import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  alertLabel,
  formatBytes,
  isSupervisionOverview,
  parseEurosToCents,
  quotaLabel,
  quotaTone,
  sortAlerts,
} from '../src/lib/supervision.ts';

test('alertes : tri critique → attention → info, ordre stable', () => {
  const tri = sortAlerts([
    { code: 'MOTEUR_EN_PAUSE', niveau: 'info', valeur: 1 },
    { code: 'QUOTA_80', niveau: 'attention', valeur: 2 },
    { code: 'FILE_BLOQUEE', niveau: 'critique', valeur: 3 },
    { code: 'ECHECS_REPETES', niveau: 'critique', valeur: 1 },
    { code: 'FUTUR', niveau: 'inconnu', valeur: 9 },
  ]);
  assert.deepEqual(tri.map((a) => a.code), ['FILE_BLOQUEE', 'ECHECS_REPETES', 'QUOTA_80', 'MOTEUR_EN_PAUSE', 'FUTUR']);
});

test('alertes : libellés accordés, code inconnu affiché tel quel', () => {
  assert.match(alertLabel({ code: 'QUOTA_80', niveau: 'attention', valeur: 1 }), /^1 compte dépasse 80 %/);
  assert.match(alertLabel({ code: 'QUOTA_80', niveau: 'attention', valeur: 3 }), /^3 comptes dépassent 80 %/);
  assert.match(alertLabel({ code: 'FILE_BLOQUEE', niveau: 'critique', valeur: 2 }), /2 travaux en attente/);
  assert.match(alertLabel({ code: 'BUDGET_GLOBAL_80', niveau: 'attention', valeur: 91.5 }), /91,5 %/);
  assert.equal(alertLabel({ code: 'FUTUR', niveau: 'info', valeur: 4 }), 'FUTUR : 4');
});

test('volumes : unités françaises, valeurs nulles ou invalides', () => {
  assert.equal(formatBytes(0), '0 o');
  assert.equal(formatBytes(null), '0 o');
  assert.equal(formatBytes('abc'), '0 o');
  assert.equal(formatBytes(900), '900 o');
  assert.equal(formatBytes(1536).replace(/ | /g, ' '), '1,5 Ko');
  assert.equal(formatBytes(5 * 1024 ** 3).replace(/ | /g, ' '), '5 Go');
});

test('quotas : libellé et seuils 80 % / 100 %', () => {
  assert.equal(quotaLabel(null, null), '—');
  assert.equal(quotaLabel(45, 50), '45 / 50');
  assert.equal(quotaLabel(12, null), '12 / non plafonné');
  assert.equal(quotaTone(null), 'normal');
  assert.equal(quotaTone(79.9), 'normal');
  assert.equal(quotaTone(80), 'attention');
  assert.equal(quotaTone(100), 'critique');
});

test('repère de budget : euros → centimes, vide = retrait, invalide refusé', () => {
  assert.equal(parseEurosToCents(''), null);
  assert.equal(parseEurosToCents(' 150 '), 15000);
  assert.equal(parseEurosToCents('150,50'), 15050);
  assert.equal(parseEurosToCents('0'), undefined);
  assert.equal(parseEurosToCents('-5'), undefined);
  assert.equal(parseEurosToCents('12,345'), undefined);
  assert.equal(parseEurosToCents('abc'), undefined);
});

test('réponse : forme minimale exigée avant affichage', () => {
  assert.equal(isSupervisionOverview(null), false);
  assert.equal(isSupervisionOverview({ version: 2, comptes: [], alertes: [], moteur: {} }), false);
  assert.equal(isSupervisionOverview({ version: 1, comptes: [], alertes: [], moteur: { installe: false } }), true);
});

test('console : la supervision est montée sans retirer aucune section existante', () => {
  const src = readFileSync(new URL('../src/pages/AdminConsole.tsx', import.meta.url), 'utf8');
  for (const id of ['dashboard', 'nouveaux', 'clients', 'dossiers', 'corbeille', 'activite', 'notifications', 'demandes', 'ia', 'supervision', 'abonnements', 'diagnostic']) {
    assert.ok(src.includes(`{ id: "${id}", label:`), `section ${id}`);
  }
  assert.ok(src.includes('section === "supervision" && <AdminSupervision'));
});

test('composant : lecture seule de la RPC, aucune clé ni contenu de pièce', () => {
  const src = readFileSync(new URL('../src/components/admin/AdminSupervision.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes('"admin_supervision_overview"'));
  assert.ok(!/service_role|VITE_[A-Z_]*KEY/.test(src));
  assert.ok(!/\.from\("(dossier_documents|ai_extractions|ai_analyses|inbound_emails)"\)/.test(src), 'aucune lecture directe de contenu');
});
