// Connexion directe d'une messagerie — cœur de synchronisation, SANS dépendance :
// le réseau (`fetch`) et la base (`MailStore`) sont injectés. Les fonctions
// mail-oauth / mail-sync fournissent les vrais ; les tests fournissent des
// simulations (tests/mail-connect.test.ts).
//
// Garanties portées ici :
//  - LECTURE SEULE : seules des requêtes GET partent vers les boîtes, plus les
//    appels de surveillance (watch / subscriptions) et de jetons. Jamais
//    d'envoi, de modification ni de suppression d'un e-mail.
//  - aucun lien contenu dans un e-mail n'est suivi : les seules URL appelées
//    sont construites ici vers les API officielles, ou des liens de pagination
//    renvoyés par Graph ET situés sur graph.microsoft.com ;
//  - reprise par curseur : une notification ne sert que de signal — on relit
//    toujours depuis le curseur enregistré (historyId / deltaLink), donc une
//    notification perdue est rattrapée à la suivante ou au passage planifié ;
//  - dédup : un message déjà pris en charge n'est jamais retraité ;
//  - « connected » seulement après une réception réelle (store.markReception).

import { acceptAttachment } from './inbound-email.ts';
import {
  OAUTH_ENDPOINTS,
  buildRefreshBody,
  chooseDossier,
  isSyncable,
  nextStatus,
  outOfScope,
  parseGmailMessage,
  parseGraphMessage,
  type DossierContext,
  type MailAttachment,
  type MailMessage,
  type MailProvider,
  type MailStatus,
} from './mail-connect.ts';

export const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';
export const GRAPH_API = 'https://graph.microsoft.com/v1.0';
const GRAPH_ORIGIN = 'https://graph.microsoft.com';

export const MAX_MESSAGES_PER_RUN = 50;
export const MAX_ATTACHMENTS = 10;
const MAX_PAGES = 20;
const TEXT_LIMIT = 200_000;
/** Renouvellement dès qu'il reste moins de 48 h (Gmail : 7 j max ; Graph : < 7 j). */
export const RENEW_BEFORE_MS = 48 * 3_600_000;
/** Durée demandée pour un abonnement Graph « message » (maximum : 10 080 min). */
export const GRAPH_SUBSCRIPTION_MS = 6 * 24 * 3_600_000;

export type MailConnection = {
  id: string;
  user_id: string;
  provider: MailProvider;
  address: string;
  status: MailStatus;
  import_since: string;
  scope_label: string | null;
  dossier_id: string | null;
  sync_cursor: string | null;
  subscription_id: string | null;
  watch_expires_at: string | null;
};

export type MailTokens = { accessToken: string | null; accessExpiresAtMs: number | null; refreshToken: string };

export type MessageOutcome = {
  status: 'filtered' | 'a_classer' | 'stored' | 'rejected' | 'error';
  dossier_id?: string | null;
  suggested_dossier_id?: string | null;
  suggestion_reason?: string | null;
  thread_id?: string | null;
  internet_message_id?: string | null;
  from_addr?: string | null;
  subject?: string | null;
  received_at?: string | null;
  attachment_count?: number;
  stored_count?: number;
  error?: string | null;
};

