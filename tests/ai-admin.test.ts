import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adminErrorMessage,
  automationRate,
  counters,
  coverageSummary,
  deriveAiState,
  formatCents,
  needsAdmin,
  sortForAdmin,
  type AiOverviewRow,
} from '../src/lib/ai-admin.ts';

const base: AiOverviewRow = {
  dossier_id: 'd1',
  user_id: 'u1',
  title: 'Dossier',
  typology: 'impaye',
  dossier_status: 'transmis',
  closed: false,
  enabled_at: '2026-11-02T10:00:00Z',
  review_mode: 'manual',
  pieces: 3,
  extracted: 3,
  unsupported: 0,
  jobs_open: 0,
  jobs_failed: 0,
  jobs_failed_budget: 0,
  last_revision: null,
  last_review_status: null,
  last_analysis_at: null,
  last_coverage: null,
  last_cost_cents: null,
  pending_revision: null,
  month_cost_cents: '0',
};
const row = (over: Partial<AiOverviewRow>): AiOverviewRow => ({ ...base, ...over });

test('état : non activé, puis file / lecture / vérification selon les compteurs', () => {
  assert.equal(deriveAiState(row({ enabled_at: null })), 'OFF');
  assert.equal(deriveAiState(row({ enabled_at: null, last_review_status: 'published' })), 'PUBLISHED');
  assert.equal(deriveAiState(row({ pieces: 0 })), 'RECEIVED');
  assert.equal(deriveAiState(row({})), 'QUEUED');
  assert.equal(deriveAiState(row({ jobs_open: 2, extracted: 1 })), 'PROCESSING');
  assert.equal(deriveAiState(row({ jobs_open: 1, extracted: 3 })), 'QUALITY_CHECK');
  assert.equal(deriveAiState(row({ jobs_open: 1, extracted: 2, unsupported: 1 })), 'QUALITY_CHECK', 'pièce non prise en charge = lue');
});

test('état : relecture, approbation, publication, rejet, pause, échec', () => {
  assert.equal(deriveAiState(row({ pending_revision: 2, last_revision: 2, last_review_status: 'pending' })), 'READY_FOR_REVIEW');
  assert.equal(deriveAiState(row({ last_review_status: 'approved', jobs_open: 1 })), 'APPROVED');
  assert.equal(deriveAiState(row({ last_review_status: 'approved' })), 'APPROVED');
  assert.equal(deriveAiState(row({ last_review_status: 'published', last_revision: 1 })), 'PUBLISHED');
  assert.equal(deriveAiState(row({ last_review_status: 'rejected', last_revision: 1 })), 'REJECTED');
  assert.equal(deriveAiState(row({ jobs_failed_budget: 1 })), 'PAUSED');
  assert.equal(deriveAiState(row({ jobs_failed: 1 })), 'FAILED');
  // Un travail ouvert prime sur un échec passé (relance en cours).
  assert.equal(deriveAiState(row({ jobs_failed: 1, jobs_open: 1 })), 'QUALITY_CHECK');
  // Une révision en attente reste « à valider » même si une ancienne est publiée.
  assert.equal(deriveAiState(row({ pending_revision: 3, last_revision: 3, last_review_status: 'pending' })), 'READY_FOR_REVIEW');
});

test('ce qui attend l’administrateur, tri et compteurs', () => {
  const a = row({ dossier_id: 'a', last_analysis_at: '2026-11-01T00:00:00Z', last_review_status: 'published' });
  const b = row({ dossier_id: 'b', last_analysis_at: '2026-10-01T00:00:00Z', pending_revision: 1, last_review_status: 'pending' });
  const c = row({ dossier_id: 'c', jobs_failed: 1 });
  const d = row({ dossier_id: 'd', jobs_open: 1 });
  assert.equal(needsAdmin(a), false);
  assert.equal(needsAdmin(b), true);
  assert.equal(needsAdmin(c), true);
  assert.deepEqual(sortForAdmin([a, d, c, b]).map((r) => r.dossier_id), ['b', 'c', 'a', 'd']);
  assert.deepEqual(counters([a, b, c, d]), { total: 4, toReview: 1, failed: 1, paused: 0, processing: 1, published: 1 });
  assert.equal(automationRate([a, b, c, d]), 33.3);
  assert.equal(automationRate([d]), null, 'rien de terminé : pas de taux');
});

test('formats : centimes, couverture, erreurs', () => {
  assert.equal(formatCents('123.4'), '1,23 €');
  assert.equal(formatCents(null), '0,00 €');
  assert.equal(formatCents('abc'), '—');
  assert.equal(coverageSummary(null), '—');
  assert.equal(coverageSummary({ complete: true }), 'complète');
  assert.equal(coverageSummary({ complete: false, usable: 2, total: 5 }), 'partielle 2/5');
  assert.equal(adminErrorMessage('ERROR: DEJA_PUBLIEE'), 'Cette révision est déjà publiée : elle ne peut plus être rejetée.');
  assert.equal(adminErrorMessage('boom'), "L'opération n'a pas abouti. Réessayez dans un instant.");
});
