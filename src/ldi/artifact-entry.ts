/**
 * Point d'entrée du bundle autonome (page publique).
 *
 * Expose le noyau déterministe sur `window.LDI`. Aucun appel réseau n'est
 * possible depuis ce bundle : le module de recherche et l'étage génératif en
 * sont volontairement absents, seul ce qui se calcule hors ligne est embarqué.
 */
import dossierExemple from '../../examples/dossier-exemple.json';

import { alertesResiduelles, minimiser } from './confidentialite';
import { genererDocument } from './modules/documents';
import { analyser, rendreMarkdown } from './pipeline';
import { VERSION_LDI } from './prompt';
import type { Dossier } from './types';
import { validerDossier } from './validation';

const { _avertissement, ...exemple } = dossierExemple as Dossier & { _avertissement?: string };

export const LDI = {
  version: VERSION_LDI,
  exemple: exemple as Dossier,
  analyser,
  rendreMarkdown,
  genererDocument,
  minimiser,
  alertesResiduelles,
  // Le même contrat d'entrée que la CLI et l'atelier. Sans lui, la page
  // autonome acceptait des dossiers que les deux autres interfaces refusent —
  // un régime inconnu, par exemple, et donc un plafond de garde à vue qui
  // n'est pas celui du régime déclaré.
  validerDossier,
};

declare global {
  interface Window {
    LDI: typeof LDI;
  }
}

window.LDI = LDI;
