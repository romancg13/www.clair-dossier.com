# Baseline ClairDossier v1 — Phase 0A (Snapshot)

> Document de référence unique permettant de répondre à tout moment à la question : **« La nouvelle version possède-t-elle encore tout ce que possédait l'ancienne ? »** (constitution `docs/MASTER_PROMPT.md`, PARTIE I.2 et PARTIE III.1).
>
> Règle n°1 : **ne jamais détruire l'existant**. Ce document décrit l'état « avant » ; toute évolution ultérieure doit être comparée à lui (Inter-Phase Gate, PARTIE XI.2).

---

## 0. En-tête

| Élément | Valeur |
|---|---|
| Date de la baseline | **2026-08-23** |
| Commit de référence (site d'origine) | `24e1e2b37d556f9e11b00ce66c7fffd7d624e60e` — 2026-07-02 16:41:05 +0200 — « Ameliore les animations visuelles premium » = HEAD de `main` = code déployé en production |
| Branche de travail | `feature/clairdossier-next`, créée depuis `main`. Au moment de la baseline elle porte un seul commit supplémentaire, `ab2b00b` (2026-08-23 18:06 +0200, « chore(governance): install MASTER_PROMPT constitution, CLAUDE.md, guardrails, sub-agents and Phase 0 baseline captures »), qui n'ajoute **que** des fichiers de gouvernance et de documentation (`.claude/`, `AGENTS.md`, `CLAUDE.md`, `docs/`) — **aucun fichier du site (`src/`, `public/`, `supabase/`, `scripts/*.mjs|ts`, configs) n'est modifié**. |
| Dépôt | `/Users/Roman_784/Documents/Codex/2026-07-02/contrainte-absolue-ne-pas-toucher-aux/work/www.clair-dossier.com` — origin `https://github.com/romancg13/www.clair-dossier.com.git` |
| URL de production | `https://www.clair-dossier.com` (servi par GitHub Pages, en-tête `server: GitHub.com`, `last-modified: Thu, 02 Jul 2026 14:49:04 GMT`) |
| Méthode de vérification | Build local le 2026-08-23 (node v24.19.0, npm 11.17.0) : `npm run typecheck` OK, `npm run build` OK en 941 ms. Les hashes des chunks `react-CBBoJgXi.js`, `supabase-Buf76L6m.js`, `motion-ZtdEAC6k.js`, `router-CjS7eph5.js`, `index-B6lhu7zR.css` sont **identiques à la production** ; seul `index-*.js` diffère (`index-DOvyzgrX.js` local vs `index-BEZEsRp_.js` prod) car `VITE_SUPABASE_*` sont injectées au build CI (`.github/workflows/deploy.yml:39-43`). Le dépôt local reproduit donc le site live. |
| Fichiers ajoutés en Phase 0 (commit `ab2b00b` + non suivis) | `.claude/agents/*.md` (18 sous-agents), `.claude/settings.json`, `AGENTS.md`, `CLAUDE.md`, `docs/MASTER_PROMPT.md`, `docs/baseline/README.md`, `docs/baseline/audit/*.md` (7 rapports), `docs/baseline/screens/` (48 captures + `index.json`), `scripts/guard_destructive.py`, ainsi que `docs/baseline/STRIPE_SUPABASE_MAP.md` (non suivi au moment de la rédaction). Ils ne font **pas** partie du site d'origine et ne sont pas décrits comme tels dans les sections 1 à 12. |
| Convention de citation | `fichier:ligne` relatif à la racine du dépôt. Les faits live sont marqués « vérifié en prod » (curl/HEAD du 2026-08-23). Ce qui n'a pas pu être vérifié est marqué **À VÉRIFIER**. |

### Rapports sources

Les faits ci-dessous sont consolidés depuis sept audits de lecture seule réalisés le 2026-08-23. Ils ont été rédigés dans un répertoire scratch **éphémère** (chemins ci-dessous) puis copiés dans le dépôt sous `docs/baseline/audit/<nom>.md` par le commit `ab2b00b`. La présente baseline reste le document de référence ; les rapports servent de pièces justificatives détaillées.

| Rapport | Copie versionnée | Chemin scratch d'origine (éphémère) | Périmètre |
|---|---|---|---|
| routes-seo | `docs/baseline/audit/routes-seo.md` | `/private/tmp/claude-502/-Users-Roman-784/4bec9f02-806e-4685-b26d-f923c1c7628b/scratchpad/baseline/audit/routes-seo.md` | Routes `App.tsx`, SEO (`seo.tsx`), sitemap/robots/llms, pipeline Pages/Netlify, build, env |
| design | `docs/baseline/audit/design.md` | `…/scratchpad/baseline/audit/design.md` | Tokens `@theme`, composants UI, primitives motion, Nav/Footer/Logo, grilles, 10 détails signature, ADN |
| public-content | `docs/baseline/audit/public-content.md` | `…/scratchpad/baseline/audit/public-content.md` | Home section par section, pages publiques, données (features, FAQ, statuts, blog), coordonnées |
| app-auth | `docs/baseline/audit/app-auth.md` | `…/scratchpad/baseline/audit/app-auth.md` | Auth Supabase, appels Supabase exhaustifs, DossierFlow/Account/DossierDetail, admin, localStorage |
| supabase | `docs/baseline/audit/supabase.md` | `…/scratchpad/baseline/audit/supabase.md` | `config.toml`, tables, policies RLS, fonctions/triggers, bucket, edge function |
| stripe-pricing | `docs/baseline/audit/stripe-pricing.md` | `…/scratchpad/baseline/audit/stripe-pricing.md` | 7 formules, matrice, Payment Links, scripts Stripe, absences |
| live-site | `docs/baseline/audit/live-site.md` | `…/scratchpad/baseline/audit/live-site.md` | Codes HTTP, en-têtes, redirections, assets, markdown par page, coordonnées |
| identity-legal | `docs/baseline/audit/identity-legal.md` | `…/scratchpad/baseline/audit/identity-legal.md` | Occurrences noms/téléphones/e-mails/adresses, contenu des 4 pages légales |

---

## 1. Stack & toolchain

### 1.1 `package.json` (`name: clairdossier-showcase`, `version: 0.1.0`, `type: module`)

| Dépendance | Plage déclarée (`package.json`) | Version installée (`package-lock.json`) | Rôle |
|---|---|---|---|
| `react` / `react-dom` | `^19.0.0` | 19.2.6 | UI |
| `react-router-dom` (→ `react-router`) | `^7.1.0` | 7.15.1 | Routage (`BrowserRouter`, `main.tsx:13`) |
| `motion` | `^11.15.0` | 11.18.2 | Animations (primitives, Nav, Hero, Tabs, Accordion) |
| `@supabase/supabase-js` | `^2.108.2` | 2.108.2 | Auth + DB + Storage (`src/lib/supabase.ts`) |
| `fflate` | `^0.8.3` | 0.8.3 | Zip côté client (`DossierDetail.tsx:3`) |
| `@fontsource/cormorant-garamond` | `^5.2.5` | 5.2.11 | Police display |
| `@fontsource/inter` | `^5.2.5` | 5.2.8 | Police texte |
| `@fontsource/jetbrains-mono` | `^5.2.5` | 5.2.8 | Police mono |
| `vite` (dev) | `^6.0.0` | 6.4.2 | Bundler |
| `@vitejs/plugin-react` (dev) | `^4.3.4` | 4.7.0 | |
| `tailwindcss` / `@tailwindcss/vite` (dev) | `^4.0.0` | 4.3.0 | Tailwind v4 (`@import "tailwindcss"` dans `src/index.css:1`) |
| `typescript` (dev) | `^5.7.0` | 5.9.3 | |
| `tsx` (dev) | `^4.19.0` | 4.22.4 | Exécute `scripts/gen-markdown.ts` |
| `@types/node` / `@types/react` / `@types/react-dom` (dev) | `^22` / `^19` / `^19` | 22.19.19 / — / — | |

**Absents** : aucun ESLint, Prettier, Vitest, Jest, Playwright, Testing Library ; aucun SDK `stripe` (les scripts `scripts/*.mjs` l'importent sans qu'il soit déclaré). Pas de champ `engines` ni `packageManager`.

### 1.2 Scripts npm (`package.json:6-12`)

| Script | Commande | Remarque |
|---|---|---|
| `dev` | `vite` | port 5173 (`vite.config.ts:45`) |
| `gen:md` | `tsx scripts/gen-markdown.ts` | Écrit 27 fichiers `.md` dans `public/` (suivis par git) |
| `build` | `npm run gen:md && tsc -p tsconfig.json && vite build` | Le build **modifie l'arbre de travail** (`public/**/*.md`) |
| `preview` | `vite preview --port 4173` | |
| `typecheck` | `tsc -p tsconfig.json --noEmit` | |
| `lint` / `test` | **inexistants** | |

### 1.3 Runtimes

| Contexte | Node | npm |
|---|---|---|
| Build local 2026-08-23 | v24.19.0 | 11.17.0 |
| CI GitHub Actions | 22 (`deploy.yml:29`, `actions/setup-node@v4`) | cache npm |
| Netlify | 22 (`netlify.toml:8` `NODE_VERSION = "22"`) | — |

### 1.4 Configuration TypeScript / Vite

- `tsconfig.json` : `target ES2022`, `module ESNext`, `moduleResolution bundler`, `jsx react-jsx`, `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `noEmit`, `include: ["src", "vite.config.ts"]` (`tsconfig.json:2-28`). **`scripts/` est hors typecheck.**
- `vite.config.ts` : `base = process.env.VITE_BASE_PATH ?? '/'` (`:20,23`) ; plugins `react()`, `tailwindcss()`, `spaFallback()` (copie `dist/index.html` → `dist/404.html`, `:9-17`) ; `build.target es2022`, `sourcemap false`, `cssCodeSplit true`, `assetsInlineLimit 4096` (`:26-29`) ; `manualChunks` : `react`, `motion`, `router`, `supabase`, `fonts` (`:32-40` — le chunk `fonts` n'est jamais émis, règle morte) ; `optimizeDeps.include` react/react-dom/motion (`:44`).
- `src/vite-env.d.ts` : une seule ligne `/// <reference types="vite/client" />` (aucun typage des variables `VITE_*`).

---

## 2. Hébergement & pipeline

### 2.1 Vue d'ensemble

```
push sur main ──► GitHub Actions (.github/workflows/deploy.yml) ──► npm ci ──► npm run build ──► dist/ ──► GitHub Pages ══► https://www.clair-dossier.com  (PROD)
                  env : VITE_BASE_PATH=/, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (en clair dans le YAML, deploy.yml:39-43)

(parallèle, hors dépôt) Netlify (netlify.toml) ──► npm run build ──► dist/ ══► https://clair-dossier.netlify.app  (NON actif sur le domaine)
```

### 2.2 GitHub Pages — `.github/workflows/deploy.yml` (seul workflow)

| Élément | Valeur | Ligne |
|---|---|---|
| Déclencheurs | `push` sur `main`, `workflow_dispatch` | `:8-11` |
| Commentaire d'intention | DNS (whois.com) pointe vers GitHub Pages « tant que le DNS n'est pas basculé vers Netlify » ; Netlify = « cible finale » | `:3-6` |
| Permissions | `contents: read`, `pages: write`, `id-token: write` | `:13-16` |
| Job `build` | ubuntu-latest, checkout@v4, setup-node@v4 (Node 22), configure-pages@v5, `npm ci`, `npm run build`, upload-pages-artifact@v3 (`./dist`) | `:23-48` |
| Variables au build | `VITE_BASE_PATH: /`, `VITE_SUPABASE_URL: https://buzgokfmxpmyceppvjpp.supabase.co`, `VITE_SUPABASE_ANON_KEY: <JWT anon complet>` | `:39-43` |
| Job `deploy` | `needs: build`, environnement `github-pages`, deploy-pages@v4 | `:50-58` |
| Secrets GitHub | aucun `${{ secrets.* }}` | — |
| Étapes backend | **aucune** (`supabase db push`, `functions deploy` absents → déploiement Supabase manuel) | — |

### 2.3 Netlify — `netlify.toml` (cible parallèle, **non active sur le domaine**)

| Élément | Valeur | Ligne |
|---|---|---|
| Build | `npm run build`, publish `dist`, Node 22 | `:3-8` |
| SPA fallback | `[[redirects]] from="/*" to="/index.html" status=200` | `:13-16` |
| En-têtes `/*` | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`, CSP | `:19-26` |
| CSP | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://buzgokfmxpmyceppvjpp.supabase.co wss://buzgokfmxpmyceppvjpp.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://buy.stripe.com` | `:26` |
| Cache | `/assets/*` → `max-age=31536000, immutable` ; `/index.html` → `max-age=0, must-revalidate` | `:29-37` |
| Vérifié en prod Netlify | `https://clair-dossier.netlify.app/tarifs` → `200`, CSP + HSTS `max-age=31536000; includeSubDomains; preload` + `x-frame-options: DENY` présents | — |

### 2.4 DNS, domaine, CNAME (vérifié en prod le 2026-08-23)

| Élément | Valeur |
|---|---|
| `www.clair-dossier.com` | CNAME → `romancg13.github.io.` (A 185.199.108/109/110/111.153) |
| `clair-dossier.com` (apex) | A 185.199.108/109/110/111.153 ; pas d'AAAA |
| MX / TXT (SPF, DMARC) | **aucun** — le domaine n'envoie pas de courrier ; pourtant `supabase/config.toml:222` et `notify-lead/index.ts:7` utilisent `noreply@clair-dossier.com` comme expéditeur via Resend (**À VÉRIFIER** : domaine vérifié côté Resend ?) |
| NS | `ns1..ns4.whois.com.` |
| Certificat | Let's Encrypt, `CN=www.clair-dossier.com`, expiration 2026-10-22 ; TLS 1.3, h2 |
| `public/CNAME:1` | `www.clair-dossier.com` (copié dans `dist/CNAME`) |
| Hôte canonique | **www** partout : `seo.tsx:13`, `index.html:12,26-27,36`, `sitemap.xml`, `robots.txt:21`, `llms.txt`, `gen-markdown.ts:32`. Seule exception textuelle : `clair-dossier.com` (apex) dans `legal.ts:25,28` |
| Vérification Google | balise `<meta name="google-site-verification" content="yKED4w0FJ9KypEjb814a_MoyCkGpPRjWR8KVPEhDQ7c">` (`index.html:9`) ; pas de TXT DNS |

### 2.5 Redirections (vérifié en prod)

| Requête | Statut | Location |
|---|---|---|
| `http://www.clair-dossier.com/` | **200** (servi en clair, pas de redirection HTTPS) | — |
| `http://clair-dossier.com/` | 301 | `http://www.clair-dossier.com/` (reste en http) |
| `https://clair-dossier.com/` | 301 | `https://www.clair-dossier.com/` |
| `https://clair-dossier.com/tarifs` | 301 | `https://www.clair-dossier.com/tarifs` → puis 404 |
| `/fonctionnalites`, `/blog` (sans slash) | 301 → `/fonctionnalites/`, `/blog/` → **404** (répertoires `.md` existants, pas d'`index.html`) | — |
| `https://romancg13.github.io/` | 404 | — |

### 2.6 SPA fallback et problème des 404

- Mécanisme : `vite.config.ts:9-17` copie `dist/index.html` en `dist/404.html` (identiques, 3 759 octets).
- GitHub Pages sert `404.html` pour tout chemin inexistant **avec le statut HTTP 404**. Vérifié en prod : `/tarifs`, `/blog/mise-en-demeure`, `/dossier/nouveau`, `/connexion`, `/compte` → `HTTP/2 404`, même `etag "6a467a60-eaf"` que `/`.
- **Conséquence : 25 des 26 URL du sitemap répondent 404 ; seule `/` répond 200.** Le rendu React est correct pour un humain (les 48 captures de `docs/baseline/screens/` le prouvent) mais les moteurs reçoivent un 404 (risque R-SEO-1, §15).
- Sur Netlify le même chemin répond 200 (`netlify.toml:13-16`).

### 2.7 En-têtes effectifs (GitHub Pages) vs déclarés (Netlify)

| En-tête | Déclaré (`netlify.toml`) | Effectif en prod (`www.clair-dossier.com`) |
|---|---|---|
| `Content-Security-Policy` | oui (`:26`) | **absent** |
| `Strict-Transport-Security` | (Netlify natif) | **absent** |
| `X-Frame-Options` | `DENY` | **absent** |
| `X-Content-Type-Options` | `nosniff` | **absent** |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | **absent** |
| `Permissions-Policy` | oui | **absent** |
| `Cache-Control` assets | `immutable, 1 an` | `max-age=600` sur tout (y compris `/assets/*.js`) |
| `Access-Control-Allow-Origin` | — | `*` |
| Compression | — | gzip (pas de Brotli) ; CDN Fastly (`via: 1.1 varnish`, `x-served-by: cache-par-…`) |

---

## 3. Routes

Source : `src/App.tsx` (un seul `<Routes>` `:48`, route parente `<Layout />` `:49` ; `Layout` = `Nav` + `<main id="main">` + `Footer`, scroll-to-top et focus `<main>` à chaque `pathname`, `Layout.tsx:13-33`). `Home` en eager (`App.tsx:7`) ; toutes les autres pages en `lazy()` chacune dans son `<Suspense fallback={<RouteFallback />}>` (`App.tsx:12-44`). Routeur `BrowserRouter` dans `AuthProvider` (`main.tsx:13-14`).

### 3.1 Tableau des routes

Légende : Titre final = `document.title` après `seo.tsx:36` (suffixe « — ClairDossier · Dossier juridique clair, structuré et suivi » si le titre ne contient pas « ClairDossier »). `.md` = fichier markdown servi aux crawlers (`public/`). HTTP live = statut au chargement direct (vérifié en prod / `docs/baseline/screens/index.json`).

| # | Route | Page (fichier) | Lazy | Auth | Titre final (`<Seo>`) | JSON-LD | Sitemap | `.md` crawler | HTTP live |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `/` | `Home` (`src/pages/Home.tsx`) | non | non | ClairDossier — Votre dossier juridique, clair, structuré et suivi (`Home.tsx:46`) | `Organization`, `WebSite`+`SearchAction`, `SoftwareApplication` (LegalService, Offer 19 EUR), `FAQPage` (`Home.tsx:15-40,49`) | oui (1.0) | `/index.md` = `/page.md` | **200** |
| 2 | `/fonctionnalites` | `FeaturesIndex` | oui | non | Fonctionnalités — … (`FeaturesIndex.tsx:20`) | `BreadcrumbList` + 9 × `Service` (`:7-14,23-29`) | oui (0.9) | `/fonctionnalites/index.md` | 301 → `/fonctionnalites/` → **404** |
| 3 | `/fonctionnalites/:slug` (×9) | `FeatureDetail` | oui | non | `feature.title` + suffixe (`FeatureDetail.tsx:19-38`) | `BreadcrumbList` (3 niv.) + `Service` | oui ×9 (0.7) | `/fonctionnalites/<slug>.md` ×9 | **404** |
| 4 | `/tarifs` | `Pricing` | oui | non | Tarifs — … (`Pricing.tsx:95-124`) | `BreadcrumbList` + `SoftwareApplication` (BusinessApplication, `AggregateOffer` 19–299 EUR) (`:104-122`) | oui (0.9) | `/tarifs.md` | **404** |
| 5 | `/securite` | `Security` | oui | non | Sécurité & conformité — … (`Security.tsx:80-88`) | `BreadcrumbList` | oui (0.8) | `/securite.md` | **404** |
| 6 | `/blog` | `BlogIndex` | oui | non | Journal — … (`BlogIndex.tsx:15-39`) | `BreadcrumbList` + `Blog` (7 × `BlogPosting`, author `Person`) | oui (0.8) | `/blog/index.md` | 301 → `/blog/` → **404** |
| 7 | `/blog/:slug` (×7) | `BlogPost` | oui | non | `post.metaTitle` + suffixe (`BlogPost.tsx:80-94`), `og:type=article` | `BreadcrumbList` + `BlogPosting` (author `Organization`) + `FAQPage` (`:33-73`) | oui ×7 (0.6, `lastmod`) | `/blog/<slug>.md` ×7 | **404** |
| 8 | `/contact` | `Contact` | oui | non | Contact — … (`Contact.tsx:42-50`) | `BreadcrumbList` | oui (0.5) | `/contact.md` | **404** |
| 9 | `/dossier/nouveau` | `DossierFlow` | oui | **oui** (`App.tsx:110`) | Créer un dossier — … (`DossierFlow.tsx:403-411`), **index** (pas de noindex) | `BreadcrumbList` | non (`Disallow: /dossier/` `robots.txt:3`) | non | **404** (redirigé côté client vers `/connexion?next=%2Fdossier%2Fnouveau`) |
| 10 | `/inscription` | `Signup` | oui | non | Créer un compte — … (`Signup.tsx:53-58`), noindex | aucun | non | non | **404** |
| 11 | `/connexion` | `Login` | oui | non | Connexion — … (`Login.tsx:36-41`), noindex ; lit `?next=` (`:10-11`) | aucun | non | non | **404** |
| 12 | `/compte` | `Account` | oui | **oui** (`App.tsx:136`) | Mon compte — … (`Account.tsx:86`), noindex | aucun | non | non | **404** |
| 13 | `/compte/dossier/:id` | `DossierDetail` | oui | **oui** (`App.tsx:146`) | Détail du dossier — … (`DossierDetail.tsx:430-435`), noindex, canonical forcé `/compte` | aucun | non | non | 404 (non capturé) |
| 14 | `/mentions-legales` | `LegalPage slug="mentions-legales"` | oui | non | Mentions légales — … (`LegalPage.tsx:22-30`, `legal.ts:21-26`) | `BreadcrumbList` | oui (0.3) | `/mentions-legales.md` | **404** |
| 15 | `/cgv` | `LegalPage slug="cgv"` | oui | non | Conditions générales de vente — … (`legal.ts:121-126`) | `BreadcrumbList` | oui (0.3) | `/cgv.md` | **404** |
| 16 | `/politique-confidentialite` | `LegalPage slug="politique-confidentialite"` | oui | non | Politique de confidentialité — … (`legal.ts:247-252`) | `BreadcrumbList` | oui (0.3) | `/politique-confidentialite.md` | **404** |
| 17 | `/cookies` | `LegalPage slug="cookies"` | oui | non | Cookies — … (`legal.ts:387-392`) | `BreadcrumbList` | oui (0.3) | `/cookies.md` | **404** |
| 18 | `*` | `NotFound` | oui | non | Page introuvable — … (`NotFound.tsx:7`), noindex, canonical forcé `/` | aucun | non | non | **404** |

Slugs fonctionnalités (9, `src/data/features.ts`) : `creation-guidee`, `pieces-ocr`, `chronologie`, `validation-avocat`, `suivi-statuts`, `messagerie-securisee`, `coffre-fort`, `calendrier-relances`, `reponse-auto-mails`. Slugs blog (7, `src/data/blog/index.ts:11-19`) : `preparer-rendez-vous-avocat`, `chronologie-prud-homale`, `mise-en-demeure`, `conservation-documents`, `mediation-contentieux`, `rgpd-legaltech`, `ia-droit`. Slug inconnu → `<NotFound />` rendu **sans changer l'URL** (`FeatureDetail.tsx:12`, `BlogPost.tsx:17`).

Aucune route d'alias ni de redirection déclarative ; aucune route `/mot-de-passe-oublie`, `/admin`, `/compte/abonnement` (`App.tsx:48-195`).

### 3.2 Meta descriptions exactes par route

| Route | Meta description (`<Seo description>`) | Source |
|---|---|---|
| `/` | « ClairDossier transforme les demandes juridiques en dossiers structurés et suivis. Plateforme legaltech française pour clients, PME et cabinets d'avocats. » | `Home.tsx:47` |
| `/fonctionnalites` | « Les neuf briques ClairDossier : création de dossier guidée en 5 étapes, dépôt de pièces sécurisé, suivi de l'avancement, échéances, transmission par e-mail ou WhatsApp validée par vous, espace privé conforme RGPD. » | `FeaturesIndex.tsx:21` |
| `/fonctionnalites/:slug` | `feature.blurb` | `features.ts` |
| `/tarifs` | « Sept formules ClairDossier, de l'indépendant à l'entreprise : Essentiel, Entrepreneur, Business PME 20/50, Pro, Premium et offre sur-mesure. Compte gratuit, sans engagement. −10 % en annuel. » | `Pricing.tsx:95-124` |
| `/securite` | « Chiffrement en transit et au repos, isolation des données par utilisateur, stockage privé des pièces et hébergeur conforme RGPD. Les engagements sécurité de ClairDossier. » | `Security.tsx:82` |
| `/blog` | « Articles juridiques pédagogiques : préparation prud'homale, RGPD legaltech, IA et droit. Lecture libre, signée. » | `BlogIndex.tsx:17` |
| `/blog/:slug` | `post.metaDescription` | `src/data/blog/<slug>.ts:7-8` |
| `/contact` | « Réserver une démo ClairDossier, poser une question commerciale, contacter le support, ou écrire à l'équipe presse. Échanges directs via WhatsApp. » | `Contact.tsx:44` |
| `/dossier/nouveau` | « Créez un dossier structuré : profil, nature du dossier, informations, documents, transmission. Sauvegardé dans votre compte. » | `DossierFlow.tsx:403-411` |
| `/inscription` | « Créez gratuitement votre compte ClairDossier : … » | `Signup.tsx:53-58` |
| `/connexion` | « Connectez-vous à votre espace ClairDossier … » | `Login.tsx:36-41` |
| `/compte` | « Votre espace ClairDossier. » | `Account.tsx:86` |
| `/compte/dossier/:id` | « Le détail de votre dossier ClairDossier. » | `DossierDetail.tsx:430-435` |
| `/mentions-legales` | « Mentions légales du site clair-dossier.com — éditeur, hébergeur, directeur de publication, propriété intellectuelle. » | `legal.ts:24-25` |
| `/cgv`, `/politique-confidentialite` | `legalPages[slug].description` | `legal.ts:124-125`, `:250-251` |
| `/cookies` | « Politique cookies ClairDossier — cookies techniques uniquement, aucun cookie de mesure d'audience ou marketing tiers. » | `legal.ts:390-391` |
| `*` | « La page demandée n'existe pas. » | `NotFound.tsx:7` |

### 3.3 Navigation programmatique

| Source | Condition | Cible | Référence |
|---|---|---|---|
| `RequireAuth` | `configured && !session` | `<Navigate to="/connexion?next=<pathname+search>" replace />` | `RequireAuth.tsx:25-27` |
| `RequireAuth` | `!configured` (build sans `VITE_SUPABASE_*`) | **laisse passer** (« on ne bloque pas la démo ») | `RequireAuth.tsx:24-25` |
| `Login` succès | — | `navigate(next \|\| '/compte', { replace: true })` | `Login.tsx:11,28` |
| `Signup` succès | — | `navigate(next \|\| '/compte', { replace: true })` (même sans session) | `Signup.tsx:20,48` |
| `Account` déconnexion | — | `navigate('/')` | `Account.tsx:80-81` |

---

## 4. Composants

### 4.1 `src/components/` (racine)

| Fichier | Rôle | Utilisé |
|---|---|---|
| `Layout.tsx` | Shell : skip-link « Aller au contenu principal », `<Nav/>`, `<main id="main" tabIndex=-1>`, `<Footer/>` ; scroll-to-top + focus à chaque `pathname` (`:13-33`) | oui (`App.tsx:49`) |
| `Nav.tsx` | Header sticky (`z-40`), état scrollé (`scrollY > 24`), 5 liens (`NAV_ITEMS` `:7-13` : Fonctionnalités, Tarifs, Sécurité, Journal, Contact), CTA selon session (déconnecté : « Se connecter » `/connexion` + « Créer un compte » `/inscription` `:86-99` ; connecté : « Mon compte » `/compte` + « Créer un dossier » `/dossier/nouveau` `:70-84`), burger + menu mobile `AnimatePresence` (`:128-202`), `Escape`, verrou scroll body | oui |
| `Footer.tsx` | 4 colonnes (`:29`) : marque + texte ; « Produit » (`/fonctionnalites`, `/tarifs`, `/securite`, `/dossier/nouveau`) ; « Ressources » (`/blog`, `/contact`, `/securite#conformite`, `/securite#dpa`) ; « Légal » (4 pages) ; barre basse « © 2026 ClairDossier · Édité par Roman Gomes · SIREN 105 490 734 » (`:46`) + « Hébergeur conforme RGPD · Pièces chiffrées au repos · Charte de sécurité » (`:48-56`). Aucun e-mail/téléphone/adresse | oui |
| `Logo.tsx` | Carré navy « CD » or (40 px, `rounded-md`) + wordmark « ClairDossier » + tagline « Dossiers administratifs et juridiques, clairs. » ; props `size`, `withWordmark` | oui (Nav, Footer) |
| `RequireAuth.tsx` | Garde de route (cf. §3.3) ; « Chargement… » pendant `loading` (`:10-22`) | oui (3 routes) |
| `icons.tsx` | SVG 24×24 stroke 1.5 `currentColor` : 8 icônes features (`FEATURE_ICONS` `:269-278`), 6 icônes sécurité (`SECURITY_ICONS` `:282-289`), utilitaires `ArrowRightIcon`, `CheckIcon`, `LockIcon`, `FilePagesIcon`, `UsersIcon`, `HeadsetIcon`, `InfoIcon`, `WhatsAppIcon` (plein), `CrossIcon` (`:177-267`) | oui |

### 4.2 `src/components/sections/` (Home, ordre de montage `Home.tsx:51-61`)

| # | Fichier | Rôle (kicker / H2) | Utilisé |
|---|---|---|---|
| 1 | `Hero.tsx` | Kicker « Legaltech pour PME · artisans · indépendants », H1, sous-titre, CTA « Créer un dossier » / « Demander une démo », 3 fact pills, hero card « Dossier prud'homal — synthèse » (`#CD-2026-0421`, 6 étapes, pulse or) ; `SplitWords` + `MarkerHighlight` | oui |
| 2 | `AvantApres.tsx` | « Avant ClairDossier » / « Avec ClairDossier » — 2 cartes (cream / navy), 5 puces chacune | oui |
| 3 | `FeaturesGrid.tsx` | « Fonctionnalités » / « Huit briques pour structurer un dossier juridique. » — grille 4 col. sur les **9** features | oui |
| 4 | `WorkspacesTabs.tsx` | « Espaces dédiés » / « Un même dossier, trois lectures différentes. » — `Tabs` sur 3 `workspaces` (Vous / Validation / Entreprise), fond navy | oui |
| 5 | `Workflow.tsx` | « Workflow » / « Six statuts. Aucun « entre-deux ». » — frise 6 statuts, ligne or `scaleX` scroll-linked (desktop) | oui |
| 6 | `DossierLifecycle.tsx` | « Cycle de vie du dossier » / « De la création du dossier au contentieux. » — 5 étapes, 10 pastilles RH, encarts Comptable / Professionnel du droit | oui |
| 7 | `SecurityBlock.tsx` | « Sécurité & conformité » / « La sécurité juridique commence par la sécurité technique. » — 6 cartes `TRUST`, CTA « Charte complète » | oui |
| 8 | `PricingPreview.tsx` | « Tarifs » / « Une formule par usage. Pas de surprise. » — 3 plans (`essentiel`, `business-pme-20`, `business-pme-pro`), CTA « S'abonner » (Stripe), « Voir les 7 formules et le détail » | oui |
| 9 | `BlogPreview.tsx` | « Journal » / « Trois lectures pour comprendre où on se situe. » — affiche les **7** articles | oui |
| 10 | `FaqBlock.tsx` | « Foire aux questions » / « Huit questions qui reviennent. » — `Accordion` sur `homeFaq` (8) | oui |
| 11 | `FinalCTA.tsx` | « Passez à l'usage » / « Prêt à transformer vos dossiers ? » — CTA « Créer un dossier » / « Réserver une démo », fond navy, filets or | oui |

### 4.3 `src/components/ui/`

| Fichier | Rôle | Utilisé |
|---|---|---|
| `Tabs.tsx` | Onglets accessibles (`role=tablist`, indicateur `layoutId`, panel `AnimatePresence`) ; `aria-label="Espaces dédiés"` en dur ; pas de navigation clavier flèches | oui (`WorkspacesTabs.tsx:1`) |
| `Accordion.tsx` | Un item ouvert à la fois, premier ouvert par défaut, icône « + » → « × », panel `height auto` | oui (`FaqBlock.tsx:1`, `Pricing.tsx:6`) |
| `Button.tsx` | 4 variants (`primary` sheen or, `secondary` navy, `ghost`, `outline`), 3 tailles, polymorphe `to`/`href`/`button` | **non** (aucun import) |
| `Pill.tsx` | 4 tons (`cream`, `navy`, `gold`, `mono`) | **non** |
| `Card.tsx` | 3 variants (`white`, `cream`, `navy`), `interactive` (motion hover) | **non** |

### 4.4 `src/components/primitives/`

| Fichier | Rôle | Utilisé |
|---|---|---|
| `Reveal.tsx` | `Reveal` (fade + y 18→0, 0.65 s, viewport `once`, marge 240 px, fallback 900 ms), `Stagger`/`StaggerItem` (0.07 s) ; `useReducedMotion` | oui (10 sections + 8 pages) |
| `SplitWords.tsx` | Mot par mot `y 110%→0`, stagger 0.055 s, `aria-label` | oui (`Hero.tsx`) |
| `MarkerHighlight.tsx` | Surligneur sky `scaleX` CSS via `data-revealed` (`index.css:151-169`) | oui (`Hero.tsx:55-62`) |
| `Marquee.tsx` | Défilement infini (60 s) | **non** (consommateur `Partners.tsx` supprimé au commit `7fafc9b`) |
| `Magnetic.tsx` | Attraction curseur (spring) | **non** |

### 4.5 `src/pages/` (15 fichiers)

`Home`, `FeaturesIndex`, `FeatureDetail`, `Pricing`, `Security`, `BlogIndex`, `BlogPost`, `Contact`, `DossierFlow` (1 067 l.), `Signup`, `Login`, `Account`, `DossierDetail` (825 l.), `LegalPage`, `NotFound` — tous utilisés (§3).

### 4.6 `src/data/`

| Fichier | Contenu |
|---|---|
| `features.ts` | 9 `Feature` (`slug, title, shortTitle, icon, blurb, hero, body[], bullets[]`), `getFeatureBySlug` (`:204-209`) |
| `faq.ts` | `homeFaq` : 8 entrées (ids `qui-valide`, `donnees-securisees`, `obligation-avocat`, `compatible-cabinet`, `refus-avocat`, `tarification-cabinet`, `export-possible`, `rgpd-donnees`) |
| `statuses.ts` | 6 `CaseStatus` : `brouillon` Brouillon, `complete` Complété, `attente-avocat` Transmis, `validation` En cours, `valide` Validé, `archive` Archivé (`:10-64`) |
| `workspaces.ts` | 3 `Workspace` : `client` « Vous », `avocat` « Validation », `cabinet` « Entreprise » (`:21-96`) |
| `pricing.ts` | 7 `plans` (`:35-225`), `COMPARISON_FEATURES` (8, `:24-33`), `TRUST_PILLARS` (`:227-243`), `YEARLY_DISCOUNT = 0.1` (`:246`) |
| `legal.ts` | `legalPages` : 4 pages (mentions-legales `:21-119`, cgv `:121-245`, politique-confidentialite `:247-385`, cookies `:387-458`), `lastUpdate: "2026-05-26"` |
| `authors.ts` | 1 auteur `redaction` « Rédaction ClairDossier » (`:10-17`) |
| `blog/index.ts` + 7 fichiers + `types.ts` | 7 `BlogPost` (cf. §11.7) |

---

## 5. Fonctions / libs

| Fichier | Exports / rôle | Points clés |
|---|---|---|
| `src/lib/supabase.ts` (25 l.) | `supabase` (client unique), `isSupabaseConfigured` | `createClient(url ?? 'https://placeholder.supabase.co', anonKey ?? 'placeholder', { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'clairdossier-auth' })` (`:17-22`) ; warning console en DEV si non configuré (`:8-13`) |
| `src/lib/auth.tsx` (124 l.) | `AuthProvider`, `useAuth()` → `{ session, user, loading, configured, signUp, signIn, signOut }` | `getSession()` au montage (`:55-65`), `onAuthStateChange` (`:66-72`) ; `signUp` avec metadata `full_name`, `company_name`, `company_type` (`:77-87`) ; `signInWithPassword` (`:95`) ; `signOut` sans gestion d'erreur (`:101-104`) ; `translateError` 6 messages FR sinon message brut (`:39-49`). **Aucun** reset/updateUser/OAuth/OTP |
| `src/lib/seo.tsx` (126 l.) | `Seo` (composant), `orgSchema`, `websiteSchema`, `breadcrumbSchema()` | `SITE_URL = 'https://www.clair-dossier.com'` (`:13`), écriture de `document.head` dans `useEffect` (`:35-79`), retourne `null` (`:81`) ; canonical = `SITE_URL + path` ; robots `index, follow, max-image-preview:large` ou `noindex, follow` ; OG/Twitter ; JSON-LD via `<script data-seo-jsonld>` |
| `src/lib/whatsapp.ts` (20 l.) | `WHATSAPP_NUMBER = '33782983644'` (`:5`), `WHATSAPP_DISPLAY = '+33 7 82 98 36 44'` (`:6`), `buildWhatsAppUrl(text)` → `https://wa.me/33782983644?text=…` (`:9`), `openWhatsApp(text)` (`window.open` + repli `location.href`, `:12-20`) | Consommé par `Contact.tsx:5`, `Pricing.tsx:28`, `DossierFlow.tsx:6` |
| `scripts/gen-markdown.ts` | Génère 27 `.md` dans `public/` (`index.md` + `page.md`, `blog/index.md` + 7, `fonctionnalites/index.md` + 9, `tarifs.md`, `securite.md`, `contact.md`, 4 légaux) depuis les data React (`:16-28`) | Footer commun « éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE. » (`:40-49`) ; contenu **en dur** pour Home/Sécurité/Contact (`:52-74, :381-438, :441-470`) divergent de `Security.tsx` (OVH, AES-256, HSTS, HDS, ISO 27001…) ; ne génère ni `sitemap.xml` ni `llms.txt` ; hors `tsconfig` |
| `scripts/create-stripe-products.mjs` (109 l.) | Archive les anciens produits/liens (`archiveOld` `:49-65`) puis crée 6 produits + 6 prix mensuels + 6 Payment Links (`:67-93`) | `STRIPE_SECRET_KEY` (`:18-26`), API `2024-12-18.acacia`, redirect `https://www.clair-dossier.com/compte?paid=<planId>` (`:82-84`) ; **destructif** pour les liens en dur |
| `scripts/add-annual-prices.mjs` (72 l.) | Crée 6 prix annuels (`monthly × 12 × 0.9`) + 6 Payment Links | **non idempotent** (`:5`) ; même redirect |
| `scripts/guard_destructive.py` | Hook PreToolUse prévu par la constitution (II.3.3) — **ajouté en Phase 0, hors baseline d'origine** | commit `ab2b00b` (gouvernance), absent de `main` |
| `supabase/functions/notify-lead/index.ts` (69 l.) | Edge Function Deno : POST `{table, record}` → e-mail Resend vers `prestige.seller@icloud.com` | cf. §6.6 |

---

## 6. Supabase

### 6.1 Projet

| Élément | Valeur | Source |
|---|---|---|
| Ref projet hébergé | `buzgokfmxpmyceppvjpp` (`https://buzgokfmxpmyceppvjpp.supabase.co`) | `deploy.yml:42`, `netlify.toml:26`, migration `20260617110728:15` |
| `project_id` CLI local | `clair-dossier` | `supabase/config.toml:5` |
| Postgres | 17 | `config.toml:36` |
| Clé anon | JWT HS256 `role=anon`, `iat=1781549969`, `exp=2097125969` — en clair dans `deploy.yml:43` **et** dans la migration `20260617110728_dossier_lead_notification.sql:18` | — |
| Santé live | `GET /auth/v1/health` sans clé → 401 « No API key found » (projet vivant) — vérifié en prod | — |
| Déploiement backend | **manuel** (aucune étape CI) → état réel des migrations/fonction **À VÉRIFIER** sur le projet live | `deploy.yml` |
| `seed.sql` | référencé `config.toml:65`, **fichier inexistant** | — |

### 6.2 Tables (schéma `public`) — 6 migrations `supabase/migrations/`

| Table | Colonnes (type, null, défaut, contraintes) | Index | Source |
|---|---|---|---|
| `profiles` | `id uuid PK FK auth.users ON DELETE CASCADE` · `full_name text` · `company_name text` · `company_type text check in ('pme','artisan','entreprise-individuelle','profession-liberale','particulier','autre')` · `phone text` (jamais renseignée) · `created_at timestamptz NOT NULL now()` · `updated_at timestamptz NOT NULL now()` | PK | `…init.sql:5-17` |
| `dossiers` | `id uuid PK gen_random_uuid()` · `user_id uuid NOT NULL FK auth.users CASCADE` · `typology text NOT NULL` (sans check) · `title text` · `status text NOT NULL default 'brouillon'` (sans check ; le front insère `'transmis'`) · `answers jsonb NOT NULL '{}'` · `legal_review_requested boolean NOT NULL false` · `created_at`, `updated_at` | PK, `dossiers_user_id_idx (user_id)` | `…init.sql:20-32` |
| `dossier_documents` | `id uuid PK` · `dossier_id uuid NOT NULL FK dossiers CASCADE` · `user_id uuid NOT NULL FK auth.users CASCADE` · `file_path text NOT NULL` · `file_name text NOT NULL` · `size_bytes bigint` · `created_at` · `kind text NOT NULL default 'piece' check in ('piece','deliverable')` (M5) | PK, `dossier_documents_dossier_id_idx (dossier_id)` ; **pas d'index `user_id`** | `…init.sql:35-45`, `…deliverables.sql:13-19` |
| `app_admins` | `user_id uuid PK FK auth.users CASCADE` · `created_at` | PK | `…admin_global_access.sql:11-14` |

Historique : M1 `20260615201942_clair_dossier_init` → M2 `20260617110728_dossier_lead_notification` → M3 `20260621144123_admin_global_access` → M4 `20260622062648_admin_user_emails` → M5 `20260628093000_dossier_deliverables` → M6 `20260701093000_admin_delete_documents`. Aucun enum, aucune vue, seule extension explicite `pg_net` (M2 `:5`), aucun `pg_cron`, aucun Database Webhook Supabase, aucune table ajoutée à la publication realtime.

### 6.3 Policies RLS (texte exact — toutes PERMISSIVE, sans `to <role>`)

| Table | Policy | Cmd | USING | WITH CHECK | Source |
|---|---|---|---|---|---|
| `profiles` | `profiles_select_own` | SELECT | `auth.uid() = id` | — | `…init.sql:52` |
| `profiles` | `profiles_insert_own` | INSERT | — | `auth.uid() = id` | `:53` |
| `profiles` | `profiles_update_own` | UPDATE | `auth.uid() = id` | `auth.uid() = id` | `:54` |
| `profiles` | `profiles_select_admin` | SELECT | `public.is_admin()` | — | `…admin_global_access.sql:46-48` |
| `dossiers` | `dossiers_select_own` | SELECT | `auth.uid() = user_id` | — | `…init.sql:56` |
| `dossiers` | `dossiers_insert_own` | INSERT | — | `auth.uid() = user_id` | `:57` |
| `dossiers` | `dossiers_update_own` | UPDATE | `auth.uid() = user_id` | `auth.uid() = user_id` | `:58` |
| `dossiers` | `dossiers_delete_own` | DELETE | `auth.uid() = user_id` | — | `:59` |
| `dossiers` | `dossiers_select_admin` | SELECT | `public.is_admin()` | — | `…admin_global_access.sql:38-40` |
| `dossier_documents` | `docs_select_own` | SELECT | `auth.uid() = user_id` | — | `…init.sql:61` |
| `dossier_documents` | `docs_insert_own` | INSERT | — | `auth.uid() = user_id` (ne vérifie pas la propriété de `dossier_id`) | `:62` |
| `dossier_documents` | `docs_delete_own` | DELETE | `auth.uid() = user_id` | — | `:63` |
| `dossier_documents` | `docs_select_admin` | SELECT | `public.is_admin()` | — | `…admin_global_access.sql:42-44` |
| `dossier_documents` | `docs_insert_admin` | INSERT | — | `public.is_admin()` | `…deliverables.sql:22-24` |
| `dossier_documents` | `docs_delete_admin` | DELETE | `public.is_admin()` | — | `…admin_delete_documents.sql:5-7` |
| `app_admins` | (aucune) — RLS activée, `revoke all from anon, authenticated` | — | — | — | `…admin_global_access.sql:15-17` |
| `storage.objects` | `docs_storage_select_own` | SELECT | `bucket_id = 'documents' and auth.uid()::text = (storage.foldername(name))[1]` | — | `…init.sql:108-109` |
| `storage.objects` | `docs_storage_insert_own` | INSERT | — | idem | `:110-111` |
| `storage.objects` | `docs_storage_delete_own` | DELETE | idem | — | `:112-113` |
| `storage.objects` | `docs_storage_select_admin` | SELECT | `bucket_id = 'documents' and public.is_admin()` | — | `…admin_global_access.sql:51-53` |
| `storage.objects` | `docs_storage_insert_admin` | INSERT | — | idem | `…deliverables.sql:27-29` |
| `storage.objects` | `docs_storage_delete_admin` | DELETE | idem | — | `…admin_delete_documents.sql:9-11` |

Absences notables : aucune policy UPDATE/DELETE **admin** sur `dossiers` (le statut ne peut pas être modifié par l'admin via l'API) ; aucune policy UPDATE sur `dossier_documents` ni `storage.objects` ; aucune policy DELETE sur `profiles`.

### 6.4 Fonctions et triggers

| Fonction | Langage / sécurité | Rôle | Grants | Source |
|---|---|---|---|---|
| `touch_updated_at()` | plpgsql, INVOKER | `new.updated_at = now()` | défauts | `…init.sql:66-72` |
| `handle_new_user()` | plpgsql, **DEFINER**, `search_path public` | insère `profiles(id, full_name, company_name, company_type)` depuis `raw_user_meta_data`, `on conflict do nothing` | défauts | `…init.sql:83-96` |
| `notify_lead()` | plpgsql, **DEFINER** | `net.http_post` vers `…/functions/v1/notify-lead`, `Authorization: Bearer <anon en dur>`, body `{table, record: to_jsonb(new)}` | défauts | `…lead_notification.sql:7-24` |
| `is_admin()` → boolean | sql, **DEFINER**, stable | `exists (select 1 from app_admins where user_id = auth.uid())` | revoke public/anon, grant `authenticated` | `…admin_global_access.sql:25-35` |
| `admin_user_emails()` → `table(id, email)` | sql, **DEFINER**, `search_path public, auth` | `select id, email from auth.users where is_admin()` | revoke public/anon, grant `authenticated` | `…admin_user_emails.sql:6-19` |

| Trigger | Table | Moment | Fonction | Source |
|---|---|---|---|---|
| `profiles_touch` | `profiles` | BEFORE UPDATE | `touch_updated_at` | `…init.sql:74-76` |
| `dossiers_touch` | `dossiers` | BEFORE UPDATE | `touch_updated_at` | `:78-80` |
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user` | `:98-100` |
| `on_new_profile_notify` | `profiles` | AFTER INSERT | `notify_lead` | `…lead_notification.sql:26-29` |
| `on_new_dossier_notify` | `dossiers` | AFTER INSERT | `notify_lead` | `:31-34` |

Admin global : ligne unique insérée par M3 pour `auth.users.email = 'prestige.seller@icloud.com'` (`…admin_global_access.sql:20-22`) — si le compte n'existait pas à l'application de M3, `app_admins` est vide (**À VÉRIFIER** sur le projet live). Aucun claim JWT (pas de custom access token hook, `config.toml:257-265`).

### 6.5 Bucket Storage

| Bucket | Public | Limites | Convention de chemin | Source |
|---|---|---|---|---|
| `documents` | `false` | aucune limite taille/MIME au niveau bucket (seule limite globale locale `50MiB`, `config.toml:108`) — limite réelle **À VÉRIFIER** | `<user_id>/<dossier_id>/<timestamp>-<nom>` (pièces, `DossierFlow.tsx:360`) ; `<client_user_id>/<dossier_id>/deliverable-<timestamp>-<nom>` (livrables admin, `DossierDetail.tsx:343`) ; URLs signées 1 h (`DossierDetail.tsx:284-286`) | `…init.sql:103-105` |

### 6.6 Edge Function `notify-lead`

| Aspect | Valeur | Source |
|---|---|---|
| Runtime | Deno 2, `Deno.serve` | `index.ts:10`, `config.toml:362` |
| Entrée | `{ table: 'profiles' \| 'dossiers', record }` ; seuls `table` et `record.id` lus | `index.ts:13-21` |
| Secret attendu | `RESEND_API_KEY` (`Deno.env.get`) | `index.ts:6` |
| Expéditeur / destinataire | `ClairDossier <noreply@clair-dossier.com>` → `prestige.seller@icloud.com` (en dur) | `index.ts:7-8` |
| Contenu | « ClairDossier — nouveau compte » / « — nouveau dossier », référence = 8 premiers caractères de l'id, lien `/compte` ou `/compte/dossier/<id>` ; minimisation RGPD volontaire (pas de nom/montant) | `index.ts:16-47` |
| Authentification entrante | aucune dans le code ; `verify_jwt` par défaut (pas de `[functions.notify-lead]` dans `config.toml`) → appelable avec la clé anon publique | — |
| Déploiement | manuel — version déployée **À VÉRIFIER** | — |

### 6.7 Configuration Auth / SMTP (`supabase/config.toml` — config CLI locale ; état du Dashboard hébergé **À VÉRIFIER**)

| Paramètre | Valeur | Ligne |
|---|---|---|
| `site_url` | `https://www.clair-dossier.com` | `:150` |
| `additional_redirect_urls` | `https://www.clair-dossier.com`, `https://clair-dossier.com`, `https://clair-dossier.netlify.app`, `http://localhost:5173`, `http://127.0.0.1:5173` | `:152` |
| `jwt_expiry` | 3600 s ; rotation refresh token activée (réutilisation 10 s) | `:154,160,163` |
| `enable_signup` / anonymes / manual linking | `true` / `false` / `false` | `:165-169` |
| `minimum_password_length` / `password_requirements` | 8 / `""` | `:171,174` |
| Captcha / MFA TOTP / OAuth (Apple) | désactivés | `:192-196`, `:281-283`, `:298-314` |
| `[auth.email]` | `enable_signup true`, `double_confirm_changes true`, **`enable_confirmations true`**, `secure_password_change false`, `max_frequency 1s`, OTP 6 chiffres / 3600 s | `:200-213` |
| SMTP | `smtp.resend.com:465`, user `resend`, `pass = env(RESEND_SMTP_PASSWORD)`, `admin_email noreply@clair-dossier.com`, `sender_name ClairDossier` | `:215-223` |
| Templates e-mail | par défaut (sections commentées) | `:225-234` |
| Sessions (timebox/inactivité) | illimitées (commentées) | `:250-255` |
| `[api]` | schemas `public`, `graphql_public` ; `max_rows 1000` | `:13-18` |
| `[storage]` | `file_size_limit 50MiB` (global local) | `:105-108` |

---

## 7. Stripe

### 7.1 Nature de l'intégration

**12 Stripe Payment Links codés en dur** dans `src/data/pricing.ts:45-182` (6 mensuels `ctaHref` + 6 annuels `ctaHrefYearly`) + 2 scripts Node d'administration. Aucun SDK `stripe` déclaré, aucun code Stripe côté client ou serveur, aucun `price_`/`prod_`/`plink_` dans le dépôt (grep : 0), aucun `client_reference_id` / `prefilled_email` transmis. Navigation = `<Link to="https://buy.stripe.com/…">` rendu en `<a href>` même onglet (`Pricing.tsx:542-547`, `PricingPreview.tsx:117-122`).

### 7.2 Les 7 formules (`src/data/pricing.ts:35-225`) — prix HT, −10 % annuel (`YEARLY_DISCOUNT = 0.1`, `:246`)

| # | id | Nom | Audience | Mensuel | Annuel (total) | Badge | Dossiers / Utilisateurs / Support | Payment Link mensuel | Payment Link annuel | Lignes |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `essentiel` | Essentiel | Indépendant / EI | 19 € | 205,20 € | — | 5 / 1 / Support email | `https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605` | `https://buy.stripe.com/dRm9ATbYu6bF9PvfWmbV60b` | `:36-62` |
| 2 | `entrepreneur` | Entrepreneur | Entrepreneur / prof. libérale | 39 € | 421,20 € | — | 10 / 2 / Support email prioritaire | `https://buy.stripe.com/8x214n1jQ2Zt9Pvh0qbV606` | `https://buy.stripe.com/28EeVd9QmgQj7HndOebV60c` | `:63-89` |
| 3 | `business-pme-20` | Business PME 20 | TPE / PME | 49 € | 529,20 € | « Populaire » | 20 / 5 / Support prioritaire | `https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607` | `https://buy.stripe.com/14AbJ18MicA3e5L11sbV60d` | `:90-117` |
| 4 | `business-pme-50` | Business PME 50 | PME | 89 € | 961,20 € | — | 50 / 5 / Support prioritaire | `https://buy.stripe.com/28E4gz8Mi9nRaTz25wbV608` | `https://buy.stripe.com/6oU00j5A69nR3r7bG6bV60e` | `:118-143` |
| 5 | `business-pme-pro` | Business / PME Pro | PME / multi-sites | 169 € | 1 825,20 € | « Recommandé » | illimités / 15 / Support dédié | `https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609` | `https://buy.stripe.com/cNifZh9Qm8jNe5L39AbV60f` | `:144-171` |
| 6 | `business-pme-premium` | Business / PME Premium | Entreprise | 299 € | 3 229,20 € | — | illimités / illimités / Support entreprise | `https://buy.stripe.com/9B628raUq8jNgdT8tUbV60a` | `https://buy.stripe.com/28EeVdaUq7fJd1H11sbV60g` | `:172-198` |
| 7 | `business-pme-sur-mesure` | Business / PME personnalisée | Grand compte | Sur devis | — | — | illimités / illimités / Accompagnement dédié | `/contact?plan=sur-mesure` (paramètre ignoré par `Contact.tsx`) | — | `:199-224` |

### 7.3 Matrice comparative (`COMPARISON_FEATURES`, `pricing.ts:24-33` ; ✓ / limité / ✗)

| id interne | Libellé actuel | Essentiel | Entrepreneur | PME 20 | PME 50 | Pro | Premium | Sur-mesure |
|---|---|---|---|---|---|---|---|---|
| `messagerie` | Transmission par e-mail ou WhatsApp | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `calendrier` | Échéances affichées sur le dossier | limité | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `resume-ia` | Récapitulatif du dossier | limité | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `redaction-ia` | Suivi par étapes métier | ✗ | limité | ✓ | ✓ | ✓ | ✓ | ✓ |
| `reponse-auto` | Dépôt de pièces sécurisé | ✗ | ✗ | limité | ✓ | ✓ | ✓ | ✓ |
| `ia-avancee` | Espace privé multi-dossiers | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| `modeles` | Pièces téléchargeables | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `recurrents` | Plusieurs dossiers en parallèle | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |

Les ids internes sont hérités d'une grille « IA » renommée au commit `417708f` (2026-06-26). Les descriptions produits des scripts Stripe (`create-stripe-products.mjs:36-46`) et `llms.txt:56-61` portent encore les anciens libellés (« résumé IA », « rédaction IA », « IA avancée (GPT-5.5) », « réponse automatisée aux e-mails ») — état réel des produits Stripe **À VÉRIFIER** dans le dashboard.

### 7.4 Scripts

| Script | Effet | Paramètres Payment Link | Risque |
|---|---|---|---|
| `scripts/create-stripe-products.mjs` | `archiveOld()` désactive tous les liens avec `metadata.planId`/`source` et archive les produits `source=clair-dossier-showcase` (prix non archivés) ; crée produit + prix mensuel (`interval month`) + lien par plan (6, hors sur-mesure `:33`) | `after_completion → https://www.clair-dossier.com/compte?paid=<planId>`, `allow_promotion_codes true`, `billing_address_collection auto`, `payment_method_collection always`, metadata `{planId, source}` ; **pas** de `automatic_tax`, `trial_period_days`, `consent_collection` | destructif pour les 12 URLs en dur |
| `scripts/add-annual-prices.mjs` | prix annuel `round(monthly×12×0.9×100)` + lien, metadata `billing: yearly` | même redirect (sans `billing=`) | non idempotent |

### 7.5 Parcours de paiement actuel

`/tarifs` (ou Home) → clic « S'abonner » → `buy.stripe.com/<link>` (sans identifiant utilisateur, pas besoin d'être connecté) → paiement → redirect `/compte?paid=<planId>` → `RequireAuth` (→ `/connexion?next=…` si déconnecté) → `Account.tsx:31,89-98` affiche « Abonnement confirmé … Votre abonnement est actif. » **dès que `?paid` est présent, sans vérification**. Rien n'est écrit en base.

### 7.6 Absences (constats)

| Composant | État | Preuve |
|---|---|---|
| Webhook Stripe | **absent** | seule fonction serveur : `notify-lead` ; grep `webhook` → texte marketing `Pricing.tsx:36` uniquement |
| Table `subscriptions` / `stripe_customers` / colonne plan | **absentes** | `profiles` sans `stripe_customer_id` (`…init.sql:5-17`) ; grep migrations → 0 |
| Customer Portal / gestion d'abonnement dans `/compte` | **absent** | `Account.tsx` intégral ; grep `portal` → 0 — alors que la FAQ (`Pricing.tsx:54`) et les CGV (`legal.ts:178`) promettent une résiliation « depuis l'espace facturation / client » |
| Gating des fonctionnalités par plan | **absent** | RLS uniquement `auth.uid() = user_id` ; tout compte connecté a tout |
| Checkout Session / Stripe.js / période d'essai | **absents** | — |
| Variables `STRIPE_WEBHOOK_SECRET`, `STRIPE_PUBLISHABLE_KEY`, `VITE_STRIPE_*` | **absentes** | grep → 0 |
| IDs Stripe versionnés | **absents** | seuls les URLs publics `buy.stripe.com` |
| Mode LIVE vs TEST des 12 liens, abonnés actifs, config TVA | **À VÉRIFIER** dans le dashboard Stripe | — |

---

## 8. Variables d'environnement (noms seulement)

| Nom | Lue dans | Fournie par | Usage |
|---|---|---|---|
| `VITE_SUPABASE_URL` | `src/lib/supabase.ts:3` | `deploy.yml:42` (en clair), `.env.example`, Netlify (**À VÉRIFIER**) | URL client Supabase ; fallback `placeholder.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.ts:4` | `deploy.yml:43` (en clair), `.env.example` | clé anon ; fallback `'placeholder'` |
| `VITE_BASE_PATH` | `vite.config.ts:20` | `deploy.yml:40` | `base` Vite (défaut `/`) |
| `import.meta.env.DEV` | `supabase.ts:8` | Vite | avertissement console |
| `STRIPE_SECRET_KEY` | `scripts/create-stripe-products.mjs:18`, `scripts/add-annual-prices.mjs:11` | exécution manuelle (absente de `.env.example` et du CI) | scripts d'admin Stripe |
| `RESEND_API_KEY` | `supabase/functions/notify-lead/index.ts:6` | secrets Edge Function (**À VÉRIFIER**) | envoi e-mail |
| `RESEND_SMTP_PASSWORD` | `supabase/config.toml:219` (`env(...)`) | env CLI Supabase | SMTP auth e-mails |
| `OPENAI_API_KEY` | `supabase/config.toml:91` (Studio local) | — | local uniquement |

`.gitignore` : `.env`, `.env.*` sauf `.env.example` (`:12-14`) ; `supabase/.gitignore` : `.env.keys`, `.env.local`, `.env.*.local`. Aucun `.env` suivi par git. `.env.example` ne contient que `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (commentaire « Valeurs réelles dans les variables d'env Netlify », incohérent avec le workflow Pages).

---

## 9. SEO

| Élément | État | Source |
|---|---|---|
| `<html lang>` | `fr` | `index.html:2` |
| `<title>` statique | « ClairDossier — Votre dossier administratif et juridique, clair, structuré et suivi. » | `index.html:16` |
| Meta description statique | « ClairDossier structure vos dossiers administratifs et juridiques : calendrier, relances à échéance, projets de réponse aux e-mails. Pour PME, artisans, indépendants et professions libérales. » | `index.html:17` |
| `meta author` | `Nouh BENZIDANE` | `index.html:18` |
| `meta robots` | `index, follow, max-image-preview:large` | `index.html:19` |
| `theme-color` / `color-scheme` | `#0d1b3d` / `light` | `index.html:6,8` |
| Canonical statique | `https://www.clair-dossier.com/` (identique sur toutes les routes avant JS) | `index.html:12` |
| OG statique | `og:type website`, `og:site_name`, `og:title`, `og:description` (« Plateforme legaltech française… Hébergement UE, RGPD natif. »), `og:url`, `og:image https://www.clair-dossier.com/og-default.svg` 1200×630, `og:locale fr_FR` | `index.html:22-30` |
| Twitter | `summary_large_image`, image SVG | `index.html:33-36` |
| `rel=alternate rss` | `href="/blog"` — **aucun flux RSS n'existe** (`/feed.xml`, `/rss.xml` → 404) | `index.html:13` |
| Favicon | `/favicon.svg` uniquement (pas de `.ico`, `apple-touch-icon`, manifest) | `index.html:11` |
| Injection par route | **client-side uniquement** (`useEffect`, `seo.tsx:35-79`) : title, description, canonical, robots, OG, Twitter, JSON-LD ; le HTML servi est le même pour toutes les routes (3 759 o, sans JSON-LD) | `seo.tsx` |
| JSON-LD | par route, cf. §3.1 ; `orgSchema` (logo `/favicon.svg`, `contactPoint` customer support FR sans `telephone`, `seo.tsx:85-100`), `websiteSchema` (`SearchAction` → `/blog?q=` non implémenté, `:102-113`), `breadcrumbSchema` (`:115-126`) | — |
| `hreflang`, `article:published_time` | absents | — |
| `public/sitemap.xml` | statique (écrit à la main), 26 URL en `https://www.clair-dossier.com` : `/` (weekly 1.0), `/fonctionnalites` (0.9) + 9 détails (0.7), `/tarifs` (0.9), `/securite` (0.8), `/blog` (0.8) + 7 articles (yearly 0.6, `lastmod` = date article), `/contact` (0.5), 4 légaux (0.3, sans `lastmod`) ; 26/26 correspondent à une route existante ; servi `200 application/xml` | `sitemap.xml:3-139` |
| `public/robots.txt` | `User-agent: *` → `Allow: /`, `Disallow: /dossier/` ; autorisations explicites GPTBot, ChatGPT-User, PerplexityBot, Claude-Web, Google-Extended ; `Sitemap: https://www.clair-dossier.com/sitemap.xml` ; `/compte`, `/connexion`, `/inscription` non disallow | `robots.txt:1-21` |
| `public/llms.txt` | statique (non généré), 105 l. : éditeur (Roman Gomes, SIREN, adresse, WhatsApp, Nouh BENZIDANE), architecture des routes (`/dossier/nouveau : 4 étapes` — vs 5 partout ailleurs), 7 articles, tarifs (« 7 formules », 6 nommées, libellés IA), sécurité (OVHcloud, AES-256, HSTS preload, HDS 2026 T3, ISO 27001 2027), convention `.md`, crawling | `llms.txt:5-105` |
| Markdown crawlers | 27 `.md` dans `public/` (convention « même chemin + .md »), tous servis `200 text/markdown` ; `llms-full.txt` absent | `gen-markdown.ts` |
| Google Search Console | propriété vérifiée par balise meta ; **accès/données non consultés** — **À VÉRIFIER** | `index.html:9` |
| Statut HTTP live | **25/26 URL du sitemap → 404** (seule `/` → 200) ; `/fonctionnalites` et `/blog` → 301 → 404 | §2.6 |
| Titres | suffixe de 54 caractères (`seo.tsx:36`) → titres blog ≈ 110 car. ; titre/description JS de `/` (`Home.tsx:46-47`) divergent du HTML statique (`index.html:16-17`) | — |
| Canonical anormaux | `NotFound` → `/` ; `DossierDetail` → `/compte` ; `/dossier/nouveau` indexable malgré `RequireAuth` + `Disallow` | `NotFound.tsx:7`, `DossierDetail.tsx:433`, `DossierFlow.tsx:403-411` |
| OG image | SVG 2 347 o (non rendu par la plupart des aperçus sociaux) ; texte « Votre dossier juridique… », « OVH France », « CABINETS » divergent du site | `public/og-default.svg:24-41` |

---

## 10. Fonctionnalités (synthèse)

> Inventaire détaillé (nom, emplacement, utilisateur, abonnement, frontend, backend, dépendances, état, test) à produire dans **`FEATURE_INVENTORY.md`** (Phase 0B, PARTIE III.2). Cette section fixe la liste de référence que l'inventaire doit couvrir intégralement.

### 10.1 Site public (marketing)

| Fonctionnalité | Emplacement | État |
|---|---|---|
| Home 11 sections (Hero animé, Avant/Après, 9 features, 3 espaces en onglets, workflow 6 statuts scroll-linked, cycle de vie 5 étapes + RH, 6 piliers sécurité, 3 plans, 7 articles, FAQ 8, CTA finale) | `Home.tsx:51-61`, `components/sections/*` | fonctionnel |
| Catalogue fonctionnalités (index + 9 fiches avec breadcrumb, « Concrètement », « Autres briques utiles ») | `FeaturesIndex.tsx`, `FeatureDetail.tsx`, `features.ts` | fonctionnel |
| Page tarifs (7 cartes, toggle mensuel/annuel −10 %, matrice 8 lignes, bloc devis, FAQ 5, CTA) | `Pricing.tsx`, `pricing.ts` | fonctionnel (liens Stripe) |
| Page sécurité (architecture 5 nœuds, 6 piliers `#conformite`, badges, droits `#dpa`, divulgation responsable) | `Security.tsx` | fonctionnel |
| Journal (index + 7 articles : chapô, corps en blocs, « À retenir », FAQ, articles liés ; drop cap, citations) | `BlogIndex.tsx`, `BlogPost.tsx`, `data/blog/*` | fonctionnel |
| Contact (carte WhatsApp, e-mail, siège, formulaire 4 sujets → pré-remplissage WhatsApp `wa.me`, sans persistance ni validation) | `Contact.tsx:19-38,124-189`, `whatsapp.ts` | fonctionnel (manuel) |
| 4 pages légales (+ bloc « Documents associés ») | `LegalPage.tsx`, `legal.ts` | fonctionnel |
| 404 applicative (« Cette page n'existe pas. ») | `NotFound.tsx` | fonctionnel |
| Navigation (header sticky, menu mobile, CTA selon session, footer 4 colonnes, skip-link) | `Nav.tsx`, `Footer.tsx`, `Layout.tsx` | fonctionnel |
| Markdown crawlers + `llms.txt` + sitemap + robots | `gen-markdown.ts`, `public/` | fonctionnel (contenu divergent, §15) |
| Animations (reveal, stagger, split words, marker, sheen, hover cards, ambient sweep, grid drift ; `prefers-reduced-motion`) | `primitives/*`, `index.css:129-375` | fonctionnel |

### 10.2 Espace authentifié (application)

| Fonctionnalité | Emplacement | Utilisateur | Backend | État |
|---|---|---|---|---|
| Inscription (companyType, companyName, fullName, email, password ≥ 8) | `Signup.tsx`, `auth.tsx:75-91` | visiteur | `auth.signUp` + trigger `handle_new_user` → `profiles` + `notify_lead` | **partiel** : cas « confirmation e-mail requise » non géré (redirige vers `/compte` sans session) |
| Connexion e-mail/mot de passe, `?next=` | `Login.tsx`, `auth.tsx:93-99` | visiteur | `signInWithPassword` | fonctionnel |
| Déconnexion | `Account.tsx:79-82` | client/admin | `signOut` | fonctionnel (pas dans la Nav) |
| Session persistée (`localStorage clairdossier-auth`), refresh auto, sync inter-onglets | `supabase.ts:17-24` | tous | supabase-js | fonctionnel |
| Garde de route | `RequireAuth.tsx` | tous | — | fonctionnel ; **désactivée si env absente** |
| Réinitialisation mot de passe / édition profil / changement e-mail | — | — | — | **inexistant** |
| Tunnel de création de dossier 5 étapes (profil 5 choix ; catégorie 7 choix + nom obligatoire ; infos `counterparty/startDate/amount/deadline/situation` avec surcharges `impaye-precontentieux` et `rh` ; documents `accept .pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt` ; récapitulatif + option « question IA préparatoire » si impayé) ; brouillon `localStorage clairdossier_draft` | `DossierFlow.tsx` | client | `insert dossiers (status 'transmis')`, `storage.upload documents`, `insert dossier_documents` | **partiel** : statut forcé `transmis`, upload échoué silencieux, glisser-déposer annoncé non implémenté, fichiers non persistés au rechargement |
| Transmission finale « E-mail » (`mailto:contact.clairdossier@icloud.com`) ou « WhatsApp » (`wa.me/33782983644`) avec synthèse texte | `DossierFlow.tsx:308-330,381-399` | client | aucun | **simulé / manuel** (écran « Dossier transmis. » dans tous les cas) |
| Liste des dossiers (`Vos dossiers` / admin `Tous les dossiers (N)` avec société + e-mail), bannière `?paid=` | `Account.tsx` | client / admin | `select dossiers` (RLS), `rpc is_admin`, `select profiles`, `rpc admin_user_emails` | fonctionnel (sans pagination/recherche) ; bannière **non vérifiée** |
| Détail de dossier — 4 onglets : Vue d'ensemble (frise 5 étapes `TIMELINE`, messages `STEP_MESSAGES`, « Ce que vous devez faire maintenant ») ; Pièces (Visualiser / Télécharger via URL signée 1 h ; zip admin) ; Échéances (regex sur clés `date|deadline|echeance`) ; DashBoard ClairDossier (livrables `kind='deliverable'`, « Tout télécharger ») | `DossierDetail.tsx:145-150,524-795` | client / admin | `select dossiers .eq id`, `select dossier_documents`, `createSignedUrl` | **partiel** : statut jamais mis à jour → toujours étape 3 ; libellés hérités (« Partie adverse », « Date d'entrée dans les lieux ») |
| Zip de toutes les pièces (`fflate zipSync level 0`, en mémoire) | `DossierDetail.tsx:367-401` | admin (pièces) / tous (livrables > 1) | `fetch` URL signées | fonctionnel |
| Livrer des fichiers au client (upload sous `user_id` client, `kind deliverable`) | `DossierDetail.tsx:336-364,714-746` | admin | `docs_insert_admin`, `docs_storage_insert_admin` | fonctionnel |
| Supprimer un livrable (`window.confirm`, `storage.remove` non vérifié + `delete`) | `DossierDetail.tsx:403-426` | admin | `docs_delete_admin`, `docs_storage_delete_admin` | fonctionnel |
| Supprimer une pièce client / un dossier ; changer le statut ; gérer les comptes ; abonnement | — | — | policies `docs_delete_own`, `dossiers_update_own`, `dossiers_delete_own` existent | **inexistant dans l'UI** |
| Notifications e-mail équipe (nouveau compte / nouveau dossier) | backend (`notify_lead` + Edge Function) | équipe | pg_net + Resend → `prestige.seller@icloud.com` | fonctionnel (non vérifiable depuis le front) |
| Notifications e-mail client, export RGPD, suppression de compte | — | — | — | **inexistant** (processus manuel « via le contact ») |
| Abonnement (paiement Stripe Payment Links, retour `?paid=`) | `pricing.ts`, `Account.tsx:89-98` | client | aucun | **simulé** : aucun droit, aucun gating, aucun webhook |

---

## 11. Pages — H1 exact et contenu clé

H1 relevés sur le site live (`docs/baseline/screens/index.json`) et dans le code.

| Route | H1 exact | Contenu clé | Source |
|---|---|---|---|
| `/` | « Votre dossier administratif et juridique, clair, structuré et suivi. » (mots « clair, », « structuré », « suivi. » surlignés) | Kicker « Legaltech pour PME · artisans · indépendants » ; sous-titre « Créez des dossiers administratifs et juridiques structurés : déposez vos pièces dans un espace privé, suivez l'avancement et vos échéances, puis transmettez quand vous le décidez. Pour les PME, artisans, entreprises individuelles et professions libérales. » ; pills « Suivi étape par étape » · « Pièces chiffrées » · « Conçu pour le RGPD » ; hero card « Dossier prud'homal — synthèse » (`Aperçu · exemple de dossier · #CD-2026-0421`, statut « En attente validation », dl Statut/Pièces déposées 7 / 9/Chronologie 4 évènements datés/Validation Sous 24 h ouvrées, frise Brouillon·Complété·Attente·Validation·Validé·Archivé) ; puis 10 sections (§4.2) | `Hero.tsx:44-262`, `Home.tsx:51-61` |
| `/fonctionnalites` | « Neuf briques, un dossier administratif et juridique propre. » | Sous-titre « Chaque fonctionnalité a été conçue pour traiter un point de friction identifié dans des dossiers réels — pas pour cocher une case dans un comparatif. … » ; grille 3 col. « Lire la fiche » ; CTA navy « Plutôt voir en pratique ? » (« Demander une démo », « Créer un dossier maintenant ») | `FeaturesIndex.tsx:40-116` |
| `/fonctionnalites/<slug>` ×9 | = `feature.title` : « Création guidée par typologie » · « Dépôt de pièces dans un espace privé » · « Avancement du dossier en 5 étapes » · « Transmission validée par vous » · « Liste de vos dossiers en un espace » · « Espace privé et sécurisé » · « Vos données protégées et maîtrisées » · « Échéances renseignées et affichées » · « Récapitulatif avant transmission » | Kicker « Fonctionnalité · {shortTitle} », accroche italique `hero`, corps 3-4 §, aside « Concrètement » (4 puces + « Essayer maintenant »), « Autres briques utiles. » | `FeatureDetail.tsx:59-134`, `features.ts:15-201` |
| `/tarifs` | « Une formule par usage. Pas de surprise. » | Sous-titre « De l'indépendant à l'entreprise — sept niveaux de service couvrent tous les usages. Compte gratuit, abonnement sans engagement. » ; toggle Mensuel/Annuel « −10 % » ; 7 cartes ; bloc « Devis sur-mesure » (marque blanche, API/webhooks, SSO/audit, onboarding sur site) avec WhatsApp + mailto + `/contact?topic=commercial` ; FAQ 5 (engagement, changement de plan, TVA 20 %, compte gratuit, annuel) ; matrice 8 lignes ; CTA « Demander un devis » / « Créer un compte gratuit » | `Pricing.tsx:30-80,133-432` |
| `/securite` | « La sécurité administrative et juridique commence par la sécurité technique. » | Sous-titre « Pour une legaltech, la confiance se mérite. … » ; « Du navigateur jusqu'à vos sauvegardes. » (5 nœuds) ; 6 piliers (Hébergement, Chiffrement, Accès, Conformité, Vos pièces, Maîtrise & contact) ; badges « Nos engagements en clair » ; « Vos données restent les vôtres. » (6 droits, « Exercer un droit ») ; « Trouvé une faille ? Écrivez-nous. » (mailto) ; affirme « Seul un administrateur unique peut consulter les dossiers côté support. » | `Security.tsx:14-75,97-320` |
| `/blog` | « Le droit administratif et juridique, expliqué calmement. » | Sous-titre « Articles écrits par des avocats, des juristes IT et l'équipe éditoriale ClairDossier. … » (un seul auteur déclaré en réalité) ; grille 3 col. des 7 articles | `BlogIndex.tsx:49-125` |
| `/blog/<slug>` ×7 | = `post.title` (ex. « Mise en demeure : le courrier qui débloque (souvent) la situation ») | Kicker « {category} · {readMinutes} min de lecture », chapô, auteur « Rédaction ClairDossier », image dégradé, corps, « À retenir », « Questions liées », « Continuer la lecture. » | `BlogPost.tsx:111-231` |
| `/contact` | « Une réponse sur WhatsApp, dans l'heure. » | Sous-titre « Pas de formulaire en file d'attente, pas de tickets perdus. … » ; carte WhatsApp `+33 7 82 98 36 44` « Réponse en moyenne sous 1 h en journée (9 h – 19 h, lundi-vendredi). » ; Email `contact.clairdossier@icloud.com` ; Siège « Château-Gombert, 13013 Marseille » ; formulaire « Préparez votre message en quelques champs. » (4 sujets, nom, email pro, structure, message, consentement, « Continuer sur WhatsApp ») | `Contact.tsx:58-189` |
| `/mentions-legales` | « Mentions légales » | Éditeur Roman Gomes EI, SIREN 105 490 734, SIRET 105 490 734 00016, APE 4791A, TVA non applicable 293 B, siège Château-Gombert 13013 Marseille ; contact e-mail + WhatsApp ; réalisation Nouh BENZIDANE ; directeur de publication Roman Gomes ; hébergeur GitHub Pages (GitHub Inc., San Francisco) ; données client chez « un sous-traitant technique conforme au RGPD » ; PI « société ClairDossier » ; limitation de responsabilité ; màj 2026-05-26 | `legal.ts:21-119` |
| `/cgv` | « Conditions générales de vente » | 9 articles : vendeur Roman Gomes EI ; compte gratuit + abonnement sans engagement ; prix HT, **TVA 20 %** ; facturation mensuelle, Stripe Payments Europe Ltd ; résiliation à tout moment via espace client/e-mail, prorata, copie des données sous 30 jours ; pas de SLA chiffré ; « aucune lecture, extraction ou analyse automatique des documents » ; DPA sur demande ; responsabilité plafonnée 12 mois ; droit français, tribunaux de Paris | `legal.ts:121-245` |
| `/politique-confidentialite` | « Politique de confidentialité » | Responsable Roman Gomes EI ; données compte/dossier/paiement/techniques ; bases 6.1.b/f/a ; destinataires hébergeur (non nommé), Stripe, sous-traitants mail (registre sur demande) ; conservation compte +12 mois, facturation 10 ans, logs 12 mois ; droits sous 30 jours, CNIL ; pas de DPO, pas de section transferts hors UE | `legal.ts:247-385` |
| `/cookies` | « Cookies » | Cookies strictement nécessaires (session, préférence 1 an, CSRF) ; Stripe au paiement ; aucun analytics ; gestion par navigateur ; `localStorage` non mentionné | `legal.ts:387-458` |
| `/connexion` | « Se connecter » | email, mot de passe, lien inscription (propage `?next`), pas de « mot de passe oublié » | `Login.tsx:47-89` |
| `/inscription` | « Créer un compte » | « Gratuit. Vous pourrez créer vos dossiers immédiatement — un abonnement n'est nécessaire que pour aller plus loin. » ; select type de structure (6), société, nom, email, mot de passe ≥ 8 ; pas de case CGV | `Signup.tsx:64-152` |
| `/dossier/nouveau` | selon étape : « Quel est votre profil ? » · « Quelle est la nature de votre dossier ? » · « Quelques informations pour structurer. » · « Ajoutez vos documents. » · « Récapitulatif avant transmission. » · « Dossier transmis. » | Kicker « Création dossier · {step} / 5 » ; badge « Brouillon restauré depuis votre dernière visite » | `DossierFlow.tsx:415-428` |
| `/compte` | « Bonjour, {email} » | Kicker « Mon compte » / « Administration » ; bannières « Abonnement confirmé » (`?paid`), « Espace administrateur » ; « Vos dossiers » / « Tous les dossiers (N) » ; « Créer un dossier » ; « Se déconnecter » | `Account.tsx:89-190` |
| `/compte/dossier/:id` | `dossier.title` (ou libellé de typologie) ; « Dossier introuvable » si absent | Catégorie, date, statut ; 4 onglets ; bloc « Garanties » | `DossierDetail.tsx:450-808` |
| `*` | « Cette page n'existe pas. » | « Le lien est peut-être obsolète ou mal recopié. Revenez à l'accueil ou ouvrez le journal. » ; « Retour à l'accueil », « Lire le journal » | `NotFound.tsx:9-25` |

### 11.1 Articles du journal (`src/data/blog/`)

| slug | Titre | Date | Catégorie | Min | Articles liés |
|---|---|---|---|---|---|
| `preparer-rendez-vous-avocat` | Préparer son rendez-vous avocat : la checklist en 8 étapes | 2026-05-20 | Méthode | 7 | chronologie-prud-homale, mise-en-demeure, mediation-contentieux |
| `chronologie-prud-homale` | Préparer un dossier prud'homal : la chronologie qui fait la différence | 2026-05-12 | Droit social | 6 | ia-droit, rgpd-legaltech |
| `ia-droit` | L'IA dans le droit : assistante de préparation, pas substitut | 2026-05-02 | IA et droit | 7 | chronologie-prud-homale, rgpd-legaltech |
| `rgpd-legaltech` | RGPD et legaltech : où vont vraiment vos données juridiques ? | 2026-04-28 | Conformité | 8 | ia-droit, chronologie-prud-homale |
| `mise-en-demeure` | Mise en demeure : le courrier qui débloque (souvent) la situation | 2026-04-15 | Procédure amiable | 8 | preparer-rendez-vous-avocat, conservation-documents, mediation-contentieux |
| `conservation-documents` | Conservation des documents juridiques : durées légales et bonnes pratiques | 2026-03-28 | Conformité | 9 | rgpd-legaltech, preparer-rendez-vous-avocat, mise-en-demeure |
| `mediation-contentieux` | Médiation ou contentieux : trois critères pour choisir | 2026-02-12 | Résolution de conflit | 7 | mise-en-demeure, preparer-rendez-vous-avocat, chronologie-prud-homale |

Auteur unique `redaction` « Rédaction ClairDossier » (`authors.ts:10-17`). Ordre d'affichage (`blog/index.ts:11-19`) non strictement décroissant par date.

---

## 12. Design tokens (synthèse)

> Inventaire complet (couleurs, fonts, buttons, cards, inputs, navbar, footer, modals, icons, animations, grids, spacing, radius, shadows) à produire dans **`DESIGN_INVENTORY.md`** (Phase 0C, PARTIE III.3). Source unique : bloc `@theme` de `src/index.css:15-62` + classes custom `index.css:65-375`.

| Famille | Tokens (valeur) | Source |
|---|---|---|
| Couleurs (17) | `navy-900 #0d1b3d` · `navy-800 #152348` · `navy-700 #1e2c52` · `navy-600 #2a3960` (inutilisé) · `gold-500 #c4a456` · `gold-400 #e6c97d` · `gold-300 #f0d99a` (inutilisé) · `gold-700 #7a5f28` (texte AA sur cream) · `cream-50 #fbf9f4` (fond page) · `cream-100 #f5f0e6` · `cream-200 #ebe2cf` · `ink #0a1228` (texte) · `slate-500 #5a6378` · `slate-400 #7c8497` · `slate-300 #a3aab9` · `sky-marker rgba(179,210,239,.6)` (surligneur H1, `::selection`) · `sky-marker-deep rgba(150,190,230,.8)` (inutilisé) | `index.css:17-38` |
| Couleurs hors palette | `white` (cards), `red-*` (erreurs), `emerald-*` (badge gratuit/coches), `amber-*` (avertissement) | grep `src/**/*.tsx` |
| Typographie | `--font-display` Cormorant Garamond (400/500/500i/600/700) · `--font-sans` Inter (300/400/500/600) · `--font-mono` JetBrains Mono (400/500) — @fontsource, `font-display: swap`, tous sous-ensembles buildés (124 `@font-face`) ; `html { font-feature-settings: "ss01","cv11","calt" }` ; `body` Inter 400 / 1.55 ; `h1-h6` 600, `letter-spacing -0.015em` | `index.css:3-13,41-43,65-97` |
| Radii | `xs .25rem` · `sm .5rem` · `md .75rem` (logo) · `lg 1.125rem` · `xl 1.5rem` · `full 9999px` ; `2xl`/`3xl` restent aux défauts Tailwind (1rem / 1.5rem) → `rounded-xl` > `rounded-2xl` (hiérarchie inversée, vérifiée dans le CSS compilé) | `index.css:46-51` |
| Ombres | `card 0 2px 24px rgba(13,27,61,.06)` · `card-hover 0 12px 48px rgba(13,27,61,.1)` · `gold 0 8px 24px rgba(196,164,86,.22)` · `gold-strong 0 14px 36px rgba(196,164,86,.32)` | `index.css:54-57` |
| Easings | `ease-out-expo cubic-bezier(.16,1,.3,1)` · `ease-out-soft cubic-bezier(.22,1,.36,1)` (réutilisés en JS) | `index.css:60-61` |
| Spacing / containers / breakpoints | défauts Tailwind v4 (`sm 40rem`, `md 48rem`, `lg 64rem`, `xl 80rem`, `2xl 96rem`) ; container standard `mx-auto max-w-7xl px-5 sm:px-8 lg:px-12` ; padding de section `py-14 sm:py-20 lg:py-24` | grep |
| Classes custom | `.hairline` (navy 8 %), `.hairline-strong` (12 %), `.hairline-gold` (or 35 %), `.sheen` (balayage 0.6 s ; déclaré 2×), `.marker-track`, `.skip-nav`, `.premium-hero-shell::after`, `.premium-tech-section` (grille or animée 28 s), `.premium-card`, `.premium-recommended-plan`, `.premium-preview-card`, `header nav a::after` (soulignement or), `.drop-cap`, focus-visible global (outline navy + anneau or), `@media (prefers-reduced-motion)` | `index.css:100-375` |
| Keyframes | `premium-ambient-sweep` 18 s, `premium-grid-drift` 28 s, `marquee` (inline, inutilisé) ; Motion : flottement hero 8 s, pulse or 1.8 s | `index.css:326-334`, `Hero.tsx:130-217` |
| Logo / favicon / OG | carré navy « CD » or ; `favicon.svg` 64×64 `rx=12` ; `og-default.svg` 1200×630 (carré en `#0a1228`, H1 différent du site, « OVH France ») | `Logo.tsx`, `public/favicon.svg`, `public/og-default.svg` |
| ADN reconnaissable | trio crème/navy/or sans blanc pur en fond ; triplet eyebrow mono / H2 Cormorant / paragraphe Inter ; surligneur bleu ciel ; hairlines navy 8 % ; capsules `rounded-full` (89 occ.) ; micro-signaux dossier en mono (`#CD-2026-0421`, « Étape 01 ») ; mouvement lent et feutré ; hero card « pièce à conviction » ; sections navy à bord or ; détails éditoriaux (drop cap, citations italiques) ; aucune image raster | design.md §8 |
| Écarts vs `PLAN.md` | 17 tokens vs 10 prévus ; `Counter.tsx` inexistant ; `Partners`/`Testimonials` supprimés (`7fafc9b`) ; Avant/Après symétrique (pas de diagonale) ; Workflow en `div scaleX` (pas SVG `pathLength`) ; un seul layout de mockup pour les 3 onglets | design.md §7 |

---

## 13. Identité publique & coordonnées actuelles (règle I.5)

Décisions possibles : **R-NOM** = remplacer par « ClairDossier » · **R-TEL** = remplacer par « Service Assistance ClairDossier — 04 91 95 90 32 » (`tel:0491959032`) · **C-LEG** = conserver : obligation légale · **C-TECH** = conserver : technique.

Un seul numéro existe dans tout le dépôt (`+33 7 82 98 36 44` / `33782983644`) ; le nouveau `04 91 95 90 32` n'apparaît nulle part. Chaîne de génération : `legal.ts`, `whatsapp.ts`, `gen-markdown.ts`, `index.html`, `llms.txt`, `Footer.tsx` sont les **sources** ; les 27 `public/**/*.md` sont régénérés par `npm run gen:md` (corriger les `.md` seuls serait écrasé au build).

| Donnée | Texte exact | Fichier:ligne | Zone | Décision I.5 | Remarque |
|---|---|---|---|---|---|
| Nom | « Édité par Roman Gomes » | `src/components/Footer.tsx:46` | Footer commercial (toutes pages) | **R-NOM** | ex. « © 2026 ClairDossier · SIREN 105 490 734 » |
| Nom | « éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE. » | `scripts/gen-markdown.ts:45` → footer des 27 `public/**/*.md` | SEO/IA | **R-NOM** | 1 ligne → 27 fichiers |
| Nom | « Roman Gomes — entrepreneur individuel — SIREN 105 490 734 — Château-Gombert, 13013 Marseille, France. » | `scripts/gen-markdown.ts:463` → `public/contact.md:20` | SEO/IA (contact) | **R-NOM** | renvoyer à `/mentions-legales` pour l'identité complète |
| Nom | « ClairDossier édité par Roman Gomes, entrepreneur individuel (SIREN 105 490 734), Château-Gombert, 13013 Marseille, France. … WhatsApp : +33 7 82 98 36 44. Site réalisé par Nouh BENZIDANE (https://nouhbenzidane.fr). » | `public/llms.txt:5` | SEO/IA (statique) | **R-NOM + R-TEL** | fichier non généré, à éditer à la main |
| Nom | « …édité par Roman Gomes, entrepreneur individuel … SIREN 105 490 734 (SIRET siège : 105 490 734 00016) … Château-Gombert, 13013 Marseille, France. » | `src/data/legal.ts:36` (→ `public/mentions-legales.md:16`) | Mentions légales — éditeur | **C-LEG** | LCEN art. 6-III-1 (nom, domicile, RNE) |
| Nom | « Le directeur de la publication … est Roman Gomes » | `src/data/legal.ts:62` (→ `mentions-legales.md:28`) | Mentions légales | **C-LEG** | LCEN 6-III-1-c |
| Nom | « Roman Gomes, entrepreneur individuel (SIREN 105 490 734), ci-après « ClairDossier » ou « l'Éditeur » » | `src/data/legal.ts:136` (→ `cgv.md:16`) | CGV art. 1 | **C-LEG** | identification du cocontractant |
| Nom | « Le responsable du traitement … est Roman Gomes, entrepreneur individuel, SIREN 105 490 734 … Château-Gombert, 13013 Marseille » | `src/data/legal.ts:262` (→ `politique-confidentialite.md:16`) | Confidentialité | **C-LEG** | RGPD art. 13.1.a |
| Nom (prestataire) | `<meta name="author" content="Nouh BENZIDANE" />` | `index.html:18` | SEO (toutes pages) | **R-NOM** | → `content="ClairDossier"` |
| Nom (prestataire) | « Réalisation et développement du site : Nouh BENZIDANE — https://nouhbenzidane.fr. » | `src/data/legal.ts:52` (→ `mentions-legales.md:24`) | Mentions légales — crédit | **R-NOM** | crédit non imposé par la loi ; **À VÉRIFIER** : clause contractuelle de crédit avec le prestataire |
| Nom (prestataire) | « Site réalisé et développé par Nouh BENZIDANE — https://nouhbenzidane.fr. » | `scripts/gen-markdown.ts:465` → `public/contact.md:22` | SEO/IA | **R-NOM** | idem |
| Téléphone | `WHATSAPP_NUMBER = '33782983644'` | `src/lib/whatsapp.ts:5` | TECH → liens `wa.me` (`Contact.tsx:37,70`, `Pricing.tsx:276`, `DossierFlow.tsx:386`) | **R-TEL** | `33491959032` **uniquement si** le 04 91 95 90 32 est sur WhatsApp Business ; sinon liens `tel:+33491959032` (**À VÉRIFIER**) |
| Téléphone | `WHATSAPP_DISPLAY = '+33 7 82 98 36 44'` | `src/lib/whatsapp.ts:6` → `Contact.tsx:83`, `Pricing.tsx:291` | COM (/contact, /tarifs) | **R-TEL** | |
| Téléphone | « Contact : contact.clairdossier@icloud.com — WhatsApp : +33 7 82 98 36 44. » | `src/data/legal.ts:48` (→ `mentions-legales.md:22`) | Mentions légales | **R-TEL** | I.5.2 vise explicitement les mentions légales ; un téléphone doit rester (LCEN) |
| Téléphone | « - WhatsApp : +33 7 82 98 36 44 (réponse en moyenne sous 1 h en journée) » | `scripts/gen-markdown.ts:129` → `public/index.md:119`, `public/page.md:119` | SEO/IA | **R-TEL** | |
| Téléphone | « …Contact : contact.clairdossier@icloud.com ou WhatsApp +33 7 82 98 36 44. » | `scripts/gen-markdown.ts:365` → `public/tarifs.md:153` | SEO/IA | **R-TEL** | |
| Téléphone | « - **WhatsApp** : +33 7 82 98 36 44 — réponse en moyenne sous 1 h en journée (9 h – 19 h, lundi-vendredi). » | `scripts/gen-markdown.ts:456` → `public/contact.md:13` | SEO/IA | **R-TEL** | horaires à aligner sur le nouveau service |
| Wording WhatsApp | H1 « Une réponse sur WhatsApp, dans l'heure. », carte « WhatsApp », « Continuer sur WhatsApp », « Le message sera envoyé via WhatsApp », « On vous recontacte sur le numéro WhatsApp… » | `src/pages/Contact.tsx:61,80,120-121,176,185,188` ; `Pricing.tsx:289,416` ; SEO `Contact.tsx:44` | COM | **R-TEL** (libellés → « Service Assistance ClairDossier ») | dépend de la décision WhatsApp Business vs ligne vocale |
| E-mail | `contact.clairdossier@icloud.com` | `src/data/legal.ts:48,62,114,178,182,216,262,370` (+ copies `.md`) | Pages légales | **C-LEG** | LCEN exige un e-mail ; **À VÉRIFIER** : migration vers `@clair-dossier.com` (domaine déjà utilisé par Resend en expéditeur) |
| E-mail | `contact.clairdossier@icloud.com` | `Contact.tsx:98-99` ; `Security.tsx:316,319` ; `Pricing.tsx:304,327` ; `LegalPage.tsx:134,137` ; `index.html:49` (noscript) ; `DossierFlow.tsx:39` (`TEAM_EMAIL`, réception des dossiers) ; `gen-markdown.ts:130-131,365,433,457-458` ; `llms.txt:105` | COM / SEO / app | **C-TECH** | canal actif, hors I.5 ; `DossierFlow.tsx:39` reçoit des dossiers clients sur une boîte iCloud |
| E-mail | `prestige.seller@icloud.com` | `supabase/functions/notify-lead/index.ts:8` ; `supabase/migrations/20260621144123_admin_global_access.sql:1,21` | MAIL / ADMIN (non public) | **C-TECH** | identité de l'admin Supabase et destinataire des notifications ; changement = nouvelle migration + compte Auth |
| E-mail | `noreply@clair-dossier.com` / `sender_name ClairDossier` | `notify-lead/index.ts:7` ; `supabase/config.toml:222-223` | MAIL | **C-TECH** | déjà « ClairDossier » |
| Adresse | « Château-Gombert, 13013 Marseille » | `src/pages/Contact.tsx:104` (champ « Siège ») | COM (/contact) | **C-TECH** | hors I.5 (ni nom ni téléphone) ; siège d'un EI = domicile probable, à arbitrer (réduire à « Marseille, France ») |
| Adresse | « Château-Gombert, 13013 Marseille » | `legal.ts:36,262` ; footer `gen-markdown.ts:45,463` ; `llms.txt:5` | Légal / SEO | **C-LEG** (pages légales) ; suit **R-NOM** sur les lignes de footer/`llms.txt` | |
| Adresse hébergeur | « 88 Colin P Kelly Jr St, San Francisco, CA 94107, États-Unis » (GitHub Inc.) | `legal.ts:72` | Mentions légales | **C-LEG** | exactitude à maintenir si bascule Netlify |
| SIREN / SIRET / APE | `105 490 734` / `105 490 734 00016` / `4791A` | `legal.ts:36,40` ; `Footer.tsx:46` ; footers `.md` ; `llms.txt:5` | Légal / COM | **C-LEG** (légal) ; peut accompagner « ClairDossier » ailleurs | |
| JSON-LD `Organization` | `name: 'ClairDossier'`, `contactPoint` sans `telephone` | `src/lib/seo.tsx:85-100` | SEO | **C-TECH** | opportunité : ajouter `telephone: '+33-4-91-95-90-32'` |
| Image OG | « LEGALTECH · CLIENTS · PME · CABINETS », « OVH France » | `public/og-default.svg:31,38` | SEO | **C-TECH** (aucun nom/téléphone) | contenu divergent, §15 |
| Auteurs blog | « Rédaction ClairDossier » / « Cellule éditoriale » | `src/data/authors.ts:12-13` | COM | **C-TECH** | aucun nom personnel |
| Termes sans occurrence | `Cottant`, `13'UP`, `Dalbret`, `tel:`, numéros en `06`/`04`, `04 91 95 90 32` | — | — | — | grep : 0 |

Ordre d'exécution recommandé pour I.5 (phase d'écriture ultérieure) : 1) `whatsapp.ts:5-6` ; 2) `legal.ts:48,52` (garder `:36,62,136,262`) ; 3) `Footer.tsx:46` ; 4) `index.html:18` ; 5) `gen-markdown.ts:45,129,365,456,463,465` ; 6) `llms.txt:5` ; 7) `npm run gen:md` ; 8) grep de contrôle (`33782983644`, `+33 7 82`, `BENZIDANE` absents hors pages légales ; « Roman Gomes » uniquement `legal.ts:36,62,136,262` et copies).

