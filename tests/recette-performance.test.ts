// Lot « performance et capacité » de la recette : chaque gain a ici un test qui échoue sans lui.
// Pile en mémoire (aucun réseau, aucun modèle) ; magasin de mesure : compte les accès et leur parallélisme.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RecetteStore } from '../recette/server/store.ts';
import { engineDeps, sha256 } from '../recette/server/engine-deps.ts';
import { drain, rulesProvider } from '../supabase/functions/_shared/engine/runner.ts';
import { MesureKv, type Nature } from '../scripts/recette/lib/kv-mesure.ts';
import { pileMesure } from '../scripts/recette/lib/pile-mesure.ts';
import { delaiSondage, SONDAGE } from '../src/recette/suivi.ts';
import { fixture, stack } from './helpers/recette.ts';

const LOT = '11111111-1111-4111-8111-111111111111';
const QUATRE = ['Courrier-bailleur-2026-10-12.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml', 'Avis-echeance-T4-2026.pdf'];

/** Pile dont le stockage est mesuré ; latence de 1 ms pour observer les accès menés de front. */
async function pile(pieces: { nom: string; contenu: Uint8Array }[]) {
  let t = Date.parse('2026-11-18T09:00:00Z');
  const clock = { now: () => new Date(t), advance: (ms: number) => (t += ms) };
  const kv = new MesureKv();
  const store = new RecetteStore(kv, clock.now);
  await store.putUser({ id: 'A', email: 'a@exemple.test', first_name: 'A', last_name: 'Test', company: null, role: 'client', pwd: { salt: '', hash: '' }, notifications: true, created_at: clock.now().toISOString() });
  await store.updateSub('A', (s) => ({ ...s, status: 'active', plan_id: 'essentiel', current_period_end: '2026-12-18T00:00:00Z' }));
  await store.createDossier({ id: 'D1', user_id: 'A', title: 'Régularisation de charges 2025', typology: 'facture-paiement', objective: null, review_mode: 'auto', sensitive: false, closed: false, deleted: false, created_at: clock.now().toISOString() });
  let i = 0;
  for (const p of pieces) {
    clock.advance(10);
    const id = `p${String(++i).padStart(3, '0')}`;
    await store.addPiece({ id, dossier_id: 'D1', user_id: 'A', lot_id: LOT, file_name: p.nom, mime: null, size_bytes: p.contenu.byteLength, sha256: await sha256(p.contenu), duplicate_of: null, created_at: clock.now().toISOString(), deleted_at: null }, p.contenu);
    await store.enqueue({ key: `x:${id}`, kind: 'extract', user_id: 'A', dossier_id: 'D1', piece_id: id });
  }
  const cles: { nature: Nature; cle: string }[] = [];
  kv.onAcces = (nature, cle) => void cles.push({ nature, cle });
  kv.raz();
  const executer = async () => {
    for (let k = 0; k < 40 && (await store.allOpenJobs()).some((j) => !j.key.startsWith('n:')); k++) {
      await drain(engineDeps(new RecetteStore(kv, clock.now), { ai: null, config: { consolidateDelayMs: 0 } }), 60_000, 400);
      clock.advance(3_000);
    }
  };
  return { kv, store, clock, cles, executer };
}
const texte = (s: string) => new TextEncoder().encode(s);

test('premier résultat utile : la situation est publiée AVANT la fabrication des documents', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  await s.depose('D1', 'A', LOT, QUATRE);
  const files = s.deps.renderer.files.bind(s.deps.renderer);
  const vueAuPremierDocument: (number | null)[] = [];
  s.deps.renderer.files = async (k, input, view) => {
    if (!vueAuPremierDocument.length) vueAuPremierDocument.push((await s.store.getView('D1'))?.revision ?? null);
    return files(k, input, view);
  };
  await s.run();
  assert.deepEqual(vueAuPremierDocument, [1], 'la vue (situation, dates, prochaine action) précède le premier document');
  // Rien de fictif : la vue publiée est celle de la révision analysée, et les six documents suivent.
  const pub = await s.store.getPublished('D1');
  assert.equal(Object.values(pub).filter((c) => c?.status === 'approved' && c.files.length).length, 6);
  assert.equal((await s.store.getView('D1'))?.status, 'approved');
});

