// Automatisations réelles de la recette : planification, exécution idempotente, équité, droits, isolement.
// Magasin en mémoire, horloge injectée (store.now) : aucun réseau, aucun modèle.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toWorkflow, type PendingAction } from '../supabase/functions/_shared/intelligence/core.ts';
import { MAX_ACTIVES, createAutomation, handleAutomations, listAutomations, nextRun, onPieceRecue, parisToUtc, runsOf, scheduleFrom, setStatus, tickAutomations, type Automation, type Schedule } from '../recette/server/automations.ts';
import { stack } from './helpers/recette.ts';

const VENDREDI = 'Chaque vendredi, analyse mes nouveaux documents, prépare un bilan et indique les actions nécessaires.';
const ECHEANCES = 'Préviens-moi avant chaque échéance.';
const DIX = [...['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map((j) => `Tous les ${j}s, prépare le bilan de mes dossiers.`), 'Chaque jour, prépare le bilan de mes dossiers.', 'Chaque mois, prépare le bilan de mes dossiers.', ECHEANCES];

/** Mercredi 25/11/2026, 11 h à Paris. */
async function monde(start = '2026-11-25T10:00:00Z') {
  const s = stack({ start });
  const abonne = async (id: string, fin = '2030-01-01T00:00:00Z') => {
    await s.user(id, 'none');
    await s.store.updateSub(id, (x) => ({ ...x, status: 'active', plan_id: 'essentiel', current_period_end: fin }));
  };
  const aller = (iso: string) => void s.clock.advance(Date.parse(iso) - s.clock.now().getTime());
  const creer = async (userId: string, input: string | PendingAction) => {
    const r = await createAutomation(s.store, { id: userId }, await s.store.getSub(userId), input);
    assert.ok(r.ok, r.ok ? '' : r.error);
    return r.automation;
  };
  const relire = async (userId: string, id: string) => (await s.store.kv.getJson<Automation>(`auto/${userId}/${id}.json`))!.value;
  const etat = async (userId: string, id: string, op: 'suspendre' | 'reprendre' | 'annuler') => setStatus(s.store, { id: userId }, await s.store.getSub(userId), id, op);
  return { ...s, abonne, aller, creer, relire, etat };
}

function vue(o: { situation?: string; action?: string; echeances?: { key: string; date: string; title: string; done?: boolean }[] } = {}) {
  return {
    version: 1,
    tableau: { situation: o.situation ?? 'Au 25/11/2026, le dossier est complet.', action: { label: o.action ?? 'Joindre le bail', owner: 'client', owner_label: 'Vous', rationale: '', due_date: null, target: null }, next_date: null, cabinet: null, alerts: [] },
    echeances: { confirmed: (o.echeances ?? []).map((e) => ({ time: null, owner: 'client', nature: 'mentioned', source: null, reliability: 'haute', done: false, ...e })), to_confirm: [], past: [], none_confirmed: !o.echeances?.length },
  };
}

test('planification : phrases comprises, heure de Paris, été et hiver', () => {
  const now = new Date('2026-11-25T10:00:00Z');
  assert.deepEqual(scheduleFrom(VENDREDI, now), { schedule: { kind: 'hebdo', weekday: 5, hour: 8, tz: 'Europe/Paris' }, next_run_at: '2026-11-27T07:00:00.000Z' });
  assert.deepEqual(scheduleFrom('Tous les lundis, prépare le bilan de mes dossiers.', now)?.schedule, { kind: 'hebdo', weekday: 1, hour: 8, tz: 'Europe/Paris' });
  assert.deepEqual(scheduleFrom('Chaque jour, fais-moi un point.', now), { schedule: { kind: 'quotidien', hour: 8, tz: 'Europe/Paris' }, next_run_at: '2026-11-26T07:00:00.000Z' });
  assert.deepEqual(scheduleFrom('Chaque mois, prépare un bilan.', now), { schedule: { kind: 'mensuel', hour: 8, tz: 'Europe/Paris' }, next_run_at: '2026-12-01T07:00:00.000Z' });
  assert.deepEqual(scheduleFrom('À chaque facture reçue, analyse-la et préviens-moi.', now), { schedule: { kind: 'evenement', on: 'piece_recue' }, next_run_at: null });
  assert.deepEqual(scheduleFrom(toWorkflow(VENDREDI)!, now)?.schedule, scheduleFrom(VENDREDI, now)?.schedule, 'texte et workflow préparé par l’assistant donnent la même planification');
  assert.equal(scheduleFrom('Bonjour, comment allez-vous ?', now), null);
  assert.equal(scheduleFrom('Chaque vendredi, danse.', now), null, 'rythme sans action comprise');

  // Retour à l'heure d'hiver : dimanche 25/10/2026 (8 h à Paris = 6 h UTC la veille du changement, 7 h UTC ensuite).
  const dimanche: Schedule = { kind: 'hebdo', weekday: 0, hour: 8, tz: 'Europe/Paris' };
  assert.equal(nextRun(dimanche, new Date('2026-10-18T06:00:00Z')), '2026-10-25T07:00:00.000Z');
  assert.equal(nextRun({ kind: 'quotidien', hour: 8, tz: 'Europe/Paris' }, new Date('2026-10-24T06:00:00Z')), '2026-10-25T07:00:00.000Z');
  // Passage à l'heure d'été : dimanche 28/03/2027 (8 h à Paris = 7 h UTC avant, 6 h UTC ensuite).
  assert.equal(nextRun(dimanche, new Date('2027-03-21T07:00:00Z')), '2027-03-28T06:00:00.000Z');
  assert.equal(nextRun({ kind: 'quotidien', hour: 8, tz: 'Europe/Paris' }, new Date('2027-03-27T07:00:00Z')), '2027-03-28T06:00:00.000Z');
  assert.equal(nextRun({ kind: 'quotidien', hour: 8, tz: 'Europe/Paris' }, new Date('2027-03-28T06:00:00Z')), '2027-03-29T06:00:00.000Z');
  // 2 h du matin n'existe pas le 28/03/2027 : exécution à 3 h (1 h UTC), une seule fois ; le 25/10/2026, 2 h existe deux fois : une seule échéance.
  assert.equal(new Date(parisToUtc(2027, 3, 28, 2)).toISOString(), '2027-03-28T01:00:00.000Z');
  const nuit: Schedule = { kind: 'quotidien', hour: 2, tz: 'Europe/Paris' };
  const le25 = nextRun(nuit, new Date('2026-10-24T12:00:00Z'))!;
  assert.equal(le25.slice(0, 10), '2026-10-25');
  assert.equal(nextRun(nuit, new Date(le25)), '2026-10-26T01:00:00.000Z');
  assert.equal(nextRun({ kind: 'mensuel', hour: 8, tz: 'Europe/Paris' }, new Date('2026-12-15T00:00:00Z')), '2027-01-01T07:00:00.000Z');
});

test('création : abonnement exigé, idempotence, plafond de 10 automatisations actives', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.user('sans', 'none');
  const refus = await createAutomation(m.store, { id: 'sans' }, await m.store.getSub('sans'), VENDREDI);
  assert.deepEqual(refus.ok ? null : [refus.status, refus.redirect], [402, '/tarifs']);
  assert.equal((await m.store.kv.list('auto')).length, 0, 'rien n’est enregistré sans abonnement');

  const a = await m.creer('a', VENDREDI);
  assert.equal(a.action, 'bilan_dossiers');
  assert.equal(a.status, 'active');
  assert.equal(a.next_run_at, '2026-11-27T07:00:00.000Z');
  assert.equal(a.workflow.fuseau, 'Europe/Paris');
  // Même demande confirmée deux fois (texte, puis action préparée par l'assistant, puis deux fois en même temps).
  const w = toWorkflow(VENDREDI)!;
  const pending: PendingAction = { id: 'auto:x', kind: 'automatisation', title: w.actions[0], detail: w.declencheur, workflow: w };
  const sub = await m.store.getSub('a');
  const encore = await Promise.all([createAutomation(m.store, { id: 'a' }, sub, VENDREDI), createAutomation(m.store, { id: 'a' }, sub, pending), createAutomation(m.store, { id: 'a' }, sub, pending)]);
  assert.deepEqual(encore.map((r) => r.ok && [r.automation.id, r.created]), [[a.id, false], [a.id, false], [a.id, false]]);
  assert.equal((await listAutomations(m.store, 'a')).length, 1);
  // Création simultanée d'une demande nouvelle : une seule fiche.
  const deux = await Promise.all([createAutomation(m.store, { id: 'a' }, sub, DIX[0]), createAutomation(m.store, { id: 'a' }, sub, DIX[0])]);
  assert.equal(deux.filter((r) => r.ok && r.created).length, 1);
  assert.equal((await listAutomations(m.store, 'a')).length, 2);

  for (const t of DIX) await m.creer('a', t);
  assert.equal((await listAutomations(m.store, 'a')).length, MAX_ACTIVES);
  const onze = await createAutomation(m.store, { id: 'a' }, sub, 'Chaque lundi, préviens-moi avant chaque échéance.');
  assert.equal(onze.ok ? 0 : onze.status, 409);
  // Une place libérée par une suspension peut être reprise par une autre ; la suspendue ne repart pas tant que c'est plein.
  assert.ok((await m.etat('a', a.id, 'suspendre')).ok);
  assert.ok((await createAutomation(m.store, { id: 'a' }, sub, 'Chaque mardi, préviens-moi avant chaque échéance.')).ok);
  const plein = await m.etat('a', a.id, 'reprendre');
  assert.equal(plein.ok ? 0 : plein.status, 409);
  assert.equal(((await createAutomation(m.store, { id: 'a' }, sub, 'Chaque lundi, prépare un projet de relance.')) as { status: number }).status, 400, 'action non exécutable : refusée, jamais simulée');
});

test('exécution au bon instant, pas avant ; preuve et bilan remis dans la boîte', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.dossier('d1', 'a', { title: 'Bail commercial' });
  await m.store.putView('d1', 1, vue(), 'approved');
  const a = await m.creer('a', VENDREDI);
  m.aller('2026-11-27T06:59:59Z');
  assert.equal((await tickAutomations(m.store)).executees, 0);
  assert.equal((await m.store.mailbox('a')).length, 0);
  m.aller('2026-11-27T07:00:00Z');
  const r = await tickAutomations(m.store);
  assert.deepEqual([r.dues, r.executees, r.echecs], [1, 1, 0]);
  const [mail] = await m.store.mailbox('a');
  assert.equal(mail.subject, 'Votre bilan du 27/11/2026');
  assert.equal(mail.link, '/compte');
  assert.match(mail.text, /Bail commercial — aucune nouvelle pièce depuis le 25\/11\/2026/);
  assert.match(mail.text, /Situation : Au 25\/11\/2026, le dossier est complet\./);
  assert.match(mail.text, /Prochaine action : Joindre le bail/);
  const runs = (await runsOf(m.store, 'a', a.id))!;
  assert.equal(runs.length, 1);
  assert.deepEqual([runs[0].at, runs[0].due, runs[0].status, runs[0].rattrapage], ['2026-11-27T07:00:00.000Z', '2026-11-27T07:00:00.000Z', 'faite', false]);
  assert.equal(typeof runs[0].duree_ms, 'number');
  assert.deepEqual(runs[0].compteurs, { dossiers: 1, nouvelles_pieces: 0, actions: 1, dates: 0 });
  const apres = await m.relire('a', a.id);
  assert.deepEqual([apres.runs, apres.last_run_at, apres.next_run_at], [1, '2026-11-27T07:00:00.000Z', '2026-12-04T07:00:00.000Z']);
  assert.equal((await tickAutomations(m.store)).executees, 0, 'pas de seconde exécution pour la même échéance');
  assert.equal((await m.store.mailbox('a')).length, 1);
});

