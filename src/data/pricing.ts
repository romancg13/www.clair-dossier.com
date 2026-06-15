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
  { id: 'calendrier', label: 'Calendrier & relances à échéance' },
  { id: 'resume-ia', label: 'Résumé IA' },
  { id: 'redaction-ia', label: 'Rédaction IA (projet de réponse)' },
  { id: 'reponse-auto', label: 'Réponse automatisée aux e-mails' },
  { id: 'ia-avancee', label: 'IA avancée (GPT-5.5)' },
  { id: 'modeles', label: 'Modèles de documents' },
  { id: 'recurrents', label: 'Dossiers récurrents' },
];

export const plans: Plan[] = [
  {
    id: 'essentiel',
    audience: 'Indépendant / EI',
    name: 'Essentiel',
    description:
      'Pour les indépendants et entrepreneurs individuels qui structurent leurs premiers dossiers.',
    priceMonthly: 19,
    variant: 'light',
    ctaLabel: "S'abonner",
    ctaHref: 'https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605',
    specs: { dossiers: '5 dossiers', users: '1 utilisateur', support: 'Support email' },
    features: {
      messagerie: 'yes',
      calendrier: 'limited',
      'resume-ia': 'limited',
      'redaction-ia': 'no',
      'reponse-auto': 'no',
      'ia-avancee': 'no',
      modeles: 'no',
      recurrents: 'no',
    },
  },
  {
    id: 'entrepreneur',
    audience: 'Entrepreneur / prof. libérale',
    name: 'Entrepreneur',
    description:
      'Pour les entrepreneurs et professions libérales avec un flux régulier de dossiers.',
    priceMonthly: 39,
    variant: 'light',
    ctaLabel: "S'abonner",
    ctaHref: 'https://buy.stripe.com/8x214n1jQ2Zt9Pvh0qbV606',
    specs: { dossiers: '10 dossiers', users: '2 utilisateurs', support: 'Support email prioritaire' },
    features: {
      messagerie: 'yes',
      calendrier: 'yes',
      'resume-ia': 'yes',
      'redaction-ia': 'limited',
      'reponse-auto': 'no',
      'ia-avancee': 'no',
      modeles: 'yes',
      recurrents: 'no',
    },
  },
  {
    id: 'business-pme-20',
    audience: 'TPE / PME',
    name: 'Business PME 20',
    description: 'Pour les TPE/PME avec plusieurs dossiers récurrents et une petite équipe.',
    priceMonthly: 49,
    badge: { label: 'Populaire', tone: 'popular' },
    variant: 'dark',
    ctaLabel: "S'abonner",
    ctaHref: 'https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607',
    specs: { dossiers: '20 dossiers', users: '5 utilisateurs', support: 'Support prioritaire' },
    features: {
      messagerie: 'yes',
      calendrier: 'yes',
      'resume-ia': 'yes',
      'redaction-ia': 'yes',
      'reponse-auto': 'limited',
      'ia-avancee': 'no',
      modeles: 'yes',
      recurrents: 'yes',
    },
  },
  {
    id: 'business-pme-50',
    audience: 'PME',
    name: 'Business PME 50',
    description: 'Pour les PME qui gèrent de nombreux dossiers en parallèle.',
    priceMonthly: 89,
    variant: 'light',
    ctaLabel: "S'abonner",
    ctaHref: 'https://buy.stripe.com/28E4gz8Mi9nRaTz25wbV608',
    specs: { dossiers: '50 dossiers', users: '5 utilisateurs', support: 'Support prioritaire' },
    features: {
      messagerie: 'yes',
      calendrier: 'yes',
      'resume-ia': 'yes',
      'redaction-ia': 'yes',
      'reponse-auto': 'yes',
      'ia-avancee': 'no',
      modeles: 'yes',
      recurrents: 'yes',
    },
  },
  {
    id: 'business-pme-pro',
    audience: 'PME / multi-sites',
    name: 'Business / PME Pro',
    description:
      'Pour les structures multi-collaborateurs avec statistiques et workflows avancés.',
    priceMonthly: 169,
    badge: { label: 'Recommandé', tone: 'recommended' },
    variant: 'dark',
    ctaLabel: "S'abonner",
    ctaHref: 'https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609',
    specs: { dossiers: 'Dossiers illimités', users: '15 utilisateurs', support: 'Support dédié' },
    features: {
      messagerie: 'yes',
      calendrier: 'yes',
      'resume-ia': 'yes',
      'redaction-ia': 'yes',
      'reponse-auto': 'yes',
      'ia-avancee': 'yes',
      modeles: 'yes',
      recurrents: 'yes',
    },
  },
  {
    id: 'business-pme-premium',
    audience: 'Entreprise',
    name: 'Business / PME Premium',
    description: 'Solution entreprise : marque blanche, API, SSO, audit avancé.',
    priceMonthly: 299,
    variant: 'light',
    ctaLabel: "S'abonner",
    ctaHref: 'https://buy.stripe.com/9B628raUq8jNgdT8tUbV60a',
    specs: {
      dossiers: 'Dossiers illimités',
      users: 'Utilisateurs illimités',
      support: 'Support entreprise',
    },
    features: {
      messagerie: 'yes',
      calendrier: 'yes',
      'resume-ia': 'yes',
      'redaction-ia': 'yes',
      'reponse-auto': 'yes',
      'ia-avancee': 'yes',
      modeles: 'yes',
      recurrents: 'yes',
    },
  },
  {
    id: 'business-pme-sur-mesure',
    audience: 'Grand compte',
    name: 'Business / PME personnalisée',
    description:
      'Volumétrie, intégrations ou conformité spécifiques ? On construit une offre sur-mesure.',
    priceMonthly: null,
    variant: 'dark',
    ctaLabel: 'Demander un devis',
    ctaHref: '/contact?plan=sur-mesure',
    specs: {
      dossiers: 'Dossiers illimités',
      users: 'Utilisateurs illimités',
      support: 'Accompagnement dédié',
    },
    features: {
      messagerie: 'yes',
      calendrier: 'yes',
      'resume-ia': 'yes',
      'redaction-ia': 'yes',
      'reponse-auto': 'yes',
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
    body: 'Chaque analyse IA peut être validée par un professionnel du droit, en option, avant transmission.',
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
