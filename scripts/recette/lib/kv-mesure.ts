// Magasin de MESURE : enveloppe un stockage clé-valeur, compte chaque accès par nature et peut lui ajouter une
// latence simulée (reproduction locale d'un stockage distant, p. ex. Vercel Blob). Aucun réseau, aucune persistance.
// Utilisé par scripts/recette/latence.ts, scripts/recette/capacite.ts et les tests de performance.
import { MemoryKv, type Kv, type PutResult } from '../../../recette/server/kv.ts';

export type Nature = 'lecture' | 'autorite' | 'ecriture' | 'octetsLus' | 'octetsEcrits' | 'liste' | 'suppression';
const ZERO: Record<Nature, number> = { lecture: 0, autorite: 0, ecriture: 0, octetsLus: 0, octetsEcrits: 0, liste: 0, suppression: 0 };

export interface Latence {
  /** Bornes de la latence ajoutée à CHAQUE accès, en millisecondes (tirage uniforme, graine fixe). */
  minMs: number;
  maxMs: number;
  /** Latence propre aux écritures et aux listes (souvent bien plus lentes que les lectures) ; absente : la même. */
  ecriture?: { minMs: number; maxMs: number };
}

/** Générateur pseudo-aléatoire à graine fixe (mesures reproductibles). */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MesureKv implements Kv {
  readonly durable = false;
  n: Record<Nature, number> = { ...ZERO };
  /** Accès en vol au même instant (maximum observé) : mesure du parallélisme réel. */
  enVol = 0;
  maxEnVol = 0;
  /** Observateur facultatif : nature et clé de chaque accès (jamais le contenu). */
  onAcces: ((nature: Nature, cle: string) => void) | null = null;
  private rnd = mulberry32(20261125);
  constructor(
    readonly inner: Kv = new MemoryKv(),
    public latence: Latence | null = null,
  ) {}
  get total() {
    return Object.values(this.n).reduce((a, b) => a + b, 0) - this.n.autorite;
  }
  /** Opérations Blob « simples » (lectures) et « avancées » (écritures, listes, suppressions, en-têtes). */
  get operations() {
    return { simples: this.n.lecture - this.n.autorite + this.n.octetsLus, avancees: this.n.ecriture + this.n.octetsEcrits + this.n.liste + this.n.suppression + this.n.autorite };
  }
  raz() {
    this.n = { ...ZERO };
    this.maxEnVol = 0;
  }
  instantane() {
    return { ...this.n, total: this.total };
  }
  private async acces<T>(nature: Nature, cle: string, fn: () => Promise<T>): Promise<T> {
    this.n[nature]++;
    this.onAcces?.(nature, cle);
    if (!this.latence) return fn();
    this.maxEnVol = Math.max(this.maxEnVol, ++this.enVol);
    try {
      const l = (nature === 'ecriture' || nature === 'octetsEcrits' || nature === 'liste' || nature === 'suppression' ? this.latence.ecriture : undefined) ?? this.latence;
      await new Promise((r) => setTimeout(r, l.minMs + this.rnd() * (l.maxMs - l.minMs)));
      return await fn();
    } finally {
      this.enVol--;
    }
  }
  getJson<T>(key: string, opts?: { fresh?: boolean }) {
    if (opts?.fresh) this.n.autorite++;
    return this.acces('lecture', key, () => this.inner.getJson<T>(key, opts));
  }
  putJson(key: string, value: unknown, opts?: { ifMatch?: string; create?: boolean }): Promise<PutResult> {
    return this.acces('ecriture', key, () => this.inner.putJson(key, value, opts));
  }
  getBytes(key: string) {
    return this.acces('octetsLus', key, () => this.inner.getBytes(key));
  }
  putBytes(key: string, bytes: Uint8Array, contentType: string) {
    return this.acces('octetsEcrits', key, () => this.inner.putBytes(key, bytes, contentType));
  }
  delete(key: string) {
    return this.acces('suppression', key, () => this.inner.delete(key));
  }
  list(prefix: string) {
    return this.acces('liste', prefix, () => this.inner.list(prefix));
  }
}
