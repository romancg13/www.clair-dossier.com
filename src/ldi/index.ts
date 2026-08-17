/**
 * LDI — Legal Defense Intelligence.
 *
 * Moteur d'analyse de dossier pénal. Deux étages nettement séparés :
 *
 *   1. Un noyau DÉTERMINISTE (modules 1, 3, 4, 5, 6) — pas d'appel réseau, pas
 *      de modèle de langage, sortie reproductible et testable.
 *   2. Des CONNECTEURS vers les sources officielles (module 2) et, en aval,
 *      vers un modèle de langage qui exploite le rapport sans le recalculer.
 *
 * La séparation est le point important : tout ce qui pourrait halluciner est
 * hors du chemin critique, et ce qui compte — heures, durées, ordre des actes,
 * points de contrôle — se vérifie ligne à ligne.
 *
 * @see docs/LDI.md
 */
export * from './types';

export { analyser, rendreMarkdown } from './pipeline';
export { analyserDossier, parseHorodatage, trierChronologie, SEUILS } from './modules/chronologie';
export { detecterIrregularites } from './modules/nullites';
export { analyserPiece, analyserPieces, SEUILS_DETECTION } from './modules/detection-ia';
export { construireStrategie, REGLES_SOLIDITE } from './modules/strategie';
export { genererDocument } from './modules/documents';
export {
  rechercher,
  rechercherJurisprudence,
  verifierTexte,
  type ConfigRecherche,
  type ConfigSource,
} from './modules/recherche';
export { minimiser, restaurer, alertesResiduelles, type TableCorrespondance } from './confidentialite';
export { INVITE_SYSTEME, construireMessage, VERSION_LDI, type ContexteInvite } from './prompt';
export { CORPUS, trouverReference, DUREE_MAX_GAV_HEURES } from './corpus/references';
