// Revue de la PR de recette — lot « production » : le site en production (drapeaux
// VITE_RECETTE / VITE_HOME_CLARTE / VITE_AI_ENGINE éteints) ne doit pas changer.
// C04 : suivi « Documents disponibles » atteint par un document déposé par l'équipe.
// C17 : aucun chunk de recette publié dans un build sans VITE_RECETTE.
// B3  : feuille Tailwind de production sans les classes du code sous drapeau.
// B4  : message vide de la grille (acronyme « IA », accords).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { build, type Plugin, type Rollup } from 'vite';
import { splitDeliverables, trackingStep, TIMELINE_STEPS } from '../packages/core/src/dossiers.ts';
import { DELIVERABLE_CATALOG, deliverableKeyOf } from '../supabase/functions/_shared/analysis-model.ts';
import { DeliverablesGrid, type DeliverableFile } from '../src/components/dossier/DeliverablesGrid.tsx';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

/* ── C04 ─────────────────────────────────────────────────────────────────── */

const detail = read('src/pages/DossierDetail.tsx');

/**
 * Évalue une expression de DossierDetail.tsx telle qu'elle est écrite dans le code de
 * production (le composant lui-même ne se charge pas hors de Vite : import.meta.env,
 * Supabase). Seule une expression simple est acceptée : identifiants, chaînes,
 * ternaire, comparaison, `.length` — aucun appel, aucune affectation.
 */
