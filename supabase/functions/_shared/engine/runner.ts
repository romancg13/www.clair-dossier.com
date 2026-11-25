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
import type { AnalysisData3, AnalysisRec, BudgetScope, CoverageRec, DossierState, EngineConfig, EngineStore, ExtractionRec, Job, OutFileLite, PieceRec } from './ports.ts';
import { SCHEMA_VERSION, type AnalysisOutput, type ExtractionOutput } from './schemas.ts';

export interface RenderInput {
  /** Identifiant du dossier (UID des événements ICS propres au dossier). */
  dossierId?: string;
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
/** Lectures indépendantes menées en parallèle par paquet (borne la pression sur le stockage). */
const READ_BATCH = 16;

/** Attentes avant relecture automatique d'une pièce en échec définitif : trois essais au plus, de plus en plus espacés. */
export const REREAD_DELAYS_MS = [60 * 60_000, 6 * 60 * 60_000, 24 * 60 * 60_000];
const rereadDelays = (c: EngineConfig) => c.rereadDelaysMs ?? REREAD_DELAYS_MS;
/** Clé du travail de relecture automatique d'une pièce (distincte de x:<pièce>, terminé quand elle est créée). */
const rereadKey = (pieceId: string) => `xr:${pieceId}`;

/** Motif lisible d'un repli sur les règles déterministes faute de budget IA. */
export const BUDGET_REASON: Record<BudgetScope, string> = {
  user: 'plafond mensuel de lecture approfondie de votre compte atteint',
  global: 'plafond mensuel de lecture approfondie du service atteint',
  lot: 'budget de traitement de ce dépôt atteint',
};
const budgetResume = (scope: BudgetScope) => (scope === 'lot' ? 'La lecture approfondie de ce dépôt n’a pas été faite.' : 'La lecture approfondie reprendra automatiquement au début du mois prochain.');

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
  // La pièce est lue avec celles de même contenu (détection des doublons) : les seules fiches utiles si le magasin
  // sait les désigner, sinon toutes celles du dossier. Droits vérifiés de front (lectures indépendantes).
  const [found, p] = await Promise.all([
    !job.piece_id ? null : store.piecesOfSameContent ? store.piecesOfSameContent(job.dossier_id, job.piece_id) : store.listPieces(job.dossier_id).then((all) => ({ piece: all.find((s) => s.id === job.piece_id) ?? null, same: all })),
    processable(store, job.dossier_id),
  ]);
  const piece = found?.piece ?? null;
  const siblings = found?.same ?? [];
  if (!piece || piece.deleted_at) return 'done';
  if (!p.ok) return 'cancelled';
  const consolidate = () => store.enqueue({ key: `c:${piece.dossier_id}`, kind: 'consolidate', user_id: piece.user_id, dossier_id: piece.dossier_id, piece_id: null, delayMs: config.consolidateDelayMs });

  // Doublon dans le dossier : même empreinte qu'une pièce antérieure → aucune extraction, aucun coût.
  // Une pièce antérieure en échec de lecture (non reporté) n'est pas un original : la copie redéposée est lue et la remplace.
  const same = siblings.filter((s) => !s.deleted_at && s.sha256 === piece.sha256).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  const failedCopies: PieceRec[] = [];
  let first: PieceRec | undefined;
  for (const s of same) {
    if (s.id !== piece.id && s.duplicate_of) continue; // copie déjà rattachée à une autre pièce : jamais un original
    const sx = s.id === piece.id ? null : await store.getExtraction(s.id);
    if (sx && sx.status === 'error' && !sx.deferred) {
      failedCopies.push(s);
      continue;
    }
    first = s;
    break;
  }
  if (first && first.id !== piece.id) {
    await store.markDuplicate(piece.id, first.id);
    await store.addEvent(piece.dossier_id, piece.user_id, 'piece_doublon', `« ${piece.file_name} » est identique à « ${first.file_name} » : prise en compte une seule fois.`);
    await consolidate();
    return 'done';
  }
  for (const f of failedCopies) if (f.duplicate_of !== piece.id) await store.markDuplicate(f.id, piece.id);
  // Extraction déjà enregistrée et extraction réutilisable (même empreinte, autre dossier) : lectures indépendantes, menées de front.
  const [existing, reusable] = await Promise.all([store.getExtraction(piece.id), store.findReusableExtraction(piece.user_id, piece.sha256)]);
  // Pièce lue par les règles faute de budget IA : la lecture IA est reprise (ce travail attendait le cycle suivant).
  const resumable = Boolean(existing && existing.status === 'ok' && existing.fallback && existing.fallback !== 'lot' && deps.ai);
  if (existing && existing.status !== 'error' && !resumable) {
    await consolidate();
    return 'done';
  }
  // Échec définitif déjà enregistré : ce passage est une relecture automatique (comptée, plafonnée).
  const rereads = existing && existing.status === 'error' && !existing.deferred ? (existing.rereads ?? 0) + 1 : 0;
  const base = { piece_id: piece.id, dossier_id: piece.dossier_id, user_id: piece.user_id, sha256: piece.sha256, created_at: iso(config.now()) };
  // Même empreinte déjà lue pour ce titulaire (autre dossier) : réemploi, coût nul.
  if (!resumable && reusable && reusable.status === 'ok' && reusable.data && reusable.piece_id !== piece.id) {
    await store.putExtraction({ ...reusable, ...base, reused_from: reusable.piece_id, input_tokens: 0, output_tokens: 0, cost_cents: 0 });
    await consolidate();
    return 'done';
  }

