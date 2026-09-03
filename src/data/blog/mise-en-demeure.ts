import type { BlogPost } from './types';

export const miseEnDemeure: BlogPost = {
  slug: 'mise-en-demeure',
  title: "Mise en demeure : le courrier qui débloque (souvent) la situation",
  metaTitle: "Mise en demeure — guide pratique et erreurs à éviter",
  metaDescription:
    "La mise en demeure est l'étape qui précède le contentieux. Pourquoi elle fonctionne, comment la rédiger, les cinq erreurs à éviter.",
  summary:
    "Avant tout procès, la loi française demande presque toujours d'avoir tenté un règlement amiable. La mise en demeure est l'outil principal de cette tentative. Bien rédigée, elle débloque souvent la situation sans aller plus loin. Mal rédigée, elle peut être inopposable et faire perdre un temps précieux.",
  author: 'redaction',
  date: '2026-04-15',
  readMinutes: 8,
  category: 'Procédure amiable',
  tags: ['mise en demeure', 'recouvrement', 'procédure amiable', 'modèle'],
  heroImageQuery: 'registered letter signature',
  content: [
    {
      type: 'p',
      text:
        "Vous avez prêté de l'argent à un proche qui ne rend rien. Votre locataire ne paye plus les charges depuis trois mois. Un prestataire vous a livré un travail bâclé. Avant de saisir le tribunal, le réflexe juridique français est presque toujours le même : envoyer une mise en demeure. Ce courrier formel a une efficacité psychologique réelle — il signale à la partie adverse que vous êtes prêt à aller plus loin — mais aussi une portée juridique précise.",
    },
    { type: 'h2', text: "Qu'est-ce qu'une mise en demeure" },
    {
      type: 'p',
      text:
        "Une mise en demeure est un courrier par lequel un créancier (vous) somme un débiteur (l'autre partie) d'exécuter une obligation dans un délai déterminé, à défaut de quoi des poursuites judiciaires seront engagées. C'est l'article 1344 du Code civil qui la consacre depuis la réforme de 2016 du droit des contrats.",
    },
    {
      type: 'p',
      text:
        "Elle se distingue de la simple relance (un mail de rappel) et de la sommation par huissier (acte juridique plus formel et plus coûteux). C'est l'étape intermédiaire : ferme dans le ton, légère dans le coût, lourde de conséquences juridiques.",
    },
    { type: 'h2', text: 'Trois cas où la mise en demeure marche' },
    {
      type: 'list',
      items: [
        "Impayés (loyer, facture, prêt entre particuliers) — quand la dette est claire et que le débiteur a simplement laissé traîner.",
        "Inexécution de prestation (artisan, prestataire, fournisseur) — quand vous avez payé et que la prestation est partielle ou défectueuse.",
        "Trouble du voisinage (bruit récurrent, débordement, occupation indue) — quand vous voulez formaliser l'avertissement avant action en justice.",
      ],
    },
    {
      type: 'p',
      text:
        "Dans ces trois cas, environ deux tiers des destinataires régularisent dans le délai imparti ou ouvrent une négociation amiable. Le tiers restant rend la situation lisible : l'autre partie refuse explicitement, ce qui ouvre la voie au contentieux dans des conditions claires.",
    },
    { type: 'h2', text: 'La forme : ce qui rend la lettre opposable' },
    {
      type: 'p',
      text:
        "Pour être pleinement efficace juridiquement — c'est-à-dire faire courir les intérêts moratoires et constituer une preuve devant un juge —, la mise en demeure doit respecter une forme précise.",
    },
    {
      type: 'h3',
      text: 'Lettre recommandée avec accusé de réception',
    },
    {
      type: 'p',
      text:
        "C'est le canal standard. L'AR prouve que le destinataire a reçu (ou refusé de recevoir) le courrier. Coût : environ 6 à 8 euros à La Poste. Une lettre recommandée électronique (LRE) via un service certifié a la même valeur juridique depuis le décret de 2018, à coût équivalent ou inférieur.",
    },
    {
      type: 'h3',
      text: 'Mentions obligatoires',
    },
    {
      type: 'list',
      items: [
        "Identité complète de l'expéditeur (vous) et du destinataire.",
        "Référence claire à l'obligation invoquée (contrat, facture, courrier précédent).",
        "Description précise de ce qui est demandé.",
        "Délai accordé pour s'exécuter (généralement 8 à 15 jours).",
        "Mention « Mise en demeure » dans l'objet ou en haut du courrier.",
        "Annonce de la conséquence : « à défaut, je saisirai la juridiction compétente ».",
        "Date et signature.",
      ],
    },
    { type: 'h2', text: 'Cinq erreurs courantes' },
    {
      type: 'p',
      text:
        "Ces erreurs reviennent fréquemment dans les dossiers d'impayés. Toutes sont évitables.",
    },
    {
      type: 'list',
      items: [
        "Envoyer en lettre simple ou par email — aucune preuve de réception, la mise en demeure n'est pas opposable.",
        "Omettre la mention « mise en demeure » et présenter le courrier comme une « relance amicale » — le juge ne reconnaît pas la qualification.",
        "Donner un délai déraisonnable (24 heures, ou aucun délai) — le destinataire peut faire valoir que le délai était irréaliste.",
        "Mélanger plusieurs réclamations sans les distinguer — la mise en demeure doit être précise sur ce qui est dû.",
        "Menacer de manière disproportionnée (« je vais vous traîner devant tous les tribunaux ») — la menace doit être proportionnée et juridiquement fondée.",
      ],
    },
    { type: 'h2', text: "Modèle commenté" },
    {
      type: 'p',
      text:
        "Voici la structure que nous recommandons. Elle tient sur une page A4 et couvre la plupart des situations courantes ; faites-la relire par un professionnel du droit si l'enjeu le justifie.",
    },
    {
      type: 'callout',
      text:
        "« Objet : Mise en demeure de [payer la somme de X / exécuter telle obligation]. Madame, Monsieur, Par la présente, je vous mets en demeure de [action attendue] dans un délai de [8 / 15 jours] à compter de la réception du présent courrier. Cette obligation résulte de [référence précise : contrat du …, facture n°…, etc.]. À défaut d'exécution dans ce délai, je me verrai contraint de saisir la juridiction compétente, et de réclamer en sus les intérêts moratoires courus depuis [date], ainsi que les frais éventuels de procédure. Veuillez agréer, etc. »",
      tone: 'navy',
    },
    {
      type: 'p',
      text:
        "À adapter selon la situation. Pour un dossier complexe ou un montant supérieur à 5 000 euros, une relecture par un avocat avant envoi est recommandée. Vingt minutes de relecture peuvent valoir des semaines de procédure.",
    },
  ],
  takeaways: [
    "La mise en demeure est l'étape amiable qui précède le contentieux — elle est exigée dans la plupart des dossiers civils.",
    "Lettre recommandée avec AR (ou LRE certifiée) : sans preuve de réception, la lettre n'est pas opposable.",
    "Délai raisonnable : 8 à 15 jours minimum. 24 heures = inopposable.",
    "Mentionner explicitement « mise en demeure » et l'action attendue, précise et chiffrée.",
  ],
  faq: [
    {
      q: "Quel délai laisser entre la mise en demeure et la saisine du tribunal ?",
      a: "Le délai mentionné dans la mise en demeure doit être respecté. Au minimum 8 jours pour une dette claire, 15 à 30 jours pour des obligations complexes. Ne saisissez jamais le tribunal avant l'expiration du délai annoncé.",
    },
    {
      q: "Peut-on envoyer une mise en demeure par email ?",
      a: "Un simple email n'a pas de force probante suffisante. Pour un effet juridique pleinement opposable, utilisez une lettre recommandée avec AR (papier) ou une LRE certifiée par un prestataire qualifié (Aralis, LRE La Poste, etc.). Un email peut compléter mais ne remplace pas.",
    },
    {
      q: "Est-ce que la mise en demeure fait courir des intérêts ?",
      a: "Oui, pour une dette d'argent, la mise en demeure fait courir les intérêts moratoires au taux légal (article 1344-1 du Code civil) à compter de sa réception, ou à la date stipulée dans le contrat si elle est plus favorable au créancier.",
    },
  ],
  howTo: {
    name: 'Rédiger une mise en demeure',
    description:
      "Structure et mentions obligatoires d'une mise en demeure opposable juridiquement, conforme à l'article 1344 du Code civil.",
    totalTime: 'PT20M',
    steps: [
      { name: "Identifier l'expéditeur et le destinataire", text: 'Indiquer noms, prénoms, adresses postales complètes des deux parties, et qualité (créancier, locataire, particulier, etc.).' },
      { name: "Référencer l'obligation invoquée", text: "Citer précisément le contrat, la facture, le courrier ou la disposition légale qui fonde la créance ou l'obligation." },
      { name: "Décrire l'action attendue", text: "Formuler de manière précise ce qui est demandé (paiement d'une somme chiffrée, exécution d'une prestation, cessation d'un trouble)." },
      { name: 'Fixer un délai raisonnable', text: 'Accorder un délai de 8 à 15 jours minimum à compter de la réception. Un délai trop court (24 h) rend la mise en demeure inopposable.' },
      { name: 'Mentionner explicitement « mise en demeure »', text: "Inscrire la qualification dans l'objet du courrier ou en première ligne pour que la portée juridique soit reconnue." },
      { name: 'Annoncer la conséquence', text: "Indiquer qu'à défaut d'exécution dans le délai, la juridiction compétente sera saisie et les intérêts moratoires courus seront réclamés." },
      { name: 'Envoyer en LRAR ou LRE certifiée', text: "Utiliser la lettre recommandée avec accusé de réception (papier, 6-8 €) ou une lettre recommandée électronique certifiée. Un email simple ne suffit pas." },
    ],
  },
  relatedSlugs: ['preparer-rendez-vous-avocat', 'conservation-documents', 'mediation-contentieux'],
};
