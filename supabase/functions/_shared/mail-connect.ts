// Connexion directe d'une messagerie (Gmail / Microsoft 365) — partie PURE,
// sans dépendance ni accès réseau : URL d'autorisation officielles, state signé
// (anti-CSRF) + PKCE, chiffrement AES-GCM des jetons, lecture des notifications
// (Pub/Sub, Microsoft Graph), machine d'état, choix du dossier, lecture des
// messages. Importée par les fonctions mail-oauth / mail-sync (Deno) et par les
// tests (Node, Web Crypto natif).
//
// Règle de sécurité : tout ce qui vient d'un e-mail (sujet, expéditeur, texte,
// nom de pièce jointe) est une DONNÉE. Rien n'y est interprété comme une
// instruction, aucun lien n'y est suivi.

export type MailProvider = 'gmail' | 'microsoft';
export type MailStatus = 'pending' | 'connected' | 'paused' | 'revoked' | 'error';

// ── Encodages ────────────────────────────────────────────────────────────────
const enc = new TextEncoder();
const dec = new TextDecoder();

export function b64urlEncode(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Accepte base64url ET base64 classique (Gmail : base64url ; Graph : base64). */
export function b64urlDecode(text: string): Uint8Array {
  const norm = text.replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const pad = norm.length % 4 === 0 ? '' : '='.repeat(4 - (norm.length % 4));
  const bin = atob(norm + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function buf(bytes: Uint8Array): ArrayBuffer {
  return bytes as unknown as ArrayBuffer;
}

/** Comparaison en temps constant de deux chaînes. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', buf(enc.encode(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return b64urlEncode(new Uint8Array(await crypto.subtle.sign('HMAC', key, buf(enc.encode(message)))));
}

// ── OAuth : points d'entrée officiels et permissions minimales ───────────────
// Lecture seule uniquement. Microsoft : `openid email` ne donne accès à aucune
// donnée de boîte — ils servent seulement à connaître l'adresse connectée
// (jeton d'identité), sans ajouter la permission Graph User.Read.
export const OAUTH_ENDPOINTS = {
  gmail: {
    authorize: 'https://accounts.google.com/o/oauth2/v2/auth',
    token: 'https://oauth2.googleapis.com/token',
    revoke: 'https://oauth2.googleapis.com/revoke',
    scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
  },
  microsoft: {
    authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
    token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token',
    revoke: null,
    scopes: ['offline_access', 'https://graph.microsoft.com/Mail.Read', 'openid', 'email'],
  },
} as const;

/** Permissions jamais demandées : toute écriture, tout envoi. Vérifié par test. */
export const FORBIDDEN_SCOPE_PATTERN = /send|modify|compose|insert|readwrite|mail\.google\.com|full_access/i;

export function buildAuthorizeUrl(args: {
  provider: MailProvider;
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}): string {
  const ep = OAUTH_ENDPOINTS[args.provider];
  const u = new URL(ep.authorize);
  u.searchParams.set('client_id', args.clientId);
  u.searchParams.set('redirect_uri', args.redirectUri);
  u.searchParams.set('response_type', 'code');
  u.searchParams.set('scope', ep.scopes.join(' '));
  u.searchParams.set('state', args.state);
  u.searchParams.set('code_challenge', args.codeChallenge);
  u.searchParams.set('code_challenge_method', 'S256');
  if (args.provider === 'gmail') {
    // access_type=offline + prompt=consent : jeton de rafraîchissement garanti.
    u.searchParams.set('access_type', 'offline');
    u.searchParams.set('prompt', 'consent');
    u.searchParams.set('include_granted_scopes', 'false');
  } else {
    u.searchParams.set('response_mode', 'query');
    u.searchParams.set('prompt', 'select_account');
  }
  return u.toString();
}

/** Corps (x-www-form-urlencoded) de l'échange du code d'autorisation. */
export function buildTokenExchangeBody(args: {
  provider: MailProvider;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier: string;
}): URLSearchParams {
  const p = new URLSearchParams();
  p.set('grant_type', 'authorization_code');
  p.set('client_id', args.clientId);
  p.set('client_secret', args.clientSecret);
  p.set('redirect_uri', args.redirectUri);
  p.set('code', args.code);
  p.set('code_verifier', args.codeVerifier);
  if (args.provider === 'microsoft') p.set('scope', OAUTH_ENDPOINTS.microsoft.scopes.join(' '));
  return p;
}

export function buildRefreshBody(args: {
  provider: MailProvider;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): URLSearchParams {
  const p = new URLSearchParams();
  p.set('grant_type', 'refresh_token');
  p.set('client_id', args.clientId);
  p.set('client_secret', args.clientSecret);
  p.set('refresh_token', args.refreshToken);
  if (args.provider === 'microsoft') p.set('scope', OAUTH_ENDPOINTS.microsoft.scopes.join(' '));
  return p;
}

/** Adresse lue dans un jeton d'identité Microsoft (reçu DIRECTEMENT du point
 *  de jetons en TLS : sert d'affichage, jamais de preuve d'identité). */
export function addressFromIdToken(idToken: string | null | undefined): string {
  if (!idToken) return '';
  const parts = idToken.split('.');
  if (parts.length < 2) return '';
  try {
    const claims = JSON.parse(dec.decode(b64urlDecode(parts[1]))) as Record<string, unknown>;
    const v = typeof claims.email === 'string' ? claims.email : typeof claims.preferred_username === 'string' ? claims.preferred_username : '';
    return /^[^\s@<>]+@[^\s@<>]+$/.test(v) ? v.toLowerCase().slice(0, 320) : '';
  } catch {
    return '';
  }
}

// ── State signé (anti-CSRF) et PKCE ──────────────────────────────────────────
export type OAuthState = { c: string; u: string; p: MailProvider; n: string; e: number };
export const STATE_TTL_S = 600;

export function randomNonce(bytes = 16): string {
  return b64urlEncode(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function signState(secret: string, payload: OAuthState): Promise<string> {
  if (!secret) throw new Error('secret de state absent');
  const body = b64urlEncode(enc.encode(JSON.stringify(payload)));
  return `${body}.${await hmac(secret, `state.${body}`)}`;
}

/** Charge utile si la signature est valide et le state non expiré, sinon null. */
export async function verifyState(secret: string, state: string | null | undefined, nowMs = Date.now()): Promise<OAuthState | null> {
  if (!secret || !state) return null;
  const dot = state.indexOf('.');
  if (dot <= 0 || state.indexOf('.', dot + 1) !== -1) return null;
  const body = state.slice(0, dot);
  if (!safeEqual(state.slice(dot + 1), await hmac(secret, `state.${body}`))) return null;
  let p: OAuthState;
  try {
    p = JSON.parse(dec.decode(b64urlDecode(body))) as OAuthState;
  } catch {
    return null;
  }
  if (!p || typeof p.c !== 'string' || typeof p.u !== 'string' || typeof p.n !== 'string' || typeof p.e !== 'number') return null;
  if (p.p !== 'gmail' && p.p !== 'microsoft') return null;
  if (p.e * 1000 < nowMs) return null;
  return p;
}

/** Vérificateur PKCE dérivé côté serveur (jamais transmis au navigateur ni
 *  stocké) : HMAC du couple connexion + nonce du state. 43 caractères. */
export async function derivePkceVerifier(secret: string, connectionId: string, nonce: string): Promise<string> {
  return hmac(secret, `pkce.${connectionId}.${nonce}`);
}

export async function pkceChallenge(verifier: string): Promise<string> {
  return b64urlEncode(new Uint8Array(await crypto.subtle.digest('SHA-256', buf(enc.encode(verifier)))));
}

/** clientState Microsoft Graph (≤ 128 caractères), dérivé par connexion. */
export async function deriveClientState(secret: string, connectionId: string): Promise<string> {
  return hmac(secret, `graph-client-state.${connectionId}`);
}

// ── Chiffrement des jetons (AES-256-GCM, clé d'environnement) ────────────────
// Format « v1.<iv base64url>.<chiffré+étiquette base64url> ». La donnée
// associée (identifiant de connexion) lie le chiffré à SA ligne : un chiffré
// recopié sur une autre connexion ne se déchiffre pas.
async function aesKey(keyB64: string): Promise<CryptoKey> {
  let raw: Uint8Array;
  try {
    raw = b64urlDecode(keyB64.trim());
  } catch {
    throw new Error('MAIL_TOKEN_KEY illisible');
  }
  if (raw.length !== 32) throw new Error('MAIL_TOKEN_KEY doit contenir 32 octets (base64)');
  return crypto.subtle.importKey('raw', buf(raw), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptToken(keyB64: string, plaintext: string, aad: string): Promise<string> {
  const key = await aesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: buf(iv), additionalData: buf(enc.encode(aad)) }, key, buf(enc.encode(plaintext))),
  );
  return `v1.${b64urlEncode(iv)}.${b64urlEncode(ct)}`;
}

export async function decryptToken(keyB64: string, sealed: string, aad: string): Promise<string> {
  const parts = sealed.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('jeton chiffré : format inconnu');
  const key = await aesKey(keyB64);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: buf(b64urlDecode(parts[1])), additionalData: buf(enc.encode(aad)) },
    key,
    buf(b64urlDecode(parts[2])),
  );
  return dec.decode(pt);
}

// ── Notifications Gmail (Pub/Sub push) ───────────────────────────────────────
/** { emailAddress, historyId } d'une notification push Pub/Sub, sinon null. */
export function parsePubSubPush(body: string): { emailAddress: string; historyId: string; pubsubMessageId: string | null } | null {
  try {
    const outer = JSON.parse(body) as { message?: { data?: unknown; messageId?: unknown } };
    const data = outer?.message?.data;
    if (typeof data !== 'string' || !data) return null;
    const inner = JSON.parse(dec.decode(b64urlDecode(data))) as { emailAddress?: unknown; historyId?: unknown };
    const email = typeof inner.emailAddress === 'string' ? inner.emailAddress.trim().toLowerCase() : '';
    const hid = typeof inner.historyId === 'string' || typeof inner.historyId === 'number' ? String(inner.historyId) : '';
    if (!email || !/^\d+$/.test(hid)) return null;
    return { emailAddress: email, historyId: hid, pubsubMessageId: typeof outer.message?.messageId === 'string' ? outer.message.messageId : null };
  } catch {
    return null;
  }
}

export type Jwk = { kid?: string; kty?: string; alg?: string; n?: string; e?: string; use?: string };
export const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

/**
 * Jeton OIDC d'un abonnement push Pub/Sub (en-tête Authorization: Bearer) :
 * signature RS256 par une clé Google (JWKS fourni par l'appelant), émetteur
 * Google, audience configurée, compte de service attendu, e-mail vérifié,
 * non expiré. Tout le reste est refusé.
 */
export async function verifyGoogleOidcToken(args: {
  token: string | null | undefined;
  jwks: ReadonlyArray<Jwk>;
  audience: string;
  serviceAccountEmail: string;
  nowMs?: number;
}): Promise<boolean> {
  const { token, jwks, audience, serviceAccountEmail } = args;
  if (!token || !audience || !serviceAccountEmail) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  let header: { alg?: string; kid?: string };
  let claims: { iss?: string; aud?: string; email?: string; email_verified?: unknown; exp?: number };
  try {
    header = JSON.parse(dec.decode(b64urlDecode(parts[0])));
    claims = JSON.parse(dec.decode(b64urlDecode(parts[1])));
  } catch {
    return false;
  }
  if (header.alg !== 'RS256' || !header.kid) return false;
  const jwk = jwks.find((k) => k.kid === header.kid && k.kty === 'RSA');
  if (!jwk) return false;
  try {
    const key = await crypto.subtle.importKey('jwk', { kty: 'RSA', n: jwk.n, e: jwk.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, buf(b64urlDecode(parts[2])), buf(enc.encode(`${parts[0]}.${parts[1]}`)));
    if (!ok) return false;
  } catch {
    return false;
  }
  const nowS = (args.nowMs ?? Date.now()) / 1000;
  if (typeof claims.exp !== 'number' || claims.exp < nowS) return false;
  if (!claims.iss || !GOOGLE_ISSUERS.includes(claims.iss)) return false;
  if (claims.aud !== audience) return false;
  if (claims.email !== serviceAccountEmail) return false;
  if (claims.email_verified !== true && claims.email_verified !== 'true') return false;
  return true;
}

// ── Notifications Microsoft Graph ────────────────────────────────────────────
/** Jeton de validation d'un abonnement (à renvoyer tel quel, text/plain, 200). */
export function graphValidationToken(requestUrl: string): string | null {
  try {
    const t = new URL(requestUrl).searchParams.get('validationToken');
    return t && t.length <= 4096 ? t : null;
  } catch {
    return null;
  }
}

export type GraphNotification = {
  subscriptionId: string;
  clientState: string;
  /** null = notification de changement ; sinon événement de cycle de vie. */
  lifecycleEvent: 'reauthorizationRequired' | 'subscriptionRemoved' | 'missed' | null;
  changeType: string | null;
  messageId: string | null;
};

export function parseGraphNotifications(body: string): GraphNotification[] | null {
  try {
    const outer = JSON.parse(body) as { value?: unknown };
    if (!Array.isArray(outer?.value)) return null;
    const out: GraphNotification[] = [];
    for (const raw of outer.value as Record<string, unknown>[]) {
      if (!raw || typeof raw.subscriptionId !== 'string') continue;
      const lc = raw.lifecycleEvent;
      const rd = raw.resourceData as { id?: unknown } | undefined;
      out.push({
        subscriptionId: raw.subscriptionId,
        clientState: typeof raw.clientState === 'string' ? raw.clientState : '',
        lifecycleEvent: lc === 'reauthorizationRequired' || lc === 'subscriptionRemoved' || lc === 'missed' ? lc : null,
        changeType: typeof raw.changeType === 'string' ? raw.changeType : null,
        messageId: rd && typeof rd.id === 'string' ? rd.id : null,
      });
    }
    return out;
  } catch {
    return null;
  }
}

// ── Machine d'état d'une connexion ───────────────────────────────────────────
export type MailEvent =
  | 'reception' // un message réel a été pris en charge
  | 'sync_ok'
  | 'sync_error'
  | 'auth_revoked' // jeton révoqué ou expiré définitivement chez le fournisseur
  | 'pause'
  | 'resume'
  | 'disconnect';

/**
 * Statut suivant, ou null si la transition est interdite (statut inchangé).
 * « connected » n'est JAMAIS atteint sans réception réelle (hasReceived).
 * « revoked » est terminal : reconnecter = nouvelle autorisation OAuth.
 */
export function nextStatus(current: MailStatus, event: MailEvent, hasReceived: boolean): MailStatus | null {
  if (current === 'revoked') return null;
  switch (event) {
    case 'disconnect':
    case 'auth_revoked':
      return 'revoked';
    case 'pause':
      return current === 'paused' ? null : 'paused';
    case 'resume':
      return current === 'paused' ? (hasReceived ? 'connected' : 'pending') : null;
    case 'sync_error':
      return current === 'pending' || current === 'connected' ? 'error' : null;
    case 'reception':
      return current === 'pending' || current === 'error' ? 'connected' : null;
    case 'sync_ok':
      return current === 'error' ? (hasReceived ? 'connected' : 'pending') : null;
  }
}

/** Statuts pour lesquels le serveur a le droit d'interroger le fournisseur. */
export function isSyncable(status: MailStatus): boolean {
  return status === 'pending' || status === 'connected' || status === 'error';
}

// ── Messages : forme commune ─────────────────────────────────────────────────
export type MailAttachment = {
  id: string;
  filename: string;
  contentType: string | null;
  size: number | null;
  inline: boolean;
};

export type MailMessage = {
  id: string;
  threadId: string | null;
  internetMessageId: string | null;
  from: string | null;
  recipients: string[];
  subject: string | null;
  receivedAtMs: number | null;
  labels: string[];
  text: string | null;
  attachments: MailAttachment[];
};

type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name?: string; value?: string }[];
  body?: { attachmentId?: string; size?: number; data?: string };
  parts?: GmailPart[];
};

function header(headers: { name?: string; value?: string }[] | undefined, name: string): string | null {
  const h = (headers ?? []).find((x) => (x.name ?? '').toLowerCase() === name);
  return typeof h?.value === 'string' ? h.value : null;
}

function splitAddresses(value: string | null): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, 50);
}