  const bytes = await store.readPieceBytes(piece);
  const prepared = await preparePiece(bytes, piece.file_name, piece.mime, deps.reading);
  const fail = async (status: 'unsupported' | 'error', reason: string, provider = 'aucun', deferred = false) => {
    // Échec définitif (ni format non pris en charge, ni report) : la pièce reste annoncée « illisible » et sera relue
    // d'elle-même, sans nouveau dépôt, après une attente croissante ; au-delà du plafond, plus aucun essai.
    const definitive = status === 'error' && !deferred;
    await store.putExtraction({ ...base, status, reason, deferred, ...(definitive ? { rereads } : {}), data: null, vision: false, provider, model: null, reused_from: null, input_tokens: 0, output_tokens: 0, cost_cents: 0 });
    await consolidate();
    const wait = definitive ? rereadDelays(config)[rereads] : undefined;
    if (wait !== undefined) {
      // Depuis le travail de relecture lui-même : il se replanifie (se remettre en file relancerait aussitôt).
      if (job.key === rereadKey(piece.id)) throw Object.assign(new Retry('relecture automatique reprogrammée'), { delayMs: wait, countAttempt: false });
      await store.enqueue({ key: rereadKey(piece.id), kind: 'extract', user_id: piece.user_id, dossier_id: piece.dossier_id, piece_id: piece.id, delayMs: wait });
    }
    return 'done' as const;
  };
  if (!prepared.ok) return fail('unsupported', prepared.reason);
  const pp = prepared.piece;
  const provider: ModelProvider = pp.needsVision ? (deps.ai?.canReadImages ? deps.ai : rulesProvider) : (deps.ai ?? rulesProvider);
  if (pp.needsVision && provider === rulesProvider) return fail('error', "Document numérisé ou photo : la lecture visuelle n'est pas disponible pour le moment. La pièce est conservée ; elle sera lue dès que le service le permettra.", 'aucun', true);

