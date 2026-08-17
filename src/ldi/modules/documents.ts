/**
 * LDI — Module 6 : génération de documents.
 *
 * Le module produit des SQUELETTES, jamais des actes prêts à déposer. Trois
 * règles tiennent la conception :
 *
 * 1. Tout emplacement qui appelle un choix de l'avocat est balisé
 *    « [À COMPLÉTER : …] ». Un document généré ne doit jamais pouvoir être
 *    signé sans avoir été relu ligne à ligne.
 * 2. Toute référence dont le statut n'est pas `verifie` est marquée dans le
 *    corps du texte. Une citation non vérifiée reste visible jusqu'au dernier
 *    moment plutôt que de se fondre dans la mise en page.
 * 3. Aucun numéro de pourvoi n'est inséré par le module. La jurisprudence est
 *    ajoutée par l'avocat, depuis le module 2 et ses sources officielles.
 */
import type {
  AnalyseDossier,
  DocumentJuridique,
  EnonceJuridique,
  NoteStrategique,
  TypeDocument,
} from '../types';

const MARQUEUR = /\[À COMPLÉTER : [^\]]+\]/g;

/** Rend une référence citable, en gardant visible son statut de vérification. */
function citer(e: EnonceJuridique): string {
  if (e.statut === 'verifie') return e.reference;
  if (e.statut === 'non-verifiable') return `${e.reference} **[RÉFÉRENCE NON VÉRIFIABLE — NE PAS CITER EN L'ÉTAT]**`;
  return `${e.reference} **[à vérifier sur Légifrance avant dépôt]**`;
}

function entete(titre: string, analyse: AnalyseDossier): string {
  return `# ${titre}

**Dossier :** ${analyse.reference}
**Qualification(s) poursuivie(s) :** ${analyse.qualifications.join(' · ') || '[À COMPLÉTER : qualifications]'}

**Juridiction saisie :** [À COMPLÉTER : juridiction]
**Pour :** [À COMPLÉTER : identité du mis en cause]
**Avocat :** [À COMPLÉTER : nom, barreau, adresse]
`;
}

function pied(): string {
  return `
---

*Projet préparé avec l'assistance d'un outil d'analyse automatisée (LDI). Le
document n'est pas un acte : il doit être vérifié, complété et signé par
l'avocat, qui en demeure seul responsable. Chaque référence marquée « à
vérifier » doit être confrontée à sa source officielle avant dépôt.*
`;
}

function sectionFaits(analyse: AnalyseDossier): string {
  const lignes = analyse.chronologie
    .slice(0, 40)
    .map((e) => `| ${e.horodatage} | ${e.nature} | ${e.description} | ${e.sourcePieceId ?? '—'} |`);

  return `## Rappel des faits et de la procédure

| Date / heure | Nature | Constat | Pièce |
|---|---|---|---|
${lignes.join('\n')}

[À COMPLÉTER : mise en récit des faits, en propre]
`;
}

function sectionDiscussion(strategie: NoteStrategique): { corps: string; refs: EnonceJuridique[] } {
  const refs: EnonceJuridique[] = [];
  const blocs: string[] = [];

  const retenus = strategie.axes.filter((a) => a.solidite !== 'exploratoire');
  const axes = retenus.length > 0 ? retenus : strategie.axes;

  axes.forEach((axe, index) => {
    refs.push(...axe.fondements);
    const fondements =
      axe.fondements.length > 0
        ? axe.fondements.map(citer).join(', ')
        : '[À COMPLÉTER : fondement textuel]';

    blocs.push(`### ${index + 1}. ${axe.intitule}

**Fondement :** ${fondements}

**Sur les faits —**
${axe.appuis.map((a) => `- ${a}`).join('\n')}

**Sur le grief —** [À COMPLÉTER : en quoi l'irrégularité a porté atteinte aux intérêts du mis en cause, concrètement et non en la forme]

**Objection prévisible —**
${axe.contreArguments.map((c) => `- ${c}`).join('\n')}

**Diligences préalables —**
${axe.actes.map((a) => `- ${a}`).join('\n')}
`);
  });

  return { corps: `## Discussion\n\n${blocs.join('\n')}`, refs };
}

