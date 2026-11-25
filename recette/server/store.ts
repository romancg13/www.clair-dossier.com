// Mise en œuvre des ports du moteur (EngineStore) sur un stockage clé-valeur
// conditionnel, plus les données d'application de la recette (comptes,
// abonnements simulés, dossiers). Une seule source pour l'API, l'exécuteur et le MCP.
import type { DeadlineRow, DeliverableKey, EventOverride } from '../../supabase/functions/_shared/analysis-model.ts';
import type { AnalysisRec, Costs, DossierState, EngineStore, ExtractionRec, Job, OutFileLite, PieceRec, PieceState, PublishedCategory } from '../../supabase/functions/_shared/engine/ports.ts';
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
  /** Compte de chaque travail à exécuter (tourniquet entre comptes) ; une entrée antérieure sans compte connu forme un groupe à part. */
  users?: Record<string, string>;
}
/** Travaux d'un même compte exécutés en même temps, tous exécuteurs confondus (borne par client). */
export const MAX_RUNNING_PER_ACCOUNT = 2;
/** Groupe des travaux listés avant l'introduction du tourniquet (compte inconnu sans lecture). */
const UNKNOWN_ACCOUNT = '?';
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

/** Délai sans nouvelle pièce au-delà duquel un lot dont l'envoi s'est interrompu est tenu pour complet. */
export const LOT_IDLE_MS = 10 * 60_000;

/**
 * Travail qui traite réellement le dossier, pour le statut affiché : en cours, ou prévu dans les 10 minutes.
 * Une lecture reportée au mois suivant (plafond) et le contrôle différé de fin de lot (n:) n'en sont pas ; ni les
 * reprises de fond : relecture automatique d'une pièce illisible (xr:), reprise d'une synthèse en repli budget (cr:).
 */
export const jobEnCours = (j: Job, now: Date) => !/^(n|xr|cr):/.test(j.key) && (j.status === 'running' || (j.status === 'queued' && Date.parse(j.run_after) <= now.getTime() + 10 * 60_000));

export class RecetteStore implements EngineStore {
  constructor(
    readonly kv: Kv,
    readonly now: () => Date = () => new Date(),
    readonly id: () => string = () => crypto.randomUUID(),
  ) {}

