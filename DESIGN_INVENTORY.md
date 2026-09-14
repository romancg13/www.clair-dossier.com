# DESIGN_INVENTORY — ClairDossier v1 (Phase 0C · UI Inventory)

**Statut** : livrable Phase 0C (MASTER_PROMPT PARTIE III.3). Socle du futur « ClairDossier Design System 2.0 » (PARTIE VI.1 : *évolution du design original, jamais un rebranding sans continuité*).
**Date** : 2026-08-23. **Référence code** : dépôt `www.clair-dossier.com`, branche `feature/clairdossier-next` (code identique à `main`, dernier commit `24e1e2b` du 2026-07-02 « Ameliore les animations visuelles premium »). Build local du jour : typecheck OK, `vite build` OK (941 ms), hashes `react`/`supabase`/`motion`/`router`/CSS identiques à la production GitHub Pages.
**Mode** : lecture seule — aucun fichier existant modifié, aucune commande git modifiante. Ce document est un **inventaire**, pas une proposition de redesign (I.2 *Original First*).

**Sources** : lecture directe de `src/index.css` (375 l.), `src/components/ui/*.tsx`, `src/components/primitives/*.tsx`, `Nav.tsx`, `Footer.tsx`, `Logo.tsx`, `Layout.tsx`, `icons.tsx`, `RequireAuth.tsx`, `App.tsx`, sections Home, pages `Login`, `Signup`, `Contact`, `Pricing`, `Security`, `Account`, `DossierFlow`, `DossierDetail`, `BlogPost`, `PLAN.md`, `index.html`, CSS compilé `dist/assets/index-B6lhu7zR.css` ; rapports d'audit Phase 0 (design, public-content, app-auth, live-site, routes-seo, stripe-pricing, supabase, identity-legal) ; captures du site live `docs/baseline/screens/*.jpg` (48 fichiers ; `index.json` les référence en `.png` — écart de nommage, à corriger dans l'index, pas dans les captures).
**Convention** : chaque fait cite `fichier:ligne` (chemins relatifs à la racine du dépôt). « Indicatif » = calcul WCAG 2.x effectué sur les hex des tokens ; les couleurs Tailwind par défaut (red/emerald/amber) sont en `oklch` dans le CSS compilé et converties approximativement. « À VÉRIFIER » = non confirmé au rendu navigateur.

---

## Sommaire

1. Couleurs · 2. Typographie · 3. Boutons · 4. Cards · 5. Inputs / formulaires · 6. Navbar · 7. Footer · 8. Modals / overlays · 9. Icônes · 10. Animations & motion · 11. Grilles & containers · 12. Spacing · 13. Radius · 14. Shadows · 15. Patterns signature · 16. ADN à préserver · 17. Lacunes · Annexe

---

## 0. Architecture du styling (contexte)

| Élément | Fait | Source |
|---|---|---|
| Moteur CSS | Tailwind v4 via `@import "tailwindcss"` + plugin `@tailwindcss/vite` | `src/index.css:1`, `vite.config.ts:3,24` |
| Tokens | bloc unique `@theme` (17 couleurs, 3 familles, 6 radii, 4 ombres, 2 easings) | `src/index.css:15-62` |
| CSS global hors `@layer` | base, focus, hairlines, sheen, marker, couche `premium-*`, formulaires, drop cap, reduced-motion | `src/index.css:64-375` |
| Import | une seule feuille, importée dans `src/main.tsx:6` ; un seul CSS émis (`index-B6lhu7zR.css`, 100,11 kB / 27,43 gzip) | `vite.config.ts:28` (`cssCodeSplit` sans effet) |
| Composants réutilisables | `ui/` : `Button`, `Pill`, `Card`, `Tabs`, `Accordion` ; `primitives/` : `Reveal`/`Stagger`, `SplitWords`, `MarkerHighlight`, `Marquee`, `Magnetic` | `src/components/ui/`, `src/components/primitives/` |
| Composants **non utilisés** | `Button`, `Pill`, `Card`, `Marquee`, `Magnetic` ne sont importés nulle part (grep `components/ui`, `primitives/Marquee`, `primitives/Magnetic` → 0 consommateur) ; les boutons/pills/cards réels sont écrits **inline** en classes Tailwind dans ~20 fichiers | audit design §2-3 ; `grep -rn "from '../ui/\|/ui/Button\|Pill'\|Card'"` |
| Thème sombre | aucun (`grep dark:` → 0 ; `<meta name="color-scheme" content="light">` `index.html:8` ; `theme-color #0d1b3d` `index.html:6`) | — |
| Images | aucune image raster dans `public/` ni `src/` ; identité 100 % typographie + couleur + hairlines + SVG inline | `ls public` ; audit design §8.11 |

---

## 1. Couleurs

### 1.1 Tokens `@theme` (17) — `src/index.css:17-38`

