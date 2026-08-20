/**
 * DEFENSE OS — mémorisation de la chaîne P1→P6 par état de dossier.
 *
 * Même principe que le cache d'analyse : la clé est l'empreinte du dossier,
 * qui change si et seulement si le dossier change, et la chaîne est
 * déterministe. Le pupitre et les filtres restent praticables au-delà de
 * deux dossiers sans réexécuter quatorze postes à chaque frappe.
 */
import { creerJournalAudit, type JournalAudit } from '../noyau/audit';
import type { DossierPenal } from '../noyau/modele';
import { executerChaine, type ResultatChaine } from '../noyau/orchestrateur';
import { empreinte } from './journal';

export type CacheChaine = {
  executer(dossier: DossierPenal): ResultatChaine;
  vider(): void;
  /** Le journal d'audit commun : chaque passe s'y consigne. */
  journal: JournalAudit;
};

const CAPACITE = 32;

export function creerCacheChaine(): CacheChaine {
  const entrees = new Map<string, ResultatChaine>();
  const journal = creerJournalAudit();

  return {
    journal,

    executer(dossier) {
      const cle = empreinte(dossier);
      const connu = entrees.get(cle);
      if (connu) {
        entrees.delete(cle);
        entrees.set(cle, connu);
        return connu;
      }
      const resultat = executerChaine(dossier, { journal });
      entrees.set(cle, resultat);
      while (entrees.size > CAPACITE) {
        const ancienne = entrees.keys().next().value;
        if (ancienne === undefined) break;
        entrees.delete(ancienne);
      }
      return resultat;
    },

    vider: () => entrees.clear(),
  };
}
