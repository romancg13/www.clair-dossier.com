// Edge Function: mail-oauth — autorisation OAuth d'une messagerie (Gmail /
// Google Workspace, Outlook / Microsoft 365), LECTURE SEULE.
//
// Étapes (toutes côté serveur ; le navigateur ne voit jamais un jeton) :
//  1. POST {action:"start", provider, dossier_id?} + jeton du titulaire
//     → droit par offre vérifié (mail_connect_included), connexion « pending »
//       créée, URL d'autorisation OFFICIELLE renvoyée (state signé + PKCE S256,
//       permissions gmail.readonly / Mail.Read + offline_access).
//  2. GET ?code&state (retour du fournisseur) → state vérifié (signature,
//     10 min), puis simple RELAIS vers ClairDossier (#mail_code / #mail_state).
//     Rien n'est échangé ici : ce retour n'est pas authentifié.
//  3. POST {action:"finish", code, state} + jeton du titulaire → le state doit
//     appartenir à CE compte (sinon refus : empêche de relier la boîte d'un
//     tiers au compte de quelqu'un d'autre), échange du code (PKCE + secret
//     client), jetons chiffrés AES-GCM (MAIL_TOKEN_KEY), surveillance créée
//     (users.watch / abonnement Graph). La connexion reste « pending » :
//     « connected » n'arrive qu'après une première réception réelle (mail-sync).
//  4. POST {action:"disconnect", connection_id} + jeton du titulaire → arrêt de
//     la surveillance, révocation chez Google (Microsoft : pas de point de
//     révocation OAuth — l'abonnement est supprimé), puis RPC
//     mail_connection_disconnect : statut révoqué ET jetons effacés.
//
// NON VÉRIFIÉ DE BOUT EN BOUT (2026-11-25) : aucun identifiant OAuth Google ni
// Microsoft disponible. La logique (URL, state, PKCE, chiffrement, échange,
// surveillance) est couverte par tests/mail-connect.test.ts avec un réseau
// simulé ; le premier essai réel reste à faire (docs/recette/MESSAGERIE_DIRECTE.md).
//
// Déploiement : supabase functions deploy mail-oauth --no-verify-jwt
// (le retour du fournisseur arrive sans jeton ; start/finish/disconnect
// vérifient eux-mêmes le jeton du titulaire).
// Secrets : MAIL_TOKEN_KEY, MAIL_STATE_SECRET, GOOGLE_OAUTH_CLIENT_ID,
// GOOGLE_OAUTH_CLIENT_SECRET, MICROSOFT_OAUTH_CLIENT_ID,
// MICROSOFT_OAUTH_CLIENT_SECRET, MAIL_OAUTH_REDIRECT_URL,
// MAIL_CONNECT_RETURN_URL, GMAIL_PUBSUB_TOPIC, MAIL_GRAPH_NOTIFICATION_URL,
// INBOUND_EMAIL_DOMAIN (facultatif) ; SUPABASE_URL / SUPABASE_ANON_KEY /
// SUPABASE_SERVICE_ROLE_KEY injectés par la plateforme.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  OAUTH_ENDPOINTS,
  STATE_TTL_S,
  addressFromIdToken,
  buildAuthorizeUrl,
  buildTokenExchangeBody,
  deriveClientState,
  derivePkceVerifier,
  pkceChallenge,
  randomNonce,
  signState,
  verifyState,
  type MailProvider,
} from '../_shared/mail-connect.ts';
import { GMAIL_API, ensureWatch, stopWatch, type MailConnection, type MailDeps } from '../_shared/mail-sync-core.ts';
import { CONNECTION_COLUMNS, createMailStore } from '../_shared/mail-store.ts';

