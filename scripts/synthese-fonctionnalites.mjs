// Calcule la synthèse de docs/recette/ETAT_FONCTIONNALITES.md à partir de ses tableaux (aucun chiffre saisi à la main).
import { readFileSync, writeFileSync } from 'node:fs';
const p = 'docs/recette/ETAT_FONCTIONNALITES.md';
const src = readFileSync(p, 'utf8').split('<!-- SYNTHESE -->')[0];
const S = ['OK', 'ÉMU', 'PART', 'DNT', 'SIM', 'BLQ', 'ND', 'DV', '—'];
const rows = [...src.matchAll(/^\| ([A-O])-\d+ \|(.*)\|$/gm)].map((m) => ({ cat: m[1], c: m[2].split('|').map((x) => x.trim()) }));
const env = { Local: 2, Recette: 3, Production: 4 };
const out = ['<!-- SYNTHESE -->', '## Synthèse (calculée par `node scripts/synthese-fonctionnalites.mjs`)', '', `Fonctionnalités recensées : **${rows.length}**.`, ''];
for (const [nom, i] of Object.entries(env)) {
  const n = Object.fromEntries(S.map((s) => [s, rows.filter((r) => r.c[i] === s).length]));
  const actif = rows.length - n['—'] - n.DV;
  const etabli = rows.length - n.DNT;
  out.push(`### ${nom}`, '', `| ${S.join(' | ')} |`, `|${S.map(() => '---').join('|')}|`, `| ${S.map((s) => n[s]).join(' | ')} |`, '',
    `- Couverture de vérification : ${etabli}/${rows.length} = **${Math.round((etabli / rows.length) * 100)} %** (état établi par une preuve ; exclus : les ${n.DNT} « développé mais non testé »).`,
    `- Taux d'opérationnalité : ${n.OK}/${actif} = **${actif ? Math.round((n.OK / actif) * 100) : 0} %** vérifié réellement, plus ${n['ÉMU']} vérifié par émulation (périmètre actif = recensées − sans objet − désactivées volontairement ; simulé, bloqué et non développé restent au dénominateur).`, '');
}
out.push('### Par catégorie (colonne Recette)', '', `| Catégorie | Total | ${S.join(' | ')} |`, `|---|---|${S.map(() => '---').join('|')}|`);
for (const cat of 'ABCDEFGHIJKLMNO') { const r = rows.filter((x) => x.cat === cat); out.push(`| ${cat} | ${r.length} | ${S.map((s) => r.filter((x) => x.c[3] === s).length).join(' | ')} |`); }
writeFileSync(p, src + out.join('\n') + '\n');
console.log(out.slice(3, 40).join('\n'));
