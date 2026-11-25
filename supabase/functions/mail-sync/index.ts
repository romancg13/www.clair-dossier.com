// Edge Function: mail-sync — synchronisation des messageries connectées
// (Gmail / Google Workspace, Outlook / Microsoft 365), LECTURE SEULE.
//
// Entrées :
//  - POST ?source=gmail : push Pub/Sub. Le jeton OIDC Google de l'en-tête
//    Authorization est vérifié (signature RS256 par les clés Google, émetteur,
//    audience GMAIL_PUBSUB_AUDIENCE, compte de service
//    GMAIL_PUBSUB_SERVICE_ACCOUNT) — sinon 401. La notification ne sert que de
//    signal : la boîte est relue depuis le curseur enregistré (historyId).
//  - POST ?source=graph : notifications et événements de cycle de vie Microsoft
//    Graph. `validationToken` renvoyé tel quel (text/plain, 200) ; chaque
//    notification doit porter le clientState dérivé de SA connexion — sinon
//    ignorée. missed / subscriptionRemoved / reauthorizationRequired →
//    reprise par delta et renouvellement.
//  - POST ?action=tick (en-tête x-mail-cron-secret = MAIL_CRON_SECRET) : passage
//    planifié — renouvellement des surveillances (Gmail : au moins tous les
//    7 jours ; Graph : < 7 jours), rattrapage par curseur des notifications
//    perdues, import des messages classés par le titulaire, nettoyage des
//    autorisations abandonnées.
//  - POST ?action=import + jeton du titulaire : import immédiat de SES messages
//    qu'il vient de classer (statut queued).
//
// Garanties : jamais d'effacement ni de modification d'un e-mail, jamais
// d'envoi, aucun lien d'e-mail suivi (voir _shared/mail-sync-core.ts) ; les
// e-mails sont des DONNÉES, jamais des instructions ; une connexion en pause
// ou révoquée n'est jamais interrogée ; « connected » uniquement après une
// réception réelle ; le droit par offre est revérifié à chaque passage.
//
// NON VÉRIFIÉ DE BOUT EN BOUT (2026-11-25) : aucun projet Google Cloud ni
// application Microsoft Entra disponibles. Logique couverte par
// tests/mail-connect.test.ts (réseau simulé).
//
// Déploiement : supabase functions deploy mail-sync --no-verify-jwt
// Secrets : ceux de mail-oauth + GMAIL_PUBSUB_AUDIENCE,
// GMAIL_PUBSUB_SERVICE_ACCOUNT, MAIL_CRON_SECRET.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  GOOGLE_JWKS_URL,
  deriveClientState,
  graphValidationToken,
  isSyncable,
  parseGraphNotifications,
  parsePubSubPush,
  safeEqual,
  verifyGoogleOidcToken,
  type Jwk,
  type MailProvider,
} from '../_shared/mail-connect.ts';
import { ensureWatch, importQueuedMessage, renewIfNeeded, syncConnection, type MailConnection, type MailDeps } from '../_shared/mail-sync-core.ts';
import { CONNECTION_COLUMNS, createMailStore } from '../_shared/mail-store.ts';

const env = (k: string): string => Deno.env.get(k) ?? '';
const SUPABASE_URL = env('SUPABASE_URL');
const ANON_KEY = env('SUPABASE_ANON_KEY');
const SERVICE_ROLE = env('SUPABASE_SERVICE_ROLE_KEY');
const TOKEN_KEY = env('MAIL_TOKEN_KEY');
const STATE_SECRET = env('MAIL_STATE_SECRET');
const CRON_SECRET = env('MAIL_CRON_SECRET');
const PUBSUB_AUDIENCE = env('GMAIL_PUBSUB_AUDIENCE');
const PUBSUB_SERVICE_ACCOUNT = env('GMAIL_PUBSUB_SERVICE_ACCOUNT');
const OAUTH: Record<MailProvider, { clientId: string; clientSecret: string }> = {
  gmail: { clientId: env('GOOGLE_OAUTH_CLIENT_ID'), clientSecret: env('GOOGLE_OAUTH_CLIENT_SECRET') },
  microsoft: { clientId: env('MICROSOFT_OAUTH_CLIENT_ID'), clientSecret: env('MICROSOFT_OAUTH_CLIENT_SECRET') },
};