test('publication groupée : les six rendus basculent en une écriture, fichiers écrits de front', async () => {
  const p = await pile(QUATRE.map((nom) => ({ nom, contenu: fixture(nom) })));
  p.kv.latence = { minMs: 1, maxMs: 1 };
  await p.executer();
  const pub = await p.store.getPublished('D1');
  assert.equal(Object.values(pub).filter((c) => c?.revision === 1 && c.files.length).length, 6, 'six catégories publiées');
  assert.equal(p.cles.filter((a) => a.nature === 'ecriture' && a.cle === 'published/D1.json').length, 1, 'une seule bascule de pointeurs (six avant)');
  const fichiers = p.cles.filter((a) => a.nature === 'octetsEcrits' && a.cle.startsWith('out/')).length;
  assert.ok(fichiers >= 6, `${fichiers} fichiers écrits`);
  assert.ok(p.kv.maxEnVol >= fichiers, `fichiers écrits de front (${p.kv.maxEnVol} accès simultanés pour ${fichiers} fichiers)`);
  // Reprise sans changement : rien n'est réécrit (idempotence de la publication conservée).
  const avant = p.cles.length;
  await p.store.enqueue({ key: 'r:D1', kind: 'render', user_id: 'A', dossier_id: 'D1', piece_id: null });
  await p.executer();
  assert.equal(p.cles.slice(avant).filter((a) => a.nature === 'octetsEcrits').length, 0, 'aucun fichier réécrit');
  assert.equal(p.cles.slice(avant).filter((a) => a.nature === 'ecriture' && a.cle === 'published/D1.json').length, 0, 'pointeurs inchangés');
});

test('publication groupée : une révision plus récente déjà publiée n’est jamais écrasée', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  const f = { name: 'Resume-r2.pdf', mime: 'application/pdf', bytes: texte('r2') };
  await s.store.publishCategories('D1', 'A', 2, [{ category: 'resume', dataHash: 'b'.repeat(64), files: [f] }], 'approved');
  await s.store.publishCategories('D1', 'A', 1, [{ category: 'resume', dataHash: 'a'.repeat(64), files: [{ ...f, name: 'Resume-r1.pdf' }] }, { category: 'dates', dataHash: 'c'.repeat(64), files: [{ ...f, name: 'Dates-r1.pdf' }] }], 'approved');
  const pub = await s.store.getPublished('D1');
  assert.equal(pub.resume?.revision, 2, 'catégorie plus récente conservée');
  assert.equal(pub.dates?.revision, 1, 'autre catégorie publiée');
  await s.store.publishCategories('D1', 'A', 3, [{ category: 'resume', dataHash: 'd'.repeat(64), files: [f] }], 'approved');
  assert.deepEqual((await s.store.getPublished('D1')).resume?.previous.map((x) => x.revision), [2], 'version précédente conservée');
});

test('lectures en parallèle : les fiches d’un dossier sont lues de front, par paquets bornés', async () => {
  const p = await pile(Array.from({ length: 40 }, (_, i) => ({ nom: `note-${i}.txt`, contenu: texte(`Note ${i} du 0${(i % 9) + 1}/10/2026.`) })));
  p.kv.latence = { minMs: 1, maxMs: 1 };
  p.kv.raz();
  const pieces = await p.store.listPieces('D1');
  assert.equal(pieces.length, 40);
  assert.deepEqual(pieces.map((x) => x.id), [...pieces.map((x) => x.id)].sort(), 'ordre de dépôt conservé');
  assert.ok(p.kv.maxEnVol >= 8, `lectures menées de front (${p.kv.maxEnVol} simultanées ; 1 avant)`);
  assert.ok(p.kv.maxEnVol <= 16, 'parallélisme borné (16 lectures au plus)');
});

