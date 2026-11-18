// Exécuteur de travaux du moteur : extraction → consolidation → rendu → publication.
// Piloté par des ports (EngineStore) et des dépendances injectées ; aucune base,
// aucun fournisseur, aucune plateforme en dur. Chaque travail est idempotent :
// une reprise après panne ne rappelle pas le modèle pour une étape déjà enregistrée,
// ne republie pas une catégorie inchangée et ne notifie jamais deux fois un lot.
import { buildChronology, type DeliverableKey, type PieceRef, type DeadlineRow, type EventOverride } from '../analysis-model.ts';
import { deadlineKey } from '../ai-pipeline.ts';
import { costCents } from './cost.ts';
import { preparePiece, type PreparedPiece, type ReadingCaps } from './reading.ts';
import { consolidateByRules, extractByRules, type ConsolidationInput } from './rules.ts';
import { guardAnalysis, verifyExtraction, type StoredExtraction } from './verify.ts';
import type { ModelProvider, ModelResult } from './anthropic.ts';
import type { AnalysisData3, AnalysisRec, CoverageRec, DossierState, EngineConfig, EngineStore, ExtractionRec, Job, OutFileLite, PieceRec } from './ports.ts';
import { SCHEMA_VERSION, type AnalysisOutput, type ExtractionOutput } from './schemas.ts';

export interface RenderInput {
  title: string;
  revision: number;
  generatedAt: Date;
  analysis: AnalysisData3;
  coverage: CoverageRec;
  pieces: PieceRef[];
  overrides: EventOverride[];
  deadlineRows: DeadlineRow[];
  provider: string;
}

export interface Renderer {
  /** Jeu de données unique (web + exports) et empreinte par catégorie (sans horodatage). */
  prepare(input: RenderInput): Promise<{ view: unknown; hashes: Record<DeliverableKey, string> }>;
  files(category: DeliverableKey, input: RenderInput, view: unknown): Promise<OutFileLite[]>;
}

export interface EngineDeps {
  store: EngineStore;
  config: EngineConfig;
  renderer: Renderer;
  reading: ReadingCaps;
  /** Fournisseur IA disponible (null = règles seules). */
  ai: ModelProvider | null;
  /** Identifiant de délimitation aléatoire par appel. */
  boundary: () => string;
  sha256: (data: Uint8Array | string) => Promise<string>;
}

/** Fournisseur déterministe exposé sous la même interface que l'IA. */
export const rulesProvider: ModelProvider = {
  name: 'regles',
  canReadImages: false,
  async extract(piece: PreparedPiece, fileName: string) {
    return { ok: true, data: extractByRules(piece, fileName), model: null, input_tokens: 0, output_tokens: 0 };
  },
  async consolidate(input: ConsolidationInput) {
    return { ok: true, data: consolidateByRules(input), model: null, input_tokens: 0, output_tokens: 0 };
  },
};

class Retry extends Error {}

const iso = (d: Date) => d.toISOString();
const monthStartNext = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 6));
const parisDate = (d: Date) => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);

function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') return `{${Object.keys(v as object).sort().map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(v);
}
export { canonical };

export interface RunReport {
  job: string | null;
  kind: Job['kind'] | null;
  outcome: 'done' | 'requeued' | 'failed' | 'cancelled' | 'idle' | 'paused';
}

async function processable(store: EngineStore, dossierId: string): Promise<{ ok: true; dossier: DossierState } | { ok: false; reason: string }> {
  const d = await store.getDossier(dossierId);
  if (!d) return { ok: false, reason: 'dossier introuvable' };
  if (d.deleted) return { ok: false, reason: 'dossier supprimé' };
  if (d.closed) return { ok: false, reason: 'dossier clôturé' };
  if (!(await store.entitlementActive(d.user_id))) return { ok: false, reason: 'droits expirés' };
  return { ok: true, dossier: d };
}

