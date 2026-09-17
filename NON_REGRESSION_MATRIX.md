# NON_REGRESSION_MATRIX.md — Matrice de non-régression ClairDossier v1

**Phase 0D — PARTIE III.4 de `docs/MASTER_PROMPT.md`** · Établie le 2026-08-23 · Branche `feature/clairdossier-next` (code identique à `main`, commit `24e1e2b` du 2026-07-02).

> **Règle constitutionnelle (MASTER_PROMPT IX.6 et II.7.5) :** après chaque migration, chaque évolution et avant chaque fusion, cette matrice doit repasser à **100 %**. Chaque ligne se termine en **PASS**, **MIGRATED** ou **REPLACED WITH EQUIVALENT**. Le statut **LOST** est interdit. Une seule ligne LOST = la phase n'est pas terminée (XI.2 Inter-Phase Gate).

---

## 0. Sources, périmètre et conventions

### 0.1 Sources (lecture seule)

| Source | Chemin | Usage dans cette matrice |
|---|---|---|
| Constitution | `docs/MASTER_PROMPT.md` (PARTIE I, II.7, III.4, IX.6, XI.2) | Règle 100 % PASS / MIGRATED / REPLACED — jamais LOST ; viewports desktop/tablet/mobile ; tests E2E imposés |
| Audit routes / SEO / build | `scratchpad/baseline/audit/routes-seo.md` (noté **[RS]**) | Routes `src/App.tsx`, `<Seo>` par route, sitemap/robots/llms, pipeline, chunks |
| Audit design | `scratchpad/baseline/audit/design.md` (**[DS]**) | Nav, Footer, Layout, primitives motion, `prefers-reduced-motion`, focus |
| Audit contenu public | `scratchpad/baseline/audit/public-content.md` (**[PC]**) | Sections Home, pages publiques, CTA, données |
| Audit app / auth | `scratchpad/baseline/audit/app-auth.md` (**[AA]**) | Auth, DossierFlow, Account, DossierDetail, localStorage, admin |
| Audit Supabase | `scratchpad/baseline/audit/supabase.md` (**[SB]**) | Tables, policies RLS (texte exact), fonctions, bucket, edge function |
| Audit Stripe / pricing | `scratchpad/baseline/audit/stripe-pricing.md` (**[SP]**) | 7 formules, 12 Payment Links, matrice comparatif, retour `?paid=` |
| Audit site live | `scratchpad/baseline/audit/live-site.md` (**[LS]**) | Codes HTTP réels, en-têtes, redirections, `.md` servis |
| Audit identité / légal | `scratchpad/baseline/audit/identity-legal.md` (**[IL]**) | Pages légales, occurrences nom/téléphone/e-mail (règle I.5) |
| Captures de référence | `docs/baseline/screens/*.jpg` + `docs/baseline/screens/index.json` (**[CAP]**) | 48 captures pleine page du site LIVE du 2026-08-23 (24 routes × 1440 px desktop / 390 px mobile), statut HTTP, URL finale, `title`, H1 |
| Build local | BUILD_INFO du 2026-08-23 (**[BI]**) | node v24.19.0, npm 11.17.0 ; `npm run typecheck` OK ; `npm run build` OK en 941 ms ; tailles de chunks (plafond de performance) |

Chaque ligne cite `fichier:ligne` (chemins relatifs à la racine du dépôt) ou une URL. Lorsqu'un fait n'a pas pu être vérifié, la mention **À VÉRIFIER** apparaît.

### 0.2 Colonnes

