/**
 * DEFENSE OS — l'application EST l'atelier.
 *
 * Une seule route : le poste de travail. Il n'existe ni page marketing, ni
 * compte en ligne, ni serveur — l'atelier fonctionne fichier ouvert en local,
 * et tout ce qui exige le réseau vit dans la CLI (mandat v4, §3.1).
 */
import { Routes, Route, Navigate } from 'react-router-dom';

import { LdiAtelier } from './pages/LdiAtelier';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LdiAtelier />} />
      {/* Toute autre URL ramène à l'atelier : il n'y a rien d'autre à servir. */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
