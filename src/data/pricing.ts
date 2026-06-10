export type FeatureStatus = 'yes' | 'no' | 'limited';

export type PlanBadge = {
  label: string;
  tone: 'gratuit' | 'popular' | 'recommended';
};

export type Plan = {
  id: string;
  audience: string;
  name: string;
  description: string;
  priceMonthly: number | null;
  badge?: PlanBadge;
  variant: 'light' | 'dark';
  ctaLabel: string;
  ctaHref: string;
  specs: { dossiers: string; users: string; support: string };
  features: Record<string, FeatureStatus>;
};

export const COMPARISON_FEATURES: { id: string; label: string }[] = [
  { id: 'messagerie', label: 'Messagerie sécurisée' },
  { id: 'resume-ia', label: 'Résumé IA' },
  { id: 'redaction-ia', label: 'Rédaction IA (brouillons)' },
  { id: 'ia-avancee', label: 'IA avancée (GPT-4o)' },
  { id: 'modeles', label: 'Modèles de documents' },
  { id: 'recurrents', label: 'Dossiers récurrents' },
];

export const plans: Plan[] = [
  {
    id: 'decouverte',
    audience: 'Particulier / indépendant',
    name: 'Découverte',
    description: 'Testez ClairDossier gratuitement. Idéal pour découvrir la plateforme.',
    priceMonthly: 0,
    badge: { label: 'Gratuit', tone: 'gratuit' },
    variant: 'light',
    ctaLabel: 'Commencer gratuitement',
    ctaHref: '/dossier/nouveau',
    specs: { dossiers: '1 dossier', users: '1 utilisateur', support: 'Support communauté' },
    features: {
      messagerie: 'no',
      'resume-ia': 'no',
      'redaction-ia': 'no',
      'ia-avancee': 'no',
      modeles: 'no',
      recurrents: 'no',
    },
  },
  {
    id: 'client-essentiel',
    audience: 'Particulier / indépendant',
    name: 'Client Essentiel',
    description: 'Pour les particuliers et indépendants qui suivent leurs dossiers en autonomie.',
    priceMonthly: 19,
    variant: 'light',
    ctaLabel: 'Essai gratuit 14 jours',
    ctaHref: '/contact?plan=client-essentiel',
    specs: { dossiers: '5 dossiers', users: '1 utilisateur', support: 'Support email' },
    features: {
      messagerie: 'yes',
      'resume-ia': 'limited',
      'redaction-ia': 'no',
      'ia-avancee': 'no',
      modeles: 'no',
      recurrents: 'no',
    },
  },
  {
    id: 'business-pme',
    audience: 'TPE / PME',
    name: 'Business / PME',
    description: 'Pour les PME avec plusieurs dossiers récurrents et des équipes internes.',
    priceMonthly: 49,
    badge: { label: 'Populaire', tone: 'popular' },
    variant: 'dark',
    ctaLabel: 'Essai gratuit 14 jours',
    ctaHref: '/contact?plan=business',
    specs: { dossiers: '20 dossiers', users: '5 utilisateurs', support: 'Support prioritaire' },
    features: {
      messagerie: 'yes',
      'resume-ia': 'yes',
      'redaction-ia': 'limited',
      'ia-avancee': 'no',
      modeles: 'yes',
      recurrents: 'yes',
    },
  },
  {
    id: 'cabinet-solo',
    audience: "Cabinet d'avocat",
    name: 'Cabinet Solo',
    description: "Pour les avocats indépendants. Intake client, résumé IA, validation et brouillons.",
    priceMonthly: 79,
    variant: 'light',
    ctaLabel: 'Essai gratuit 14 jours',
    ctaHref: '/contact?plan=cabinet-solo',
    specs: { dossiers: '50 dossiers', users: '3 utilisateurs', support: 'Support prioritaire' },
    features: {
      messagerie: 'yes',
      'resume-ia': 'yes',
      'redaction-ia': 'yes',
      'ia-avancee': 'no',
      modeles: 'yes',
      recurrents: 'yes',
    },
  },
  {
    id: 'cabinet-pro',
    audience: "Cabinet d'avocat",
    name: 'Cabinet Pro',
    description: 'Pour les cabinets multi-avocats avec statistiques avancées et workflows.',
    priceMonthly: 149,
    badge: { label: 'Recommandé', tone: 'recommended' },
    variant: 'dark',
    ctaLabel: 'Essai gratuit 14 jours',
    ctaHref: '/contact?plan=cabinet-pro',
    specs: { dossiers: 'Dossiers illimités', users: '15 utilisateurs', support: 'Support dédié' },
    features: {
      messagerie: 'yes',
      'resume-ia': 'yes',
      'redaction-ia': 'yes',
      'ia-avancee': 'yes',
      modeles: 'yes',
      recurrents: 'yes',
    },
  },
  {
    id: 'cabinet-premium',
    audience: "Cabinet d'avocat",
    name: 'Cabinet Premium',
    description: 'Solution entreprise : marque blanche, API, SSO, audit avancé et accompagnement dédié.',
    priceMonthly: 299,
    variant: 'light',
    ctaLabel: 'Essai gratuit 14 jours',
    ctaHref: '/contact?plan=cabinet-premium',
    specs: {
      dossiers: 'Dossiers illimités',
      users: 'Utilisateurs illimités',
      support: 'Support entreprise',
    },
    features: {
      messagerie: 'yes',
      'resume-ia': 'yes',
      'redaction-ia': 'yes',
      'ia-avancee': 'yes',
      modeles: 'yes',
      recurrents: 'yes',
    },
  },
];

export const TRUST_PILLARS: { id: string; title: string; body: string }[] = [
  {
    id: 'donnees-chiffrees',
    title: 'Données chiffrées',
    body: 'Chiffrement de bout en bout, hébergement exclusivement UE.',
  },
  {
    id: 'ia-supervisee',
    title: 'IA supervisée',
    body: 'Chaque analyse IA est validée par un avocat habilité avant transmission.',
  },
  {
    id: 'sans-engagement',
    title: 'Sans engagement',
    body: 'Résiliez à tout moment. Vos données restent exportables.',
  },
];

/** Remise appliquée quand le client choisit la facturation annuelle. */
export const YEARLY_DISCOUNT = 0.1;

/** Équivalent mensuel d'un plan facturé à l'année (mensuel − 10 %). */
export function yearlyMonthlyEquivalent(priceMonthly: number): number {
  return priceMonthly * (1 - YEARLY_DISCOUNT);
}

/** Total facturé en une fois pour un an (12 × mensuel − 10 %). */
export function yearlyTotal(priceMonthly: number): number {
  return priceMonthly * 12 * (1 - YEARLY_DISCOUNT);
}

export function formatEuro(amount: number): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
