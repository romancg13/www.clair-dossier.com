import { DOSSIER, frLongDate, type ChronologyEvent, type Finding } from "../../demo/construction/dossier.ts";
import { StatusBadge, StatusLegend } from "./Status";
import { DocIcon, SourceList, type OpenSource } from "./SourceLink";

type Props = {
  onOpenSource: OpenSource;
  onOpenReport: () => void;
  /** Paragraphes du projet de rapport encore à corriger. */
  toCorrect: number;
};

const contradiction = DOSSIER.findings.find((f) => f.kind === "contradiction")!;
const missing = DOSSIER.findings.find((f) => f.kind === "piece-manquante")!;
const constats = DOSSIER.findings.filter((f) => f.kind === "constat");
const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

function Eyebrow({ children }: { children: string }) {
  return <p className="font-mono text-sm uppercase tracking-[0.14em] text-gold-700">{children}</p>;
}

function ContradictionCard({ f, onOpenSource }: { f: Finding; onOpenSource: OpenSource }) {
  const [a, b] = f.versions!;
  const compare = [a.sources[0], b.sources[0]];
  return (
    <article data-testid="finding-contradiction" aria-labelledby="finding-contradiction-title" className="rounded-xl border border-gold-500/60 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Contradiction entre pièces</Eyebrow>
        <StatusBadge status={f.status} />
      </div>
      <h3 id="finding-contradiction-title" className="mt-2 font-display text-2xl font-semibold leading-snug text-navy-900 xl:text-[1.75rem]">
        {f.title}
      </h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-start">
        {[a, b].map((v, i) => (
          <div key={v.date} className={i === 1 ? "sm:order-3" : ""}>
            <p className="font-display text-3xl font-semibold text-navy-900">
              <time dateTime={v.date}>{frLongDate(v.date)}</time>
            </p>
            <p className="mt-1 text-sm text-navy-900 xl:text-base">selon : {v.according}</p>
            <div className="mt-3">
              <SourceList sources={v.sources} related={compare} onOpen={onOpenSource} />
            </div>
          </div>
        ))}
        <p aria-hidden="true" className="hidden self-center font-display text-4xl text-gold-700 sm:order-2 sm:block">
          ≠
        </p>
      </div>
      <p className="mt-4 border-t hairline pt-3 leading-relaxed text-navy-900">{f.text}</p>
      <button
        type="button"
        onClick={(e) => onOpenSource(compare, 0, e.currentTarget)}
        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-navy-900 px-4 text-sm font-semibold text-navy-900 hover:bg-cream-100"
      >
        <DocIcon /> Comparer les deux pièces
      </button>
    </article>
  );
}

function MissingCard({ f, onOpenSource }: { f: Finding; onOpenSource: OpenSource }) {
  return (
    <article data-testid="finding-missing" aria-labelledby="finding-missing-title" className="rounded-xl border border-gold-500/60 bg-white p-5 shadow-card sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Eyebrow>Pièce annoncée, absente</Eyebrow>
        <StatusBadge status={f.status} />
      </div>
      <div className="mt-2 flex gap-4">
        <div aria-hidden="true" className="mt-1 grid h-16 w-12 shrink-0 place-items-center rounded-sm border-2 border-dashed border-gold-700/70 font-display text-2xl text-gold-700">
          ?
        </div>
        <div className="min-w-0">
          <h3 id="finding-missing-title" className="font-display text-2xl font-semibold leading-snug text-navy-900 xl:text-[1.75rem]">
            {f.announced!.title} du {frLongDate(f.announced!.date)}
          </h3>
          <p className="mt-1 text-sm text-slate-500">Cité dans une pièce ; absent des {DOSSIER.pieces.length} pièces du dossier.</p>
        </div>
      </div>
      <p className="mt-4 border-t hairline pt-3 leading-relaxed text-navy-900">{f.text}</p>
      <div className="mt-3">
        <SourceList sources={f.sources} onOpen={onOpenSource} />
      </div>
    </article>
  );
}

function ChronologyItem({ e, onOpenSource }: { e: ChronologyEvent; onOpenSource: OpenSource }) {
  const other = e.contradictionId ? DOSSIER.chronology.find((x) => x.contradictionId === e.contradictionId && x.id !== e.id) : undefined;
  const related = other ? [...e.sources, ...other.sources] : e.sources;
  return (
    <li className="grid gap-x-5 gap-y-1 border-t hairline py-4 sm:grid-cols-[9.5rem_1fr]">
      <p className="font-mono text-sm font-medium text-navy-900 sm:pt-0.5">
        <time dateTime={e.date}>{frLongDate(e.date)}</time>
      </p>
      <div className={e.contradictionId ? "border-l-4 border-gold-500 pl-3" : ""}>
        <StatusBadge status={e.status} />
        <p className="mt-1.5 font-medium leading-snug text-navy-900">{e.label}</p>
        {other && (
          <p className="mt-1 text-sm font-medium text-gold-700">
            ≠ Même événement daté du {frLongDate(other.date)} dans une autre pièce — date à confirmer.
          </p>
        )}
        <div className="mt-2">
          <SourceList sources={e.sources} related={related} onOpen={onOpenSource} />
        </div>
      </div>
    </li>
  );
}