async function overBudget(deps: EngineDeps, userId: string, lotId: string | null): Promise<'user' | 'global' | 'lot' | null> {
  const c = await deps.store.costs(userId, lotId ? [lotId] : []);
  const { budgetCentsPerUserMonth: u, budgetCentsGlobalMonth: g, budgetCentsPerLot: l } = deps.config;
  if (c.globalMonth >= g) return 'global';
  if (c.userMonth >= u) return 'user';
  if (lotId && c.lot >= l) return 'lot';
  return null;
}

async function recordCost(deps: EngineDeps, userId: string, lotId: string | null, r: { model?: string | null; input_tokens?: number; output_tokens?: number }, provider: string): Promise<number> {
  if (provider === 'regles' || !r.input_tokens) return 0;
  const cents = costCents(r.model, r.input_tokens ?? 0, r.output_tokens ?? 0);
  if (cents > 0) await deps.store.addCost(userId, lotId, cents);
  return cents;
}

/* ── Extraction ─────────────────────────────────────────────────────────── */

async function runExtract(deps: EngineDeps, job: Job): Promise<RunReport['outcome']> {
  const { store, config } = deps;
  const piece = job.piece_id ? await store.getPiece(job.piece_id) : null;
  if (!piece || piece.deleted_at) return 'done';
  const p = await processable(store, job.dossier_id);
  if (!p.ok) return 'cancelled';
  const consolidate = () => store.enqueue({ key: `c:${piece.dossier_id}`, kind: 'consolidate', user_id: piece.user_id, dossier_id: piece.dossier_id, piece_id: null, delayMs: config.consolidateDelayMs });

  // Doublon dans le dossier : même empreinte qu'une pièce antérieure → aucune extraction, aucun coût.
  const siblings = await store.listPieces(piece.dossier_id);
  const first = siblings.filter((s) => !s.deleted_at && s.sha256 === piece.sha256).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))[0];
  if (first && first.id !== piece.id) {
    await store.markDuplicate(piece.id, first.id);
    await store.addEvent(piece.dossier_id, piece.user_id, 'piece_doublon', `« ${piece.file_name} » est identique à « ${first.file_name} » : prise en compte une seule fois.`);
    await consolidate();
    return 'done';
  }
  const existing = await store.getExtraction(piece.id);
  if (existing && existing.status !== 'error') {
    await consolidate();
    return 'done';
  }
  const base = { piece_id: piece.id, dossier_id: piece.dossier_id, user_id: piece.user_id, sha256: piece.sha256, created_at: iso(config.now()) };
  // Même empreinte déjà lue pour ce titulaire (autre dossier) : réemploi, coût nul.
  const reusable = await store.findReusableExtraction(piece.user_id, piece.sha256);
  if (reusable && reusable.status === 'ok' && reusable.data && reusable.piece_id !== piece.id) {
    await store.putExtraction({ ...reusable, ...base, reused_from: reusable.piece_id, input_tokens: 0, output_tokens: 0, cost_cents: 0 });
    await consolidate();
    return 'done';
  }

  const bytes = await store.readPieceBytes(piece);
  const prepared = await preparePiece(bytes, piece.file_name, piece.mime, deps.reading);
  const fail = async (status: 'unsupported' | 'error', reason: string, provider = 'aucun', deferred = false) => {
    await store.putExtraction({ ...base, status, reason, deferred, data: null, vision: false, provider, model: null, reused_from: null, input_tokens: 0, output_tokens: 0, cost_cents: 0 });
    await consolidate();
    return 'done' as const;
  };
  if (!prepared.ok) return fail('unsupported', prepared.reason);
  const pp = prepared.piece;
  const provider: ModelProvider = pp.needsVision ? (deps.ai?.canReadImages ? deps.ai : rulesProvider) : (deps.ai ?? rulesProvider);
  if (pp.needsVision && provider === rulesProvider) return fail('error', "Document numérisé ou photo : la lecture visuelle n'est pas disponible pour le moment. La pièce est conservée ; elle sera lue dès que le service le permettra.", 'aucun', true);

  if (provider !== rulesProvider) {
    const over = await overBudget(deps, piece.user_id, piece.lot_id);
    if (over === 'user' || over === 'global') {
      await store.alert('BUDGET', { scope: over, dossier: piece.dossier_id });
      throw Object.assign(new Retry(`budget ${over} atteint`), { until: monthStartNext(config.now()), countAttempt: false });
    }
    if (over === 'lot') return fail('error', 'Budget de traitement de ce dépôt atteint : la pièce est conservée et sera lue lors du prochain recalcul.', provider.name, true);
  }
  const res: ModelResult<ExtractionOutput> = await provider.extract(pp, piece.file_name, deps.boundary());
  const cost = await recordCost(deps, piece.user_id, piece.lot_id, res, provider.name);
  if (!res.ok) {
    if (res.retryable) throw new Retry(res.message);
    // Repli : texte lisible → règles déterministes plutôt qu'un échec.
    if (!pp.needsVision) {
      const fb = await rulesProvider.extract(pp, piece.file_name, '');
      if (fb.ok) {
        await store.putExtraction({ ...base, status: 'ok', reason: `repli règles (${res.kind})`, data: verifyExtraction(fb.data, pp), vision: false, provider: 'regles', model: null, reused_from: null, input_tokens: res.input_tokens ?? 0, output_tokens: res.output_tokens ?? 0, cost_cents: cost });
        await consolidate();
        return 'done';
      }
    }
    // Service indisponible (configuration, facturation, panne durable) : la pièce n'est pas en cause.
    if (res.kind === 'unavailable' || res.kind === 'timeout') {
      await store.alert('IA_INDISPONIBLE', { dossier: piece.dossier_id, detail: res.message.slice(0, 120) });
      return fail('error', "La lecture automatique est momentanément indisponible : la pièce est conservée et sera lue dès que le service le permettra.", provider.name, true);
    }
    return fail('error', 'Lecture impossible de cette pièce : merci de la redéposer (copie nette, sans mot de passe).', provider.name);
  }
  const data: StoredExtraction = verifyExtraction(res.data, pp);
  await store.putExtraction({ ...base, status: 'ok', reason: null, data, vision: pp.needsVision, provider: provider.name, model: res.model, reused_from: null, input_tokens: res.input_tokens, output_tokens: res.output_tokens, cost_cents: cost });
  await consolidate();
  return 'done';
}

