# ClairDossier — Showcase v2

Site showcase B2B/B2C ClairDossier construit en **Vite 6 + Tailwind v4 + Motion**. Cette branche est une refonte visuelle complète et indépendante de l'application principale (`main`).

## Stack

- React 19 · TypeScript 5 strict
- Vite 6 · `@vitejs/plugin-react`
- Tailwind v4 via `@tailwindcss/vite` (tokens dans `@theme`)
- Motion (`motion/react`) pour les animations
- React Router 7
- Fonts self-hosted : Cormorant Garamond, Inter, JetBrains Mono (via `@fontsource`)

## Démarrer

```bash
npm install
npm run dev
```

L'application tourne sur http://localhost:5173/

## Build production

```bash
npm run build      # compile + bundle (tsc + vite build)
npm run preview    # sert le build sur :4173
npm run typecheck  # tsc --noEmit
```

## Routes

| Route | Description |
|---|---|
| `/` | Home — 11 sections (Hero, Partners, Avant/Après, Features, Workspaces tabs, Workflow, Sécurité, Pricing, Témoignages, Blog preview, FAQ, Final CTA) |
| `/fonctionnalites` | Index des 9 fonctionnalités |
| `/fonctionnalites/:slug` | 9 pages détail (200-400 mots chacune) |
| `/tarifs` | 7 formules + toggle annuel/mensuel (−10 %) + matrice comparative |
| `/securite` | Schéma archi + 6 piliers détaillés + badges + documents |
| `/blog` | Index + 7 articles complets (800-1200 mots) |
| `/blog/:slug` | Article avec drop cap, citations, "À retenir", FAQ inline |
| `/contact` | Formulaire 4 topics avec état submitted simulé |
| `/dossier/nouveau` | Flow 3 étapes avec persistance localStorage |

## Architecture

```
src/
├── components/
│   ├── primitives/   Reveal, SplitWords, MarkerHighlight, Marquee, Magnetic
│   ├── sections/     12 sections de la Home
│   ├── ui/           Button, Pill, Card, Tabs, Accordion
│   ├── Nav.tsx · Footer.tsx · Layout.tsx · Logo.tsx · icons.tsx
├── data/             Contenus typés (features, pricing, statuses, testimonials, faq, workspaces, partners, authors, blog/*)
├── lib/              seo.tsx (composant Seo + builders JSON-LD)
├── pages/            Une page par route
├── App.tsx           Router
├── main.tsx          Entry
└── index.css         Tokens Tailwind v4 + base + utilities CSS
```

Voir `PLAN.md` pour le détail d'implémentation et les 10 détails signature.

## Bundles (build prod)

| Chunk | Taille | Gzip |
|---|---|---|
| `index.js` | 163 KB | 44 KB |
| `react.js` | 194 KB | 60 KB |
| `motion.js` | 121 KB | 40 KB |
| `router.js` | 36 KB | 13 KB |
| `index.css` | 88 KB | 25 KB |

Fonts chargées en woff/woff2 par sous-set (latin + latin-ext), ~30-50 KB chacune.

## Couche agentique

Les règles de travail ClairDossier (auto-contrôle, identité de marque, vérité
produit, normes PDF, sourcing B2B conforme, contenu) sont packagées en skills
Claude Code auto-déclenchés dans `.claude/skills/`, avec trois commandes dans
`.claude/commands/` : `/prospect`, `/verif`, `/pilotage`.

Elles s'appliquent automatiquement dans toute session ouverte sur ce dépôt.
Pour les utiliser ailleurs, le dépôt s'installe comme plugin :

```bash
/plugin marketplace add romancg13/www.clair-dossier.com
/plugin install clairdossier@clairdossier
```

Documentation : `docs/agentic/README.md`. Arbitrages ouverts :
`docs/agentic/decisions.md`.
