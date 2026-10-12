/**
 * Indicateurs de revenus calculés à partir de `subscriptions` (copie de Stripe). Module PUR.
 *
 * Définitions (affichées dans la console) :
 *  - MRR : somme, ramenée au mois, des abonnements au statut `active` (essais exclus) ;
 *  - MRR à risque : même calcul sur `past_due` / `unpaid` (impayés en cours de relance Stripe) ;
 *  - Résiliations 30 j : abonnements dont `canceled_at` tombe dans les 30 derniers jours ;
 *  - Attrition 30 j : résiliations 30 j ÷ (actifs + résiliations 30 j) — approximation simple.
 * Une ligne sans montant (migration non appliquée, ou synchronisation antérieure) n'est
 * JAMAIS estimée : elle est comptée à part, pour qu'aucun chiffre ne soit inventé.
 */

export type RevenueRow = {
  status: string;
  plan_id: string | null;
  unit_amount?: number | null;
  currency?: string | null;
  billing_interval?: string | null;
  interval_count?: number | null;
  quantity?: number | null;
  cancel_at_period_end: boolean;
  canceled_at: string | null;
  created_at: string;
};

export type RevenueSummary = {
  mrrCents: number;
  arrCents: number;
  atRiskCents: number;
  active: number;
  trialing: number;
  pastDue: number;
  cancelingAtPeriodEnd: number;
  canceled30d: number;
  new30d: number;
  churnRate30d: number | null;
  missingAmount: number;
  currencies: string[];
  byPlan: Array<{ planId: string; active: number; mrrCents: number }>;
};

const MONTHS_PER: Record<string, number> = { day: 12 / 365, week: 12 / 52, month: 1, year: 12 };
const DAY_MS = 86_400_000;

/** Montant mensuel en centimes, ou `null` si la ligne ne porte pas de montant exploitable. */
export function monthlyCents(row: RevenueRow): number | null {
  if (typeof row.unit_amount !== 'number' || !row.billing_interval) return null;
  const months = (MONTHS_PER[row.billing_interval] ?? NaN) * (row.interval_count ?? 1);
  if (!Number.isFinite(months) || months <= 0) return null;
  return Math.round((row.unit_amount * (row.quantity ?? 1)) / months);
}

export function computeRevenue(rows: RevenueRow[], now: Date = new Date()): RevenueSummary {
  const since = now.getTime() - 30 * DAY_MS;
  const plans = new Map<string, { active: number; mrrCents: number }>();
  const currencies = new Set<string>();
  const s: RevenueSummary = {
    mrrCents: 0, arrCents: 0, atRiskCents: 0, active: 0, trialing: 0, pastDue: 0,
    cancelingAtPeriodEnd: 0, canceled30d: 0, new30d: 0, churnRate30d: null,
    missingAmount: 0, currencies: [], byPlan: [],
  };

  for (const row of rows) {
    if (row.currency) currencies.add(row.currency);
    if (Date.parse(row.created_at) >= since) s.new30d += 1;
    if (row.canceled_at && Date.parse(row.canceled_at) >= since && row.status === 'canceled') s.canceled30d += 1;

    const monthly = monthlyCents(row);
    if (row.status === 'active') {
      s.active += 1;
      if (row.cancel_at_period_end) s.cancelingAtPeriodEnd += 1;
      const plan = plans.get(row.plan_id ?? 'inconnue') ?? { active: 0, mrrCents: 0 };
      plan.active += 1;
      if (monthly === null) s.missingAmount += 1;
      else {
        s.mrrCents += monthly;
        plan.mrrCents += monthly;
      }
      plans.set(row.plan_id ?? 'inconnue', plan);
    } else if (row.status === 'trialing') {
      s.trialing += 1;
    } else if (row.status === 'past_due' || row.status === 'unpaid') {
      s.pastDue += 1;
      if (monthly === null) s.missingAmount += 1;
      else s.atRiskCents += monthly;
    }
  }

  s.arrCents = s.mrrCents * 12;
  const base = s.active + s.canceled30d;
  s.churnRate30d = base > 0 ? s.canceled30d / base : null;
  s.currencies = [...currencies].sort();
  s.byPlan = [...plans].map(([planId, v]) => ({ planId, ...v })).sort((a, b) => b.mrrCents - a.mrrCents);
  return s;
}

/** Taux de conversion inscription → abonnement sur 30 jours (`null` sans inscription). */
export function conversionRate(signups30d: number, newSubscriptions30d: number): number | null {
  return signups30d > 0 ? newSubscriptions30d / signups30d : null;
}

export function formatCents(cents: number, currency = 'eur'): string {
  return (cents / 100).toLocaleString('fr-FR', { style: 'currency', currency: currency.toUpperCase(), maximumFractionDigits: 0 });
}