  if (provider !== rulesProvider) {
    const over = await overBudget(deps, piece.user_id, piece.lot_id);
    if (over && !pp.needsVision) {
      // Budget IA épuisé, texte lisible : repli sur les règles déterministes. Le résultat est livré, annoncé PARTIEL
      // avec son motif ; ce même travail reprend la lecture IA au cycle suivant (un seul appel, un seul coût).
      await store.alert('BUDGET', { scope: over, dossier: piece.dossier_id });
      if (!(existing && existing.status === 'ok' && existing.fallback === over)) {
        const fb = await rulesProvider.extract(pp, piece.file_name, '');
        if (!fb.ok) throw new Retry('repli règles impossible');
        await store.putExtraction({ ...base, status: 'ok', reason: `Lecture par les règles automatiques seulement : ${BUDGET_REASON[over]}. ${budgetResume(over)}`, fallback: over, data: verifyExtraction(fb.data, pp), vision: false, provider: 'regles', model: null, reused_from: null, input_tokens: 0, output_tokens: 0, cost_cents: 0 });
        await store.addEvent(piece.dossier_id, piece.user_id, 'lecture_partielle', `« ${piece.file_name} » lue par les règles automatiques seulement : ${BUDGET_REASON[over]}.`);
        await consolidate();
      }
      if (over === 'lot') return 'done';
      throw Object.assign(new Retry(`budget ${over} atteint : repli règles`), { until: monthStartNext(config.now()), countAttempt: false });
    }
    if (over === 'user' || over === 'global') {
      await store.alert('BUDGET', { scope: over, dossier: piece.dossier_id });
      // Pièce comptée « reportée » : les pièces déjà lues sont publiées sans attendre ; ce travail la relit au début du mois suivant.
      await store.putExtraction({ ...base, status: 'error', reason: 'Plafond mensuel de lecture atteint : la pièce est conservée et sera lue au début du mois prochain.', deferred: true, data: null, vision: false, provider: provider.name, model: null, reused_from: null, input_tokens: 0, output_tokens: 0, cost_cents: 0 });
      await consolidate();
      throw Object.assign(new Retry(`budget ${over} atteint`), { until: monthStartNext(config.now()), countAttempt: false });
    }
    if (over === 'lot') return fail('error', 'Budget de traitement de ce dépôt atteint : la pièce est conservée et sera lue lors du prochain recalcul.', provider.name, true);
  }
  const res: ModelResult<ExtractionOutput> = await provider.extract(pp, piece.file_name, deps.boundary());
  const cost = await recordCost(deps, piece.user_id, piece.lot_id, res, provider.name);
  if (!res.ok) {
    // Dernière tentative : plus de nouvel essai payant, mêmes replis qu'une erreur définitive.
    if (res.retryable && job.attempts < job.max_attempts) throw new Retry(res.message);
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

function coverageOf(pieces: PieceRec[], ex: Map<string, ExtractionRec | null>, consolidationFallback: BudgetScope | null = null): CoverageRec {
  const live = pieces.filter((p) => !p.deleted_at);
  const dup = live.filter((p) => p.duplicate_of);
  const main = live.filter((p) => !p.duplicate_of);
  const st = main.map((p) => ex.get(p.id)?.status ?? null);
  const pending = st.filter((s) => s === null).length;
  const deferred = main.filter((p) => ex.get(p.id)?.status === 'error' && ex.get(p.id)?.deferred).length;
  const failed = st.filter((s) => s === 'error').length - deferred;
  // Repli budget : pièces lues par les règles seules, ou consolidation rendue par les règles → résultat PARTIEL, motif en clair.
  const fb = main.map((p) => ex.get(p.id)).filter((x): x is ExtractionRec => Boolean(x && x.status === 'ok' && x.fallback));
  const scope = consolidationFallback ?? fb[0]?.fallback ?? null;
  const partial = scope
    ? { fallback: fb.length, partial_reason: `${fb.length ? `${fb.length} pièce${fb.length > 1 ? 's lues' : ' lue'} par les règles automatiques seulement` : 'synthèse établie par les règles automatiques seulement'} — ${BUDGET_REASON[scope]}. ${budgetResume(scope)}` }
    : {};
  return { total: main.length, extracted: st.filter((s) => s === 'ok').length, unsupported: st.filter((s) => s === 'unsupported').length, failed, pending, deferred, duplicates: dup.length, ...partial, complete: main.length > 0 && pending === 0 && failed === 0 && deferred === 0 && !scope };
}

/** Clé du travail qui reprend, au cycle suivant, une consolidation rendue par les règles faute de budget. */
const resumeKey = (dossierId: string) => `cr:${dossierId}`;

async function runConsolidate(deps: EngineDeps, job: Job): Promise<RunReport['outcome']> {
  const { store, config } = deps;
  const p = await processable(store, job.dossier_id);
  if (!p.ok) return 'cancelled';
  const dossier = p.dossier;
  // Lectures en cours ou reprises proches ; une lecture reportée au mois suivant (budget) ne retient pas la publication.
  const horizon = config.now().getTime() + 10 * 60_000;
  // Une relecture automatique (xr:) non plus : la pièce reste « illisible » d'ici là, et relance la consolidation si elle est lue.
  const open = (await store.openJobs(dossier.id)).filter((j) => j.kind === 'extract' && !j.key.startsWith('xr:') && j.id !== job.id && (j.status === 'running' || (j.status === 'queued' && Date.parse(j.run_after) <= horizon)));
  if (open.length) throw Object.assign(new Retry('extractions en cours'), { delayMs: deps.config.extractionWaitMs ?? 20_000, countAttempt: false });

  const pieces = (await store.listPieces(dossier.id)).filter((x) => !x.deleted_at);
  const main = pieces.filter((x) => !x.duplicate_of);
  const ex = new Map<string, ExtractionRec | null>();
  // Extractions lues par paquets parallèles bornés (un aller-retour par paquet, et non par pièce).
  for (let i = 0; i < main.length; i += READ_BATCH) {
    const batch = main.slice(i, i + READ_BATCH);
    (await Promise.all(batch.map((x) => store.getExtraction(x.id)))).forEach((x, k) => ex.set(batch[k].id, x));
  }
  const cov = coverageOf(pieces, ex);
  if (cov.pending > 0) {
    // Pièce sans extraction ni travail ouvert (travail perdu) : réconciliation.
    // Même clé que le dépôt et la réconciliation planifiée (x:<pièce>) : jamais deux travaux pour une même pièce.
    for (const x of main.filter((m) => !ex.get(m.id))) await store.enqueue({ key: `x:${x.id}`, kind: 'extract', user_id: x.user_id, dossier_id: dossier.id, piece_id: x.id });
    throw Object.assign(new Retry('extractions manquantes'), { delayMs: deps.config.extractionWaitMs ?? 20_000, countAttempt: false });
  }
  const usable = main.filter((x) => ex.get(x.id)?.status === 'ok');
  const notOk = main.filter((x) => ex.get(x.id) && ex.get(x.id)!.status !== 'ok');
  const unreadable = notOk.filter((x) => !ex.get(x.id)!.deferred).map((x) => ({ document_id: x.id, file_name: x.file_name, reason: ex.get(x.id)!.reason ?? 'illisible' }));
  const deferredPieces = notOk.filter((x) => ex.get(x.id)!.deferred).map((x) => ({ document_id: x.id, file_name: x.file_name }));
  const fingerprint = await deps.sha256(canonical({ v: SCHEMA_VERSION, usable: usable.map((x) => [x.id, x.sha256, ex.get(x.id)!.provider]), unreadable: unreadable.map((u) => [u.document_id, u.reason]), deferred: deferredPieces.map((d) => d.document_id), objective: dossier.objective }));
  const last = await store.lastAnalysis(dossier.id);
  const lots = [...new Set(main.map((x) => x.lot_id))];
  const useAi = Boolean(deps.ai && usable.some((x) => ex.get(x.id)!.provider !== 'regles'));
  // Budget consulté une seule fois par consolidation, et seulement si l'IA serait appelée.
  let budget: BudgetScope | null | undefined;
  const over = async () => (budget === undefined ? (budget = useAi ? await overBudget(deps, dossier.user_id, null) : null) : budget);
  // Fin d'une consolidation en repli budget : reprise IA au cycle suivant, par un travail à part (jamais le travail
  // courant de consolidation, qu'un nouveau dépôt doit pouvoir relancer tout de suite).
  const parkForResume = async (): Promise<RunReport['outcome']> => {
    const until = monthStartNext(config.now());
    if (job.key === resumeKey(dossier.id)) throw Object.assign(new Retry('budget atteint : reprise au cycle suivant'), { until, countAttempt: false });
    await store.enqueue({ key: resumeKey(dossier.id), kind: 'consolidate', user_id: dossier.user_id, dossier_id: dossier.id, piece_id: null, delayMs: until.getTime() - config.now().getTime() });
    return 'done';
  };
  if (last && last.input_fingerprint === fingerprint) {
    // Dernière synthèse rendue par les règles faute de budget, budget de nouveau disponible : recalcul par l'IA.
    const resume = Boolean(last.budget_fallback) && useAi && !(await over());
    if (!resume) {
      // Rien de nouveau (doublon, relance) : aucun appel au modèle ; republication si la précédente a été interrompue.
      await renderAndPublish(deps, dossier, last);
      return last.budget_fallback && useAi ? parkForResume() : 'done';
    }
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
  let provider: ModelProvider = useAi ? deps.ai! : rulesProvider;
  let budgetFallback: BudgetScope | null = null;
  if (provider !== rulesProvider) {
    budgetFallback = await over();
    if (budgetFallback) {
      await store.alert('BUDGET', { scope: budgetFallback, dossier: dossier.id });
      provider = rulesProvider; // le client reçoit un résultat déterministe, annoncé partiel, plutôt qu'aucun
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
  const coverage = coverageOf(pieces, ex, budgetFallback);
  // Résultat partiel pour cause de budget : le motif figure en tête des points d'attention de tous les rendus.
  if (coverage.partial_reason) guarded.attention_points = [`Résultat partiel : ${coverage.partial_reason}`, ...guarded.attention_points];
  const rec: AnalysisRec = {
    dossier_id: dossier.id,
    user_id: dossier.user_id,
    revision: (last?.revision ?? 0) + 1,
    input_fingerprint: fingerprint,
    lots,
    pieces: Object.fromEntries(main.map((x) => [x.id, ex.get(x.id)!.status === 'error' && ex.get(x.id)!.deferred ? 'deferred' : ex.get(x.id)!.status])),
    data: { ...guarded, events },
    coverage,
    provider: provider.name,
    model: res.model,
    status: 'pending',
    ...(budgetFallback ? { budget_fallback: budgetFallback } : {}),
    input_tokens: res.input_tokens,
    output_tokens: res.output_tokens,
    cost_cents: cost,
    created_at: iso(config.now()),
  };
  if (!(await store.insertAnalysis(rec))) {
    // Révision déjà présente : écrite par un exécuteur concurrent, ou par un essai interrompu avant la mise à jour du pointeur.
    const cur = await store.lastAnalysis(dossier.id);
    if (cur && cur.input_fingerprint === fingerprint) {
      await renderAndPublish(deps, dossier, cur);
      return 'done';
    }
    throw new Retry('révision déjà présente : nouveau calcul'); // compté : un blocage durable finit en alerte TRAVAIL_ECHEC
  }
  await renderAndPublish(deps, dossier, rec);
  return budgetFallback ? parkForResume() : 'done';
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
  const lastRevision = async () => (store.lastRevision ? store.lastRevision(dossier.id) : ((await store.lastAnalysis(dossier.id))?.revision ?? null));
  const latest = await lastRevision();
  if (latest !== null && latest > rec.revision) return 'skipped'; // révision obsolète
  const mode: 'approved' | 'pending' = again.dossier.review_mode === 'auto' && !again.dossier.sensitive ? 'approved' : 'pending';
  // Lectures indépendantes menées de front ; les échéances sont relues APRÈS leur synchronisation.
  const [allPieces, overrides, published, deadlineRows] = await Promise.all([
    store.listPieces(dossier.id),
    store.listOverrides(dossier.id),
    store.getPublished(dossier.id),
    (async () => {
      if (mode === 'approved') await store.syncDeadlines(dossier.id, dossier.user_id, toDeadlineRows(rec.data));
      return store.listDeadlines(dossier.id);
    })(),
  ]);
  const pieces = allPieces.filter((x) => !x.deleted_at && !x.duplicate_of).map((x) => ({ id: x.id, file_name: x.file_name, created_at: x.created_at }));
  const input: RenderInput = { dossierId: dossier.id, title: dossier.title, revision: rec.revision, generatedAt: config.now(), analysis: rec.data, coverage: rec.coverage, pieces, overrides, deadlineRows, provider: rec.provider };
  const { view, hashes } = await deps.renderer.prepare(input);
  const changed = (Object.keys(hashes) as DeliverableKey[]).filter((k) => published[k]?.data_hash !== hashes[k] || published[k]?.status !== mode);
  // Premier résultat utile : la situation, les dates et la prochaine action (jeu de données d'affichage) sont mis à
  // disposition AVANT la fabrication des documents, qui suivent. Une interruption entre les deux est rattrapée par la
  // reprise du travail (les catégories dont l'empreinte diffère sont alors publiées).
  await store.putView(dossier.id, rec.revision, view, mode);
  if (store.publishCategories) {
    // Publication groupée : documents fabriqués l'un après l'autre (calcul), écrits de front, pointeurs basculés ensemble.
    const items: { category: DeliverableKey; dataHash: string; files: OutFileLite[] }[] = [];
    for (const k of changed) items.push({ category: k, dataHash: hashes[k], files: await deps.renderer.files(k, input, view) });
    if (items.length) {
      const cur = await lastRevision();
      if (cur !== null && cur > rec.revision) return 'skipped';
      await store.publishCategories(dossier.id, dossier.user_id, rec.revision, items, mode);
    }
  } else {
    for (const k of changed) {
      const files = await deps.renderer.files(k, input, view);
      const cur = await lastRevision();
      if (cur !== null && cur > rec.revision) return 'skipped';
      await store.publishCategory(dossier.id, dossier.user_id, k, rec.revision, hashes[k], files, mode);
    }
  }
  if (mode === 'approved') {
    // Statut de la révision, ligne d'historique et réservation des notifications : écritures indépendantes (clés
    // distinctes), menées de front.
    const [, , claimed] = await Promise.all([
      rec.status !== 'published' ? store.setAnalysisStatus(dossier.id, rec.revision, 'published') : null,
      changed.length ? store.addEvent(dossier.id, dossier.user_id, 'resultats_disponibles', `Résultats mis à jour (révision ${rec.revision}) : ${changed.length} document${changed.length > 1 ? 's' : ''} actualisé${changed.length > 1 ? 's' : ''}${rec.coverage.complete ? '' : ' — analyse partielle'}${rec.coverage.partial_reason ? ` (${rec.coverage.partial_reason})` : ''}.`) : null,
      (async () => {
        // Réservation possible seulement une fois le lot complet (voir EngineStore.claimNotification) : elle peut donc
        // survenir sur une republication sans changement (dernier fichier du lot identique à un précédent).
        const lots: string[] = [];
        // Complétude jugée sur le contenu de CETTE révision : une pièce lue pendant son calcul notifiera avec la suivante.
        for (const lot of rec.lots) if (await store.claimNotification(dossier.id, lot, rec.pieces)) lots.push(lot);
        return lots;
      })(),
    ]);
    if (claimed.length && (await store.notificationsAllowed(dossier.user_id))) {
      await store.notify(dossier.user_id, {
        subject: 'Vos résultats ClairDossier sont disponibles',
        text: `Bonjour,\n\nDe nouveaux résultats sont disponibles dans l'un de vos dossiers (situation, dates, prochaine action).${rec.coverage.complete ? '' : rec.coverage.partial_reason && !rec.coverage.failed && !rec.coverage.unsupported && !rec.coverage.deferred ? `\nRésultat partiel : ${rec.coverage.partial_reason}` : "\nCertaines pièces n'ont pas pu être exploitées : le détail figure dans votre espace."}\n\nCes documents sont générés automatiquement et doivent être vérifiés ; ils ne constituent pas un conseil juridique.`,
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

/**
 * Lecture en échec après tous les essais : la pièce est comptée « illisible » (et non plus « en attente »),
 * ce qui arrête la réconciliation de la consolidation et laisse publier les autres pièces.
 */
async function recordUnreadable(deps: EngineDeps, pieceId: string) {
  const { store, config } = deps;
  const piece = await store.getPiece(pieceId);
  if (!piece || piece.deleted_at) return;
  const cur = await store.getExtraction(piece.id);
  // Déjà lue, non prise en charge ou reportée : rien à enregistrer. Déjà en échec définitif : c'était une relecture.
  if (cur && !(cur.status === 'error' && !cur.deferred)) return;
  const rereads = cur ? (cur.rereads ?? 0) + 1 : 0;
  await store.putExtraction({ piece_id: piece.id, dossier_id: piece.dossier_id, user_id: piece.user_id, sha256: piece.sha256, created_at: iso(config.now()), status: 'error', reason: cur?.reason ?? 'Lecture impossible de cette pièce après plusieurs essais : merci de la redéposer.', deferred: false, rereads, data: null, vision: false, provider: cur?.provider ?? 'aucun', model: null, reused_from: null, input_tokens: 0, output_tokens: 0, cost_cents: 0 });
  // Copie déjà déposée pendant les essais (rattachée à cette pièce comme doublon) : la plus ancienne devient l'original
  // et est lue ; la pièce en échec lui est rattachée. Le client n'a pas à redéposer une troisième fois.
  const copies = (await store.listPieces(piece.dossier_id)).filter((c) => !c.deleted_at && c.duplicate_of === piece.id).sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  if (copies.length) {
    const [copy, ...others] = copies;
    await store.markDuplicate(copy.id, null);
    await store.markDuplicate(piece.id, copy.id);
    for (const o of others) await store.markDuplicate(o.id, copy.id);
    await store.enqueue({ key: `x:${copy.id}`, kind: 'extract', user_id: copy.user_id, dossier_id: copy.dossier_id, piece_id: copy.id });
  } else {
    // Aucune copie pour la remplacer : relecture automatique, sans nouveau dépôt, après une attente croissante et un
    // nombre d'essais plafonné. Le travail en échec reste signalé tant que la pièce n'est pas lue.
    const wait = piece.duplicate_of ? undefined : rereadDelays(config)[rereads];
    if (wait !== undefined) await store.enqueue({ key: rereadKey(piece.id), kind: 'extract', user_id: piece.user_id, dossier_id: piece.dossier_id, piece_id: piece.id, delayMs: wait, keepFailed: true });
  }
  await store.enqueue({ key: `c:${piece.dossier_id}`, kind: 'consolidate', user_id: piece.user_id, dossier_id: piece.dossier_id, piece_id: null, delayMs: config.consolidateDelayMs });
}

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
      if (job.kind === 'extract' && job.piece_id) await recordUnreadable(deps, job.piece_id);
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
