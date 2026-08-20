import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// HashRouter, pas BrowserRouter : le build doit s'ouvrir FICHIER EN LOCAL
// (file://), où l'API history est inutilisable. Le hash porte la vue.
import { HashRouter } from 'react-router-dom';
import App from './App';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Élément #root introuvable');

createRoot(container).render(
  <StrictMode>
    <HashRouter>
      <App />
    </HashRouter>
  </StrictMode>
);
