// Service worker ClairDossier — volontairement MINIMAL.
// Il ne met en cache QUE la page « hors connexion » et son icône (ressources publiques).
// Jamais : une réponse d'API, un document, un rendu, une conversation, un lien signé, un retour OAuth ou de paiement.
// Les fichiers versionnés (/assets/*) restent gérés par le cache HTTP du navigateur.
// Désactivation à distance : /pwa.json { "actif": false } (voir src/lib/pwa.ts) ; ce fichier se désinscrit alors.
const CACHE = 'clairdossier-hors-connexion-v1';
const PUBLIC = ['/hors-connexion.html', '/icon-192.png'];
const PRIVE = /^\/(api|oauth|mcp|\.well-known)(\/|$)/;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PUBLIC)));
  // Pas de skipWaiting automatique : la nouvelle version attend l'accord de l'utilisateur (message ci-dessous).
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('clairdossier-') && k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'ACTIVER') self.skipWaiting();
  if (e.data === 'DESACTIVER') e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).then(() => self.registration.unregister()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  if (r.method !== 'GET' || r.mode !== 'navigate') return; // tout le reste passe par le réseau, sans intervention
  const u = new URL(r.url);
  if (u.origin !== self.location.origin || PRIVE.test(u.pathname)) return;
  // Navigation : toujours le réseau ; seulement en cas d'échec réseau, la page « hors connexion ».
  e.respondWith(fetch(r).catch(() => caches.match('/hors-connexion.html').then((p) => p || Response.error())));
});