test('gros lot : un exécuteur ne relit pas tout le dossier à chaque pièce (N lectures de fiches, pas N × N)', async () => {
  const N = 30;
  const pieces = Array.from({ length: N }, (_, i) => ({ nom: `courrier-${i}.txt`, contenu: texte(`Courrier n° ${i} du 12/10/2026. Montant réclamé : ${1000 + i},00 euros.`) }));
  pieces.push({ nom: 'copie-du-courrier-3.txt', contenu: pieces[3].contenu }); // doublon exact
  const p = await pile(pieces);
  // Extractions seules (un exécuteur) : les consolidations sont laissées de côté.
  const deps = engineDeps(new RecetteStore(p.kv, p.clock.now), { ai: null, config: { consolidateDelayMs: 600_000 } });
  const r = await drain(deps, 60_000, 400);
  assert.equal(r.filter((x) => x.kind === 'extract' && x.outcome === 'done').length, N + 1);
  const fiches = p.cles.filter((a) => a.nature === 'lecture' && a.cle.startsWith('pieces/D1/')).length;
  assert.ok(fiches <= 3 * (N + 1), `${fiches} lectures de fiches pour ${N + 1} pièces (${(N + 1) * (N + 1)} avant)`);
  // La détection des doublons reste exacte : la copie est rattachée à l'original, jamais lue deux fois.
  const all = await p.store.listPieces('D1');
  assert.equal(all.find((x) => x.file_name === 'copie-du-courrier-3.txt')?.duplicate_of, 'p004');
  assert.equal(all.filter((x) => x.duplicate_of).length, 1);
  assert.equal(await p.store.getExtraction('p031'), null, 'aucune extraction pour le doublon');
});

test('gros lot : doublon rattaché par un AUTRE exécuteur entre-temps — état relu, jamais deviné', async () => {
  const contenu = texte('Relevé de charges 2025. Total : 4 200,00 euros.');
  const p = await pile([{ nom: 'a.txt', contenu }, { nom: 'b.txt', contenu }, { nom: 'c.txt', contenu }]);
  const s1 = new RecetteStore(p.kv, p.clock.now);
  // L'exécuteur 1 connaît déjà les trois pièces…
  assert.equal((await s1.piecesOfSameContent('D1', 'p001')).same.length, 3);
  // … un autre exécuteur rattache b à a…
  await new RecetteStore(p.kv, p.clock.now).markDuplicate('p002', 'p001');
  // … l'exécuteur 1 le voit à l'appel suivant (fiches de même empreinte relues).
  const r = await s1.piecesOfSameContent('D1', 'p003');
  assert.equal(r.same.find((x) => x.id === 'p002')?.duplicate_of, 'p001');
  assert.equal(r.piece?.id, 'p003');
  assert.deepEqual(await s1.piecesOfSameContent('D1', 'inconnue'), { piece: null, same: [] });
});

test('travail remis en file : la relance demandée pendant son exécution n’entraîne pas une exécution de plus', async () => {
  const s = stack();
  await s.user('A');
  await s.dossier('D1', 'A');
  const job = { key: 'c:D1', kind: 'consolidate' as const, user_id: 'A', dossier_id: 'D1', piece_id: null };
  await s.store.enqueue(job);
  const j1 = (await s.store.claim('w1', 60_000))!;
  assert.equal(await s.store.enqueue(job), 'rearmed'); // relance demandée pendant l'exécution
  await s.store.complete(j1, { status: 'queued', delayMs: 1_000, countAttempt: false, error: 'extractions en cours' });
  s.clock.advance(1_500);
  const j2 = (await s.store.claim('w1', 60_000))!;
  assert.equal(j2.id, j1.id);
  await s.store.complete(j2, { status: 'done', error: null });
  assert.deepEqual(await s.store.allOpenJobs(), [], 'terminé : pas de troisième passage (remis en file pour 5 s avant)');
  // Relance demandée pendant une exécution qui ABOUTIT : toujours rejouée (comportement conservé).
  await s.store.enqueue(job);
  const j3 = (await s.store.claim('w1', 60_000))!;
  await s.store.enqueue(job);
  await s.store.complete(j3, { status: 'done', error: null });
  assert.deepEqual((await s.store.allOpenJobs()).map((j) => j.status), ['queued'], 'relance prise en compte');
});

