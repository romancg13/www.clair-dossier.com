import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { computeRevenue, conversionRate, formatCents, type RevenueRow, type RevenueSummary } from "../../lib/revenue";

/**
 * Revenus et conversions (console admin). Lecture seule de `subscriptions`,
 * protégée par la RLS (`is_admin()`) : un compte non administrateur ne lit rien.
 * Aucun chiffre estimé : sans montant synchronisé depuis Stripe, l'indicateur
 * l'annonce au lieu d'afficher une valeur.
 */

const BASE_COLUMNS = "status, plan_id, cancel_at_period_end, canceled_at, created_at";
const AMOUNT_COLUMNS = "unit_amount, currency, billing_interval, interval_count, quantity";

type State =
  | { kind: "loading" }
  | { kind: "error" }
  | { kind: "ready"; summary: RevenueSummary; amountsMigrated: boolean };

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

export function AdminRevenue({ signups30d }: { signups30d: number }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      let amountsMigrated = true;
      let res = await supabase.from("subscriptions").select(`${BASE_COLUMNS}, ${AMOUNT_COLUMNS}`);
      if (res.error?.code === "42703" || res.error?.code === "PGRST204") {
        amountsMigrated = false;
        res = await supabase.from("subscriptions").select(BASE_COLUMNS);
      }
      if (!alive) return;
      if (res.error) return setState({ kind: "error" });
      setState({ kind: "ready", summary: computeRevenue((res.data ?? []) as RevenueRow[]), amountsMigrated });
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

  const { summary: s, amountsMigrated } = state;
  const currency = s.currencies[0] ?? "eur";
  const noAmount = !amountsMigrated || (s.mrrCents === 0 && s.missingAmount > 0);
  const money = (cents: number) => (noAmount ? "—" : formatCents(cents, currency));

  return (
    <section aria-labelledby="revenus-titre" className="mt-6">
      <h3 id="revenus-titre" className="font-display text-xl font-semibold text-navy-900">Revenus & conversions</h3>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="MRR" value={money(s.mrrCents)} hint="Abonnements actifs, ramenés au mois" />
        <Tile label="ARR" value={money(s.arrCents)} hint="MRR × 12" />
        <Tile label="Abonnés actifs" value={String(s.active)} hint={`${s.trialing} en essai`} />
        <Tile label="Impayés" value={String(s.pastDue)} hint={noAmount ? undefined : `${money(s.atRiskCents)} / mois à risque`} warn={s.pastDue > 0} />
        <Tile label="Résiliations 30 j" value={String(s.canceled30d)} hint={`Attrition ${pct(s.churnRate30d)}`} warn={s.canceled30d > 0} />
        <Tile label="Fin de période demandée" value={String(s.cancelingAtPeriodEnd)} hint="À recontacter avant l'échéance" warn={s.cancelingAtPeriodEnd > 0} />
        <Tile label="Nouveaux abonnements 30 j" value={String(s.new30d)} />
        <Tile label="Conversion 30 j" value={pct(conversionRate(signups30d, s.new30d))} hint={`${signups30d} inscription(s) sur 30 jours`} />
      </div>
      {s.byPlan.length > 0 ? (
        <ul className="mt-4 space-y-1 text-sm text-navy-900">
          {s.byPlan.map((p) => (
            <li key={p.planId}>
              <span className="font-medium">{p.planId}</span> · {p.active} actif(s) · {money(p.mrrCents)} / mois
            </li>
          ))}
        </ul>
      ) : null}
      {noAmount || s.missingAmount > 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          {amountsMigrated
            ? `${s.missingAmount} abonnement(s) sans montant synchronisé : lancer scripts/sync-stripe-subscriptions.ts --apply pour les compléter depuis Stripe.`
            : "Montants non encore synchronisés : appliquer la migration 20261012120000_revenus_abonnements puis relancer la synchronisation Stripe. Aucun montant n'est estimé."}
        </p>
      ) : null}
    </section>
  );
}
