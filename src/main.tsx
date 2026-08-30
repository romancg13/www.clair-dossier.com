import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './lib/auth';
import { initAnalytics } from './lib/analytics';
import './index.css';

// Mesure d'audience sans cookie (Lot 2.1) — no-op tant que
// VITE_PLAUSIBLE_DOMAIN n'est pas configuré.
initAnalytics();

const container = document.getElementById('root');
if (!container) throw new Error('Missing #root element');

const app = (
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

// Routes publiques pré-rendues (Lot 3) : #root contient déjà le HTML de la
// page → hydratation. Coquille SPA vierge (routes privées, fallback) :
// rendu client classique, comportement inchangé.
if (container.firstElementChild) {
  hydrateRoot(container, app);
} else {
  createRoot(container).render(app);
}
