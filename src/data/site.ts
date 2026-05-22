export const site = {
  name: 'ClairDossier',
  slogan: 'Votre dossier juridique, clair, structuré et suivi.',
  url: 'https://clair-dossier.com',
  email: 'contact@clair-dossier.com',
};

export const publicNav = [
  { label: 'Fonctionnalités', path: '/fonctionnalites' },
  { label: 'Tarifs', path: '/tarifs' },
  { label: 'Blog', path: '/blog' },
  { label: 'Sécurité', path: '/securite' },
  { label: 'Contact', path: '/contact' },
];

export const productLinks = [
  { label: 'Fonctionnalités', path: '/fonctionnalites' },
  { label: 'Tarifs', path: '/tarifs' },
  { label: 'Sécurité', path: '/securite' },
  { label: 'RGPD', path: '/rgpd' },
];

export const resourceLinks = [
  { label: 'Documentation', path: '/documentation' },
  { label: "Centre d'aide", path: '/aide' },
  { label: 'Blog juridique', path: '/blog' },
  { label: 'Contact', path: '/contact' },
];

export const legalLinks = [
  { label: "Conditions d'utilisation", path: '/conditions-utilisation' },
  { label: 'Politique de confidentialité', path: '/politique-confidentialite' },
  { label: 'Mentions légales', path: '/mentions-legales' },
  { label: 'Cookies', path: '/cookies' },
];

export const footerBadges = [
  { label: 'Conçu pour respecter le RGPD', path: '/rgpd' },
  { label: 'Hébergement UE prévu', path: '/securite' },
  { label: 'Secret professionnel pris en compte', path: '/securite' },
];

export const featureCards = [
  {
    title: 'Dossiers structurés',
    text: 'Centralisez les faits, pièces, échéances, échanges et validations dans un parcours lisible pour le client et le cabinet.',
  },
  {
    title: 'Suivi client-avocat',
    text: 'Visualisez le statut du dossier, les demandes de pièces, les messages et les prochaines actions sans multiplier les emails.',
  },
  {
    title: 'IA encadrée',
    text: "Les analyses IA sont soumises à validation humaine. L'IA ne remplace pas l'avocat et n'émet pas de conseil personnalisé autonome.",
  },
  {
    title: 'Base RGPD et sécurité',
    text: 'Consentements, RLS, audit logs, hébergement UE prévu et séparation des données sont intégrés dans le schéma Supabase proposé.',
  },
];

export const plans = [
  {
    id: 'discovery',
    name: 'Découverte',
    price: '0 €',
    audience: 'Particuliers qui veulent cadrer un premier dossier',
    features: ['1 dossier de test', 'Check-list documentaire', 'Accès blog et ressources', 'Paiement non requis'],
  },
  {
    id: 'client-essential',
    name: 'Client Essentiel',
    price: '19 € / mois',
    audience: 'Clients particuliers avec suivi régulier',
    features: ['3 dossiers actifs', 'Messagerie dossier', 'Upload documents', 'Notifications de statut'],
  },
  {
    id: 'business',
    name: 'Business / PME',
    price: '79 € / mois',
    audience: 'Dirigeants et PME',
    features: ['Dossiers illimités PME', 'Contrats et recouvrement', 'Tableau de bord priorités', 'Accès multi-utilisateurs'],
  },
  {
    id: 'cabinet-solo',
    name: 'Cabinet Solo',
    price: '99 € / mois',
    audience: 'Avocats indépendants',
    features: ['Pipeline dossiers', 'Demandes clients entrantes', 'Validation avocat', 'Facturation Stripe préparée'],
  },
  {
    id: 'cabinet-pro',
    name: 'Cabinet Pro',
    price: '249 € / mois',
    audience: 'Cabinets en croissance',
    features: ['Gestion clients', 'Tâches cabinet', 'Rôles équipe', 'Audit logs et reporting'],
  },
  {
    id: 'cabinet-premium',
    name: 'Cabinet Premium',
    price: 'Sur devis',
    audience: 'Structures avec exigences avancées',
    features: ['Onboarding dédié', 'Paramétrage sécurité', 'Support prioritaire', 'Intégrations sur demande'],
  },
];

export const caseStatuses = ['reçu', 'incomplet', 'en analyse', 'en attente de pièces', 'en attente validation avocat', 'clôturé'];

