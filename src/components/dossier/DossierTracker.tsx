import { STEP_PANELS, TIMELINE_STEPS } from "../../../packages/core/src/dossiers";
import { CheckIcon } from "../icons";

type Props = {
  /** Étape réelle (1–4) calculée par trackingStep(). */
  step: number;
  /** Détail factuel de l'étape en cours (ex. « 143/190 pièces lues »), jamais un pourcentage estimé. */
  detail?: string | null;
  /** Mise à jour en cours alors que des livrables existent déjà (nouvelle pièce). */
  updating?: boolean;
  /** Progression RÉELLE de la lecture (pièces lues / pièces déposées). Absente : aucune barre de lecture. */
  progress?: { done: number; total: number } | null;
  /** Pièces qui demandent une vérification (illisibles, format non pris en charge). */
  toCheck?: number;
};

/**
 * Suivi du dossier : UNE ligne d'état et une barre fine ; le détail des quatre
 * étapes (créé → traitement → documents disponibles → clôturé) s'ouvre à la demande.
 */
export function DossierTracker({ step, detail, updating, progress, toCheck = 0 }: Props) {
  const reading = step === 2 && progress && progress.total > 0;
  const headline =
    // « Analyse » seulement quand une lecture automatique existe réellement (progression fournie) ;
    // sinon le libellé neutre du suivi (« Traitement en cours ») : le dossier peut être traité à la main.
    step === 2 && progress
      ? reading
        ? `Analyse en cours — ${progress.done}/${progress.total} pièces`
        : "Analyse en cours"
      : step === 3 && progress
        ? "Analyse terminée"
        : TIMELINE_STEPS[step - 1];
  // Barre : part réelle des pièces lues pendant la lecture, sinon l'étape atteinte.
  const ratio = reading ? Math.min(1, progress.done / progress.total) : step >= 3 ? 1 : step === 2 ? 0.5 : 0.1;
  const note = updating ? "Mise à jour en cours — vos documents restent disponibles." : toCheck > 0 ? `${toCheck} pièce${toCheck > 1 ? "s restent" : " reste"} à vérifier` : null;

  return (
    <section aria-labelledby="tracker-title" className="rounded-2xl border hairline bg-white px-5 py-4 shadow-card sm:px-6">
      <div role="status" aria-live="polite" className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 id="tracker-title" className="flex items-center gap-2.5 text-[0.95rem] font-semibold text-navy-900">
          <span aria-hidden className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${step >= 3 ? "bg-navy-900 text-cream-50" : "bg-gold-500 text-navy-900"}`}>
            {step >= 3 ? <CheckIcon width={11} height={11} strokeWidth={3} /> : <span className="h-1.5 w-1.5 rounded-full bg-navy-900 motion-safe:animate-pulse" />}
          </span>
          {headline}
        </h2>
        {note && <p className={`text-xs ${toCheck > 0 && !updating ? "font-semibold text-amber-800" : "text-slate-600"}`}>{note}</p>}
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-cream-100"
        role="progressbar"
        aria-label="Avancement du dossier"
        aria-valuemin={0}
        aria-valuemax={reading ? progress.total : 4}
        aria-valuenow={reading ? progress.done : step}
      >
        <span className="block h-full rounded-full bg-navy-900 transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${Math.round(ratio * 100)}%` }} />
      </div>
      {detail && <p className="mt-2 text-xs text-slate-600">{detail}</p>}
      <details className="mt-2 text-xs text-slate-600">
        <summary className="cursor-pointer rounded py-1 font-medium text-slate-500 hover:text-navy-900">Voir le détail du suivi</summary>
        <ol className="mt-2 space-y-2">
          {TIMELINE_STEPS.map((label, i) => {
            const n = i + 1;
            const done = step > n || (step === 4 && n === 4);
            return (
              <li key={label} aria-current={step === n ? "step" : undefined} className="flex gap-2.5">
                <span aria-hidden className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full text-[0.6rem] font-semibold ${done ? "bg-navy-900 text-cream-50" : step === n ? "bg-gold-500 text-navy-900" : "border hairline-strong text-slate-400"}`}>
                  {done ? <CheckIcon width={9} height={9} strokeWidth={3} /> : n}
                </span>
                <span className="leading-relaxed">
                  <span className={step >= n ? "font-semibold text-navy-900" : ""}>{label}</span>
                  {step === n && <span className="block text-slate-600">{STEP_PANELS[i]}</span>}
                </span>
              </li>
            );
          })}
        </ol>
      </details>
    </section>
  );
}
