export type FeatureStatus = "yes" | "no" | "limited";

export type PlanBadge = {
  label: string;
  tone: "gratuit" | "popular" | "recommended";
};

export type Plan = {
  id: string;
  audience: string;
  name: string;
  description: string;
  priceMonthly: number | null;
  badge?: PlanBadge;
  variant: "light" | "dark";
  ctaLabel: string;
  ctaHref: string;
  /** Payment Link annuel (total année −10 %) — utilisé quand la facturation annuelle est sélectionnée. */
  ctaHrefYearly?: string;
  specs: { dossiers: string; users: string; support: string };
  features: Record<string, FeatureStatus>;
};

export const COMPARISON_FEATURES: { id: string; label: string }[] = [
  { id: "messagerie", label: "Transmission par e-mail ou WhatsApp" },
  { id: "calendrier", label: "Échéances affichées sur le dossier" },
  { id: "resume-ia", label: "Récapitulatif du dossier" },
  { id: "redaction-ia", label: "Suivi par étapes métier" },
  { id: "reponse-auto", label: "Dépôt de pièces sécurisé" },
  { id: "ia-avancee", label: "Espace privé multi-dossiers" },
  { id: "modeles", label: "Pièces téléchargeables" },
  { id: "recurrents", label: "Plusieurs dossiers en parallèle" },
];