  /** Travaux en attente déjà lus par CET exécuteur (valeur + ETag) : relus seulement s'ils changent (écriture conditionnelle refusée). */
  private seen = new Map<string, KvEntry<Job>>();
  /** Travaux pris par cet exécuteur, avec l'ETag de la prise : la fin du travail s'écrit sous condition sans relecture. */
  private held = new Map<string, KvEntry<Job>>();
  /** Dernier compte servi (tourniquet) ; undefined = pas encore lu dans le stockage. */
  private tour: string | null | undefined;
  /** Travaux à exécuter vus dans la file à sa dernière lecture par cet exécuteur. */
  private listed = new Set<string>();

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
    // Fichier et référence d'abord (en parallèle), fiche de la pièce ensuite : une pièce n'est jamais listée sans son fichier.
    await Promise.all([
      this.kv.putBytes(`files/${p.user_id}/${p.dossier_id}/${p.id}`, bytes, p.mime ?? 'application/octet-stream'),
      this.kv.putJson(`pieceref/${p.id}.json`, { dossier_id: p.dossier_id }, { create: true }),
    ]);
    await this.kv.putJson(`pieces/${p.dossier_id}/${p.id}.json`, p, { create: true });
  }
  async readPieceBytes(p: PieceRec) {
    const b = await this.kv.getBytes(`files/${p.user_id}/${p.dossier_id}/${p.id}`);
    if (!b) throw new Error('fichier de la pièce introuvable');
    return b;
  }
  async markDuplicate(pieceId: string, ofId: string | null) {
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
  async lastRevision(dossierId: string) {
    return (await this.kv.getJson<{ revision: number }>(`analyses/${dossierId}/last.json`))?.value.revision ?? null;
  }
  async insertAnalysis(rec: AnalysisRec) {
    const key = `analyses/${rec.dossier_id}/r${String(rec.revision).padStart(5, '0')}.json`;
    const ok = (await this.kv.putJson(key, rec, { create: true })).ok;
    // Pointeur avancé aussi quand la révision existait déjà (essai précédent interrompu entre les deux écritures),
    // jamais vers une révision absente.
    if (ok || (await this.kv.getJson(key, { fresh: true }))) await update<{ revision: number }>(this.kv, `analyses/${rec.dossier_id}/last.json`, (cur) => (cur && cur.revision >= rec.revision ? null : { revision: rec.revision }));
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
  async enqueue(j: Pick<Job, 'key' | 'kind' | 'user_id' | 'dossier_id' | 'piece_id'> & { delayMs?: number; keepFailed?: boolean }) {
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
          this.seen.delete(cur.value.id);
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
      // keepFailed : l'échec remplacé reste listé (incident visible) tant que la relecture n'a pas abouti.
      await this.enlist(job, replaced?.status === 'failed' && !j.keepFailed ? replaced.id : null);
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
      if (open.includes(job.id) && q?.dossiers?.[job.id] === job.dossier_id && q?.users?.[job.id] === job.user_id && !drop) return null;
      const dossiers = { ...(q?.dossiers ?? {}), [job.id]: job.dossier_id };
      if (drop) delete dossiers[replaces];
      return { open: open.includes(job.id) ? open : [...open, job.id], failed: drop ? failed.filter((x) => x !== replaces) : failed, dossiers, users: { ...(q?.users ?? {}), [job.id]: job.user_id } };
    });
  }
  /** Réinscription d'un travail réarmé absent de la file, s'il est toujours en attente (pas un travail terminé entre-temps). */
  private async relist(jobId: string) {
    // Déjà vu dans la file par cet exécuteur : un travail en attente n'en sort jamais (seuls les statuts définitifs
    // en sont retirés), inutile de la relire.
    if (this.listed.has(jobId)) return;
    if ((await this.queue()).open.includes(jobId)) return;
    const cur = (await this.kv.getJson<Job>(`jobs/${jobId}.json`, { fresh: true }))?.value;
    if (cur && cur.status === 'queued') await this.enlist(cur);
  }
  private async queue(entry?: KvEntry<QueueDoc> | null) {
    const q = (entry === undefined ? await this.kv.getJson<QueueDoc>('queue.json') : entry)?.value;
    this.listed = new Set(q?.open ?? []);
    return { open: q?.open ?? [], failed: q?.failed ?? [], dossiers: q?.dossiers ?? {}, users: q?.users ?? {} };
  }
  /** Lecture des travaux par paquets parallèles bornés (ordre conservé ; travaux introuvables ignorés). */
  private async readJobs(ids: string[]) {
    const out: KvEntry<Job>[] = [];
    for (let i = 0; i < ids.length; i += READ_BATCH) {
      for (const e of await Promise.all(ids.slice(i, i + READ_BATCH).map((id) => this.kv.getJson<Job>(`jobs/${id}.json`)))) if (e) out.push(e);
    }
    return out;
  }
  /**
   * Prise d'un travail, à tour de rôle entre les comptes : le compte servi est le suivant (ordre cyclique des
   * identifiants) après le dernier servi, un seul travail par compte et par tour. Un compte qui a déjà
   * MAX_RUNNING_PER_ACCOUNT travaux en cours (bail valide) passe son tour. Un gros volume d'un compte ne
   * retarde donc le premier travail d'un autre que d'un tour, et ses travaux ne sont lus que lorsque vient son tour.
   */
  async claim(workerId: string, leaseMs: number) {
    const q = await this.queue();
    const listed = new Set(q.open);
    for (const id of this.seen.keys()) if (!listed.has(id)) this.seen.delete(id);
    const byAccount = new Map<string, string[]>();
    for (const id of q.open) {
      const a = q.users[id] ?? UNKNOWN_ACCOUNT;
      const ids = byAccount.get(a);
      if (ids) ids.push(id);
      else byAccount.set(a, [id]);
    }
    const accounts = [...byAccount.keys()].sort();
    if (!accounts.length) return null;
    let order = accounts;
    if (accounts.length > 1) {
      // Le dernier compte servi n'est lu (une fois par exécuteur) que si plusieurs comptes attendent.
      if (this.tour === undefined) this.tour = (await this.kv.getJson<{ user: string }>('queue-tour.json'))?.value.user ?? null;
      const last = this.tour;
      const i = last === null ? 0 : accounts.findIndex((a) => a > last);
      order = i <= 0 ? accounts : [...accounts.slice(i), ...accounts.slice(0, i)];
    }
    const finis: Job[] = [];
    let claimed: Job | null = null;
    for (const account of order) {
      claimed = await this.claimFor(byAccount.get(account)!, workerId, leaseMs, finis);
      if (!claimed) continue;
      this.tour = account;
      // Repère du tourniquet partagé entre exécuteurs (écriture simple : le perdre ne coûte qu'un tour).
      if (accounts.length > 1) await this.kv.putJson('queue-tour.json', { user: account }).catch(() => undefined);
      break;
    }
    // Auto-nettoyage : un travail terminé encore listé (réinscription concurrente de sa fin) sort de la file ;
    // un échec rejoint la liste des échecs. Ces statuts sont définitifs : aucun risque de retirer un travail à exécuter.
    if (finis.length) await this.unlist(finis);
    return claimed;
  }
  /** Prise du travail le plus prioritaire d'UN compte (extractions d'abord, puis le plus ancien), ou null. */
  private async claimFor(ids: string[], workerId: string, leaseMs: number, finis: Job[]): Promise<Job | null> {
    // Second passage seulement si un travail gardé en mémoire avait changé entre-temps (relu, puis réessayé).
    for (let pass = 0; pass < 2; pass++) {
      const entries: KvEntry<Job>[] = [];
      let stale = false;
      // Lecture par paquets, arrêtée au premier paquet qui contient un travail prêt : la file d'un compte n'est
      // parcourue en entier que si rien n'y est prêt.
      for (let i = 0; i < ids.length; i += READ_BATCH) {
        const batch = await Promise.all(ids.slice(i, i + READ_BATCH).map(async (id) => this.seen.get(id) ?? (await this.kv.getJson<Job>(`jobs/${id}.json`))));
        const at = this.now().toISOString();
        for (const e of batch) if (e) entries.push(e);
        if (batch.some((e) => e && ((e.value.status === 'queued' && e.value.run_after <= at) || (e.value.status === 'running' && e.value.lease_until !== null && e.value.lease_until < at)))) break;
      }
      // Horodatage APRÈS le parcours : le bail écrit n'est pas déjà entamé par la durée de la lecture.
      const now = this.now();
      const iso = now.toISOString();
      let running = 0;
      const candidates: KvEntry<Job>[] = [];
      for (const e of entries) {
        const j = e.value;
        if (j.status === 'done' || j.status === 'cancelled' || j.status === 'failed') {
          this.seen.delete(j.id);
          if (!finis.some((f) => f.id === j.id)) finis.push(j);
        } else if (j.status === 'queued') {
          this.seen.set(j.id, e);
          if (j.run_after <= iso) candidates.push(e);
        } else if (j.lease_until !== null && j.lease_until < iso) candidates.push(e); // bail expiré : repris
        else running++;
      }
      if (running >= MAX_RUNNING_PER_ACCOUNT) return null;
      // Ordre : extractions d'abord, puis le plus ancien.
      candidates.sort((a, b) => Number(a.value.kind !== 'extract') - Number(b.value.kind !== 'extract') || a.value.run_after.localeCompare(b.value.run_after));
      for (const { value: j, etag } of candidates) {
        const next: Job = { ...j, status: 'running', attempts: j.attempts + 1, lease_until: new Date(now.getTime() + leaseMs).toISOString(), locked_by: workerId, updated_at: iso };
        const r = await this.kv.putJson(`jobs/${j.id}.json`, next, { ifMatch: etag });
        if (r.ok) {
          this.seen.delete(j.id);
          if (r.etag) this.held.set(j.id, { value: next, etag: r.etag });
          return next;
        }
        if (this.seen.delete(j.id)) stale = true;
      }
      if (!stale) return null;
    }
    return null;
  }
  async complete(job: Job, outcome: Parameters<EngineStore['complete']>[1]) {
    const now = this.now();
    let terminal = false;
    const next = (cur: Job | null): Job | null => {
      // Recalculé à chaque essai : un essai précédent refusé (rerun posé entre-temps) ne doit pas compter.
      terminal = false;
      if (!cur || cur.locked_by !== job.locked_by || cur.status !== 'running') return null; // bail perdu : un autre exécuteur a repris
      if (outcome.status === 'queued') return { ...cur, status: 'queued', attempts: outcome.countAttempt ? cur.attempts : Math.max(0, cur.attempts - 1), run_after: new Date(now.getTime() + outcome.delayMs).toISOString(), lease_until: null, locked_by: null, last_error: outcome.error ?? null, updated_at: now.toISOString() };
      if (outcome.status === 'done' && cur.rerun) return { ...cur, status: 'queued', rerun: false, attempts: 0, run_after: new Date(now.getTime() + 5_000).toISOString(), lease_until: null, locked_by: null, updated_at: now.toISOString() };
      terminal = true;
      return { ...cur, status: outcome.status, lease_until: null, last_error: outcome.error ?? null, updated_at: now.toISOString() };
    };
    // ETag de la prise encore en main : écriture conditionnelle directe, sans relecture. Refusée (travail réarmé
    // entre-temps, bail repris) : relecture puis nouvel essai, comme pour toute écriture en conflit.
    const mine = this.held.get(job.id);
    this.held.delete(job.id);
    this.seen.delete(job.id);
    const direct = mine && mine.value.locked_by === job.locked_by ? next(structuredClone(mine.value)) : null;
    if (!direct || !(await this.kv.putJson(`jobs/${job.id}.json`, direct, { ifMatch: mine!.etag })).ok) await update<Job>(this.kv, `jobs/${job.id}.json`, next);
    // Fin du travail : retiré des travaux à exécuter ; un échec reste listé (état « incident », écran d'exceptions).
    if (terminal) {
      // Extraction menée à son terme : les échecs antérieurs de la même pièce (autre clé, p. ex. réconciliation) sont obsolètes.
      // Une seule lecture de la file pour les deux usages (échecs obsolètes, puis retrait sous condition d'ETag).
      const lookup = outcome.status === 'done' && job.kind === 'extract' && job.piece_id !== null;
      const qe = lookup ? await this.kv.getJson<QueueDoc>('queue.json') : undefined;
      const obsoletes = lookup ? await this.failedOfPiece(job.dossier_id, job.piece_id!, job.id, qe) : [];
      await this.unlist([{ ...job, status: outcome.status }, ...obsoletes.map((id) => ({ id, dossier_id: job.dossier_id, status: 'done' as const }))], qe);
      for (const id of obsoletes) this.seen.delete(id);
    }
  }
  /** Retire de la file des travaux terminés ; ceux en échec rejoignent la liste des échecs (bornée). */
  private async unlist(jobs: Pick<Job, 'id' | 'dossier_id' | 'status'>[], read?: KvEntry<QueueDoc> | null) {
    const fn = (q: QueueDoc | null): QueueDoc => {
      const ids = new Set(jobs.map((j) => j.id));
      const dossiers = { ...(q?.dossiers ?? {}) };
      const users = { ...(q?.users ?? {}) };
      let failed = (q?.failed ?? []).filter((x) => !ids.has(x));
      for (const j of jobs) {
        delete users[j.id];
        if (j.status === 'failed') {
          failed.push(j.id);
          dossiers[j.id] = j.dossier_id;
        } else delete dossiers[j.id];
      }
      for (const x of failed.slice(0, Math.max(0, failed.length - MAX_FAILED))) delete dossiers[x];
      failed = failed.slice(-MAX_FAILED);
      return { open: (q?.open ?? []).filter((x) => !ids.has(x)), failed, dossiers, users };
    };
    for (const j of jobs) this.listed.delete(j.id);
    // File déjà lue par l'appelant : écriture sous condition de l'ETag de CETTE lecture ; refusée, reprise ordinaire.
    if (read && (await this.kv.putJson('queue.json', fn(structuredClone(read.value)), { ifMatch: read.etag })).ok) return;
    await update<QueueDoc>(this.kv, 'queue.json', fn);
  }
  /** Échecs d'extraction d'une pièce (lus parmi les seuls échecs de son dossier). */
  private async failedOfPiece(dossierId: string, pieceId: string, except: string, read?: KvEntry<QueueDoc> | null) {
    const q = await this.queue(read);
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
  /** Nombre de fichiers annoncé pour un lot envoyé fichier par fichier ; le premier envoi du lot fait foi. */
  async declareLot(dossierId: string, lotId: string, total: number) {
    await this.kv.putJson(`lots/${dossierId}/${lotId}.json`, { total }, { create: true });
  }
  /**
   * Envoi du lot terminé côté navigateur avant tous les fichiers annoncés (fichier refusé, erreur) : le nombre annoncé
   * est ramené au nombre de pièces reçues. Vrai si le lot attendait encore des fichiers.
   */
  async closeLot(dossierId: string, lotId: string) {
    const received = (await this.listPieces(dossierId)).filter((p) => p.lot_id === lotId).length;
    let lowered = false;
    await update<{ total: number }>(this.kv, `lots/${dossierId}/${lotId}.json`, (cur) => ((lowered = Boolean(cur && cur.total > received)) ? { ...cur!, total: received } : null));
    return lowered;
  }
  async claimNotification(dossierId: string, lotId: string, covered?: Record<string, PieceState>) {
    const key = `notif/${dossierId}/${lotId}.json`;
    if (await this.kv.getJson(key)) return false;
    const total = (await this.kv.getJson<{ total: number }>(`lots/${dossierId}/${lotId}.json`))?.value.total ?? 0;
    const lot = (await this.listPieces(dossierId)).filter((p) => p.lot_id === lotId);
    if (!lot.length) return false;
    if (lot.length < total) {
      // Fichiers annoncés encore attendus. Envoi interrompu sans clôture (onglet fermé, réseau coupé) : le lot est tenu
      // pour complet LOT_IDLE_MS après sa dernière pièce ; un rendu est planifié à cette échéance pour le notifier.
      const due = Math.max(...lot.map((p) => Date.parse(p.created_at))) + LOT_IDLE_MS - this.now().getTime();
      if (due > 0) {
        // Pas de réarmement depuis ce contrôle lui-même : la consolidation de la nouvelle pièce le replanifiera.
        const key = `n:${dossierId}:${lotId}`;
        if (!(await this.openJobs(dossierId)).some((j) => j.key === key && j.status === 'running')) await this.enqueue({ key, kind: 'render', user_id: lot[0].user_id, dossier_id: dossierId, piece_id: null, delayMs: due });
        return false;
      }
    }
    // Chaque pièce principale du lot doit figurer dans la révision publiée (sinon, la suivante notifiera), et au moins
    // l'une doit avoir été réellement lue : un lot entièrement reporté notifiera avec la révision qui le lira.
    const states: PieceState[] = [];
    for (const p of lot) {
      if (p.deleted_at || p.duplicate_of) continue;
      const x = covered ? null : await this.getExtraction(p.id);
      const st = covered ? covered[p.id] : x && (x.status === 'error' && x.deferred ? 'deferred' : x.status);
      if (!st) return false;
      states.push(st);
    }
    if (states.length && states.every((st) => st === 'deferred')) return false;
    return (await this.kv.putJson(key, { at: this.now().toISOString() }, { create: true })).ok;
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
