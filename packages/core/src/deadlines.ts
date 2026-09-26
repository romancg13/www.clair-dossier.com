/**
 * Échéances d'un dossier (table `dossier_deadlines`).
 *
 * Extrait de `src/lib/dossier-workspace.ts`. Le statut est calculé à partir de
 * la date seule : ClairDossier n'envoie aucun rappel automatique côté serveur
 * (voir /etat-du-produit — « Relances automatiques à échéance : prévu »).
 */

export type DeadlineStatus = 'retard' | 'a-venir' | 'terminee';
export type DeadlinePriority = 'haute' | 'normale' | 'basse';

export type Deadline = {
  id: string;
  dossier_id: string;
  user_id: string;
  title: string;
  description: string | null;
  due_date: string; // YYYY-MM-DD
  due_time: string | null;
  priority: DeadlinePriority;
  done: boolean;
  created_at: string;
  updated_at?: string;
};

export const PRIORITY_LABELS: Record<DeadlinePriority, string> = {
  haute: 'Haute',
  normale: 'Normale',
  basse: 'Basse',
};

export const DEADLINE_STATUS_LABELS: Record<DeadlineStatus, string> = {
  retard: 'En retard',
  'a-venir': 'À venir',
  terminee: 'Terminée',
};

export function deadlineStatus(dueDate: string, done: boolean, today = new Date()): DeadlineStatus {
  if (done) return 'terminee';
  const d = new Date(`${dueDate}T23:59:59`);
  return d.getTime() < today.getTime() ? 'retard' : 'a-venir';
}

/** Nombre de jours entiers entre aujourd'hui et l'échéance (négatif = passée). */
export function daysUntil(dueDate: string, today = new Date()): number {
  const due = new Date(`${dueDate}T12:00:00`);
  const ref = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0);
  return Math.round((due.getTime() - ref.getTime()) / 86_400_000);
}

/** Libellé relatif court, en français (« Aujourd'hui », « Dans 3 jours », « 2 jours de retard »). */
export function relativeDueLabel(dueDate: string, today = new Date()): string {
  const d = daysUntil(dueDate, today);
  if (d === 0) return "Aujourd'hui";
  if (d === 1) return 'Demain';
  if (d === -1) return 'Hier';
  if (d > 1) return `Dans ${d} jours`;
  return `${Math.abs(d)} jours de retard`;
}

/** Tri d'affichage : en retard d'abord, puis à venir par date, terminées à la fin. */
export function sortDeadlines<T extends Pick<Deadline, 'due_date' | 'done' | 'priority'>>(
  deadlines: T[],
  today = new Date(),
): T[] {
  const weight: Record<DeadlineStatus, number> = { retard: 0, 'a-venir': 1, terminee: 2 };
  const priorityWeight: Record<DeadlinePriority, number> = { haute: 0, normale: 1, basse: 2 };
  return [...deadlines].sort((a, b) => {
    const wa = weight[deadlineStatus(a.due_date, a.done, today)];
    const wb = weight[deadlineStatus(b.due_date, b.done, today)];
    if (wa !== wb) return wa - wb;
    if (a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
    return priorityWeight[a.priority] - priorityWeight[b.priority];
  });
}

/** Compteurs pour le tableau de bord. */
export function countDeadlines<T extends Pick<Deadline, 'due_date' | 'done'>>(
  deadlines: T[],
  today = new Date(),
): Record<DeadlineStatus, number> {
  const counts: Record<DeadlineStatus, number> = { retard: 0, 'a-venir': 0, terminee: 0 };
  for (const d of deadlines) counts[deadlineStatus(d.due_date, d.done, today)] += 1;
  return counts;
}

/** Date ISO (YYYY-MM-DD) d'un objet Date, en heure locale (pas UTC). */
export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Vrai si la chaîne est une date calendaire valide au format YYYY-MM-DD. */
export function isISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

/** Vrai si la chaîne est une heure valide au format HH:MM (24 h). */
export function isTimeOfDay(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

/**
 * Instant d'un rappel local (sur l'appareil) pour une échéance.
 * `offsetDays` = nombre de jours AVANT l'échéance (0 = le jour même).
 * Retourne null si l'instant est déjà passé — on ne programme jamais dans le passé.
 */
export function reminderInstant(
  dueDate: string,
  dueTime: string | null,
  offsetDays: number,
  hourWhenAllDay = 9,
  now = new Date(),
): Date | null {
  if (!isISODate(dueDate)) return null;
  const [y, m, d] = dueDate.split('-').map(Number);
  const [hh, mm] = dueTime && isTimeOfDay(dueTime) ? dueTime.split(':').map(Number) : [hourWhenAllDay, 0];
  const at = new Date(y, m - 1, d - offsetDays, hh, mm, 0, 0);
  return at.getTime() > now.getTime() ? at : null;
}