export interface MailStore {
  /** Jetons DÉCHIFFRÉS de la connexion, ou null s'ils n'existent plus. */
  loadTokens(conn: MailConnection): Promise<MailTokens | null>;
  /** Enregistre les jetons (chiffrés par l'implémentation). */
  saveTokens(conn: MailConnection, tokens: MailTokens): Promise<void>;
  eraseTokens(conn: MailConnection): Promise<void>;
  updateConnection(id: string, patch: Partial<MailConnection> & { last_sync_at?: string; last_error?: string | null; last_received_at?: string }): Promise<void>;
  logEvent(conn: MailConnection, type: string, detail: string | null): Promise<void>;
  /** Prend en charge un message (unicité en base). null = déjà traité.
   *  Une ligne restée en « error » (tentatives < 3) ou en « received » depuis
   *  plus de 10 minutes peut être reprise ; tout autre état est définitif. */
  claimMessage(conn: MailConnection, messageId: string): Promise<string | null>;
  /** Prend en charge l'import d'un message classé par le titulaire : passage
   *  ATOMIQUE queued → received. false = déjà pris par un autre import (ou plus
   *  en file) : ne rien déposer. */
  claimQueued(rowId: string): Promise<boolean>;
  finishMessage(rowId: string, outcome: MessageOutcome): Promise<void>;
  /** Une réception réelle existe-t-elle pour cette connexion ? */
  hasReception(conn: MailConnection): Promise<boolean>;
  dossierContext(conn: MailConnection, msg: MailMessage): Promise<DossierContext>;
  /** Dépôt d'une pièce dans un dossier (stockage + dossier_documents). */
  storePiece(dossierId: string, userId: string, fileName: string, bytes: Uint8Array, contentType: string | null): Promise<boolean>;
  logDossierEvent(dossierId: string, userId: string, label: string): Promise<void>;
}

export type MailDeps = {
  fetch: typeof fetch;
  store: MailStore;
  now: () => number;
  oauth: Record<MailProvider, { clientId: string; clientSecret: string }>;
  /** Sujet Pub/Sub complet (projects/<projet>/topics/<sujet>) pour Gmail. */
  pubsubTopic: string;
  /** URL publique de mail-sync côté Graph (notifications + cycle de vie). */
  graphNotificationUrl: string;
  clientStateFor: (connectionId: string) => Promise<string>;
};

/** Autorisation perdue définitivement (révoquée ou expirée chez le fournisseur). */
export class MailAuthRevoked extends Error {}
/** Échec passager (réseau, 5xx, quota) : à retenter plus tard, curseur inchangé. */
export class MailTransient extends Error {}

// ── Jetons ───────────────────────────────────────────────────────────────────
async function refreshAccessToken(conn: MailConnection, tokens: MailTokens, deps: MailDeps): Promise<MailTokens> {
  const cfg = deps.oauth[conn.provider];
  let res: Response;
  try {
    res = await deps.fetch(OAUTH_ENDPOINTS[conn.provider].token, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildRefreshBody({ provider: conn.provider, clientId: cfg.clientId, clientSecret: cfg.clientSecret, refreshToken: tokens.refreshToken }).toString(),
    });
  } catch {
    throw new MailTransient('point de jetons injoignable');
  }
  const out = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string } | null;
  if (!res.ok) {
    // invalid_grant : jeton de rafraîchissement révoqué, expiré ou inutilisable.
    if (res.status === 400 || res.status === 401) {
      if (out?.error === 'invalid_grant' || out?.error === 'interaction_required' || out?.error === 'invalid_client' || out?.error === 'unauthorized_client') {
        if (out.error === 'invalid_grant' || out.error === 'interaction_required') throw new MailAuthRevoked(`autorisation révoquée (${out.error})`);
        throw new MailTransient(`configuration OAuth refusée (${out.error})`);
      }
    }
    throw new MailTransient(`rafraîchissement du jeton : HTTP ${res.status}`);
  }
  if (!out || typeof out.access_token !== 'string') throw new MailTransient('réponse de jeton illisible');
  const next: MailTokens = {
    accessToken: out.access_token,
    accessExpiresAtMs: deps.now() + Math.max(60, Number(out.expires_in) || 3600) * 1000,
    // Microsoft fait tourner le jeton de rafraîchissement : on garde le dernier.
    refreshToken: typeof out.refresh_token === 'string' && out.refresh_token ? out.refresh_token : tokens.refreshToken,
  };
  await deps.store.saveTokens(conn, next);
  return next;
}

async function accessToken(conn: MailConnection, deps: MailDeps, force = false): Promise<string> {
  const tokens = await deps.store.loadTokens(conn);
  if (!tokens) throw new MailAuthRevoked('jetons absents');
  if (!force && tokens.accessToken && tokens.accessExpiresAtMs && tokens.accessExpiresAtMs - deps.now() > 60_000) return tokens.accessToken;
  return (await refreshAccessToken(conn, tokens, deps)).accessToken as string;
}

