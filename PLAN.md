# ClairDossier Showcase — Implementation Plan

**Goal:** Site showcase B2B/B2C ClairDossier (legaltech française) en local Vite + Tailwind v4 + Motion, qui ne ressemble à RIEN d'autre dans le marché legaltech français.

**Architecture:** SPA React 19 / React Router 7. CSS via Tailwind v4 (`@tailwindcss/vite` + `@theme` tokens). Animations via Motion (whileInView, useScroll, AnimatePresence). Fonts self-hosted via `@fontsource/*` pour zéro dépendance Google + CSP propre. Pas de backend — c'est un showcase. localStorage pour le brouillon dossier.

**Tech Stack:** Vite 6 · React 19 · TypeScript 5 strict · Tailwind v4 · Motion (motion/react) · React Router 7 · `@fontsource` (Cormorant Garamond, Inter, JetBrains Mono).

---

## 10 détails signature (anti-Webflow-legaltech-template)

1. **Marker sky animé** (`clip-path` trace) sur 3 mots du H1 — pas un bold ni un underline générique.
2. **Cormorant Garamond serif** pour H1/H2/citations — casse le default Inter omniprésent en B2B SaaS.
3. **JetBrains Mono** pour références dossier (`#CD-2026-0421`), statuts, micro-meta — signale rigueur tech/juridique.
4. **Pills cream + texte navy + 1px or 8 % opacity** — pas le pill SaaS blanc-gris.
5. **Sheen au hover** sur les CTA primaires or (gradient sweep 600ms).
6. **Hero card "Dossier prud'homal — synthèse"** avec timeline horizontale 6 dots dont 1 pulse or — pas un dashboard mockup générique.
7. **Avant/Après asymétrique** cream → navy, transition diagonale fine ligne or — pas le 50/50 standard.
8. **Workflow 6 statuts en SVG `pathLength` scroll-linked** — la ligne or se trace pendant que la section devient visible.
9. **Onglets espaces (Client / Avocat / Cabinet)** avec mockups en JSX/SVG custom (jamais de screenshot photo) — chacun montre un layout différent.
10. **Drop cap Cormorant** sur articles blog + citations pleine largeur en italique Cormorant — détail éditorial qui signale "pas un blog SaaS".

---

## Phase 1 — Setup (Task 13)

- [x] Créer `/Users/fouzi/clair-dossier-showcase/`
- [x] `package.json` avec deps fixées (React 19, Tailwind v4, Motion 11, RR 7, fontsource)
- [x] `tsconfig.json` strict
- [x] `vite.config.ts` avec `manualChunks` (react, motion, router, fonts)
- [x] `index.html` lang=fr, theme-color navy
- [ ] `npm install` (in progress)

## Phase 2 — Tokens + Plan (Task 14)

**Files:**
- `src/index.css` — `@import "tailwindcss"` + `@theme { ... }` (colors, fonts, shadows, radii)
- `src/main.tsx` — entry + import fonts
- `src/App.tsx` — Router + Layout
- `public/favicon.svg` — logo CD navy/or

**Tokens (palette du brief, à reprendre 1:1) :**
```
--color-navy-900: #0d1b3d   (text fort, sections sombres)
--color-navy-800: #152348   (cards, hover navy)
--color-navy-700: #1e2c52   (séparateurs)
--color-gold-500: #c4a456   (CTA, accents)
--color-gold-400: #e6c97d   (hover or, soft highlights)
--color-cream-50: #fbf9f4   (bg principal)
--color-cream-100: #f5f0e6  (cards alternées)
--color-ink: #0a1228        (texte ultra-fort, h1)
--color-slate-500: #5a6378  (texte secondaire)
--color-sky-marker: rgba(179,210,239,0.6)  (surligneur)
```

## Phase 3 — Primitives + UI atoms (Task 15)

**Files in `src/components/primitives/`:**
- `Reveal.tsx` — `whileInView` y:18, opacity, once, amount: 0.2, duration 0.65
- `SplitWords.tsx` — word-by-word reveal pour H1 Cormorant (1s, easing `[0.16, 1, 0.3, 1]`)
- `MarkerHighlight.tsx` — `clip-path: inset(0 100% 0 0) → inset(0 0 0 0)` sur sky bg, stagger 200ms
- `Marquee.tsx` — translate boucle 60s, opacity 35 % → 100 % au hover
- `Magnetic.tsx` — léger pull au hover pour CTAs majeurs
- `Counter.tsx` — animation chiffres avec `useTransform`