test('attentes fixes : réduites à 1 s en lecture par règles, inchangées dès qu’un modèle est appelé', () => {
  const s = stack();
  const regles = engineDeps(s.store, { ai: null }).config;
  assert.deepEqual([regles.consolidateDelayMs, regles.extractionWaitMs], [1_000, 1_000]);
  const ia = engineDeps(s.store, { ai: { ...rulesProvider, name: 'anthropic' } }).config;
  assert.deepEqual([ia.consolidateDelayMs, ia.extractionWaitMs], [2_000, 3_000], 'avec modèle : attente de stabilisation du lot conservée (appels payants)');
});

test('écran du dossier : lectures indépendantes de front, aucune relecture pour le statut', async () => {
  const pm = pileMesure();
  const c = pm.client();
  await c.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const id = (await c.json('GET', '/api/dossiers')).dossiers[0].id as string;
  const f = new FormData();
  for (const n of QUATRE) f.append('fichiers', new File([fixture(n)], n));
  assert.equal((await c.call('POST', `/api/dossiers/${id}/pieces`, f)).status, 201);
  await pm.repos();
  for (let i = 0; i < 20 && (await c.json('GET', `/api/dossiers/${id}`)).statut.etat === 'en_cours'; i++) {
    await new Promise((r) => setTimeout(r, 300));
    await pm.repos();
  }
  const cles: string[] = [];
  pm.kv.onAcces = (nature, cle) => void (nature === 'lecture' && cles.push(cle));
  pm.kv.latence = { minMs: 1, maxMs: 1 };
  pm.kv.raz();
  const d = await c.json('GET', `/api/dossiers/${id}`);
  assert.equal(d.statut.etat, 'pret');
  assert.equal(d.statut.pieces, 4);
  assert.equal(d.pieces.length, 4);
  assert.equal(d.rendus.filter((r: { fichiers: unknown[] }) => r.fichiers.length).length, 6);
  const une = (prefixe: string) => cles.filter((k) => k.startsWith(prefixe)).length;
  assert.equal(une('views/'), 1, 'vue lue une fois (deux avant)');
  assert.equal(une('queue.json'), 1, 'file lue une fois (deux avant)');
  assert.equal(une(`pieces/${id}/`), 4, 'fiches lues une fois (deux avant)');
  assert.ok(pm.kv.n.lecture <= 20, `${pm.kv.n.lecture} lectures pour l’écran du dossier (30 avant)`);
  assert.ok(pm.kv.maxEnVol >= 6, `lectures menées de front (${pm.kv.maxEnVol} simultanées)`);

  // Liste des dossiers : pièces comptées sans lire leurs fiches, vue lue une fois par dossier.
  cles.length = 0;
  pm.kv.raz();
  const l = await c.json('GET', '/api/dossiers');
  assert.equal(l.dossiers[0].pieces, 4);
  assert.equal(l.dossiers[0].etat, 'pret');
  assert.equal(typeof l.dossiers[0].action, 'string');
  assert.equal(l.dossiers[0].vue, undefined, 'la vue ne sort pas dans la liste');
  assert.equal(une(`pieces/${id}/`), 0, 'aucune fiche de pièce lue pour la liste');
  assert.equal(une('views/'), 1, 'vue lue une fois par dossier');
});

