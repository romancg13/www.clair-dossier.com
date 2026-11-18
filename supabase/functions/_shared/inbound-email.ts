// Réception e-mail entrante (Resend) — partie PURE, sans dépendance :
// vérification de signature Svix, routage par destinataire, règles
// d'acceptation des pièces jointes. Importée par la fonction email-inbound
// (Deno) et par les tests (Node, Web Crypto natif).

/* Règles d'acceptation : MÊMES valeurs que packages/core/src/documents.ts
   (une fonction Edge ne peut pas importer hors de supabase/functions ;
   tests/email-inbound.test.ts vérifie que les deux restent identiques). */
export const INBOUND_ACCEPTED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'txt'];
export const INBOUND_MAX_BYTES = 25 * 1024 * 1024; // 25 Mo

/** Même règle que sanitizeFileName (packages/core) : chemin de stockage sûr. */
export function sanitizeInboundName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80);
}

/** Message d'erreur (français) ou null si la pièce jointe est acceptée. */
export function acceptAttachment(meta: { filename: string | null | undefined; size?: number | null }): string | null {
  const name = (meta.filename ?? '').trim();
  if (!name) return 'pièce jointe sans nom';
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  if (!INBOUND_ACCEPTED_EXTENSIONS.includes(ext)) {
    return `« ${name} » : format non accepté (formats : ${INBOUND_ACCEPTED_EXTENSIONS.join(', ')}).`;
  }
  if (typeof meta.size === 'number' && meta.size > INBOUND_MAX_BYTES) {
    return `« ${name} » : fichier trop volumineux (maximum 25 Mo).`;
  }
  if (meta.size === 0) return `« ${name} » : fichier vide.`;
  return null;
}

/**
 * Routage par DESTINATAIRE enregistré, jamais par expéditeur : parties locales
 * « d-<32 hex> » des destinataires qui sont sur NOTRE sous-domaine de réception.
 * Accepte « Nom <adresse> » et les casses mélangées ; dédoublonne.
 */
export function inboundLocalParts(
  recipients: ReadonlyArray<string | null | undefined>,
  domain: string,
): string[] {
  const dom = domain.trim().toLowerCase();
  if (!dom) return [];
  const found = new Set<string>();
  for (const r of recipients) {
    if (!r) continue;
    const addr = (r.match(/<([^<>]+)>/)?.[1] ?? r).trim().toLowerCase();
    const at = addr.lastIndexOf('@');
    if (at <= 0 || addr.slice(at + 1) !== dom) continue;
    const local = addr.slice(0, at);
    if (/^d-[0-9a-f]{32}$/.test(local)) found.add(local);
  }
  return [...found];
}

/** Tolérance d'horodatage de la signature (anti-rejeu) : ± 5 minutes. */
export const SVIX_TOLERANCE_S = 300;

/**
 * Signature Svix (en-têtes svix-id / svix-timestamp / svix-signature) :
 * HMAC-SHA256 de `id.timestamp.corps` avec le secret (base64 après le préfixe
 * whsec_), comparée en temps constant à chaque candidate « v1,<base64> ».
 * Le corps doit être le corps BRUT de la requête, jamais re-sérialisé.
 */
export async function verifySvixSignature(args: {
  secret: string;
  id: string | null;
  timestamp: string | null;
  signature: string | null;
  body: string;
  nowMs?: number;
}): Promise<boolean> {
  const { secret, id, timestamp, signature, body } = args;
  if (!secret || !id || !timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowS = (args.nowMs ?? Date.now()) / 1000;
  if (Math.abs(nowS - ts) > SVIX_TOLERANCE_S) return false;
  const keyB64 = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(keyB64), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  const key = await crypto.subtle.importKey('raw', keyBytes as unknown as ArrayBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${id}.${timestamp}.${body}`) as unknown as ArrayBuffer));
  let bin = '';
  for (const b of mac) bin += String.fromCharCode(b);
  const expected = btoa(bin);
  let valid = false;
  for (const part of signature.split(/\s+/)) {
    const comma = part.indexOf(',');
    if (comma <= 0) continue;
    if (part.slice(0, comma) !== 'v1') continue;
    const sig = part.slice(comma + 1);
    if (sig.length !== expected.length) continue;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
    if (diff === 0) valid = true;
  }
  return valid;
}
