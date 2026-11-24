import { useEffect, useRef, useState } from "react";
import { isReadyToValidate, reportFileName, validationLabel, type Report, type ReportParagraph } from "../../demo/construction/report.ts";
import { unsupportedChars } from "../../demo/construction/pdf-charset.ts";
import { StatusBadge } from "./Status";
import { SourceList, type OpenSource } from "./SourceLink";

export type Validation = { at: Date; fileName: string };

type Props = {
  report: Report;
  draft: string;
  onDraftChange: (text: string) => void;
  validation: Validation | null;
  onValidated: (v: Validation) => void;
  onOpenSource: OpenSource;
  onBack: () => void;
  onRestart: () => void;
};

const reducedMotion = () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Amène le paragraphe signalé sous l'en-tête collant (scroll-margin) ; `focus` : le paragraphe prend le focus. */
export function goToFlagged(focus = false) {
  const el = document.querySelector<HTMLElement>('[data-testid="report-flagged"]');
  el?.scrollIntoView({ block: "start", behavior: reducedMotion() ? "auto" : "smooth" });
  if (focus) el?.focus({ preventScroll: true });
}

const codePoint = (c: string) => `U+${c.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

function saveFile(bytes: Uint8Array, name: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/pdf" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function CorrectedMark() {
  return (
    <span data-testid="corrected-indicator" className="inline-flex items-center gap-1.5 rounded-full border border-navy-900 px-2.5 py-0.5 text-sm font-semibold text-navy-900">
      <svg aria-hidden="true" viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 8.5l3.2 3L13 4.5" />
      </svg>
      Corrigé par l’expert
    </span>
  );
}

function Paragraph({ p, onOpenSource }: { p: ReportParagraph; onOpenSource: OpenSource }) {
  return (
    <div className="space-y-2 border-t hairline py-3 first:border-t-0">
      <div>{p.status ? <StatusBadge status={p.status} /> : <span className="inline-flex rounded-full border border-dashed border-slate-500 px-2.5 py-0.5 text-sm font-semibold text-slate-500">Réservé à l’expert</span>}</div>
      <p className="leading-relaxed text-navy-900">{p.text}</p>
      {p.sources.length > 0 && <SourceList sources={p.sources} onOpen={onOpenSource} />}
    </div>
  );
}

type FlaggedProps = { p: ReportParagraph; report: Report; draft: string; unsupported: string[]; busy: boolean; onDraftChange: (t: string) => void; onOpenSource: OpenSource };

function FlaggedParagraph({ p, report, draft, unsupported, busy, onDraftChange, onOpenSource }: FlaggedProps) {
  const applied = draft.trim() === report.flagged.suggestion;
  return (
    <div
      data-testid="report-flagged"
      tabIndex={-1}
      className={`my-3 scroll-mt-[calc(8rem+env(safe-area-inset-top,0px))] rounded-lg border-l-4 bg-cream-50 p-4 sm:p-5 ${p.corrected ? "border-navy-900" : "border-gold-500"}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        {p.corrected ? <CorrectedMark /> : <span className="inline-flex rounded-full bg-gold-500 px-2.5 py-0.5 text-sm font-semibold text-navy-900">À corriger</span>}
        <StatusBadge status={p.status!} />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-navy-900 xl:text-base">
        <span className="font-semibold">Pourquoi ce signalement : </span>
        {p.flag!.reason}
      </p>

      <label htmlFor="report-editor" className="mt-4 block text-sm font-semibold text-navy-900">
        Texte du paragraphe {p.corrected ? "(corrigé)" : "(projet simulé)"}
      </label>
      <textarea
        id="report-editor"
        data-testid="report-editor"
        value={draft}
        onChange={(e) => onDraftChange(e.target.value)}
        readOnly={busy}
        aria-invalid={unsupported.length > 0 || undefined}
        aria-describedby={unsupported.length > 0 ? "report-editor-charset" : undefined}
        rows={5}
        className="mt-1.5 min-h-32 w-full resize-y [field-sizing:content] rounded-lg border hairline-strong bg-white px-3 py-2.5 leading-relaxed text-navy-900 focus-visible:border-navy-900"
      />
      {unsupported.length > 0 && (
        <p id="report-editor-charset" data-testid="report-charset-error" className="mt-2 text-sm font-semibold text-red-800">
          {unsupported.length > 1 ? "Caractères non pris en charge par le PDF" : "Caractère non pris en charge par le PDF"} :{" "}
          {unsupported.map((c) => `« ${c} » (${codePoint(c)})`).join(", ")}. Remplacez-{unsupported.length > 1 ? "les" : "le"} ou retirez-{unsupported.length > 1 ? "les" : "le"} pour pouvoir exporter le PDF.
        </p>
      )}

      {!applied && (
        <div className="mt-3 rounded-lg border border-gold-500/60 bg-white p-4">
          <p className="text-sm font-semibold text-gold-700">Correction proposée</p>
          <p className="mt-1 leading-relaxed text-navy-900">{report.flagged.suggestion}</p>
          <button
            type="button"
            data-testid="apply-correction"
            onClick={() => onDraftChange(report.flagged.suggestion)}
            disabled={busy}
            className="mt-3 inline-flex min-h-11 items-center rounded-full bg-navy-900 px-5 text-sm font-semibold text-cream-50 hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-slate-500"
          >
            Appliquer la correction proposée
          </button>
        </div>
      )}
      <div className="mt-3">
        <p className="mb-1.5 text-sm font-semibold text-navy-900">Sources du paragraphe</p>
        <SourceList sources={p.sources} onOpen={onOpenSource} />
      </div>
    </div>
  );
}