function dedupliquer(refs: EnonceJuridique[]): EnonceJuridique[] {
  const vues = new Map<string, EnonceJuridique>();
  for (const r of refs) if (!vues.has(r.reference)) vues.set(r.reference, r);
  return [...vues.values()];
}

// ---------------------------------------------------------------------------
// Trames
// ---------------------------------------------------------------------------

const TITRES: Record<TypeDocument, string> = {
  'requete-nullite': 'Requête en nullité',
  'memoire-defense': 'Mémoire en défense',
  'demande-mise-en-liberte': 'Demande de mise en liberté',
  'memoire-appel': "Mémoire d'appel",
};

function corpsSpecifique(type: TypeDocument, strategie: NoteStrategique): string {
  switch (type) {
    case 'requete-nullite':
      return `## Sur la recevabilité

[À COMPLÉTER : stade de la procédure, date de la connaissance de l'acte critiqué, respect du délai applicable]

La présente requête est déposée au greffe de la chambre de l'instruction. Elle
énonce l'ensemble des moyens de nullité connus à ce jour : ${strategie.axes.length} moyen(s) sont développés ci-après.

> Attention — les moyens non soulevés dans la présente requête ne pourront
> plus l'être ultérieurement. Vérifier avant dépôt qu'aucun point de contrôle
> laissé « non établi » n'a été abandonné faute de vérification.
`;
    case 'demande-mise-en-liberte':
      return `## Sur les garanties de représentation

[À COMPLÉTER : domicile, emploi, situation familiale, pièces justificatives jointes]

## Sur la nécessité de la détention

[À COMPLÉTER : discussion des motifs retenus par l'ordonnance de placement, un par un]

## Sur les mesures alternatives

[À COMPLÉTER : contrôle judiciaire, assignation à résidence sous surveillance électronique, obligations proposées]
`;
    case 'memoire-appel':
      return `## Sur la recevabilité de l'appel

[À COMPLÉTER : date de la décision entreprise, date et forme de la déclaration d'appel, étendue de l'appel]

## Sur ce qui est critiqué

[À COMPLÉTER : chefs de la décision critiqués — l'étendue de la saisine de la cour en dépend]
`;
    case 'memoire-defense':
      return `## Sur les éléments constitutifs de l'infraction poursuivie

[À COMPLÉTER : reprendre chaque élément constitutif et confronter aux pièces]

## Sur la charge de la preuve

[À COMPLÉTER : rappel de la présomption d'innocence et du doute qui profite au prévenu]
`;
  }
}

// ---------------------------------------------------------------------------
// Entrée du module
// ---------------------------------------------------------------------------

export function genererDocument(
  type: TypeDocument,
  analyse: AnalyseDossier,
  strategie: NoteStrategique
): DocumentJuridique {
  const discussion = sectionDiscussion(strategie);

  const corps = [
    entete(TITRES[type], analyse),
    corpsSpecifique(type, strategie),
    sectionFaits(analyse),
    discussion.corps,
    `## Points d'incertitude relevés par l'analyse

${strategie.zonesIncertitude.map((z) => `- ${z}`).join('\n') || '- Néant.'}

## Risques identifiés

${strategie.risques.map((r) => `- ${r}`).join('\n')}
`,
    `## Par ces motifs

[À COMPLÉTER : dispositif — ce qui est demandé, acte par acte, en visant expressément l'étendue de l'annulation sollicitée]
`,
    pied(),
  ].join('\n');

  return {
    type,
    titre: TITRES[type],
    corps,
    aCompleter: [...new Set(corps.match(MARQUEUR) ?? [])],
    referencesCitees: dedupliquer(discussion.refs),
  };
}
