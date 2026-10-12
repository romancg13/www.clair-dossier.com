/**
 * Génère le Kit documentaire (version complète, imprimable) à partir de la source
 * unique src/data/blog/kit-documentaire.ts : une fiche Markdown par liste, cases à
 * cocher, plus deux modèles. Sortie : docs/produits/kit-documentaire/.
 *   node --import tsx scripts/gen-kit.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { kitDocumentaire } from '../src/data/blog/kit-documentaire.ts';

const OUT = 'docs/produits/kit-documentaire';
mkdirSync(OUT, { recursive: true });

const disclaimer =
  "> Aide-mémoire d'organisation, non exhaustif. Ne remplace pas l'avis d'un professionnel (avocat, expert-comptable) sur votre situation.";

const sheets: Array<{ title: string; items: string[]; intro?: string }> = [];
for (const block of kitDocumentaire.content) {
  if (block.type === 'h2' && /^\d\./.test(block.text)) sheets.push({ title: block.text, items: [] });
  else if (block.type === 'p' && sheets.length && !sheets.at(-1)!.items.length) sheets.at(-1)!.intro = block.text;
  else if (block.type === 'list' && sheets.length) sheets.at(-1)!.items.push(...block.items);
}

sheets.forEach((sheet, i) => {
  const slug = sheet.title.replace(/^\d\.\s*/, '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const body = [
    `# ${sheet.title.replace(/^\d\.\s*/, '')}`,
    '',
    disclaimer,
    '',
    ...(sheet.intro ? [sheet.intro, ''] : []),
    'Dossier : ______________________   Date de vérification : ____ / ____ / ________',
    '',
    ...sheet.items.map((item) => `- [ ] ${item}`),
    '',
    'Pièces manquantes / à relancer :',
    '',
    '- ',
    '',
    '---',
    'Kit documentaire ClairDossier — www.clair-dossier.com',
    '',
  ].join('\n');
  writeFileSync(`${OUT}/0${i + 1}-${slug}.md`, body);
});

writeFileSync(
  `${OUT}/06-modele-chronologie.md`,
  [
    '# Modèle de chronologie',
    '',
    disclaimer,
    '',
    "Une ligne par événement, dans l'ordre des dates. Une colonne « Pièce » renvoie au nom du fichier (AAAA-MM-JJ_nature_tiers.pdf).",
    '',
    '| Date (AAAA-MM-JJ) | Événement | Qui | Pièce |',
    '|---|---|---|---|',
    '| | | | |',
    '| | | | |',
    '| | | | |',
    '',
  ].join('\n'),
);
writeFileSync(
  `${OUT}/07-registre-echeances.csv`,
  'date_echeance;action;piece_concernee;responsable;rappel_le;fait\n;;;;;\n',
);
console.log(`Kit généré : ${sheets.length} fiches + 2 modèles dans ${OUT}/`);
