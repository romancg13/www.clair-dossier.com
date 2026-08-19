/**
 * LDI — orchestration.
 *
 * Chaîne les modules déterministes et produit le rapport qui sera, selon les
 * cas, lu tel quel par l'avocat ou versé au contexte d'un modèle de langage.
 *
 * Tout ce qui est ici est reproductible : mêmes entrées, même sortie. C'est
 * la partie du système qui peut être vérifiée, testée et opposée. La partie
 * générative, elle, reste en aval et ne recalcule rien.
 */
import { analyserDossier } from './modules/chronologie';
import { detecterIrregularites } from './modules/nullites';
import { construireStrategie } from './modules/strategie';
import { celluleMarkdown } from './markdown';
import { VERSION_LDI } from './prompt';
import type { Dossier, RapportLdi } from './types';

/** Limites applicables à tout rapport produit par ce pipeline. */
const LIMITES_STRUCTURELLES = [
  // En tête, parce que c'est la lecture erronée la plus coûteuse : prendre
  // l'absence d'anomalie pour un satisfecit de régularité.
  "Points de contrôle couverts : garde à vue, contrôle d'identité, perquisition en enquête préliminaire, traçabilité des scellés, prescription. NON couverts : l'instruction, la détention provisoire, les interceptions, les expertises au fond, la procédure d'audience et les voies de recours. Un rapport sans anomalie ne signifie donc PAS que la procédure est régulière : il signifie que les dix points contrôlés n'ont rien révélé.",
  "L'analyse ne porte que sur les éléments saisis dans le dossier fourni. Une pièce non saisie est invisible pour le système, et son absence n'est pas signalée.",
  "Les statuts de vérification des textes sont ceux de l'index interne. Sans accès à Légifrance pendant l'exécution, toutes les références sont marquées « à vérifier » et doivent être confrontées à leur source avant citation dans un acte.",
  "Aucune jurisprudence n'est produite par le pipeline déterministe : la recherche de décisions relève du module 2 et de ses sources officielles.",
  "Les seuils de déclenchement (délais de tri, signaux textuels) sont des règles d'alerte fixées par convention, non des règles de droit. Ils orientent le regard, ils ne qualifient rien.",
  "Ce rapport n'est pas une consultation juridique. Il prépare le travail de l'avocat, qui décide seul des moyens soulevés et en assume la responsabilité.",
];

export function analyser(dossier: Dossier): RapportLdi {
  const analyse = analyserDossier(dossier);
  const nullites = detecterIrregularites(dossier, analyse);
  const strategie = construireStrategie(analyse, nullites);

  const limites = [...LIMITES_STRUCTURELLES];
  if (dossier.pieces.length === 0) {
    limites.unshift("Aucune pièce n'a été versée : rien n'est établi, tous les constats sont conditionnels.");
  }

  return {
    version: VERSION_LDI,
    genereLe: new Date().toISOString(),
    dossier: analyse,
    nullites,
    strategie,
    limites,
  };
}

/**
 * Rend le rapport en markdown : lisible par l'avocat, et exploitable comme
 * contexte par un modèle de langage.
 */
export function rendreMarkdown(rapport: RapportLdi): string {
  const { dossier, nullites, strategie } = rapport;

  const sections: string[] = [];

  sections.push(`# Rapport d'analyse — dossier ${dossier.reference}

*LDI v${rapport.version} · généré le ${rapport.genereLe.slice(0, 16).replace('T', ' à ')} UTC*

**Qualifications poursuivies :** ${dossier.qualifications.join(' · ') || 'non renseignées'}
**Régime procédural retenu :** ${dossier.regime}
**Pièces au dossier :** ${dossier.piecesTotal}, dont ${dossier.piecesOrphelines.length} non rattachée(s) à la chronologie`);

  sections.push(`## 1. Contradictions relevées

${
  dossier.contradictions.length === 0
    ? "Aucune contradiction détectée par les contrôles automatiques. Cela ne signifie pas qu'il n'y en a pas : les contrôles ne portent que sur les heures, les durées et l'ordre des actes."
    : dossier.contradictions
        .map(
          (c) =>
            `**[${c.severite.toUpperCase()}] ${c.type}** — ${c.constat}\n> À vérifier : ${c.verificationSuggeree}`
        )
        .join('\n\n')
}`);

  sections.push(`## 2. Points de contrôle procéduraux

| Point | Résultat | Constat |
|---|---|---|
${nullites.points
  .map((p) => `| ${p.id} — ${p.intitule} | ${p.resultat} | ${celluleMarkdown(p.constat)} |`)
  .join('\n')}

**Anomalies : ${nullites.anomalies.length} · Points non établis : ${nullites.nonEtablis.length}**

Rappel du régime : ${nullites.regimeNullite.map((r) => r.reference).join(', ')} — une irrégularité ne devient une nullité qu'à la double condition d'une formalité substantielle et d'un grief.`);

  sections.push(`## 3. Axes de défense

${
  strategie.axes.length === 0
    ? 'Aucun axe ne se dégage des éléments fournis.'
    : strategie.axes
        .map(
          (a, i) => `### ${i + 1}. ${a.intitule} — *${a.solidite}*

${a.justificationSolidite}

**Fondements :** ${a.fondements.map((f) => `${f.reference} (${f.statut})`).join(', ') || '—'}

**Appuis :**
${a.appuis.map((x) => `- ${x}`).join('\n')}

**Objections prévisibles :**
${a.contreArguments.map((x) => `- ${x}`).join('\n')}

**Diligences :**
${a.actes.map((x) => `- ${x}`).join('\n')}`
        )
        .join('\n\n')
}`);

  sections.push(`## 4. Risques

${strategie.risques.map((r) => `- ${r}`).join('\n')}

## 5. Zones d'incertitude

${strategie.zonesIncertitude.map((z) => `- ${z}`).join('\n') || '- Néant.'}

## 6. Échéances

${strategie.echeances.map((e) => `- ${e}`).join('\n')}

## 7. Limites de ce rapport

${rapport.limites.map((l) => `- ${l}`).join('\n')}`);

  return sections.join('\n\n');
}