| Colonne | Contenu |
|---|---|
| **ID** | `T-nnn`, séquentiel, stable dans le temps (ne jamais renuméroter ; un test retiré garde son ID avec la mention « retiré ») |
| **Fonctionnalité (F-réf.)** | Référence `F-<DOMAINE>-nn` — voir §0.4. Mêmes 14 domaines que `FEATURE_INVENTORY.md` |
| **Pré-conditions** | État requis avant d'exécuter (build, compte, données, viewport) |
| **Étapes** | Actions observables, numérotées |
| **Résultat attendu (observable)** | Ce qui doit être constaté, avec le texte exact quand il est connu. Le symbole ⚠ signale un **comportement baseline connu comme défaut** (référence R-xx / F-xx / S-xx des audits) : la cible peut l'améliorer (AUGMENT/ELEVATE) à condition de ne perdre aucune fonction sous-jacente |
| **Type** | `visuel` · `fonctionnel` · `E2E` · `SEO` · `sécurité` · `perf` · `build` |
| **Automatisable** | `oui — <outil>` (Playwright, curl, tsc, vitest, script Node, Lighthouse, pixelmatch) · `partiel` · `non — manuel` |
| **Viewports** | `1440` (desktop) · `390` (mobile) · `1440 / 390` · `n/a` (HTTP, build) |
| **Statut baseline** | `PASS (prod 2026-08-23)` + preuve · `À EXÉCUTER` (non constaté à ce jour, comportement déduit du code) · `À VÉRIFIER` (dépend d'une configuration non lisible dans le dépôt) |

### 0.3 Règle d'interprétation du statut HTTP en baseline

Le site live est servi par GitHub Pages (`server: GitHub.com`, [LS §4.1]) : **toute route sauf `/` répond HTTP 404** avec le corps de `404.html` (copie de `index.html`, `vite.config.ts:9-17`), puis React rend le contenu côté client ([LS §2], [CAP] `status: 404` sur 23 routes / 24). En baseline, le résultat attendu d'une route est donc **« contenu rendu »** (title + H1 + sections présents), le statut 404 étant noté tel quel. **La cible future est HTTP 200 sur toutes les routes publiques** (risque R1 [RS §6]) ; le passage 404 → 200 sera consigné **MIGRATED**, jamais comme régression.

### 0.4 Table de correspondance F-réf. (provisoire — à aligner avec `FEATURE_INVENTORY.md`)

`FEATURE_INVENTORY.md` (Phase 0B) n'existait pas encore dans le dépôt au moment de la rédaction (`ls` racine : `CLAUDE.md`, `PLAN.md`, `README.md` seulement). Les références ci-dessous sont **provisoires** ; la colonne « F-réf. » devra être réconciliée une fois l'inventaire publié (voir question ouverte Q1).

| Domaine | Préfixe | Fonctionnalités couvertes (numérotation interne à ce document) |
|---|---|---|
| Navigation & layout | `F-NAV` | 01 Logo/accueil · 02 Nav desktop · 03 CTA nav (session) · 04 Header scrollé · 05 Menu mobile · 06 Footer colonnes · 07 Footer barre basse · 08 Skip-link · 09 Scroll/focus à la navigation · 10 Fallback lazy · 11 Ancres `/securite#…` · 12 Typographie/fonts · 13 Focus clavier · 14 Reduced motion |
| Home | `F-HOME` | 01 Hero · 02 Hero card · 03 AvantApres · 04 FeaturesGrid · 05 WorkspacesTabs · 06 Workflow · 07 DossierLifecycle · 08 SecurityBlock · 09 PricingPreview · 10 BlogPreview · 11 FaqBlock · 12 FinalCTA · 13 JSON-LD Home |
| Pages fonctionnalités | `F-FEAT` | 01 Index · 02 Fiche détail ×9 · 03 Slug inconnu · 04 JSON-LD |
| Tarifs & paiement | `F-PRIX` | 01 Grille 7 plans · 02 Toggle mensuel/annuel · 03 Payment Links mensuels · 04 Payment Links annuels · 05 Sur-mesure · 06 Matrice comparatif · 07 Bloc devis · 08 FAQ tarifs · 09 CTA finale · 10 Retour Stripe `?paid=` · 11 JSON-LD · 12 Piliers de confiance |
| Sécurité | `F-SEC` | 01 Page `/securite` en-tête · 02 Architecture 5 nœuds · 03 Piliers `#conformite` · 04 Badges engagements · 05 Droits `#dpa` · 06 Divulgation responsable |
| Journal | `F-BLOG` | 01 Index · 02 Article ×7 · 03 Slug inconnu · 04 Mise en page éditoriale · 05 JSON-LD |
| Contact | `F-CONT` | 01 En-tête + carte WhatsApp · 02 Infos e-mail/siège · 03 Formulaire guidé → WhatsApp · 04 Lien confidentialité · 05 Paramètres d'URL |
| Légal | `F-LEG` | 01 Mentions légales · 02 CGV · 03 Politique de confidentialité · 04 Cookies · 05 Bloc « Documents associés » · 06 Copies markdown |
| Auth | `F-AUTH` | 01 Inscription · 02 Confirmation e-mail · 03 Connexion · 04 Session persistante · 05 Garde de route · 06 Déconnexion · 07 Pages auth en session · 08 Mode non configuré |
| Espace client | `F-APP` | 01 Tunnel étape 1 · 02 Étape 2 · 03 Étape 3 · 04 Étape 4 · 05 Étape 5 · 06 Brouillon localStorage · 07 Finalisation WhatsApp · 08 Finalisation e-mail · 09 Liste dossiers · 10 Détail en-tête/onglets · 11 Vue d'ensemble · 12 Pièces · 13 URLs signées · 14 Échéances · 15 DashBoard · 16 Zip · 17 Dossier introuvable · 18 Statuts · 19 Catégories/sous-catégories · 20 Garanties · 21 Isolation RLS (frontend/REST/storage) |
| Admin global | `F-ADM` | 01 Détection admin · 02 Liste globale · 03 Détail propriétaire · 04 Zip toutes pièces · 05 Livrer · 06 Supprimer livrable · 07 Limites admin · 08 Non-admin |
| Notifications e-mail | `F-NOTIF` | 01 Nouveau compte · 02 Nouveau dossier · 03 Edge function · 04 E-mails Auth |
| SEO & crawlers IA | `F-SEO` | 01 `index.html` statique · 02 `<Seo>` par route · 03 JSON-LD par route · 04 noindex · 05 sitemap · 06 robots · 07 llms.txt · 08 Markdown `.md` · 09 Statuts HTTP · 10 Redirections · 11 En-têtes · 12 404 SPA · 13 Assets statiques |
| Build/Deploy | `F-BUILD` | 01 Install · 02 Typecheck · 03 Build · 04 Arbre propre · 05 Budget bundles · 06 Markdown générés · 07 Variables d'env CI · 08 Dev/preview · 09 Hashes prod · 10 Core Web Vitals · 11 Régression visuelle |

---

## 1. Navigation & layout

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-001 | F-NAV-01 Logo → accueil | Toute page chargée | 1. Cliquer le logo « CD / ClairDossier » dans le header | Navigation vers `/` ; lien porte `aria-label="ClairDossier — accueil"` ; carré navy `#0d1b3d` avec « CD » or, wordmark « ClairDossier », tagline « Dossiers administratifs et juridiques, clairs. » (`src/components/Logo.tsx:5-21`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — logo visible sur les 48 captures [CAP] ; navigation À EXÉCUTER |
| T-002 | F-NAV-02 Navigation desktop | Viewport ≥ 1024 px (`lg`) | 1. Observer le header 2. Cliquer chaque lien 3. Revenir sur la page active | 5 liens dans l'ordre : Fonctionnalités → `/fonctionnalites`, Tarifs → `/tarifs`, Sécurité → `/securite`, Journal → `/blog`, Contact → `/contact` (`src/components/Nav.tsx:7-13`) ; `<nav aria-label="Navigation principale">` (`Nav.tsx:51`) ; lien actif `aria-current="page"` + fond `bg-cream-100` + soulignement or (`Nav.tsx:57-59`, `src/index.css:251-270, 315-319`) | fonctionnel | oui — Playwright | 1440 | PASS (prod 2026-08-23) — 5 liens visibles sur `home__desktop.jpg` [CAP] ; états actifs À EXÉCUTER |
| T-003 | F-NAV-03 CTA header selon session | (a) sans session ; (b) avec session | 1. Charger `/` sans session 2. Se connecter 3. Recharger `/` | (a) « Se connecter » → `/connexion` et « Créer un compte » → `/inscription` (bouton or `sheen`) (`Nav.tsx:86-99`) ; (b) « Mon compte » → `/compte` (navy) et « Créer un dossier » → `/dossier/nouveau` (or) (`Nav.tsx:70-84`) ; ⚠ aucun bouton « Se déconnecter » dans la nav (F13 [AA §7.2]) | fonctionnel | oui — Playwright | 1440 / 390 | (a) PASS (prod 2026-08-23) [CAP `home__desktop.jpg`] ; (b) À EXÉCUTER (compte de test requis) |
| T-004 | F-NAV-04 Header collant et état scrollé | Page longue (`/`) | 1. Défiler de plus de 24 px 2. Revenir en haut | Header `sticky top-0 z-40` ; au-delà de 24 px : `border-b hairline bg-cream-50/92 backdrop-blur-xl` + ombre ; en haut : `border-transparent bg-cream-50/70 backdrop-blur-md` (`Nav.tsx:18-21, 41-46`) | visuel | oui — Playwright (classe/computed style) | 1440 / 390 | À EXÉCUTER |
| T-005 | F-NAV-05 Menu mobile (burger) | Viewport < 1024 px | 1. Cliquer le bouton burger 2. Vérifier ARIA 3. Presser `Escape` 4. Rouvrir, cliquer le backdrop 5. Rouvrir, cliquer un lien | Bouton 44×44 `aria-controls="mobile-menu"`, `aria-expanded` true/false, `aria-label` « Ouvrir le menu » / « Fermer le menu » (`Nav.tsx:103-125`) ; overlay `fixed top-[64px]` + backdrop `bg-navy-900/30` ; `document.body.style.overflow = 'hidden'` quand ouvert (`Nav.tsx:23-28`) ; fermeture sur `Escape` (`:30-38`), sur clic backdrop et sur clic lien (`:150-165`) ; `<nav id="mobile-menu" aria-label="Navigation mobile">` (`:128-149`) | fonctionnel | oui — Playwright | 390 | À EXÉCUTER (captures mobiles prises menu fermé [CAP]) |
| T-006 | F-NAV-05 Contenu du menu mobile | Menu ouvert, (a) sans / (b) avec session | 1. Ouvrir le menu 2. Lire les entrées | 5 mêmes liens que T-002 (`rounded-md px-4 py-3`), lien actif `bg-cream-100` ; CTA pleine largeur : (a) « Se connecter » + « Créer un compte » ; (b) « Mon compte » + « Créer un dossier » (`Nav.tsx:150-202`) | fonctionnel | oui — Playwright | 390 | À EXÉCUTER |
| T-007 | F-NAV-06 Footer — 3 colonnes de liens | Toute page | 1. Défiler jusqu'au footer 2. Cliquer chaque lien | Colonne « Produit » : Fonctionnalités `/fonctionnalites`, Tarifs `/tarifs`, Sécurité `/securite`, Créer un dossier `/dossier/nouveau` ; « Ressources » : Journal `/blog`, Contact & démo `/contact`, Conformité `/securite#conformite`, DPA `/securite#dpa` ; « Légal » : Mentions légales `/mentions-legales`, CGV `/cgv`, Confidentialité `/politique-confidentialite`, Cookies `/cookies` (`src/components/Footer.tsx:4-23, 39-41`) ; titres `h3` mono majuscules (`:72`) ; paragraphe de marque exact « ClairDossier structure vos dossiers administratifs et juridiques — du brouillon à la transmission, avec dépôt de pièces sécurisé, suivi de l'avancement et échéances réunies au même endroit. » (`:30-37`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — footer présent sur toutes les captures pleine page [CAP] ; clics À EXÉCUTER |
| T-008 | F-NAV-07 Footer — barre basse | Toute page | 1. Lire la barre basse | Gauche (mono) : « © 2026 ClairDossier · Édité par Roman Gomes · SIREN 105 490 734 » (`Footer.tsx:45-47`) ; droite : « Hébergeur conforme RGPD · Pièces chiffrées au repos · » + lien « Charte de sécurité » → `/securite` (`:48-56`). **Règle I.5 :** le nom personnel doit être remplacé par « ClairDossier » en zone commerciale → après application, ce test est consigné **REPLACED WITH EQUIVALENT** (le lien « Charte de sécurité » et le SIREN doivent subsister) [IL §1.4] | visuel | oui — Playwright (texte) | 1440 / 390 | PASS (prod 2026-08-23) [CAP] |
| T-009 | F-NAV-08 Skip-link | Toute page, clavier | 1. Charger la page 2. Presser `Tab` une fois 3. Presser `Entrée` | Lien « Aller au contenu principal » (`src/components/Layout.tsx:26`) apparaît en `top: 1rem` au focus (`src/index.css:100-112`) ; `Entrée` déplace le focus sur `<main id="main" tabIndex={-1}>` (`Layout.tsx:28`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-010 | F-NAV-09 Scroll haut + focus à chaque route | Être en bas de `/` | 1. Défiler en bas 2. Cliquer « Tarifs » dans la nav | `window.scrollY === 0` sur `/tarifs` ; `document.activeElement === main#main` (sauf premier rendu) (`Layout.tsx:13-22`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-011 | F-NAV-10 Fallback de chargement des pages lazy | Réseau ralenti (throttling) | 1. Naviguer vers `/tarifs` depuis `/` | Pendant le chargement du chunk : `RouteFallback` « Chargement… » en mono (`src/App.tsx:32-44, 39`) ; puis page rendue sans erreur console | fonctionnel | oui — Playwright (route throttling) | 1440 | À EXÉCUTER |
| T-012 | F-NAV-11 Ancres footer `/securite#conformite` et `#dpa` | Depuis `/` | 1. Cliquer « Conformité » dans le footer 2. Cliquer « DPA » | URL `/securite#conformite` / `/securite#dpa` ; les sections `id="conformite"` (`src/pages/Security.tsx:167`) et `id="dpa"` (`:224`) existent. ⚠ Le défilement vers l'ancre n'a pas été vérifié (D7 [RS §6]) : `Layout` force `scrollTo(0,0)` à chaque changement de `pathname` — consigner le comportement réel observé comme baseline | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-013 | F-NAV-12 Polices et rendu typographique | Toute page | 1. Charger `/` 2. Inspecter `document.fonts` | Cormorant Garamond (400/500/500i/600/700), Inter (300/400/500/600), JetBrains Mono (400/500) chargées via `@fontsource` (`src/index.css:3-13`), `font-display: swap` ; H1/H2 en `font-display`, eyebrows en `font-mono` ; aucune requête vers Google Fonts [LS §5.4] | visuel | oui — Playwright (`document.fonts.check`) | 1440 / 390 | PASS (prod 2026-08-23) — rendu serif/mono visible [CAP], woff2 latin 200 [LS §5.4] |
| T-014 | F-NAV-13 Focus clavier visible et ordre de tabulation | Clavier seul | 1. `Tab` successifs depuis le haut de `/` 2. Observer l'anneau de focus | Ordre : skip-link → logo → 5 liens nav → 2 CTA → contenu ; `:focus-visible` = `outline 2px navy-900` + halo or 4 px (`src/index.css:115-121`) ; aucun piège de focus ; menu mobile refermable au clavier (`Escape`) | fonctionnel | oui — Playwright (`:focus-visible`) | 1440 / 390 | À EXÉCUTER |
| T-015 | F-NAV-14 `prefers-reduced-motion` | Émulation `reduce` | 1. Charger `/` avec `prefers-reduced-motion: reduce` 2. Observer hero, sections, surligneur | `Reveal`/`Stagger`/`SplitWords`/`MarkerHighlight` rendent statique (`src/components/primitives/Reveal.tsx:34,42-44,107,143`, `SplitWords.tsx:27-45`, `MarkerHighlight.tsx:21-24`) ; `.marker-track::before { transform: scaleX(1) }`, animations `premium-*` → `none`, `.sheen::before` masqué (`src/index.css:358-375`) ; carte hero sans flottement ni pulse (`Hero.tsx:130-135, 201-214`) ; ligne Workflow `scaleX` = 1 (`Workflow.tsx:13,49`). ⚠ `Tabs`, `Accordion` et menu mobile restent animés (A6 [DS annexe]) — baseline à conserver ou à améliorer | visuel | oui — Playwright (`emulateMedia`) | 1440 / 390 | À EXÉCUTER |
| T-016 | F-NAV-12 Absence de défilement horizontal | Mobile 390 px | 1. Charger chaque route publique 2. Mesurer `document.documentElement.scrollWidth` | `scrollWidth <= 390` sur toutes les routes (`body { overflow-x: clip }`, `src/index.css:74-80`) | visuel | oui — Playwright | 390 | PASS (prod 2026-08-23) — aucune coupure latérale visible sur les 24 captures mobiles [CAP] ; mesure À EXÉCUTER |

---

## 2. Home (`/`)

Ordre de montage des 11 sections : `Hero`, `AvantApres`, `FeaturesGrid`, `WorkspacesTabs`, `Workflow`, `DossierLifecycle`, `SecurityBlock`, `PricingPreview`, `BlogPreview`, `FaqBlock`, `FinalCTA` (`src/pages/Home.tsx:51-61`) [PC §1.2]. Captures de référence : `home__desktop.jpg` (1440 × 11 541 px), `home__mobile.jpg` (390 × 21 025 px).

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-017 | F-HOME-01 Hero — textes et CTA | `/` chargée | 1. Lire kicker, H1, sous-titre, pills 2. Cliquer chaque CTA | Kicker « Legaltech pour PME · artisans · indépendants » (`src/components/sections/Hero.tsx:44`) ; H1 exact « Votre dossier administratif et juridique, clair, structuré et suivi. » (`:64`) ; sous-titre « Créez des dossiers administratifs et juridiques structurés : déposez vos pièces dans un espace privé, suivez l'avancement et vos échéances, puis transmettez quand vous le décidez. Pour les PME, artisans, entreprises individuelles et professions libérales. » (`:76-79`) ; pills « Suivi étape par étape » · « Pièces chiffrées » · « Conçu pour le RGPD » (`:114-116`) ; CTA « Créer un dossier » → `/dossier/nouveau` (`:88-99`) et « Demander une démo » → `/contact` (`:100-105`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — H1 confirmé [CAP `index.json`] ; clics À EXÉCUTER |
| T-018 | F-HOME-01 Hero — animations d'entrée | `/` chargée, motion non réduite | 1. Charger 2. Observer 1,5 s | H1 par mots (`SplitWords` stagger 0,06 s, durée 0,85 s, `Hero.tsx:48-67`) ; surligneur sky sur « clair, », « structuré », « suivi. » avec délais 0,6 / 0,85 / 1,1 s (`:55-62`, `src/index.css:151-169`) ; kicker/sous-titre/CTA/pills en fondu décalé 0 / 0,5 / 0,7 / 0,9 s (`:38-41, 70-73, 82-85, 108-111`) | visuel | partiel — Playwright (attribut `data-revealed="true"` + captures temporisées) | 1440 / 390 | À EXÉCUTER |
| T-019 | F-HOME-02 Hero card « pièce à conviction » | `/` chargée | 1. Lire l'aside droite (desktop) / sous le hero (mobile) | `aria-label="Aperçu dossier ClairDossier"` (`Hero.tsx:122`) ; badge « Exemple », indicateur « Actif », ligne mono « Aperçu · exemple de dossier · #CD-2026-0421 » (`:151`), H2 « Dossier prud'homal — synthèse » (`:156`), badge « En attente validation » ; `dl` : Statut → « Validation pro (option) », Pièces déposées → « 7 / 9 », Chronologie → « 4 évènements datés », Validation → « Sous 24 h ouvrées » (`:8-11`) ; frise « Avancement » 6 étapes Brouillon · Complété · Attente · Validation (active, pulse or) · Validé · Archivé (`:14-21, 190-231`) ; mobile « Étape 4 / 6 » (`:233-242`) ; flottement 8 s (`:130-135`) | visuel | oui — Playwright (texte) ; animation partiel | 1440 / 390 | PASS (prod 2026-08-23) [CAP `home__desktop.jpg`] |
| T-020 | F-HOME-03 Avant / Après | Défiler jusqu'à la section 2 | 1. Lire les deux cartes | H2 « Le dossier vit dans le désordre. » (`AvantApres.tsx:31`, carte crème) et « Le dossier vit dans l'ordre. » (`:73`, carte navy) ; 5 puces « Avant » (`:4-10`) et 5 puces « Avec » (`:12-18`) au texte exact [PC §1.5] ; connecteur central or desktop (`:54-65`) | visuel | oui — Playwright (texte) | 1440 / 390 | PASS (prod 2026-08-23) [CAP] |
| T-021 | F-HOME-04 Grille des fonctionnalités | Section 3 | 1. Compter les cartes 2. Survoler une carte 3. Cliquer « Voir » | Kicker « Fonctionnalités », H2 « Huit briques pour structurer un dossier juridique. » (`FeaturesGrid.tsx:14-17`) ⚠ le titre dit « Huit » mais **9 cartes** sont rendues (`features.ts`, 9 entrées — écart n°1 [PC §7]) ; chaque carte : icône, `shortTitle`, `blurb`, lien « Voir » → `/fonctionnalites/{slug}` (`:44-50`) ; hover `y: -4` + bordure or (`:31-33`) ; grille `sm:grid-cols-2 lg:grid-cols-4` (`:25`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — 9 cartes visibles [CAP] ; clics À EXÉCUTER |
| T-022 | F-HOME-05 Onglets « Espaces dédiés » | Section 4 (fond navy) | 1. Lire l'onglet par défaut 2. Cliquer « Validation » 3. Cliquer « Entreprise » 4. Revenir sur « Vous » | H2 « Un même dossier, trois lectures différentes. » (`WorkspacesTabs.tsx:23`) ; `role="tablist" aria-label="Espaces dédiés"` (`src/components/ui/Tabs.tsx:24`) ; onglets « Vous » / « Validation » / « Entreprise » (`src/data/workspaces.ts:23,48,73`), défaut `client` (`WorkspacesTabs.tsx:33`) ; `aria-selected`, `aria-controls`, `tabIndex` 0/-1 (`Tabs.tsx:28-40`) ; panneau : H3 `workspace.title`, description, 4 `capabilities`, mockup `dl` (kicker/titre/5 lignes/footnote) [PC §3.3] ; indicateur or `layoutId="tab-active"` (`Tabs.tsx:41-47`). ⚠ pas de navigation par flèches (A5 [DS]) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — onglet « Vous » rendu [CAP] ; bascule À EXÉCUTER |
| T-023 | F-HOME-06 Workflow 6 statuts | Section 5 | 1. Lire la frise (desktop) ou la liste (mobile) 2. Défiler lentement | H2 « Six statuts. Aucun « entre-deux ». » (`Workflow.tsx:28`) ; 6 statuts de `src/data/statuses.ts:11-63` : Brouillon, Complété, Transmis, En cours, Validé, Archivé, libellés « Étape 01 … 06 » ; desktop `grid-cols-6` + ligne or dont `scaleX` suit le scroll (`Workflow.tsx:14-18, 46-50`) ; mobile liste verticale (`:60-79`) | visuel | oui — Playwright (texte) ; scroll-link partiel | 1440 / 390 | PASS (prod 2026-08-23) [CAP] |
| T-024 | F-HOME-07 Cycle de vie du dossier | Section 6 | 1. Lire les 5 cartes, l'encart RH et les 2 encarts | H2 « De la création du dossier au contentieux. » (`DossierLifecycle.tsx:61`) ; 5 étapes « Création du dossier », « Devis, contrat ou accord », « Suivi du dossier », « Facture et paiement », « Option impayé / pré-contentieux » (`:11-37`) ; encart « Documents liés au personnel » avec 10 pastilles Contrat de travail … Autre document RH (`:39-50, 99`) ; encarts « Comptable » (`:117-123`) et « Professionnel du droit » (navy, `:127-133`) | visuel | oui — Playwright (texte) | 1440 / 390 | PASS (prod 2026-08-23) — section vérifiée sur `home__desktop.jpg` (étapes 01-05, 10 pastilles, 2 encarts) [CAP] |
| T-025 | F-HOME-08 Bloc sécurité | Section 7 | 1. Lire les 6 cartes 2. Cliquer « Charte complète » | H2 « La sécurité juridique commence par la sécurité technique. » (`SecurityBlock.tsx:56`) ; 6 cartes : Hébergeur conforme RGPD · Chiffrement en transit et au repos · Vos droits RGPD · Vous gardez la main · Stockage privé des pièces · Isolation par utilisateur (`:13-44`, textes exacts [PC §1.7]) ; CTA « Charte complète » → `/securite` (`:59-65`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — 6 cartes + bouton vérifiés sur `home__desktop.jpg` [CAP] ; clic À EXÉCUTER |
| T-026 | F-HOME-09 Aperçu tarifs | Section 8 | 1. Lire les 3 cartes 2. Vérifier les `href` des 3 « S'abonner » 3. Cliquer « Voir les 7 formules et le détail » | H2 « Une formule par usage. Pas de surprise. » ; paragraphe « Sept formules, de l'indépendant à l'entreprise. Compte gratuit, abonnement sans engagement — et 10 % de réduction en facturation annuelle. » (`PricingPreview.tsx:18-25`) ; 3 cartes `essentiel` (19 €/mois, 5 dossiers · 1 utilisateur · Support email), `business-pme-20` (49 €, badge « Populaire »), `business-pme-pro` (169 €, badge « Recommandé ») (`:7-10`, `src/data/pricing.ts:37-51, 91-105, 145-159`) ; `href` exacts : `https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605`, `https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607`, `https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609` (`pricing.ts:45, 99, 153`) ; lien « Voir les 7 formules et le détail » → `/tarifs` (`:38-44`) | fonctionnel | oui — Playwright (`href` exacts) | 1440 / 390 | PASS (prod 2026-08-23) — 3 cartes et prix visibles [CAP], 12 URLs Stripe présentes dans le bundle prod [LS §6.4] |
| T-027 | F-HOME-10 Aperçu journal | Section 9 | 1. Compter les cartes 2. Cliquer « Tout le journal » 3. Cliquer une carte | H2 « Trois lectures pour comprendre où on se situe. » ⚠ **7 cartes** rendues (tous les `blogPosts`, écart n°2 [PC §7]) ; chaque carte : vignette dégradé, catégorie, date fr-FR + `readMinutes`, titre, résumé, lien « Lire l'article » → `/blog/{slug}` (`BlogPreview.tsx:35-37, 71`) ; « Tout le journal » → `/blog` (`:23-29`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP] ; clics À EXÉCUTER |
| T-028 | F-HOME-11 FAQ | Section 10 | 1. Lire 2. Cliquer la 2e question 3. Cliquer à nouveau la 1re | H2 « Huit questions qui reviennent. » (`FaqBlock.tsx:14`) ; 8 questions de `src/data/faq.ts:8-55` dans l'ordre [PC §3.4] ; `Accordion` : 1re ouverte par défaut, une seule ouverte à la fois, bouton `aria-expanded` + `aria-controls`, icône « + » tournée à 45° si ouvert, panneau `role="region"` (`src/components/ui/Accordion.tsx:11, 19-57`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — 8 questions visibles [CAP] ; interaction À EXÉCUTER |
| T-029 | F-HOME-12 CTA final | Section 11 (navy) | 1. Lire 2. Cliquer les 2 CTA | Kicker « Passez à l'usage », H2 « Prêt à transformer vos dossiers ? », paragraphe exact [PC §1.2 n°11] ; « Créer un dossier » → `/dossier/nouveau` (`FinalCTA.tsx:38-44`), « Réserver une démo » → `/contact` (`:45-50`) ; filets or haut/bas (`:8-15`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP] ; clics À EXÉCUTER |
| T-030 | F-HOME-13 JSON-LD de la Home | `/` après exécution JS | 1. Lire `script[type="application/ld+json"][data-seo-jsonld]` | 4 objets : `Organization` (`src/lib/seo.tsx:85-100`), `WebSite` + `SearchAction` (`:102-113`), `SoftwareApplication` (applicationCategory `LegalService`, Offer `19` EUR, `Home.tsx:15-30`), `FAQPage` 8 questions (`Home.tsx:32-40`) ; JSON valide | SEO | oui — Playwright (parse JSON) | 1440 | À EXÉCUTER (non vérifié en rendu [LS §11]) |
| T-031 | F-HOME Reveals au scroll + fallback | `/` chargée | 1. Défiler progressivement jusqu'au footer 2. Charger sans défiler et attendre 1 s | Chaque section `Reveal`/`Stagger` passe en `opacity: 1` à l'entrée dans le viewport (marge 240 px, une seule fois, `Reveal.tsx:14`) ; sans intersection, forçage après 900 ms (`FALLBACK_MS`, `Reveal.tsx:9,37-40`) → aucun contenu reste invisible | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — captures prises avec défilement progressif, toutes sections visibles [CAP] |

---

## 3. Pages fonctionnalités (`/fonctionnalites`, `/fonctionnalites/:slug`)

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-032 | F-FEAT-01 Index des fonctionnalités | Charger `/fonctionnalites` | 1. Lire H1, sous-titre 2. Compter les cartes 3. Cliquer les 2 CTA du bas | Title « Fonctionnalités — ClairDossier · Dossier juridique clair, structuré et suivi » ; H1 « Neuf briques, un dossier administratif et juridique propre. » (`src/pages/FeaturesIndex.tsx:40`) ; 9 cartes-liens (icône, H2 = `title`, `blurb`, « Lire la fiche ») → `/fonctionnalites/{slug}` (`:53-88`) ; section navy H2 « Plutôt voir en pratique ? » ; CTA « Demander une démo » → `/contact` (`:104-110`), « Créer un dossier maintenant » → `/dossier/nouveau` (`:111-116`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — title/H1 [CAP `index.json`], rendu [CAP `fonctionnalites__*.jpg`] ; clics À EXÉCUTER |
| T-033 | F-FEAT-02 Fiche détail (×9 slugs) | Charger chacun des 9 slugs `creation-guidee`, `pieces-ocr`, `chronologie`, `validation-avocat`, `suivi-statuts`, `messagerie-securisee`, `coffre-fort`, `calendrier-relances`, `reponse-auto-mails` (`src/data/features.ts:16-183`) | 1. Lire fil d'ariane, kicker, H1, accroche, corps, aside 2. Cliquer « Essayer maintenant » 3. Cliquer « Toutes les fonctionnalités » et une carte liée | Fil d'ariane Accueil › Fonctionnalités › `shortTitle` (`FeatureDetail.tsx:41-49`) ; kicker « Fonctionnalité · {shortTitle} » ; H1 = `feature.title` (`:61-63`) ; accroche italique `feature.hero` ; un `<p>` par `body[]` ; aside « Concrètement » = 4 `bullets` + CTA « Essayer maintenant » → `/dossier/nouveau` (`:79-98`) ; section « Autres briques utiles. » = 3 cartes (⚠ toujours les 3 premières hors courante, écart n°12 [PC §7]) + « Toutes les fonctionnalités » → `/fonctionnalites` (`:103-134`). Titles/H1 des 9 pages = colonne `title` de `features.ts` [CAP `index.json`] | fonctionnel | oui — Playwright (boucle sur 9 slugs) | 1440 / 390 | PASS (prod 2026-08-23) — 9 × 2 captures, title/H1 confirmés [CAP] ; clics À EXÉCUTER |
| T-034 | F-FEAT-03 Slug inconnu | — | 1. Charger `/fonctionnalites/inexistant` | Rendu de `NotFound` (H1 « Cette page n'existe pas. ») **sans changement d'URL** (`FeatureDetail.tsx:10-12`) ; `<Seo noindex>` | fonctionnel | oui — Playwright | 1440 | À EXÉCUTER |
| T-035 | F-FEAT-04 JSON-LD | Index et détail | 1. Parser les scripts JSON-LD | Index : `BreadcrumbList` (Accueil › Fonctionnalités) + 9 × `Service` (`FeaturesIndex.tsx:7-14, 23-29`) ; détail : `BreadcrumbList` 3 niveaux + `Service` (`FeatureDetail.tsx:19-38`) | SEO | oui — Playwright | 1440 | À EXÉCUTER |

---

## 4. Tarifs & paiement (`/tarifs`)

Source unique : `src/data/pricing.ts:35-225` (7 plans) [SP §1]. **Aucun achat réel ne doit être effectué pendant les tests** (II.5 : transaction financière = confirmation humaine) ; les tests Stripe se limitent à la vérification des `href` et à un `HEAD` sur les Payment Links.

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-036 | F-PRIX-01 Grille des 7 formules (mensuel) | Charger `/tarifs` | 1. Lire H1/sous-titre 2. Lire les 7 cartes dans l'ordre | H1 « Une formule par usage. Pas de surprise. » (`src/pages/Pricing.tsx:133-135`) ; sous-titre « De l'indépendant à l'entreprise — sept niveaux de service couvrent tous les usages. Compte gratuit, abonnement sans engagement. » (`:136-139`) ; 7 cartes (grille `lg:grid-cols-2`, `:194-199`) : Essentiel 19 € · Entrepreneur 39 € · Business PME 20 49 € (badge « Populaire », dark) · Business PME 50 89 € · Business / PME Pro 169 € (badge « Recommandé », dark) · Business / PME Premium 299 € · Business / PME personnalisée « Sur devis » (dark) ; specs dossiers/utilisateurs/support par plan [SP §1.3] | visuel | oui — Playwright (texte) | 1440 / 390 | PASS (prod 2026-08-23) — `tarifs__desktop.jpg` (169 €, 299 €, Sur devis, specs, CTA vérifiés) [CAP] |
| T-037 | F-PRIX-02 Toggle Mensuel / Annuel | `/tarifs` | 1. Lire l'état initial 2. Cliquer « Annuel » 3. Lire les prix 4. Cliquer « Mensuel » | Groupe `role="group" aria-label="Période de facturation"` (`Pricing.tsx:142-145`) ; 2 boutons `aria-pressed` (`:150, 167`), badge « −10 % » sur Annuel (`:180-183`) ; état initial mensuel ; en annuel, équivalents mensuels 17,10 / 35,10 / 44,10 / 80,10 / 152,10 / 269,10 € et totaux 205,20 / 421,20 / 529,20 / 961,20 / 1 825,20 / 3 229,20 € (`pricing.ts:246-256`) ; « Sur devis » inchangé | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) pour l'état mensuel [CAP] ; bascule À EXÉCUTER |
| T-038 | F-PRIX-03 Payment Links mensuels (6) | `/tarifs`, toggle Mensuel | 1. Lire `href` des 6 boutons « S'abonner » | `essentiel` → `https://buy.stripe.com/00w9AT9Qm7fJ4vbeSibV605` ; `entrepreneur` → `https://buy.stripe.com/8x214n1jQ2Zt9Pvh0qbV606` ; `business-pme-20` → `https://buy.stripe.com/5kQaEX7IeeIb4vb11sbV607` ; `business-pme-50` → `https://buy.stripe.com/28E4gz8Mi9nRaTz25wbV608` ; `business-pme-pro` → `https://buy.stripe.com/5kQbJ1e6C7fJ6DjdOebV609` ; `business-pme-premium` → `https://buy.stripe.com/9B628raUq8jNgdT8tUbV60a` (`pricing.ts:45, 72, 99, 127, 153, 181` ; sélection `Pricing.tsx:543`) ; rendu `<a href>` même onglet, sans `target`/`rel` [SP §2.2] | fonctionnel | oui — Playwright (`href`) | 1440 | PASS (prod 2026-08-23) — les 12 URLs sont dans `Pricing-*.js` prod [LS §6.4] ; association plan→lien À EXÉCUTER |
| T-039 | F-PRIX-04 Payment Links annuels (6) | `/tarifs`, toggle Annuel | 1. Lire `href` des 6 boutons | `essentiel` → `https://buy.stripe.com/dRm9ATbYu6bF9PvfWmbV60b` ; `entrepreneur` → `https://buy.stripe.com/28EeVd9QmgQj7HndOebV60c` ; `business-pme-20` → `https://buy.stripe.com/14AbJ18MicA3e5L11sbV60d` ; `business-pme-50` → `https://buy.stripe.com/6oU00j5A69nR3r7bG6bV60e` ; `business-pme-pro` → `https://buy.stripe.com/cNifZh9Qm8jNe5L39AbV60f` ; `business-pme-premium` → `https://buy.stripe.com/28EeVdaUq7fJd1H11sbV60g` (`pricing.ts:46, 73, 100, 128, 154, 182`) | fonctionnel | oui — Playwright | 1440 | À EXÉCUTER |
| T-040 | F-PRIX-03/04 Disponibilité des 12 Payment Links | Réseau | 1. `curl -sI` sur chacune des 12 URLs | HTTP 200 (ou 30x vers `checkout.stripe.com`) pour les 12 liens ; aucun 404 « This payment link is no longer active ». ⚠ mode LIVE/TEST et activité des liens annuels **à confirmer dans le dashboard Stripe** [SP §5] | E2E | oui — curl | n/a | À VÉRIFIER |
| T-041 | F-PRIX-05 Plan sur-mesure | `/tarifs` | 1. Cliquer « Demander un devis » de la 7e carte | Navigation vers `/contact?plan=sur-mesure` (`pricing.ts:208`) ; ⚠ paramètre ignoré par `Contact.tsx` (B9 [SP §6.1]) — le formulaire s'ouvre sur « Démo produit » | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) pour le bouton [CAP] ; navigation À EXÉCUTER |
| T-042 | F-PRIX-06 Matrice comparatif 8 × 7 | `/tarifs` | 1. Lire les 8 lignes de chaque carte | Libellés et ordre : Transmission par e-mail ou WhatsApp · Échéances affichées sur le dossier · Récapitulatif du dossier · Suivi par étapes métier · Dépôt de pièces sécurisé · Espace privé multi-dossiers · Pièces téléchargeables · Plusieurs dossiers en parallèle (`pricing.ts:24-33`) ; statuts ✓ / « (limité) » / ✗ conformes à la table [SP §1.4] (ex. Essentiel : ✓, limité, limité, ✗, ✗, ✗, ✗, ✗ ; Pro/Premium/Sur-mesure : 8 ✓) ; rendu `FeatureRow` (`Pricing.tsx:552-591`) | visuel | oui — Playwright (texte + classes) | 1440 / 390 | PASS (prod 2026-08-23) — Pro/Premium/Sur-mesure 8 ✓ vérifiés sur `tarifs__desktop.jpg` [CAP] ; autres plans À EXÉCUTER |
| T-043 | F-PRIX-07 Bloc « Devis sur-mesure » | `/tarifs` | 1. Lire les 4 capacités 2. Vérifier les 3 contacts | 4 capacités : Marque blanche complète ; API et webhooks dédiés ; SSO et audit renforcé ; Onboarding sur site (`Pricing.tsx:30-47, 228-262`) ; contact WhatsApp `https://wa.me/33782983644?text=…` + numéro affiché `+33 7 82 98 36 44` (`:276-291`, `src/lib/whatsapp.ts:5-6`) ; `mailto:contact.clairdossier@icloud.com?subject=Demande%20de%20devis%20sur-mesure&body=…` (`:304`) ; lien `/contact?topic=commercial` (`:340`) ; promesse « proposition chiffrée écrite sous 48 h ouvrées » (`:377-380`). **Règle I.5 :** téléphone → « Service Assistance ClairDossier — 04 91 95 90 32 » ; après application → **REPLACED WITH EQUIVALENT** (un canal de contact téléphonique + e-mail doivent subsister) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP] |
| T-044 | F-PRIX-08 FAQ tarifs | `/tarifs` | 1. Ouvrir chacune des 5 questions | 5 entrées `Accordion` : engagement, changement de plan, TVA, « Faut-il payer pour créer un compte ? », annuel (`Pricing.tsx:49-80`) ; comportement identique à T-028 | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-045 | F-PRIX-09 CTA finale | `/tarifs` | 1. Cliquer les 2 CTA | « Demander un devis » → `/contact` ; « Créer un compte gratuit » → `/inscription` (`Pricing.tsx:420-432`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-046 | F-PRIX-10 Retour Stripe `?paid=` | Compte de test connecté (aucun paiement réel) | 1. Charger `/compte?paid=business-pme-20` 2. Charger `/compte?paid=x` 3. Déconnecté : charger `/compte?paid=essentiel` | (1)(2) bandeau « Abonnement confirmé » + « Merci — votre paiement a bien été pris en compte. Votre abonnement est actif. » (`src/pages/Account.tsx:31, 89-98`) ⚠ aucune vérification (S2/B5) ; (3) redirection `/connexion?next=%2Fcompte%3Fpaid%3Dessentiel` puis, après login, retour sur `/compte?paid=…` avec bandeau (`RequireAuth.tsx:25-27`, `Login.tsx:11, 28`) | E2E | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-047 | F-PRIX-11 JSON-LD tarifs | `/tarifs` | 1. Parser JSON-LD | `BreadcrumbList` + `SoftwareApplication` (applicationCategory `BusinessApplication`, `AggregateOffer` lowPrice 19 / highPrice 299 EUR, `offerCount` = 6) (`Pricing.tsx:104-122`) | SEO | oui — Playwright | 1440 | À EXÉCUTER |
| T-048 | F-PRIX-12 Piliers de confiance | `/tarifs` | 1. Lire le bandeau crème | 3 piliers « Données protégées », « Vous gardez la main », « Sans engagement » (`pricing.ts:227-243`) | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — vérifié sur `tarifs__desktop.jpg` [CAP] |

---

## 5. Sécurité (`/securite`)

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-049 | F-SEC-01 En-tête | Charger `/securite` | 1. Lire title, kicker, H1, sous-titre | Title « Sécurité & conformité — ClairDossier · … » ; H1 « La sécurité administrative et juridique commence par la sécurité technique. » (`src/pages/Security.tsx:97-100`) ; sous-titre exact [PC §2.3] | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP `securite__*.jpg`, `index.json`] |
| T-050 | F-SEC-02 Architecture simplifiée | `/securite` | 1. Lire les 5 nœuds | H2 « Du navigateur jusqu'à vos sauvegardes. » ; nœuds 1 « Client · Navigateur · App », 2 « HTTPS · Connexion chiffrée », 3 « Authentification · Compte confirmé », 4 « Application · Isolation par utilisateur », 5 « Stockage privé · Pièces chiffrées au repos » (`Security.tsx:112-164`) | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP] |
| T-051 | F-SEC-03 Six piliers `#conformite` | `/securite` | 1. Lire la section `id="conformite"` | Piliers Hébergement · Chiffrement · Accès · Conformité · Vos pièces · Maîtrise & contact, chacun corps + 3 puces (`Security.tsx:14-75, 167-192`) ; aucune mention OVH/AES/HDS dans la page React (cohérent avec [LS §6.5]) | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP] |
| T-052 | F-SEC-04 Badges « Nos engagements en clair » | `/securite` | 1. Lire les 4 badges | RGPD / Conçu pour · Chiffrement / Transit & repos · Isolation / Par utilisateur · Vos droits / Sur demande (`Security.tsx:195-221`) | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP] |
| T-053 | F-SEC-05 Vos droits `#dpa` | `/securite` | 1. Lire le tableau 2. Cliquer « Exercer un droit » | H2 « Vos données restent les vôtres. » ; 6 lignes Accès / Export / Suppression / Rectification (« Sur demande »), Création de compte (« Gratuite, confirmée par e-mail », « Inclus »), Stockage privé des pièces (« Inclus ») (`Security.tsx:224-287`) ; CTA « Exercer un droit » → `/contact` (`:289-295`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP] ; clic À EXÉCUTER |
| T-054 | F-SEC-06 Divulgation responsable | `/securite` | 1. Lire la section navy 2. Vérifier le `mailto:` | H2 « Trouvé une faille ? Écrivez-nous. » ; bouton `contact.clairdossier@icloud.com` → `mailto:contact.clairdossier@icloud.com` (`Security.tsx:301-320`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP] |

---

## 6. Journal (`/blog`, `/blog/:slug`)

7 articles (`src/data/blog/index.ts:11-19`), ordre d'affichage : `preparer-rendez-vous-avocat`, `chronologie-prud-homale`, `mise-en-demeure`, `conservation-documents`, `mediation-contentieux`, `rgpd-legaltech`, `ia-droit` (⚠ non strictement décroissant par date, écart n°7 [PC §7] — ordre baseline à conserver ou à corriger en MIGRATED).

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-055 | F-BLOG-01 Index du journal | Charger `/blog` | 1. Lire H1, sous-titre 2. Compter et ordonner les cartes 3. Cliquer « Lire » | Title « Journal — ClairDossier · … » ; H1 « Le droit administratif et juridique, expliqué calmement. » (`src/pages/BlogIndex.tsx:49`) ; 7 cartes dans l'ordre ci-dessus ; chaque carte : vignette dégradé, `category`, date fr-FR + « N min », H2 titre, `summary`, avatar « CD » + « Rédaction ClairDossier », lien « Lire » → `/blog/{slug}` (`:63-125`) | fonctionnel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP `blog__*.jpg`, `index.json`] ; clics À EXÉCUTER |
| T-056 | F-BLOG-02 Article (×7 slugs) | Charger chacun des 7 slugs | 1. Lire fil d'ariane, kicker, H1, chapô, auteur 2. Parcourir le corps 3. Lire « À retenir », « Questions liées », « Continuer la lecture. » 4. Cliquer une carte liée | Fil d'ariane Accueil › Journal › titre (`BlogPost.tsx:97-105`) ; kicker « {category} · {readMinutes} min de lecture » ; H1 = `post.title` ; chapô italique = `summary` ; bloc auteur (initiales, nom, rôle, date) ; blocs `p/h2/h3/quote/list/callout` (`:236-297`) ; aside « À retenir » = `takeaways` ; « Questions liées » = `faq` (les 7 articles en ont) ; « Continuer la lecture. » = `relatedSlugs` (2-3 cartes, lien « Lire ») (`:199-231`). Title = `metaTitle` + suffixe (ex. « Mise en demeure — guide pratique et erreurs à éviter — ClairDossier · Dossier juridique clair, structuré et suivi ») [CAP] | fonctionnel | oui — Playwright (boucle 7 slugs) | 1440 / 390 | PASS (prod 2026-08-23) pour `mise-en-demeure` [CAP `blog__mise-en-demeure__*.jpg`] ; 6 autres slugs À EXÉCUTER (non capturés, contenu `.md` servi 200 [LS §3]) |
| T-057 | F-BLOG-03 Slug inconnu | — | 1. Charger `/blog/inexistant` | `NotFound` rendu sans changement d'URL (`BlogPost.tsx:15-17`) | fonctionnel | oui — Playwright | 1440 | À EXÉCUTER |
| T-058 | F-BLOG-04 Mise en page éditoriale | Article ≥ 1024 px et < 640 px | 1. Observer la 1re lettre du corps 2. Observer une citation | Drop cap Cormorant 4,2 em sur `.drop-cap > p:first-of-type::first-letter` (`src/index.css:337-345`), désactivée sous 640 px (`:348-355`) ; citations `figure` filet or gauche, `blockquote.font-display italic` (`BlogPost.tsx:252-264`) ; image hero = dégradé navy/or sans image raster (`:135-153`) | visuel | partiel — Playwright (computed style) + pixelmatch | 1440 / 390 | PASS (prod 2026-08-23) [CAP `blog__mise-en-demeure__desktop.jpg`] |
| T-059 | F-BLOG-05 JSON-LD + og:type | Index et article | 1. Parser JSON-LD 2. Lire `og:type` | Index : `BreadcrumbList` + `Blog` (7 `BlogPosting`, author `Person` « Rédaction ClairDossier ») (`BlogIndex.tsx:19-38`) ; article : `BreadcrumbList` 3 niveaux + `BlogPosting` (author `Organization`, publisher ClairDossier, `wordCount`, `timeRequired`, `keywords`) + `FAQPage` (`BlogPost.tsx:33-94`) ; `og:type` = `article` sur `/blog/:slug` (`seo.tsx:48-54`) ; ⚠ incohérence Person/Organization (R13 [RS §6]) — harmonisation autorisée | SEO | oui — Playwright | 1440 | À EXÉCUTER |

---

## 7. Contact (`/contact`)

Le formulaire ne fait **aucun appel réseau** : il compose un message et ouvre WhatsApp (`src/pages/Contact.tsx:19-38`, `src/lib/whatsapp.ts:12-20`) [PC §2.4]. **Règle I.5 :** le numéro `+33 7 82 98 36 44` / `33782983644` doit être remplacé par « Service Assistance ClairDossier — 04 91 95 90 32 » ; après application, les tests T-060 à T-062 sont consignés **REPLACED WITH EQUIVALENT** à condition qu'un canal de contact direct (téléphone ou WhatsApp Business) et le formulaire guidé subsistent [IL §5.2].

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-060 | F-CONT-01 En-tête et carte WhatsApp | Charger `/contact` | 1. Lire H1/sous-titre 2. Lire la carte 3. Vérifier `href` et `target` | H1 « Une réponse sur WhatsApp, dans l'heure. » (`Contact.tsx:61`) ; carte : kicker « WhatsApp », numéro `+33 7 82 98 36 44` (`:83`), « Réponse en moyenne sous 1 h en journée (9 h – 19 h, lundi-vendredi). », libellé « Ouvrir une conversation » ; `href="https://wa.me/33782983644?text=Bonjour%20ClairDossier%2C%20j'aimerais%20vous%20poser%20une%20question."`, `target="_blank"` (`:69-93`, `whatsapp.ts:8-10`) | fonctionnel | oui — Playwright (`href`) | 1440 / 390 | PASS (prod 2026-08-23) [CAP `contact__*.jpg`, `index.json`] |
| T-061 | F-CONT-02 Infos e-mail et siège | `/contact` | 1. Lire les 2 `ContactInfo` | Email `contact.clairdossier@icloud.com` → `mailto:contact.clairdossier@icloud.com`, détail « Demandes générales, devis, et divulgation responsable de vulnérabilités — réponse sous 24 h ouvrées » (`:96-101`) ; Siège « Château-Gombert, 13013 Marseille » sans lien (`:102-106`) (⚠ adresse en zone commerciale — ARB [IL §5.5]) | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP] |
| T-062 | F-CONT-03 Formulaire guidé → WhatsApp | `/contact`, intercepter `window.open` | 1. Cliquer « Question commerciale » 2. Remplir Nom « Test A », Email `a@example.com`, Structure « SARL Test », Message « Bonjour » 3. Cocher le consentement 4. Cliquer « Continuer sur WhatsApp » | 4 boutons `type=button` Démo produit / Question commerciale / Support technique / Presse & contenu, défaut `demo` (`:9-14, 17, 126-146`) ; champs `name` (requis), `email` (requis), `organization`, `message` (textarea, requis), case consentement avec lien « politique de confidentialité » ; `<form noValidate>` (`:124`) ; à la soumission `window.open("https://wa.me/33782983644?text=<encodé>", "_blank", "noopener,noreferrer")` avec texte « Bonjour ClairDossier,\n\nNature de la demande : Question commerciale\nNom : Test A\nEmail : a@example.com\nStructure : SARL Test\n\nBonjour » (`:19-38`, `whatsapp.ts:12-20`) ; repli `location.href` si popup bloqué ; **aucune requête réseau** vers Supabase. ⚠ aucune validation JS des champs requis ni de la case (écart n°8 [PC §7]) | E2E | oui — Playwright (stub `window.open`) | 1440 / 390 | PASS (prod 2026-08-23) pour le rendu [CAP] ; soumission À EXÉCUTER |
| T-063 | F-CONT-04 Lien vers la politique de confidentialité | `/contact` | 1. Cliquer le lien dans le libellé de consentement | `<a href="/politique-confidentialite">` (ancre HTML → rechargement complet, `:173-175`) ; page Politique de confidentialité rendue | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-064 | F-CONT-05 Paramètres d'URL ignorés | — | 1. Charger `/contact?topic=commercial` 2. Charger `/contact?plan=sur-mesure` | ⚠ Dans les deux cas le sujet sélectionné reste « Démo produit » (`Contact.tsx:1-17` : pas de `useSearchParams`) (D7 [RS], B9 [SP]). Une prise en compte future des paramètres = AUGMENT, à consigner MIGRATED | fonctionnel | oui — Playwright | 1440 | À EXÉCUTER |

---

## 8. Légal (4 pages)

Source unique `src/data/legal.ts` ; rendu `src/pages/LegalPage.tsx` ; `lastUpdate: "2026-05-26"` sur les 4 pages (`legal.ts:26, 126, 252, 392`) [IL §4]. **Règle I.5 :** dans ces pages, les identités imposées par la loi (éditeur `legal.ts:36`, directeur de publication `:62`, cocontractant CGV `:136`, responsable du traitement `:262`) sont **conservées** ; seuls le téléphone (`:48`) et, à arbitrer, le crédit développeur (`:52`) changent [IL §7].

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-065 | F-LEG-01 Mentions légales | Charger `/mentions-legales` | 1. Lire H1 et rubriques 2. Vérifier les mentions obligatoires | Title « Mentions légales — ClairDossier · … », H1 « Mentions légales » [CAP] ; rubriques Éditeur (Roman Gomes, EI, SIREN 105 490 734, SIRET 105 490 734 00016, Château-Gombert 13013 Marseille, APE 4791A, TVA 293 B), Contact (e-mail + téléphone), Réalisation, Directeur de la publication, Hébergement (GitHub Pages, GitHub Inc., 88 Colin P Kelly Jr St, San Francisco), Propriété intellectuelle, Responsabilité (`legal.ts:36-114`) ; date « 26 mai 2026 » | visuel | oui — Playwright (texte) | 1440 / 390 | PASS (prod 2026-08-23) [CAP `mentions-legales__*.jpg`, `index.json`] |
| T-066 | F-LEG-02 CGV | Charger `/cgv` | 1. Lire H1 2. Compter les articles | Title « Conditions générales de vente — ClairDossier · … », H1 « Conditions générales de vente » [CAP] ; 9 articles (objet, souscription, tarifs HT/TVA 20 %, facturation Stripe, résiliation, SLA, traitement « aucune lecture/extraction automatique », données/DPA, responsabilité 12 mois, droit français/tribunaux de Paris) (`legal.ts:136-240`) ⚠ contradictions TVA (vs `:44`) et facturation mensuelle (vs annuel vendu) — B4 [SP], §5.4 [IL] — corrections juridiques autorisées (MIGRATED) | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP `cgv__*.jpg`] |
| T-067 | F-LEG-03 Politique de confidentialité | Charger `/politique-confidentialite` | 1. Lire H1 et rubriques | H1 « Politique de confidentialité » [CAP] ; responsable du traitement (`legal.ts:262`), données collectées (`:277-280`), finalités, bases légales 6.1.b/f/a (`:307`), destinataires (hébergeur non nommé, Stripe Payments Europe Ltd.), durées (12 mois / 10 ans / 12 mois, `:341-344`), droits + CNIL (`:360-370`), sécurité (`:380`) | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP `politique-confidentialite__*.jpg`] |
| T-068 | F-LEG-04 Cookies | Charger `/cookies` | 1. Lire H1 et rubriques | H1 « Cookies » [CAP] ; cookies strictement nécessaires (session, préférence 1 an, CSRF), Stripe lors du paiement, aucun analytics, instructions Chrome/Firefox/Safari/Edge (`legal.ts:394-452`) ; **aucun bandeau cookies** dans l'application (grep `consent|cookie` → `legal.ts` uniquement [AA §4.5]) | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP `cookies__*.jpg`] |
| T-069 | F-LEG-05 Bloc « Documents associés » | Toute page légale | 1. Lire le bloc de fin 2. Vérifier le `mailto:` | Liens vers les 3 autres pages légales + `mailto:contact.clairdossier@icloud.com` (`LegalPage.tsx:134-137`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-070 | F-LEG-06 Copies markdown des pages légales | Après `npm run gen:md` | 1. Comparer `public/{mentions-legales,cgv,politique-confidentialite,cookies}.md` au contenu de `legal.ts` | Front-matter `title/description/url/lastUpdate` (`scripts/gen-markdown.ts:476-481`), corps identique aux sections de `legal.ts`, pied commun `footer()` (`gen-markdown.ts:40-49`) ; servis en 200 `text/markdown` [LS §3] | build | oui — vitest (snapshot) ou `diff` | n/a | PASS (prod 2026-08-23) — 4 `.md` en 200 [LS §3] |

---

## 9. Auth (`/inscription`, `/connexion`, session)

Pré-requis communs : build avec `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (sinon voir T-080) ; **deux comptes de test dédiés A et B** (e-mails de test, jamais de données client réelles) ; accès à la boîte mail de test pour la confirmation. Aucune commande destructive sur Supabase (II.3.3).

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-071 | F-AUTH-01 Page d'inscription — rendu | Charger `/inscription` sans session | 1. Lire H1, texte, champs | Title « Créer un compte — ClairDossier · … », H1 « Créer un compte » [CAP] ; texte « Gratuit. Vous pourrez créer vos dossiers immédiatement — un abonnement n'est nécessaire que pour aller plus loin. » (`src/pages/Signup.tsx:67-70`) ; champs : `companyType` select (pme / artisan / entreprise-individuelle / profession-liberale / particulier / autre, défaut `pme`, `:7-14, 79-89`), `companyName` (optionnel), `fullName`, `email` (requis), `password` (requis, `minLength=8`) (`:91-125`) ; `<form noValidate>` (`:75`) ; `robots: noindex, follow` (`:57`) ; ⚠ aucune case CGV (F-AUTH [AA §2.3]) | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP `inscription__*.jpg`, `index.json`] |
| T-072 | F-AUTH-01 Validation mot de passe court | `/inscription` | 1. Saisir un e-mail valide et un mot de passe de 5 caractères 2. Soumettre | Message « Mot de passe trop court (8 caractères minimum). » (`Signup.tsx:33-36`) ; aucun appel `signUp` | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-073 | F-AUTH-01 Inscription réussie | `/inscription`, e-mail de test neuf | 1. Remplir companyType `artisan`, companyName « Test Co », fullName « Test A », email, mot de passe ≥ 8 2. Soumettre | `supabase.auth.signUp` avec `options.data = { full_name, company_name, company_type }` (`src/lib/auth.tsx:77-87`) ; ligne `public.profiles` créée par le trigger `on_auth_user_created` → `handle_new_user()` avec ces 3 champs (`supabase/migrations/20260615201942_clair_dossier_init.sql:83-100`) ; `navigate(next || '/compte', { replace: true })` (`Signup.tsx:20, 48`) | E2E | oui — Playwright + requête REST de vérification | 1440 / 390 | À EXÉCUTER |
| T-074 | F-AUTH-02 Confirmation e-mail | Inscription T-073 avec confirmation activée côté projet | 1. Après soumission, observer l'URL 2. Ouvrir la boîte de test 3. Cliquer le lien 4. Revenir sur le site | Si `enable_confirmations = true` (`supabase/config.toml:205` — **réglage prod À VÉRIFIER** [SB §1.3]) : `data.session` null → l'app navigue vers `/compte` puis `RequireAuth` renvoie vers `/connexion?next=%2Fcompte` ⚠ sans message (F1 [AA §7.2]) ; e-mail reçu de « ClairDossier <noreply@clair-dossier.com> » via SMTP Resend (`config.toml:215-223`) ; lien de confirmation → redirection vers `site_url` `https://www.clair-dossier.com` (`config.toml:150-152`), session détectée (`detectSessionInUrl: true`, `src/lib/supabase.ts:21`) | E2E | partiel — Playwright + lecture manuelle de la boîte mail | 1440 | À VÉRIFIER |
| T-075 | F-AUTH-02 Connexion avant confirmation | Compte non confirmé | 1. Tenter de se connecter | Message « Email non confirmé. Vérifiez votre boîte mail. » (`auth.tsx:47`) dans `<p role="alert">` (`Login.tsx:65-69`) | fonctionnel | oui — Playwright | 1440 | À VÉRIFIER (dépend de T-074) |
| T-076 | F-AUTH-03 Page de connexion — rendu | Charger `/connexion` | 1. Lire H1, champs, liens | Title « Connexion — ClairDossier · … », H1 « Se connecter » [CAP] ; champs `email` (`autoComplete="email"`), `password` (`autoComplete="current-password"`) (`Login.tsx:51-63`) ; lien vers `/inscription` conservant `?next=` si ≠ `/compte` (`:81-89`) ; ⚠ pas de lien « mot de passe oublié » (inexistant, [AA §2.7]) ; `noindex` (`:40`) | visuel | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP `connexion__*.jpg`] |
| T-077 | F-AUTH-03 Connexion — erreur | `/connexion` | 1. Saisir un mot de passe faux 2. Soumettre | Message traduit via `translateError` (`auth.tsx:39-49`, ex. « Email ou mot de passe incorrect. » pour `Invalid login credentials` — libellé exact À VÉRIFIER à l'exécution) dans `role="alert"` ; bouton désactivé pendant `loading` (`Login.tsx:71-78`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-078 | F-AUTH-03 Connexion réussie + `next` | Compte A confirmé | 1. Charger `/connexion?next=%2Fdossier%2Fnouveau` 2. Se connecter 3. Sans `next`, se connecter | `signInWithPassword` (`auth.tsx:95`) ; `navigate(next, { replace: true })` → `/dossier/nouveau` ; sans `next` → `/compte` (`Login.tsx:11, 28`) ; nav passe en mode connecté (T-003 b) | E2E | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-079 | F-AUTH-04 Session persistante | Connecté | 1. Recharger la page 2. Ouvrir un second onglet 3. Attendre > 1 h (ou forcer le refresh) | `localStorage["clairdossier-auth"]` présent (`storageKey`, `supabase.ts:22`) ; `getSession()` restaure la session au montage (`auth.tsx:55-65`) ; synchronisation inter-onglets via `BroadcastChannel` ; `autoRefreshToken: true` (`supabase.ts:20`) — session toujours valide après expiration du JWT (3600 s, `config.toml:154`) | E2E | oui — Playwright (`localStorage`, horloge) | 1440 | À EXÉCUTER |
| T-080 | F-AUTH-05 Garde de route `RequireAuth` | Sans session, build configuré | 1. Charger `/dossier/nouveau` 2. Charger `/compte` 3. Charger `/compte/dossier/00000000-0000-0000-0000-000000000000` | Redirection `replace` vers `/connexion?next=<pathname+search encodé>` (`src/components/RequireAuth.tsx:25-27`) : `/connexion?next=%2Fdossier%2Fnouveau`, `/connexion?next=%2Fcompte`, `/connexion?next=%2Fcompte%2Fdossier%2F0000…` ; pendant `loading` : « Chargement… » `role="status"` (`:10-22`) | sécurité | oui — Playwright | 1440 / 390 | PASS (prod 2026-08-23) — `/dossier/nouveau` → `https://www.clair-dossier.com/connexion?next=%2Fdossier%2Fnouveau` [CAP `index.json`, `dossier__nouveau__*.jpg`] |
| T-081 | F-AUTH-06 Déconnexion | Connecté, sur `/compte` | 1. Cliquer « Se déconnecter » | `signOut()` puis `navigate('/')` (`src/pages/Account.tsx:79-82, 121-127`, `auth.tsx:101-104`) ; `localStorage["clairdossier-auth"]` supprimé ; nav en mode déconnecté ; ⚠ `clairdossier_draft` **non** effacé (S6 [AA §7.1]) — nettoyage futur = AUGMENT | E2E | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-082 | F-AUTH-07 Pages auth visitées en session | Connecté | 1. Charger `/connexion` 2. Charger `/inscription` | ⚠ Les formulaires s'affichent, aucune redirection (F13 [AA §7.2]) — une redirection future vers `/compte` = AUGMENT, consigner MIGRATED | fonctionnel | oui — Playwright | 1440 | À EXÉCUTER |
| T-083 | F-AUTH-08 Mode « non configuré » | Build **sans** `VITE_SUPABASE_*` (`npm run build` local sans `.env`) | 1. Charger `/inscription` 2. Charger `/compte` | `isSupabaseConfigured = false` (`supabase.ts:6`) ; message « Le service de comptes est en cours de configuration. » (`Signup.tsx:136-140`) et erreur « Le service de comptes n'est pas configuré. » à la soumission (`auth.tsx:76`) ; ⚠ `RequireAuth` laisse passer `/compte` (`RequireAuth.tsx:24-25`, R7/S1). **Ce comportement est un risque** : un durcissement (échec de build si variables absentes) est autorisé et sera consigné REPLACED WITH EQUIVALENT (le mode démo local doit rester possible via un flag explicite ou disparaître sur décision documentée) | sécurité | oui — Playwright sur build local | 1440 | À EXÉCUTER |

---

## 10. Espace client (`/dossier/nouveau`, `/compte`, `/compte/dossier/:id`)

Pré-requis : compte de test A connecté (et compte B pour l'isolation). Fichiers de test : `test-a.pdf` (< 1 Mo), `photo.jpg`. Les insertions créées pendant les tests sont des données de test identifiées (titre préfixé `[TEST]`) ; leur suppression ultérieure passe par les policies `dossiers_delete_own` / `docs_delete_own` du compte de test lui-même (jamais `DELETE FROM` global — II.3.3).

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-084 | F-APP-01 Tunnel — étape 1 Profil | A connecté, `localStorage` vide | 1. Charger `/dossier/nouveau` 2. Cliquer « Artisan » | Title « Créer un dossier — ClairDossier · … » (`src/pages/DossierFlow.tsx:403-411`, ⚠ sans `noindex`, F14) ; H1 « Quel est votre profil ? » (`:419-428`) ; 5 boutons `artisan`, `independant`, `profession-liberale`, `entreprise-pme`, `autre` (`:41-68, 547-589`) ; clic → étape 2 (`selectProfil`, `:239-246`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER (non capturé : la capture live a été redirigée vers `/connexion` [CAP]) |
| T-085 | F-APP-02 Tunnel — étape 2 Nature + nom obligatoire | Étape 2 | 1. Cliquer « Continuer » sans catégorie 2. Choisir `impaye-precontentieux` sans nom, « Continuer » 3. Saisir « [TEST] Chantier Dupont — solde impayé », « Continuer » 4. « Changer de profil » | H1 « Quelle est la nature de votre dossier ? » ; 7 catégories `dossier-client`, `facture-paiement`, `impaye-precontentieux`, `administratif`, `comptable`, `rh`, `autre` (`:70-106`) ; champ « Nom de votre dossier » placeholder « Ex. Chantier Dupont — solde impayé » (`:649-682`) ; (1) bouton désactivé (`:695`) ; (2) message d'erreur nom vide (`:262-264`) ; (3) étape 3 ; (4) retour étape 1 (`:685-691`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-086 | F-APP-03 Tunnel — étape 3 Informations | Étape 3, catégorie `impaye-precontentieux` puis `rh` | 1. Lire les libellés 2. Remplir `counterparty`, `startDate`, `amount` « 1500 », `deadline`, `situation` 3. Soumettre 4. Refaire avec `rh` | H1 « Quelques informations pour structurer. » ; champs `COMMON_FIELDS` (`:115-144`) ; surcharges `impaye-precontentieux` : « Débiteur », « Date de la facture », « Montant dû », « Échéance de paiement », « Historique des relances » ; `rh` : « Salarié concerné », « Date d'embauche », sans champ `amount` (`:147-181`) ; ⚠ aucun champ obligatoire, montant non numérique accepté ; `handleInfoSubmit` copie toutes les entrées dans `answers` + `answers.profil` (`:271-286`) → étape 4 | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-087 | F-APP-04 Tunnel — étape 4 Documents | Étape 4 | 1. Sélectionner 2 fichiers via l'input 2. « Retirer » le 2e 3. « Continuer » ; variante : « Passer cette étape » | H1 « Ajoutez vos documents. » ; `<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.txt">` (`:813-822`) ; liste avec « Retirer » ; ⚠ pas de `onDrop` malgré « glissez-déposez » (F5), pas de limite taille/nombre (S9) ; « Passer cette étape » → étape 5 sans fichier (`:782-864`) | fonctionnel | oui — Playwright (`setInputFiles`) | 1440 / 390 | À EXÉCUTER |
| T-088 | F-APP-05 Tunnel — étape 5 Récapitulatif | Étape 5 | 1. Lire le récap 2. Vérifier la case « Option — question IA préparatoire » 3. « ← Modifier » 4. Revenir à l'étape 5 | H1 « Récapitulatif avant transmission. » ; nom, profil, champs, nombre de pièces, badge « Brouillon » (`:898, 905`) ; case IA **uniquement** si `typology === "impaye-precontentieux"` (`:306, 944-960`) ; « ← Modifier » → étape 3 ; deux boutons « E-mail » et « WhatsApp » (`:866-1003`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-089 | F-APP-06 Brouillon `localStorage` | Tunnel en cours à l'étape 3 avec 1 fichier à l'étape 4 | 1. Lire `localStorage["clairdossier_draft"]` 2. Recharger la page 3. Revenir à l'étape 1 | Clé exacte `clairdossier_draft` (`:38`), JSON `{ profil, typology, title, answers, step, updatedAt }` (`:29-36`) écrit à chaque changement (`:231-237`) ; après rechargement : étape et réponses restaurées, badge « Brouillon restauré depuis votre dernière visite » à l'étape 1 (`:209-229, 431-436`) ; ⚠ fichiers et option IA non restaurés (F6) ; ⚠ clé non suffixée par `user.id` (S6) ; `resetDraft` supprime la clé (`:297`) | E2E | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-090 | F-APP-07 Finalisation WhatsApp | Étape 5, 1 fichier, stub `window.open` | 1. Cliquer « WhatsApp » 2. Vérifier la base et le bucket 3. Lire l'écran final | `insert dossiers { user_id, typology, title, answers (+profil), legal_review_requested, status: "transmis" }` (`:340-351`) ⚠ jamais `brouillon` (F2) ; `storage.upload` `documents/${user.id}/${dossierId}/${Date.now()}-${sanitizeName}` `upsert:false` (`:359-363`) puis `insert dossier_documents { dossier_id, user_id, file_path, file_name, size_bytes }` kind défaut `'piece'` (`:365-371`) ; `window.open("https://wa.me/33782983644?text=<synthèse>")` avec profil, nom, catégorie, réponses, « N document(s) », e-mail du compte (`:308-330, 385-386`) ; `SuccessCard` « Dossier enregistré et transmis », H1 « Dossier transmis. » (`:419, 1005-1048`) ; `clairdossier_draft` supprimé (`:395`) ; trigger `on_new_dossier_notify` déclenché (voir T-117) | E2E | oui — Playwright + REST (`GET /rest/v1/dossiers?title=eq.[TEST]…` avec JWT A) | 1440 / 390 | À EXÉCUTER |
| T-091 | F-APP-08 Finalisation e-mail | Étape 5, stub `location.href` | 1. Cliquer « E-mail » | Mêmes écritures que T-090 puis `mailto:contact.clairdossier@icloud.com?subject=…&body=<synthèse>` (`TEAM_EMAIL`, `:39, 388-390`). **Règle I.5 / ARB :** changement d'adresse de réception = REPLACED WITH EQUIVALENT | E2E | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-092 | F-APP-07 Échec de persistance | Étape 5, réseau Supabase bloqué (route abort) | 1. Cliquer « WhatsApp » | `saveWarning` affiché en ambre « Le dossier n'a pas pu être enregistré dans votre compte, mais l'envoi a bien été préparé. » (`:353-356, 375-377`) ; WhatsApp tout de même ouvert ; ⚠ un échec d'upload seul est silencieux (F4) | E2E | oui — Playwright (`page.route` abort) | 1440 | À EXÉCUTER |
| T-093 | F-APP-09 Liste des dossiers | A connecté avec ≥ 1 dossier | 1. Charger `/compte` 2. Lire l'en-tête, la liste 3. Cliquer une ligne | Title « Mon compte — ClairDossier · … » (`noindex`) ; « Bonjour, {email} » + bouton « Se déconnecter » (`Account.tsx:112-128`) ; titre « Vos dossiers » (`:130-133`) ; CTA « Créer un dossier » → `/dossier/nouveau` (`:134-140`) ; `select dossiers` `order created_at desc` **sans filtre user_id** (RLS) (`:47-50`) ; ligne : `title || typology`, date fr-FR, pastille `STATUS_LABELS` (brouillon / transmis / en-cours / valide / archive, `:19-25`), lien `/compte/dossier/{id}` (`:154-190`) ; état vide : texte client (`:145-152`) ; ⚠ pas de pagination/recherche/tri ; ⚠ erreurs Supabase ignorées (F8) | E2E | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-094 | F-APP-10 Détail — en-tête et onglets | A connecté, dossier `[TEST]` créé en T-090 | 1. Ouvrir `/compte/dossier/{id}` 2. Lire l'en-tête 3. Cliquer chaque onglet | Title « Détail du dossier — ClairDossier · … » (`DossierDetail.tsx:430-435`, canonical forcé `/compte`, `noindex`) ; en-tête : catégorie `TYPOLOGY_LABELS`, titre, date, pastille statut (`:466-499`) ; `role="tablist"` + 4 `role="tab"` `aria-selected` : « Vue d'ensemble », « Pièces », « Échéances », « DashBoard ClairDossier » (`:145-150, 502-522`) ; onglet actif `border-b-2 border-gold-500` | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-095 | F-APP-11 Onglet Vue d'ensemble | Détail ouvert, statut `transmis` | 1. Lire la frise 2. Cliquer l'étape 1 puis l'étape 5 | Frise « Avancement du dossier » 5 étapes `TIMELINE` (`:56-62`) ; `currentStep` = 3 pour `transmis`/`en-cours` (`:92-106`) ⚠ figé à 3 tant que le statut n'évolue pas (F2) ; étapes cliquables → `STEP_PANELS` (`:65-71`) ; message `STEP_MESSAGES[step]` (`:74-80`) ; carte « Ce que vous devez faire maintenant » `STEP_NEXT_ACTIONS` (`:83-89`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-096 | F-APP-12 Onglet Pièces — visualiser / télécharger | Dossier avec 1 pièce | 1. Ouvrir l'onglet 2. Cliquer « Visualiser » 3. Cliquer « Télécharger » | Liste des `dossier_documents` avec `kind !== 'deliverable'` (`:309`) ; `DocLine` : « Visualiser » = URL signée 1 h `target=_blank` (`:182-195`, `createSignedUrl(path, 3600)` `:284-286`), « Télécharger » = même URL + `?download=<file_name>` (`:166-168`) ; le fichier s'ouvre / se télécharge (HTTP 200 sur `…/storage/v1/object/sign/documents/…`) ; **pas** de bouton « Supprimer » pour le client (`:656-662`) ; **pas** de bouton « Télécharger toutes les pièces » pour un non-admin (`:632-648`) | E2E | oui — Playwright (download event) | 1440 / 390 | À EXÉCUTER |
| T-097 | F-APP-13 Expiration des URLs signées | URL signée copiée depuis T-096 | 1. Attendre > 3 600 s (ou générer avec `expiresIn` court en test) 2. Ouvrir l'URL | HTTP 400/403 de Supabase Storage après expiration ; dans l'UI, sans rechargement, ⚠ aucune régénération automatique (F10) ; `reloadDocuments` régénère (`:313-332`) | sécurité | oui — curl | n/a | À EXÉCUTER |
| T-098 | F-APP-14 Onglet Échéances | Dossier `impaye-precontentieux` avec `startDate`, `deadline`, `situation`, option IA cochée | 1. Ouvrir l'onglet | Entrées dont la clé matche `/date|deadline|echeance|échéance/i` (`:139-141`) avec libellés `ANSWER_LABELS` (`:109-132`) ⚠ libellés hérités (« Partie adverse », « Date d'entrée dans les lieux », F7) ; encart « Situation » ; badge « Préavis juridique demandé » si `legal_review_requested` (`:750-795`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-099 | F-APP-15 Onglet DashBoard (côté client) | Dossier avec 0 puis 2 livrables (déposés par l'admin, T-110) | 1. Ouvrir l'onglet sans livrable 2. Après T-110, rouvrir | Livrables `kind === 'deliverable'` listés ; bouton « Tout télécharger » visible si > 1 livrable (`:674-688`) ; **aucun** bouton « Supprimer » ni zone « Livrer le travail au client » pour un non-admin (`:704-706, 714-746`) | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-100 | F-APP-16 Téléchargement groupé (.zip) | ≥ 2 livrables, dont 2 de même nom | 1. Cliquer « Tout télécharger » | `fetch` de chaque URL signée → `zipSync` (`fflate`, `level: 0`) → `<a download>` (`:367-401`) ; archive contenant tous les fichiers, doublon préfixé `copie-` ; en cas d'échec total : « Téléchargement indisponible pour le moment. » (`:385`) ⚠ affiché uniquement dans l'onglet `dashboard` (F11) | E2E | oui — Playwright (download + lecture du zip) | 1440 | À EXÉCUTER |
| T-101 | F-APP-17 Dossier introuvable | A connecté | 1. Charger `/compte/dossier/00000000-0000-0000-0000-000000000000` | Carte « Dossier introuvable » + lien vers `/compte` (`:448-463`), pas de redirection, pas d'erreur console non gérée | fonctionnel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-102 | F-APP-18 Statuts et frise | Accès SQL au projet de **test** (jamais la prod sans confirmation humaine) ; dossier `[TEST]` | 1. `UPDATE dossiers SET status='valide' WHERE id=<test>` 2. Recharger le détail 3. Idem `archive`, `brouillon`, `en-cours`, puis valeur inconnue `xyz` | `currentStep` : `brouillon`→1, `transmis`/`en-cours`→3, `valide`→4, `archive`→5, défaut 1 (`:92-106`) ; pastille `STATUS_LABELS` ou code brut si inconnu (`Account.tsx:178`) ; ⚠ aucune contrainte `check` sur `status` (`…init.sql:25`) ; ⚠ aucun `update` possible depuis l'UI ni policy admin UPDATE (R5 [SB]). Remarque : le client peut techniquement `PATCH` son propre statut via REST (`dossiers_update_own`, `…init.sql:58`) | E2E | partiel — REST `PATCH` avec JWT A + Playwright | 1440 | À EXÉCUTER |
| T-103 | F-APP-19 Catégories et sous-catégories de documents | Dossier avec 1 pièce + 1 livrable ; dossiers anciens éventuels | 1. Vérifier la répartition Pièces / DashBoard 2. Ouvrir un dossier à typologie héritée (si présent en base) | Sous-catégorisation des documents par `kind` : `'piece'` → onglet Pièces, `'deliverable'` → onglet DashBoard (`:309`, `dossier_documents_kind_check`, `…deliverables.sql:13-19`) ; catégories de dossier : 7 typologies actuelles + 7 anciennes (`litige-commercial`, `recouvrement`, `bail`, `consommation`, `prud-hommes`, `divorce`, `succession`) **conservées pour les dossiers déjà enregistrés** (`TYPOLOGY_LABELS`, `:35-52`) → tout dossier existant reste affichable avec son libellé. **Interdiction de retirer une typologie héritée sans migration des données** (I.7) | fonctionnel | oui — Playwright + REST | 1440 | À EXÉCUTER |
| T-104 | F-APP-20 Bloc « Garanties » | Détail ouvert | 1. Lire le bloc de fin | Texte « Aucun envoi ne sera effectué sans votre confirmation. … doit pouvoir être vérifiée ou validée par un professionnel habilité » (`:797-808`) | visuel | oui — Playwright | 1440 / 390 | À EXÉCUTER |
| T-105 | F-APP-21 Isolation RLS — frontend | A et B connectés (2 contextes), dossier de B connu | 1. Avec A, charger `/compte` 2. Avec A, charger `/compte/dossier/{id_B}` | (1) la liste de A ne contient aucun dossier de B (`dossiers_select_own` : `auth.uid() = user_id`, `…init.sql:56`) ; (2) « Dossier introuvable » (`maybeSingle()` → null, `DossierDetail.tsx:241-250`) | sécurité | oui — Playwright (2 `browser.newContext`) | 1440 | À EXÉCUTER |
| T-106 | F-APP-21 Isolation RLS — REST (lecture/écriture) | JWT de A (`POST /auth/v1/token?grant_type=password`), `id_B`, `doc_id_B` | 1. `GET /rest/v1/dossiers?id=eq.{id_B}` 2. `GET /rest/v1/dossier_documents?dossier_id=eq.{id_B}` 3. `PATCH /rest/v1/dossiers?id=eq.{id_B}` `{title:"hack"}` 4. `DELETE /rest/v1/dossier_documents?id=eq.{doc_id_B}` 5. `GET /rest/v1/profiles?id=eq.{uid_B}` | (1)(2)(5) `200 []` ; (3)(4) `204`/`200` avec **0 ligne affectée** (`Prefer: return=representation` → `[]`) — policies `dossiers_update_own`, `docs_delete_own`, `profiles_select_own` (`…init.sql:52-63`) ; B inchangé (vérification avec JWT B) | sécurité | oui — curl | n/a | À EXÉCUTER |
| T-107 | F-APP-21 Isolation RLS — storage | JWT A, chemin d'un objet de B `documents/{uid_B}/{id_B}/…` | 1. `POST /storage/v1/object/sign/documents/{path_B}` avec JWT A 2. `GET /storage/v1/object/authenticated/documents/{path_B}` avec JWT A 3. `POST /storage/v1/object/documents/{uid_B}/{id_B}/evil.txt` (upload sous le préfixe de B) avec JWT A 4. `POST /storage/v1/object/list/documents` `{prefix:"{uid_B}/"}` avec JWT A | (1)(2) 400/403/404 — `docs_storage_select_own` : `(storage.foldername(name))[1] = auth.uid()::text` (`…init.sql:108-109`) ; (3) refusé — `docs_storage_insert_own` (`:110-111`) ; (4) liste vide | sécurité | oui — curl | n/a | À EXÉCUTER |
| T-108 | F-APP-21 Isolation — rôle `anon` | `apikey` anon seule, sans JWT | 1. `GET /rest/v1/dossiers` 2. `GET /rest/v1/profiles` 3. `POST /rest/v1/rpc/is_admin` | (1)(2) `200 []` **ou** erreur `42501 permission denied for function is_admin` (R11 [SB §8.3] — comportement réel **À VÉRIFIER**, aucune fuite dans les deux cas) ; (3) `401/403` (`revoke … from anon`, `…admin_global_access.sql:34`) | sécurité | oui — curl | n/a | À VÉRIFIER |
| T-109 | F-APP-21 Intégrité croisée `dossier_documents` | JWT A, `id_B` | 1. `POST /rest/v1/dossier_documents` `{dossier_id:id_B, user_id:uid_A, file_path:"{uid_A}/x/y.pdf", file_name:"y.pdf"}` | ⚠ Baseline : insertion **acceptée** (`docs_insert_own` ne vérifie pas la propriété de `dossier_id`, R6 [SB §8.1]) ; aucune fuite (le fichier reste sous le préfixe de A). Un durcissement futur (refus 403) = amélioration de sécurité à consigner REPLACED WITH EQUIVALENT. Nettoyer la ligne de test avec JWT A (`docs_delete_own`) | sécurité | oui — curl | n/a | À EXÉCUTER |

---

## 11. Admin global

Admin = unique compte dont l'`id` figure dans `public.app_admins` (inséré par e-mail `prestige.seller@icloud.com`, `supabase/migrations/20260621144123_admin_global_access.sql:20-22`) [SB §6]. **Contenu réel de `app_admins` en prod À VÉRIFIER** (R7). Les tests admin nécessitent ce compte (ou un admin de test sur un projet de test).

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-110 | F-ADM-01 Détection admin | Admin connecté | 1. Charger `/compte` | `rpc('is_admin')` → `true` (`Account.tsx:42`, fonction `…admin_global_access.sql:25-35`) ; bannière « Espace administrateur » (`:100-110`) ; titre « Tous les dossiers (N) » (`:130-133`) | E2E | oui — Playwright | 1440 / 390 | À VÉRIFIER (existence de l'admin en prod) |
| T-111 | F-ADM-02 Liste globale avec identité propriétaire | Admin connecté, dossiers de A et B existants | 1. Lire la liste | Tous les dossiers (policy `dossiers_select_admin`, `…admin_global_access.sql:38-40`) ; par ligne `company_name || full_name` (`select profiles`, `profiles_select_admin`) · e-mail via `rpc('admin_user_emails')` (`Account.tsx:55-64`, `…admin_user_emails.sql:6-19`) ou `user_id` tronqué à 8 caractères | E2E | oui — Playwright | 1440 | À EXÉCUTER |
| T-112 | F-ADM-03 Détail d'un dossier d'autrui | Admin connecté | 1. Ouvrir `/compte/dossier/{id_A}` | Dossier affiché ; ligne « Propriétaire · {email_A} » (`DossierDetail.tsx:257-268, 481-486`) ; pièces listées (`docs_select_admin`) ; URLs signées générées (`docs_storage_select_admin`, `…admin_global_access.sql:51-53`) | E2E | oui — Playwright | 1440 | À EXÉCUTER |
| T-113 | F-ADM-04 Zip de toutes les pièces | Admin, dossier avec ≥ 2 pièces | 1. Onglet Pièces 2. Cliquer « Télécharger toutes les pièces (N) » | Bouton visible admin seulement (`:632-648`) ; zip conforme à T-100 | E2E | oui — Playwright | 1440 | À EXÉCUTER |
| T-114 | F-ADM-05 Livrer un fichier au client | Admin sur le dossier de A | 1. Onglet DashBoard 2. Zone « Livrer le travail au client » : sélectionner `livrable.pdf` 3. Vérifier côté A | Upload `documents/{uid_A}/{id_A}/deliverable-{ts}-{safe}` (`:343-346`) puis insert `dossier_documents { user_id: uid_A, kind: 'deliverable' }` (`:348-355`) via `docs_insert_admin` / `docs_storage_insert_admin` (`…deliverables.sql:22-29`) ; A voit le livrable dans son onglet DashBoard (T-099) ; erreur → `deliverError` (`:336-364`) | E2E | oui — Playwright (2 contextes) | 1440 | À EXÉCUTER |
| T-115 | F-ADM-06 Supprimer un livrable | Admin, livrable de T-114 | 1. Cliquer « Supprimer » 2. Confirmer le `window.confirm` | `storage.remove([file_path])` puis `delete dossier_documents .eq('id')` (`:403-426`) via `docs_delete_admin` / `docs_storage_delete_admin` (`…admin_delete_documents.sql:5-11`) ; ligne disparue ; bouton « Supprimer » proposé **uniquement** sur les livrables (`:704-706`) ; ⚠ résultat de `storage.remove` ignoré (S12) | E2E | oui — Playwright (`dialog.accept`) | 1440 | À EXÉCUTER |
| T-116 | F-ADM-07 Limites de l'admin | JWT admin | 1. `PATCH /rest/v1/dossiers?id=eq.{id_A}` `{status:"valide"}` 2. `DELETE /rest/v1/dossiers?id=eq.{id_A}` 3. `GET /rest/v1/app_admins` | (1)(2) 0 ligne affectée — **aucune policy UPDATE/DELETE admin sur `dossiers`** (R5 [SB §3.2]) ; (3) refusé (`revoke all on app_admins`, `…admin_global_access.sql:15-17`). ⚠ Baseline fonctionnelle limitée : l'ajout futur d'une policy admin UPDATE sur `status` = AUGMENT (MIGRATED) | sécurité | oui — curl | n/a | À EXÉCUTER |
| T-117 | F-ADM-08 Non-admin | JWT A | 1. `POST /rest/v1/rpc/is_admin` 2. `POST /rest/v1/rpc/admin_user_emails` 3. Sur `/compte`, inspecter l'UI | (1) `false` ; (2) `[]` (`where public.is_admin()`, `…admin_user_emails.sql:15`) ; (3) ni bannière admin, ni « Tous les dossiers », ni zone de livraison, ni « Télécharger toutes les pièces » | sécurité | oui — curl + Playwright | 1440 | À EXÉCUTER |

---

## 12. Notifications e-mail

Chaîne : INSERT `profiles` / `dossiers` → triggers `on_new_profile_notify` / `on_new_dossier_notify` → `notify_lead()` → `net.http_post` → Edge Function `notify-lead` → Resend → `prestige.seller@icloud.com` (`supabase/migrations/20260617110728_dossier_lead_notification.sql:7-34`, `supabase/functions/notify-lead/index.ts`) [SB §4.4]. **Déploiement réel de la fonction et secret `RESEND_API_KEY` À VÉRIFIER** (R12).

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-118 | F-NOTIF-01 Notification « nouveau compte » | Inscription T-073 ; accès à la boîte `prestige.seller@icloud.com` (ou destinataire de test) | 1. Créer le compte 2. Consulter la boîte sous 2 min | E-mail de « ClairDossier <noreply@clair-dossier.com> » (`index.ts:7`), objet « ClairDossier — nouveau compte » (`:27`), corps : phrase générique + « Référence : <8 premiers caractères de l'id>… » + lien `https://www.clair-dossier.com/compte` (`:21-33`) ; **aucune donnée nominative** (`:16-19`) | E2E | non — manuel (boîte mail) ; partiel via logs Supabase `net._http_response` | n/a | À VÉRIFIER |
| T-119 | F-NOTIF-02 Notification « nouveau dossier » | Création T-090 | 1. Créer le dossier 2. Consulter la boîte | Objet « ClairDossier — nouveau dossier » (`:31`), lien `https://www.clair-dossier.com/compte/dossier/<id>` ; sans titre, typologie ni montant | E2E | non — manuel | n/a | À VÉRIFIER |
| T-120 | F-NOTIF-03 Edge function — contrat d'entrée | `VITE_SUPABASE_ANON_KEY` (valeur publique du bundle) | 1. `POST https://buzgokfmxpmyceppvjpp.supabase.co/functions/v1/notify-lead` `Authorization: Bearer <anon>` body `{"table":"profiles","record":{"id":"test-0000"}}` 2. Idem avec `{"table":"autre","record":{"id":"x"}}` | (1) 200 (réponse Resend relayée, `:58-67`) ; (2) `200 { skipped: true, table: "autre" }` (`:34-39`). ⚠ Appelable par quiconque détient la clé anon (R1/S8) — un durcissement (secret partagé, `service_role`) = REPLACED WITH EQUIVALENT. **Ne pas exécuter (1) en boucle** : chaque appel envoie un vrai e-mail | sécurité | oui — curl (1 appel max) | n/a | À VÉRIFIER |
| T-121 | F-NOTIF-04 E-mails Supabase Auth | Inscription T-073 | 1. Lire l'expéditeur de l'e-mail de confirmation | Expéditeur « ClairDossier » `noreply@clair-dossier.com` via `smtp.resend.com:465` (`supabase/config.toml:215-223`) ; templates par défaut (`:225-234`) — **config SMTP du projet hébergé À VÉRIFIER** | E2E | non — manuel | n/a | À VÉRIFIER |

---

## 13. SEO & crawlers IA

### 13.1 Tableau de référence `<Seo>` par route (source `src/lib/seo.tsx` + appels par page [RS §2])

Suffixe automatique `« — ClairDossier · Dossier juridique clair, structuré et suivi »` si le titre ne contient pas « ClairDossier » (`seo.tsx:36`). Canonical = `https://www.clair-dossier.com` + `path` (`:37, 60-66`). `og:image` = `https://www.clair-dossier.com/og-default.svg` partout.

| Route | `document.title` attendu | robots | Canonical | og:type | JSON-LD |
|---|---|---|---|---|---|
| `/` | ClairDossier — Votre dossier juridique, clair, structuré et suivi | index, follow, max-image-preview:large | `/` | website | Organization, WebSite, SoftwareApplication, FAQPage |
| `/fonctionnalites` | Fonctionnalités — ClairDossier · Dossier juridique clair, structuré et suivi | index | `/fonctionnalites` | website | BreadcrumbList + 9 Service |
| `/fonctionnalites/:slug` | `{feature.title}` + suffixe | index | `/fonctionnalites/{slug}` | website | BreadcrumbList (3) + Service |
| `/tarifs` | Tarifs — ClairDossier · … | index | `/tarifs` | website | BreadcrumbList + SoftwareApplication/AggregateOffer |
| `/securite` | Sécurité & conformité — ClairDossier · … | index | `/securite` | website | BreadcrumbList |
| `/blog` | Journal — ClairDossier · … | index | `/blog` | website | BreadcrumbList + Blog |
| `/blog/:slug` | `{post.metaTitle}` + suffixe | index | `/blog/{slug}` | **article** | BreadcrumbList + BlogPosting + FAQPage |
| `/contact` | Contact — ClairDossier · … | index | `/contact` | website | BreadcrumbList |
| `/mentions-legales`, `/cgv`, `/politique-confidentialite`, `/cookies` | Mentions légales / Conditions générales de vente / Politique de confidentialité / Cookies — ClairDossier · … | index | chemin | website | BreadcrumbList |
| `/inscription` | Créer un compte — ClairDossier · … | **noindex, follow** | `/inscription` | website | — |
| `/connexion` | Connexion — ClairDossier · … | **noindex, follow** | `/connexion` | website | — |
| `/compte` | Mon compte — ClairDossier · … | **noindex** | `/compte` | website | — |
| `/compte/dossier/:id` | Détail du dossier — ClairDossier · … | **noindex** | **`/compte`** (forcé) | website | — |
| `/dossier/nouveau` | Créer un dossier — ClairDossier · … | ⚠ **index** (R15) | `/dossier/nouveau` | website | BreadcrumbList |
| `*` (404) | Page introuvable — ClairDossier · … | **noindex** | ⚠ **`/`** (R14) | website | — |

### 13.2 Tests

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-122 | F-SEO-01 `index.html` statique (avant JS) | `curl https://www.clair-dossier.com/` | 1. Lire le HTML brut | `<html lang="fr">` ; `<title>ClairDossier — Votre dossier administratif et juridique, clair, structuré et suivi.</title>` (`index.html:16`) ; meta description (`:17`), `author` « Nouh BENZIDANE » (`:18`, **I.5 → « ClairDossier »**, REPLACED WITH EQUIVALENT), robots `index, follow, max-image-preview:large` (`:19`), canonical `https://www.clair-dossier.com/` (`:12`), `google-site-verification` `yKED4w0FJ9KypEjb814a_MoyCkGpPRjWR8KVPEhDQ7c` (`:9`), OG/Twitter avec `og-default.svg` 1200×630 (`:22-36`), `theme-color #0d1b3d` (`:6`), `<noscript>` avec `mailto:` (`:49-57`) ; `content-length: 3759` [LS §5.1] | SEO | oui — curl + grep | n/a | PASS (prod 2026-08-23) [LS §5.1] |
| T-123 | F-SEO-02 `<Seo>` par route (après JS) | Navigateur, chaque route du tableau 13.1 | 1. Charger la route 2. Lire `document.title`, `meta[name=description]`, `link[rel=canonical]`, `meta[name=robots]`, `og:url`, `og:type` | Valeurs du tableau 13.1 ; titles des 24 routes capturées = colonne `title` de `docs/baseline/screens/index.json` [CAP] | SEO | oui — Playwright (boucle routes) | 1440 | PASS (prod 2026-08-23) pour les 24 titles capturés [CAP `index.json`] ; description/canonical/robots À EXÉCUTER |
| T-124 | F-SEO-03 JSON-LD par route | Navigateur | 1. Pour chaque route, parser tous les `script[data-seo-jsonld]` | Types et nombres du tableau 13.1 ; JSON valide ; anciens scripts supprimés à chaque changement de route (`seo.tsx:68-78`) | SEO | oui — Playwright | 1440 | À EXÉCUTER |
| T-125 | F-SEO-04 noindex des pages privées | Navigateur | 1. Charger `/inscription`, `/connexion`, `/compte` (connecté), `/compte/dossier/:id`, `/zzz-404` | `meta[name=robots]` = `noindex, follow` ; ⚠ `/dossier/nouveau` = `index, follow` (baseline) — passage en `noindex` = MIGRATED | SEO | oui — Playwright | 1440 | À EXÉCUTER |
| T-126 | F-SEO-05 Sitemap | `curl -sI/-s https://www.clair-dossier.com/sitemap.xml` | 1. Vérifier statut/type 2. Extraire les `<loc>` | `200`, `content-type: application/xml` [RS §3] ; **exactement 26 URLs** en `https://www.clair-dossier.com` : `/`, `/fonctionnalites`, 9 × `/fonctionnalites/{slug}`, `/tarifs`, `/securite`, `/blog`, 7 × `/blog/{slug}`, `/contact`, `/mentions-legales`, `/cgv`, `/politique-confidentialite`, `/cookies` (`public/sitemap.xml:3-139`) ; `lastmod` sur les 7 articles uniquement. Toute nouvelle URL publique doit être **ajoutée** ; aucune URL existante ne doit disparaître sans redirection 301 (VII.1) | SEO | oui — curl + script Node | n/a | PASS (prod 2026-08-23) [LS §2, §3] |
| T-127 | F-SEO-06 robots.txt | `curl -s https://www.clair-dossier.com/robots.txt` | 1. Comparer au fichier | `200 text/plain` ; `User-agent: *` / `Allow: /` / `Disallow: /dossier/` ; blocs GPTBot, ChatGPT-User, PerplexityBot, Claude-Web, Google-Extended ; `Sitemap: https://www.clair-dossier.com/sitemap.xml` (`public/robots.txt:1-21`) | SEO | oui — curl + diff | n/a | PASS (prod 2026-08-23) [LS §6.1] |
| T-128 | F-SEO-07 llms.txt | `curl -s https://www.clair-dossier.com/llms.txt` | 1. Statut/type 2. Comparer à `public/llms.txt` | `200 text/plain`, 8 672 o [LS §3] ; sections éditeur, architecture, 7 articles, tarifs, sécurité, convention `.md` (`llms.txt:5-105`). ⚠ Contenu à corriger (I.5 : nom/téléphone ; R5 : affirmations OVH/HSTS/HDS) → REPLACED WITH EQUIVALENT : le fichier doit rester servi et cohérent avec le site | SEO | oui — curl | n/a | PASS (prod 2026-08-23) [LS §3] |
| T-129 | F-SEO-08 Fichiers markdown pour crawlers | `curl -sI` sur les 27 chemins | 1. Vérifier chaque `.md` 2. `diff index.md page.md` | 27 fichiers en `200 text/markdown` : `/index.md`, `/page.md` (identiques), `/tarifs.md`, `/securite.md`, `/contact.md`, 4 `<legal>.md`, `/fonctionnalites/index.md` + 9 `/fonctionnalites/{slug}.md`, `/blog/index.md` + 7 `/blog/{slug}.md` [LS §3] ; `/fonctionnalites.md` et `/blog.md` → 404 (baseline, convention `index.md`) ; front-matter `title/description/url` (`scripts/gen-markdown.ts:54-58, 161-169, 476-481`). ⚠ `securite.md`/`index.md` divergent de la page React (R5) — réalignement = REPLACED WITH EQUIVALENT | SEO | oui — curl (boucle) | n/a | PASS (prod 2026-08-23) [LS §3] |
| T-130 | F-SEO-09 Statuts HTTP des routes (baseline 404) | `curl -s -o /dev/null -w %{http_code}` sur les 26 URLs du sitemap + `/inscription`, `/connexion`, `/compte`, `/dossier/nouveau` | 1. Sans `-L` 2. Avec `-L` | **Baseline** : `/` → 200 ; `/fonctionnalites` et `/blog` → 301 vers `/fonctionnalites/` et `/blog/` puis 404 ; toutes les autres → 404 avec `content-length: 3759`, `etag "6a467a60-eaf"` (corps = `index.html`) [LS §2] ; contenu rendu côté client (T-123). **Cible** : 200 sur toutes les routes publiques (R1) ; le passage est consigné MIGRATED. Après bascule, les deux 301 trailing-slash doivent être surveillés (redirection ou suppression documentée) | SEO | oui — curl | n/a | PASS (prod 2026-08-23) au sens « contenu rendu » [LS §2, CAP `index.json`] |
| T-131 | F-SEO-10 Redirections d'hôte et de schéma | `curl -sI` | 1. `https://clair-dossier.com/` 2. `http://clair-dossier.com/` 3. `https://clair-dossier.com/tarifs` 4. `http://www.clair-dossier.com/` | (1) 301 → `https://www.clair-dossier.com/` ; (2) 301 → `http://www.clair-dossier.com/` ; (3) 301 → `https://www.clair-dossier.com/tarifs` (chemin conservé) ; (4) ⚠ **200 en clair, sans redirection HTTPS ni HSTS** (R2/R3) [LS §4.2]. **Cible** : (2) et (4) → 301 vers `https://www.…` + `strict-transport-security` ; consigner MIGRATED. L'hôte canonique **www** doit rester (`public/CNAME:1`, `seo.tsx:13`) | sécurité | oui — curl | n/a | PASS (prod 2026-08-23) pour (1)(3) ; (2)(4) = défaut connu [LS §4.2] |
| T-132 | F-SEO-11 En-têtes HTTP | `curl -sI https://www.clair-dossier.com/` et `/assets/react-CBBoJgXi.js` | 1. Lire les en-têtes | **Baseline** : `server: GitHub.com`, `cache-control: max-age=600` (même sur les assets hachés), `access-control-allow-origin: *`, `content-encoding: gzip` si demandé ; **absents** : CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy [LS §4.1] (R4). **Cible** : en-têtes de `netlify.toml:19-37` (CSP `default-src 'self'; script-src 'self'; … connect-src … supabase.co; frame-ancestors 'none'`, cache `immutable` sur `/assets/*`) effectifs sur le domaine ; consigner MIGRATED. Régression interdite : aucun en-tête ne doit bloquer Supabase (`connect-src`) ni les polices auto-hébergées | sécurité | oui — curl | n/a | PASS (prod 2026-08-23) au sens « état constaté » [LS §4.1] |
| T-133 | F-SEO-12 404 SPA et page NotFound | `curl` + navigateur | 1. `curl -sI https://www.clair-dossier.com/page-inexistante` 2. Charger la même URL dans le navigateur 3. Cliquer les 2 CTA | (1) 404, corps identique à `index.html` (`/404.html` → 200 identique) [LS §4.4] ; (2) kicker « Erreur 404 », H1 « Cette page n'existe pas. », texte « Le lien est peut-être obsolète ou mal recopié. Revenez à l'accueil ou ouvrez le journal. » (`src/pages/NotFound.tsx:9-14`), rendu **dans** le Layout (nav + footer) ; title « Page introuvable — ClairDossier · … », `noindex` ; (3) « Retour à l'accueil » → `/`, « Lire le journal » → `/blog` (`:17-25`). **Cible** : après bascule d'hébergeur, une URL inconnue doit **toujours** répondre 404 (et non 200) | SEO | oui — curl + Playwright | 1440 / 390 | PASS (prod 2026-08-23) [CAP `page-inexistante-404__*.jpg`, `index.json`] |
| T-134 | F-SEO-13 Assets statiques | `curl -sI` | 1. `/favicon.svg` 2. `/og-default.svg` 3. `/CNAME` 4. `/assets/index-B6lhu7zR.css` 5. une police `.woff2` latin | (1) 200 `image/svg+xml` 297 o ; (2) 200 2 347 o 1200×630 ; (3) 200 `www.clair-dossier.com` ; (4) 200 `text/css` ; (5) 200 `font/woff2` [LS §3, §5] ; ⚠ `favicon.ico`, `apple-touch-icon.png`, `feed.xml` → 404 (baseline) — ajouts futurs = AUGMENT | SEO | oui — curl | n/a | PASS (prod 2026-08-23) [LS §3, §5.4] |
| T-135 | F-SEO-02 Canonical sur hôte www partout | `grep -rn "clair-dossier.com" src public index.html` | 1. Vérifier les URL absolues | Toutes en `https://www.clair-dossier.com` (`seo.tsx:13`, `index.html:12,26-27,36`, `sitemap.xml`, `robots.txt:21`, `llms.txt`, `gen-markdown.ts:32`, `BlogIndex.tsx:28,34`, `BlogPost.tsx:49,55-58`) ; seules exceptions textuelles : `legal.ts:25, 28` (apex dans un texte) [RS §3] | SEO | oui — grep (script) | n/a | PASS (repo 2026-08-23) [RS §3] |

---

## 14. Build / Deploy

| ID | Fonctionnalité (F-réf.) | Pré-conditions | Étapes | Résultat attendu (observable) | Type | Automatisable | Viewports | Statut baseline |
|---|---|---|---|---|---|---|---|---|
| T-136 | F-BUILD-01 Installation | Node 22 (CI, `deploy.yml:29`) ou 24 (local) | 1. `npm ci` | Sortie 0, aucune vulnérabilité bloquante signalée comme erreur ; dépendances `package.json:13-34` (react 19, react-router-dom 7, motion 11, @supabase/supabase-js 2, fflate, tailwindcss 4, vite 6, typescript 5, tsx) | build | oui — shell | n/a | PASS (local 2026-08-23) [BI] |
| T-137 | F-BUILD-02 Typecheck | Dépendances installées | 1. `npm run typecheck` | `tsc --noEmit` sortie 0 avec `strict`, `noUnusedLocals`, `noUnusedParameters` (`tsconfig.json:2-28`) ; ⚠ `scripts/` hors `include` (D4) | build | oui — tsc | n/a | PASS (local 2026-08-23) [BI] |
| T-138 | F-BUILD-03 Build complet | Idem | 1. `npm run build` 2. `diff dist/index.html dist/404.html` 3. `cat dist/CNAME` 4. `ls dist/assets/*.js \| wc -l` | `gen:md` → `tsc` → `vite build` (`package.json:9`), sortie 0, durée de l'ordre de 1 s ; `dist/404.html` identique à `dist/index.html` (plugin `spaFallback`, `vite.config.ts:9-17`) ; `dist/CNAME` = `www.clair-dossier.com` ; chunks : 5 initiaux + 14 pages lazy + `authors` + `whatsapp` [BI] | build | oui — shell | n/a | PASS (local 2026-08-23, 941 ms) [BI] |
| T-139 | F-BUILD-04 Arbre de travail inchangé par le build | Arbre propre | 1. `git status --porcelain` avant 2. `npm run build` 3. `git status --porcelain` après | Identique avant/après : les 27 `public/**/*.md` régénérés par `gen:md` sont déjà synchronisés avec `src/data` (D2 [RS §6]) ; toute différence = données et markdown désynchronisés → **bloquant** | build | oui — shell | n/a | PASS (local 2026-08-23) [RS en-tête] |
| T-140 | F-BUILD-05 Budget de performance (plafond = baseline) | Après build | 1. Lister `dist/assets/*.js` et `*.css` avec tailles brutes et gzip | **Plafonds (tailles du 2026-08-23, [BI])** : `index-*.js` ≤ 150,37 kB (gzip 45,79) · `react-*.js` ≤ 193,69 kB (60,49) · `supabase-*.js` ≤ 209,59 kB (54,63) · `motion-*.js` ≤ 121,55 kB (40,42) · `router-*.js` ≤ 37,89 kB (13,67) · `index-*.css` ≤ 100,11 kB (27,43) · pages lazy : DossierDetail ≤ 26,67 · DossierFlow ≤ 23,13 · LegalPage ≤ 22,45 · Pricing ≤ 17,36 · Security ≤ 10,74 · Contact ≤ 7,92 · BlogPost ≤ 7,64 · Account ≤ 4,87 · FeatureDetail ≤ 4,42 · Signup ≤ 4,38 · BlogIndex ≤ 4,11 · FeaturesIndex ≤ 4,00 · Login ≤ 2,87 · NotFound ≤ 1,36 kB ; **JS initial total ≤ 713 kB brut / ≤ 215 kB gzip** [LS §5.2]. Un dépassement exige une justification écrite (IX.2) ; un nouveau chunk lazy est admis s'il n'alourdit pas le chargement initial | perf | oui — script Node (`fs.statSync` + `zlib.gzipSync`) | n/a | PASS (local 2026-08-23 = prod) [BI] |
| T-141 | F-BUILD-06 Markdown générés | Après build | 1. `find dist -name '*.md' \| wc -l` 2. `diff -r public dist` sur les `.md` 3. `diff dist/index.md dist/page.md` | 27 fichiers ; identiques à `public/` ; `index.md` = `page.md` (`gen-markdown.ts:135-137, 526-535`) ; pied commun `footer()` (`:40-49`) — **I.5** : après correction du pied (nom/crédit), les 27 fichiers changent simultanément → REPLACED WITH EQUIVALENT | build | oui — shell / vitest snapshot | n/a | PASS (local 2026-08-23) [RS §4.4] |
| T-142 | F-BUILD-07 Variables d'environnement CI | Build CI (`.github/workflows/deploy.yml`) ou local avec `.env` | 1. `grep -c "buzgokfmxpmyceppvjpp" dist/assets/index-*.js` 2. Charger le site buildé, lire `isSupabaseConfigured` (absence du warning DEV) | `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` injectées (`deploy.yml:39-43`) → URL présente dans `index-*.js` (≥ 1 occurrence) ; `configured === true` ; `RequireAuth` actif (T-080). Sans variables : hash `index-*.js` différent (seul chunk qui diffère, [BI]) | build | oui — shell | n/a | PASS (prod 2026-08-23) — clé et URL présentes dans `index-BEZEsRp_.js` [LS §7] |
| T-143 | F-BUILD-08 Serveurs dev / preview | Dépendances installées | 1. `npm run dev` → `http://localhost:5173/` 2. `npm run preview` → `http://localhost:4173/` 3. Charger `/tarifs` directement sur chacun | Dev : Vite 5173 `strictPort: false` (`vite.config.ts:45`) ; preview : 4173 (`package.json:10`) ; les deux servent `/tarifs` en **200** (fallback SPA Vite) avec la page rendue | build | oui — shell + curl | n/a | À EXÉCUTER |
| T-144 | F-BUILD-09 Reproductibilité vs prod | Build local avec les mêmes variables que CI | 1. Comparer les hashes `dist/assets/*` à ceux servis en prod | Sans changement de dépendance ni de code : `react-CBBoJgXi.js`, `supabase-Buf76L6m.js`, `motion-ZtdEAC6k.js`, `router-CjS7eph5.js`, `index-B6lhu7zR.css` identiques ; `index-*.js` identique si les variables sont identiques (sinon seul ce hash diffère) [BI]. Après toute évolution, les hashes changent légitimement : ce test sert uniquement à vérifier que le **déploiement effectif** correspond au commit attendu (`last-modified` GitHub Pages vs date du commit) | build | oui — script (curl + `ls dist/assets`) | n/a | PASS (2026-08-23) [BI, RS §4.1] |
| T-145 | F-BUILD-10 Core Web Vitals | Lighthouse (Chrome) sur `https://www.clair-dossier.com/` et `/tarifs`, preset desktop et mobile | 1. `npx lighthouse <url> --preset=desktop --output=json` 2. Idem mobile 3. Relever LCP, INP/TBT, CLS | **Cibles constitutionnelles** (VII.1) : LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1. **Baseline** : valeurs à mesurer et à consigner lors de la première exécution ; ensuite, aucune évolution ne doit dégrader LCP/CLS de plus de 10 % ni franchir les cibles | perf | oui — Lighthouse CLI | 1440 / 390 (émulation) | À EXÉCUTER (jamais mesuré) |
| T-146 | F-BUILD-11 Régression visuelle (captures avant/après) | Build à tester servi (preview ou prod) ; 48 captures de référence `docs/baseline/screens/` | 1. Rejouer le script de capture (puppeteer-core + Chrome, 1440 px et 390 px émulé, défilement progressif pour déclencher les reveals) sur les 24 routes du `index.json` 2. Comparer avec `pixelmatch`/`odiff` 3. Examiner chaque différence | Différence de pixels **nulle** hors des zones explicitement modifiées par la tâche (II.7.4 étape 8, II.7.5) ; hauteur de page identique à ± 2 % sauf ajout documenté ; toute différence non attendue = **FAIL**. Routes : `/`, `/fonctionnalites` (+9 détails), `/tarifs`, `/securite`, `/blog`, `/blog/mise-en-demeure`, `/contact`, 4 légales, `/connexion`, `/inscription`, `/dossier/nouveau` (→ `/connexion?next=…`), `/page-inexistante-404`. ⚠ `index.json` référence des `.png` alors que les fichiers sont des `.jpg` (voir Q4) | visuel | oui — puppeteer-core/Playwright + pixelmatch | 1440 / 390 | PASS (prod 2026-08-23) = référence [CAP] |

---

## 15. Synthèse

| Domaine | Tests | PASS (prod 2026-08-23) | À EXÉCUTER | À VÉRIFIER |
|---|---|---|---|---|
| Navigation & layout | T-001 – T-016 (16) | 7 (partiels : rendu) | 9 | 0 |
| Home | T-017 – T-031 (15) | 13 (rendu) | 2 | 0 |
| Pages fonctionnalités | T-032 – T-035 (4) | 2 | 2 | 0 |
| Tarifs & paiement | T-036 – T-048 (13) | 6 | 6 | 1 |
| Sécurité | T-049 – T-054 (6) | 6 | 0 | 0 |
| Journal | T-055 – T-059 (5) | 3 | 2 | 0 |
| Contact | T-060 – T-064 (5) | 3 | 2 | 0 |
| Légal | T-065 – T-070 (6) | 5 | 1 | 0 |
| Auth | T-071 – T-083 (13) | 3 | 8 | 2 |
| Espace client | T-084 – T-109 (26) | 0 | 25 | 1 |
| Admin global | T-110 – T-117 (8) | 0 | 7 | 1 |
| Notifications e-mail | T-118 – T-121 (4) | 0 | 0 | 4 |
| SEO & crawlers IA | T-122 – T-135 (14) | 12 | 2 | 0 |
| Build / Deploy | T-136 – T-146 (11) | 8 | 3 | 0 |
| **Total** | **146** | **68** | **69** | **9** |

Les « PASS (prod 2026-08-23) » attestent du **rendu** constaté (captures, codes HTTP, fichiers servis) ; les interactions (clics, formulaires, base de données) restent à exécuter lors de la première campagne, qui fixera définitivement la baseline.

---

## 16. Procédure d'exécution

### 16.1 Principes

1. **Jamais sur des données client réelles** : comptes de test A/B dédiés, dossiers titrés `[TEST]`, fichiers fictifs. Aucune commande `DELETE FROM`, `DROP`, `supabase db reset`, `stripe … delete` (garde-fous `.claude/settings.json` + `scripts/guard_destructive.py`, II.3.3). Nettoyage des données de test uniquement via les policies `_own` du compte de test.
2. **Aucun paiement réel** : les Payment Links Stripe sont vérifiés par `HEAD`/`href`, jamais soumis.
3. **Un seul appel** à l'edge function `notify-lead` par campagne (chaque appel envoie un vrai e-mail).
4. Les tests créés sont des **fichiers nouveaux** (`tests/e2e/*.spec.ts`, `tests/http/*.sh`, `tests/unit/*.test.ts`, `playwright.config.ts`, `vitest.config.ts`) : aucune modification de fichier existant hors l'ajout des scripts `test:*` dans `package.json` (diff minimal, II.7.2).
5. L'ordre d'exécution est : Build → HTTP/SEO → Visuel → Fonctionnel public → Auth/App/Admin (E2E) → Performance.

### 16.2 Préparation (une fois)

```bash
cd /Users/Roman_784/Documents/Codex/2026-07-02/contrainte-absolue-ne-pas-toucher-aux/work/www.clair-dossier.com
git switch feature/clairdossier-next
npm ci
# Outils de test (devDependencies, fichiers nouveaux uniquement)
npm i -D @playwright/test vitest pixelmatch pngjs
npx playwright install chromium
# Variables (jamais commitées) : copier .env.example → .env et renseigner VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
# Comptes de test : E2E_USER_A / E2E_PASS_A, E2E_USER_B / E2E_PASS_B, E2E_ADMIN / E2E_ADMIN_PASS (admin de test uniquement)
```

`playwright.config.ts` attendu : deux projets — `desktop` (viewport 1440 × 900, Chromium) et `mobile` (device « iPhone 14 », viewport 390 × 844) ; `baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:4173'` ; `reducedMotion` surchargé par test pour T-015.

### 16.3 Étape 1 — Build (T-136 à T-144)

```bash
git status --porcelain                      # doit être vide (T-139)
npm run typecheck                           # T-137
npm run build                               # T-138 (gen:md + tsc + vite build)
git status --porcelain                      # doit rester vide (T-139)
diff dist/index.html dist/404.html && echo "SPA fallback OK"
cat dist/CNAME                              # www.clair-dossier.com
find dist -name '*.md' | wc -l              # 27 (T-141)
diff dist/index.md dist/page.md && echo "index.md == page.md"
node -e '
const fs=require("fs"),z=require("zlib"),d="dist/assets";
for(const f of fs.readdirSync(d).filter(f=>/\.(js|css)$/.test(f))){const b=fs.readFileSync(`${d}/${f}`);console.log(f,(b.length/1024).toFixed(2),"kB gzip",(z.gzipSync(b).length/1024).toFixed(2));}
'                                           # T-140 : comparer aux plafonds
grep -c "buzgokfmxpmyceppvjpp" dist/assets/index-*.js   # T-142 (≥ 1 avec .env)
npm run preview &                           # T-143, port 4173
```

### 16.4 Étape 2 — HTTP, SEO, sécurité transport (T-122, T-126 à T-134, T-131, T-132)

```bash
BASE=https://www.clair-dossier.com
# Statuts des 26 URLs du sitemap (T-130)
curl -s $BASE/sitemap.xml | grep -o '<loc>[^<]*</loc>' | sed 's/<\/\?loc>//g' | while read u; do
  printf '%s %s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' "$u")" "$(curl -sL -o /dev/null -w '%{http_code}' "$u")" "$u"; done
# Redirections (T-131)
for u in https://clair-dossier.com/ http://clair-dossier.com/ https://clair-dossier.com/tarifs http://www.clair-dossier.com/; do curl -sI "$u" | sed -n '1p;/^location/Ip'; done
# En-têtes (T-132)
curl -sI $BASE/ | grep -iE '^(HTTP|server|cache-control|strict-transport|content-security|x-frame|x-content-type|referrer|permissions)'
# Fichiers crawlers (T-127 à T-129, T-134)
for p in robots.txt llms.txt sitemap.xml index.md page.md tarifs.md securite.md contact.md mentions-legales.md cgv.md politique-confidentialite.md cookies.md fonctionnalites/index.md blog/index.md favicon.svg og-default.svg CNAME; do printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code} %{content_type}' $BASE/$p)" "$p"; done
for s in creation-guidee pieces-ocr chronologie validation-avocat suivi-statuts messagerie-securisee coffre-fort calendrier-relances reponse-auto-mails; do curl -s -o /dev/null -w "%{http_code} fonctionnalites/$s.md\n" $BASE/fonctionnalites/$s.md; done
for s in preparer-rendez-vous-avocat chronologie-prud-homale rgpd-legaltech mise-en-demeure conservation-documents ia-droit mediation-contentieux; do curl -s -o /dev/null -w "%{http_code} blog/$s.md\n" $BASE/blog/$s.md; done
diff <(curl -s $BASE/robots.txt) public/robots.txt && echo "robots.txt identique"
# 404 SPA (T-133)
curl -sI $BASE/page-inexistante | sed -n '1p;/content-length/p'
# Payment Links (T-040) — HEAD uniquement, jamais de soumission
grep -o 'https://buy.stripe.com/[A-Za-z0-9]*' src/data/pricing.ts | sort -u | while read u; do printf '%s %s\n' "$(curl -s -o /dev/null -w '%{http_code}' -L "$u")" "$u"; done
```

### 16.5 Étape 3 — Régression visuelle (T-146)

```bash
# Rejouer le script de capture de référence (mêmes paramètres : Chrome via puppeteer-core, 1440 px / 390 px émulé, défilement progressif)
# Sortie attendue : docs/baseline/runs/<AAAA-MM-JJ>/screens/<route>__{desktop,mobile}.jpg + index.json
# Comparaison (exemple avec pixelmatch sur PNG convertis) :
node -e '
const fs=require("fs"),{PNG}=require("pngjs"),pm=require("pixelmatch");
const [a,b]=process.argv.slice(1).map(p=>PNG.sync.read(fs.readFileSync(p)));
const w=Math.min(a.width,b.width),h=Math.min(a.height,b.height);
const diff=new PNG({width:w,height:h});
console.log("pixels différents:",pm(a.data,b.data,diff.data,w,h,{threshold:0.1}));
' ref.png new.png
```

Règle : tout écart hors zone modifiée déclarée = FAIL. Les captures de référence `docs/baseline/screens/` ne sont **jamais écrasées** ; une nouvelle référence est créée dans un nouveau dossier daté après validation humaine.

### 16.6 Étape 4 — Parcours publics, auth, espace client, admin (Playwright)

```bash
E2E_BASE_URL=http://localhost:4173 npx playwright test --project=desktop --project=mobile tests/e2e/public    # T-001…T-070, T-122…T-125, T-133
E2E_BASE_URL=http://localhost:4173 npx playwright test --project=desktop tests/e2e/auth tests/e2e/app tests/e2e/admin   # T-071…T-117
```

Vérifications REST/storage (T-106 à T-109, T-116, T-117) — exemple :

```bash
SB=https://buzgokfmxpmyceppvjpp.supabase.co; K="$VITE_SUPABASE_ANON_KEY"
JWT_A=$(curl -s "$SB/auth/v1/token?grant_type=password" -H "apikey: $K" -H 'Content-Type: application/json' -d "{\"email\":\"$E2E_USER_A\",\"password\":\"$E2E_PASS_A\"}" | jq -r .access_token)
curl -s "$SB/rest/v1/dossiers?id=eq.$ID_B" -H "apikey: $K" -H "Authorization: Bearer $JWT_A"                      # attendu []
curl -s -X PATCH "$SB/rest/v1/dossiers?id=eq.$ID_B" -H "apikey: $K" -H "Authorization: Bearer $JWT_A" -H 'Content-Type: application/json' -H 'Prefer: return=representation' -d '{"title":"hack"}'   # attendu []
curl -s -X POST "$SB/storage/v1/object/sign/documents/$PATH_B" -H "apikey: $K" -H "Authorization: Bearer $JWT_A" -H 'Content-Type: application/json' -d '{"expiresIn":60}'   # attendu erreur
curl -s -X POST "$SB/rest/v1/rpc/is_admin" -H "apikey: $K" -H "Authorization: Bearer $JWT_A" -d '{}'                # attendu false
```

### 16.7 Étape 5 — Tests unitaires (vitest, à créer)

Cibles sans dépendance réseau, utiles comme filet rapide : `src/data/pricing.ts` (`yearlyTotal`, `yearlyMonthlyEquivalent`, 7 plans, 12 liens), `src/lib/whatsapp.ts` (`buildWhatsAppUrl` → `https://wa.me/<numéro>?text=…`), `src/lib/seo.tsx` (`orgSchema`, `websiteSchema`, `breadcrumbSchema`), `src/data/features.ts` (9 slugs), `src/data/blog/index.ts` (7 slugs, `getPostBySlug`, `getRelatedPosts`), snapshot des 27 sorties de `scripts/gen-markdown.ts`.

```bash
npx vitest run
```

### 16.8 Étape 6 — Performance (T-145)

```bash
npx lighthouse https://www.clair-dossier.com/ --preset=desktop --output=json --output-path=docs/baseline/runs/<date>/lh-home-desktop.json --quiet
npx lighthouse https://www.clair-dossier.com/ --output=json --output-path=docs/baseline/runs/<date>/lh-home-mobile.json --quiet
npx lighthouse https://www.clair-dossier.com/tarifs --preset=desktop --output=json --output-path=docs/baseline/runs/<date>/lh-tarifs-desktop.json --quiet
```

### 16.9 Compte rendu de campagne

Chaque exécution produit `docs/baseline/runs/<AAAA-MM-JJ>/NON_REGRESSION_RUN.md` : une ligne par `T-nnn` avec **PASS / MIGRATED / REPLACED WITH EQUIVALENT / FAIL**, la preuve (capture, sortie de commande, URL), l'exécutant et la date. Les statuts MIGRATED et REPLACED WITH EQUIVALENT doivent pointer vers le mapping `SECTION CURRENT → KEEP/ENHANCE/MOVE/MERGE` (VI.4) ou la décision I.4 (PRESERVE/AUGMENT/ELEVATE) qui les justifie, et vers le commit correspondant.

---

## 17. Règle finale

> **Après chaque migration, chaque insertion (II.7) et avant chaque Inter-Phase Gate (XI.2), les 146 lignes de cette matrice doivent être à 100 % dans l'un des trois états : `PASS`, `MIGRATED` (la fonction existe à un nouvel emplacement ou sous une nouvelle forme, avec redirection/migration documentée) ou `REPLACED WITH EQUIVALENT` (la fonction est rendue par un mécanisme différent mais au moins équivalent pour l'utilisateur, décision I.4 documentée).**
>
> **`LOST` n'existe pas comme état acceptable.** Une ligne `FAIL` non résolue, ou une fonctionnalité d'origine absente de la cible sans MIGRATED/REPLACED justifié, bloque la phase. Les lignes marquées ⚠ (défauts connus de la baseline) peuvent être améliorées — elles ne peuvent pas être supprimées sans que la fonction sous-jacente soit conservée.
>
> Une nouvelle fonctionnalité ajoute des lignes `T-nnn` à la suite (jamais de renumérotation) ; une ligne ne peut être retirée que sur décision humaine explicite et documentée (I.4 DELETE), en conservant son ID avec la mention « retiré le <date>, décision <réf.> ».

---

## 18. Questions ouvertes

| # | Question | Impact sur la matrice |
|---|---|---|
| Q1 | `FEATURE_INVENTORY.md` n'existait pas au moment de la rédaction : les références `F-<DOM>-nn` de §0.4 sont provisoires. À réconcilier dès publication de l'inventaire (même 14 domaines). | Colonne « Fonctionnalité (F-réf.) » à mettre à jour, IDs `T-nnn` inchangés |
| Q2 | Le réglage réel `enable_confirmations` du projet Supabase hébergé (et le SMTP Resend) n'est pas lisible dans le dépôt (`supabase/config.toml:205` = config CLI locale). | T-074, T-075, T-121 restent « À VÉRIFIER » jusqu'à inspection du Dashboard (lecture seule) |
| Q3 | Existence effective de l'admin dans `public.app_admins` en production et déploiement réel de l'edge function `notify-lead` + secret `RESEND_API_KEY`. | T-110 à T-120 |
| Q4 | `docs/baseline/screens/index.json` référence des fichiers `.png` (`"file": "screens/home__desktop.png"`) alors que le dossier contient des `.jpg` (`home__desktop.jpg`, 1440 × 11 541 px). Corriger l'index ou documenter la conversion avant d'automatiser T-146. | T-146 |
| Q5 | Interprétation de « sous-catégories » dans la commande : traitée comme (a) la partition des documents par `kind` (`piece` / `deliverable`) et (b) les catégories de dossier actuelles + typologies héritées (`TYPOLOGY_LABELS`). À confirmer. | T-103 |
| Q6 | Mode LIVE/TEST des 12 Payment Links et activité des 6 liens annuels (possible désactivation par `archiveOld()` si `create-stripe-products.mjs` a été relancé) : à confirmer dans le dashboard Stripe, sans aucune commande de suppression. | T-040 |
| Q7 | Comportement réel du rôle `anon` face aux policies admin (`is_admin()` sans EXECUTE pour `anon`, R11) : `[]` ou erreur 42501 ? | T-108 |
| Q8 | Décision WhatsApp Business sur le 04 91 95 90 32 ou ligne vocale seule (I.5, [IL §5.2]) : détermine la forme « REPLACED WITH EQUIVALENT » des tests T-043, T-060, T-062, T-090, T-091. | Contact / Tarifs / Tunnel |
| Q9 | Les mesures Core Web Vitals (T-145) n'ont jamais été réalisées : la première campagne fixe la baseline chiffrée. | T-145 |

---

## Addendum — Phase 4 « Homepage elevation » (2026-09-14)

Composition cinématique montée derrière le flag `HOME_CINEMATIC` (`src/lib/flags.ts`, ON par défaut sur la branche ; `VITE_HOME_CINEMATIC=false` rétablit la composition historique de `src/pages/Home.tsx`, intacte). Mapping complet : `docs/HOMEPAGE_ELEVATION.md`. Statut de chaque test F-HOME avec le flag ON :

| Test | Statut | Équivalent dans la composition cinématique |
|---|---|---|
| T-017 Hero textes et CTA | **REPLACED WITH EQUIVALENT** | H1 « Des documents dispersés. Un dossier clair. » ; kicker « Plateforme française · dossiers administratifs & juridiques » ; sous-titre conservant l'audience « PME, artisans, indépendants et professions libérales » ; CTA « Commencer avec ClairDossier » → `/inscription`, « Voir comment ça fonctionne » → `#comment-ca-fonctionne` ; lien « Découvrir le parcours dédié » → `/grands-comptes` conservé ; « Demander une démo » → `/rendez-vous` (CTA milieu de page et final). Pills remplacées par la ligne « Compte gratuit, confirmé par e-mail · Sans engagement · Aucune lecture automatique de vos pièces. » (`src/components/landing/HeroCinematic.tsx`) |
| T-018 Hero animations | **REPLACED WITH EQUIVALENT** | Entrée CSS pure : nav 300 ms, mots 300–900 ms (`.cd-word-mask`), sous-titre 0,9 s, CTA 1,1 s, produit 1,3 s ; surligneur sky sur « clair. » (délai 1,05 s) |
| T-019 Hero card | **REPLACED WITH EQUIVALENT** | Carte « Dossier de démonstration » (`demo-dossier.ts`) : référence CD-2026-0918, 5 étapes métier réelles, pièces, échéance, transmission « à votre validation », bloc « Ce que vous devez faire maintenant » ; 3 cartes satellites (sm+) ; flottement CSS 9/11/13 s, parallaxe pointeur desktop |
| T-020 Avant / Après | **REPLACED WITH EQUIVALENT** | `landing/BeforeAfter.tsx` : mêmes 5 + 5 textes (exportés de `AvantApres.tsx`), titres « Le dossier vit dans le désordre. » / « Le dossier vit dans l'ordre. » en `h3` de colonnes, trait or scroll-driven |
| T-021 Grille fonctionnalités | **REPLACED WITH EQUIVALENT** | `landing/FeaturesBento.tsx` : 9 briques, liens « Voir » → `/fonctionnalites/{slug}`, titre « Neuf briques pour structurer un dossier juridique. » (écart n°1 résolu) |
| T-022 Onglets Espaces dédiés | **PASS** | `WorkspacesTabs` réutilisé tel quel (déplacé après « Pour qui ») |
| T-023 Workflow 6 statuts | **MERGED** | Chapitre 03 `landing/ChapterTimeline.tsx` : les 6 statuts de `statuses.ts` dans l'ordre, phrase « Six statuts, aucun « entre-deux » » conservée ; trait qui se dessine au scroll |
| T-024 Cycle de vie | **PASS** | `DossierLifecycle` réutilisé tel quel |
| T-025 Bloc sécurité | **REPLACED WITH EQUIVALENT** | `landing/TrustChapter.tsx` : mêmes 6 titres et textes (exportés de `SecurityBlock.tsx`), CTA « Centre de confiance » → `/securite` + « État du produit, daté » → `/etat-du-produit` |
| T-026 Aperçu tarifs | **REPLACED WITH EQUIVALENT** | `landing/PricingCinematic.tsx` : mêmes 3 formules et `href` Stripe exacts (mensuel) ; sélecteur Mensuel / Annuel (liens `ctaHrefYearly`) ; lien « Voir les 7 formules et le détail » → `/tarifs` |
| T-027 Aperçu journal | **PASS (écart n°2 résolu)** | `BlogPreview limit={3}` — 3 cartes, conformément au titre |
| T-028 FAQ | **PASS** | `FaqBlock` réutilisé tel quel |
| T-029 CTA final | **REPLACED WITH EQUIVALENT** | `landing/FinalCinematic.tsx` : « Transformez vos dossiers en décisions claires. », CTA `/inscription` + `/rendez-vous` + lien « Se connecter » |
| T-030 JSON-LD Home | **PASS** | Mêmes 4 schémas (Organization, WebSite, SoftwareApplication, FAQPage) |
| T-004 Header scrollé | **PASS (augmenté)** | Classe `cd-nav-enter` (fondu 300 ms) ; padding vertical réduit au-delà de 24 px sur ≥ 1024 px uniquement (`lg:py-2.5`), menu mobile inchangé |
| T-015 Reduced motion | **PASS (augmenté)** | Toutes les scènes rendent leur état final statique ; sélecteurs « Pour qui » et « Mensuel / Annuel » sans transition |

Nouveaux tests : `tests/home-landing.test.ts` (flag, étiquetage « Dossier de démonstration », libellés réels, frise = 6 statuts, aucune capacité non opérationnelle mise en scène, calendrier cohérent).

---

## Addendum — application mobile & extraction de la logique partagée (2026-09-16)

Chantier `feature/mobile-app` : ajout de `mobile/` (Expo) et de `packages/core`
(logique métier partagée). Le site web n'a subi **aucun changement de
comportement** ; seules des redéfinitions locales ont été remplacées par des
imports du cœur partagé.

### Fichiers du site touchés (diffs additifs, API publique inchangée)

| Fichier | Nature du changement | Contrôle |
|---|---|---|
| `src/lib/dossier-workspace.ts` | réexporte `packages/core` ; conserve `validateUpload(File)`, les sondes de capacités et `logDossierEvent` | tous les imports existants (`DossierDetail`, `DossierFlow`, `Account`, `AdminConsole`) compilent sans modification |
| `src/pages/DossierFlow.tsx` | `PROFILS`, `CATEGORIES`, champs et `fieldsFor` importés au lieu d'être redéfinis ; `sanitizeName` → `sanitizeFileName` (implémentation identique) | mêmes valeurs écrites dans `dossiers.typology` et `dossiers.answers` |
| `src/pages/DossierDetail.tsx` | `STATUS_LABELS`, `TYPOLOGY_LABELS`, étapes, `currentStep`, `ANSWER_LABELS`, `isDateKey` importés au lieu d'être redéfinis | libellés affichés strictement identiques |
| `tsconfig.json` | `packages/core/src` ajouté à `include` | typecheck vert |

Aucune route, aucune classe CSS, aucune colonne, aucune policy n'a été renommée
ni supprimée. Aucune migration existante n'a été modifiée.

### Résultats

| Test | Attendu | Obtenu |
|---|---|---|
| `npm run typecheck` | 0 erreur | **PASS** |
| `node --import tsx --test tests/*.test.ts` | tous verts | **PASS** — 70/70 (39 existants + 31 nouveaux sur `packages/core`) |
| `npm run build` (gen:md + gen:sitemap + tsc + vite + prerender) | 32 routes pré-rendues | **PASS** |
| Bundle principal | pas de régression de poids | 212,91 Ko / 62,89 Ko gzip |
| Comportement des écrans dossier / compte / admin | identique | **PASS** (mêmes libellés, mêmes requêtes, mêmes écritures) |

### Base de données

Une migration **additive** est livrée mais **non appliquée** :
`20260916120000_mobile_push_tokens.sql` (table `device_push_tokens` + RLS
`_own`). Elle ne touche à aucune table existante ; le site et l'application
fonctionnent à l'identique tant qu'elle n'est pas appliquée.

La fonction Edge `delete-account` est livrée mais **non déployée** (suppression
de compte exigée par les magasins ; l'application le détecte et propose la voie
écrite tant que la fonction est absente).
