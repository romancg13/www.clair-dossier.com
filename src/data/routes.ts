/**
 * Manifeste des routes PUBLIQUES du site — source unique pour :
 *   - scripts/gen-sitemap.ts   (sitemap.xml généré à la compilation)
 *   - scripts/prerender.mjs    (pré-rendu HTML de chaque route publique)
 *   - les tests de cohérence   (tests/routes.test.ts)
 *
 * ⚠ Ce manifeste doit rester aligné avec le routeur réel (src/App.tsx).
 *   Toute route ajoutée dans App.tsx doit être ajoutée ici (et inversement),
 *   sauf les routes privées (/compte, /compte/dossier/:id, /dossier/nouveau)
 *   et les écrans d'authentification (/connexion, /inscription), exclus de
 *   l'indexation (robots.txt) et du pré-rendu.
 */
import { blogPosts } from './blog/index';
import { features } from './features';
import { legalPages } from './legal';

export type PublicRoute = {
  path: string;
  changefreq: 'weekly' | 'monthly' | 'yearly';
  priority: number;
  /** Date ISO (YYYY-MM-DD) de dernière modification connue, si pertinente. */
  lastmod?: string;
};

const staticRoutes: PublicRoute[] = [
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/fonctionnalites', changefreq: 'monthly', priority: 0.9 },
  { path: '/tarifs', changefreq: 'monthly', priority: 0.9 },
  { path: '/securite', changefreq: 'monthly', priority: 0.8 },
  { path: '/blog', changefreq: 'weekly', priority: 0.8 },
  { path: '/contact', changefreq: 'yearly', priority: 0.5 },
  // Vague 1 — à décommenter au moment où chaque page est ajoutée à src/App.tsx :
  // { path: '/etat-du-produit', changefreq: 'monthly', priority: 0.7 },
  // { path: '/cabinets-avocats', changefreq: 'monthly', priority: 0.8 },
  // { path: '/experts-comptables', changefreq: 'monthly', priority: 0.8 },
  // { path: '/grands-comptes', changefreq: 'monthly', priority: 0.8 },
  // { path: '/rendez-vous', changefreq: 'monthly', priority: 0.7 },
];

export function publicRoutes(): PublicRoute[] {
  return [
    ...staticRoutes,
    ...features.map((f) => ({
      path: `/fonctionnalites/${f.slug}`,
      changefreq: 'monthly' as const,
      priority: 0.7,
    })),
    ...blogPosts.map((p) => ({
      path: `/blog/${p.slug}`,
      changefreq: 'yearly' as const,
      priority: 0.6,
      lastmod: p.date,
    })),
    ...Object.keys(legalPages).map((slug) => ({
      path: `/${slug}`,
      changefreq: 'monthly' as const,
      priority: 0.3,
    })),
  ];
}
