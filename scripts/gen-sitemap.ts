/**
 * Génère public/sitemap.xml à la compilation, à partir du manifeste des routes
 * réelles (src/data/routes.ts) — jamais écrit à la main, jamais figé.
 *
 * - <loc> : URL canonique finale, avec barre oblique (GitHub Pages redirige
 *   /route → /route/ en 301) ;
 * - routes privées (compte, dossiers, admin, connexion, inscription) : exclues
 *   (vérifié par publicRoutes()) ;
 * - <lastmod> : uniquement une date réelle — date publiée de l'article, ou
 *   date du dernier commit git ayant modifié les fichiers sources de la page.
 *   Jamais la date du build. Dans un clone git superficiel (CI par défaut :
 *   actions/checkout fetch-depth 1), l'historique est inconnu → lastmod omis
 *   pour ces pages plutôt que faussé.
 *
 * Usage :  npm run gen:sitemap                       (inclus dans npm run build)
 *          tsx scripts/gen-sitemap.ts --out <fichier> (écrit ailleurs, ex. contrôle)
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { publicRoutes, sitemapXml, type PublicRoute } from '../src/data/routes';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const outFlag = process.argv.indexOf('--out');
const outFile = outFlag !== -1 && process.argv[outFlag + 1]
  ? resolve(process.argv[outFlag + 1])
  : join(root, 'public', 'sitemap.xml');

function git(args: string[]): string {
  return execFileSync('git', args, { cwd: root, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/** null = historique git exploitable ; sinon, la raison de l'omission. */
function gitHistoryUnavailable(): string | null {
  try {
    if (git(['rev-parse', '--is-shallow-repository']) === 'true') {
      return 'clone git superficiel (historique incomplet)';
    }
    return null;
  } catch {
    return 'git indisponible';
  }
}

const unavailable = gitHistoryUnavailable();
const cache = new Map<string, string | undefined>();

function lastCommitDate(sources: string[]): string | undefined {
  const key = sources.join('\n');
  if (cache.has(key)) return cache.get(key);
  let date: string | undefined;
  try {
    const iso = git(['log', '-1', '--format=%cI', '--', ...sources]);
    date = iso ? iso.slice(0, 10) : undefined;
  } catch {
    date = undefined;
  }
  cache.set(key, date);
  return date;
}

function lastmodFor(route: PublicRoute): string | undefined {
  if (route.lastmod) return route.lastmod;
  if (unavailable || !route.sources?.length) return undefined;
  return lastCommitDate(route.sources);
}

const routes = publicRoutes();
const xml = sitemapXml(routes, lastmodFor);
writeFileSync(outFile, xml, 'utf-8');

const dated = routes.filter((r) => lastmodFor(r)).length;
console.log(`sitemap.xml : ${routes.length} URLs générées depuis src/data/routes.ts (${dated} avec lastmod) → ${outFile}`);
if (unavailable) {
  console.warn(`sitemap.xml : lastmod git omis — ${unavailable}. Seules les dates publiées (articles) sont renseignées.`);
}