/** Étape 3 — projet de rapport : un paragraphe à corriger, puis validation et PDF. */
export function ReportView({ report, draft, onDraftChange, validation, onValidated, onOpenSource, onBack, onRestart }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = isReadyToValidate(report);
  const remaining = report.sections.flatMap((s) => s.paragraphs).filter((p) => p.flag && !p.corrected).length;
  const unsupported = unsupportedChars(draft);
  // Brouillon courant, lu à la fin de la génération ; null une fois la vue quittée.
  const currentDraft = useRef<string | null>(draft);
  useEffect(() => {
    currentDraft.current = draft;
    return () => {
      currentDraft.current = null;
    };
  }, [draft]);

  const exportPdf = async () => {
    const exported = draft;
    setBusy(true);
    setError(null);
    try {
      const at = new Date();
      const { renderReportPdf } = await import("../../demo/construction/report-pdf.ts");
      const bytes = await renderReportPdf(report, { at });
      if (currentDraft.current !== exported) return; // brouillon modifié (ou vue quittée) pendant la génération : ni PDF ni validation
      const fileName = reportFileName(report);
      saveFile(bytes, fileName);
      onValidated({ at, fileName });
    } catch {
      setError("La génération du PDF a échoué. Réessayez.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <p className="font-mono text-sm uppercase tracking-[0.14em] text-gold-700">Projet de rapport · {report.reference}</p>
        <h1 id="stage-heading" tabIndex={-1} className="mt-2 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
          Corriger le projet de rapport
        </h1>
        <p className="mt-3 inline-flex rounded-full border border-gold-700 px-3 py-1 text-sm font-semibold text-gold-700">{report.label}</p>
        <p className="mt-3 max-w-3xl leading-relaxed text-navy-900">
          Le projet ci-dessous a été préparé pour la démonstration. Un paragraphe y affirme une date unique alors que deux pièces divergent : corrigez-le, puis validez pour exporter le PDF.
        </p>
      </header>

      <article aria-label="Projet de rapport" className="rounded-md border hairline-strong bg-white px-4 py-6 shadow-card sm:px-10 sm:py-10">
        <p className="font-mono text-sm text-slate-500">
          {report.reference} · {report.site}
        </p>
        <p className="mt-1 font-display text-2xl font-semibold text-navy-900 sm:text-3xl">{report.title}</p>
        {report.sections.map((s, i) => (
          <section key={s.id} aria-labelledby={`sec-${s.id}`} className="mt-8">
            <h2 id={`sec-${s.id}`} className="border-b border-gold-500/50 pb-1.5 font-display text-2xl font-semibold text-navy-900">
              <span className="mr-2 font-mono text-base text-gold-700">{i + 1}.</span>
              {s.title}
            </h2>
            <div>
              {s.paragraphs.map((p) =>
                p.flag ? (
                  <FlaggedParagraph key={p.id} p={p} report={report} draft={draft} unsupported={unsupported} busy={busy} onDraftChange={onDraftChange} onOpenSource={onOpenSource} />
                ) : (
                  <Paragraph key={p.id} p={p} onOpenSource={onOpenSource} />
                ),
              )}
            </div>
          </section>
        ))}
      </article>

      <div className="sticky bottom-0 z-20 -mx-4 border-t border-gold-500/50 bg-cream-50/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 backdrop-blur sm:-mx-8 sm:px-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 text-sm text-navy-900">
            <div aria-live="polite" className="min-w-0">
              {busy ? (
                <p>Génération du PDF…</p>
              ) : validation ? (
                <p data-testid="validation-status">
                  <span className="font-semibold">{validationLabel(validation.at)}</span>
                  <span className="hidden sm:inline"> · PDF téléchargé : <span className="font-mono">{validation.fileName}</span></span>
                </p>
              ) : !ready ? (
                <p id="export-hint">
                  <span className="font-semibold">{remaining} paragraphe à corriger</span>
                  <span className="hidden sm:inline"> avant de valider.</span>
                </p>
              ) : unsupported.length > 0 ? (
                <p id="export-hint" className="font-semibold text-red-800">
                  Export bloqué : {unsupported.length > 1 ? "caractères non pris en charge" : "caractère non pris en charge"} dans le paragraphe.
                </p>
              ) : (
                <p id="export-hint">Paragraphe corrigé : le projet peut être validé.</p>
              )}
              {error && <p className="mt-1 font-semibold text-red-800">{error}</p>}
            </div>
            {!ready && !busy && (
              <button type="button" data-testid="go-flagged" onClick={() => goToFlagged(true)} className="inline-flex min-h-11 items-center font-semibold text-navy-900 underline underline-offset-4 hover:text-gold-700">
                Aller au paragraphe
              </button>
            )}
            {validation && !busy && (
              <button type="button" data-testid="demo-restart" onClick={onRestart} className="inline-flex min-h-11 items-center text-slate-500 underline underline-offset-4 hover:text-navy-900">
                Recommencer la démonstration
              </button>
            )}
          </div>
          <div className="flex shrink-0 gap-2">
            <button type="button" onClick={onBack} className="inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border hairline-strong bg-white px-4 text-sm font-semibold sm:px-5 text-navy-900 hover:bg-cream-100">
              ← <span className="sm:hidden">Dossier</span>
              <span className="hidden sm:inline">Vue dossier</span>
            </button>
            <button
              type="button"
              data-testid="export-pdf"
              disabled={!ready || busy || unsupported.length > 0}
              aria-describedby={validation ? undefined : "export-hint"}
              onClick={exportPdf}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-full bg-navy-900 px-5 font-semibold sm:flex-none sm:px-6 text-cream-50 hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {busy ? "Génération du PDF…" : "Valider et exporter le PDF"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
