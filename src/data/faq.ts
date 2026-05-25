export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
};

export const homeFaq: FaqEntry[] = [
  {
    id: 'qui-valide',
    question: "Qui valide juridiquement les dossiers sur ClairDossier ?",
    answer:
      "Un avocat habilité — inscrit au barreau, à jour de ses obligations déontologiques. ClairDossier n'est ni un cabinet, ni un conseil juridique : nous structurons le dossier, un professionnel le valide. La signature électronique de l'avocat est jointe à chaque décision, avec horodatage et numéro de toque.",
  },
  {
    id: 'donnees-securisees',
    question: "Mes données sont-elles vraiment sécurisées ?",
    answer:
      "Hébergement OVH France (Roubaix, Strasbourg). Chiffrement AES-256 au repos, TLS 1.3 en transit. Aucun transfert hors UE, ni pour les sauvegardes ni pour les sous-traitants. Audit de sécurité annuel par tiers indépendant — rapport consultable sur notre page Sécurité.",
  },
  {
    id: 'obligation-avocat',
    question: "Suis-je obligé de prendre un avocat via ClairDossier ?",
    answer:
      "Non. Vous pouvez constituer votre dossier, l'exporter en ZIP, et le transmettre à l'avocat de votre choix — ami de famille, conseil d'entreprise, avocat trouvé par recommandation. ClairDossier propose un réseau d'avocats partenaires si vous n'avez personne, mais nous n'imposons rien.",
  },
  {
    id: 'compatible-cabinet',
    question: "ClairDossier est-il compatible avec mon cabinet existant ?",
    answer:
      "Oui. Nous proposons une API d'intégration (plan Professionnel et Entreprise) pour synchroniser les dossiers ClairDossier avec votre outil de gestion existant — Septeo, Polyact, Cicéron, ou solution maison. L'onboarding sur site (plan Entreprise) couvre cette intégration.",
  },
  {
    id: 'refus-avocat',
    question: "Que se passe-t-il si l'avocat refuse de valider mon dossier ?",
    answer:
      "L'avocat doit motiver son refus. Vous recevez l'explication par message dans l'app et par email. Trois cas : le dossier est incomplet (vous le complétez), le dossier est hors champ de l'avocat (nous vous orientons vers un autre confrère), le dossier est juridiquement non recevable (vous êtes orienté vers une démarche alternative).",
  },
  {
    id: 'tarification-cabinet',
    question: "Cabinet : la facturation est par utilisateur ou par dossier ?",
    answer:
      "Par utilisateur, avec dossiers illimités. Le plan Professionnel inclut 5 utilisateurs ; le plan Entreprise est illimité. Cette tarification permet aux cabinets de ne pas être pénalisés sur la volumétrie — au contraire, plus le cabinet utilise ClairDossier, plus la valeur par utilisateur augmente.",
  },
  {
    id: 'export-possible',
    question: "Puis-je exporter mes dossiers (PDF, ZIP) ?",
    answer:
      "Oui, à tout moment, sans condition. L'export ZIP contient toutes les pièces, la chronologie en PDF, l'historique des messages et des statuts. Vous pouvez le déposer chez un autre professionnel, l'archiver localement, ou le transmettre à une juridiction.",
  },
  {
    id: 'rgpd-donnees',
    question: "Conformité RGPD : où sont stockées exactement mes données ?",
    answer:
      "Datacenters OVH situés à Roubaix (59) et Strasbourg (67). Sauvegardes redondantes sur ces deux sites, jamais hors de France. Sous-traitants tiers utilisés (mail transactionnel, monitoring) : tous européens, DPA consultables sur la page Sécurité. Vous pouvez exiger la suppression de votre compte à tout moment — anonymisation sous 30 jours.",
  },
];
