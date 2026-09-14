/**
 * Centre de confiance (Vague 1 — 5.3) : données de la page /securite.
 *
 * Règle absolue : chaque affirmation est vérifiée dans le code, les
 * migrations, ou un document publié (CGV, politique de confidentialité).
 * Tout élément non vérifiable reste un TODO EXPLICITE (`todo: true`),
 * affiché comme tel — jamais comblé par une formulation vague.
 *
 * Ce fichier sert aussi d'amorce au registre des sous-traitants (RGPD
 * art. 30) — à formaliser côté conformité.
 */

export const TRUST_UPDATED = '2026-08-30';

export type Subprocessor = {
  name: string;
  finalite: string;
  donnees: string;
  localisation: string;
  localisationTodo?: boolean;
  retention: string;
  dpa: string;
  dpaTodo?: boolean;
};

export const subprocessors: Subprocessor[] = [
  {
    name: 'Supabase',
    finalite: 'Base de données, authentification, stockage privé des pièces, fonctions serveur.',
    donnees: 'Comptes et profils, dossiers, pièces déposées, demandes de contact.',
    localisation: 'Région cloud du projet : en cours de confirmation — sera affichée ici.',
    localisationTodo: true,
    retention: 'Durée du contrat, puis délais de la politique de confidentialité (comptes : 12 mois après résiliation).',
    dpa: 'Cadre de sous-traitance Supabase : référence à publier ici.',
    dpaTodo: true,
  },
  {
    name: 'Stripe Payments Europe Ltd',
    finalite: 'Paiement des abonnements par pages de paiement hébergées (Payment Links).',
    donnees: 'Coordonnées de paiement et de facturation — traitées par Stripe directement, jamais par nos serveurs.',
    localisation: 'Entité européenne (Irlande) ; transferts encadrés par Stripe.',
    retention: 'Données de facturation : 10 ans (obligation légale, C. com. L. 123-22).',
    dpa: 'Accord de traitement des données Stripe (public, stripe.com/legal/dpa).',
  },
  {
    name: 'Resend',
    finalite: 'E-mails transactionnels : confirmation de compte, notifications, accusés de réception.',
    donnees: 'Adresse e-mail et contenu des messages transactionnels (minimisés : pas de contenu de dossier).',
    localisation: 'Société américaine — encadrement des transferts (clauses contractuelles types) : à confirmer.',
    localisationTodo: true,
    retention: 'Journaux d’envoi côté prestataire : durée à confirmer.',
    dpa: 'DPA Resend : référence à publier ici.',
    dpaTodo: true,
  },
  {
    name: 'GitHub Pages / Netlify',
    finalite: 'Diffusion du site public (fichiers statiques).',
    donnees: 'Aucune donnée de dossier — journaux techniques de diffusion (adresses IP) côté hébergeur.',
    localisation: 'Réseaux de diffusion mondiaux (contenu public uniquement).',
    retention: 'Journaux techniques selon les politiques de ces hébergeurs.',
    dpa: 'Conditions de service publiques de ces plateformes.',
  },
  {
    name: 'WhatsApp (Meta)',
    finalite: 'Canal de contact et de transmission optionnel, toujours choisi et déclenché par vous.',
    donnees: 'Uniquement ce que vous décidez d’y envoyer — régi par les conditions de WhatsApp.',
    localisation: 'Hors de notre périmètre serveur : aucune pièce n’y transite sans votre action explicite.',
    retention: 'Selon vos réglages WhatsApp.',
    dpa: 'Sans objet (canal externe activé par l’utilisateur).',
  },
];

/** Durées de conservation — reprises de la politique de confidentialité publiée (/politique-confidentialite). */
export const retentionRows = [
  { label: 'Données de compte', value: 'Durée du contrat, puis 12 mois après résiliation.' },
  {
    label: 'Données de dossier',
    value: 'Durée du contrat ; à la résiliation, copie transmise sur demande sous 30 jours, puis suppression ou anonymisation.',
  },
  { label: 'Données de facturation', value: '10 ans (Code de commerce, art. L. 123-22).' },
  { label: 'Journaux de connexion', value: '12 mois (LCEN).' },
];

/** Journal daté des changements de sécurité — chaque entrée est vérifiable (migrations SQL, configuration, commits). */
export const securityChangelog: Array<{ date: string; entry: string }> = [
  {
    date: '2026-08-30',
    entry:
      'En-têtes HTTP renforcés sur la cible d’hébergement (HSTS 1 an, CSP stricte, nosniff, anti-framing). Pré-rendu des pages publiques. Conception de la capture des demandes de contact : table verrouillée (aucun accès public direct), écriture par fonction serveur validée, limitation de débit par hachés salés — activation en cours.',
  },
  {
    date: '2026-08-23',
    entry:
      'Baseline de sécurité et matrice de non-régression établies (inventaire complet du code, des accès et des flux Stripe/Supabase).',
  },
  {
    date: '2026-06-21',
    entry:
      'Accès support restreint à un administrateur unique : liste d’admins hors d’atteinte des utilisateurs (aucune policy applicative), vérification par fonction dédiée, politiques de lecture additives — l’isolation entre clients reste inchangée.',
  },
  {
    date: '2026-06-15',
    entry:
      'Isolation par utilisateur appliquée en base dès l’initialisation (Row Level Security sur dossiers, documents, profils et stockage) ; bucket de pièces privé, accès par liens signés temporaires.',
  },
];

/** Éléments non vérifiables à ce jour — affichés comme TODO, jamais comblés par du flou. */
export const openTodos: string[] = [
  'Localisation exacte (région cloud) du projet de base de données : à confirmer puis afficher.',
  'DPA ClairDossier téléchargeable directement depuis cette page (aujourd’hui : envoyé par e-mail sur simple demande).',
  'Analyse d’impact (AIPD) : évaluation de la nécessité à documenter.',
  'Procédure d’incident rédigée et publiée (l’engagement réglementaire s’applique déjà — voir Continuité).',
  'Test de restauration des sauvegardes : à réaliser puis dater ici.',
];
