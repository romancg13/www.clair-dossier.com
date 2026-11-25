// REMISE §11, point « latence » : nombre d'accès au stockage sur « dépôt de 4 pièces → premier résultat ».
// Mesure avec le magasin en mémoire instrumenté (aucun réseau) ; les plafonds verrouillent la réduction obtenue.
//   Avant (5f79e26) : dépôt 32 accès ; premier résultat 207 accès (140 lectures, dont 23 de travaux et 20 de la file).
//   Après          : dépôt 32 accès ; premier résultat 174 accès (107 lectures, dont 12 de travaux et 13 de la file).
// Aucune lecture d'autorité dans ce parcours sans conflit, avant comme après : le gain vient des lectures ordinaires
// évitées (travaux déjà lus par l'exécuteur, fin de travail écrite sur l'ETag de la prise, file lue une fois par
// fin de lecture, numéro de révision lu sans son contenu).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecetteStore } from '../recette/server/store.ts';
import { engineDeps, sha256 } from '../recette/server/engine-deps.ts';
import { drain } from '../supabase/functions/_shared/engine/runner.ts';
import { CompteurKv } from './helpers/compteur-kv.ts';
import { fixture } from './helpers/recette.ts';

const PIECES = ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml', 'Avis-echeance-T4-2026.pdf'];

async function mesure() {
  let t = Date.parse('2026-11-18T09:00:00Z');
  const clock = { now: () => new Date(t), advance: (ms: number) => (t += ms) };
  const kv = new CompteurKv();
  const store = new RecetteStore(kv, clock.now);
  await store.putUser({ id: 'A', email: 'a@exemple.test', first_name: 'A', last_name: 'Test', company: null, role: 'client', pwd: { salt: '', hash: '' }, notifications: true, created_at: clock.now().toISOString() });
  await store.updateSub('A', (s) => ({ ...s, status: 'active', plan_id: 'essentiel', current_period_end: '2026-12-18T00:00:00Z' }));
  await store.createDossier({ id: 'D1', user_id: 'A', title: 'Régularisation de charges 2025', typology: 'facture-paiement', objective: null, review_mode: 'auto', sensitive: false, closed: false, deleted: false, created_at: clock.now().toISOString() });
  kv.raz();
  let i = 0;
  for (const f of PIECES) {
    const bytes = fixture(f);
    const id = `p${++i}`;
    clock.advance(10);
    await store.addPiece({ id, dossier_id: 'D1', user_id: 'A', lot_id: 'L1', file_name: f, mime: null, size_bytes: bytes.byteLength, sha256: await sha256(bytes), duplicate_of: null, created_at: clock.now().toISOString(), deleted_at: null }, bytes);
    await store.enqueue({ key: `x:${id}`, kind: 'extract', user_id: 'A', dossier_id: 'D1', piece_id: id });
  }
  const depot = { ...kv.n, total: kv.total };
  kv.raz();
  // Un exécuteur neuf par passage (comme une invocation hébergée), jusqu'au premier résultat publié.
  let passages = 0;
  while (!(await kv.inner.getJson('views/D1.json')) && passages < 50) {
    passages++;
    await drain(engineDeps(new RecetteStore(kv, clock.now), { ai: null, config: { consolidateDelayMs: 0 } }), 60_000, 50);
    clock.advance(3_000);
  }
  const view = (await kv.inner.getJson<{ revision: number }>('views/D1.json'))?.value ?? null;
  const parCle: Record<string, number> = {};
  for (const k of kv.cles) parCle[k.split(/[/.]/)[0]] = (parCle[k.split(/[/.]/)[0]] ?? 0) + 1;
  return { depot, resultat: { ...kv.n, total: kv.total, lecturesDeTravaux: kv.cles.filter((k) => k.startsWith('jobs/')).length, passages }, parCle, view };
}

test('latence : accès au stockage bornés sur « dépôt de 4 pièces → premier résultat »', async () => {
  const m = await mesure();
  console.log(`# mesure stockage ${JSON.stringify({ depot: m.depot, resultat: m.resultat, lecturesParCle: m.parCle })}`);
  assert.equal(m.view?.revision, 1, 'premier résultat publié');
  assert.equal(m.depot.autorite + m.resultat.autorite, 0, 'aucune lecture d’autorité sans conflit');
  assert.equal(m.resultat.passages, 1, 'un seul passage de l’exécuteur');
  // Plafonds : la mesure d'avant correctif (207 accès, 23 lectures de travaux, 20 de la file) les dépasse tous.
  assert.ok(m.resultat.total <= 180, `${m.resultat.total} accès pour le premier résultat`);
  assert.ok(m.resultat.lecturesDeTravaux <= 14, `${m.resultat.lecturesDeTravaux} lectures de travaux`);
  assert.ok((m.parCle.queue ?? 0) <= 15, `${m.parCle.queue} lectures de la file`);
  assert.ok(m.depot.total <= 32, `${m.depot.total} accès au dépôt`);
});
