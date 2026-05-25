import type { BlogPost } from './types';

export const rgpdLegaltech: BlogPost = {
  slug: 'rgpd-legaltech',
  title: "RGPD et legaltech : où vont vraiment vos données juridiques ?",
  metaTitle: "RGPD legaltech — où vont vraiment vos données ?",
  metaDescription:
    "Cycle de vie des données dans une plateforme legaltech : hébergement, sous-traitance, conservation, suppression. Articles 28, 32, 35 RGPD expliqués.",
  summary:
    "Quand vous déposez le contrat de travail d'un salarié sur une plateforme legaltech, vous engagez la conformité RGPD du cabinet, pas seulement la vôtre. Voici comment vérifier qu'une legaltech tient ses engagements — et ce que les articles 28, 32 et 35 du RGPD exigent concrètement.",
  author: 'thomas-leclerc',
  date: '2026-04-28',
  readMinutes: 8,
  category: 'Conformité',
  tags: ['RGPD', 'protection données', 'legaltech', 'DPO'],
  heroImageQuery: 'data center server room',
  content: [
    {
      type: 'p',
      text: "Un cabinet d'avocats qui choisit une plateforme legaltech ne sous-traite pas seulement de la fonctionnalité — il sous-traite une responsabilité juridique. Le client final, lui, ne sait pas toujours ce qu'il signe en cochant « j'accepte les CGU ». Pour les deux populations, comprendre où vont les données est devenu une question de souveraineté juridique, pas un détail de notice légale.",
    },
    {
      type: 'p',
      text: "Cet article explique le cycle de vie d'une donnée juridique dans une legaltech, en détaillant les obligations issues du Règlement Général sur la Protection des Données (UE 2016/679). Il s'adresse aux avocats qui sélectionnent un outil, aux DRH qui choisissent une plateforme pour leur contentieux interne, et aux clients particuliers qui veulent savoir ce qui se passe entre le moment où ils déposent un contrat et le moment où ils décident de quitter le service.",
    },
    { type: 'h2', text: "Étape 1 : l'hébergement initial" },
    {
      type: 'p',
      text: "La première question à poser à un fournisseur legaltech, c'est où physiquement sont stockées les données. Pas « dans le cloud » — un datacenter, une ville, un pays. Toute réponse vague est une réponse à creuser. Une réponse propre ressemble à : « OVH France, datacenters de Roubaix et Strasbourg, sauvegardes redondantes uniquement sur ces deux sites. »",
    },
    {
      type: 'p',
      text: "L'enjeu n'est pas xénophobe — c'est juridique. Depuis l'arrêt Schrems II de la CJUE (16 juillet 2020), tout transfert de données personnelles vers les États-Unis est soumis à des garanties supplémentaires presque impossibles à remplir pour des données sensibles comme les données juridiques. Une legaltech qui héberge chez AWS US ou Google Cloud US engage le cabinet utilisateur dans un risque de conformité qui se matérialise lors d'un contrôle CNIL.",
    },
    { type: 'h3', text: "Ce que dit l'article 28 du RGPD" },
    {
      type: 'p',
      text: "L'article 28 régit le sous-traitant. Toute plateforme qui traite des données pour le compte d'un cabinet est juridiquement un sous-traitant — et le cabinet est le responsable de traitement. Cet article exige un contrat écrit (le DPA, Data Processing Agreement) qui précise la nature des traitements, leur durée, les mesures de sécurité et les obligations en cas de violation.",
    },
    {
      type: 'callout',
      text: "Un DPA opposable se demande avant la signature du contrat de service, pas après. C'est le premier document à exiger d'une legaltech — et le premier indicateur de son sérieux.",
      tone: 'navy',
    },
    { type: 'h2', text: "Étape 2 : les sous-traitants tiers" },
    {
      type: 'p',
      text: "Une legaltech utilise rarement uniquement son propre hébergement. Elle a besoin d'un fournisseur de mail transactionnel (pour les notifications), d'un outil de monitoring (pour la disponibilité du service), parfois d'un sous-traitant OCR (pour la lecture automatique des pièces). Chacun de ces sous-traitants est un sous-traitant ultérieur au sens du RGPD.",
    },
    {
      type: 'p',
      text: "Le RGPD impose une chaîne de responsabilité documentée. Le cabinet (responsable de traitement) → la legaltech (sous-traitant) → les outils tiers (sous-traitants ultérieurs). Chaque maillon doit être identifié, et le cabinet doit être informé en cas de changement. Les CGU d'une legaltech doivent contenir la liste à jour des sous-traitants tiers — pas dans un PDF obscur, mais dans une page publique consultable.",
    },
    { type: 'h2', text: "Étape 3 : la sécurité technique" },
    {
      type: 'p',
      text: "L'article 32 du RGPD exige des mesures de sécurité « appropriées au risque ». Pour des données juridiques — qui sont presque toujours des données sensibles ou révélant des informations sensibles — le standard minimal est :",
    },
    {
      type: 'list',
      items: [
        "Chiffrement au repos (AES-256) pour les pièces et les bases de données",
        "Chiffrement en transit (TLS 1.3) pour tous les flux entre le navigateur et le serveur",
        "Authentification forte pour les accès administrateur (2FA non négociable)",
        "Journalisation des accès aux données sensibles, avec conservation des logs 12 mois",
        "Tests de pénétration annuels par un tiers (le rapport doit être consultable)",
        "Procédure documentée de réaction en cas de violation (notification CNIL sous 72h)",
      ],
    },
    {
      type: 'p',
      text: "Une legaltech qui ne peut pas répondre point par point sur ces six éléments n'a pas le sérieux requis pour traiter des données juridiques. Ce n'est pas un jugement de valeur — c'est l'application du RGPD.",
    },
    { type: 'h2', text: "Étape 4 : l'analyse d'impact (article 35)" },
    {
      type: 'p',
      text: "L'article 35 du RGPD impose une analyse d'impact (DPIA, Data Protection Impact Assessment) pour les traitements à risque élevé. Le traitement de dossiers juridiques entre dans cette catégorie : données sensibles, profilage potentiel, surveillance possible, conséquences juridiques importantes pour les personnes concernées.",
    },
    {
      type: 'p',
      text: "Une legaltech qui n'a pas réalisé son DPIA n'est pas conforme — et le cabinet qui l'utilise hérite mécaniquement de cette non-conformité. Le DPIA doit être disponible sur demande pour le cabinet client, et son existence doit être mentionnée dans le DPA.",
    },
    { type: 'h2', text: "Étape 5 : la fin du parcours — suppression et portabilité" },
    {
      type: 'p',
      text: "Le RGPD reconnaît trois droits clés à la sortie : le droit d'accès (article 15), le droit à l'effacement (article 17, le « droit à l'oubli ») et le droit à la portabilité (article 20). Une legaltech doit permettre l'exercice de ces droits sans friction et sans condition.",
    },
    {
      type: 'p',
      text: "La portabilité signifie un export structuré, lisible par une machine, qui contient l'intégralité des données du compte. Un export PDF n'est pas suffisant ; il faut au minimum un ZIP contenant les fichiers originaux et un fichier JSON ou XML qui décrit la structure du dossier (chronologie, messages, statuts). C'est la portabilité réelle — pas l'apparence de portabilité.",
    },
    {
      type: 'quote',
      text: "Une donnée juridique conservée dans une legaltech reste votre donnée. Le jour où vous voulez partir, vous devez pouvoir partir avec tout — pas avec un PDF récapitulatif qui ne ressemble plus à votre dossier.",
    },
    { type: 'h2', text: "Ce que cela signifie pour ClairDossier" },
    {
      type: 'p',
      text: "Nous avons construit ClairDossier en partant du RGPD, pas en l'ajoutant à la fin. Hébergement OVH France exclusif, chiffrement AES-256 au repos, TLS 1.3 en transit, DPA standard et version renforcée pour les plans Entreprise, DPIA disponible, audit annuel par un cabinet de sécurité tiers indépendant, export ZIP intégral à tout moment, suppression de compte avec anonymisation sous 30 jours.",
    },
    {
      type: 'p',
      text: "Ces engagements sont consultables et vérifiables sur notre page Sécurité. Vous pouvez les opposer à n'importe quel cabinet, n'importe quel DPO, n'importe quel auditeur. C'est notre définition de la conformité : pas un slogan, des documents.",
    },
  ],
  takeaways: [
    "Toujours exiger un DPA opposable avant de signer un contrat de service legaltech.",
    "Vérifier la localisation physique des données — France ou UE, jamais ailleurs pour des données juridiques.",
    "Demander la liste à jour des sous-traitants tiers et leurs propres DPA.",
    "Tester la portabilité réelle : un export ZIP structuré, pas un PDF récapitulatif.",
  ],
  faq: [
    {
      q: "Que faire si ma legaltech actuelle n'a pas de DPA ?",
      a: "Demandez-le par écrit. Si elle ne peut pas en fournir un, vous êtes en non-conformité — et le risque vous revient. Trois mois est un délai raisonnable pour migrer vers une solution conforme.",
    },
    {
      q: "Le RGPD s'applique-t-il aux dossiers archivés ?",
      a: "Oui, sans exception. Un dossier archivé reste un traitement de données personnelles. Les obligations de sécurité, de conservation limitée et de suppression continuent de s'appliquer jusqu'à l'effacement effectif.",
    },
  ],
  relatedSlugs: ['ia-droit', 'chronologie-prud-homale'],
};
