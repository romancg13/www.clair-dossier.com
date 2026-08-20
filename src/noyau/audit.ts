/**
 * DEFENSE OS — M13 : journal d'audit.
 *
 * ┌─ AUCUN CONTENU DE DOSSIER, PAR CONSTRUCTION ────────────────────────────┐
 * │ Une entrée ne porte que des identifiants internes, des comptes et des    │
 * │ horodatages (B11). Le type ne comporte AUCUN champ de texte libre où du  │
 * │ contenu pourrait se glisser — les « blocages » sont des chemins           │
 * │ d'anomalie, pas des extraits.                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { empreinte } from '../ldi/journal';
import type { EntreeJournal } from './modele';
import type { SortiePasse } from './passes';

export type JournalAudit = {
  consigner(entree: Omit<EntreeJournal, 'id' | 'horodatage'> & { horodatage?: string }): EntreeJournal;
  consignerPasse(sortie: SortiePasse, action?: string): EntreeJournal;
  entrees(): EntreeJournal[];
  /** Filtre simple : par passe, par action, par moteur. */
  filtrer(critere: { passe?: string; action?: string; moteur?: string }): EntreeJournal[];
  exporter(): string;
};

export function creerJournalAudit(): JournalAudit {
  const entrees: EntreeJournal[] = [];

  function consigner(entree: Omit<EntreeJournal, 'id' | 'horodatage'> & { horodatage?: string }): EntreeJournal {
    const horodatage = entree.horodatage ?? new Date().toISOString();
    const complete: EntreeJournal = {
      id: `j-${empreinte(`${horodatage}|${entree.action}|${entrees.length}`).slice(0, 12)}`,
      horodatage,
      action: entree.action,
      passe: entree.passe,
      moteur: entree.moteur,
      entrees: entree.entrees,
      sorties: entree.sorties,
      blocages: entree.blocages,
    };
    entrees.push(complete);
    return complete;
  }

  return {
    consigner,

    consignerPasse(sortie, action = `exécution ${sortie.passe}`) {
      return consigner({
        action,
        passe: sortie.passe,
        moteur: { type: sortie.moteur.type, modele: sortie.moteur.modele },
        // Identifiants seulement : ce que la passe a traité, jamais son texte.
        entrees: sortie.traite,
        sorties: [`resultats:${sortie.resultats.length}`, `manques:${sortie.manques.length}`, `ecarte:${sortie.ecarte.length}`],
        blocages: sortie.ecarte.length > 0 ? [`${sortie.passe}.ecarte[${sortie.ecarte.length}]`] : [],
        horodatage: sortie.horodatage,
      });
    },

    entrees: () => [...entrees],

    filtrer: (critere) =>
      entrees.filter(
        (e) =>
          (critere.passe === undefined || e.passe === critere.passe) &&
          (critere.action === undefined || e.action.includes(critere.action)) &&
          (critere.moteur === undefined || e.moteur.type === critere.moteur)
      ),

    exporter: () => JSON.stringify(entrees, null, 2),
  };
}
