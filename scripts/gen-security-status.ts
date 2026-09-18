/**
 * Relevé daté des tests SQL de cloisonnement — alimente l'indicateur
 * « Cloisonnement des données entre comptes » de la page /securite.
 *
 * Exécute RÉELLEMENT tests/sql/migrations.pglite.mjs (migrations du dépôt
 * rejouées sur une base PostgreSQL embarquée, hors production), lit la ligne
 * de synthèse et écrit src/components/security/sql-check.json :
 *   { checkedAt, passed, failed, suite, scope }
 *
 * Règles :
 *   - aucune date n'est saisie à la main : checkedAt = heure réelle du passage ;
 *   - si la suite ne peut pas s'exécuter (PGlite absent, erreur) : le relevé
 *     précédent est CONSERVÉ tel quel et vieillira jusqu'à « À revérifier » ;
 *   - si des tests échouent : le relevé est écrit avec failed > 0 → la page
 *     affiche « À revérifier » ; code de sortie 1.
 *
 * Usage (hors CI : PGlite n'est pas une dépendance du projet) :
 *   PGLITE_MODULE=/chemin/@electric-sql/pglite/dist/index.js \
 *     node --import tsx scripts/gen-security-status.ts
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSqlSummary, type SqlCheckRecord } from '../src/components/security/status-model';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SUITE = 'tests/sql/migrations.pglite.mjs';
const OUT = join(root, 'src/components/security/sql-check.json');

const run = spawnSync(process.execPath, [join(root, SUITE)], {
  cwd: root,
  env: process.env,
  encoding: 'utf8',
  timeout: 10 * 60 * 1000,
});

const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
const summary = parseSqlSummary(output);

if (!summary || summary.passed === 0) {
  console.error('Suite SQL non exécutée ou sans synthèse lisible : relevé précédent conservé.');
  console.error(output.trim().split('\n').slice(-5).join('\n'));
  process.exit(1);
}

const record: SqlCheckRecord = {
  checkedAt: new Date().toISOString(),
  passed: summary.passed,
  failed: summary.failed,
  suite: SUITE,
  scope:
    'Migrations du dépôt rejouées sur une base de test locale (PGlite) — ne porte pas sur la base de production.',
};

writeFileSync(OUT, `${JSON.stringify(record, null, 2)}\n`);
console.log(`Relevé écrit : ${summary.passed} réussis, ${summary.failed} échoués (${record.checkedAt}).`);
process.exit(summary.failed > 0 ? 1 : 0);
