export type Workspace = {
  id: 'client' | 'avocat' | 'cabinet';
  label: string;
  title: string;
  description: string;
  capabilities: string[];
  /** Données structurées pour le mockup SVG/JSX custom du workspace. */
  mockup: {
    kicker: string;
    title: string;
    rows: Array<{ label: string; value: string; tone?: 'normal' | 'gold' | 'navy' }>;
    footnote?: string;
  };
};

export const workspaces: Workspace[] = [
  {
    id: 'client',
    label: 'Client',
    title: 'Votre dossier, vos décisions.',
    description:
      "Vous construisez votre dossier à votre rythme. Vous voyez en permanence où il en est, qui agit, ce qui est attendu de vous.",
    capabilities: [
      "Création guidée par typologie (prud'hommes, bail, recouvrement…)",
      "Suivi en temps réel des 6 statuts de votre dossier",
      "Messagerie sécurisée avec l'avocat assigné",
      "Export ZIP intégral à tout moment, sans condition",
    ],
    mockup: {
      kicker: 'Dossier · #CD-2026-0421',
      title: "Prud'homal — synthèse",
      rows: [
        { label: 'Statut', value: 'En attente validation avocat', tone: 'gold' },
        { label: 'Pièces déposées', value: '7 / 9' },
        { label: 'Chronologie', value: '4 évènements datés' },
        { label: 'Avocat assigné', value: 'Me Vasseur-Dupré', tone: 'navy' },
        { label: 'Dernier message', value: 'il y a 2 h' },
      ],
      footnote: 'Notification dès qu\'une action est requise.',
    },
  },
  {
    id: 'avocat',
    label: 'Avocat',
    title: "Les dossiers arrivent prêts. Vous gardez l'analyse pour vous.",
    description:
      "Brief IA préparatoire, chronologie reconstruite, pièces indexées. Vous arrivez en consultation avec dix minutes de gain — par dossier.",
    capabilities: [
      "Brief IA préparatoire avant chaque consultation",
      "Validation en un clic, demande de pièce ou refus motivé",
      "Notes internes (privées) vs notes partagées (visibles client)",
      "Signature électronique horodatée jointe à chaque validation",
    ],
    mockup: {
      kicker: 'Brief · Préparation consultation',
      title: 'Dossier prud\'homal C. Bertrand',
      rows: [
        { label: 'Points de droit', value: 'L1232-1 · L1232-6 CT' },
        { label: 'Jurisprudence', value: 'Cass. soc. 2023, n° 21-19.456', tone: 'navy' },
        { label: 'Incohérences', value: '1 datation à clarifier' },
        { label: 'Pièces à vérifier', value: 'Mise en demeure 03/2024' },
        { label: 'Durée estimée', value: '25 minutes', tone: 'gold' },
      ],
      footnote: 'Brief généré par IA. Validation professionnelle requise.',
    },
  },
  {
    id: 'cabinet',
    label: 'Cabinet',
    title: 'Une vue d\'ensemble qui ne ment pas.',
    description:
      "Tous les dossiers de votre équipe, tous les statuts, toutes les charges. La direction du cabinet sait ce qui se passe — sans demander.",
    capabilities: [
      "Tableau de bord équipe avec attribution des dossiers",
      "Suivi de la charge par collaborateur",
      "Notes internes partagées entre membres habilités",
      "Reporting mensuel automatique (PDF, CSV)",
    ],
    mockup: {
      kicker: 'Cabinet · Marais & Associés',
      title: 'Vue équipe — semaine du 18 mai',
      rows: [
        { label: 'Dossiers actifs', value: '47', tone: 'navy' },
        { label: 'En attente validation', value: '6' },
        { label: 'Validés cette semaine', value: '12', tone: 'gold' },
        { label: 'Charge par avocat', value: '5,2 dossiers/sem.' },
        { label: 'Délai moyen validation', value: '38 heures' },
      ],
      footnote: 'Rapport hebdomadaire envoyé chaque lundi à 8h.',
    },
  },
];
