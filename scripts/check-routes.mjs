#!/usr/bin/env node
/**
 * Vérification des routes publiques — Lot 1.1 (Vague 0).
 *
 * Interroge les routes de référence et affiche le code HTTP, le TTFB et la
 * taille. À exécuter AVANT et APRÈS la bascule DNS (voir docs/GO-LIVE-NETLIFY.md).
 *
 * Usage :
 *   node scripts/check-routes.mjs                                  # prod (www.clair-dossier.com)
 *   node scripts/check-routes.mjs https://clair-dossier.netlify.app # cible Netlify
 *   node scripts/check-routes.mjs http://localhost:4173             # vite preview local
 *   node scripts/check-routes.mjs <base> --all                      # toutes les routes du sitemap
 *
 * Code de sortie : 0 si tout est en 200, 1 sinon (utilisable en CI).
 */

const base = (process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'https://www.clair-dossier.com').replace(/\/$/, '');
const all = process.argv.includes('--all');

// Les 10 routes du constat initial (audit du 29/08/2026) — ne pas modifier :
// elles servent de base de comparaison avant/après bascule.
const CORE_ROUTES = [
  '/',
  '/tarifs',
  '/securite',
  '/fonctionnalites',
  '/contact',
  '/blog',
  '/blog/ia-droit',
  '/mentions-legales',
  '/robots.txt',
  '/sitemap.xml',
];

async function loadAllRoutes() {
  // Routes réelles depuis le sitemap généré (source : src/data/routes.ts).
  try {
    const res = await fetch(`${base}/sitemap.xml`);
    if (!res.ok) throw new Error(`sitemap ${res.status}`);
    const xml = await res.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
    return [...new Set([...CORE_ROUTES, ...locs])];
  } catch (e) {
    console.error(`(impossible de lire le sitemap distant : ${e.message} — routes de base uniquement)`);
    return CORE_ROUTES;
  }
}

async function check(path) {
  const url = `${base}${path}`;
  const start = performance.now();
  try {
    const res = await fetch(url, { redirect: 'manual' });
    await res.arrayBuffer();
    const ms = Math.round(performance.now() - start);
    const redirect = res.status >= 300 && res.status < 400 ? ` → ${res.headers.get('location') ?? '?'}` : '';
    return { path, status: res.status, ms, redirect };
  } catch (e) {
    return { path, status: 0, ms: 0, redirect: '', error: String(e.cause ?? e.message) };
  }
}

const routes = all ? await loadAllRoutes() : CORE_ROUTES;
console.log(`Cible : ${base} — ${routes.length} routes\n`);

let failures = 0;
for (const path of routes) {
  const r = await check(path);
  const ok = r.status === 200;
  if (!ok) failures += 1;
  const mark = ok ? 'OK ' : 'KO ';
  console.log(
    `${mark} ${String(r.status).padStart(3)}  ${String(r.ms).padStart(5)} ms  ${r.path}${r.redirect}${r.error ? `  (${r.error})` : ''}`
  );
}

console.log(`\n${routes.length - failures}/${routes.length} routes en 200.`);
process.exit(failures === 0 ? 0 : 1);