function expression(pattern: RegExp, ...params: string[]) {
  const m = detail.match(pattern);
  assert.ok(m, `expression introuvable dans DossierDetail.tsx : ${pattern}`);
  assert.match(m[1], /^[\p{L}\d\s_?:.()>"']+$/u, `expression inattendue : ${m[1]}`);
  return new Function(...params, `return (${m[1]});`) as (...args: unknown[]) => unknown;
}

test('C04 — moteur éteint : un document déposé par l’équipe mène à « Documents disponibles »', () => {
  const hasDeliverables = expression(/hasDeliverables:\s*([^,\n]+),/, 'AI_ENGINE', 'aiDeliverables', 'deliverables');
  // handleDeliver garde le nom d'origine du fichier : jamais au format du catalogue.
  const deliverables = [{ file_name: 'Synthese-dossier-Martin.pdf' }];
  const { catalog } = splitDeliverables(deliverables, deliverableKeyOf);
  assert.equal(catalog.length, 0);
  for (const status of ['transmis', 'en-cours', 'valide']) {
    for (const forcedStep of [null, 2, 3, 5]) {
      const step = trackingStep({ status, forcedStep, hasDeliverables: hasDeliverables(false, catalog, deliverables) as boolean, processing: false, closed: false });
      assert.equal(TIMELINE_STEPS[step - 1], 'Documents disponibles', `${status} / étape forcée ${forcedStep}`);
    }
  }
  assert.equal(hasDeliverables(false, [], []), false, 'sans aucun document, pas d’étape 3');
  // Moteur en service : seule la règle du catalogue (comme les cartes) annonce l'étape 3.
  assert.equal(hasDeliverables(true, catalog, deliverables), false);
  const auto = [{ file_name: 'Dashboard-r1.pdf' }];
  assert.equal(hasDeliverables(true, splitDeliverables(auto, deliverableKeyOf).catalog, auto), true);
});

test('C04 — moteur éteint : la liste garde son intitulé « Documents déposés par l’équipe ClairDossier »', () => {
  const heading = expression(/\{\s*(AI_ENGINE\s*\?\s*"[^"]*"\s*:\s*"[^"]*")\s*\}/, 'AI_ENGINE');
  assert.equal(heading(false), "Documents déposés par l'équipe ClairDossier");
  assert.equal(heading(true), 'Autres documents');
});

/* ── C17 / B3 : builds Vite réels, en mémoire (aucun fichier écrit) ───────── */

const FLAGS = ['VITE_RECETTE', 'VITE_HOME_CLARTE', 'VITE_AI_ENGINE', 'VITE_DEMO', 'VITE_NOINDEX'];

/** Build Vite en mémoire d'un module d'entrée virtuel, drapeaux de build imposés. */
async function buildMemoire(entry: string, flags: Record<string, string>, plugins: Plugin[] = [], external?: (id: string) => boolean) {
  const saved = Object.fromEntries(FLAGS.map((k) => [k, process.env[k]]));
  const envDir = mkdtempSync(join(tmpdir(), 'revue-production-'));
  for (const k of FLAGS) delete process.env[k];
  Object.assign(process.env, flags);
  const virtual: Plugin = {
    name: 'entree-virtuelle',
    resolveId: (id) => (id === 'virtual:entree' ? '\0virtual:entree' : null),
    load: (id) => (id === '\0virtual:entree' ? entry : null),
  };
  try {
    const out = (await build({
      configFile: false,
      root: ROOT,
      envDir,
      logLevel: 'silent',
      plugins: [virtual, ...plugins],
      build: { write: false, emptyOutDir: false, copyPublicDir: false, rollupOptions: { input: 'virtual:entree', external } },
    })) as Rollup.RollupOutput | Rollup.RollupOutput[];
    return (Array.isArray(out) ? out : [out]).flatMap((o) => o.output);
  } finally {
    for (const k of FLAGS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    rmSync(envDir, { recursive: true, force: true });
  }
}

// Même usage que src/App.tsx : les routes de recette ne sont appelées que sous VITE_RECETTE
// (affectation globale : un build d'application ne conserve pas les exports de l'entrée).
const ENTREE_APP = `import { recetteRoutes } from '/src/recette/routes.tsx';
globalThis.routes = import.meta.env.VITE_RECETTE === '1' ? recetteRoutes() : null;`;
const nu = (id: string) => !id.startsWith('.') && !id.startsWith('/') && !id.startsWith('\0') && !id.startsWith('virtual:');

test('C17 — build sans VITE_RECETTE : aucun chunk ni code de la recette publié', async () => {
  const sortie = await buildMemoire(ENTREE_APP, {}, [], nu);
  const chunks = sortie.filter((o): o is Rollup.OutputChunk => o.type === 'chunk');
  assert.deepEqual(chunks.map((c) => c.isEntry), [true], `chunks émis : ${chunks.map((c) => c.fileName).join(', ')}`);
  const code = chunks.map((c) => c.code).join('\n');
  for (const trace of ['PaiementRecette', 'RecetteConnexion', 'DossierPage', 'import(']) assert.ok(!code.includes(trace), `« ${trace} » publié`);
});

test('C17 — build VITE_RECETTE=1 : les pages de recette restent chargées à la demande', async () => {
  const sortie = await buildMemoire(ENTREE_APP, { VITE_RECETTE: '1' }, [], nu);
  const chunks = sortie.filter((o): o is Rollup.OutputChunk => o.type === 'chunk');
  const code = chunks.map((c) => c.code).join('\n');
  assert.ok(chunks.length >= 4, `chunks émis : ${chunks.map((c) => c.fileName).join(', ')}`);
  for (const trace of ['PaiementRecette', 'RecetteConnexion', 'DossierPage']) assert.ok(code.includes(trace), `« ${trace} » absent`);
});

let instance = 0;
/** Feuille produite par src/index.css avec les greffons CSS de vite.config.ts (Tailwind et ce qui le précède). */
async function feuille(flags: Record<string, string>) {
  // Configuration rechargée à chaque build : le greffon Tailwind garde un cache par fichier,
  // comme un vrai `vite build` qui part toujours de greffons neufs.
  const config = (await import(`../vite.config.ts?build=${++instance}`)).default as { plugins: unknown[] };
  const css = (config.plugins.flat(Infinity) as Plugin[]).filter((p) => p && (p.name.startsWith('@tailwindcss/vite') || p.name === 'sources-sous-drapeau'));
  const sortie = await buildMemoire(`import '/src/index.css';`, flags, css);
  const asset = sortie.find((o): o is Rollup.OutputAsset => o.type === 'asset' && o.fileName.endsWith('.css'));
  assert.ok(asset, 'feuille CSS émise');
  return String(asset.source);
}

// Classes présentes UNIQUEMENT dans le code sous drapeau (vérifié par git grep à la revue).
// Tailwind analyse aussi tests/ : les tirets sont écrits \u002d pour que ce fichier ne
// fasse générer aucune de ces classes. Crochets échappés comme dans la feuille produite.
const RECETTE_SEULE = ['whitespace\u002dpre\u002dwrap', 'list\u002ddecimal', 'min\u002dh\u002d\\[70vh\\]', 'ring\u002dsky\u002d200'];
const CLARTE_SEULE = ['text\u002d\\[44px\\]', 'scroll\u002dmt\u002d20'];
const PRODUCTION = ['bg-navy-900', 'text-gold-700', 'shadow-card'];

test('B3 — feuille de production (drapeaux éteints) : aucune classe de la recette ni de l’accueil « clarté »', async () => {
  const css = await feuille({});
  for (const c of [...RECETTE_SEULE, ...CLARTE_SEULE]) assert.ok(!css.includes(`.${c}`), `classe .${c} générée en production`);
  for (const c of PRODUCTION) assert.ok(css.includes(`.${c}`), `classe de production .${c} manquante`);
});

test('B3 — builds sous drapeau : les classes de la recette et de l’accueil « clarté » restent générées', async () => {
  const recette = await feuille({ VITE_RECETTE: '1', VITE_HOME_CLARTE: '1' });
  for (const c of [...RECETTE_SEULE, ...CLARTE_SEULE, ...PRODUCTION]) assert.ok(recette.includes(`.${c}`), `classe .${c} manquante (recette)`);
  const clarte = await feuille({ VITE_HOME_CLARTE: '1' });
  for (const c of CLARTE_SEULE) assert.ok(clarte.includes(`.${c}`), `classe .${c} manquante (clarté seule)`);
  for (const c of RECETTE_SEULE) assert.ok(!clarte.includes(`.${c}`), `classe .${c} générée sans VITE_RECETTE`);
});

/* ── B4 ─────────────────────────────────────────────────────────────────── */

const texte = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();
const fichier = (key: DeliverableFile['key'], name: string): DeliverableFile => ({ key, name, open: () => undefined, download: () => undefined });
const grille = (files: DeliverableFile[], emptyLabel: string) => texte(renderToStaticMarkup(createElement(DeliverablesGrid, { files, emptyLabel })));

test('B4 — grille vide : libellés d’origine (« Résumé IA »), phrase indépendante de l’état', () => {
  for (const etat of ['Pas encore disponibles.', 'En préparation…']) {
    const t = grille([], etat);
    assert.ok(t.includes(`${etat} Vos six documents (${DELIVERABLE_CATALOG.map((d) => d.label).join(', ')}) apparaîtront ici dès leur publication.`), t);
    assert.ok(t.includes('Résumé IA'), t);
    assert.doesNotMatch(t, /résumé ia/);
  }
});

test('B4 — grille partielle : documents manquants avec un accord correct, sans recoller l’état', () => {
  const quatre = [fichier('resume', 'Resume-IA-r1.pdf'), fichier('dashboard', 'Dashboard-r1.pdf'), fichier('chronologie', 'Chronologie-r1.pdf'), fichier('echeances', 'Echeances-r1.ics')];
  const t = grille(quatre, 'Pas encore disponibles.');
  assert.ok(t.includes('Documents pas encore publiés : Dates modifiables · Relances e-mails.'), t);
  assert.doesNotMatch(t, /disponibles? :/);
  const cinq = grille([...quatre, fichier('dates', 'Dates-modifiables-r1.pdf')], 'En préparation…');
  assert.ok(cinq.includes('Document pas encore publié : Relances e-mails.'), cinq);
  assert.doesNotMatch(cinq, /En préparation/);
});

test('B4 — états transmis à la grille : accords cohérents avec « Vos six documents »', () => {
  const demo = read('src/pages/DemoDossier.tsx');
  for (const [nom, src] of [['DossierDetail', detail], ['DemoDossier', demo]] as const) {
    const etats = [...src.matchAll(/emptyLabel=\{([^}]+)\}/g)].flatMap((m) => [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]));
    assert.ok(etats.length >= 2, `${nom} : états introuvables`);
    for (const e of etats) {
      assert.doesNotMatch(e, /\bce document\b/, `${nom} : « ${e} »`);
      assert.doesNotMatch(e, /^Pas encore disponible\.$/, `${nom} : « ${e} » (singulier)`);
    }
  }
});
