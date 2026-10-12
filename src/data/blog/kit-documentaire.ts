import type { BlogPostInput } from './types';

/**
 * Kit documentaire (version gratuite, acquisition) — listes de contrôle
 * d'ORGANISATION. Aucune règle de droit, aucune durée ni obligation légale
 * affirmée : rien à sourcer, rien à interpréter. Version complète (modèles
 * imprimables) : docs/produits/kit-documentaire/.
 */
export const kitDocumentaire: BlogPostInput = {
  slug: 'kit-documentaire-checklists',
  title: 'Kit documentaire : cinq listes de contrôle pour constituer un dossier complet',
  metaTitle: 'Kit documentaire — cinq checklists pour vos dossiers',
  metaDescription:
    "Facture impayée, dossier administratif, pièces comptables, dossier client, échéances : cinq listes de contrôle pour réunir les bonnes pièces sans rien oublier.",
  summary:
    "Un dossier incomplet coûte des allers-retours. Ces cinq listes de contrôle, à imprimer ou à suivre dans ClairDossier, aident à réunir les pièces courantes d'une situation. Ce sont des aide-mémoire d'organisation, pas des conseils juridiques.",
  author: 'redaction',
  date: '2026-10-12',
  reviewBy: '2027-04-12',
  category: 'Méthode',
  tags: ['checklist', 'organisation', 'dossier', 'kit'],
  illustration: 'checklist',
  content: [
    {
      type: 'p',
      text:
        "La plupart des retards dans un dossier ne viennent pas de sa difficulté, mais d'une pièce qui manque : le devis signé introuvable, la relance dont on ne retrouve plus la date, l'attestation expirée. Une liste de contrôle ne résout pas le fond du problème — elle évite simplement de le découvrir trop tard.",
    },
    {
      type: 'callout',
      tone: 'navy',
      text:
        "Ces listes sont des aide-mémoire d'organisation. Elles ne sont pas exhaustives et ne remplacent pas l'avis d'un professionnel (avocat, expert-comptable) sur votre situation.",
    },
    { type: 'h2', text: '1. Une facture impayée' },
    {
      type: 'list',
      items: [
        'La facture concernée : numéro, date, montant, échéance de paiement.',
        "Le devis signé, le bon de commande ou tout écrit qui montre l'accord du client.",
        "La preuve de l'exécution : bon de livraison, procès-verbal de réception, photos datées.",
        'Les échanges écrits avec le client : e-mails, courriers, messages.',
        "L'historique des relances : date, canal utilisé, réponse obtenue.",
        'Les coordonnées complètes du débiteur : nom ou raison sociale, numéro SIREN, adresse.',
        'Une chronologie datée de quelques lignes, du devis à aujourd’hui.',
      ],
    },
    { type: 'h2', text: "2. Le dossier administratif de l'entreprise" },
    {
      type: 'list',
      items: [
        "Le justificatif d'immatriculation à jour (extrait Kbis ou avis de situation, selon votre forme juridique).",
        'Les statuts à jour, pour une société.',
        "La pièce d'identité du dirigeant, en cours de validité.",
        "Les attestations d'assurance en cours, avec leur date de fin.",
        'Le RIB professionnel.',
        "Les attestations que vos clients ou donneurs d'ordre vous demandent régulièrement, avec leur date de validité.",
      ],
    },
    { type: 'h2', text: '3. Les pièces comptables du mois' },
    {
      type: 'list',
      items: [
        'Les factures de vente émises.',
        "Les factures d'achat et de frais reçues.",
        'Les relevés bancaires du mois.',
        'Les justificatifs des dépenses payées par carte ou en espèces.',
        'Les notes de frais, avec leurs justificatifs.',
        'La liste des factures clients restant à encaisser.',
      ],
    },
    { type: 'h2', text: '4. Un dossier client' },
    {
      type: 'list',
      items: [
        'Le devis ou la proposition acceptée, et les conditions générales communiquées.',
        'Les avenants et demandes de modification, datés.',
        'Les livrables remis, avec leur date de remise.',
        'Les factures émises et les paiements reçus.',
        'Les échanges importants : validations, réserves, réclamations.',
      ],
    },
    { type: 'h2', text: '5. Les échéances à ne pas manquer' },
    {
      type: 'p',
      text:
        "Une échéance oubliée coûte souvent plus cher qu'une pièce manquante. La méthode la plus simple : une seule liste, tenue à jour, relue chaque semaine.",
    },
    {
      type: 'list',
      items: [
        "Pour chaque échéance : la date, ce qu'il faut faire, la pièce concernée, qui s'en charge.",
        'Un rappel posé quelques jours avant la date, pas le jour même.',
        "Une relecture hebdomadaire de la liste, à heure fixe.",
        "Les attestations et assurances y figurent aussi, avec leur date d'expiration.",
      ],
    },
    { type: 'h2', text: 'Nommer et dater chaque pièce' },
    {
      type: 'p',
      text:
        "Une liste de contrôle n'est utile que si l'on retrouve les pièces qu'elle cite. Un nom de fichier qui commence par la date (année-mois-jour), suivi de la nature du document et du tiers concerné, suffit à trier un dossier dans l'ordre chronologique — la méthode est détaillée dans notre article sur l'organisation d'un dossier.",
    },
    { type: 'h2', text: 'Suivre ces listes dans ClairDossier' },
    {
      type: 'p',
      text:
        "Chaque situation ci-dessus correspond à une catégorie de dossier dans ClairDossier : impayé, dossier administratif, documents comptables, dossier client. Vous y déposez les pièces au fil de l'eau, l'échéance s'affiche sur le dossier, et la transmission reste toujours décidée et effectuée par vous. Le service ne lit pas vos documents : il les organise à partir de ce que vous saisissez.",
    },
  ],
  takeaways: [
    "La plupart des retards viennent d'une pièce manquante, pas de la difficulté du dossier.",
    'Cinq listes couvrent les situations courantes : impayé, administratif, comptabilité, dossier client, échéances.',
    'Dater et nommer chaque pièce rend la liste de contrôle réellement utile.',
    "Ces listes organisent ; elles ne remplacent pas l'avis d'un professionnel.",
  ],
  faq: [
    {
      q: 'Ces listes sont-elles exhaustives ?',
      a: "Non. Elles rassemblent les pièces les plus courantes de chaque situation. Votre activité, votre forme juridique ou la demande d'un professionnel peuvent en exiger d'autres.",
    },
    {
      q: 'Faut-il un compte ClairDossier pour les utiliser ?',
      a: "Non : elles s'utilisent aussi sur papier. ClairDossier permet de les suivre dossier par dossier, avec les pièces déposées dans un espace privé et l'échéance visible sur le dossier.",
    },
  ],
  relatedSlugs: ['organiser-un-dossier', 'mise-en-demeure', 'conservation-documents'],
};
