import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readFlag } from './src/lib/flag-parse';

// SPA fallback: GitHub Pages serves 404.html on unknown routes — copy index.html
// so BrowserRouter routes survive direct loads / refresh.
function spaFallback(): Plugin {
  return {
    name: 'spa-fallback',
    closeBundle() {
      const dist = resolve(__dirname, 'dist');
      copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'));
    },
  };
}

// Lien court /v (campagne Village de la Justice) : GitHub Pages sert dist/v.html
// sur /v. Seules des valeurs PUBLIQUES y sont injectées (clé Supabase anon, domaine
// Plausible) ; sans elles, la page redirige sans compter.
function shortlinkPage(): Plugin {
  let env: Record<string, string> = {};
  return {
    name: 'shortlink-page',
    apply: 'build',
    configResolved(config) {
      env = config.env;
    },
    closeBundle() {
      const safe = (v: string | undefined) => (v && /^[\w.:/-]+$/.test(v) ? v : '');
      const html = readFileSync(resolve(__dirname, 'src/shortlink/v.html'), 'utf-8')
        .replaceAll('__SUPABASE_URL__', safe(env.VITE_SUPABASE_URL))
        .replaceAll('__SUPABASE_ANON_KEY__', safe(env.VITE_SUPABASE_ANON_KEY))
        .replaceAll('__PLAUSIBLE_DOMAIN__', safe(env.VITE_PLAUSIBLE_DOMAIN));
      const dist = resolve(__dirname, 'dist');
      writeFileSync(resolve(dist, 'v.html'), html);
      mkdirSync(resolve(dist, 'v'), { recursive: true });
      writeFileSync(resolve(dist, 'v', 'index.html'), html); // /v/ (barre finale)
    },
  };
}

// Use VITE_BASE_PATH at build time (set by Pages workflow). Empty default for local dev.
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  // Le dossier statique s'appelle "public/" (CNAME, favicon, mirrors .md, brochure).
  // Un commit l'avait pointé vers "publique/" (dossier inexistant) → assets + CNAME
  // perdus au build. On réaligne sur le dossier réellement présent dans le dépôt.
  publicDir: 'public',
  base,
  // Flags injectés comme littéraux (voir src/lib/flags.ts) — branche inactive éliminée du bundle.
  define: {
    __HOME_CINEMATIC__: JSON.stringify(readFlag(process.env.VITE_HOME_CINEMATIC, true)),
    __CINEMATICS__: JSON.stringify(readFlag(process.env.VITE_CINEMATICS, true)),
    // Horloge du build : le HTML prérendu affiche les campagnes (src/data/campagnes.ts) en cours à cet instant.
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [react(), tailwindcss(), spaFallback(), shortlinkPage()],
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // L'assistant de préchargement de Vite (module virtuel) est partagé par tous les
          // imports dynamiques : il voyage avec le chunk React, toujours chargé — sinon Rollup
          // le range dans un chunk différé (three) et force son préchargement partout.
          if (id.includes('vite/preload-helper')) return 'react';
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('/scheduler/')) return 'react';
            // Couche 3D (Phase 4b) : chunk dédié, importé dynamiquement après le LCP.
            if (id.includes('/three/') || id.includes('@react-three/') || id.includes('three-stdlib') || id.includes('/maath/')) return 'three';
            if (id.includes('motion')) return 'motion';
            if (id.includes('react-router')) return 'router';
            if (id.includes('@supabase')) return 'supabase';
            if (id.includes('@fontsource')) return 'fonts';
          }
        },
      },
    },
  },
  optimizeDeps: { include: ['react', 'react-dom', 'motion'] },
  server: { port: 5173, strictPort: false },
});