export const warnings = [
  "L'IA ne remplace pas l'avocat.",
  'Toute analyse doit être validée par un professionnel habilité.',
  "Aucun conseil juridique personnalisé n'est transmis sans validation.",
];

export const categories = [
  { name: 'Droit du travail', slug: 'droit-du-travail' },
  { name: 'Recouvrement', slug: 'recouvrement' },
  { name: 'Bail et immobilier', slug: 'bail-et-immobilier' },
  { name: 'Contrats', slug: 'contrats' },
  { name: 'Droit des sociétés', slug: 'droit-des-societes' },
  { name: 'RGPD', slug: 'rgpd' },
  { name: 'IA et droit', slug: 'ia-et-droit' },
  { name: 'Conseils pratiques', slug: 'conseils-pratiques' },
];

export type BlogPost = {
  title: string;
  slug: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  category: string;
  author: string;
  date: string;
  keywords: string[];
  status: 'brouillon' | 'publié';
  takeaways: string[];
  content: string[];
  faq: { question: string; answer: string }[];
  internalLinks: { label: string; path: string }[];
};

export const blogPosts: BlogPost[] = [
  {
    title: 'Comment préparer un dossier juridique clair avant de contacter un avocat ?',
    slug: 'preparer-dossier-juridique-clair',
    metaTitle: 'Préparer un dossier juridique clair | ClairDossier',
    metaDescription: 'Méthode simple pour organiser faits, documents et questions avant un rendez-vous avocat.',
    summary: 'Un dossier clair aide le professionnel à comprendre rapidement les faits, les pièces disponibles et les urgences.',
    category: 'Conseils pratiques',
    author: 'Équipe ClairDossier',
    date: '2026-05-22',
    keywords: ['dossier juridique', 'avocat', 'documents', 'préparation'],
    status: 'publié',
    takeaways: [
      'Séparez les faits, les documents et les questions.',
      'Classez les pièces par date et par thème.',
      'Indiquez clairement les délais et les risques connus.',
    ],
    content: [
      'Un dossier juridique exploitable commence par une chronologie courte : qui a fait quoi, quand, et avec quelles preuves. Cette étape réduit les incompréhensions et limite les échanges inutiles.',
      'Ajoutez ensuite les documents disponibles : contrats, emails, mises en demeure, factures, captures, courriers, décisions ou attestations. Chaque pièce doit être rattachée à un fait précis.',
      "ClairDossier aide à structurer cette préparation, mais l'analyse juridique personnalisée doit rester validée par un avocat ou un professionnel habilité.",
    ],
    faq: [
      { question: 'Faut-il tout envoyer à son avocat ?', answer: 'Il vaut mieux transmettre les pièces utiles et signaler les éléments incertains. Le professionnel décidera ensuite ce qui est juridiquement pertinent.' },
      { question: 'Une IA peut-elle qualifier juridiquement mon dossier ?', answer: "Une IA peut aider à organiser l'information, mais elle ne remplace pas l'avocat et ne doit pas délivrer seule un conseil personnalisé." },
    ],
    internalLinks: [
      { label: 'Créer un dossier', path: '/creer-dossier' },
      { label: 'Sécurité des documents', path: '/securite' },
    ],
  },
  {
    title: "IA juridique : pourquoi la validation humaine reste indispensable",
    slug: 'ia-et-avocat-validation-humaine',
    metaTitle: 'IA juridique et validation avocat | ClairDossier',
    metaDescription: "Comprendre le rôle d'une IA LegalTech et les limites nécessaires pour protéger le client.",
    summary: "L'IA peut accélérer le tri et la synthèse, mais la décision et le conseil doivent être validés humainement.",
    category: 'IA et droit',
    author: 'Équipe ClairDossier',
    date: '2026-05-22',
    keywords: ['IA juridique', 'avocat', 'validation humaine', 'LegalTech'],
    status: 'publié',
    takeaways: [
      "L'IA peut assister la préparation, pas remplacer le professionnel.",
      'Les sorties IA doivent être relues et validées.',
      'Les utilisateurs doivent être informés des limites du système.',
    ],
    content: [
      "Dans une LegalTech prudente, l'IA sert d'assistant : elle aide à classer, résumer, identifier les informations manquantes et proposer des questions de suivi.",
      "Elle ne doit pas être présentée comme un avocat automatique. Les analyses IA sont soumises à validation humaine et aucun conseil personnalisé ne doit être transmis sans contrôle professionnel.",
      'Cette approche réduit les risques de mauvaise qualification, protège le secret professionnel et maintient une chaîne de responsabilité claire.',
    ],
    faq: [
      { question: "L'IA de ClairDossier donne-t-elle un conseil juridique ?", answer: "Non. Les contenus et analyses sont informatifs ou préparatoires tant qu'un professionnel habilité ne les a pas validés." },
      { question: 'Pourquoi afficher des avertissements IA ?', answer: 'Ils rappellent les limites du service et évitent de créer une confiance excessive dans une réponse automatisée.' },
    ],
    internalLinks: [
      { label: 'Notre approche sécurité', path: '/securite' },
      { label: 'RGPD et droits utilisateurs', path: '/rgpd' },
    ],
  },
  {
    title: 'RGPD et dossier juridique : quelles données faut-il protéger ?',
    slug: 'rgpd-donnees-dossier-juridique',
    metaTitle: 'RGPD et données de dossier juridique | ClairDossier',
    metaDescription: 'Données personnelles, durées, droits et mesures de sécurité pour une plateforme LegalTech.',
    summary: 'Un dossier juridique contient souvent des données sensibles qui exigent minimisation, sécurité et droits utilisateurs effectifs.',
    category: 'RGPD',
    author: 'Équipe ClairDossier',
    date: '2026-05-22',
    keywords: ['RGPD', 'données personnelles', 'LegalTech', 'sécurité'],
    status: 'publié',
    takeaways: [
      'Collectez uniquement les informations utiles au traitement du dossier.',
      'Documentez les finalités et les durées de conservation.',
      'Préparez les droits d’accès, rectification, suppression et portabilité.',
    ],
    content: [
      'Un dossier juridique peut contenir des identités, coordonnées, informations professionnelles, données financières, éléments familiaux ou contentieux. Certaines informations peuvent être sensibles selon le contexte.',
      'ClairDossier est conçu pour respecter le RGPD : consentement des formulaires, règles RLS, hébergement UE prévu, audit logs et limitation des accès sont prévus dans la base technique.',
      'La conformité finale dépendra toutefois de la configuration réelle, des sous-traitants choisis, des durées de conservation et des procédures internes du responsable de traitement.',
    ],
    faq: [
      { question: 'Quelles données collecter dans un premier formulaire ?', answer: 'Uniquement les informations nécessaires pour qualifier la demande : identité, contact, domaine, description et consentement.' },
      { question: 'Peut-on supprimer son dossier ?', answer: 'L’utilisateur peut demander la suppression, sous réserve des obligations légales de conservation applicables.' },
    ],
    internalLinks: [
      { label: 'Politique de confidentialité', path: '/politique-confidentialite' },
      { label: 'Page RGPD', path: '/rgpd' },
    ],
  },
];

