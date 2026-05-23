export const site = {
  name: 'ClairDossier',
  slogan: 'Votre dossier juridique, clair, structuré et suivi.',
  url: 'https://www.clair-dossier.com',
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
  { label: "Centre d’aide", path: '/aide' },
  { label: 'Blog juridique', path: '/blog' },
  { label: 'Contact', path: '/contact' },
];

export const legalLinks = [
  { label: "Conditions d’utilisation", path: '/conditions-utilisation' },
  { label: 'Politique de confidentialité', path: '/politique-confidentialite' },
  { label: 'Mentions légales', path: '/mentions-legales' },
  { label: 'Cookies', path: '/cookies' },
  { label: 'RGPD', path: '/rgpd' },
  { label: 'Sécurité', path: '/securite' },
];

export const footerBadges = [
  { label: 'Conçu pour respecter le RGPD', path: '/rgpd' },
  { label: "Hébergement prévu dans l'UE", path: '/securite' },
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
    text: "Les analyses IA sont soumises à validation humaine. L’IA ne remplace pas l’avocat et n’émet pas de conseil personnalisé autonome.",
  },
  {
    title: 'Base RGPD et sécurité',
    text: "Consentements, RLS, audit logs, hébergement prévu dans l’Union européenne et séparation des données sont intégrés dans le schéma Supabase.",
  },
];

export const plans = [
  {
    id: 'discovery',
    name: 'Découverte',
    description: 'Pour cadrer un premier dossier sans paiement.',
    monthlyPrice: 0,
    audience: 'Particuliers qui veulent cadrer un premier dossier',
    features: ['1 dossier de test', 'Check-list documentaire', 'Accès blog et ressources', 'Paiement non requis'],
  },
  {
    id: 'client-essential',
    name: 'Client Essentiel',
    description: 'Pour les clients particuliers avec suivi régulier.',
    monthlyPrice: 19,
    audience: 'Clients particuliers avec suivi régulier',
    features: ['3 dossiers actifs', 'Messagerie dossier', 'Upload documents', 'Notifications de statut'],
  },
  {
    id: 'business',
    name: 'Business / PME',
    description: 'Pour dirigeants, équipes internes et PME.',
    monthlyPrice: 79,
    audience: 'Dirigeants et PME',
    features: ['Dossiers illimités PME', 'Contrats et recouvrement', 'Tableau de bord priorités', 'Accès multi-utilisateurs'],
  },
  {
    id: 'cabinet-solo',
    name: 'Cabinet Solo',
    description: 'Pour les avocats indépendants qui structurent les demandes entrantes.',
    monthlyPrice: 99,
    audience: 'Avocats indépendants',
    features: ['Pipeline dossiers', 'Demandes clients entrantes', 'Validation avocat', 'Facturation Stripe préparée'],
  },
  {
    id: 'cabinet-pro',
    name: 'Cabinet Pro',
    description: 'Pour les cabinets en croissance avec rôles et reporting.',
    monthlyPrice: 249,
    audience: 'Cabinets en croissance',
    features: ['Gestion clients', 'Tâches cabinet', 'Rôles équipe', 'Audit logs et reporting'],
  },
  {
    id: 'cabinet-premium',
    name: 'Cabinet Premium',
    description: 'Pour les structures avec exigences avancées.',
    monthlyPrice: null,
    audience: 'Structures avec exigences avancées',
    features: ['Onboarding dédié', 'Paramétrage sécurité', 'Support prioritaire', 'Intégrations sur demande'],
  },
] as const;

export const caseStatuses = ['reçu', 'incomplet', 'en analyse', 'en attente de pièces', 'en attente validation avocat', 'clôturé'];