test('dépôt confirmé : le traitement démarre aussitôt, sans attendre ni consultation ni planificateur', async () => {
  const pm = pileMesure();
  const c = pm.client();
  await c.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const id = (await c.json('GET', '/api/dossiers')).dossiers[0].id as string;
  const f = new FormData();
  f.append('fichiers', new File([fixture('Courrier-bailleur-2026-10-12.pdf')], 'Courrier-bailleur-2026-10-12.pdf'));
  let extraction = 0;
  const t0 = Date.now();
  pm.kv.onAcces = (nature, cle) => void (nature === 'ecriture' && cle.startsWith('extractions/') && !extraction && (extraction = Date.now() - t0));
  assert.equal((await c.call('POST', `/api/dossiers/${id}/pieces`, f)).status, 201);
  assert.ok(pm.enFond() > 0, 'exécuteur lancé par le dépôt lui-même');
  await pm.repos(); // aucune consultation, aucun appel du planificateur
  assert.ok(extraction > 0, 'pièce lue');
  assert.equal((await pm.env().store.getView(id))?.revision, 1, 'premier résultat publié sans autre déclencheur');
});

test('suivi côté navigateur : cadence rapprochée au début, espacée ensuite', () => {
  assert.equal(delaiSondage(0), 2000);
  assert.equal(delaiSondage(SONDAGE.rapideJusquA - 1), 2000);
  assert.equal(delaiSondage(SONDAGE.rapideJusquA), 4000);
  assert.equal(delaiSondage(SONDAGE.moyenJusquA), 8000);
  assert.ok(delaiSondage(0) < 4000, 'plus rapproché que les 4 s fixes d’avant');
});

test('compte d’administration : vérifié une fois par instance, pas à chaque requête', async () => {
  const avant = { pwd: process.env.RECETTE_ADMIN_PASSWORD, blob: process.env.BLOB_READ_WRITE_TOKEN, store: process.env.BLOB_STORE_ID };
  delete process.env.BLOB_READ_WRITE_TOKEN;
  delete process.env.BLOB_STORE_ID;
  process.env.RECETTE_ADMIN_PASSWORD = 'mot-de-passe-de-test-0123456789';
  try {
    const { apiEnv, storage } = await import('../recette/server/runtime.ts');
    const kv = storage();
    assert.equal(kv.durable, false, 'magasin en mémoire');
    let verifications = 0;
    const get = kv.getJson.bind(kv);
    kv.getJson = ((k: string, o?: { fresh?: boolean }) => {
      if (k.startsWith('emails/')) verifications++;
      return get(k, o);
    }) as typeof kv.getJson;
    for (let i = 0; i < 3; i++) await apiEnv('http://recette.test', () => undefined);
    assert.equal(verifications, 1, 'une vérification pour trois requêtes');
    const e = await apiEnv('http://recette.test', () => undefined);
    const idAdmin = await e.store.userIdByEmailHash((await import('../recette/server/security.ts')).emailKey('admin@recette.clair-dossier.example'));
    assert.equal((await e.store.getUser(idAdmin!))?.role, 'admin', 'compte d’administration bien créé');
  } finally {
    for (const [k, v] of [['RECETTE_ADMIN_PASSWORD', avant.pwd], ['BLOB_READ_WRITE_TOKEN', avant.blob], ['BLOB_STORE_ID', avant.store]] as const) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  }
});

/* ── Exécuteur : pas de relances à vide ────────────────────────────────── */

const notes = (n: number) => Array.from({ length: n }, (_, i) => ({ nom: `note-${i}.txt`, contenu: texte(`Note n° ${i} du 12/10/2026. Montant : ${500 + i},00 euros.`) }));