export const infoPages = {
  fonctionnalites: {
    title: 'Fonctionnalités LegalTech',
    description: 'Un socle opérationnel pour créer, suivre, documenter et valider les dossiers juridiques.',
    sections: [
      { title: 'Espace client', text: 'Tableau de bord, dossiers, documents, messages, paiements et abonnement sont structurés pour accompagner les particuliers et PME.' },
      { title: 'Espace avocat et cabinet', text: 'Vue dossiers reçus, clients, tâches, validations, messages et facturation pour les cabinets.' },
      { title: 'Gestion documentaire', text: 'Upload, liste, rattachement au dossier, statut et règles de confidentialité sont prévus dans la structure.' },
      { title: 'Messagerie rattachée au dossier', text: 'Les échanges client-avocat peuvent être historisés avec statut lu/non lu et contexte dossier.' },
    ],
  },
  documentation: {
    title: 'Documentation',
    description: 'Guides de prise en main pour clients, PME, avocats et administrateurs de cabinet.',
    sections: [
      { title: 'Créer un dossier', text: 'Choisissez le domaine juridique, décrivez les faits, indiquez l’urgence et listez les documents disponibles.' },
      { title: 'Suivre un dossier', text: 'Consultez le statut, les demandes de pièces, les messages et les prochaines actions.' },
      { title: 'Configurer Stripe et Supabase', text: 'Déployez les migrations Supabase, configurez les variables serveur puis activez les fonctions Edge.' },
    ],
  },
  aide: {
    title: "Centre d'aide",
    description: 'Réponses courtes aux questions fréquentes sur ClairDossier.',
    sections: [
      { title: 'ClairDossier remplace-t-il un avocat ?', text: "Non. ClairDossier structure l'information. L'IA ne remplace pas l'avocat et toute analyse doit être validée." },
      { title: 'Où sont hébergées les données ?', text: "L'architecture est prévue pour un hébergement dans l'Union européenne via Supabase ou un fournisseur équivalent." },
      { title: 'Le paiement est-il actif ?', text: 'Le code Stripe est prêt. Le checkout devient actif après configuration des clés et des price IDs Stripe.' },
    ],
  },
};

