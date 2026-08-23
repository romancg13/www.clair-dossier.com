# ClairDossier — Audit PHASE 0 : routes, SEO, hébergement, build

Date : 2026-08-23 · Lecture seule · Repository : `/Users/Roman_784/Documents/Codex/2026-07-02/contrainte-absolue-ne-pas-toucher-aux/work/www.clair-dossier.com`

Dépôt git interne : `origin = https://github.com/romancg13/www.clair-dossier.com.git`, 72 commits, premier commit 2026-05-14, dernier commit `24e1e2b` du 2026-07-02 (« Ameliore les animations visuelles premium »). Arbre de travail propre (`git status --porcelain` vide) après le build local du jour.

Fichiers lus intégralement : `src/App.tsx`, `src/main.tsx`, `index.html`, `src/lib/seo.tsx`, `public/robots.txt`, `public/sitemap.xml`, `public/llms.txt`, `public/CNAME`, `public/index.md`, `public/page.md`, `scripts/gen-markdown.ts`, `netlify.toml`, `.github/workflows/deploy.yml`, `vite.config.ts`, `tsconfig.json`, `package.json`, `.env.example`, `.gitignore`, `src/components/RequireAuth.tsx`, `src/components/Layout.tsx`, `src/components/Footer.tsx`, `src/pages/Home.tsx`, `src/pages/NotFound.tsx`, `src/lib/supabase.ts`, `src/data/authors.ts`, `src/data/blog/index.ts`. Lus partiellement (en-têtes et appels `<Seo>` uniquement) : les autres fichiers de `src/pages/*.tsx`, `src/data/features.ts`, `src/data/legal.ts`, `src/data/blog/*.ts`, `src/data/pricing.ts`, `src/components/Nav.tsx`, `src/index.css`, `README.md`. Aucun fichier `.env` lu. Aucune commande git modifiante exécutée.

Vérifications réseau complémentaires (requêtes `curl -sI`, HEAD, lecture seule) sur https://www.clair-dossier.com et https://clair-dossier.netlify.app le 2026-08-23 — les résultats sont explicitement marqués « vérifié en prod » ci-dessous.

---

## 1. Routes déclarées dans `src/App.tsx`

Structure : un unique `<Routes>` (App.tsx:48) avec une route parente sans chemin `<Route element={<Layout />}>` (App.tsx:49) ; `Layout` rend `<Nav />`, `<main id="main"><Outlet /></main>`, `<Footer />` (Layout.tsx:24-33) et remet le scroll à zéro + focus sur `<main>` à chaque changement de `pathname` (Layout.tsx:13-22). Le routeur est `BrowserRouter` (main.tsx:13), enveloppé dans `AuthProvider` (main.tsx:14). `Home` est importé en eager (App.tsx:7) ; toutes les autres pages passent par `lazy()` via l'helper `named()` (App.tsx:12-13) ou `lazy()` direct pour `LegalPage` (App.tsx:23-25), chacune dans son propre `<Suspense fallback={<RouteFallback />}>` (App.tsx:32-44).

| # | Chemin (relatif à `/`) | Composant de page | Fichier source | Lazy | RequireAuth | Déclaration (App.tsx) | Remarques |
|---|---|---|---|---|---|---|---|
| 1 | `/` (index) | `Home` | `src/pages/Home.tsx` | **non** (eager, App.tsx:7) | non | :50 | Seule route non lazy |
| 2 | `/fonctionnalites` | `FeaturesIndex` | `src/pages/FeaturesIndex.tsx` | oui (:15) | non | :51-58 | |
| 3 | `/fonctionnalites/:slug` | `FeatureDetail` | `src/pages/FeatureDetail.tsx` | oui (:16) | non | :59-66 | Slug inconnu → rend `<NotFound />` **sans changer l'URL** (FeatureDetail.tsx:12). 9 slugs valides (features.ts:16,37,58,79,100,121,142,163,183) |
| 4 | `/tarifs` | `Pricing` | `src/pages/Pricing.tsx` | oui (:17) | non | :67-74 | |
| 5 | `/securite` | `Security` | `src/pages/Security.tsx` | oui (:18) | non | :75-82 | Ancres `#conformite` (Security.tsx:167) et `#dpa` (Security.tsx:224) ciblées par le footer (Footer.tsx:14-15) |
| 6 | `/blog` | `BlogIndex` | `src/pages/BlogIndex.tsx` | oui (:19) | non | :83-90 | |
| 7 | `/blog/:slug` | `BlogPost` | `src/pages/BlogPost.tsx` | oui (:20) | non | :91-98 | Slug inconnu → `<NotFound />` sans changer l'URL (BlogPost.tsx:17). 7 slugs valides (blog/index.ts:11-19) |
| 8 | `/contact` | `Contact` | `src/pages/Contact.tsx` | oui (:21) | non | :99-106 | Lien `/contact?topic=commercial` depuis Pricing.tsx:340, mais Contact.tsx ne lit **pas** `useSearchParams` (Contact.tsx:1-17 : `topic` initialisé à `'demo'`) |
| 9 | `/dossier/nouveau` | `DossierFlow` | `src/pages/DossierFlow.tsx` | oui (:22) | **oui** (:110) | :107-116 | |
| 10 | `/inscription` | `Signup` | `src/pages/Signup.tsx` | oui (:27) | non | :117-124 | |
| 11 | `/connexion` | `Login` | `src/pages/Login.tsx` | oui (:28) | non | :125-132 | Lit `?next=` (Login.tsx:10-11), défaut `/compte` |
| 12 | `/compte` | `Account` | `src/pages/Account.tsx` | oui (:29) | **oui** (:136) | :133-142 | |
| 13 | `/compte/dossier/:id` | `DossierDetail` | `src/pages/DossierDetail.tsx` | oui (:30) | **oui** (:146) | :143-152 | |
| 14 | `/mentions-legales` | `LegalPage slug="mentions-legales"` | `src/pages/LegalPage.tsx` | oui (:23-25) | non | :153-160 | Données : legal.ts:21-26 |
| 15 | `/cgv` | `LegalPage slug="cgv"` | idem | oui | non | :161-168 | legal.ts:121-126 |
| 16 | `/politique-confidentialite` | `LegalPage slug="politique-confidentialite"` | idem | oui | non | :169-176 | legal.ts:247-252 |
| 17 | `/cookies` | `LegalPage slug="cookies"` | idem | oui | non | :177-184 | legal.ts:387-392 |
| 18 | `*` (catch-all) | `NotFound` | `src/pages/NotFound.tsx` | oui (:26) | non | :185-192 | Rendu **dans** le Layout (Nav + Footer) |

Total : 17 routes nommées + 1 catch-all. Aucune route d'alias, aucune route de redirection déclarative (`<Route element={<Navigate/>}>`), aucune gestion de trailing slash ni de casse dans le code.

### Redirections et navigation programmatique