export const plans: Plan[] = [
  {
    id: "essentiel",
    audience: "Indépendant / EI",
    name: "Essentiel",
    description:
      "Pour les indépendants et entrepreneurs individuels qui structurent leurs premiers dossiers.",
    priceMonthly: 19,
    variant: "light",
    ctaLabel: "S'abonner",
    ctaHref: "https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605",
    ctaHrefYearly: "https://buy.stripe.com/dRm9ATbYu6bF9PvfWmbV60b",
    specs: {
      dossiers: "5 dossiers",
      users: "1 utilisateur",
      support: "Support email",
    },
    features: {
      messagerie: "yes",
      calendrier: "limited",
      "resume-ia": "limited",
      "redaction-ia": "no",
      "reponse-auto": "no",
      "ia-avancee": "no",
      modeles: "no",
      recurrents: "no",
    },
  },
  {
    id: "entrepreneur",
    audience: "Entrepreneur / prof. libérale",
    name: "Entrepreneur",
    description:
      "Pour les entrepreneurs et professions libérales avec un flux régulier de dossiers.",
    priceMonthly: 39,
    variant: "light",
    ctaLabel: "S'abonner",
    ctaHref: "https://buy.stripe.com/8x214n1jQ2Zt9Pvh0qbV606",
    ctaHrefYearly: "https://buy.stripe.com/28EeVd9QmgQj7HndOebV60c",
    specs: {
      dossiers: "10 dossiers",
      users: "2 utilisateurs",
      support: "Support email prioritaire",
    },
    features: {
      messagerie: "yes",
      calendrier: "yes",
      "resume-ia": "yes",
      "redaction-ia": "limited",
      "reponse-auto": "no",
      "ia-avancee": "no",
      modeles: "yes",
      recurrents: "no",
    },
  },
  {
    id: "business-pme-20",
    audience: "TPE / PME",
    name: "Business PME 20",
    description:
      "Pour les TPE/PME avec plusieurs dossiers récurrents et une petite équipe.",
    priceMonthly: 49,
    badge: { label: "Populaire", tone: "popular" },
    variant: "dark",
    ctaLabel: "S'abonner",
    ctaHref: "https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607",
    ctaHrefYearly: "https://buy.stripe.com/14AbJ18MicA3e5L11sbV60d",
    specs: {
      dossiers: "20 dossiers",
      users: "5 utilisateurs",
      support: "Support prioritaire",
    },
    features: {
      messagerie: "yes",
      calendrier: "yes",
      "resume-ia": "yes",
      "redaction-ia": "yes",
      "reponse-auto": "limited",
      "ia-avancee": "no",
      modeles: "yes",
      recurrents: "yes",
    },
  },
  {
    id: "business-pme-50",
    audience: "PME",
    name: "Business PME 50",
    description: "Pour les PME qui gèrent de nombreux dossiers en parallèle.",
    priceMonthly: 89,
    variant: "light",
    ctaLabel: "S'abonner",
    ctaHref: "https://buy.stripe.com/28E4gz8Mi9nRaTz25wbV608",
    ctaHrefYearly: "https://buy.stripe.com/6oU00j5A69nR3r7bG6bV60e",
    specs: {
      dossiers: "50 dossiers",
      users: "5 utilisateurs",
      support: "Support prioritaire",
    },
    features: {
      messagerie: "yes",
      calendrier: "yes",
      "resume-ia": "yes",
      "redaction-ia": "yes",
      "reponse-auto": "yes",
      "ia-avancee": "no",
      modeles: "yes",
      recurrents: "yes",
    },
  },
  {
    id: "business-pme-pro",
    audience: "PME / multi-sites",
    name: "Business / PME Pro",
    description:
      "Pour les structures multi-collaborateurs : dossiers illimités et support dédié.",
    priceMonthly: 169,
    badge: { label: "Recommandé", tone: "recommended" },
    variant: "dark",
    ctaLabel: "S'abonner",
    ctaHref: "https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609",
    ctaHrefYearly: "https://buy.stripe.com/cNifZh9Qm8jNe5L39AbV60f",
    specs: {
      dossiers: "Dossiers illimités",
      users: "15 utilisateurs",
      support: "Support dédié",
    },
    features: {
      messagerie: "yes",
      calendrier: "yes",
      "resume-ia": "yes",
      "redaction-ia": "yes",
      "reponse-auto": "yes",
      "ia-avancee": "yes",
      modeles: "yes",
      recurrents: "yes",
    },
  },
  {
    id: "business-pme-premium",
    audience: "Entreprise",
    name: "Business / PME Premium",
    description:
      "Pour les entreprises : dossiers et utilisateurs illimités, support entreprise.",
    priceMonthly: 299,
    variant: "light",
    ctaLabel: "S'abonner",
    ctaHref: "https://buy.stripe.com/9B628raUq8jNgdT8tUbV60a",
    ctaHrefYearly: "https://buy.stripe.com/28EeVdaUq7fJd1H11sbV60g",
    specs: {
      dossiers: "Dossiers illimités",
      users: "Utilisateurs illimités",
      support: "Support entreprise",
    },
    features: {
      messagerie: "yes",
      calendrier: "yes",
      "resume-ia": "yes",
      "redaction-ia": "yes",
      "reponse-auto": "yes",
      "ia-avancee": "yes",
      modeles: "yes",
      recurrents: "yes",
    },
  },
  {
    id: "business-pme-sur-mesure",
    audience: "Grand compte",
    name: "Business / PME personnalisée",
    description:
      "Volumétrie, intégrations ou conformité spécifiques ? On construit une offre sur-mesure.",
    priceMonthly: null,
    variant: "dark",
    ctaLabel: "Demander un devis",
    ctaHref: "/contact?plan=sur-mesure",
    specs: {
      dossiers: "Dossiers illimités",
      users: "Utilisateurs illimités",
      support: "Accompagnement dédié",
    },
    features: {
      messagerie: "yes",
      calendrier: "yes",
      "resume-ia": "yes",
      "redaction-ia": "yes",
      "reponse-auto": "yes",
      "ia-avancee": "yes",
      modeles: "yes",
      recurrents: "yes",
    },
  },
];

export const TRUST_PILLARS: { id: string; title: string; body: string }[] = [
  {
    id: "donnees-chiffrees",
    title: "Données protégées",
    body: "Chiffrement en transit (HTTPS) et au repos côté hébergeur, pièces stockées dans un espace privé, accès par authentification.",
  },
  {
    id: "ia-supervisee",
    title: "Vous gardez la main",
    body: "Rien ne part sans votre validation : la transmission du dossier, par e-mail ou WhatsApp, est déclenchée par vous.",
  },
  {
    id: "sans-engagement",
    title: "Sans engagement",
    body: "Résiliez à tout moment. Accès, export et suppression de vos données sur demande.",
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
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: Number.isInteger(amount) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
