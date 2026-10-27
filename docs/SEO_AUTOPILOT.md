# Autopilot SEO & performance — ClairDossier

Objectif : surveiller et corriger en continu le référencement et la performance,
**sans jamais publier automatiquement** (un push sur `main` = production).
Toute correction naît sur une branche et attend une revue humaine.

## Garde-fous (non négociables)

- Aucune publication automatique : l'autopilot écrit sur une branche dédiée
  (`seo/autopilot-AAAAMMJJ`) et ouvre au plus une PR ; jamais de push sur `main`.
- Aucune promesse de classement : on mesure des scores et des états, on ne
  « garantit » jamais une position Google.
- Aucun contenu généré en masse : pas de pages satellites, pas de keyword
  stuffing, pas de faux avis ni de FAQ artificielle (politiques spam Google).
- Un score simulé (lab) n'est jamais présenté comme une mesure terrain (CrUX).

## Vérifications déjà mécanisées dans le dépôt (chaque build)

`npm run build` échoue ou avertit déjà sur l'essentiel de l'on-page :

| Contrôle | Où | Effet |
|---|---|---|
| Titres uniques, H1 unique par page | scripts/prerender.ts | erreur / avertissement |
| Descriptions 50–160, titres ≤ 70 | scripts/prerender.ts | avertissement (0 au 2026-10-26) |
| Route noindex listée au sitemap (soft 404) | scripts/prerender.ts | erreur (build bloqué) |
| Canonical + JSON-LD injectés par route | scripts/prerender.ts | automatique |
| Sitemap : `lastmod` = vraies dates git, jamais la date du build | scripts/gen-sitemap.ts | automatique |
| Pages privées hors sitemap | src/data/routes.ts (`publicRoutes`) | automatique |

## Mesure reproductible

```bash
# 3 passes Lighthouse mobile sur n'importe quelle URL (médiane à retenir) :
bash scripts/lh-run.sh https://www.clair-dossier.com/ prod 3 mobile
bash scripts/lh-run.sh https://www.clair-dossier.com/ prod 1 desktop
```

Rapports JSON conservés dans `~/.cache/clairdossier-lh/`. Référence au
2026-10-26 : prod mobile 98-99, preview branche 100 ; TBT ≈ 0 ; LCP ≈ 1,0-1,3 s.
Attention : une mesure sur `vite preview` (HTTP/1.1 local) surestime FCP/LCP
d'environ 2 s par rapport à un hébergement H2 réel — comparer local à local,
ou preview Vercel à production.

## Cadences proposées (à activer par Roman via les tâches planifiées Claude)

- **Hebdomadaire** : `lh-run` sur `/`, `/tarifs`, `/fonctionnalites`, `/securite`
  (mobile ×3) ; comparer aux médianes précédentes ; alerter si perf < 95,
  TBT > 200 ms, CLS > 0,1 ou SEO < 100. Vérifier `robots.txt`, `sitemap.xml`
  et `llms.txt` servis en prod (HTTP 200, contenu attendu).
- **Mensuel** : revue Search Console (impressions, couverture, enrichissements) —
  nécessite un accès propriétaire, non disponible aux sessions actuelles ;
  contrôle des données structurées (Rich Results Test) ; re-crawl des pages
  modifiées dans le mois ; mise à jour de l'analyse concurrentielle.
- **Sur événement** (nouvelle page, refonte) : build (gates SEO) + `lh-run`
  avant/après sur la preview Vercel isolée, jamais sur la prod.

Chaque exécution qui détecte un écart produit : un diagnostic, un correctif sur
branche, et s'arrête là. La mise en production reste une décision humaine
(« JE VALIDE LA MISE EN PRODUCTION »).

## Référencement IA (état au 2026-10-26)

- `public/llms.txt` : descriptif exact du produit pour les assistants.
- `robots.txt` : mêmes règles pour tous ; robots IA nommés explicitement —
  `OAI-SearchBot` (recherche ChatGPT, citations) distinct de `GPTBot`
  (entraînement), `ChatGPT-User`, `ClaudeBot`, `Claude-Web`, `PerplexityBot`,
  `Google-Extended` — tous autorisés sur les pages publiques, espaces privés
  exclus. Pas de « GEO hack » : le contenu sert les mêmes pages aux humains
  et aux robots (le prérendu garantit un HTML complet sans JavaScript).
- Google AI Overviews / Bing Copilot : aucun opt-in spécifique requis tant que
  l'indexation classique est propre (sitemap, canonical, contenu rendu).

## Activation (2026-10-26)

Tâche planifiée locale `clairdossier-seo-hebdo` (application Claude, lundi
8 h) : Lighthouse mobile ×3 sur 4 pages + contrôles robots/sitemap/llms en
production, **lecture seule**, rapport de 10 lignes, aucun correctif appliqué.
Elle tourne quand l'application est ouverte (sinon au lancement suivant).

## Search Console et Bing — préparation (action propriétaire, ~10 min)

Aucun code à modifier : la méthode recommandée est la propriété **Domaine**
(DNS), qui couvre `www`, l'apex et les sous-domaines.

1. https://search.google.com/search-console → Ajouter une propriété →
   « Domaine » → `clair-dossier.com` → copier l'enregistrement
   `google-site-verification=…` → l'ajouter en **TXT** à la racine du DNS
   chez le registraire → « Valider ».
2. Sitemaps → soumettre `https://www.clair-dossier.com/sitemap.xml`.
3. https://www.bing.com/webmasters → « Importer depuis Google Search
   Console » (reprend propriété et sitemap ; Bing alimente aussi Copilot).
4. Facultatif : ajouter en utilisateur (lecture) le compte qui pilote
   l'autopilot, pour joindre impressions et couverture au rapport mensuel.

Sans ces accès, l'autopilot mesure le lab et l'état servi, pas les
impressions/clics réels ni les erreurs de couverture. Ne pas utiliser
l'Indexing API de Google : réservée aux offres d'emploi et diffusions en
direct.
