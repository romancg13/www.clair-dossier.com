import type { BlogPost } from './types';

export const iaDroit: BlogPost = {
  slug: 'ia-droit',
  title: "L'IA dans le droit : assistante de préparation, pas substitut",
  metaTitle: "IA et droit — assistante de préparation, pas substitut",
  metaDescription:
    "Ce que l'IA peut et ne doit pas faire dans le droit : synthèses, chronologies, recherche jurisprudentielle vs conseil, validation, plaidoirie. Position de fond.",
  summary:
    "L'IA générative bouleverse les métiers du droit, mais une frontière reste non négociable : l'IA prépare le travail du professionnel — elle ne le remplace pas. Voici où l'IA est utile, où elle est dangereuse, et pourquoi cette frontière protège autant les avocats que leurs clients.",
  author: 'redaction',
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
      text: "C'est pourquoi ClairDossier ne produit aujourd'hui aucune analyse juridique automatisée : la plateforme organise les pièces et les informations que l'utilisateur renseigne lui-même, et laisse l'analyse au professionnel. Ce qui est réellement opérationnel est publié, daté, sur la page « État du produit ».",
    },
    {
      type: 'h3',
      text: "Valider un dossier à la place du professionnel",
    },
    {
      type: 'p',
      text: "Valider un dossier est une responsabilité juridique : elle engage l'assurance professionnelle du cabinet, la déontologie du barreau et l'avenir du client. Aucun système automatique ne peut prendre cette responsabilité à la place du professionnel.",
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
      text: "Nous avons formalisé cette frontière en interne sous une forme courte : « l'outil prépare, le professionnel décide ». Elle guide la conception de ClairDossier : les fonctions d'assistance envisagées sont pensées pour préparer le travail du professionnel, jamais pour délivrer un conseil juridique au client.",
    },
    {
      type: 'p',
      text: "Concrètement, aujourd'hui, ClairDossier rassemble les pièces, les informations et les échéances que l'utilisateur renseigne, présente un récapitulatif relu avant validation, et ne transmet rien sans son accord explicite. Aucune lecture ni exploitation automatique des pièces n'est effectuée.",
    },
    {
      type: 'quote',
      text: "L'IA augmente la capacité de l'avocat. Elle n'augmente pas son habilitation. Cette distinction est la base de toute legaltech éthique.",
    },
    { type: 'h2', text: "Ce que dit le RIN" },
    {
      type: 'p',
      text: "Le Règlement Intérieur National (RIN) de la profession d'avocat pose des principes qui s'appliquent quel que soit l'outil employé : l'avocat reste personnellement responsable des actes qu'il signe, et il est tenu à la loyauté et à l'information de son client. Le Conseil national des barreaux a par ailleurs publié des ressources sur l'usage de l'IA générative par les avocats ; il convient de se reporter aux textes et recommandations en vigueur.",
    },
    {
      type: 'p',
      text: "L'information du client sur les outils utilisés dans la préparation de son dossier relève de ce devoir de loyauté. ClairDossier, de son côté, indique clairement ce que la plateforme fait et ne fait pas, sur sa page « État du produit ».",
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
    "Le RIN rappelle la responsabilité personnelle de l'avocat sur ses actes et son devoir de loyauté envers le client, quel que soit l'outil utilisé.",
  ],
  faq: [
    {
      q: "Comment savoir si une legaltech utilise l'IA pour donner du conseil direct ?",
      a: "Lisez ses CGU et sa page d'aide. Si elle décrit des fonctionnalités où le client reçoit une analyse juridique sans intervention d'un professionnel habilité, c'est un cas d'exercice illégal. Signalez à votre barreau ou à la CNIL selon la nature du problème.",
    },
    {
      q: "L'avocat doit-il informer son client de l'usage d'IA dans son dossier ?",
      a: "L'information loyale du client relève des règles déontologiques de la profession ; en pratique, de nombreux cabinets la prévoient dans leurs conditions d'intervention. Se reporter aux textes et recommandations en vigueur (Conseil national des barreaux, barreau de rattachement).",
    },
  ],
  relatedSlugs: ['chronologie-prud-homale', 'rgpd-legaltech'],
};
