import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zipSync } from "fflate";
import { Seo } from "../lib/seo";
import { trackingStep } from "../../packages/core/src/dossiers";
import { DossierTracker } from "../components/dossier/DossierTracker";
import { DeliverablesGrid, type DeliverableFile } from "../components/dossier/DeliverablesGrid";
import { ChronologyEditor } from "../components/dossier/ChronologyEditor";
import { AnalysisView } from "../components/dossier/AnalysisView";
import { applyOverrides, buildDeliverables, type CoverageInfo, type EventOverride, type PieceRef } from "../../supabase/functions/_shared/deliverables.ts";
import { DEMO_FAILED, DEMO_PIECES, DEMO_TITLE, DEMO_UNSUPPORTED, bulkPieces, demoAnalysis } from "../demo/fixture";

/**
 * DÉMONSTRATION isolée (build VITE_DEMO=1 uniquement, jamais en production) :
 * dossier fictif, aucun appel Supabase, aucun e-mail, aucune IA appelée. Les
 * états du traitement sont SIMULÉS (accélérés) ; les six livrables sont de
 * vrais fichiers PDF/DOCX/XLSX/CSV/ICS générés dans le navigateur par le même
 * code que le worker de production.
 */

type Scenario = "cree" | "traitement" | "disponible" | "partiel" | "volumineux" | "cloture" | "pause";

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "cree", label: "Dossier créé" },
  { id: "traitement", label: "Traitement en cours" },
  { id: "disponible", label: "Livrables disponibles" },
  { id: "partiel", label: "Analyse partielle" },
  { id: "volumineux", label: "190 pièces" },
  { id: "pause", label: "Pause (plafond)" },
  { id: "cloture", label: "Dossier clôturé" },
];

type State = {
  enabled: boolean;
  pieces: PieceRef[];
  read: number;
  consolidating: boolean;
  revision: number;
  closed: boolean;
  paused: boolean;
  partial: boolean;
  bulk: boolean;
  overrides: EventOverride[];
  journal: { at: string; label: string }[];
};

const now = () => new Date().toISOString();

function initial(s: Scenario): State {
  const base: State = { enabled: true, pieces: DEMO_PIECES, read: DEMO_PIECES.length, consolidating: false, revision: 1, closed: false, paused: false, partial: false, bulk: false, overrides: [], journal: [] };
  const j = (label: string) => [{ at: now(), label }];
  switch (s) {
    case "cree":
      return { ...base, enabled: false, read: 0, revision: 0, journal: j(`Dossier créé — ${DEMO_PIECES.length} pièces déposées`) };
    case "traitement":
      return { ...base, read: 0, revision: 0, journal: j("Traitement automatique activé — conditions ia-2026-10") };
    case "partiel":
      return { ...base, partial: true, pieces: [...DEMO_PIECES, DEMO_UNSUPPORTED, DEMO_FAILED], read: DEMO_PIECES.length + 2, journal: j("Livrables disponibles — révision 1 (analyse partielle)") };
    case "volumineux":
      return { ...base, bulk: true, pieces: [...DEMO_PIECES, ...bulkPieces().pieces], read: 0, revision: 0, journal: j("190 pièces déposées — lecture en cours") };
    case "pause":
      return { ...base, paused: true, pieces: [...DEMO_PIECES, { id: "p20", file_name: "Avenant au devis.pdf", created_at: now() }], journal: j("Traitement en pause : plafond mensuel atteint") };
    case "cloture":
      return { ...base, closed: true, journal: [{ at: now(), label: "Livrables disponibles — révision 1" }, { at: now(), label: "Dossier clôturé" }] };
    default:
      return { ...base, journal: j("Livrables disponibles — révision 1") };
  }
}