test('deux passages concurrents du planificateur : une seule exécution', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.dossier('d1', 'a');
  await m.store.putView('d1', 1, vue(), 'approved');
  const a = await m.creer('a', VENDREDI);
  m.aller('2026-11-27T07:05:00Z');
  const rs = await Promise.all([tickAutomations(m.store), tickAutomations(m.store), tickAutomations(m.store)]);
  assert.equal(rs.reduce((n, r) => n + r.executees, 0), 1);
  assert.equal((await m.store.mailbox('a')).length, 1);
  assert.equal((await runsOf(m.store, 'a', a.id))!.length, 1);
  assert.equal((await m.relire('a', a.id)).runs, 1);
  // Passage qui a lu l'automatisation avant qu'elle n'avance (lecture périmée) : la preuve existe déjà, rien n'est refait.
  await m.store.kv.putJson(`auto/a/${a.id}.json`, { ...(await m.relire('a', a.id)), next_run_at: '2026-11-27T07:00:00.000Z' });
  const r = await tickAutomations(m.store);
  assert.deepEqual([r.executees, r.ignorees], [0, 1]);
  assert.equal((await m.store.mailbox('a')).length, 1);
});

test('échéances manquées : un seul rattrapage, puis retour au rythme normal', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.dossier('d1', 'a');
  await m.store.putView('d1', 1, vue(), 'approved');
  const a = await m.creer('a', VENDREDI);
  m.aller('2026-12-30T12:00:00Z'); // cinq vendredis sont passés sans passage du planificateur
  assert.equal((await tickAutomations(m.store)).executees, 1);
  assert.equal((await tickAutomations(m.store)).executees, 0);
  const runs = (await runsOf(m.store, 'a', a.id))!;
  assert.equal(runs.length, 1);
  assert.deepEqual([runs[0].due, runs[0].rattrapage], ['2026-11-27T07:00:00.000Z', true]);
  assert.equal((await m.relire('a', a.id)).next_run_at, '2027-01-01T07:00:00.000Z');
  assert.equal((await m.store.mailbox('a')).length, 1);
});

