/**
 * État du produit (Vague 1 — 5.4) : ce qui est opérationnel, partiel et
 * prévu — généré à partir de ce que le CODE fait réellement (audit du
 * 2026-08-29/30 : routeur, pages, migrations SQL, fonctions edge), pas de
 * ce que dit le marketing.
 *
 * Règles de tenue :
 *  - toute évolution du produit met à jour cette liste ET la date ;
 *  - un élément n'entre en « opérationnel » que constaté dans le code ;
 *  - cette page est la SEULE source autorisée de l'agent de qualification
 *    (prompts/a1-qualification.system.md) sur les capacités du produit.
 */

export const PRODUCT_STATUS_UPDATED = '2026-08-30';

export type ProductStatusEntry = {
  label: string;
  detail: string;
  /** Où cela se constate (page publique, document, code). */
  verification?: string;
};

export const operational: ProductStatusEntry[] = [
  {
    label: 'Compte gratuit avec confirmation par e-mail',
    detail:
      "Création de compte gratuite, confirmée par e-mail avant connexion. Profil rattaché (structure, type d'activité).",
    verification: '/inscription',
  },
  {
    label: 'Création de dossier guidée en 5 étapes',
    detail:
      'Tunnel adapté au profil (artisan, indépendant, profession libérale, PME) : profil, nature du dossier, informations, pièces, récapitulatif.',
    verification: '/fonctionnalites/creation-guidee',
  },
  {
    label: 'Dépôt de pièces dans un espace privé',
    detail:
      'Stockage dans un bucket privé, accès par liens temporaires signés, isolation par compte appliquée en base (Row Level Security).',
    verification: '/fonctionnalites/depot-de-pieces',
  },
  {
    label: 'Espace « Mes dossiers » et page d’avancement',
    detail:
      'Liste des dossiers du compte ; chaque dossier a sa page d’avancement : statuts, pièces consultables et téléchargeables, échéances renseignées affichées.',
    verification: '/fonctionnalites/suivi-statuts · /fonctionnalites/chronologie',
  },
  {
    label: 'Échéances renseignées et affichées',
    detail:
      'Les dates clés saisies à la création sont conservées et affichées sur la page d’avancement du dossier. (L’envoi de rappels automatiques n’existe pas — voir « Prévu ».)',
    verification: '/fonctionnalites/calendrier-relances',
  },
  {
    label: 'Récapitulatif avant validation',
    detail: 'Relecture complète du dossier (profil, nature, informations, pièces) avant confirmation.',
    verification: '/fonctionnalites/recapitulatif-transmission',
  },
  {
    label: 'Transmission déclenchée par vous, jamais automatique',
    detail:
      'Le dossier validé est enregistré dans votre compte ; aucun envoi automatique. Vous téléchargez vos pièces et transmettez le dossier vous-même au destinataire de votre choix. Aucune lecture ni exploitation automatique des pièces (engagement contractuel).',
    verification: '/fonctionnalites/transmission-validee · /cgv',
  },
  {
    label: 'Remise de documents de travail par l’équipe',
    detail:
      'L’équipe ClairDossier peut déposer des documents de travail dans un dossier ; le client les consulte et les télécharge, y compris en téléchargement groupé.',
  },
  {
    label: 'Abonnements par Stripe (7 formules)',
    detail:
      'Paiement par liens Stripe hébergés, en mensuel ou annuel (−10 %). Aucune donnée bancaire ne transite par nos serveurs.',
    verification: '/tarifs',
  },
  {
    label: 'Pages publiques lisibles par les moteurs et les IA',
    detail:
      'Chaque page publique est servie en HTML complet (pré-rendu) et doublée d’une version .md pour les crawlers IA (llms.txt).',
    verification: '/llms.txt',
  },
];

export const partial: ProductStatusEntry[] = [
  {
    label: 'Quotas de dossiers des formules',
    detail:
      'Le contrôle serveur des plafonds de dossiers (vérification et décompte à la validation, exceptions gérées par l’équipe) est livré ; son activation en production est en cours de déploiement. Aucune limite n’est appliquée à un abonné tant que son abonnement n’est pas rattaché.',
  },
  {
    label: 'Rattachement automatique de l’abonnement aux droits',
    detail:
      'Le rattachement de l’abonnement Stripe au compte via un webhook signé est livré ; son activation est en cours de déploiement. D’ici là, le rapprochement est effectué par l’équipe.',
  },
  {
    label: 'Capture des demandes de contact et de rendez-vous',
    detail:
      'Enregistrement côté serveur des demandes (avec accusé de réception par e-mail) : code livré et testé, activation en cours de déploiement.',
  },
  {
    label: 'Mesure d’audience sans cookie',
    detail:
      'Intégration prête (aucun cookie, aucun bandeau nécessaire) ; inactive tant que le compte de mesure n’est pas ouvert.',
  },
];

export const planned: ProductStatusEntry[] = [
  {
    label: 'Relances automatiques à échéance',
    detail:
      'Aujourd’hui, les échéances sont affichées sur le dossier. L’envoi automatique de rappels est à l’étude ; toute relance restera préparée en brouillon et validée humainement.',
  },
  {
    label: 'Projets de réponse aux e-mails',
    detail: 'Évoqué dans d’anciennes descriptions du service : non disponible à ce jour.',
  },
  {
    label: 'Validation par un professionnel du droit (option)',
    detail:
      'Mentionnée dans certaines descriptions : non disponible à ce jour. C’est vous qui constituez et validez votre dossier ; le cadrage de cette option est en cours d’arbitrage.',
  },
  {
    label: 'Démonstration produit interactive en ligne',
    detail: 'En attendant : démonstration accompagnée sur rendez-vous (/rendez-vous).',
  },
];

/**
 * Offre Entreprise sur devis : SDK Node et Python, SSO SAML 2.0 / OIDC,
 * marque blanche, onboarding sur site (voir /tarifs). Ces éléments sont
 * fournis dans le cadre d'un engagement contractuel cadré — il n'existe pas
 * de module en libre-service dans le produit aujourd'hui.
 */
export const ENTERPRISE_NOTE =
  "Les capacités de l'offre Entreprise (SDK Node et Python, SSO SAML 2.0 / OIDC, marque blanche, onboarding sur site) sont mises en œuvre dans le cadre d'un engagement sur devis, cadré contractuellement — elles ne sont pas des modules en libre-service du produit.";
