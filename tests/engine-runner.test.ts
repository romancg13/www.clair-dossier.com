// Moteur de bout en bout sur le dossier fictif « Atelier Lumen » (règles, sans IA, sans réseau).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stack } from './helpers/recette.ts';
import type { RenduView } from '../supabase/functions/_shared/rendus/index.ts';
import type { ModelProvider } from '../supabase/functions/_shared/engine/anthropic.ts';
import { rulesProvider } from '../supabase/functions/_shared/engine/runner.ts';

const INITIAL = ['Courrier-bailleur-2026-10-12.pdf', 'Avis-echeance-T4-2026.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml'];
const view = async (s: ReturnType<typeof stack>, d: string) => (await s.store.getView(d))?.view as RenduView;

test('lot initial : six catégories publiées sans geste, geste « Joindre le bail », une notification', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', INITIAL);
  await s.run();
  const pub = await s.store.getPublished('D1');
  assert.deepEqual(Object.keys(pub).sort(), ['chronologie', 'dashboard', 'dates', 'echeances', 'relances', 'resume']);
  for (const c of Object.values(pub)) assert.equal(c!.status, 'approved');
  const v = await view(s, 'D1');
  assert.equal(v.tableau.action.label, 'Joindre le bail');
  assert.match(v.tableau.situation, /^Au 18 novembre 2026, .*3\s480,00\s€/);
  assert.equal(v.tableau.next_date?.date, '2027-01-15');
  assert.equal(v.tableau.next_date?.status, 'confirmee');
  assert.equal(v.dossier.complete, false, 'le scan n’est pas lu sans IA : analyse partielle explicite');
  assert.ok(v.resume.contradictions.some((c) => /3\s480,00\s€.*3\s210,00\s€/.test(c.text)));
  assert.equal((await s.store.mailbox('A')).length, 1);
  assert.equal(v.echeances.confirmed.length, 1, 'une seule date confirmée (15 janvier 2027)');
  assert.ok(v.echeances.to_confirm.some((d) => d.date === '2026-12-09'), 'rendez-vous proposé : à confirmer');
});

test('complément : doublon détecté, geste « Vérifier la date », une notification par lot', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', INITIAL);
  await s.run();
  const before = await s.store.getPublished('D1');
  await s.depose('D1', 'A', 'L2', ['Bail-commercial-2021.pdf', 'Bail signé (copie).pdf']);
  await s.run();
  const pieces = await s.store.listPieces('D1');
  assert.equal(pieces.filter((p) => p.duplicate_of).length, 1);
  const v = await view(s, 'D1');
  assert.equal(v.tableau.action.label, 'Vérifier la date');
  assert.ok(v.resume.contradictions.some((c) => /3 mars 2021.*5 mars 2021/.test(c.text)));
  const after = await s.store.getPublished('D1');
  assert.ok(after.dashboard!.revision > before.dashboard!.revision);
  assert.equal(after.dashboard!.previous.length, 1, 'version précédente conservée');
  assert.equal((await s.store.mailbox('A')).length, 2);
  // Redépôt du même fichier : aucun nouvel appel, aucune nouvelle révision, aucune notification.
  const rev = (await s.store.lastAnalysis('D1'))!.revision;
  await s.depose('D1', 'A', 'L3', ['Bail-commercial-2021.pdf']);
  await s.run();
  assert.equal((await s.store.lastAnalysis('D1'))!.revision, rev);
  assert.equal((await s.store.mailbox('A')).length, 2);
});

test('correction de date : seules les catégories touchées sont republiées', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', [...INITIAL, 'Bail-commercial-2021.pdf']);
  await s.run();
  const before = await s.store.getPublished('D1');
  const v0 = await view(s, 'D1');
  const ev = v0.dates.rows.find((r) => r.extracted === '2021-03-03')!;
  await s.store.addOverride('D1', { event_key: ev.key, retained_date: '2021-03-05', label: null, hidden: false, reason: 'Date figurant sur le bail signé', author: 'Titulaire du dossier', created_at: s.clock.now().toISOString() });
  await s.store.enqueue({ key: 'r:D1', kind: 'render', user_id: 'A', dossier_id: 'D1', piece_id: null });
  await s.run();
  const after = await s.store.getPublished('D1');
  assert.notEqual(after.dates!.data_hash, before.dates!.data_hash);
  assert.notEqual(after.chronologie!.data_hash, before.chronologie!.data_hash);
  assert.equal(after.resume!.data_hash, before.resume!.data_hash, 'résumé inchangé');
  assert.equal(after.relances!.published_at, before.relances!.published_at, 'relances non republiées');
  const v1 = await view(s, 'D1');
  assert.equal(v1.dates.rows.find((r) => r.key === ev.key)!.retained, '2021-03-05');
  assert.equal(v1.dates.history.length, 1);
});

test('clôture ou droits expirés avant traitement : rien n’est publié', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', INITIAL);
  await s.store.updateDossier('D1', (d) => ({ ...d, closed: true }));
  await s.run();
  assert.deepEqual(await s.store.getPublished('D1'), {});
  const t = stack();
  await t.user('B');
  await t.dossier('D2', 'B');
  await t.depose('D2', 'B', 'L1', INITIAL);
  await t.store.updateSub('B', (x) => ({ ...x, status: 'canceled', current_period_end: '2026-11-01T00:00:00Z' }));
  await t.run();
  assert.deepEqual(await t.store.getPublished('D2'), {});
});