/** Étape 1 — vue dossier : synthèse, points saillants, chronologie sourcée. */
export function DossierView({ onOpenSource, onOpenReport, toCorrect }: Props) {
  const contradictions = DOSSIER.findings.filter((f) => f.kind === "contradiction").length;
  const missingCount = DOSSIER.findings.filter((f) => f.kind === "piece-manquante").length;
  const summary = [
    { n: DOSSIER.pieces.length, one: "pièce", many: "pièces" },
    { n: contradictions, one: "contradiction", many: "contradictions" },
    { n: missingCount, one: "pièce manquante", many: "pièces manquantes" },
  ];

  return (
    <div className="space-y-10">
      <header>
        <Eyebrow>{`Dossier ${DOSSIER.reference} · fictif`}</Eyebrow>
        {/* En-tête compact : au vidéoprojecteur (1280×720), les points prioritaires restent visibles sans défiler. */}
        <h1 id="stage-heading" tabIndex={-1} className="mt-2 max-w-4xl font-display text-3xl font-semibold leading-[1.1] text-navy-900 sm:text-4xl">
          {DOSSIER.title}
        </h1>
        <p className="mt-1.5 text-slate-500">{DOSSIER.site}</p>
        <section aria-labelledby="synthese-title" className="mt-3">
          <h2 id="synthese-title" className="sr-only">
            Synthèse
          </h2>
          <dl className="flex flex-wrap gap-x-7 gap-y-1">
            {summary.map((s, i) => (
              <div key={s.one} className="flex items-baseline gap-2">
                <dt className="order-2 font-medium text-navy-900">{s.n > 1 ? s.many : s.one}</dt>
                <dd className={`order-1 font-display text-4xl font-semibold leading-none lining-nums ${i === 0 ? "text-navy-900" : "text-gold-700"}`}>{s.n}</dd>
              </div>
            ))}
          </dl>
        </section>
      </header>

      <section aria-labelledby="points-title">
        <h2 id="points-title" className="font-display text-3xl font-semibold text-navy-900">
          À examiner en priorité
        </h2>
        <div className="mt-4 grid gap-5 lg:grid-cols-2">
          <ContradictionCard f={contradiction} onOpenSource={onOpenSource} />
          <MissingCard f={missing} onOpenSource={onOpenSource} />
        </div>
        <details className="mt-4 max-w-3xl">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-navy-900">Parties ({DOSSIER.parties.length}, toutes fictives)</summary>
          <dl className="mt-1 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {DOSSIER.parties.map((p) => (
              <div key={p.role} className="flex flex-wrap gap-x-2">
                <dt className="text-slate-500">{p.role} :</dt>
                <dd className="font-medium text-navy-900">{p.name}</dd>
              </div>
            ))}
          </dl>
        </details>
      </section>

      <section aria-labelledby="rapport-callout" className="flex flex-col gap-4 rounded-xl bg-navy-900 p-5 text-cream-50 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.14em] text-gold-400">Étape 3 · projet de rapport</p>
          <h2 id="rapport-callout" className="mt-1 font-display text-2xl font-semibold">
            {toCorrect ? `${plural(toCorrect, "paragraphe", "paragraphes")} à corriger avant validation` : "Projet corrigé, prêt à valider"}
          </h2>
          <p className="mt-1 text-sm text-cream-100">Projet préparé pour la démonstration — traitement simulé.</p>
        </div>
        <button
          type="button"
          data-testid="report-open"
          onClick={onOpenReport}
          className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-gold-500 px-6 font-semibold text-navy-900 hover:bg-gold-400"
        >
          Corriger le projet de rapport →
        </button>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_23rem]">
        <section aria-labelledby="chrono-title">
          <h2 id="chrono-title" className="font-display text-3xl font-semibold text-navy-900">
            Chronologie sourcée
          </h2>
          <p className="mt-1 text-sm text-slate-500">Chaque événement renvoie à une pièce, une page et un passage exact.</p>
          <ol className="mt-3 border-b hairline">
            {DOSSIER.chronology.map((e) => (
              <ChronologyItem key={e.id} e={e} onOpenSource={onOpenSource} />
            ))}
          </ol>

          <h2 className="mt-10 font-display text-3xl font-semibold text-navy-900">Autres constats</h2>
          <ul className="mt-3 border-b hairline">
            {constats.map((f) => (
              <li key={f.id} className="border-t hairline py-4">
                <StatusBadge status={f.status} />
                <h3 className="mt-1.5 font-semibold text-navy-900">{f.title}</h3>
                <p className="mt-1 leading-relaxed text-navy-900">{f.text}</p>
                <div className="mt-2">
                  <SourceList sources={f.sources} onOpen={onOpenSource} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <aside className="space-y-8 lg:sticky lg:top-36 lg:self-start" aria-label="Légende et pièces">
          <StatusLegend className="rounded-xl border hairline bg-white p-5" />
          <div className="rounded-xl border hairline bg-white p-5">
            <h2 className="font-mono text-sm uppercase tracking-[0.14em] text-gold-700">Pièces du dossier</h2>
            <ol className="mt-3 space-y-2">
              {DOSSIER.pieces.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    data-testid="piece-open"
                    onClick={(e) => onOpenSource([{ pieceId: p.id, page: 1, passage: "" }], 0, e.currentTarget)}
                    className="flex min-h-11 w-full items-start gap-3 rounded-lg px-2 py-2 text-left hover:bg-cream-100"
                  >
                    <span className="font-mono text-sm font-medium text-gold-700">{String(p.numero).padStart(2, "0")}</span>
                    <span className="min-w-0">
                      <span className="block font-medium leading-snug text-navy-900">{p.typeLabel}</span>
                      <span className="block text-sm text-slate-500">
                        {frLongDate(p.date)} · {plural(p.pages.length, "page", "pages")}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
