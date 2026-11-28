import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_ASSISTANT_MESSAGE, assistantSettings, modelUsable, parseAssistantRequest } from '../supabase/functions/_shared/intelligence/assistant-request.ts';
import { DEFAULT_MODELS } from '../supabase/functions/_shared/intelligence/assistant-model.ts';

const ID = '3f2b8c1e-5d4a-4b6c-9e8f-0a1b2c3d4e5f';

test('requête assistant : corps valide, message nettoyé et borné, clés de documents filtrées', () => {
  const r = parseAssistantRequest({ dossier_id: ID.toUpperCase(), message: `  Résume\u0000 ce dossier  ${'x'.repeat(5000)}`, available: ['resume', 'inconnu', 'resume', 3] });
  assert.ok(r);
  assert.equal(r.dossierId, ID);
  assert.ok(r.message.startsWith('Résume  ce dossier'));
  assert.equal(r.message.length, MAX_ASSISTANT_MESSAGE);
  assert.deepEqual(r.available, ['resume']);
});

test('requête assistant : refus des corps invalides', () => {
  for (const body of [null, 'texte', {}, { dossier_id: 'pas-un-uuid', message: 'x' }, { dossier_id: ID, message: '   ' }, { dossier_id: ID, message: 42 }]) {
    assert.equal(parseAssistantRequest(body), null, JSON.stringify(body));
  }
});

test('réglages assistant : aucun plafond par défaut, modèle utilisable seulement si tout est présent', () => {
  const env = (o: Record<string, string>) => (n: string) => o[n];
  const vide = assistantSettings(env({}));
  assert.equal(vide.capGlobalMicro, null);
  assert.equal(modelUsable(vide), false);
  assert.deepEqual(vide.models, DEFAULT_MODELS);
  const complet = { ANTHROPIC_API_KEY: 'k', ASSISTANT_BUDGET_MICRO_USD_GLOBAL_MONTH: '5000000', ASSISTANT_BUDGET_MICRO_USD_PER_USER_MONTH: '1000000' };
  assert.equal(modelUsable(assistantSettings(env(complet))), true);
  assert.equal(modelUsable(assistantSettings(env({ ...complet, ASSISTANT_PAUSED: '1' }))), false, 'pause');
  assert.equal(modelUsable(assistantSettings(env({ ...complet, ASSISTANT_BUDGET_MICRO_USD_PER_USER_MONTH: '-3' }))), false, 'plafond invalide');
  assert.equal(modelUsable(assistantSettings(env({ ...complet, ANTHROPIC_API_KEY: '' }))), false, 'sans clé');
  assert.equal(assistantSettings(env({ ASSISTANT_MODEL_SIMPLE: 'claude-haiku-5-5' })).models.simple, 'claude-haiku-5-5');
});