export const warnings = [
  "L’IA ne remplace pas l’avocat.",
  'Toute analyse doit être validée par un professionnel habilité.',
  "Aucun conseil juridique personnalisé n’est transmis sans validation.",
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
      "ClairDossier aide à structurer cette préparation, mais l’analyse juridique personnalisée doit rester validée par un avocat ou un professionnel habilité.",
    ],
    faq: [
      { question: 'Faut-il tout envoyer à son avocat ?', answer: 'Il vaut mieux transmettre les pièces utiles et signaler les éléments incertains. Le professionnel décidera ensuite ce qui est juridiquement pertinent.' },
      { question: 'Une IA peut-elle qualifier juridiquement mon dossier ?', answer: "Une IA peut aider à organiser l’information, mais elle ne remplace pas l’avocat et ne doit pas délivrer seule un conseil personnalisé." },
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
    metaDescription: "Comprendre le rôle d’une IA LegalTech et les limites nécessaires pour protéger le client.",
    summary: "L’IA peut accélérer le tri et la synthèse, mais la décision et le conseil doivent être validés humainement.",
    category: 'IA et droit',
    author: 'Équipe ClairDossier',
    date: '2026-05-22',
    keywords: ['IA juridique', 'avocat', 'validation humaine', 'LegalTech'],
    status: 'publié',
    takeaways: [
      "L’IA peut assister la préparation, pas remplacer le professionnel.",
      'Les sorties IA doivent être relues et validées.',
      'Les utilisateurs doivent être informés des limites du système.',
    ],
    content: [
      "Dans une LegalTech prudente, l’IA sert d’assistant : elle aide à classer, résumer, identifier les informations manquantes et proposer des questions de suivi.",
      "Elle ne doit pas être présentée comme un avocat automatique. Les analyses IA sont soumises à validation humaine et aucun conseil personnalisé ne doit être transmis sans contrôle professionnel.",
      'Cette approche réduit les risques de mauvaise qualification, protège le secret professionnel et maintient une chaîne de responsabilité claire.',
    ],
    faq: [
      { question: "L’IA de ClairDossier donne-t-elle un conseil juridique ?", answer: "Non. Les contenus et analyses sont informatifs ou préparatoires tant qu’un professionnel habilité ne les a pas validés." },
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
      'ClairDossier est conçu pour respecter le RGPD : consentement des formulaires, règles RLS, hébergement UE documenté, audit logs et limitation des accès sont intégrés dans la base technique.',
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
  {
    title: 'Licenciement abusif : quels documents réunir pour se défendre ?',
    slug: 'licenciement-abusif-documents-defense',
    metaTitle: 'Documents pour contester un licenciement abusif | ClairDossier',
    metaDescription: 'Liste des pièces à rassembler pour préparer un dossier prud’homal solide en cas de licenciement contesté.',
    summary: 'Face à un licenciement contesté, la qualité du dossier dépend des preuves réunies dès les premiers jours.',
    category: 'Droit du travail',
    author: 'Équipe ClairDossier',
    date: '2026-05-20',
    keywords: ['licenciement abusif', 'prud\u2019hommes', 'droit du travail', 'documents'],
    status: 'publié',
    takeaways: [
      'Conservez la lettre de licenciement, le contrat et les avenants.',
      'Réunissez les bulletins de paie et les entretiens annuels.',
      'Archivez les emails et SMS liés aux faits reprochés.',
    ],
    content: [
      'En cas de licenciement contesté, le salarié doit prouver l’absence de cause réelle et sérieuse ou démontrer des irrégularités de procédure. La constitution rapide du dossier est essentielle.',
      'Les pièces prioritaires sont : le contrat de travail et ses avenants, la lettre de convocation à l’entretien préalable, le compte-rendu de l’entretien, la lettre de licenciement, les bulletins de paie sur toute la période, les courriers de contestation et les attestations de collègues.',
      'Classez ces documents par date dans un dossier structuré. Indiquez clairement les délais de recours. Le Conseil de prud’hommes doit être saisi dans les délais légaux applicables.',
      'ClairDossier peut vous aider à structurer cette préparation. L’analyse juridique doit ensuite être validée par un avocat en droit du travail.',
    ],
    faq: [
      { question: 'Quel est le délai pour contester un licenciement ?', answer: 'Le délai de prescription est généralement de 12 mois à compter de la notification du licenciement pour les licenciements pour motif personnel. Ce délai peut varier selon les situations.' },
      { question: 'Peut-on contester un licenciement sans avocat ?', answer: 'Oui, la représentation par un avocat n’est pas obligatoire devant le Conseil de prud’hommes, mais elle est fortement recommandée pour des raisons de complexité technique.' },
    ],
    internalLinks: [
      { label: 'Créer un dossier', path: '/creer-dossier' },
      { label: 'Blog droit du travail', path: '/blog/categorie/droit-du-travail' },
    ],
  },
  {
    title: 'Recouvrement de créances : étapes et bonnes pratiques',
    slug: 'recouvrement-creances-etapes-bonnes-pratiques',
    metaTitle: 'Recouvrement de créances : guide pratique | ClairDossier',
    metaDescription: 'Étapes du recouvrement amiable et judiciaire, documents nécessaires et erreurs à éviter.',
    summary: 'Le recouvrement d’une créance impayée suit un parcours précis : relance, mise en demeure, puis procédure judiciaire si nécessaire.',
    category: 'Recouvrement',
    author: 'Équipe ClairDossier',
    date: '2026-05-18',
    keywords: ['recouvrement', 'créances', 'impayés', 'mise en demeure'],
    status: 'publié',
    takeaways: [
      'Commencez toujours par une relance amiable écrite.',
      'Envoyez une mise en demeure par courrier recommandé avec accusé de réception.',
      'Conservez toutes les preuves de la créance et des relances.',
    ],
    content: [
      'Le recouvrement amiable est la première étape : relance téléphonique, email de rappel, puis courrier recommandé de mise en demeure avec un délai raisonnable de paiement.',
      'Si le débiteur ne répond pas ou refuse de payer, la phase judiciaire peut être envisagée : injonction de payer, assignation au tribunal, ou recours à un huissier de justice pour les créances établies.',
      'Les documents essentiels sont : le contrat ou bon de commande, les factures impayées, les preuves de livraison ou de prestation, les relances envoyées et la mise en demeure.',
      'La prescription des créances commerciales est généralement de 5 ans. Ne tardez pas à constituer votre dossier et à consulter un professionnel.',
    ],
    faq: [
      { question: 'Combien de temps faut-il attendre avant une mise en demeure ?', answer: 'Il n’y a pas de délai légal minimum, mais une relance amiable préalable est recommandée. La mise en demeure intervient généralement après 15 à 30 jours sans paiement.' },
      { question: 'L’injonction de payer est-elle coûteuse ?', answer: 'La requête en injonction de payer est une procédure simplifiée avec des frais limités. Le coût dépend du montant de la créance et du tribunal compétent.' },
    ],
    internalLinks: [
      { label: 'Créer un dossier recouvrement', path: '/creer-dossier' },
      { label: 'Tarifs ClairDossier', path: '/tarifs' },
    ],
  },
  {
    title: 'Bail commercial : les points clés à vérifier avant de signer',
    slug: 'bail-commercial-points-cles-verification',
    metaTitle: 'Bail commercial : vérifications avant signature | ClairDossier',
    metaDescription: 'Les clauses essentielles à vérifier dans un bail commercial avant de s’engager.',
    summary: 'Un bail commercial engage sur plusieurs années. La vérification attentive des clauses essentielles évite des litiges coûteux.',
    category: 'Bail et immobilier',
    author: 'Équipe ClairDossier',
    date: '2026-05-16',
    keywords: ['bail commercial', 'immobilier', 'loyer', 'clauses'],
    status: 'publié',
    takeaways: [
      'Vérifiez la durée, le loyer, les charges et les conditions de révision.',
      'Examinez les clauses de destination, sous-location et cession.',
      'Faites relire le bail par un professionnel avant signature.',
    ],
    content: [
      'Le bail commercial (bail 3-6-9) est régi par le statut des baux commerciaux. Il engage le preneur pour une durée minimale de 9 ans, avec possibilité de résiliation triennale sous conditions.',
      'Les points essentiels à vérifier sont : le montant du loyer et les modalités de révision, la répartition des charges et travaux, la destination des lieux (activités autorisées), les conditions de cession du bail et la clause de solidarité.',
      'Attention aux charges récupérables : depuis la loi Pinel, le bailleur doit fournir un état récapitulatif annuel des charges. Vérifiez aussi les travaux prévus et leur répartition.',
      'Un bail mal négocié peut avoir des conséquences financières importantes. Faites relire le projet de bail par un avocat spécialisé avant toute signature.',
    ],
    faq: [
      { question: 'Peut-on négocier un bail commercial ?', answer: 'Oui, le bail commercial est un contrat négociable. Le loyer, la durée, les charges et les travaux peuvent faire l’objet de discussions avant signature.' },
      { question: 'Qu’est-ce que le droit au renouvellement ?', answer: 'Le locataire d’un bail commercial bénéficie d’un droit au renouvellement après 3 ans d’exploitation. Le refus du bailleur peut donner lieu à une indemnité d’éviction.' },
    ],
    internalLinks: [
      { label: 'Créer un dossier immobilier', path: '/creer-dossier' },
      { label: 'Sécurité des documents', path: '/securite' },
    ],
  },
  {
    title: 'Rédiger un contrat commercial solide : les clauses indispensables',
    slug: 'contrat-commercial-clauses-indispensables',
    metaTitle: 'Clauses indispensables d’un contrat commercial | ClairDossier',
    metaDescription: 'Guide des clauses essentielles à intégrer dans un contrat commercial pour protéger votre entreprise.',
    summary: 'Un contrat commercial bien rédigé protège les deux parties et prévient les litiges.',
    category: 'Contrats',
    author: 'Équipe ClairDossier',
    date: '2026-05-14',
    keywords: ['contrat commercial', 'clauses', 'entreprise', 'litige'],
    status: 'publié',
    takeaways: [
      'Définissez précisément l’objet, le prix et les délais.',
      'Incluez des clauses de responsabilité, résiliation et force majeure.',
      'Prévoyez un mode de résolution des litiges.',
    ],
    content: [
      'Un contrat commercial doit contenir au minimum : l’identification des parties, l’objet précis du contrat, le prix et les modalités de paiement, les délais d’exécution, les obligations de chaque partie et les conditions de résiliation.',
      'Les clauses protectrices essentielles sont : la clause de responsabilité (limitation et exclusion), la clause de force majeure, la clause pénale (pénalités de retard), la clause de confidentialité et la clause compromissoire ou attributive de juridiction.',
      'Pour les contrats de prestation, précisez les critères d’acceptation, les modalités de recette et les garanties après livraison. Pour les contrats de vente, détaillez les conditions de livraison, de garantie et de retour.',
      'La rédaction d’un contrat commercial engage la responsabilité de l’entreprise. Faites-le relire par un juriste ou un avocat pour sécuriser vos engagements.',
    ],
    faq: [
      { question: 'Un contrat verbal est-il valable ?', answer: 'En droit commercial, un contrat verbal peut être valable. Cependant, en cas de litige, la preuve est beaucoup plus difficile à apporter sans écrit.' },
      { question: 'Faut-il obligatoirement un avocat pour rédiger un contrat ?', answer: 'Non, mais c’est fortement recommandé pour les contrats à enjeux importants. Un contrat mal rédigé peut coûter beaucoup plus cher qu’un conseil juridique.' },
    ],
    internalLinks: [
      { label: 'Créer un dossier contrat', path: '/creer-dossier' },
      { label: 'Formules pour entreprises', path: '/tarifs' },
    ],
  },
  {
    title: 'Créer sa société : les étapes juridiques essentielles',
    slug: 'creer-societe-etapes-juridiques',
    metaTitle: 'Création de société : étapes juridiques | ClairDossier',
    metaDescription: 'Guide des formalités juridiques pour créer une société en France : statuts, immatriculation, obligations.',
    summary: 'La création d’une société implique des étapes juridiques précises, du choix de la forme sociale à l’immatriculation.',
    category: 'Droit des sociétés',
    author: 'Équipe ClairDossier',
    date: '2026-05-12',
    keywords: ['création société', 'statuts', 'immatriculation', 'droit des sociétés'],
    status: 'publié',
    takeaways: [
      'Choisissez la forme sociale adaptée à votre projet (SARL, SAS, etc.).',
      'Rédigez des statuts complets et conformes.',
      'Respectez les formalités de publication et d’immatriculation.',
    ],
    content: [
      'Le choix de la forme sociale dépend du nombre d’associés, du capital prévu, du régime fiscal souhaité et du mode de gouvernance. Les formes les plus courantes sont la SARL, la SAS, l’EURL et la SASU.',
      'Les étapes de création sont : la rédaction des statuts, le dépôt du capital social, la publication d’une annonce légale, le dépôt du dossier au guichet unique (INPI) et l’obtention du Kbis.',
      'Les statuts doivent obligatoirement préciser : la forme sociale, la dénomination, le siège social, l’objet social, le capital, la durée, les apports et les modalités de fonctionnement.',
      'Des erreurs dans les statuts ou les formalités peuvent entraîner des blocages ou des surcoûts. Un accompagnement juridique est recommandé pour sécuriser la création.',
    ],
    faq: [
      { question: 'Quel est le capital minimum pour créer une SAS ?', answer: 'Le capital minimum d’une SAS est de 1 euro. Cependant, un capital trop faible peut poser des difficultés de crédibilité auprès des partenaires et des banques.' },
      { question: 'Combien de temps faut-il pour créer une société ?', answer: 'Avec un dossier complet, l’immatriculation peut être obtenue en quelques jours à quelques semaines selon les greffes et la complexité du dossier.' },
    ],
    internalLinks: [
      { label: 'Créer un dossier société', path: '/creer-dossier' },
      { label: 'Documentation', path: '/documentation' },
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
      { title: 'Gestion documentaire', text: 'Upload, liste, rattachement au dossier, statut et règles de confidentialité sont intégrés dans la structure.' },
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
    title: "Centre d’aide",
    description: 'Réponses courtes aux questions fréquentes sur ClairDossier.',
    sections: [
      { title: 'ClairDossier remplace-t-il un avocat ?', text: "Non. ClairDossier structure l’information. L’IA ne remplace pas l’avocat et toute analyse doit être validée." },
      { title: 'Où sont hébergées les données ?', text: "L’architecture cible un hébergement dans l’Union européenne via Supabase ou un fournisseur équivalent." },
      { title: 'Le paiement est-il actif ?', text: 'Le checkout Stripe s’active lorsque les clés, Price IDs et webhooks de production sont configurés.' },
    ],
  },
};

export const legalPages = {
  'conditions-utilisation': {
    title: "Conditions d’utilisation",
    description: 'Cadre prudent d’utilisation de ClairDossier.',
    sections: [
      { title: 'Objet du service', text: 'ClairDossier propose des outils de structuration, suivi et préparation de dossiers juridiques pour clients, PME, avocats et cabinets.' },
      { title: 'Rôle de ClairDossier', text: "ClairDossier agit comme outil logiciel. Le service n’est pas un cabinet d’avocats et ne remplace pas l’intervention d’un professionnel habilité." },
      { title: 'Absence de remplacement de l’avocat', text: "L’IA ne remplace pas l’avocat. Aucun conseil juridique personnalisé n’est transmis sans validation par un professionnel habilité." },
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
      { title: 'Suppression de compte et export', text: 'L’utilisateur peut demander l’export ou la suppression de son compte et de ses données, sous réserve des obligations légales de conservation.' },
      { title: 'Sous-traitants', text: 'Supabase, Stripe et les services d’hébergement ou d’emailing doivent être documentés avant mise en production.' },
      { title: 'Information IA', text: "Aucune donnée confidentielle ne doit être transmise à un service d’IA sans information claire. L’IA ne remplace pas l’avocat et les analyses sont soumises à validation professionnelle." },
      { title: 'Sécurité', text: 'Le service prévoit contrôle d’accès, RLS, journalisation, sauvegardes et hébergement UE lorsque la configuration est finalisée.' },
      { title: 'Contact confidentialité', text: 'Contact confidentialité : contact@clair-dossier.com.' },
    ],
  },
  'mentions-legales': {
    title: 'Mentions légales',
    description: 'Informations éditoriales de ClairDossier.',
    sections: [
      { title: 'Éditeur du site', text: 'ClairDossier - [nom de l’entité éditrice à compléter], [forme sociale à compléter], [capital social à compléter].' },
      { title: 'Responsable de publication', text: '[Nom du responsable de publication à compléter].' },
      { title: 'Hébergeur', text: 'Site statique hébergé via GitHub Pages ou l’hébergeur de production retenu. Les données applicatives sont destinées à être hébergées dans Supabase selon une région configurée dans l’Union européenne.' },
      { title: 'Contact', text: 'contact@clair-dossier.com.' },
      { title: 'SIRET', text: '[SIRET à compléter si disponible].' },
      { title: 'Adresse', text: '[Adresse de l’éditeur à compléter si disponible].' },
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
      { title: 'Suppression de compte', text: 'Vous pouvez demander la suppression de votre compte depuis le support, sous réserve des obligations légales de conservation.' },
      { title: 'Aucune garantie de résultat', text: 'ClairDossier aide à structurer les informations ; aucune garantie de résultat juridique ou judiciaire n’est donnée.' },
      { title: 'Contact', text: 'Contact RGPD : contact@clair-dossier.com.' },
    ],
  },
  securite: {
    title: 'Sécurité et confidentialité',
    description: 'Mesures pour protéger les dossiers juridiques et les échanges sensibles.',
    sections: [
      { title: 'Chiffrement', text: 'Les communications doivent être servies en HTTPS. Le chiffrement au repos dépendra de la configuration de l’hébergeur retenu.' },
      { title: 'Hébergement UE', text: 'La configuration de production doit retenir une région d’hébergement dans l’Union européenne afin de limiter les transferts de données hors UE.' },
      { title: 'Séparation des données', text: 'Les règles RLS Supabase proposées limitent l’accès aux données selon l’utilisateur, le cabinet et le rôle.' },
      { title: 'Sauvegardes', text: 'Des sauvegardes régulières doivent être activées chez l’hébergeur avant production.' },
      { title: 'Contrôle d’accès', text: 'Les espaces client, avocat et cabinet sont séparés fonctionnellement et doivent être protégés par authentification.' },
      { title: 'Secret professionnel', text: 'Le produit est conçu pour tenir compte du secret professionnel ; la configuration finale doit être validée avec les cabinets utilisateurs.' },
      { title: 'Validation avocat', text: 'Les analyses IA sont soumises à validation humaine et n’ont pas vocation à remplacer l’avocat.' },
      { title: 'Journalisation', text: 'La table audit_logs trace les événements sensibles sans exposer publiquement les données.' },
    ],
  },
};