test('suspension, reprise, annulation', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.dossier('d1', 'a');
  await m.store.putView('d1', 1, vue(), 'approved');
  const a = await m.creer('a', VENDREDI);
  const s = await m.etat('a', a.id, 'suspendre');
  assert.deepEqual(s.ok && [s.automation.status, s.automation.next_run_at], ['suspendue', null]);
  m.aller('2026-11-27T08:00:00Z');
  assert.equal((await tickAutomations(m.store)).dues, 0, 'suspendue : rien ne s’exécute');
  const r = await m.etat('a', a.id, 'reprendre');
  assert.deepEqual(r.ok && [r.automation.status, r.automation.next_run_at], ['active', '2026-12-04T07:00:00.000Z'], 'la reprise ne rejoue pas l’échéance passée pendant la suspension');
  m.aller('2026-12-04T07:00:00Z');
  assert.equal((await tickAutomations(m.store)).executees, 1);
  const x = await m.etat('a', a.id, 'annuler');
  assert.deepEqual(x.ok && [x.automation.status, x.automation.next_run_at], ['annulee', null]);
  assert.equal((await listAutomations(m.store, 'a')).length, 0);
  const non = await m.etat('a', a.id, 'reprendre');
  assert.equal(non.ok ? 0 : non.status, 409);
  m.aller('2026-12-18T07:00:00Z');
  assert.equal((await tickAutomations(m.store)).dues, 0);
  assert.equal((await runsOf(m.store, 'a', a.id))!.length, 1, 'le journal reste consultable par le titulaire');
  // La même demande, confirmée de nouveau, repart (historique conservé).
  const b = await m.creer('a', VENDREDI);
  assert.deepEqual([b.id, b.status, b.runs, b.next_run_at], [a.id, 'active', 1, '2026-12-25T07:00:00.000Z']);
});