| Token | Hex / valeur | Ligne | Rôle observé | Contraste indicatif (texte) |
|---|---|---|---|---|
| `navy-900` | `#0d1b3d` | `:17` | Texte fort, fonds sombres (`WorkspacesTabs.tsx:8`, `FinalCTA.tsx:7`, carte « Avec » `AvantApres.tsx:68`), logo (`Logo.tsx:11`), `theme-color` (`index.html:6`), frise d'étapes (`DossierFlow.tsx:445`) | sur cream-50 **16,08:1** · sur white 16,92:1 · sur gold-500 **7,08:1** (texte des CTA or) |
| `navy-800` | `#152348` | `:18` | Hover logo (`Logo.tsx:11`), hover CTA navy (`Hero.tsx:102`, `Nav.tsx:75`), fond tablist `bg-navy-800/40` (`Tabs.tsx:24`) | — |
| `navy-700` | `#1e2c52` | `:19` | Citations blog (`BlogPost.tsx:255`), fin de dégradé OG (`og-default.svg`) | — |
| `navy-600` | `#2a3960` | `:20` | **Défini, aucun usage** (`grep navy-600 src/**/*.tsx` → 0) | — |
| `gold-500` | `#c4a456` | `:22` | Accent unique : CTA primaire (`Hero.tsx:90`), indicateur d'onglet (`Tabs.tsx:44`), ligne Workflow (`Workflow.tsx:48`), points 4–6 px (`Hero.tsx:139,144`), bordure hover cards (`FeaturesGrid.tsx:33`), lettres du logo, eyebrows **sur navy** (`FinalCTA.tsx:26`, `WorkspacesTabs.tsx:19`), filet citations (`BlogPost.tsx:254`) | sur navy-900 **7,08:1** ✓ · sur cream-50 **2,27:1** ✗ (jamais utilisé comme texte sur fond clair — vérifié par grep `text-gold-500`, 12 occurrences toutes sur navy ou en icône) |
| `gold-400` | `#e6c97d` | `:23` | Anneau de focus (rgba 230,201,125 `:119`), grille `premium-tech-section` (`:201-202`) | non-texte |
| `gold-300` | `#f0d99a` | `:24` | **Défini, aucun usage** | — |
| `gold-700` | `#7a5f28` | `:26` | Commentaire code « texte uniquement sur fond clair — 5.3:1 sur cream-50 » (`:25`). Eyebrows mono (`Hero.tsx:44`, 28 occ. `text-gold-700` avec `tracking-[0.2em]`), labels focus formulaires (`:289`), astérisque requis (`Contact.tsx:217`), hover liens (`FeaturesGrid.tsx:46`), icône « limité » (`Pricing.tsx:585`) | sur cream-50 **5,71:1** ✓ · sur white 6,01:1 ✓ · sur cream-100 5,29:1 ✓ · sur `gold-500/10` 5,31:1 ✓ |
| `cream-50` | `#fbf9f4` | `:28` | Fond de page (`:66`, `Layout.tsx:25`, `index.html:47`), fond des inputs (`Login.tsx:32`), texte sur navy | comme texte sur navy-900 **16,08:1** ✓ |
| `cream-100` | `#f5f0e6` | `:29` | Cards alternées (`AvantApres.tsx:26`), fond footer à 60 % (`Footer.tsx:27`), lien nav actif (`Nav.tsx:59`), bouton tertiaire (`Account.tsx:124`), encarts (`DossierFlow.tsx:945,962`), pastille icône (`FeaturesGrid.tsx:35`) | navy-900 dessus 14,90:1 ✓ · slate-500 dessus 5,30:1 ✓ |
| `cream-200` | `#ebe2cf` | `:30` | Hover des boutons tertiaires (`Account.tsx:124`, `DossierFlow.tsx:688,1041`, `Button.tsx:11`) | — |
| `ink` | `#0a1228` | `:32` | Couleur de texte de base (`:67`, `Layout.tsx:25`), carré logo OG (`og-default.svg:23`) | sur cream-50 **17,66:1** ✓ |
| `slate-500` | `#5a6378` | `:33` | Texte secondaire (paragraphes, footer, nav inactive, labels de champs `Login.tsx:54`) | sur cream-50 **5,72:1** ✓ · sur white 6,02:1 ✓ |
| `slate-400` | `#7c8497` | `:34` | Flèche de ligne dossier (`Account.tsx:184`), URL OG | sur white 3,75:1 (icône, ≥ 3:1 ✓) |
| `slate-300` | `#a3aab9` | `:35` | Séparateurs breadcrumb `/` (`BlogPost.tsx:100`, `FeatureDetail.tsx:44`, `LegalPage.tsx:36`), ligne de fond Workflow `/40` (`Workflow.tsx:43`), **texte des fonctionnalités « ✗ » des cards tarifs claires** (`Pricing.tsx:452`), icônes specs (`PricingPreview.tsx:59`), ligne d'étapes `/40` (`DossierFlow.tsx:457`) | sur white **2,33:1** ✗ (texte « ✗ » des plans clairs — constat, cf. §17) |
| `sky-marker` | `rgba(179,210,239,0.6)` | `:37` | Surligneur du H1 (`:160`), `::selection` (`:83`), halo hero (`:181`) | ink sur marker blendé (#d0e2f1) 13,97:1 ✓ |
| `sky-marker-deep` | `rgba(150,190,230,0.8)` | `:38` | **Défini, aucun usage hors `index.css`** | — |

Écart documentaire : `PLAN.md:43-55` liste 10 tokens ; l'implémentation en compte 17 (`navy-600`, `gold-300`, `gold-700`, `cream-200`, `slate-400`, `slate-300`, `sky-marker-deep` ajoutés). Trois tokens sont sans usage (`navy-600`, `gold-300`, `sky-marker-deep`).

### 1.2 Couleurs dérivées par opacité (rgba en dur ou `/xx`)

| Usage | Valeur | Source | Note |
|---|---|---|---|
| `.hairline` | `rgba(13,27,61,0.08)` | `index.css:124` | bordure standard (≈ 106 occurrences grep) ; blendée sur cream-50 → `#e8e7e5`, **1,17:1** (non-texte < 3:1, constat) |
| `.hairline-strong` | `rgba(13,27,61,0.12)` | `:125` | 6 occ. (dropzone `DossierFlow.tsx:806`, pastilles d'étape inactives `:446`) ; 1,27:1 |
| `.hairline-gold` | `rgba(196,164,86,0.35)` | `:126` | 25 occ. (pills, badges statut, soulignés de liens `Footer.tsx:52`) ; 1,30:1 |
| Fond pill or | `bg-gold-500/12`, `/10`, `/15`, `/5` | `Account.tsx:177`, `:90`, `FeaturesGrid.tsx:35`, `DossierDetail.tsx:173` | teintes or très diluées (≈ `#f8f4eb` sur blanc) |
| Texte sur navy | `text-cream-50/50…/90` (33 occ. : `/70` ×10, `/75` ×10, `/60` ×4, `/80` ×3, `/90` ×3, `/85`, `/65`, `/50`) | `FinalCTA.tsx:32`, `Pricing.tsx:448-453`, `Tabs.tsx:38` | `/75` ≈ `#bfc2c6` 9,44:1 ✓ · `/60` ≈ `#9ca0ab` 6,48:1 ✓ |
| Bordures sur navy | `border-cream-50/15`, `/20`, `/25`, `/55` | `Tabs.tsx:24`, `FinalCTA.tsx:47`, `Pricing.tsx:455` | — |
| Header scrollé | `bg-cream-50/92` ; non scrollé `bg-cream-50/70` | `Nav.tsx:44-45` | — |
| Backdrop menu mobile | `bg-navy-900/30` | `Nav.tsx:138` | — |
| Halos or | `rgba(196,164,86,0.05…0.22)` | `index.css:180,203,229`, `WorkspacesTabs.tsx:14`, `FinalCTA.tsx:21` | — |
| Filets or FinalCTA | `via-gold-500/60` | `FinalCTA.tsx:10,14` | — |

### 1.3 Couleurs hors palette (Tailwind par défaut, fonctionnelles)

| Classe | Valeur compilée (oklch → hex approx.) | Usage | Contraste indicatif |
|---|---|---|---|
| `bg-red-50` / `text-red-700` | `#fef2f2` / `#c10007` | message d'erreur auth (`Login.tsx:66`, `Signup.tsx:130`) | 5,88:1 ✓ |
| `text-red-600` | `#e7000b` | erreur inline (`DossierFlow.tsx:671`, `DossierDetail.tsx:205,741`), hover « Retirer » (`DossierFlow.tsx:836`) | sur white 4,76:1 ✓ · sur cream-50 4,53:1 ✓ |
| `border-red-400` | `#ff6467` | bordure input invalide (`DossierFlow.tsx:664`) | non-texte |
| `bg-emerald-100` / `text-emerald-700` | `#d0fae5` / `#007a55` | badge « −10 % » (`Pricing.tsx:181`), badge `gratuit` (code mort, `Pricing.tsx:464`, `PricingPreview.tsx:71`) | 4,73:1 ✓ |
| `bg-emerald-100` / `text-emerald-600` | `#d0fae5` / `#009966` | pastille succès fin de tunnel (`DossierFlow.tsx:1014`) | icône 3,23:1 ✓ |
| `text-emerald-500` | `#00bc7d` | coche « ✓ » des matrices tarifs (`Pricing.tsx:581`) | sur white **2,46:1** (icône < 3:1, constat) |
| `bg-amber-50` / `text-amber-700` | `#fffbeb` / `#bb4d00` | avertissement « non enregistré » (`DossierFlow.tsx:1026`) | 4,87:1 ✓ |
| `#25D366` (WhatsApp) | littéral | `Contact.tsx:75` (`bg-[#25D366]/12 text-[#25D366]`), `Pricing.tsx:284` | couleur de marque tierce, hors tokens |
| `bg-white` | `#fff` | cards blanches (`FeaturesGrid.tsx:33`, `Login.tsx:51`), inputs au focus | — |

Sémantique : **aucun token sémantique** (`success`, `warning`, `danger`, `info`) n'existe ; les états fonctionnels empruntent directement l'échelle Tailwind. Le **sky-marker** est la seule « couleur d'information » et elle est réservée au surligneur/sélection.

### 1.4 Règle de dosage constatée

« Or = 5-8 % de la surface visible, jamais plus » (`PLAN.md:142`) : traduit dans le code par un or réservé aux CTA, points 4 px, eyebrows (en `gold-700` sur clair), hairlines or à 35 % et halos ≤ 22 % — vérifiable sur `docs/baseline/screens/home__desktop.jpg` (deux CTA or visibles dans le hero, une ligne or dans le Workflow, un bloc FinalCTA à filets or).

---

## 2. Typographie

### 2.1 Familles et graisses

| Token | Pile | Graisses chargées (`@fontsource`, `^5.2.5`) | Source |
|---|---|---|---|
| `--font-display` | `"Cormorant Garamond", "Iowan Old Style", Georgia, serif` | 400, 500, 500 italic, 600, 700 | `index.css:41`, `:3-7` |
| `--font-sans` | `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` | 300, 400, 500, 600 | `:42`, `:8-11` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace` | 400, 500 | `:43`, `:12-13` |

Faits : `font-display: swap` (fourni par `@fontsource`, commentaire `index.html:38-39`) ; aucun `<link rel="preload">` ; 124 `@font-face` émis (tous sous-ensembles Unicode) pour ≈ 2,1 Mo de fichiers déployés, seuls latin/latin-ext téléchargés (36–49 kB chacun, BUILD_INFO) ; **Inter 300 chargée mais jamais utilisée** (`grep font-light` → 0) ; `font-bold` utilisé une seule fois (logo `Logo.tsx:11`, Cormorant 700).

### 2.2 Réglages de base

| Règle | Valeur | Source |
|---|---|---|
| `html` | `font-feature-settings: "ss01", "cv11", "calt"` (variantes stylistiques Inter), antialiasing, `optimizeLegibility` | `index.css:68-71` |
| `body` | `font-family: var(--font-sans); font-weight: 400; line-height: 1.55` | `:74-77` |
| `h1…h6` | `color: inherit; font-weight: 600; letter-spacing: -0.015em` | `:93-97` |
| `.font-display` | `font-family: var(--font-display); font-feature-settings: "liga", "kern"` (hors `@layer`, doublonne l'utilitaire Tailwind) | `:88-91` |
| `::selection` | fond `sky-marker`, texte navy-900 | `:82-85` |

### 2.3 Échelle typographique réellement utilisée (grep `src/`)

| Rôle | Classes exactes | Occurrences | Exemples |
|---|---|---|---|
| H1 hero | `font-display text-[clamp(2.1rem,7vw,5.4rem)] leading-[0.98] tracking-tight sm:leading-[0.96]` | 1 | `Hero.tsx:47` |
| H1 pages internes | `font-display text-4xl font-semibold leading-[1.05] text-navy-900 sm:text-5xl` | 13× `leading-[1.05]` | `Login.tsx:47`, `DossierFlow.tsx:418`, `Account.tsx:117` |
| H1 blog | `text-4xl sm:text-5xl leading-[1.08]` | 1 | `BlogPost.tsx:113` |
| H2 section | `font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl` | 33× `text-4xl`, 26× `text-5xl` | `Workflow.tsx:27`, `FeaturesGrid.tsx:17` |
| H2 FinalCTA | `text-4xl sm:text-6xl leading-[1.05]` (9× `text-6xl` au total) | — | `FinalCTA.tsx:29` |
| H2 card Avant/Après | `text-3xl sm:text-4xl leading-tight` | — | `AvantApres.tsx:30,72` |
| H3 card | `font-display text-xl font-semibold leading-snug` / `text-2xl sm:text-3xl` (plans) | 15× `text-xl`, 25× `text-2xl`, 19× `text-3xl` | `FeaturesGrid.tsx:38`, `Pricing.tsx:478` |
| Prix | `font-display text-5xl font-semibold leading-none` | — | `Pricing.tsx:497` |
| Corps | `text-sm` (152) / `text-base` (21) + `leading-relaxed` (70) | — | `Accordion.tsx:54` |
| Eyebrow (kicker) | `font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700` (28) ; variante `text-[0.7rem] tracking-[0.18em]` (34) | 63× `text-[0.7rem]` | `Hero.tsx:44`, `DossierDetail.tsx:528` |
| Label de champ | `font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500` (26× `tracking-[0.16em]`) | — | `Login.tsx:54`, `Contact.tsx:215` |
| Micro-meta | `font-mono text-[0.7rem] uppercase tracking-[0.14em]` (13) ; `text-[0.65rem]` (15) ; `text-[0.62rem]` (1) | — | `Account.tsx:165`, `Security.tsx:214`, `DossierDetail.tsx:586` |
| Citation blog | `font-display text-2xl italic leading-snug text-navy-700 sm:text-[1.65rem]` | — | `BlogPost.tsx:255` |
| Chapô / H3 blog | `font-display italic` (12 occ. de `italic`) | — | `BlogPost.tsx:116,248,290` |
| Drop cap | Cormorant 600, `4.2em`, `line-height .85`, désactivé < 640 px | — | `index.css:337-355` |
| Wordmark | `font-display text-[1.05rem] font-semibold` + tagline `text-[0.7rem] text-slate-500` | — | `Logo.tsx:18-21` |
| Fallback route | `font-mono text-xs uppercase tracking-[0.18em] text-slate-500` « Chargement… » | — | `App.tsx:39`, `RequireAuth.tsx:17` |

Poids : `font-semibold` 114, `font-medium` 78, `font-normal` 1, `font-bold` 1. Interlignages : `leading-relaxed` 70, `leading-tight` 41, `leading-snug` 11, `leading-none` 8. Lettrage : seules 4 valeurs de `tracking-[…]` (0.14 / 0.16 / 0.18 / 0.2 em) + `tracking-tight` ×2.

Tailles sous 12 px (constat, §17) : `text-[0.7rem]` = 11,2 px, `text-[0.72rem]` = 11,5 px, `text-[0.68rem]` = 10,9 px, `text-[0.65rem]` = 10,4 px, `text-[0.62rem]` = 9,9 px — toutes en mono capitales espacées (eyebrows, labels, badges).

Typographie française appliquée dans le copy : guillemets « », espaces avant `:` `?` `!`, tirets cadratins, nombres espacés (audit public-content §6.3).

---

## 3. Boutons

### 3.1 Composant `Button` — `src/components/ui/Button.tsx` (**non utilisé** dans l'app)

| Aspect | Détail | Ligne |
|---|---|---|
| Base | `inline-flex items-center justify-center gap-2 rounded-full font-semibold leading-none transition-[background-color,transform,box-shadow,border-color] duration-200` | `:58` |
| `primary` | `sheen bg-gold-500 text-navy-900 shadow-gold hover:-translate-y-0.5 hover:shadow-gold-strong` | `:8-9` |
| `secondary` | `bg-navy-900 text-cream-50 hover:bg-navy-800 hover:-translate-y-0.5` | `:10` |
| `ghost` | `bg-cream-100 text-navy-900 hover:bg-cream-200` | `:11` |
| `outline` | `border hairline bg-transparent text-navy-900 hover:border-gold-500` | `:12` |
| Tailles | `sm` `px-3.5 py-2 text-sm` · `md` `px-5 py-3 text-sm` · `lg` `px-6 py-3.5 text-base` | `:15-19` |
| Polymorphisme | `to` → `<Link>`, `href` → `<a>`, sinon `<button>` | `:65-84` |
| Disabled | `opacity-60 cursor-not-allowed` (bouton seulement) | `:81` |
| Focus | aucune classe ; repose sur `*:focus-visible` global | `index.css:116-121` |

### 3.2 Variants **réellement rendus** (inline, classes exactes)

| Variant (nom proposé pour l'inventaire) | Classes exactes | Où | États codés |
|---|---|---|---|
| **Primaire or** | `sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-gold-strong` (+ `ArrowRightIcon 14px strokeWidth 2` avec `group-hover:translate-x-0.5`) | `Hero.tsx:88-99`, `FinalCTA.tsx:38-44`, `FeaturesIndex.tsx:111`, `NotFound.tsx:19`, `DossierDetail.tsx:458`, `DossierFlow.tsx:1031` | hover (lévitation −2 px + ombre or forte + sheen + `saturate(1.05)` `index.css:321`), focus-visible global, **disabled** `disabled:cursor-not-allowed disabled:opacity-60` (`Login.tsx:74`) ou `/50` (`DossierFlow.tsx:696`), **loading** = libellé remplacé (« Connexion… », « Création… », « Envoi… ») et icône retirée (`Login.tsx:76-77`, `Signup.tsx:147`, `DossierFlow.tsx:997`) |
| Primaire or — taille nav | `sheen rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5` | `Nav.tsx:95`, `:80` ; pleine largeur mobile `:179,196` | hover |
| Primaire or — compact | `px-5 py-3` (`Account.tsx:136`) ; `px-5 py-2.5` (label-bouton fichier admin `DossierDetail.tsx:716`) | — | hover ; « Envoi… » |
| **Secondaire navy** | `rounded-full bg-navy-900 px-6 py-3.5 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800` | `Hero.tsx:100-105`, `Nav.tsx:74` (« Mon compte », `px-4 py-2.5`) | hover |
| Navy compact (actions dossier) | `rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-navy-800 disabled:opacity-60` | `DossierDetail.tsx:641,683` (zip) | hover, disabled pendant `zipping` |
| **Tertiaire cream** | `rounded-full bg-cream-100 px-5 py-3 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-200` | `DossierFlow.tsx:688,766,849`, `Account.tsx:124` (« Se déconnecter », `py-2.5`), `:1041` | hover |
| **Outline clair** | `inline-flex items-center gap-2 rounded-full border hairline bg-white px-5 py-3.5 text-sm font-medium text-navy-900 transition-colors hover:border-navy-900 disabled:opacity-60` | `DossierFlow.tsx:986` (« E-mail ») | hover, disabled |
| **Outline sur navy** | `rounded-full border border-cream-50/20 bg-transparent px-6 py-3.5 text-sm font-medium text-cream-50 transition-colors hover:border-cream-50/50` | `FinalCTA.tsx:45-50`, `FeaturesIndex.tsx:104` | hover |
| **Texte nav** | `rounded-full px-4 py-2.5 text-sm font-medium text-navy-900 hover:bg-cream-100` | `Nav.tsx:88` (« Se connecter ») | hover |
| **CTA de plan (clair)** | `rounded-xl px-5 py-3.5 text-sm font-medium border hairline bg-white text-navy-900 hover:border-navy-900 hover:bg-cream-100/60` — **seul bouton non capsule** (`rounded-xl`) | `Pricing.tsx:454-547` | hover |
| CTA de plan (sombre) | `border border-cream-50/25 bg-transparent text-cream-50 hover:border-cream-50/55 hover:bg-cream-50/5` | `Pricing.tsx:455` | hover |
| **Lien souligné or** | `font-medium text-navy-900 border-b hairline-gold pb-0.5 transition-colors hover:text-gold-700` | `DossierDetail.tsx:186,192`, `DossierFlow.tsx:977`, `Contact.tsx:248`, `Footer.tsx:52` | hover |
| Lien « Voir → » | `inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 hover:text-gold-700` + flèche | `FeaturesGrid.tsx:44-50`, `DossierFlow.tsx:576` | hover |
| Lien inline | `font-medium text-navy-900 underline decoration-gold-500 underline-offset-4` | `Login.tsx:85`, `Signup.tsx:158` | — |
| Lien retour | `text-sm font-medium text-slate-500 hover:text-navy-900` « ← Retour… » | `DossierDetail.tsx:441` | hover |
| Action destructive | `text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50` (« Supprimer », « … » pendant suppression) ; `text-slate-500 hover:text-red-600` (« Retirer ») | `DossierDetail.tsx:205-207`, `DossierFlow.tsx:836` | hover, disabled |
| Burger | `grid h-11 w-11 place-items-center rounded-md border hairline lg:hidden` (SVG 18×14, 3 traits dont le 3e court `x2=11`, `strokeWidth 1.8`) | `Nav.tsx:103-125` | `aria-expanded`, icône ↔ croix |
| Boutons-cartes de sélection | profil : `rounded-2xl border p-6 … hover:-translate-y-1` ; sélectionné `border-gold-500 bg-white shadow-card-hover`, sinon `hairline bg-white hover:border-gold-500 hover:shadow-card` | `DossierFlow.tsx:561-565` ; catégories `:611-646` ; sujets contact `rounded-xl border p-3` sélectionné `border-gold-500 bg-cream-50` (`Contact.tsx:135-139`) | hover, selected |
| Toggle segmenté | conteneur `inline-flex rounded-full border hairline bg-white p-1 shadow-card` ; option `min-h-[40px] rounded-full px-5 py-2 text-sm font-medium` ; indicateur `motion.span layoutId="billing-pill" bg-cream-100` spring 380/32 ; `aria-pressed` | `Pricing.tsx:142-186` | active/inactive |
| Onglets (navy) | `Tabs.tsx` : tablist `rounded-full border border-cream-50/15 bg-navy-800/40 p-1 backdrop-blur`, onglet actif texte navy sur pastille or `layoutId="tab-active"` | `Tabs.tsx:24-49` | active, hover (`hover:text-cream-50`) |
| Onglets (clair, app) | `-mb-px rounded-t-lg px-4 py-2.5 text-sm font-medium` ; actif `border-b-2 border-gold-500 text-navy-900` ; inactif `text-slate-500 hover:text-navy-900` ; `role="tablist"/"tab"` sans navigation clavier | `DossierDetail.tsx:502-522` | active, hover |

Constats transversaux :
- **Géométrie** : tous les boutons sont des capsules `rounded-full` (89 occ.), sauf le CTA des plans (`rounded-xl`) et le burger (`rounded-md`).
- **Hauteur** : pas de token ; hauteur implicite ≈ 44–46 px (`py-3.5` + `text-sm`), 40–42 px (`py-2.5`), `min-h-[40px]` / `min-h-[44px]` explicites uniquement sur toggle, onglets et accordéon (`Accordion.tsx:25`).
- **Focus** : anneau global `outline 2px navy-900 + box-shadow 0 0 0 4px rgba(230,201,125,.95)` (`index.css:116-121`) ; exception locale `focus-visible:ring-2 focus-visible:ring-gold-500/40` (`DossierDetail.tsx:545`). Le `border-radius: 2px` imposé par la règle globale à l'anneau (`:120`) ne suit pas la capsule — À VÉRIFIER au rendu.
- **Sheen** : 20 occurrences (`grep sheen`) ; double déclaration `.sheen` (`index.css:129` et `:272`), la seconde impose `transition: transform 180ms / box-shadow 360ms / filter 360ms` hors `@layer`, donc prioritaire sur `transition-all duration-300` des boutons — À VÉRIFIER au rendu (audit design A3).
- **Pas d'état `active`/pressed** codé (aucun `active:`), pas de variante « icône seule », pas de variante « danger » pleine, pas de taille `lg` utilisée hors composant mort.

---

## 4. Cards

### 4.1 Composant `Card` — `src/components/ui/Card.tsx` (**non utilisé**)

`rounded-xl p-6 transition-[border-color,box-shadow,transform] duration-300` (`:26`) ; variants `white` (`bg-white border hairline shadow-card`), `cream` (`bg-cream-100 border hairline-strong`), `navy` (`bg-navy-900 text-cream-50 border border-navy-800`) (`:7-9`) ; `interactive` → `motion[as]` `whileHover y:-4` 0,25 s + `hover:border-gold-500 hover:shadow-card-hover` (`:28-38`) ; `useReducedMotion` → statique (`:25,41`).

### 4.2 Familles de cards réellement rendues

| Famille | Classes exactes | Padding | Radius | Hover | Sources |
|---|---|---|---|---|---|
| **Card feature (premium)** | `premium-card group relative flex h-full flex-col rounded-xl border hairline bg-white p-6 transition-colors duration-300 hover:border-gold-500` + `whileHover y:-4` | `p-6` | `xl` (1,5 rem) | bordure or, `translate3d(0,-6px)`, `shadow-card-hover`, `saturate(1.03)`, voile dégradé or→sky via `::after`, icône `scale(1.035)` (`index.css:301-313`) | `FeaturesGrid.tsx:30-34`, `FeaturesIndex.tsx:60-82` |
| **Card blanche standard** | `rounded-2xl border hairline bg-white p-7 shadow-card` (+ `sm:p-9`) | `p-7`/`p-8`/`p-9` | `2xl` (1 rem) | aucun | `Login.tsx:51`, `DossierFlow.tsx:723,796`, `DossierDetail.tsx:527`, `Account.tsx:146` (état vide `p-8 text-center`) |
| **Card hero (pièce à conviction)** | `premium-card premium-preview-card relative rounded-2xl border hairline bg-white p-7 shadow-card` + flottement 8 s | `p-7` | `2xl` | premium-card | `Hero.tsx:129` |
| **Card crème** | `rounded-2xl border hairline bg-cream-100 p-7 sm:p-9` (Avant) ; encarts `rounded-xl bg-cream-100 p-5` ; nœuds archi `rounded-xl border hairline bg-cream-50 p-4 text-center` | `p-5`/`p-7` | `2xl`/`xl` | aucun | `AvantApres.tsx:26`, `DossierFlow.tsx:945,962`, `Security.tsx:144` |
| **Card navy** | `rounded-2xl bg-navy-900 p-7 text-cream-50 sm:p-9` (Avec) ; bannière admin `rounded-2xl border border-navy-900 bg-navy-900 p-5 text-cream-50` ; callout blog `rounded-2xl bg-navy-900 px-7 py-6` | `p-5`/`p-7` | `2xl` | aucun | `AvantApres.tsx:68`, `Account.tsx:101`, `BlogPost.tsx:279-280` |
| **Card or diluée (information)** | `rounded-2xl border hairline-gold bg-gold-500/10 p-7 shadow-card sm:p-9` (« Ce que vous devez faire maintenant ») ; bannière `bg-gold-500/10 p-5` ; callout blog `bg-gold-500/10 text-navy-900` | `p-5`/`p-7` | `2xl` | aucun | `DossierDetail.tsx:614`, `Account.tsx:90`, `BlogPost.tsx:280` |
| **Card plan (claire)** | `premium-card relative flex h-full flex-col rounded-2xl border p-7 sm:p-8 hairline bg-white text-navy-900 shadow-card` ; badge flottant `absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[0.68rem] uppercase tracking-[0.18em] bg-cream-100 text-navy-900` | `p-7`/`p-8` | `2xl` | premium-card | `Pricing.tsx:444-470` |
| **Card plan (sombre « Recommandé »)** | idem + `premium-recommended-plan border-navy-900 bg-navy-900 text-cream-50` (ombre double `index.css:241-245`) | — | `2xl` | premium-card | `Pricing.tsx:445-459` ; aperçu Home `PricingPreview.tsx:55-66` |
| **Ligne de liste (dossier)** | `group flex flex-wrap items-center justify-between gap-3 rounded-2xl border hairline bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-card-hover` | `p-5` | `2xl` | lévitation + or | `Account.tsx:159` |
| **Ligne de document** | `rounded-xl border px-4 py-3 text-sm` ; pièce `hairline bg-cream-50`, livrable `hairline-gold bg-gold-500/5` | `px-4 py-3` | `xl` | aucun | `DossierDetail.tsx:171-174`, `DossierFlow.tsx:830` |
| **Dropzone** | `rounded-2xl border-2 border-dashed hairline-strong bg-cream-50 px-6 py-12 text-center hover:border-gold-500 hover:bg-white` | `px-6 py-12` | `2xl` | or + blanc | `DossierFlow.tsx:806` |
| **Badge-carte engagement** | `rounded-xl border hairline bg-white px-4 py-5 text-center` | — | `xl` | aucun | `Security.tsx:209` |
| **Vignette blog** | dégradé navy + halos or, pas d'image (`BlogPost.tsx:137-152`, `BlogPreview.tsx`) | — | `2xl` | — | — |
| **Mockup d'espace** | card blanche `rounded-2xl … p-6 sm:p-7` avec `dl` label/valeur à hairlines (motif de la hero card réutilisé) | — | `2xl` | — | `WorkspacesTabs.tsx:67-87` |

Constat de radius inversé : `rounded-xl` (1,5 rem, token custom) est **plus rond** que `rounded-2xl` (1 rem, défaut Tailwind, vérifié dans le CSS compilé `--radius-2xl:1rem`, `--radius-xl:1.5rem`) ; les cards « standard » (`2xl`, 43 occ.) sont donc moins arrondies que les cards feature (`xl`, 34 occ.). Détail à préserver tel quel (pas de renommage, II.7.2) mais à documenter pour le DS 2.0.

Motif `dl` label/valeur : `dl.divide-y hairline border-y hairline` avec lignes `py-2.5` label `text-slate-500` / valeur `font-medium text-navy-900` (tons `gold`/`navy`) — `Hero.tsx:163-185`, `WorkspacesTabs.tsx:74-87`, récap `DossierFlow.tsx:~900-941`.

---

## 5. Inputs / formulaires

### 5.1 Champ texte standard (`inputCls`, dupliqué à l'identique dans 3 fichiers)

`mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20` — `Login.tsx:31-32`, `Signup.tsx:169-170`, `DossierFlow.tsx:718-719` ; variante avec `placeholder:text-slate-500` `Contact.tsx:161,225`.

| État | Implémentation | Source |
|---|---|---|
| default | fond cream-50, bordure hairline 8 %, radius `xl` (1,5 rem), hauteur ≈ 44 px | ci-dessus |
| focus | bordure or, fond blanc, `ring-2 ring-gold-500/20` **+** règle globale `box-shadow: 0 0 0 3px rgba(196,164,86,.16), 0 12px 30px rgba(13,27,61,.06)` (`index.css:292-298`) et label parent → `gold-700` (`:288-290`) ; transitions 180 ms (`:279-286`) | — |
| invalid / error | uniquement sur « Nom de votre dossier » : `border-red-400 focus:border-red-400 focus:ring-red-400/20`, `aria-invalid`, `aria-describedby="dossier-name-error"`, message `text-xs font-medium text-red-600` | `DossierFlow.tsx:655-674` |
| help text | `mt-1.5 block text-xs italic text-slate-500` | `DossierFlow.tsx:676,755` |
| disabled / readonly | **aucune classe** (`disabled:` n'existe que sur les boutons) | grep |
| placeholder | `placeholder:text-slate-500` (Contact seulement) ; placeholders des autres pages hérités du navigateur | — |

### 5.2 Autres contrôles

| Contrôle | Classes / comportement | Source |
|---|---|---|
| Label | `<label class="block">` + `<span class="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">` ; astérisque requis `ml-1 text-gold-700` (Contact) ou `text-gold-700` (DossierFlow) | `Login.tsx:53-54`, `Contact.tsx:214-218`, `DossierFlow.tsx:651-654` |
| Select | mêmes classes que l'input (apparence native du navigateur, aucune flèche custom) | `Signup.tsx:79-89` |
| Textarea | idem, `rows={5}` | `Contact.tsx:156-162`, `DossierFlow.tsx:740-745` |
| Checkbox | natif : `mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-gold-700 focus:ring-gold-500` (Contact) ; `mt-1 h-4 w-4 accent-gold-500` (option IA) — **deux styles différents** | `Contact.tsx:169`, `DossierFlow.tsx:950` |
| Upload | `<input type="file" class="hidden">` dans un `<label>` stylé en dropzone (client) ou en bouton or (admin) ; pas de `onDrop` malgré le texte « glissez-déposez » (`DossierFlow.tsx:811`, audit app-auth F5) | `DossierFlow.tsx:806-823`, `DossierDetail.tsx:716-735` |
| Radio-cards | boutons `type="button"` sélectionnables (profil, catégorie, sujet contact) — pas de `<input type="radio">`, pas de `aria-pressed`/`role="radio"` | `DossierFlow.tsx:557-586`, `Contact.tsx:131-144` |
| Formulaire | `<form noValidate>` partout (`Login.tsx:51`, `Signup.tsx:75`, `Contact.tsx:124`, `DossierFlow.tsx:724`) ; validation HTML désactivée, validation JS minimale (mot de passe ≥ 8, nom de dossier non vide) | audit app-auth §2.3-2.4, public-content §7.8 |
| Message d'erreur bloc | `mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700` `role="alert"` | `Login.tsx:66`, `Signup.tsx:130` |
| Message neutre bloc | `rounded-xl bg-cream-100 px-4 py-3 text-sm text-slate-500` (« service en cours de configuration ») | `Signup.tsx:137` |
| Avertissement | `rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-700` | `DossierFlow.tsx:1026` |
| Conteneur de formulaire | card blanche `rounded-2xl border hairline bg-white p-7 shadow-card`, champs en `space-y-5` (auth) / `space-y-6` (tunnel, contact) | `Login.tsx:51-52`, `DossierFlow.tsx:733` |
| Largeur | `max-w-md` (auth, 28 rem), `max-w-4xl` (tunnel, compte) | `Login.tsx:43`, `DossierFlow.tsx:414` |
| Stepper | 5 pastilles `h-7 w-7 rounded-full font-mono text-[0.7rem] font-semibold` (faite/en cours `bg-navy-900 text-cream-50` avec `CheckIcon 12px strokeWidth 2.5`, à venir `border hairline-strong bg-white text-slate-500`) reliées par `h-px` navy/`slate-300/40` ; compteur mono « Création dossier · n / 5 » | `DossierFlow.tsx:415-463` ; même motif pour la frise d'avancement `DossierDetail.tsx:532-595` |

---

## 6. Navbar — `src/components/Nav.tsx`

| Aspect | Détail | Ligne |
|---|---|---|
| Conteneur | `<header class="sticky top-0 z-40 transition-[background,border-color,box-shadow] duration-300">` ; inner `mx-auto flex max-w-7xl items-center gap-6 px-5 py-3.5 sm:px-8 lg:px-12` ; hauteur implicite ≈ 68 px (logo 40 px + 2 × 14 px) | `:41-48` |
| Deux états | repos : `border-b border-transparent bg-cream-50/70 backdrop-blur-md` ; scrollé (> 24 px via `useScroll` + `useMotionValueEvent`) : `border-b hairline bg-cream-50/92 backdrop-blur-xl shadow-[0_4px_24px_rgba(13,27,61,0.05)]` | `:18-21`, `:42-46` |
| Logo | `<Logo />` carré navy 40 px « CD » or `rounded-md` + wordmark Cormorant + tagline 11 px | `:49`, `Logo.tsx` |
| Liens (5) | `/fonctionnalites` Fonctionnalités · `/tarifs` Tarifs · `/securite` Sécurité · `/blog` Journal · `/contact` Contact | `:7-13` |
| Lien desktop | `NavLink` `rounded-full px-3.5 py-2 text-sm font-medium transition-colors` ; actif `text-navy-900 bg-cream-100` ; inactif `text-slate-500 hover:text-navy-900 hover:bg-cream-100/70` ; **soulignement or 1 px** (`header nav a::after`, gradient, `opacity 0 → 1`, `scaleX(.42 → 1)`, 180/360 ms) sur hover et `aria-current="page"`, pointeur fin uniquement | `:51-67`, `index.css:251-270,315-319` |
| Visibilité | nav + CTA `hidden … lg:flex` ; burger `lg:hidden` → bascule à **1024 px** | `:51,69,105` |
| CTA déconnecté | « Se connecter » (texte, `hover:bg-cream-100`) + « Créer un compte » (or sheen) | `:86-99` |
| CTA connecté | « Mon compte » (navy) + « Créer un dossier » (or sheen) ; **pas de déconnexion dans la nav** | `:70-84` |
| Burger | 44 × 44 px `rounded-md border hairline`, `aria-expanded`, `aria-controls="mobile-menu"`, `aria-label` dynamique, SVG 3 traits (3e plus court) ↔ croix | `:103-125` |
| Menu mobile | `AnimatePresence` ; overlay `fixed inset-x-0 top-[64px] z-50 bottom-0` fade 0,2 s ; backdrop `bg-navy-900/30 backdrop-blur-sm` cliquable ; panneau `motion.nav absolute inset-x-0 top-0 bg-cream-50 border-b hairline px-5 py-6 shadow-card` spring 320/32 `y -30% → 0` ; liens `rounded-md px-4 py-3 text-base font-medium` actif `bg-cream-100` ; CTA pleine largeur navy puis or | `:128-202` |
| Comportements | `body.overflow = hidden` quand ouvert ; fermeture sur `Escape` et au clic sur lien ; `top-[64px]` codé en dur (hauteur réelle non mesurée) | `:23-38`, `:131` |
| Reduced motion | menu mobile animé par Motion sans `useReducedMotion` (seul le CSS global raccourcit les transitions CSS) | audit design A6 |
| Skip-link | `a.skip-nav href="#main"` « Aller au contenu principal », visible au focus (`top: 1rem`), navy/cream, radius md | `Layout.tsx:26`, `index.css:100-112` |

Captures de référence : `docs/baseline/screens/home__desktop.jpg` (header repos), `home__mobile.jpg` (burger).

---

## 7. Footer — `src/components/Footer.tsx`

| Aspect | Détail | Ligne |
|---|---|---|
| Conteneur | `footer.border-t hairline bg-cream-100/60` ; inner `mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12` | `:27-28` |
| Grille | `grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]` — 4 colonnes desktop, 1 colonne < 1024 px | `:29` |
| Col. marque | `<Logo />` + paragraphe `mt-5 max-w-xs text-sm leading-relaxed text-slate-500` | `:30-37` |
| Colonnes | « Produit » (4 liens dont `/dossier/nouveau`), « Ressources » (4 dont `/securite#conformite`, `/securite#dpa`), « Légal » (4 pages) | `:4-23`, `:39-41` |
| Titre de colonne | `h3.font-mono text-[0.7rem] uppercase tracking-[0.18em] text-navy-900` ; liste `mt-4 space-y-2.5` ; lien `text-sm text-slate-500 hover:text-navy-900` | `:72-84` |
| Barre basse | `mt-12 flex flex-col gap-3 border-t hairline pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between` | `:44` |
| Copyright | `font-mono` « © 2026 ClairDossier · Édité par Roman Gomes · SIREN 105 490 734 » — zone commerciale visée par I.5.1 (remplacement du nom personnel : à traiter en phase d'écriture, via diff minimal, **hors périmètre de cet inventaire**) | `:45-47` |
| Mention droite | « Hébergeur conforme RGPD · Pièces chiffrées au repos · » + lien « Charte de sécurité » `border-b hairline-gold hover:text-navy-900` | `:48-56` |
| Absents | e-mail, téléphone, adresse, réseaux sociaux, sélecteur de langue, newsletter | fichier lu intégralement (89 l.) |

Écart `PLAN.md:76` (« 3 cols + mention RCS placeholder ») → 4 colonnes et SIREN réel.

---

## 8. Modals / overlays

| Élément | État | Source |
|---|---|---|
| Composant Modal / Dialog | **Absent** (`grep -i "dialog\|createPortal\|aria-modal\|<Modal"` → 0) | — |
| Confirmation | `window.confirm(...)` natif avant suppression d'un livrable | `DossierDetail.tsx:406` |
| Toast / notification | **Absent** (`grep -i toast` → 0) ; les retours sont des `<p>` inline (erreur rouge, avertissement ambre, bannière or « Abonnement confirmé » `Account.tsx:89-98`) | — |
| Overlay existant | uniquement le menu mobile (`fixed … z-50`, backdrop `bg-navy-900/30 backdrop-blur-sm`) | `Nav.tsx:130-140` |
| Drawer / sheet / popover / tooltip / dropdown | **Absents** ; le `<select>` est natif | grep |
| Bandeau cookies | **Absent** (page `/cookies` déclare des cookies strictement nécessaires) | audit app-auth §4.5 |
| Échelle z-index | `-z-10` (halos décoratifs ×4), `z-10` (contenu d'onglet/toggle ×4), `z-40` (header), `z-50` (menu mobile), `z-index:100` (skip-nav `index.css:104`) — aucun token | grep |
| Skip-link | seul élément « overlay » d'accessibilité | `index.css:100-112` |

Conclusion : **aucune couche modale** n'existe ; toute insertion future d'un panneau (ex. widget Agent IA, II.7.3) devra créer un portail dédié avec un `z-index` supérieur à 50 et sous 100, sans toucher `Nav.tsx`.

---

## 9. Icônes — `src/components/icons.tsx`

| Aspect | Détail | Ligne |
|---|---|---|
| Règle de dessin | « 24x24 stroke 1.5, dessin au trait minimaliste. Jamais d'isométrique, jamais de cliché » | `:1-5` |
| `baseProps` | `width/height 24`, `viewBox 0 0 24 24`, `fill none`, `stroke currentColor`, `strokeWidth 1.5`, `strokeLinecap/Linejoin round`, `aria-hidden true` | `:8-18` |
| Inventaire (23 exports) | Features (8) : `FormGuide`, `ScanOcr`, `Timeline`, `AiBrief`, `Validate`, `StatusTrack`, `MessageSecure`, `Vault` (`FEATURE_ICONS` `:269-278`) · Sécurité (6) : `HostingFrance`, `Encryption`, `Rgpd`, `ComplianceRin`, `Backup`, `Audit` (`SECURITY_ICONS` `:282-289`) · Utilitaires (9) : `ArrowRight`, `Check`, `Lock`, `FilePages`, `Users`, `Headset`, `Info`, `WhatsApp`, `Cross` (`:177-267`) | — |
| Exceptions | `CheckIcon` `strokeWidth 2` (`:188`) ; `WhatsAppIcon` glyphe plein `fill="currentColor"` sans `baseProps` (`:245-258`) ; `MessageSecureIcon`/`InfoIcon` points à `strokeWidth 2` ; `ValidateIcon`/`AuditIcon` `opacity .4/.6` | audit design §5.4 |
| Tailles réelles | 24 px (cards features/sécurité), 16 px (specs plans, WhatsApp), 14 px `strokeWidth 2` (flèches CTA, `Hero.tsx:93-98`), 12 px `strokeWidth 2.5` (coches de stepper), 26 px (succès) | sources citées §3-5 |
| Conteneurs d'icône | `grid h-11 w-11 place-items-center rounded-lg bg-cream-100 text-navy-900` → hover `bg-gold-500/15 text-gold-700` (`FeaturesGrid.tsx:35`) ; `h-12 w-12 rounded-xl bg-[#25D366]/12` (`Contact.tsx:75`) ; `h-14 w-14 rounded-full bg-emerald-100` (`DossierFlow.tsx:1014`) ; `h-8 w-8 rounded-full border hairline` (+ accordéon) | — |
| SVG inline hors bibliothèque | burger (`Nav.tsx:111`), « + » accordéon (`Accordion.tsx:35`), `MailIcon` (`DossierFlow.tsx:1050-1066`, `strokeWidth 1.6`), 2 SVG dans `Pricing.tsx:309,345` | grep `<svg` |
| Couleur | toujours `currentColor` ; classes `text-gold-700`, `text-navy-900`, `text-emerald-500`, `text-slate-300/400` | — |
| Remarque | malgré la règle « jamais shield/lock », `RgpdIcon` (`:140-147`) est un bouclier et `EncryptionIcon`/`LockIcon` des cadenas | audit design §5.4 |
| Favicon / OG | `favicon.svg` (carré `rx=12` navy, « CD » Cormorant 700 or) ; `og-default.svg` 1200×630 (carré en `#0a1228` ink, texte « OVH France » et H1 divergents) ; pas de PNG/ICO/apple-touch-icon | `public/favicon.svg:2-3`, `public/og-default.svg:22-41`, audit live-site §5.4 |
| Emoji | aucun (`PLAN.md:139`) | — |

---

## 10. Animations & motion

### 10.1 Tokens et durées

| Token / valeur | Usage | Source |
|---|---|---|
| `--ease-out-expo` `cubic-bezier(0.16,1,0.3,1)` | reveals, H1, marker, hero ; tableau JS `[0.16,1,0.3,1]` | `index.css:60`, `Reveal.tsx:4`, `Hero.tsx:41,73,85,111,126` |
| `--ease-out-soft` `cubic-bezier(0.22,1,0.36,1)` | tabs, accordéon, cards ; `[0.22,1,0.36,1]` | `index.css:61`, `Tabs.tsx:65`, `Accordion.tsx:51`, `FeaturesGrid.tsx:32` |
| Micro (≤ 250 ms) | `transition-colors` (défaut 150 ms), `duration-200` boutons, sheen transform 180 ms, nav underline opacity 180 ms, inputs 180 ms, overlay fade 200 ms, cards hover 250 ms | `index.css:274,268,283`, `Nav.tsx:135`, `Card.tsx:34` |
| UI (200–400 ms) | header 300 ms, cards 300 ms, premium-card 360 ms, tabs/accordéon 350 ms, nav underline 360 ms | `Nav.tsx:42`, `index.css:213-218`, `Tabs.tsx:65` |
| Story | reveal 0,65 s (fallback 0,55 s), stagger 0,07 s / enfant 0,6 s, H1 mots 0,85 s × 0,06 s, marker 0,9 s (délais 0,6/0,85/1,1 s), sheen 0,6 s, hero card slide 0,7 s delay 0,4 s | `Reveal.tsx:14,63-80`, `SplitWords.tsx`, `index.css:165`, `Hero.tsx:55-62,124-126` |
| Ambiant | flottement hero 8 s, pulse or 1,8 s, `premium-ambient-sweep` 18 s alternate, `premium-grid-drift` 28 s linear | `Hero.tsx:130-135,199-217`, `index.css:184,207` |
| Springs | `stiffness 380 / damping 32` (onglets, toggle) ; `320 / 32` (menu mobile) ; `200 / 18` (`Magnetic`, non utilisé) | `Tabs.tsx:45`, `Pricing.tsx:159`, `Nav.tsx:146`, `Magnetic.tsx` |

Correspondance avec VI.3 (Micro 100–250 / UI 200–400 / Story scroll-driven / 3D) : les trois premières catégories existent déjà ; **aucune 3D** (pas de WebGL, Three, canvas : grep → 0).

### 10.2 Primitives — `src/components/primitives/`

| Primitive | Mécanique | Reduced motion | Utilisée | Source |
|---|---|---|---|---|
| `Reveal` | `initial {opacity 0, y 18}` → `whileInView {1, 0}` 0,65 s expo ; viewport `{ once: true, amount: 0, margin: '240px' }` ; **fallback 900 ms** forçant l'affichage si l'observer ne tire pas ; prop `amount` déclarée mais non lue | `createElement` statique | oui (10 sections, 8 pages) | `Reveal.tsx:9,14,18-75` |
| `Stagger` / `StaggerItem` | `staggerChildren 0.07, delayChildren 0.05` ; enfant `y 18 → 0` 0,6 s ; même fallback | div statique | oui | `Reveal.tsx:77-149` |
| `SplitWords` | mot par mot `y '110%' → 0` + opacité, `overflow-hidden`, `aria-label` global + mots `aria-hidden` | spans statiques | H1 hero | `SplitWords.tsx:10-64`, `Hero.tsx:48-67` |
| `MarkerHighlight` | `setTimeout(delay)` → `data-revealed="true"` → CSS `scaleX(0→1)` 0,9 s, origine gauche, radius irrégulier `0.1em 0.3em 0.15em 0.2em` (technique `transform`, pas `clip-path` contrairement au commentaire et à `PLAN.md:13`) | révélé immédiatement + CSS `scaleX(1)` | 3 mots du H1 | `MarkerHighlight.tsx:9-34`, `index.css:151-169,365` |
| `Marquee` | piste `w-max gap-12` dupliquée `aria-hidden`, keyframes inline 60 s, pause au hover | flex-wrap statique | **non** (consommateur `Partners.tsx` supprimé en `7fafc9b`) | `Marquee.tsx` |
| `Magnetic` | `useMotionValue` + `useSpring` 200/18, décalage = (curseur − centre) × 0,18, pas de clamp 6 px | span statique | **non** | `Magnetic.tsx:9-52` |
| `Counter` | prévu `PLAN.md:65` — **fichier inexistant** | — | — | — |

### 10.3 Scroll-linked

| Élément | Mécanique | Source |
|---|---|---|
| Ligne or du Workflow | `useScroll({ target, offset: ["start 80%", "end 30%"] })` → `useTransform` → `style.scaleX` d'un `motion.div h-px bg-gold-500 origin-left` ; desktop seulement (`lg:block`) ; `scaleX: 1` si reduced | `Workflow.tsx:12-50` |
| Header | `useScroll` + `useMotionValueEvent(scrollY)` → seuil 24 px | `Nav.tsx:18-21` |
| Aucun `pathLength` SVG | contrairement à `PLAN.md:20` (grep → 0) | — |

### 10.4 Hover / micro-interactions

| Pattern | Détail | Source |
|---|---|---|
| Sheen | `::before` gradient 115° blanc 45 %, `translateX(-100% → 100%)` 0,6 s ; 20 usages | `index.css:129-148` |
| Lévitation | `hover:-translate-y-0.5` (boutons, lignes), `-translate-y-1` (cards de sélection), `translate3d(0,-6px,0)` (premium-card), `whileHover y:-4` (features) | `Hero.tsx:90`, `DossierFlow.tsx:561`, `index.css:302`, `FeaturesGrid.tsx:31` |
| Flèche | `group-hover:translate-x-0.5` sur `ArrowRightIcon` | `Hero.tsx:97`, `Account.tsx:184` |
| Soulignement nav | gradient or 1 px `scaleX(.42→1)` | `index.css:255-270` |
| Voile premium-card | `::after` dégradé or→sky opacité 0 → 1, icône `scale(1.035)` | `index.css:222-232,307-313` |
| Indicateur partagé | `layoutId` Motion (onglets `tab-active`, toggle `billing-pill`) | `Tabs.tsx:43`, `Pricing.tsx:157` |
| Accordéon | `+` → `×` par `rotate(45deg)` style inline ; panneau `height 0 → auto` | `Accordion.tsx:30-57` |
| Gate pointeur | tous les hovers premium sous `@media (hover: hover) and (pointer: fine)` | `index.css:300-324` |

### 10.5 `prefers-reduced-motion`

| Couche | Couverture | Source |
|---|---|---|
| CSS global | `animation-duration/transition-duration: .01ms !important`, `iteration-count: 1`, sheen masqué, marker forcé, animations `premium-*` coupées, transforms premium-card neutralisés | `index.css:358-375` |
| JS (`useReducedMotion`) | `Reveal`, `Stagger`, `StaggerItem`, `SplitWords`, `MarkerHighlight`, `Marquee`, `Magnetic`, `Card`, `Hero` (flottement + pulse), `Workflow` (ligne), `FeaturesGrid` (hover) | fichiers cités |
| **Non couverts en JS** | `Tabs` (crossfade), `Accordion` (height), menu mobile (`Nav.tsx:130-146`), toggle tarifs (`Pricing.tsx:156-177`) — animations Motion non neutralisées par le CSS | audit design A6 |

---

## 11. Grilles & containers

| Pattern | Classes | Source / occurrences |
|---|---|---|
| **Container standard** | `mx-auto max-w-7xl px-5 sm:px-8 lg:px-12` — 1280 px max, gouttières 20 / 32 / 48 px | 32× `max-w-7xl` ; `Nav.tsx:48`, `Footer.tsx:28`, toutes les sections Home |
| Containers de lecture | `max-w-md` 28 rem (auth, 11 occ.), `max-w-2xl` 42 rem (sous-titres, 8), `max-w-3xl` 48 rem (intro de section, article blog, 14), `max-w-4xl` 56 rem (FAQ, tunnel, compte, 7), `max-w-5xl` 64 rem (FinalCTA, image blog, 7), `max-w-xs` (footer) | grep |
| Breakpoints | défauts Tailwind v4 : `sm` 640, `md` 768, `lg` 1024, `xl` 1280, `2xl` 1536 px (aucun override `--breakpoint-*`) ; usage réel : `sm` (typo/paddings), `md` (grilles 2-5 col), `lg` (nav desktop, grilles asymétriques, Workflow horizontal) ; `xl`/`2xl` non utilisés ; une media query manuelle `max-width: 640px` (`index.css:348`) | CSS compilé ; `Nav.tsx:51`, `Workflow.tsx:38` |
| Hero | `lg:grid-cols-[1.15fr_0.85fr] lg:gap-16` | `Hero.tsx:36` |
| Avant/Après | `grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1fr] lg:gap-8` (colonne centrale = connecteur or) | `AvantApres.tsx:24` |
| Features | `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` (Home) ; `md:grid-cols-3` (index) | `FeaturesGrid.tsx:25`, `FeaturesIndex.tsx` |
| Workspaces | `lg:grid-cols-[1.05fr_0.95fr] gap-10` | `WorkspacesTabs.tsx:48` |
| Workflow | desktop `grid-cols-6 gap-4` ; mobile liste verticale | `Workflow.tsx:51,60` |
| Pricing | Home `md:grid-cols-3 gap-5 sm:gap-6` ; page `/tarifs` 7 cards (grille lue partiellement — À VÉRIFIER colonnes exactes) | `PricingPreview.tsx:29`, `Pricing.tsx:195-199` |
| Sécurité | archi `grid-cols-1 gap-4 md:grid-cols-5` ; badges `grid-cols-2 gap-3 sm:grid-cols-4` ; en-tête `lg:grid-cols-[1fr_auto]` | `Security.tsx:122,200`, `SecurityBlock.tsx:50` |
| Footer | `grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]` | `Footer.tsx:29` |
| Blog | `md:grid-cols-2` (related), 3 colonnes (index/preview) | `BlogPost.tsx:206`, `BlogPreview.tsx` |
| App | profils `sm:grid-cols-2 lg:grid-cols-3 gap-3` ; sujets contact `sm:grid-cols-2 gap-2` ; frise détail `sm:flex` 5 colonnes `flex-1` | `DossierFlow.tsx:555`, `Contact.tsx:129`, `DossierDetail.tsx:532` |
| Totaux grep | `grid-cols-2` 16, `grid-cols-3` 9, `grid-cols-4` 3, `grid-cols-6` 1, `grid-cols-5` 1 | — |
| Layout racine | `div.flex min-h-dvh flex-col bg-cream-50 text-ink` → `Nav` / `main#main.flex-1 outline-none tabIndex -1` / `Footer` ; scroll-to-top + focus `<main>` à chaque changement de route (sauf premier rendu) | `Layout.tsx:13-33` |

---

## 12. Spacing

Aucun token `--spacing-*` custom : échelle Tailwind par défaut (`--spacing: .25rem` dans le CSS compilé).

| Rôle | Valeurs constatées | Source |
|---|---|---|
| Padding vertical de section | `py-14 sm:py-20 lg:py-24` (56 / 80 / 96 px) — 12 sections | `AvantApres.tsx:23`, `Workflow.tsx:22`, `Security.tsx:225`… |
| Hero | `pb-14 pt-12 sm:pb-20 sm:pt-16 lg:pb-32 lg:pt-24` | `Hero.tsx:36` |
| Pages internes | `pb-12 pt-12 sm:pt-16 lg:pt-24` puis `pb-14 sm:pb-20 lg:pb-24` ; pages app `py-16` ; auth `py-16 lg:py-24` | `FeaturesIndex.tsx:34,54`, `Account.tsx:88`, `Login.tsx:43` |
| Footer | `py-14` ; barre basse `mt-12 pt-6` | `Footer.tsx:28,44` |
| Anomalie | `FinalCTA.tsx:25` cumule `sm:py-20` et `sm:py-28` dans la même classe (la dernière gagne — À VÉRIFIER au rendu) | audit design A10 |
| Padding de card | `p-5` (bannières, lignes), `p-6` (features, sélection), `p-7` (standard, hero card), `p-7 sm:p-8` (plans), `p-7 sm:p-9` (Avant/Après, tunnel, détail), `p-8 sm:p-12` (succès) | §4 |
| Padding de bouton | `px-6 py-3.5` (principal), `px-5 py-3` (compact), `px-4 py-2.5` (nav), `px-4 py-2` (xs), `px-3.5 py-2` (lien nav), `px-3 py-1.5` (pill), `px-2.5 py-0.5` (badge mono) | §3 |
| Gaps | `gap-3` 42, `gap-2` 37, `gap-4` 28, `gap-1.5` 24 (icône+texte), `gap-6` 10, `gap-12` 9 (footer/marquee), `gap-5`/`gap-8`/`gap-10`/`gap-16` ponctuels | grep |
| Rythme vertical | `space-y-3` 7 (listes), `space-y-5` 6 (champs auth), `space-y-2.5` 5 (liens footer, specs), `space-y-6` 3 (champs tunnel/contact) ; `mt-3` (eyebrow → H2), `mt-4` (H2 → paragraphe), `mt-8` (intro → CTA/formulaire), `mt-14`/`mt-16` (intro → grille) | `Workflow.tsx:27-38`, `FeaturesGrid.tsx:25` |
| Cibles tactiles | burger 44 px, accordéon `min-h-[44px]`, onglets/toggle `min-h-[40px]`, checkbox 16 px (sous 24 px) | `Nav.tsx:105`, `Accordion.tsx:25`, `Contact.tsx:169` |

---

## 13. Radius

| Token | Valeur | Émis dans le CSS compilé | Usage (occ.) |
|---|---|---|---|
| `--radius-xs` | 0,25 rem | **non** (inutilisé) | 0 |
| `--radius-sm` | 0,5 rem | **non** (inutilisé) | 0 |
| `--radius-md` | 0,75 rem | oui | `rounded-md` 3 : logo, burger, liens menu mobile |
| `--radius-lg` | 1,125 rem | oui | `rounded-lg` 12 : pastilles d'icône, `rounded-t-lg` onglets app |
| `--radius-xl` | **1,5 rem** (custom) | oui | `rounded-xl` 34 : cards features, inputs, lignes de document, encarts, CTA de plan, messages |
| `--radius-2xl` | 1 rem (**défaut Tailwind**, non redéfini) | oui | `rounded-2xl` 43 : cards standard, plans, formulaires, dropzone, callouts |
| `--radius-3xl` | 1,5 rem (défaut) | oui | `rounded-3xl` 1 : halo hero `Hero.tsx:260` |
| `--radius-full` | 9999 px | oui | `rounded-full` 89 : boutons, pills, onglets, avatars, pastilles, stepper |
| Hors tokens | `border-radius: 2px` (anneau focus `index.css:120`), `0.1em 0.3em 0.15em 0.2em` (marker `:162`), `999px` (underline nav `:262`), `rx=12`/`rx=14` (favicon/OG), `rounded` (checkbox natif) | — |

Fait structurant : hiérarchie **inversée** `xl` (1,5 rem) > `2xl` (1 rem) = à conserver en l'état (aucun renommage, II.7.2) ; le DS 2.0 devra l'expliciter.

---

## 14. Shadows

| Token | Valeur | Usage (occ.) | Source |
|---|---|---|---|
| `--shadow-card` | `0 2px 24px rgba(13,27,61,0.06)` | 27 : cards blanches, hero card, menu mobile, formulaires, toggle | `index.css:54` |
| `--shadow-card-hover` | `0 12px 48px rgba(13,27,61,0.10)` | 7 : hover cards/lignes, profil sélectionné | `:55` |
| `--shadow-gold` | `0 8px 24px rgba(196,164,86,0.22)` | 20 : tous les CTA or | `:56` |
| `--shadow-gold-strong` | `0 14px 36px rgba(196,164,86,0.32)` | 4 : hover CTA or principaux | `:57` |
| Hors tokens | header scrollé `0 4px 24px rgba(13,27,61,0.05)` (`Nav.tsx:44`) ; `.premium-recommended-plan` `0 18px 60px rgba(13,27,61,.18), inset 0 1px 0 rgba(255,255,255,.08)` (`index.css:241-245`) ; focus formulaire `0 0 0 3px rgba(196,164,86,.16), 0 12px 30px rgba(13,27,61,.06)` (`:295-297`) ; anneau focus global `0 0 0 4px rgba(230,201,125,.95)` (`:119`) ; `ring-2 ring-gold-500/20` (inputs) | — |
| Principe | ombres **très diffuses et teintées** (navy à 6-10 %, or à 22-32 %) — jamais d'ombre grise neutre ; profondeur surtout donnée par hairlines + fonds alternés | — |

---

## 15. Patterns signature — `PLAN.md:11-22` vs implémentation réelle

| # | Détail prévu (PLAN.md) | Implémentation réelle | Statut |
|---|---|---|---|
| 1 | Marker sky animé (`clip-path` trace) sur 3 mots du H1 (`:13`) | `MarkerHighlight` + `.marker-track::before` `scaleX(0→1)` 0,9 s, sur « clair, », « structuré », « suivi. » (`Hero.tsx:55-62`, délais 0,6/0,85/1,1 s) ; technique `transform`, pas `clip-path` | Implémenté (technique différente) |
| 2 | Cormorant Garamond H1/H2/citations (`:14`) | 88 occ. `font-display` : H1, H2, H3 de cards, prix, citations, chapô, logo, drop cap | Implémenté |
| 3 | JetBrains Mono références/statuts/micro-meta (`:15`) | 115 occ. `font-mono` : `#CD-2026-0421` (`Hero.tsx:151`), « Étape 01…06 », eyebrows, labels de champs, badges statut, copyright, titres footer, fallback « Chargement… », compteur « n / 5 » | Implémenté |
| 4 | Pills cream + navy + 1 px or 8 % (`:16`) | `FactPill` `rounded-full border hairline-gold bg-cream-50 px-3 py-1.5 text-xs font-medium text-navy-900` + point or 4 px (`Hero.tsx:268-274`) ; badges statut `bg-gold-500/12 … border hairline-gold` (`Account.tsx:177`) ; `Pill.tsx` non utilisé. Bordure or à **35 %**, pas 8 % | Implémenté inline (opacité différente) |
| 5 | Sheen au hover sur CTA or, 600 ms (`:17`) | `.sheen` `index.css:129-148`, 0,6 s, 20 usages | Implémenté |
| 6 | Hero card « Dossier prud'homal — synthèse », 6 dots dont 1 pulse or (`:18`) | `Hero.tsx:128-256` : titre exact, badges « Exemple »/« Actif », `dl` 4 lignes, timeline 6 points, pulse `scale [1,1.4,1]` 1,8 s, flottement 8 s, halo flou `rounded-3xl` | Implémenté |
| 7 | Avant/Après asymétrique cream → navy, diagonale fine ligne or (`:19`) | grille **symétrique** `[1fr_auto_1fr]`, cartes cream-100 / navy-900, connecteur vertical 2 × `w-px bg-gold-500/40` + flèche or (`AvantApres.tsx:24-68`) ; pas de diagonale | Partiel |
| 8 | Workflow 6 statuts en SVG `pathLength` scroll-linked (`:20`) | `motion.div h-px bg-gold-500 origin-left` piloté par `useScroll`/`scaleX` (`Workflow.tsx:14-50`) ; desktop seulement ; aucun SVG `pathLength` | Implémenté (div, pas SVG) |
| 9 | Onglets Client/Avocat/Cabinet, mockups JSX/SVG différents (`:21`) | `Tabs` + `WorkspacesTabs` ; libellés réels « Vous » / « Validation » / « Entreprise » (`workspaces.ts`) ; **un seul layout** `WorkspacePanel` (`dl` label/valeur) alimenté par données | Partiel |
| 10 | Drop cap Cormorant + citations pleine largeur italiques (`:22`) | drop cap `index.css:337-355` sur `.drop-cap` (`BlogPost.tsx:159`) ; citations `figure.border-l-2 border-gold-500 pl-6` + `blockquote.font-display text-2xl italic text-navy-700` dans la colonne `max-w-3xl` (pas pleine largeur) ; H3 italiques, callouts italiques « Note » | Implémenté (largeur colonne) |

Patterns signature **supplémentaires non prévus au plan** (commit `24e1e2b`) : couche `premium-*` — halo animé du hero (`premium-hero-shell::after`, 18 s), grille or dérivante des sections navy (`premium-tech-section::before`, 56 px, 28 s), voile dégradé au hover des cards (`premium-card::after`), ombre double du plan recommandé (`index.css:171-249`). Éléments du plan absents : `Counter.tsx`, `Partners.tsx`/marquee, `Testimonials.tsx` (supprimés en `7fafc9b`) ; `DossierLifecycle` ajouté hors plan (11 sections Home, `pages/Home.tsx:51-61`).

---

## 16. ADN ClairDossier à PRÉSERVER absolument

Liste argumentée (VI.1 : *extraire palette, typographie, iconographie, géométrie, espace, tonalité*). Chaque point est un invariant du DS 2.0 ; toute évolution doit le conserver ou l'étendre, jamais le remplacer.

| # | Invariant | Pourquoi c'est l'ADN (preuve) | Ce qui le casserait |
|---|---|---|---|
| 1 | **Trio crème / navy / or, fond de page `#fbf9f4` jamais blanc pur** | `html { background: cream-50 }` (`index.css:66`) ; alternance cream-50 / cream-100 / navy-900 section par section visible sur `home__desktop.jpg` ; le blanc n'existe que sur les cards et inputs au focus | un fond `#fff`, un gris neutre, une palette bleu-SaaS, un dark mode inversé sans passer par navy-900 |
| 2 | **Or unique et rare (5-8 %)** : CTA, points 4 px, filets, eyebrows en `gold-700` sur clair | `PLAN.md:142` ; `text-gold-500` jamais utilisé sur fond clair ; hairline-gold à 35 % | généraliser l'or (fonds, titres), le remplacer par un vert/bleu « success/primary » |
| 3 | **Triplet typographique mono → serif → grotesque** par bloc : eyebrow JetBrains Mono capitales `tracking-[0.2em] text-gold-700` / H2 Cormorant 600 `text-4xl sm:text-5xl leading-tight` / paragraphe Inter `text-slate-500 leading-relaxed` | `FeaturesGrid.tsx:13-22`, `Workflow.tsx:24-34`, `Login.tsx:44-49` ; 88 `font-display`, 115 `font-mono` | remplacer Cormorant par une sans, les eyebrows mono par du texte normal, perdre les prix en Cormorant |
| 4 | **H1 compact éditorial** `clamp(2.1rem,7vw,5.4rem) leading-[0.98]` + **surligneur sky-marker** sur 3 mots, aussi couleur de `::selection` | `Hero.tsx:47-62`, `index.css:82-85,151-169` | H1 sans marker, marker d'une autre couleur, ou marker CSS `clip-path` remplaçant l'effet sans respecter délais/radius irrégulier |
| 5 | **Hairlines navy 8 % au lieu de bordures grises** ; cards blanches à ombre diffuse teintée navy ; bordure or au hover | `.hairline` (`index.css:124`, ≈ 106 occ.), `shadow-card` (27), `hover:border-gold-500` | bordures `#e5e7eb`, ombres grises, cards sans bordure |
| 6 | **Géométrie en capsules** : boutons, pills, onglets, liens de nav en `rounded-full` (89) ; cards `rounded-2xl`/`rounded-xl` ; seul le logo/burger en `rounded-md` ; hiérarchie de radius telle quelle (`xl` > `2xl`) | §13 | boutons rectangulaires, radius 4-6 px « Material », renommage des tokens de radius |
| 7 | **Micro-signaux « dossier » en mono** : références `#CD-2026-0421`, « Étape 01…06 », badges statut `bg-gold-500/12 border hairline-gold font-mono text-[0.7rem]`, points or « Actif », compteur « n / 5 », stepper à pastilles navy 28 px | `Hero.tsx:138-160`, `Account.tsx:177`, `DossierFlow.tsx:415-463`, `DossierDetail.tsx:496,550-566` | badges colorés par statut (vert/rouge/bleu), icônes emoji, stepper à barres pleines |
| 8 | **Mouvement lent et feutré** : `ease-out-expo` / `ease-out-soft` partout, reveals 18 px / 0,65 s, stagger 0,07 s, springs amortis (damping 32), sheen 0,6 s, flottement 8 s, balayages 18-28 s ; tout dégrade en statique sous `prefers-reduced-motion` | §10 | bounce, `ease-in-out` 150 ms génériques, spinners rotatifs, animations non neutralisées en reduced-motion |
| 9 | **La carte-dossier comme objet central** (« pièce à conviction ») : card blanche flottante, en-tête mono, titre Cormorant, `dl` label/valeur à hairlines, frise de points dont un pulse or, halo flou or/navy | `Hero.tsx:121-262`, réutilisé `WorkspacesTabs.tsx:67-87` | remplacer par un screenshot, un mockup dashboard générique, une illustration stock |
| 10 | **Sections navy « à bord or »** : FinalCTA et blocs navy encadrés de filets `via-gold-500/60`, halos radiaux or ≤ 10 %, grille or dérivante ; eyebrow en `gold-500` sur navy ; texte `cream-50/75` | `FinalCTA.tsx:7-23`, `WorkspacesTabs.tsx:8-16`, `index.css:187-208` | fond bleu roi, dégradés violets, texte blanc pur |
| 11 | **Détails de presse sur le Journal** : drop cap Cormorant 4,2 em, citations italiques à filet or `border-l-2`, chapô italique, H3 italiques, callout « Note » or/navy, guillemets « », pas d'image (vignette = dégradé navy) | `index.css:337-355`, `BlogPost.tsx:116,236-297` | blog SaaS à vignettes photo, citations en gris |
| 12 | **Icônes au trait 1,5 px `currentColor`, 24 px, pastille `bg-cream-100` 44 px** ; aucune bibliothèque tierce ; aucune image raster ; aucun emoji | `icons.tsx:1-18`, `FeaturesGrid.tsx:35`, `PLAN.md:139` | Lucide/Heroicons massifs, icônes pleines colorées, illustrations 3D génériques |
| 13 | **Container 80 rem, gouttières 20/32/48, rythme `py-14 sm:py-20 lg:py-24`, intro de section `max-w-3xl`** | §11-12 | container 1140 px, sections compactes SaaS |
| 14 | **Tonalité du copy** : vouvoiement, phrases courtes en deux temps (« Six statuts. Aucun « entre-deux ». »), registre anti-marketing, typographie française ; conforme à IX.8 | audit public-content §6.3 | superlatifs, emojis, anglicismes |
| 15 | **Accessibilité de base déjà acquise** : skip-link, anneau de focus navy + or, `aria-*` sur burger/onglets/accordéon/stepper, `role="status"` sur chargements, focus `<main>` au changement de route, `hover` gaté sur pointeur fin | `index.css:100-121`, `Layout.tsx:13-28`, `Nav.tsx:106-108`, `DossierDetail.tsx:543-544` | régresser sur l'un de ces points lors d'une insertion |

---

## 17. Lacunes (constats, pas de redesign)

Grille de lecture : IX.7 exige par composant les états *default, hover, focus, active, loading, success, error, empty, disabled, locked* et des *AI states* (Analysing, Extracting, Verifying, Ready, Needs information, Human review).

### 17.1 États manquants sur l'existant

| Composant | default | hover | focus | active | loading | success | error | empty | disabled | locked |
|---|---|---|---|---|---|---|---|---|---|---|
| Bouton primaire or | ✓ | ✓ | global | ✗ (aucun `active:`) | texte « … » (3 pages) | ✗ | ✗ | — | ✓ (opacité) | ✗ |
| Boutons secondaires/tertiaires/outline | ✓ | ✓ | global | ✗ | ✗ | ✗ | ✗ | — | partiel (`DossierFlow.tsx:986`, `DossierDetail.tsx:641`) | ✗ |
| Input / textarea / select | ✓ | ✗ | ✓ | — | ✗ | ✗ | 1 seul champ (`DossierFlow.tsx:655-674`) | — | **✗** (aucune classe `disabled:`) | ✗ |
| Checkbox | natif, 2 styles divergents | ✗ | natif | — | — | — | ✗ | — | ✗ | ✗ |
| Upload | ✓ | ✓ | — | — | « Envoi… » admin seulement | ✗ | ✗ (échec silencieux côté client, audit app-auth F4) | — | admin seulement | ✗ |
| Card dossier (liste) | ✓ | ✓ | global | ✗ | texte « Chargement… » | — | **✗** (erreurs Supabase ignorées → affichées comme « Aucun dossier », F8) | ✓ (`Account.tsx:146-152`) | — | ✗ |
| Page détail dossier | ✓ | — | — | — | texte « Chargement… » (`DossierDetail.tsx:447`) | — | « Dossier introuvable » utilisé aussi pour les erreurs réseau/RLS | ✓ pièces/livrables/échéances (`:652,694,774`) | — | ✗ |
| Onglets app | ✓ | ✓ | global | ✓ | — | — | — | — | ✗ | ✗ |
| Tabs / Accordion | ✓ | ✓ | global | ✓ | — | — | — | ✗ (liste vide non gérée) | ✗ | ✗ |
| Nav | ✓ | ✓ | global | ✓ | — | — | — | — | — | — |

Constats transversaux :
- **Loading** : uniquement du texte mono « Chargement… » (`App.tsx:32-44`, `RequireAuth.tsx:10-22`, `Account.tsx:144`, `DossierDetail.tsx:447`) ; aucun skeleton, aucune barre de progression, aucun `aria-busy` (grep `skeleton|animate-pulse|animate-spin|aria-busy` → 0). IX.7 : « éviter les spinners interminables ; afficher une progression réelle » — rien de tel n'existe (uploads séquentiels sans retour par fichier, `DossierFlow.tsx:359-373`).
- **Success** : un seul écran (`SuccessCard`, pastille `emerald-100`, `DossierFlow.tsx:1005-1048`) + une bannière non vérifiée « Abonnement confirmé » ; pas de pattern de succès inline.
- **Error** : trois rendus non unifiés (bloc `red-50/red-700` auth, inline `red-600` tunnel/détail, `deliverError` affiché dans le mauvais onglet — audit app-auth F11) ; aucun composant d'erreur partagé ; messages Supabase bruts en anglais possibles (`auth.tsx:48`).
- **Empty** : textes simples dans une card blanche centrée ; pas d'illustration, pas de CTA dans les états vides de pièces/échéances.
- **Disabled** sur champs et **locked** (gating abonnement, V.5) : **inexistants** — cohérent avec l'absence totale de gating (audit stripe-pricing §3, B1).
- **Validation** : `noValidate` partout, pas de validation d'e-mail, de consentement (Contact), de taille/MIME de fichier (S9) ; une seule implémentation `aria-invalid`.
- **Reduced motion** incomplet côté JS (`Tabs`, `Accordion`, menu mobile, toggle tarifs).

### 17.2 Composants absents pour la plateforme (IV, V, VIII, IX)

| Besoin (référence MASTER_PROMPT) | État actuel | Point d'ancrage à respecter (II.7.3) |
|---|---|---|
| Modal / Dialog / Drawer / Sheet (confirmations, panneaux Agent IA IV.8) | `window.confirm` natif ; aucun portail | composant flottant au niveau du layout racine, `z-index` dédié (entre 50 et 100) |
| Toast / notification system (IX.5 audit, IV.14 automatisations) | absent | nouveau composant + provider, jamais dans `Nav`/`Footer` |
| Skeleton / progress bar / stepper de traitement (AI states IV.7, IX.7) | texte « Chargement… » | nouveau composant ; palette hairline + navy, respecter easings |
| Badge de statut sémantique (6 statuts IV.5, Health Score IV.13, Verification Engine IV.11) | un seul badge mono or ; 3 vocabulaires de statuts divergents (audit app-auth F3) | nouveau composant additif, sans renommer `STATUS_LABELS` |
| Table de données (admin V.6, liste de pièces IV.6, SEO Command Center VII.5) | listes `<ul>`/`<dl>` ; aucun `<table>` (grep → 0 hors blog) | nouveau composant |
| Dropdown / menu utilisateur (déconnexion absente de la Nav, F13) | absent | item ajouté à la nav existante par diff minimal |
| Tooltip / Popover (citations et traçabilité IA VIII.4) | absent | nouveau composant |
| Avatar utilisateur | initiales `CD` uniquement côté blog (`BlogPost.tsx:121`) | — |
| Sidebar / navigation de dashboard (onglets Digital Twin, Health Score…) | onglets horizontaux `DossierDetail.tsx:502-522` sans clavier | nouvel item/route enfant, jamais de remplacement d'onglet |
| Graphes / chronologie / ClairGraph (IV.3, IV.4) | frise 5 points statique ; aucun SVG scroll-linked, aucune 3D | nouveaux composants isolés, styles scoped |
| Dropzone réelle (drag & drop, progression par fichier, erreurs) | `label` + `input hidden`, pas d'`onDrop` | AUGMENT du composant existant |
| Search / filtres / pagination (liste de dossiers, blog `SearchAction` déclaré sans fonction — audit routes-seo R12) | absents | nouveaux composants |
| Formulaires : `Field` partagé, select custom, radio group accessible, masques (dates/montants), compteur de caractères | `inputCls` dupliqué ×3, `Field` dupliqué ×3 (Signup/Contact/DossierFlow) | nouveau module `ui/` sans toucher aux inline existants |
| Gating UI (locked state, upsell V.5) | absent | nouveau composant + feature flag `new_pricing_ui` |
| Tokens sémantiques (success/warning/danger/info, surfaces, texte) et tokens d'espacement/hauteur de contrôle | absents (échelle Tailwind brute, 3 tokens couleur inutilisés) | ajout additif dans `@theme`, jamais de renommage |
| Dark mode / thème haute lisibilité | absent (`color-scheme: light`) | hors périmètre, à décider |
| Image OG raster, favicon PNG/ICO, apple-touch-icon (live-site R9) | SVG uniquement | fichiers nouveaux dans `public/` |
| Documentation composants (Storybook ou équivalent) | aucune ; PLAN.md partiellement obsolète | nouveau dossier docs |

### 17.3 Points d'attention accessibilité / cohérence relevés (constats)

| # | Constat | Source |
|---|---|---|
| 1 | Hairlines (1,17:1), coches `emerald-500` (2,46:1) et texte `slate-300` des fonctionnalités « ✗ » (2,33:1) sous les seuils WCAG 1.4.3 / 1.4.11 — calcul indicatif | §1.1-1.3 |
| 2 | Tailles mono ≤ 11,5 px sur eyebrows/labels/badges (`text-[0.62rem]` à `text-[0.72rem]`) | §2.3 |
| 3 | Anneau de focus global en `border-radius: 2px` sur des capsules ; `ring` + `box-shadow` cumulés sur inputs — rendu À VÉRIFIER | `index.css:120,292-298` |
| 4 | `Tabs` : `aria-label` codé en dur, pas de flèches clavier ; onglets app sans `aria-controls`/`tabpanel` | `Tabs.tsx:24`, `DossierDetail.tsx:502-522` |
| 5 | Menu mobile `top-[64px]` en dur | `Nav.tsx:131` |
| 6 | Doubles définitions : `.sheen` (×2), `.font-display` (CSS + utilitaire), `inputCls` (×3), `Field` (×3), `STATUS_LABELS` (×2) | audit design A1-A3, app-auth §7.3 |
| 7 | 5 composants `ui/`/`primitives/` morts ; `Counter` manquant ; Inter 300 chargée sans usage ; 124 `@font-face` déployés | §0, §2.1 |
| 8 | `FinalCTA.tsx:25` deux `sm:py-*` ; `og-default.svg` divergent (carré `#0a1228`, « OVH France ») | audit design A8, A10 |
| 9 | `index.json` des captures référence des `.png` alors que les fichiers sont des `.jpg` | `docs/baseline/screens/index.json` vs `ls` |

---

## Annexe — Traçabilité

**Lus intégralement pour ce document** : `src/index.css`, `PLAN.md` (l.1-150), `src/components/ui/Button.tsx`, `Pill.tsx`, `Card.tsx`, `Tabs.tsx` (l.18-70), `Accordion.tsx` (l.10-60), `Nav.tsx` (l.40-150), `Footer.tsx` (l.26-89), `Logo.tsx`, `RequireAuth.tsx`, `App.tsx` (l.30-46), `Login.tsx`, `Signup.tsx` (l.72-188), `Contact.tsx` (l.124-258), `Account.tsx` (l.84-197), `DossierDetail.tsx` (l.154-213, 440-625, 700-750), `DossierFlow.tsx` (l.413-470, 547-600, 640-866, 940-1067), `Pricing.tsx` (l.141-190, 440-600), `Security.tsx` (l.118-160, 195-222), `BlogPost.tsx` (l.236-297), `Hero.tsx` (l.86-165, 264-280), `FinalCTA.tsx` (l.6-52), `FeaturesGrid.tsx` (l.25-55), `Workflow.tsx` (l.10-58), `AvantApres.tsx` (l.22-92), `WorkspacesTabs.tsx` (l.6-16), `icons.tsx` (index des exports), `index.html` (l.6-8), `dist/assets/index-B6lhu7zR.css` (extraction des tokens), `docs/baseline/screens/home__desktop.jpg`, les 8 rapports d'audit Phase 0.

**Non vérifiés au rendu (À VÉRIFIER lors de la matrice de non-régression III.4)** : cascade `.sheen` vs `transition-all` ; forme réelle de l'anneau de focus sur capsules ; effet de `sm:py-20 sm:py-28` cumulés ; hauteur réelle du header vs `top-[64px]` ; contraste exact des couleurs Tailwind oklch ; grille de `/tarifs` (7 cards) ; comportement `prefers-reduced-motion` sur Tabs/Accordion/menu mobile ; rendu du `<select>` natif par navigateur.

**Grep de comptage reproductibles** (exécutés sur `src/`, 2026-08-23) : `rounded-*`, `shadow-*`, `hairline*`, `gap-*`/`space-y-*`, `tracking-*`, `text-*` tailles, `leading-*`, `font-*` graisses, `text-cream-50/*`, `z-*`, `<svg`, `dark:`, `dialog|createPortal|toast|skeleton|animate-spin|aria-busy`, `window.confirm`, `font-light`.
