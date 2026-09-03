import type { FeatureIconKey } from "../components/icons";

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
    slug: "creation-guidee",
    title: "Création guidée par typologie",
    shortTitle: "Création guidée",
    icon: "form-guide",
    blurb:
      "Un tunnel de création en 5 étapes qui s'adapte à votre profil — artisan, indépendant, profession libérale, PME — et structure votre dossier dès le départ.",
    hero: "Le bon dossier commence par les bonnes étapes. ClairDossier en propose 5, dans l'ordre.",
    body: [
      "La plupart des outils font remplir un formulaire générique d'un seul tenant. Résultat : des informations éparses, mal rangées, qu'il faut ensuite reprendre. Notre approche est inverse — guider la création étape par étape pour ne collecter que ce qui est utile, dans le bon ordre.",
      "Le tunnel se déroule en cinq étapes : votre profil (artisan, indépendant, profession libérale ou PME), la nature du dossier, les informations, le dépôt des documents, puis un récapitulatif avant validation. À la première étape, vous donnez un nom au dossier — c'est obligatoire, pour le retrouver clairement dans votre liste.",
      "Chaque étape ne demande que ce dont elle a besoin. Vous avancez d'un écran à l'autre sans vous perdre, et vous voyez à tout moment où vous en êtes dans la création.",
      "Le récapitulatif final vous montre l'ensemble de ce que vous avez saisi avant de confirmer. Vous relisez, vous corrigez si besoin, puis vous validez. Rien n'est figé tant que vous n'avez pas confirmé.",
    ],
    bullets: [
      "Tunnel de création en 5 étapes guidées",
      "Adaptation au profil : artisan, indépendant, profession libérale, PME",
      "Nom de dossier obligatoire pour un repérage clair",
      "Récapitulatif complet avant validation finale",
    ],
  },
  {
    slug: "pieces-ocr",
    title: "Dépôt de pièces dans un espace privé",
    shortTitle: "Dépôt de pièces",
    icon: "scan-ocr",
    blurb:
      "Déposez vos pièces — contrats, courriers, factures — dans un espace privé et sécurisé, rattaché au dossier.",
    hero: "Vos pièces ne sont pas un fourre-tout. ClairDossier les range dans un espace privé, dossier par dossier.",
    body: [
      "Un dossier vit par ses pièces. La première cause de désordre, ce sont des documents éparpillés entre l'e-mail, le téléphone et les fichiers locaux. ClairDossier les rassemble en un seul endroit, rattaché au dossier concerné.",
      "À l'étape de dépôt du tunnel de création, vous ajoutez vos documents — PDF, scans, photos de courriers. Chaque pièce est stockée dans un espace privé propre à votre compte. L'accès passe par des liens temporaires signés : les fichiers ne sont jamais exposés publiquement.",
      "Une fois déposées, vos pièces apparaissent sur la page d'avancement du dossier. Vous les consultez et les téléchargez à tout moment, depuis la liste des pièces du dossier.",
      "Le stockage est isolé par utilisateur : un dossier ne voit que ses propres pièces. Vous gardez la maîtrise de ce que vous déposez, et vous le retrouvez toujours au même endroit.",
    ],
    bullets: [
      "Dépôt des pièces à l'étape dédiée du tunnel de création",
      "Espace de stockage privé, accès par liens temporaires signés",
      "Pièces consultables et téléchargeables depuis le dossier",
      "Isolation des données par utilisateur",
    ],
  },
  {
    slug: "chronologie",
    title: "Avancement du dossier en 5 étapes",
    shortTitle: "Avancement",
    icon: "timeline",
    blurb:
      "Une page d'avancement claire qui suit votre dossier à travers 5 étapes métier, avec pièces et échéances réunies au même endroit.",
    hero: "Où en est mon dossier ? Vous l'ouvrez, vous voyez les 5 étapes, vous savez.",
    body: [
      "La première chose à faire face à un dossier, c'est de savoir où il en est. ClairDossier répond à cette question avec une page d'avancement dédiée, organisée en cinq étapes métier cliquables.",
      "Chaque dossier ouvre sur sa page « Avancement du dossier ». Les cinq étapes y sont affichées et cliquables : vous suivez la progression d'un coup d'œil, du début jusqu'à la transmission.",
      "Sur cette même page, vos pièces déposées sont listées et téléchargeables, et vos échéances renseignées sont affichées. Tout ce qui concerne le dossier est réuni en un seul écran, sans avoir à chercher ailleurs.",
      "La vue reste fidèle à ce que vous avez saisi : les informations, les documents et les dates que vous avez fournis. Vous gardez une image nette de l'état du dossier à tout moment.",
    ],
    bullets: [
      "Page d'avancement à 5 étapes métier cliquables",
      "Pièces du dossier consultables et téléchargeables",
      "Échéances renseignées affichées sur la page",
      "Une vue unique et fidèle aux informations saisies",
    ],
  },
  {
    slug: "validation-avocat",
    title: "Transmission validée par vous",
    shortTitle: "Transmission",
    icon: "validate",
    blurb:
      "Vous transmettez votre dossier par e-mail ou WhatsApp, quand vous le décidez. Rien ne part sans votre validation explicite.",
    hero: "Le dossier ne part jamais tout seul. C'est vous qui déclenchez la transmission, par e-mail ou par WhatsApp.",
    body: [
      "ClairDossier prépare votre dossier ; c'est vous qui choisissez quand et à qui le transmettre. Aucun envoi automatique : tant que vous n'avez pas validé, rien ne quitte votre espace.",
      "Quand votre dossier est prêt, vous le transmettez en un geste à l'équipe ClairDossier, par e-mail ou par WhatsApp. Vous décidez du canal et du moment. La transmission est toujours déclenchée par vous, explicitement.",
      "Vous gardez ainsi la main du début à la fin : vous construisez le dossier dans le tunnel, vous relisez le récapitulatif, puis vous transmettez seulement lorsque tout vous convient.",
      "Ce fonctionnement protège vos données : elles restent dans votre espace privé jusqu'à votre validation, et ne sont partagées que sur votre action explicite.",
    ],
    bullets: [
      "Transmission déclenchée par vous, jamais automatique",
      "Envoi par e-mail ou par WhatsApp, à votre choix",
      "Validation explicite avant tout partage",
      "Données conservées dans votre espace privé jusqu'à l'envoi",
    ],
  },
  {
    slug: "suivi-statuts",
    title: "Liste de vos dossiers en un espace",
    shortTitle: "Mes dossiers",
    icon: "status-track",
    blurb:
      "Tous vos dossiers réunis dans votre espace de compte. D'un coup d'œil, vous voyez lesquels ouvrir et où chacun en est.",
    hero: "Plus besoin de chercher partout. Vos dossiers sont rassemblés dans un seul espace.",
    body: [
      "La première difficulté quand on suit plusieurs affaires, c'est de savoir lesquelles sont en cours et où chacune en est. ClairDossier répond à ce besoin avec une liste claire de vos dossiers, dans votre espace de compte.",
      "Après création de votre compte, gratuite et confirmée par e-mail, vous accédez à votre espace. Chaque dossier que vous créez s'y ajoute, identifié par le nom que vous lui avez donné. Vous ouvrez celui que vous voulez d'un clic.",
      "Depuis la liste, vous entrez sur la page d'avancement de chaque dossier : ses cinq étapes, ses pièces, ses échéances. Vous passez d'un dossier à l'autre sans rien perdre de vue.",
      "Vos dossiers restent isolés : votre espace ne contient que les vôtres. Cette séparation par utilisateur garantit que vos informations ne se mélangent jamais avec celles d'un autre compte.",
    ],
    bullets: [
      "Création de compte gratuite, confirmée par e-mail",
      "Liste de tous vos dossiers dans votre espace",
      "Accès direct à la page d'avancement de chaque dossier",
      "Isolation des données par utilisateur",
    ],
  },
  {
    slug: "messagerie-securisee",
    title: "Espace privé et sécurisé",
    shortTitle: "Espace sécurisé",
    icon: "message-secure",
    blurb:
      "Vos pièces et informations quittent les SMS et les e-mails dispersés pour un espace privé : accès par authentification, chiffrement en transit et au repos.",
    hero: "Un dossier mérite mieux qu'un fil de SMS. ClairDossier le garde dans un espace privé, sous votre compte.",
    body: [
      "Combien de pièces circulent encore par SMS, par e-mail personnel, par WhatsApp ? C'est un risque de confidentialité et une charge mentale dès qu'il faut retrouver le bon document. ClairDossier rassemble pièces et informations dans un espace privé, rattaché à votre dossier.",
      "L'accès à votre espace passe par une authentification : vous seul ouvrez vos dossiers. Les échanges en transit se font en HTTPS, et vos données sont chiffrées au repos côté hébergeur.",
      "Le stockage des pièces est privé : les fichiers ne sont accessibles que via des liens temporaires signés, jamais en accès libre. Vos documents restent rangés là où vous les avez déposés, dossier par dossier.",
      "Quand vous le décidez, vous transmettez le dossier à l'équipe ClairDossier par e-mail ou par WhatsApp. Le partage n'a lieu que sur votre action explicite — rien ne sort de votre espace sans votre validation.",
    ],
    bullets: [
      "Accès à l'espace par authentification",
      "Chiffrement en transit (HTTPS) et au repos côté hébergeur",
      "Stockage privé des pièces, liens temporaires signés",
      "Partage uniquement sur transmission validée par vous",
    ],
  },
  {
    slug: "coffre-fort",
    title: "Vos données protégées et maîtrisées",
    shortTitle: "Données RGPD",
    icon: "vault",
    blurb:
      "Vos données sont isolées par utilisateur, chiffrées au repos côté hébergeur, accessibles par authentification. Accès, export et suppression sur demande.",
    hero: "Vos données n'appartiennent qu'à vous. Vous pouvez en demander l'accès, l'export ou la suppression.",
    body: [
      "Le RGPD n'est pas une case à cocher. ClairDossier traite vos informations avec le souci de la protection des données, et vous conservez vos droits sur ce qui vous concerne.",
      "Vos données sont hébergées chez un sous-traitant conforme RGPD, chiffrées au repos côté hébergeur et transmises en HTTPS. L'isolation par utilisateur garantit que vos dossiers restent séparés de ceux des autres comptes ; l'accès se fait par authentification.",
      "Vous gardez la main sur vos droits : accès, export et suppression de vos données. Ces demandes se font via le contact ou votre espace, et sont traitées dans un délai raisonnable (jusqu'à 30 jours), sauf obligation légale de conservation.",
      "Tant que vous ne demandez pas de modification, vos données restent là où vous les avez placées, dans votre espace privé. Vous décidez de ce que vous transmettez, et à qui.",
    ],
    bullets: [
      "Hébergeur sous-traitant conforme RGPD, chiffrement au repos",
      "Isolation des données par utilisateur, accès par authentification",
      "Accès, export et suppression sur demande",
      "Demandes traitées sous 30 jours (sauf obligation légale)",
    ],
  },
  {
    slug: "calendrier-relances",
    title: "Échéances renseignées et affichées",
    shortTitle: "Échéances",
    icon: "timeline",
    blurb:
      "Chaque dossier a ses dates clés. ClairDossier les conserve et les affiche sur la page d'avancement, sous vos yeux à chaque consultation.",
    hero: "Une échéance se garde en vue. ClairDossier l'affiche sur le dossier, là où vous la consultez.",
    body: [
      "Les délais sont au cœur des dossiers : délai de contestation, date d'échéance, paiement, rendez-vous. Les garder en vue, c'est déjà éviter de les laisser passer. ClairDossier conserve ces dates avec le dossier auquel elles se rattachent.",
      "Vous renseignez les échéances connues lors de la création du dossier. Elles sont enregistrées et affichées sur la page d'avancement, à côté des pièces et des étapes. Vous les retrouvez à chaque fois que vous ouvrez le dossier.",
      "Vous gardez ainsi vos dates importantes réunies au même endroit que le reste du dossier, plutôt que dispersées dans des notes ou des agendas séparés. Vous décidez ensuite quand transmettre le dossier, par e-mail ou par WhatsApp.",
    ],
    bullets: [
      "Échéances renseignées à la création du dossier",
      "Dates affichées sur la page d'avancement",
      "Échéances réunies avec les pièces et les étapes",
      "Transmission du dossier décidée et déclenchée par vous",
    ],
  },
  {
    slug: "reponse-auto-mails",
    title: "Récapitulatif avant transmission",
    shortTitle: "Récapitulatif",
    icon: "ai-brief",
    blurb:
      "Avant d'envoyer, ClairDossier vous présente un récapitulatif complet du dossier. Vous relisez, vous corrigez si besoin, puis vous transmettez.",
    hero: "On relit avant d'envoyer. ClairDossier réunit tout le dossier dans un récapitulatif clair.",
    body: [
      "Avant de transmettre un dossier, il faut être sûr de ce qu'il contient : les informations, les pièces, les échéances. ClairDossier réunit l'ensemble dans une étape de récapitulatif, à la fin du tunnel de création.",
      "Le récapitulatif affiche le profil, la nature du dossier, les informations saisies et les pièces déposées. Vous relisez le tout d'un seul écran, vous revenez en arrière pour corriger si besoin, puis vous confirmez. Rien n'est transmis tant que vous n'avez pas validé.",
      "Une fois le dossier confirmé, vous le transmettez quand vous le décidez, par e-mail ou par WhatsApp, à l'équipe ClairDossier. Vous gardez la main sur le contenu comme sur l'envoi.",
    ],
    bullets: [
      "Récapitulatif complet à la fin du tunnel de création",
      "Profil, nature, informations et pièces réunis sur un écran",
      "Retour en arrière possible pour corriger avant de valider",
      "Transmission par e-mail ou WhatsApp, déclenchée par vous",
    ],
  },
];

export function getFeatureBySlug(
  slug: string | undefined,
): Feature | undefined {
  if (!slug) return undefined;
  return features.find((f) => f.slug === slug);
}
