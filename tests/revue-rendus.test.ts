// Revue PR #68, lot « rendus » : non-régression des constats C12, C13, C24, C25, C26, B6 et B7
// (six rendus, ICS, PDF, prestations, formulaire de dates). Pile en mémoire, sans réseau.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFPage } from 'pdf-lib';
import { MemoryKv } from '../recette/server/kv.ts';
import { RecetteStore } from '../recette/server/store.ts';
import { engineDeps } from '../recette/server/engine-deps.ts';
import { handle, type ApiEnv } from '../recette/server/api.ts';
import { loadAssets } from '../recette/server/assets.ts';
import { fixture, stack } from './helpers/recette.ts';
import { deadlineKey } from '../supabase/functions/_shared/ai-pipeline.ts';
import { buildConfirmedIcs, buildView, categoryFiles, reliabilityOf, type RenduView, type ViewAnalysis } from '../supabase/functions/_shared/rendus/index.ts';
import { Pdf } from '../supabase/functions/_shared/rendus/pdf.ts';
import { demandeJustificatifs, ficheRendezVous } from '../supabase/functions/_shared/prestations/index.ts';

const INITIAL = ['Courrier-bailleur-2026-10-12.pdf', 'Avis-echeance-T4-2026.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml'];
const view = async (s: ReturnType<typeof stack>, d: string) => (await s.store.getView(d))?.view as RenduView;
const allDeadlines = (v: RenduView) => [...v.echeances.confirmed, ...v.echeances.to_confirm, ...v.echeances.past];
/** Contenu d'un .ics publié, lignes dépliées (RFC 5545 §3.1). */
async function publishedIcs(s: ReturnType<typeof stack>, d: string): Promise<string> {
  const f = (await s.store.getPublished(d)).echeances!.files.find((x) => x.name.endsWith('.ics'))!;
  return new TextDecoder().decode((await s.kv.getBytes(f.path))!).replace(/\r\n /g, '');
}
async function correct(s: ReturnType<typeof stack>, d: string, user: string, key: string, date: string) {
  // Même écriture que la route POST /dates de l'API.
  await s.store.addOverride(d, { event_key: key, retained_date: date, label: null, hidden: false, reason: 'Revue', author: 'Titulaire du dossier', created_at: s.clock.now().toISOString() });
  await s.store.enqueue({ key: `r:${d}`, kind: 'render', user_id: user, dossier_id: d, piece_id: null });
  s.clock.advance(1000);
  await s.run();
}

/** Textes dessinés sur les pages PDF pendant `fn` (espion sur PDFPage.drawText). */
async function drawnTexts<T>(fn: () => Promise<T>): Promise<{ text: string; x: number; y: number; size: number; width: number }[]> {
  const calls: { text: string; x: number; y: number; size: number; width: number }[] = [];
  const orig = PDFPage.prototype.drawText;
  PDFPage.prototype.drawText = function (this: PDFPage, text: string, o: Parameters<PDFPage['drawText']>[1] = {}) {
    calls.push({ text, x: o.x ?? 0, y: o.y ?? 0, size: o.size ?? 0, width: o.font && o.size ? o.font.widthOfTextAtSize(text, o.size) : 0 });
    return orig.call(this, text, o);
  };
  try {
    await fn();
  } finally {
    PDFPage.prototype.drawText = orig;
  }
  return calls;
}

