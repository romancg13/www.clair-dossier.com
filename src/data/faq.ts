export type FaqEntry = {
  id: string;
  question: string;
  answer: string;
};

export const homeFaq: FaqEntry[] = [
  {
    id: "qui-valide",
    question: "Qui prépare les dossiers sur ClairDossier ?",
    answer:
      "C'est vous. ClairDossier vous guide pour constituer votre dossier en 5 étapes (profil, nature, informations, dépôt des pièces, récapitulatif) et le garder organisé. L'outil structure et conserve votre dossier dans un espace privé ; vous restez seul maître de son contenu et de ce que vous en faites.",
  },
  {
    id: "donnees-securisees",
    question: "Mes données sont-elles vraiment sécurisées ?",
    answer:
      "Vos échanges passent en HTTPS (chiffrement en transit) et vos données sont chiffrées au repos côté hébergeur. Vos pièces sont déposées dans un stockage privé, accessible uniquement après authentification, via des liens temporaires. Chaque compte est isolé des autres, et nos hébergeurs sous-traitants sont conformes au RGPD.",
  },
  {
    id: "obligation-avocat",
    question: "Suis-je obligé de passer par un tiers via ClairDossier ?",
    answer:
      "Non. ClairDossier vous sert à constituer et organiser votre dossier, puis à le transmettre quand vous le décidez — par e-mail ou WhatsApp — au destinataire de votre choix. Rien n'est envoyé sans votre validation explicite, et vous n'êtes obligé de passer par aucun intermédiaire imposé.",
  },
  {
    id: "compatible-cabinet",
    question: "Comment je récupère ou partage mes dossiers ?",
    answer:
      "Depuis la liste de vos dossiers, ouvrez la page détail « Avancement du dossier » : vous y consultez les 5 étapes, téléchargez chaque pièce et voyez les échéances. Quand vous le souhaitez, vous transmettez le dossier par e-mail ou WhatsApp au destinataire de votre choix, après votre validation.",
  },
  {
    id: "refus-avocat",
    question: "Comment je suis l'avancement de mon dossier ?",
    answer:
      "La page détail « Avancement du dossier » affiche 5 étapes métier cliquables. Vous y voyez où en est votre dossier, les pièces déjà déposées (téléchargeables) et les échéances à venir. Si une pièce manque, vous complétez le dossier directement depuis l'app, puis vous le transmettez quand il est prêt.",
  },
  {
    id: "tarification-cabinet",
    question: "La facturation est par utilisateur ou par dossier ?",
    answer:
      "Selon le plan. Les formules Essentiel à Business PME 50 incluent un nombre défini de dossiers et d'utilisateurs ; les plans Pro et Premium passent en dossiers illimités (15 utilisateurs, puis illimité). Vous montez en gamme quand votre volume augmente — jamais pénalisé à l'usage.",
  },
  {
    id: "export-possible",
    question: "Puis-je récupérer mes pièces et mon dossier ?",
    answer:
      "Oui. Depuis la page détail du dossier, chaque pièce déposée est téléchargeable. Vous pouvez aussi transmettre le dossier par e-mail ou WhatsApp, au moment où vous le décidez. Pour une copie complète de vos données personnelles, une demande d'export RGPD est possible via le contact (traitement sous 30 jours).",
  },
  {
    id: "rgpd-donnees",
    question: "Conformité RGPD : comment exercer mes droits sur mes données ?",
    answer:
      "Vos données sont chiffrées au repos chez notre hébergeur, conforme au RGPD, et chaque compte est isolé des autres. Vous gardez vos droits d'accès, d'export et de suppression : il suffit d'en faire la demande via le contact ou votre espace. Une demande est traitée dans un délai raisonnable, sous 30 jours.",
  },
];
