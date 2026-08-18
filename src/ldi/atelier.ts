/**
 * LDI — atelier : plusieurs dossiers, vus ensemble.
 *
 * ┌─ CE QUE CE MODULE CLASSE, ET SUR QUELLE BASE ───────────────────────────┐
 * │ Trois axes de classement, choisis parce que chacun repose sur quelque   │
 * │ chose de vérifiable :                                                    │
 * │                                                                          │
 * │   — le RÉGIME procédural est DÉCLARÉ dans le dossier ;                   │
 * │   — l'ÉTAT est MESURÉ par les points de contrôle ;                        │
 * │   — la QUALIFICATION est reprise VERBATIM du dossier.                     │
 * │                                                                          │
 * │ Aucun classement par « matière » (stupéfiants, atteintes aux biens…) :   │
 * │ il faudrait une taxonomie que personne n'a validée, et un dossier rangé  │
 * │ dans la mauvaise case est un dossier qu'on cherche là où il n'est pas.   │
 * │ Les qualifications sont donc groupées telles qu'elles sont écrites.      │
 * │                                                                          │
 * │ Aucun score, aucune priorité calculée : des COMPTES. Un décompte         │
 * │ d'anomalies n'est pas un pronostic, et ne doit pas s'en donner l'air.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Fonctions pures : mêmes rapports, mêmes fiches. Rien ici ne touche au réseau
 * ni à l'horloge.
 */
import { parseHorodatage } from './modules/chronologie';
import type { RapportLdi, RegimeProcedural, Severite } from './types';

/**
 * État d'un dossier au regard des seuls contrôles exécutés.
 *
 * ┌─ POURQUOI IL N'Y A PAS D'ÉTAT « RIEN RELEVÉ » ──────────────────────────┐
 * │ Il a existé, et il était MORT. Deux des dix points de contrôle —          │
 * │ GAV-01 (motivation du placement) et PRESC-01 (prescription) — ne          │
 * │ retournent jamais que `non-etabli` : ils demandent une lecture humaine    │
 * │ que le moteur ne fait pas. `nonEtablis` vaut donc au moins 2 pour tout    │
 * │ dossier pourvu d'une pièce, et un état exigeant `nonEtablis === 0`       │
 * │ n'était atteignable par AUCUNE entrée possible.                          │
 * │                                                                          │
 * │ Un état mort dans un type n'est pas neutre : il se lit comme une         │
 * │ promesse — « ce dossier pourrait être déclaré sans anomalie » — que le   │
 * │ système ne peut pas tenir. Trois états suffisent, et chacun se produit.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export type EtatDossier = 'anomalie' | 'a-verifier' | 'vide';

export const LIBELLES_ETAT: Record<EtatDossier, { court: string; explication: string }> = {
  anomalie: {
    court: 'Anomalie relevée',
    explication: "Au moins un point de contrôle a relevé un écart, ou une contradiction critique a été détectée.",
  },
  'a-verifier': {
    court: 'À vérifier',
    explication:
      "Aucun écart relevé, mais des points restent non établis : le dossier ne contient pas de quoi les trancher. Cela ne signifie pas que la procédure est régulière — le contrôle ne porte que sur dix points, dont deux qu'aucune analyse automatique ne peut établir.",
  },
  vide: {
    court: 'Aucune pièce',
    explication: "Aucune pièce n'a été versée : rien n'est établi, tous les constats seraient conditionnels.",
  },
};

export const LIBELLES_REGIME: Record<RegimeProcedural, string> = {
  'droit-commun': 'Droit commun',
  'criminalite-organisee': 'Criminalité organisée',
  terrorisme: 'Terrorisme',
};

/** Comptes bruts affichés au tableau de bord. Aucun n'est une estimation. */
export type Indicateurs = {
  pieces: number;
  piecesOrphelines: number;
  evenements: number;
  /** Événements portant une heure exploitable — les seuls que les durées mesurent. */
  evenementsDates: number;
  evenementsNonSources: number;
  contradictions: number;
  contradictionsCritiques: number;
  anomalies: number;
  nonEtablis: number;
  pointsControles: number;
};

