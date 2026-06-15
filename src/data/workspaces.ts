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
    label: 'Vous',
    title: 'Votre dossier, vos décisions.',
    description:
      "Vous construisez votre dossier à votre rythme. Vous voyez en permanence où il en est, qui agit, ce qui est attendu de vous.",
    capabilities: [
      "Création guidée par typologie (prud'hommes, bail, recouvrement…)",
      "Suivi en temps réel des 6 statuts de votre dossier",
      'Messagerie sécurisée avec votre interlocuteur',
      "Export ZIP intégral à tout moment, sans condition",
    ],
    mockup: {
      kicker: 'Aperçu dossier',
      title: "Prud'homal — synthèse",
      rows: [
        { label: 'Statut', value: 'Validation pro (option)', tone: 'gold' },
        { label: 'Pièces déposées', value: '7 / 9' },
        { label: 'Chronologie', value: '4 évènements datés' },
        { label: 'Validation', value: 'Sous 24 h ouvrées', tone: 'navy' },
        { label: 'Dernier message', value: 'il y a 2 h' },
      ],
      footnote: 'Notification dès qu\'une action est requise.',
    },
  },
  {
    id: 'avocat',
    label: 'Validation',
    title: 'Un préavis juridique, quand vous le décidez.',
    description:
      "En option, un professionnel du droit établit un préavis juridique et valide le résumé de votre situation : brief IA préparatoire, chronologie reconstruite, pièces indexées.",
    capabilities: [
      "Brief IA préparatoire avant chaque consultation",
      "Validation en un clic, demande de pièce ou refus motivé",
      "Notes internes (privées) vs notes partagées (visibles client)",
      "Signature électronique horodatée jointe à chaque validation",
    ],
    mockup: {
      kicker: 'Brief · Préparation consultation',
      title: 'Aperçu dossier prud\'homal',
      rows: [
        { label: 'Points de droit', value: 'L1232-1 · L1232-6 CT' },
        { label: 'Jurisprudence', value: 'Cass. soc. arrêt récent', tone: 'navy' },
        { label: 'Incohérences', value: '1 datation à clarifier' },
        { label: 'Pièces à vérifier', value: 'Mise en demeure' },
        { label: 'Durée estimée', value: '25 minutes', tone: 'gold' },
      ],
      footnote: 'Brief généré par IA. Validation professionnelle requise.',
    },
  },
  {
    id: 'cabinet',
    label: 'Entreprise',
    title: 'Une vue d\'ensemble qui ne ment pas.',
    description:
      "Tous les dossiers de votre équipe, tous les statuts, toutes les charges. La direction de l'entreprise sait ce qui se passe — sans demander.",
    capabilities: [
      "Tableau de bord équipe avec attribution des dossiers",
      "Suivi de la charge par collaborateur",
      "Notes internes partagées entre membres habilités",
      "Reporting mensuel automatique (PDF, CSV)",
    ],
    mockup: {
      kicker: 'Vue entreprise · semaine type',
      title: 'Tableau de bord équipe',
      rows: [
        { label: 'Dossiers actifs', value: '47', tone: 'navy' },
        { label: 'En attente validation', value: '6' },
        { label: 'Validés cette semaine', value: '12', tone: 'gold' },
        { label: 'Charge par membre', value: '5,2 dossiers/sem.' },
        { label: 'Délai moyen validation', value: '38 heures' },
      ],
      footnote: 'Rapport hebdomadaire envoyé chaque lundi à 8h.',
    },
  },
];
