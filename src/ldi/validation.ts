/**
 * Validation d'un dossier venu de l'extérieur (fichier, presse-papier, saisie).
 *
 * `JSON.parse('null')` et `JSON.parse('42')` réussissent : sans contrôle de
 * type, la première lecture de propriété lève une exception hors du chemin
 * d'erreur prévu, et l'utilisateur ne voit rien d'explicite. Un seul validateur
 * pour la console et la ligne de commande, pour que les deux refusent la même
 * chose avec le même message.
 */
import type { Dossier, RegimeProcedural } from './types';

/** Régimes acceptés, en miroir du type `RegimeProcedural`. */
const REGIMES: RegimeProcedural[] = ['droit-commun', 'criminalite-organisee', 'terrorisme'];

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

  // Le régime commande le plafond légal de garde à vue. Une valeur inconnue
  // recevait jusqu'ici le repli de 48 h : le rapport annonçait alors une
  // échéance qui n'était pas celle du régime déclaré, sans que rien ne le
  // signale. Un régime absent reste accepté — le pipeline retient le droit
  // commun, et c'est un défaut par omission, pas une valeur fausse.
  if (candidat.regime !== undefined && !REGIMES.includes(candidat.regime)) {
    return {
      ok: false,
      message: `Régime procédural inconnu : « ${String(candidat.regime)} ». Valeurs acceptées : ${REGIMES.join(', ')}.`,
    };
  }

  return { ok: true, dossier: candidat as Dossier };
}
