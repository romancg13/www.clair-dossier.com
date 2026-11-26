#!/usr/bin/env node
/**
 * Neutralisation de la PRÉVISUALISATION (Vercel uniquement — jamais la production).
 *
 * Exécuté après `npm run build` par vercel.json. Le code source et les fichiers
 * de paiement gelés ne changent pas : seul le dossier dist/ de la preview est
 * réécrit.
 *   1. Tout lien de paiement Stripe LIVE est remplacé par un lien interne inerte ;
 *      le script ÉCHOUE s'il en reste un seul (aucun paiement réel possible).
 *   2. Pages non indexables (meta robots + robots.txt) et sans canonique.
 *   3. Bandeau visible « prévisualisation ».
 * Garde-fou : refuse de s'exécuter hors Vercel sauf --force (tests locaux).
 */
import { copyFileSync, existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dirArg = process.argv.find((a) => a.startsWith('--dir='))?.slice(6) ?? 'dist';
const DIST = new URL(`../${dirArg.replace(/\/$/, '')}/`, import.meta.url).pathname;
if (!process.env.VERCEL && !process.argv.includes('--force')) {
  console.error('preview-neutralise : réservé au build Vercel de prévisualisation (ou --force).');
  process.exit(1);
}

const LIVE = /https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g;
const INERTE = '/tarifs?paiement=desactive-en-previsualisation';
const TEXTE = /\.(html|js|mjs|css|json|md|txt|xml|webmanifest)$/;
const BANDEAU =
  '<div role="note" style="position:fixed;left:0;right:0;bottom:0;z-index:2147483647;padding:6px 12px;' +
  'background:#0c1a2e;color:#e9d9b0;font:600 12px/1.4 system-ui,sans-serif;text-align:center;pointer-events:none">' +
  'Prévisualisation privée — données fictives, paiements désactivés</div>';

function* fichiers(dir) {
  for (const nom of readdirSync(dir)) {
    const p = join(dir, nom);
    if (statSync(p).isDirectory()) yield* fichiers(p);
    else if (TEXTE.test(nom)) yield p;
  }
}

// Recette : chaque lien Stripe LIVE devient le paiement de recette (bac à sable interne) de LA MÊME formule ;
// correspondance lue dans src/data/pricing.ts (fichier gelé, lu sans être modifié). Démonstration : lien inerte.
const formules = new Map();
if (process.argv.includes('--pwa=recette')) {
  const pricing = readFileSync(new URL('../src/data/pricing.ts', import.meta.url), 'utf8');
  for (const bloc of pricing.split(/\n\s*\{\s*\n/).slice(1)) {
    const id = /id:\s*["']([^"']+)["']/.exec(bloc)?.[1];
    if (id) for (const m of bloc.matchAll(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g)) formules.set(m[0], id);
  }
}
const versRecette = (lien) => (formules.has(lien) ? `/abonnement?formule=${formules.get(lien)}` : INERTE);
let liens = 0;
let pages = 0;
for (const f of fichiers(DIST)) {
  const avant = readFileSync(f, 'utf8');
  let apres = avant.replace(LIVE, (lien) => (liens++, versRecette(lien)));
  if (f.endsWith('.html')) {
    apres = apres
      .replace(/(<meta name="robots" content=")[^"]*(")/, '$1noindex, nofollow$2')
      .replace(/<link rel="canonical"[^>]*>\s*/g, '');
    if (!apres.includes(BANDEAU)) apres = apres.replace('</body>', `${BANDEAU}</body>`);
    pages++;
  }
  if (apres !== avant) writeFileSync(f, apres);
}
writeFileSync(join(DIST, 'robots.txt'), 'User-agent: *\nDisallow: /\n');

// Application installable : la recette et la démonstration ne doivent JAMAIS se confondre avec la production
// sur un écran d'accueil — nom, identifiant et icônes distincts (bandeau « RECETTE » sur l'icône).
const pwa = process.argv.find((a) => a.startsWith('--pwa='))?.slice(6);
const manifeste = join(DIST, 'manifest.webmanifest');
if (pwa && existsSync(manifeste)) {
  const m = JSON.parse(readFileSync(manifeste, 'utf8'));
  const nom = pwa === 'recette' ? 'ClairDossier Recette' : 'ClairDossier Démo';
  Object.assign(m, { id: `/?app=clairdossier-${pwa}`, name: nom, short_name: pwa === 'recette' ? 'CD Recette' : 'CD Démo', description: `${nom} — données fictives, aucun paiement réel.` });
  if (pwa === 'demo') Object.assign(m, { start_url: '/demo?source=application', shortcuts: [] });
  writeFileSync(manifeste, JSON.stringify(m, null, 2));
  const icones = new URL('../recette/pwa/', import.meta.url).pathname;
  for (const f of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png']) copyFileSync(join(icones, f), join(DIST, f));
  for (const f of fichiers(DIST)) {
    if (!f.endsWith('.html')) continue;
    const h = readFileSync(f, 'utf8');
    const n = h.replace(/(<meta name="apple-mobile-web-app-title" content=")[^"]*(")/, `$1${pwa === 'recette' ? 'CD Recette' : 'CD Démo'}$2`);
    if (n !== h) writeFileSync(f, n);
  }
}

const restants = [...fichiers(DIST)].filter((f) => /https:\/\/buy\.stripe\.com\/[A-Za-z0-9]/.test(readFileSync(f, 'utf8')));
if (restants.length) {
  console.error(`preview-neutralise : ÉCHEC — lien de paiement LIVE encore présent dans :\n${restants.join('\n')}`);
  process.exit(1);
}
console.log(`preview-neutralise : ${liens} lien(s) de paiement neutralisé(s), ${pages} page(s) en noindex, 0 lien LIVE restant.`);
