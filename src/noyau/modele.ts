/**
 * DEFENSE OS — modèle de données du noyau (schéma 3.0).
 *
 * ┌─ CE QUE CE MODÈLE AJOUTE, ET CE QU'IL NE CASSE PAS ─────────────────────┐
 * │ Le moteur d'analyse existant travaille sur `Dossier` (référence, pièces, │
 * │ événements, régime). Ce modèle l'ÉTEND au lieu de le remplacer : un      │
 * │ `DossierPenal` est un `Dossier` porteur des entités du mandat v4 —       │
 * │ documents ingérés, faits, actes, mesures, griefs, moyens, manques,       │
 * │ échéances, demandes. Tout ce qui lisait un `Dossier` continue de lire.   │
 * │                                                                          │
 * │ Chaque champ absent est absent, jamais deviné : `completerDossierPenal`  │
 * │ pose des listes vides et des `null`, pas des valeurs plausibles.         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Invariants tenus par `controlerInvariants` :
 *   — tout Moyen cite au moins un Fait ou un ActeProcedure ;
 *   — un fait sans cote est marqué `non sourcé` (signalé, pas corrigé) ;
 *   — l'import refuse une version de schéma inconnue.
 */
import type { Dossier } from '../ldi/types';

export const VERSION_SCHEMA = '3.0';

// ---------------------------------------------------------------------------
// Taxonomie de classement — cinq axes indépendants et cumulables (§4.2).
// Le classement n'est ni un jugement de valeur, ni un pronostic (B4).
// ---------------------------------------------------------------------------

export type Phase =
  | 'garde-a-vue'
  | 'enquete'
  | 'instruction'
  | 'comparution-immediate'
  | 'jugement'
  | 'appel'
  | 'execution';

export type StatutClient =
  | 'libre'
  | 'controle-judiciaire'
  | 'arse'
  | 'detention-provisoire'
  | 'condamne';

export type NatureContentieux =
  | 'usage'
  | 'cession'
  | 'detention-transport'
  | 'importation'
  | 'trafic-aggrave'
  | 'association-malfaiteurs'
  | 'blanchiment'
  | 'volet-patrimonial'
  | 'volet-douanier';

export type Avancement =
  | 'a-constituer'
  | 'ingestion'
  | 'controle'
  | 'moyens-a-arbitrer'
  | 'ecritures-a-finaliser'
  | 'depose'
  | 'clos';

/**
 * L'urgence n'est PAS un champ saisi : elle se CALCULE depuis les échéances
 * ouvertes (voir `delais.ts`). Un champ saisi vieillirait sans prévenir — une
 * urgence de la semaine dernière affichée comme actuelle est exactement le
 * genre d'erreur qui coûte une forclusion.
 */
export type Urgence = 'sous-48h' | 'sous-7j' | 'sous-30j' | 'sans-echeance-courte';

export const LIBELLES_PHASE: Record<Phase, string> = {
  'garde-a-vue': 'Garde à vue',
  enquete: 'Enquête',
  instruction: 'Instruction',
  'comparution-immediate': 'Comparution immédiate',
  jugement: 'Jugement',
  appel: 'Appel',
  execution: 'Exécution',
};

export const LIBELLES_STATUT_CLIENT: Record<StatutClient, string> = {
  libre: 'Libre',
  'controle-judiciaire': 'Contrôle judiciaire',
  arse: 'ARSE',
  'detention-provisoire': 'Détention provisoire',
  condamne: 'Condamné',
};

export const LIBELLES_NATURE: Record<NatureContentieux, string> = {
  usage: 'Usage',
  cession: 'Cession',
  'detention-transport': 'Détention–transport',
  importation: 'Importation',
  'trafic-aggrave': 'Trafic aggravé',
  'association-malfaiteurs': 'Association de malfaiteurs',
  blanchiment: 'Blanchiment',
  'volet-patrimonial': 'Volet patrimonial',
  'volet-douanier': 'Volet douanier',
};

