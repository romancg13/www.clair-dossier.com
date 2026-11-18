/**
 * Sécurité côté navigateur : brouillons cloisonnés par compte (navigateur
 * partagé) et redirection `?next=` limitée au site.
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { blankDraft, listDrafts, loadDraft, removeDraft, saveDraft, setDraftOwner, type KeyValueStore } from '../src/lib/drafts.ts';
import { safeNextPath } from '../src/lib/safe-redirect.ts';

function memoryStore(): KeyValueStore & { size: () => number } {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => void m.set(k, v),
    removeItem: (k) => void m.delete(k),
    size: () => m.size,
  };
}

test('navigateur partagé : le compte B ne lit, ne liste ni ne supprime les brouillons du compte A', () => {
  const store = memoryStore();
  setDraftOwner('user-a');
  const a = { ...blankDraft(), typology: 'facture-paiement', title: 'Litige Société A', answers: { amount: '18000' } };
  saveDraft(a, store);
  assert.deepEqual(listDrafts(store).map((d) => d.id), [a.id]);

  setDraftOwner('user-b');
  assert.deepEqual(listDrafts(store), []);
  assert.equal(loadDraft(a.id, store), null);
  removeDraft(a.id, store);
  const b = { ...blankDraft(), title: 'Dossier B' };
  saveDraft(b, store);
  assert.deepEqual(listDrafts(store).map((d) => d.id), [b.id]);

  setDraftOwner('user-a');
  assert.equal(loadDraft(a.id, store)?.title, 'Litige Société A');
  assert.equal(loadDraft(b.id, store), null);
  assert.deepEqual(listDrafts(store).map((d) => d.id), [a.id]);
});

test('déconnecté : aucun brouillon lu ni écrit', () => {
  const store = memoryStore();
  setDraftOwner('user-a');
  const a = { ...blankDraft(), title: 'Brouillon A' };
  saveDraft(a, store);
  const before = store.size();

  setDraftOwner(null);
  assert.deepEqual(listDrafts(store), []);
  assert.equal(loadDraft(a.id, store), null);
  saveDraft({ ...blankDraft(), title: 'Anonyme' }, store);
  removeDraft(a.id, store);
  assert.equal(store.size(), before);
});

test('next : chemins du site acceptés tels quels', () => {
  for (const p of ['/compte', '/tarifs?formule=pro', '/dossier/nouveau?brouillon=abc#etape', '/compte/dossier/42']) {
    assert.equal(safeNextPath(p), p);
  }
});

test('next : tout ce qui sort du site retombe sur /compte', () => {
  for (const p of [
    null,
    undefined,
    '',
    'compte',
    'https://evil.example',
    'javascript:alert(1)',
    '//evil.example',
    '/\\evil.example',
    '/\t/evil.example',
    '/\n/evil.example',
    '\t//evil.example',
    '/\t\\evil.example',
  ]) {
    assert.equal(safeNextPath(p), '/compte', JSON.stringify(p));
  }
  assert.equal(safeNextPath('//evil.example', '/'), '/');
});
