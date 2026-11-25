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

test('fournisseur : synthèse rendue par un outil non strict, validée strictement, sans grammaire ; sortie absente ou non conforme = nouvelle tentative', async () => {
  const envois: { system: string; output_config?: unknown; tools: { name: string; strict?: boolean; input_schema: unknown }[]; tool_choice: { type: string } }[] = [];
  let contenu: unknown[] = [{ type: 'tool_use', id: 't1', name: 'enregistrer_synthese', input: wire }];
  const client = { messages: {
    create: async (req: (typeof envois)[number]) => {
      envois.push(req);
      return { model: 'claude-sonnet-5-5', stop_reason: 'tool_use', content: contenu, usage: { input_tokens: 10, output_tokens: 10 } };
    },
    parse: async () => { throw new Error('la synthèse ne doit pas passer par une grammaire'); },
  } } as unknown as Anthropic;
  const p = createAnthropicProvider({ client, modelExtract: 'claude-sonnet-5-5', modelConsolidate: 'claude-sonnet-5-5' });
  const entree = { today: '2026-11-25', title: 'D', typology: null, objective: null, pieces: [], events: [], total: 0, unreadable: [], others: [] } as never;
  const r = await p.consolidate(entree, 'B');
  assert.ok(r.ok);
  if (r.ok) assert.equal(r.data.deadlines[0].date, null);
  assert.equal(envois[0].output_config, undefined, 'aucune grammaire de sortie');
  assert.equal(envois[0].tools[0].strict, undefined, 'outil non strict (aucune grammaire)');
  assert.equal(envois[0].tool_choice.type, 'auto', 'choix forcé refusé par les modèles récents');
  assert.equal(mesure(envois[0].tools[0].input_schema).unions, 0);
  contenu = [{ type: 'tool_use', id: 't2', name: 'enregistrer_synthese', input: { situation: 12 } }];
  const r2 = await p.consolidate(entree, 'B');
  assert.ok(!r2.ok && r2.kind === 'invalid' && r2.retryable);
  contenu = [{ type: 'text', text: 'Voici la synthèse…' }];
  const r3 = await p.consolidate(entree, 'B');
  assert.ok(!r3.ok && r3.kind === 'invalid');
});