/** Message Gmail (users.messages.get, format=full) → forme commune. */
export function parseGmailMessage(raw: unknown): MailMessage | null {
  const m = raw as { id?: unknown; threadId?: unknown; labelIds?: unknown; internalDate?: unknown; payload?: GmailPart };
  if (!m || typeof m.id !== 'string') return null;
  const attachments: MailAttachment[] = [];
  let text: string | null = null;
  const walk = (part: GmailPart | undefined, depth: number): void => {
    if (!part || depth > 12) return;
    const disposition = (header(part.headers, 'content-disposition') ?? '').toLowerCase();
    if (part.filename && part.body?.attachmentId) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        contentType: part.mimeType ?? null,
        size: typeof part.body.size === 'number' ? part.body.size : null,
        inline: disposition.startsWith('inline') || header(part.headers, 'content-id') !== null && !disposition.startsWith('attachment'),
      });
    } else if (text === null && part.mimeType === 'text/plain' && typeof part.body?.data === 'string' && part.body.data) {
      try {
        text = dec.decode(b64urlDecode(part.body.data));
      } catch {
        text = null;
      }
    }
    for (const child of part.parts ?? []) walk(child, depth + 1);
  };
  walk(m.payload, 0);
  const h = m.payload?.headers;
  const internal = Number(m.internalDate);
  return {
    id: m.id,
    threadId: typeof m.threadId === 'string' ? m.threadId : null,
    internetMessageId: header(h, 'message-id'),
    from: header(h, 'from'),
    recipients: [...splitAddresses(header(h, 'to')), ...splitAddresses(header(h, 'cc')), ...splitAddresses(header(h, 'delivered-to'))],
    subject: header(h, 'subject'),
    receivedAtMs: Number.isFinite(internal) && internal > 0 ? internal : null,
    labels: Array.isArray(m.labelIds) ? (m.labelIds as unknown[]).filter((x): x is string => typeof x === 'string') : [],
    text,
    attachments,
  };
}