export type FicheDossier = {
  reference: string;
  regime: RegimeProcedural;
  qualifications: string[];
  etat: EtatDossier;
  indicateurs: Indicateurs;
  /** Échéances reprises de la note stratégique, sans réordonnancement. */
  echeances: string[];
  /** Premier et dernier horodatage exploitables, bornes de la chronologie. */
  periode: { debut: string; fin: string } | null;
};

const POIDS_SEVERITE: Record<Severite, number> = { critique: 3, majeure: 2, mineure: 1 };

export function indicateurs(rapport: RapportLdi): Indicateurs {
  const { dossier, nullites } = rapport;

  const dates = dossier.chronologie.filter((e) => parseHorodatage(e.horodatage)?.avecHeure);

  return {
    pieces: dossier.piecesTotal,
    piecesOrphelines: dossier.piecesOrphelines.length,
    evenements: dossier.chronologie.length,
    evenementsDates: dates.length,
    evenementsNonSources: dossier.evenementsNonSources.length,
    contradictions: dossier.contradictions.length,
    contradictionsCritiques: dossier.contradictions.filter((c) => c.severite === 'critique').length,
    anomalies: nullites.anomalies.length,
    nonEtablis: nullites.nonEtablis.length,
    pointsControles: nullites.points.length,
  };
}

export function etatDossier(rapport: RapportLdi): EtatDossier {
  const i = indicateurs(rapport);
  if (i.pieces === 0) return 'vide';
  if (i.anomalies > 0 || i.contradictionsCritiques > 0) return 'anomalie';
  // `nonEtablis` est toujours ≥ 2 (GAV-01 et PRESC-01 ne concluent jamais) :
  // cette branche est celle de tout dossier qui n'a pas d'anomalie.
  return 'a-verifier';
}

/** Bornes de la chronologie, sur les seuls horodatages lisibles. */
function periodeDe(rapport: RapportLdi): FicheDossier['periode'] {
  const lisibles = rapport.dossier.chronologie
    .map((e) => e.horodatage)
    .filter((h) => parseHorodatage(h) !== null)
    .sort();
  if (lisibles.length === 0) return null;
  return { debut: lisibles[0], fin: lisibles[lisibles.length - 1] };
}

export function ficheDossier(rapport: RapportLdi): FicheDossier {
  return {
    reference: rapport.dossier.reference,
    regime: rapport.dossier.regime,
    qualifications: rapport.dossier.qualifications,
    etat: etatDossier(rapport),
    indicateurs: indicateurs(rapport),
    echeances: rapport.strategie.echeances,
    periode: periodeDe(rapport),
  };
}

// ---------------------------------------------------------------------------
// Classement
// ---------------------------------------------------------------------------

export type AxeClassement = 'etat' | 'regime' | 'qualification';

export const LIBELLES_AXE: Record<AxeClassement, string> = {
  etat: "État d'analyse",
  regime: 'Régime procédural',
  qualification: 'Qualification poursuivie',
};

export type Groupe = {
  /** Clé stable, utilisable comme identifiant de rendu. */
  cle: string;
  intitule: string;
  /** Précision affichée sous l'intitulé, vide quand il n'y a rien à nuancer. */
  precision: string;
  fiches: FicheDossier[];
};

/** Ordre d'affichage des états : ce qui appelle une action passe devant. */
const ORDRE_ETAT: EtatDossier[] = ['anomalie', 'a-verifier', 'vide'];
const ORDRE_REGIME: RegimeProcedural[] = ['terrorisme', 'criminalite-organisee', 'droit-commun'];

/**
 * Groupe les fiches selon l'axe demandé.
 *
 * Un dossier portant plusieurs qualifications apparaît dans plusieurs groupes
 * sur l'axe « qualification » — c'est la réalité du dossier, pas un doublon.
 * Les deux autres axes sont exclusifs.
 */
