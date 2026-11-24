import { DOSSIER } from "../../demo/construction/dossier.ts";

const STEPS = [
  { n: "1", title: "Le dossier", text: "Synthèse, chronologie sourcée, contradiction et pièce manquante mises en avant." },
  { n: "2", title: "La pièce", text: "Chaque constat ouvre la pièce à la bonne page, passage cité surligné." },
  { n: "3", title: "Le projet de rapport", text: "Un paragraphe à corriger, puis validation par l’expert et export PDF." },
];

/** Accueil : annonce le dossier fictif et le traitement simulé, puis « Ouvrir le dossier ». */
export function Welcome({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start lg:gap-16">
      {/* Mobile : le bouton précède le paragraphe (visible sans défiler) ; à partir de sm, il le suit. */}
      <div className="flex flex-col">
        <p className="font-mono text-sm uppercase tracking-[0.14em] text-gold-700">Démonstration · assurance construction</p>
        <h1 id="stage-heading" tabIndex={-1} className="mt-3 font-display text-[2.1rem] font-semibold leading-[1.04] text-navy-900 sm:text-6xl">
          Un sinistre d’infiltration, cinq pièces, un projet de rapport à valider.
        </h1>
        <ul className="mt-6 flex flex-wrap gap-2" aria-label="Nature de la démonstration">
          <li className="rounded-full bg-navy-900 px-4 py-1.5 text-sm font-semibold text-cream-50">Dossier fictif</li>
          <li className="rounded-full border border-navy-900 px-4 py-1.5 text-sm font-semibold text-navy-900">Traitement simulé</li>
        </ul>
        <button
          type="button"
          data-testid="demo-open"
          onClick={onOpen}
          className="mt-6 inline-flex min-h-14 items-center gap-3 self-start rounded-full bg-navy-900 px-8 text-lg font-semibold text-cream-50 shadow-card hover:bg-navy-800 sm:order-last sm:mt-8"
        >
          Ouvrir le dossier
          <span aria-hidden="true" className="text-gold-400">
            →
          </span>
        </button>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-navy-900 xl:text-xl">
          Toutes les parties, pièces et montants sont inventés. Les constats ont été préparés à la main pour la démonstration&nbsp;: aucun document réel n’est lu ni analysé, et aucune conclusion
          n’est tirée sur la cause, les responsabilités ou les garanties.
        </p>
      </div>

      <div className="rounded-md border hairline-strong bg-white p-6 shadow-card sm:p-8">
        <p className="font-mono text-sm text-gold-700">{DOSSIER.reference}</p>
        <p className="mt-1 font-display text-2xl font-semibold leading-snug text-navy-900">{DOSSIER.title}</p>
        <p className="mt-1 text-sm text-slate-500">{DOSSIER.site}</p>
        <ol className="mt-6 space-y-5 border-t hairline pt-5">
          {STEPS.map((s) => (
            <li key={s.n} className="grid grid-cols-[2.25rem_1fr] gap-3">
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-full border border-gold-500 font-display text-xl font-semibold text-gold-700">
                {s.n}
              </span>
              <div>
                <p className="font-semibold text-navy-900">
                  <span className="sr-only">Étape {s.n} : </span>
                  {s.title}
                </p>
                <p className="mt-0.5 leading-relaxed text-slate-500">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
