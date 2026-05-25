import type { FeatureIconKey } from '../components/icons';

export type Feature = {
  slug: string;
  title: string;
  shortTitle: string;
  icon: FeatureIconKey;
  blurb: string;
  hero: string;
  body: string[];
  bullets: string[];
};

export const features: Feature[] = [
  {
    slug: 'creation-guidee',
    title: 'Création guidée par typologie',
    shortTitle: 'Création guidée',
    icon: 'form-guide',
    blurb:
      "Un formulaire intelligent qui s'adapte à la nature du dossier — prud'hommes, bail, recouvrement — et collecte les bonnes informations dès le départ.",
    hero:
      "Le bon dossier commence par les bonnes questions. ClairDossier en pose 12 — pas 80.",
    body: [
      "La plupart des plateformes juridiques font remplir un formulaire générique de 80 champs. Résultat : 60 % des champs sont laissés vides, 30 % sont mal renseignés, et l'avocat doit recommencer l'instruction. Notre approche est inverse — partir de la typologie pour ne demander que ce qui est strictement utile à l'analyse.",
      "À l'ouverture, le formulaire détermine la nature du dossier : litige commercial, conflit de travail, problème locatif, contestation administrative. Les questions suivantes sont conditionnelles. Un dossier prud'homal n'a pas besoin du DPE du logement ; un litige locatif n'a pas besoin du contrat de travail.",
      "Chaque champ contient une micro-aide rédigée par un juriste, qui explique pourquoi cette information est demandée. Quand le client comprend l'utilité, il répond. Quand il répond, l'avocat instruit plus vite.",
      "Le formulaire enregistre automatiquement en brouillon toutes les 30 secondes. Vous pouvez quitter, revenir, finir depuis le mobile. Le dossier suit votre rythme — pas l'inverse.",
    ],
    bullets: [
      "12 typologies juridiques couvertes au lancement",
      "Champs conditionnels selon la nature du dossier",
      "Micro-aide juridique rédigée par juriste sur chaque champ",
      "Sauvegarde brouillon automatique toutes les 30 secondes",
    ],
  },
  {
    slug: 'pieces-ocr',
    title: 'Pièces jointes avec OCR et indexation',
    shortTitle: 'Pièces & OCR',
    icon: 'scan-ocr',
    blurb:
      "Déposez vos pièces — contrats, courriers, factures. ClairDossier les renomme, les indexe et extrait les dates clés.",
    hero:
      "Vos pièces ne sont pas un fourre-tout. ClairDossier les lit, les nomme, les classe.",
    body: [
      "Un dossier juridique vit ou meurt par ses pièces. Et la première cause de retard, ce sont les pièces mal nommées, sans ordre, sans lien avec la chronologie. Notre OCR adresse ce point précis.",
      "Quand vous déposez un document — PDF, scan, photo de courrier — le moteur d'OCR extrait le texte, identifie le type (contrat, courrier, facture, attestation), repère les dates pertinentes et la signature éventuelle. La pièce est alors renommée selon une convention claire : `2024-03-15_courrier_employeur.pdf`. Vous ne reverrez plus jamais un `IMG_0421.jpg` dans un dossier ClairDossier.",
      "Chaque pièce est ensuite reliée automatiquement à la chronologie du dossier. Une lettre de licenciement datée du 15 mars apparaît sur la timeline à cette date, prête à être consultée en deux clics.",
      "Le moteur reconnaît les principaux formats de pièces juridiques françaises : courriers RAR, citations à comparaître, conclusions adverses, expertises judiciaires, contrats CDI/CDD/freelance. Si le format est inconnu, vous renommez manuellement — votre travail est conservé.",
    ],
    bullets: [
      "OCR français entraîné sur les pièces juridiques courantes",
      "Renommage automatique selon convention `YYYY-MM-DD_type_partie`",
      "Reliure automatique à la chronologie du dossier",
      "Stockage chiffré AES-256, bucket privé par dossier",
    ],
  },
  {
    slug: 'chronologie',
    title: 'Chronologie auto-construite',
    shortTitle: 'Chronologie',
    icon: 'timeline',
    blurb:
      "Une frise visuelle qui assemble seule les dates clés du dossier à partir des pièces et des réponses du client.",
    hero:
      "La chronologie compte plus que les arguments. ClairDossier la construit pendant que le client raconte.",
    body: [
      "Tout avocat sait que la première chose à faire face à un dossier nouveau, c'est de remettre les faits dans l'ordre. Cinq minutes de chronologie claire évitent deux heures de relecture confuse. ClairDossier transforme cette discipline en automatisme.",
      "À chaque réponse du client et à chaque pièce déposée, les dates sont extraites et placées sur une frise visuelle. Le contrat de travail entre à la date de signature ; la lettre de mise en demeure entre à la date d'envoi ; la convocation entre à la date prévue. Le client peut ajouter manuellement des évènements oraux (réunion, appel, refus verbal).",
      "La frise reste éditable. L'avocat peut requalifier un évènement, en ajouter, en supprimer, ou créer un point de bascule (rupture du contrat, mise en demeure, saisine du tribunal). Chaque ajustement reste tracé dans le journal d'audit.",
      "À l'export, la chronologie devient un document PDF utilisable en pièce 1 du dossier. Lisible par le tribunal, exploitable par l'avocat adverse — et fidèle à ce que le client a transmis.",
    ],
    bullets: [
      "Extraction automatique des dates depuis pièces et réponses",
      "Frise éditable et requalifiable par l'avocat",
      "Journal d'audit complet de toutes les modifications",
      "Export PDF prêt à servir de pièce 1 au dossier",
    ],
  },
  {
    slug: 'ia-preparatoire',
    title: 'Question IA préparatoire',
    shortTitle: 'IA préparatoire',
    icon: 'ai-brief',
    blurb:
      "Avant la consultation, l'IA prépare un brief : faits saillants, points de droit potentiels, questions à poser. L'avocat valide, ajuste ou rejette.",
    hero:
      "L'IA prépare. L'avocat décide. Cette frontière est notre charte.",
    body: [
      "ClairDossier intègre une assistance IA, mais notre position est nette : l'IA ne donne jamais de conseil juridique au client. Elle prépare le travail de l'avocat — synthèse des faits, identification des points de droit potentiels, suggestions de questions à creuser, repérage des incohérences dans le récit client.",
      "Avant chaque consultation programmée, l'avocat reçoit un brief synthétique de deux pages maximum. Il l'ouvre, il lit, il garde ce qui l'aide, il barre ce qui est faux. Le brief n'est jamais transmis au client en l'état — c'est un outil interne, un brouillon pour le professionnel.",
      "Les suggestions sont annotées : tel point de droit suggéré renvoie à tel article du Code du travail, telle jurisprudence est citée avec sa référence Cassation. L'avocat sait d'où vient chaque suggestion et peut la vérifier en un clic.",
      "Cette frontière — l'IA prépare, l'avocat décide — n'est pas un slogan marketing. C'est une exigence déontologique du RIN (Règlement Intérieur National des avocats). ClairDossier la respecte techniquement, pas seulement contractuellement.",
    ],
    bullets: [
      "Brief synthétique de 2 pages par consultation préparée",
      "Citations sourcées (Code, Cassation, jurisprudence vérifiable)",
      "Jamais transmis au client en l'état — outil interne avocat",
      "Conformité RIN : l'IA ne délivre pas de conseil",
    ],
  },
  {
    slug: 'validation-avocat',
    title: 'Validation avocat en un clic',
    shortTitle: 'Validation pro',
    icon: 'validate',
    blurb:
      "Quand le dossier est prêt, l'avocat habilité valide, demande une pièce, ou refuse avec motif. Le client est notifié dans la minute.",
    hero:
      "Un dossier non validé n'est pas un dossier. La signature d'un professionnel habilité est le seul tampon qui compte.",
    body: [
      "Aucun dossier ne quitte le brouillon sans une décision d'un avocat habilité. C'est notre principe fondateur : ClairDossier n'est pas un cabinet, ClairDossier est une plateforme qui prépare les dossiers pour des cabinets.",
      "L'avocat reçoit le dossier complet sur son espace : chronologie, pièces, brief IA, demandes du client. Il dispose de trois actions claires : valider (le dossier passe en statut `Validé`), demander une pièce ou une précision (statut `En attente de pièces`), refuser avec motif (statut `Refusé` avec explication transmise au client).",
      "Chaque décision est tracée. La signature électronique de l'avocat est jointe au statut, avec horodatage. Le client voit qui a validé, à quelle date, et avec quelle réserve éventuelle. La transparence est intégrale.",
      "Si l'avocat refuse, le client n'est pas laissé seul. ClairDossier propose un message-type, qu'il peut personnaliser, indiquant la raison du refus et orientant vers un autre confrère ou une démarche alternative. La rupture n'est jamais brutale — elle est juridiquement propre.",
    ],
    bullets: [
      "Trois actions : valider, demander, refuser avec motif",
      "Signature électronique horodatée jointe à la décision",
      "Message-type personnalisable en cas de refus",
      "Orientation client maintenue même en cas de non-prise en charge",
    ],
  },
  {
    slug: 'suivi-statuts',
    title: 'Suivi des 6 statuts en temps réel',
    shortTitle: 'Suivi 6 statuts',
    icon: 'status-track',
    blurb:
      "Brouillon → Complété → En attente avocat → Validation en cours → Validé → Archivé. Le client voit exactement où en est son dossier.",
    hero:
      "Le client ne demande plus « où en est mon dossier ? ». Il ouvre l'app, il voit.",
    body: [
      "Les six statuts ne sont pas un gadget visuel. Ils répondent à la première frustration des clients en droit : ne pas savoir où en est leur affaire. Chaque transition de statut déclenche une notification (email + in-app), avec un horodatage et un acteur identifié.",
      "Brouillon — le client construit. Complété par client — toutes les informations sont fournies. En attente avocat — un professionnel est saisi. Validation en cours — l'avocat instruit. Validé — le dossier peut être plaidé, négocié, ou suivi. Archivé — l'affaire est close, les données sont conservées selon les règles de prescription.",
      "Le client peut consulter à tout moment l'historique complet : qui a fait quoi, à quelle date, avec quel commentaire. L'avocat peut ajouter des notes internes invisibles au client (pour son propre suivi), ou des notes partagées (visibles).",
      "Ce niveau de transparence change la relation client. Le client ne demande plus, il consulte. L'avocat n'explique plus l'avancement à chaque appel, il l'a déjà documenté. Le temps gagné est utilisé pour la stratégie juridique — pas pour le statut administratif.",
    ],
    bullets: [
      "6 statuts standardisés, transitions traçables",
      "Notification email + in-app à chaque changement",
      "Notes internes vs partagées (différenciation explicite)",
      "Historique complet consultable par client et avocat",
    ],
  },
  {
    slug: 'messagerie-securisee',
    title: 'Messagerie sécurisée client ↔ pro',
    shortTitle: 'Messagerie',
    icon: 'message-secure',
    blurb:
      "Les échanges juridiques quittent enfin les SMS et les emails. Chiffrement TLS 1.3 en transit, AES-256 au repos, attribution garantie.",
    hero:
      "Un échange juridique mérite mieux qu'un fil de SMS. ClairDossier remplace WhatsApp par une messagerie professionnelle.",
    body: [
      "Combien de cabinets reçoivent encore les pièces de leurs clients par SMS, par email personnel, par WhatsApp ? Les chiffres internes que nous avons recueillis lors de nos entretiens : entre 40 et 70 % selon la taille du cabinet. C'est un risque de confidentialité, un risque RGPD, et une charge mentale pour l'avocat qui doit retrouver les messages.",
      "La messagerie ClairDossier est rattachée à un dossier. Chaque message est horodaté, attribué nominalement, et conservé dans le coffre-fort du dossier — plus jamais à chercher dans 17 fils différents.",
      "Le chiffrement est de bout en bout sur le transport (TLS 1.3) et au repos (AES-256). Les pièces jointes héritent automatiquement de la confidentialité du dossier. Si le dossier passe en `Archivé`, les messages le suivent et sont conservés selon les obligations de conservation légales (10 ans pour les pièces civiles, 30 ans pour les pièces familiales).",
      "Pour les cabinets multi-utilisateurs, les messages sont visibles par les collaborateurs autorisés sur le dossier. Le client ne voit qu'un interlocuteur, mais l'équipe interne peut se relayer — sans rupture de fil, sans perte d'information.",
    ],
    bullets: [
      "Messagerie rattachée au dossier, jamais éparpillée",
      "TLS 1.3 en transit, AES-256 au repos",
      "Conservation selon obligations légales (10 / 30 ans)",
      "Visibilité multi-utilisateurs pour les équipes cabinet",
    ],
  },
  {
    slug: 'coffre-fort',
    title: 'Coffre-fort numérique RGPD natif',
    shortTitle: 'Coffre-fort RGPD',
    icon: 'vault',
    blurb:
      "Vos données vivent en France, hébergées chez OVH, chiffrées au repos. Vous pouvez exporter, supprimer, transférer — à tout moment.",
    hero:
      "Vos données n'appartiennent ni à ClairDossier, ni à votre avocat. Elles vous appartiennent.",
    body: [
      "Le RGPD n'est pas une case à cocher. Pour une legaltech, c'est la condition d'existence. Chaque décision technique de ClairDossier est traversée par cette exigence — et chaque utilisateur peut le vérifier dans le détail.",
      "Vos données sont hébergées en France, dans les datacenters OVH à Roubaix et Strasbourg. Aucun transfert hors UE n'a lieu, ni pour les sauvegardes, ni pour les sous-traitants. Les rares prestataires tiers que nous utilisons (mail transactionnel, monitoring) sont également européens, et leurs DPA sont consultables sur notre page Sécurité.",
      "Vous pouvez à tout moment exporter l'intégralité de votre dossier — pièces, messages, chronologie, décisions — dans un ZIP structuré, prêt à être déposé chez un autre professionnel. Vous pouvez supprimer votre compte — toutes les données vous appartenant sont effacées sous 30 jours (sauf obligation légale de conservation, auquel cas elles sont anonymisées).",
      "Le coffre-fort est versionné : si vous modifiez une pièce ou un message, l'ancienne version reste accessible pendant 90 jours. Vous gardez le contrôle, même sur vos propres modifications.",
    ],
    bullets: [
      "Hébergement OVH France (Roubaix, Strasbourg)",
      "Export ZIP intégral à tout moment, sans condition",
      "Suppression de compte sous 30 jours (anonymisation si obligation légale)",
      "Versioning 90 jours sur toutes les pièces et messages",
    ],
  },
];

export function getFeatureBySlug(slug: string | undefined): Feature | undefined {
  if (!slug) return undefined;
  return features.find((f) => f.slug === slug);
}
