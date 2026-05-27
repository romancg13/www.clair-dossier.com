export type LegalBlock =
  | { type: 'p'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'h3'; text: string };

export type LegalSection = {
  id: string;
  title: string;
  blocks: LegalBlock[];
};

export type LegalPage = {
  slug: string;
  title: string;
  metaDescription: string;
  lastUpdate: string;
  intro: string;
  sections: LegalSection[];
};

const mentionsLegales: LegalPage = {
  slug: 'mentions-legales',
  title: 'Mentions légales',
  metaDescription:
    "Mentions légales du site clair-dossier.com — éditeur, hébergeur, directeur de publication, propriété intellectuelle.",
  lastUpdate: '2026-05-26',
  intro:
    "Conformément à la loi pour la confiance dans l'économie numérique (LCEN, n° 2004-575 du 21 juin 2004), il est précisé aux utilisateurs du site clair-dossier.com l'identité des différents intervenants dans le cadre de sa réalisation et de son suivi.",
  sections: [
    {
      id: 'editeur',
      title: 'Éditeur du site',
      blocks: [
        {
          type: 'p',
          text:
            "Le site clair-dossier.com est édité par Nouh BENZIDANE, entrepreneur individuel exerçant sous le nom commercial « 13'UP AGENCY », immatriculé au Répertoire National des Entreprises (RNE) sous le numéro SIREN 899 453 401 (SIRET siège : 899 453 401 00015) depuis le 17 mai 2021, dont le siège social est situé 54 rue de la République, 13002 Marseille, France.",
        },
        {
          type: 'p',
          text:
            "Code APE : 70.22Z — Conseil pour les affaires et autres conseils de gestion.",
        },
        {
          type: 'p',
          text:
            "TVA non applicable, article 293 B du Code général des impôts (régime de la franchise en base).",
        },
        {
          type: 'p',
          text:
            "Site professionnel de l'éditeur : https://nouhbenzidane.fr. Contact : contact@clair-dossier.com.",
        },
      ],
    },
    {
      id: 'directeur',
      title: 'Directeur de la publication',
      blocks: [
        {
          type: 'p',
          text:
            "Le directeur de la publication du site clair-dossier.com est Nouh BENZIDANE, en sa qualité d'éditeur du site. Toute correspondance peut lui être adressée à contact@clair-dossier.com.",
        },
      ],
    },
    {
      id: 'hebergement',
      title: 'Hébergement',
      blocks: [
        {
          type: 'p',
          text:
            "Le site clair-dossier.com est hébergé sur l'infrastructure GitHub Pages, opérée par GitHub Inc. (88 Colin P Kelly Jr St, San Francisco, CA 94107, États-Unis).",
        },
        {
          type: 'p',
          text:
            "Les données client du service ClairDossier — dossiers, pièces, échanges — sont quant à elles hébergées exclusivement en France, dans les datacenters d'OVHcloud à Roubaix (59100) et Strasbourg (67000). Aucune donnée client n'est transférée hors Union européenne.",
        },
      ],
    },
    {
      id: 'propriete',
      title: 'Propriété intellectuelle',
      blocks: [
        {
          type: 'p',
          text:
            "L'ensemble des contenus du site (textes, images, vidéos, structure, code source, marques, logos) est la propriété exclusive de la société ClairDossier ou de ses partenaires, et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.",
        },
        {
          type: 'p',
          text:
            "Toute reproduction, représentation, modification, publication, adaptation, totale ou partielle, des éléments du site, quel que soit le moyen ou le procédé utilisé, est strictement interdite sauf autorisation écrite préalable de ClairDossier.",
        },
      ],
    },
    {
      id: 'responsabilite',
      title: 'Limitation de responsabilité',
      blocks: [
        {
          type: 'p',
          text:
            "Les informations diffusées sur le site clair-dossier.com sont présentées à titre indicatif. Elles ne constituent en aucun cas un conseil juridique personnalisé. ClairDossier est une plateforme legaltech : nous structurons les dossiers, des avocats habilités les valident. Toute décision juridique doit faire l'objet d'une consultation auprès d'un professionnel du droit.",
        },
        {
          type: 'p',
          text:
            "ClairDossier ne saurait être tenue responsable des dommages directs ou indirects résultant de l'accès au site, de son utilisation ou de l'utilisation des informations qu'il contient.",
        },
      ],
    },
    {
      id: 'contact-legal',
      title: 'Contact',
      blocks: [
        {
          type: 'p',
          text:
            "Pour toute question relative aux présentes mentions légales : contact@clair-dossier.com. Pour les questions liées à la protection des données personnelles : voir la politique de confidentialité.",
        },
      ],
    },
  ],
};

