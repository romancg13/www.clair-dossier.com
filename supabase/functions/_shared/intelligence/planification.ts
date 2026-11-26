// Traduction d'une automatisation confirmée (workflow produit par l'assistant) vers les paramètres
// de public.create_client_automation. Pur, sans dépendance : partagé par le site, l'application et les tests.
import type { Workflow } from './core.ts';

export interface Planification {
  action: 'bilan_dossiers' | 'prevenir_echeances';
  frequence: 'hebdo' | 'quotidien' | 'mensuel' | 'piece';
  /** 1 = lundi … 7 = dimanche (ISO), seulement en hebdomadaire. */
  jour: number | null;
  heure: number;
}

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** null : demande non exécutable telle quelle (ex. projet de relance seul) — jamais simulée. */
export function planificationDe(w: Workflow | undefined | null): Planification | null {
  if (!w || typeof w.declencheur !== 'string' || !Array.isArray(w.actions)) return null;
  const d = norm(w.declencheur);
  const a = norm(w.actions.join(' | '));
  const heure = Math.min(23, Math.max(0, Number(/(\d{1,2})\s*h/.exec(d)?.[1] ?? 8)));
  const action: Planification['action'] | null = /\bbilan\b/.test(a) ? 'bilan_dossiers' : /\bprevenir\b/.test(a) || /\bavant\b/.test(d) ? 'prevenir_echeances' : /\banalyser\b/.test(a) ? 'bilan_dossiers' : null;
  if (!action) return null;
  if (/\bavant\b/.test(d)) return { action: 'prevenir_echeances', frequence: 'quotidien', jour: null, heure };
  if (/\ba chaque\b/.test(d)) return { action, frequence: 'piece', jour: null, heure };
  const j = JOURS.findIndex((x) => new RegExp(`\\b${x}`).test(d));
  if (j >= 0) return { action, frequence: 'hebdo', jour: j + 1, heure };
  if (/chaque jour|quotidien/.test(d)) return { action, frequence: 'quotidien', jour: null, heure };
  if (/chaque mois|mensuel|1er/.test(d)) return { action, frequence: 'mensuel', jour: null, heure };
  return null;
}