/* ── Consolidation ──────────────────────────────────────────────────────── */

function coverageOf(pieces: PieceRec[], ex: Map<string, ExtractionRec | null>): CoverageRec {
  const live = pieces.filter((p) => !p.deleted_at);
  const dup = live.filter((p) => p.duplicate_of);
  const main = live.filter((p) => !p.duplicate_of);
  const st = main.map((p) => ex.get(p.id)?.status ?? null);
  const pending = st.filter((s) => s === null).length;
  const deferred = main.filter((p) => ex.get(p.id)?.status === 'error' && ex.get(p.id)?.deferred).length;
  const failed = st.filter((s) => s === 'error').length - deferred;
  return { total: main.length, extracted: st.filter((s) => s === 'ok').length, unsupported: st.filter((s) => s === 'unsupported').length, failed, pending, deferred, duplicates: dup.length, complete: main.length > 0 && pending === 0 && failed === 0 && deferred === 0 };
}

async function runConsolidate(deps: EngineDeps, job: Job): Promise<RunReport['outcome']> {
  const { store, config } = deps;
  const p = await processable(store, job.dossier_id);
  if (!p.ok) return 'cancelled';
  const dossier = p.dossier;
  const open = (await store.openJobs(dossier.id)).filter((j) => j.kind === 'extract' && j.id !== job.id && (j.status === 'queued' || j.status === 'running'));
  if (open.length) throw Object.assign(new Retry('extractions en cours'), { delayMs: deps.config.extractionWaitMs ?? 20_000, countAttempt: false });

  const pieces = (await store.listPieces(dossier.id)).filter((x) => !x.deleted_at);
  const main = pieces.filter((x) => !x.duplicate_of);
  const ex = new Map<string, ExtractionRec | null>();
  for (const x of main) ex.set(x.id, await store.getExtraction(x.id));
  const cov = coverageOf(pieces, ex);
  if (cov.pending > 0) {
    // Pièce sans extraction ni travail ouvert (travail perdu) : réconciliation.
    for (const x of main.filter((m) => !ex.get(m.id))) await store.enqueue({ key: `x:${dossier.id}:${x.sha256}`, kind: 'extract', user_id: x.user_id, dossier_id: dossier.id, piece_id: x.id });
    throw Object.assign(new Retry('extractions manquantes'), { delayMs: deps.config.extractionWaitMs ?? 20_000, countAttempt: false });
  }
  const usable = main.filter((x) => ex.get(x.id)?.status === 'ok');
  const notOk = main.filter((x) => ex.get(x.id) && ex.get(x.id)!.status !== 'ok');
  const unreadable = notOk.filter((x) => !ex.get(x.id)!.deferred).map((x) => ({ document_id: x.id, file_name: x.file_name, reason: ex.get(x.id)!.reason ?? 'illisible' }));
  const deferredPieces = notOk.filter((x) => ex.get(x.id)!.deferred).map((x) => ({ document_id: x.id, file_name: x.file_name }));
  const fingerprint = await deps.sha256(canonical({ v: SCHEMA_VERSION, usable: usable.map((x) => [x.id, x.sha256, ex.get(x.id)!.provider]), unreadable: unreadable.map((u) => [u.document_id, u.reason]), deferred: deferredPieces.map((d) => d.document_id), objective: dossier.objective }));
  const last = await store.lastAnalysis(dossier.id);
  if (last && last.input_fingerprint === fingerprint) {
    // Rien de nouveau (doublon, relance) : aucun appel au modèle ; republication si la précédente a été interrompue.
    await renderAndPublish(deps, dossier, last);
    return 'done';
  }

  const extractions = new Map(usable.map((x) => [x.id, { data: ex.get(x.id)!.data!, vision: ex.get(x.id)!.vision }]));
  const events = buildChronology(usable.map((x) => ({ document_id: x.id, data: ex.get(x.id)!.data as never })));
  const today = parisDate(config.now());
  const input: ConsolidationInput = {
    today,
    title: dossier.title,
    typology: dossier.typology,
    objective: dossier.objective,
    pieces: usable.map((x) => ({ document_id: x.id, file_name: x.file_name, data: ex.get(x.id)!.data as ExtractionOutput })),
    events: events.map((e) => ({ key: e.key, date: e.date, kind: e.kind, label: e.label, evidence: e.evidence })),
    total: main.length,
    unreadable,
    others: [...unreadable.map((u) => ({ document_id: u.document_id, file_name: u.file_name })), ...deferredPieces],
  };
  const lots = [...new Set(main.map((x) => x.lot_id))];
  const useAi = deps.ai && usable.some((x) => ex.get(x.id)!.provider !== 'regles');
  let provider: ModelProvider = useAi ? deps.ai! : rulesProvider;
  if (provider !== rulesProvider) {
    const over = await overBudget(deps, dossier.user_id, null);
    if (over) {
      await store.alert('BUDGET', { scope: over, dossier: dossier.id });
      provider = rulesProvider; // le client reçoit un résultat déterministe plutôt qu'aucun
    }
  }
  let res: ModelResult<AnalysisOutput> = usable.length ? await provider.consolidate(input, deps.boundary()) : { ok: true, data: consolidateByRules(input), model: null, input_tokens: 0, output_tokens: 0 };
  const cost = await recordCost(deps, dossier.user_id, null, res, provider.name);
  if (!res.ok) {
    if (res.retryable && job.attempts < job.max_attempts) throw new Retry(res.message);
    await store.alert('CONSOLIDATION_REPLI', { dossier: dossier.id, kind: res.kind });
    provider = rulesProvider;
    res = await rulesProvider.consolidate(input, '');
  }
  if (!res.ok) throw new Retry('consolidation impossible');
  const guarded = guardAnalysis(res.data, { knownDocs: new Set(usable.map((x) => x.id)), eventKeys: new Set(events.map((e) => e.key)), extractions }).analysis;
  const rec: AnalysisRec = {
    dossier_id: dossier.id,
    user_id: dossier.user_id,
    revision: (last?.revision ?? 0) + 1,
    input_fingerprint: fingerprint,
    lots,
    data: { ...guarded, events },
    coverage: cov,
    provider: provider.name,
    model: res.model,
    status: 'pending',
    input_tokens: res.input_tokens,
    output_tokens: res.output_tokens,
    cost_cents: cost,
    created_at: iso(config.now()),
  };
  if (!(await store.insertAnalysis(rec))) return 'done'; // révision créée par un autre exécuteur
  await renderAndPublish(deps, dossier, rec);
  return 'done';
}

