/**
 * Entrée serveur — pré-rendu statique des routes publiques (Lot 3).
 *
 * Utilisée uniquement à la compilation par scripts/prerender.ts :
 * `vite build --ssr` produit dist-ssr/entry-server.js, dont render(url)
 * retourne le HTML complet de la route (Suspense/lazy résolus par
 * l'API prerender de React 19) et les métadonnées collectées par <Seo>.
 *
 * Aucun effet ne s'exécute ici (pas de Supabase, pas de réseau) : le HTML
 * produit correspond à l'état initial de la page, que le client hydrate.
 */
import { StrictMode } from 'react';
import { prerender } from 'react-dom/static';
import { StaticRouter } from 'react-router-dom';
import App, { preloadAllRoutes } from './App';
import { AuthProvider } from './lib/auth';
import { setSsrSeoCollector, type CollectedSeo } from './lib/seo';

// Toutes les pages sont résolues AVANT tout rendu : aucune frontière
// Suspense ne suspend côté serveur (voir le commentaire dans App.tsx).
const routesReady = preloadAllRoutes();

export async function render(url: string): Promise<{ html: string; seo: CollectedSeo | null }> {
  let collected: CollectedSeo | null = null;
  setSsrSeoCollector((seo) => {
    collected = seo;
  });
  const app = (
    <StrictMode>
      <StaticRouter location={url}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </StaticRouter>
    </StrictMode>
  );
  try {
    await routesReady;
    // progressiveChunkSize : par défaut (~12,8 Ko), React « outline » le
    // contenu des frontières Suspense volumineuses en segments différés
    // (<!--$?--> + <div hidden> + script), illisibles sans JavaScript.
    // Une valeur très grande force l'inlining complet — c'est le but d'une
    // sortie statique.
    const { prelude } = await prerender(app, { progressiveChunkSize: 64 * 1024 * 1024 });
    const html = await new Response(prelude).text();
    // Garde-fous : la sortie statique doit être entièrement résolue —
    // ni frontière en attente, ni fallback de route dans le HTML servi.
    if (html.includes('<!--$?-->') || html.includes('Chargement…')) {
      throw new Error(`prerender: frontière Suspense non résolue pour ${url}`);
    }
    return { html, seo: collected };
  } finally {
    setSsrSeoCollector(null);
  }
}