/* ── API de recette (mêmes aides que tests/recette-api.test.ts) ─────────── */
function env() {
  const store = new RecetteStore(new MemoryKv());
  const pending: Promise<unknown>[] = [];
  const e: ApiEnv = { store, deps: async () => engineDeps(store, { ai: null, config: { consolidateDelayMs: 0 } }), secret: 'secret-de-test-0123456789', workerToken: 'w', cronSecret: 'c', siteUrl: 'http://127.0.0.1:9', adminPassword: null, waitUntil: (p) => void pending.push(p), kickWorker: async () => undefined, aiLabel: 'règles' };
  const settle = async () => {
    while (pending.length) await pending.shift();
  };
  return { e, store, settle };
}
function client(e: ApiEnv) {
  let cookie = '';
  return async (method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { 'x-clairdossier': '1', cookie };
    let payload: BodyInit | undefined;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) (payload = JSON.stringify(body)), (headers['content-type'] = 'application/json');
    const r = await handle(e, new Request(`https://recette.test${path}`, { method, headers, body: payload }));
    const sc = r.headers.get('set-cookie');
    if (sc) cookie = sc.split(';')[0];
    return r;
  };
}
const upload = (files: string[]) => {
  const f = new FormData();
  for (const n of files) f.append('fichiers', new File([fixture(n)], n));
  return f;
};
const pdfForm = (bytes: Uint8Array) => {
  const f = new FormData();
  f.append('fichier', new File([new Uint8Array(bytes)], 'dates.pdf'));
  return f;
};
/** Dossier « bail » de démonstration : vue publiée et formulaire « Dates modifiables » r1 téléchargé. */
async function bailDossier() {
  const { e, settle } = env();
  const call = client(e);
  await call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const id = (await (await call('GET', '/api/dossiers')).json()).dossiers[0].id as string;
  await call('POST', `/api/dossiers/${id}/pieces`, upload(['Courrier-bailleur-2026-10-12.pdf', 'Bail-commercial-2021.pdf']));
  await settle();
  const d0 = await (await call('GET', `/api/dossiers/${id}`)).json();
  const name = d0.rendus.find((x: { cle: string }) => x.cle === 'dates').fichiers.find((f: { nom: string }) => f.nom.endsWith('.pdf')).nom;
  const url = (await (await call('POST', `/api/dossiers/${id}/lien`, { categorie: 'dates', nom: name })).json()).url;
  const pdf = new Uint8Array(await (await call('GET', url)).arrayBuffer());
  const keys = JSON.parse((await PDFDocument.load(pdf)).getForm().getTextField('cles').getText()!) as string[];
  const vue = async () => (await (await call('GET', `/api/dossiers/${id}`)).json()).vue as RenduView;
  const fill = async (values: Record<number, string>) => {
    const doc = await PDFDocument.load(pdf);
    for (const [i, v] of Object.entries(values)) doc.getForm().getTextField(`date_retenue_${i}`).setText(v);
    return new Uint8Array(await doc.save());
  };
  return { call, settle, id, keys, vue, fill };
}

/* ── C12 : corrections reprises dans les échéances, l'ICS et la prochaine date ── */

test('C12 : une date corrigée dans « Dates modifiables » est reprise dans les échéances (et reste à confirmer)', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', INITIAL);
  await s.run();
  const v0 = await view(s, 'D1');
  const rdv = v0.dates.rows.find((r) => r.extracted === '2026-12-09')!;
  assert.ok(rdv, 'rendez-vous proposé présent dans « Dates modifiables »');
  await correct(s, 'D1', 'A', rdv.key, '2026-12-16');
  const v1 = await view(s, 'D1');
  assert.equal(v1.dates.rows.find((r) => r.key === rdv.key)!.retained, '2026-12-16');
  assert.ok(!allDeadlines(v1).some((d) => d.date === '2026-12-09'), 'plus aucune échéance à l’ancienne date');
  const moved = v1.echeances.to_confirm.find((d) => d.date === '2026-12-16');
  assert.ok(moved, 'la proposition corrigée reste « à confirmer »');
  assert.match(moved.nature, /corrigée par vous/);
  assert.deepEqual(v1.echeances.confirmed.map((d) => d.date), ['2027-01-15'], 'une proposition corrigée ne devient pas confirmée');
  assert.ok(!(await publishedIcs(s, 'D1')).includes('20261216'), 'ni exportée dans l’ICS');
});