| Source | Condition | Cible | Fichier:ligne |
|---|---|---|---|
| `RequireAuth` | `configured && !session` | `<Navigate to="/connexion?next=<pathname+search encodé>" replace />` | RequireAuth.tsx:25-27 |
| `RequireAuth` | `loading` | Rend un placeholder « Chargement… » (pas de redirection) | RequireAuth.tsx:10-22 |
| `RequireAuth` | `!configured` (build sans `VITE_SUPABASE_*`) | **Ne bloque pas** : les routes « protégées » deviennent publiques (commentaire « on ne bloque pas la démo ») | RequireAuth.tsx:24-25 ; `configured` vient de `isSupabaseConfigured` (supabase.ts:6, auth.tsx:110) |
| `Login` après succès | — | `navigate(next, { replace: true })`, `next` = `?next` ou `/compte` | Login.tsx:11, 28 |
| `Signup` après succès | — | `navigate(next, { replace: true })` | Signup.tsx:48 |
| `Account` déconnexion | — | `navigate('/')` | Account.tsx:80-81 |
| Apex → www | — | **Vérifié en prod** : `https://clair-dossier.com/` → `301` vers `https://www.clair-dossier.com/` ; `http://clair-dossier.com/` → `301` vers `http://www.clair-dossier.com/` (pas directement vers https) | Géré par GitHub Pages (hors code) |
| http → https | — | **Vérifié en prod** : `http://www.clair-dossier.com/` répond `200 OK` **sans redirection** vers https (« Enforce HTTPS » GitHub Pages non effectif) | Hors code |

### Comportement 404