---

## 14. État de santé (2026-08-23)

| Contrôle | Résultat |
|---|---|
| `npm run typecheck` | **OK** (`tsc --noEmit`) |
| `npm run build` | **OK** en 941 ms (`gen:md` + `tsc` + `vite build`) ; arbre git propre après build (les `.md` régénérés sont identiques) |
| Reproductibilité prod | hashes `react`/`supabase`/`motion`/`router`/CSS identiques à la prod ; `index-*.js` diffère uniquement par les `VITE_SUPABASE_*` |
| Chunks initiaux (`/`) | `index-DOvyzgrX.js` 150,37 kB (gzip 45,79) · `react-CBBoJgXi.js` 193,69 (60,49) · `supabase-Buf76L6m.js` 209,59 (54,63) · `motion-ZtdEAC6k.js` 121,55 (40,42) · `router-CjS7eph5.js` 37,89 (13,67) · `index-B6lhu7zR.css` 100,11 (27,43) → **≈ 713 kB JS brut / ≈ 215 kB gzip** + 27 kB CSS gzip |
| Chunks lazy | DossierDetail 26,67 · DossierFlow 23,13 · LegalPage 22,45 · Pricing 17,36 · Security 10,74 · Contact 7,92 · BlogPost 7,64 · Account 4,87 · FeatureDetail 4,42 · Signup 4,38 · BlogIndex 4,11 · FeaturesIndex 4,00 · Login 2,87 · NotFound 1,36 kB ; partagés `authors` 0,39, `whatsapp` 0,24 kB |
| Polices | 124 fichiers woff/woff2 (≈ 2,1 Mo) déployés pour tous les sous-ensembles ; seuls latin/latin-ext (≈ 21–49 kB chacun) sont téléchargés ; aucun `preload` |
| Tests | **aucun** (aucun `*.test.*`, `*.spec.*`, config Vitest/Jest/Playwright, dossier `tests`/`e2e`) |
| Lint | **aucun** (ni ESLint ni Prettier) |
| CI | `npm ci` + `npm run build` uniquement ; aucun test, aucun lint, aucune étape Supabase |
| Node | CI/Netlify 22 vs local 24.19.0 ; aucun `engines` |
| Supabase live | joignable (`/auth/v1/health` → 401 sans clé) ; schéma/policies/fonction réellement déployés **À VÉRIFIER** |
| Stripe live | 12 Payment Links présents dans le bundle ; état des produits/prix/mode **À VÉRIFIER** |
| Site live | HTTP 200 sur `/`, 404 sur toutes les autres routes ; HTTP non redirigé vers HTTPS ; aucun en-tête de sécurité |

