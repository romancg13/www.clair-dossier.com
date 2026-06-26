export type CaseStatus = {
  id: string;
  label: string;
  short: string;
  description: string;
  who: "client" | "avocat" | "plateforme";
  next?: string;
};

export const statuses: CaseStatus[] = [
  {
    id: "brouillon",
    label: "Brouillon",
    short: "Brouillon",
    description:
      "Vous construisez votre dossier dans le tunnel en 5 étapes : profil, nature, informations, dépôt des pièces, récapitulatif. Le nom du dossier est obligatoire. Rien n'est transmis tant que vous ne l'avez pas décidé.",
    who: "client",
    next: "complete",
  },
  {
    id: "complete",
    label: "Complété",
    short: "Complété",
    description:
      "Vous avez renseigné les informations et déposé vos pièces dans l'espace privé sécurisé. Le récapitulatif vous montre le dossier avant toute transmission.",
    who: "client",
    next: "attente-avocat",
  },
  {
    id: "attente-avocat",
    label: "Transmis",
    short: "Transmis",
    description:
      "Vous transmettez le dossier par e-mail ou WhatsApp, à votre initiative. Aucun envoi automatique : rien ne part sans votre validation explicite.",
    who: "client",
    next: "validation",
  },
  {
    id: "validation",
    label: "En cours",
    short: "En cours",
    description:
      "Le dossier suit son avancement sur les 5 étapes métier, cliquables depuis la page détail. Les pièces restent téléchargeables et les échéances affichées.",
    who: "plateforme",
    next: "valide",
  },
  {
    id: "valide",
    label: "Validé",
    short: "Validé",
    description:
      "Le dossier est complet et structuré, prêt à être partagé ou suivi dans la durée. Les pièces sont réunies dans un espace privé, accessibles via des liens signés temporaires.",
    who: "plateforme",
    next: "archive",
  },
  {
    id: "archive",
    label: "Archivé",
    short: "Archivé",
    description:
      "L'affaire est close. Vos données restent isolées par compte et conservées selon les délais légaux. Vous pouvez en demander l'accès ou l'export via le contact.",
    who: "plateforme",
  },
];
