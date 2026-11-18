/**
 * Paiements gelés (décision du propriétaire, 2026-11-04) : aucun changement de
 * Stripe, tarifs, abonnements, webhooks ni liens de paiement sans décision
 * explicite. Ce test échoue si un fichier dédié aux paiements change ou si la
 * liste des liens de paiement évolue. Mettre à jour tests/paiements-geles.json
 * UNIQUEMENT sur instruction écrite du propriétaire.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const gel = JSON.parse(readFileSync(new URL('./paiements-geles.json', import.meta.url), 'utf8')) as {
  fichiers: Record<string, string>;
  liensStripe: string[];
};
const root = new URL('../', import.meta.url);

test('fichiers de paiement strictement inchangés', () => {
  for (const [file, attendu] of Object.entries(gel.fichiers)) {
    const reel = createHash('sha256').update(readFileSync(new URL(file, root))).digest('hex');
    assert.equal(reel, attendu, `paiements gelés : ${file} a été modifié`);
  }
});

test('liens de paiement Stripe identiques (comportement)', () => {
  const pricing = readFileSync(new URL('src/data/pricing.ts', root), 'utf8');
  const liens = [...new Set(pricing.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g) ?? [])].sort();
  assert.deepEqual(liens, gel.liensStripe);
});
