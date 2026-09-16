/**
 * Génère public/sitemap.xml et public/feed.xml à la compilation, à partir du
 * manifeste des routes réelles (src/data/routes.ts) et des articles du
 * Journal (src/data/blog) — jamais écrits à la main, jamais figés.
 *
 * Usage :  npm run gen:sitemap   (inclus dans npm run build)
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { publicRoutes } from '../src/data/routes';
import { blogPosts } from '../src/data/blog';

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

// ── Flux RSS 2.0 du Journal (déclaré dans index.html : /feed.xml) ─────────
const escapeXml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const items = [...blogPosts]
  .sort((a, b) => b.date.localeCompare(a.date))
  .map((p) => {
    const link = `${SITE}/blog/${p.slug}`;
    return [
      '    <item>',
      `      <title>${escapeXml(p.title)}</title>`,
      `      <link>${link}</link>`,
      `      <guid isPermaLink="true">${link}</guid>`,
      `      <pubDate>${new Date(`${p.date}T08:00:00Z`).toUTCString()}</pubDate>`,
      `      <description>${escapeXml(p.summary)}</description>`,
      `      <category>${escapeXml(p.category)}</category>`,
      '    </item>',
    ].join('\n');
  })
  .join('\n');

const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>ClairDossier — Journal</title>
    <link>${SITE}/blog</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml" />
    <description>Méthode, conformité et IA documentaire : les articles du Journal ClairDossier pour préparer et suivre vos dossiers administratifs et juridiques.</description>
    <language>fr</language>
${items}
  </channel>
</rss>
`;

writeFileSync(join(__dirname, '..', 'public', 'feed.xml'), rss, 'utf-8');
console.log(`feed.xml : ${blogPosts.length} articles du Journal`);