const env = (k: string): string => Deno.env.get(k) ?? '';
const SUPABASE_URL = env('SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY');
const SERVICE_ROLE = env('SUPABASE_SERVICE_ROLE_KEY');
const TOKEN_KEY = env('MAIL_TOKEN_KEY');
const STATE_SECRET = env('MAIL_STATE_SECRET');
const REDIRECT_URL = env('MAIL_OAUTH_REDIRECT_URL');
const RETURN_URL = env('MAIL_CONNECT_RETURN_URL');
const OAUTH: Record<MailProvider, { clientId: string; clientSecret: string }> = {
  gmail: { clientId: env('GOOGLE_OAUTH_CLIENT_ID'), clientSecret: env('GOOGLE_OAUTH_CLIENT_SECRET') },
  microsoft: { clientId: env('MICROSOFT_OAUTH_CLIENT_ID'), clientSecret: env('MICROSOFT_OAUTH_CLIENT_SECRET') },
};

const SITE = 'https://www.clair-dossier.com';
const ALLOWED_ORIGINS = new Set([SITE, 'https://clair-dossier.com', 'https://clair-dossier.netlify.app', 'http://localhost:5173', 'http://localhost:4173']);

const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
const store = createMailStore(db, { tokenKey: TOKEN_KEY, inboundDomain: env('INBOUND_EMAIL_DOMAIN') });
const deps: MailDeps = {
  fetch,
  store,
  now: () => Date.now(),
  oauth: OAUTH,
  pubsubTopic: env('GMAIL_PUBSUB_TOPIC'),
  graphNotificationUrl: env('MAIL_GRAPH_NOTIFICATION_URL'),
  clientStateFor: (id) => deriveClientState(STATE_SECRET, id),
};

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}

function providerReady(p: MailProvider): boolean {
  if (!OAUTH[p].clientId || !OAUTH[p].clientSecret) return false;
  return p === 'gmail' ? !!deps.pubsubTopic : !!deps.graphNotificationUrl;
}

/** Retour vers ClairDossier : les valeurs passent dans le FRAGMENT (jamais
 *  envoyé à un serveur ni journalisé par l'hébergeur du site). */
