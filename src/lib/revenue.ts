/**
 * Indicateurs de revenus calculés à partir de `subscriptions` (copie de Stripe). Module PUR.
 *
 * Définitions (affichées dans la console) :
 *  - MRR : somme, ramenée au mois, des abonnements au statut `active` (essais exclus) ;
 *  - MRR à risque : même calcul sur `past_due` / `unpaid` (impayés en cours de relance Stripe) ;
 *  - Nouveaux abonnements 30 j : abonnements payants (`active` / `past_due`) créés sur 30 jours ;
 *  - Résiliations 30 j : abonnements dont `canceled_at` tombe dans les 30 derniers jours ;
 *  - Attrition 30 j : résiliations 30 j ÷ (actifs + résiliations 30 j) — approximation simple.
 * Une ligne sans montant (migration non appliquée, ou synchronisation antérieure) n'est
 * JAMAIS estimée : elle est comptée à part, pour qu'aucun chiffre ne soit inventé. Les
 * montants d'une autre devise que celle du tableau ne sont jamais additionnés : comptés à part.
 */

export type RevenueRow = {
  user_id?: string | null;
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
  currency: string;
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
  /** Abonnements actifs sans montant exploitable (exclus du MRR). */
  missingAmount: number;
  /** Impayés sans montant exploitable (le MRR à risque est alors inconnu). */
  missingAtRisk: number;
  /** Lignes facturées dans une autre devise (exclues des totaux). */
  otherCurrency: number;
  byPlan: Array<{ planId: string; active: number; mrrCents: number }>;
};

const MONTHS_PER: Record<string, number> = { day: 12 / 365, week: 12 / 52, month: 1, year: 12 };
const DAY_MS = 86_400_000;
const PAYING = new Set(['active', 'past_due']);

/** Montant mensuel en centimes, ou `null` si la ligne ne porte pas de montant exploitable. */
export function monthlyCents(row: RevenueRow): number | null {
  if (typeof row.unit_amount !== 'number' || !row.billing_interval) return null;
  const months = (MONTHS_PER[row.billing_interval] ?? NaN) * (row.interval_count ?? 1);
  if (!Number.isFinite(months) || months <= 0) return null;
  return Math.round((row.unit_amount * (row.quantity ?? 1)) / months);
}

const isRecent = (iso: string | null, since: number) => iso !== null && Date.parse(iso) >= since;

export function computeRevenue(rows: RevenueRow[], now: Date = new Date(), currency = 'eur'): RevenueSummary {
  const since = now.getTime() - 30 * DAY_MS;
  const plans = new Map<string, { active: number; mrrCents: number }>();
  const s: RevenueSummary = {
    currency, mrrCents: 0, arrCents: 0, atRiskCents: 0, active: 0, trialing: 0, pastDue: 0,
    cancelingAtPeriodEnd: 0, canceled30d: 0, new30d: 0, churnRate30d: null,
    missingAmount: 0, missingAtRisk: 0, otherCurrency: 0, byPlan: [],
  };

  for (const row of rows) {
    if (PAYING.has(row.status) && isRecent(row.created_at, since)) s.new30d += 1;
    if (row.status === 'canceled' && isRecent(row.canceled_at, since)) s.canceled30d += 1;

    const foreign = Boolean(row.currency) && row.currency !== currency;
    if (foreign && (PAYING.has(row.status) || row.status === 'unpaid')) s.otherCurrency += 1;
    const monthly = foreign ? null : monthlyCents(row);

    if (row.status === 'active') {
      s.active += 1;
      if (row.cancel_at_period_end) s.cancelingAtPeriodEnd += 1;
      const plan = plans.get(row.plan_id ?? 'inconnue') ?? { active: 0, mrrCents: 0 };
      plan.active += 1;
      if (monthly === null) {
        if (!foreign) s.missingAmount += 1;
      } else {
        s.mrrCents += monthly;
        plan.mrrCents += monthly;
      }
      plans.set(row.plan_id ?? 'inconnue', plan);
    } else if (row.status === 'trialing') {
      s.trialing += 1;
    } else if (row.status === 'past_due' || row.status === 'unpaid') {
      s.pastDue += 1;
      if (monthly === null) {
        if (!foreign) s.missingAtRisk += 1;
      } else s.atRiskCents += monthly;
    }
  }

  s.arrCents = s.mrrCents * 12;
  const base = s.active + s.canceled30d;
  s.churnRate30d = base > 0 ? s.canceled30d / base : null;
  s.byPlan = [...plans].map(([planId, v]) => ({ planId, ...v })).sort((a, b) => b.mrrCents - a.mrrCents);
  return s;
}

/**
 * Conversion de la cohorte des 30 derniers jours : part des comptes INSCRITS sur la période
 * qui ont souscrit un abonnement payant (`null` sans inscription). Une souscription d'un compte
 * plus ancien n'entre pas au numérateur : le taux ne peut pas dépasser 100 %.
 */
export function cohortConversion(rows: RevenueRow[], recentSignupIds: readonly string[]): number | null {
  if (recentSignupIds.length === 0) return null;
  const cohort = new Set(recentSignupIds);
  const converted = new Set(rows.filter((r) => r.user_id && cohort.has(r.user_id) && PAYING.has(r.status)).map((r) => r.user_id));
  return converted.size / cohort.size;
}

export function formatCents(cents: number, currency = 'eur'): string {
  return (cents / 100).toLocaleString('fr-FR', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
