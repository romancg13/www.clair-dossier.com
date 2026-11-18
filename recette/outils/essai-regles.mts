import { readFileSync } from 'node:fs';
import { pdfText } from '../server/pdf-text.ts';
import { preparePiece } from '../../supabase/functions/_shared/engine/reading.ts';
import { extractByRules, consolidateByRules } from '../../supabase/functions/_shared/engine/rules.ts';
import { buildChronology } from '../../supabase/functions/_shared/analysis-model.ts';
const D = '/home/user/www.clair-dossier.com/recette/fixtures/pieces/';
const files = process.argv.slice(2);
const pieces = []; const others = [];
for (const f of files) {
  const r = await preparePiece(new Uint8Array(readFileSync(D + f)), f, null, { pdfText });
  if (!r.ok) { console.log('ILLISIBLE', f, r.reason); continue; }
  if (r.piece.needsVision) { console.log('VISION', f); others.push({ document_id: f, file_name: f }); continue; }
  const x = extractByRules(r.piece, f);
  pieces.push({ document_id: f, file_name: f, data: x });
  console.log('==', f, x.document_type, '|', x.summary);
  for (const d of x.dates) console.log('  date', d.date, d.kind, '|', d.label);
  for (const a of x.amounts) console.log('  €', a.amount, a.kind, '|', a.label);
  for (const r2 of x.referenced_documents) console.log('  cite', r2.short_label, r2.date);
  for (const p of x.parties) console.log('  partie', p.name, '—', p.role);
}
const events = buildChronology(pieces.map((p) => ({ document_id: p.document_id, data: p.data as never })));
const a = consolidateByRules({ today: '2026-11-18', title: 'Lumen', typology: null, objective: null, pieces, events: events as never, total: pieces.length, unreadable: [], others });
console.log('\nSITUATION:', a.situation);
console.log('ACTION:', a.primary_action.label, '|', a.primary_action.rationale);
for (const c of a.contradictions) console.log('CONTRA', c.kind, c.text, c.evidence.map((e) => e.document_id).join(','));
for (const m of a.missing_items) console.log('MANQUE', m.short_label);
for (const d of a.deadlines) console.log('ECH', d.date, d.kind, d.owner, d.title);
for (const k of a.key_facts) console.log('FAIT', k.text);
console.log('JALONS', a.milestones.map((m) => events.find((e) => e.key === m.event_key)?.label + ' ' + m.importance).join(' | '));