/* ── Rendu et publication ───────────────────────────────────────────────── */

const toDeadlineRows = (a: AnalysisData3): DeadlineRow[] =>
  a.deadlines
    .filter((d) => d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date))
    .map((d) => ({ ai_key: deadlineKey(d.title, d.date!), title: d.title.slice(0, 200), due_date: d.date!, due_time: null, priority: d.priority, done: false, user_edited: false, description: `${d.kind === 'mentioned' ? 'Date écrite dans une pièce' : d.kind === 'computed' ? 'Date calculée' : 'À confirmer'} — ${d.basis}`.slice(0, 1000) }));

export async function renderAndPublish(deps: EngineDeps, dossier: DossierState, rec: AnalysisRec): Promise<'published' | 'pending' | 'skipped'> {
  const { store, config } = deps;
  // Droits, clôture et suppression revérifiés JUSTE avant publication.
  const again = await processable(store, dossier.id);
  if (!again.ok) return 'skipped';
  const latest = await store.lastAnalysis(dossier.id);
  if (latest && latest.revision > rec.revision) return 'skipped'; // révision obsolète
  const mode: 'approved' | 'pending' = again.dossier.review_mode === 'auto' && !again.dossier.sensitive ? 'approved' : 'pending';
  if (mode === 'approved') await store.syncDeadlines(dossier.id, dossier.user_id, toDeadlineRows(rec.data));
  const pieces = (await store.listPieces(dossier.id)).filter((x) => !x.deleted_at && !x.duplicate_of).map((x) => ({ id: x.id, file_name: x.file_name, created_at: x.created_at }));
  const input: RenderInput = { title: dossier.title, revision: rec.revision, generatedAt: config.now(), analysis: rec.data, coverage: rec.coverage, pieces, overrides: await store.listOverrides(dossier.id), deadlineRows: await store.listDeadlines(dossier.id), provider: rec.provider };
  const { view, hashes } = await deps.renderer.prepare(input);
  const published = await store.getPublished(dossier.id);
  const changed = (Object.keys(hashes) as DeliverableKey[]).filter((k) => published[k]?.data_hash !== hashes[k] || published[k]?.status !== mode);
  for (const k of changed) {
    const files = await deps.renderer.files(k, input, view);
    const cur = await store.lastAnalysis(dossier.id);
    if (cur && cur.revision > rec.revision) return 'skipped';
    await store.publishCategory(dossier.id, dossier.user_id, k, rec.revision, hashes[k], files, mode);
  }
  await store.putView(dossier.id, rec.revision, view, mode);
  if (mode === 'approved') {
    if (rec.status !== 'published') await store.setAnalysisStatus(dossier.id, rec.revision, 'published');
    if (changed.length) await store.addEvent(dossier.id, dossier.user_id, 'resultats_disponibles', `Résultats mis à jour (révision ${rec.revision}) : ${changed.length} document${changed.length > 1 ? 's' : ''} actualisé${changed.length > 1 ? 's' : ''}${rec.coverage.complete ? '' : ' — analyse partielle'}.`);
    const claimed: string[] = [];
    for (const lot of rec.lots) if (await store.claimNotification(dossier.id, lot)) claimed.push(lot);
    if (claimed.length && changed.length && (await store.notificationsAllowed(dossier.user_id))) {
      await store.notify(dossier.user_id, {
        subject: 'Vos résultats ClairDossier sont disponibles',
        text: `Bonjour,\n\nDe nouveaux résultats sont disponibles dans l'un de vos dossiers (situation, dates, prochaine action).${rec.coverage.complete ? '' : "\nCertaines pièces n'ont pas pu être exploitées : le détail figure dans votre espace."}\n\nCes documents sont générés automatiquement et doivent être vérifiés ; ils ne constituent pas un conseil juridique.`,
        link: config.dossierLink(dossier.id),
      });
    }
    return 'published';
  }
  if (changed.length) await store.addEvent(dossier.id, dossier.user_id, 'analyse_en_relecture', `Résultats en cours de vérification (révision ${rec.revision}).`);
  return 'pending';
}

