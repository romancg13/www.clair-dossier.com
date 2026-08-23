# ClairDossier — Phase 0C · DESIGN_INVENTORY (inventaire du design system)

**Périmètre** : dépôt `/Users/Roman_784/Documents/Codex/2026-07-02/contrainte-absolue-ne-pas-toucher-aux/work/www.clair-dossier.com` (branche `main`, HEAD `865f86c`), lecture seule.
**Date de l'audit** : 2026-08-23.
**Méthode** : lecture intégrale de `src/index.css`, `src/components/ui/*.tsx`, `src/components/primitives/*.tsx`, `src/components/Nav.tsx`, `Footer.tsx`, `Layout.tsx`, `Logo.tsx`, `icons.tsx`, `public/favicon.svg`, `public/og-default.svg`, `PLAN.md`, `package.json`, `src/main.tsx`, `index.html`, `vite.config.ts`, `README.md`, plus lecture ciblée des sections de la Home (`Hero`, `AvantApres`, `Workflow`, `WorkspacesTabs`, `FeaturesGrid`, `PricingPreview`, `FinalCTA`, `FaqBlock`, `DossierLifecycle` l.1-70, `SecurityBlock` l.1-60), `pages/BlogPost.tsx`, `pages/Home.tsx`, `App.tsx`, `data/statuses.ts`, `data/workspaces.ts` (l.1-60) et des `grep` sur `src/`. Le CSS compilé `dist/assets/index-B6lhu7zR.css` a été consulté pour vérifier les tokens effectivement émis. Aucun fichier `.env` lu, aucune commande git modifiante (seulement `git log` / `git show --stat`).
**Convention** : chaque fait cite `fichier:ligne`. Les mentions « non lu » ou « non vérifié » signalent ce qui n'a pas été inspecté.

---

## 1. Tokens Tailwind v4 (`@theme`) — `src/index.css`

Tailwind v4 est chargé via `@import "tailwindcss"` (`src/index.css:1`) et le plugin `@tailwindcss/vite` (`vite.config.ts:3`, `:24`). Le fichier CSS est importé une seule fois dans `src/main.tsx:6` (`import './index.css'`). Le bloc `@theme` couvre `src/index.css:15-62`.

### 1.1 Couleurs (17 tokens)

