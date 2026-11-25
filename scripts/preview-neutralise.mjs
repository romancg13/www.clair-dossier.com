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
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
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

let liens = 0;
let pages = 0;
for (const f of fichiers(DIST)) {
  const avant = readFileSync(f, 'utf8');
  let apres = avant.replace(LIVE, () => (liens++, INERTE));
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

const restants = [...fichiers(DIST)].filter((f) => /https:\/\/buy\.stripe\.com\/[A-Za-z0-9]/.test(readFileSync(f, 'utf8')));
if (restants.length) {
  console.error(`preview-neutralise : ÉCHEC — lien de paiement LIVE encore présent dans :\n${restants.join('\n')}`);
  process.exit(1);
}
console.log(`preview-neutralise : ${liens} lien(s) de paiement neutralisé(s), ${pages} page(s) en noindex, 0 lien LIVE restant.`);
