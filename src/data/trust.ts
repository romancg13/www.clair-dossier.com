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

export const TRUST_UPDATED = '2026-09-18';

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
    finalite: 'Base de données, authentification, stockage privé des pièces, fonctions serveur (dont la notification interne de l’équipe).',
    donnees: 'Comptes et profils, dossiers, pièces déposées, notifications internes.',
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
    finalite: 'Envoi des e-mails : confirmation de compte et notifications internes à l’équipe (nouvelle inscription, nouveau dossier).',
    donnees: 'Adresse e-mail du destinataire et contenu du message. Les notifications internes ne contiennent ni pièce ni contenu de dossier.',
    localisation: 'Société américaine — encadrement des transferts (clauses contractuelles types) : à confirmer.',
    localisationTodo: true,
    retention: 'Journaux d’envoi côté prestataire : durée à confirmer.',
    dpa: 'DPA Resend : référence à publier ici.',
    dpaTodo: true,
  },
  {
    name: 'GitHub Pages (GitHub, Inc.)',
    finalite: 'Diffusion du site public (fichiers statiques) sur le domaine clair-dossier.com.',
    donnees: 'Aucune donnée de dossier — journaux techniques de diffusion (dont l’adresse IP) côté hébergeur.',
    localisation: 'Société américaine, réseau de diffusion mondial (contenu public uniquement) — encadrement des transferts : à confirmer.',
    localisationTodo: true,
    retention: 'Journaux techniques selon la politique de l’hébergeur.',
    dpa: 'Conditions de traitement des données de GitHub : référence à publier ici.',
    dpaTodo: true,
  },
  {
    name: 'WhatsApp (Meta)',
    finalite: 'Canal de contact optionnel : vous choisissez d’écrire à l’équipe par WhatsApp.',
    donnees: 'Uniquement ce que vous décidez d’y écrire ou d’y joindre — régi par les conditions de WhatsApp. Le service n’y envoie jamais vos dossiers.',
    localisation: 'Hors de notre périmètre serveur : rien n’y transite sans votre action explicite.',
    retention: 'Selon vos réglages WhatsApp.',
    dpa: 'Sans objet (canal externe choisi par vous).',
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
    date: '2026-09-18',
    entry:
      'Tests SQL de cloisonnement entre comptes rejoués hors production sur l’ensemble des migrations du dépôt ; le relevé daté alimente les indicateurs de cette page.',
  },
  {
    date: '2026-08-30',
    entry:
      'Pré-rendu des pages publiques. En-têtes HTTP renforcés (HSTS, CSP stricte, nosniff, anti-framing) préparés pour une cible d’hébergement alternative, non active sur le domaine à ce jour. Capture des demandes de contact conçue (table verrouillée sans accès public direct, écriture par fonction serveur validée, limitation de débit par hachés salés) : écrite, non activée en production.',
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
  'Encadrement des transferts hors Union européenne (Resend, GitHub) : mécanisme à confirmer puis afficher.',
];
