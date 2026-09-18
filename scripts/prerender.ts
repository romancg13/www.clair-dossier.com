/**
 * Pré-rendu statique des routes publiques (Lot 3 — Vague 0).
 *
 * Après `vite build` (client), ce script :
 *   1. compile l'entrée serveur (src/entry-server.tsx) en dist-ssr/ ;
 *   2. sauvegarde la coquille SPA vierge (dist/spa-shell.html) — servie par
 *      le fallback Netlify pour les routes privées et inconnues ;
 *   3. écrit dist/404.html — servi par GitHub Pages avec un VRAI statut 404
 *      pour toute URL sans fichier (URL inconnue, mais aussi espaces privés
 *      /compte, /connexion… que la SPA affiche ensuite normalement) :
 *      noindex, sans canonique, #root vide (rendu client, pas d'hydratation
 *      d'un contenu qui ne correspondrait pas à la route demandée) ;
 *   4. rend chaque route publique (manifeste src/data/routes.ts) et écrit
 *      dist/<route>/index.html : titre, description, Open Graph, canonique
 *      (avec barre oblique finale, forme servie par GitHub Pages), JSON-LD et
 *      texte principal présents dans le HTML servi ;
 *   5. écrit une page de redirection (meta refresh immédiat + canonique) pour
 *      chaque ancien slug /fonctionnalites/* (LEGACY_FEATURE_SLUGS) : GitHub
 *      Pages ne sait pas faire de 301 ; sans cela, ces URL répondent 404 ;
 *   6. supprime dist-ssr/.
 *
 * Les fonctions de transformation sont exportées (tests/seo.test.ts) ; le
 * pré-rendu ne s'exécute que lorsque le script est lancé directement.
 *
 * Usage :  npm run prerender   (inclus dans npm run build)
 */
import { mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { publicRoutes } from '../src/data/routes';
import { LEGACY_FEATURE_SLUGS, getFeatureBySlug } from '../src/data/features';
import { canonicalPath, canonicalUrl, type CollectedSeo } from '../src/lib/seo';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const dist = join(root, 'dist');
const distSsr = join(root, 'dist-ssr');

/** Au-delà, Google tronque ; en deçà, la description est trop pauvre. */
const TITLE_WARN_MAX = 70;
const DESCRIPTION_WARN_MIN = 50;
const DESCRIPTION_WARN_MAX = 160;

export function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function replaceOrFail(html: string, pattern: RegExp, replacement: string, label: string): string {
  if (!pattern.test(html)) {
    throw new Error(`prerender: balise introuvable dans le template (${label}) — index.html a-t-il changé ?`);
  }
  return html.replace(pattern, replacement);
}

const CANONICAL_TAG = /\s*<link rel="canonical" href="[^"]*"\s*\/?>/;
const OG_URL_TAG = /\s*<meta property="og:url" content="[^"]*"\s*\/?>/;

