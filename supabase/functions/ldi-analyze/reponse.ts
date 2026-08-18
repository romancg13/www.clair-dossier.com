/**
 * LDI — contrôles portant sur la réponse du modèle.
 *
 * ┌─ DEUX DÉFAUTS, UN SEUL FICHIER ─────────────────────────────────────────┐
 * │ P1-09 — sortie structurée. L'invite système impose huit sections. Une    │
 * │ invite n'est pas un garde-fou : rien ne vérifiait que la réponse les     │
 * │ portait. Or une réponse amputée de « ⚠️ RISQUES POUR LE CLIENT » ou de   │
 * │ « LIMITES » est exactement celle qui se lit comme un feu vert.           │
 * │                                                                          │
 * │ P1-10 — plafond de coût. Rien ne bornait la dépense d'un dossier. Une    │
 * │ boucle de relance, un rapport de 200 000 caractères rejoué dix fois, et  │
 * │ la facture ne se découvre qu'à la fin du mois.                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Comme `citations.ts`, ce fichier est SANS DÉPENDANCE : il est recopié tel
 * quel dans la fonction Deno (`npm run ldi:sync-edge`), qui ne peut pas
 * importer depuis `src/`.
 */

/* ────────────────────────────── P1-09 ─────────────────────────────────── */

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
  //
  // Mais un titre ne vaut que pour UNE rubrique. Cherchées indépendamment,
  // « ANALYSE » et « RISQUES POUR LE CLIENT » étaient toutes deux satisfaites
  // par le seul titre « ANALYSE DES RISQUES POUR LE CLIENT » : la réponse
  // passait sans section de risques distincte, c'est-à-dire précisément
  // l'omission que ce contrôle existe pour attraper.
  const disponibles = [...titres];

  /** Consomme un titre et le retire du lot ; `false` si aucun ne convient. */
  const consommer = (attendu: string): boolean => {
    // Correspondance exacte d'abord : sans cela, « ANALYSE » pourrait s'emparer
    // du titre « ANALYSE DES RISQUES… » alors qu'un titre « ANALYSE » existe.
    let i = disponibles.findIndex((t) => t === attendu);
    if (i === -1) i = disponibles.findIndex((t) => t.includes(attendu));
    if (i === -1) return false;
    disponibles.splice(i, 1);
    return true;
  };

  const sectionsManquantes = SECTIONS_IMPOSEES.filter(
    (section) => !consommer(normaliserTitre(section))
  );

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

/* ────────────────────────────── P1-10 ─────────────────────────────────── */

export type Tarifs = {
  /** Dollars par million de jetons d'entrée. */
  entree: number;
  /** Dollars par million de jetons de sortie. */
  sortie: number;
  /** Dollars par million de jetons lus depuis le cache. */
  cacheLu: number;
  /** Dollars par million de jetons écrits au cache (TTL 5 min). */
  cacheEcrit: number;
  devise: 'USD';
  /**
   * Date de dernière vérification sur la grille officielle. `null` signifie
   * que personne ne l'a confrontée à sa source : le chiffre est déclaratif.
   */
  verifieLe: string | null;
  source: string;
};

/**
 * ┌─ CE QUE CES CHIFFRES SONT, ET CE QU'ILS NE SONT PAS ────────────────────┐
 * │ Des VALEURS DÉCLARÉES, saisies à la main. Aucune API n'est interrogée    │
 * │ pour les obtenir : ce module ne sait pas ce que coûte réellement un      │
 * │ appel. Les tarifs changent, et le modèle servi peut différer du modèle   │
 * │ demandé (repli côté serveur).                                            │
 * │                                                                          │
 * │ L'estimation produite est donc un ORDRE DE GRANDEUR destiné à borner     │
 * │ une boucle, jamais un montant opposable. La facture fait foi.            │
 * │ `verifieLe: null` — à confronter à la grille officielle avant de s'y     │
 * │ fier, et à corriger ici si elle a bougé.                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export const TARIFS_PAR_MILLION: Tarifs = {
  entree: 15,
  sortie: 75,
  cacheLu: 1.5,
  cacheEcrit: 18.75,
  devise: 'USD',
  verifieLe: null,
  source: 'Grille publique Anthropic — valeur saisie manuellement, non vérifiée par le programme.',
};

export type UsageJetons = {
  entree: number;
  sortie: number;
  cacheLu: number;
  cacheEcrit?: number;
};

export type EstimationCout = {
  /** Estimation en dollars, arrondie au millionième. */
  dollars: number;
  /**
   * Toujours `null`. Convertir supposerait un taux de change que ce module
   * n'a pas et n'ira pas chercher : une conversion inventée serait un chiffre
   * faux présenté comme un fait.
   */
  euros: null;
  plafondDepasse: boolean;
  /** Message prêt à afficher, vide tant que le plafond n'est pas atteint. */
  avertissement: string;
  /** Devise de `dollars`, reprise des tarifs employés. */
  devise: string;
};

