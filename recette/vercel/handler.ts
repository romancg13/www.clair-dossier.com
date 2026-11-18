// Fonction Vercel unique (Build Output API) : adapte la requête Node à l'API standard.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { waitUntil } from '@vercel/functions';
import { handle } from '../server/api.ts';
import { apiEnv } from '../server/runtime.ts';
import { blobStats } from '../server/kv.ts';

const SECURITY = { 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-robots-tag': 'noindex, nofollow' };

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const t0 = Date.now();
  const s0 = { ...blobStats };
  try {
    const host = req.headers['x-forwarded-host'] ?? req.headers.host ?? 'localhost';
    const proto = (req.headers['x-forwarded-proto'] as string) ?? 'https';
    const site = process.env.RECETTE_SITE_URL || `${proto}://${host}`;
    const raw = new URL(req.url ?? '/', site);
    // Chemin d'origine transmis par la règle de réécriture (__p) : l'API voit l'URL publique.
    const p = raw.searchParams.get('__p');
    if (p !== null) {
      raw.searchParams.delete('__p');
      raw.pathname = `/${p}`;
    }
    const chunks: Buffer[] = [];
    if (req.method !== 'GET' && req.method !== 'HEAD') for await (const c of req) chunks.push(c as Buffer);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const request = new Request(raw, { method: req.method, headers, body: chunks.length ? Buffer.concat(chunks) : undefined });
    const env = await apiEnv(site, (pr) => waitUntil(pr.catch(() => undefined)));
    const r = await handle(env, request);
    res.statusCode = r.status;
    r.headers.forEach((v, k) => res.setHeader(k, v));
    for (const [k, v] of Object.entries(SECURITY)) if (!res.hasHeader(k)) res.setHeader(k, v);
    res.end(Buffer.from(await r.arrayBuffer()));
    const ms = Date.now() - t0;
    if (ms > 2500) console.warn(JSON.stringify({ evt: 'requete_lente', route: raw.pathname.replace(/[0-9a-f-]{36}/g, ':id'), statut: r.status, ms, acces: Object.fromEntries(Object.entries(blobStats).map(([k, v]) => [k, v - s0[k as keyof typeof s0]])) }));
  } catch {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'Erreur interne de la recette.' }));
  }
}