test('isolement A/B : B ne voit, ne modifie ni ne déclenche l’automatisation de A', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.abonne('b');
  await m.dossier('d1', 'a');
  const a = await m.creer('a', VENDREDI);
  const ev = await m.creer('a', 'À chaque facture reçue, analyse-la et prépare un bilan.');
  assert.deepEqual(await listAutomations(m.store, 'b'), []);
  assert.equal(await runsOf(m.store, 'b', a.id), null);
  const subB = await m.store.getSub('b');
  const appel = (method: string, path: string, body: unknown = null, user = 'b') => handleAutomations({ store: m.store, user: { id: user }, sub: subB, method, path, body });
  const inconnu = await appel('POST', '/api/automatisations/au_000000000000000000000000/annuler');
  for (const op of ['suspendre', 'reprendre', 'annuler']) assert.deepEqual(await appel('POST', `/api/automatisations/${a.id}/${op}`), inconnu, 'même réponse que pour un identifiant inexistant');
  assert.equal(inconnu!.status, 404);
  assert.equal((await appel('GET', `/api/automatisations/${a.id}/executions`))!.status, 404);
  assert.deepEqual(((await appel('GET', '/api/automatisations'))!.body as { automatisations: unknown[] }).automatisations, []);
  assert.equal((await m.relire('a', a.id)).status, 'active');
  // L'identité vient de la session, jamais du corps : la création « pour A » demandée par B appartient à B.
  const cree = await appel('POST', '/api/automatisations', { texte: DIX[0], user_id: 'a', user: { id: 'a' } });
  assert.equal(cree!.status, 201);
  assert.equal((await listAutomations(m.store, 'a')).length, 2);
  assert.equal((await listAutomations(m.store, 'b')).length, 1);
  // Une pièce reçue par B ne déclenche pas l'automatisation événementielle de A.
  assert.equal(await onPieceRecue(m.store, 'b'), 0);
  assert.equal((await m.relire('a', ev.id)).next_run_at, null);
  assert.equal((await tickAutomations(m.store)).dues, 0);
  // Reçue par A : due, exécutée une fois par le planificateur, puis de nouveau en attente.
  assert.equal(await onPieceRecue(m.store, 'a'), 1);
  assert.equal(await onPieceRecue(m.store, 'a'), 0, 'plusieurs pièces d’un même envoi : une seule échéance');
  assert.equal((await tickAutomations(m.store)).executees, 1);
  assert.equal((await m.relire('a', ev.id)).next_run_at, null);
  assert.equal((await m.store.mailbox('b')).length, 0);
});

