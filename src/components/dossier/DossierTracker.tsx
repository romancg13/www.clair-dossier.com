import { useState } from "react";
import { STEP_MESSAGES, STEP_PANELS, TIMELINE_STEPS } from "../../../packages/core/src/dossiers";

/** Mention sous l'étape courante — cohérente avec son sens (« Documents disponibles » n'est pas « en cours »). */
const CURRENT_BADGE: Record<number, string> = { 1: "En cours", 2: "En cours", 3: "Disponibles", 4: "Clôturé" };
import { CheckIcon } from "../icons";

type Props = {
  /** Étape réelle (1–4) calculée par trackingStep(). */
  step: number;
  /** Détail factuel de l'étape en cours (ex. « 143/190 pièces lues »), jamais un pourcentage estimé. */
  detail?: string | null;
  /** Mise à jour en cours alors que des livrables existent déjà (nouvelle pièce). */
  updating?: boolean;
};

/** Suivi du dossier en 4 étapes : Dossier créé → Traitement en cours → Documents disponibles → Dossier clôturé. */
export function DossierTracker({ step, detail, updating }: Props) {
  const [open, setOpen] = useState(0);
  const shown = open || step;
  return (
    <section aria-labelledby="tracker-title" className="rounded-2xl border hairline bg-white p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="tracker-title" className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
          Suivi du dossier
        </h2>
        <p className="text-xs text-slate-500">
          Étape {step} sur {TIMELINE_STEPS.length}
          {updating && <span className="ml-2 rounded-full bg-gold-500/15 px-2 py-0.5 font-semibold text-gold-700">actualisation — vos documents restent disponibles</span>}
        </p>
      </div>

      <ol className="mt-6 grid gap-2 sm:grid-cols-4 sm:gap-0">
        {TIMELINE_STEPS.map((label, i) => {
          const n = i + 1;
          const done = step > n || (step === 4 && n === 4);
          const active = step === n && n !== 4;
          return (
            <li key={label} className="relative sm:px-1">
              {i < TIMELINE_STEPS.length - 1 && (
                <span aria-hidden className="absolute left-[1.15rem] top-9 h-[calc(100%-1.25rem)] w-px bg-slate-300/50 sm:left-[calc(50%+1.25rem)] sm:top-[1.15rem] sm:h-px sm:w-[calc(100%-2.5rem)]">
                  <span className={`block h-full w-full origin-left bg-navy-900 transition-transform duration-500 motion-reduce:transition-none ${step > n ? "scale-100" : "scale-0"}`} />
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpen(n === open ? 0 : n)}
                aria-expanded={shown === n}
                aria-current={step === n ? "step" : undefined}
                className={`flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition-colors hover:bg-cream-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50 sm:flex-col sm:gap-2 sm:text-center ${shown === n ? "bg-cream-100/70" : ""}`}
              >
                <span
                  className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-xs font-semibold transition-colors ${
                    done ? "bg-navy-900 text-cream-50" : active ? "bg-gold-500 text-navy-900 shadow-gold" : "border hairline-strong bg-white text-slate-500"
                  }`}
                >
                  {active && <span aria-hidden className="absolute inset-0 rounded-full ring-2 ring-gold-500/40 motion-safe:animate-ping" />}
                  {done ? <CheckIcon width={14} height={14} strokeWidth={2.5} /> : n}
                </span>
                <span className={`text-sm leading-snug ${done || active ? "font-semibold text-navy-900" : "text-slate-500"}`}>
                  {label}
                  {active && (
                    <span className="block font-mono text-[0.6rem] uppercase tracking-[0.14em] text-gold-700">
                      {CURRENT_BADGE[n] ?? "En cours"}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="mt-5 rounded-xl bg-cream-50 p-4 sm:p-5">
        <p className="text-sm leading-relaxed text-navy-900">{STEP_PANELS[shown - 1]}</p>
        {shown === step && detail && <p className="mt-2 font-mono text-xs text-gold-700">{detail}</p>}
      </div>
      <p className="mt-4 text-sm leading-relaxed text-slate-500">{STEP_MESSAGES[step]}</p>
    </section>
  );
}
