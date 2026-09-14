/**
 * Parcours métier (Vague 1 — 5.1) : cabinets d'avocats, experts-comptables,
 * grands comptes.
 *
 * Règle de contenu ABSOLUE : preuves vérifiables uniquement — chaque preuve
 * cite l'endroit où elle se vérifie (code, CGV, page publique). Aucun logo
 * client, aucun témoignage, aucun chiffre de performance. Un seul appel à
 * l'action : la démonstration (/rendez-vous), jamais « s'abonner ».
 */

export type SegmentProof = {
  title: string;
  body: string;
  /** Où la preuve se vérifie (affiché — c'est l'argument). */
  verification: string;
};

export type SegmentPageData = {
  slug: string;
  /** Segment transmis au parcours de qualification (lib/prospects). */
  segmentId: 'cabinet-avocats' | 'expert-comptable' | 'grand-compte';
  navLabel: string;
  surtitre: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  promesse: string;
  frictions: Array<{ title: string; body: string }>;
  proofs: SegmentProof[];
};

/** Preuves communes — toutes vérifiables dans le code ou les documents publics. */
const PROOF_ISOLATION: SegmentProof = {
  title: 'Cloisonnement par compte, appliqué par la base',
  body:
    "Chaque dossier et chaque pièce sont rattachés à un compte, et l'isolation est appliquée au niveau de la base de données (Row Level Security) — pas seulement dans l'interface. Un compte ne peut pas lire les données d'un autre.",
  verification: 'Vérifiable : migrations SQL publiées dans le dépôt (policies « _own » sur dossiers, documents, stockage).',
};

const PROOF_VALIDATION: SegmentProof = {
  title: 'Validation humaine : rien ne part tout seul',
  body:
    "La transmission d'un dossier est toujours déclenchée explicitement par son propriétaire, par e-mail ou WhatsApp. Aucun envoi automatique, aucune décision produite sans action humaine.",
  verification: 'Vérifiable : fonctionnalité « Transmission validée par vous » (/fonctionnalites/transmission-validee).',
};

const PROOF_NO_AI_READING: SegmentProof = {
  title: 'Aucune lecture automatique de vos pièces',
  body:
    "Le service organise les dossiers à partir de ce que vous saisissez. Il ne procède à aucune lecture, extraction ou analyse automatique des documents déposés — c'est un engagement contractuel, pas un réglage.",
  verification: 'Vérifiable : CGV, article « Nature du service » (/cgv).',
};

const PROOF_STORAGE: SegmentProof = {
  title: 'Pièces dans un espace privé, accès par liens signés',
  body:
    "Les documents sont stockés dans un bucket privé, jamais exposés publiquement : l'accès passe par des liens temporaires signés, compte par compte.",
  verification: 'Vérifiable : /fonctionnalites/depot-de-pieces et politique de stockage (migrations du bucket documents).',
};

const PROOF_HONESTY: SegmentProof = {
  title: 'Un état du produit public, tenu à jour',
  body:
    "Ce qui est opérationnel, partiel ou prévu est publié tel quel, daté, et généré à partir de ce que le code fait réellement — pas de ce que le marketing voudrait.",
  verification: 'Vérifiable : /etat-du-produit.',
};