test('abonnement expiré : arrêt avec motif lisible, aucune exécution', async () => {
  const m = await monde();
  await m.abonne('a', '2026-11-26T00:00:00Z');
  await m.dossier('d1', 'a');
  await m.store.putView('d1', 1, vue(), 'approved');
  const a = await m.creer('a', VENDREDI);
  m.aller('2026-11-27T07:00:00Z');
  const r = await tickAutomations(m.store);
  assert.deepEqual([r.executees, r.arretees], [0, 1]);
  const apres = await m.relire('a', a.id);
  assert.deepEqual([apres.status, apres.next_run_at, apres.runs], ['arretee', null, 0]);
  assert.match(apres.stop_reason!, /abonnement n’est plus actif/);
  assert.deepEqual(await runsOf(m.store, 'a', a.id), []);
  const boite = await m.store.mailbox('a');
  assert.equal(boite.length, 1);
  assert.match(boite[0].subject, /Automatisation arrêtée/);
  assert.equal((await tickAutomations(m.store)).dues, 0);
  // Reprise refusée tant que l'abonnement n'est pas actif ; possible ensuite.
  const non = await m.etat('a', a.id, 'reprendre');
  assert.deepEqual(non.ok ? null : [non.status, non.redirect], [402, '/tarifs']);
  await m.store.updateSub('a', (s) => ({ ...s, current_period_end: '2027-06-01T00:00:00Z' }));
  const oui = await m.etat('a', a.id, 'reprendre');
  assert.deepEqual(oui.ok && [oui.automation.status, oui.automation.stop_reason], ['active', undefined]);
});

