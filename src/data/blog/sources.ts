/**
 * Sources officielles du Journal — chaque lien a été ouvert et son contenu
 * vérifié à la date `checkedAt` (consultation du 2026-09-18). Toute nouvelle
 * source doit être vérifiée de la même façon avant d'être ajoutée ici.
 *
 * Note : entreprendre.service-public.fr et service-public.fr servent
 * désormais leurs pages sous le domaine *.service-public.gouv.fr (URL
 * canoniques reprises telles quelles).
 */
import type { BlogSource } from './types';

const CHECKED = '2026-09-18';
const LEGIFRANCE = 'Légifrance';
const CNIL = 'CNIL';

export const SRC = {
  codeCivil2224: {
    label: 'Code civil, article 2224 (prescription de droit commun : 5 ans)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000019017112',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  codeCivil1344: {
    label: 'Code civil, article 1344 (mise en demeure du débiteur)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032042162',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  codeCivil1344_1: {
    label: 'Code civil, article 1344-1 (intérêts moratoires au taux légal)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032035273',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  codeCivil1366: {
    label: 'Code civil, article 1366 (force probante de l’écrit électronique)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000032042461',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  codeCommerceL123_22: {
    label: 'Code de commerce, article L. 123-22 (documents comptables : 10 ans)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006219327',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  lpfL102B: {
    label: 'Livre des procédures fiscales, article L. 102 B (conservation : 6 ans)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041471233/',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  codeTravailL3243_4: {
    label: 'Code du travail, article L. 3243-4 (double des bulletins de paie : 5 ans)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000020625846',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  codeTravailL1332_4: {
    label: 'Code du travail, article L. 1332-4 (prescription des faits fautifs : 2 mois)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006901450',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  cpc9: {
    label: 'Code de procédure civile, article 9 (charge de la preuve)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006410102',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  cpc750_1: {
    label: 'Code de procédure civile, article 750-1 (tentative préalable de résolution amiable)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000039501708/',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  cpceL100: {
    label: 'Code des postes et des communications électroniques, article L. 100 (lettre recommandée électronique)',
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033207397/',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  loi1971Art54: {
    label: 'Loi n° 71-1130 du 31 décembre 1971, article 54 (consultation juridique)',
    url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000039280601',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  loi1971Art66_2: {
    label: 'Loi n° 71-1130 du 31 décembre 1971, article 66-2 (sanction pénale)',
    url: 'https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000006903493',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  decretMediateurs2017: {
    label: 'Décret n° 2017-1457 du 9 octobre 2017 (liste des médiateurs auprès de la cour d’appel)',
    url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000035764674',
    publisher: LEGIFRANCE,
    checkedAt: CHECKED,
  },
  spConservationParticuliers: {
    label: 'Durée de conservation des papiers (particuliers)',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F19134',
    publisher: 'Service-public.fr',
    checkedAt: CHECKED,
  },
  spConservationEntreprises: {
    label: 'Quels sont les délais de conservation des documents pour les entreprises ?',
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F10029',
    publisher: 'Entreprendre.service-public.fr',
    checkedAt: CHECKED,
  },
  spConciliateur: {
    label: 'Conciliateur de justice',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1736',
    publisher: 'Service-public.fr',
    checkedAt: CHECKED,
  },
  cnilRgpdChap1: {
    label: 'RGPD, chapitre 1 — article 2 (champ d’application matériel)',
    url: 'https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre1',
    publisher: CNIL,
    checkedAt: CHECKED,
  },
  cnilRgpdChap2: {
    label: 'RGPD, chapitre 2 — article 5 (limitation de la conservation)',
    url: 'https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre2',
    publisher: CNIL,
    checkedAt: CHECKED,
  },
  cnilRgpdChap4: {
    label: 'RGPD, chapitre 4 — articles 28 (sous-traitant) et 32 (sécurité)',
    url: 'https://www.cnil.fr/fr/reglement-europeen-protection-donnees/chapitre4',
    publisher: CNIL,
    checkedAt: CHECKED,
  },
  cnilRoles: {
    label: 'Responsable du traitement, sous-traitants : comment bien identifier son rôle ?',
    url: 'https://www.cnil.fr/fr/rgpd-comment-bien-identifier-son-role',
    publisher: CNIL,
    checkedAt: CHECKED,
  },
  cnilSousTraitant: {
    label: 'Travailler avec un sous-traitant',
    url: 'https://www.cnil.fr/fr/sous-traitant',
    publisher: CNIL,
    checkedAt: CHECKED,
  },
  cnilSecuriteSousTraitance: {
    label: 'Sécurité : gérer la sous-traitance',
    url: 'https://www.cnil.fr/fr/securite-gerer-la-sous-traitance',
    publisher: CNIL,
    checkedAt: CHECKED,
  },
  cnilClausesTypes: {
    label: 'Clauses contractuelles types entre responsable de traitement et sous-traitant',
    url: 'https://www.cnil.fr/fr/clauses-contractuelles-types-entre-responsable-de-traitement-et-sous-traitant',
    publisher: CNIL,
    checkedAt: CHECKED,
  },
  cnilGuideSecurite2024: {
    label: 'Guide de la sécurité des données personnelles (édition 2024)',
    url: 'https://www.cnil.fr/fr/guide-de-la-securite-des-donnees-personnelles-nouvelle-edition-2024',
    publisher: CNIL,
    checkedAt: CHECKED,
  },
  cnbIaGenerative: {
    label: 'Le CNB accompagne la profession dans l’utilisation de l’IA générative',
    url: 'https://www.cnb.avocat.fr/fr/actualites/le-cnb-accompagne-toujours-plus-la-profession-dans-lutilisation-de-lia-generative',
    publisher: 'Conseil national des barreaux',
    checkedAt: CHECKED,
  },
} satisfies Record<string, BlogSource>;
