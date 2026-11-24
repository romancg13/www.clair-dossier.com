import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { Seo } from "../lib/seo";
import { DOSSIER, type SourceRef } from "../demo/construction/dossier.ts";
import { FLAGGED_PARAGRAPH_ID, buildReport } from "../demo/construction/report.ts";
import { Welcome } from "../components/demo-construction/Welcome";
import { DossierView } from "../components/demo-construction/DossierView";
import { PieceViewer } from "../components/demo-construction/PieceViewer";
import { ReportView, goToFlagged, type Validation } from "../components/demo-construction/ReportView";
import type { OpenSource } from "../components/demo-construction/SourceLink";

/**
 * DÉMONSTRATION « assurance construction » (build VITE_DEMO=1 uniquement, hors Layout) :
 * dossier FICTIF, traitement SIMULÉ, aucun appel réseau. Trois clics : ouvrir le dossier,
 * ouvrir une source, corriger le projet de rapport (puis valider et exporter un vrai PDF,
 * généré dans le navigateur). Données : src/demo/construction/dossier.ts (source unique).
 */

type Stage = "accueil" | "dossier" | "rapport";

const STEPS: { stage: Stage | null; label: string; short: string }[] = [
  { stage: "dossier", label: "Le dossier", short: "Dossier" },
  { stage: null, label: "La pièce", short: "Pièce" },
  { stage: "rapport", label: "Le projet de rapport", short: "Rapport" },
];

export function DemoConstruction() {
  const [stage, setStage] = useState<Stage>("accueil");
  const [viewer, setViewer] = useState<{ key: number; sources: SourceRef[]; index: number } | null>(null);
  const [draft, setDraft] = useState<string | null>(null);
  const [validation, setValidation] = useState<Validation | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const firstRender = useRef(true);

  const report = useMemo(() => buildReport(DOSSIER, draft === null ? {} : { [FLAGGED_PARAGRAPH_ID]: draft }), [draft]);
  const toCorrect = report.sections.flatMap((s) => s.paragraphs).filter((p) => p.flag && !p.corrected).length;

  // Changement d'étape : retour en haut et focus sur le titre (lecteurs d'écran, clavier).
  // Étape 3 : le paragraphe à corriger est à ~1 360 px du titre ; on l'amène sous l'en-tête
  // collant, le focus restant sur le titre. `toCorrect` est lu à l'arrivée seulement (pas en dépendance).
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    document.getElementById("stage-heading")?.focus({ preventScroll: true });
    if (stage === "rapport" && toCorrect > 0) goToFlagged();
  }, [stage]);

  const openSource: OpenSource = useCallback((sources, index, el) => {
    trigger.current = el;
    setViewer((v) => ({ key: (v?.key ?? 0) + 1, sources, index }));
  }, []);
  const closeViewer = useCallback(() => {
    setViewer(null);
    requestAnimationFrame(() => trigger.current?.focus());
  }, []);
  const changeDraft = (text: string) => {
    setDraft(text);
    setValidation(null); // toute modification après validation annule celle-ci
  };
  const restart = () => {
    setDraft(null);
    setValidation(null);
    setStage("dossier");
  };

  return (
    <>
      <Seo
        title="Démonstration — dossier assurance construction (fictif)"
        description="Démonstration sur un dossier fictif d’infiltration : chronologie sourcée, contradiction, pièce manquante et projet de rapport à valider. Traitement simulé."
        path="/demo/assurance-construction"
        noindex
      />
      <a href="#main" className="skip-nav">
        Aller au contenu
      </a>
      <div className="min-h-dvh bg-cream-50 text-base text-ink lining-nums xl:text-lg">
        <header className="sticky top-0 z-30 border-b hairline-strong bg-cream-50/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur">
          <p role="note" className="bg-navy-900 px-4 py-1.5 text-center text-sm font-medium text-cream-50">
            <span className="font-semibold text-gold-400">Dossier fictif · traitement simulé</span>
            <span className="hidden sm:inline"> — aucune donnée réelle, aucune lecture automatique de documents.</span>
          </p>
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2.5 sm:px-8">
            <div className="*:min-h-11 *:items-center">
              <Logo />
            </div>
            <Link
              to="/pilote-assurance-construction"
              data-testid="cta-pilote"
              className="inline-flex min-h-11 items-center rounded-full border border-navy-900 px-4 text-sm font-semibold text-navy-900 hover:bg-navy-900 hover:text-cream-50 sm:px-5"
            >
              Consulter le pilote
            </Link>
          </div>
        </header>

        <main id="main" tabIndex={-1} className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-8 sm:pt-10">
          {stage !== "accueil" && (
            <nav aria-label="Étapes de la démonstration" className="mb-8">
              <ol className="flex gap-1 sm:gap-2">
                {STEPS.map((s, i) => {
                  const current = s.stage === stage;
                  const content = (
                    <>
                      <span aria-hidden="true" className={`grid size-7 place-items-center rounded-full font-mono text-sm ${current ? "bg-gold-500 text-navy-900" : "border border-navy-900/30 text-navy-900"}`}>
                        {i + 1}
                      </span>
                      <span className="sm:hidden">{s.short}</span>
                      <span className="hidden sm:inline">{s.label}</span>
                    </>
                  );
                  const base = "inline-flex min-h-11 items-center gap-2 whitespace-nowrap rounded-full px-2 pr-3 text-sm font-semibold sm:px-3 sm:pr-4";
                  return (
                    <li key={s.label}>
                      {s.stage ? (
                        <button type="button" aria-current={current ? "step" : undefined} onClick={() => setStage(s.stage!)} className={`${base} ${current ? "bg-navy-900 text-cream-50" : "text-navy-900 hover:bg-cream-100"}`}>
                          {content}
                        </button>
                      ) : (
                        <span className={`${base} text-slate-500`} title="Ouvrez une source depuis le dossier ou le rapport">
                          {content}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </nav>
          )}

          {stage === "accueil" && <Welcome onOpen={() => setStage("dossier")} />}
          {stage === "dossier" && <DossierView onOpenSource={openSource} onOpenReport={() => setStage("rapport")} toCorrect={toCorrect} />}
          {stage === "rapport" && (
            <ReportView
              report={report}
              draft={draft ?? report.flagged.original}
              onDraftChange={changeDraft}
              validation={validation}
              onValidated={setValidation}
              onOpenSource={openSource}
              onBack={() => setStage("dossier")}
              onRestart={restart}
            />
          )}
        </main>
      </div>
      {viewer && <PieceViewer key={viewer.key} sources={viewer.sources} index={viewer.index} onClose={closeViewer} />}
    </>
  );
}