export function classer(fiches: FicheDossier[], axe: AxeClassement): Groupe[] {
  if (axe === 'etat') {
    return ORDRE_ETAT.map((etat) => ({
      cle: etat,
      intitule: LIBELLES_ETAT[etat].court,
      precision: LIBELLES_ETAT[etat].explication,
      fiches: fiches.filter((f) => f.etat === etat),
    })).filter((g) => g.fiches.length > 0);
  }

  if (axe === 'regime') {
    return ORDRE_REGIME.map((regime) => ({
      cle: regime,
      intitule: LIBELLES_REGIME[regime],
      precision: '',
      fiches: fiches.filter((f) => f.regime === regime),
    })).filter((g) => g.fiches.length > 0);
  }

  // Qualifications : reprises telles qu'écrites, triées par fréquence puis
  // alphabétiquement. Aucune normalisation — « CP, art. 313-1 » et
  // « article 313-1 du code pénal » restent deux entrées, parce que les
  // rapprocher supposerait une équivalence que rien ici ne vérifie.
  const par = new Map<string, FicheDossier[]>();
  for (const fiche of fiches) {
    const cles = fiche.qualifications.length > 0 ? fiche.qualifications : ['(non renseignée)'];
    for (const cle of cles) {
      const lot = par.get(cle);
      if (lot) lot.push(fiche);
      else par.set(cle, [fiche]);
    }
  }

  return [...par.entries()]
    .sort((a, b) => b[1].length - a[1].length || comparer(a[0], b[0]))
    .map(([cle, lot]) => ({
      cle,
      intitule: cle,
      precision: '',
      fiches: lot,
    }));
}

/**
 * Comparaison par point de code. `localeCompare` dépend de la locale et des
 * données ICU disponibles : deux exécutions pourraient classer différemment.
 */
function comparer(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Ordonne les fiches : ce qui appelle une action passe devant, à sévérité
 * égale le dossier le plus fourni d'abord, puis la référence pour que l'ordre
 * soit total et reproductible.
 *
 * Ce n'est PAS une priorité juridique. L'ordre dans lequel les moyens méritent
 * d'être travaillés relève de l'avocat, sur pièces.
 */
export function ordonner(fiches: FicheDossier[]): FicheDossier[] {
  const rang = (f: FicheDossier) => ORDRE_ETAT.indexOf(f.etat);
  return [...fiches].sort(
    (a, b) =>
      rang(a) - rang(b) ||
      b.indicateurs.anomalies - a.indicateurs.anomalies ||
      b.indicateurs.contradictionsCritiques - a.indicateurs.contradictionsCritiques ||
      comparer(a.reference, b.reference)
  );
}

/** Totaux de l'atelier, pour les tuiles d'en-tête. */
export function totaux(fiches: FicheDossier[]): Indicateurs & { dossiers: number } {
  const vide: Indicateurs = {
    pieces: 0,
    piecesOrphelines: 0,
    evenements: 0,
    evenementsDates: 0,
    evenementsNonSources: 0,
    contradictions: 0,
    contradictionsCritiques: 0,
    anomalies: 0,
    nonEtablis: 0,
    pointsControles: 0,
  };

  const somme = fiches.reduce<Indicateurs>((acc, f) => {
    for (const cle of Object.keys(acc) as (keyof Indicateurs)[]) {
      acc[cle] += f.indicateurs[cle];
    }
    return acc;
  }, vide);

  return { ...somme, dossiers: fiches.length };
}

/**
 * Points de contrôle en anomalie, tous dossiers confondus, du plus sévère au
 * moins sévère. Sert la vue « Contradictions / Procédure » de l'atelier.
 */
export function anomaliesRegroupees(
  rapports: RapportLdi[]
): { reference: string; id: string; intitule: string; severite: Severite; constat: string }[] {
  const out = rapports.flatMap((r) =>
    r.nullites.anomalies.map((p) => ({
      reference: r.dossier.reference,
      id: p.id,
      intitule: p.intitule,
      severite: p.severite,
      constat: p.constat,
    }))
  );

  return out.sort(
    (a, b) =>
      POIDS_SEVERITE[b.severite] - POIDS_SEVERITE[a.severite] ||
      comparer(a.reference, b.reference) ||
      comparer(a.id, b.id)
  );
}

/**
 * Recherche plein texte sur ce qui identifie un dossier — référence,
 * qualifications, régime. Volontairement limitée à ces champs : chercher dans
 * le contenu des pièces ferait remonter des extraits de dossier dans une
 * interface de liste, hors du contexte qui leur donne leur sens.
 */
export function filtrer(fiches: FicheDossier[], requete: string): FicheDossier[] {
  const q = requete.trim().toLowerCase();
  if (q === '') return fiches;

  return fiches.filter((f) =>
    [f.reference, LIBELLES_REGIME[f.regime], ...f.qualifications]
      .join(' ')
      .toLowerCase()
      .includes(q)
  );
}