const cgv: LegalPage = {
  slug: 'cgv',
  title: "Conditions générales de vente",
  metaDescription:
    "Conditions générales de vente du service ClairDossier — souscription, tarifs, durée, résiliation, responsabilité, propriété intellectuelle.",
  lastUpdate: '2026-05-26',
  intro:
    "Les présentes conditions générales de vente (« CGV ») régissent l'accès au service ClairDossier et son utilisation par tout client souscrivant à une offre payante ou gratuite. Toute souscription emporte acceptation pleine et entière des présentes CGV.",
  sections: [
    {
      id: 'objet',
      title: 'Article 1 — Objet',
      blocks: [
        {
          type: 'p',
          text:
            "Les présentes CGV ont pour objet de définir les conditions dans lesquelles Nouh BENZIDANE, entrepreneur individuel exerçant sous le nom commercial 13'UP AGENCY (SIREN 899 453 401), ci-après « ClairDossier » ou « l'Éditeur », fournit au client (ci-après le « Client ») un accès à la plateforme legaltech ClairDossier (ci-après le « Service »), permettant la structuration, le suivi et la validation de dossiers juridiques.",
        },
        {
          type: 'p',
          text:
            "Le Service est un outil de préparation et de gestion documentaire. Il ne constitue ni un cabinet d'avocats, ni un conseil juridique. La validation finale de chaque dossier reste de la responsabilité d'un avocat habilité.",
        },
      ],
    },
    {
      id: 'souscription',
      title: 'Article 2 — Souscription et essai gratuit',
      blocks: [
        {
          type: 'p',
          text:
            "La souscription au Service est effectuée en ligne via le site clair-dossier.com. Le Client choisit un plan parmi les offres proposées (Découverte, Client Essentiel, Business/PME, Cabinet Solo, Cabinet Pro, Cabinet Premium) et fournit les informations nécessaires à la création de son compte.",
        },
        {
          type: 'p',
          text:
            "Les plans payants ouvrent droit à un essai gratuit de 14 jours, sans communication de carte bancaire. À l'issue de cette période, le Client peut souscrire effectivement, basculer vers le plan Découverte gratuit, ou résilier sans engagement.",
        },
      ],
    },
    {
      id: 'tarifs',
      title: 'Article 3 — Tarifs et facturation',
      blocks: [
        {
          type: 'p',
          text:
            "Les tarifs en vigueur sont ceux publiés sur la page /tarifs du site clair-dossier.com au jour de la souscription. Les prix sont exprimés en euros, hors taxes. La TVA française à 20 % s'applique aux clients établis en France. Les clients établis dans un autre État membre de l'Union européenne et disposant d'un numéro de TVA intracommunautaire valide bénéficient du régime de l'autoliquidation.",
        },
        {
          type: 'p',
          text:
            "La facturation est mensuelle, prélevée d'avance le jour anniversaire de la souscription. Tout changement de plan en cours de mois est facturé au prorata des jours restants. Les paiements sont opérés via le prestataire Stripe (Stripe Payments Europe Ltd., Irlande).",
        },
      ],
    },
    {
      id: 'duree',
      title: 'Article 4 — Durée, résiliation',
      blocks: [
        {
          type: 'p',
          text:
            "Le Service est souscrit pour une durée indéterminée, sans engagement de durée minimale. Le Client peut résilier son abonnement à tout moment depuis son espace facturation. La résiliation prend effet au terme de la période de facturation en cours ; les sommes versées au-delà sont remboursées au prorata.",
        },
        {
          type: 'p',
          text:
            "À la résiliation, le Client dispose d'un délai de 30 jours pour exporter l'intégralité de ses données. Passé ce délai, les données sont supprimées ou anonymisées selon les modalités prévues à la politique de confidentialité.",
        },
      ],
    },
    {
      id: 'sla',
      title: 'Article 5 — Niveau de service',
      blocks: [
        {
          type: 'p',
          text:
            "ClairDossier s'engage à fournir un taux de disponibilité moyen de 99,5 % par trimestre pour les plans Découverte à Cabinet Pro, et de 99,95 % pour le plan Cabinet Premium et les contrats sur-mesure. Les opérations de maintenance planifiées sont annoncées au moins 48 heures à l'avance et n'entrent pas dans le calcul du taux de disponibilité.",
        },
      ],
    },
    {
      id: 'ia',
      title: 'Article 6 — Recours à l\'intelligence artificielle',
      blocks: [
        {
          type: 'p',
          text:
            "ClairDossier intègre des fonctionnalités d'assistance par intelligence artificielle (résumé de dossier, suggestions de questions, rédaction de brouillons). Conformément au Règlement Intérieur National des avocats, ces fonctionnalités préparent le travail du professionnel habilité ; elles ne constituent en aucun cas un conseil juridique délivré au client.",
        },
        {
          type: 'p',
          text:
            "Toute analyse IA est soumise à validation d'un avocat habilité avant transmission au client final. ClairDossier ne saurait être tenue responsable d'une utilisation des suggestions IA en dehors du cadre de validation professionnelle prévu.",
        },
      ],
    },
    {
      id: 'donnees',
      title: 'Article 7 — Données personnelles',
      blocks: [
        {
          type: 'p',
          text:
            "Le traitement des données personnelles est régi par la politique de confidentialité accessible sur le site. Un accord de traitement des données (Data Processing Agreement) est disponible sur simple demande à contact@clair-dossier.com pour les clients professionnels.",
        },
      ],
    },
    {
      id: 'responsabilite-cgv',
      title: 'Article 8 — Limitation de responsabilité',
      blocks: [
        {
          type: 'p',
          text:
            "La responsabilité de ClairDossier ne peut être engagée qu'en cas de manquement à ses obligations contractuelles. Elle est expressément limitée aux dommages directs et plafonnée au montant des sommes effectivement versées par le Client au titre des douze derniers mois.",
        },
        {
          type: 'p',
          text:
            "ClairDossier ne saurait être tenue responsable des décisions prises par le Client ou par les avocats habilités sur la base de dossiers structurés via le Service.",
        },
      ],
    },
    {
      id: 'droit',
      title: 'Article 9 — Droit applicable et juridiction',
      blocks: [
        {
          type: 'p',
          text:
            "Les présentes CGV sont régies par le droit français. Tout litige relatif à leur interprétation ou à leur exécution sera porté devant les tribunaux compétents de Paris, sauf disposition impérative contraire.",
        },
      ],
    },
  ],
};