export function injectIntoTemplate(template: string, appHtml: string, seo: CollectedSeo | null, path: string): string {
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
  // Page non indexable : pas de canonique (même règle que <Seo> côté client).
  if (seo.noindex) out = out.replace(CANONICAL_TAG, '');

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

const NOT_FOUND_DESCRIPTION =
  "Page introuvable ou réservée à l'espace client ClairDossier.";

const NOT_FOUND_NOSCRIPT = `<noscript>
      <div style="padding: 2rem; font-family: system-ui, sans-serif; color: #0d1b3d; max-width: 640px; margin: 2rem auto; line-height: 1.6;">
        <p style="font-family: serif; font-size: 1.8rem; font-weight: 600; margin: 0 0 1rem;">Page introuvable</p>
        <p>
          Cette adresse ne correspond à aucune page publique de ClairDossier, ou
          elle appartient à l'espace client, qui nécessite JavaScript.
        </p>
        <p>
          <a href="/">Revenir à l'accueil</a> · <a href="/fonctionnalites/">Voir les fonctionnalités</a> ·
          <a href="/tarifs/">Consulter les tarifs</a> · <a href="/contact/">Contacter l'équipe</a>
        </p>
      </div>
    </noscript>`;

/**
 * dist/404.html à partir de la coquille SPA. GitHub Pages la sert avec le
 * statut 404 pour toute URL sans fichier : les URL inconnues ne sont donc
 * jamais des « soft 404 », et les espaces privés (même mécanisme) ne sont
 * pas indexables. Titre neutre : un utilisateur connecté qui recharge
 * /compte ne doit pas voir « introuvable » avant le rendu de son espace ;
 * la page NotFound (rendue côté client) pose ensuite son propre titre.
 */
export function buildNotFoundPage(shell: string): string {
  let out = shell;
  out = replaceOrFail(out, /<title>[^<]*<\/title>/, '<title>ClairDossier</title>', 'title');
  out = replaceOrFail(out, /(<meta name="description" content=")[^"]*(")/, `$1${esc(NOT_FOUND_DESCRIPTION)}$2`, 'description');
  out = replaceOrFail(out, /(<meta name="robots" content=")[^"]*(")/, '$1noindex, follow$2', 'robots');
  out = replaceOrFail(out, CANONICAL_TAG, '', 'canonical');
  out = replaceOrFail(out, OG_URL_TAG, '', 'og:url');
  out = replaceOrFail(out, /<noscript>[\s\S]*?<\/noscript>/, NOT_FOUND_NOSCRIPT, 'noscript');
  if (!/<div id="root"><\/div>/.test(out)) {
    throw new Error('prerender: la coquille 404 doit garder un #root vide (rendu client de la route demandée).');
  }
  return out;
}

/**
 * Ancienne URL → nouvelle : meta refresh immédiat (interprété par Google
 * comme une redirection permanente) + canonique vers la cible + lien lisible.
 */
export function buildRedirectPage(targetPath: string, label: string): string {
  const href = canonicalPath(targetPath);
  const url = canonicalUrl(targetPath);
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Page déplacée — ClairDossier</title>
    <link rel="canonical" href="${url}" />
    <meta http-equiv="refresh" content="0; url=${href}" />
  </head>
  <body style="font-family: system-ui, sans-serif; color: #0d1b3d; background: #fbf8f1; padding: 2rem; line-height: 1.6;">
    <p>Cette page a été déplacée : <a href="${href}">${esc(label)}</a>.</p>
  </body>
</html>
`;
}

async function main(): Promise<void> {
  const { build } = await import('vite');

  // ── 1. Bundle SSR ──────────────────────────────────────────────────────
  await build({
    configFile: join(root, 'vite.config.ts'),
    logLevel: 'warn',
    build: { ssr: 'src/entry-server.tsx', outDir: 'dist-ssr', emptyOutDir: true },
  });

  const { render } = (await import(pathToFileURL(join(distSsr, 'entry-server.js')).href)) as {
    render: (url: string) => Promise<{ html: string; seo: CollectedSeo | null }>;
  };

  // ── 2. Coquille SPA vierge (avant de réécrire dist/index.html) ────────
  let template = readFileSync(join(dist, 'index.html'), 'utf-8');

  // CSS critique : la feuille est inlinée dans chaque HTML pré-rendu pour
  // retirer une requête bloquante du chemin de rendu (LCP mobile). Les URLs
  // du bundle CSS sont absolues (/assets/…), l'inline est donc sans risque.
  const cssLink = template.match(/<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/);
  if (!cssLink) throw new Error('prerender: lien stylesheet introuvable dans dist/index.html — inline CSS impossible.');
  const cssText = readFileSync(join(dist, cssLink[1].slice(1)), 'utf-8');
  if (cssText.includes('</style>')) throw new Error('prerender: le CSS contient « </style> », inline refusé.');
  template = template.replace(cssLink[0], `<style>${cssText}</style>`);

  // Chemin critique mobile : le script module (différé par nature) part en fin
  // de <body> et les modulepreload sont retirés — la page étant entièrement
  // pré-rendue, le premier rendu n'a besoin d'aucun JavaScript ; les chunks se
  // chargent après le paint au lieu de disputer la bande passante au contenu.
  const scriptTag = template.match(/<script type="module" crossorigin src="[^"]+"><\/script>/);
  if (!scriptTag) throw new Error('prerender: script module introuvable dans dist/index.html.');
  template = template.replace(scriptTag[0], '').replace('</body>', `${scriptTag[0]}</body>`);
  template = template.replace(/\s*<link rel="modulepreload"[^>]*>/g, '');

  writeFileSync(join(dist, 'spa-shell.html'), template);

  // ── 3. 404 réelle (remplace la copie brute faite par vite.config.ts) ──
  writeFileSync(join(dist, '404.html'), buildNotFoundPage(template));

  // ── 4. Rendu de chaque route publique ─────────────────────────────────
  const routes = publicRoutes();
  const titles = new Map<string, string>();
  const descriptions = new Map<string, string>();
  const warnings: string[] = [];
  for (const route of routes) {
    const { html, seo } = await render(route.path);
    if (!html || html.length < 500) {
      throw new Error(`prerender: rendu suspect pour ${route.path} (${html.length} octets)`);
    }
    if (seo) {
      // Une route du manifeste rendue en noindex = page introuvable servie en
      // 200 (soft 404) et listée au sitemap : on bloque.
      if (seo.noindex) {
        throw new Error(`prerender: ${route.path} est rendue en noindex (page introuvable ?) — retirez-la du manifeste ou corrigez-la.`);
      }
      const dup = titles.get(seo.title);
      if (dup) throw new Error(`prerender: titre dupliqué « ${seo.title} » (${dup} et ${route.path})`);
      titles.set(seo.title, route.path);
      const dupDesc = descriptions.get(seo.description);
      if (dupDesc) warnings.push(`description dupliquée (${dupDesc} et ${route.path})`);
      descriptions.set(seo.description, route.path);
      if (seo.title.length > TITLE_WARN_MAX) warnings.push(`${route.path} : titre de ${seo.title.length} caractères (> ${TITLE_WARN_MAX})`);
      const dl = seo.description.length;
      if (dl < DESCRIPTION_WARN_MIN || dl > DESCRIPTION_WARN_MAX) {
        warnings.push(`${route.path} : description de ${dl} caractères (cible ${DESCRIPTION_WARN_MIN}–${DESCRIPTION_WARN_MAX})`);
      }
    }
    const h1Count = (html.match(/<h1[\s>]/g) ?? []).length;
    if (h1Count !== 1) warnings.push(`${route.path} : ${h1Count} balise(s) <h1> (attendu : 1)`);
    const page = injectIntoTemplate(template, html, seo, route.path);
    const outDir = route.path === '/' ? dist : join(dist, route.path.slice(1));
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), page);
  }

  // ── 5. Anciennes adresses /fonctionnalites/* → slugs actuels ──────────
  const publicPaths = new Set(routes.map((r) => r.path));
  const legacy = Object.entries(LEGACY_FEATURE_SLUGS);
  for (const [oldSlug, newSlug] of legacy) {
    const from = `/fonctionnalites/${oldSlug}`;
    const target = getFeatureBySlug(newSlug);
    if (!target) throw new Error(`prerender: redirection ${from} → slug inconnu « ${newSlug} »`);
    if (publicPaths.has(from)) throw new Error(`prerender: ${from} est à la fois une route publique et un ancien slug`);
    const outDir = join(dist, 'fonctionnalites', oldSlug);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'index.html'), buildRedirectPage(`/fonctionnalites/${newSlug}`, target.title));
  }

  // ── 6. Nettoyage ───────────────────────────────────────────────────────
  rmSync(distSsr, { recursive: true, force: true });
  for (const w of warnings) console.warn(`prerender (SEO) : ${w}`);
  console.log(
    `prerender : ${routes.length} routes écrites dans dist/ (+ spa-shell.html, 404.html, ${legacy.length} redirections d'anciens slugs).`
  );
}

function sameFile(a: string, b: string): boolean {
  try {
    return realpathSync(a) === realpathSync(b);
  } catch {
    return false;
  }
}

const entry = process.argv[1] ? resolve(process.argv[1]) : '';
if (entry && (sameFile(entry, fileURLToPath(import.meta.url)) || /(^|[\\/])prerender\.ts$/.test(entry))) {
  await main();
}