/** Appel d'API authentifié ; un 401 déclenche UN rafraîchissement puis un nouvel essai. */
export async function apiFetch(conn: MailConnection, deps: MailDeps, url: string, init: RequestInit = {}): Promise<Response> {
  const call = async (token: string): Promise<Response> => {
    try {
      return await deps.fetch(url, { ...init, headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${token}` } });
    } catch {
      throw new MailTransient('API de messagerie injoignable');
    }
  };
  let res = await call(await accessToken(conn, deps));
  if (res.status === 401) {
    res = await call(await accessToken(conn, deps, true));
    if (res.status === 401) throw new MailAuthRevoked('accès refusé par le fournisseur (401)');
  }
  return res;
}

async function okJson<T>(res: Response, what: string): Promise<T> {
  if (res.status === 429 || res.status >= 500) throw new MailTransient(`${what} : HTTP ${res.status}`);
  if (!res.ok) throw new MailTransient(`${what} : HTTP ${res.status}`);
  const out = (await res.json().catch(() => null)) as T | null;
  if (out === null) throw new MailTransient(`${what} : réponse illisible`);
  return out;
}

// ── Surveillance (watch Gmail / abonnement Graph) ────────────────────────────
function graphFolder(conn: MailConnection): string {
  return conn.scope_label && /^[A-Za-z0-9_=-]{1,200}$/.test(conn.scope_label) ? conn.scope_label : 'inbox';
}

/** Crée ou renouvelle la surveillance. Gmail : users.watch est idempotent et
 *  doit être rappelé au moins tous les 7 jours. Graph : PATCH de l'expiration,
 *  ou nouvel abonnement si l'ancien a disparu. */
export async function ensureWatch(conn: MailConnection, deps: MailDeps): Promise<Partial<MailConnection>> {
  if (conn.provider === 'gmail') {
    const res = await apiFetch(conn, deps, `${GMAIL_API}/watch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topicName: deps.pubsubTopic, labelIds: [conn.scope_label || 'INBOX'], labelFilterBehavior: 'INCLUDE' }),
    });
    const out = await okJson<{ historyId?: string | number; expiration?: string | number }>(res, 'surveillance Gmail');
    const exp = Number(out.expiration);
    const patch: Partial<MailConnection> = {
      watch_expires_at: Number.isFinite(exp) && exp > 0 ? new Date(exp).toISOString() : new Date(deps.now() + 6 * 24 * 3_600_000).toISOString(),
    };
    await deps.store.updateConnection(conn.id, patch);
    return patch;
  }
  const expiration = new Date(deps.now() + GRAPH_SUBSCRIPTION_MS).toISOString();
  if (conn.subscription_id) {
    const res = await apiFetch(conn, deps, `${GRAPH_API}/subscriptions/${encodeURIComponent(conn.subscription_id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expirationDateTime: expiration }),
    });
    if (res.ok) {
      const out = (await res.json().catch(() => null)) as { expirationDateTime?: string } | null;
      const patch: Partial<MailConnection> = { watch_expires_at: out?.expirationDateTime ?? expiration };
      await deps.store.updateConnection(conn.id, patch);
      return patch;
    }
    if (res.status !== 404 && res.status !== 410) await okJson(res, 'renouvellement de l’abonnement Graph');
    // 404 : abonnement disparu → on en recrée un.
  }
  const res = await apiFetch(conn, deps, `${GRAPH_API}/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      changeType: 'created',
      notificationUrl: deps.graphNotificationUrl,
      lifecycleNotificationUrl: deps.graphNotificationUrl,
      resource: `me/mailFolders('${graphFolder(conn)}')/messages`,
      expirationDateTime: expiration,
      clientState: await deps.clientStateFor(conn.id),
    }),
  });
  const out = await okJson<{ id?: string; expirationDateTime?: string }>(res, 'abonnement Graph');
  if (typeof out.id !== 'string') throw new MailTransient('abonnement Graph : identifiant absent');
  const patch: Partial<MailConnection> = { subscription_id: out.id, watch_expires_at: out.expirationDateTime ?? expiration };
  await deps.store.updateConnection(conn.id, patch);
  return patch;
}

