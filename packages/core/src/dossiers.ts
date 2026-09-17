/**
 * Dossiers — statuts, typologies, tunnel de création en 5 étapes.
 *
 * Source unique partagée par le site web (`src/pages/DossierFlow.tsx`,
 * `src/pages/DossierDetail.tsx`) et l'application mobile. Les valeurs écrites
 * en base (`dossiers.typology`, `dossiers.status`, clés de `dossiers.answers`)
 * sont donc rigoureusement identiques d'une plateforme à l'autre, et les
 * dossiers déjà enregistrés restent lisibles (typologies héritées conservées).
 */

import { normalizeLabel } from './documents';

/* ── Statuts ─────────────────────────────────────────────────────────────── */

/** Statuts réellement écrits en base par l'application. */
export const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  transmis: 'Transmis',
  'en-cours': 'En cours',
  valide: 'Validé',
  archive: 'Archivé',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

/** Statut ≠ étape : le statut est l'état général, l'étape la position workflow. */
export function currentStep(status: string): number {
  switch (status) {
    case 'brouillon':
      return 1;
    case 'transmis':
    case 'en-cours':
      return 3;
    case 'valide':
      return 4;
    case 'archive':
      return 5;
    default:
      return 1;
  }
}

/** Avancement du dossier — 5 étapes métier (mêmes libellés que la page web). */
export const TIMELINE_STEPS = [
  'Création du dossier',
  'Devis, contrat ou accord',
  'Suivi du dossier',
  'Facture et paiement',
  'Option impayé / pré-contentieux',
];

export const STEP_PANELS: string[] = [
  'Le dossier est créé : profil, nature, informations clés et premières pièces sont réunis dans un espace unique.',
  'Les documents qui fondent la relation (devis, contrat, bon de commande, accord) sont rassemblés et datés.',
  'Le dossier vit : échanges, relances, pièces complémentaires et échéances sont suivis au même endroit.',
  'La facturation et les règlements sont tracés : montants, échéances, acomptes et solde restant dû.',
  "En cas d'impayé, le dossier est prêt : relances, mise en demeure et pièces sont organisées pour être transmises à un professionnel habilité.",
];

export const STEP_MESSAGES: Record<number, string> = {
  1: "Votre dossier vient d'être créé. Complétez les informations et déposez vos pièces pour le structurer.",
  2: "Rassemblez les documents qui fondent l'accord (devis, contrat, commande) pour sécuriser la suite.",
  3: 'Votre dossier est suivi. Ajoutez les nouveaux échanges et pièces au fur et à mesure.',
  4: 'Suivez la facturation et les règlements : renseignez les montants et les échéances de paiement.',
  5: 'Le dossier est prêt à être transmis à un professionnel du droit en cas de contentieux.',
};

export const STEP_NEXT_ACTIONS: Record<number, string> = {
  1: 'Vérifiez les informations du dossier et déposez les premières pièces.',
  2: "Ajoutez le devis, le contrat ou l’accord signé au dossier.",
  3: 'Mettez à jour le suivi : nouveaux courriers, relances, pièces reçues.',
  4: "Renseignez la facture, le montant dû et l’échéance de paiement.",
  5: 'Préparez la transmission à un professionnel habilité si le litige persiste.',
};

/* ── Typologies ──────────────────────────────────────────────────────────── */

export type Category =
  | 'dossier-client'
  | 'facture-paiement'
  | 'impaye-precontentieux'
  | 'administratif'
  | 'comptable'
  | 'rh'
  | 'autre';

export const CATEGORIES: { id: Category; label: string; description: string }[] = [
  {
    id: 'dossier-client',
    label: 'Dossier client',
    description: "Contrat, devis, commande, prestation, suivi d'un client.",
  },
  {
    id: 'facture-paiement',
    label: 'Facture / paiement',
    description: 'Facturation, échéances, acomptes, conditions de règlement.',
  },
  {
    id: 'impaye-precontentieux',
    label: 'Impayé / pré-contentieux',
    description: 'Facture non réglée, relances, mise en demeure, litige.',
  },
  {
    id: 'administratif',
    label: 'Dossier administratif',
    description: "URSSAF, impôts, déclaration, contrôle, demande d'aide.",
  },
  {
    id: 'comptable',
    label: 'Documents comptables',
    description: 'Pièces comptables, justificatifs, bilan, TVA.',
  },
  {
    id: 'rh',
    label: 'Personnel / RH',
    description: 'Contrat de travail, salarié, congés, fin de collaboration.',
  },
  {
    id: 'autre',
    label: 'Autre',
    description: "Tout dossier qui n'entre pas dans les cases ci-dessus.",
  },
];