export const legalPages = {
  'conditions-utilisation': {
    title: "Conditions d'utilisation",
    description: 'Cadre prudent d’utilisation de ClairDossier.',
    sections: [
      { title: 'Objet du service', text: 'ClairDossier propose des outils de structuration, suivi et préparation de dossiers juridiques pour clients, PME, avocats et cabinets.' },
      { title: 'Rôle de ClairDossier', text: "ClairDossier agit comme outil logiciel. Le service n'est pas un cabinet d'avocats et ne remplace pas l'intervention d'un professionnel habilité." },
      { title: 'Absence de remplacement de l’avocat', text: "L'IA ne remplace pas l'avocat. Aucun conseil juridique personnalisé n'est transmis sans validation par un professionnel habilité." },
      { title: 'Règles d’utilisation', text: 'L’utilisateur s’engage à fournir des informations exactes, à ne pas déposer de contenu illicite et à respecter les droits des tiers.' },
      { title: 'Responsabilité', text: 'La responsabilité de ClairDossier est limitée aux fonctionnalités logicielles fournies, sous réserve du droit applicable et des obligations impératives.' },
      { title: 'Abonnements et paiement', text: 'Les abonnements sont gérés via Stripe lorsque la configuration est activée. Les conditions tarifaires applicables sont affichées avant paiement.' },
      { title: 'Résiliation', text: 'L’utilisateur peut demander la résiliation ou utiliser le portail client Stripe lorsque celui-ci est configuré.' },
      { title: 'Propriété intellectuelle', text: 'Les marques, interfaces, contenus et éléments logiciels de ClairDossier restent protégés. Les documents déposés par l’utilisateur restent sa propriété.' },
      { title: 'Loi applicable', text: 'Les présentes conditions sont rédigées dans une perspective de droit français, sous réserve d’adaptation par conseil juridique.' },
      { title: 'Contact', text: 'Pour toute question : contact@clair-dossier.com.' },
    ],
  },
  'politique-confidentialite': {
    title: 'Politique de confidentialité',
    description: 'Information RGPD sur les données traitées par ClairDossier.',
    sections: [
      { title: 'Données collectées', text: 'Identité, coordonnées, informations de compte, demandes de contact, descriptions de dossiers, documents, messages, paiements et journaux techniques peuvent être collectés selon l’usage.' },
      { title: 'Finalités', text: 'Création de compte, traitement des demandes, suivi des dossiers, relation client, sécurité, facturation, support et amélioration du service.' },
      { title: 'Bases légales', text: 'Contrat, mesures précontractuelles, consentement, intérêt légitime de sécurité et obligations légales selon les traitements.' },
      { title: 'Durée de conservation', text: 'Les durées doivent être définies selon la nature du dossier, les obligations légales et les demandes de suppression recevables.' },
      { title: 'Droits RGPD', text: 'Accès, rectification, suppression, opposition, limitation et portabilité peuvent être exercés via contact@clair-dossier.com.' },
      { title: 'Sous-traitants', text: 'Supabase, Stripe et les services d’hébergement ou d’emailing doivent être documentés avant mise en production.' },
      { title: 'Sécurité', text: 'Le service prévoit contrôle d’accès, RLS, journalisation, sauvegardes et hébergement UE lorsque la configuration est finalisée.' },
      { title: 'Contact confidentialité', text: 'Contact confidentialité/DPO à compléter : privacy@clair-dossier.com ou contact@clair-dossier.com.' },
    ],
  },
  'mentions-legales': {
    title: 'Mentions légales',
    description: 'Informations éditoriales à compléter avant publication commerciale.',
    sections: [
      { title: 'Éditeur du site', text: 'À compléter : raison sociale / nom de l’éditeur de ClairDossier.' },
      { title: 'Responsable de publication', text: 'À compléter : nom du responsable de publication.' },
      { title: 'Hébergeur', text: 'À compléter : hébergeur du site et adresse. Hébergement prévu dans l’Union européenne.' },
      { title: 'Contact', text: 'contact@clair-dossier.com.' },
      { title: 'SIRET', text: 'À compléter si disponible.' },
      { title: 'Adresse', text: 'À compléter si disponible.' },
    ],
  },
  cookies: {
    title: 'Politique cookies',
    description: 'Information sur les cookies et traceurs utilisés par ClairDossier.',
    sections: [
      { title: 'Définition', text: 'Un cookie est un petit fichier stocké sur le terminal de l’utilisateur pour permettre ou améliorer certaines fonctionnalités.' },
      { title: 'Cookies nécessaires', text: 'Les cookies nécessaires peuvent être utilisés pour la session, la sécurité, la préférence de consentement et le fonctionnement du site.' },
      { title: 'Cookies analytiques', text: 'Les cookies analytiques ne doivent être activés qu’après consentement lorsque la réglementation l’exige.' },
      { title: 'Cookies marketing', text: 'Aucun cookie marketing n’est prévu par défaut. Toute activation future devra être documentée et soumise au consentement.' },
      { title: 'Gestion du consentement', text: 'Un module de préférences doit être connecté avant usage de traceurs non nécessaires.' },
    ],
  },
  rgpd: {
    title: 'RGPD et droits utilisateurs',
    description: 'ClairDossier est conçu pour respecter le RGPD et faciliter l’exercice des droits.',
    sections: [
      { title: 'Accès', text: 'Vous pouvez demander la copie des données personnelles vous concernant.' },
      { title: 'Rectification', text: 'Vous pouvez demander la correction d’informations inexactes ou incomplètes.' },
      { title: 'Suppression', text: 'Vous pouvez demander l’effacement de données, sous réserve des obligations légales de conservation.' },
      { title: 'Opposition', text: 'Vous pouvez vous opposer à certains traitements lorsque la base légale le permet.' },
      { title: 'Portabilité', text: 'Vous pouvez demander la transmission de certaines données dans un format exploitable.' },
      { title: 'Limitation', text: 'Vous pouvez demander la limitation temporaire de certains traitements.' },
      { title: 'Contact', text: 'Contact RGPD : privacy@clair-dossier.com ou contact@clair-dossier.com.' },
    ],
  },
  securite: {
    title: 'Sécurité et confidentialité',
    description: 'Mesures prévues pour protéger les dossiers juridiques et les échanges sensibles.',
    sections: [
      { title: 'Chiffrement', text: 'Les communications doivent être servies en HTTPS. Le chiffrement au repos dépendra de la configuration de l’hébergeur retenu.' },
      { title: 'Hébergement UE', text: 'L’hébergement est prévu dans l’Union européenne afin de limiter les transferts de données hors UE.' },
      { title: 'Séparation des données', text: 'Les règles RLS Supabase proposées limitent l’accès aux données selon l’utilisateur, le cabinet et le rôle.' },
      { title: 'Sauvegardes', text: 'Des sauvegardes régulières doivent être activées chez l’hébergeur avant production.' },
      { title: 'Contrôle d’accès', text: 'Les espaces client, avocat et cabinet sont séparés fonctionnellement et doivent être protégés par authentification.' },
      { title: 'Secret professionnel', text: 'Le produit est conçu pour tenir compte du secret professionnel ; la configuration finale doit être validée avec les cabinets utilisateurs.' },
      { title: 'Validation avocat', text: 'Les analyses IA sont soumises à validation humaine et n’ont pas vocation à remplacer l’avocat.' },
      { title: 'Journalisation', text: 'La table audit_logs est prévue pour tracer les événements sensibles sans exposer publiquement les données.' },
    ],
  },
};
