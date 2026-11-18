# Extraction du corpus de recette

La fonction Vercel Node `/api/extraction` lit exclusivement les octets des deux exemples du dépôt. Elle fonctionne en Preview, avec la variable système Vercel `VERCEL_GIT_COMMIT_SHA` fournie par le déploiement Git. Les autres environnements reçoivent HTTP 404. Le site officiel GitHub Pages conserve son build statique habituel.

L’entrée est un GET `/api/extraction?fixture=devis&revision=<sha-du-déploiement>`. L’autre valeur admise pour `fixture` est `scan`. Un SHA différent renvoie 409. Un succès expose `fixture`, `revision`, `sha256`, `method` et `lines`. Seules les réponses réussies sont cachées, pendant 24 heures au CDN Vercel. La synthèse et les autorisations du dossier restent à la charge du serveur de recette. Ce service ne reçoit ni pièce téléchargée, ni identifiant de compte, ni URL de stockage.

Les dépendances Node sont isolées sous `api/` et leur intégrité est fixée par le verrou npm de ce dossier. Dans un clone local, installer avec `npm ci --prefix api --ignore-scripts`, puis tester avec `node --test recette/extraction.test.mjs`. Si une configuration Vercel impose une commande d’installation pour tout le projet, son environnement de preview doit aussi exécuter cette installation sous `api/`. Les dépendances du client Vite restent dans le manifeste racine. L’exécution n’utilise pas le réseau.

- OCR anglais ajusté au scan fictif avec Tesseract.js-core 7.0.0 (Apache-2.0), build WebAssembly LSTM autonome et modèle anglais du paquet @tesseract.js-data/eng 1.0.0, sous-répertoire 4.0.0_best_int. Le paquet de données déclare la licence MIT. [Cœur](https://github.com/naptha/tesseract.js-core) · [Données linguistiques](https://github.com/naptha/tessdata).
- Extraction du texte PDF avec unpdf 2.2.1 (MIT), qui embarque PDF.js (Apache-2.0). [unpdf](https://github.com/unjs/unpdf) · [PDF.js](https://github.com/mozilla/pdf.js).
