/**
 * LDI — dossiers de démonstration.
 *
 * ┌─ ENTIÈREMENT FICTIFS ───────────────────────────────────────────────────┐
 * │ Aucune de ces procédures n'existe. Les références, les horaires et les   │
 * │ cotes sont inventés POUR ÊTRE INVENTÉS : ils servent à faire fonctionner │
 * │ les détecteurs sur des cas connus, pas à documenter une affaire.         │
 * │                                                                          │
 * │ Chaque dossier vise un état précis du classement : anomalie relevée,     │
 * │ à vérifier, aucune pièce. Le tableau de bord est ainsi lisible dès la    │
 * │ première ouverture, sans qu'un dossier réel ait à être chargé.           │
 * │                                                                          │
 * │ Le quatrième état, « rien relevé », n'est PAS représenté — et il ne      │
 * │ pouvait pas l'être : il suppose que les dix points de contrôle passent   │
 * │ tous à `conforme`, ce qu'un dossier réaliste n'atteint jamais, les       │
 * │ points restant `non-etabli` faute de pièces qui les établissent. Cet     │
 * │ état existe dans le type ; il est quasi théorique en pratique.           │
 * │                                                                          │
 * │ Le préfixe « DEMO- » n'est pas décoratif : il doit rester visible dans   │
 * │ toutes les vues, pour qu'aucune capture d'écran ne puisse être prise     │
 * │ pour l'analyse d'une procédure réelle.                                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { Dossier } from './types';

/** Préfixe de référence réservé aux dossiers fictifs. */
export const PREFIXE_DEMONSTRATION = 'DEMO-';

export function estDemonstration(reference: string): boolean {
  return reference.startsWith(PREFIXE_DEMONSTRATION);
}

/**
 * Garde à vue de droit commun présentant plusieurs écarts : notification
 * tardive, audition avant l'expiration du délai de carence de l'art. 63-4-2
 * CPP, et durée excédant la mesure initiale prolongée une fois.
 */
