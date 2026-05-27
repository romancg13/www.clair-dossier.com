import type { BlogPost } from './types';

export const conservationDocuments: BlogPost = {
  slug: 'conservation-documents',
  title: "Conservation des documents juridiques : durées légales et bonnes pratiques",
  metaTitle: "Conservation documents juridiques — durées légales France",
  metaDescription:
    "Un contrat de travail se garde 5 ans. Une facture, 10 ans. Une attestation employeur, à vie. Le guide complet par typologie.",
  summary:
    "Combien de temps faut-il garder ses contrats, factures, bulletins de paie, actes notariés ? La règle change selon le document et la situation, et l'erreur a deux directions : trop court (vous perdez une preuve), trop long (vous violez le RGPD). Voici le guide.",
  author: 'redaction',
  date: '2026-03-28',
  readMinutes: 9,
  category: 'Conformité',
  tags: ['conservation', 'documents', 'RGPD', 'archives'],
  heroImageQuery: 'paper archives folders',
  content: [
    {
      type: 'p',
      text:
        "Combien de fois avez-vous jeté un document trop tôt, pour le regretter quelques mois plus tard ? Ou conservé pendant vingt ans une facture EDF par excès de prudence ? La conservation des documents juridiques répond à des règles précises, codifiées dans plusieurs textes : Code civil, Code du travail, Code de commerce, et — depuis 2018 — Règlement général sur la protection des données. Les durées varient selon la nature du document et le statut de la personne (particulier, salarié, entrepreneur, association).",
    },
    {
      type: 'p',
      text:
        "Cet article passe en revue les principales catégories. Il n'est pas exhaustif — pour des documents très spécialisés (droit médical, propriété intellectuelle complexe, dossiers familiaux atypiques), un conseil ciblé reste utile.",
    },
    { type: 'h2', text: 'Documents salariés' },
    {
      type: 'list',
      items: [
        "Bulletins de paie : à conserver à vie (utiles pour le calcul de la retraite, même 40 ans après).",
        "Contrat de travail : 5 ans après la rupture (prescription civile générale, article 2224 Code civil).",
        "Attestation Pôle emploi (ex-ASSEDIC) : 5 ans après la fin de l'indemnisation.",
        "Solde de tout compte : 3 ans (prescription des actions en paiement de salaire).",
        "Reçu pour solde de tout compte signé : 6 mois après remise (article L. 1234-20 Code du travail).",
      ],
    },
    {
      type: 'callout',
      text:
        "Les bulletins de paie sont l'exception : conservez-les à vie, en version papier ET numérique. La retraite se calcule sur toute la carrière, et un trimestre manquant peut coûter cher au moment de la liquidation.",
      tone: 'gold',
    },
    { type: 'h2', text: 'Documents fiscaux et bancaires' },
    {
      type: 'list',
      items: [
        "Déclaration de revenus et avis d'imposition : 3 ans, mais 6 ans en cas d'activité indépendante ou de revenus fonciers.",
        "Justificatifs de réductions et crédits d'impôt : 3 ans (durée du droit de reprise du fisc).",
        "Taxe foncière, taxe d'habitation : 1 an après paiement.",
        "Relevés bancaires : 5 ans (utiles en cas de litige avec un commerçant ou la banque).",
        "Chèques annulés ou souches : 5 ans.",
      ],
    },
    { type: 'h2', text: 'Documents immobiliers' },
    {
      type: 'list',
      items: [
        "Acte d'achat ou de vente d'un bien immobilier : à vie, tant que vous possédez le bien (et même au-delà pour preuve de plus-value).",
        "Bail d'habitation : 3 ans après la fin du bail.",
        "Quittances de loyer : 3 ans (preuve du paiement en cas de litige).",
        "État des lieux (entrée et sortie) : 3 ans après la fin du bail.",
        "Charges de copropriété (procès-verbaux d'AG, comptes annuels) : 10 ans.",
        "Diagnostics immobiliers (DPE, amiante, plomb) : à conserver tant que vous occupez ou louez le bien.",
      ],
    },
    { type: 'h2', text: 'Documents de consommation' },
    {
      type: 'list',
      items: [
        "Factures d'eau, gaz, électricité : 5 ans (prescription de l'action en paiement).",
        "Factures de téléphone, abonnements internet : 1 an minimum (souvent 5 ans recommandés).",
        "Achats de biens durables (électroménager, mobilier) : durée de la garantie + 2 ans.",
        "Carte grise (certificat d'immatriculation) : tant que vous possédez le véhicule.",
        "Contrat d'assurance et avis d'échéance : 2 ans après résiliation.",
      ],
    },
    { type: 'h2', text: 'Documents familiaux' },
    {
      type: 'list',
      items: [
        "Livret de famille : à vie.",
        "Actes notariés (donation, succession, testament) : à vie.",
        "Jugements (divorce, garde, séparation de biens) : à vie.",
        "Pensions alimentaires reçues ou versées : 5 ans.",
        "Allocations familiales et CAF : 3 ans (preuve en cas de contestation).",
      ],
    },
    { type: 'h2', text: 'Documents pour entrepreneur ou société' },
    {
      type: 'p',
      text:
        "Si vous êtes en libéral, micro-entrepreneur, gérant de SARL ou président de SAS, les durées sont plus longues car la responsabilité commerciale et fiscale est étendue.",
    },
    {
      type: 'list',
      items: [
        "Statuts de la société, procès-verbaux d'assemblée : 5 ans après la radiation.",
        "Comptes annuels, livre journal : 10 ans (article L. 123-22 Code de commerce).",
        "Factures émises et reçues : 10 ans.",
        "Documents bancaires professionnels : 10 ans.",
        "Contrats commerciaux : 5 ans après la fin du contrat (10 ans si garantie décennale).",
        "Bail commercial : 5 ans après la fin du bail.",
        "Registres du personnel : 5 ans après le départ du dernier salarié inscrit.",
      ],
    },
    { type: 'h2', text: 'Le risque de la sur-conservation : le RGPD' },
    {
      type: 'p',
      text:
        "Le RGPD impose qu'une donnée personnelle ne soit conservée que le temps nécessaire à la finalité poursuivie. Conserver indéfiniment des documents personnels d'autrui (par exemple un ancien salarié, un client résilié) au-delà des durées légales constitue une infraction. Les amendes prononcées par la CNIL en 2024 et 2025 pour conservation excessive ont concerné des sommes à six chiffres pour des structures de taille moyenne.",
    },
    {
      type: 'p',
      text:
        "Notre conseil : à chaque fin d'année, programmer une « purge » des documents dont la durée légale est échue. Plutôt que de jeter, anonymiser : un bulletin de paie peut être archivé en gardant les montants mais en supprimant le nom et le numéro de sécurité sociale, par exemple.",
    },
    { type: 'h2', text: 'Bonnes pratiques de classement' },
    {
      type: 'list',
      items: [
        "Nommer les fichiers avec une convention claire : YYYY-MM-DD_nature_partie (par exemple 2024-03-15_facture_EDF.pdf).",
        "Séparer en dossiers thématiques : Famille, Logement, Travail, Fiscal, Pro.",
        "Doublonner sur deux supports : un local (disque dur, NAS) et un distant (cloud chiffré).",
        "Sauvegarder une fois par mois en cas de changement important.",
        "Tenir un index annuel : un fichier qui liste les documents archivés cette année-là.",
      ],
    },
  ],
  takeaways: [
    "Les bulletins de paie se conservent à vie ; les contrats de travail, 5 ans après rupture.",
    "Les factures et documents commerciaux, 10 ans (Code de commerce).",
    "RGPD : conserver au-delà de la durée légale est sanctionnable. Programmer une purge annuelle.",
    "Convention de nommage YYYY-MM-DD_nature_partie : indispensable pour retrouver un document dix ans plus tard.",
  ],
  faq: [
    {
      q: "Les documents numériques ont-ils la même valeur que le papier ?",
      a: "Oui, depuis la loi de 2000 sur la signature électronique. Un PDF signé électroniquement, un email tracé, une LRE certifiée ont la même valeur probante. Veillez seulement à ce que l'horodatage et la signature soient vérifiables.",
    },
    {
      q: "Que faire des documents d'un proche décédé ?",
      a: "Les documents fiscaux et bancaires doivent être conservés pendant les durées légales (la succession peut être contestée jusqu'à 30 ans pour la prescription extinctive). Les actes notariés (testament, donation) doivent être conservés à vie par les héritiers.",
    },
    {
      q: "Faut-il garder l'original papier si on a numérisé ?",
      a: "Pour la plupart des documents, la version numérique suffit si elle est lisible, datée et conservée de manière intègre. Trois exceptions : actes notariés originaux (à conserver), titres de propriété (à conserver), documents requis en justice avec mention « original » (selon décision du juge).",
    },
  ],
  relatedSlugs: ['rgpd-legaltech', 'preparer-rendez-vous-avocat', 'mise-en-demeure'],
};