export const segmentPages: SegmentPageData[] = [
  {
    slug: 'cabinets-avocats',
    segmentId: 'cabinet-avocats',
    navLabel: "Cabinets d'avocats",
    surtitre: 'Parcours dédié · cabinets d’avocats',
    title: 'Des dossiers clients qui arrivent déjà structurés.',
    metaTitle: "Cabinets d'avocats",
    metaDescription:
      "ClairDossier pour les cabinets d'avocats : des dossiers clients constitués, datés et ordonnés avant le premier rendez-vous. Cloisonnement par compte, validation humaine, aucune lecture automatique des pièces.",
    promesse:
      "Le temps passé à réclamer des pièces, reconstituer une chronologie ou trier une boîte mail n'est pas du temps de droit. ClairDossier fait arriver le dossier constitué : pièces déposées, dates renseignées, récapitulatif relu — par le client, avant vous.",
    frictions: [
      {
        title: 'Des pièces éparpillées entre e-mails, SMS et papier',
        body:
          "Les pièces d'un même dossier arrivent par cinq canaux différents, en plusieurs fois, sans nommage. Chaque pièce manquante coûte un aller-retour.",
      },
      {
        title: 'Un premier rendez-vous consommé par la collecte',
        body:
          "La première heure sert trop souvent à comprendre ce qui existe, ce qui manque et dans quel ordre les faits se sont produits — pas à conseiller.",
      },
      {
        title: 'Le secret professionnel face aux outils grand public',
        body:
          "Faire transiter des pièces de dossier par des messageries personnelles ou des drives partagés crée un risque de confidentialité que le cabinet porte.",
      },
    ],
    proofs: [PROOF_ISOLATION, PROOF_NO_AI_READING, PROOF_VALIDATION, PROOF_STORAGE, PROOF_HONESTY],
  },
  {
    slug: 'experts-comptables',
    segmentId: 'expert-comptable',
    navLabel: 'Experts-comptables',
    surtitre: 'Parcours dédié · experts-comptables',
    title: 'Les justificatifs de vos clients, réunis et datés.',
    metaTitle: 'Experts-comptables',
    metaDescription:
      'ClairDossier pour les experts-comptables : chaque client constitue son dossier — justificatifs déposés dans un espace privé, échéances visibles, transmission quand le dossier est complet. Cloisonnement par compte.',
    promesse:
      "La relance de justificatifs est le travail le plus répétitif du cabinet. ClairDossier donne à chaque client un espace structuré où déposer ses pièces et renseigner ses échéances — et le dossier vous est transmis quand il est complet, pas pièce par pièce.",
    frictions: [
      {
        title: 'La chasse aux justificatifs, chaque mois',
        body:
          "Relancer, re-relancer, recevoir la moitié des pièces, dans trois formats : la collecte reste le premier goulot d'étranglement des cabinets.",
      },
      {
        title: 'Des échéances portées de tête',
        body:
          "Dates de dépôt, échéances fiscales et sociales par client : quand elles vivent dans des fichiers séparés, la charge mentale est permanente.",
      },
      {
        title: 'Des documents clients dans des canaux non maîtrisés',
        body:
          "Pièces reçues par e-mail personnel ou messagerie : le cabinet devient dépositaire de données qu'il n'a pas choisi d'héberger là.",
      },
    ],
    proofs: [PROOF_ISOLATION, PROOF_STORAGE, PROOF_VALIDATION, PROOF_NO_AI_READING, PROOF_HONESTY],
  },
  {
    slug: 'grands-comptes',
    segmentId: 'grand-compte',
    navLabel: 'Grands comptes',
    surtitre: 'Parcours dédié · structures à fort volume documentaire',
    title: 'Un cadre unique pour vos dossiers à fort volume.',
    metaTitle: 'Grands comptes',
    metaDescription:
      "ClairDossier pour les structures à fort volume documentaire : dossiers structurés par compte, cloisonnement appliqué en base, validation humaine systématique, état du produit public. Démonstration sur rendez-vous.",
    promesse:
      "À partir d'un certain volume, le sujet n'est plus l'outil mais le cadre : qui accède à quoi, ce qui est appliqué techniquement plutôt que promis, et ce que le produit fait réellement aujourd'hui. C'est exactement ce que nous montrons en démonstration — preuves à l'appui.",
    frictions: [
      {
        title: 'Des engagements commerciaux difficiles à vérifier',
        body:
          "Les plaquettes promettent ; vos équipes sécurité et achats veulent vérifier. Chaque affirmation invérifiable coûte un cycle de questions-réponses.",
      },
      {
        title: 'Le cloisonnement interne entre entités et services',
        body:
          "Plusieurs services, plusieurs périmètres : la séparation des accès doit être une propriété du système, pas une consigne d'usage.",
      },
      {
        title: "L'intégration au système d'information existant",
        body:
          "Un outil de plus n'est acceptable que s'il s'insère dans vos processus — exigences à cadrer en démonstration, sur vos cas réels.",
      },
    ],
    proofs: [PROOF_ISOLATION, PROOF_HONESTY, PROOF_VALIDATION, PROOF_NO_AI_READING, PROOF_STORAGE],
  },
];

export function getSegmentPage(slug: string | undefined): SegmentPageData | undefined {
  if (!slug) return undefined;
  return segmentPages.find((s) => s.slug === slug);
}