---

## 15. Risques & dettes

Gravité : **C** critique · **E** élevée · **M** moyenne · **F** faible. Chaque ligne est un constat de l'état « avant » ; aucune action n'est engagée par ce document.

### 15.1 Dépôt et gouvernance

| ID | Gravité | Constat | Preuve |
|---|---|---|---|
| G1 | **C** | **Branche distante destructive non fusionnée** `origin/claude/legal-defense-intelligence-os-ko41pt` (dernier commit `cfd840a` 2026-08-20 « chore: favicon aux couleurs v4 — dernière trace ClairDossier purgée ») : 244 fichiers, +23 229 / −14 141 lignes vs `origin/main`, purge du site vitrine, suppression de `Signup`/`Security` et des migrations. **Ne jamais fusionner** (PARTIE I.3). | `git diff --stat origin/main origin/claude/legal-defense-intelligence-os-ko41pt` |
| G2 | M | 30+ autres branches distantes (`cursor/*` ×28 dont « refonte-clairdossier-legaltech » ×13, `legacy/legaltech-supabase`, `showcase`, `gh-pages`, `dependabot/*`) : refontes alternatives non fusionnées, source de confusion. | `git branch -a` |
| G3 | M | Repo distinct « Desktop/CLAIR DOSSIER/PROJET ClairDossier » (Vite + Porsche Design System, Vercel) = projet ancien, **pas** la source du site live. | fait établi par l'orchestrateur |
| G4 | M | Déploiement backend manuel : aucune étape `supabase db push` / `functions deploy` en CI ; dérive dépôt ↔ prod possible ; `seed.sql` référencé mais absent. | `deploy.yml`, `config.toml:65` |
| G5 | M | Deux cibles d'hébergement maintenues (Pages = prod, Netlify = « cible finale ») avec comportements différents (404 vs 200, en-têtes, cache) ; décision documentée seulement dans un commentaire YAML. | `deploy.yml:3-6`, `netlify.toml` |
| G6 | F | Documentation obsolète : `README.md:35-43` (8 fonctionnalités, 3 plans, 3 articles, flow localStorage), `PLAN.md:112` (« 3 plans + add-ons »), `llms.txt:18` (« 7 formules » en nommant 6). | fichiers cités |
| G7 | F | Aucun test, aucun lint, aucun `engines` ; `scripts/` hors `tsconfig` ; Node 22 CI vs 24 local. | `package.json`, `tsconfig.json:28` |

