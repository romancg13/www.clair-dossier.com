// Construction de la démonstration de recette pour Vercel (Build Output API v3).
//  - site : build Vite + prérendu avec les drapeaux de recette, puis non-indexation
//    (robots.txt bloquant, en-tête X-Robots-Tag, suppression du CNAME et du sitemap) ;
//  - API : une fonction Node unique (esbuild), polices et logo incorporés ;
//  - aucun secret : la recette génère les siens côté serveur au premier appel.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { build } from 'esbuild';

const root = new URL('../../', import.meta.url).pathname;
const out = join(root, '.vercel/output');
const sh = (cmd, env = {}) => execSync(cmd, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });

rmSync(out, { recursive: true, force: true });
const flags = { VITE_RECETTE: '1', VITE_HOME_CLARTE: '1', VITE_PARCOURS_CLAIR: '1', VITE_TARIFS_LISIBLES: '1', VITE_NOINDEX: '1', VITE_BASE_PATH: '/', NODE_ENV: 'production' };
if (process.env.SKIP_SITE !== '1') {
  sh('npx vite build', flags);
  sh('npx tsx scripts/prerender.ts', flags);
}

// Site statique non indexable.
const st = join(out, 'static');
mkdirSync(st, { recursive: true });
cpSync(join(root, 'dist'), st, { recursive: true });
for (const f of ['CNAME', 'sitemap.xml', 'llms.txt']) rmSync(join(st, f), { force: true });
writeFileSync(join(st, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
mkdirSync(join(st, 'recette/pieces'), { recursive: true });
for (const f of readdirSync(join(root, 'recette/fixtures/pieces'))) if (!f.startsWith('gros-lot')) cpSync(join(root, 'recette/fixtures/pieces', f), join(st, 'recette/pieces', f));
writeFileSync(join(st, 'version.json'), JSON.stringify({ commit: process.env.VERCEL_GIT_COMMIT_SHA ?? execSync('git rev-parse HEAD', { cwd: root }).toString().trim(), recette: true }));

// Fonction API : polices et logo incorporés (remplacent la lecture disque de assets.ts).
const assetsPlugin = {
  name: 'ressources-incorporees',
  setup(b) {
    b.onLoad({ filter: /recette[\\/]server[\\/]assets\.ts$/ }, () => {
      const files = { body: 'node_modules/@fontsource/inter/files/inter-latin-400-normal.woff', bold: 'node_modules/@fontsource/inter/files/inter-latin-600-normal.woff', title: 'node_modules/@fontsource/cormorant-garamond/files/cormorant-garamond-latin-600-normal.woff', logo: 'docs/marque/logo-horizontal-clair.png' };
      const entries = Object.entries(files).map(([k, f]) => `${k}: Uint8Array.from(Buffer.from(${JSON.stringify(readFileSync(join(root, f)).toString('base64'))}, 'base64'))`);
      return { contents: `export const ASSET_FILES = {};\nconst A = { ${entries.join(',\n')} };\nexport function loadAssets() { return A; }\n`, loader: 'ts' };
    });
  },
};
const fn = join(out, 'functions/api.func');
mkdirSync(fn, { recursive: true });
await build({
  entryPoints: [join(root, 'recette/vercel/handler.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  outfile: join(fn, 'index.mjs'),
  plugins: [assetsPlugin],
  banner: { js: "import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);" },
  logLevel: 'warning',
  legalComments: 'none',
});
writeFileSync(join(fn, '.vc-config.json'), JSON.stringify({ runtime: 'nodejs22.x', handler: 'index.mjs', launcherType: 'Nodejs', shouldAddHelpers: false, supportsResponseStreaming: false, maxDuration: 300, regions: ['cdg1'] }, null, 2));

const headers = { 'x-robots-tag': 'noindex, nofollow, noarchive', 'x-content-type-options': 'nosniff', 'referrer-policy': 'strict-origin-when-cross-origin', 'x-frame-options': 'DENY', 'permissions-policy': 'geolocation=(), microphone=(), camera=()' };
writeFileSync(
  join(out, 'config.json'),
  JSON.stringify(
    {
      version: 3,
      routes: [
        { src: '^/(.*)$', headers, continue: true },
        { src: '^/assets/(.*)$', headers: { 'cache-control': 'public, max-age=31536000, immutable' }, continue: true },
        { src: '^/((?:api|mcp|oauth|\\.well-known)(?:/.*)?)$', dest: '/api?__p=$1' },
        { handle: 'filesystem' },
        { src: '^/compte/dossier/.*$', dest: '/compte/index.html' },
        { src: '^/(.*)$', dest: existsSync(join(st, 'spa-shell.html')) ? '/spa-shell.html' : '/index.html' },
      ],
      crons: [{ path: '/api/cron', schedule: '17 6 * * *' }],
    },
    null,
    2,
  ),
);
console.log('recette : .vercel/output prêt');
