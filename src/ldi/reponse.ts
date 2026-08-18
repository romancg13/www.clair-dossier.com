/**
 * LDI — contrôles portant sur la réponse du modèle.
 *
 * ┌─ P1-09 — SORTIE STRUCTURÉE ─────────────────────────────────────────────┐
 * │ L'invite système impose huit sections. Une invite n'est pas un           │
 * │ garde-fou : rien ne vérifiait que la réponse les portait. Or une         │
 * │ réponse amputée de « ⚠️ RISQUES POUR LE CLIENT » ou de « LIMITES » est   │
 * │ exactement celle qui se lit comme un feu vert.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Comme `citations.ts`, ce fichier est SANS DÉPENDANCE : il est recopié tel
 * quel dans la fonction Deno (`npm run ldi:sync-edge`), qui ne peut pas
 * importer depuis `src/`.
 */

/**
 * Les huit sections de l'invite système, § [STRUCTURE DE RÉPONSE].
 * L'émoji de la section « RISQUES » n'y figure pas : il est décoratif, et
 * l'exiger ferait échouer une réponse par ailleurs conforme.
 */
export const SECTIONS_IMPOSEES = [
  'CE QUI EST DEMANDÉ',
  'CE QUE DIT LE DOSSIER',
  'ANALYSE',
  'RÉSULTATS',
  'RISQUES POUR LE CLIENT',
  'DILIGENCES',
  'SOURCES',
  'LIMITES',
] as const;

/**
 * Nombre total de tentatives, relance corrective comprise. Deux, pas plus :
 * chaque tentative est un appel facturé, et un modèle qui manque la structure
 * deux fois de suite ne la trouvera pas à la troisième.
 */
export const TENTATIVES_MAX = 2;

export type ControleStructure = {
  conforme: boolean;
  /** Sections absentes, dans l'ordre de l'invite. */
  sectionsManquantes: string[];
  /** Consigne à renvoyer au modèle pour une seconde tentative. Vide si conforme. */
  consigneCorrective: string;
};

/**
 * Ramène un titre à sa forme comparable : sans accent, sans casse, sans
 * ponctuation ni émoji. « ### ⚠️ Risques pour le client » et
 * « ### RISQUES POUR LE CLIENT » doivent se rejoindre.
 */
function normaliserTitre(ligne: string): string {
  return ligne
    .normalize('NFD')
    // Marques diacritiques combinantes.
    // Écrites en échappements : un signe combinant recopié littéralement dans
    // la source est invisible à la relecture et disparaît au premier outil
    // qui renormalise le fichier.
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Titres de section trouvés dans la réponse. Sont acceptés les titres markdown
 * (`#` à `######`) et les lignes entièrement en gras (`**TITRE**`), les deux
 * formes que produisent les modèles selon la façon dont l'invite est rendue.
 */
function titresDeSection(texte: string): string[] {
  const titres: string[] = [];
  for (const ligne of texte.split('\n')) {
    const brut = ligne.trim();
    const markdown = /^#{1,6}\s+(.*)$/.exec(brut);
    const gras = /^\*\*(.+)\*\*:?$/.exec(brut);
    const titre = markdown?.[1] ?? gras?.[1];
    if (titre) titres.push(normaliserTitre(titre));
  }
  return titres;
}

export function validerStructure(texte: string): ControleStructure {
  const titres = titresDeSection(texte);

  // Inclusion et non égalité : « ### ANALYSE JURIDIQUE » remplit la section
  // ANALYSE. Le contrôle porte sur la présence de la rubrique, pas sur la
  // reproduction littérale de son intitulé.
  const sectionsManquantes = SECTIONS_IMPOSEES.filter((section) => {
    const attendu = normaliserTitre(section);
    return !titres.some((t) => t.includes(attendu));
  });

  if (sectionsManquantes.length === 0) {
    return { conforme: true, sectionsManquantes: [], consigneCorrective: '' };
  }

  return {
    conforme: false,
    sectionsManquantes: [...sectionsManquantes],
    consigneCorrective: [
      `Ta réponse précédente ne comporte pas ${sectionsManquantes.length === 1 ? 'la section' : 'les sections'} suivantes : ${sectionsManquantes.join(', ')}.`,
      "Reprends ta réponse intégralement, en conservant ton analyse et en ajoutant chaque section manquante sous la forme d'un titre « ### » identique à celui de l'invite système.",
      "Si une section n'a rien à contenir, écris-le explicitement plutôt que de l'omettre — une section absente se lit comme une absence de risque.",
      "N'ajoute aucune référence juridique qui ne figurait pas déjà dans le bloc SOURCES OFFICIELLES.",
    ].join('\n'),
  };
}