function download(url: string, name: string) {
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function DemoDossier() {
  const [scenario, setScenario] = useState<Scenario>("disponible");
  const [s, setS] = useState<State>(() => initial("disponible"));
  const [files, setFiles] = useState<{ name: string; key: DeliverableFile["key"]; url: string; bytes: Uint8Array }[]>([]);
  const [generating, setGenerating] = useState(false);
  const urls = useRef<string[]>([]);

  const choose = (id: Scenario) => {
    setScenario(id);
    setS(initial(id));
  };

  const analysis = useMemo(() => demoAnalysis(s.bulk), [s.bulk]);
  // Pièces non exploitables de la démo : une .heic (format non pris en charge) et un scan illisible (échec).
  const coverage: CoverageInfo = useMemo(() => {
    const unsupported = s.pieces.some((p) => p.id === DEMO_UNSUPPORTED.id) ? 1 : 0;
    const failed = s.pieces.some((p) => p.id === DEMO_FAILED.id) ? 1 : 0;
    const pending = Math.max(0, s.pieces.length - s.read);
    return { total: s.pieces.length, extracted: Math.min(s.read, s.pieces.length) - unsupported - failed, unsupported, failed, pending, complete: pending === 0 && failed === 0 };
  }, [s.pieces, s.read]);
  const processing = s.enabled && !s.closed && !s.paused && (s.read < s.pieces.length || s.consolidating);

  // Traitement SIMULÉ (accéléré) : lecture pièce par pièce, puis consolidation, puis nouvelle révision.
  useEffect(() => {
    if (!processing) return;
    if (s.read < s.pieces.length) {
      // La consolidation est posée dans la même mise à jour que la dernière lecture.
      const t = setTimeout(
        () =>
          setS((v) => {
            const read = Math.min(v.pieces.length, v.read + (v.bulk ? 6 : 1));
            return { ...v, read, consolidating: v.consolidating || read >= v.pieces.length };
          }),
        s.bulk ? 90 : 450,
      );
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () =>
        setS((v) => ({
          ...v,
          consolidating: false,
          revision: v.revision + 1,
          journal: [{ at: now(), label: `Livrables ${v.revision ? "mis à jour" : "disponibles"} — révision ${v.revision + 1}` }, ...v.journal],
        })),
      1400,
    );
    return () => clearTimeout(t);
  }, [processing, s.read, s.pieces.length, s.bulk, s.consolidating]);

  // Génération RÉELLE des fichiers (même code que le worker) à chaque révision ou correction.
  useEffect(() => {
    if (!s.revision) {
      setFiles([]);
      return;
    }
    let live = true;
    setGenerating(true);
    const exploited = s.pieces.filter((p) => p.id !== DEMO_UNSUPPORTED.id && p.id !== DEMO_FAILED.id);
    void buildDeliverables({ title: DEMO_TITLE, revision: s.revision, generatedAt: new Date(), analysis, coverage: { ...coverage, pending: 0 }, pieces: exploited, overrides: s.overrides, demo: true }).then((out) => {
      if (!live) return;
      urls.current.forEach((u) => URL.revokeObjectURL(u));
      const next = out.map((f) => ({ name: f.name, key: f.key, bytes: f.bytes, url: URL.createObjectURL(new Blob([f.bytes as BlobPart], { type: f.mime })) }));
      urls.current = next.map((f) => f.url);
      setFiles(next);
      setGenerating(false);
    });
    return () => {
      live = false;
    };
    // coverage dépend de read/pieces : la révision suffit à déclencher un nouveau rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.revision, s.overrides, analysis]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const deliverableFiles: DeliverableFile[] = files.map((f) => ({
    key: f.key,
    name: f.name,
    open: () => void window.open(f.url, "_blank", "noopener"),
    download: () => download(f.url, f.name),
  }));
  const downloadAll = () => {
    const zip = zipSync(Object.fromEntries(files.map((f) => [f.name, f.bytes])), { level: 6 });
    const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
    download(url, `livrables-demo-r${s.revision}.zip`);
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  const names = useMemo(() => Object.fromEntries(s.pieces.map((p) => [p.id, p.file_name])), [s.pieces]);
  const events = useMemo(() => applyOverrides(analysis.events, s.overrides), [analysis, s.overrides]);
  const step = trackingStep({ status: s.enabled ? "en-cours" : "brouillon", hasDeliverables: s.revision > 0, processing, closed: s.closed });
  const detail = s.paused
    ? "Traitement en pause : plafond mensuel atteint — la nouvelle pièce sera lue à la reprise."
    : processing
      ? s.read < s.pieces.length
        ? `${s.read}/${s.pieces.length} pièces lues — consolidation à suivre`
        : "Consolidation et préparation des livrables…"
      : null;

  const addPiece = () =>
    setS((v) => ({
      ...v,
      pieces: [...v.pieces, { id: `n${v.pieces.length}`, file_name: `Nouvelle pièce (simulée) ${v.pieces.length + 1}.pdf`, created_at: now() }],
      journal: [{ at: now(), label: "Pièce ajoutée — actualisation des livrables" }, ...v.journal],
    }));
  const toggleClosed = () => setS((v) => ({ ...v, closed: !v.closed, journal: [{ at: now(), label: v.closed ? "Dossier rouvert" : "Dossier clôturé" }, ...v.journal] }));
  const activate = () => setS((v) => ({ ...v, enabled: true, journal: [{ at: now(), label: "Traitement automatique activé — conditions ia-2026-10" }, ...v.journal] }));
  const saveOverride = useCallback(async (eventKey: string, change: { retained_date: string | null; hidden: boolean; reason: string }) => {
    setS((v) => ({
      ...v,
      overrides: [...v.overrides, { event_key: eventKey, label: null, ...change, author: "Vous (démonstration)", created_at: now() }],
      journal: [{ at: now(), label: "Date corrigée — livrables régénérés sans nouvel appel IA" }, ...v.journal],
    }));
  }, []);

  return (
    <>
      <Seo title="Démonstration — suivi et livrables" description="Démonstration fictive du suivi de dossier et des six livrables ClairDossier." path="/demo" noindex />
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8 lg:px-12">
        <div role="note" className="rounded-2xl border border-gold-500/40 bg-gold-500/10 p-4 text-sm leading-relaxed text-navy-900">
          <strong className="font-semibold">Démonstration — données entièrement fictives.</strong> Aucun dossier client, aucune IA appelée, aucun
          e-mail envoyé : les étapes du traitement sont <em>simulées</em> (accélérées). Les six livrables sont de vrais fichiers générés dans
          votre navigateur par le moteur de production.
        </div>

        <header className="mt-8">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">Espace client · /compte/dossier/demo</p>
          <h1 className="mt-2 font-display text-3xl leading-tight text-navy-900 sm:text-4xl">{DEMO_TITLE}</h1>
          <p className="mt-2 text-sm text-slate-500">
            {s.pieces.length} pièce{s.pieces.length > 1 ? "s" : ""} · {s.revision ? `révision ${s.revision}` : "aucun livrable encore"} · {s.closed ? "clôturé" : "ouvert"}
          </p>
        </header>

        <nav aria-label="Simuler un état" className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Simuler un état</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {SCENARIOS.map((x) => (
              <button
                key={x.id}
                type="button"
                aria-pressed={scenario === x.id}
                onClick={() => choose(x.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${scenario === x.id ? "bg-navy-900 text-cream-50" : "border hairline-strong bg-white text-navy-900 hover:bg-cream-100"}`}
              >
                {x.label}
              </button>
            ))}
          </div>
        </nav>

        <div className="mt-6">
          <DossierTracker step={step} detail={detail} updating={processing && s.revision > 0} />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {!s.enabled && !s.closed && (
              <button type="button" onClick={activate} className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-navy-800">
                Activer le traitement automatique (simulé)
              </button>
            )}
            <button type="button" onClick={addPiece} disabled={s.closed} className="rounded-full border hairline-strong bg-white px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-cream-100 disabled:opacity-50">
              Ajouter une pièce (simulée)
            </button>
            <button type="button" onClick={toggleClosed} className="rounded-full border hairline-strong bg-white px-4 py-2 text-xs font-semibold text-navy-900 hover:bg-cream-100">
              {s.closed ? "Rouvrir le dossier" : "Clôturer le dossier"}
            </button>
          </div>
        </div>

        {s.revision > 0 && (
          <section className="mt-8 rounded-2xl border hairline bg-white p-5 shadow-card sm:p-6">
            <AnalysisView analysis={analysis} coverage={coverage} revision={s.revision} createdAt={now()} documentNames={names} />
          </section>
        )}

        <div className="mt-8 rounded-2xl border hairline bg-white p-6 shadow-card sm:p-8">
          <DeliverablesGrid
            files={deliverableFiles}
            caption={s.revision ? `Révision ${s.revision} · générée dans votre navigateur${generating ? " · génération en cours…" : ""}` : null}
            emptyLabel={processing ? "En préparation…" : s.enabled ? "Pas encore disponible." : "Activez le traitement pour générer ce livrable."}
            busy={generating}
            onDownloadAll={downloadAll}
          />
        </div>

        {s.revision > 0 && (
          <div className="mt-8">
            <ChronologyEditor events={events} history={s.overrides} documentNames={names} canEdit={!s.closed} onSave={saveOverride} />
          </div>
        )}

        <section aria-labelledby="journal-title" className="mt-8 rounded-2xl border hairline bg-white p-5 shadow-card sm:p-6">
          <h3 id="journal-title" className="font-display text-lg text-navy-900">
            Journal du dossier
          </h3>
          <ol className="mt-3 space-y-1.5 text-sm text-slate-700">
            {s.journal.map((j, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-14 shrink-0 font-mono text-xs text-slate-400">{new Date(j.at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                {j.label}
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
