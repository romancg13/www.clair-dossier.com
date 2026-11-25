// Serveur MCP de suivi privé (lecture seule) + serveur d'autorisation OAuth 2.1.
//  - Enregistrement dynamique (RFC 7591), PKCE S256 obligatoire, paramètre resource (RFC 8707),
//    métadonnées RFC 9728 / RFC 8414, révocation (RFC 7009) ; jetons opaques, empreinte seule stockée.
//  - Un client (ChatGPT, Claude Code, claude.ai…) = un enregistrement et des jetons distincts.
//  - Outils : état d'un dossier, dernière livraison, anomalies techniques — jamais le contenu des pièces.
//  - Transport Streamable HTTP, réponses JSON ; compatible « initialize » (2025-06-18 / 2025-11-25)
//    et requêtes sans poignée de main (2026-07-28, server/discover).
import { currentUser, type ApiEnv } from './api.ts';
import { sha, token, safeEqual } from './security.ts';
import { RecetteStore, jobEnCours, type UserRec } from './store.ts';
import type { RenduView } from '../../supabase/functions/_shared/rendus/index.ts';

const SCOPE = 'dossiers:lecture';
const ACCESS_TTL = 3600, REFRESH_TTL = 30 * 86_400;
const SUPPORTED = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'];

interface Client { client_id: string; client_name: string; redirect_uris: string[]; created_at: string }
/** `gen` : génération du lien client ↔ compte à l'émission (un retrait du lien invalide définitivement les jetons émis avant). */
interface Grant { user_id: string; client_id: string; scope: string; exp: number; kind: 'access' | 'refresh' | 'code'; redirect_uri?: string; challenge?: string; resource?: string; gen?: string }
/** Lien client ↔ compte ; une nouvelle génération est tirée quand le lien est recréé après un retrait. */
interface Link { client_id: string; since: string; gen?: string }
const linkKey = (userId: string, clientId: string) => `oauth/links/${userId}/${clientId}.json`;
/** Seuls ces paramètres sont repris dans le formulaire de consentement : jamais « decision » ni « csrf » venus de l'adresse. */
const AUTHZ_PARAMS = ['response_type', 'client_id', 'redirect_uri', 'code_challenge', 'code_challenge_method', 'state', 'resource', 'scope'];
/** Ressource (RFC 8707) sans barre finale : `${site}/mcp` et `${site}/mcp/` désignent le même serveur. */
const canon = (r: string) => r.replace(/\/+$/, '');

