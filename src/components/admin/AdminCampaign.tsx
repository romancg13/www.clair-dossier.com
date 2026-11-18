import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { parisToday, summarizeClicks, type ClickRow, type ClickSummary } from "../../lib/campaign";

/**
 * Clics du lien court https://clair-dossier.com/v (Village de la Justice).
 * Lecture seule de `campaign_clicks`, protégée par la RLS (`is_admin()`).
 * Chiffres agrégés par jour : ni cookie, ni IP en base, ni visiteurs uniques.
 */
type State = { kind: "loading" } | { kind: "error" } | { kind: "ready"; summary: ClickSummary };

export function AdminCampaign() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from("campaign_clicks")
        .select("day, clicks")
        .eq("source", "village-justice")
        .order("day", { ascending: false })
        .limit(1000);
      if (!alive) return;
      if (error) return setState({ kind: "error" });
      setState({ kind: "ready", summary: summarizeClicks((data ?? []) as ClickRow[], parisToday()) });
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <section aria-labelledby="campagne-titre" className="rounded-2xl border hairline bg-white p-6">
      <p id="campagne-titre" className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
        Campagne Village de la Justice · clair-dossier.com/v
      </p>
      {state.kind === "loading" ? <p className="mt-3 text-sm text-slate-500">Chargement des clics…</p> : null}
      {state.kind === "error" ? (
        <p className="mt-3 text-sm text-slate-500">
          Compteur indisponible : appliquer la migration 20261103120000_campagne_clics. La redirection fonctionne sans lui.
        </p>
      ) : null}
      {state.kind === "ready" ? <Clicks summary={state.summary} /> : null}
    </section>
  );
}

function Clicks({ summary }: { summary: ClickSummary }) {
  const max = Math.max(1, ...summary.days.map((d) => d.clicks));
  return (
    <>
      <div className="mt-3 flex flex-wrap gap-8">
        <p>
          <span className="font-display text-3xl font-semibold text-navy-900">{summary.total}</span>
          <span className="ml-2 text-sm text-slate-500">clics au total</span>
        </p>
        <p>
          <span className="font-display text-3xl font-semibold text-navy-900">{summary.last7}</span>
          <span className="ml-2 text-sm text-slate-500">sur 7 jours</span>
        </p>
      </div>
      <ol className="mt-4 space-y-1" aria-label="Clics par jour, 30 derniers jours">
        {summary.days.map((d) => (
          <li key={d.day} className="flex items-center gap-3 text-xs">
            <span className="w-20 shrink-0 font-mono text-slate-500">{d.day.slice(5).split("-").reverse().join("/")}</span>
            <span className="h-2 rounded-full bg-gold-500" style={{ width: `${(d.clicks / max) * 70}%`, minWidth: d.clicks ? 4 : 0 }} />
            <span className="font-mono text-navy-900">{d.clicks}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-slate-500">
        Chiffre indicatif : chargements de /v par un navigateur, robots et prévisualisations connus exclus. Ce ne sont pas
        des visiteurs uniques ; aucune conversion n'est mesurée. Peut être sous-estimé (réseau lent, JavaScript coupé) ou
        gonflé (scanners de sécurité des messageries, appels directs — plafond 5 000/jour).
      </p>
    </>
  );
}