function relay(params: Record<string, string>): Response {
  const target = new URL(RETURN_URL || `${SITE}/compte`);
  target.hash = new URLSearchParams(params).toString();
  return new Response(null, { status: 302, headers: { Location: target.toString(), 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

async function callerId(req: Request): Promise<{ id: string; token: string } | null> {
  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data, error } = await caller.auth.getUser();
  return error || !data?.user ? null : { id: data.user.id, token };
}

async function allowed(userId: string): Promise<boolean> {
  const inc = await db.rpc('mail_connect_included', { p_user: userId });
  if (inc.data === true) return true;
  const { data: admin } = await db.from('app_admins').select('user_id').eq('user_id', userId).maybeSingle();
  return !!admin;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const headers = cors(req.headers.get('origin'));
  const reply = (status: number, body: Record<string, unknown>) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE || !TOKEN_KEY || !STATE_SECRET || !REDIRECT_URL) {
    return req.method === 'GET' ? relay({ mail_error: 'indisponible' }) : reply(503, { error: 'CONFIGURATION_INCOMPLETE' });
  }

  // ── 2. Retour du fournisseur (non authentifié) : relais uniquement ─────────
  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    const state = q.get('state');
    const payload = await verifyState(STATE_SECRET, state);
    if (!payload) return relay({ mail_error: 'state_invalide' });
    const code = q.get('code');
    if (q.get('error') || !code) return relay({ mail_error: q.get('error') === 'access_denied' ? 'refus' : 'echec' });
    if (code.length > 4096) return relay({ mail_error: 'echec' });
    return relay({ mail_code: code, mail_state: state as string });
  }
  if (req.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' });

  const caller = await callerId(req);
  if (!caller) return reply(401, { error: 'AUTH_REQUIRED' });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return reply(400, { error: 'BAD_REQUEST' });
  }

  // ── 1. Démarrage ───────────────────────────────────────────────────────────
  if (body.action === 'start') {
    const provider = body.provider === 'gmail' || body.provider === 'microsoft' ? (body.provider as MailProvider) : null;
    if (!provider) return reply(400, { error: 'BAD_PROVIDER' });
    if (!providerReady(provider)) return reply(503, { error: 'PROVIDER_NOT_CONFIGURED' });
    if (!(await allowed(caller.id))) return reply(403, { error: 'FEATURE_NOT_INCLUDED' });

    let dossierId: string | null = null;
    if (typeof body.dossier_id === 'string' && body.dossier_id) {
      const { data: d } = await db.from('dossiers').select('id,user_id,deleted_at').eq('id', body.dossier_id).maybeSingle();
      if (!d || d.user_id !== caller.id || d.deleted_at) return reply(403, { error: 'FORBIDDEN' });
      dossierId = d.id as string;
    }

    // Une connexion non révoquée au plus par (compte, fournisseur) : une
    // tentative restée sans jetons est reprise ; une connexion réelle bloque.
    const { data: existing } = await db.from('mail_connections').select('id').eq('user_id', caller.id).eq('provider', provider).neq('status', 'revoked').maybeSingle();
    let connectionId: string;
    if (existing) {
      const { data: tok } = await db.from('mail_connection_tokens').select('connection_id').eq('connection_id', existing.id).maybeSingle();
      if (tok) return reply(409, { error: 'ALREADY_CONNECTED' });
      connectionId = existing.id as string;
      // Périmètre : repart de maintenant ; historique global toujours désactivé.
      await db.from('mail_connections').update({ status: 'pending', import_since: new Date().toISOString(), history_import: false, dossier_id: dossierId, last_error: null }).eq('id', connectionId);
    } else {
      const ins = await db.from('mail_connections').insert({ user_id: caller.id, provider, dossier_id: dossierId }).select('id').maybeSingle();
      if (ins.error || !ins.data) return reply(500, { error: 'CREATE_FAILED' });
      connectionId = ins.data.id as string;
    }
    const nonce = randomNonce();
    const state = await signState(STATE_SECRET, { c: connectionId, u: caller.id, p: provider, n: nonce, e: Math.floor(Date.now() / 1000) + STATE_TTL_S });
    const challenge = await pkceChallenge(await derivePkceVerifier(STATE_SECRET, connectionId, nonce));
    await db.from('mail_connection_events').insert({ connection_id: connectionId, user_id: caller.id, type: 'autorisation_demandee', detail: provider });
    return reply(200, { url: buildAuthorizeUrl({ provider, clientId: OAUTH[provider].clientId, redirectUri: REDIRECT_URL, state, codeChallenge: challenge }) });
  }

  // ── 3. Finalisation (authentifiée) ─────────────────────────────────────────
  if (body.action === 'finish') {
    const payload = await verifyState(STATE_SECRET, typeof body.state === 'string' ? body.state : null);
    const code = typeof body.code === 'string' ? body.code : '';
    if (!payload || !code) return reply(400, { error: 'STATE_INVALID' });
    // Le state doit avoir été émis pour CE compte.
    if (payload.u !== caller.id) return reply(403, { error: 'STATE_FOREIGN' });
    const { data: row } = await db.from('mail_connections').select(CONNECTION_COLUMNS).eq('id', payload.c).maybeSingle();
    const conn = row as MailConnection | null;
    if (!conn || conn.user_id !== caller.id || conn.provider !== payload.p || conn.status !== 'pending') return reply(409, { error: 'CONNECTION_NOT_PENDING' });
    const { data: tok } = await db.from('mail_connection_tokens').select('connection_id').eq('connection_id', conn.id).maybeSingle();
    if (tok) return reply(409, { error: 'ALREADY_CONNECTED' });
    if (!(await allowed(caller.id))) return reply(403, { error: 'FEATURE_NOT_INCLUDED' });

    const res = await fetch(OAUTH_ENDPOINTS[conn.provider].token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildTokenExchangeBody({
        provider: conn.provider,
        clientId: OAUTH[conn.provider].clientId,
        clientSecret: OAUTH[conn.provider].clientSecret,
        redirectUri: REDIRECT_URL,
        code,
        codeVerifier: await derivePkceVerifier(STATE_SECRET, conn.id, payload.n),
      }).toString(),
    }).catch(() => null);
    const out = res ? ((await res.json().catch(() => null)) as { access_token?: string; refresh_token?: string; expires_in?: number; id_token?: string } | null) : null;
    if (!res || !res.ok || !out?.access_token) {
      console.error(`mail-oauth: échange refusé (HTTP ${res?.status ?? 'réseau'})`);
      return reply(502, { error: 'EXCHANGE_FAILED' });
    }
    // Sans jeton de rafraîchissement, aucune synchronisation durable : refus.
    if (!out.refresh_token) return reply(502, { error: 'NO_REFRESH_TOKEN' });

    let address = '';
    if (conn.provider === 'gmail') {
      const p = await fetch(`${GMAIL_API}/profile`, { headers: { Authorization: `Bearer ${out.access_token}` } }).catch(() => null);
      const prof = p?.ok ? ((await p.json().catch(() => null)) as { emailAddress?: string } | null) : null;
      address = typeof prof?.emailAddress === 'string' ? prof.emailAddress.toLowerCase() : '';
      // Sans adresse, les notifications Pub/Sub ne pourraient pas être routées.
      if (!address) return reply(502, { error: 'PROFILE_FAILED' });
    } else {
      address = addressFromIdToken(out.id_token);
    }

    // Boîte déjà reliée à un autre compte : index unique → refus, rien n'est gardé.
    const upd = await db.from('mail_connections').update({ address, import_since: new Date().toISOString(), last_error: null }).eq('id', conn.id);
    if (upd.error) return reply(409, { error: 'MAILBOX_ALREADY_LINKED' });
    conn.address = address;
    conn.import_since = new Date().toISOString();

    await store.saveTokens(conn, { accessToken: out.access_token, accessExpiresAtMs: Date.now() + Math.max(60, Number(out.expires_in) || 3600) * 1000, refreshToken: out.refresh_token });
    await store.logEvent(conn, 'autorisation_accordee', null);
    try {
      await ensureWatch(conn, deps);
      await store.logEvent(conn, 'surveillance_creee', null);
    } catch (e) {
      // La surveillance sera retentée au passage planifié de mail-sync.
      await store.updateConnection(conn.id, { last_error: ((e as Error)?.message ?? 'surveillance').slice(0, 500) });
    }
    // Statut toujours « pending » : confirmé seulement par une réception réelle.
    return reply(200, { status: 'pending', provider: conn.provider });
  }

  // ── 4. Déconnexion ─────────────────────────────────────────────────────────
  if (body.action === 'disconnect') {
    const id = typeof body.connection_id === 'string' ? body.connection_id : '';
    const { data: row } = await db.from('mail_connections').select(CONNECTION_COLUMNS).eq('id', id).maybeSingle();
    const conn = row as MailConnection | null;
    if (!conn || conn.user_id !== caller.id) return reply(403, { error: 'FORBIDDEN' });
    let providerRevoked = false;
    if (conn.status !== 'revoked') {
      const tokens = await store.loadTokens(conn).catch(() => null);
      if (tokens) {
        await stopWatch(conn, deps);
        const revokeUrl = OAUTH_ENDPOINTS[conn.provider].revoke;
        if (revokeUrl) {
          const r = await fetch(revokeUrl, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ token: tokens.refreshToken }).toString() }).catch(() => null);
          providerRevoked = !!r?.ok;
        }
      }
    }
    // Statut révoqué ET jetons effacés, sous l'identité du titulaire (RPC).
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${caller.token}` } }, auth: { persistSession: false } });
    const rpc = await asCaller.rpc('mail_connection_disconnect', { p_connection: conn.id });
    if (rpc.error) return reply(500, { error: 'DISCONNECT_FAILED' });
    return reply(200, { status: 'revoked', provider_revoked: providerRevoked });
  }

  return reply(400, { error: 'BAD_ACTION' });
});
