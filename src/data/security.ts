import type { SecurityIconKey } from "../components/icons";

/**
 * Engagements sécurité et données — source de vérité unique, partagée entre la
 * page /securite (src/pages/Security.tsx) et le miroir markdown public/securite.md
 * (scripts/gen-markdown.ts). Chaque énoncé décrit uniquement ce qui est en place
 * (invariant I10 : aucune fonctionnalité de roadmap présentée comme disponible).
 */
export type SecurityPillar = {
  icon: SecurityIconKey;
  title: string;
  body: string;
  bullets: string[];
};

export const SECURITY_PILLARS: SecurityPillar[] = [
  {
    icon: "hosting-france",
    title: "Hébergement",
    body: "L'application est hébergée chez un sous-traitant conforme au RGPD. Les données sont chiffrées en transit (HTTPS) et au repos côté hébergeur. Vous gardez la main : aucune pièce n'est transmise à un tiers sans votre validation explicite.",
    bullets: [
      "Sous-traitant hébergeur conforme RGPD",
      "Chiffrement en transit (HTTPS)",
      "Chiffrement au repos côté hébergeur",
    ],
  },
  {
    icon: "encryption",
    title: "Chiffrement",
    body: "Tous les échanges entre votre navigateur et l'application passent par une connexion chiffrée (HTTPS). Les pièces déposées sont conservées dans un stockage privé, chiffré au repos côté hébergeur. Les liens de téléchargement sont signés et temporaires.",
    bullets: [
      "Connexion chiffrée HTTPS de bout en bout",
      "Stockage des pièces chiffré au repos",
      "Liens de téléchargement signés et temporaires",
    ],
  },
  {
    icon: "rgpd",
    title: "Accès",
    body: "L'accès à votre espace passe par une authentification (compte avec confirmation par e-mail). Vos données sont isolées par utilisateur : un client ne voit jamais les dossiers d'un autre. Seul un administrateur unique peut consulter les dossiers côté support.",
    bullets: [
      "Accès protégé par authentification",
      "Isolation des données par utilisateur",
      "Consultation support limitée à un seul admin",
    ],
  },
  {
    icon: "compliance-rin",
    title: "Conformité",
    body: "Le service est conçu pour respecter le RGPD (UE 2016/679). Vos données restent les vôtres : vous pouvez exercer vos droits d'accès, d'export et de suppression sur simple demande via le contact ou votre espace. L'hébergeur intervient comme sous-traitant conforme au RGPD.",
    bullets: [
      "Conçu pour le RGPD (UE 2016/679)",
      "Droits d'accès, export et suppression sur demande",
      "Hébergeur sous-traitant conforme RGPD",
    ],
  },
  {
    icon: "backup",
    title: "Vos pièces",
    body: "Chaque dossier rassemble vos pièces dans un espace privé et sécurisé. Vous les retrouvez à tout moment depuis la liste de vos dossiers et la page d'avancement, où elles restent téléchargeables. Rien n'est partagé tant que vous ne déclenchez pas la transmission.",
    bullets: [
      "Espace privé et sécurisé par dossier",
      "Pièces téléchargeables depuis votre espace",
      "Transmission déclenchée par vous seul",
    ],
  },
  {
    icon: "audit",
    title: "Maîtrise & contact",
    body: "Vous décidez de chaque envoi : la transmission d'un dossier par e-mail ou WhatsApp ne part qu'après votre validation explicite. Pour toute question de sécurité ou demande relative à vos données, une adresse de contact dédiée vous répond.",
    bullets: [
      "Aucune transmission sans votre validation",
      "Envoi par e-mail ou WhatsApp à votre main",
      "Contact dédié pour vos demandes données",
    ],
  },
];

/** Schéma d'architecture simplifié affiché sur /securite et dans securite.md. */
export const SECURITY_ARCHITECTURE = [
  { kicker: "1", label: "Client", detail: "Navigateur · App" },
  { kicker: "2", label: "HTTPS", detail: "Connexion chiffrée" },
  { kicker: "3", label: "Authentification", detail: "Compte confirmé" },
  { kicker: "4", label: "Application", detail: "Isolation par utilisateur" },
  { kicker: "5", label: "Stockage privé", detail: "Pièces chiffrées au repos" },
];

/** Badges « Nos engagements en clair » (aucune certification revendiquée). */
export const SECURITY_BADGES = [
  { label: "RGPD", status: "Conçu pour" },
  { label: "Chiffrement", status: "Transit & repos" },
  { label: "Isolation", status: "Par utilisateur" },
  { label: "Vos droits", status: "Sur demande" },
];
