// Synthèse par le modèle : la grammaire envoyée au fournisseur doit rester compilable (recette 25/11/2026 :
// « The compiled grammar is too large » avec des champs nullable). Garde : aucun type multiple, aucun champ facultatif,
// et la conversion rend exactement la forme stockée.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { AnalysisOutputSchema, AnalysisWireSchema, fromWire, validate, type AnalysisWire } from '../supabase/functions/_shared/engine/schemas.ts';
import { createAnthropicProvider } from '../supabase/functions/_shared/engine/anthropic.ts';

function mesure(schema: unknown) {
  let unions = 0, facultatifs = 0;
  const walk = (n: any) => {
    if (!n || typeof n !== 'object') return;
    if (n.anyOf || Array.isArray(n.type)) unions++;
    if (n.type === 'object' && n.properties) { const r = new Set(n.required ?? []); for (const [k, v] of Object.entries(n.properties)) { if (!r.has(k)) facultatifs++; walk(v); } }
    if (n.items) walk(n.items);
    for (const x of n.anyOf ?? []) walk(x);
    for (const d of Object.values(n.$defs ?? {})) walk(d);
  };
  walk(schema);
  return { unions, facultatifs };
}

const wire: AnalysisWire = {
  situation: 'Au 25 novembre 2026, le bailleur réclame 3 480,00 €.', summary_short: 'Régularisation contestée.', summary_long: '…',
  parties: [{ name: 'SCI des Tilleuls', role: 'bailleur', evidence: [{ document_id: 'p1', page: 0, locator: '', quote: 'SCI des Tilleuls' }] }],
  facts: [], key_facts: [], amounts: [{ label: 'Régularisation', amount: 3480, currency: 'EUR', kind: 'claimed', evidence: [{ document_id: 'p1', page: 2, locator: 'ligne 4', quote: '3 480,00 €' }] }],
  deadlines: [{ title: 'Répondre', date: '', kind: 'mentioned', basis: 'courrier', priority: 'haute', owner: 'client', owner_name: '', evidence: [] }],
  contradictions: [], missing_items: [], milestones: [],
  primary_action: { label: 'Demander les justificatifs', owner: 'client', rationale: 'écart', due_date: '2027-01-15' },
  attention_points: [], next_actions: [], reminder_drafts: [{ audience: 'third_party', subject: 'Justificatifs', body: '…', suggested_date: '', recipient_hint: 'gestionnaire', condition: '', related_deadline: '' }],
};

test('grammaire de synthèse : aucun type multiple ni champ facultatif', () => {
  const f = zodOutputFormat(AnalysisWireSchema as never) as unknown as { schema: unknown };
  assert.deepEqual(mesure(f.schema), { unions: 0, facultatifs: 0 });
});

test('forme filaire → forme stockée : vides et pages 0 redeviennent null, valide pour le moteur', () => {
  const a = fromWire(wire);
  assert.equal(a.deadlines[0].date, null);
  assert.equal(a.deadlines[0].owner_name, null);
  assert.equal(a.parties[0].evidence[0].page, null);
  assert.equal(a.parties[0].evidence[0].locator, null);
  assert.equal(a.amounts[0].evidence[0].page, 2);
  assert.equal(a.primary_action.due_date, '2027-01-15');
  assert.equal(a.reminder_drafts[0].related_deadline, null);
  assert.ok(validate(AnalysisOutputSchema, a).ok);
});

test('fournisseur : la synthèse demande la forme filaire et rend la forme stockée', async () => {
  let schemaEnvoye: unknown = null;
  const client = { messages: { parse: async (req: { output_config: { format: { schema: unknown } } }) => {
    schemaEnvoye = req.output_config.format.schema;
    return { model: 'claude-sonnet-5-5', stop_reason: 'end_turn', parsed_output: wire, usage: { input_tokens: 10, output_tokens: 10 } };
  } } } as unknown as Anthropic;
  const p = createAnthropicProvider({ client, modelExtract: 'claude-sonnet-5-5', modelConsolidate: 'claude-sonnet-5-5' });
  const r = await p.consolidate({ today: '2026-11-25', title: 'D', typology: null, objective: null, pieces: [], events: [], total: 0, unreadable: [], others: [] } as never, 'B');
  assert.ok(r.ok);
  assert.equal(mesure(schemaEnvoye).unions, 0);
  if (r.ok) assert.equal(r.data.deadlines[0].date, null);
});