type GraphRecipient = { emailAddress?: { address?: string; name?: string } };

/** Message Graph + liste de ses pièces jointes → forme commune. */
export function parseGraphMessage(raw: unknown, rawAttachments: unknown): MailMessage | null {
  const m = raw as {
    id?: unknown;
    conversationId?: unknown;
    internetMessageId?: unknown;
    subject?: unknown;
    receivedDateTime?: unknown;
    isDraft?: unknown;
    from?: GraphRecipient;
    toRecipients?: GraphRecipient[];
    ccRecipients?: GraphRecipient[];
    body?: { contentType?: string; content?: string };
  };
  if (!m || typeof m.id !== 'string') return null;
  const addr = (r: GraphRecipient | undefined): string | null => (typeof r?.emailAddress?.address === 'string' ? r.emailAddress.address : null);
  const list = (rawAttachments as { value?: unknown })?.value;
  const attachments: MailAttachment[] = [];
  for (const a of (Array.isArray(list) ? list : []) as Record<string, unknown>[]) {
    // Seules les pièces « fichier » : ni élément Outlook joint, ni lien.
    if (a?.['@odata.type'] !== '#microsoft.graph.fileAttachment') continue;
    if (typeof a.id !== 'string' || typeof a.name !== 'string') continue;
    attachments.push({
      id: a.id,
      filename: a.name,
      contentType: typeof a.contentType === 'string' ? a.contentType : null,
      size: typeof a.size === 'number' ? a.size : null,
      inline: a.isInline === true,
    });
  }
  const received = typeof m.receivedDateTime === 'string' ? Date.parse(m.receivedDateTime) : NaN;
  return {
    id: m.id,
    threadId: typeof m.conversationId === 'string' ? m.conversationId : null,
    internetMessageId: typeof m.internetMessageId === 'string' ? m.internetMessageId : null,
    from: addr(m.from),
    recipients: [...(m.toRecipients ?? []), ...(m.ccRecipients ?? [])].map(addr).filter((x): x is string => !!x).slice(0, 50),
    subject: typeof m.subject === 'string' ? m.subject : null,
    receivedAtMs: Number.isFinite(received) ? received : null,
    labels: m.isDraft === true ? ['DRAFT'] : [],
    text: m.body?.contentType?.toLowerCase() === 'text' && typeof m.body.content === 'string' ? m.body.content : null,
    attachments,
  };
}

