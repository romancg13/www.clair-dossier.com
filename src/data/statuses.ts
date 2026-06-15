export type CaseStatus = {
  id: string;
  label: string;
  short: string;
  description: string;
  who: 'client' | 'avocat' | 'plateforme';
  next?: string;
};

export const statuses: CaseStatus[] = [
  {
    id: 'brouillon',
    label: 'Brouillon',
    short: 'Brouillon',
    description: "Le client construit son dossier — il complète les informations, dépose les premières pièces. Aucune action côté professionnel.",
    who: 'client',
    next: 'complete',
  },
  {
    id: 'complete',
    label: 'Complété par client',
    short: 'Complété',
    description: "Le client estime que son dossier est prêt à être confié. ClairDossier vérifie l'exhaustivité des champs obligatoires avant de transmettre.",
    who: 'plateforme',
    next: 'attente-avocat',
  },
  {
    id: 'attente-avocat',
    label: 'En attente de validation',
    short: 'En attente',
    description: "Le dossier attend une validation par un professionnel du droit (option). Aucun délai n'est garanti à ce stade — le professionnel priorise selon sa charge.",
    who: 'avocat',
    next: 'validation',
  },
  {
    id: 'validation',
    label: 'Validation en cours',
    short: 'Validation',
    description: "Un professionnel du droit instruit le dossier : il lit les pièces, demande des précisions, prépare l'analyse juridique. Vous êtes notifié à chaque action.",
    who: 'avocat',
    next: 'valide',
  },
  {
    id: 'valide',
    label: 'Validé',
    short: 'Validé',
    description: "Le dossier porte la signature électronique d'un professionnel du droit habilité. Il peut être plaidé, négocié, transmis à une juridiction ou suivi dans la durée.",
    who: 'avocat',
    next: 'archive',
  },
  {
    id: 'archive',
    label: 'Archivé',
    short: 'Archivé',
    description: "L'affaire est close. Les données sont conservées selon les délais légaux de prescription. Le client peut exporter à tout moment.",
    who: 'plateforme',
  },
];
