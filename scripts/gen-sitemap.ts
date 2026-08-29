/**
 * Génère public/sitemap.xml à la compilation, à partir du manifeste des routes
 * réelles (src/data/routes.ts) — jamais écrit à la main, jamais figé.
 *
 * Usage :  npm run gen:sitemap   (inclus dans npm run build)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { publicRoutes } from '../src/data/routes';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://www.clair-dossier.com';

const entries = publicRoutes()
  .map((r) => {
    const lines = [
      '  <url>',
      `    <loc>${SITE}${r.path}</loc>`,
      ...(r.lastmod ? [`    <lastmod>${r.lastmod}</lastmod>`] : []),
      `    <changefreq>${r.changefreq}</changefreq>`,
      `    <priority>${r.priority.toFixed(1)}</priority>`,
      '  </url>',
    ];
    return lines.join('\n');
  })
  .join('\n');

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

writeFileSync(join(__dirname, '..', 'public', 'sitemap.xml'), xml, 'utf-8');
console.log(`sitemap.xml : ${publicRoutes().length} URLs générées depuis src/data/routes.ts`);
