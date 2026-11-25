#!/usr/bin/env node
/**
 * Point d'entrée UNIQUE des builds Vercel de recette (jamais la production, qui
 * est servie par GitHub Pages). Une seule branche alimente les deux projets :
 *  - projet doté d'un stockage Blob (recette hébergée, parcours réel) →
 *    scripts/recette/vercel-build.mjs (site + fonction API) ;
 *  - sinon (prévisualisation statique, /demo) → build du site.
 * Dans les deux cas la sortie est neutralisée : aucun lien Stripe LIVE, noindex.
 */
import { execSync } from 'node:child_process';

const sh = (cmd) => execSync(cmd, { stdio: 'inherit' });
if (process.env.BLOB_READ_WRITE_TOKEN) {
  sh('node scripts/recette/vercel-build.mjs');
  sh('node scripts/preview-neutralise.mjs --dir=.vercel/output/static --pwa=recette');
} else {
  sh('npm run build');
  sh('node scripts/preview-neutralise.mjs --pwa=demo');
}
