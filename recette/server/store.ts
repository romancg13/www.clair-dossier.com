// Mise en œuvre des ports du moteur (EngineStore) sur un stockage clé-valeur
// conditionnel, plus les données d'application de la recette (comptes,
// abonnements simulés, dossiers). Une seule source pour l'API, l'exécuteur et le MCP.
import type { DeadlineRow, DeliverableKey, EventOverride } from '../../supabase/functions/_shared/analysis-model.ts';
import type { AnalysisRec, Costs, DossierState, EngineStore, ExtractionRec, Job, OutFileLite, PieceRec, PublishedCategory } from '../../supabase/functions/_shared/engine/ports.ts';
import { update, type Kv, type KvEntry } from './kv.ts';

/**
 * File de travaux : un seul document (queue.json), mis à jour atomiquement.
 *  - open : travaux à exécuter (en attente ou en cours), seuls parcourus par claim() ;
 *  - failed : travaux en échec définitif, conservés pour l'état « incident » et l'écran d'exceptions ;
 *  - dossiers : dossier de chaque travail listé, pour lire la file d'UN dossier sans charger les travaux
 *    des autres clients (une entrée antérieure sans dossier connu est lue, par compatibilité).
 */
interface QueueDoc {
  open: string[];
  failed?: string[];
  dossiers?: Record<string, string>;
}
/** Travaux en échec conservés (les plus anciens sortent de la liste). */
const MAX_FAILED = 200;
/** Lectures de travaux menées en parallèle par paquet. */
const READ_BATCH = 16;

export type SubStatus = 'none' | 'incomplete' | 'active' | 'past_due' | 'canceled' | 'expired';
export interface Subscription {
  status: SubStatus;
  plan_id: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  /** Identifiants d'événements déjà appliqués (idempotence). */
  seen: string[];
  /** Horodatage du dernier événement appliqué (événements hors ordre ignorés). */
  last_event_at: string | null;
  history: { at: string; event: string; status: SubStatus }[];
}

export interface UserRec {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string | null;
  role: 'client' | 'admin';
  pwd: { salt: string; hash: string };
  notifications: boolean;
  created_at: string;
  fixture?: string;
}

export interface DossierRec {
  id: string;
  user_id: string;
  title: string;
  typology: string | null;
  objective: string | null;
  review_mode: 'auto' | 'manual';
  sensitive: boolean;
  closed: boolean;
  deleted: boolean;
  created_at: string;
}

export interface EventItem {
  id: string;
  type: string;
  label: string;
  created_at: string;
}

const enc = (k: string) => encodeURIComponent(k).replace(/%/g, '~');
const month = (d: Date) => d.toISOString().slice(0, 7);

export class RecetteStore implements EngineStore {
  constructor(
    readonly kv: Kv,
    readonly now: () => Date = () => new Date(),
    readonly id: () => string = () => crypto.randomUUID(),
  ) {}

  /* ── Comptes et abonnements (application) ─────────────────────────────── */
  async getUser(id: string) {
    return (await this.kv.getJson<UserRec>(`users/${id}.json`))?.value ?? null;
  }
  async putUser(u: UserRec) {
    await this.kv.putJson(`users/${u.id}.json`, u);
  }
  async userIdByEmailHash(h: string) {
    return (await this.kv.getJson<{ user_id: string }>(`emails/${h}.json`))?.value.user_id ?? null;
  }
  async claimEmail(h: string, userId: string) {
    return (await this.kv.putJson(`emails/${h}.json`, { user_id: userId }, { create: true })).ok;
  }
  async getSub(userId: string): Promise<Subscription> {
    return (await this.kv.getJson<Subscription>(`subs/${userId}.json`))?.value ?? { status: 'none', plan_id: null, current_period_end: null, cancel_at_period_end: false, seen: [], last_event_at: null, history: [] };
  }
  async updateSub(userId: string, fn: (s: Subscription) => Subscription | null) {
    return update<Subscription>(this.kv, `subs/${userId}.json`, (cur) => fn(cur ?? { status: 'none', plan_id: null, current_period_end: null, cancel_at_period_end: false, seen: [], last_event_at: null, history: [] }));
  }
  /** Droit d'usage : actif, essai, impayé en cours de relance, ou résilié non échu (droits historiques). */
  static active(s: Subscription, now: Date): boolean {
    if (s.status === 'active' || s.status === 'past_due') return !s.current_period_end || new Date(s.current_period_end) > now || s.status === 'past_due';
    if (s.status === 'canceled') return Boolean(s.current_period_end && new Date(s.current_period_end) > now);
    return false;
  }
  async entitlementActive(userId: string) {
    return RecetteStore.active(await this.getSub(userId), this.now());
  }