test('plafond mensuel atteint : arrêt ; trois échecs de suite : suspension et alerte', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.abonne('b');
  await m.dossier('d1', 'a');
  const a = await m.creer('a', 'Chaque jour, prépare le bilan de mes dossiers.');
  await m.store.kv.putJson(`auto/a/${a.id}.json`, { ...a, max_runs_per_month: 2 });
  for (const j of ['26', '27']) {
    m.aller(`2026-11-${j}T07:00:00Z`);
    assert.equal((await tickAutomations(m.store)).executees, 1);
  }
  m.aller('2026-11-28T07:00:00Z');
  assert.deepEqual([(await tickAutomations(m.store)).arretees, (await m.relire('a', a.id)).status], [1, 'arretee']);
  assert.match((await m.relire('a', a.id)).stop_reason!, /nombre maximal d’exécutions de ce mois/);
  assert.equal((await runsOf(m.store, 'a', a.id))!.length, 2);

  const b = await m.creer('b', 'Chaque jour, prépare le bilan de mes dossiers.');
  const lire = m.store.listUserDossiers.bind(m.store);
  m.store.listUserDossiers = async (u: string) => {
    if (u === 'b') throw new Error('panne simulée');
    return lire(u);
  };
  for (const j of ['29', '30']) {
    m.aller(`2026-11-${j}T07:00:00Z`);
    assert.equal((await tickAutomations(m.store)).echecs, 1);
    assert.equal((await m.relire('b', b.id)).status, 'active');
  }
  m.aller('2026-12-01T07:00:00Z');
  assert.equal((await tickAutomations(m.store)).echecs, 1);
  const fin = await m.relire('b', b.id);
  assert.deepEqual([fin.status, fin.next_run_at, fin.failures], ['suspendue', null, 3]);
  assert.match(fin.stop_reason!, /3 exécutions de suite/);
  assert.equal((await m.store.alerts()).filter((x) => x.code === 'AUTOMATISATION_SUSPENDUE').length, 1);
  const runs = (await runsOf(m.store, 'b', b.id))!;
  assert.deepEqual(runs.map((r) => r.status), ['echec', 'echec', 'echec']);
  assert.ok(!JSON.stringify(runs).includes('panne simulée'), 'le détail technique n’est pas montré au client');
  m.aller('2026-12-02T07:00:00Z');
  assert.equal((await tickAutomations(m.store)).dues, 0);
});

test('équité : un compte avec 10 automatisations dues ne prive pas un autre de son tour', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.abonne('z');
  for (const t of DIX) await m.creer('a', t);
  const z = await m.creer('z', VENDREDI);
  m.aller('2027-01-05T12:00:00Z');
  const r = await tickAutomations(m.store, { max: 3 });
  assert.deepEqual([r.dues, r.executees], [11, 3]);
  assert.equal((await m.relire('z', z.id)).runs, 1, 'le second compte est servi dès le premier passage');
  const total = async () => (await listAutomations(m.store, 'a')).reduce((n, x) => n + x.runs, 0);
  assert.equal(await total(), 2);
  // Passages suivants (plafond par défaut) : au plus 2 exécutions par compte et par passage, jusqu'à épuisement.
  for (const attendu of [4, 6, 8, 10]) {
    assert.equal((await tickAutomations(m.store)).executees, 2);
    assert.equal(await total(), attendu);
  }
  assert.equal((await tickAutomations(m.store)).dues, 0);
});