export const LIBELLES_AVANCEMENT: Record<Avancement, string> = {
  'a-constituer': 'À constituer',
  ingestion: 'Ingestion en cours',
  controle: 'Contrôle en cours',
  'moyens-a-arbitrer': 'Moyens à arbitrer',
  'ecritures-a-finaliser': 'Écritures à finaliser',
  depose: 'Déposé',
  clos: 'Clos',
};

// ---------------------------------------------------------------------------
// Entités du dossier
// ---------------------------------------------------------------------------

export type Echeance = {
  id: string;
  intitule: string;
  /** Date au format ISO (AAAA-MM-JJ ou AAAA-MM-JJThh:mm). */
  date: string;
  type: 'procedural' | 'audience' | 'detention' | 'recours';
  etat: 'ouverte' | 'tenue' | 'depassee';
};

/**
 * Un vide nommé. L'agent ne comble jamais un manque : il le crée, avec
 * l'action qui le comble, et le manque remonte au pupitre (§7.10).
 */
export type Manque = {
  id: string;
  /** Ce qui manque, dit en clair. */
  nature: string;
  /** Criticité QUALITATIVE — jamais un score (B4). */
  criticite: 'bloquant' | 'important' | 'utile';
  /** Ce que ce manque empêche : grief, qualification, moyen, échéance. */
  necessairePour: string;
  /** Le geste qui le comble : cote à demander, acte à solliciter, question. */
  action: string;
};

export type ActeProcedure = {
  id: string;
  type: string;
  /** Date/heure ISO, ou null si l'acte n'est pas daté — c'est alors un Manque. */
  dateHeure: string | null;
  autoritePrescriptrice: string;
  autorisationPrealable: 'oui' | 'non' | 'inconnu';
  /** Cotes qui documentent l'acte. */
  cotes: string[];
  /** Actes qui découlent de celui-ci — support de la propagation d'un grief. */
  actesSubsequents: string[];
};

export type MesureContrainte = {
  id: string;
  type: string;
  debut: string | null;
  fin: string | null;
  prolongations: { date: string; autorisation: string }[];
  /** Mentions de notification relevées au dossier (droits, avis, examen…). */
  notifications: string[];
};

export type Fait = {
  id: string;
  enonce: string;
  /** Date ou période alléguée, texte libre daté. */
  periode: string | null;
  statut: 'etabli' | 'allegue' | 'conteste';
  cotes: string[];
};

export type ElementPreuve = {
  id: string;
  type: string;
  /** Comment l'élément est rattaché AU CLIENT — le cœur du débat d'imputation. */
  rattachementClient: string;
  /** Portée probatoire QUALITATIVE, argumentée. Jamais un score. */
  portee: string;
  faiblesses: string[];
  cotes: string[];
};

export type Scelle = {
  id: string;
  designation: string;
  dateSaisie: string | null;
  /** Chaîne de conservation, opération par opération, dans l'ordre. */
  chaineConservation: string[];
  operationsSubsequentes: string[];
};

export type QualificationEnvisagee = {
  id: string;
  /** Intitulé FONCTIONNEL — le fondement textuel est résolu à la génération (B2). */
  intituleFonctionnel: string;
  elementsAttendus: string[];
  elementsPresents: { element: string; appuis: string[] }[];
  elementsManquants: string[];
  aggravationsDiscutees: string[];
};

export type GriefNullite = {
  id: string;
  acteViseId: string;
  irregularite: string;
  /** L'intérêt à agir, argumenté — condition de recevabilité (poste 14). */
  interetAAgir: string;
  cotesAffectees: string[];
  /** Actes subséquents contaminés si le grief prospère. */
  actesSubsequentsContamines: string[];
  forclusionEventuelle: string | null;
  appuis: string[];
};

export type CategorieMoyen =
  | 'in-limine-litis'
  | 'nullite'
  | 'imputation'
  | 'requalification'
  | 'peine';

