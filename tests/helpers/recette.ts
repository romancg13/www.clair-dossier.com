// Pile de recette complète EN MÉMOIRE pour les tests (aucun réseau, aucune persistance).
import { readFileSync } from 'node:fs';
import { MemoryKv } from '../../recette/server/kv.ts';
import { RecetteStore, type DossierRec } from '../../recette/server/store.ts';
import { engineDeps, sha256 } from '../../recette/server/engine-deps.ts';
import { drain } from '../../supabase/functions/_shared/engine/runner.ts';
import type { ModelProvider } from '../../supabase/functions/_shared/engine/anthropic.ts';
import type { EngineConfig } from '../../supabase/functions/_shared/engine/ports.ts';

const PIECES = new URL('../../recette/fixtures/pieces/', import.meta.url);
export const fixture = (name: string) => new Uint8Array(readFileSync(new URL(encodeURIComponent(name).replace(/%2F/g, '/'), PIECES)));

export function stack(o: { ai?: ModelProvider | null; config?: Partial<EngineConfig>; start?: string } = {}) {
  let t = new Date(o.start ?? '2026-11-18T09:00:00Z').getTime();
  const clock = { now: () => new Date(t), advance: (ms: number) => (t += ms) };
  const kv = new MemoryKv();
  const store = new RecetteStore(kv, clock.now);
  const deps = engineDeps(store, { ai: o.ai ?? null, config: { consolidateDelayMs: 0, ...o.config } });
  async function user(id: string, sub: 'active' | 'none' = 'active') {
    await store.putUser({ id, email: `${id}@exemple.test`, first_name: id, last_name: 'Test', company: null, role: 'client', pwd: { salt: '', hash: '' }, notifications: true, created_at: clock.now().toISOString() });
    if (sub === 'active') await store.updateSub(id, (s) => ({ ...s, status: 'active', plan_id: 'essentiel', current_period_end: '2026-12-18T00:00:00Z' }));
  }
  async function dossier(id: string, userId: string, extra: Partial<DossierRec> = {}) {
    await store.createDossier({ id, user_id: userId, title: 'Régularisation de charges 2025', typology: 'facture-paiement', objective: null, review_mode: 'auto', sensitive: false, closed: false, deleted: false, created_at: clock.now().toISOString(), ...extra });
  }
  let n = 0;
  async function depose(dossierId: string, userId: string, lot: string, files: string[]) {
    const ids: string[] = [];
    for (const f of files) {
      const bytes = fixture(f);
      const id = `p${++n}`;
      clock.advance(10);
      await store.addPiece({ id, dossier_id: dossierId, user_id: userId, lot_id: lot, file_name: f.split('/').pop()!, mime: null, size_bytes: bytes.byteLength, sha256: await sha256(bytes), duplicate_of: null, created_at: clock.now().toISOString(), deleted_at: null }, bytes);
      await store.enqueue({ key: `x:${id}`, kind: 'extract', user_id: userId, dossier_id: dossierId, piece_id: id });
      ids.push(id);
    }
    return ids;
  }
  /** Fait tourner l'exécuteur jusqu'à épuisement, en avançant l'horloge entre les tours. */
  async function run(rounds = 40) {
    const reports = [];
    for (let i = 0; i < rounds; i++) {
      const r = await drain(deps, 60_000, 50);
      reports.push(...r);
      if (!(await store.allOpenJobs()).length) break;
      clock.advance(30_000);
    }
    return reports;
  }
  return { kv, store, deps, clock, user, dossier, depose, run };
}
