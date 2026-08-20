/**
 * DEFENSE OS — M12 : registre des demandes.
 *
 * ┌─ RIEN NE SE PERD (barème, rang 5) ──────────────────────────────────────┐
 * │ Toute demande de l'avocat entre au registre et en ressort avec une       │
 * │ sortie datée. Il n'existe AUCUNE fonction de suppression dans ce module  │
 * │ (B21) : une demande se clôt, elle ne disparaît pas. Une demande          │
 * │ partiellement traitée reste ouverte, avec la liste explicite de ce qui   │
 * │ manque pour l'achever.                                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { empreinte } from '../ldi/journal';
import type { Demande, EtatDemande } from './modele';

export function creerDemande(
  dossierReference: string,
  enonce: string,
  date = new Date().toISOString()
): Demande {
  return {
    id: `dm-${empreinte(`${dossierReference}|${enonce}|${date}`).slice(0, 12)}`,
    dossierReference,
    enonce: enonce.trim(),
    date,
    etat: 'ouverte',
    passesDeclenchees: [],
    sortieProduite: null,
    resteAFaire: [],
    verifieeLe: null,
  };
}

/**
 * Marque une demande traitée — ou PARTIELLEMENT traitée : s'il reste quelque
 * chose à faire, elle reste ouverte, et la liste dit quoi.
 */
export function traiterDemande(
  demande: Demande,
  resultat: { passes: string[]; sortieId: string; resteAFaire?: string[] }
): Demande {
  const reste = resultat.resteAFaire ?? [];
  return {
    ...demande,
    passesDeclenchees: [...new Set([...demande.passesDeclenchees, ...resultat.passes])],
    sortieProduite: resultat.sortieId,
    resteAFaire: reste,
    etat: reste.length > 0 ? 'ouverte' : 'traitee',
  };
}

/** L'avocat a vérifié : la demande passe à « à vérifier » → « close ». */
export function verifierDemande(demande: Demande, date = new Date().toISOString()): Demande {
  return { ...demande, etat: 'close', verifieeLe: date };
}

/** Changement d'état explicite, sans raccourci vers la disparition. */
export function changerEtat(demande: Demande, etat: EtatDemande): Demande {
  return { ...demande, etat };
}

/**
 * Reprise d'une demande ancienne : une NOUVELLE demande, liée par l'énoncé,
 * qui permet de comparer l'ancienne sortie à la nouvelle. L'ancienne reste
 * au registre telle quelle.
 */
export function reprendreDemande(
  ancienne: Demande,
  date = new Date().toISOString()
): { nouvelle: Demande; comparaison: { ancienneSortie: string | null } } {
  return {
    nouvelle: creerDemande(ancienne.dossierReference, ancienne.enonce, date),
    comparaison: { ancienneSortie: ancienne.sortieProduite },
  };
}

/** Les demandes qui remontent au pupitre : ouvertes et à vérifier. */
export function demandesEnAttente(demandes: Demande[]): Demande[] {
  return demandes
    .filter((d) => d.etat === 'ouverte' || d.etat === 'a-verifier')
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}
