import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
  plugins: [react(), tailwindcss(), spaFallback()],
  build: {
    target: 'es2022',
    sourcemap: false,
    cssCodeSplit: true,
    assetsInlineLimit: 4096,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom') || id.includes('/react/')) return 'react';
            if (id.includes('motion')) return 'motion';
            if (id.includes('react-router')) return 'router';
            if (id.includes('@fontsource')) return 'fonts';
          }
        },
      },
    },
  },
  optimizeDeps: { include: ['react', 'react-dom', 'motion'] },
  server: { port: 5173, strictPort: false },
});
