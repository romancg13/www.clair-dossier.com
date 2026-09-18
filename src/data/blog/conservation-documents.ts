import { SRC } from './sources';
import type { BlogPostInput } from './types';

export const conservationDocuments: BlogPostInput = {
  slug: 'conservation-documents',
  title: 'Conservation des documents : combien de temps garder chaque pièce selon sa nature',
  metaTitle: 'Conservation des documents — durées selon leur nature',
  metaDescription:
    'Bulletins de paie, relevés, factures, pièces comptables : les durées de conservation selon la nature du document, avec les textes officiels et leurs nuances.',
  summary:
    "Garder trop peu, c'est risquer de ne plus pouvoir prouver un paiement ou un droit. Il n'existe pas de durée unique : elle dépend de la nature du document et de votre situation. Voici les repères officiels, avec leurs nuances.",
  author: 'redaction',
  date: '2026-03-28',
  updated: '2026-09-18',
  revisionNote:
    "Article réécrit à partir des textes officiels vérifiés (Légifrance, service-public, CNIL) : durées corrigées, chiffres non sourcés retirés, portée du RGPD précisée.",
  reviewBy: '2027-03-18',
  category: 'Conformité',
  tags: ['conservation', 'documents', 'archives', 'RGPD'],
  illustration: 'archive',
  content: [
    {
      type: 'p',
      text:
        "Combien de temps garder un bulletin de paie, un relevé bancaire, une facture ? La réponse dépend de la nature du document, de votre situation (particulier ou entreprise) et parfois de circonstances particulières. Les durées ci-dessous sont des repères issus des textes et des pages officielles : ce sont souvent des minimums.",
    },
    { type: 'h2', text: 'Le repère général : cinq ans' },
    {
      type: 'p',
      text:
        "Beaucoup d'actions en justice se prescrivent par cinq ans, à compter du jour où l'on a connu, ou aurait dû connaître, les faits permettant d'agir (article 2224 du code civil). D'où l'intérêt de garder au moins cinq ans les contrats, courriers et justificatifs liés à un engagement. Attention : le point de départ varie selon les situations, et de nombreux délais spéciaux existent.",
    },
    { type: 'h2', text: 'Particuliers : des durées minimales' },
    {
      type: 'p',
      text: 'Service-public.fr publie des durées minimales, présentées comme des durées de prudence. Quelques exemples :',
    },
    {
      type: 'list',
      items: [
        'Bulletins de salaire et contrat de travail : jusqu’à la liquidation de la retraite.',
        'Relevés bancaires : 5 ans à partir de la date de l’opération.',
        'Déclaration et avis d’impôt sur le revenu : jusqu’à la fin de la 3e année qui suit l’année d’imposition.',
        'Quittances de loyer : durée de la location, plus 3 ans.',
        'Factures d’électricité, de gaz et d’eau : 5 ans.',
        'Titre de propriété, livret de famille : sans limite de durée.',
      ],
    },
    { type: 'h2', text: 'Entreprises : comptabilité, fiscalité, paie' },
    {
      type: 'list',
      items: [
        'Documents comptables et pièces justificatives (factures, bons de commande) : 10 ans (article L. 123-22 du code de commerce), à compter de la clôture de l’exercice.',
        'Documents que l’administration fiscale peut contrôler : 6 ans (article L. 102 B du livre des procédures fiscales), délai porté à 10 ans en cas d’activité occulte.',
        'Double des bulletins de paie : 5 ans pour l’employeur (article L. 3243-4 du code du travail).',
        'Contrats et correspondance commerciale : 5 ans.',
      ],
    },
    {
      type: 'p',
      text:
        "Quand plusieurs règles visent le même document, retenez la plus longue : une facture est à la fois une pièce comptable et un justificatif fiscal.",
    },
    { type: 'h2', text: 'Un exemple concret' },
    {
      type: 'p',
      text:
        "Exemple fictif. Une entreprise reçoit une facture fournisseur en mars 2025 ; son exercice est clos le 31 décembre 2025. Pièce justificative comptable, la facture se conserve 10 ans à partir de la clôture, soit au moins jusqu'au 31 décembre 2035. Le délai fiscal de 6 ans s'applique aussi, mais il est plus court : c'est le délai comptable qui fixe la date.",
    },
    { type: 'h2', text: 'Données personnelles : ne pas garder sans raison' },
    {
      type: 'p',
      text:
        "Une entreprise peut archiver plus longtemps, sauf les documents qui contiennent des données personnelles. Le RGPD demande en effet de ne pas conserver ces données plus longtemps que nécessaire au regard de la finalité (article 5). Ce principe s'adresse aux organisations : les papiers qu'un particulier garde pour lui, dans un cadre strictement personnel, n'entrent pas dans le champ du RGPD (article 2).",
    },
    { type: 'h2', text: 'Les cas particuliers' },
    {
      type: 'p',
      text:
        "Ces durées sont des repères, pas un conseil juridique. Elles peuvent s'allonger en cas de litige en cours, de contrôle, d'activité réglementée ou de règles propres à votre secteur. En cas de doute, conservez le document et demandez l'avis d'un professionnel, comme votre expert-comptable ou un avocat.",
    },
  ],
  takeaways: [
    'Repère général : 5 ans pour de nombreuses actions civiles (code civil, article 2224).',
    'Entreprises : 10 ans pour la comptabilité et ses pièces, 6 ans pour les documents fiscaux ; retenez la durée la plus longue.',
    'Salariés : bulletins de paie et contrat de travail jusqu’à la liquidation de la retraite.',
    'Données personnelles : une organisation ne les garde pas au-delà du nécessaire.',
  ],
  faq: [
    {
      q: 'Les documents numériques ont-ils la même valeur que le papier ?',
      a: "En principe oui : l'écrit électronique a la même force probante que l'écrit papier, si la personne dont il émane peut être identifiée et s'il est établi et conservé dans des conditions qui garantissent son intégrité (article 1366 du code civil).",
    },
    {
      q: "Faut-il garder l'original papier après l'avoir numérisé ?",
      a: "Pour les documents à conserver sans limite (titre de propriété, livret de famille) et en cas de doute, gardez l'original. Pour les autres, une copie numérique fidèle et bien conservée est souvent suffisante, sous les conditions de l'article 1366 du code civil.",
    },
  ],
  sources: [
    SRC.codeCivil2224,
    SRC.codeCommerceL123_22,
    SRC.lpfL102B,
    SRC.codeTravailL3243_4,
    SRC.codeCivil1366,
    SRC.spConservationParticuliers,
    SRC.spConservationEntreprises,
    SRC.cnilRgpdChap2,
    SRC.cnilRgpdChap1,
  ],
  relatedSlugs: ['organiser-un-dossier', 'rgpd-legaltech', 'mise-en-demeure'],
};