test('C12 : la date confirmée exportée dans l’ICS est corrigeable et sa correction est reprise partout', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', INITIAL);
  await s.run();
  const v0 = await view(s, 'D1');
  const conf = v0.echeances.confirmed[0];
  assert.equal(conf.date, '2027-01-15');
  assert.ok(v0.dates.rows.some((r) => r.key === conf.key), 'l’échéance confirmée figure dans « Dates modifiables »');
  await correct(s, 'D1', 'A', conf.key, '2027-01-22');
  const v1 = await view(s, 'D1');
  assert.equal(v1.dates.rows.find((r) => r.key === conf.key)!.status, 'corrigee');
  assert.deepEqual(v1.echeances.confirmed.map((d) => d.date), ['2027-01-22']);
  assert.equal(v1.tableau.next_date?.date, '2027-01-22');
  assert.equal(v1.tableau.next_date?.status, 'confirmee');
  const ics = await publishedIcs(s, 'D1');
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20270122') && !ics.includes('20270115'), 'ICS à la date corrigée');
});

test('C12 : le lien échéance ↔ événement ne dépend pas de la coïncidence des clés (libellé court)', () => {
  const ev = { document_id: 'p1', page: null, quote: 'Réunion de chantier le 9 décembre 2026.', status: 'found' as const };
  const eventKey = deadlineKey('Courriel : réunion de chantier', '2026-12-09');
  const analysis: ViewAnalysis = {
    summary_short: 's', summary_long: 'l', parties: [], facts: [], contradictions: [], missing_items: [], attention_points: [], next_actions: [], reminder_drafts: [],
    deadlines: [{ title: 'Courriel : réunion de chantier (proposition, non confirmée)', date: '2026-12-09', kind: 'hypothesis', basis: 'b', priority: 'normale', owner: 'client', evidence: [ev] }],
    events: [{ key: eventKey, date: '2026-12-09', precision: 'day', kind: 'event_date', label: 'Courriel : réunion de chantier', evidence: [ev] }],
  };
  assert.notEqual(deadlineKey(analysis.deadlines[0].title, '2026-12-09'), eventKey);
  const v = buildView({ title: 'T', revision: 1, generatedAt: new Date('2026-11-18T09:00:00Z'), analysis, coverage: { total: 1, extracted: 1, unsupported: 0, failed: 0, pending: 0, complete: true }, pieces: [{ id: 'p1', file_name: 'Courriel.eml', created_at: '2026-11-18T09:00:00Z' }], overrides: [{ event_key: eventKey, retained_date: '2026-12-16', label: null, hidden: false, reason: 'Réunion reportée', author: 'Titulaire du dossier', created_at: '2026-11-18T10:00:00Z' }], deadlineRows: [], provider: 'regles' });
  assert.deepEqual(v.echeances.to_confirm.map((d) => d.date), ['2026-12-16']);
  assert.equal(v.dates.rows.length, 1, 'une seule ligne modifiable pour l’événement et sa proposition');
});

/* ── C13 : formulaire PDF « Dates modifiables » ─────────────────────────── */

test('C13 : un ancien formulaire n’écrase pas une correction faite en ligne entre-temps', async () => {
  const { call, settle, id, keys, vue, fill } = await bailDossier();
  const ix = keys.findIndex((k) => k.startsWith('2021-03-03'));
  const iy = keys.findIndex((k, j) => j !== ix && !k.startsWith('2021-03-05'));
  assert.equal((await call('POST', `/api/dossiers/${id}/dates`, { cle: keys[ix], date: '2021-03-05', raison: 'Correction en ligne' })).status, 200);
  await settle();
  // Vieux PDF : seule la ligne Y est modifiée.
  const r = await (await call('POST', `/api/dossiers/${id}/dates/formulaire`, pdfForm(await fill({ [iy]: '01/01/2020' })))).json();
  assert.equal(r.corrigees, 1, 'seule la ligne modifiée dans le formulaire est appliquée');
  await settle();
  const v = await vue();
  assert.equal(v.dates.rows.find((x) => x.key === keys[ix])!.retained, '2021-03-05', 'correction en ligne conservée');
  assert.equal(v.dates.rows.find((x) => x.key === keys[iy])!.retained, '2020-01-01');
});