const politiqueConfidentialite: LegalPage = {
  slug: 'politique-confidentialite',
  title: 'Politique de confidentialité',
  metaDescription:
    "Politique de confidentialité ClairDossier — données collectées, finalités, base légale, durées de conservation, vos droits RGPD.",
  lastUpdate: '2026-05-26',
  intro:
    "ClairDossier traite des données personnelles dans le strict respect du Règlement général sur la protection des données (RGPD) et de la loi française Informatique et Libertés. Cette politique décrit les données collectées, leurs finalités, et les droits dont vous disposez.",
  sections: [
    {
      id: 'responsable',
      title: 'Responsable du traitement',
      blocks: [
        {
          type: 'p',
          text:
            "Le responsable du traitement des données personnelles collectées sur clair-dossier.com est Nouh BENZIDANE, entrepreneur individuel (13'UP AGENCY), SIREN 899 453 401, dont le siège est situé 54 rue de la République, 13002 Marseille. Pour toute question relative à la protection de vos données : contact@clair-dossier.com.",
        },
      ],
    },
    {
      id: 'donnees-collectees',
      title: 'Données collectées',
      blocks: [
        { type: 'p', text: 'Nous collectons les catégories de données suivantes :' },
        {
          type: 'list',
          items: [
            "Données de compte : nom, prénom, adresse électronique, mot de passe (chiffré), structure professionnelle éventuelle.",
            "Données de dossier : informations renseignées par vous dans le cadre de la constitution d'un dossier juridique (typologie, contexte, dates, pièces jointes).",
            "Données de paiement : traitées par notre prestataire Stripe (les coordonnées bancaires ne transitent jamais par nos serveurs).",
            "Données techniques : adresse IP, type de navigateur, journaux de connexion, conservés à des fins de sécurité.",
          ],
        },
      ],
    },
    {
      id: 'finalites',
      title: 'Finalités du traitement',
      blocks: [
        {
          type: 'list',
          items: [
            "Fournir le Service ClairDossier (gestion du compte, structuration des dossiers, suivi des statuts).",
            "Assurer la facturation et la gestion du contrat.",
            "Permettre l'intervention d'avocats habilités lors de la validation des dossiers.",
            "Répondre aux demandes de contact et d'assistance.",
            "Garantir la sécurité du service et prévenir les fraudes.",
          ],
        },
      ],
    },
    {
      id: 'base-legale',
      title: 'Base légale',
      blocks: [
        {
          type: 'p',
          text:
            "Le traitement repose principalement sur l'exécution du contrat conclu avec vous (article 6.1.b du RGPD). Pour les finalités liées à la sécurité et à la prévention des fraudes, nous nous fondons sur notre intérêt légitime (article 6.1.f). Le traitement des données issues du formulaire de contact repose sur votre consentement explicite (article 6.1.a).",
        },
      ],
    },
    {
      id: 'destinataires',
      title: 'Destinataires des données',
      blocks: [
        {
          type: 'p',
          text:
            "Vos données sont accessibles aux équipes ClairDossier strictement habilitées dans le cadre de leurs missions. Sont également destinataires, pour les seules opérations nécessaires :",
        },
        {
          type: 'list',
          items: [
            "OVHcloud (hébergement et stockage) — France.",
            "Stripe Payments Europe Ltd. (gestion des paiements) — Irlande.",
            "Les avocats habilités que vous saisissez pour la validation d'un dossier.",
            "Les éventuels sous-traitants techniques (mail transactionnel, monitoring) listés dans le registre des sous-traitants, fourni sur demande.",
          ],
        },
        {
          type: 'p',
          text:
            "Aucune donnée n'est transférée en dehors de l'Union européenne. Aucune donnée n'est cédée à des tiers à des fins commerciales.",
        },
      ],
    },
    {
      id: 'conservation',
      title: 'Durée de conservation',
      blocks: [
        {
          type: 'list',
          items: [
            "Données de compte : pendant toute la durée du contrat, puis 12 mois après résiliation.",
            "Données de dossier : pendant la durée du contrat ; à la résiliation, vous disposez de 30 jours pour exporter, puis les données sont anonymisées ou supprimées.",
            "Données de facturation : conservées 10 ans à des fins légales (Code de commerce, article L. 123-22).",
            "Journaux de connexion : 12 mois (loi pour la confiance dans l'économie numérique).",
          ],
        },
      ],
    },
    {
      id: 'vos-droits',
      title: 'Vos droits',
      blocks: [
        { type: 'p', text: 'Vous disposez à tout moment des droits suivants sur vos données :' },
        {
          type: 'list',
          items: [
            "Droit d'accès et de rectification.",
            "Droit à l'effacement (« droit à l'oubli »).",
            "Droit à la portabilité de vos données (export ZIP intégral disponible depuis l'espace compte).",
            "Droit d'opposition au traitement.",
            "Droit de limitation du traitement.",
            "Droit de retirer votre consentement à tout moment.",
          ],
        },
        {
          type: 'p',
          text:
            "Pour exercer ces droits, contactez-nous à contact@clair-dossier.com en précisant votre demande. Une réponse vous est apportée sous 30 jours maximum. Si la réponse ne vous satisfait pas, vous pouvez introduire une réclamation auprès de la CNIL (www.cnil.fr).",
        },
      ],
    },
    {
      id: 'securite',
      title: 'Sécurité',
      blocks: [
        {
          type: 'p',
          text:
            "Vos données sont protégées par un chiffrement AES-256 au repos et TLS 1.3 en transit. L'accès aux données est strictement limité au personnel habilité, avec authentification à deux facteurs obligatoire pour les administrateurs. Un audit de sécurité indépendant est réalisé chaque année. Les détails techniques sont disponibles sur la page Sécurité du site.",
        },
      ],
    },
  ],
};