### 15.2 SEO et hébergement

| ID | Gravité | Constat | Preuve |
|---|---|---|---|
| S1 | **C** | **25/26 URL du sitemap répondent HTTP 404** sur GitHub Pages (fallback `404.html`) ; seule `/` répond 200. Googlebot traite un 404 comme page inexistante malgré le rendu JS. | vérifié en prod ; `vite.config.ts:9-17` |
| S2 | E | Tout le SEO par page (title, description, canonical, OG, JSON-LD) est injecté **côté client** ; le HTML servi est identique pour toutes les routes (3 759 o, sans JSON-LD). Aperçus sociaux et crawlers sans JS voient l'accueil partout. | `seo.tsx:35-81`, `index.html:15` |
| S3 | E | `http://www.clair-dossier.com/` répond 200 sans redirection HTTPS ; aucun HSTS ; apex http → `http://www` (« Enforce HTTPS » Pages inactif, **À VÉRIFIER** côté réglages du dépôt GitHub). Contredit `llms.txt:67` / `securite.md` (« HSTS preload »). | vérifié en prod |
| S4 | E | Aucun en-tête de sécurité en prod (CSP, XFO, nosniff, Referrer-Policy, Permissions-Policy) : la config existe dans `netlify.toml:19-26` mais **ne s'applique pas** sur Pages. Site embarquable en iframe ; sessions Supabase sans CSP. | vérifié en prod |
| S5 | M | `cache-control: max-age=600` sur les assets hachés (pas d'`immutable`) ; ≈ 713 kB JS initial dont 210 kB de `supabase-js` chargé sur les pages marketing (`AuthProvider` racine). | `main.tsx:14` |
| S6 | M | `og:image`/`twitter:image`/`Organization.logo` en **SVG** (non rendu par la plupart des réseaux) ; OG divergente (« OVH France », « CABINETS », H1 différent). | `index.html:27,36`, `og-default.svg` |
| S7 | F | `rel=alternate rss` vers `/blog` (HTML, 404) : aucun flux RSS. | `index.html:13` |
| S8 | F | Titres longs (suffixe 54 car.), title/description de `/` divergents entre JS et HTML statique ; `SearchAction` vers `/blog?q=` non implémenté ; JSON-LD incohérents (auteur `Person` vs `Organization`, `applicationCategory` différent `/` vs `/tarifs`, `dateModified = datePublished`). | `seo.tsx:36,108-112`, `Home.tsx:46-47`, `BlogIndex.tsx:35`, `BlogPost.tsx:38-46` |
| S9 | F | Canonicals anormaux (`NotFound` → `/`, `DossierDetail` → `/compte`) ; `/dossier/nouveau` indexable malgré `RequireAuth` et `Disallow` ; `Claude-Web` n'est plus l'UA Anthropic principal (**À VÉRIFIER**). | `NotFound.tsx:7`, `DossierDetail.tsx:433`, `DossierFlow.tsx:403-411`, `robots.txt:15` |
| S10 | F | `sitemap.xml` écrit à la main (pas généré, pas de `lastmod` hors blog) ; `gen:md` écrit dans `public/` (suivi par git) pendant le build. | `gen-markdown.ts:31-38` |
| S11 | F | Slugs d'URL indexés obsolètes par rapport aux titres (`pieces-ocr`, `validation-avocat`, `messagerie-securisee`, `coffre-fort`, `calendrier-relances`, `reponse-auto-mails`) — ne pas renommer sans 301 (impossibles sur Pages). | `features.ts:16-183` |
| S12 | F | Aucun MX/SPF/DMARC sur `clair-dossier.com` alors que `noreply@clair-dossier.com` est utilisé comme expéditeur (Resend) ; usurpation possible. | `dig`, `config.toml:222` |

### 15.3 Contenu, juridique, identité

| ID | Gravité | Constat | Preuve |
|---|---|---|---|
| L1 | E | **Contenu servi aux IA/moteurs divergent du site visible** : `securite.md`, `index.md:17`, `llms.txt:64-74`, `og-default.svg:38`, blog `rgpd-legaltech.ts:99` affirment OVHcloud Roubaix/Strasbourg, AES-256, HSTS preload + pinning, bastion/WAF, KMS 90 j, 2FA admin, RPO 15 min/RTO 4 h, HDS 2026 T3, ISO 27001 2027, pentest annuel, « IA avancée GPT-5.5 », « validation par un avocat inscrit au barreau » — alors que `Security.tsx:14-75` est prudent, que les mentions légales disent GitHub Pages (USA), que les CGV art. 6 disent « aucune analyse automatique », et que l'infra réelle est GitHub/Fastly + Supabase + Resend. Risque de pratique commerciale trompeuse. | `gen-markdown.ts:70,381-438` |
| L2 | M | Contradictions juridiques internes : TVA « non applicable 293 B » (`legal.ts:44`) vs « TVA 20 % » (`legal.ts:164`, `Pricing.tsx:66`) ; « société ClairDossier » (`legal.ts:86`) vs EI ; tribunaux de Paris (`legal.ts:240`) vs siège Marseille ; CGV « facturation mensuelle » (`legal.ts:168`) vs 6 liens annuels vendus ; « 4 étapes » (`llms.txt:23`) vs 5 ; « relances automatiques » / « projets de réponse aux e-mails » (`index.md:16`, `index.html:17`) vs simple affichage des échéances / récapitulatif. | fichiers cités |
| L3 | M | Sous-traitants réels non nommés dans la politique de confidentialité (Supabase, Resend ; région Supabase **À VÉRIFIER**) ; pas de DPO ; pas de section transferts hors UE (GitHub Inc., USA) ; `localStorage` non mentionné dans la page cookies ; formulaire de contact envoyant nom/e-mail/message vers WhatsApp (Meta) sans mention dans la politique. | `legal.ts:322-325`, `Contact.tsx:19-38` |
| L4 | M | Exposition de données personnelles en zone commerciale : nom de l'éditeur, quartier de résidence, portable personnel (aussi en clair dans le JS), nom du prestataire en `<meta author>` sur chaque page, répliqués dans 30+ fichiers `.md`/`llms.txt` destinés aux crawlers IA. → traité par I.5 (§13). | §13 |
| L5 | M | Promesses non tenues : FAQ « résiliation depuis l'espace facturation » (`Pricing.tsx:54`), CGV « via l'espace client » (`legal.ts:178`), « changement de plan prorata » — aucun portail ni gestion d'abonnement ; `FinalCTA.tsx:35` « validé par un professionnel » vs FAQ « C'est vous. » ; hero card « Validation pro (option) », « Sous 24 h ouvrées » ; `BlogIndex.tsx:52` « écrits par des avocats » vs auteur unique. | fichiers cités |
| L6 | F | Incohérences de contenu : « Huit briques » (`FeaturesGrid.tsx:17`) pour 9 features ; « Trois lectures » (`BlogPreview.tsx:20`) pour 7 articles ; labels de frise hero (`Attente`, `Validation`) ≠ `statuses.ts` (`Transmis`, `En cours`) ; ids internes hérités (`avocat`, `cabinet`, `attente-avocat`, `qui-valide`…) ; `?topic=`/`?plan=` ignorés par `/contact`. | `public-content.md` §7 |

### 15.4 Application, sécurité, données

| ID | Gravité | Constat | Preuve |
|---|---|---|---|
| A1 | E | **Aucun gating d'abonnement** : tout compte connecté accède à tout ; la bannière « Abonnement confirmé » s'affiche sur un simple `?paid=x` sans vérification ; aucun webhook, aucune table d'abonnement, aucun rapprochement client Stripe ↔ compte (pas de `client_reference_id`). Le modèle d'abonnement est purement déclaratif. | `Account.tsx:31,89-98`, `pricing.ts:45-182` |
| A2 | E | **Garde de route désactivée sans variables d'env** : `RequireAuth` laisse passer si `configured === false` ; un build sans `VITE_SUPABASE_*` expose l'UI de `/compte`, `/dossier/nouveau`, `/compte/dossier/:id`. | `RequireAuth.tsx:24-27`, `supabase.ts:6,17` |
| A3 | E | **Statut de dossier jamais mis à jour** : insert en `transmis` (jamais `brouillon`), aucun `update` dans le front, aucune policy UPDATE admin → frise d'avancement figée à l'étape 3 pour tous les dossiers. | `DossierFlow.tsx:348`, `DossierDetail.tsx:92-106`, §6.3 |
| A4 | E | **Confirmation e-mail non gérée** à l'inscription : pas d'écran intermédiaire, redirection vers `/compte` puis rebond `/connexion` sans message (si `enable_confirmations = true` en prod — **À VÉRIFIER**). | `Signup.tsx:44-48`, `auth.tsx:88-90`, `config.toml:205` |
| A5 | M | Toute l'isolation repose sur la RLS (requêtes sans filtre `user_id`, détail sans vérification `row.user_id`) ; correct si les policies sont déployées à l'identique (**À VÉRIFIER**) ; `docs_insert_own` ne vérifie pas la propriété de `dossier_id` ; policies sans `to authenticated` (erreurs 42501 possibles pour `anon`). | `Account.tsx:47-50`, `…init.sql:62` |
| A6 | M | Clé anon Supabase + URL projet en clair dans `deploy.yml:42-43`, `netlify.toml:26` **et** dans la migration `notify_lead` (`…lead_notification.sql:15-18`) ; Edge Function `notify-lead` appelable par quiconque détient la clé anon (spam e-mail vers l'admin) ; payload `to_jsonb(new)` complet envoyé. | fichiers cités |
| A7 | M | Admin unique désigné par e-mail en dur dans une migration ; si le compte n'existait pas à l'application de M3, `app_admins` est vide (**À VÉRIFIER**) ; aucun moyen applicatif d'ajouter un admin. | `…admin_global_access.sql:20-22` |
| A8 | M | Brouillon `localStorage clairdossier_draft` non cloisonné par utilisateur, contenant `situation`, montant, contrepartie ; persiste après `signOut`. Session (`user_metadata`, e-mail) lisible en `localStorage` sans CSP. | `DossierFlow.tsx:38,233`, `auth.tsx:101-104` |
| A9 | M | Synthèse de dossier (e-mail du compte, montant, situation, contrepartie) envoyée vers WhatsApp (Meta) ou `mailto:` iCloud, à l'initiative de l'utilisateur. | `DossierFlow.tsx:308-330,385-391` |
| A10 | M | Uploads sans contrôle de taille/MIME/nombre côté client ni bucket ; échec d'upload silencieux ; glisser-déposer annoncé non implémenté ; fichiers non persistés au rechargement. | `DossierFlow.tsx:359-373,806-823` |
| A11 | M | Erreurs réseau/RLS ignorées sur `/compte` et le détail (affichées comme « Aucun dossier » / « Dossier introuvable ») ; `storage.remove` non vérifié (orphelins) ; fichiers storage orphelins à la suppression de compte (pas de cascade storage). | `Account.tsx:42-65`, `DossierDetail.tsx:241-291,414-418` |
| A12 | M | Inexistants : reset mot de passe, édition profil, e-mails transactionnels client, export RGPD/suppression de compte en self-service, suppression de pièce/dossier côté UI, journal d'audit, organisations/multi-utilisateurs, rôles. | `App.tsx`, §6 |
| A13 | F | `next` non validé (Login/Signup) ; utilisateur connecté peut revisiter `/connexion`/`/inscription` ; pas de déconnexion dans la Nav ; messages Supabase bruts en anglais ; « 6 caractères minimum » vs 8 ; URLs signées 1 h sans régénération ; zip en mémoire ; `window.confirm`. | `app-auth.md` §7 |
| A14 | F | `password_requirements = ""`, captcha et MFA désactivés, sessions illimitées, `localhost` dans les redirect URLs (si `config.toml` reflète la prod — **À VÉRIFIER**). | `config.toml:152,174,192-196,250-255,281-283` |

### 15.5 Stripe

| ID | Gravité | Constat | Preuve |
|---|---|---|---|
| P1 | E | Aucun webhook, aucune source de vérité applicative sur les abonnements ; IDs Stripe non versionnés (seuls les URLs `buy.stripe.com`) ; schéma DB sans notion de plan. Toute migration V.3 part de zéro. | §7.6 |
| P2 | E | `create-stripe-products.mjs` est **destructif** (désactive tous les liens `metadata.planId`, y compris annuels) → les 12 URLs en dur deviennent mortes jusqu'à mise à jour manuelle ; `add-annual-prices.mjs` non idempotent ; SDK `stripe` non déclaré (scripts non reproductibles). | `create-stripe-products.mjs:49-65`, `add-annual-prices.mjs:5` |
| P3 | E | Divergence probable entre la page Tarifs (libellés dé-« IA-isés » le 2026-06-26) et les descriptions produits Stripe (« résumé IA », « GPT-5.5 »…) — **À VÉRIFIER** dans le dashboard. | `create-stripe-products.mjs:36-46`, commit `417708f` |
| P4 | M | TVA : site annonce HT + 20 % mais aucun `automatic_tax`/`tax_behavior` dans les scripts ; pas de `consent_collection` CGV ; redirect identique mensuel/annuel (`/compte?paid=<planId>`) ; redirect en dur vers la prod pour tous les environnements. | scripts |
| P5 | F | Code mort « Gratuit » (`priceMonthly === 0`) dans 3 fichiers ; aucun plan gratuit défini (limites du « compte gratuit » non spécifiées). | `Pricing.tsx:492`, `PricingPreview.tsx:88`, `gen-markdown.ts:103,333` |

### 15.6 Design et code

| ID | Gravité | Constat | Preuve |
|---|---|---|---|
| D1 | F | Composants non utilisés : `ui/Button.tsx`, `ui/Pill.tsx`, `ui/Card.tsx`, `primitives/Marquee.tsx`, `primitives/Magnetic.tsx` ; patterns dupliqués inline (~20 fichiers). À **conserver** (PRESERVE) tant qu'aucun mapping explicite ne décide de leur sort. | design.md A1 |
| D2 | F | `rounded-xl` (1,5 rem) > `rounded-2xl` (1 rem) ; `.sheen` déclaré deux fois ; tokens inutilisés (`navy-600`, `gold-300`, `sky-marker-deep`) ; `Reveal` prop `amount` jamais lue ; `Tabs`/`Accordion`/menu mobile sans `useReducedMotion` ; `top-[64px]` en dur ; `FinalCTA` double `sm:py-*`. | design.md A2–A11 |
| D3 | F | 124 fichiers de polices déployés ; règle `manualChunks fonts` morte ; `cssCodeSplit` sans effet ; `fflate` runtime pour un seul écran. | `vite.config.ts:28,38`, `index.css:3-13` |
| D4 | F | Types et constantes dupliqués (`DossierRow`, `STATUS_LABELS`, `inputCls`) ; aucun typage généré des tables Supabase ; trois vocabulaires de statuts (`statuses.ts`, `STATUS_LABELS`, SQL). | `app-auth.md` §7.3, F3 |
| D5 | F | `docs/baseline/screens/index.json` référence des fichiers `.png` alors que les captures sont en `.jpg` (48/48). | `index.json` |

---

## 16. Captures de référence — `docs/baseline/screens/`

| Élément | Valeur |
|---|---|
| Emplacement | `docs/baseline/screens/` (non suivi par git au 2026-08-23 — à versionner avec la baseline) |
| Contenu | **48 captures JPEG pleine page** + `index.json` (49 fichiers, ≈ 15 Mo) |
| Source | site **LIVE** `https://www.clair-dossier.com` le 2026-08-23 (pas le build local) |
| Méthode | `puppeteer-core` + Chrome ; **défilement progressif** de la page avant capture pour déclencher les `Reveal`/`Stagger` (viewport `once`, marge 240 px) ; capture `fullPage` |
| Viewports | `desktop` : 1440 px de large (ex. `home__desktop.jpg` 1440 × 11 541 px) ; `mobile` : 390 px avec émulation mobile (ex. `home__mobile.jpg` 390 × 21 025 px) |
| Nommage | `<route>__desktop.jpg` / `<route>__mobile.jpg`, `/` → `home`, `/` interne remplacé par `__` (ex. `blog__mise-en-demeure__desktop.jpg`, `dossier__nouveau__mobile.jpg`) |
| `index.json` | 48 entrées `{ route, label, status, finalUrl, title, h1, file }` — **`file` pointe vers `screens/<nom>.png` alors que les fichiers réels sont `.jpg`** (cf. D5) |
| Statuts HTTP relevés | `200` pour `/` ; `404` pour toutes les autres routes (fallback SPA GitHub Pages) ; `/fonctionnalites` et `/blog` → `finalUrl` avec slash final ; `/dossier/nouveau` → `finalUrl` `https://www.clair-dossier.com/connexion?next=%2Fdossier%2Fnouveau` (redirection `RequireAuth`, H1 « Se connecter ») |

Routes capturées (24 × 2 viewports) :

| Route | Fichiers | H1 capturé |
|---|---|---|
| `/` | `home__*` | Votre dossier administratif et juridique, clair, structuré et suivi. |
| `/fonctionnalites` | `fonctionnalites__*` | Neuf briques, un dossier administratif et juridique propre. |
| `/fonctionnalites/creation-guidee` … `/reponse-auto-mails` (9) | `fonctionnalites__<slug>__*` | titre de la fiche (§11) |
| `/tarifs` | `tarifs__*` | Une formule par usage. Pas de surprise. |
| `/securite` | `securite__*` | La sécurité administrative et juridique commence par la sécurité technique. |
| `/blog` | `blog__*` | Le droit administratif et juridique, expliqué calmement. |
| `/blog/mise-en-demeure` | `blog__mise-en-demeure__*` | Mise en demeure : le courrier qui débloque (souvent) la situation |
| `/contact` | `contact__*` | Une réponse sur WhatsApp, dans l'heure. |
| `/mentions-legales`, `/cgv`, `/politique-confidentialite`, `/cookies` | `<slug>__*` | Mentions légales · Conditions générales de vente · Politique de confidentialité · Cookies |
| `/connexion` | `connexion__*` | Se connecter |
| `/inscription` | `inscription__*` | Créer un compte |
| `/dossier/nouveau` | `dossier__nouveau__*` | Se connecter (redirigé) |
| `/page-inexistante-404` | `page-inexistante-404__*` | Cette page n'existe pas. |

Non capturés (auth requise) : `/compte`, `/compte/dossier/:id`, les 5 étapes de `/dossier/nouveau` connecté, les 6 autres articles de blog. **À compléter** avec un compte de test avant toute modification de l'espace client (II.7.4 étape 4 « capturer l'état avant »).

---

## Annexe — Points « À VÉRIFIER » (hors de portée d'une lecture du dépôt)

| # | Point | Où vérifier |
|---|---|---|
| V1 | Migrations effectivement appliquées, contenu de `app_admins`, policies déployées, version de `notify-lead`, secrets (`RESEND_API_KEY`), `verify_jwt`, limites du bucket, région du projet | Dashboard Supabase `buzgokfmxpmyceppvjpp` |
| V2 | Paramètres Auth hébergés (confirmation e-mail, SMTP Resend, redirect URLs, captcha, MFA, templates) | Dashboard Supabase > Authentication |
| V3 | Produits/prix/liens Stripe réels (IDs, mode live/test, descriptions, TVA, abonnés actifs, doublons de prix, liens annuels actifs) | Dashboard Stripe |
| V4 | « Enforce HTTPS » et réglages Pages du dépôt GitHub ; variables d'env et état du site Netlify | GitHub / Netlify |
| V5 | Domaine `clair-dossier.com` vérifié chez Resend (SPF/DKIM) malgré l'absence de TXT DNS | Resend |
| V6 | Données Search Console (indexation des 25 URL en 404, soft 404) | Google Search Console |
| V7 | 04 91 95 90 32 enregistré ou non sur WhatsApp Business (conditionne `whatsapp.ts` et le wording /contact) | décision humaine |
| V8 | Clause contractuelle de crédit avec le prestataire « Nouh BENZIDANE » | décision humaine |
| V9 | Hébergeur à déclarer dans les mentions légales si bascule Netlify ; nomination de Supabase/Resend comme sous-traitants | décision humaine / juridique |
| V10 | UA `Claude-Web` vs `ClaudeBot` dans `robots.txt` | documentation Anthropic |