test('C13 : une ligne modifiée dans le formulaire ET en ligne depuis son impression est signalée en conflit, sans écrasement', async () => {
  const { call, settle, id, keys, vue, fill } = await bailDossier();
  const ix = keys.findIndex((k) => k.startsWith('2021-03-03'));
  await call('POST', `/api/dossiers/${id}/dates`, { cle: keys[ix], date: '2021-03-05', raison: 'Correction en ligne' });
  await settle();
  const res = await call('POST', `/api/dossiers/${id}/dates/formulaire`, pdfForm(await fill({ [ix]: '04/03/2021' })));
  assert.equal(res.status, 200);
  const r = await res.json();
  assert.equal(r.corrigees, 0);
  assert.equal(r.conflits.length, 1);
  await settle();
  assert.equal((await vue()).dates.rows.find((x) => x.key === keys[ix])!.retained, '2021-03-05');
});

test('C13 : saisie J/M/AAAA acceptée ; date impossible refusée et signalée (formulaire et route en ligne)', async () => {
  const { call, settle, id, keys, vue, fill } = await bailDossier();
  const ix = keys.findIndex((k) => k.startsWith('2021-03-03'));
  const r1 = await (await call('POST', `/api/dossiers/${id}/dates/formulaire`, pdfForm(await fill({ [ix]: '5/3/2021' })))).json();
  assert.equal(r1.corrigees, 1, '« 5/3/2021 » est lu comme le 5 mars 2021');
  await settle();
  assert.equal((await vue()).dates.rows.find((x) => x.key === keys[ix])!.retained, '2021-03-05');
  const r2 = await (await call('POST', `/api/dossiers/${id}/dates/formulaire`, pdfForm(await fill({ [ix]: '31/02/2021' })))).json();
  assert.equal(r2.corrigees, 0);
  assert.equal(r2.ignorees.length, 1, 'date inexistante signalée');
  await settle();
  assert.equal((await vue()).dates.rows.find((x) => x.key === keys[ix])!.retained, '2021-03-05', 'aucune date impossible enregistrée');
  assert.equal((await call('POST', `/api/dossiers/${id}/dates`, { cle: keys[ix], date: '2021-02-31', raison: 'x' })).status, 400);
});

/* ── C24 : prestations, aucune échéance affirmée à tort ─────────────────── */

test('C24 : la demande de justificatifs et la fiche RDV n’affirment pas une date à confirmer comme échéance', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', ['Courriel-2026-10-20.eml', 'Releve-charges-2025.xlsx']);
  await s.run();
  const v = await view(s, 'D1');
  assert.equal(v.tableau.next_date?.status, 'a_confirmer', 'prémisse : seule une proposition de rendez-vous est datée');
  const corps = demandeJustificatifs(v, '').corps;
  assert.ok(!corps.includes('09/12/2026') && !/réponse est attendue/i.test(corps), corps);
  assert.ok(!ficheRendezVous(v).questions.some((q) => q.includes('09/12/2026')));
  // Lot complet : l'échéance de réponse confirmée reste citée.
  await s.dossier('D2', 'A');
  await s.depose('D2', 'A', 'L2', INITIAL);
  await s.run();
  assert.match(demandeJustificatifs(await view(s, 'D2'), '').corps, /Une réponse est attendue avant le 15\/01\/2027/);
});

/* ── C25 : ICS ──────────────────────────────────────────────────────────── */