async function deposeEnRafale(pm: ReturnType<typeof pileMesure>, n: number, total = n) {
  const c = pm.client();
  await c.call('POST', '/api/demo/demarrer', { scenario: 'a' });
  const id = (await c.json('GET', '/api/dossiers')).dossiers[0].id as string;
  const lot = crypto.randomUUID();
  // Comme l'interface : un fichier par requête, 4 envois de front.
  const file = notes(n);
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let p = file.shift(); p; p = file.shift()) {
        const f = new FormData();
        f.append('lot', lot);
        f.append('total', String(total));
        f.append('fichiers', new File([p.contenu], p.nom));
        assert.equal((await c.call('POST', `/api/dossiers/${id}/pieces`, f)).status, 201);
      }
    }),
  );
  return { c, id, lot };
}

test('gros lot : les dépôts ne lancent pas chacun une chaîne d’exécuteurs qui relit toute la file', async () => {
  const N = 24;
  const pm = pileMesure({ latence: { minMs: 2, maxMs: 4 } });
  let travauxLus = 0;
  pm.kv.onAcces = (nature, cle) => void (nature === 'lecture' && cle.startsWith('jobs/') && travauxLus++);
  const { c, id } = await deposeEnRafale(pm, N);
  await pm.repos(); // aucune consultation : le traitement va à son terme seul
  const d = await c.json('GET', `/api/dossiers/${id}`);
  assert.equal(d.pieces.filter((p: { lecture: { statut: string } | null }) => p.lecture?.statut === 'ok').length, N, 'toutes les pièces lues');
  assert.equal(d.rendus.filter((r: { fichiers: unknown[] }) => r.fichiers.length).length, 6, 'six rendus publiés sans consultation');
  console.log(`# mesure exécuteur ${JSON.stringify({ pieces: N, ...pm.compteurs, travauxLus })}`);
  assert.ok(pm.compteurs.relances <= N, `${pm.compteurs.relances} relances de l’exécuteur pour ${N} pièces`);
  assert.ok(travauxLus <= 40 * N, `${travauxLus} lectures de travaux pour ${N} pièces`);
});

test('exécuteur en pause : aucune relance en boucle', async () => {
  // Garde-fou du test : une boucle de relances (comportement d'avant) est coupée à 50 au lieu de tourner sans fin.
  const pm = pileMesure({ config: { paused: true }, maxRelances: 50 });
  const { c, id } = await deposeEnRafale(pm, 3);
  await pm.repos();
  assert.equal(pm.compteurs.relances, 0, 'aucune relance tant que l’exécuteur est en pause');
  const d = await c.json('GET', `/api/dossiers/${id}`);
  assert.equal(d.pieces.length, 3, 'pièces conservées');
  assert.equal(d.pieces.filter((p: { lecture: unknown }) => p.lecture).length, 0, 'aucune lecture pendant la pause');
  await pm.repos();
});

test('exécuteur interrompu : ses travaux sont repris à la fin du bail, sans consultation ni planificateur', async () => {
  const pm = pileMesure();
  const { c, id } = await deposeEnRafale(pm, 0);
  // Deux pièces « en cours » chez un exécuteur disparu (bail court), une troisième prête : rien ne peut être pris.
  const store = pm.env().store;
  const u = (await c.json('GET', '/api/moi')).user.id as string;
  let k = 0;
  for (const p of notes(3)) {
    const pid = `00000000-0000-4000-8000-00000000000${++k}`;
    await store.addPiece({ id: pid, dossier_id: id, user_id: u, lot_id: LOT, file_name: p.nom, mime: null, size_bytes: p.contenu.byteLength, sha256: await sha256(p.contenu), duplicate_of: null, created_at: new Date(Date.now() + k).toISOString(), deleted_at: null }, p.contenu);
    await store.enqueue({ key: `x:${pid}`, kind: 'extract', user_id: u, dossier_id: id, piece_id: pid });
  }
  assert.ok(await store.claim('executeur-disparu', 700));
  assert.ok(await store.claim('executeur-disparu', 700));
  // Un passage de l'exécuteur (comme après un dépôt) : rien à prendre tout de suite.
  await pm.env().kickWorker();
  await pm.repos();
  const d = await c.json('GET', `/api/dossiers/${id}`);
  assert.equal(d.pieces.filter((p: { lecture: { statut: string } | null }) => p.lecture?.statut === 'ok').length, 3, 'les trois pièces sont lues, dont les deux abandonnées');
  assert.ok(d.vue, 'résultat publié');
  assert.ok(pm.compteurs.relances <= 6, `${pm.compteurs.relances} relances (une veille, pas une boucle)`);
});