async function runRender(deps: EngineDeps, job: Job): Promise<RunReport['outcome']> {
  const p = await processable(deps.store, job.dossier_id);
  if (!p.ok) return 'cancelled';
  const last = await deps.store.lastAnalysis(job.dossier_id);
  if (!last) return 'done';
  await renderAndPublish(deps, p.dossier, last);
  return 'done';
}

/* ── Boucle ─────────────────────────────────────────────────────────────── */

export async function runOnce(deps: EngineDeps): Promise<RunReport> {
  if (deps.config.paused) return { job: null, kind: null, outcome: 'paused' };
  const job = await deps.store.claim(deps.config.workerId, deps.config.leaseMs);
  if (!job) return { job: null, kind: null, outcome: 'idle' };
  try {
    const outcome = job.kind === 'extract' ? await runExtract(deps, job) : job.kind === 'consolidate' ? await runConsolidate(deps, job) : await runRender(deps, job);
    await deps.store.complete(job, { status: outcome === 'cancelled' ? 'cancelled' : 'done', error: null });
    return { job: job.id, kind: job.kind, outcome: outcome === 'cancelled' ? 'cancelled' : 'done' };
  } catch (e) {
    const r = e as Retry & { until?: Date; delayMs?: number; countAttempt?: boolean };
    const message = e instanceof Error ? e.message.slice(0, 300) : 'erreur';
    const countAttempt = r.countAttempt !== false;
    if (countAttempt && job.attempts >= job.max_attempts) {
      await deps.store.complete(job, { status: 'failed', error: message });
      await deps.store.alert('TRAVAIL_ECHEC', { kind: job.kind, dossier: job.dossier_id, attempts: job.attempts });
      return { job: job.id, kind: job.kind, outcome: 'failed' };
    }
    const delayMs = r.until ? r.until.getTime() - deps.config.now().getTime() : r.delayMs ?? Math.min(15 * 60_000, 2 ** job.attempts * 15_000);
    await deps.store.complete(job, { status: 'queued', delayMs, countAttempt, error: message });
    return { job: job.id, kind: job.kind, outcome: 'requeued' };
  }
}

/** Traite des travaux tant que le budget de temps le permet. */
export async function drain(deps: EngineDeps, timeBudgetMs: number, maxJobs = 200): Promise<RunReport[]> {
  const t0 = deps.config.now().getTime();
  const out: RunReport[] = [];
  while (out.length < maxJobs && deps.config.now().getTime() - t0 < timeBudgetMs) {
    const r = await runOnce(deps);
    if (r.outcome === 'idle' || r.outcome === 'paused') break;
    out.push(r);
  }
  return out;
}