/** Adresse nue, en minuscules, d'un champ « Nom <adresse> ». */
export function bareAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const a = (value.match(/<([^<>]+)>/)?.[1] ?? value).trim().toLowerCase();
  return /^[^\s@<>]+@[^\s@<>]+$/.test(a) ? a : null;
}

// ── Périmètre : ce message a-t-il le droit d'être importé ? ──────────────────
const GMAIL_EXCLUDED_LABELS = ['SPAM', 'TRASH', 'DRAFT', 'SENT', 'CHAT'];

/** null si le message est dans le périmètre, sinon le motif (français). */
export function outOfScope(
  msg: Pick<MailMessage, 'receivedAtMs' | 'labels' | 'from'>,
  scope: { provider: MailProvider; importSinceMs: number; scopeLabel: string | null; ownAddress: string },
): string | null {
  if (msg.receivedAtMs === null) return 'date de réception inconnue';
  if (msg.receivedAtMs < scope.importSinceMs) return 'antérieur au début du périmètre';
  const excluded = msg.labels.find((l) => GMAIL_EXCLUDED_LABELS.includes(l));
  if (excluded) return `libellé exclu (${excluded})`;
  if (scope.provider === 'gmail') {
    const wanted = scope.scopeLabel || 'INBOX';
    if (!msg.labels.includes(wanted)) return 'hors du libellé surveillé';
  }
  const from = bareAddress(msg.from);
  if (from && scope.ownAddress && from === scope.ownAddress.toLowerCase()) return 'message envoyé par le titulaire';
  return null;
}

