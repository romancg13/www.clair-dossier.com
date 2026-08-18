/**
 * Validation d'un dossier venu de l'extérieur (fichier, presse-papier, saisie).
 *
 * `JSON.parse('null')` et `JSON.parse('42')` réussissent : sans contrôle de
 * type, la première lecture de propriété lève une exception hors du chemin
 * d'erreur prévu, et l'utilisateur ne voit rien d'explicite. Un seul validateur
 * pour la console et la ligne de commande, pour que les deux refusent la même
 * chose avec le même message.
 */
import type { Dossier } from './types';

export type Validation =
  | { ok: true; dossier: Dossier }
  | { ok: false; message: string };

export function validerDossier(valeur: unknown): Validation {
  if (typeof valeur !== 'object' || valeur === null || Array.isArray(valeur)) {
    return { ok: false, message: 'Le dossier doit être un objet JSON.' };
  }

  const candidat = valeur as Partial<Dossier>;

  if (typeof candidat.reference !== 'string' || candidat.reference.trim() === '') {
    return { ok: false, message: 'Le dossier doit porter une « reference » non vide.' };
  }
  if (!Array.isArray(candidat.evenements)) {
    return { ok: false, message: 'Le dossier doit contenir un tableau « evenements ».' };
  }
  if (!Array.isArray(candidat.pieces)) {
    return { ok: false, message: 'Le dossier doit contenir un tableau « pieces ».' };
  }
  if (!Array.isArray(candidat.qualifications)) {
    return { ok: false, message: 'Le dossier doit contenir un tableau « qualifications ».' };
  }

  return { ok: true, dossier: candidat as Dossier };
}
