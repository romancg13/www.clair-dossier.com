import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import {
  cohortConversion,
  computeRevenue,
  formatCents,
  type RevenueRow,
  type RevenueSummary,
} from "../../lib/revenue";

/**
 * Revenus et conversions (console admin). Lecture seule de `subscriptions`,
 * protégée par la RLS (`is_admin()`) : un compte non administrateur ne lit rien.
 * Aucun chiffre estimé : sans montant synchronisé depuis Stripe, l'indicateur
 * l'annonce au lieu d'afficher une valeur. Toutes les lignes sont lues (pagination).
 */

const BASE_COLUMNS = "user_id, status, plan_id, cancel_at_period_end, canceled_at, created_at";
const AMOUNT_COLUMNS = "unit_amount, currency, billing_interval, interval_count, quantity";
const PAGE = 1000;

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; rows: RevenueRow[]; summary: RevenueSummary; amountsMigrated: boolean };

/** Lit toute la table par pages ordonnées (la limite par défaut de l'API est de 1 000 lignes). */
async function fetchAll(columns: string): Promise<{ rows: RevenueRow[]; code?: string }> {
  const rows: RevenueRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("subscriptions")
      .select(columns)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) return { rows, code: error.code ?? "erreur" };
    rows.push(...((data ?? []) as unknown as RevenueRow[]));
    if (!data || data.length < PAGE) return { rows };
  }
}

function Tile({ label, value, hint, warn = false }: { label: string; value: string; hint?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border hairline bg-white p-4">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-semibold ${warn ? "text-red-600" : "text-navy-900"}`}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} %`);

export function AdminRevenue({ recentSignupIds }: { recentSignupIds: string[] }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      let amountsMigrated = true;
      let res = await fetchAll(`${BASE_COLUMNS}, ${AMOUNT_COLUMNS}`);
      if (res.code === "42703" || res.code === "PGRST204") {
        amountsMigrated = false;
        res = await fetchAll(BASE_COLUMNS);
      }
      if (!alive) return;
      if (res.code) return setState({ kind: "error" });
      setState({ kind: "ready", rows: res.rows, summary: computeRevenue(res.rows), amountsMigrated });
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (state.kind === "loading") return <p className="mt-4 text-sm text-slate-500">Calcul des revenus…</p>;
  if (state.kind === "error") {
    return (
      <p className="mt-4 text-sm text-slate-500">
        Revenus indisponibles : la table des abonnements n'est pas encore en service (migration « automatisation » à appliquer).
      </p>
    );
  }

  const { rows, summary: s, amountsMigrated } = state;
  const mrrKnown = amountsMigrated && !(s.mrrCents === 0 && s.missingAmount > 0);
  const money = (cents: number, known: boolean) => (known ? formatCents(cents, s.currency) : "—");
  const atRiskKnown = amountsMigrated && s.missingAtRisk === 0;

  return (
    <section aria-labelledby="revenus-titre" className="mt-6">
      <h3 id="revenus-titre" className="font-display text-xl font-semibold text-navy-900">Revenus & conversions</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="MRR" value={money(s.mrrCents, mrrKnown)} hint="Abonnements actifs, ramenés au mois" />
        <Tile label="ARR" value={money(s.arrCents, mrrKnown)} hint="MRR × 12" />
        <Tile label="Abonnés actifs" value={String(s.active)} hint={`${s.trialing} en essai`} />
        <Tile
          label="Impayés"
          value={String(s.pastDue)}
          hint={s.pastDue === 0 ? undefined : atRiskKnown ? `${money(s.atRiskCents, true)} / mois à risque` : "Montant à risque inconnu"}
          warn={s.pastDue > 0}
        />
        <Tile label="Résiliations 30 j" value={String(s.canceled30d)} hint={`Attrition ${pct(s.churnRate30d)}`} warn={s.canceled30d > 0} />
        <Tile label="Fin de période demandée" value={String(s.cancelingAtPeriodEnd)} hint="À recontacter avant l'échéance" warn={s.cancelingAtPeriodEnd > 0} />
        <Tile label="Nouveaux abonnements 30 j" value={String(s.new30d)} hint="Payants (hors essais)" />
        <Tile
          label="Conversion des inscrits 30 j"
          value={pct(cohortConversion(rows, recentSignupIds))}
          hint={`${recentSignupIds.length} inscription(s) sur 30 jours`}
        />
      </div>
      {s.byPlan.length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm text-navy-900">
          {s.byPlan.map((p) => (
            <li key={p.planId}>
              <span className="font-medium">{p.planId}</span> · {p.active} actif(s) · {money(p.mrrCents, mrrKnown)} / mois
            </li>
          ))}
        </ul>
      ) : null}
      {!amountsMigrated || s.missingAmount > 0 || s.missingAtRisk > 0 || s.otherCurrency > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          {!amountsMigrated
            ? "Montants non encore synchronisés : appliquer la migration 20261012120000_revenus_abonnements puis relancer la synchronisation Stripe. Aucun montant n'est estimé."
            : `${s.missingAmount + s.missingAtRisk} abonnement(s) sans montant synchronisé : lancer scripts/sync-stripe-subscriptions.ts --apply pour les compléter depuis Stripe.`}
          {s.otherCurrency > 0 ? ` ${s.otherCurrency} abonnement(s) dans une autre devise que ${s.currency.toUpperCase()}, exclu(s) des totaux.` : ""}
        </p>
      ) : null}
    </section>
  );
}