/** Ordre procédural imposé (§7.6) — jamais un ordre « par chances ». */
export const ORDRE_MOYENS: CategorieMoyen[] = [
  'in-limine-litis',
  'nullite',
  'imputation',
  'requalification',
  'peine',
];

export type Moyen = {
  id: string;
  categorie: CategorieMoyen;
  enonce: string;
  /** Ids de Fait, ActeProcedure, cotes ou fragments qui portent le moyen. */
  appuis: string[];
  /** Références de texte, résolues à la génération. Vide ⇒ « fondement à vérifier ». */
  references: string[];
  /** Riposte prévisible du parquet (P5). Vide ⇒ moyen incomplet, export bloqué. */
  ripostePrevue: string;
  contreRiposte: string;
  consequenceRecherchee: string;
};

export type Consigne = {
  id: string;
  portee: 'cabinet' | 'dossier';
  /** Référence du dossier concerné quand la portée est « dossier ». */
  dossierReference: string | null;
  enonce: string;
  date: string;
  auteur: string;
  active: boolean;
};

export type EtatDemande = 'ouverte' | 'traitee' | 'a-verifier' | 'close';

export type Demande = {
  id: string;
  dossierReference: string;
  enonce: string;
  date: string;
  etat: EtatDemande;
  passesDeclenchees: string[];
  /** Identifiant de la sortie produite — jamais son contenu (B11). */
  sortieProduite: string | null;
  /** Ce qui reste à faire quand la demande est partiellement traitée. */
  resteAFaire: string[];
  verifieeLe: string | null;
};

/**
 * Entrée du journal d'audit (M13). AUCUN contenu de dossier n'y figure :
 * uniquement des identifiants internes et des comptes (B11).
 */
export type EntreeJournal = {
  id: string;
  horodatage: string;
  action: string;
  passe: string | null;
  moteur: { type: 'deterministe' | 'local' | 'distant'; modele: string | null };
  /** Identifiants des entrées mobilisées — pas leur contenu. */
  entrees: string[];
  sorties: string[];
  blocages: string[];
};

// ---------------------------------------------------------------------------
// Le dossier pénal complet
// ---------------------------------------------------------------------------

/**
 * Champs v4 ajoutés au `Dossier` d'analyse. Tous ont un défaut vide : un
 * dossier ancien se charge, il n'est jamais « migré » en silence.
 */
export type ExtensionPenale = {
  versionSchema: string;
  /** Initiales seulement : le nom complet n'a rien à faire dans une clé d'écran. */
  initialesClient: string;
  juridiction: string;
  cadreProcedural: string;
  qualiteClient: string;
  statutLiberte: StatutClient;
  phase: Phase;
  natures: NatureContentieux[];
  avancement: Avancement;
  /** Étiquettes libres — en complément des axes, jamais en remplacement. */
  etiquettes: string[];
  echeances: Echeance[];
  faits: Fait[];
  actes: ActeProcedure[];
  mesures: MesureContrainte[];
  preuves: ElementPreuve[];
  scelles: Scelle[];
  qualificationsEnvisagees: QualificationEnvisagee[];
  griefs: GriefNullite[];
  moyens: Moyen[];
  manques: Manque[];
};

export type DossierPenal = Dossier & ExtensionPenale;

/**
 * Complète un `Dossier` d'analyse en `DossierPenal`.
 *
 * Les défauts sont des ABSENCES (listes vides, `null` sémantique), pas des
 * suppositions : `phase: 'enquete'` par défaut serait une affirmation sur un
 * dossier qu'on n'a pas lu — le défaut est donc `a-constituer` côté
 * avancement, et la phase reste à choisir par l'avocat (défaut neutre).
 */
