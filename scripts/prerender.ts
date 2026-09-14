/**
 * Pré-rendu statique des routes publiques (Lot 3 — Vague 0).
 *
 * Après `vite build` (client), ce script :
 *   1. compile l'entrée serveur (src/entry-server.tsx) en dist-ssr/ ;
 *   2. sauvegarde la coquille SPA vierge (dist/spa-shell.html) — servie par
 *      le fallback Netlify pour les routes privées et inconnues ;
 *   3. rend chaque route publique (manifeste src/data/routes.ts) et écrit
 *      dist/<route>/index.html : titre, description, Open Graph, canonique,
 *      JSON-LD et texte principal présents dans le HTML servi ;
 *   4. supprime dist-ssr/.
 *
 * Usage :  npm run prerender   (inclus dans npm run build)
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';

import { publicRoutes } from '../src/data/routes';
import type { CollectedSeo } from '../src/lib/seo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const distSsr = join(root, 'dist-ssr');

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function replaceOrFail(html: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(html)) {
    throw new Error(`prerender: balise introuvable dans le template (${label}) — index.html a-t-il changé ?`);
  }
  return html.replace(pattern, replacement);
}

function injectIntoTemplate(template: string, appHtml: string, seo: CollectedSeo | null, path: string): string {
  let out = replaceOrFail(
    template,
    /<div id="root"><\/div>/,
    `<div id="root">${appHtml}</div>`,
    'div#root'
  );

  if (!seo) {
    console.warn(`prerender: aucune métadonnée <Seo> collectée pour ${path} — head par défaut conservé.`);
    return out;
  }

  const metas: Array<[RegExp, string, string]> = [
    [/<title>[^<]*<\/title>/, `<title>${esc(seo.title)}</title>`, 'title'],
    [/(<meta name="description" content=")[^"]*(")/, `$1${esc(seo.description)}$2`, 'description'],
    [
      /(<meta name="robots" content=")[^"]*(")/,
      `$1${seo.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large'}$2`,
      'robots',
    ],
    [/(<link rel="canonical" href=")[^"]*(")/, `$1${seo.url}$2`, 'canonical'],
    [/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(seo.title)}$2`, 'og:title'],
    [/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(seo.description)}$2`, 'og:description'],
    [/(<meta property="og:url" content=")[^"]*(")/, `$1${seo.url}$2`, 'og:url'],
    [/(<meta property="og:type" content=")[^"]*(")/, `$1${seo.type}$2`, 'og:type'],
    [/(<meta property="og:image" content=")[^"]*(")/, `$1${seo.image}$2`, 'og:image'],
    [/(<meta name="twitter:title" content=")[^"]*(")/, `$1${esc(seo.title)}$2`, 'twitter:title'],
    [/(<meta name="twitter:description" content=")[^"]*(")/, `$1${esc(seo.description)}$2`, 'twitter:description'],
    [/(<meta name="twitter:image" content=")[^"]*(")/, `$1${seo.image}$2`, 'twitter:image'],
  ];
  for (const [pattern, replacement, label] of metas) {
    out = replaceOrFail(out, pattern, replacement, label);
  }

  if (seo.jsonLd.length > 0) {
    // data-seo-jsonld : le composant <Seo> client remplace ces blocs à
    // l'hydratation (pas de duplication). \u003c : neutralise tout </script>.
    const scripts = seo.jsonLd
      .map(
        (d) =>
          `<script type="application/ld+json" data-seo-jsonld="true">${JSON.stringify(d).replace(/</g, '\\u003c')}</script>`
      )
      .join('\n    ');
    out = replaceOrFail(out, /<\/head>/, `  ${scripts}\n  </head>`, '</head>');
  }

  return out;
}

// ── 1. Bundle SSR ────────────────────────────────────────────────────────
await build({
  configFile: join(root, 'vite.config.ts'),
  logLevel: 'warn',
  build: { ssr: 'src/entry-server.tsx', outDir: 'dist-ssr', emptyOutDir: true },
});

const { render } = (await import(pathToFileURL(join(distSsr, 'entry-server.js')).href)) as {
  render: (url: string) => Promise<{ html: string; seo: CollectedSeo | null }>;
};

// ── 2. Coquille SPA vierge (avant de réécrire dist/index.html) ──────────
const template = readFileSync(join(dist, 'index.html'), 'utf-8');
writeFileSync(join(dist, 'spa-shell.html'), template);

// ── 3. Rendu de chaque route publique ────────────────────────────────────
const routes = publicRoutes();
const titles = new Map<string, string>();
for (const route of routes) {
  const { html, seo } = await render(route.path);
  if (!html || html.length < 500) {
    throw new Error(`prerender: rendu suspect pour ${route.path} (${html.length} octets)`);
  }
  if (seo) {
    const dup = titles.get(seo.title);
    if (dup) throw new Error(`prerender: titre dupliqué « ${seo.title} » (${dup} et ${route.path})`);
    titles.set(seo.title, route.path);
  }
  const page = injectIntoTemplate(template, html, seo, route.path);
  const outDir = route.path === '/' ? dist : join(dist, route.path.slice(1));
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'index.html'), page);
}

// ── 4. Nettoyage ─────────────────────────────────────────────────────────
rmSync(distSsr, { recursive: true, force: true });
console.log(`prerender : ${routes.length} routes écrites dans dist/ (+ spa-shell.html).`);