  async listUserDossiers(userId: string): Promise<DossierRec[]> {
    const idx = (await this.kv.getJson<{ ids: string[] }>(`index/${userId}.json`))?.value.ids ?? [];
    const out: DossierRec[] = [];
    for (const id of idx) {
      const d = await this.getDossierRec(id);
      if (d && !d.deleted && d.user_id === userId) out.push(d);
    }
    return out.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }
  async getDossierRec(id: string) {
    return (await this.kv.getJson<DossierRec>(`dossiers/${id}.json`))?.value ?? null;
  }
  async createDossier(d: DossierRec) {
    await this.kv.putJson(`dossiers/${d.id}.json`, d, { create: true });
    await update<{ ids: string[] }>(this.kv, `index/${d.user_id}.json`, (cur) => ({ ids: [...new Set([...(cur?.ids ?? []), d.id])] }));
  }
  async updateDossier(id: string, fn: (d: DossierRec) => DossierRec | null) {
    return update<DossierRec>(this.kv, `dossiers/${id}.json`, (cur) => (cur ? fn(cur) : null));
  }

  /* ── Ports du moteur ──────────────────────────────────────────────────── */
  async getDossier(id: string): Promise<DossierState | null> {
    const d = await this.getDossierRec(id);
    return d ? { id: d.id, user_id: d.user_id, title: d.title, typology: d.typology, objective: d.objective, deleted: d.deleted, closed: d.closed, review_mode: d.review_mode, sensitive: d.sensitive } : null;
  }
  async listPieces(dossierId: string) {
    const keys = await this.kv.list(`pieces/${dossierId}/`);
    const out: PieceRec[] = [];
    for (const k of keys) {
      const p = await this.kv.getJson<PieceRec>(k);
      if (p) out.push(p.value);
    }
    return out.sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id));
  }
  async getPiece(id: string) {
    const ref = await this.kv.getJson<{ dossier_id: string }>(`pieceref/${id}.json`);
    return ref ? ((await this.kv.getJson<PieceRec>(`pieces/${ref.value.dossier_id}/${id}.json`))?.value ?? null) : null;
  }
  async addPiece(p: PieceRec, bytes: Uint8Array) {
    // Écritures indépendantes (clés distinctes) : en parallèle.
    await Promise.all([
      this.kv.putBytes(`files/${p.user_id}/${p.dossier_id}/${p.id}`, bytes, p.mime ?? 'application/octet-stream'),
      this.kv.putJson(`pieceref/${p.id}.json`, { dossier_id: p.dossier_id }, { create: true }),
      this.kv.putJson(`pieces/${p.dossier_id}/${p.id}.json`, p, { create: true }),
    ]);
  }
  async readPieceBytes(p: PieceRec) {
    const b = await this.kv.getBytes(`files/${p.user_id}/${p.dossier_id}/${p.id}`);
    if (!b) throw new Error('fichier de la pièce introuvable');
    return b;
  }
  async markDuplicate(pieceId: string, ofId: string) {
    const ref = await this.kv.getJson<{ dossier_id: string }>(`pieceref/${pieceId}.json`);
    if (ref) await update<PieceRec>(this.kv, `pieces/${ref.value.dossier_id}/${pieceId}.json`, (p) => (p && p.duplicate_of !== ofId ? { ...p, duplicate_of: ofId } : null));
  }
  async getExtraction(pieceId: string) {
    return (await this.kv.getJson<ExtractionRec>(`extractions/${pieceId}.json`))?.value ?? null;
  }
  async putExtraction(rec: ExtractionRec) {
    await this.kv.putJson(`extractions/${rec.piece_id}.json`, rec);
    if (rec.status === 'ok' && !rec.reused_from) await this.kv.putJson(`xsha/${rec.user_id}/${rec.sha256}.json`, { piece_id: rec.piece_id });
  }
  async findReusableExtraction(userId: string, sha: string) {
    const r = await this.kv.getJson<{ piece_id: string }>(`xsha/${userId}/${sha}.json`);
    if (!r) return null;
    const x = await this.getExtraction(r.value.piece_id);
    return x && x.user_id === userId && x.sha256 === sha ? x : null;
  }
  async lastAnalysis(dossierId: string) {
    const last = await this.kv.getJson<{ revision: number }>(`analyses/${dossierId}/last.json`);
    return last ? ((await this.kv.getJson<AnalysisRec>(`analyses/${dossierId}/r${String(last.value.revision).padStart(5, '0')}.json`))?.value ?? null) : null;
  }
  async insertAnalysis(rec: AnalysisRec) {
    const ok = (await this.kv.putJson(`analyses/${rec.dossier_id}/r${String(rec.revision).padStart(5, '0')}.json`, rec, { create: true })).ok;
    if (ok) await update<{ revision: number }>(this.kv, `analyses/${rec.dossier_id}/last.json`, (cur) => (cur && cur.revision >= rec.revision ? null : { revision: rec.revision }));
    return ok;
  }
  async setAnalysisStatus(dossierId: string, revision: number, status: AnalysisRec['status']) {
    await update<AnalysisRec>(this.kv, `analyses/${dossierId}/r${String(revision).padStart(5, '0')}.json`, (cur) => (cur ? { ...cur, status } : null));
  }
  async listOverrides(dossierId: string) {
    return (await this.kv.getJson<{ items: EventOverride[] }>(`overrides/${dossierId}.json`))?.value.items ?? [];
  }
  async addOverride(dossierId: string, o: EventOverride) {
    await update<{ items: EventOverride[] }>(this.kv, `overrides/${dossierId}.json`, (cur) => ({ items: [...(cur?.items ?? []), o] }));
  }
  async listDeadlines(dossierId: string) {
    return (await this.kv.getJson<{ rows: DeadlineRow[] }>(`deadlines/${dossierId}.json`))?.value.rows ?? [];
  }
  async syncDeadlines(dossierId: string, _userId: string, rows: DeadlineRow[]) {
    await update<{ rows: DeadlineRow[] }>(this.kv, `deadlines/${dossierId}.json`, (cur) => {
      const existing = cur?.rows ?? [];
      const frozen = new Set(existing.filter((r) => r.user_edited || !r.ai_key).map((r) => r.ai_key ?? `m:${r.title}:${r.due_date}`));
      const kept = existing.filter((r) => r.user_edited || !r.ai_key);
      return { rows: [...kept, ...rows.filter((r) => !frozen.has(r.ai_key!))] };
    });
  }
  async updateDeadlines(dossierId: string, fn: (rows: DeadlineRow[]) => DeadlineRow[]) {
    await update<{ rows: DeadlineRow[] }>(this.kv, `deadlines/${dossierId}.json`, (cur) => ({ rows: fn(cur?.rows ?? []) }));
  }
  async getPublished(dossierId: string) {
    return (await this.kv.getJson<{ c: Partial<Record<DeliverableKey, PublishedCategory>> }>(`published/${dossierId}.json`))?.value.c ?? {};
  }
  async publishCategory(dossierId: string, _userId: string, category: DeliverableKey, revision: number, dataHash: string, files: OutFileLite[], status: 'approved' | 'pending') {
    const dir = `out/${dossierId}/${category}/r${revision}-${dataHash.slice(0, 10)}`;
    const written: PublishedCategory["files"] = [];
    for (const f of files) {
      const path = `${dir}/${f.name}`;
      await this.kv.putBytes(path, f.bytes, f.mime);
      written.push({ name: f.name, mime: f.mime, size_bytes: f.bytes.byteLength, path });
    }
    // Bascule atomique du pointeur de la catégorie ; la version précédente est conservée.
    await update<{ c: Partial<Record<DeliverableKey, PublishedCategory>> }>(this.kv, `published/${dossierId}.json`, (cur) => {
      const c = { ...(cur?.c ?? {}) };
      const prev = c[category];
      if (prev && prev.revision > revision) return null;
      c[category] = {
        category, revision, data_hash: dataHash, status, files: written, published_at: this.now().toISOString(),
        previous: prev ? [{ revision: prev.revision, data_hash: prev.data_hash, files: prev.files.map((f) => ({ name: f.name, path: f.path })), published_at: prev.published_at }, ...prev.previous].slice(0, 10) : [],
      };
      return { c };
    });
  }
  async putView(dossierId: string, revision: number, view: unknown, status: 'approved' | 'pending') {
    await update<{ revision: number; status: string; view: unknown }>(this.kv, `views/${dossierId}.json`, (cur) => (cur && cur.revision > revision ? null : { revision, status, view }));
  }
  async getView(dossierId: string) {
    return (await this.kv.getJson<{ revision: number; status: 'approved' | 'pending'; view: unknown }>(`views/${dossierId}.json`))?.value ?? null;
  }

  /* ── File de travaux ──────────────────────────────────────────────────── */
  async enqueue(j: Pick<Job, 'key' | 'kind' | 'user_id' | 'dossier_id' | 'piece_id'> & { delayMs?: number }) {
    const now = this.now();
    const runAfter = new Date(now.getTime() + (j.delayMs ?? 0)).toISOString();
    const keyDoc = `jobkeys/${enc(j.key)}.json`;
    for (let i = 0; i < 6; i++) {
      // Après un conflit : lecture d'autorité de la clé.
      const ref = await this.kv.getJson<{ job_id: string }>(keyDoc, { fresh: i > 0 });
      let replaced: Job | null = null;
      if (ref) {
        // Lecture rapide d'abord ; lecture d'autorité seulement après un conflit ou si le travail paraît absent :
        // un travail tout juste créé ne doit jamais passer pour absent (clé « libre »). Un statut lu périmé est sans
        // risque : les branches « queued » et « running » écrivent sous condition d'ETag, et les statuts terminaux sont définitifs.
        const jobDoc = `jobs/${ref.value.job_id}.json`;
        const cur = (i === 0 ? await this.kv.getJson<Job>(jobDoc) : null) ?? (await this.kv.getJson<Job>(jobDoc, { fresh: true }));
        if (cur && cur.value.status === 'queued') {
          const r = await this.kv.putJson(`jobs/${cur.value.id}.json`, { ...cur.value, run_after: runAfter > cur.value.run_after ? runAfter : cur.value.run_after, updated_at: now.toISOString() }, { ifMatch: cur.etag });
          if (!r.ok) continue;
          // Auto-réparation : un travail dont l'inscription dans la file a échoué (panne, arrêt) y est réinscrit.
          await this.relist(cur.value.id);
          return 'rearmed' as const;
        }
        if (cur && cur.value.status === 'running') {
          const r = await this.kv.putJson(`jobs/${cur.value.id}.json`, { ...cur.value, rerun: true, updated_at: now.toISOString() }, { ifMatch: cur.etag });
          if (r.ok) return 'rearmed' as const;
          continue;
        }
        replaced = cur?.value ?? null;
      }
      const job: Job = { id: this.id(), key: j.key, kind: j.kind, user_id: j.user_id, dossier_id: j.dossier_id, piece_id: j.piece_id, status: 'queued', attempts: 0, max_attempts: 4, run_after: runAfter, lease_until: null, locked_by: null, rerun: false, last_error: null, created_at: now.toISOString(), updated_at: now.toISOString() };
      // Le travail existe AVANT que la clé ne le désigne ; la clé ne bascule que si elle n'a pas changé
      // depuis la lecture qui l'a constatée libre (ETag de CETTE lecture, jamais relu au moment d'écrire).
      if (!(await this.kv.putJson(`jobs/${job.id}.json`, job, { create: true })).ok) continue;
      const claim = await this.kv.putJson(keyDoc, { job_id: job.id }, ref ? { ifMatch: ref.etag } : { create: true });
      if (!claim.ok) {
        await this.kv.delete(`jobs/${job.id}.json`);
        continue;
      }
      await this.enlist(job, replaced?.status === 'failed' ? replaced.id : null);
      return 'created' as const;
    }
    throw new Error('mise en file impossible (conflits)');
  }
  /** Inscrit un travail dans la file (aucune écriture s'il y figure déjà) ; retire l'échec qu'il remplace. */
  private async enlist(job: Job, replaces: string | null = null) {
    await update<QueueDoc>(this.kv, 'queue.json', (q) => {
      const open = q?.open ?? [];
      const failed = q?.failed ?? [];
      const drop = replaces !== null && failed.includes(replaces);
      if (open.includes(job.id) && q?.dossiers?.[job.id] === job.dossier_id && !drop) return null;
      const dossiers = { ...(q?.dossiers ?? {}), [job.id]: job.dossier_id };
      if (drop) delete dossiers[replaces];
      return { open: open.includes(job.id) ? open : [...open, job.id], failed: drop ? failed.filter((x) => x !== replaces) : failed, dossiers };
    });
  }
  /** Réinscription d'un travail réarmé absent de la file, s'il est toujours en attente (pas un travail terminé entre-temps). */
  private async relist(jobId: string) {
    if ((await this.queue()).open.includes(jobId)) return;
    const cur = (await this.kv.getJson<Job>(`jobs/${jobId}.json`, { fresh: true }))?.value;
    if (cur && cur.status === 'queued') await this.enlist(cur);
  }
  private async queue() {
    const q = (await this.kv.getJson<QueueDoc>('queue.json'))?.value;
    return { open: q?.open ?? [], failed: q?.failed ?? [], dossiers: q?.dossiers ?? {} };
  }
  /** Lecture des travaux par paquets parallèles bornés (ordre conservé ; travaux introuvables ignorés). */
  private async readJobs(ids: string[]) {
    const out: KvEntry<Job>[] = [];
    for (let i = 0; i < ids.length; i += READ_BATCH) {
      for (const e of await Promise.all(ids.slice(i, i + READ_BATCH).map((id) => this.kv.getJson<Job>(`jobs/${id}.json`)))) if (e) out.push(e);
    }
    return out;
  }
  async claim(workerId: string, leaseMs: number) {
    const entries = await this.readJobs((await this.queue()).open);
    // Auto-nettoyage : un travail terminé encore listé (réinscription concurrente de sa fin) sort de la file ;
    // un échec rejoint la liste des échecs. Ces statuts sont définitifs : aucun risque de retirer un travail à exécuter.
    const finis = entries.map((e) => e.value).filter((j) => j.status === 'done' || j.status === 'cancelled' || j.status === 'failed');
    if (finis.length) await this.unlist(finis);
    // Horodatage APRÈS le parcours : le bail écrit n'est pas déjà entamé par la durée de la lecture.
    const now = this.now();
    const candidates: { j: Job; etag: string }[] = [];
    for (const e of entries) {
      const j = e.value;
      const runnable = (j.status === 'queued' && j.run_after <= now.toISOString()) || (j.status === 'running' && j.lease_until !== null && j.lease_until < now.toISOString());
      if (runnable) candidates.push({ j, etag: e.etag });
    }
    // Ordre : extractions d'abord, puis le plus ancien.
    candidates.sort((a, b) => Number(a.j.kind !== 'extract') - Number(b.j.kind !== 'extract') || a.j.run_after.localeCompare(b.j.run_after));
    for (const { j, etag } of candidates) {
      const next: Job = { ...j, status: 'running', attempts: j.attempts + 1, lease_until: new Date(now.getTime() + leaseMs).toISOString(), locked_by: workerId, updated_at: now.toISOString() };
      if ((await this.kv.putJson(`jobs/${j.id}.json`, next, { ifMatch: etag })).ok) return next;
    }
    return null;
  }
  async complete(job: Job, outcome: Parameters<EngineStore['complete']>[1]) {
    const now = this.now();
    let terminal = false;
    await update<Job>(this.kv, `jobs/${job.id}.json`, (cur) => {
      // Recalculé à chaque essai : un essai précédent refusé (rerun posé entre-temps) ne doit pas compter.
      terminal = false;
      if (!cur || cur.locked_by !== job.locked_by || cur.status !== 'running') return null; // bail perdu : un autre exécuteur a repris
      if (outcome.status === 'queued') return { ...cur, status: 'queued', attempts: outcome.countAttempt ? cur.attempts : Math.max(0, cur.attempts - 1), run_after: new Date(now.getTime() + outcome.delayMs).toISOString(), lease_until: null, locked_by: null, last_error: outcome.error ?? null, updated_at: now.toISOString() };
      if (outcome.status === 'done' && cur.rerun) return { ...cur, status: 'queued', rerun: false, attempts: 0, run_after: new Date(now.getTime() + 5_000).toISOString(), lease_until: null, locked_by: null, updated_at: now.toISOString() };
      terminal = true;
      return { ...cur, status: outcome.status, lease_until: null, last_error: outcome.error ?? null, updated_at: now.toISOString() };
    });
    // Fin du travail : retiré des travaux à exécuter ; un échec reste listé (état « incident », écran d'exceptions).
    if (terminal) {
      // Extraction menée à son terme : les échecs antérieurs de la même pièce (autre clé, p. ex. réconciliation) sont obsolètes.
      const obsoletes = outcome.status === 'done' && job.kind === 'extract' && job.piece_id ? await this.failedOfPiece(job.dossier_id, job.piece_id, job.id) : [];
      await this.unlist([{ ...job, status: outcome.status }, ...obsoletes.map((id) => ({ id, dossier_id: job.dossier_id, status: 'done' as const }))]);
    }
  }
  /** Retire de la file des travaux terminés ; ceux en échec rejoignent la liste des échecs (bornée). */
  private async unlist(jobs: Pick<Job, 'id' | 'dossier_id' | 'status'>[]) {
    await update<QueueDoc>(this.kv, 'queue.json', (q) => {
      const ids = new Set(jobs.map((j) => j.id));
      const dossiers = { ...(q?.dossiers ?? {}) };
      let failed = (q?.failed ?? []).filter((x) => !ids.has(x));
      for (const j of jobs) {
        if (j.status === 'failed') {
          failed.push(j.id);
          dossiers[j.id] = j.dossier_id;
        } else delete dossiers[j.id];
      }
      for (const x of failed.slice(0, Math.max(0, failed.length - MAX_FAILED))) delete dossiers[x];
      failed = failed.slice(-MAX_FAILED);
      return { open: (q?.open ?? []).filter((x) => !ids.has(x)), failed, dossiers };
    });
  }
  /** Échecs d'extraction d'une pièce (lus parmi les seuls échecs de son dossier). */
  private async failedOfPiece(dossierId: string, pieceId: string, except: string) {
    const q = await this.queue();
    const ids = q.failed.filter((id) => id !== except && (q.dossiers[id] ?? dossierId) === dossierId);
    return (await this.readJobs(ids)).map((e) => e.value).filter((j) => j.status === 'failed' && j.kind === 'extract' && j.piece_id === pieceId).map((j) => j.id);
  }
  /** Travaux d'un dossier : en attente, en cours et en échec. Seuls ceux de CE dossier sont lus. */
  async openJobs(dossierId: string) {
    const q = await this.queue();
    const ids = [...new Set([...q.open, ...q.failed])].filter((id) => (q.dossiers[id] ?? dossierId) === dossierId);
    return (await this.readJobs(ids)).map((e) => e.value).filter((j) => j.dossier_id === dossierId);
  }
  /** Tous les travaux en attente ou en cours (exécuteur). */
  async allOpenJobs() {
    return (await this.readJobs((await this.queue()).open)).map((e) => e.value).filter((j) => j.status === 'queued' || j.status === 'running');
  }
  /** Travaux en échec conservés (écran d'exceptions de l'administration). */
  async failedJobs() {
    return (await this.readJobs((await this.queue()).failed)).map((e) => e.value).filter((j) => j.status === 'failed');
  }

  /* ── Coûts, journal, notifications, alertes ───────────────────────────── */
  async costs(userId: string, lotIds: string[]): Promise<Costs> {
    const m = month(this.now());
    const get = async (k: string) => (await this.kv.getJson<{ cents: number }>(k))?.value.cents ?? 0;
    let lot = 0;
    for (const l of lotIds) lot += await get(`costs/lot/${l}.json`);
    return { userMonth: await get(`costs/${m}/${userId}.json`), globalMonth: await get(`costs/${m}/_global.json`), lot };
  }
  async addCost(userId: string, lotId: string | null, cents: number) {
    const m = month(this.now());
    const inc = (k: string) => update<{ cents: number }>(this.kv, k, (cur) => ({ cents: Math.round(((cur?.cents ?? 0) + cents) * 100) / 100 }));
    await inc(`costs/${m}/${userId}.json`);
    await inc(`costs/${m}/_global.json`);
    if (lotId) await inc(`costs/lot/${lotId}.json`);
  }
  async addEvent(dossierId: string, _userId: string, type: string, label: string) {
    await update<{ items: EventItem[] }>(this.kv, `events/${dossierId}.json`, (cur) => ({ items: [{ id: this.id(), type, label, created_at: this.now().toISOString() }, ...(cur?.items ?? [])].slice(0, 300) }));
  }
  async listEvents(dossierId: string) {
    return (await this.kv.getJson<{ items: EventItem[] }>(`events/${dossierId}.json`))?.value.items ?? [];
  }
  async claimNotification(dossierId: string, lotId: string) {
    return (await this.kv.putJson(`notif/${dossierId}/${lotId}.json`, { at: this.now().toISOString() }, { create: true })).ok;
  }
  async notificationsAllowed(userId: string) {
    return (await this.getUser(userId))?.notifications ?? false;
  }
  /** Boîte de recette : aucune transmission externe ; le message est consultable dans l'espace de recette. */
  async notify(userId: string, message: { subject: string; text: string; link: string }) {
    await update<{ items: (typeof message & { id: string; at: string })[] }>(this.kv, `mail/${userId}.json`, (cur) => ({ items: [{ ...message, id: this.id(), at: this.now().toISOString() }, ...(cur?.items ?? [])].slice(0, 100) }));
  }
  async mailbox(userId: string) {
    return (await this.kv.getJson<{ items: { subject: string; text: string; link: string; id: string; at: string }[] }>(`mail/${userId}.json`))?.value.items ?? [];
  }
  async alert(code: string, meta: Record<string, string | number | boolean | null>) {
    console.error(JSON.stringify({ evt: 'alerte', code, meta }));
    await update<{ items: { code: string; meta: typeof meta; at: string }[] }>(this.kv, 'alerts.json', (cur) => ({ items: [{ code, meta, at: this.now().toISOString() }, ...(cur?.items ?? [])].slice(0, 200) }));
  }
  async alerts() {
    return (await this.kv.getJson<{ items: { code: string; meta: Record<string, unknown>; at: string }[] }>('alerts.json'))?.value.items ?? [];
  }
}