/** Arrêt de la surveillance chez le fournisseur (déconnexion). Au mieux : un
 *  échec n'empêche jamais l'effacement des jetons qui suit. */
export async function stopWatch(conn: MailConnection, deps: MailDeps): Promise<void> {
  try {
    if (conn.provider === 'gmail') await apiFetch(conn, deps, `${GMAIL_API}/stop`, { method: 'POST' });
    else if (conn.subscription_id) await apiFetch(conn, deps, `${GRAPH_API}/subscriptions/${encodeURIComponent(conn.subscription_id)}`, { method: 'DELETE' });
  } catch {
    /* au mieux */
  }
}

// ── Liste des nouveaux messages depuis le curseur ────────────────────────────
type Listing = { ids: string[]; cursor: string | null; resynced: boolean };

/** Gmail : resynchronisation BORNÉE au périmètre (jamais l'historique global). */
async function gmailBoundedList(conn: MailConnection, deps: MailDeps): Promise<Listing> {
  // Curseur lu AVANT la liste : rien de ce qui arrive entre-temps n'est perdu.
  const profile = await okJson<{ historyId?: string | number }>(await apiFetch(conn, deps, `${GMAIL_API}/profile`), 'profil Gmail');
  const cursor = profile.historyId != null ? String(profile.historyId) : null;
  const after = Math.floor(Date.parse(conn.import_since) / 1000);
  const ids: string[] = [];
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const u = new URL(`${GMAIL_API}/messages`);
    u.searchParams.set('q', `after:${after}`);
    u.searchParams.set('labelIds', conn.scope_label || 'INBOX');
    u.searchParams.set('maxResults', '100');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const out = await okJson<{ messages?: { id?: string }[]; nextPageToken?: string }>(await apiFetch(conn, deps, u.toString()), 'liste Gmail');
    for (const m of out.messages ?? []) if (typeof m.id === 'string') ids.push(m.id);
    pageToken = out.nextPageToken ?? null;
    if (!pageToken) break;
  }
  return { ids, cursor, resynced: true };
}

async function gmailList(conn: MailConnection, deps: MailDeps): Promise<Listing> {
  if (!conn.sync_cursor) return gmailBoundedList(conn, deps);
  const ids: string[] = [];
  let cursor: string | null = conn.sync_cursor;
  let pageToken: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const u = new URL(`${GMAIL_API}/history`);
    u.searchParams.set('startHistoryId', conn.sync_cursor);
    u.searchParams.set('historyTypes', 'messageAdded');
    u.searchParams.set('labelId', conn.scope_label || 'INBOX');
    u.searchParams.set('maxResults', '500');
    if (pageToken) u.searchParams.set('pageToken', pageToken);
    const res = await apiFetch(conn, deps, u.toString());
    // 404 : curseur hors de l'historique disponible → resynchronisation bornée.
    if (res.status === 404) return gmailBoundedList(conn, deps);
    const out = await okJson<{ history?: { messagesAdded?: { message?: { id?: string } }[] }[]; nextPageToken?: string; historyId?: string | number }>(res, 'historique Gmail');
    for (const h of out.history ?? []) for (const a of h.messagesAdded ?? []) if (typeof a.message?.id === 'string') ids.push(a.message.id);
    if (out.historyId != null) cursor = String(out.historyId);
    pageToken = out.nextPageToken ?? null;
    if (!pageToken) break;
  }
  return { ids: [...new Set(ids)], cursor, resynced: false };
}