const j = (data: unknown, status = 200, h: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-expose-headers': 'WWW-Authenticate, Mcp-Session-Id', 'x-robots-tag': 'noindex', ...h } });
const html = (s: string, status = 200) => new Response(s, { status, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex', 'x-frame-options': 'DENY', 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' https: http://localhost:* http://127.0.0.1:*" } });
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const okRedirect = (u: string) => /^https:\/\//.test(u) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u);
const b64url = (b: ArrayBuffer) => Buffer.from(b).toString('base64url');

export async function handleOAuth(env: ApiEnv, req: Request, url: URL): Promise<Response> {
  const site = env.siteUrl;
  const p = url.pathname;
  const s = env.store.kv;
  if (req.method === 'OPTIONS') return j({}, 204);
  if (p.startsWith('/.well-known/oauth-protected-resource')) return j({ resource: `${site}/mcp`, authorization_servers: [site], scopes_supported: [SCOPE], bearer_methods_supported: ['header'], resource_name: 'ClairDossier — suivi privé (recette)' });
  if (p === '/.well-known/oauth-authorization-server' || p === '/.well-known/openid-configuration')
    return j({ issuer: site, authorization_endpoint: `${site}/oauth/authorize`, token_endpoint: `${site}/oauth/token`, registration_endpoint: `${site}/oauth/register`, revocation_endpoint: `${site}/oauth/revoke`, response_types_supported: ['code'], grant_types_supported: ['authorization_code', 'refresh_token'], code_challenge_methods_supported: ['S256'], token_endpoint_auth_methods_supported: ['none'], scopes_supported: [SCOPE], authorization_response_iss_parameter_supported: true });

  if (p === '/oauth/register' && req.method === 'POST') {
    const b = (await req.json().catch(() => ({}))) as { redirect_uris?: string[]; client_name?: string };
    const uris = (b.redirect_uris ?? []).filter((u) => typeof u === 'string' && okRedirect(u)).slice(0, 10);
    if (!uris.length) return j({ error: 'invalid_redirect_uri' }, 400);
    const c: Client = { client_id: `cd_${token(12)}`, client_name: (b.client_name ?? 'Client MCP').slice(0, 80), redirect_uris: uris, created_at: env.store.now().toISOString() };
    await s.putJson(`oauth/clients/${c.client_id}.json`, c);
    return j({ client_id: c.client_id, client_name: c.client_name, redirect_uris: c.redirect_uris, token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }, 201);
  }

  if (p === '/oauth/authorize') {
    const q = req.method === 'POST' ? new URLSearchParams(await req.text()) : url.searchParams;
    const client = (await s.getJson<Client>(`oauth/clients/${q.get('client_id') ?? '-'}.json`))?.value;
    const redirect = q.get('redirect_uri') ?? '';
    // Loopback : le port est ignoré (Claude Code choisit un port éphémère).
    const loop = (u: string) => u.replace(/^(http:\/\/(?:localhost|127\.0\.0\.1)):\d+/, '$1');
    if (!client || !client.redirect_uris.some((u) => u === redirect || loop(u) === loop(redirect))) return html('<p>Client ou adresse de retour inconnus.</p>', 400);
    if (q.get('response_type') !== 'code' || q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge')) return html('<p>Requête d’autorisation invalide (PKCE S256 requis).</p>', 400);
    const back = new URL(redirect);
    if (q.get('state')) back.searchParams.set('state', q.get('state')!);
    back.searchParams.set('iss', site);
    // Jetons réservés à ce serveur (RFC 8707) : toute autre ressource est refusée avant le consentement.
    const resources = q.getAll('resource');
    if (resources.length > 1 || (resources.length === 1 && canon(resources[0]) !== `${site}/mcp`)) {
      back.searchParams.set('error', 'invalid_target');
      return Response.redirect(back.toString(), 302);
    }
    const user = await currentUser(env, req);
    if (!user) return Response.redirect(`${site}/connexion?next=${encodeURIComponent(url.pathname + '?' + q.toString())}`, 302);
    const csrf = sha(`${env.secret}|${user.id}|${q.get('client_id')}|${q.get('code_challenge')}`);
    if (req.method === 'POST') {
      // Une seule décision et un seul jeton : une valeur glissée dans l'adresse ne peut pas l'emporter sur le bouton cliqué.
      if (q.getAll('decision').length !== 1 || q.getAll('csrf').length !== 1) return html('<p>Requête invalide.</p>', 400);
      if (!safeEqual(q.get('csrf') ?? '', csrf)) return html('<p>Formulaire expiré.</p>', 400);
      if (q.get('decision') !== 'autoriser') {
        back.searchParams.set('error', 'access_denied');
      } else {
        const code = token();
        await s.putJson(`oauth/grants/${sha(code)}.json`, { user_id: user.id, client_id: client.client_id, scope: SCOPE, exp: Date.now() + 5 * 60_000, kind: 'code', redirect_uri: redirect, challenge: q.get('code_challenge')!, resource: `${site}/mcp` } satisfies Grant);
        back.searchParams.set('code', code);
      }
      return Response.redirect(back.toString(), 302);
    }
    const hidden = AUTHZ_PARAMS.filter((k) => q.has(k)).map((k) => `<input type="hidden" name="${k}" value="${esc(q.get(k)!)}">`).join('');
    return html(`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Autoriser l'accès — ClairDossier</title>
<body style="font-family:system-ui,sans-serif;background:#faf8f3;color:#0d1b3d;max-width:520px;margin:48px auto;padding:0 16px">
<p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#4a5366">ClairDossier · recette</p>
<h1 style="font-size:24px">Autoriser « ${esc(client.client_name)} » ?</h1>
<p>Connecté en tant que <strong>${esc(user.email)}</strong>.</p>
<p>Cette application pourra <strong>lire l’état de vos dossiers</strong> : situation, prochaine action, dates, dernière livraison et anomalies techniques. Elle <strong>ne pourra pas</strong> lire vos pièces, déposer, modifier, supprimer ni envoyer quoi que ce soit.</p>
<p style="font-size:14px;color:#4a5366">Vous pouvez retirer cet accès à tout moment depuis votre compte.</p>
<form method="post" action="/oauth/authorize">${hidden}<input type="hidden" name="csrf" value="${csrf}">
<button name="decision" value="autoriser" style="background:#0d1b3d;color:#fff;border:0;border-radius:999px;padding:12px 22px;font-size:16px">Autoriser</button>
<button name="decision" value="refuser" style="background:none;border:1px solid #c4a456;border-radius:999px;padding:12px 22px;font-size:16px;margin-left:8px">Refuser</button></form></body></html>`);
  }

  if (p === '/oauth/token' && req.method === 'POST') {
    const q = new URLSearchParams(await req.text());
    const issue = async (g: Grant) => {
      const access = token(), refresh = token();
      const now = Date.now();
      let gen = g.gen;
      if (g.kind === 'code') {
        // Nouvelle autorisation : génération du lien en place, ou NOUVELLE génération si le lien a été retiré
        // (les jetons émis avant le retrait portent l'ancienne et restent refusés).
        const lk = linkKey(g.user_id, g.client_id);
        const cur = (await s.getJson<Link>(lk))?.value;
        if (cur) gen = cur.gen;
        else {
          const fresh: Link = { client_id: g.client_id, since: new Date(now).toISOString(), gen: token(12) };
          const w = await s.putJson(lk, fresh, { create: true });
          gen = w.ok ? fresh.gen : ((await s.getJson<Link>(lk, { fresh: true }))?.value.gen ?? fresh.gen);
        }
      }
      await s.putJson(`oauth/grants/${sha(access)}.json`, { ...g, gen, kind: 'access', exp: now + ACCESS_TTL * 1000 } satisfies Grant);
      await s.putJson(`oauth/grants/${sha(refresh)}.json`, { ...g, gen, kind: 'refresh', exp: now + REFRESH_TTL * 1000 } satisfies Grant);
      return j({ access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL, refresh_token: refresh, scope: g.scope });
    };
    if (q.get('grant_type') === 'authorization_code') {
      const code = q.get('code') ?? '';
      const g = (await s.getJson<Grant>(`oauth/grants/${sha(code)}.json`))?.value;
      await s.delete(`oauth/grants/${sha(code)}.json`); // usage unique
      if (!g || g.kind !== 'code' || g.exp < Date.now() || g.client_id !== q.get('client_id') || g.redirect_uri !== q.get('redirect_uri')) return j({ error: 'invalid_grant' }, 400);
      const verifier = q.get('code_verifier') ?? '';
      const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
      if (!g.challenge || !safeEqual(challenge, g.challenge)) return j({ error: 'invalid_grant', error_description: 'PKCE' }, 400);
      return issue(g);
    }
    if (q.get('grant_type') === 'refresh_token') {
      const r = q.get('refresh_token') ?? '';
      const g = (await s.getJson<Grant>(`oauth/grants/${sha(r)}.json`))?.value;
      if (!g || g.kind !== 'refresh' || g.exp < Date.now() || g.client_id !== q.get('client_id')) return j({ error: 'invalid_grant' }, 400);
      if (!(await linkValid(env, g))) return j({ error: 'invalid_grant' }, 400); // accès retiré (ou retiré puis accordé de nouveau)
      await s.delete(`oauth/grants/${sha(r)}.json`); // rotation
      return issue(g);
    }
    return j({ error: 'unsupported_grant_type' }, 400);
  }
  if (p === '/oauth/revoke' && req.method === 'POST') {
    const q = new URLSearchParams(await req.text());
    await s.delete(`oauth/grants/${sha(q.get('token') ?? '')}.json`);
    return new Response(null, { status: 200 });
  }
  return j({ error: 'not_found' }, 404);
}

/** Lien client ↔ compte présent ET de la génération du jeton : un retrait reste définitif pour les jetons émis avant. */
async function linkValid(env: ApiEnv, g: Grant): Promise<boolean> {
  const l = (await env.store.kv.getJson<Link>(linkKey(g.user_id, g.client_id)))?.value;
  return Boolean(l) && l!.gen === g.gen;
}

/** Jeton d'accès valide, émis pour ce serveur (RFC 8707), et lien client ↔ compte non retiré. */
async function bearerUser(env: ApiEnv, req: Request): Promise<{ user: UserRec; client: string } | null> {
  const t = /^Bearer (.+)$/.exec(req.headers.get('authorization') ?? '')?.[1];
  if (!t) return null;
  const g = (await env.store.kv.getJson<Grant>(`oauth/grants/${sha(t)}.json`))?.value;
  if (!g || g.kind !== 'access' || g.exp < Date.now()) return null;
  if (canon(g.resource ?? '') !== `${env.siteUrl}/mcp`) return null;
  if (!(await linkValid(env, g))) return null;
  const user = await env.store.getUser(g.user_id);
  return user ? { user, client: g.client_id } : null;
}

const TOOLS = [
  { name: 'lister_dossiers', title: 'Lister mes dossiers', description: "Liste les dossiers du compte avec leur état et leur prochaine action. Lecture seule, sans contenu de pièce.", inputSchema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'etat_dossier', title: "État d'un dossier", description: "Situation datée, prochaine action, prochaine date et couverture de l'analyse d'un dossier autorisé.", inputSchema: { type: 'object', properties: { dossier_id: { type: 'string' } }, required: ['dossier_id'], additionalProperties: false } },
  { name: 'derniere_livraison', title: 'Dernière livraison', description: 'Révision et date de publication de chaque rendu (noms de fichiers, sans lien ni contenu).', inputSchema: { type: 'object', properties: { dossier_id: { type: 'string' } }, required: ['dossier_id'], additionalProperties: false } },
  { name: 'anomalies_techniques', title: 'Anomalies techniques', description: 'Travaux en échec, lectures reportées et alertes (identifiants et compteurs seulement).', inputSchema: { type: 'object', properties: { dossier_id: { type: 'string' } }, additionalProperties: false } },
  { name: 'search', title: 'Rechercher un dossier', description: 'Recherche par titre parmi les dossiers autorisés.', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'], additionalProperties: false } },
  { name: 'fetch', title: 'Lire un dossier', description: "Renvoie l'état d'un dossier par son identifiant.", inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false } },
].map((t) => ({ ...t, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true } }));

async function callTool(env: ApiEnv, user: UserRec, name: string, args: Record<string, unknown>): Promise<unknown> {
  const s = env.store;
  if (!(await s.entitlementActive(user.id)) && user.role !== 'admin') return { erreur: 'Abonnement inactif : accès au suivi suspendu.' };
  const own = async (id: unknown) => {
    const d = typeof id === 'string' ? await s.getDossierRec(id) : null;
    return d && !d.deleted && (d.user_id === user.id || user.role === 'admin') ? d : null;
  };
  const etat = async (id: unknown) => {
    const d = await own(id);
    if (!d) return { erreur: 'Dossier introuvable.' };
    const v = await s.getView(d.id);
    const view = v?.status === 'approved' ? (v.view as RenduView) : null;
    const jobs = await s.openJobs(d.id);
    return { id: d.id, titre: d.title, cloture: d.closed, traitement_en_cours: jobs.some((x) => jobEnCours(x, s.now())), revision: v?.revision ?? null, situation: view?.tableau.situation ?? null, prochaine_action: view?.tableau.action ?? null, prochaine_date: view?.tableau.next_date ? { date: view.tableau.next_date.date, libelle: view.tableau.next_date.title, statut: view.tableau.next_date.status } : null, couverture: view?.dossier.coverage_label ?? null, url: `${env.siteUrl}/compte/dossier/${d.id}` };
  };
  switch (name) {
    case 'lister_dossiers':
    case 'search': {
      const list = user.role === 'admin' ? [] : await s.listUserDossiers(user.id);
      const q = String(args.query ?? '').toLowerCase();
      const rows = list.filter((d) => !q || d.title.toLowerCase().includes(q));
      if (name === 'search') return { results: rows.map((d) => ({ id: d.id, title: d.title, url: `${env.siteUrl}/compte/dossier/${d.id}` })) };
      return { dossiers: await Promise.all(rows.map((d) => etat(d.id))) };
    }
    case 'etat_dossier':
      return etat(args.dossier_id);
    case 'fetch': {
      const e = await etat(args.id);
      return 'erreur' in e ? e : { id: e.id, title: e.titre, text: `${e.situation ?? 'Résultats en préparation.'}\nProchaine action : ${e.prochaine_action?.label ?? '—'}`, url: e.url };
    }
    case 'derniere_livraison': {
      const d = await own(args.dossier_id);
      if (!d) return { erreur: 'Dossier introuvable.' };
      const pub = await s.getPublished(d.id);
      return { dossier_id: d.id, rendus: Object.values(pub).filter((c) => c?.status === 'approved').map((c) => ({ categorie: c!.category, revision: c!.revision, publie_le: c!.published_at, fichiers: c!.files.map((f) => f.name), versions_precedentes: c!.previous.length })) };
    }
    case 'anomalies_techniques': {
      const ids = args.dossier_id ? [(await own(args.dossier_id))?.id].filter(Boolean) as string[] : user.role === 'admin' ? null : (await s.listUserDossiers(user.id)).map((d) => d.id);
      // Client : seuls les travaux de SES dossiers sont lus (jamais la file des autres clients).
      const jobs = ids ? (await Promise.all(ids.map((id) => s.openJobs(id)))).flat() : [...(await s.allOpenJobs()), ...(await s.failedJobs())];
      const alerts = (await s.alerts()).filter((a) => !ids || ids.includes(String(a.meta.dossier ?? '')));
      return { travaux_en_echec: jobs.filter((x) => x.status === 'failed').map((x) => ({ type: x.kind, dossier_id: x.dossier_id, tentatives: x.attempts })), travaux_en_attente: jobs.filter((x) => x.status !== 'failed').length, alertes: alerts.slice(0, 20).map((a) => ({ code: a.code, le: a.at, dossier_id: a.meta.dossier ?? null })) };
    }
  }
  return { erreur: 'Outil inconnu.' };
}

export async function handleMcp(env: ApiEnv, req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return j({}, 204);
  if (req.method !== 'POST') return j({ error: 'POST uniquement' }, 405, { allow: 'POST' });
  const auth = await bearerUser(env, req);
  if (!auth) return j({ jsonrpc: '2.0', error: { code: -32001, message: 'Authentification requise' }, id: null }, 401, { 'www-authenticate': `Bearer resource_metadata="${env.siteUrl}/.well-known/oauth-protected-resource", scope="${SCOPE}"` });
  const msg = (await req.json().catch(() => null)) as { jsonrpc: string; id?: number | string; method: string; params?: Record<string, unknown> } | null;
  if (!msg || msg.jsonrpc !== '2.0') return j({ jsonrpc: '2.0', error: { code: -32700, message: 'JSON-RPC invalide' }, id: null }, 400);
  if (msg.id === undefined) return new Response(null, { status: 202 });
  const meta = (msg.params?._meta ?? {}) as Record<string, unknown>;
  const modern = meta['io.modelcontextprotocol/protocolVersion'] === '2026-07-28' || req.headers.get('mcp-protocol-version') === '2026-07-28';
  const done = (result: Record<string, unknown>) => j({ jsonrpc: '2.0', id: msg.id, result: modern ? { resultType: 'complete', ...result } : result });
  const info = { name: 'clairdossier-suivi', title: 'ClairDossier — suivi privé', version: '0.1.0' };
  switch (msg.method) {
    case 'initialize': {
      const asked = String(msg.params?.protocolVersion ?? '2025-06-18');
      return done({ protocolVersion: SUPPORTED.includes(asked) ? asked : '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: info, instructions: "Lecture seule : état des dossiers, dernière livraison, anomalies techniques. Aucune pièce n'est exposée." });
    }
    case 'server/discover':
      return done({ supportedVersions: SUPPORTED, capabilities: { tools: {} }, serverInfo: info, instructions: 'Lecture seule ; aucune pièce exposée.' });
    case 'ping':
      return done({});
    case 'tools/list':
      return done({ tools: TOOLS, ...(modern ? { ttlMs: 3_600_000, cacheScope: 'user' } : {}) });
    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      const out = await callTool(env, auth.user, name, (msg.params?.arguments ?? {}) as Record<string, unknown>);
      return done({ content: [{ type: 'text', text: JSON.stringify(out) }], structuredContent: out, isError: Boolean((out as { erreur?: string }).erreur) });
    }
  }
  return j({ jsonrpc: '2.0', id: msg.id, error: { code: -32601, message: 'Méthode inconnue' } });
}

/** Connexions OAuth actives d'un compte (pour affichage et retrait). */
export async function listConnections(store: RecetteStore, userId: string) {
  const keys = await store.kv.list(`oauth/links/${userId}/`);
  const out = [];
  for (const k of keys) {
    const l = (await store.kv.getJson<Link>(k))?.value;
    const c = l ? (await store.kv.getJson<Client>(`oauth/clients/${l.client_id}.json`))?.value : null;
    if (l) out.push({ client_id: l.client_id, nom: c?.client_name ?? 'Client MCP', depuis: l.since });
  }
  return out;
}