test('alertes d’échéance : 30, 7 et 1 jour(s), une seule fois par échéance et par palier', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.dossier('d1', 'a', { title: 'Bail commercial' });
  await m.dossier('d2', 'a', { title: 'Dossier clos', closed: true });
  const ech = [{ key: 'k1', date: '2026-12-03', title: 'Répondre au bailleur' }, { key: 'k2', date: '2027-03-01', title: 'Trop lointaine' }, { key: 'k3', date: '2026-11-30', title: 'Déjà faite', done: true }];
  await m.store.putView('d1', 1, vue({ echeances: ech }), 'approved');
  await m.store.putView('d2', 1, vue({ echeances: [{ key: 'k9', date: '2026-11-28', title: 'Dossier clos' }] }), 'approved');
  const a = await m.creer('a', ECHEANCES);
  assert.deepEqual([a.action, a.schedule], ['prevenir_echeances', { kind: 'quotidien', hour: 8, tz: 'Europe/Paris' }]);
  const alertes = async () => (await m.store.mailbox('a')).filter((x) => /échéance/.test(x.subject));
  m.aller('2026-11-26T07:00:00Z'); // J-7
  assert.equal((await tickAutomations(m.store)).executees, 1);
  assert.equal((await alertes()).length, 1);
  assert.match((await alertes())[0].text, /03\/12\/2026 \(dans 7 jours\) — Répondre au bailleur — dossier « Bail commercial »/);
  assert.ok(!/Trop lointaine|Déjà faite|Dossier clos/.test((await alertes())[0].text));
  for (const j of ['27', '28', '29', '30']) {
    m.aller(`2026-11-${j}T07:00:00Z`);
    assert.equal((await tickAutomations(m.store)).executees, 1);
  }
  assert.equal((await alertes()).length, 1, 'même palier : pas de nouvelle alerte');
  assert.equal((await runsOf(m.store, 'a', a.id))![0].status, 'rien_a_signaler');
  // Une seconde automatisation du même compte ne redit pas ce qui a déjà été signalé.
  await m.creer('a', 'Chaque mardi, préviens-moi avant chaque échéance.');
  m.aller('2026-12-01T07:30:00Z');
  assert.equal((await tickAutomations(m.store)).executees, 2);
  assert.equal((await alertes()).length, 1);
  m.aller('2026-12-02T07:00:00Z'); // J-1
  await tickAutomations(m.store);
  assert.equal((await alertes()).length, 2);
  assert.match((await alertes())[0].text, /\(demain\)/);
  m.aller('2026-12-03T07:00:00Z'); // jour J : palier « 1 jour » déjà signalé
  await tickAutomations(m.store);
  m.aller('2026-12-04T07:00:00Z'); // passée
  await tickAutomations(m.store);
  assert.equal((await alertes()).length, 2);
  // Date corrigée : c'est une autre échéance, signalée à son tour.
  await m.store.putView('d1', 2, vue({ echeances: [{ key: 'k1', date: '2026-12-10', title: 'Répondre au bailleur' }] }), 'approved');
  m.aller('2026-12-05T07:00:00Z');
  await tickAutomations(m.store);
  assert.equal((await alertes()).length, 3);
});

test('bilan réel après dépôt : compteurs et situation, sans aucun texte ni nom de pièce', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.dossier('d1', 'a');
  const a = await m.creer('a', VENDREDI);
  const fichiers = ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml'];
  await m.depose('d1', 'a', 'lot-1', fichiers);
  await m.run();
  const v = (await m.store.getView('d1'))!;
  assert.equal(v.status, 'approved');
  const t = (v.view as { tableau: { situation: string; action: { label: string } } }).tableau;
  m.aller('2026-11-27T07:00:00Z');
  assert.equal((await tickAutomations(m.store)).executees, 1);
  const bilan = (await m.store.mailbox('a')).find((x) => x.subject.startsWith('Votre bilan'))!;
  assert.match(bilan.text, /3 nouvelles pièces reçues depuis le 25\/11\/2026/);
  assert.ok(bilan.text.includes(`Situation : ${t.situation}`));
  assert.ok(bilan.text.includes(`Prochaine action : ${t.action.label}`));
  assert.match(bilan.text, /ne constitue pas un conseil juridique/);
  const [preuve] = (await runsOf(m.store, 'a', a.id))!;
  assert.equal(preuve.compteurs!.nouvelles_pieces, 3);
  assert.equal(preuve.texte, bilan.text);
  // Ni nom de fichier, ni extrait lu dans une pièce, ni identifiant de pièce : dans le message comme dans le journal.
  const journal = JSON.stringify(await Promise.all((await m.store.kv.list('auto')).map((k) => m.store.kv.getJson(k))));
  const extraits = new Set<string>();
  for (const k of await m.store.kv.list('extractions/')) for (const q of JSON.stringify((await m.store.kv.getJson(k))!.value).match(/"quote":"((?:[^"\\]|\\.){12,})"/g) ?? []) extraits.add(JSON.parse(`{${q}}`).quote);
  assert.ok(extraits.size > 0, 'le contrôle porte bien sur des extraits réels');
  const connus = new Set([t.situation, t.action.label]);
  for (const interdit of [...fichiers, ...fichiers.map((f) => f.replace(/\.\w+$/, '')), ...[...extraits].filter((q) => ![...connus].some((c) => c.includes(q))), 'sha256', '"p1"']) {
    assert.ok(!bilan.text.includes(interdit), `le bilan ne contient pas « ${interdit.slice(0, 40)} »`);
    assert.ok(!journal.includes(interdit), `le journal ne contient pas « ${interdit.slice(0, 40)} »`);
  }
  // Deuxième vendredi : aucune nouvelle pièce depuis le dernier bilan.
  m.aller('2026-12-04T07:00:00Z');
  await tickAutomations(m.store);
  assert.match((await m.store.mailbox('a'))[0].text, /aucune nouvelle pièce depuis le 27\/11\/2026/);
});

