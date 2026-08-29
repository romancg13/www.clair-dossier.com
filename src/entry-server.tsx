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
import App from './App';
import { AuthProvider } from './lib/auth';
import { setSsrSeoCollector, type CollectedSeo } from './lib/seo';

export async function render(url: string): Promise<{ html: string; seo: CollectedSeo | null }> {
  let collected: CollectedSeo | null = null;
  setSsrSeoCollector((seo) => {
    collected = seo;
  });
  try {
    const { prelude } = await prerender(
      <StrictMode>
        <StaticRouter location={url}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </StaticRouter>
      </StrictMode>
    );
    const html = await new Response(prelude).text();
    return { html, seo: collected };
  } finally {
    setSsrSeoCollector(null);
  }
}
