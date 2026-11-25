import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { formatCents } from "../../lib/ai-admin";
import { LIBELLE_ANOMALIE, syntheseEconomie, type CompteCout } from "../../lib/economie-ia";
import type { RevenueRow } from "../../lib/revenue";

/**
 * Console : « Économie de l'IA » (dans Supervision). Coût IA MESURÉ par compte × montant d'abonnement
 * (copie de Stripe) → marge directe, projection du mois, anomalies, recommandations. Lecture seule ;
 * aucune action automatique. Frais Stripe : estimation, signalée comme telle. Seuil réglable localement.
 */
const TON = { haute: "border-red-200 bg-red-50 text-red-800", moyenne: "border-amber-200 bg-amber-50 text-amber-800", info: "hairline bg-cream-50 text-navy-900" } as const;
const SEUIL_CLE = "clairdossier-seuil-marge";
const lireSeuil = () => {
  try {
    const v = Number(localStorage.getItem(SEUIL_CLE));
    return v >= 1 && v <= 99 ? v : 70;
  } catch {
    return 70;
  }
};
const fmtPct = (v: number | null) => (v === null ? "—" : `${v.toLocaleString("fr-FR")} %`);

export function AdminEconomieIa({ comptes, emails }: { comptes: CompteCout[]; emails: Record<string, string> }) {
  const [abos, setAbos] = useState<RevenueRow[] | null>(null);
  const [seuil, setSeuil] = useState(lireSeuil);

  useEffect(() => {
    let vivant = true;
    void (async () => {
      const rows: RevenueRow[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase
          .from("subscriptions")
          .select("user_id,status,plan_id,unit_amount,currency,billing_interval,interval_count,quantity,cancel_at_period_end,canceled_at,created_at")
          .order("created_at", { ascending: true })
          .range(from, from + 999);
        if (error) break; // colonnes de montant absentes : marges non calculées (aucune estimation)
        rows.push(...((data ?? []) as unknown as RevenueRow[]));
        if (!data || data.length < 1000) break;
      }
      if (vivant) setAbos(rows);
    })();
    return () => {
      vivant = false;
    };
  }, []);

  const s = useMemo(() => (abos ? syntheseEconomie(comptes, abos, new Date(), seuil) : null), [abos, comptes, seuil]);
  if (!s) return <p className="text-sm text-slate-500">Calcul de l'économie de l'IA…</p>;
  const sous = s.marge_projetee_pct !== null && s.marge_projetee_pct < s.seuil_marge_pct;

  return (
    <div className="rounded-2xl border hairline bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-display text-lg text-navy-900">Économie de l'IA — {s.mois}</p>
          <p className="mt-1 text-xs text-slate-500">
            Coûts mesurés (facturés par le fournisseur) · revenus : copie Stripe · frais Stripe <strong>estimés</strong> · jour {s.jours_ecoules}/{s.jours_du_mois}
          </p>
        </div>
        <label className="text-xs text-slate-600">
          Objectif de marge{" "}
          <input
            type="number"
            min={1}
            max={99}
            value={seuil}
            onChange={(e) => {
              const v = Math.min(99, Math.max(1, Number(e.target.value) || 70));
              setSeuil(v);
              try {
                localStorage.setItem(SEUIL_CLE, String(v));
              } catch {
                /* préférence locale seulement */
              }
            }}
            className="ml-1 w-16 rounded-md border hairline px-2 py-1 text-sm"
          />{" "}
          %
        </label>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Revenu mensuel", formatCents(s.revenu_mensuel_cents), "abonnements payants en EUR"],
          ["Coût IA du mois", formatCents(s.cout_ia_cents), s.cout_ia_projete_cents === null ? "projection à partir du 3e jour" : `projeté : ${formatCents(s.cout_ia_projete_cents)}`],
          ["Marge directe", fmtPct(s.marge_pct), "après IA et frais Stripe estimés"],
          ["Marge projetée", fmtPct(s.marge_projetee_pct), `objectif ${s.seuil_marge_pct} %`],
        ].map(([l, v, h], i) => (
          <div key={l} className="rounded-xl border hairline p-4">
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{l}</p>
            <p className={`mt-1.5 font-display text-2xl font-semibold ${i === 3 && sous ? "text-red-600" : "text-navy-900"}`}>{v}</p>
            <p className="mt-1 text-xs text-slate-500">{h}</p>
          </div>
        ))}
      </div>

      <ul className="mt-4 space-y-2">
        {s.recommandations.map((r, i) => (
          <li key={i} className={`rounded-xl border px-4 py-2.5 text-sm ${TON[r.priorite]}`}>
            {r.texte}
          </li>
        ))}
      </ul>

      {s.lignes.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead>
              <tr className="border-b hairline font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-500">
                {["Compte", "Revenu / mois", "Coût IA", "Projeté", "Marge", "Projetée", "Signal"].map((h) => (
                  <th key={h} scope="col" className="py-2 pr-3 font-normal">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y hairline">
              {s.lignes.slice(0, 50).map((l) => (
                <tr key={l.user_id}>
                  <td className="py-2 pr-3 text-navy-900">{emails[l.user_id] ?? l.user_id.slice(0, 8)}</td>
                  <td className="py-2 pr-3 text-slate-600">{l.revenu_mensuel_cents === null ? "—" : formatCents(l.revenu_mensuel_cents)}</td>
                  <td className="py-2 pr-3 text-slate-600">{formatCents(l.cout_ia_cents)}</td>
                  <td className="py-2 pr-3 text-slate-600">{l.cout_ia_projete_cents === null ? "—" : formatCents(l.cout_ia_projete_cents)}</td>
                  <td className="py-2 pr-3 text-slate-600">{fmtPct(l.marge_pct)}</td>
                  <td className={`py-2 pr-3 font-medium ${l.marge_projetee_pct !== null && l.marge_projetee_pct < s.seuil_marge_pct ? "text-red-600" : "text-slate-600"}`}>{fmtPct(l.marge_projetee_pct)}</td>
                  <td className="py-2 text-xs text-slate-600">{l.anomalies.map((a) => LIBELLE_ANOMALIE[a]).join(" · ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