// ── Choix du dossier : certain, sinon « à classer » avec proposition ─────────
export type DossierChoice = {
  dossierId: string | null;
  certain: boolean;
  suggestedDossierId: string | null;
  reason: string | null;
};

export type DossierContext = {
  /** Dossier cible choisi explicitement par le titulaire pour cette connexion. */
  connectionDossierId: string | null;
  /** Dossier auquel un message du MÊME fil a déjà été rattaché. */
  threadDossierId: string | null;
  /** Partie locale d'adresse de réception (d-<32 hex>) → dossier. */
  inboundAddressDossiers: Readonly<Record<string, string>>;
  inboundDomain: string;
  /** Dossiers déjà choisis par le titulaire pour ce même expéditeur. */
  senderDossierIds: ReadonlyArray<string>;
  /** Dossiers ouverts du titulaire (rattachement possible). */
  openDossiers: ReadonlyArray<{ id: string; title: string | null }>;
};

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/**
 * Rattachement AUTOMATIQUE uniquement quand il est certain :
 *  1. dossier cible explicite de la connexion ;
 *  2. le message est adressé à l'adresse de réception non devinable d'un dossier ;
 *  3. un message du même fil a déjà été rattaché.
 * Sinon « à classer », avec au mieux une PROPOSITION (jamais appliquée seule) :
 * expéditeur déjà classé dans un seul dossier, ou titre d'un seul dossier
 * présent dans le sujet. Un dossier absent de la liste des dossiers ouverts
 * n'est jamais retenu.
 */