function graphInitialDeltaUrl(conn: MailConnection): string {
  const since = new Date(Date.parse(conn.import_since)).toISOString();
  return `${GRAPH_API}/me/mailFolders/${graphFolder(conn)}/messages/delta?changeType=created&$select=id,receivedDateTime&$filter=${encodeURIComponent(`receivedDateTime ge ${since}`)}`;
}

/** Un lien de pagination n'est suivi que s'il reste sur l'API Graph (https). */
export function isGraphUrl(url: string | null | undefined): url is string {
  if (!url) return false;
  try {
    const u = new URL(url);
    return u.origin === GRAPH_ORIGIN;
  } catch {
    return false;
  }
}

async function graphList(conn: MailConnection, deps: MailDeps): Promise<Listing> {
  let resynced = !isGraphUrl(conn.sync_cursor);
  let url: string = resynced ? graphInitialDeltaUrl(conn) : (conn.sync_cursor as string);
  const ids: string[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await apiFetch(conn, deps, url, { headers: { Prefer: 'odata.maxpagesize=50' } });
    // 410 : jeton delta périmé → on repart de la requête initiale bornée.
    if ((res.status === 410 || res.status === 404) && !resynced) {
      resynced = true;
      url = graphInitialDeltaUrl(conn);
      ids.length = 0;
      continue;
    }
    const out = await okJson<{ value?: Record<string, unknown>[]; '@odata.nextLink'?: string; '@odata.deltaLink'?: string }>(res, 'delta Graph');
    for (const m of out.value ?? []) if (typeof m.id === 'string' && !m['@removed']) ids.push(m.id);
    if (isGraphUrl(out['@odata.deltaLink'])) {
      cursor = out['@odata.deltaLink'];
      break;
    }
    if (!isGraphUrl(out['@odata.nextLink'])) throw new MailTransient('delta Graph : pagination inattendue');
    url = out['@odata.nextLink'];
  }
  if (!cursor) throw new MailTransient('delta Graph : trop de pages, reprise au prochain passage');
  return { ids: [...new Set(ids)], cursor, resynced };
}

// ── Lecture d'un message et de ses pièces ────────────────────────────────────
async function fetchMessage(conn: MailConnection, deps: MailDeps, id: string): Promise<MailMessage | null> {
  if (conn.provider === 'gmail') {
    const res = await apiFetch(conn, deps, `${GMAIL_API}/messages/${encodeURIComponent(id)}?format=full`);
    if (res.status === 404) return null; // supprimé entre-temps par son propriétaire
    return parseGmailMessage(await okJson<unknown>(res, 'message Gmail'));
  }
  const base = `${GRAPH_API}/me/messages/${encodeURIComponent(id)}`;
  const res = await apiFetch(conn, deps, `${base}?$select=id,conversationId,internetMessageId,subject,receivedDateTime,isDraft,from,toRecipients,ccRecipients,hasAttachments,body`, {
    headers: { Prefer: 'outlook.body-content-type="text"' },
  });
  if (res.status === 404) return null;
  const raw = await okJson<{ hasAttachments?: boolean }>(res, 'message Graph');
  let attachments: unknown = { value: [] };
  if (raw.hasAttachments) {
    attachments = await okJson<unknown>(await apiFetch(conn, deps, `${base}/attachments?$select=id,name,contentType,size,isInline`), 'pièces jointes Graph');
  }
  return parseGraphMessage(raw, attachments);
}

