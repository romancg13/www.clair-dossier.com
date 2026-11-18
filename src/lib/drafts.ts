/**
 * Brouillons du tunnel de création — ISOLÉS par identifiant.
 *
 * Règles :
 *  - « Nouveau dossier » = nouvel identifiant, état vierge : aucune valeur
 *    d'un dossier ou d'un brouillon précédent n'est jamais reprise ;
 *  - « Reprendre » restaure UNIQUEMENT le brouillon demandé ;
 *  - la validation supprime UNIQUEMENT le brouillon correspondant ;
 *  - chaque brouillon appartient au compte connecté (clé préfixée par son
 *    identifiant, positionné par AuthProvider via `setDraftOwner`) : sur un
 *    navigateur partagé, B ne voit jamais les brouillons de A ; déconnecté,
 *    rien n'est lu ni écrit ;
 *  - les brouillons antérieurs, sans propriétaire (`clairdossier_draft`,
 *    `clairdossier_draft_v2:*`), ne sont attribués à aucun compte : laissés
 *    en place, jamais affichés.
 *
 * Le stockage est injectable pour les tests ; par défaut `localStorage`,
 * silencieusement indisponible en navigation privée stricte.
 */

export type DraftStep = 1 | 2 | 3 | 4 | 5;

export type TunnelDraft = {
  id: string;
  profil?: string;
  typology?: string;
  title?: string;
  answers: Record<string, string>;
  step: DraftStep;
  updatedAt: string;
};

export type DraftSummary = Pick<TunnelDraft, 'id' | 'title' | 'typology' | 'step' | 'updatedAt'>;

export type KeyValueStore = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const INDEX_PREFIX = 'clairdossier_drafts_v3:';
const PREFIX = 'clairdossier_draft_v3:';

let owner: string | null = null;

/** Compte connecté propriétaire des brouillons ; `null` à la déconnexion. */
export function setDraftOwner(userId: string | null | undefined): void {
  owner = userId || null;
}

const indexKey = (o: string) => INDEX_PREFIX + o;
const draftKey = (o: string, id: string) => `${PREFIX}${o}:${id}`;

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** UUID v4 : l'identifiant du brouillon sert aussi de clé d'idempotence serveur. */
export function newDraftId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/** Brouillon vierge — la seule façon de démarrer un nouveau dossier. */
export function blankDraft(id: string = newDraftId()): TunnelDraft {
  return { id, answers: {}, step: 1, updatedAt: new Date().toISOString() };
}

/** Un brouillon ne mérite d'être conservé qu'une fois un choix réel effectué. */
export function isMeaningful(draft: TunnelDraft): boolean {
  return Boolean(draft.profil || draft.typology || draft.title?.trim() || Object.keys(draft.answers).length);
}

/** Retire les réponses vides : une aide ou un champ non rempli n'est jamais une valeur. */
export function cleanAnswers(answers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(answers)) {
    const t = (v ?? '').trim();
    if (t) out[k] = t;
  }
  return out;
}

function readIndex(store: KeyValueStore, o: string): DraftSummary[] {
  try {
    const raw = store.getItem(indexKey(o));
    const parsed = raw ? (JSON.parse(raw) as DraftSummary[]) : [];
    return Array.isArray(parsed) ? parsed.filter((d) => d && typeof d.id === 'string') : [];
  } catch {
    return [];
  }
}

function writeIndex(store: KeyValueStore, o: string, index: DraftSummary[]): void {
  try {
    store.setItem(indexKey(o), JSON.stringify(index));
  } catch {
    /* stockage plein ou indisponible */
  }
}

function summary(d: TunnelDraft): DraftSummary {
  return { id: d.id, title: d.title, typology: d.typology, step: d.step, updatedAt: d.updatedAt };
}

export function saveDraft(draft: TunnelDraft, store: KeyValueStore | null = defaultStore()): void {
  const o = owner;
  if (!store || !o || !isMeaningful(draft)) return;
  try {
    store.setItem(draftKey(o, draft.id), JSON.stringify(draft));
  } catch {
    return;
  }
  const index = readIndex(store, o).filter((d) => d.id !== draft.id);
  index.unshift(summary(draft));
  writeIndex(store, o, index.slice(0, 20));
}

export function loadDraft(id: string, store: KeyValueStore | null = defaultStore()): TunnelDraft | null {
  const o = owner;
  if (!store || !o || !id) return null;
  try {
    const raw = store.getItem(draftKey(o, id));
    if (!raw) return null;
    const d = JSON.parse(raw) as TunnelDraft;
    if (!d || d.id !== id) return null;
    return { ...d, answers: d.answers ?? {}, step: d.step ?? 1 };
  } catch {
    return null;
  }
}

export function removeDraft(id: string, store: KeyValueStore | null = defaultStore()): void {
  const o = owner;
  if (!store || !o) return;
  try {
    store.removeItem(draftKey(o, id));
  } catch {
    /* noop */
  }
  writeIndex(store, o, readIndex(store, o).filter((d) => d.id !== id));
}

export function listDrafts(store: KeyValueStore | null = defaultStore()): DraftSummary[] {
  const o = owner;
  return store && o ? readIndex(store, o) : [];
}
