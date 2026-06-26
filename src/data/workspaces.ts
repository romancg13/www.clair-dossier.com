export type Workspace = {
  id: "client" | "avocat" | "cabinet";
  label: string;
  title: string;
  description: string;
  capabilities: string[];
  /** Données structurées pour le mockup SVG/JSX custom du workspace. */
  mockup: {
    kicker: string;
    title: string;
    rows: Array<{
      label: string;
      value: string;
      tone?: "normal" | "gold" | "navy";
    }>;
    footnote?: string;
  };
};

export const workspaces: Workspace[] = [
  {
    id: "client",
    label: "Vous",
    title: "Votre dossier, vos décisions.",
    description:
      "Vous construisez votre dossier à votre rythme. Vous voyez en permanence où il en est, qui agit, ce qui est attendu de vous.",
    capabilities: [
      "Création guidée en 5 étapes (profil, nature, informations, pièces, récapitulatif)",
      "Suivi de l'avancement sur les 5 étapes métier de votre dossier",
      "Transmission par e-mail ou WhatsApp, déclenchée par vous",
      "Récupération de vos pièces et données sur demande",
    ],
    mockup: {
      kicker: "Aperçu dossier",
      title: "Avancement du dossier",
      rows: [
        { label: "Étape", value: "Dépôt des pièces", tone: "gold" },
        { label: "Pièces déposées", value: "7 / 9" },
        { label: "Échéance", value: "affichée sur le dossier" },
        { label: "Transmission", value: "à votre validation", tone: "navy" },
        { label: "Stockage", value: "espace privé sécurisé" },
      ],
      footnote: "Rien n'est transmis sans votre validation explicite.",
    },
  },
  {
    id: "avocat",
    label: "Validation",
    title: "Une relecture côté support, quand c'est utile.",
    description:
      "Un administrateur unique peut, côté support, consulter votre dossier et les pièces déposées pour vous accompagner. Vous gardez la main : rien n'est transmis hors de votre espace sans votre accord.",
    capabilities: [
      "Consultation du dossier et des pièces par l'administrateur support",
      "Vue d'ensemble des 5 étapes et des échéances du dossier",
      "Accès limité à l'administrateur unique, isolé des autres comptes",
      "Pièces accessibles via des liens privés à durée limitée",
    ],
    mockup: {
      kicker: "Support · Relecture du dossier",
      title: "Aperçu du dossier",
      rows: [
        { label: "Profil", value: "Indépendant" },
        { label: "Nature", value: "renseignée à la création", tone: "navy" },
        { label: "Pièces", value: "déposées dans l'espace privé" },
        { label: "Étape en cours", value: "Récapitulatif" },
        { label: "Accès", value: "administrateur unique", tone: "gold" },
      ],
      footnote: "Accès support réservé à un administrateur unique.",
    },
  },
  {
    id: "cabinet",
    label: "Entreprise",
    title: "Tous vos dossiers, au même endroit.",
    description:
      "Artisan, indépendant, profession libérale ou PME : retrouvez la liste de vos dossiers et l'avancement de chacun depuis un seul espace. Chaque compte ne voit que ses propres dossiers.",
    capabilities: [
      "Liste de tous vos dossiers avec leur étape en cours",
      "Page détail « Avancement du dossier » pour chaque dossier",
      "Données isolées par compte : vous ne voyez que les vôtres",
      "Transmission par e-mail ou WhatsApp, dossier par dossier",
    ],
    mockup: {
      kicker: "Vos dossiers · vue d'ensemble",
      title: "Liste des dossiers",
      rows: [
        { label: "Dossiers du compte", value: "tous regroupés", tone: "navy" },
        { label: "Avancement", value: "étape affichée par dossier" },
        { label: "Pièces", value: "téléchargeables par dossier", tone: "gold" },
        { label: "Échéances", value: "affichées sur chaque dossier" },
        { label: "Visibilité", value: "limitée à votre compte" },
      ],
      footnote:
        "Chaque compte est isolé : aucun accès croisé entre utilisateurs.",
    },
  },
];