test('gros dossier : la comparaison des montants ne remet pas en forme chaque montant à chaque paire', async () => {
  // 40 courriers réclamant chacun un montant différent pour le même objet : chaque paire est un écart à relever.
  const N = 40;
  const p = await pile(Array.from({ length: N }, (_, i) => ({ nom: `courrier-${i}.txt`, contenu: texte(`Courrier du bailleur du 12/10/2026.\n\nObjet : régularisation de charges 2025.\n\nMontant réclamé : ${1200 + i * 7},00 euros au titre des charges 2025.`) })));
  const natif = Number.prototype.toLocaleString;
  let misesEnForme = 0;
  Number.prototype.toLocaleString = function (this: number, ...a: Parameters<typeof natif>) {
    misesEnForme++;
    return natif.apply(this, a);
  } as typeof natif;
  try {
    await drain(engineDeps(new RecetteStore(p.kv, p.clock.now), { ai: null, config: { consolidateDelayMs: 0 } }), 120_000, 400);
  } finally {
    Number.prototype.toLocaleString = natif;
  }
  const a = await p.store.lastAnalysis('D1');
  const ecarts = a!.data.contradictions.filter((c) => c.kind === 'amount').length;
  console.log(`# mesure montants ${JSON.stringify({ pieces: N, ecarts, misesEnForme })}`);
  assert.ok(ecarts > N, `${ecarts} écarts de montants relevés`);
  // Avant : deux mises en forme par écart déjà relevé, pour chaque paire (croissance en N puissance 4).
  assert.ok(misesEnForme < 40 * ecarts, `${misesEnForme} mises en forme de montants pour ${ecarts} écarts`);
});

test('lot de 250 fichiers : annoncé en entier, donc notifié seulement une fois complet (plafonné à 200 avant)', async () => {
  const pm = pileMesure({ config: { paused: true } });
  const { c, id, lot } = await deposeEnRafale(pm, 2, 250);
  assert.equal((await pm.kv.inner.getJson<{ total: number }>(`lots/${id}/${lot}.json`))?.value.total, 250);
  // Une valeur absurde reste bornée.
  const f = new FormData();
  const autre = crypto.randomUUID();
  f.append('lot', autre);
  f.append('total', '999999999');
  f.append('fichiers', new File([texte('Note du 12/10/2026.')], 'n.txt'));
  assert.equal((await c.call('POST', `/api/dossiers/${id}/pieces`, f)).status, 201);
  assert.equal((await pm.kv.inner.getJson<{ total: number }>(`lots/${id}/${autre}.json`))?.value.total, 1000);
  await pm.repos();
});

test('veille de la file : un seul veilleur à la fois, relève possible à l’échéance', async () => {
  const s = stack();
  const t = s.clock.now().getTime();
  assert.equal(await s.store.watchHeld(), false);
  const [a, b] = await Promise.all([s.store.claimWatch(t + 5_000), new RecetteStore(s.kv, s.clock.now).claimWatch(t + 5_000)]);
  assert.equal(Number(a) + Number(b), 1, 'un seul veilleur');
  assert.equal(await s.store.watchHeld(), true);
  assert.equal(await s.store.claimWatch(t + 9_000), false);
  s.clock.advance(5_001);
  assert.equal(await s.store.watchHeld(), false, 'veille éteinte à son échéance');
  assert.equal(await s.store.claimWatch(t + 20_000), true, 'relève');
});
