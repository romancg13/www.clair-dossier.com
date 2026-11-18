/**
 * Lien court de campagne /v — agrégation des clics journaliers (table
 * campaign_clicks, migration 20261103120000). Un clic n'est pas un visiteur unique.
 */
export type ClickRow = { day: string; clicks: number };

export interface ClickSummary {
  total: number;
  last7: number;
  /** 30 derniers jours, du plus récent au plus ancien, jours sans clic inclus (0). */
  days: ClickRow[];
}

const DAY_MS = 86_400_000;

/** `today` au format AAAA-MM-JJ (jour de Paris, comme la base). */
export function summarizeClicks(rows: ClickRow[], today: string): ClickSummary {
  const byDay = new Map(rows.map((r) => [r.day, r.clicks]));
  const end = Date.parse(`${today}T00:00:00Z`);
  const days = Array.from({ length: 30 }, (_, i) => {
    const day = new Date(end - i * DAY_MS).toISOString().slice(0, 10);
    return { day, clicks: byDay.get(day) ?? 0 };
  });
  return {
    total: rows.reduce((sum, r) => sum + r.clicks, 0),
    last7: days.slice(0, 7).reduce((sum, r) => sum + r.clicks, 0),
    days,
  };
}

/** Date du jour à Paris (AAAA-MM-JJ). */
export function parisToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Paris' }).format(now);
}