test('routes : liste, création, états, exécutions ; réponses en français simple', async () => {
  const m = await monde();
  await m.abonne('a');
  await m.user('sans', 'none');
  const appel = async (user: string, method: string, path: string, body: unknown = null) => handleAutomations({ store: m.store, user: { id: user }, sub: await m.store.getSub(user), method, path, body });
  assert.equal(await appel('a', 'GET', '/api/dossiers'), null, 'chemin étranger : laissé à l’appelant');
  assert.deepEqual(await appel('sans', 'POST', '/api/automatisations', { texte: VENDREDI }), { status: 402, body: { error: 'Un abonnement actif est nécessaire pour utiliser les automatisations.', redirect: '/tarifs' } });
  assert.equal((await appel('a', 'POST', '/api/automatisations', {}))!.status, 400);
  assert.equal((await appel('a', 'POST', '/api/automatisations', { texte: 'Bonjour' }))!.status, 400);
  assert.equal((await appel('a', 'POST', '/api/automatisations', { action: { kind: 'rappel', title: 'x', detail: 'y', id: 'z' } }))!.status, 400);
  const c = await appel('a', 'POST', '/api/automatisations', { texte: VENDREDI });
  assert.equal(c!.status, 201);
  const auto = (c!.body as { automatisation: { id: string; titre: string; quand: string; statut: string; prochaine_execution: string } }).automatisation;
  assert.deepEqual([auto.titre, auto.quand, auto.statut, auto.prochaine_execution], ['Bilan de vos dossiers', 'chaque vendredi à 8 h (heure de Paris)', 'active', '2026-11-27T07:00:00.000Z']);
  const w = toWorkflow(VENDREDI)!;
  const bis = await appel('a', 'POST', '/api/automatisations', { action: { id: 'auto:x', kind: 'automatisation', title: 't', detail: 'd', workflow: w } });
  assert.deepEqual([bis!.status, (bis!.body as { deja_existante: boolean }).deja_existante], [200, true]);
  assert.equal(((await appel('a', 'GET', '/api/automatisations'))!.body as { automatisations: unknown[] }).automatisations.length, 1);
  assert.equal(((await appel('a', 'POST', `/api/automatisations/${auto.id}/suspendre`))!.body as { automatisation: { statut: string } }).automatisation.statut, 'suspendue');
  assert.equal(((await appel('a', 'POST', `/api/automatisations/${auto.id}/reprendre`))!.body as { automatisation: { statut: string } }).automatisation.statut, 'active');
  assert.deepEqual((await appel('a', 'GET', `/api/automatisations/${auto.id}/executions`))!.body, { executions: [] });
  assert.equal((await appel('a', 'GET', '/api/automatisations/../../users/a/executions'))!.status, 404);
  assert.equal((await appel('a', 'DELETE', `/api/automatisations/${auto.id}`))!.status, 404);
  assert.equal(((await appel('a', 'POST', `/api/automatisations/${auto.id}/annuler`))!.body as { automatisation: { statut: string } }).automatisation.statut, 'annulee');
});
