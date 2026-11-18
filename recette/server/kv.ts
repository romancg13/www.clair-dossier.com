// Stockage clé-valeur à écritures conditionnelles (ETag) : la seule primitive
// dont l'adaptateur de recette a besoin pour une file et des documents durables.
//  - BlobKv : Vercel Blob privé (recette hébergée, persistance réelle) ;
//  - MemoryKv : mémoire de processus — TESTS UNIQUEMENT, jamais présenté comme persistant.
import { BlobNotFoundError, BlobPreconditionFailedError, del, get, head, list, put } from '@vercel/blob';

export interface KvEntry<T> {
  value: T;
  etag: string;
}
export type PutResult = { ok: true; etag: string } | { ok: false };

export interface Kv {
  readonly durable: boolean;
  /** `fresh` : lecture d'autorité (plus lente) avant une écriture conditionnelle qui a déjà échoué. */
  getJson<T>(key: string, opts?: { fresh?: boolean }): Promise<KvEntry<T> | null>;
  /** ifMatch : remplace seulement si l'ETag correspond ; create : échoue si la clé existe. */
  putJson(key: string, value: unknown, opts?: { ifMatch?: string; create?: boolean }): Promise<PutResult>;
  getBytes(key: string): Promise<Uint8Array | null>;
  putBytes(key: string, bytes: Uint8Array, contentType: string): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

/** Lecture-modification-écriture avec reprise sur conflit (optimiste). */
export async function update<T>(kv: Kv, key: string, fn: (cur: T | null) => T | null, attempts = 8): Promise<T | null> {
  for (let i = 0; i < attempts; i++) {
    const cur = await kv.getJson<T>(key, { fresh: i >= 2 });
    const next = fn(cur ? structuredClone(cur.value) : null);
    if (next === null) return cur?.value ?? null;
    const r = await kv.putJson(key, next, cur ? { ifMatch: cur.etag } : { create: true });
    if (r.ok) return next;
    await new Promise((res) => setTimeout(res, 25 + Math.random() * 90 * (i + 1)));
  }
  throw new Error(`conflit d'écriture persistant (${key.split('/')[0]})`);
}

export class MemoryKv implements Kv {
  readonly durable = false;
  private m = new Map<string, { data: Uint8Array; etag: string; type: string }>();
  private n = 0;
  async getJson<T>(key: string) {
    const e = this.m.get(key);
    return e ? { value: JSON.parse(new TextDecoder().decode(e.data)) as T, etag: e.etag } : null;
  }
  async putJson(key: string, value: unknown, opts: { ifMatch?: string; create?: boolean } = {}): Promise<PutResult> {
    const cur = this.m.get(key);
    if (opts.create && cur) return { ok: false };
    if (opts.ifMatch && (!cur || cur.etag !== opts.ifMatch)) return { ok: false };
    const etag = `e${++this.n}`;
    this.m.set(key, { data: new TextEncoder().encode(JSON.stringify(value)), etag, type: 'application/json' });
    return { ok: true, etag };
  }
  async getBytes(key: string) {
    return this.m.get(key)?.data.slice() ?? null;
  }
  async putBytes(key: string, bytes: Uint8Array, contentType: string) {
    this.m.set(key, { data: bytes.slice(), etag: `e${++this.n}`, type: contentType });
  }
  async delete(key: string) {
    this.m.delete(key);
  }
  async list(prefix: string) {
    return [...this.m.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

async function readAll(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Vercel Blob privé. Authentification : jeton OIDC de la fonction ou BLOB_READ_WRITE_TOKEN (serveur). */
const strongEtag = (e: string) => e.replace(/^W\//, '');

export class BlobKv implements Kv {
  readonly durable = true;
  constructor(private readonly prefix = 'recette/') {}
  private k(key: string) {
    return `${this.prefix}${key}`;
  }
  /**
   * Lecture rapide : CDN de la région du magasin, sans cache (cache=0) et sans
   * compression — un CDN qui compresse renvoie un ETag faible (W/"…") que
   * l'écriture conditionnelle refuse. Lecture d'autorité (`fresh`) : ETag de
   * référence via head() (API) et contenu lu à une adresse propre à cet ETag.
   */
  async getJson<T>(key: string, opts: { fresh?: boolean } = {}) {
    if (!opts.fresh) {
      const r = await get(this.k(key), { access: 'private', useCache: false, headers: { 'accept-encoding': 'identity' } });
      if (!r || r.statusCode !== 200 || !r.stream) return null;
      return { value: JSON.parse(new TextDecoder().decode(await readAll(r.stream))) as T, etag: strongEtag(r.blob.etag) };
    }
    for (let i = 0; i < 5; i++) {
      let meta: Awaited<ReturnType<typeof head>>;
      try {
        meta = await head(this.k(key));
      } catch (e) {
        if (e instanceof BlobNotFoundError) return null;
        throw e;
      }
      const u = new URL(meta.url);
      u.searchParams.set('v', meta.etag.replace(/[^A-Za-z0-9]/g, ''));
      const r = await get(u.toString(), { access: 'private', useCache: false, headers: { 'accept-encoding': 'identity' } });
      if (r && r.statusCode === 200 && r.stream) {
        const text = new TextDecoder().decode(await readAll(r.stream));
        if (!r.blob.etag || strongEtag(r.blob.etag) === strongEtag(meta.etag)) return { value: JSON.parse(text) as T, etag: meta.etag };
        if (i === 4) console.error(JSON.stringify({ evt: 'stockage', etag_api: meta.etag, etag_lu: r.blob.etag }));
      }
      await new Promise((res) => setTimeout(res, 40 * (i + 1)));
    }
    throw new Error('lecture incohérente du stockage');
  }
  async putJson(key: string, value: unknown, opts: { ifMatch?: string; create?: boolean } = {}): Promise<PutResult> {
    try {
      const r = await put(this.k(key), JSON.stringify(value), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: !opts.create,
        ...(opts.ifMatch ? { ifMatch: opts.ifMatch } : {}),
        contentType: 'application/json',
        cacheControlMaxAge: 60,
      });
      return { ok: true, etag: (r as { etag?: string }).etag ?? '' };
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError) return { ok: false };
      if (opts.create && /already exists/i.test(String((e as Error).message))) return { ok: false };
      throw e;
    }
  }
  async getBytes(key: string) {
    const r = await get(this.k(key), { access: 'private', useCache: false });
    return r && r.statusCode === 200 && r.stream ? readAll(r.stream) : null;
  }
  async putBytes(key: string, bytes: Uint8Array, contentType: string) {
    await put(this.k(key), Buffer.from(bytes), { access: 'private', addRandomSuffix: false, allowOverwrite: true, contentType, cacheControlMaxAge: 60 });
  }
  async delete(key: string) {
    await del(this.k(key)).catch(() => undefined);
  }
  async list(prefix: string) {
    const out: string[] = [];
    let cursor: string | undefined;
    do {
      const r = await list({ prefix: this.k(prefix), cursor, limit: 1000 });
      out.push(...r.blobs.map((b) => b.pathname.slice(this.prefix.length)));
      cursor = r.hasMore ? r.cursor : undefined;
    } while (cursor);
    return out.sort();
  }
}