| Token (`@theme`) | Valeur | Ligne | Commentaire dans le code / usage typique observé |
|---|---|---|---|
| `--color-navy-900` | `#0d1b3d` | `index.css:17` | Texte fort, fonds sombres (sections `WorkspacesTabs`, `FinalCTA`, carte « Avec » d'`AvantApres`), logo, `theme-color` de `index.html:6` |
| `--color-navy-800` | `#152348` | `index.css:18` | Hover du logo (`Logo.tsx:11`), hover CTA secondaire (`Hero.tsx:102`), `bg-navy-800/40` fond de la tablist (`Tabs.tsx:24`) |
| `--color-navy-700` | `#1e2c52` | `index.css:19` | Texte des citations blog (`BlogPost.tsx:116`, `:255`), icône croix « Avant » (`AvantApres.tsx:44`) |
| `--color-navy-600` | `#2a3960` | `index.css:20` | Défini ; aucun usage trouvé par `grep navy-600` dans `src/**/*.tsx` |
| `--color-gold-500` | `#c4a456` | `index.css:22` | CTA primaire (`Hero.tsx:90`), pastille active du Workflow, « CD » du logo, bordures hover (`FeaturesGrid.tsx:33`) |
| `--color-gold-400` | `#e6c97d` | `index.css:23` | Anneau de focus (`index.css:119`, en rgba), grille `premium-tech-section` (`index.css:201-202`) |
| `--color-gold-300` | `#f0d99a` | `index.css:24` | Défini ; aucun usage trouvé par `grep gold-300` dans `src/**/*.tsx` |
| `--color-gold-700` | `#7a5f28` | `index.css:26` | « Texte uniquement sur fond clair — passe WCAG AA (contrast 5.3:1 sur cream-50) » (`index.css:25`). Eyebrows mono (`Hero.tsx:42`), libellés focus formulaires (`index.css:289`) |
| `--color-cream-50` | `#fbf9f4` | `index.css:28` | Fond de page (`index.css:66`, `Layout.tsx:25`, `index.html:41`), texte sur navy |
| `--color-cream-100` | `#f5f0e6` | `index.css:29` | Cards alternées, fond footer à 60 % (`Footer.tsx:27`), lien nav actif (`Nav.tsx:59`) |
| `--color-cream-200` | `#ebe2cf` | `index.css:30` | Hover du bouton `ghost` (`Button.tsx:11`) — composant non utilisé (cf. §2) |
| `--color-ink` | `#0a1228` | `index.css:32` | Couleur de texte de base (`index.css:67`, `Layout.tsx:25`), carré du logo dans `og-default.svg:23` |
| `--color-slate-500` | `#5a6378` | `index.css:33` | Texte secondaire (paragraphes, footer, nav inactive) |
| `--color-slate-400` | `#7c8497` | `index.css:34` | URL dans `og-default.svg:41` ; usage dans `src/**/*.tsx` non vérifié exhaustivement |
| `--color-slate-300` | `#a3aab9` | `index.css:35` | Lignes de fond du Workflow (`Workflow.tsx:43`, `/40`), séparateurs breadcrumb (`BlogPost.tsx:100`), sous-titre `og-default.svg:38` |
| `--color-sky-marker` | `rgba(179, 210, 239, 0.6)` | `index.css:37` | Surligneur du H1 (`index.css:160`), `::selection` (`index.css:83`) |
| `--color-sky-marker-deep` | `rgba(150, 190, 230, 0.8)` | `index.css:38` | Défini ; aucun usage trouvé par `grep sky-marker-deep` dans `src/` hors `index.css` |

Écart avec `PLAN.md:43-55` : le plan liste 10 tokens ; l'implémentation en compte 17 (ajouts : `navy-600`, `gold-300`, `gold-700`, `cream-200`, `slate-400`, `slate-300`, `sky-marker-deep`).

**Couleurs hors palette utilisées en dur (Tailwind par défaut)** — relevé par `grep` sur `src/**/*.tsx` :

| Classe | Occurrences | Fichiers (ligne) |
|---|---|---|
| `text-red-600` / `text-red-700` / `border-red-400` / `bg-red-50` | 4 / 3 / 2 / 2 | `pages/DossierFlow.tsx:664,671,836,1014,1026`, `pages/Login.tsx:66`, `pages/Signup.tsx:130`, `pages/DossierDetail.tsx:205,741` (états d'erreur ; lignes non lues individuellement, seulement localisées) |
| `bg-emerald-100` / `text-emerald-700` / `text-emerald-600` / `text-emerald-500` | 4 / 3 / 1 / 1 | `sections/PricingPreview.tsx:71` (badge « gratuit »), `pages/Pricing.tsx:181,464,581` |
| `bg-amber-50` / `text-amber-700` | 1 / 1 | localisés dans les mêmes fichiers (ligne exacte non relevée) |
| `bg-white` | nombreux | cards blanches (`FeaturesGrid.tsx:33`, `Hero.tsx:129`, `Card.tsx:7`…) — `white` est une couleur Tailwind par défaut, pas un token `@theme` |

### 1.2 Typographie

**Familles** (`index.css:41-43`) :

| Token | Pile | Ligne |
|---|---|---|
| `--font-display` | `"Cormorant Garamond", "Iowan Old Style", Georgia, serif` | `index.css:41` |
| `--font-sans` | `"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` | `index.css:42` |
| `--font-mono` | `"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace` | `index.css:43` |

**Graisses chargées via `@fontsource`** (imports `index.css:3-13`, dépendances `package.json:14-16` en `^5.2.5`) :

| Famille | Fichiers importés | Graisses / styles | Lignes |
|---|---|---|---|
| Cormorant Garamond | `400.css`, `500.css`, `500-italic.css`, `600.css`, `700.css` | 400, 500, 500 italique, 600, 700 | `index.css:3-7` |
| Inter | `300.css`, `400.css`, `500.css`, `600.css` | 300, 400, 500, 600 | `index.css:8-11` |
| JetBrains Mono | `400.css`, `500.css` | 400, 500 | `index.css:12-13` |

Faits complémentaires :
- Les fichiers `@fontsource` déclarent `font-display: swap` (vérifié dans `node_modules/@fontsource/cormorant-garamond/400.css`, commentaire `index.html:38-39`).
- Chaque CSS `@fontsource` contient un `@font-face` par sous-ensemble Unicode : Cormorant = latin, latin-ext, cyrillic, cyrillic-ext, vietnamese ; Inter = + greek, greek-ext ; JetBrains Mono = latin, latin-ext, cyrillic, cyrillic-ext, greek, vietnamese (vérifié par `grep` sur les `400.css`). Le `dist/assets/` contient donc tous ces `.woff`/`.woff2` ; seuls ceux couvrant la `unicode-range` des glyphes affichés sont téléchargés par le navigateur. `README.md:74` parle de « latin + latin-ext » : c'est ce qui est téléchargé en pratique, pas ce qui est buildé.
- `vite.config.ts:38` isole `@fontsource` dans un chunk `fonts`.
- Aucun `<link rel="preload">` de police dans `index.html` (lignes 1-56 lues).
- Base : `html { font-feature-settings: "ss01", "cv11", "calt" }` (`index.css:71`, variantes stylistiques Inter), `body { font-family: var(--font-sans); font-weight: 400; line-height: 1.55 }` (`index.css:74-77`), `h1-h6 { font-weight: 600; letter-spacing: -0.015em }` (`index.css:93-97`), `.font-display { font-family: var(--font-display); font-feature-settings: "liga", "kern" }` (`index.css:88-91`) — ce `.font-display` hors `@layer` double la classe utilitaire générée par Tailwind.
- Antialiasing : `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; text-rendering: optimizeLegibility` (`index.css:68-70`).

### 1.3 Radii

| Token | Valeur | Ligne | Note |
|---|---|---|---|
| `--radius-xs` | `0.25rem` | `index.css:46` | |
| `--radius-sm` | `0.5rem` | `index.css:47` | |
| `--radius-md` | `0.75rem` | `index.css:48` | utilisé par le logo (`Logo.tsx:11`), skip-nav (`index.css:108`) |
| `--radius-lg` | `1.125rem` | `index.css:49` | |
| `--radius-xl` | `1.5rem` | `index.css:50` | cards features (`FeaturesGrid.tsx:33`), `Card.tsx:26` |
| `--radius-full` | `9999px` | `index.css:51` | boutons, pills (89 occurrences de `rounded-full` dans `src/**/*.tsx`) |

**Fait important vérifié dans le CSS compilé** (`dist/assets/index-B6lhu7zR.css`) : `--radius-2xl: 1rem` et `--radius-3xl: 1.5rem` sont les valeurs **par défaut Tailwind v4** (non redéfinies dans `@theme`). Conséquence : `rounded-xl` (1.5rem, custom) est **plus arrondi** que `rounded-2xl` (1rem, défaut) et égal à `rounded-3xl`. Or `rounded-2xl` est la classe la plus utilisée pour les cards (43 occurrences contre 34 pour `rounded-xl`) : `Hero.tsx:129`, `AvantApres.tsx:26,68`, `PricingPreview.tsx:66`, `WorkspacesTabs.tsx:67`, `BlogPost.tsx:139,166,211,279`. Autres usages : `rounded-lg` 12, `rounded-md` 3, `rounded-3xl` 1 (`Hero.tsx:260`), `rounded-t` 1.

### 1.4 Ombres

| Token | Valeur | Ligne | Usage |
|---|---|---|---|
| `--shadow-card` | `0 2px 24px rgba(13, 27, 61, 0.06)` | `index.css:54` | `Card.tsx:7`, `Hero.tsx:129`, menu mobile `Nav.tsx:142`, `PricingPreview.tsx:55` |
| `--shadow-card-hover` | `0 12px 48px rgba(13, 27, 61, 0.1)` | `index.css:55` | `Card.tsx:32`, `.premium-card:hover` (`index.css:303`) |
| `--shadow-gold` | `0 8px 24px rgba(196, 164, 86, 0.22)` | `index.css:56` | CTA or (`Nav.tsx:80,95`, `Hero.tsx:90`, `FinalCTA.tsx:40`) |
| `--shadow-gold-strong` | `0 14px 36px rgba(196, 164, 86, 0.32)` | `index.css:57` | hover CTA or (`Hero.tsx:90`, `Button.tsx:9`) |

Ombres en dur hors tokens : `shadow-[0_4px_24px_rgba(13,27,61,0.05)]` sur le header scrollé (`Nav.tsx:44`) ; `.premium-recommended-plan` `0 18px 60px rgba(13,27,61,0.18), inset 0 1px 0 rgba(255,255,255,0.08)` (`index.css:241-245`) ; focus formulaire `0 0 0 3px rgba(196,164,86,0.16), 0 12px 30px rgba(13,27,61,0.06)` (`index.css:295-297`).

### 1.5 Easings

| Token | Valeur | Ligne | Réutilisé en JS |
|---|---|---|---|
| `--ease-out-expo` | `cubic-bezier(0.16, 1, 0.3, 1)` | `index.css:60` | `Reveal.tsx:4`, `SplitWords.tsx:4`, `Hero.tsx:41,73,85,111,126` (tableau `[0.16, 1, 0.3, 1]`) |
| `--ease-out-soft` | `cubic-bezier(0.22, 1, 0.36, 1)` | `index.css:61` | `Accordion.tsx:51`, `Tabs.tsx:65`, `Card.tsx:34`, `FeaturesGrid.tsx:32` (tableau `[0.22, 1, 0.36, 1]`) |

Les deux tokens sont bien émis dans le CSS compilé (`--ease-out-expo`, `--ease-out-soft` présents dans `dist/assets/index-B6lhu7zR.css`).

### 1.6 Spacing custom, containers, breakpoints

- **Spacing** : aucun token `--spacing-*` dans `@theme` (`index.css:15-62`). Échelle Tailwind par défaut.
- **Containers** (`max-w-*`) : aucun override ; le CSS compilé émet les valeurs par défaut `--container-xs: 20rem`, `md: 28rem`, `xl: 36rem`, `2xl: 42rem`, `3xl: 48rem`, `4xl: 56rem`, `5xl: 64rem`, `6xl: 72rem`, `7xl: 80rem`.
- **Breakpoints** : aucun `--breakpoint-*` dans `@theme`. Le CSS compilé contient les media queries `min-width: 40rem` (sm), `48rem` (md), `64rem` (lg), `80rem` (xl), `96rem` (2xl), soit les défauts Tailwind v4. Une media query manuelle `max-width: 640px` existe pour le drop cap (`index.css:348`).

### 1.7 Keyframes et animations

| Nom | Défini dans | Durée / timing | Cible |
|---|---|---|---|
| `premium-ambient-sweep` | `index.css:326-329` | `18s var(--ease-out-soft) infinite alternate` (`index.css:184`) | `.premium-hero-shell::after` — balayage de `background-position` sur la 3e couche (gradient blanc 30 %) |
| `premium-grid-drift` | `index.css:331-334` | `28s linear infinite` (`index.css:207`) | `.premium-tech-section::before` — grille 56×56 px or à 16 %/11 % d'opacité, opacité globale 0.24 (`index.css:199-206`) |
| `marquee` | `Marquee.tsx:32-37` (balise `<style>` inline) | `${duration}s linear infinite`, 60 s par défaut (`Marquee.tsx:10,25`) | `translateX(0) → translateX(-50%)` — **composant non utilisé** (cf. §3) |
| Flottement carte hero | `Hero.tsx:130-135` (Motion, pas CSS) | `y: [0, -6, 0]`, 8 s, `easeInOut`, `repeat: Infinity` | `.premium-preview-card` |
| Pulse pastille or | `Hero.tsx:199-217` (Motion) | `scale [1, 1.4, 1]`, `opacity [1, 0.6, 1]`, 1.8 s, infini | point « active » de la timeline hero |

### 1.8 Utilities / classes custom définies dans `index.css` (hors `@layer`)

| Classe / sélecteur | Lignes | CSS (résumé fidèle) |
|---|---|---|
| `html` | `65-72` | `background: cream-50; color: ink;` antialiasing ; `font-feature-settings: "ss01","cv11","calt"` |
| `body` | `74-80` | `font-family: var(--font-sans); font-weight: 400; line-height: 1.55; overflow-x: clip; min-height: 100dvh` |
| `::selection` | `82-85` | `background: var(--color-sky-marker); color: navy-900` |
| `.font-display` | `88-91` | `font-family: var(--font-display); font-feature-settings: "liga","kern"` |
| `h1…h6` | `93-97` | `color: inherit; font-weight: 600; letter-spacing: -0.015em` |
| `.skip-nav` / `.skip-nav:focus` | `100-112` | `position: fixed; top: -100%; left: 1rem; z-index: 100; padding .75rem 1.25rem; bg navy-900; color cream-50; radius md; font-weight 600; transition top .2s ease-out-soft` → `top: 1rem` au focus. Utilisé `Layout.tsx:26` |
| `*:focus` / `*:focus-visible` | `115-121` | `outline: none` ; focus-visible = `outline: 2px solid navy-900; outline-offset: 2px; box-shadow: 0 0 0 4px rgba(230,201,125,0.95); border-radius: 2px` (anneau or-400) |
| `.hairline` | `124` | `border-color: rgba(13,27,61,0.08)` — 97 occurrences dans `src/**/*.tsx` |
| `.hairline-strong` | `125` | `border-color: rgba(13,27,61,0.12)` — 5 occurrences |
| `.hairline-gold` | `126` | `border-color: rgba(196,164,86,0.35)` — 24 occurrences |
| `.sheen` / `.sheen::before` / `.sheen:hover::before` | `129-148` | `position: relative; overflow: hidden; isolation: isolate` ; pseudo `::before` `inset: 0`, gradient `115deg transparent 30% / rgba(255,255,255,.45) 50% / transparent 70%`, `translateX(-100%)`, `transition: transform .6s ease-out-soft` ; hover → `translateX(100%)` |
| `.sheen` (2e déclaration) | `272-277` | `transition: transform 180ms ease-out-expo, box-shadow 360ms ease-out-expo, filter 360ms ease-out-soft` — redéfinit la `transition` de l'élément (pas du `::before`). Étant hors `@layer`, cette règle l'emporte sur les utilitaires Tailwind `transition-* duration-*` posés sur les mêmes boutons (ex. `Hero.tsx:90` `transition-all duration-300`) selon la cascade des layers (non vérifié au rendu) |
| `.marker-track` / `::before` / `[data-revealed="true"]::before` | `151-169` | `display: inline-block; isolation: isolate` ; `::before` `inset: 0.2em -0.08em 0.05em -0.08em; background: sky-marker; z-index: -1; border-radius: 0.1em 0.3em 0.15em 0.2em; transform-origin: left center; transform: scaleX(var(--marker-scale, 0)); transition: transform .9s ease-out-expo` ; révélé → `--marker-scale: 1` |
| `.premium-hero-shell::after` | `173-185` | couche `-z-10` : 2 radial-gradients (or 13 % à 16 %/18 %, sky 22 % à 82 %/14 %) + gradient blanc 120deg, `background-size 100%/100%/220%`, animation `premium-ambient-sweep` |
| `.premium-tech-section` / `::before` | `187-208` | `isolation: isolate; overflow: hidden` ; grille or 56 px + 2 radial-gradients, `opacity .24`, animation `premium-grid-drift` |
| `.premium-card` / `::after` / `svg` | `210-239` | `transform: translateZ(0); will-change: transform; transition 360ms` (transform/border/bg/box-shadow/filter) ; `::after` `inset -1px`, gradient 135deg or 22 % → sky 15 %, `opacity 0` ; svg transition 360ms |
| `.premium-recommended-plan` | `241-245` | ombre double (cf. §1.4) |
| `.premium-preview-card` | `247-249` | `backface-visibility: hidden` |
| `header nav a` / `::after` | `251-270` | soulignement or 1 px (`right/left .85rem; bottom .38rem; gradient 90deg transparent → or 82 % → transparent`), `opacity 0; scaleX(.42)` |
| `form input, textarea, select` | `279-286` | transition 180ms border/bg/box-shadow |
| `form label:focus-within > span:first-child` | `288-290` | `color: gold-700` |
| `form input/textarea/select:focus` | `292-298` | anneau or 3 px 16 % + ombre navy |
| `@media (hover: hover) and (pointer: fine)` | `300-324` | `.premium-card:hover` → `translate3d(0,-6px,0); shadow-card-hover; saturate(1.03)` ; `::after` opacité 1 ; svg `translate3d(1px,-1px,0) scale(1.035)` ; `header nav a:hover::after, header nav a[aria-current="page"]::after` → `opacity 1; scaleX(1)` ; `.sheen:hover` → `saturate(1.05)` |
| `.drop-cap > p:first-of-type::first-letter` | `337-345` | Cormorant 600, `float: left; font-size: 4.2em; line-height: .85; margin: .05em .12em 0 0; color: navy-900` ; désactivé sous 640 px (`348-355`) |
| `@media (prefers-reduced-motion: reduce)` | `358-375` | `animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important` sur `*` ; `.sheen::before { display: none }` ; `.marker-track::before { transform: scaleX(1) }` ; animations `premium-*` → `none` ; `.premium-card` transforms → `none` |

---

## 2. Composants UI — `src/components/ui/`

**Constat préalable (grep sur `src/`)** : seuls `Tabs` (importé `WorkspacesTabs.tsx:1`) et `Accordion` (importés `FaqBlock.tsx:1`, `pages/Pricing.tsx:6`) sont utilisés. **`Button.tsx`, `Pill.tsx` et `Card.tsx` ne sont importés nulle part** (`grep -rn "components/ui\|/ui/"` ne retourne que les 3 lignes ci-dessus ; aucune balise `<Button`, `<Pill`, `<Card` dans `src/`). Les boutons et pills du site sont écrits inline avec des classes Tailwind (ex. `Hero.tsx:88-105`, `Hero.tsx:268-274`, `Nav.tsx:72-99`).

### 2.1 `Button` — `src/components/ui/Button.tsx` (non utilisé)

| Aspect | Détail | Ligne |
|---|---|---|
| Props communes | `children`, `variant` (`primary` par défaut), `size` (`md`), `className`, `full` (→ `w-full`) | `Button.tsx:21-27`, `:50-56`, `:61` |
| Polymorphisme | `to` → `<Link>` (React Router) ; `href` → `<a target rel>` ; sinon `<button type onClick disabled>` | `:29-47`, `:65-84` |
| Base | `inline-flex items-center justify-center gap-2 rounded-full font-semibold leading-none transition-[background-color,transform,box-shadow,border-color] duration-200` | `:58` |
| `primary` | `sheen bg-gold-500 text-navy-900 shadow-gold hover:-translate-y-0.5 hover:shadow-gold-strong` | `:8-9` |
| `secondary` | `bg-navy-900 text-cream-50 hover:bg-navy-800 hover:-translate-y-0.5` | `:10` |
| `ghost` | `bg-cream-100 text-navy-900 hover:bg-cream-200` | `:11` |
| `outline` | `border hairline bg-transparent text-navy-900 hover:border-gold-500 hover:text-navy-900` | `:12` |
| `sm` / `md` / `lg` | `px-3.5 py-2 text-sm` / `px-5 py-3 text-sm` / `px-6 py-3.5 text-base` | `:16-18` |
| Disabled | `opacity-60 cursor-not-allowed` ajouté uniquement sur `<button>` | `:81` |
| Focus | aucune classe dédiée ; repose sur le `*:focus-visible` global (`index.css:116-121`) | — |
| Sheen | via la classe `.sheen` (`index.css:129-148`) sur `primary` uniquement | `:9` |

Écart `PLAN.md:68` : le plan prévoit 3 variants (`primary/secondary/ghost`) ; l'implémentation en a 4 (+`outline`).

### 2.2 `Pill` — `src/components/ui/Pill.tsx` (non utilisé)

| Tone | Classes | Ligne |
|---|---|---|
| Base | `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium` | `Pill.tsx:23` |
| `cream` (défaut) | `bg-cream-100 text-navy-900 border hairline-gold` | `:6` |
| `navy` | `bg-navy-900 text-cream-50 border border-navy-900` | `:7` |
| `gold` | `bg-gold-500/15 text-navy-900 border hairline-gold` | `:8` |
| `mono` | `bg-cream-50 text-navy-900 border hairline font-mono uppercase tracking-[0.16em] text-[0.7rem]` (cumule `text-xs` de la base et `text-[0.7rem]` ; ordre de priorité non vérifié) | `:9` |

Le pill réellement affiché sur la Home est `FactPill` (`Hero.tsx:268-274`) : `inline-flex items-center gap-1.5 rounded-full border hairline-gold bg-cream-50 px-3 py-1.5 text-xs font-medium text-navy-900` + point or 4 px (`h-1 w-1 rounded-full bg-gold-500`). Bordure or à 35 % d'opacité (`hairline-gold`, `index.css:126`), et non 8 % comme l'écrit `PLAN.md:16`.

### 2.3 `Card` — `src/components/ui/Card.tsx` (non utilisé)

| Aspect | Détail | Ligne |
|---|---|---|
| Props | `variant` (`white` défaut / `cream` / `navy`), `className`, `interactive` (false), `as` (`article` défaut, `div`, `section`, `li`) | `Card.tsx:12-24` |
| Base | `rounded-xl p-6 transition-[border-color,box-shadow,transform] duration-300` | `:26` |
| `white` | `bg-white border hairline shadow-card` | `:7` |
| `cream` | `bg-cream-100 border hairline-strong` | `:8` |
| `navy` | `bg-navy-900 text-cream-50 border border-navy-800` | `:9` |
| Interactive | si `interactive && !reduce` : `motion[as]` avec `hover:border-gold-500 hover:shadow-card-hover hover:-translate-y-1`, `whileHover={{ y: -4 }}`, 0.25 s ease-out-soft | `:28-38` |
| Reduced motion | `useReducedMotion()` → élément statique via `createElement` | `:25`, `:41` |

Les cards réelles reproduisent ce pattern inline : `FeaturesGrid.tsx:30-34` (`premium-card group … rounded-xl border hairline bg-white p-6 … hover:border-gold-500`, `whileHover y:-4`).

### 2.4 `Tabs` — `src/components/ui/Tabs.tsx` (utilisé par `WorkspacesTabs.tsx:32-39`)

| Aspect | Détail | Ligne |
|---|---|---|
| Props | `items: {id,label,content}[]`, `defaultId?`, `className?` | `Tabs.tsx:4-18` |
| État | `useState(defaultId ?? items[0]?.id)` | `:19` |
| Tablist | `role="tablist" aria-label="Espaces dédiés"` (libellé **codé en dur**, non paramétrable) ; `inline-flex flex-wrap gap-2 rounded-full border border-cream-50/15 bg-navy-800/40 p-1 backdrop-blur` → conçu pour fond navy | `:24` |
| Tab | `role="tab" aria-selected aria-controls tabIndex={isActive?0:-1}` ; `relative min-h-[40px] rounded-full px-4 py-2 text-xs font-medium transition-colors sm:px-5 sm:text-sm` ; actif `text-navy-900`, inactif `text-cream-50/75 hover:text-cream-50` | `:28-40` |
| Indicateur | `motion.span layoutId="tab-active"` `absolute inset-0 rounded-full bg-gold-500`, spring `stiffness 380, damping 32` | `:41-47` |
| Panel | `AnimatePresence mode="wait"`, `role="tabpanel" tabIndex={0}`, `initial {opacity 0, y 8} → animate {1, 0} → exit {0, -8}`, 0.35 s ease-out-soft ; conteneur `mt-8 min-h-[280px]` | `:54-69` |
| Clavier | pas de gestion flèches gauche/droite (aucun `onKeyDown` dans le fichier) | — |
| Reduced motion | pas de `useReducedMotion` dans ce fichier ; seul le CSS global (`index.css:358-363`) raccourcit les transitions — les animations Motion (JS) ne sont pas couvertes par ce CSS | — |

### 2.5 `Accordion` — `src/components/ui/Accordion.tsx` (utilisé par `FaqBlock.tsx:19-25`, `pages/Pricing.tsx`)

| Aspect | Détail | Ligne |
|---|---|---|
| Props | `items: {id, question, answer: ReactNode}[]` | `Accordion.tsx:4-10` |
| État | un seul item ouvert ; **premier item ouvert par défaut** (`items[0]?.id`) | `:11` |
| Liste | `ul.divide-y hairline border-y hairline` | `:14` |
| Trigger | `button` `flex min-h-[44px] w-full items-center justify-between gap-4 py-4 … sm:gap-6 sm:py-5`, `aria-expanded`, `aria-controls`, ids `accordion-trigger-*` / `accordion-panel-*` | `:19-26` |
| Question | `font-display text-base font-semibold text-navy-900 sm:text-xl` | `:27` |
| Icône | cercle 32 px `rounded-full border hairline`, SVG « + » 12 px stroke 1.5, `rotate(45deg)` si ouvert (→ « × »), `transition-transform` | `:30-39` |
| Panel | `AnimatePresence initial={false}`, `motion.div role="region" aria-labelledby`, `height 0→auto`, `opacity 0→1`, 0.35 s ease-out-soft, `overflow-hidden` | `:41-57` |
| Réponse | `pb-5 pr-2 text-sm text-slate-500 leading-relaxed sm:pb-6 sm:pr-10 sm:text-base` | `:54` |
| Reduced motion | pas de `useReducedMotion` ; même remarque que `Tabs` | — |

---

## 3. Primitives motion — `src/components/primitives/`

| Primitive | Utilisée ? (grep) |
|---|---|
| `Reveal` / `Stagger` / `StaggerItem` | Oui, dans 10 sections et 8 pages (ex. `AvantApres.tsx:1`, `FeaturesGrid.tsx:3`, `pages/Pricing.tsx:5`) |
| `SplitWords` | Oui, `Hero.tsx:4,48-67` |
| `MarkerHighlight` | Oui, `Hero.tsx:3,55-62` |
| `Marquee` | **Non** — aucun import dans `src/` ; son consommateur `sections/Partners.tsx` a été supprimé par le commit `7fafc9b` « Remove fake content + add 4 new blog articles » (`git show --stat 7fafc9b` : `Partners.tsx -27`, `data/partners.ts -16`, `TestimonialsBlock.tsx -44`, `data/testimonials.ts -34`) |
| `Magnetic` | **Non** — aucun import dans `src/` |
| `Counter` (prévu `PLAN.md:65`) | **Fichier inexistant** (`find src -type f` ne le liste pas) |

### 3.1 `Reveal` — `Reveal.tsx:18-75`

| Paramètre | Valeur | Ligne |
|---|---|---|
| Easing | `EASE_OUT_EXPO = [0.16, 1, 0.3, 1]` | `:4` |
| Viewport | `{ once: true, amount: 0, margin: '240px' }` — déclenche dès que l'élément est à 240 px de la zone visible | `:14` |
| Props | `delay` (0), `y` (18), `className`, `as` (`div` ; `section/article/header/span/aside/figure`), `id` ; une prop `amount?: number` est **déclarée dans le type mais jamais lue** (`:30`) | `:18-33` |
| Animation | `initial {opacity 0, y}` → `whileInView {opacity 1, y 0}`, `duration 0.65`, `delay` | `:63-74` |
| Fallback | `FALLBACK_MS = 900` : après 900 ms, bascule en `animate` forcé (`duration 0.55`) pour éviter un contenu invisible si l'observer ne se déclenche pas | `:9`, `:37-40`, `:48-61` |
| Reduced motion | `useReducedMotion()` → `createElement(as, {className,id}, children)` statique | `:34`, `:42-44` |

Écart `PLAN.md:60` : le plan prévoit `amount: 0.2` ; l'implémentation utilise `amount: 0` + `margin 240px`.

### 3.2 `Stagger` / `StaggerItem` — `Reveal.tsx:77-149`

| Paramètre | Valeur | Ligne |
|---|---|---|
| Parent | variants `hidden {}` / `visible { staggerChildren 0.07, delayChildren 0.05 }` | `:77-80` |
| Enfant | `hidden {opacity 0, y 18}` → `visible {opacity 1, y 0, duration 0.6, ease expo}` | `:82-85` |
| Props `Stagger` | `className`, `inView` (true → `whileInView` + `VIEWPORT_CONFIG` ; false → `animate`), `delay` (→ `delayChildren`) | `:87-97`, `:131-134` |
| Fallback 900 ms | identique à `Reveal` | `:102-105`, `:109-123` |
| Reduced motion | `<div>` statique pour les deux | `:107`, `:143` |

### 3.3 `SplitWords` — `SplitWords.tsx:10-64`

| Paramètre | Valeur | Ligne |
|---|---|---|
| Props | `text?`, `className?`, `stagger` (0.055), `duration` (0.9), `segments?: Array<string \| {node}>` | `:10-23` |
| Découpage | `segments ?? text.split(' ')` | `:25` |
| Animation | chaque mot : wrapper `inline-block overflow-hidden aria-hidden`, `motion.span` `initial {y '110%', opacity 0}` → `animate {y '0%', opacity 1}`, `delay i*stagger`, ease expo | `:48-61` |
| Accessibilité | `aria-label={text}` sur le conteneur, mots `aria-hidden="true"` | `:48`, `:50` |
| Reduced motion | spans statiques sans Motion | `:27-45` |
| Appel réel | `Hero.tsx:48-67` : `stagger={0.06}`, `duration={0.85}`, 9 segments | — |

Écart `PLAN.md:61` : « 1s » prévu ; 0.9 s par défaut, 0.85 s en usage.

### 3.4 `MarkerHighlight` — `MarkerHighlight.tsx:9-34`

| Paramètre | Valeur | Ligne |
|---|---|---|
| Props | `children`, `delay` (0, en secondes) | `:9-15` |
| Mécanisme | `setTimeout(delay*1000)` → `setRevealed(true)` → attribut `data-revealed="true"` sur `span.marker-track` ; l'animation est **CSS** (`index.css:151-169`) : `scaleX(0 → 1)` sur `::before`, 0.9 s `ease-out-expo`, origine gauche | `:20-27`, `:30` |
| Reduced motion | `setRevealed(true)` immédiat (`:21-24`) + CSS `.marker-track::before { transform: scaleX(1) }` (`index.css:365`) | — |
| Appel réel | 3 mots du H1 : `clair,` (delay 0.6), `structuré` (0.85), `suivi.` (1.1) — `Hero.tsx:55-62` | — |

Écart : le commentaire du fichier (`:6`) et `PLAN.md:13,62` parlent de `clip-path` ; l'implémentation réelle est un `transform: scaleX` (`index.css:164-165`). Aucune occurrence de `clip-path`/`clipPath` dans `src/` hors ce commentaire (grep).

### 3.5 `Marquee` — `Marquee.tsx:8-40` (non utilisé)

| Paramètre | Valeur | Ligne |
|---|---|---|
| Props | `children`, `duration` (60 s), `className` | `:8-16` |
| Structure | conteneur `group relative overflow-hidden` ; piste `flex w-max gap-12` avec `animation: marquee ${duration}s linear infinite` ; contenu dupliqué (`aria-hidden` sur la copie) | `:22-31` |
| Pause | `group-hover:[animation-play-state:paused]` | `:24` |
| Keyframes | `<style>` inline `translateX(0) → translateX(-50%)` | `:32-37` |
| Reduced motion | `flex flex-wrap gap-12` statique | `:17-20` |

Écart `PLAN.md:63` : « opacity 35 % → 100 % au hover » — aucune règle d'opacité dans le fichier (le commentaire `:6` l'annonce mais rien ne l'implémente).

### 3.6 `Magnetic` — `Magnetic.tsx:9-52` (non utilisé)

| Paramètre | Valeur | Ligne |
|---|---|---|
| Props | `children`, `strength` (0.18), `className` | `:9-17` |
| Mécanisme | `useMotionValue` x/y + `useSpring({ stiffness: 200, damping: 18 })` ; sur `mousemove`, décalage = (curseur − centre) × strength ; `mouseleave` → 0 | `:20-37` |
| Commentaire | « Léger pull au hover (max 6px). Pour CTAs majeurs uniquement. » (`:6-7`) — la borne 6 px n'est pas codée (pas de clamp) | — |
| Reduced motion | `<span>` statique | `:39` |

### 3.7 Gestion globale de `prefers-reduced-motion`

- **JS** : `useReducedMotion()` (Motion) dans `Reveal`, `Stagger`, `StaggerItem`, `SplitWords`, `MarkerHighlight`, `Marquee`, `Magnetic`, `Card`, `Hero.tsx:24` (flottement et pulse désactivés `:130-135`, `:201-214`), `Workflow.tsx:13,49` (`scaleX` forcé à 1), `FeaturesGrid.tsx:8,31`.
- **CSS** : `index.css:358-375` (cf. §1.8).
- **Non couverts par JS** : `Tabs`, `Accordion`, menu mobile `Nav.tsx:130-146` (animations Motion sans `useReducedMotion`).

---

## 4. Navigation et pied de page

### 4.1 `Nav` — `src/components/Nav.tsx`

| Aspect | Détail | Ligne |
|---|---|---|
| Liens principaux (`NAV_ITEMS`) | `/fonctionnalites` « Fonctionnalités », `/tarifs` « Tarifs », `/securite` « Sécurité », `/blog` « Journal », `/contact` « Contact » | `Nav.tsx:7-13` |
| Conteneur | `<header class="sticky top-0 z-40 transition-[background,border-color,box-shadow] duration-300">` ; inner `mx-auto flex max-w-7xl items-center gap-6 px-5 py-3.5 sm:px-8 lg:px-12` | `:41-48` |
| État scrollé | `useScroll` + `useMotionValueEvent(scrollY)` → `scrolled = latest > 24` ; scrollé : `border-b hairline bg-cream-50/92 backdrop-blur-xl shadow-[0_4px_24px_rgba(13,27,61,0.05)]` ; sinon `border-b border-transparent bg-cream-50/70 backdrop-blur-md` | `:18`, `:21`, `:42-46` |
| Logo | `<Logo />` (taille 40, wordmark) | `:49` |
| Nav desktop | `nav.ml-auto hidden items-center gap-1 lg:flex` `aria-label="Navigation principale"` ; `NavLink` `rounded-full px-3.5 py-2 text-sm font-medium transition-colors` ; actif `text-navy-900 bg-cream-100`, inactif `text-slate-500 hover:text-navy-900 hover:bg-cream-100/70` ; soulignement or via `header nav a::after` (`index.css:255-270`, `:315-319`) sur hover et `aria-current="page"` (posé automatiquement par `NavLink`) | `:51-67` |
| CTA desktop — **déconnecté** | `/connexion` « Se connecter » (`rounded-full px-4 py-2.5 text-sm font-medium text-navy-900 hover:bg-cream-100`) + `/inscription` « Créer un compte » (`sheen rounded-full bg-gold-500 px-4 py-2.5 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5`) | `:86-99` |
| CTA desktop — **connecté** (`session` de `useAuth`, `src/lib/auth.tsx` non lu) | `/compte` « Mon compte » (`rounded-full bg-navy-900 px-4 py-2.5 text-sm font-medium text-cream-50 hover:bg-navy-800`) + `/dossier/nouveau` « Créer un dossier » (même style or sheen) | `:19`, `:70-84` |
| Bouton burger | `ml-auto grid h-11 w-11 place-items-center rounded-md border hairline lg:hidden` ; `aria-expanded`, `aria-controls="mobile-menu"`, `aria-label` « Ouvrir le menu » / « Fermer le menu » ; SVG 18×14, 3 traits (le 3e plus court : `x2=11`) ↔ croix | `:103-125` |
| Menu mobile | `AnimatePresence` ; overlay `fixed inset-x-0 top-[64px] z-50 bottom-0 lg:hidden` (fade 0.2 s) ; backdrop `bg-navy-900/30 backdrop-blur-sm` cliquable ; panneau `motion.nav` `absolute inset-x-0 top-0 bg-cream-50 border-b hairline px-5 py-6 shadow-card`, spring `stiffness 320, damping 32`, `y '-30%' → 0` ; `id="mobile-menu"`, `aria-label="Navigation mobile"` | `:128-149` |
| Liens mobile | `NavLink` `rounded-md px-4 py-3 text-base font-medium` ; actif `bg-cream-100 text-navy-900` | `:150-165` |
| CTA mobile | même logique session ; boutons `w-full rounded-full … py-3 text-center` (navy puis or sheen) | `:166-202` |
| Comportements | `document.body.style.overflow = 'hidden'` quand ouvert (`:23-28`) ; fermeture sur `Escape` (`:30-38`) ; fermeture au clic sur un lien (`onClick={() => setOpen(false)}`) | — |
| Seuil `top-[64px]` | valeur codée en dur ; la hauteur réelle du header (`py-3.5` + logo 40 px) n'est pas calculée | `:131` |

### 4.2 `Footer` — `src/components/Footer.tsx`

| Aspect | Détail | Ligne |
|---|---|---|
| Conteneur | `footer.border-t hairline bg-cream-100/60` ; inner `mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-12` | `Footer.tsx:27-28` |
| Grille | `grid gap-12 lg:grid-cols-[1.4fr_1fr_1fr_1fr]` → **4 colonnes** (marque + 3 listes) | `:29` |
| Colonne marque | `<Logo />` + paragraphe `mt-5 max-w-xs text-sm leading-relaxed text-slate-500` : « ClairDossier structure vos dossiers administratifs et juridiques — du brouillon à la transmission, avec dépôt de pièces sécurisé, suivi de l'avancement et échéances réunies au même endroit. » | `:30-37` |
| Colonne « Produit » | `/fonctionnalites` Fonctionnalités · `/tarifs` Tarifs · `/securite` Sécurité · `/dossier/nouveau` Créer un dossier | `:4-9`, `:39` |
| Colonne « Ressources » | `/blog` Journal · `/contact` Contact & démo · `/securite#conformite` Conformité · `/securite#dpa` DPA | `:11-16`, `:40` |
| Colonne « Légal » | `/mentions-legales` Mentions légales · `/cgv` CGV · `/politique-confidentialite` Confidentialité · `/cookies` Cookies | `:18-23`, `:41` |
| Titre de colonne | `h3.font-mono text-[0.7rem] uppercase tracking-[0.18em] text-navy-900` ; liens `text-sm text-slate-500 hover:text-navy-900`, `space-y-2.5` | `:72-84` |
| Barre basse | `mt-12 flex flex-col gap-3 border-t hairline pt-6 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between` | `:44` |
| Copyright (exact) | `© 2026 ClairDossier · Édité par Roman Gomes · SIREN 105 490 734` en `font-mono` | `:45-47` |
| Mention droite (exact) | `Hébergeur conforme RGPD · Pièces chiffrées au repos · ` + lien `/securite` « Charte de sécurité » (`border-b hairline-gold hover:text-navy-900`) | `:48-56` |
| E-mail / téléphone / adresse | **Absents du Footer** (fichier lu intégralement, lignes 1-89). Les coordonnées existent ailleurs : e-mail `contact.clairdossier@icloud.com` (`index.html:49` noscript `mailto:`, `pages/Contact.tsx:98-99`, `data/legal.ts:48,62,114,…`) ; WhatsApp `+33 7 82 98 36 44` (`src/lib/whatsapp.ts:6` `WHATSAPP_DISPLAY`, `data/legal.ts:48`) ; adresse « Château-Gombert, 13013 Marseille » (`data/legal.ts:262`). Le commit `f98e7e6` mentionne « 96 avenue Paul Dalbret, 13013 Marseille » (message de commit seulement ; présence actuelle dans `legal.ts` non vérifiée). | — |

Écart `PLAN.md:76` : « 3 cols + mention RCS placeholder » → implémentation à 4 colonnes et mention SIREN réelle.

### 4.3 `Layout` — `src/components/Layout.tsx`

- `div.flex min-h-dvh flex-col bg-cream-50 text-ink` (`:25`), skip-link `a.skip-nav href="#main"` « Aller au contenu principal » (`:26`), `<Nav/>`, `<main id="main" tabIndex={-1} class="flex-1 outline-none">` (`:28`), `<Footer/>`.
- À chaque changement de `location.pathname` : scroll en haut (`window.scrollTo`, `documentElement.scrollTop`, `body.scrollTop`) puis focus sur `<main>` sauf au premier rendu (`:13-22`).

---

## 5. Logo et icônes

### 5.1 `Logo` — `src/components/Logo.tsx`

| Élément | Détail | Ligne |
|---|---|---|
| Wrapper | `<Link to="/" class="group inline-flex items-center gap-3" aria-label="ClairDossier — accueil">` | `Logo.tsx:5-9` |
| Carré | `grid place-items-center rounded-md bg-navy-900 font-display font-bold leading-none text-gold-500 group-hover:bg-navy-800` ; `width/height = size` (40 px défaut), `fontSize = size * 0.42` (16.8 px) ; texte « CD » | `:10-15` |
| Wordmark | « ClairDossier » `font-display text-[1.05rem] font-semibold text-navy-900` | `:18-20` |
| Tagline | « Dossiers administratifs et juridiques, clairs. » `text-[0.7rem] text-slate-500` | `:21` |
| Props | `size` (40), `withWordmark` (true) | `:3` |

Couleurs : fond `navy-900 #0d1b3d`, lettres `gold-500 #c4a456`, radius `md` = 0,75 rem (token `index.css:48`).

### 5.2 `public/favicon.svg`

- `viewBox 0 0 64 64`, `rect rx=12 fill=#0d1b3d` (`favicon.svg:2`), texte « CD » `Cormorant Garamond, Georgia, serif` poids 700, 34 px, `fill=#c4a456` (`:3`). Lié dans `index.html:11`. Aucun `apple-touch-icon` ni PNG de secours dans `index.html` (lignes 1-56) ni dans `public/` (listing `ls public`).

### 5.3 `public/og-default.svg` (1200×630)

| Élément | Détail | Ligne |
|---|---|---|
| Fond | gradient linéaire `#0d1b3d → #1e2c52` (navy-900 → navy-700) + 2 halos radiaux or `#c4a456` à 32 % et 18 % | `og-default.svg:3-19` |
| Logo | carré 72 px `rx=14` **`fill=#0a1228` (ink)** — diffère du composant React (`navy-900`) et du favicon ; « CD » Cormorant 700 38 px or | `:22-25` |
| Wordmark | « ClairDossier » Cormorant 600 32 px `#fbf9f4` | `:28` |
| Eyebrow | « LEGALTECH · CLIENTS · PME · CABINETS » JetBrains Mono 500 20 px or, `letter-spacing 4` | `:31` |
| H1 | « Votre dossier juridique, / clair, **structuré** et suivi. » Cormorant 600 78 px cream, « structuré » en or | `:34-35` |
| Sous-titre | « Plateforme legaltech française · OVH France · RGPD natif » Inter 24 px `#a3aab9` | `:38` |
| URL | « clair-dossier.com » JetBrains Mono 18 px `#7c8497` | `:41` |
| Hairline | ligne or 120 px, épaisseur 2 | `:44` |

Écarts de contenu : le H1 de l'OG (« Votre dossier juridique… ») diffère du H1 du site (« Votre dossier administratif et juridique… », `Hero.tsx:64`) ; l'OG affirme « OVH France » alors que la section sécurité dit « Hébergeur conforme RGPD » sans nommer l'hébergeur (`SecurityBlock.tsx:16-17`). L'OG est référencé dans `index.html:27,36` en SVG (format non pris en charge par tous les crawlers sociaux — non vérifié ici).

### 5.4 Icônes — `src/components/icons.tsx`

- Règle de dessin (commentaire `icons.tsx:1-5`) : « 24x24 stroke 1.5, dessin au trait minimaliste. Jamais d'isométrique, jamais de cliché ».
- `baseProps` (`:8-18`) : `width/height 24`, `viewBox 0 0 24 24`, `fill none`, `stroke currentColor`, `strokeWidth 1.5`, `strokeLinecap/Linejoin round`, `aria-hidden true`. Couleur toujours héritée (`currentColor`) ; les appels donnent la couleur par classe (`text-gold-700`, `text-navy-900`…).
- Exceptions : `CheckIcon` force `strokeWidth 2` (`:188`) ; `WhatsAppIcon` est un glyphe **plein** (`fill="currentColor"`, `:245-258`) sans `baseProps` ; `MessageSecureIcon` et `InfoIcon` ont des points à `strokeWidth 2` (`:101`, `:240`) ; `ValidateIcon` et `AuditIcon` utilisent `opacity 0.4/0.6` (`:79`, `:172`).
- Inventaire : 8 icônes features `FEATURE_ICONS` (`form-guide`, `scan-ocr`, `timeline`, `ai-brief`, `validate`, `status-track`, `message-secure`, `vault`, `:269-278`) ; 6 icônes sécurité `SECURITY_ICONS` (`hosting-france`, `encryption`, `rgpd`, `compliance-rin`, `backup`, `audit`, `:282-289`) ; utilitaires `ArrowRightIcon`, `CheckIcon`, `LockIcon`, `FilePagesIcon`, `UsersIcon`, `HeadsetIcon`, `InfoIcon`, `WhatsAppIcon`, `CrossIcon` (`:177-267`).
- Remarque factuelle : malgré la règle « jamais shield/lock pour la sécurité », `RgpdIcon` (`:140-147`) dessine un bouclier avec coche, `EncryptionIcon` (`:130-138`) et `LockIcon` (`:194-202`) des cadenas.
- Usage : `ArrowRightIcon` est l'icône la plus importée (14 fichiers, grep) ; tailles réduites par props `width={14} height={14} strokeWidth={2}` (`Hero.tsx:93-98`).

---

## 6. Grille, espacements, containers

| Pattern | Classes | Occurrences / exemples |
|---|---|---|
| **Container standard** | `mx-auto max-w-7xl px-5 sm:px-8 lg:px-12` (max 80 rem = 1280 px ; gouttières 20 / 32 / 48 px) | 26 occurrences de `mx-auto max-w-7xl px-5` ; `Nav.tsx:48`, `Footer.tsx:28`, toutes les sections Home |
| **Padding vertical de section** | `py-14 sm:py-20 lg:py-24` (56 / 80 / 96 px) | `AvantApres.tsx:23`, `FeaturesGrid.tsx:11`, `WorkspacesTabs.tsx:17`, `Workflow.tsx:22`, `DossierLifecycle.tsx:55`, `SecurityBlock.tsx:49`, `PricingPreview.tsx:15`, `BlogPreview.tsx:13`, `FaqBlock.tsx:8`, `pages/Pricing.tsx:230`, `Contact.tsx:53`, `Security.tsx:225` |
| Hero | `pb-14 pt-12 sm:pb-20 sm:pt-16 lg:pb-32 lg:pt-24` | `Hero.tsx:36` |
| Hero de pages internes | `pb-12 pt-12 sm:pt-16 lg:pt-24` puis `pb-14 sm:pb-20 lg:pb-24` | `FeaturesIndex.tsx:34,54`, `BlogIndex.tsx:43,62`, `Security.tsx:92` |
| Footer | `py-14` | `Footer.tsx:28` |
| FinalCTA | `max-w-5xl … py-14 sm:py-20 lg:py-24 text-center … sm:py-28` (deux `sm:py-*` dans la même chaîne, `:25`) | `FinalCTA.tsx:25` |
| **Bloc d'intro de section** | `div.max-w-3xl` (48 rem) contenant eyebrow + H2 + paragraphe | `FeaturesGrid.tsx:12`, `Workflow.tsx:23`, `WorkspacesTabs.tsx:18`, `PricingPreview.tsx:16` |
| Largeurs de lecture | `max-w-3xl` (article blog `BlogPost.tsx:109,158`), `max-w-4xl` (FAQ `FaqBlock.tsx:8`), `max-w-5xl` (image blog `BlogPost.tsx:136`, FinalCTA), `max-w-2xl` (sous-titre hero `Hero.tsx:74`) ; comptage global : `max-w-7xl` 32, `max-w-3xl` 14, `max-w-md` 11, `max-w-2xl` 8, `max-w-5xl` 7, `max-w-4xl` 7 | grep |
| **Grilles** | Hero `lg:grid-cols-[1.15fr_0.85fr] lg:gap-16` (`Hero.tsx:36`) ; Avant/Après `lg:grid-cols-[1fr_auto_1fr] gap-4 lg:gap-8` (`AvantApres.tsx:24`) ; Features `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` (`FeaturesGrid.tsx:25`) ; Workspaces `lg:grid-cols-[1.05fr_0.95fr] gap-10` (`WorkspacesTabs.tsx:48`) ; Workflow desktop `grid-cols-6 gap-4` (`Workflow.tsx:51`) / mobile liste verticale (`:60`) ; Pricing preview `md:grid-cols-3 gap-5 sm:gap-6` (`PricingPreview.tsx:29`) ; Sécurité en-tête `lg:grid-cols-[1fr_auto]` (`SecurityBlock.tsx:50`) ; Footer `lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-12` (`Footer.tsx:29`) ; Blog related `md:grid-cols-2` (`BlogPost.tsx:206`) ; totaux grep : `grid-cols-2` 16, `grid-cols-3` 9, `grid-cols-4` 3 | — |
| **Breakpoints réellement utilisés** | `sm` (640 px) pour typographie/paddings, `md` (768 px) pour grilles 2-3 col, `lg` (1024 px) pour nav desktop (`Nav.tsx:51,69,105`), grilles asymétriques et Workflow horizontal (`Workflow.tsx:38,60`) ; `xl`/`2xl` : présents dans le CSS compilé mais usage non relevé | — |
| Padding des cards | `p-6` (features, `Card.tsx:26`), `p-6 sm:p-7` (pricing `PricingPreview.tsx:66`, mockup `WorkspacesTabs.tsx:67`), `p-7` (hero card `Hero.tsx:129`), `p-7 sm:p-9` (Avant/Après `AvantApres.tsx:26,68`), `p-7 sm:p-8` (« À retenir » `BlogPost.tsx:166`) | — |
| Typographie H1/H2 de section | H1 hero `text-[clamp(2.1rem,7vw,5.4rem)] leading-[0.98] tracking-tight sm:leading-[0.96]` (`Hero.tsx:47`) ; H2 section `font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl` (11 occurrences navy/cream) ; H2 FinalCTA `text-4xl sm:text-6xl leading-[1.05]` (`FinalCTA.tsx:29`) ; H1 blog `text-4xl sm:text-5xl leading-[1.08]` (`BlogPost.tsx:113`) | — |
| Eyebrow | `font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700` (28 occ.) et variante `text-[0.7rem] tracking-[0.18em]` (30 occ.) ; sur fond navy : `text-gold-500` (`WorkspacesTabs.tsx:19`, `FinalCTA.tsx:26`) | grep |
| Séparateurs | `border-y hairline` + `divide-y hairline` pour les listes `dl`/accordéon (`Hero.tsx:163`, `Accordion.tsx:14`) ; `border-t hairline pt-*` (`Footer.tsx:44`, `BlogPost.tsx:120`) | — |

---

## 7. Les « 10 détails signature » de `PLAN.md:11-22` — état réel

| # | Détail (PLAN.md) | Ligne PLAN | Implémentation réelle | Statut |
|---|---|---|---|---|
| 1 | Marker sky animé (`clip-path` trace) sur 3 mots du H1 | `PLAN.md:13` | `MarkerHighlight.tsx:9-34` + `index.css:151-169` ; appliqué à « clair, », « structuré », « suivi. » (`Hero.tsx:55-62`, délais 0.6/0.85/1.1 s). Technique : `transform: scaleX` (pas `clip-path`). | **Implémenté** (technique différente) |
| 2 | Cormorant Garamond pour H1/H2/citations | `PLAN.md:14` | Chargée `index.css:3-7`, token `:41`, classe `.font-display` `:88-91` ; 88 occurrences de `font-display` dans `src/**/*.tsx` ; H1 `Hero.tsx:47`, H2 sections, citations `BlogPost.tsx:255`, prix `PricingPreview.tsx:89-95`, logo `Logo.tsx:11,18` | **Implémenté** |
| 3 | JetBrains Mono pour références dossier `#CD-2026-0421`, statuts, micro-meta | `PLAN.md:15` | Chargée `index.css:12-13`, token `:43` ; 115 occurrences de `font-mono` ; référence `#CD-2026-0421` dans `Hero.tsx:151` ; eyebrows, labels Workflow (`Workflow.tsx:98`), copyright (`Footer.tsx:45`), titres de colonnes footer (`:72`), fallback de route (`App.tsx:39`), badges tarifs (`PricingPreview.tsx:69`) | **Implémenté** |
| 4 | Pills cream + texte navy + 1 px or 8 % | `PLAN.md:16` | `Pill.tsx:6` (`bg-cream-100 text-navy-900 border hairline-gold`) — **composant non utilisé** ; pills réels `FactPill` `Hero.tsx:268-274` (`bg-cream-50 … border hairline-gold`) et badges `Hero.tsx:138-141,158-160`. Bordure or à **35 %** (`index.css:126`), pas 8 %. | **Implémenté inline** (opacité différente) |
| 5 | Sheen au hover sur CTA primaires or (600 ms) | `PLAN.md:17` | `index.css:129-148` (`transition: transform 0.6s`) ; appliqué à 20 endroits (grep `sheen`) : `Nav.tsx:80,95,179,196`, `Hero.tsx:90`, `FinalCTA.tsx:40`, `pages/Pricing.tsx:422`, `Contact.tsx:182`, `Signup.tsx:145`, `Login.tsx:74`, `Account.tsx:136`, `DossierFlow.tsx` ×5, `DossierDetail.tsx:458`, `FeaturesIndex.tsx:106`, `NotFound.tsx:19`, `Button.tsx:9` | **Implémenté** |
| 6 | Hero card « Dossier prud'homal — synthèse », timeline 6 dots dont 1 pulse or | `PLAN.md:18` | `Hero.tsx:128-256` : titre exact `Dossier prud'homal — synthèse` (`:156`), 6 étapes (`:14-21`), rendu des dots (`:190-231`), pulse or Motion `scale [1,1.4,1]` 1.8 s (`:199-217`), labels mobile/desktop (`:233-254`), flottement 8 s (`:130-135`) | **Implémenté** |
| 7 | Avant/Après asymétrique cream → navy, transition diagonale fine ligne or | `PLAN.md:19` | `AvantApres.tsx` : carte « Avant » `bg-cream-100` (`:26`) et carte « Avec » `bg-navy-900` (`:68`) ; grille **symétrique** `lg:grid-cols-[1fr_auto_1fr]` (`:24`) ; connecteur central vertical = 2 traits `w-px bg-gold-500/40` + flèche or (`:54-65`). Pas de diagonale. | **Partiel** (cream/navy oui ; asymétrie et diagonale non) |
| 8 | Workflow 6 statuts en SVG `pathLength` scroll-linked | `PLAN.md:20` | `Workflow.tsx:14-18` `useScroll({ target, offset: ["start 80%", "end 30%"] })` + `useTransform` → `scaleX` d'un `motion.div` `h-px bg-gold-500 origin-left` (`:46-50`) ; 6 statuts de `data/statuses.ts:10-64` ; desktop seulement (`lg:block`, `:38`), mobile = liste verticale statique (`:60-79`). Aucun `pathLength` / SVG dans `src/` (grep). | **Implémenté** (div `scaleX`, pas SVG `pathLength`) |
| 9 | Onglets Client / Avocat / Cabinet avec mockups JSX/SVG custom, chacun un layout différent | `PLAN.md:21` | `WorkspacesTabs.tsx:32-39` + `Tabs.tsx` ; libellés réels « Vous », « Validation » + 3e (`data/workspaces.ts:23,48` ; 3e non lu) ; mockup = **un seul layout** `WorkspacePanel` (`:46-95`) : `dl` de lignes label/valeur alimentées par `workspace.mockup.rows`. Pas de SVG, pas de layout différent par onglet. | **Partiel** |
| 10 | Drop cap Cormorant sur articles blog + citations pleine largeur italique Cormorant | `PLAN.md:22` | Drop cap `index.css:337-355` + classe `drop-cap` sur le corps `BlogPost.tsx:159` ; citations `figure.my-10 border-l-2 border-gold-500 pl-6` + `blockquote.font-display text-2xl italic … text-navy-700 sm:text-[1.65rem]` (`BlogPost.tsx:252-264`) — bordure gauche or, largeur de la colonne `max-w-3xl` (pas « pleine largeur ») ; chapeau italique Cormorant (`:116`), H3 italiques (`:248`), callouts italiques (`:290`) | **Implémenté** (citations dans la colonne, pas pleine largeur) |

Éléments du plan absents du code : `Counter.tsx` (`PLAN.md:65`), `Partners.tsx`/marquee (`PLAN.md:98`, supprimé en `7fafc9b`), `Testimonials.tsx` (`PLAN.md:105`, supprimé en `7fafc9b`), `Features.tsx`/`Workspaces.tsx`/`Security.tsx`/`FAQ.tsx` existent sous d'autres noms (`FeaturesGrid`, `WorkspacesTabs`, `SecurityBlock`, `FaqBlock`). La Home réelle compte 11 sections (`pages/Home.tsx:51-61`) dont `DossierLifecycle` non prévue au plan.

---

## 8. ADN visuel — ce qui rend ClairDossier reconnaissable sans le logo

Analyse fondée uniquement sur le code lu ; chaque point renvoie à sa source.

1. **Trio chromatique crème / navy / or, jamais de blanc pur en fond de page.** Fond `#fbf9f4` (`index.css:66`), texte `#0a1228`/`#0d1b3d`, accent unique `#c4a456`. Les sections alternent crème (`bg-cream-50`), crème chaud (`bg-cream-100/40` + `border-y hairline`, `SecurityBlock.tsx:48`) et navy plein (`WorkspacesTabs.tsx:8`, `FinalCTA.tsx:7`). Les seules couleurs tierces sont fonctionnelles (erreur rouge, badge « gratuit » émeraude, §1.1). La contrainte « Or = 5-8 % de la surface » (`PLAN.md:142`) se traduit par un or réservé aux CTA, pastilles 4 px, eyebrows et hairlines (`hairline-gold` à 35 %).

2. **Contraste typographique serif / grotesque / mono systématique.** Chaque bloc de section suit le même triplet : eyebrow JetBrains Mono capitales espacées (`tracking-[0.2em]`, `text-gold-700`), H2 Cormorant Garamond 600 `text-4xl sm:text-5xl` avec interlignage serré (`leading-tight`, `letter-spacing -0.015em`), paragraphe Inter `text-slate-500 leading-relaxed` (`FeaturesGrid.tsx:13-22`, `Workflow.tsx:24-34`, `PricingPreview.tsx:17-26`). Les prix eux-mêmes sont en Cormorant (`PricingPreview.tsx:94`). Le H1 est en `clamp(2.1rem,7vw,5.4rem)` avec `leading-[0.98]` (`Hero.tsx:47`), ce qui donne un titre très compact de type éditorial.

3. **Le surligneur bleu ciel (sky-marker) sur trois mots du H1**, qui est aussi la couleur de sélection de texte (`::selection`, `index.css:82-85`) : un geste « feutre » rare en SaaS juridique (`index.css:151-169`, `Hero.tsx:55-62`).

4. **Hairlines navy à 8 % plutôt que des bordures grises.** 97 usages de `.hairline` (`rgba(13,27,61,0.08)`) pour cards, séparateurs `dl`, accordéon, header scrollé. Les cards blanches n'ont qu'une ombre très diffuse (`0 2px 24px` à 6 %) et passent en bordure or au hover (`FeaturesGrid.tsx:33`, `BlogPost.tsx:211`).

5. **Géométrie en capsules.** 89 `rounded-full` : tous les boutons, pills, onglets (`Tabs.tsx:37`), liens de nav (`Nav.tsx:57`), avatars auteur (`BlogPost.tsx:121`). Les cards utilisent `rounded-2xl` (1 rem) ou `rounded-xl` (1,5 rem). Le logo est le seul élément « carré arrondi » (`rounded-md`).

6. **Micro-signaux « dossier » en mono.** Références `#CD-2026-0421` (`Hero.tsx:151`), numérotation `Étape 01…06` (`Workflow.tsx:99`), états `Actif`/`Exemple` avec point or 4-6 px (`Hero.tsx:138-147`), copyright et titres de footer en mono (`Footer.tsx:45,72`), fallback « Chargement… » en mono (`App.tsx:39`). Ce registre typographique fait office de « tampon administratif ».

7. **Mouvement lent et feutré, jamais bondissant.** Easings `ease-out-expo`/`ease-out-soft` partout (§1.5) ; reveals 0,65 s avec décalage 18 px ; stagger 0,07 s ; sheen 0,6 s ; flottement de la carte hero sur 8 s ; pulse or 1,8 s ; balayages de fond 18 s et 28 s (`index.css:184,207`). Les springs sont amortis (`damping 32`, `Tabs.tsx:45`, `Nav.tsx:146`). Tout dégrade en statique sous `prefers-reduced-motion` (§3.7).

8. **La carte hero comme « pièce à conviction ».** Une fiche blanche flottante avec en-tête mono, titre Cormorant « Dossier prud'homal — synthèse », liste `dl` à hairlines et timeline 6 points dont un pulse or (`Hero.tsx:128-256`), doublée d'un halo flou or/navy (`:258-261`). Ce motif `dl` label/valeur à hairlines est réutilisé dans les mockups d'espaces (`WorkspacesTabs.tsx:74-87`).

9. **Sections navy « à bord or ».** `FinalCTA` est encadrée par deux hairlines or en dégradé horizontal (`FinalCTA.tsx:8-15`) et une grille or animée (`premium-tech-section`) ; la carte « Avec ClairDossier » est navy avec coches or (`AvantApres.tsx:68-92`). Le passage crème → navy est le rythme visuel de la Home.

10. **Détails éditoriaux de presse.** Drop cap Cormorant 4,2 em (`index.css:337-345`), citations italiques Cormorant à filet or (`BlogPost.tsx:254-263`), chapeau italique (`:116`), H3 italiques (`:248`), guillemets français « » (`:256`), liste à puces or (`:173`), en-tête « À retenir » en mono or.

11. **Absence délibérée d'imagerie.** Aucune image raster dans `public/` (listing : SVG, MD, XML, TXT uniquement) ni dans `src/` ; l'image « hero » des articles est un dégradé navy + halos or (`BlogPost.tsx:137-152`) ; les icônes sont des traits 1,5 px `currentColor` (`icons.tsx:8-18`). L'identité repose sur la typographie, la couleur et les hairlines.

---

## Annexe — Points d'attention factuels relevés pendant l'inventaire

| # | Constat | Source |
|---|---|---|
| A1 | `Button.tsx`, `Pill.tsx`, `Card.tsx`, `Marquee.tsx`, `Magnetic.tsx` ne sont importés nulle part ; les patterns sont dupliqués inline dans ~20 fichiers (`sheen`, pills, cards). | grep §2, §3 |
| A2 | `rounded-xl` (1,5 rem custom) > `rounded-2xl` (1 rem défaut Tailwind) : hiérarchie de radii inversée, vérifiée dans `dist/assets/index-B6lhu7zR.css`. | §1.3 |
| A3 | `.sheen` est déclaré deux fois dans `index.css` (`:129` et `:272`) ; la seconde impose une `transition` qui court-circuite les `transition-*`/`duration-*` Tailwind des boutons (cascade non vérifiée au rendu). | §1.8 |
| A4 | `Reveal` accepte une prop `amount` jamais lue (`Reveal.tsx:30`). | §3.1 |
| A5 | `Tabs` a un `aria-label="Espaces dédiés"` codé en dur (`Tabs.tsx:24`) et pas de navigation clavier par flèches. | §2.4 |
| A6 | `Tabs`, `Accordion` et le menu mobile n'appellent pas `useReducedMotion` (animations Motion JS non couvertes par le CSS reduced-motion). | §3.7 |
| A7 | Tokens définis mais sans usage trouvé : `navy-600`, `gold-300`, `sky-marker-deep`. | §1.1 |
| A8 | `og-default.svg` : H1 et mention « OVH France » divergent du site ; carré logo en `#0a1228` au lieu de `#0d1b3d`. | §5.3 |
| A9 | Coordonnées (e-mail, WhatsApp, adresse) absentes du Footer ; présentes dans `Contact.tsx`, `legal.ts`, `whatsapp.ts`, `index.html` (noscript). | §4.2 |
| A10 | `FinalCTA.tsx:25` contient `sm:py-20` et `sm:py-28` dans la même classe. | §6 |
| A11 | Le menu mobile est positionné à `top-[64px]` en dur (`Nav.tsx:131`). | §4.1 |
| A12 | `index.css:171-172` annonce une « Premium visual layer … Presentation-only » ; ces classes `premium-*` ne sont pas dans `PLAN.md` (ajoutées au commit `24e1e2b` « Ameliore les animations visuelles premium » d'après `git log`). | §1.8 |

**Non lus dans cet audit** (à ne pas considérer comme inventoriés) : `src/lib/auth.tsx`, `src/lib/seo.tsx`, `src/lib/supabase.ts`, `src/components/RequireAuth.tsx`, `src/pages/*` hors `Home`, `BlogPost` (les autres pages n'ont été parcourues que par `grep`), `src/components/sections/BlogPreview.tsx`, `DossierLifecycle.tsx` au-delà de la l.70, `SecurityBlock.tsx` au-delà de la l.60, `src/data/*` hors `statuses.ts` et `workspaces.ts` (l.1-60), `public/*.md`, `scripts/`, `supabase/`, `netlify.toml`, `.github/`.
