# Application installable (PWA) — ce qui est fait, vérifié, et ce qui reste à confirmer

Un seul produit : l'application installée EST le site, ouvert depuis l'écran d'accueil. Même code, mêmes comptes, même serveur,
mêmes abonnements. Aucune application native, aucun second backend, aucune donnée gardée sur l'appareil.

## Fichiers

| Fichier | Rôle |
|---|---|
| `public/manifest.webmanifest` | nom, identifiant stable `/?app=clairdossier`, plein écran, couleurs, icônes, raccourcis (Mes dossiers, Nouveau dossier) |
| `public/sw.js` | service worker minimal : met en cache UNIQUEMENT `/hors-connexion.html` et une icône ; n'intercepte que les navigations ; exclut `/api`, `/oauth`, `/mcp` |
| `public/hors-connexion.html` | écran hors connexion (aucune donnée) |
| `public/pwa.json` | coupe-circuit : `{ "actif": false }` désinscrit le service worker et vide ses caches à la visite suivante |
| `src/lib/pwa.ts`, `src/components/pwa/InstallApp.tsx` | enregistrement, invitation d'installation, consignes par plateforme, proposition de mise à jour |
| `scripts/preview-neutralise.mjs --pwa=recette\|demo`, `recette/pwa/` | recette et démonstration : nom « ClairDossier Recette / Démo », identifiant distinct, icône barrée « RECETTE » |
| `tests/pwa.test.ts` | garde-fous rejoués par la CI (`pr-checks.yml`) à chaque évolution |

## Matrice de compatibilité

Statuts : RÉEL = constaté sur l'appareil · ÉMULÉ = Chromium automatisé (ordinateur 1440 px, téléphone 390 px) · À CONFIRMER = aucun appareil disponible dans cette session.

| Fonction | Offre | Navigateur (onglet) | Application installée | Plateforme testée | Statut | Limitation |
|---|---|---|---|---|---|---|
| Toutes les fonctions A→N de `ETAT_FONCTIONNALITES.md` | selon l'abonnement | identiques | identiques (même code, même API) | Chromium | ÉMULÉ | le statut de chaque fonction reste celui de l'inventaire |
| Manifeste, icônes, identité de recette | gratuit | oui | oui | Chromium | ÉMULÉ | — |
| Bouton « Installer l'application » (Mon compte, connexion) | gratuit | oui | masqué une fois installée | Chromium | ÉMULÉ | — |
| Invitation native en un clic | gratuit | Chrome, Edge, Android | — | aucune | À CONFIRMER | ne se déclenche pas en navigateur automatisé |
| iPhone / iPad : Partager → Sur l'écran d'accueil | gratuit | Safari | oui | aucune | À CONFIRMER | consigne affichée ; pas d'invitation automatique sur iOS |
| Mac Safari : Ajouter au Dock | gratuit | Safari récent | oui | aucune | À CONFIRMER | — |
| Windows / Mac / Linux : Chrome ou Edge | gratuit | oui | oui | Chromium Linux | ÉMULÉ | Firefox ordinateur n'installe pas d'application : le site reste utilisable |
| Hors connexion : écran simple, rien d'ancien | toutes | oui | oui | Chromium | ÉMULÉ | aucun travail hors ligne, volontairement |
| Cache sans donnée privée | toutes | oui | oui | Chromium | ÉMULÉ | — |
| Mise à jour proposée, jamais imposée | toutes | oui | oui | — | À CONFIRMER | à observer au prochain déploiement |
| Désactivation à distance | interne | oui | oui | Chromium | ÉMULÉ | — |
| Dépôt, photo, fichiers du téléphone | toutes | oui | oui | Chromium (fichiers) | ÉMULÉ / À CONFIRMER pour la photo | un dépôt en cours s'interrompt si l'application est fermée : les fichiers déjà reçus continuent d'être traités par le serveur |
| Automatisations application fermée | toutes | oui | oui | serveur | voir G-05 | elles tournent sur le serveur, jamais dans le service worker |
| Notifications poussées | toutes | — | — | — | NON DÉVELOPPÉ | iOS : seulement application installée ; exige des clés d'envoi côté serveur |
| Partage d'un fichier vers ClairDossier | toutes | — | — | — | NON DÉVELOPPÉ | Android/Chrome seulement |
| Connexion Gmail/Outlook, paiement : retour dans l'application | selon offre | — | — | — | BLOQUÉ | applications OAuth et bac à sable Stripe absents |

Sessions : sur iPhone, l'application installée ne partage pas la session de Safari ; une connexion est demandée une fois, puis conservée.

## Sécurité

- Rien de privé dans Cache Storage, IndexedDB, localStorage ou sessionStorage (inspecté après dépôt, six rendus et archive).
- Les réponses d'API portent `cache-control: no-store` ; les fichiers par lien signé `private, no-store`.
- Hors connexion, aucune authentification n'est contournée : l'écran dit seulement que les dossiers sont sur le serveur.
- L'essai prospect ne peut pas être remis à zéro par l'installation : le compteur est côté serveur, lié au compte.

## Retour arrière (testé en local)

1. Publier `public/pwa.json` avec `{ "actif": false }` : chaque appareil désinscrit le service worker et vide ses caches à sa prochaine ouverture.
2. Ou revenir au commit précédent : sans `sw.js`, le navigateur abandonne l'ancien service worker après son contrôle de mise à jour.
L'application déjà installée reste une simple icône vers le site : elle continue de fonctionner.

## Production

La PWA arrive en production avec la fusion de la PR #71 (GitHub Pages). GitHub Pages ne permet pas de régler les en-têtes : `sw.js` y est
revalidé par le navigateur (règle des 24 h) et l'enregistrement utilise `updateViaCache: 'none'`. À vérifier après fusion : `/manifest.webmanifest`, `/sw.js`, installation réelle sur un téléphone.
