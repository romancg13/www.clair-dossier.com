/**
 * Manifeste des routes PUBLIQUES du site — source unique pour :
 *   - scripts/gen-sitemap.ts   (sitemap.xml généré à la compilation)
 *   - scripts/prerender.ts     (pré-rendu HTML de chaque route publique)
 *   - les tests de cohérence   (tests/routes.test.ts, tests/seo.test.ts)
 *
 * ⚠ Ce manifeste doit rester aligné avec le routeur réel (src/App.tsx).
 *   Toute route ajoutée dans App.tsx doit être ajoutée ici (et inversement),
 *   sauf les routes privées (/compte, /compte/dossier/:id, /dossier/nouveau,
 *   /admin) et les écrans d'authentification (/connexion, /inscription),
 *   exclus de l'indexation (noindex, robots.txt), du sitemap et du pré-rendu
 *   — voir PRIVATE_PATH_PREFIXES (src/lib/seo.tsx), vérifié à l'exécution.
 */
import { blogPosts } from './blog/index';
import { features } from './features';
import { legalPages } from './legal';
import { canonicalUrl, isPrivatePath } from '../lib/seo';

export type PublicRoute = {
  path: string;
  changefreq: 'weekly' | 'monthly' | 'yearly';
  priority: number;
  /**
   * Date ISO (YYYY-MM-DD) de dernière modification explicite et publiée
   * (ex. date d'un article). Prioritaire sur `sources`.
   */
  lastmod?: string;
  /**
   * Fichiers ou dossiers (relatifs à la racine du dépôt) qui portent le
   * contenu principal de la page : scripts/gen-sitemap.ts en déduit lastmod
   * à partir de la date du dernier commit git qui les a modifiés — jamais la
   * date du build. Sans historique git complet, lastmod est simplement omis.
   */
  sources?: string[];
};

const HOME_SOURCES = ['src/pages/Home.tsx', 'src/components/landing', 'src/components/sections', 'src/data/faq.ts'];
const SEGMENT_SOURCES = ['src/pages/SegmentPage.tsx', 'src/data/segments.ts'];

const staticRoutes: PublicRoute[] = [
  { path: '/', changefreq: 'weekly', priority: 1.0, sources: HOME_SOURCES },
  { path: '/fonctionnalites', changefreq: 'monthly', priority: 0.9, sources: ['src/pages/FeaturesIndex.tsx', 'src/data/features.ts'] },
  { path: '/tarifs', changefreq: 'monthly', priority: 0.9, sources: ['src/pages/Pricing.tsx', 'src/data/pricing.ts'] },
  { path: '/securite', changefreq: 'monthly', priority: 0.8, sources: ['src/pages/Security.tsx', 'src/data/trust.ts'] },
  { path: '/blog', changefreq: 'weekly', priority: 0.8, sources: ['src/pages/BlogIndex.tsx', 'src/data/blog'] },
  { path: '/contact', changefreq: 'yearly', priority: 0.5, sources: ['src/pages/Contact.tsx', 'src/data/contact.ts'] },
  // Vague 1 — parcours à forte valeur
  { path: '/etat-du-produit', changefreq: 'monthly', priority: 0.7, sources: ['src/pages/ProductStatus.tsx', 'src/data/product-status.ts'] },
  { path: '/cabinets-avocats', changefreq: 'monthly', priority: 0.8, sources: SEGMENT_SOURCES },
  { path: '/experts-comptables', changefreq: 'monthly', priority: 0.8, sources: SEGMENT_SOURCES },
  { path: '/grands-comptes', changefreq: 'monthly', priority: 0.8, sources: SEGMENT_SOURCES },
  { path: '/rendez-vous', changefreq: 'monthly', priority: 0.7, sources: ['src/pages/RendezVous.tsx'] },
  { path: '/marseille', changefreq: 'monthly', priority: 0.7, sources: ['src/pages/Marseille.tsx', 'src/data/contact.ts'] },
];

export function publicRoutes(): PublicRoute[] {
  const routes: PublicRoute[] = [
    ...staticRoutes,
    ...features.map((f) => ({
      path: `/fonctionnalites/${f.slug}`,
      changefreq: 'monthly' as const,
      priority: 0.7,
      sources: ['src/pages/FeatureDetail.tsx', 'src/data/features.ts'],
    })),
    ...blogPosts.map((p) => ({
      path: `/blog/${p.slug}`,
      changefreq: 'yearly' as const,
      priority: 0.6,
      // Date publiée de l'article (identique à datePublished/dateModified du JSON-LD).
      lastmod: p.updated ?? p.date,
    })),
    ...Object.keys(legalPages).map((slug) => ({
      path: `/${slug}`,
      changefreq: 'monthly' as const,
      priority: 0.3,
      sources: ['src/pages/LegalPage.tsx', 'src/data/legal.ts'],
    })),
  ];
  const leaked = routes.filter((r) => isPrivatePath(r.path));
  if (leaked.length > 0) {
    throw new Error(`routes: route(s) privée(s) dans le manifeste public : ${leaked.map((r) => r.path).join(', ')}`);
  }
  return routes;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * sitemap.xml : une entrée par route publique, <loc> = URL canonique finale
 * (barre oblique comprise), <lastmod> seulement si une date réelle est connue.
 */
export function sitemapXml(
  routes: PublicRoute[],
  lastmodFor: (route: PublicRoute) => string | undefined = (r) => r.lastmod
): string {
  const entries = routes
    .map((r) => {
      const lastmod = lastmodFor(r);
      if (lastmod !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) {
        throw new Error(`sitemap: lastmod invalide pour ${r.path} : ${lastmod}`);
      }
      const lines = [
        '  <url>',
        `    <loc>${xmlEscape(canonicalUrl(r.path))}</loc>`,
        ...(lastmod ? [`    <lastmod>${lastmod}</lastmod>`] : []),
        `    <changefreq>${r.changefreq}</changefreq>`,
        `    <priority>${r.priority.toFixed(1)}</priority>`,
        '  </url>',
      ];
      return lines.join('\n');
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}
