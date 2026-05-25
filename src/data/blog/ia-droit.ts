import type { BlogPost } from './types';

export const iaDroit: BlogPost = {
  slug: 'ia-droit',
  title: "L'IA dans le droit : assistante de préparation, pas substitut",
  metaTitle: "IA et droit — assistante de préparation, pas substitut",
  metaDescription:
    "Ce que l'IA peut et ne doit pas faire dans le droit : synthèses, chronologies, recherche jurisprudentielle vs conseil, validation, plaidoirie. Position de fond.",
  summary:
    "L'IA générative bouleverse les métiers du droit, mais une frontière reste non négociable : l'IA prépare le travail du professionnel — elle ne le remplace pas. Voici où l'IA est utile, où elle est dangereuse, et pourquoi cette frontière protège autant les avocats que leurs clients.",
  author: 'helene-vasseur',
  date: '2026-05-02',
  readMinutes: 7,
  category: 'IA et droit',
  tags: ['IA', 'déontologie', 'pratique professionnelle', 'RIN'],
  heroImageQuery: 'judge desk justice',
  content: [
    {
      type: 'p',
      text: "Depuis 2023, chaque conférence d'avocats finit par sa question fatigante : « l'IA va-t-elle remplacer le métier ? ». La réponse honnête est insatisfaisante pour ceux qui veulent un titre de presse. Non, l'IA ne remplace pas le métier d'avocat. Oui, l'IA change profondément les conditions d'exercice de ce métier. Et ces deux propositions ne sont pas contradictoires.",
    },
    {
      type: 'p',
      text: "Cet article expose ce que l'IA fait bien dans le droit, ce qu'elle ne doit pas faire — ni techniquement, ni déontologiquement — et pourquoi cette frontière est devenue le principe de conception de toute legaltech sérieuse. Notamment de ClairDossier.",
    },
    { type: 'h2', text: "Ce que l'IA fait bien (très bien, parfois)" },
    {
      type: 'h3',
      text: "Les synthèses de pièces volumineuses",
    },
    {
      type: 'p',
      text: "Une expertise judiciaire de 80 pages, des conclusions adverses de 50 pages, une jurisprudence régulièrement abondante. L'avocat doit lire — mais il peut commencer par une synthèse IA, qui dégage les points saillants, repère les contradictions internes, identifie les références citées. La lecture humaine reste indispensable. Mais elle commence orientée, pas à l'aveugle.",
    },
    {
      type: 'h3',
      text: "La construction d'une chronologie à partir de pièces",
    },
    {
      type: 'p',
      text: "Nous l'avons développé dans un article précédent : la chronologie est l'ossature d'un dossier. Construire une chronologie à la main demande une heure de travail technique sans valeur juridique propre. L'IA le fait en trois minutes. L'avocat valide, corrige, requalifie. Le temps économisé est rendu à la stratégie.",
    },
    {
      type: 'h3',
      text: "La recherche jurisprudentielle ciblée",
    },
    {
      type: 'p',
      text: "Trouver l'arrêt pertinent dans le bon visa, avec la bonne formulation, à partir d'une situation factuelle. C'est une compétence qu'on apprend en cinq ans de pratique. L'IA y arrive en quelques secondes — à condition qu'elle soit branchée sur une base jurisprudentielle vérifiable (Légifrance, Doctrine, Lexbase), et non sur sa seule mémoire d'entraînement.",
    },
    {
      type: 'callout',
      text: "Une IA juridique qui cite une jurisprudence sans donner sa référence Cassation est une IA qui hallucine. C'est le premier test à faire avant d'adopter un outil.",
      tone: 'gold',
    },
    {
      type: 'h3',
      text: "La détection d'incohérences dans le récit client",
    },
    {
      type: 'p',
      text: "Le client raconte. Il est sincère. Mais sa mémoire reconstruit les dates, fusionne deux évènements, oublie un précédent. L'IA compare son récit avec les pièces déposées et signale les écarts. L'avocat peut alors creuser ces écarts en consultation, dans la sincérité — pas dans la suspicion.",
    },
    { type: 'h2', text: "Ce que l'IA ne doit jamais faire" },
    {
      type: 'h3',
      text: "Donner un conseil juridique au client en direct",
    },
    {
      type: 'p',
      text: "Une IA qui dit à un client « vous avez des chances de gagner ce dossier prud'homal », c'est une IA qui exerce illégalement la profession d'avocat. C'est puni par l'article 4 de la loi du 31 décembre 1971. C'est aussi une mise en danger du client : un conseil juridique sans validation professionnelle peut orienter une décision majeure sur des bases erronées.",
    },
    {
      type: 'p',
      text: "ClairDossier interdit techniquement ce cas d'usage. Les outputs IA sont accessibles uniquement à un avocat habilité, dans son espace professionnel. Le client ne voit jamais une analyse juridique générée par IA — il voit l'analyse validée par son avocat.",
    },
    {
      type: 'h3',
      text: "Valider un dossier à la place du professionnel",
    },
    {
      type: 'p',
      text: "Aucun dossier ne quitte le statut « brouillon » sans la signature d'un avocat habilité. Cette signature est une responsabilité juridique. Elle engage l'assurance professionnelle du cabinet, elle engage la déontologie du barreau, elle engage l'avenir du client. Aucun système automatique ne peut prendre cette responsabilité — et tout système qui prétend le pouvoir doit être refusé.",
    },
    {
      type: 'h3',
      text: "Plaider, négocier, représenter",
    },
    {
      type: 'p',
      text: "L'IA peut préparer une trame de plaidoirie, suggérer une stratégie de négociation, modéliser un quantum de transaction. Elle ne peut pas se substituer à la présence humaine devant un tribunal, à la lecture en temps réel d'une partie adverse, à l'arbitrage éthique d'un compromis qui engage la dignité du client.",
    },
    { type: 'h2', text: "La position éthique de ClairDossier" },
    {
      type: 'p',
      text: "Nous avons formalisé cette frontière en interne sous une forme courte : « l'IA prépare, l'avocat décide ». Cette formule n'est pas un slogan — c'est une règle technique. Chaque fonctionnalité IA de ClairDossier est conçue pour produire un livrable destiné à l'avocat, jamais au client en direct.",
    },
    {
      type: 'p',
      text: "Le brief préparatoire avant consultation est un document interne. Les suggestions de qualification juridique sont des hypothèses présentées à l'avocat. Les références jurisprudentielles sont sourcées et vérifiables. Aucune décision juridique ne sort de ClairDossier sans la signature électronique d'un professionnel habilité.",
    },
    {
      type: 'quote',
      text: "L'IA augmente la capacité de l'avocat. Elle n'augmente pas son habilitation. Cette distinction est la base de toute legaltech éthique.",
    },
    { type: 'h2', text: "Ce que dit le RIN" },
    {
      type: 'p',
      text: "Le Règlement Intérieur National des avocats, dans sa version actualisée 2024, intègre des dispositions explicites sur l'usage de l'IA générative. L'article 6.3.1 rappelle que l'avocat reste personnellement responsable du contenu de tout acte qu'il signe, quel qu'en soit l'auteur initial — y compris quand cet auteur est un système automatique.",
    },
    {
      type: 'p',
      text: "L'article 11.5 impose une transparence vis-à-vis du client quant à l'usage d'outils automatisés dans la préparation de son dossier. ClairDossier respecte cette obligation par défaut : le client est informé, au moment de la création de son compte, que des outils d'assistance peuvent être utilisés par l'avocat assigné, et qu'aucun de ces outils ne se substitue à la validation professionnelle.",
    },
    { type: 'h2', text: "L'avenir, raisonnablement" },
    {
      type: 'p',
      text: "L'IA va continuer de progresser. Les synthèses seront meilleures, les chronologies plus rapides, la recherche jurisprudentielle plus fine. Mais la frontière ne bougera pas — parce qu'elle ne dépend pas de la qualité de l'IA. Elle dépend de la nature même du droit : un système juridique repose sur l'engagement d'une personne responsable, qui assume ses actes et qui peut être appelée à en répondre.",
    },
    {
      type: 'p',
      text: "L'IA peut aider cette personne. Elle ne peut pas la remplacer. Et toute legaltech qui prétend le contraire mérite d'être interrogée — par les barreaux, par les clients, et par les régulateurs.",
    },
  ],
  takeaways: [
    "L'IA excelle sur synthèses, chronologies, recherche jurisprudentielle et détection d'incohérences.",
    "Conseil juridique direct au client, validation du dossier et plaidoirie restent hors champ de l'IA.",
    "Toute référence jurisprudentielle IA sans citation vérifiable est une hallucination potentielle.",
    "Le RIN 2024 impose la responsabilité personnelle de l'avocat et la transparence sur l'usage d'outils IA.",
  ],
  faq: [
    {
      q: "Comment savoir si une legaltech utilise l'IA pour donner du conseil direct ?",
      a: "Lisez ses CGU et sa page d'aide. Si elle décrit des fonctionnalités où le client reçoit une analyse juridique sans intervention d'un professionnel habilité, c'est un cas d'exercice illégal. Signalez à votre barreau ou à la CNIL selon la nature du problème.",
    },
    {
      q: "L'avocat doit-il informer son client de l'usage d'IA dans son dossier ?",
      a: "Oui, depuis la mise à jour 2024 du RIN. L'information peut être générique (dans les CGU du cabinet) ou spécifique (au cas par cas). ClairDossier la fournit par défaut à l'inscription du client.",
    },
  ],
  relatedSlugs: ['chronologie-prud-homale', 'rgpd-legaltech'],
};