export function chooseDossier(msg: Pick<MailMessage, 'recipients' | 'subject'>, ctx: DossierContext): DossierChoice {
  const open = new Set(ctx.openDossiers.map((d) => d.id));
  const certain = (id: string, reason: string): DossierChoice => ({ dossierId: id, certain: true, suggestedDossierId: null, reason });
  if (ctx.connectionDossierId && open.has(ctx.connectionDossierId)) return certain(ctx.connectionDossierId, 'dossier choisi pour cette connexion');
  const dom = ctx.inboundDomain.trim().toLowerCase();
  if (dom) {
    const hits = new Set<string>();
    for (const r of msg.recipients) {
      const a = bareAddress(r);
      if (!a) continue;
      const at = a.lastIndexOf('@');
      if (a.slice(at + 1) !== dom) continue;
      const id = ctx.inboundAddressDossiers[a.slice(0, at)];
      if (id && open.has(id)) hits.add(id);
    }
    if (hits.size === 1) return certain([...hits][0], 'adressé à l’adresse de réception du dossier');
  }
  if (ctx.threadDossierId && open.has(ctx.threadDossierId)) return certain(ctx.threadDossierId, 'suite d’un fil déjà rattaché');

  const suggest = (id: string, reason: string): DossierChoice => ({ dossierId: null, certain: false, suggestedDossierId: id, reason });
  const senders = [...new Set(ctx.senderDossierIds)].filter((id) => open.has(id));
  if (senders.length === 1) return suggest(senders[0], 'expéditeur déjà classé dans ce dossier');
  const subject = normalize(msg.subject ?? '');
  if (subject) {
    const titled = ctx.openDossiers.filter((d) => {
      const t = normalize((d.title ?? '').trim());
      return t.length >= 6 && subject.includes(t);
    });
    if (titled.length === 1) return suggest(titled[0].id, 'titre du dossier présent dans le sujet');
  }
  return { dossierId: null, certain: false, suggestedDossierId: null, reason: null };
}