- Côté application : la route `*` rend `NotFound` (App.tsx:185-192) qui émet `<Seo title="Page introuvable" … path="/" noindex />` (NotFound.tsx:7) → `robots: noindex, follow`, **canonical = `https://www.clair-dossier.com/`** (page d'accueil) pour toute URL inconnue (effet de `path="/"` via seo.tsx:37, 66).
- Côté hébergeur : `vite.config.ts:9-17` copie `dist/index.html` en `dist/404.html` à la fin du bundle (plugin `spa-fallback`). Vérifié localement : `dist/404.html` et `dist/index.html` sont identiques (3759 octets).
- **Vérifié en prod (GitHub Pages)** : `https://www.clair-dossier.com/tarifs` → `HTTP/2 404`, `https://www.clair-dossier.com/blog/mise-en-demeure` → `HTTP/2 404`, `https://www.clair-dossier.com/dossier/nouveau` → `HTTP/2 404`, avec le même `etag: "6a467a60-eaf"` que `/` (`eaf` hex = 3759 octets = taille de `dist/index.html`). Autrement dit : **toutes les routes profondes chargées directement renvoient un statut HTTP 404** avec le contenu de l'index ; le rendu React prend ensuite le relais côté client. Seul `/` renvoie 200.
- Sur Netlify (cible « finale » selon deploy.yml:3-6), la règle `[[redirects]] from="/*" to="/index.html" status=200` (netlify.toml:13-16) renvoie 200. **Vérifié** : `https://clair-dossier.netlify.app/tarifs` → `HTTP/2 200`.

---

## 2. SEO par route publique (tel que produit par `src/lib/seo.tsx`)

### Mécanique commune (`src/lib/seo.tsx`)

- `Seo` est un composant **client-side uniquement** : tout est écrit dans `document.head` dans un `useEffect` (seo.tsx:35-79) et il retourne `null` (seo.tsx:81). Avant exécution du JS, tout crawler voit les valeurs par défaut de `index.html`.
- Constantes : `SITE_URL = 'https://www.clair-dossier.com'` (seo.tsx:13), `SITE_NAME = 'ClairDossier'` (:14).
- Titre : si `title` contient « ClairDossier », il est utilisé tel quel, sinon suffixé `« — ClairDossier · Dossier juridique clair, structuré et suivi »` (seo.tsx:36) — suffixe de 54 caractères.
- `canonical` = `SITE_URL + path` (seo.tsx:37, 60-66) ; `path` par défaut `/` (seo.tsx:29).
- `robots` = `index, follow, max-image-preview:large` ou `noindex, follow` si `noindex` (seo.tsx:42-47).
- Open Graph : `og:title` (= titre complet), `og:description`, `og:url` (= canonical), `og:type` (`website` par défaut, `article` si demandé), `og:site_name`, `og:locale fr_FR`, `og:image` (absolu ; défaut `/og-default.svg`, seo.tsx:31, 38) (seo.tsx:48-54). `og:image:width/height` ne sont **pas** réécrits (restent ceux d'index.html:28-29 = 1200×630).
- Twitter : `summary_large_image`, title, description, image (seo.tsx:55-58).
- JSON-LD : suppression de tous les `<script data-seo-jsonld>` puis injection d'un `<script type="application/ld+json">` par objet (seo.tsx:68-78). Builders exportés : `orgSchema` (Organization, logo = `/favicon.svg`, seo.tsx:85-100), `websiteSchema` (WebSite + `SearchAction` vers `/blog?q={search_term_string}`, seo.tsx:102-113), `breadcrumbSchema()` (BreadcrumbList, seo.tsx:115-126).
- Aucune balise `hreflang`, aucune balise `article:published_time` / `article:author` pour `og:type=article`.

### Valeurs par défaut avant JS (`index.html`, identiques dans `dist/index.html`)

| Élément | Valeur | index.html |
|---|---|---|
| `<html lang>` | `fr` | :2 |
| `<title>` | ClairDossier — Votre dossier administratif et juridique, clair, structuré et suivi. | :16 |
| `meta description` | « ClairDossier structure vos dossiers administratifs et juridiques : calendrier, relances à échéance, projets de réponse aux e-mails. Pour PME, artisans, indépendants et professions libérales. » | :17 |
| `meta author` | Nouh BENZIDANE | :18 |
| `meta robots` | index, follow, max-image-preview:large | :19 |
| `canonical` | https://www.clair-dossier.com/ | :12 |
| `google-site-verification` | yKED4w0FJ9KypEjb814a_MoyCkGpPRjWR8KVPEhDQ7c | :9 |
| `rel=alternate rss` | `type="application/rss+xml" href="/blog"` — pointe vers une page HTML ; **aucun flux RSS n'existe** dans `public/` (vérifié `ls public`) | :13 |
| OG | type website, site_name, title, description (« Plateforme legaltech française… Hébergement UE, RGPD natif. »), url www, image `https://www.clair-dossier.com/og-default.svg` 1200×630, locale fr_FR | :22-30 |
| Twitter | summary_large_image, title, description, image SVG | :33-36 |
| JSON-LD | **aucun** dans le HTML statique | — |
| theme-color / color-scheme | `#0d1b3d` / `light` | :6, :8 |

### Tableau par route

Légende : « Titre final » = ce que `document.title` reçoit après seo.tsx:36. Canonical et `og:url` sont toujours `https://www.clair-dossier.com` + path. `og:image` = `https://www.clair-dossier.com/og-default.svg` partout (aucune page ne passe `image`).

| Route | Fichier:ligne de `<Seo>` | Titre final (`document.title`) | Meta description | Canonical / og:url | og:type | robots | JSON-LD (types) |
|---|---|---|---|---|---|---|---|
| `/` | Home.tsx:45-50 | « ClairDossier — Votre dossier juridique, clair, structuré et suivi » (contient SITE_NAME → pas de suffixe) | « ClairDossier transforme les demandes juridiques en dossiers structurés et suivis. Plateforme legaltech française pour clients, PME et cabinets d'avocats. » | `/` | website | index | `Organization` (orgSchema), `WebSite` (websiteSchema + SearchAction), `SoftwareApplication` (applicationCategory LegalService, Offer 19 EUR — Home.tsx:15-30), `FAQPage` (depuis `homeFaq`, Home.tsx:32-40) |
| `/fonctionnalites` | FeaturesIndex.tsx:19-30 | « Fonctionnalités — ClairDossier · Dossier juridique clair, structuré et suivi » | « Les neuf briques ClairDossier : création de dossier guidée en 5 étapes, dépôt de pièces sécurisé, suivi de l'avancement, échéances, transmission par e-mail ou WhatsApp validée par vous, espace privé conforme RGPD. » | `/fonctionnalites` | website | index | `BreadcrumbList` (Accueil › Fonctionnalités) + 9 × `Service` (FeaturesIndex.tsx:7-14) |
| `/fonctionnalites/:slug` (×9) | FeatureDetail.tsx:19-38 | `feature.title` + suffixe, ex. « Création guidée par typologie — ClairDossier · Dossier juridique clair, structuré et suivi » | `feature.blurb` (features.ts:20-21, 41-42, 62-63, 83-84, 104-105, 125-126, 146-147, 167-168, 187-188) | `/fonctionnalites/<slug>` | website | index | `BreadcrumbList` (3 niveaux, nom = `shortTitle`) + `Service` |
| `/tarifs` | Pricing.tsx:95-124 | « Tarifs — ClairDossier · … » | « Sept formules ClairDossier, de l'indépendant à l'entreprise : Essentiel, Entrepreneur, Business PME 20/50, Pro, Premium et offre sur-mesure. Compte gratuit, sans engagement. −10 % en annuel. » | `/tarifs` | website | index | `BreadcrumbList` + `SoftwareApplication` (applicationCategory BusinessApplication, `AggregateOffer` 19–299 EUR, `offerCount` calculé — Pricing.tsx:104-122) |
| `/securite` | Security.tsx:80-88 | « Sécurité & conformité — ClairDossier · … » (le littéral JSX `"Sécurité &amp; conformité"` Security.tsx:81 est décodé en `&` par JSX) | « Chiffrement en transit et au repos, isolation des données par utilisateur, stockage privé des pièces et hébergeur conforme RGPD. Les engagements sécurité de ClairDossier. » | `/securite` | website | index | `BreadcrumbList` uniquement |
| `/blog` | BlogIndex.tsx:15-39 | « Journal — ClairDossier · … » | « Articles juridiques pédagogiques : préparation prud'homale, RGPD legaltech, IA et droit. Lecture libre, signée. » | `/blog` | website | index | `BreadcrumbList` + `Blog` (7 × `BlogPosting` avec `author` de type **Person** « Rédaction ClairDossier » — BlogIndex.tsx:35) |
| `/blog/:slug` (×7) | BlogPost.tsx:80-94 | `post.metaTitle` + suffixe, ex. « Mise en demeure — guide pratique et erreurs à éviter — ClairDossier · Dossier juridique clair, structuré et suivi » (≈ 110 car.) | `post.metaDescription` (chaque fichier `src/data/blog/<slug>.ts:7-8`) | `/blog/<slug>` | **article** | index | `BreadcrumbList` (3 niveaux) + `BlogPosting` (headline, datePublished = dateModified = `post.date`, wordCount calculé, timeRequired, `author` de type **Organization**, publisher avec logo favicon.svg, mainEntityOfPage, keywords — BlogPost.tsx:33-60) + `FAQPage` si `post.faq` (BlogPost.tsx:62-73 ; les 7 articles ont un bloc `faq:`). `HowTo` volontairement retiré (BlogPost.tsx:75-76) |
| `/contact` | Contact.tsx:42-50 | « Contact — ClairDossier · … » | « Réserver une démo ClairDossier, poser une question commerciale, contacter le support, ou écrire à l'équipe presse. Échanges directs via WhatsApp. » | `/contact` | website | index | `BreadcrumbList` |
| `/mentions-legales` | LegalPage.tsx:22-30 | « Mentions légales — ClairDossier · … » | legal.ts:24-25 « Mentions légales du site clair-dossier.com — éditeur, hébergeur, directeur de publication, propriété intellectuelle. » | `/mentions-legales` | website | index | `BreadcrumbList` |
| `/cgv` | idem | « Conditions générales de vente — ClairDossier · … » | legal.ts:124-125 | `/cgv` | website | index | `BreadcrumbList` |
| `/politique-confidentialite` | idem | « Politique de confidentialité — ClairDossier · … » | legal.ts:250-251 | `/politique-confidentialite` | website | index | `BreadcrumbList` |
| `/cookies` | idem | « Cookies — ClairDossier · … » | legal.ts:390-391 « Politique cookies ClairDossier — cookies techniques uniquement, aucun cookie de mesure d'audience ou marketing tiers. » | `/cookies` | website | index | `BreadcrumbList` |
| `/inscription` | Signup.tsx:53-58 | « Créer un compte — ClairDossier · … » | « Créez gratuitement votre compte ClairDossier : … » | `/inscription` | website | **noindex, follow** | aucun |
| `/connexion` | Login.tsx:36-41 | « Connexion — ClairDossier · … » | « Connectez-vous à votre espace ClairDossier … » | `/connexion` | website | **noindex, follow** | aucun |
| `/compte` (auth) | Account.tsx:86 | « Mon compte — ClairDossier · … » | « Votre espace ClairDossier. » | `/compte` | website | **noindex** | aucun |
| `/compte/dossier/:id` (auth) | DossierDetail.tsx:430-435 | « Détail du dossier — ClairDossier · … » | « Le détail de votre dossier ClairDossier. » | **`/compte`** (path forcé, pas l'URL réelle) | website | **noindex** | aucun |
| `/dossier/nouveau` (auth) | DossierFlow.tsx:403-411 | « Créer un dossier — ClairDossier · … » | « Créez un dossier structuré : profil, nature du dossier, informations, documents, transmission. Sauvegardé dans votre compte. » | `/dossier/nouveau` | website | **index** (pas de `noindex` malgré RequireAuth et `Disallow: /dossier/` dans robots.txt:3) | `BreadcrumbList` |
| `*` (404) | NotFound.tsx:7 | « Page introuvable — ClairDossier · … » | « La page demandée n'existe pas. » | **`/`** (canonical = accueil) | website | **noindex** | aucun |

Slugs blog (7) et métadonnées : `preparer-rendez-vous-avocat` (2026-05-20), `chronologie-prud-homale` (2026-05-12), `mise-en-demeure` (2026-04-15), `conservation-documents` (2026-03-28), `mediation-contentieux` (2026-02-12), `rgpd-legaltech` (2026-04-28), `ia-droit` (2026-05-02) — `src/data/blog/<slug>.ts:4-12`. Auteur unique `redaction` → « Rédaction ClairDossier » (authors.ts:10-17).

Slugs fonctionnalités (9) : `creation-guidee`, `pieces-ocr`, `chronologie`, `validation-avocat`, `suivi-statuts`, `messagerie-securisee`, `coffre-fort`, `calendrier-relances`, `reponse-auto-mails` (features.ts). Les slugs ne reflètent plus les titres actuels (ex. `pieces-ocr` → « Dépôt de pièces dans un espace privé », `validation-avocat` → « Transmission validée par vous », `reponse-auto-mails` → « Récapitulatif avant transmission » — features.ts:37-38, 79-80, 183-184).

---

## 3. Sitemap ↔ routes réelles, et www vs apex

### Contenu de `public/sitemap.xml` (statique, 26 URL, non généré par script)

| Groupe | URLs | Lignes | lastmod | changefreq / priority |
|---|---|---|---|---|
| Accueil | `/` | :3-7 | — | weekly / 1.0 |
| Fonctionnalités index | `/fonctionnalites` | :8-12 | — | monthly / 0.9 |
| Fonctionnalités détail (9) | `creation-guidee`, `pieces-ocr`, `chronologie`, `validation-avocat`, `suivi-statuts`, `messagerie-securisee`, `coffre-fort`, `calendrier-relances`, `reponse-auto-mails` | :13-57 | — | monthly / 0.7 |
| Tarifs | `/tarifs` | :58-62 | — | monthly / 0.9 |
| Sécurité | `/securite` | :63-67 | — | monthly / 0.8 |
| Blog index | `/blog` | :68-72 | — | weekly / 0.8 |
| Articles (7) | `preparer-rendez-vous-avocat` (2026-05-20), `chronologie-prud-homale` (2026-05-12), `rgpd-legaltech` (2026-04-28), `mise-en-demeure` (2026-04-15), `conservation-documents` (2026-03-28), `ia-droit` (2026-05-02), `mediation-contentieux` (2026-02-12) | :73-114 | oui, cohérents avec `date:` des fichiers blog | yearly / 0.6 |
| Contact | `/contact` | :115-119 | — | yearly / 0.5 |
| Légal (4) | `/mentions-legales`, `/cgv`, `/politique-confidentialite`, `/cookies` | :120-139 | — (alors que `lastUpdate: "2026-05-26"` existe dans legal.ts:26,126,252,392) | monthly / 0.3 |

### Comparaison

| Constat | Détail |
|---|---|
| Entrées du sitemap sans route | **Aucune.** Les 26 `<loc>` correspondent toutes à une route déclarée et à un slug existant (9/9 features, 7/7 articles, 4/4 pages légales). |
| Routes absentes du sitemap — attendu | `/inscription`, `/connexion` (noindex), `/compte`, `/compte/dossier/:id` (noindex + auth) : omission cohérente. |
| Routes absentes du sitemap — à signaler | `/dossier/nouveau` : absente du sitemap, `Disallow: /dossier/` (robots.txt:3), mais **indexable** côté `<Seo>` (pas de `noindex`, DossierFlow.tsx:403-411) et liée 7 fois dans le site (Nav.tsx:79,177 ; Footer.tsx:8 ; etc.). Incohérence mineure. |
| Alternates markdown | Les 27 fichiers `.md` (voir §4) ne sont pas dans le sitemap ; ils sont listés dans `llms.txt:82-97`. Choix cohérent (pas de canonical possible sur un .md). |
| Sitemap statique | `public/sitemap.xml` est un fichier écrit à la main (daté du 2026-07-02), **pas généré** par `scripts/gen-markdown.ts` (qui ne touche pas au sitemap). Tout nouvel article/fonctionnalité exige une mise à jour manuelle → risque de dérive. |
| `lastmod` | Absent pour les pages non-blog, y compris les 4 pages légales qui ont un `lastUpdate` en données. |
| Accessibilité en prod | **Vérifié** : `https://www.clair-dossier.com/sitemap.xml` → `200`, `content-type: application/xml` ; `robots.txt` → `200 text/plain`. |

### www vs apex

| Emplacement | Valeur | Référence |
|---|---|---|
| `public/CNAME` | `www.clair-dossier.com` | CNAME:1 (copié dans `dist/CNAME` au build, vérifié) |
| `seo.tsx` SITE_URL | `https://www.clair-dossier.com` | seo.tsx:13 |
| `index.html` canonical / og:url / images | `https://www.clair-dossier.com/…` | index.html:12, 26-27, 36 |
| `sitemap.xml` | 26/26 URL en `https://www.clair-dossier.com` | sitemap.xml:4-136 |
| `robots.txt` Sitemap | `https://www.clair-dossier.com/sitemap.xml` | robots.txt:21 |
| `llms.txt` | toutes les URL en www | llms.txt:5, 34-50, 86-97 |
| `gen-markdown.ts` SITE | `https://www.clair-dossier.com` | gen-markdown.ts:32 |
| JSON-LD en dur | `https://www.clair-dossier.com/…` | BlogIndex.tsx:28,34 ; BlogPost.tsx:49,55-58 |
| Texte légal | mentionne `clair-dossier.com` (apex, sans www) dans les descriptions | legal.ts:25, 28 |
| Prod apex → www | `301` (https et http) — **vérifié** | hors code |

Conclusion : l'hôte canonique est **www** partout dans le code, la configuration et la redirection DNS/Pages ; cohérent. Seule exception textuelle : `clair-dossier.com` en apex dans les mentions légales (legal.ts:25, 28), sans impact technique.

### robots.txt (`public/robots.txt`)

- `User-agent: *` → `Allow: /`, `Disallow: /dossier/` (:1-3).
- Autorisations explicites pour GPTBot, ChatGPT-User, PerplexityBot, Claude-Web, Google-Extended (:5-19). À noter : le user-agent Anthropic actuel est `ClaudeBot` ; `Claude-Web` est une ancienne dénomination (non vérifié dans ce dépôt — constat de connaissance générale, à confirmer).
- `/compte`, `/connexion`, `/inscription` ne sont **pas** disallow (gérés par `noindex` côté JS uniquement).

---

## 4. Pipeline de build et d'hébergement

### Vue d'ensemble

```
push sur main ──► GitHub Actions (deploy.yml) ──► npm ci ──► npm run build ──► dist/ ──► GitHub Pages  ══► https://www.clair-dossier.com  (PROD, vérifié : server: GitHub.com)
                  └─ env: VITE_BASE_PATH=/, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (en clair dans le YAML)

(en parallèle, hors de ce dépôt) Netlify (netlify.toml) ──► npm run build ──► dist/ ══► https://clair-dossier.netlify.app  (vérifié : server: Netlify, CSP + HSTS présents)
```

`npm run build` = `npm run gen:md && tsc -p tsconfig.json && vite build` (package.json:9).

### 4.1 GitHub Pages — `.github/workflows/deploy.yml` (seul workflow du dépôt)

| Élément | Valeur | Ligne |
|---|---|---|
| Déclencheurs | `push` sur `main`, `workflow_dispatch` | :8-11 |
| Commentaire d'intention | Le DNS (whois.com) pointe vers GitHub Pages « tant que le DNS n'est pas basculé vers Netlify » ; Netlify = « cible finale » sur `clair-dossier.netlify.app` | :3-6 |
| Permissions | `contents: read`, `pages: write`, `id-token: write` | :13-16 |
| Concurrence | groupe `pages`, `cancel-in-progress: false` | :18-20 |
| Job `build` | ubuntu-latest ; `actions/checkout@v4` ; `actions/setup-node@v4` node **22** + cache npm ; `actions/configure-pages@v5` ; `npm ci` ; `npm run build` ; `actions/upload-pages-artifact@v3` path `./dist` | :23-48 |
| Variables au build | `VITE_BASE_PATH: /` ; `VITE_SUPABASE_URL: https://buzgokfmxpmyceppvjpp.supabase.co` ; `VITE_SUPABASE_ANON_KEY: eyJhbGciOiJIUzI1NiIs…` (JWT anon complet, **en clair dans le dépôt**, commentaire « clés PUBLIQUES (anon) … protégées par RLS ») | :39-43 |
| Job `deploy` | `needs: build`, environnement `github-pages`, `actions/deploy-pages@v4` | :50-58 |
| Secrets GitHub | **aucun** `${{ secrets.* }}` utilisé | — |

Le site en production est bien celui-ci : en-têtes `server: GitHub.com`, `last-modified: Thu, 02 Jul 2026 14:49:04 GMT` (cohérent avec le dernier commit du 2026-07-02 16:41 +0200), `content-length: 3759` = taille de `dist/index.html` local, et hashes des chunks identiques (BUILD_INFO).

### 4.2 Netlify — `netlify.toml`

| Élément | Valeur | Ligne |
|---|---|---|
| Build | `command = "npm run build"`, `publish = "dist"`, `NODE_VERSION = "22"` | :3-8 |
| SPA fallback | `[[redirects]] from="/*" to="/index.html" status=200` | :13-16 |
| En-têtes `/*` | `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: geolocation=(), microphone=(), camera=()`, **CSP** | :19-26 |
| CSP | `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://buzgokfmxpmyceppvjpp.supabase.co wss://buzgokfmxpmyceppvjpp.supabase.co; frame-ancestors 'none'; base-uri 'self'; form-action 'self' https://buy.stripe.com` | :26 |
| Cache | `/assets/*` → `public, max-age=31536000, immutable` ; `/index.html` → `public, max-age=0, must-revalidate` | :29-37 |
| Variables d'env | Non définies dans le fichier ; `.env.example:1` indique « Valeurs réelles dans les variables d'env Netlify » (non vérifiable ici) | — |

**Ces en-têtes et redirections ne s'appliquent PAS sur GitHub Pages.** GitHub Pages ne lit ni `netlify.toml` ni `_headers`/`_redirects`. Vérifié en prod (`https://www.clair-dossier.com/`) : aucun `Content-Security-Policy`, aucun `X-Frame-Options`, aucun `Strict-Transport-Security`, aucun `Referrer-Policy`, aucun `Permissions-Policy` ; `cache-control: max-age=600` sur **tout**, y compris `/assets/react-CBBoJgXi.js` (pas d'`immutable`), et `access-control-allow-origin: *`. À l'inverse, `https://clair-dossier.netlify.app/tarifs` renvoie `200` avec la CSP ci-dessus, `strict-transport-security: max-age=31536000; includeSubDomains; preload` et `x-frame-options: DENY`.

Remarques sur la CSP Netlify : `script-src 'self'` est compatible avec le build Vite (dist/index.html:40-45 : uniquement des `<script type="module" src>` et `<link rel="modulepreload">`, aucun script inline) ; `form-action https://buy.stripe.com` n'est pas nécessaire puisque les CTA Stripe sont des liens `<a href>` (pricing.ts:45-182), pas des formulaires ; l'URL Supabase est dupliquée en dur dans `netlify.toml:26` et `deploy.yml:42`.

### 4.3 Mécanisme SPA fallback (`404.html`)

- Plugin Vite `spaFallback` : hook `closeBundle` → `copyFileSync(dist/index.html, dist/404.html)` (vite.config.ts:9-17). Vérifié : fichiers identiques dans `dist/`.
- GitHub Pages sert `404.html` pour tout chemin inexistant **avec le statut HTTP 404** (vérifié : `/tarifs`, `/blog/mise-en-demeure`, `/dossier/nouveau` → `HTTP/2 404`). Le contenu est bien rendu pour un humain (React démarre), mais pour un robot le statut 404 prime : voir risque R1.
- Les fichiers réels (`/tarifs.md`, `/sitemap.xml`, `/assets/*`) sont servis normalement en 200 (vérifié `tarifs.md` → `200 text/markdown`).

### 4.4 `gen:md` — markdown pour les crawlers IA (`scripts/gen-markdown.ts`)

| Élément | Détail | Lignes |
|---|---|---|
| Exécution | `tsx scripts/gen-markdown.ts` (package.json:8), **toujours** lancé en tête de `npm run build` (package.json:9) | — |
| Sources | Importe directement les data files React : `blogPosts`, `homeFaq`, `features`, `legalPages`, `plans`/`COMPARISON_FEATURES`/`TRUST_PILLARS`, `statuses`, `workspaces` | :16-28 |
| Destination | `public/` (écrit **dans le dépôt**, fichiers suivis par git — non ignorés par `.gitignore`) ; Vite copie ensuite `public/` dans `dist/` | :31, :34-38 |
| Fichiers générés (27) | `index.md` + alias `page.md` (identiques, vérifié `diff`) ; `blog/index.md` + 7 `blog/<slug>.md` ; `fonctionnalites/index.md` + 9 `fonctionnalites/<slug>.md` ; `tarifs.md` ; `securite.md` ; `contact.md` ; 4 `<legal>.md`. Formule de comptage :526-535 = 27 ; `find dist -name '*.md'` = 27 (vérifié) | :135-137, :227, :258, :283, :308, :377, :437, :469, :507 |
| Front-matter | `title`, `description`, `url` (+ `date`, `author`, `category`, `readMinutes` pour le blog ; `lastUpdate` pour le légal) | :54-58, :161-169, :476-481 |
| Footer commun | « Source : … — éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE. » + citation suggérée | :40-49 |
| Contenu **en dur** (non dérivé des pages React) | `generateHome` : intro, « Promesse » (« 100 % conforme RGPD — hébergement OVH France » :70), contact ; `generateSecurity` : tout le contenu (OVH Roubaix/Strasbourg, AES-256, TLS 1.3 HSTS preload + pinning, bastion/WAF, KMS rotation 90 j, 2FA, 3-2-1, RPO 15 min/RTO 4 h, HDS 2026 T3, ISO 27001 2027, audit pentest annuel) ; `generateContact` | :52-74, :127-132, :381-438, :441-470 |
| Divergence avec la page React `/securite` | `Security.tsx:14-75` (PILLARS) ne mentionne plus ni OVH, ni AES-256, ni HSTS, ni 2FA, ni RPO/RTO, ni HDS/ISO : formulations prudentes (« sous-traitant conforme au RGPD », « chiffrement en transit HTTPS et au repos côté hébergeur »). `securite.md` et `llms.txt:64-74` exposent donc aux IA des engagements **plus forts** que la page HTML. Idem `index.md:17` vs `Security.tsx`. | — |
| Typage | `scripts/` n'est pas dans `tsconfig.json include` (:28 = `["src", "vite.config.ts"]`) → `gen-markdown.ts` n'est pas vérifié par `tsc` ; seul `tsx` l'exécute | — |
| Locale | `toLocaleDateString('fr-FR', …)` dépend des ICU de Node (Node 22 CI = full-icu, OK) | :173, :249, :485 |

`public/llms.txt` (statique, non généré) : description de l'éditeur (Roman Gomes, SIREN 105 490 734, Marseille), architecture des routes (:13-28), liste des 7 articles (:30-50), tarifs (:52-62 — titre annonce « 7 formules » mais n'en nomme que 6 + sur-mesure, :18), sécurité (:64-74), convention `.md` (:82-97), crawling (:99-101). Servi en `200 text/plain` (vérifié).

### 4.5 Variables d'environnement

| Variable | Lue dans | Usage | Fournie par |
|---|---|---|---|
| `VITE_SUPABASE_URL` | supabase.ts:3 | URL client Supabase ; fallback `https://placeholder.supabase.co` si absente (supabase.ts:17) | deploy.yml:42 (en clair) ; `.env.example:2` ; Netlify (non vérifié) |
| `VITE_SUPABASE_ANON_KEY` | supabase.ts:4 | clé anon ; fallback `'placeholder'` | deploy.yml:43 (en clair) ; `.env.example:3` |
| `VITE_BASE_PATH` | vite.config.ts:20 (`process.env`) | `base` Vite ; défaut `/` | deploy.yml:40 |
| `import.meta.env.DEV` | supabase.ts:8 | warning console si non configuré | Vite |

Aucune autre lecture de `import.meta.env` / `process.env` dans `src/`, `vite.config.ts` ou `scripts/gen-markdown.ts` (grep). Conséquence : `index-*.js` (qui embarque `supabase.ts`) diffère entre un build local sans `.env` et le build CI — ce qui explique le seul hash différent noté dans BUILD_INFO. Sans ces variables, `isSupabaseConfigured = false` et **RequireAuth laisse passer** (RequireAuth.tsx:24-25).

`.gitignore` : `node_modules`, `dist`, `dist-ssr`, `*.local`, `.vite`, `.DS_Store`, `.netlify`, `.env`, `.env.*` sauf `.env.example` (:1-14). `public/**/*.md` générés sont suivis.

---

## 5. Configuration build

### `vite.config.ts`

| Option | Valeur | Ligne |
|---|---|---|
| `base` | `process.env.VITE_BASE_PATH ?? '/'` | :20, :23 |
| Plugins | `react()`, `tailwindcss()` (Tailwind v4 via `@tailwindcss/vite`), `spaFallback()` | :24 |
| `build.target` | `es2022` | :26 |
| `sourcemap` | `false` | :27 |
| `cssCodeSplit` | `true` (mais un seul CSS émis en pratique : `index-B6lhu7zR.css`, car tout le CSS passe par `src/index.css`) | :28 |
| `assetsInlineLimit` | 4096 octets | :29 |
| `manualChunks` | `react` (react-dom, /react/), `motion`, `router` (react-router), `supabase` (@supabase), `fonts` (@fontsource) | :32-40 |
| `optimizeDeps.include` | react, react-dom, motion | :44 |
| `server` | port 5173, `strictPort: false` | :45 |

Le chunk `fonts` (:38) **n'existe pas** dans `dist/assets` : `@fontsource/*` ne fournit que du CSS (`src/index.css:3-13`) et des fichiers `.woff/.woff2`, donc aucun module JS n'est routé vers ce chunk. Règle morte mais inoffensive.

### `tsconfig.json`

`target ES2022`, `lib ES2022/DOM/DOM.Iterable`, `types: ["node"]`, `module ESNext`, `moduleResolution bundler`, `jsx react-jsx`, `noEmit`, `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`, `noUncheckedSideEffectImports`, `verbatimModuleSyntax: false`, `include: ["src", "vite.config.ts"]` (:2-28). Pas de `references`, pas de `tsconfig.node.json` séparé. `scripts/` exclu du typecheck.

### `package.json`

- `name clairdossier-showcase`, `version 0.1.0`, `type module` (:2-5).
- Scripts : `dev`, `gen:md`, `build`, `preview` (port 4173), `typecheck` (:6-12). **Pas de `lint`, pas de `test`**, aucun ESLint/Prettier/Vitest en devDependencies (:24-34). Pas de champ `engines`/`packageManager` (Node 22 en CI vs Node 24 en local : pas de garde-fou).
- Dépendances runtime (:13-23) : `@fontsource/cormorant-garamond`, `@fontsource/inter`, `@fontsource/jetbrains-mono` (^5.2.5), `@supabase/supabase-js ^2.108.2`, `fflate ^0.8.3` (utilisé par `DossierDetail.tsx:3` pour `zipSync`), `motion ^11.15.0`, `react`/`react-dom ^19`, `react-router-dom ^7.1.0`.
- Dev (:24-34) : `@tailwindcss/vite ^4`, `tailwindcss ^4`, `@types/node ^22`, `@types/react(-dom) ^19`, `@vitejs/plugin-react ^4.3.4`, `tsx ^4.19`, `typescript ^5.7`, `vite ^6`.

### Résultat du build (BUILD_INFO du 2026-08-23, node v24.19.0 / npm 11.17.0, `tsc --noEmit` OK, `vite build` en 941 ms) confronté à `dist/`

| Chunk | Taille | gzip | Contenu | Préchargé depuis `dist/index.html` |
|---|---|---|---|---|
| `index-DOvyzgrX.js` | 150,37 kB | 45,79 | App, Layout, Nav, Footer, Home + sections, auth, supabase.ts (env) | `<script type=module>` :40 |
| `react-CBBoJgXi.js` | 193,69 kB | 60,49 | react + react-dom | modulepreload :41 |
| `supabase-Buf76L6m.js` | 209,59 kB | 54,63 | @supabase/supabase-js — **chargé sur toutes les pages** (y compris marketing) car `AuthProvider` est monté à la racine (main.tsx:14) | modulepreload :43 |
| `motion-ZtdEAC6k.js` | 121,55 kB | 40,42 | motion (animations Home) | modulepreload :44 |
| `router-CjS7eph5.js` | 37,89 kB | 13,67 | react-router | modulepreload :42 |
| `index-B6lhu7zR.css` | 100,11 kB | 27,43 | Tailwind v4 + toutes les `@font-face` @fontsource | stylesheet :45 |
| Pages lazy | DossierDetail 26,67 · DossierFlow 23,13 · LegalPage 22,45 · Pricing 17,36 · Security 10,74 · Contact 7,92 · BlogPost 7,64 · Account 4,87 · FeatureDetail 4,42 · Signup 4,38 · BlogIndex 4,11 · FeaturesIndex 4,00 · Login 2,87 · NotFound 1,36 kB | — | un chunk par route | à la demande |
| Chunks partagés | `authors-CIQV-9ZL.js` 0,39 kB, `whatsapp-XHY5k8kR.js` 0,24 kB | — | | |

Poids initial JS (non-gzip) pour `/` : ≈ 713 kB (index + react + supabase + motion + router) ; ≈ 215 kB gzip. Hashes `react`/`supabase`/`motion`/`router`/CSS identiques à la prod (BUILD_INFO).

### Polices

- Import CSS : Cormorant Garamond 400/500/500i/600/700, Inter 300/400/500/600, JetBrains Mono 400/500 (`src/index.css:3-13`) ; `font-display: swap` fourni par @fontsource (commentaire index.html:38-39).
- `dist/assets` contient **124 fichiers de polices (≈ 2,1 Mo)** : chaque CSS @fontsource déclare tous les sous-ensembles (`latin`, `latin-ext`, `cyrillic`, `cyrillic-ext`, `greek`, `greek-ext`, `vietnamese`) avec `unicode-range`, en woff et woff2. Le navigateur ne télécharge que les sous-ensembles utilisés (latin/latin-ext, ≈ 36–49 kB chacun selon BUILD_INFO), mais le déploiement embarque l'ensemble. Aucun `<link rel="preload">` de police dans `index.html`.
- Inter 300 est importé (index.css:8) ; son usage réel n'a pas été vérifié.

---

## 6. Risques et dettes identifiés

Classement : **R** = risque (impact prod/SEO/sécurité), **D** = dette technique/contenu. Chaque point cite les preuves.

| ID | Gravité | Constat | Preuves | Piste (à arbitrer en phase ultérieure, hors périmètre de cet audit) |
|---|---|---|---|---|
| R1 | **Critique (SEO)** | Sur l'hébergement réel (GitHub Pages), toutes les URL profondes (`/tarifs`, `/blog/<slug>`, `/fonctionnalites/<slug>`, pages légales…) répondent **HTTP 404** au chargement direct ; seul `/` répond 200. Googlebot traite un 404 comme « page inexistante » quel que soit le contenu rendu en JS. Les 25 URL non-racine du sitemap sont donc potentiellement non indexées / en erreur « soft 404 » dans Search Console. | Vérifié en prod : `/tarifs`, `/blog/mise-en-demeure`, `/dossier/nouveau` → `HTTP/2 404`, `server: GitHub.com`, même etag que `/`. Mécanisme : vite.config.ts:9-17 + comportement natif de Pages. deploy.yml:3-6 décrit Pages comme solution transitoire. | Basculer le DNS vers Netlify (redirect 200, netlify.toml:13-16, vérifié `200` sur `clair-dossier.netlify.app/tarifs`) ou pré-rendre les routes publiques en HTML statique (un `index.html` par route) pour Pages. |
| R2 | **Élevé (SEO)** | Tout le SEO par page (title, description, canonical, OG, JSON-LD) est injecté **uniquement côté client** par `useEffect` ; le HTML servi est identique pour toutes les routes (3759 octets, sans JSON-LD). Crawlers sans JS, agrégateurs OG (LinkedIn, WhatsApp, Slack…) et certains crawlers IA voient le titre/description de l'accueil sur chaque URL. | seo.tsx:35-79, 81 ; index.html:15 (« overridden per route by the Seo component once JS mounts ») ; dist/index.html identique pour toutes les routes. | Pré-rendu/SSG des 26 routes publiques au build. |
| R3 | **Élevé (sécurité/transport)** | `http://www.clair-dossier.com/` répond `200` sans redirection vers https ; aucun `Strict-Transport-Security` en prod. Contredit `llms.txt:67` (« TLS 1.3 en transit, HSTS preload ») et `securite.md` généré (gen-markdown.ts:397, 410). | Vérifié en prod (HEAD http → 200 ; en-têtes https sans HSTS). | Activer « Enforce HTTPS » sur le dépôt Pages (paramètre GitHub, hors code) ; ou bascule Netlify (HSTS preload vérifié présent). |
| R4 | **Élevé (sécurité)** | Aucun en-tête de sécurité en prod (pas de CSP, X-Frame-Options, Referrer-Policy, Permissions-Policy, nosniff). La configuration existe mais dans `netlify.toml:19-26`, **inapplicable sur GitHub Pages**. Le site est embarquable en iframe (clickjacking) et ne bénéficie d'aucune CSP, alors qu'il manipule des sessions Supabase et des documents utilisateurs. | Vérifié en prod : en-têtes absents. netlify.toml:18 (« appliqué à toutes les réponses ») ne vaut que pour Netlify. | Idem R1/R3 ; à défaut, `<meta http-equiv="Content-Security-Policy">` partiel (sans frame-ancestors) dans index.html. |
| R5 | **Moyen (contenu/légal)** | Les fichiers destinés aux IA (`securite.md`, `index.md:17`, `llms.txt:64-74`) affirment OVHcloud Roubaix/Strasbourg, AES-256, HSTS preload + pinning, bastion/WAF, KMS rotation 90 j, 2FA admin, RPO 15 min/RTO 4 h, HDS 2026 T3, ISO 27001 2027, audit pentest annuel — alors que la page HTML `/securite` a été reformulée prudemment (« sous-traitant conforme RGPD », HTTPS, chiffrement au repos côté hébergeur) et que le back-end est Supabase (`buzgokfmxpmyceppvjpp.supabase.co`, deploy.yml:42). Les IA génératives citeront des engagements que le site HTML ne tient plus. | gen-markdown.ts:70, 381-438 (texte en dur) vs Security.tsx:14-75 ; llms.txt:64-74 ; netlify.toml:26 / deploy.yml:42 (Supabase). | Dériver `securite.md` des mêmes données que `Security.tsx` (ou supprimer les affirmations non tenues) ; mettre à jour `llms.txt`. |
| R6 | Moyen (sécurité/config) | Clé anon Supabase (JWT) et URL du projet **en clair dans le dépôt** (`deploy.yml:42-43`, `netlify.toml:26`). Par conception la clé anon est publique (elle est de toute façon dans `index-*.js` servi), mais le dépôt devient la source de vérité d'un identifiant de projet ; sa rotation exige un commit. `.env.example:1` annonce les valeurs « dans les variables d'env Netlify », incohérent avec le workflow. | deploy.yml:41-43 ; .env.example:1 ; supabase.ts:3-4. | Passer par `secrets`/`vars` GitHub (`${{ vars.VITE_SUPABASE_URL }}`), aligner `.env.example`. |
| R7 | Moyen (robustesse) | Sans variables `VITE_SUPABASE_*` au build, `RequireAuth` **ne protège plus** `/compte`, `/compte/dossier/:id`, `/dossier/nouveau` (mode « démo »). Un build mal configuré (ex. Netlify sans env) expose les écrans avec un client Supabase placeholder. | RequireAuth.tsx:24-27 ; supabase.ts:6, 17. | Échec de build explicite si variables absentes en CI. |
| R8 | Moyen (cache/perf) | Sur GitHub Pages, `cache-control: max-age=600` sur tous les fichiers, **y compris les assets hashés** (`/assets/react-CBBoJgXi.js`) ; les règles `immutable` de netlify.toml:29-37 ne s'appliquent pas. Le site embarque ≈ 713 kB de JS initial (≈ 215 kB gzip) dont 210 kB de `supabase-js` chargé sur les pages marketing via `AuthProvider` racine. | Vérifié en prod (HEAD sur `/assets/react-CBBoJgXi.js`) ; main.tsx:14 ; BUILD_INFO. | Charger `supabase` paresseusement (n'initialiser le client que sur les routes auth) ; hébergeur avec en-têtes. |
| R9 | Moyen (SEO/partage) | `og:image` et `twitter:image` pointent vers un **SVG** (`/og-default.svg`, 2,3 kB). Facebook, LinkedIn, X/Twitter, WhatsApp, Slack n'affichent généralement pas les SVG en aperçu. Idem `Organization.logo` et `publisher.logo` = `favicon.svg`. | index.html:27, 36 ; seo.tsx:31, 90 ; BlogPost.tsx:56. | Générer un PNG/JPG 1200×630. |
| R10 | Faible (SEO) | `<link rel="alternate" type="application/rss+xml" href="/blog">` déclare un flux RSS qui **n'existe pas** (`/blog` est une page HTML ; aucun `feed.xml`/`rss.xml` dans `public/`). | index.html:13 ; `ls public`. | Générer un vrai flux dans `gen-markdown.ts` ou retirer la balise. |
| R11 | Faible (SEO) | Titres longs : suffixe de 54 caractères (seo.tsx:36) ajouté aux `metaTitle` du blog (ex. ≈ 110 caractères pour `/blog/mise-en-demeure`) → troncature SERP. Titre/description JS de `/` (Home.tsx:46-47, « clients, PME et cabinets d'avocats ») divergent du HTML statique (index.html:16-17, « administratif et juridique… PME, artisans, indépendants »). | seo.tsx:36 ; Home.tsx:46-47 ; index.html:16-17. | Raccourcir le suffixe ; aligner Home/index.html. |
| R12 | Faible (SEO) | `websiteSchema.potentialAction` (SearchAction) cible `/blog?q={search_term_string}` mais `BlogIndex` ne lit aucun paramètre `q` (pas de `useSearchParams`). Schéma déclaratif sans fonctionnalité réelle. | seo.tsx:108-112 ; BlogIndex.tsx:1-6. | Retirer `SearchAction` ou implémenter la recherche. |
| R13 | Faible (SEO) | Incohérences JSON-LD : auteur « Rédaction ClairDossier » typé `Person` dans `Blog` (BlogIndex.tsx:35) et `Organization` dans `BlogPosting` (BlogPost.tsx:46) ; `SoftwareApplication` avec `applicationCategory` différent sur `/` (`LegalService`, Home.tsx:19) et `/tarifs` (`BusinessApplication`, Pricing.tsx:108) ; `dateModified = datePublished` (BlogPost.tsx:38-39). | — | Harmoniser. |
| R14 | Faible (SEO) | `NotFound` force `path="/"` → canonical de toute 404 (et des slugs inconnus de `/blog/:slug`, `/fonctionnalites/:slug`) = page d'accueil ; `DossierDetail` force `path="/compte"`. Avec `noindex` l'impact est limité, mais un canonical vers `/` depuis une URL 404 est un signal contradictoire. | NotFound.tsx:7 ; DossierDetail.tsx:433 ; FeatureDetail.tsx:12 ; BlogPost.tsx:17. | `path` = `location.pathname` ou omettre le canonical sur noindex. |
| R15 | Faible (SEO/robots) | `/dossier/nouveau` : `Disallow` dans robots.txt:3 mais indexable côté `<Seo>` (pas de `noindex`, DossierFlow.tsx:403-411), liée 7 fois dans le site ; `/compte`, `/connexion`, `/inscription` ne sont pas disallow et ne reposent que sur un `noindex` injecté en JS. `Claude-Web` (robots.txt:15) n'est plus le user-agent Anthropic principal (`ClaudeBot`) — constat non vérifiable dans le dépôt. | robots.txt:1-19 ; DossierFlow.tsx:403-411. | Ajouter `noindex` à DossierFlow ; revoir la liste d'UA. |
| D1 | Dette | `sitemap.xml` maintenu à la main, sans `lastmod` hors blog, non généré par `gen-markdown.ts` qui dispose pourtant de toutes les données (dates blog, `lastUpdate` légal). Risque de dérive à chaque nouvel article. | sitemap.xml ; gen-markdown.ts:511-537. | Générer le sitemap dans `gen:md`. |
| D2 | Dette | `gen:md` écrit dans `public/` (fichiers suivis par git) pendant `npm run build` : le build **modifie l'arbre de travail**. Aujourd'hui synchronisé (git status propre après build), mais toute modification de `src/data` sans re-commit des `.md` laisse le dépôt incohérent (la prod, elle, est toujours régénérée). | gen-markdown.ts:31-38 ; .gitignore (pas d'exclusion). | Générer dans `dist/` via un plugin Vite, ou ignorer `public/**/*.md`. |
| D3 | Dette | Deux cibles d'hébergement maintenues en parallèle (Pages = prod, Netlify = « cible finale » depuis le 2026-07-02 au moins) avec des comportements différents (statut 404 vs 200, en-têtes, cache). La documentation de transition vit dans un commentaire YAML. | deploy.yml:3-6 ; netlify.toml. | Décider et documenter une seule cible ; supprimer l'autre config. |
| D4 | Dette | Aucun lint, aucun test, aucun `engines` ; `scripts/` hors `tsconfig include` (gen-markdown.ts non typé par `tsc`) ; Node 22 en CI/Netlify vs Node 24 en local. | package.json:6-12, 24-34 ; tsconfig.json:28 ; deploy.yml:29 ; netlify.toml:8 ; BUILD_INFO. | — |
| D5 | Dette | `README.md:35-43` obsolète (8 fonctionnalités, 3 plans, 3 articles, flow 3 étapes localStorage) vs réalité (9, 7, 7, flow Supabase). `llms.txt:18` annonce « 7 formules » et en nomme 6. Slugs de fonctionnalités désalignés des titres (`pieces-ocr`, `validation-avocat`, `reponse-auto-mails`). | README.md ; llms.txt:18 ; features.ts:37-38, 79-80, 183-184. | Mettre à jour la doc ; les slugs sont dans le sitemap et indexés : ne pas les changer sans redirections (impossibles sur Pages). |
| D6 | Dette | Règle `manualChunks` `fonts` morte (vite.config.ts:38) ; 124 fichiers de polices (≈ 2,1 Mo) déployés pour tous les sous-ensembles alors que seuls latin/latin-ext sont utiles ; `cssCodeSplit: true` sans effet (un seul CSS). `fflate` (dépendance runtime) n'est utilisé que par `DossierDetail`. | vite.config.ts:28, 38 ; `ls dist/assets` ; index.css:3-13. | Importer `@fontsource/<font>/latin-400.css` etc. |
| D7 | Dette | Le lien `/contact?topic=commercial` (Pricing.tsx:340) n'a aucun effet (Contact.tsx ignore la query). Les ancres `/securite#conformite` et `/securite#dpa` existent (Security.tsx:167, 224) mais `Layout` force `scrollTo(0,0)` à chaque changement de `pathname` (Layout.tsx:13-22) — le défilement vers l'ancre au premier chargement n'a pas été testé ici. | — | — |
| D8 | Dette | Les `useEffect` de `Seo` dépendent de `jsonLd` (seo.tsx:79) recréé à chaque rendu (littéraux de tableau dans les pages) → réécriture du `<head>` et des scripts JSON-LD à chaque re-render (ex. bascule mensuel/annuel sur `/tarifs`, Pricing.tsx:91). Impact fonctionnel nul, bruit DOM. | seo.tsx:68-79 ; Home.tsx:49 ; Pricing.tsx:99-123. | `useMemo` ou comparaison par sérialisation. |

---

## Annexe — ce qui n'a pas été vérifié

- Les paramètres du dépôt GitHub (Pages : « Enforce HTTPS », domaine custom, branche source) et la configuration DNS chez whois.com : non accessibles en lecture de fichiers ; seuls les effets observables (en-têtes HTTP) ont été constatés.
- Les variables d'environnement Netlify et l'état du site Netlify (au-delà d'un HEAD sur `/tarifs`).
- Le contenu complet des fichiers `src/pages/*.tsx` au-delà des appels `<Seo>` (DossierFlow, DossierDetail, Account, Pricing, Security, Contact, Signup : lus partiellement).
- Le dossier `supabase/` (config.toml, functions, migrations) : seulement listé, non lu (hors périmètre de cette mission).
- `PLAN.md` et `README.md` : seuls les passages relatifs aux routes/hébergement ont été lus (grep).
- Le rendu effectif des ancres `#conformite`/`#dpa` et le comportement de Googlebot sur les 404 (déduit du statut HTTP, pas de Search Console consultée).
