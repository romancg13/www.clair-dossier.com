import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * Build AUTONOME : un seul fichier, ouvrable depuis le disque (file://).
 *
 * Les modules ES sont bloqués en file:// par Chromium : la sortie est donc un
 * IIFE unique, imports dynamiques repliés, et TOUT est inliné — scripts,
 * styles, polices (woff2 en data:). C'est la forme « fichier ouvert en
 * local, sans serveur » exigée par §3.1 ; `scripts/build-atelier.mjs`
 * assemble ensuite l'HTML final.
 */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist-autonome-brut',
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: false,
    // Tout inline : polices comprises. Le fichier grossit, mais il est UN.
    assetsInlineLimit: 100_000_000,
    rollupOptions: {
      output: {
        format: 'iife',
        inlineDynamicImports: true,
      },
    },
  },
});