/** Libellés d'affichage, typologies héritées comprises (dossiers déjà enregistrés). */
export const TYPOLOGY_LABELS: Record<string, string> = {
  'dossier-client': 'Dossier client',
  'facture-paiement': 'Facture / paiement',
  'impaye-precontentieux': 'Impayé / pré-contentieux',
  administratif: 'Dossier administratif',
  comptable: 'Documents comptables',
  rh: 'Personnel / RH',
  autre: 'Autre',
  // Anciennes typologies — conservées pour les dossiers déjà enregistrés.
  'litige-commercial': 'Litige commercial',
  recouvrement: 'Recouvrement',
  bail: 'Bail & immobilier',
  consommation: 'Litige client / fournisseur',
  'prud-hommes': "Prud'hommes",
  divorce: 'Divorce / famille',
  succession: 'Succession',
};

export function typologyLabel(typology: string): string {
  return TYPOLOGY_LABELS[typology] ?? typology;
}

/* ── Profils ─────────────────────────────────────────────────────────────── */

export type Profil =
  | 'artisan'
  | 'independant'
  | 'profession-liberale'
  | 'entreprise-pme'
  | 'autre';

export const PROFILS: { id: Profil; label: string; description: string }[] = [
  {
    id: 'artisan',
    label: 'Artisan',
    description: 'Bâtiment, métiers de bouche, services à la personne, fabrication.',
  },
  {
    id: 'independant',
    label: 'Indépendant',
    description: 'Auto-entrepreneur, freelance, micro-entreprise.',
  },
  {
    id: 'profession-liberale',
    label: 'Profession libérale',
    description: 'Santé, conseil, droit, expertise, technique.',
  },
  {
    id: 'entreprise-pme',
    label: 'Entreprise individuelle / PME',
    description: 'TPE, PME, société avec quelques salariés.',
  },
  {
    id: 'autre',
    label: 'Autre',
    description: 'Association, particulier, autre structure.',
  },
];

/* ── Champs du tunnel (étape 3) ──────────────────────────────────────────── */

export type Field = {
  id: string;
  label: string;
  help?: string;
  type?: 'text' | 'date' | 'textarea';
};

export const AMOUNT_HELP =
  'Si vous connaissez le montant concerné, indiquez-le ici. Sinon laissez ce champ vide : il pourra être précisé ultérieurement après analyse de votre dossier.';

export const COMMON_FIELDS: Field[] = [
  {
    id: 'counterparty',
    label: 'Personne ou société concernée',
    help: 'Client, fournisseur, organisme, salarié…',
  },
  {
    id: 'startDate',
    label: 'Date de référence',
    type: 'date',
    help: 'Contrat, facture, échange — la date qui compte.',
  },
  {
    id: 'amount',
    label: 'Montant en jeu (€)',
    help: AMOUNT_HELP,
  },
  {
    id: 'deadline',
    label: 'Échéance / date limite',
    type: 'date',
    help: 'Pour les relances et le suivi des délais.',
  },
  {
    id: 'situation',
    label: 'Décrivez la situation',
    type: 'textarea',
    help: "Quelques phrases : ce qui s'est passé, quand, et ce que vous attendez.",
  },
];

// Jeu de champs générique, légèrement adapté par catégorie (sans mapping complexe).
export const FIELD_OVERRIDES: Partial<Record<Category, Field[]>> = {
  'impaye-precontentieux': [
    { id: 'counterparty', label: 'Débiteur (client ou société)' },
    { id: 'startDate', label: 'Date de la facture', type: 'date' },
    { id: 'amount', label: 'Montant dû (€)', help: AMOUNT_HELP },
    {
      id: 'deadline',
      label: 'Échéance de paiement',
      type: 'date',
      help: 'Pour suivre les délais de paiement.',
    },
    {
      id: 'situation',
      label: 'Historique des relances',
      type: 'textarea',
      help: 'Relances déjà envoyées, réponses obtenues, suite souhaitée.',
    },
  ],
  rh: [
    { id: 'counterparty', label: 'Salarié concerné' },
    { id: 'startDate', label: "Date d'embauche", type: 'date' },
    {
      id: 'deadline',
      label: 'Échéance / date limite',
      type: 'date',
      help: 'Fin de contrat, entretien, délai à respecter.',
    },
    {
      id: 'situation',
      label: 'Situation actuelle',
      type: 'textarea',
      help: "Quelques phrases : ce qui s'est passé, quand, et ce que vous attendez.",
    },
  ],
};