export function completerDossierPenal(
  dossier: Dossier,
  extension: Partial<ExtensionPenale> = {}
): DossierPenal {
  return {
    ...dossier,
    versionSchema: extension.versionSchema ?? VERSION_SCHEMA,
    initialesClient: extension.initialesClient ?? '',
    juridiction: extension.juridiction ?? '',
    cadreProcedural: extension.cadreProcedural ?? '',
    qualiteClient: extension.qualiteClient ?? '',
    statutLiberte: extension.statutLiberte ?? 'libre',
    phase: extension.phase ?? 'enquete',
    natures: extension.natures ?? [],
    avancement: extension.avancement ?? 'a-constituer',
    etiquettes: extension.etiquettes ?? [],
    echeances: extension.echeances ?? [],
    faits: extension.faits ?? [],
    actes: extension.actes ?? [],
    mesures: extension.mesures ?? [],
    preuves: extension.preuves ?? [],
    scelles: extension.scelles ?? [],
    qualificationsEnvisagees: extension.qualificationsEnvisagees ?? [],
    griefs: extension.griefs ?? [],
    moyens: extension.moyens ?? [],
    manques: extension.manques ?? [],
  };
}

// ---------------------------------------------------------------------------
// Invariants
// ---------------------------------------------------------------------------

export type Violation = {
  entite: string;
  id: string;
  regle: string;
};

/**
 * Contrôle les invariants du modèle. Rend la liste des violations — il ne
 * corrige RIEN : corriger en silence, c'est décider à la place de l'avocat.
 */
export function controlerInvariants(dossier: DossierPenal): Violation[] {
  const violations: Violation[] = [];
  const idsFaits = new Set(dossier.faits.map((f) => f.id));
  const idsActes = new Set(dossier.actes.map((a) => a.id));
  const idsCotes = new Set(dossier.pieces.map((p) => p.cote ?? p.id));
  const idsPieces = new Set(dossier.pieces.map((p) => p.id));

  for (const moyen of dossier.moyens) {
    const citeFaitOuActe = moyen.appuis.some((a) => idsFaits.has(a) || idsActes.has(a));
    if (!citeFaitOuActe) {
      violations.push({
        entite: 'Moyen',
        id: moyen.id,
        regle: 'Tout moyen cite au moins un fait ou un acte de procédure.',
      });
    }
  }

  for (const fait of dossier.faits) {
    if (fait.cotes.length === 0) {
      violations.push({
        entite: 'Fait',
        id: fait.id,
        regle: 'Fait non sourcé : aucune cote ne le porte. Il reste allégué.',
      });
    } else {
      for (const cote of fait.cotes) {
        if (!idsCotes.has(cote) && !idsPieces.has(cote)) {
          violations.push({
            entite: 'Fait',
            id: fait.id,
            regle: `La cote « ${cote} » citée n'existe pas au dossier.`,
          });
        }
      }
    }
  }

  for (const grief of dossier.griefs) {
    if (!idsActes.has(grief.acteViseId)) {
      violations.push({
        entite: 'GriefNullite',
        id: grief.id,
        regle: `L'acte visé « ${grief.acteViseId} » n'existe pas au dossier.`,
      });
    }
  }

  return violations;
}

/**
 * L'import refuse une version de schéma inconnue : lire un format qu'on ne
 * connaît pas produirait des champs devinés, ce que tout ce modèle interdit.
 */
export function versionAcceptee(version: unknown): boolean {
  return version === VERSION_SCHEMA;
}

/**
 * Propagation d'un grief : l'acte visé, puis tous ses actes subséquents,
 * transitivement. C'est le calcul que la frise matérialise (§8.4).
 *
 * Une boucle dans le graphe (A subséquent de B, B de A) n'est pas une erreur
 * fatale : chaque acte n'est visité qu'une fois.
 */
export function actesContamines(dossier: DossierPenal, grief: GriefNullite): string[] {
  const parId = new Map(dossier.actes.map((a) => [a.id, a]));
  const atteints = new Set<string>();
  const file = [grief.acteViseId];

  while (file.length > 0) {
    const id = file.pop()!;
    if (atteints.has(id)) continue;
    atteints.add(id);
    const acte = parId.get(id);
    if (acte) file.push(...acte.actesSubsequents);
  }

  return [...atteints];
}