async function downloadAttachment(conn: MailConnection, deps: MailDeps, messageId: string, a: MailAttachment): Promise<Uint8Array | null> {
  if (conn.provider === 'gmail') {
    const res = await apiFetch(conn, deps, `${GMAIL_API}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(a.id)}`);
    if (!res.ok) return null;
    const out = (await res.json().catch(() => null)) as { data?: string } | null;
    if (!out || typeof out.data !== 'string') return null;
    try {
      const bin = atob(out.data.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    } catch {
      return null;
    }
  }
  const res = await apiFetch(conn, deps, `${GRAPH_API}/me/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(a.id)}/$value`);
  if (!res.ok) return null;
  return new Uint8Array(await res.arrayBuffer());
}

/** Dépose dans le dossier les pièces AUTORISÉES du message (mêmes règles que le
 *  dépôt manuel et que la réception par e-mail) ; sans pièce, le texte devient
 *  une pièce .txt. Renvoie le nombre de pièces déposées et les refus. */
export async function ingestIntoDossier(
  conn: MailConnection,
  deps: MailDeps,
  msg: MailMessage,
  dossierId: string,
): Promise<{ stored: number; problems: string[] }> {
  const problems: string[] = [];
  const real = msg.attachments.filter((a) => !a.inline);
  if (real.length > MAX_ATTACHMENTS) problems.push(`${real.length - MAX_ATTACHMENTS} pièce(s) au-delà de la limite de ${MAX_ATTACHMENTS} ignorée(s)`);
  let stored = 0;
  for (const a of real.slice(0, MAX_ATTACHMENTS)) {
    const name = a.filename.trim() || 'piece-jointe';
    const refuse = acceptAttachment({ filename: a.filename, size: a.size });
    if (refuse) {
      problems.push(refuse);
      continue;
    }
    const bytes = await downloadAttachment(conn, deps, msg.id, a);
    if (!bytes) {
      problems.push(`« ${name} » : téléchargement impossible`);
      continue;
    }
    const sizeRefuse = acceptAttachment({ filename: name, size: bytes.byteLength });
    if (sizeRefuse) {
      problems.push(sizeRefuse);
      continue;
    }
    if (await deps.store.storePiece(dossierId, conn.user_id, name, bytes, a.contentType)) stored += 1;
    else problems.push(`« ${name} » : dépôt impossible`);
  }
  if (stored === 0 && typeof msg.text === 'string' && msg.text.trim()) {
    const day = new Date(msg.receivedAtMs ?? deps.now()).toISOString().slice(0, 10);
    const txt = new TextEncoder().encode(msg.text.slice(0, TEXT_LIMIT));
    if (await deps.store.storePiece(dossierId, conn.user_id, `email-${day}.txt`, txt, 'text/plain')) stored += 1;
  }
  return { stored, problems };
}

function meta(msg: MailMessage): Pick<MessageOutcome, 'thread_id' | 'internet_message_id' | 'from_addr' | 'subject' | 'received_at' | 'attachment_count'> {
  return {
    thread_id: msg.threadId,
    internet_message_id: msg.internetMessageId?.slice(0, 500) ?? null,
    from_addr: msg.from?.slice(0, 320) ?? null,
    subject: msg.subject?.slice(0, 500) ?? null,
    received_at: msg.receivedAtMs ? new Date(msg.receivedAtMs).toISOString() : null,
    attachment_count: msg.attachments.filter((a) => !a.inline).length,
  };
}

export type ProcessResult = 'duplicate' | 'filtered' | 'a_classer' | 'stored' | 'rejected';

/** Prend en charge UN message : dédup → lecture → périmètre → dossier. */
export async function processMessage(conn: MailConnection, deps: MailDeps, messageId: string): Promise<ProcessResult> {
  const rowId = await deps.store.claimMessage(conn, messageId);
  if (!rowId) return 'duplicate';
  try {
    return await handleClaimed(conn, deps, messageId, rowId);
  } catch (e) {
    // Échec en cours de route : la ligne passe en « error » (reprise possible
    // au passage suivant, tentatives bornées par le store), puis l'erreur
    // remonte pour que le curseur n'avance pas.
    await deps.store.finishMessage(rowId, { status: 'error', error: ((e as Error)?.message ?? 'erreur').slice(0, 500) }).catch(() => undefined);
    throw e;
  }
}

async function handleClaimed(conn: MailConnection, deps: MailDeps, messageId: string, rowId: string): Promise<ProcessResult> {
  const msg = await fetchMessage(conn, deps, messageId);
  if (!msg) {
    await deps.store.finishMessage(rowId, { status: 'filtered', error: 'message introuvable' });
    return 'filtered';
  }
  const out = outOfScope(msg, {
    provider: conn.provider,
    importSinceMs: Date.parse(conn.import_since),
    scopeLabel: conn.scope_label,
    ownAddress: conn.address,
  });
  if (out) {
    // Hors périmètre : RIEN n'est conservé du message, sauf son identifiant.
    await deps.store.finishMessage(rowId, { status: 'filtered', error: out });
    return 'filtered';
  }
  const choice = chooseDossier(msg, await deps.store.dossierContext(conn, msg));
  if (!choice.certain || !choice.dossierId) {
    await deps.store.finishMessage(rowId, {
      status: 'a_classer',
      ...meta(msg),
      suggested_dossier_id: choice.suggestedDossierId,
      suggestion_reason: choice.reason,
    });
    return 'a_classer';
  }
  const { stored, problems } = await ingestIntoDossier(conn, deps, msg, choice.dossierId);
  await deps.store.finishMessage(rowId, {
    status: stored > 0 ? 'stored' : 'rejected',
    ...meta(msg),
    dossier_id: choice.dossierId,
    suggestion_reason: choice.reason,
    stored_count: stored,
    error: problems.length ? problems.join(' ; ').slice(0, 1000) : null,
  });
  if (stored > 0) {
    await deps.store.logDossierEvent(
      choice.dossierId,
      conn.user_id,
      `E-mail reçu (messagerie connectée) — ${stored} pièce${stored > 1 ? 's' : ''} ajoutée${stored > 1 ? 's' : ''}${problems.length ? ` (${problems.length} refusée${problems.length > 1 ? 's' : ''})` : ''}`,
    );
  }
  return stored > 0 ? 'stored' : 'rejected';
}

/** Import d'un message que le titulaire vient de classer (statut queued). */
export async function importQueuedMessage(
  conn: MailConnection,
  deps: MailDeps,
  row: { id: string; message_id: string; dossier_id: string },
): Promise<'stored' | 'rejected' | 'error' | 'duplicate'> {
  // Deux imports simultanés (double clic, « action=import » pendant le passage
  // planifié) lisent la même ligne « queued » : un seul la prend en charge,
  // sinon les pièces seraient déposées en double.
  if (!(await deps.store.claimQueued(row.id))) return 'duplicate';
  try {
    const msg = await fetchMessage(conn, deps, row.message_id);
    if (!msg) {
      await deps.store.finishMessage(row.id, { status: 'rejected', dossier_id: row.dossier_id, error: 'message introuvable dans la boîte' });
      return 'rejected';
    }
    const { stored, problems } = await ingestIntoDossier(conn, deps, msg, row.dossier_id);
    await deps.store.finishMessage(row.id, {
      status: stored > 0 ? 'stored' : 'rejected',
      dossier_id: row.dossier_id,
      stored_count: stored,
      error: problems.length ? problems.join(' ; ').slice(0, 1000) : null,
    });
    if (stored > 0) {
      await deps.store.logDossierEvent(row.dossier_id, conn.user_id, `E-mail classé (messagerie connectée) — ${stored} pièce${stored > 1 ? 's' : ''} ajoutée${stored > 1 ? 's' : ''}`);
    }
    return stored > 0 ? 'stored' : 'rejected';
  } catch (e) {
    if (e instanceof MailAuthRevoked) await markRevoked(conn, deps, e.message);
    else await deps.store.finishMessage(row.id, { status: 'error', dossier_id: row.dossier_id, error: (e as Error).message.slice(0, 500) });
    return 'error';
  }
}

async function markRevoked(conn: MailConnection, deps: MailDeps, why: string): Promise<void> {
  await deps.store.eraseTokens(conn);
  await deps.store.updateConnection(conn.id, { status: 'revoked', last_error: why.slice(0, 500), sync_cursor: null, subscription_id: null, watch_expires_at: null });
  await deps.store.logEvent(conn, 'revocation', why.slice(0, 500));
}

export type SyncResult = {
  status: MailStatus;
  processed: number;
  duplicates: number;
  resynced: boolean;
  skipped?: string;
};

/**
 * Synchronise UNE connexion depuis son curseur. Appelée sur notification
 * (Pub/Sub, Graph), sur événement de cycle de vie et au passage planifié.
 * Ne lit rien si la connexion est en pause ou révoquée.
 */
export async function syncConnection(conn: MailConnection, deps: MailDeps): Promise<SyncResult> {
  if (!isSyncable(conn.status)) return { status: conn.status, processed: 0, duplicates: 0, resynced: false, skipped: conn.status };
  try {
    const listing = conn.provider === 'gmail' ? await gmailList(conn, deps) : await graphList(conn, deps);
    let processed = 0;
    let duplicates = 0;
    let received = 0;
    const batch = listing.ids.slice(0, MAX_MESSAGES_PER_RUN);
    for (const id of batch) {
      const r = await processMessage(conn, deps, id);
      if (r === 'duplicate') duplicates += 1;
      else processed += 1;
      if (r === 'stored' || r === 'a_classer' || r === 'rejected') received += 1;
    }
    // Lot incomplet : le curseur n'avance pas, la suite est reprise au prochain
    // passage (les messages déjà pris en charge sont écartés par la dédup).
    const complete = batch.length === listing.ids.length;
    const nowIso = new Date(deps.now()).toISOString();
    const hasReceived = received > 0 || (await deps.store.hasReception(conn));
    let status: MailStatus = conn.status;
    if (received > 0) status = nextStatus(status, 'reception', true) ?? status;
    status = nextStatus(status, 'sync_ok', hasReceived) ?? status;
    await deps.store.updateConnection(conn.id, {
      ...(complete && listing.cursor ? { sync_cursor: listing.cursor } : {}),
      status,
      last_sync_at: nowIso,
      last_error: null,
      ...(received > 0 ? { last_received_at: nowIso } : {}),
    });
    if (status !== conn.status) await deps.store.logEvent(conn, status === 'connected' ? 'connexion_confirmee' : 'statut', `${conn.status} → ${status}`);
    if (listing.resynced && conn.sync_cursor) await deps.store.logEvent(conn, 'resynchronisation', 'curseur périmé : reprise bornée au périmètre');
    return { status, processed, duplicates, resynced: listing.resynced };
  } catch (e) {
    if (e instanceof MailAuthRevoked) {
      await markRevoked(conn, deps, e.message);
      return { status: 'revoked', processed: 0, duplicates: 0, resynced: false };
    }
    const why = ((e as Error)?.message ?? 'erreur inconnue').slice(0, 500);
    const status = nextStatus(conn.status, 'sync_error', false) ?? conn.status;
    await deps.store.updateConnection(conn.id, { status, last_error: why });
    if (status !== conn.status) await deps.store.logEvent(conn, 'erreur', why);
    return { status, processed: 0, duplicates: 0, resynced: false };
  }
}

/** Renouvelle la surveillance si elle manque ou expire bientôt (passage planifié). */
export async function renewIfNeeded(conn: MailConnection, deps: MailDeps): Promise<'renewed' | 'fresh' | 'skipped' | 'revoked' | 'error'> {
  if (!isSyncable(conn.status)) return 'skipped';
  const exp = conn.watch_expires_at ? Date.parse(conn.watch_expires_at) : 0;
  if (exp - deps.now() > RENEW_BEFORE_MS) return 'fresh';
  try {
    await ensureWatch(conn, deps);
    await deps.store.logEvent(conn, 'surveillance_renouvelee', null);
    return 'renewed';
  } catch (e) {
    if (e instanceof MailAuthRevoked) {
      await markRevoked(conn, deps, e.message);
      return 'revoked';
    }
    const why = ((e as Error)?.message ?? 'erreur inconnue').slice(0, 500);
    const status = nextStatus(conn.status, 'sync_error', false) ?? conn.status;
    await deps.store.updateConnection(conn.id, { status, last_error: why });
    return 'error';
  }
}