export function fieldsFor(category: Category): Field[] {
  return FIELD_OVERRIDES[category] ?? COMMON_FIELDS;
}

/** Libellés de lecture des réponses enregistrées (clés historiques comprises). */
export const ANSWER_LABELS: Record<string, string> = {
  counterparty: 'Partie adverse',
  contractDate: 'Date du contrat',
  amount: 'Montant en jeu',
  deadline: 'Échéance',
  situation: 'Situation',
  debtor: 'Débiteur',
  invoiceDate: 'Date de la facture',
  organisme: 'Organisme concerné',
  refDossier: 'Référence du dossier',
  role: 'Rôle',
  address: 'Adresse du local',
  startDate: "Date d'entrée dans les lieux",
  merchant: 'Vendeur / prestataire / client',
  purchaseDate: "Date d'achat ou de souscription",
  employer: "Nom de l'employeur",
  contractStart: "Date d'embauche",
  ruptureDate: 'Date de la rupture',
  marriageDate: 'Date du mariage',
  separationDate: 'Date de séparation',
  children: "Nombre d'enfants concernés",
  deathDate: 'Date du décès',
  heirCount: "Nombre d'héritiers connus",
};

export function answerLabel(key: string): string {
  return ANSWER_LABELS[key] ?? key;
}

export function isDateKey(key: string): boolean {
  return /date|deadline|echeance|échéance/i.test(key);
}

/* ── Titres ──────────────────────────────────────────────────────────────── */

const GENERIC_TITLES = new Set(
  [
    'autre', 'dossier client', 'facture / paiement', 'impayé / pré-contentieux',
    'dossier administratif', 'documents comptables', 'personnel / rh',
    'litige commercial', 'recouvrement', 'bail & immobilier',
    'litige client / fournisseur', "prud'hommes", 'divorce / famille', 'succession',
    'dossier-client', 'facture-paiement', 'impaye-precontentieux', 'administratif',
    'comptable', 'rh',
  ].map((t) => normalizeLabel(t)),
);

/** Vrai si le titre est vide ou n'est qu'une reprise de catégorie (à renommer). */
export function isGenericTitle(title: string | null | undefined): boolean {
  if (!title?.trim()) return true;
  return GENERIC_TITLES.has(normalizeLabel(title.trim()));
}

/** Titre affiché d'un dossier : titre saisi, sinon libellé de typologie. */
export function dossierDisplayTitle(dossier: { title?: string | null; typology: string }): string {
  const t = dossier.title?.trim();
  if (t) return t;
  return typologyLabel(dossier.typology);
}

export type Dossier = {
  id: string;
  user_id: string;
  typology: string;
  title: string | null;
  status: string;
  answers: Record<string, string>;
  legal_review_requested: boolean;
  created_at: string;
  updated_at: string;
};

export type DossierDocument = {
  id: string;
  dossier_id: string;
  user_id: string;
  file_path: string;
  file_name: string;
  size_bytes: number | null;
  created_at: string;
  /** Colonnes ajoutées par 20260915120000_gestion_documentaire.sql (peuvent être absentes). */
  category?: string | null;
  deleted_at?: string | null;
  /** Colonne ajoutée par 20260628093000_dossier_deliverables.sql : 'piece' | 'deliverable'. */
  kind?: string | null;
};

/** Recherche locale insensible à la casse et aux accents (dossiers + pièces). */
export function matchesQuery(haystack: (string | null | undefined)[], query: string): boolean {
  const q = normalizeLabel(query.trim());
  if (!q) return true;
  const terms = q.split(/\s+/);
  const text = haystack.filter(Boolean).map((s) => normalizeLabel(String(s))).join(' ');
  return terms.every((t) => text.includes(t));
}