const cookies: LegalPage = {
  slug: 'cookies',
  title: 'Cookies',
  metaDescription:
    "Politique cookies ClairDossier — cookies techniques uniquement, aucun cookie de mesure d'audience ou marketing tiers.",
  lastUpdate: '2026-05-26',
  intro:
    "Le site clair-dossier.com utilise un nombre minimal de cookies, strictement nécessaires au fonctionnement du service. Aucun cookie marketing, publicitaire ou de mesure d'audience tierce n'est déposé sans votre consentement explicite.",
  sections: [
    {
      id: 'cest-quoi',
      title: "Qu'est-ce qu'un cookie ?",
      blocks: [
        {
          type: 'p',
          text:
            "Un cookie est un petit fichier déposé sur votre terminal (ordinateur, tablette, smartphone) lorsque vous consultez un site web. Il permet au site de mémoriser certaines informations sur votre visite (préférences d'affichage, état de connexion, panier, etc.).",
        },
      ],
    },
    {
      id: 'cookies-utilises',
      title: 'Cookies utilisés par ClairDossier',
      blocks: [
        {
          type: 'p',
          text:
            "Nous utilisons exclusivement des cookies dits « strictement nécessaires », exemptés de consentement préalable conformément à l'article 82 de la loi Informatique et Libertés et à la délibération CNIL n° 2020-091 :",
        },
        {
          type: 'list',
          items: [
            "Cookie de session — maintient votre connexion authentifiée pendant votre utilisation du service. Durée : session du navigateur.",
            "Cookie de préférence — mémorise vos choix d'interface (thème, langue). Durée : 1 an.",
            "Cookie de sécurité — protège contre les attaques CSRF lors des soumissions de formulaire. Durée : session.",
          ],
        },
      ],
    },
    {
      id: 'cookies-tiers',
      title: 'Cookies tiers',
      blocks: [
        {
          type: 'p',
          text:
            "Aucun cookie tiers n'est déposé par défaut. Si vous utilisez le portail de paiement Stripe, ce dernier peut déposer ses propres cookies de sécurité dans le cadre strict du traitement de votre paiement (politique Stripe : stripe.com/cookies-policy).",
        },
        {
          type: 'p',
          text:
            "Nous n'utilisons aucun outil d'analytics tiers (Google Analytics, Matomo Cloud, etc.). Si nous souhaitons activer un suivi de fréquentation à l'avenir, votre consentement sera demandé via une bannière dédiée.",
        },
      ],
    },
    {
      id: 'gestion',
      title: 'Gérer vos cookies',
      blocks: [
        {
          type: 'p',
          text:
            "Vous pouvez configurer votre navigateur pour refuser tout ou partie des cookies. Cette configuration ne nous est pas signalée et peut affecter le fonctionnement du service (notamment la connexion à votre espace).",
        },
        {
          type: 'list',
          items: [
            "Chrome : Paramètres → Confidentialité et sécurité → Cookies.",
            "Firefox : Paramètres → Vie privée et sécurité → Cookies et données de sites.",
            "Safari : Préférences → Confidentialité → Gérer les données de sites web.",
            "Edge : Paramètres → Cookies et autorisations de sites.",
          ],
        },
      ],
    },
  ],
};

export const legalPages: Record<string, LegalPage> = {
  'mentions-legales': mentionsLegales,
  cgv,
  'politique-confidentialite': politiqueConfidentialite,
  cookies,
};
