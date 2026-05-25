export type BillingPeriod = 'monthly' | 'yearly';

export type Plan = {
  id: string;
  name: string;
  audience: string;
  description: string;
  priceMonthly: number | null; // null = sur devis
  popular?: boolean;
  ctaLabel: string;
  ctaHref: string;
  features: string[];
};

export const YEARLY_DISCOUNT = 0.15;

export const plans: Plan[] = [
  {
    id: 'particulier',
    name: 'Particulier',
    audience: 'Pour traiter un dossier personnel.',
    description: "Une affaire à monter — prud'hommes, bail, recouvrement, succession. Vous remplissez, ClairDossier structure, un avocat habilité valide.",
    priceMonthly: 0,
    ctaLabel: 'Créer un dossier',
    ctaHref: '/dossier/nouveau',
    features: [
      "1 dossier actif",
      "12 typologies juridiques",
      "Pièces jointes jusqu'à 500 Mo",
      "Chronologie automatique",
      "Validation par un avocat partenaire",
      "Messagerie sécurisée",
      "Export ZIP intégral",
      "Conservation 10 ans",
    ],
  },
  {
    id: 'professionnel',
    name: 'Professionnel',
    audience: "Pour un cabinet jusqu'à 5 utilisateurs.",
    description: "L'avocat seul, le cabinet en démarrage, l'étude familiale. Tout l'outillage ClairDossier, sans les complexités SSO/audit dédiés.",
    priceMonthly: 49,
    popular: true,
    ctaLabel: 'Choisir Professionnel',
    ctaHref: '/contact?plan=professionnel',
    features: [
      "5 utilisateurs inclus",
      "Dossiers illimités",
      "Stockage 50 Go",
      "API d'intégration logicielle",
      "Brief IA préparatoire avant chaque rendez-vous",
      "Notes internes vs partagées",
      "Notification SMS premium (option)",
      "Support prioritaire 24h",
    ],
  },
  {
    id: 'entreprise',
    name: 'Entreprise',
    audience: 'Pour les cabinets multi-sites et structures complexes.',
    description: "SSO, audit dédié, DPA renforcé, onboarding sur site. Pour les structures où la conformité interne fait partie du contrat.",
    priceMonthly: null,
    ctaLabel: 'Demander un devis',
    ctaHref: '/contact?plan=entreprise',
    features: [
      "Utilisateurs illimités",
      "Stockage 1 To (extensible)",
      "Single Sign-On (SAML, OIDC)",
      "DPA renforcé et personnalisé",
      "Audit annuel par tiers (rapport remis)",
      "Onboarding sur site (2 jours)",
      "Formation cabinet (équipe entière)",
      "SLA 99,95 % avec garantie de remboursement",
    ],
  },
];

export type AddOn = {
  id: string;
  name: string;
  blurb: string;
  pricing: string;
};

export const addOns: AddOn[] = [
  {
    id: 'audit-annuel',
    name: 'Audit de sécurité annuel',
    blurb: "Un cabinet de tiers indépendant audite notre infrastructure et les configurations RGPD de votre cabinet. Rapport remis sous 30 jours.",
    pricing: '2 400 € HT / an',
  },
  {
    id: 'onboarding',
    name: 'Onboarding sur site',
    blurb: "Deux jours dans votre cabinet : reprise de vos dossiers existants, migration des pièces, formation des collaborateurs.",
    pricing: 'À partir de 1 800 € HT',
  },
  {
    id: 'formation-cabinet',
    name: 'Formation cabinet complète',
    blurb: "Formation distancielle ou présentielle pour l'équipe entière — usage avancé, paramétrage des typologies internes, conventions de nommage.",
    pricing: '950 € HT / session',
  },
];

export type MatrixRow = {
  feature: string;
  particulier: boolean | string;
  professionnel: boolean | string;
  entreprise: boolean | string;
};

export const comparisonMatrix: MatrixRow[] = [
  { feature: "Utilisateurs", particulier: '1', professionnel: '5', entreprise: 'Illimités' },
  { feature: "Dossiers actifs", particulier: '1', professionnel: 'Illimités', entreprise: 'Illimités' },
  { feature: "Stockage par compte", particulier: '500 Mo', professionnel: '50 Go', entreprise: '1 To+' },
  { feature: "12 typologies juridiques", particulier: true, professionnel: true, entreprise: true },
  { feature: "Chronologie automatique", particulier: true, professionnel: true, entreprise: true },
  { feature: "Pièces jointes + OCR", particulier: true, professionnel: true, entreprise: true },
  { feature: "Brief IA préparatoire", particulier: false, professionnel: true, entreprise: true },
  { feature: "API d'intégration", particulier: false, professionnel: true, entreprise: true },
  { feature: "Notes internes vs partagées", particulier: false, professionnel: true, entreprise: true },
  { feature: "SSO (SAML, OIDC)", particulier: false, professionnel: false, entreprise: true },
  { feature: "DPA personnalisé", particulier: 'Standard', professionnel: 'Standard', entreprise: 'Renforcé' },
  { feature: "Audit annuel par tiers", particulier: false, professionnel: 'En option', entreprise: 'Inclus' },
  { feature: "Support", particulier: 'Communauté', professionnel: 'Prioritaire 24h', entreprise: 'Dédié + SLA 99,95 %' },
  { feature: "Conservation des données", particulier: '10 ans', professionnel: '10 ans', entreprise: 'Sur mesure' },
];

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
