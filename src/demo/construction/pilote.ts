/**
 * Fiche « Pilote ClairDossier — assurance construction » : source unique de la
 * page /pilote-assurance-construction (build VITE_DEMO=1 uniquement) et de sa
 * version imprimée sur une page A4.
 *
 * Proposition de travail, non contractuelle : la convention de pilote signée
 * fait foi. Aucun résultat, aucun gain annoncé : les seuils se fixent ensemble
 * au cadrage. Référents désignés par leur rôle, jamais par un nom.
 *
 * Prix : écrit « 1 500 € HT » (décision du commanditaire), avec la mention « TVA non
 * applicable, article 293 B du CGI (franchise en base) : le prix HT est le prix payé » —
 * même régime que /tarifs et les CGV (src/data/legal.ts).
 */
import { formatEuro } from '../../data/pricing';

export const PILOTE_PRIX = 1500;
export const PILOTE_DOSSIERS = 50;
export const PILOTE_SEMAINES = 6;
/** Calculé, jamais écrit en dur. */
export const PILOTE_PRIX_PAR_DOSSIER = PILOTE_PRIX / PILOTE_DOSSIERS;

/** Typographie française : espace insécable avant « ; : ! ? » (jamais de ligne qui commence par « : »). */
function insecables<T>(v: T): T {
  if (typeof v === 'string') return v.replace(/ ([;:!?])/g, '\u00a0$1') as T;
  if (Array.isArray(v)) return v.map(insecables) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, insecables(x)])) as T;
  return v;
}

export const PILOTE_TVA = insecables('Prix hors taxe. TVA non applicable, article 293 B du CGI (franchise en base) : le prix HT est le prix payé.');

export type Phase = { debut: number; fin: number; titre: string; detail: string };
export type Referent = { role: string; mission: string };
export type DecisionApres = { titre: string; detail: string };

export const PILOTE = insecables({
  titre: 'Pilote ClairDossier — assurance construction',
  public: "Pour les cabinets d'expertise et les directions indemnisation.",
  decision: `Tester ClairDossier sur ${PILOTE_DOSSIERS} dossiers pendant ${PILOTE_SEMAINES} semaines, pour ${formatEuro(PILOTE_PRIX)} HT, puis décider, sur résultats, d'un éventuel contrat réseau.`,
  prepare: [
    "L'inventaire des pièces du dossier : numérotées, datées, consultables page par page.",
    'Une chronologie sourcée : chaque événement renvoie à la pièce dont il provient.',
    "Les points à vérifier : dates divergentes d'une pièce à l'autre, pièces annoncées mais absentes du dossier.",
    "Un projet de trame de rapport, que l'expert corrige et complète.",
  ],
  nePasFaire: [
    "Aucune conclusion sur la cause, la responsabilité ou la garantie : ces appréciations restent celles de l'expert.",
    "Aucun envoi automatique : rien ne part vers un tiers sans une action de l'expert.",
    "L'expert relit et valide chaque document avant tout usage.",
  ],
  prealable:
    "Une convention de pilote et un accord de sous-traitance des données sont signés avant le dépôt de la moindre pièce réelle. La convention définit les modalités de traitement des pièces (manuel ou automatisé, outils et sous-traitants) ; à défaut, nos conditions générales s'appliquent et excluent toute lecture automatique des documents.",
  calendrier: [
    {
      debut: 1,
      fin: 1,
      titre: 'Cadrage et trame commune',
      detail: "Choix des dossiers et des dossiers témoins, définition commune d'une erreur importante, seuils de décision, trame de rapport de départ.",
    },
    {
      debut: 2,
      fin: 5,
      titre: 'Traitement',
      detail: "Les dossiers du pilote passent par ClairDossier ; l'expert relit, corrige et valide chaque sortie. Un point d'étape par semaine entre référents.",
    },
    {
      debut: 6,
      fin: 6,
      titre: 'Mesure et bilan',
      detail: 'Comparaison avec les dossiers témoins, bilan écrit partagé, préparation des deux décisions de suite.',
    },
  ] satisfies Phase[],
  referents: [
    { role: 'Référent assureur', mission: 'Valide le périmètre, les critères et les seuils ; porte la décision de suite côté assureur.' },
    { role: 'Référent cabinet', mission: 'Choisit les dossiers, organise la relecture par les experts, remonte les écarts constatés.' },
    { role: 'ClairDossier', mission: 'Prépare les dossiers, tient le journal du pilote, établit les relevés de mesure et le bilan.' },
  ] satisfies Referent[],
  referentsNote: 'Des rôles, pas des noms : les personnes sont désignées dans la convention de pilote.',
  mesure: {
    principe: 'Comparer des dossiers de complexité proche, traités avec ClairDossier et sans, sur trois indicateurs :',
    indicateurs: [
      'le temps total de préparation et de relecture, par dossier ;',
      "les erreurs importantes, selon une définition commune fixée au cadrage ;",
      'les demandes de pièces complémentaires.',
    ],
    note: "Aucun gain n'est annoncé : les seuils sont fixés ensemble au cadrage, avant le premier dossier.",
  },
  extension: {
    intro: 'Seuils fixés ensemble au cadrage.',
    criteres: [
      'Temps total : écart mesuré comparé au seuil retenu.',
      'Erreurs importantes : aucune hausse par rapport aux dossiers témoins.',
      'Experts : trame et sorties jugées utilisables par ceux qui les ont relues.',
      'Données : convention et accord de sous-traitance respectés, aucun incident.',
    ],
  },
  decisionsApres: [
    {
      titre: "Adoption d'une trame commune de rapport",
      detail: 'La trame mise au point pendant le pilote, proposée au réseau pour ses rapports.',
    },
    {
      titre: 'Licence réseau',
      detail: 'Le déploiement de ClairDossier auprès des cabinets : périmètre, volume et prix négociés sur la base du bilan.',
    },
  ] satisfies DecisionApres[],
  decisionsNote: "Deux décisions distinctes, négociées séparément : l'une peut être prise sans l'autre.",
  contact: 'Service Assistance ClairDossier',
  mentionDocument: 'Document de travail, non contractuel : la convention de pilote signée fait foi.',
});

/** Tous les textes affichés (et imprimés) de la fiche — utilisé par les tests de non-promesse. */
export function piloteTextes(): string[] {
  const out: string[] = [PILOTE_TVA];
  const walk = (v: unknown): void => {
    if (typeof v === 'string') out.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(PILOTE);
  return out;
}