/** Rattrapage planifié : une connexion non synchronisée depuis ce délai est relue. */
const FALLBACK_SYNC_MS = 6 * 3_600_000;
/** Autorisation commencée mais jamais terminée : nettoyée après ce délai. */
const ABANDONED_MS = 3_600_000;
const TICK_BATCH = 25;
/** Import d'un message classé resté en suspens (fonction interrompue) : remis en file. */
const STALE_IMPORT_MS = 10 * 60_000;

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

const SITE = 'https://www.clair-dossier.com';
const ALLOWED_ORIGINS = new Set([SITE, 'https://clair-dossier.com', 'https://clair-dossier.netlify.app', 'http://localhost:5173', 'http://localhost:4173']);
function corsOrigin(req: Request): string {
  const origin = req.headers.get('origin');
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE;
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

/** Poursuit le travail après la réponse quand la plateforme le permet
 *  (Graph attend une réponse en moins de 3 secondes). */
function background(work: Promise<unknown>): Promise<void> | void {
  const guarded = work.catch((e) => console.error(`mail-sync: ${(e as Error)?.message ?? 'erreur'}`));
  // deno-lint-ignore no-explicit-any
  const rt = (globalThis as any).EdgeRuntime;
  if (rt && typeof rt.waitUntil === 'function') {
    rt.waitUntil(guarded);
    return;
  }
  return guarded.then(() => undefined);
}

let jwksCache: { keys: Jwk[]; at: number } | null = null;
async function googleJwks(): Promise<Jwk[]> {
  if (jwksCache && Date.now() - jwksCache.at < 3_600_000) return jwksCache.keys;
  const res = await fetch(GOOGLE_JWKS_URL).catch(() => null);
  const out = res?.ok ? ((await res.json().catch(() => null)) as { keys?: Jwk[] } | null) : null;
  if (!out || !Array.isArray(out.keys)) return jwksCache?.keys ?? [];
  jwksCache = { keys: out.keys, at: Date.now() };
  return out.keys;
}

/** Droit par offre revérifié côté serveur ; perdu → pause (jamais d'import). */
async function entitled(conn: MailConnection): Promise<boolean> {
  const inc = await db.rpc('mail_connect_included', { p_user: conn.user_id });
  if (inc.data === true) return true;
  const { data: admin } = await db.from('app_admins').select('user_id').eq('user_id', conn.user_id).maybeSingle();
  if (admin) return true;
  if (inc.error) return true; // contrôle illisible : on ne coupe pas sur une panne
  await db.from('mail_connections').update({ status: 'paused', paused_at: new Date().toISOString(), last_error: 'Offre sans connexion de messagerie : import suspendu' }).eq('id', conn.id);
  await store.logEvent(conn, 'pause', 'offre sans connexion de messagerie');
  return false;
}

async function syncOne(conn: MailConnection): Promise<void> {
  if (!isSyncable(conn.status)) return;
  if (!(await entitled(conn))) return;
  await syncConnection(conn, deps);
}

async function importQueued(filter: { userId?: string }): Promise<number> {
  // Passage planifié : un import pris en charge (queued → received) puis
  // interrompu avant sa fin est remis en file, pour ne pas rester bloqué.
  if (!filter.userId) {
    await db.from('mail_messages').update({ status: 'queued' }).eq('status', 'received').not('classified_at', 'is', null).not('dossier_id', 'is', null).lt('updated_at', new Date(Date.now() - STALE_IMPORT_MS).toISOString());
  }
  let q = db.from('mail_messages').select('id,message_id,dossier_id,connection_id').eq('status', 'queued').not('dossier_id', 'is', null).order('classified_at', { ascending: true }).limit(TICK_BATCH);
  if (filter.userId) q = q.eq('user_id', filter.userId);
  const { data: rows } = await q;
  let done = 0;
  for (const r of (rows ?? []) as { id: string; message_id: string; dossier_id: string; connection_id: string }[]) {
    const { data: c } = await db.from('mail_connections').select(CONNECTION_COLUMNS).eq('id', r.connection_id).maybeSingle();
    const conn = c as MailConnection | null;
    // Droit par offre revérifié ici aussi : « action=import » est appelable à
    // volonté par le titulaire (offre perdue → connexion mise en pause, aucun import).
    if (!conn || !isSyncable(conn.status) || !(await entitled(conn))) {
      await store.finishMessage(r.id, { status: 'error', dossier_id: r.dossier_id, error: 'connexion en pause ou révoquée : import impossible' });
      continue;
    }
    const { data: closed } = await db.rpc('dossier_is_closed', { p_dossier: r.dossier_id });
    if (closed === true) {
      await store.finishMessage(r.id, { status: 'error', dossier_id: r.dossier_id, error: 'dossier clôturé' });
      continue;
    }
    if ((await importQueuedMessage(conn, deps, r)) === 'stored') done += 1;
  }
  return done;
}

async function tick(): Promise<Record<string, number>> {
  const stats = { renewed: 0, synced: 0, imported: 0, abandoned: 0 };
  // Autorisations commencées puis abandonnées (aucun jeton) : révoquées.
  const { data: pend } = await db.from('mail_connections').select('id,user_id,created_at,updated_at').eq('status', 'pending').lt('updated_at', new Date(Date.now() - ABANDONED_MS).toISOString()).limit(TICK_BATCH);
  for (const p of (pend ?? []) as { id: string }[]) {
    const { data: tok } = await db.from('mail_connection_tokens').select('connection_id').eq('connection_id', p.id).maybeSingle();
    if (tok) continue;
    await db.from('mail_connections').update({ status: 'revoked', revoked_at: new Date().toISOString(), last_error: 'Autorisation non terminée' }).eq('id', p.id);
    stats.abandoned += 1;
  }

  const { data: rows } = await db.from('mail_connections').select(`${CONNECTION_COLUMNS},last_sync_at`).in('status', ['pending', 'connected', 'error']).order('last_sync_at', { ascending: true, nullsFirst: true }).limit(TICK_BATCH);
  for (const row of (rows ?? []) as (MailConnection & { last_sync_at: string | null })[]) {
    const { data: tok } = await db.from('mail_connection_tokens').select('connection_id').eq('connection_id', row.id).maybeSingle();
    if (!tok) continue; // autorisation en cours
    if (!(await entitled(row))) continue;
    const renewed = await renewIfNeeded(row, deps);
    if (renewed === 'renewed') stats.renewed += 1;
    if (renewed === 'revoked') continue;
    const stale = !row.last_sync_at || Date.now() - Date.parse(row.last_sync_at) > FALLBACK_SYNC_MS;
    if (stale || !row.sync_cursor || row.status === 'error') {
      const { data: fresh } = await db.from('mail_connections').select(CONNECTION_COLUMNS).eq('id', row.id).maybeSingle();
      if (fresh) {
        await syncConnection(fresh as MailConnection, deps);
        stats.synced += 1;
      }
    }
  }
  stats.imported = await importQueued({});
  return stats;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const source = url.searchParams.get('source');
  let action = url.searchParams.get('action');

  // Graph valide l'URL à la création de l'abonnement : réponse immédiate.
  if (source === 'graph') {
    const validation = graphValidationToken(req.url);
    if (validation !== null) return new Response(validation, { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff' } });
  }
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: { 'Access-Control-Allow-Origin': corsOrigin(req), 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } });
  }
  if (req.method !== 'POST') return json(405, { error: 'POST attendu' });
  if (!SUPABASE_URL || !SERVICE_ROLE || !TOKEN_KEY || !STATE_SECRET) return json(503, { error: 'configuration incomplète : rien n’est traité' });

  // ── Gmail : push Pub/Sub authentifié par jeton OIDC ────────────────────────
  if (source === 'gmail') {
    if (!PUBSUB_AUDIENCE || !PUBSUB_SERVICE_ACCOUNT) return json(503, { error: 'configuration incomplète : rien n’est traité' });
    const authz = req.headers.get('Authorization') ?? '';
    const ok = await verifyGoogleOidcToken({
      token: authz.startsWith('Bearer ') ? authz.slice(7) : null,
      jwks: await googleJwks(),
      audience: PUBSUB_AUDIENCE,
      serviceAccountEmail: PUBSUB_SERVICE_ACCOUNT,
    });
    if (!ok) return json(401, { error: 'jeton invalide' });
    const note = parsePubSubPush(await req.text());
    if (!note) return json(200, { processed: 0 }); // charge illisible : acquittée, jamais rejouée
    const { data: row } = await db.from('mail_connections').select(CONNECTION_COLUMNS).eq('provider', 'gmail').eq('address', note.emailAddress).neq('status', 'revoked').maybeSingle();
    // Boîte inconnue, en pause ou révoquée : acquitté sans rien révéler.
    if (row) await background(syncOne(row as MailConnection));
    return json(200, { processed: row ? 1 : 0 });
  }

  // ── Microsoft Graph : notifications + cycle de vie ─────────────────────────
  if (source === 'graph') {
    const list = parseGraphNotifications(await req.text());
    if (!list) return json(400, { error: 'corps illisible' });
    const work: Promise<void>[] = [];
    const seen = new Set<string>();
    for (const n of list) {
      const { data: row } = await db.from('mail_connections').select(CONNECTION_COLUMNS).eq('provider', 'microsoft').eq('subscription_id', n.subscriptionId).neq('status', 'revoked').maybeSingle();
      const conn = row as MailConnection | null;
      if (!conn) continue;
      // clientState : preuve que la notification vient bien de Graph pour CETTE connexion.
      if (!n.clientState || !safeEqual(n.clientState, await deriveClientState(STATE_SECRET, conn.id))) continue;
      const key = `${conn.id}:${n.lifecycleEvent ?? 'change'}`;
      if (seen.has(key)) continue;
      seen.add(key);
      work.push(
        (async () => {
          if (!isSyncable(conn.status)) return;
          if (n.lifecycleEvent === 'subscriptionRemoved') {
            // Abonnement supprimé par Graph : on en recrée un, puis delta.
            await ensureWatch({ ...conn, subscription_id: null }, deps).catch(() => undefined);
          } else if (n.lifecycleEvent === 'reauthorizationRequired') {
            // PATCH de l'expiration = réautorisation + renouvellement en un appel.
            await renewIfNeeded({ ...conn, watch_expires_at: null }, deps);
          }
          const { data: fresh } = await db.from('mail_connections').select(CONNECTION_COLUMNS).eq('id', conn.id).maybeSingle();
          if (fresh) await syncOne(fresh as MailConnection);
        })(),
      );
    }
    // 202 : reçu, traitement en cours (Graph exige une réponse en moins de 3 s).
    await background(Promise.all(work));
    return json(202, { accepted: work.length });
  }

  // Le site appelle la fonction avec l'action dans le corps ({"action":"import"}).
  if (!action) {
    const parsed = (await req.json().catch(() => null)) as { action?: unknown } | null;
    action = typeof parsed?.action === 'string' ? parsed.action : null;
  }

  // ── Passage planifié ───────────────────────────────────────────────────────
  if (action === 'tick') {
    if (!CRON_SECRET || !safeEqual(req.headers.get('x-mail-cron-secret') ?? '', CRON_SECRET)) return json(401, { error: 'non autorisé' });
    return json(200, await tick());
  }

  // ── Import immédiat des messages classés par le titulaire ──────────────────
  if (action === 'import') {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': corsOrigin(req) };
    const authz = req.headers.get('Authorization') ?? '';
    const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
    if (!token || !ANON_KEY) return new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401, headers });
    const caller = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
    const { data, error } = await caller.auth.getUser();
    if (error || !data?.user) return new Response(JSON.stringify({ error: 'AUTH_REQUIRED' }), { status: 401, headers });
    return new Response(JSON.stringify({ imported: await importQueued({ userId: data.user.id }) }), { status: 200, headers });
  }

  return json(400, { error: 'requête inconnue' });
});
