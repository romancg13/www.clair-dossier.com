// Application installable : manifeste, icônes, service worker minimal et sûr, séparation recette / production.
// Contrôles statiques rejoués à chaque évolution (npm test) : ils empêchent qu'un cache de données privées soit introduit.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { plateforme } from '../src/lib/pwa.ts';

const lire = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url));
const taille = (png: Buffer) => [png.readUInt32BE(16), png.readUInt32BE(20)];

test('manifeste de production : identité stable, plein écran, icônes officielles aux bonnes tailles', () => {
  const m = JSON.parse(lire('public/manifest.webmanifest').toString());
  assert.equal(m.name, 'ClairDossier');
  assert.equal(m.id, '/?app=clairdossier');
  assert.equal(m.display, 'standalone');
  assert.equal(m.scope, '/');
  assert.match(m.start_url, /^\/compte/, 'ouvre le véritable espace, pas une démonstration');
  assert.equal(m.theme_color, '#0d1b3d');
  const par = (s: string, purpose?: string) => m.icons.find((i: { sizes: string; purpose?: string }) => i.sizes === s && (!purpose || i.purpose === purpose));
  for (const [s, purpose, f] of [['192x192', 'any', 'icon-192.png'], ['512x512', 'any', 'icon-512.png'], ['512x512', 'maskable', 'icon-maskable-512.png'], ['180x180', undefined, 'apple-touch-icon.png']] as const) {
    assert.equal(par(s, purpose)?.src, `/${f}`);
    assert.deepEqual(taille(lire(`public/${f}`)), s.split('x').map(Number));
  }
  for (const sc of m.shortcuts) assert.match(sc.url, /^\/(compte|dossier\/nouveau)/);
  const html = lire('index.html').toString();
  for (const balise of ['rel="manifest"', 'apple-touch-icon', 'apple-mobile-web-app-capable', 'viewport-fit=cover']) assert.ok(html.includes(balise), balise);
});

test('service worker : ne met en cache que la page hors connexion, jamais une API, un document ou une donnée privée', () => {
  const sw = lire('public/sw.js').toString().replace(/^\s*\/\/.*$/gm, '');
  assert.match(sw, /const PUBLIC = \['\/hors-connexion\.html', '\/icon-192\.png'\];/);
  assert.equal((sw.match(/\.addAll\(/g) ?? []).length, 1, 'un seul préchargement');
  assert.doesNotMatch(sw, /\.put\(|cache\.add\(/, 'aucune réponse n’est ajoutée au cache à la volée');
  assert.match(sw, /r\.method !== 'GET' \|\| r\.mode !== 'navigate'/, 'seules les navigations sont interceptées');
  assert.match(sw, /\(api\|oauth\|mcp\|\\\.well-known\)/, 'API, OAuth et MCP exclus');
  assert.doesNotMatch(sw, /install'[^]*skipWaiting\(\)[^]*activate'/, 'pas d’activation forcée à l’installation');
  assert.match(sw, /'ACTIVER'[^]*skipWaiting/, 'la mise à jour attend l’accord de l’utilisateur');
  assert.match(sw, /'DESACTIVER'[^]*unregister/, 'désactivation prévue');
  assert.equal(JSON.parse(lire('public/pwa.json').toString()).actif, true);
  const hc = lire('public/hors-connexion.html').toString();
  assert.match(hc, /hors connexion/i);
  assert.doesNotMatch(hc, /<script src|fetch\(|localStorage|indexedDB/, 'la page hors connexion n’affiche aucune donnée conservée');
});

test('recette et démonstration : nom, identifiant et icône distincts de la production', () => {
  const d = mkdtempSync(join(tmpdir(), 'pwa-'));
  for (const pwa of ['recette', 'demo']) {
    const out = join(d, pwa);
    cpSync(new URL('../public/manifest.webmanifest', import.meta.url), join(out, 'manifest.webmanifest'), { recursive: true });
    execFileSync('node', ['scripts/preview-neutralise.mjs', `--dir=${out.replace(/^\//, '../'.repeat(12))}`, `--pwa=${pwa}`, '--force'], { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' });
    const m = JSON.parse(readFileSync(join(out, 'manifest.webmanifest'), 'utf8'));
    assert.equal(m.id, `/?app=clairdossier-${pwa}`);
    assert.notEqual(m.name, 'ClairDossier');
    assert.match(m.name, pwa === 'recette' ? /Recette/ : /Démo/);
    assert.notDeepEqual(readFileSync(join(out, 'icon-192.png')), lire('public/icon-192.png'), 'icône marquée « RECETTE »');
  }
});

test('consigne d’installation choisie selon le navigateur réel', () => {
  assert.equal(plateforme('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', true), 'ios');
  assert.equal(plateforme('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', true), 'ios', 'iPad en mode ordinateur');
  assert.equal(plateforme('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36', true), 'android');
  assert.equal(plateforme('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', false), 'mac-safari');
  assert.equal(plateforme('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36 Edg/126.0', false), 'ordinateur');
  assert.equal(plateforme('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36', false), 'ordinateur');
  assert.equal(plateforme('', false), 'autre');
});
