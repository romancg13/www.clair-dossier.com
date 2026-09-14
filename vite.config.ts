import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync } from 'node:fs';
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

// Use VITE_BASE_PATH at build time (set by Pages workflow). Empty default for local dev.
const base = process.env.VITE_BASE_PATH ?? '/';

export default defineConfig({
  base,
  // Flags injectés comme littéraux (voir src/lib/flags.ts) — branche inactive éliminée du bundle.
  define: {
    __HOME_CINEMATIC__: JSON.stringify(readFlag(process.env.VITE_HOME_CINEMATIC, true)),
    __CINEMATICS__: JSON.stringify(readFlag(process.env.VITE_CINEMATICS, true)),
  },
  plugins: [react(), tailwindcss(), spaFallback()],
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