**Files in `src/components/ui/`:**
- `Button.tsx` — `variant: 'primary' | 'secondary' | 'ghost'`, sheen via `::before` sur primary
- `Pill.tsx` — cream bg, navy text, or thin border
- `Card.tsx` — white bg, hairline border, subtle shadow
- `Tabs.tsx` — `AnimatePresence` mode wait, crossfade 350ms
- `Accordion.tsx` — height auto, `+` rotate 45° → `×`

**Layout:**
- `src/components/Nav.tsx` — sticky, blur on scroll
- `src/components/Footer.tsx` — 3 cols + mention RCS placeholder
- `src/components/Logo.tsx` — carré navy 40px, "CD" or, rounded-md

## Phase 4 — Data files (Task 16)

**Files in `src/data/`:**
- `features.ts` — 8 fonctionnalités (id, slug, title, icon SVG, blurb, body 200-400 mots)
- `pricing.ts` — 3 plans + 3 add-ons + matrice comparative
- `statuses.ts` — 6 statuts dossier ordonnés
- `testimonials.ts` — 3 témoignages réalistes (avocat, particulier, RH PME)
- `faq.ts` — 8 Q+R home (60-100 mots chacune)
- `workspaces.ts` — 3 espaces (client/avocat/cabinet) + mockup layout descriptor
- `partners.ts` — 8-10 noms cabinets fictifs réalistes
- `authors.ts` — 1-2 bios auteurs blog
- `blog/chronologie-prud-homale.ts`
- `blog/rgpd-legaltech.ts`
- `blog/ia-droit.ts`

## Phase 5 — Home sections (Task 17)

**Files in `src/components/sections/`:**
1. `Hero.tsx` — eyebrow mono / H1 Cormorant + marker / sub / 2 CTAs / 3 pills / preview card lévitante
2. `Partners.tsx` — marquee 60s
3. `AvantApres.tsx` — 2 cols asymétriques cream/navy
4. `Features.tsx` — grille 4×2 (8 cards SVG icons custom)
5. `Workspaces.tsx` — tabs Client/Avocat/Cabinet + mockups
6. `Workflow.tsx` — timeline 6 statuts `pathLength` scroll-linked
7. `Security.tsx` — 6 blocs trust (SVG icons, pas emoji)
8. `PricingPreview.tsx` — 3 plans, centrale "Le plus choisi"
9. `Testimonials.tsx` — 3 cards éditoriales Cormorant italic
10. `BlogPreview.tsx` — 3 derniers articles horizontaux
11. `FAQ.tsx` — accordion 8 Q+R
12. `FinalCTA.tsx` — bande navy, hairlines or, H2 Cormorant

## Phase 6-9 — Routes internes (Tasks 18-21)

- `/tarifs` — hero, toggle annuel/mensuel, 3 plans, comparative matrix, add-ons, FAQ tarifs, CTA
- `/securite` — 6 blocs détaillés, schéma archi SVG, badges conformité, downloads grisés
- `/contact` — formulaire (sans backend, simule submit + localStorage)
- `/fonctionnalites` — index 8 features (cards)
- `/fonctionnalites/:slug` — détail (hero, body 200-400 mots, related)
- `/blog` — index + filtres catégorie
- `/blog/:slug` — article complet (drop cap, hero image placeholder, citations, bloc "À retenir")
- `/dossier/nouveau` — flow 3 étapes (typologie / form intelligent / récap), localStorage `clairdossier_draft`

## Phase 10 — SEO (Task 22)

- `src/lib/seo.tsx` — composant `<Seo>` (Helmet-like via DOM mutation) qui set title/meta/JSON-LD
- `public/robots.txt`, `public/sitemap.xml`
- JSON-LD par page : Organization, WebSite+SearchAction, SoftwareApplication, Service×N, Product+Offer, BlogPosting, FAQPage, BreadcrumbList

## Phase 11 — Verify (Task 23)

- [ ] `npm run typecheck` → 0 erreur
- [ ] `npm run build` → bundle OK, JS ≤ 200 KB gzip core
- [ ] `npm run dev` → http://localhost:5173 fonctionne
- [ ] Visual check 360 / 768 / 1280 — zéro scroll horizontal, aucun layout cassé
- [ ] Accessibility quick check : h1 unique par page, focus visible, contraste WCAG AA

---

## Contraintes (rappel brief)

- **Pas d'emoji** dans le copy live, jamais
- **Pas de phrase générique** ("Boostez votre productivité", "Solution tout-en-un")
- **Pas de stat fabriquée** — si pas la vraie donnée, on ne met pas de chiffre
- **Or = 5-8 %** de la surface visible, jamais plus
- **H1 exact** : `Votre dossier juridique, clair, structuré et suivi.` (immuable)
- **Réduced motion** : tout dégrade gracieusement
