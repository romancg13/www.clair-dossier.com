/**
 * Construit la page LDI autonome : bundle du noyau déterministe (esbuild, format
 * IIFE) injecté dans le gabarit `artifact/ldi.html`.
 *
 * La page résultante est strictement hors ligne — aucun script externe, aucune
 * requête. Seules les fontes Google restent chargées depuis leur hôte.
 *
 *   npm run ldi:artifact              → artifact/dist/ldi.html
 *   npm run ldi:artifact -- <chemin>  → sortie ailleurs
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gabarit = join(racine, 'artifact', 'ldi.html');
const sortie = resolve(process.argv[2] ?? join(racine, 'artifact', 'dist', 'ldi.html'));
const JETON = '/*__LDI_BUNDLE__*/';

const resultat = await build({
  entryPoints: [join(racine, 'src', 'ldi', 'artifact-entry.ts')],
  bundle: true,
  format: 'iife',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  write: false,
  loader: { '.json': 'json' },
});

const code = resultat.outputFiles[0].text;
const html = readFileSync(gabarit, 'utf-8');

if (!html.includes(JETON)) {
  throw new Error(`Jeton ${JETON} absent de ${gabarit}.`);
}
// Remplacement par fonction : le bundle peut contenir des motifs ($&, $1…) que
// la forme littérale de String.replace interpréterait.
const page = html.replace(JETON, () => code);

mkdirSync(dirname(sortie), { recursive: true });
writeFileSync(sortie, page, 'utf-8');

// Deux sorties, parce que les deux usages n'ont pas les mêmes besoins :
//  — `ldi.html` sans squelette : la plateforme d'artefacts fournit elle-même
//    doctype, <head> et <body> ; les ajouter produirait un document imbriqué ;
//  — `ldi.standalone.html` complet : ouvert depuis le disque ou auto-hébergé,
//    un fichier sans doctype bascule le navigateur en mode quirks, ce qui change
//    le modèle de boîte et la mise en page des tableaux dont dépend la feuille
//    de style. `lang="fr"` sert aussi la synthèse vocale.
const autonome = `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${page}
</body>
</html>
`;
const sortieAutonome = sortie.replace(/\.html$/, '.standalone.html');
writeFileSync(sortieAutonome, autonome, 'utf-8');

const ko = (t) => `${(Buffer.byteLength(t, 'utf-8') / 1024).toFixed(1)} ko`;
process.stdout.write(
  `${sortie}\n  bundle ${ko(code)} · page ${ko(page)}\n${sortieAutonome}\n  autonome ${ko(autonome)}\n`
);
