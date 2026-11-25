// Magasin en mémoire instrumenté : compte les accès au stockage (tests et mesures, aucun réseau).
import { MemoryKv, type Kv, type PutResult } from '../../recette/server/kv.ts';

const ZERO = { lectures: 0, autorite: 0, ecritures: 0, octetsLus: 0, octetsEcrits: 0, listes: 0, suppressions: 0 };

export class CompteurKv implements Kv {
  readonly durable = false;
  readonly inner = new MemoryKv();
  n = { ...ZERO };
  /** Clés lues (JSON), dans l'ordre. */
  cles: string[] = [];
  get total() {
    return this.n.lectures + this.n.ecritures + this.n.octetsLus + this.n.octetsEcrits + this.n.listes + this.n.suppressions;
  }
  raz() {
    this.n = { ...ZERO };
    this.cles = [];
  }
  async getJson<T>(key: string, opts?: { fresh?: boolean }) {
    this.n.lectures++;
    if (opts?.fresh) this.n.autorite++;
    this.cles.push(key);
    return this.inner.getJson<T>(key);
  }
  async putJson(key: string, value: unknown, opts?: { ifMatch?: string; create?: boolean }): Promise<PutResult> {
    this.n.ecritures++;
    return this.inner.putJson(key, value, opts);
  }
  async getBytes(key: string) {
    this.n.octetsLus++;
    return this.inner.getBytes(key);
  }
  async putBytes(key: string, bytes: Uint8Array, contentType: string) {
    this.n.octetsEcrits++;
    return this.inner.putBytes(key, bytes, contentType);
  }
  async delete(key: string) {
    this.n.suppressions++;
    return this.inner.delete(key);
  }
  async list(prefix: string) {
    this.n.listes++;
    return this.inner.list(prefix);
  }
}
