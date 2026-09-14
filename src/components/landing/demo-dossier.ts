/**
 * Dossier de démonstration — source UNIQUE des données fictives affichées par
 * la home cinématique (hero, chapitres, vue d'ensemble, section finale).
 *
 * Règles (MASTER_PROMPT X.5 « No fake functionality », VI.4) :
 *  - toutes les données sont fictives et présentées comme telles (DEMO_LABEL) ;
 *  - chaque libellé d'interface reprend un libellé RÉEL du produit
 *    (src/pages/DossierFlow.tsx, src/pages/DossierDetail.tsx, src/data/statuses.ts) ;
 *  - aucune capacité non opérationnelle n'est mise en scène (pas de lecture
 *    automatique des pièces, pas de rappel envoyé — voir /etat-du-produit).
 */

export const DEMO_LABEL = 'Dossier de démonstration';

/** Les 5 étapes métier de la page « Avancement du dossier » (DossierDetail.tsx). */
export const BUSINESS_STEPS = [
  'Création du dossier',
  'Devis, contrat ou accord',
  'Suivi du dossier',
  'Facture et paiement',
  'Option impayé / pré-contentieux',
] as const;

/** Les 5 étapes du tunnel de création (DossierFlow.tsx). */
export const TUNNEL_STEPS = ['Profil', 'Nature', 'Informations', 'Pièces', 'Récapitulatif'] as const;

export type DemoDocType = 'devis' | 'facture' | 'email' | 'courrier' | 'photo' | 'justificatif' | 'contrat' | 'echeance';

export type DemoPiece = {
  name: string;
  type: DemoDocType;
  /** Étiquette lisible du type (nommage libre côté produit : sous-catégorie). */
  tag: string;
  meta: string;
};

export const DEMO = {
  label: DEMO_LABEL,
  reference: 'CD-2026-0918',
  title: 'Chantier Estaque — devis D-2026-018',
  /** Nature du dossier — libellé réel du tunnel (CATEGORIES). */
  category: 'Facture / paiement',
  /** Profil — libellé réel du tunnel (PROFILS). */
  profile: 'Artisan',
  /** Champs réels du tunnel (COMMON_FIELDS / FIELD_OVERRIDES facture-paiement). */
  fields: [
    { label: 'Nature du dossier', value: 'Facture / paiement' },
    { label: 'Débiteur (client ou société)', value: 'Exemple SARL' },
    { label: 'Date de la facture', value: '12 sept. 2026' },
    { label: 'Montant dû (€)', value: '4 800 € HT' },
    { label: 'Échéance de paiement', value: '15 oct. 2026' },
  ],
  deadline: {
    label: 'Échéance de paiement',
    dateLong: 'jeudi 15 octobre 2026',
    dateShort: '15 oct. 2026',
    iso: '2026-10-15',
    day: 15,
    month: 'Octobre 2026',
    /** 1er octobre 2026 = jeudi → décalage de 3 cases (lun. = 0). */
    firstWeekday: 3,
    daysInMonth: 31,
    status: 'À venir',
  },
  /** Étape métier atteinte (1-indexée) et statut réel (statuses.ts). */
  step: 3,
  status: 'En cours',
  /** Texte réel STEP_NEXT_ACTIONS[3] (DossierDetail.tsx). */
  nextAction: 'Mettez à jour le suivi : nouveaux courriers, relances, pièces reçues.',
  pieces: [
    { name: 'Devis D-2026-018 signé.pdf', type: 'devis', tag: 'Devis', meta: '2 pages · déposé le 12 sept.' },
    { name: 'Facture F-2026-042.pdf', type: 'facture', tag: 'Facture', meta: '1 page · déposée le 13 sept.' },
    { name: 'Accord client — e-mail du 12 sept.', type: 'email', tag: 'E-mail', meta: 'exporté en PDF' },
    { name: 'Bon de livraison signé.jpg', type: 'justificatif', tag: 'Justificatif', meta: 'photo · 13 sept.' },
  ] satisfies DemoPiece[],
  transmission: {
    channel: 'E-mail',
    recipient: 'Exemple SARL',
    date: '14 sept. 2026',
  },
} as const;

/**
 * Chapitre 1 — documents « dispersés » puis rangés dans le dossier.
 * 12 pièces fictives, typiques d'un artisan / d'une PME.
 */
export const SCATTERED_DOCS: DemoPiece[] = [
  { name: 'Devis D-2026-018 signé.pdf', type: 'devis', tag: 'Devis', meta: '' },
  { name: 'Facture F-2026-042.pdf', type: 'facture', tag: 'Facture', meta: '' },
  { name: 'E-mail — accord du 12 sept.', type: 'email', tag: 'E-mail', meta: '' },
  { name: 'Courrier recommandé AR', type: 'courrier', tag: 'Courrier', meta: '' },
  { name: 'Bon de livraison.jpg', type: 'photo', tag: 'Justificatif', meta: '' },
  { name: 'Contrat de sous-traitance', type: 'contrat', tag: 'Contrat', meta: '' },
  { name: 'Relevé de paiement', type: 'justificatif', tag: 'Justificatif', meta: '' },
  { name: 'Photo chantier — 3 sept.', type: 'photo', tag: 'Photo', meta: '' },
  { name: "Attestation d'assurance", type: 'justificatif', tag: 'Administratif', meta: '' },
  { name: 'Échéance — 15 oct. 2026', type: 'echeance', tag: 'Échéance', meta: '' },
  { name: 'Note de frais — septembre', type: 'facture', tag: 'Comptable', meta: '' },
  { name: 'Extrait Kbis client', type: 'courrier', tag: 'Administratif', meta: '' },
];

/** Événements datés de la frise (un par statut réel, dans l'ordre de statuses.ts). */
export const DEMO_TIMELINE: Array<{ statusId: string; event: string; when: string }> = [
  { statusId: 'brouillon', event: 'Dossier créé, nommé, profil renseigné', when: '12 sept.' },
  { statusId: 'complete', event: '4 pièces déposées, récapitulatif relu', when: '13 sept.' },
  { statusId: 'attente-avocat', event: 'Transmis par e-mail — sur votre validation', when: '14 sept.' },
  { statusId: 'validation', event: 'Suivi en cours · échéance du 15 oct. affichée', when: 'aujourd’hui' },
  { statusId: 'valide', event: 'Dossier complet, prêt à être partagé', when: 'à venir' },
  { statusId: 'archive', event: 'Affaire close, données conservées et isolées', when: 'à venir' },
];