test('C25 : UID ICS propre à chaque dossier, stable d’une révision à l’autre ; « ; » échappé', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A', { title: 'Bail local A ; charges incluses' });
  await s.dossier('D2', 'A', { title: 'Bail local B' });
  await s.depose('D1', 'A', 'L1', INITIAL);
  await s.depose('D2', 'A', 'L2', INITIAL);
  await s.run();
  const uid = (ics: string) => /^UID:(.+)$/m.exec(ics)![1];
  const ics1 = await publishedIcs(s, 'D1');
  const u1 = uid(ics1), u2 = uid(await publishedIcs(s, 'D2'));
  assert.notEqual(u1, u2, 'même échéance, même date, deux dossiers : deux UID');
  assert.match(ics1, /^SUMMARY:Bail local A \\; charges incluses — /m, '« ; » échappé (RFC 5545 §3.3.11)');
  assert.match(buildConfirmedIcs({ ...(await view(s, 'D2')), dossier: { ...(await view(s, 'D2')).dossier, title: 'a;b,c' } }, new Date()), /^SUMMARY:a\\;b\\,c — /m);
  // Nouvelle révision : l'événement garde son UID (réimport = mise à jour, pas doublon).
  await s.depose('D1', 'A', 'L3', ['Bail-commercial-2021.pdf']);
  await s.run();
  assert.ok((await s.store.lastAnalysis('D1'))!.revision > 1);
  assert.equal(uid(await publishedIcs(s, 'D1')), u1);
});

/* ── C26 : pied de page PDF complet ─────────────────────────────────────── */

test('C26 : le pied de page PDF n’est jamais tronqué (avertissement juridique, « sans IA », « Données fictives »)', async () => {
  const title = 'Litige bail commercial avec la société Exemple et ses ayants droit successifs dans le cadre de la procédure collective ouverte'.slice(0, 120);
  const footer = `ClairDossier — ${title} — révision 12. Document généré automatiquement à partir des pièces du dossier : à vérifier ; il ne constitue pas un conseil juridique. Analyse produite par règles déterministes (sans IA). Données fictives (recette).`;
  const p = await Pdf.create(loadAssets(), { title: 't', kicker: 'K', footer, subject: 's' });
  p.text('Corps du document.');
  const calls = await drawnTexts(() => p.save());
  const foot = calls.filter((c) => c.size === 7);
  assert.equal(foot.map((c) => c.text).join(' ').replace(/\s+/g, ' '), footer.replace(/\s+/g, ' '), 'pied de page complet');
  assert.ok(foot.every((c) => c.y >= 10), 'dans la page');
});

/* ── B6 : motif de fiabilité ────────────────────────────────────────────── */

test('B6 : une date proposée n’est pas dite « non écrite dans une pièce »', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', INITIAL);
  await s.run();
  const rdv = (await view(s, 'D1')).echeances.to_confirm.find((d) => d.date === '2026-12-09')!;
  assert.ok(rdv.source?.quote.includes('9 décembre 2026'), 'prémisse : la date figure dans la citation');
  assert.ok(!rdv.reliability.reasons.includes('date non écrite dans une pièce'), rdv.reliability.reasons.join(', '));
  assert.ok(rdv.reliability.reasons.includes('date proposée, non confirmée'));
  const found = [{ document_id: 'p1', page: 1, quote: 'q', status: 'found' as const }];
  assert.deepEqual(reliabilityOf(found, { kind: 'computed' }).reasons, ['date calculée, non écrite dans une pièce']);
  assert.deepEqual(reliabilityOf(found, { kind: 'mentioned' }), { level: 'elevee', reasons: [] });
});

/* ── B7 : PDF « Dates modifiables », sous-ligne repliée ─────────────────── */

test('B7 : la ligne « Extraite … · Date contredite … » reste dans la colonne Événement', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', 'L1', ['Courrier-bailleur-2026-10-12.pdf', 'Bail-commercial-2021.pdf']);
  await s.run();
  const v = await view(s, 'D1');
  assert.ok(v.dates.rows.some((r) => r.flag), 'prémisse : une date contredite');
  const calls = await drawnTexts(() => categoryFiles('dates', v, { assets: loadAssets(), demo: true }, new Date('2026-11-18T09:00:00Z')));
  const sub = calls.filter((c) => c.size === 8 && c.x === 56);
  assert.ok(sub.some((c) => /contredite/.test(c.text)));
  for (const c of sub) assert.ok(c.x + c.width <= 290, `« ${c.text} » déborde sur « Date retenue » (${Math.round(c.x + c.width)} pt)`);
});
