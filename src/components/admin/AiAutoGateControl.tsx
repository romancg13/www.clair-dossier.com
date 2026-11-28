import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type Mode = "ferme" | "pilote" | "ouvert";

const MODES: { mode: Mode; label: string; detail: string }[] = [
  { mode: "ferme", label: "Fermé", detail: "Aucune activation par les clients (seule l'activation par l'équipe sur accord écrit reste possible)." },
  { mode: "pilote", label: "Pilote", detail: "Seuls les comptes administrateurs peuvent accepter l'analyse automatique ; relecture manuelle." },
  { mode: "ouvert", label: "Ouvert", detail: "Tous les comptes éligibles se voient proposer l'acceptation unique ; publication directe des résultats." },
];

/**
 * Interrupteur général de l'analyse automatique par compte (migration 20261128120000).
 * Ne passer à « Ouvert » qu'après validation des textes (CGV art. 6, confidentialité, AIPD, DPA).
 */
export function AiAutoGateControl() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error: e } = await supabase.from("ai_auto_gate").select("mode").eq("id", 1).maybeSingle();
    setMode(e || !data ? null : (data.mode as Mode));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const change = async (next: Mode) => {
    setPending(true);
    setError(null);
    const { error: e } = await supabase.rpc("ai_admin_set_auto_gate", { p_mode: next });
    if (e) setError(e.message.includes("FORBIDDEN") ? "Réservé à l'administration." : "Le changement n'a pas abouti.");
    await load();
    setPending(false);
  };

  if (mode === null) return null;
  const current = MODES.find((m) => m.mode === mode);

  return (
    <section aria-labelledby="ia-interrupteur" className="rounded-2xl border hairline bg-white px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 id="ia-interrupteur" className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-gold-700">
            Analyse automatique par compte
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{current?.detail}</p>
        </div>
        <div role="group" aria-label="Position de l'interrupteur" className="flex gap-1 rounded-full border hairline bg-white p-1 text-xs">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              aria-pressed={mode === m.mode}
              disabled={pending || mode === m.mode}
              onClick={() => void change(m.mode)}
              className={`rounded-full px-3 py-1 font-medium ${mode === m.mode ? "bg-navy-900 text-cream-50" : "text-navy-900 hover:bg-cream-100"} disabled:cursor-default`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
