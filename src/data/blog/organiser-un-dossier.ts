import { SRC } from './sources';
import type { BlogPostInput } from './types';

export const organiserUnDossier: BlogPostInput = {
  slug: 'organiser-un-dossier',
  title: 'Organiser un dossier : une méthode simple en quatre temps',
  metaTitle: 'Organiser un dossier — méthode simple en 4 temps',
  metaDescription:
    'Rassembler, nommer, dater, vérifier : une méthode simple pour transformer des pièces éparpillées en dossier lisible, avec un exemple concret.',
  summary:
    'Contrat dans un tiroir, factures dans une boîte mail, photos sur un téléphone : avant de chercher un argument, il faut retrouver ses pièces. Quatre temps suffisent pour obtenir un dossier lisible.',
  author: 'redaction',
  date: '2026-09-18',
  reviewBy: '2027-09-18',
  category: 'Méthode',
  tags: ['organisation', 'dossier', 'méthode', 'classement'],
  illustration: 'dossier',
  content: [
    {
      type: 'p',
      text:
        "Un dossier commence presque toujours dans le désordre : un impayé, un sinistre, un contrôle, la fin d'un contrat. Les pièces sont dispersées entre papiers, e-mails et téléphone. Or, en procédure civile, c'est à chaque partie de prouver les faits dont dépend sa demande (article 9 du code de procédure civile). Un dossier organisé, c'est d'abord des preuves que l'on retrouve.",
    },
    { type: 'h2', text: '1. Rassembler sans trier' },
    {
      type: 'p',
      text:
        "Réunissez tout au même endroit : un dossier sur votre ordinateur ou une boîte pour le papier. Contrats, devis, factures, courriers, e-mails enregistrés en PDF, captures d'écran, photos. À ce stade, ne jugez pas l'importance des pièces : celle que l'on écarte trop tôt est souvent celle qui manque ensuite.",
    },
    { type: 'h2', text: '2. Nommer chaque pièce' },
    {
      type: 'p',
      text:
        "Un nom de fichier doit se comprendre sans ouvrir le fichier. Une convention simple suffit : date du document, nature, émetteur. Par exemple : 2026-03-14_facture_menuiserie-dupont.pdf. En plaçant la date au format année-mois-jour en tête, l'ordre alphabétique devient l'ordre chronologique.",
    },
    {
      type: 'list',
      items: [
        'Un fichier par pièce, plutôt qu’un grand PDF fourre-tout.',
        'Des versions numérotées (v1, v2) pour un même document, jamais écrasées.',
        'Les originaux papier importants rangés à part, dans le même ordre.',
      ],
    },
    { type: 'h2', text: '3. Dater les événements' },
    {
      type: 'p',
      text:
        "Sur une page, listez les événements dans l'ordre : une ligne par événement, avec la date, ce qui s'est passé et la pièce qui le prouve. Distinguez la date de l'événement de celle du document : un courrier écrit le 2 mai peut relater un rendez-vous du 28 avril. Un échange oral sans trace écrite se note aussi, en précisant qu'il n'est pas documenté.",
    },
    { type: 'h2', text: '4. Vérifier et sécuriser' },
    {
      type: 'p',
      text:
        "Relisez la chronologie : chaque ligne importante a-t-elle sa pièce ? Les trous désignent les documents à demander, comme un relevé, une attestation ou la copie d'un courrier envoyé. Gardez ensuite une sauvegarde sur un second support : le guide de la sécurité des données personnelles de la CNIL consacre une fiche aux sauvegardes.",
    },
    {
      type: 'p',
      text:
        "Une copie numérique a de la valeur : l'écrit électronique a la même force probante que le papier, à condition que son auteur puisse être identifié et que son intégrité soit garantie (article 1366 du code civil). En cas de doute, gardez aussi l'original.",
    },
    { type: 'h2', text: 'Un exemple concret' },
    {
      type: 'p',
      text:
        "Exemple fictif. Sonia, menuisière, n'a pas été payée pour un chantier. Elle réunit le devis signé, deux factures, trois e-mails et les photos de fin de travaux, puis renomme chaque fichier, par exemple 2026-01-10_devis-signe_client-martin.pdf. Elle écrit ensuite six lignes de chronologie. En relisant, elle constate que sa relance téléphonique de février n'est prouvée par rien : elle retrouve le SMS de confirmation et l'ajoute. Son dossier tient désormais sur une page et un dossier de fichiers, prêt à être montré à un conseil ou à un conciliateur de justice.",
    },
    {
      type: 'callout',
      text:
        "ClairDossier vous aide à rassembler vos pièces, les informations et les échéances que vous renseignez, avec un récapitulatif relu avant validation. La plateforme ne lit pas vos documents et ne donne pas de conseil juridique : pour analyser votre situation, adressez-vous à un professionnel du droit.",
      tone: 'gold',
    },
  ],
  takeaways: [
    'Rassemblez tout au même endroit avant de trier.',
    'Nommez chaque fichier « date_nature_émetteur », avec la date au format année-mois-jour.',
    'Une chronologie d’une page : une ligne par événement, avec la pièce qui le prouve.',
    'Repérez les trous, complétez, puis sauvegardez sur un second support.',
  ],
  faq: [
    {
      q: 'Faut-il imprimer les e-mails ?',
      a: "Pas nécessairement. Enregistrez-les en PDF en conservant l'expéditeur, le destinataire et la date, et nommez-les comme vos autres pièces. Gardez aussi le message d'origine dans votre messagerie.",
    },
    {
      q: 'Combien de temps garder les pièces une fois le dossier clos ?',
      a: "Cela dépend de leur nature : voir notre article sur la conservation des documents, qui reprend les durées publiées par l'administration et les textes de référence.",
    },
  ],
  sources: [SRC.cpc9, SRC.codeCivil1366, SRC.cnilGuideSecurite2024],
  relatedSlugs: ['conservation-documents', 'preparer-rendez-vous-avocat', 'rgpd-legaltech'],
};
