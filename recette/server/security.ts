// Primitives de sécurité de la recette : mots de passe (scrypt), jetons opaques
// (empreinte SHA-256 seule stockée), liens signés temporaires (HMAC), comparaison
// à temps constant. Aucun secret n'est journalisé ni renvoyé au client.
import { createHmac, randomBytes, scrypt as scryptCb, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pwd: string, salt: Buffer, len: number) => Promise<Buffer>;

export async function hashPassword(pwd: string): Promise<{ salt: string; hash: string }> {
  const salt = randomBytes(16);
  return { salt: salt.toString('base64'), hash: (await scrypt(pwd, salt, 64)).toString('base64') };
}
export async function checkPassword(pwd: string, stored: { salt: string; hash: string }): Promise<boolean> {
  if (!stored.salt || !stored.hash) return false;
  const h = await scrypt(pwd, Buffer.from(stored.salt, 'base64'), 64);
  const ref = Buffer.from(stored.hash, 'base64');
  return h.length === ref.length && timingSafeEqual(h, ref);
}
export const token = (bytes = 32) => randomBytes(bytes).toString('base64url');
export const sha = (s: string) => createHash('sha256').update(s).digest('hex');
export const emailKey = (email: string) => sha(email.trim().toLowerCase());

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Lien signé : chemin + titulaire + expiration, HMAC-SHA256. */
export function signLink(secret: string, payload: { path: string; user: string; exp: number; name: string }): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}
export function verifyLink(secret: string, tokenStr: string, now: number): { path: string; user: string; exp: number; name: string } | null {
  const [body, sig] = tokenStr.split('.');
  if (!body || !sig) return null;
  const expect = createHmac('sha256', secret).update(body).digest('base64url');
  if (!safeEqual(sig, expect)) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as { path: string; user: string; exp: number; name: string };
  return p.exp > now ? p : null;
}

/** Signature d'événement (format inspiré de Stripe : t=…,v1=HMAC(t.corps)) — tolérance 5 min. */
export function signEvent(secret: string, body: string, t: number): string {
  return `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;
}
export function verifyEvent(secret: string, body: string, header: string | null, nowSec: number): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => p.split('=') as [string, string]));
  const t = Number(parts.t);
  if (!t || Math.abs(nowSec - t) > 300 || !parts.v1) return false;
  return safeEqual(parts.v1, createHmac('sha256', secret).update(`${t}.${body}`).digest('hex'));
}
