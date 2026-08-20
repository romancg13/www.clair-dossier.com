import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  // Chemins relatifs : le build doit s'ouvrir depuis le disque, pas seulement
  // depuis un serveur — c'est la contrainte « fichier ouvert en local » (§3.1).
  base: './',
  plugins: [react(), tailwindcss()],
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
            if (id.includes('react-router')) return 'router';
            if (id.includes('@fontsource')) return 'fonts';
          }
        },
      },
    },
  },
  optimizeDeps: { include: ['react', 'react-dom'] },
  server: { port: 5173, strictPort: false },
});