const GARDE_A_VUE_IRREGULIERE: Dossier = {
  reference: 'DEMO-2026-014',
  qualifications: ['CP, art. 222-37'],
  regime: 'droit-commun',
  pieces: [
    { id: 'D1', cote: 'D1', nature: 'proces-verbal', intitule: 'PV de placement en garde à vue', date: '2026-03-14', auteur: 'OPJ' },
    { id: 'D2', cote: 'D2', nature: 'proces-verbal', intitule: 'PV de notification des droits', date: '2026-03-14', auteur: 'OPJ' },
    { id: 'D3', cote: 'D3', nature: 'audition', intitule: 'PV d’audition n°1', date: '2026-03-14', auteur: 'OPJ' },
    { id: 'D4', cote: 'D4', nature: 'proces-verbal', intitule: 'PV de prolongation', date: '2026-03-15', auteur: 'OPJ' },
    { id: 'D5', cote: 'D5', nature: 'proces-verbal', intitule: 'PV de fin de mesure', date: '2026-03-16', auteur: 'OPJ' },
  ],
  evenements: [
    { id: 'E1', nature: 'interpellation', horodatage: '2026-03-14T06:20', description: 'Interpellation au domicile', sourcePieceId: 'D1' },
    { id: 'E2', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T06:40', description: 'Placement en garde à vue', sourcePieceId: 'D1' },
    { id: 'E3', nature: 'notification-droits', horodatage: '2026-03-14T08:00', description: 'Notification des droits', sourcePieceId: 'D2' },
    { id: 'E4', nature: 'demande-avocat', horodatage: '2026-03-14T08:05', description: 'Demande d’assistance d’un avocat', sourcePieceId: 'D2' },
    { id: 'E5', nature: 'avis-avocat', horodatage: '2026-03-14T08:20', description: 'Avis donné au barreau', sourcePieceId: 'D2' },
    { id: 'E6', nature: 'audition', horodatage: '2026-03-14T09:00', description: 'Première audition sur les faits', sourcePieceId: 'D3' },
    { id: 'E7', nature: 'prolongation-garde-a-vue', horodatage: '2026-03-15T06:00', description: 'Prolongation autorisée par le procureur', sourcePieceId: 'D4' },
    { id: 'E8', nature: 'fin-garde-a-vue', horodatage: '2026-03-16T07:40', description: 'Fin de la mesure', sourcePieceId: 'D5' },
  ],
  observations: [
    'Le client indique avoir demandé un avocat dès son interpellation ; à vérifier au registre.',
  ],
};

/**
 * Régime dérogatoire de l'art. 706-88 CPP. Procédure régulière quant aux
 * durées, mais dont plusieurs points restent non établis faute de pièces.
 */
const CRIMINALITE_ORGANISEE: Dossier = {
  reference: 'DEMO-2026-021',
  qualifications: ['CP, art. 324-1', 'CP, art. 222-37'],
  regime: 'criminalite-organisee',
  pieces: [
    { id: 'D1', cote: 'D1', nature: 'proces-verbal', intitule: 'PV de placement', date: '2026-05-02', auteur: 'OPJ' },
    { id: 'D2', cote: 'D2', nature: 'proces-verbal', intitule: 'PV de notification des droits', date: '2026-05-02', auteur: 'OPJ' },
    { id: 'D3', cote: 'D3', nature: 'proces-verbal', intitule: 'PV de prolongation (JLD)', date: '2026-05-03', auteur: 'JLD' },
    { id: 'D4', cote: 'D4', nature: 'audition', intitule: 'PV d’audition n°2', date: '2026-05-03', auteur: 'OPJ' },
    { id: 'D5', cote: 'D5', nature: 'proces-verbal', intitule: 'PV de fin de mesure', date: '2026-05-04', auteur: 'OPJ' },
    { id: 'D6', cote: 'D6', nature: 'piece-technique', intitule: 'Scellé n°3 — téléphone', date: '2026-05-02' },
  ],
  evenements: [
    { id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-05-02T07:00', description: 'Placement en garde à vue', sourcePieceId: 'D1' },
    { id: 'E2', nature: 'notification-droits', horodatage: '2026-05-02T07:10', description: 'Notification des droits', sourcePieceId: 'D2' },
    { id: 'E3', nature: 'demande-avocat', horodatage: '2026-05-02T07:15', description: 'Demande d’avocat', sourcePieceId: 'D2' },
    { id: 'E4', nature: 'avis-avocat', horodatage: '2026-05-02T07:25', description: 'Avis au barreau', sourcePieceId: 'D2' },
    { id: 'E5', nature: 'arrivee-avocat', horodatage: '2026-05-02T09:30', description: 'Arrivée de l’avocat', sourcePieceId: 'D2' },
    { id: 'E6', nature: 'audition', horodatage: '2026-05-02T10:00', description: 'Audition en présence de l’avocat', sourcePieceId: 'D4' },
    { id: 'E7', nature: 'prolongation-garde-a-vue', horodatage: '2026-05-03T06:30', description: 'Première prolongation', sourcePieceId: 'D3' },
    { id: 'E8', nature: 'fin-garde-a-vue', horodatage: '2026-05-04T06:00', description: 'Fin de la mesure', sourcePieceId: 'D5' },
  ],
};

/** Enquête préliminaire sans garde à vue : peu de points contrôlables. */
const ENQUETE_PRELIMINAIRE: Dossier = {
  reference: 'DEMO-2026-033',
  qualifications: ['CP, art. 313-1'],
  regime: 'droit-commun',
  pieces: [
    { id: 'D1', cote: 'D1', nature: 'proces-verbal', intitule: 'PV de plainte', date: '2026-01-08' },
    { id: 'D2', cote: 'D2', nature: 'proces-verbal', intitule: 'PV de perquisition', date: '2026-02-11', auteur: 'OPJ' },
    { id: 'D3', cote: 'D3', nature: 'temoignage', intitule: 'Audition libre du témoin', date: '2026-02-12' },
  ],
  evenements: [
    { id: 'E1', nature: 'perquisition', horodatage: '2026-02-11T09:00', description: 'Perquisition au siège social', sourcePieceId: 'D2' },
    { id: 'E2', nature: 'audition', horodatage: '2026-02-12T14:00', description: 'Audition libre', sourcePieceId: 'D3' },
  ],
};

/** Dossier ouvert, aucune pièce versée : état « vide » du classement. */
const DOSSIER_OUVERT: Dossier = {
  reference: 'DEMO-2026-040',
  qualifications: ['CP, art. 432-11'],
  regime: 'droit-commun',
  pieces: [],
  evenements: [],
};

/**
 * Les quatre dossiers fictifs, dans l'ordre où ils rendent le classement
 * lisible : un par état atteignable.
 */
export const DOSSIERS_DEMONSTRATION: Dossier[] = [
  GARDE_A_VUE_IRREGULIERE,
  CRIMINALITE_ORGANISEE,
  ENQUETE_PRELIMINAIRE,
  DOSSIER_OUVERT,
];