/** Évite la poussière flottante (0.30000000000000004) sans fausser les tests. */
function arrondir(valeur: number): number {
  return Math.round(valeur * 1e6) / 1e6;
}

/**
 * Estime le coût d'un appel à partir des jetons consommés et des tarifs
 * déclarés. Fonction pure : ni horloge, ni réseau, ni état.
 *
 * @param budgetRestant Part du plafond ENCORE DISPONIBLE pour ce dossier, en
 *        dollars — l'appelant en a déjà retiré le cumul engagé. Ce n'est donc
 *        pas le plafond du dossier, et le message ne doit pas le présenter
 *        comme tel : un dossier plafonné à 5 USD dont 3 sont engagés annonçait
 *        « un plafond de 2 USD » à l'avocat. Omis : aucun contrôle.
 */
export function estimerCout(
  usage: UsageJetons,
  tarifs: Tarifs,
  budgetRestant?: number
): EstimationCout {
  const parMillion = (jetons: number, tarif: number) => (jetons / 1_000_000) * tarif;

  const dollars = arrondir(
    parMillion(usage.entree, tarifs.entree) +
      parMillion(usage.sortie, tarifs.sortie) +
      parMillion(usage.cacheLu, tarifs.cacheLu) +
      parMillion(usage.cacheEcrit ?? 0, tarifs.cacheEcrit)
  );

  const plafondDepasse = typeof budgetRestant === 'number' && dollars > budgetRestant;

  return {
    dollars,
    euros: null,
    plafondDepasse,
    devise: tarifs.devise,
    avertissement: plafondDepasse
      ? `Plafond de dépense dépassé pour ce dossier : ${dollars} ${tarifs.devise} estimés pour cet appel, alors qu'il restait ${budgetRestant} ${tarifs.devise} sur le plafond du dossier. Estimation calculée sur des tarifs déclarés, non vérifiés — la facturation réelle fait foi.`
      : '',
  };
}

/**
 * Plafond par défaut, en dollars, pour l'ensemble des appels d'un même dossier.
 * Valeur de sûreté destinée à arrêter une boucle, pas un budget : elle se règle
 * par la variable d'environnement LDI_PLAFOND_DOSSIER_DOLLARS.
 */
export const PLAFOND_DOSSIER_DOLLARS = 5;

export type ControlePlafond = {
  /** Faux : l'appel ne doit pas être lancé. */
  autorise: boolean;
  message: string;
};

/**
 * Contrôle AVANT l'appel. C'est le seul qui évite une dépense : constater le
 * dépassement après coup ne rembourse rien.
 *
 * ┌─ LIMITE À CONNAÎTRE ────────────────────────────────────────────────────┐
 * │ `coutEngage` est déclaré par l'appelant : le serveur ne tient aucun      │
 * │ compteur et ne saurait donc pas qu'on lui ment. C'est un garde-fou       │
 * │ contre une boucle qui s'emballe — un onglet rouvert, un script qui       │
 * │ relance —, pas contre un client hostile. Un vrai quota suppose un        │
 * │ compteur par utilisateur en base : décision de produit, non prise ici.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function controlerAvantAppel(coutEngage: number, plafond: number): ControlePlafond {
  // Un compteur illisible fait échouer le contrôle, il ne le contourne pas.
  // Le ramener à zéro serait la seule erreur vraiment coûteuse ici : un NaN
  // rendrait toute comparaison fausse et laisserait passer chaque appel. Un
  // appelant correct envoie toujours un nombre fini positif ou nul.
  if (!Number.isFinite(coutEngage) || coutEngage < 0) {
    return {
      autorise: false,
      message:
        "Le cumul de dépense transmis pour ce dossier n'est pas un nombre exploitable : " +
        "aucun appel n'est lancé tant que le compteur n'est pas rétabli.",
    };
  }

  if (coutEngage < plafond) return { autorise: true, message: '' };

  return {
    autorise: false,
    message:
      `Plafond de dépense atteint pour ce dossier : ${arrondir(coutEngage)} USD estimés engagés ` +
      `pour un plafond de ${plafond} USD. Aucun nouvel appel n'est lancé. ` +
      `Estimation calculée sur des tarifs déclarés, non vérifiés — la facturation réelle fait foi.`,
  };
}