test('deux exécuteurs simultanés : chaque travail une seule fois, une seule révision', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', INITIAL);
  const { drain } = await import('../supabase/functions/_shared/engine/runner.ts');
  for (let i = 0; i < 10; i++) {
    await Promise.all([drain(s.deps, 60_000), drain({ ...s.deps, config: { ...s.deps.config, workerId: 'w2' } }, 60_000)]);
    s.clock.advance(30_000);
  }
  assert.equal((await s.store.lastAnalysis('D1'))!.revision, 1);
  assert.equal((await s.store.mailbox('A')).length, 1);
});

test('service IA mal configuré : scan mis en attente (pas « redéposez »), texte lu par les règles', async () => {
  const down: ModelProvider = {
    name: 'anthropic',
    canReadImages: true,
    extract: async () => ({ ok: false, kind: 'unavailable', message: 'fournisseur indisponible (401 authentication_error)', retryable: false }),
    consolidate: (i, b) => rulesProvider.consolidate(i, b),
  };
  const s = stack({ ai: down });
  await s.user('A');
  await s.dossier('D1', 'A');
  const [scan, courrier] = await s.depose('D1', 'A', 'L1', ['Avis-echeance-T4-2026.pdf', 'Courrier-bailleur-2026-10-12.pdf']);
  await s.run();
  const xs = await s.store.getExtraction(scan);
  assert.equal(xs?.deferred, true, 'reprise prévue');
  assert.match(xs?.reason ?? '', /momentanément indisponible/);
  assert.doesNotMatch(xs?.reason ?? '', /redéposer/);
  assert.equal((await s.store.getExtraction(courrier))?.provider, 'regles', 'repli déterministe');
  assert.ok((await s.store.alerts()).some((a) => a.code === 'IA_INDISPONIBLE'));
});

test('panne du fournisseur puis reprise : pas de double notification ; budget dépassé = pause sans échec', async () => {
  let calls = 0;
  const flaky: ModelProvider = {
    name: 'anthropic',
    canReadImages: false,
    async extract(p, f, b) {
      calls++;
      if (calls <= 2) return { ok: false, kind: 'unavailable', message: 'indisponible', retryable: true };
      const r = await rulesProvider.extract(p, f, b);
      return r.ok ? { ...r, model: 'claude-sonnet-5-5', input_tokens: 1000, output_tokens: 200 } : r;
    },
    consolidate: (i, b) => rulesProvider.consolidate(i, b),
  };
  const s = stack({ ai: flaky });
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx']);
  await s.run();
  assert.equal((await s.store.mailbox('A')).length, 1);
  assert.ok((await s.store.costs('A', [])).userMonth > 0, 'coût enregistré');
  const b = stack({ ai: flaky, config: { budgetCentsPerUserMonth: 0.0001 } });
  await b.user('A');
  await b.dossier('D1', 'A');
  await b.depose('D1', 'A', 'L1', ['Courrier-bailleur-2026-10-12.pdf']);
  await b.store.addCost('A', null, 1);
  await b.run(3);
  const open = await b.store.allOpenJobs();
  assert.ok(open.some((j) => j.status === 'queued' && j.run_after.startsWith('2026-12-01')), 'reporté au mois suivant');
  assert.ok((await b.store.alerts()).some((a) => a.code === 'BUDGET'));
  assert.ok(!JSON.stringify(await b.store.alerts()).includes('Verdier'), 'aucun contenu de pièce dans les alertes');
});

test('pièce piégée : consigne traitée comme texte, aucun effet ; formats illisibles signalés', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', ['Courrier-bailleur-2026-10-12.pdf', 'Consigne-piegee.txt', 'Notes.heic', 'Photo-floue.jpg']);
  await s.run();
  const d = await s.store.getDossierRec('D1');
  assert.equal(d!.deleted, false);
  assert.equal((await s.store.listDeadlines('D1')).filter((r) => r.done).length, 0);
  const v = await view(s, 'D1');
  assert.ok(v.resume.missing.some((m) => /Notes\.heic/.test(m.label)));
  assert.equal(v.tableau.action.label.startsWith('Joindre') || v.tableau.action.label.startsWith('Redéposer'), true);
});

test('isolement : une empreinte connue d’un autre titulaire n’est jamais réemployée', async () => {
  const s = stack();
  await s.user('A');
  await s.user('B');
  await s.dossier('DA', 'A');
  await s.dossier('DB', 'B');
  await s.depose('DA', 'A', 'L1', ['Courrier-bailleur-2026-10-12.pdf']);
  await s.run();
  await s.depose('DB', 'B', 'L2', ['Courrier-bailleur-2026-10-12.pdf']);
  await s.run();
  const pb = (await s.store.listPieces('DB'))[0];
  assert.equal((await s.store.getExtraction(pb.id))!.reused_from, null);
  const v = await view(s, 'DB');
  assert.ok(v.pieces.every((p) => p.id === pb.id), 'aucune pièce de A dans la vue de B');
});
