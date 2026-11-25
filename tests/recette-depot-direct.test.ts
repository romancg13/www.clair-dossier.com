// Dépôt direct (gros fichiers) : autorisation courte délivrée après contrôle des droits,
// chemin imposé par le serveur, confirmation idempotente, isolement entre comptes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MemoryKv } from '../recette/server/kv.ts';
import { RecetteStore } from '../recette/server/store.ts';
import { engineDeps } from '../recette/server/engine-deps.ts';
import { handle, type ApiEnv } from '../recette/server/api.ts';
import { fixture } from './helpers/recette.ts';

/** Stockage de test sachant « recevoir en direct » : le jeton est factice, le dépôt est simulé par putBytes. */
class DirectKv extends MemoryKv {
  issued: { key: string; maxBytes: number }[] = [];
  async directUpload(key: string, opts: { maxBytes: number; validMs: number }) {
    this.issued.push({ key, maxBytes: opts.maxBytes });
    return { pathname: key, token: 'jeton-de-test' };
  }
}
function setup(kv: MemoryKv = new DirectKv()) {
  const store = new RecetteStore(kv);
  const pending: Promise<unknown>[] = [];
  const e = { store, deps: async () => engineDeps(store, { ai: null, config: { consolidateDelayMs: 0 } }), secret: 'secret-de-test-0123456789', workerToken: 'w', cronSecret: 'c', siteUrl: 'http://127.0.0.1', waitUntil: (p: Promise<unknown>) => void pending.push(p.catch(() => undefined)) } as unknown as ApiEnv;
  const client = () => {
    let cookie = '';
    return async (method: string, path: string, body?: unknown) => {
      const r = await handle(e, new Request(`https://recette.test${path}`, { method, headers: { 'x-clairdossier': '1', cookie, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }));
      const sc = r.headers.get('set-cookie');
      if (sc) cookie = sc.split(';')[0];
      return r;
    };
  };
  const settle = async () => {
    while (pending.length) await pending.shift();
  };
  return { kv: kv as DirectKv, store, client, settle };
}
const dossierDe = async (call: ReturnType<ReturnType<typeof setup>['client']>, scenario: string) => {
  await call('POST', '/api/demo/demarrer', { scenario });
  return (await (await call('GET', '/api/dossiers')).json()).dossiers[0].id as string;
};

test('dépôt direct : autorisé, déposé, confirmé une seule fois (rejeu sans doublon), traité', async () => {
  const { kv, store, client, settle } = setup();
  const a = client();
  const dA = await dossierDe(a, 'a');
  const bytes = fixture('Courrier-bailleur-2026-10-12.pdf');
  const r = await a('POST', `/api/dossiers/${dA}/pieces/autoriser`, { nom: '../../Courrier.pdf', taille: bytes.byteLength, type: 'application/pdf' });
  assert.equal(r.status, 201);
  const aut = await r.json();
  assert.equal(aut.mode, 'direct');
  // Chemin imposé par le serveur, dans l'espace du compte ; taille plafonnée à la taille annoncée.
  assert.match(aut.pathname, new RegExp(`^depots/[0-9a-f-]{36}/${dA}/${aut.id}$`));
  assert.equal(kv.issued[0].maxBytes, bytes.byteLength);
  assert.equal((await store.kv.list('pieces/')).length, 0, 'rien n’est enregistré avant la confirmation');
  // Confirmation avant l'arrivée du fichier : à rejouer, rien n'est créé.
  assert.equal((await a('POST', `/api/dossiers/${dA}/pieces/confirmer`, { id: aut.id })).status, 409);
  await kv.putBytes(aut.pathname, bytes, 'application/pdf');
  const c1 = await a('POST', `/api/dossiers/${dA}/pieces/confirmer`, { id: aut.id });
  assert.equal(c1.status, 201);
  assert.equal((await c1.json()).pieces[0].nom, '.._.._Courrier.pdf');
  const c2 = await a('POST', `/api/dossiers/${dA}/pieces/confirmer`, { id: aut.id });
  assert.equal(c2.status, 200, 'rejeu : même pièce, pas de doublon');
  assert.equal((await store.listPieces(dA)).filter((p) => p.id === aut.id).length, 1);
  assert.equal((await store.kv.list('depots/')).length, 0, 'fichier temporaire retiré');
  await settle();
  assert.notEqual((await (await a('GET', `/api/dossiers/${dA}`)).json()).statut.etat, 'vide');
});

test('dépôt direct : refus AVANT toute autorisation (abonnement, taille), rien n’est émis', async () => {
  const { kv, client } = setup();
  const s = client();
  await s('POST', '/api/demo/demarrer', { scenario: 'sans-abonnement' });
  const a = client();
  const dA = await dossierDe(a, 'a');
  // Sans abonnement : le dossier d'autrui est introuvable, et aucun jeton n'est émis.
  assert.ok([402, 404].includes((await s('POST', `/api/dossiers/${dA}/pieces/autoriser`, { nom: 'x.pdf', taille: 10 })).status));
  assert.equal((await a('POST', `/api/dossiers/${dA}/pieces/autoriser`, { nom: 'x.pdf', taille: 26 * 1024 * 1024 })).status, 413);
  assert.equal((await a('POST', `/api/dossiers/${dA}/pieces/autoriser`, { nom: '', taille: 10 })).status, 400);
  assert.equal(kv.issued.length, 0);
});

test('dépôt direct : isolement A/B et fichier plus gros qu’annoncé écarté', async () => {
  const { kv, store, client } = setup();
  const a = client(), b = client();
  const dA = await dossierDe(a, 'a');
  const dB = await dossierDe(b, 'b');
  const aut = await (await a('POST', `/api/dossiers/${dA}/pieces/autoriser`, { nom: 'a.pdf', taille: 100 })).json();
  await kv.putBytes(aut.pathname, new Uint8Array(100), 'application/pdf');
  // B ne peut confirmer le dépôt de A ni sur le dossier de A (introuvable) ni sur le sien.
  assert.equal((await b('POST', `/api/dossiers/${dA}/pieces/confirmer`, { id: aut.id })).status, 404);
  assert.equal((await b('POST', `/api/dossiers/${dB}/pieces/confirmer`, { id: aut.id })).status, 404);
  assert.equal((await store.listPieces(dB)).some((p) => p.id === aut.id), false);
  // Fichier reçu plus gros que la taille annoncée : écarté, jamais enregistré.
  const gros = await (await a('POST', `/api/dossiers/${dA}/pieces/autoriser`, { nom: 'g.pdf', taille: 50 })).json();
  await kv.putBytes(gros.pathname, new Uint8Array(500), 'application/pdf');
  assert.equal((await a('POST', `/api/dossiers/${dA}/pieces/confirmer`, { id: gros.id })).status, 413);
  assert.equal((await store.listPieces(dA)).some((p) => p.id === gros.id), false);
  assert.equal(await kv.getBytes(gros.pathname), null);
});

test('stockage sans dépôt direct (tests) : le serveur le dit, le dépôt classique reste la voie', async () => {
  const { client } = setup(new MemoryKv());
  const a = client();
  const dA = await dossierDe(a, 'a');
  const r = await (await a('POST', `/api/dossiers/${dA}/pieces/autoriser`, { nom: 'a.pdf', taille: 100 })).json();
  assert.equal(r.mode, 'serveur');
});
