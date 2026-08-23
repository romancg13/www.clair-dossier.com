# Audit PHASE 0 — État LIVE de https://www.clair-dossier.com

- **Date/heure de capture** : 2026-08-23, 06:43 – 06:47 UTC (`date -u` exécuté en fin de capture).
- **Méthode** : `curl` (HEAD/GET, avec et sans `-L`), `dig`, `gzip -c | wc -c`, `base64 -d` (décodage des claims du JWT anon, sans signature). Aucune modification du repository. Aucun `.env` lu. Aucune commande git.
- **Captures brutes** : toutes les réponses sont conservées dans `docs/baseline/audit/raw (non conservé)/` (ci-après `raw/`). Les références `raw/<fichier>:<ligne>` renvoient à ces captures, pas au code source du repo (que je n'ai **pas** lu pour cette mission).
- **Périmètre non couvert** : je n'ai pas rendu le JavaScript dans un navigateur (pas de screenshot, pas de DOM rendu) ; les « pages vivantes » React sont analysées à partir du texte contenu dans les bundles JS téléchargés. Je n'ai pas appelé l'API Supabase avec une clé (test de santé sans donnée uniquement).

---

## 1. Résumé exécutif (faits saillants)

| # | Constat | Gravité | Preuve |
|---|---------|---------|--------|
| 1 | **25 des 26 URLs du sitemap répondent HTTP 404** (seule `/` répond 200). Le corps renvoyé est `404.html`, identique octet pour octet à `index.html` (3 759 o). Le SPA fonctionne visuellement mais chaque route profonde est servie avec un **statut 404**. | Élevée (SEO) | `raw/codes.txt:1-26`, `diff raw/index.html raw/404.html` → identique |
| 2 | **`http://www.clair-dossier.com/` répond 200 en clair**, sans redirection vers HTTPS. Aucun header `Strict-Transport-Security`. « Enforce HTTPS » GitHub Pages semble désactivé (non vérifiable sans accès au dépôt). | Élevée (sécurité) | `raw/http-www-body.html` identique à `raw/index.html` ; en-têtes dans §4 |
| 3 | **Aucun header de sécurité** : pas de CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, HSTS. `Access-Control-Allow-Origin: *` présent. | Moyenne (limite GitHub Pages) | `raw/headers-home.txt` |
| 4 | **Écart fort entre les fichiers `.md` servis aux crawlers / `llms.txt` / articles de blog et les pages React réelles** : les `.md` et `llms.txt` affirment « hébergement OVH France (Roubaix, Strasbourg) », « AES-256 », « TLS 1.3 HSTS preload, pinning », « WAF », « HDS en cours 2026 T3 », « ISO 27001 objectif 2027 », « audit annuel pentest », « IA avancée GPT-5.5 », « validation par un avocat inscrit au barreau ». Les pages React (home, Sécurité) disent seulement « hébergeur sous-traitant conforme RGPD » ; les mentions légales disent « GitHub Pages » ; les CGV art. 6 disent « aucune lecture, extraction ou analyse automatique ». Le site est en réalité servi par GitHub Pages (US, Fastly) et les données par Supabase. | Élevée (juridique / crédibilité) | §6.3 |
| 5 | **Données personnelles publiques** : nom de l'éditeur « Roman Gomes », SIREN 105 490 734, SIRET 105 490 734 00016, adresse « Château-Gombert, 13013 Marseille », WhatsApp +33 7 82 98 36 44 (aussi `33782983644` dans le JS), e-mail `contact.clairdossier@icloud.com`, nom du prestataire « Nouh BENZIDANE » + `nouhbenzidane.fr` (et `<meta name="author">` de la home). Présents sur 30+ fichiers. | Information (obligations LCEN, mais à cadrer) | §7 |
| 6 | **Clé anon Supabase embarquée** dans `index-BEZEsRp_.js` (JWT HS256, `role: anon`, `ref: buzgokfmxpmyceppvjpp`). Comportement normal d'un client Supabase ; la sécurité repose donc entièrement sur les RLS côté Supabase (non testé ici). | Information | `raw/assets/index-BEZEsRp_.js` (clé tronquée dans ce rapport) |
| 7 | Supabase joignable : `GET /auth/v1/health` → **401** (« No API key found in request »), pas de 5xx ni de timeout. Le projet est vivant. | OK | §8 |
| 8 | `<link rel="alternate" type="application/rss+xml" href="/blog">` pointe vers une page HTML (404) — aucun flux RSS n'existe (`/feed.xml`, `/rss.xml`, `/blog/feed.xml` → 404). | Faible | `raw/index.html:13`, `raw/md-codes.txt` |
| 9 | Pas de `favicon.ico`, pas d'`apple-touch-icon.png`, pas de manifest, OG image en **SVG** (`og-default.svg`) — non supporté par la plupart des aperçus sociaux (LinkedIn, Facebook, X exigent PNG/JPG). | Faible–moyenne | §5.4 |
| 10 | DNS : `clair-dossier.com` **sans MX, sans TXT (SPF/DMARC)**. Le domaine n'est pas utilisé pour le courrier ; le contact passe par `@icloud.com`. Pas d'AAAA (IPv6) sur l'apex. | Information | §4.3 |

---

## 2. Sitemap : codes HTTP de chaque URL

Source : `raw/sitemap.xml` (HTTP 200, 26 `<loc>`). Codes mesurés avec `curl -s -o /dev/null -w %{http_code}` sans puis avec `-L`. Toutes les réponses ont `content-type: text/html; charset=utf-8`, `content-length: 3759`, `etag: "6a467a60-eaf"` — c'est le même fichier `index.html` / `404.html`.

| URL | Code direct | Code final (`-L`) | Location (si 301) | Corps servi |
|---|---|---|---|---|
| `/` | **200** | 200 | — | index.html (3 759 o) |
| `/fonctionnalites` | 301 | **404** | `https://www.clair-dossier.com/fonctionnalites/` | 404.html |
| `/fonctionnalites/creation-guidee` | **404** | 404 | — | 404.html |
| `/fonctionnalites/pieces-ocr` | **404** | 404 | — | 404.html |
| `/fonctionnalites/chronologie` | **404** | 404 | — | 404.html |
| `/fonctionnalites/validation-avocat` | **404** | 404 | — | 404.html |
| `/fonctionnalites/suivi-statuts` | **404** | 404 | — | 404.html |
| `/fonctionnalites/messagerie-securisee` | **404** | 404 | — | 404.html |
| `/fonctionnalites/coffre-fort` | **404** | 404 | — | 404.html |
| `/fonctionnalites/calendrier-relances` | **404** | 404 | — | 404.html |
| `/fonctionnalites/reponse-auto-mails` | **404** | 404 | — | 404.html |
| `/tarifs` | **404** | 404 | — | 404.html |
| `/securite` | **404** | 404 | — | 404.html |
| `/blog` | 301 | **404** | `https://www.clair-dossier.com/blog/` | 404.html |
| `/blog/preparer-rendez-vous-avocat` | **404** | 404 | — | 404.html |
| `/blog/chronologie-prud-homale` | **404** | 404 | — | 404.html |
| `/blog/rgpd-legaltech` | **404** | 404 | — | 404.html |
| `/blog/mise-en-demeure` | **404** | 404 | — | 404.html |
| `/blog/conservation-documents` | **404** | 404 | — | 404.html |
| `/blog/ia-droit` | **404** | 404 | — | 404.html |
| `/blog/mediation-contentieux` | **404** | 404 | — | 404.html |
| `/contact` | **404** | 404 | — | 404.html |
| `/mentions-legales` | **404** | 404 | — | 404.html |
| `/cgv` | **404** | 404 | — | 404.html |
| `/politique-confidentialite` | **404** | 404 | — | 404.html |
| `/cookies` | **404** | 404 | — | 404.html |

**Bilan** : 1 × 200, 2 × 301→404, 23 × 404 (`raw/codes.txt`).

Explication du 301 sur `/fonctionnalites` et `/blog` : GitHub Pages détecte qu'un **répertoire** `fonctionnalites/` et `blog/` existe dans le déploiement (il contient les fichiers `.md`, cf. §3) et redirige vers la forme avec slash ; comme il n'y a pas d'`index.html` dans ces répertoires, il sert ensuite `404.html` avec un statut 404.

Autres routes SPA (déclarées dans le bundle, hors sitemap) — toutes 404 avec corps `404.html` : `/inscription`, `/connexion`, `/compte`, `/dossier/nouveau`, `/dossier/`, `/blog/` (`raw/lazy-codes.txt`, test §4.4). Liste complète des routes React trouvées dans `raw/assets/index-BEZEsRp_.js` : `/`, `fonctionnalites`, `fonctionnalites/:slug`, `tarifs`, `securite`, `blog`, `blog/:slug`, `contact`, `mentions-legales`, `cgv`, `politique-confidentialite`, `cookies`, `inscription`, `connexion`, `compte`, `compte/dossier/:id`, `dossier/nouveau`, `*`.

---

## 3. Fichiers statiques pour crawlers (`.md`, `llms.txt`, `robots.txt`) — codes

Source : `raw/md-codes.txt`. Tous les `.md` sont servis en `text/markdown; charset=utf-8`.

| Chemin | Code | Type | Taille (o) |
|---|---|---|---|
| `/index.md` | 200 | text/markdown | 10 298 |
| `/page.md` | 200 | text/markdown | 10 298 (identique à index.md) |
| `/tarifs.md` | 200 | text/markdown | 6 083 |
| `/securite.md` | 200 | text/markdown | 3 206 |
| `/contact.md` | 200 | text/markdown | 1 189 |
| `/mentions-legales.md` | 200 | text/markdown | 3 638 |
| `/cgv.md` | 200 | text/markdown | 5 688 |
| `/politique-confidentialite.md` | 200 | text/markdown | 4 978 |
| `/cookies.md` | 200 | text/markdown | 2 730 |
| `/fonctionnalites/index.md` | 200 | text/markdown | 3 632 |
| `/fonctionnalites.md` | **404** | (404.html) | — |
| `/fonctionnalites/creation-guidee.md` | 200 | text/markdown | 1 999 |
| `/fonctionnalites/pieces-ocr.md` | 200 | text/markdown | 1 865 |
| `/fonctionnalites/chronologie.md` | 200 | text/markdown | 1 743 |
| `/fonctionnalites/validation-avocat.md` | 200 | text/markdown | 1 721 |
| `/fonctionnalites/suivi-statuts.md` | 200 | text/markdown | 1 762 |
| `/fonctionnalites/messagerie-securisee.md` | 200 | text/markdown | 1 920 |
| `/fonctionnalites/coffre-fort.md` | 200 | text/markdown | 1 894 |
| `/fonctionnalites/calendrier-relances.md` | 200 | text/markdown | 1 716 |
| `/fonctionnalites/reponse-auto-mails.md` | 200 | text/markdown | 1 701 |
| `/blog/index.md` | 200 | text/markdown | 4 326 |
| `/blog.md` | **404** | (404.html) | — |
| `/blog/preparer-rendez-vous-avocat.md` | 200 | text/markdown | 8 544 |
| `/blog/chronologie-prud-homale.md` | 200 | text/markdown | 8 009 |
| `/blog/rgpd-legaltech.md` | 200 | text/markdown | 8 823 |
| `/blog/mise-en-demeure.md` | 200 | text/markdown | 9 150 |
| `/blog/conservation-documents.md` | 200 | text/markdown | 8 129 |
| `/blog/ia-droit.md` | 200 | text/markdown | 8 743 |
| `/blog/mediation-contentieux.md` | 200 | text/markdown | 8 168 |
| `/llms.txt` | 200 | text/plain | 8 672 |
| `/llms-full.txt` | 404 | — | — |
| `/robots.txt` | 200 | text/plain | 306 |
| `/sitemap.xml` | 200 | (xml) | — |
| `/humans.txt`, `/security.txt`, `/.well-known/security.txt` | 404 | — | — |
| `/feed.xml`, `/rss.xml`, `/blog/feed.xml` | 404 | — | — |
| `/manifest.webmanifest`, `/site.webmanifest` | 404 | — | — |
| `/inscription.md`, `/connexion.md`, `/compte.md`, `/dossier/nouveau.md` | 404 | — | — |
| `/favicon.svg` | 200 | image/svg+xml | 297 |
| `/og-default.svg` | 200 | image/svg+xml | 2 347 |
| `/CNAME` | 200 | — | 22 (`www.clair-dossier.com`) |
| `/.nojekyll` | 404 | — | — |

Remarque : la convention annoncée dans `llms.txt` (« même chemin + `.md` ») est respectée pour 20 pages ; les pages applicatives (`/inscription`, `/connexion`, `/compte`, `/dossier/nouveau`) n'ont pas de `.md`, ce qui est cohérent avec `robots.txt`.

---

## 4. En-têtes HTTP, redirections, 404

### 4.1 Home `https://www.clair-dossier.com/` (`raw/headers-home.txt`)

| En-tête | Valeur |
|---|---|
| Statut | `HTTP/2 200` |
| `server` | `GitHub.com` |
| `content-type` | `text/html; charset=utf-8` |
| `content-length` | `3759` |
| `last-modified` | `Thu, 02 Jul 2026 14:49:04 GMT` (date du dernier déploiement) |
| `etag` | `"6a467a60-eaf"` |
| `cache-control` | `max-age=600` (10 min, valeur GitHub Pages par défaut) |
| `expires` | `Sun, 23 Aug 2026 06:46:28 GMT` |
| `access-control-allow-origin` | `*` |
| `via` / `x-served-by` / `x-cache` | `1.1 varnish` / `cache-par-lfpg1960091-PAR` / `HIT` (CDN Fastly, POP Paris) |
| `x-github-edge-region` | `fra` |
| `vary` | `Accept-Encoding` |
| `accept-ranges` | `bytes` |
| **`strict-transport-security`** | **absent** |
| **`content-security-policy`** | **absent** |
| **`x-frame-options`** | **absent** |
| **`x-content-type-options`** | **absent** |
| **`referrer-policy`** | **absent** |
| **`permissions-policy`** | **absent** |

Les assets `/assets/*.js|css` et les images ont le même `cache-control: max-age=600` (`raw/assets-codes.txt`) — aucune directive `immutable` malgré les noms hachés (limite GitHub Pages, non configurable).

Compression : GitHub Pages sert `content-encoding: gzip` quand `Accept-Encoding: gzip, br` est envoyé (testé sur `supabase-Buf76L6m.js` : 55 254 o transférés) — pas de Brotli observé.

### 4.2 Redirections http → https et apex → www

| Requête | Statut | `Location` | Commentaire |
|---|---|---|---|
| `http://www.clair-dossier.com/` | **200** | — | **Page servie en clair, sans redirection HTTPS.** Corps identique à `index.html` (`raw/http-www-body.html`). |
| `http://www.clair-dossier.com/tarifs` | 404 | — | 404.html servi en clair |
| `http://clair-dossier.com/` | 301 | `http://www.clair-dossier.com/` | redirection apex→www **en HTTP** (pas vers https) |
| `https://clair-dossier.com/` | 301 | `https://www.clair-dossier.com/` | OK |
| `http://clair-dossier.com/tarifs` | 301 | `http://www.clair-dossier.com/tarifs` | chemin conservé, puis 404 |
| `https://clair-dossier.com/tarifs` | 301 | `https://www.clair-dossier.com/tarifs` | chemin conservé, puis 404 |
| `https://romancg13.github.io/` | 404 | — | origine GitHub Pages (project page) ; ne redirige pas vers le domaine |

Chaîne complète `http://clair-dossier.com/tarifs` → `301 http://www.clair-dossier.com/tarifs` → `404`.

### 4.3 DNS et TLS

| Élément | Valeur observée |
|---|---|
| `www.clair-dossier.com` CNAME | `romancg13.github.io.` |
| `www` A (via CNAME) | 185.199.108/109/110/111.153 (GitHub Pages) |
| `clair-dossier.com` A | 185.199.108/109/110/111.153 |
| `clair-dossier.com` AAAA | aucun |
| MX | **aucun** |
| TXT | **aucun** (pas de SPF, pas de DMARC, pas de vérification Google en TXT — la vérification passe par la balise `<meta name="google-site-verification">` `raw/index.html:9`) |
| NS | `ns1..ns4.whois.com.` |
| Certificat | `CN=www.clair-dossier.com`, émetteur Let's Encrypt (`CN=YR2`), expiration **22 oct. 2026 15:17:56 GMT** (renouvellement automatique GitHub) |
| Protocole | TLS 1.3 / CHACHA20-POLY1305, ALPN h2 |

### 4.4 Route inexistante `/page-inexistante`

- Statut **404**, `content-length: 3759`, corps **identique** à `index.html` (`diff raw/index.html raw/page-inexistante.html` → vide).
- `/404.html` répond **200** et est identique à `index.html`. Donc le fallback SPA GitHub Pages (« 404.html = copie d'index.html ») est bien en place : l'application React se charge sur toute route, mais avec un statut HTTP 404 pour tout ce qui n'est pas `/`.

---

## 5. Assets référencés par la home

### 5.1 HTML de la home (`raw/index.html`, 3 759 o)

| Ligne | Élément |
|---|---|
| 1–2 | `<!doctype html><html lang="fr">` |
| 6 | `theme-color #0d1b3d` |
| 7 | `format-detection telephone=no` |
| 9 | `google-site-verification` = `yKED4w0FJ9KypEjb814a_MoyCkGpPRjWR8KVPEhDQ7c` |
| 11 | favicon `/favicon.svg` (SVG uniquement) |
| 12 | canonical `https://www.clair-dossier.com/` (le même pour toute route, tant que le JS n'a pas tourné) |
| 13 | `rel="alternate" type="application/rss+xml" href="/blog"` → **pas un flux RSS** |
| 16 | `<title>ClairDossier — Votre dossier administratif et juridique, clair, structuré et suivi.</title>` |
| 17 | meta description (PME, artisans, indépendants, professions libérales) |
| 18 | `<meta name="author" content="Nouh BENZIDANE">` |
| 19 | robots `index, follow, max-image-preview:large` |
| 22–30 | Open Graph : `og:image` = `https://www.clair-dossier.com/og-default.svg` (1200×630), locale `fr_FR` |
| 33–36 | Twitter card `summary_large_image`, image SVG |
| 40–45 | `<script type="module" src="/assets/index-BEZEsRp_.js">` + 4 `modulepreload` + 1 CSS |
| 47 | `<body class="bg-cream-50 text-ink antialiased">` |
| 49–57 | `<noscript>` avec l'e-mail `contact.clairdossier@icloud.com` |

### 5.2 JS / CSS initiaux (`raw/assets-codes.txt`)

| Asset | Code | Type | Brut (o) | gzip (o, calcul local) |
|---|---|---|---|---|
| `/assets/index-BEZEsRp_.js` | 200 | application/javascript | 150 581 | 45 971 |
| `/assets/react-CBBoJgXi.js` | 200 | application/javascript | 193 685 | 60 434 |
| `/assets/router-CjS7eph5.js` | 200 | application/javascript | 37 893 | 13 691 |
| `/assets/supabase-Buf76L6m.js` | 200 | application/javascript | 209 587 | 54 597 |
| `/assets/motion-ZtdEAC6k.js` | 200 | application/javascript | 121 549 | 40 355 |
| **Total JS initial** | | | **713 295** | **215 048** |
| `/assets/index-B6lhu7zR.css` | 200 | text/css | 100 114 | 27 459 |

Le CSS (100 Ko) est volumineux surtout à cause des **124 déclarations `@font-face`** (61 `.woff2` + 63 `.woff`, subsets cyrillic/cyrillic-ext/latin/latin-ext/greek/vietnamese) pour 3 familles : Cormorant Garamond (400/500/600/700 + 500 italic), Inter (300/400/500/600), JetBrains Mono (400/500). `font-display: swap` partout.

### 5.3 Chunks lazy (`raw/lazy-codes.txt`) — tous 200

`Account` 4 874 o · `BlogIndex` 4 107 · `BlogPost` 7 637 · `Contact` 7 917 · `DossierDetail` 26 672 · `DossierFlow` 23 126 · `FeatureDetail` 4 420 · `FeaturesIndex` 4 004 · `LegalPage` 22 452 · `Login` 2 865 · `NotFound` 1 360 · `Pricing` 17 357 · `Security` 10 736 · `Signup` 4 383 · `authors` 390 · `whatsapp` 244. Total ≈ 142 544 o bruts.

### 5.4 Polices, favicon, OG

- Polices latin `.woff2` testées en HEAD : toutes 200, `font/woff2`, 21–24 Ko chacune (10 fichiers testés, liste dans la sortie `raw/` §polices). Elles sont auto-hébergées (`@fontsource`), aucune requête vers Google Fonts.
- `/favicon.svg` : 200, 297 o, carré navy `#0d1b3d` avec « CD » doré. **Pas de `favicon.ico`, `favicon.png`, `apple-touch-icon.png`** (404).
- `/og-default.svg` : 200, 2 347 o, 1200×630. Texte : « Votre dossier juridique, clair, structuré et suivi. » / sous-titre « Plateforme legaltech française · OVH France · RGPD natif » / eyebrow « LEGALTECH · CLIENTS · PME · CABINETS ». **Aucune variante PNG/JPG** (`/og-default.png`, `/og-image.png`, `/og.png` → 404). Les polices citées dans le SVG (Cormorant, JetBrains Mono, Inter) ne sont pas embarquées dans le SVG → rendu variable selon le système qui l'affiche.

---

## 6. Résumé de contenu page par page (version markdown servie aux crawlers)

### 6.1 `robots.txt` (`raw/md/robots.txt`)
- `User-agent: *` → `Allow: /`, `Disallow: /dossier/`.
- Autorisations explicites : GPTBot, ChatGPT-User, PerplexityBot, Claude-Web, Google-Extended.
- `Sitemap: https://www.clair-dossier.com/sitemap.xml`.

### 6.2 `llms.txt` (`raw/md/llms.txt`, 8 672 o)
| Section | Contenu |
|---|---|
| En-tête (l.1–7) | Présentation ; **éditeur Roman Gomes, EI, SIREN 105 490 734, Château-Gombert, 13013 Marseille ; contact.clairdossier@icloud.com ; WhatsApp +33 7 82 98 36 44 ; site réalisé par Nouh BENZIDANE (nouhbenzidane.fr)** (l.5). Ligne 7 : « l'IA prépare les dossiers (résumé, chronologie, projet de réponse), un professionnel du droit peut les valider en option ». |
| Position éditoriale (l.9–11) | « validation juridique … service optionnel, assuré par un avocat inscrit au barreau » (l.11). |
| Architecture (l.13–28) | Liste des routes, y compris `/inscription, /connexion, /compte : … (Supabase auth)` (l.22) et `/dossier/nouveau : Création de dossier en 4 étapes` (l.23) — **les pages fonctionnalités parlent de 5 étapes**. |
| Articles (l.30–52) | 7 articles avec résumés et bases légales (L.1332-4 C. trav., art. 1344 et 1344-1 C. civ., L.123-22 C. com., art. 2224 C. civ., RGPD 28/32/35, décret 2019). |
| Tarifs (l.54–62) | Essentiel 19 € (5 dossiers, 1 utilisateur, **résumé IA**) ; Entrepreneur 39 € (10 dossiers, 2 utilisateurs, **rédaction IA**) ; Business PME 20 49 € (20 dossiers, 5 utilisateurs) ; Business PME 50 89 € (50 dossiers, 5 utilisateurs, **réponse automatisée aux e-mails, IA complète**) ; Pro 169 € (illimité, 15 utilisateurs, **IA avancée GPT-5.5**) ; Premium 299 € (illimité, marque blanche, API, SSO, audit) ; sur devis. « −10 % annuel », « remboursement au prorata ». |
| Sécurité (l.64–74) | **OVHcloud France (Roubaix, Strasbourg)**, AES-256, **TLS 1.3 HSTS preload**, 2FA admin, sauvegardes 3-2-1 RPO 15 min RTO < 4 h, DPA, RIN 2024, **HDS en cours (2026 T3), ISO 27001 objectif 2027**, pentest annuel, CNIL < 72 h. |
| Markdown alternatif (l.82–97) ; Crawling (l.99–101) ; Contact (l.103–105) | convention `.md`, réponse sous 24 h ouvrées. |

### 6.3 `/index.md` = `/page.md` (`raw/md/index.md`, 128 lignes)
| Élément | Valeur (ligne) |
|---|---|
| H1 | « ClairDossier » (l.7) ; accroche « Votre dossier administratif et juridique, clair, structuré et suivi. » (l.9) |
| Intro | « Option : un préavis juridique et un résumé de la situation à valider par un professionnel du droit. » (l.11) |
| Promesse | « 6 statuts dossier standardisés », « Calendrier et relances automatiques à échéance », **« 100 % conforme RGPD — hébergement OVH France »** (l.15–17) |
| Trois espaces | Vous / Validation (« administrateur unique … côté support ») / Entreprise (l.19–46) — création guidée **en 5 étapes**, transmission e-mail ou WhatsApp, liens privés à durée limitée |
| Workflow 6 statuts | Brouillon, Complété, Transmis, En cours, Validé, Archivé (l.48–55) |
| 9 fonctionnalités | Création guidée, Dépôt de pièces, Avancement, Transmission, Mes dossiers, Espace sécurisé, Données RGPD, Échéances, Récapitulatif (l.57–67) — **les slugs historiques (`pieces-ocr`, `validation-avocat`, `messagerie-securisee`, `coffre-fort`, `calendrier-relances`, `reponse-auto-mails`) ne correspondent plus aux intitulés** |
| Tarifs | 19 / 39 / 49 / 89 / 169 / 299 € HT/mois + sur devis ; −10 % annuel (l.69–81) |
| FAQ | 8 questions (l.83–115) ; « export RGPD … sous 30 jours » |
| Contact | **WhatsApp +33 7 82 98 36 44**, **contact.clairdossier@icloud.com** ×2, formulaire (l.117–122) |
| Pied | « éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE. » (l.126) |

Écart avec la page React réelle : le bundle home (`raw/assets/index-BEZEsRp_.js`) affiche « Hébergeur conforme RGPD · Pièces chiffrées au repos » et « Conçu pour le RGPD » ; **la chaîne « hébergement OVH France » n'apparaît dans le bundle que dans les articles de blog embarqués**, pas dans le hero.

### 6.4 `/tarifs.md` (`raw/md/tarifs.md`, 166 lignes)
H1 « Tarifs ClairDossier » (l.7). Sept formules avec prix mensuel HT, prix annuel (−10 %), dossiers, utilisateurs, support et grille de 8 fonctionnalités (✓ / limité / ✗) :

| Formule | Mensuel HT | Annuel HT | Dossiers | Utilisateurs | Support | Ligne |
|---|---|---|---|---|---|---|
| Essentiel | 19 € | 205,20 € (17,10 €/mois) | 5 | 1 | email | 13–31 |
| Entrepreneur | 39 € | 421,20 € (35,10 €/mois) | 10 | 2 | email prioritaire | 33–51 |
| Business PME 20 (mis en avant) | 49 € | 529,20 € (44,10 €/mois) | 20 | 5 | prioritaire | 53–71 |
| Business PME 50 | 89 € | 961,20 € (80,10 €/mois) | 50 | 5 | prioritaire | 73–91 |
| Business / PME Pro (mis en avant) | 169 € | 1 825,20 € (152,10 €/mois) | illimités | 15 | dédié | 93–111 |
| Business / PME Premium | 299 € | 3 229,20 € (269,10 €/mois) | illimités | illimités | entreprise | 113–131 |
| Business / PME personnalisée (mis en avant) | sur devis | — | illimités | illimités | accompagnement dédié | 133–149 |

- Devis sur-mesure « sous 48 h », contact e-mail + **WhatsApp +33 7 82 98 36 44** (l.153).
- Engagement : chiffrement HTTPS/au repos, transmission déclenchée par le client, sans engagement (l.155–159).
- Particularité : le plan **Essentiel** a « Suivi par étapes métier : ✗ », « Dépôt de pièces sécurisé : ✗ », « Pièces téléchargeables : ✗ » (l.27–30) alors que la FAQ de la home (index.md l.87, l.111) présente le dépôt/téléchargement de pièces comme générique.
- **Aucune mention d'IA** dans tarifs.md, contrairement à `llms.txt` l.56–60.
- Liens de paiement (dans `raw/assets/lazy/Pricing-BkV7N3IO.js` et `raw/assets/index-BEZEsRp_.js`) : 12 « Payment Links » Stripe `https://buy.stripe.com/…` (6 mensuels `ctaHref` + 6 annuels `ctaHrefYearly`), un par plan payant. Badges « Populaire » (49 €) et « Recommandé » (169 €).

### 6.5 `/securite.md` (`raw/md/securite.md`, 57 lignes)
H1 « Sécurité et conformité » (l.7). Architecture en 5 nœuds : Client → **TLS 1.3 (HSTS preload, pinning)** → **Bastion (WAF, rate-limit, audit)** → Application (France, 2FA admin) → **Coffre chiffré AES-256, réplique France** (l.13–17). Six piliers : **OVH France Roubaix/Strasbourg, bare-metal souverain** (l.24) ; AES-256, KMS, rotation 90 jours (l.27) ; 2FA, logs 12 mois (l.30) ; RGPD, DPIA, DPA, RIN, **HDS en cours** (l.33) ; 3-2-1, RPO 15 min, RTO < 4 h (l.36) ; pentest annuel, CNIL 72 h (l.39). Cadres : RGPD conforme, RIN 2024 conforme, **HDS objectif 2026 T3, ISO 27001 objectif 2027** (l.43–46). Divulgation responsable : e-mail, « programme de récompense informel » (l.50).

**Écart majeur avec la page React réelle** (`raw/assets/lazy/Security-CRht3cp3.js`) : le chunk ne contient **aucune** occurrence de « OVH », « AES », « HDS », « HSTS », « pentest ». Ses libellés sont : « Hébergement », « Chiffrement », « Accès », « Conformité », « Vos pièces », « Maîtrise & contact », statuts « Transit & repos », « Par utilisateur », « Sur demande », « Conçu pour » ; phrase type : « Les données sont hébergées chez un sous-traitant conforme au RGPD… chiffrées en transit (HTTPS) et au repos côté hébergeur… liens de téléchargement signés et temporaires ». Le `.md` servi aux moteurs et IA décrit donc une infrastructure qui n'est pas celle annoncée par la page visible, ni celle observée (GitHub Pages/Fastly + Supabase, **pas de HSTS**, HTTP en clair accepté).

### 6.6 `/contact.md` (`raw/md/contact.md`)
H1 « Contact » (l.7). Canaux : **WhatsApp +33 7 82 98 36 44, 9 h–19 h lun.–ven., réponse ~1 h** (l.13) ; e-mail général et sécurité `contact.clairdossier@icloud.com` (l.14–15) ; formulaire. Coordonnées éditeur : **« Roman Gomes — entrepreneur individuel — SIREN 105 490 734 — Château-Gombert, 13013 Marseille, France. »** (l.20) ; « Site réalisé et développé par Nouh BENZIDANE — https://nouhbenzidane.fr » (l.22).

Fonctionnement réel du formulaire (chunk `raw/assets/lazy/Contact-Dxc0iNee.js`, l.1 et l.8) : il importe `o as k` depuis `whatsapp-XHY5k8kR.js` ; à la soumission il compose un message « Bonjour ClairDossier, … » avec nom, e-mail, structure, message et **ouvre `https://wa.me/33782983644?text=…`**. Aucun appel serveur, aucune insertion Supabase : **le formulaire est un pré-remplissage WhatsApp**. Sujets proposés : Démo produit, Question commerciale, Support technique, Presse & contenu. H1 visible : « Une réponse sur WhatsApp, dans l'heure. » Champ « Siège » = « Château-Gombert, 13013 Marseille ».

### 6.7 `/mentions-legales.md` (`raw/md/mentions-legales.md`, màj 26 mai 2026)
- Éditeur : **Roman Gomes, EI, RNE SIREN 105 490 734, SIRET siège 105 490 734 00016, Château-Gombert, 13013 Marseille** ; APE **4791A — Vente à distance sur catalogue général** ; TVA non applicable art. 293 B CGI (l.16–20).
- Contact e-mail + **WhatsApp +33 7 82 98 36 44** (l.22) ; réalisation **Nouh BENZIDANE** (l.24).
- Directeur de la publication : Roman Gomes (l.28).
- **Hébergement : GitHub Pages, GitHub Inc., 88 Colin P Kelly Jr St, San Francisco, CA 94107, États-Unis** (l.32) ; données client « chez un sous-traitant technique conforme au RGPD » non nommé (l.34).
- Propriété intellectuelle : « propriété exclusive de **la société ClairDossier** » (l.38) — alors que l'éditeur est une entreprise individuelle, pas une société.
- Limitation de responsabilité : « ni un cabinet d'avocats, ni un service de conseil juridique » (l.44).

### 6.8 `/cgv.md` (`raw/md/cgv.md`, màj 26 mai 2026)
9 articles. Points factuels : création de compte gratuite, abonnement payant (l.12) ; Éditeur = Roman Gomes EI SIREN 105 490 734 (l.16) ; **« TVA française à 20 % s'applique »** (l.28) — **contradiction avec mentions-legales.md l.20 « TVA non applicable, art. 293 B »** ; paiement Stripe Payments Europe Ltd (l.30) ; résiliation à tout moment, remboursement prorata (l.34) ; récupération des données sous 30 jours (l.36) ; **art. 6 : « Il ne procède à aucune lecture, extraction ou analyse automatique des documents »** (l.44) — **contradiction avec llms.txt (résumé IA, rédaction IA, GPT-5.5) et avec l'article blog chronologie-prud-homale l.60 (« ClairDossier extrait automatiquement les dates des pièces »)** ; plafond de responsabilité = 12 derniers mois (l.54) ; **tribunaux de Paris** (l.60) alors que le siège est à Marseille.

### 6.9 `/politique-confidentialite.md` (`raw/md/politique-confidentialite.md`, màj 26 mai 2026)
Responsable : Roman Gomes, SIREN 105 490 734, Château-Gombert, 13013 Marseille (l.16). Données : compte, dossier, paiement (Stripe), techniques/IP (l.22–25). Bases légales 6.1.b / 6.1.f / 6.1.a (l.37). Destinataires : hébergeur non nommé, Stripe Payments Europe Ltd (Irlande), sous-traitants mail transactionnel « listés dans le registre… fourni sur demande » (l.43–46). Conservation : compte 12 mois après résiliation, facturation 10 ans, logs 12 mois (l.52–55). Droits RGPD, réponse sous 30 jours, CNIL (l.61–68). **Aucun DPO nommé**, **Supabase n'est jamais cité** bien que ce soit le sous-traitant effectif (clé et URL dans le bundle, `llms.txt` l.22 le cite).

### 6.10 `/cookies.md` (`raw/md/cookies.md`, màj 26 mai 2026)
Cookies « strictement nécessaires » uniquement : session, préférence (1 an), sécurité CSRF (l.22–24). Cookies tiers : Stripe lors du paiement (l.28). Aucun analytics (l.30). Remarque : le bundle utilise `localStorage` avec la clé `clairdossier-auth` (config Supabase `storageKey`, `raw/assets/index-BEZEsRp_.js`) — ce n'est pas un cookie au sens strict, la page cookies ne mentionne pas le stockage local.

### 6.11 `/fonctionnalites/index.md` + 9 pages (`raw/md/fonctionnalites_*.md`)
| Slug | H1 (ligne 7) | 4 puces « Concrètement » (résumé) |
|---|---|---|
| `creation-guidee` | Création guidée par typologie | tunnel 5 étapes, profils artisan/indépendant/prof. libérale/PME, nom de dossier obligatoire, récapitulatif |
| `pieces-ocr` | Dépôt de pièces dans un espace privé | dépôt à l'étape dédiée, liens temporaires signés, téléchargement, isolation par utilisateur — **aucune OCR** malgré le slug |
| `chronologie` | Avancement du dossier en 5 étapes | 5 étapes cliquables, pièces, échéances — **pas de chronologie auto** |
| `validation-avocat` | Transmission validée par vous | transmission e-mail/WhatsApp déclenchée par le client — **aucun avocat** |
| `suivi-statuts` | Liste de vos dossiers en un espace | compte gratuit confirmé par e-mail, liste, isolation |
| `messagerie-securisee` | Espace privé et sécurisé | auth, HTTPS + chiffrement au repos, liens signés — **pas de messagerie** |
| `coffre-fort` | Vos données protégées et maîtrisées | hébergeur sous-traitant RGPD, accès/export/suppression sous 30 jours |
| `calendrier-relances` | Échéances renseignées et affichées | dates saisies à la création, affichées — **pas de relances automatiques** (contrairement à index.md l.16 « relances automatiques à échéance » et à la meta description de la home) |
| `reponse-auto-mails` | Récapitulatif avant transmission | récapitulatif en fin de tunnel — **pas de réponse automatique aux e-mails** (contrairement à la meta description `raw/index.html:17` « projets de réponse aux e-mails ») |

Chaque page se termine par le même pied : « éditeur : Roman Gomes (SIREN 105 490 734, Château-Gombert, 13013 Marseille). Site réalisé par Nouh BENZIDANE. »

### 6.12 `/blog/index.md` + 7 articles (`raw/md/blog_*.md`)
- Index : « Articles écrits par la rédaction ClairDossier, **relus par des avocats** » (l.9). 7 articles (dates 12 févr. → 20 mai 2026, 6–9 min, catégories Méthode / Droit social / Procédure amiable / Conformité / Résolution de conflit / IA et droit). Tous signés `author: Rédaction ClairDossier`.
- Structure commune des articles : frontmatter (title, description, date, author, category, readMinutes, url), H1, sections, « À retenir », « Questions liées » (FAQ), parfois « Méthode étape par étape », « Articles liés », pied éditeur.
- **Affirmations produit contenues dans les articles (et embarquées dans le bundle home)** :
  - `blog_rgpd-legaltech.md:68` : « Hébergement OVH France exclusif, chiffrement AES-256 au repos, TLS 1.3 en transit, DPA standard et version renforcée pour les plans Entreprise, DPIA disponible, audit annuel par un cabinet de sécurité tiers indépendant, export ZIP intégral à tout moment, suppression de compte avec anonymisation sous 30 jours. »
  - `blog_ia-droit.md:59-61` : « Chaque fonctionnalité IA de ClairDossier est conçue pour produire un livrable destiné à l'avocat… Aucune décision juridique ne sort de ClairDossier sans la signature électronique d'un professionnel habilité. »
  - `blog_chronologie-prud-homale.md:60` : « ClairDossier extrait automatiquement les dates des pièces déposées par le client, propose une frise éditable, et permet à l'avocat de requalifier chaque évènement. »
  - JSON-LD `Organization` (`raw/assets/index-BEZEsRp_.js`) : description « …dossiers structurés, suivis et **validés par des professionnels habilités** », `foundingDate: "2025"`.

---

## 7. Données personnelles et identifiants trouvés (URL + texte exact)

| Donnée | Texte exact | Où (fichier:ligne) |
|---|---|---|
| Téléphone / WhatsApp | `+33 7 82 98 36 44` | `raw/md/index.md:119`, `raw/md/page.md:119`, `raw/md/tarifs.md:153`, `raw/md/contact.md:13`, `raw/md/mentions-legales.md:22`, `raw/md/llms.txt:5`, chunk `raw/assets/lazy/LegalPage-Bb23UQjS.js:1`, chunk `raw/assets/lazy/whatsapp-XHY5k8kR.js:1` (`p="+33 7 82 98 36 44"`) |
| Téléphone format international sans espace | `33782983644` | `raw/assets/lazy/whatsapp-XHY5k8kR.js:1` (`e="33782983644"`, utilisé dans `https://wa.me/…`) |
| E-mail | `contact.clairdossier@icloud.com` | 50 occurrences : `raw/index.html:54` (noscript), tous les `.md` (pied et sections contact), `llms.txt:5,105`, chunks `LegalPage` (×10), `Security` (×2), `Pricing` (×2), `Contact` (×2, dont `mailto:`), `DossierFlow` (×1) |
| E-mail (placeholder) | `vous@cabinet.fr` | `raw/assets/lazy/Contact-Dxc0iNee.js:8` (placeholder de champ, pas une vraie adresse) |
| Nom (éditeur) | `Roman Gomes` | `raw/md/mentions-legales.md:16,28,55`, `politique-confidentialite.md:16,77`, `cgv.md:16,65`, `contact.md:20,27`, `llms.txt:5`, pied de **tous** les `.md` (index l.126, tarifs l.164, securite l.55, cookies l.44, fonctionnalites_* , blog_*), `raw/assets/index-BEZEsRp_.js` (×1), `raw/assets/lazy/LegalPage-Bb23UQjS.js` (×4) |
| Nom (prestataire) | `Nouh BENZIDANE` | `raw/index.html:18` (`<meta name="author">`), pied de tous les `.md`, `llms.txt:5`, `mentions-legales.md:24`, `contact.md:22`, `raw/assets/lazy/LegalPage-Bb23UQjS.js` |
| Site tiers | `https://nouhbenzidane.fr` | `raw/md/llms.txt:5`, `contact.md:22`, `mentions-legales.md:24`, chunk `LegalPage` |
| SIREN | `105 490 734` | 34 occurrences (`raw/md/*.md` pieds + corps légaux, `llms.txt:5`, `raw/assets/index-BEZEsRp_.js`, chunk `LegalPage` ×2) |
| SIRET | `105 490 734 00016` | `raw/md/mentions-legales.md:16`, chunk `LegalPage` |
| Code APE | `4791A — Vente à distance sur catalogue général` | `raw/md/mentions-legales.md:18` |
| Adresse postale éditeur | `Château-Gombert, 13013 Marseille, France` / `Château-Gombert, 13013 Marseille` | 31 occurrences (`mentions-legales.md:16`, `contact.md:20`, `politique-confidentialite.md:16`, pieds de tous les `.md`, `llms.txt:5`, chunks `LegalPage`, `Contact` champ « Siège ») — pas de numéro/rue, quartier + code postal seulement |
| Adresse hébergeur | `88 Colin P Kelly Jr St, San Francisco, CA 94107, États-Unis` | `raw/md/mentions-legales.md:32`, chunk `LegalPage` |
| Identifiant Supabase | URL `https://buzgokfmxpmyceppvjpp.supabase.co` + clé anon JWT (`role: anon`, `iss: supabase`, `ref: buzgokfmxpmyceppvjpp`) | `raw/assets/index-BEZEsRp_.js` (constantes `Ce` et `Y`, `storageKey: "clairdossier-auth"`) — clé non reproduite ici |
| Tables/fonctions Supabase exposées dans le client | `dossiers`, `dossier_documents`, `profiles`, bucket `documents`, RPC `is_admin`, `admin_user_emails` | `raw/assets/lazy/*.js` (grep `.from("…")`, `.rpc("…")`) |
| Liens de paiement | 12 × `https://buy.stripe.com/<id>` | `raw/assets/index-BEZEsRp_.js`, `raw/assets/lazy/Pricing-BkV7N3IO.js` |
| Vérification Google | `yKED4w0FJ9KypEjb814a_MoyCkGpPRjWR8KVPEhDQ7c` | `raw/index.html:9` |
| Compte GitHub (déduit du DNS) | `romancg13.github.io` | `dig www.clair-dossier.com CNAME` |

Non trouvés : autre numéro de téléphone (aucun motif `0X XX XX XX XX`), autre e-mail, autre nom de personne (les auteurs du blog sont « Rédaction ClairDossier », `raw/assets/lazy/authors-CIQV-9ZL.js`), numéro de TVA intracommunautaire, IBAN.

---

## 8. Accessibilité de l'API Supabase

| Requête | Code | Corps (extrait) |
|---|---|---|
| `HEAD https://buzgokfmxpmyceppvjpp.supabase.co/auth/v1/health` | **401** | — |
| `GET …/auth/v1/health` (sans clé) | 401 | `{"hint":"No \`apikey\` request header or url param was found.","message":"No API key found in request"}` |
| `GET …/rest/v1/` (sans clé) | 401 | idem |
| `HEAD …/` (racine) | 404 | — |

Conclusion : le projet Supabase est joignable et répond normalement (la passerelle exige `apikey`). Aucune donnée n'a été demandée ni reçue. Je n'ai **pas** testé avec la clé anon (hors périmètre lecture seule / aucune donnée).

---

## 9. Écarts avec ce qu'on attend d'un site Vite SPA sur GitHub Pages

| Attendu (Vite SPA + GitHub Pages, bonnes pratiques) | Observé | Écart |
|---|---|---|
| `index.html` à la racine, assets hachés sous `/assets/` | Oui (`/assets/index-BEZEsRp_.js`, CSS, polices) | Conforme |
| `404.html` = copie d'`index.html` pour le fallback SPA | Oui, identique (3 759 o) | Conforme, **mais** toutes les routes profondes renvoient un statut 404 — c'est la limite connue de GitHub Pages ; un sitemap de 26 URLs dont 25 en 404 est incohérent avec une indexation (Google traite un 404 comme « page absente », même si le JS se rend). |
| `CNAME` déployé | Oui (`www.clair-dossier.com`) | Conforme |
| « Enforce HTTPS » activé → 301 http→https + `strict-transport-security` | **Non** : `http://www.` répond 200, apex http→`http://www` ; aucun HSTS | **Écart** (et contradiction avec `securite.md:14` et `llms.txt:67` « HSTS preload ») |
| `.nojekyll` (évite le traitement Jekyll des `_*`) | 404 — fichier absent ou non servi (GitHub ne sert pas forcément les dotfiles) | Non vérifiable depuis l'extérieur |
| Pas de pré-rendu : titre/description/canonical identiques sur toutes les routes tant que le JS n'a pas tourné | Oui : `<title>` et `canonical=https://www.clair-dossier.com/` pour tout, commentaire « overridden per route by the Seo component once JS mounts » (`raw/index.html:15`) | Attendu, mais combiné au statut 404 cela affaiblit fortement le SEO des pages profondes ; les `.md` + `llms.txt` compensent pour les LLM, pas pour Google |
| Cache `max-age=600` non modifiable | Oui | Limite plateforme |
| Pas de headers de sécurité configurables (CSP, XFO…) | Aucun | Limite plateforme — seule une CSP via `<meta http-equiv>` serait possible ; absente |
| `og:image` en PNG/JPG ≥ 1200×630 | SVG uniquement | **Écart** (aperçus sociaux cassés sur la plupart des plateformes) |
| `favicon.ico` + `apple-touch-icon` | Absents | Écart mineur |
| Flux RSS si `rel=alternate` déclaré | Déclaré vers `/blog` (HTML, 404) | **Écart** (lien trompeur) |
| 301 trailing-slash : GitHub ajoute `/` si un dossier existe | `/fonctionnalites` et `/blog` → 301 → `/…/` → 404 | Effet de bord de la présence des répertoires `fonctionnalites/` et `blog/` contenant les `.md` |
| Chunks vendor séparés (react, router, supabase, motion) | Oui, 5 chunks initiaux (713 Ko brut / 215 Ko gzip) + 16 lazy | Conforme ; le chunk `supabase` (210 Ko brut) est chargé en `modulepreload` sur la home marketing |
| Polices auto-hébergées subsettées | 124 `@font-face` (6 subsets × 3 familles × poids) dans un CSS de 100 Ko | Surcoût CSS ; seuls les `.woff2` latin sont réellement utiles en FR |

---

## 10. Risques identifiés

| # | Risque | Niveau | Base factuelle |
|---|---|---|---|
| R1 | **SEO** : 25/26 URLs du sitemap en 404 ; title/canonical identiques avant JS ; rel=alternate RSS cassé. Risque de désindexation/« soft 404 » des pages tarifs, sécurité, blog, légales. | Élevé | §2, §5.1 |
| R2 | **Transport** : HTTP en clair accepté sur `www` (200) ; pas de HSTS ; redirection apex en http. Un utilisateur tapant `clair-dossier.com` reste en HTTP jusqu'à ce que le navigateur force HTTPS (HSTS absent). Les claims « TLS 1.3 HSTS preload, pinning » (`securite.md:14`) sont contredits par la réalité. | Élevé | §4.2 |
| R3 | **Conformité / loyauté de l'information** : les `.md`, `llms.txt`, l'OG image et les articles de blog affirment OVH France, AES-256, WAF, bastion, HDS, ISO 27001, pentest annuel, IA GPT-5.5, validation par avocat inscrit au barreau, signature électronique d'un professionnel habilité — alors que : (a) la page Sécurité React ne le dit plus ; (b) les mentions légales disent GitHub Pages (US) ; (c) les CGV art. 6 disent « aucune analyse automatique » ; (d) l'infra observée est GitHub/Fastly + Supabase. Ces textes sont précisément ceux que les IA et moteurs citeront (`llms.txt` l.103 invite à citer). Exposition à des reproches de pratique commerciale trompeuse et à une perte de crédibilité. | Élevé | §6.2, §6.3, §6.5, §6.12 |
| R4 | **Incohérences juridiques internes** : TVA 20 % (cgv.md:28) vs franchise 293 B (mentions-legales.md:20) ; « société ClairDossier » (mentions-legales.md:38) vs EI ; tribunaux de Paris (cgv.md:60) vs siège Marseille ; « 4 étapes » (llms.txt:23) vs « 5 étapes » partout ailleurs ; « relances automatiques » / « projets de réponse aux e-mails » (index.md:16, index.html:17) vs pages fonctionnalités qui décrivent un simple affichage des échéances et un récapitulatif ; slugs d'URL (`pieces-ocr`, `validation-avocat`, `messagerie-securisee`, `reponse-auto-mails`) décrivant des fonctions qui n'existent plus. | Moyen | §6.4–6.11 |
| R5 | **RGPD** : sous-traitant réel (Supabase, région non indiquée) jamais nommé dans la politique de confidentialité ni les mentions légales ; pas de DPO ; stockage local (`clairdossier-auth`) non mentionné dans la page cookies ; formulaire de contact qui envoie nom/e-mail/structure/message vers **WhatsApp (Meta)** sans en informer l'utilisateur dans la politique (seule la transmission de dossiers « à votre initiative » est citée). | Moyen | §6.6, §6.9, §6.10 |
| R6 | **Exposition de données personnelles** : numéro de portable personnel (`+33 7 82 98 36 44`, aussi en clair dans le JS), SIREN/SIRET, quartier de résidence, nom du prestataire en `<meta author>` sur toutes les pages, diffusés sur 30+ fichiers conçus pour être aspirés par les crawlers IA (`robots.txt` autorise explicitement GPTBot, ClaudeBot, Perplexity). Mentions LCEN obligatoires, mais la redondance (pied de chaque `.md`, `llms.txt`) maximise la réplication hors du site. | Moyen | §7 |
| R7 | **Sécurité applicative** : clé anon Supabase et noms de tables/RPC (`is_admin`, `admin_user_emails`, bucket `documents`) visibles dans le bundle ; la protection des données client dépend exclusivement des politiques RLS et des policies Storage (non auditées ici). Aucun header CSP pour limiter l'injection. | Moyen (à vérifier côté Supabase) | §7, §4.1 |
| R8 | **Paiement** : 12 Payment Links Stripe en dur dans le bundle ; un changement de prix exige un rebuild ; pas de vérification que les prix Stripe correspondent aux prix affichés (non testé, hors périmètre). | Faible–moyen | §6.4 |
| R9 | **Partage social** : `og:image` SVG → vignette absente sur LinkedIn/Facebook/X/WhatsApp ; l'OG dit encore « OVH France » et « CABINETS ». | Faible | §5.4 |
| R10 | **E-mail** : aucun MX/SPF/DMARC sur `clair-dossier.com` ; le domaine peut être usurpé en expéditeur sans qu'aucune politique ne le rejette ; contact via iCloud personnel. | Faible–moyen | §4.3 |
| R11 | **Performance** : 215 Ko JS gzip + 27 Ko CSS gzip + polices au premier chargement de la home marketing (dont le client Supabase 55 Ko gzip en preload) ; CSS gonflé par 124 `@font-face`. | Faible | §5.2 |

---

## 11. Ce que je n'ai pas fait / limites

- Pas de rendu navigateur : pas de vérification visuelle, du DOM rendu, des balises `<title>` injectées par route, des JSON-LD réellement injectés, des erreurs console.
- Pas de lecture du code source du repository (mission = état live uniquement) ; les références de lignes renvoient aux captures `raw/`.
- Pas d'appel Supabase avec clé, pas de test RLS, pas de test des Payment Links Stripe.
- Le fichier `.nojekyll` et la configuration « Enforce HTTPS » ne sont pas observables de l'extérieur ; seuls leurs effets le sont (HTTP 200 en clair).
- Les affirmations d'infrastructure (OVH, AES-256, HDS…) n'ont été ni confirmées ni infirmées techniquement au-delà de ce que montrent les en-têtes (`server: GitHub.com`, `via: varnish`, IP GitHub) et le bundle (Supabase).
