# Homepage elevation — Phase 4 (MASTER_PROMPT XI.1 · VI.4)

**Date** : 2026-09-14 · **Branche** : `feature/clairdossier-next` · **Flag** : `HOME_CINEMATIC` (`src/lib/flags.ts`, ON par défaut ; `VITE_HOME_CINEMATIC=false` rétablit la composition historique de `src/pages/Home.tsx`, intacte).

## 1. Décision de contenu : rien d'inventé

Le brief demandait un récit « l'IA analyse vos documents ». L'audit du code (`src/data/product-status.ts`, `src/data/segments.ts`, CGV) établit que ClairDossier **ne procède à aucune lecture ni analyse automatique des pièces** — c'est un engagement contractuel. Le récit est donc construit sur ce que le produit fait réellement :

| Chapitre demandé | Réalité produit mise en scène | Source |
|---|---|---|
| Chaos documentaire | Pièces dispersées → réunies dans « Pièces du dossier » | `/fonctionnalites/depot-de-pieces` |
| « L'IA analyse » | **La structure** : les 5 étapes du tunnel ; les champs que l'utilisateur renseigne composent le récapitulatif | `DossierFlow.tsx` (PROFILS, CATEGORIES, FIELD_OVERRIDES) |
| Chronologie | Les 6 statuts réels, en frise | `src/data/statuses.ts` |
| Échéances | Dates renseignées, affichées sur le dossier · rappels automatiques = « à l'étude » avec lien `/etat-du-produit` | `product-status.ts` (operational / planned) |
| Relances | **La transmission** validée par l'utilisateur (e-mail / WhatsApp) | `/fonctionnalites/transmission-validee`, CGV |
| Vue d'ensemble | La page « Avancement du dossier » : onglets réels, 5 étapes métier, bloc « Ce que vous devez faire maintenant » | `DossierDetail.tsx` |

Toutes les données affichées sont fictives et portent le badge « Dossier de démonstration » (`src/components/landing/demo-dossier.ts`, source unique, testée dans `tests/home-landing.test.ts`).

## 2. Mapping SECTION CURRENT → KEEP / ENHANCE / MOVE / MERGE

| # | Section historique (`Home.tsx`) | Action | Nouvelle réalisation |
|---|---|---|---|
| 1 | `Hero` | **ELEVATE** | `landing/HeroCinematic.tsx` — H1 « Des documents dispersés. Un dossier clair. », mise en scène 3D CSS du dossier de démo, entrée CSS séquencée, parallaxe pointeur desktop. Lien « parcours dédié » et faits (compte gratuit, sans engagement, aucune lecture automatique) conservés. CTA principal unifié « Commencer avec ClairDossier » → `/inscription` (compte gratuit réel) ; « Voir comment ça fonctionne » → ancre du récit. « Demander une démo » → `/rendez-vous` (page dédiée Vague 1) dans le CTA de milieu de page et final. |
| 2 | `AvantApres` | **ENHANCE + MOVE** | `landing/BeforeAfter.tsx` — mêmes 5 paires de textes (exportées de `AvantApres.tsx`), registre ligne à ligne, trait or scroll-driven. Placée après le bento. |
| 3 | `FeaturesGrid` | **ELEVATE** | `landing/FeaturesBento.tsx` — 9 briques, mêmes liens `/fonctionnalites/{slug}`, bento 12 colonnes, brique fondatrice (création guidée) en bloc principal. Titre et paragraphe conservés. |
| 4 | `WorkspacesTabs` | **KEEP + MOVE** | Composant réutilisé tel quel, après « Pour qui ». |
| 5 | `Workflow` (6 statuts) | **MERGE** | Contenu intégré au chapitre 03 `landing/ChapterTimeline.tsx` (mêmes 6 statuts de `statuses.ts`, phrase « Six statuts, aucun entre-deux » conservée). |
| 6 | `DossierLifecycle` | **KEEP** | Réutilisé tel quel. |
| 7 | `SecurityBlock` | **ENHANCE** | `landing/TrustChapter.tsx` — mêmes 6 affirmations (exportées de `SecurityBlock.tsx`), présentation sobre, liens `/securite` et `/etat-du-produit`. |
| 8 | `PricingPreview` | **ENHANCE** | `landing/PricingCinematic.tsx` — mêmes 3 formules, mêmes liens Stripe (`pricing.ts` non modifié), sélecteur mensuel / annuel (−10 %) repris de `/tarifs`. |
| 9 | `BlogPreview` | **ENHANCE** | Prop additive `limit={3}` — corrige l'écart n°2 de la matrice (« Trois lectures » affichait 7 cartes). |
| 10 | `FaqBlock` | **KEEP** | Réutilisé tel quel. |
| 11 | `FinalCTA` | **ELEVATE** | `landing/FinalCinematic.tsx` — l'interface se recentre, « Transformez vos dossiers en décisions claires. », CTA unifié. |
| — | *(nouveau)* | **ADD** | `StoryScene` (01), `ChapterStructure` (02), `ChapterDeadlines` (04), `ChapterTransmission` (05), `ChapterOverview` (06), `MidCTA`, `AudienceSwitcher` (« Pour qui », contenus de `segments.ts` + profils du tunnel). |

Ordre final : Hero → 01 Chaos → 02 Structure → 03 Avancement → 04 Échéances → 05 Transmission → 06 Vue d'ensemble → CTA → Fonctionnalités → Avant / avec → Pour qui → Espaces dédiés → Cycle de vie → Confiance → Tarifs → Journal → FAQ → Final.

## 3. Fichiers touchés hors `landing/`

Diffs additifs et localisés uniquement (II.7.2) :

- `src/pages/Home.tsx` — 2 imports + 1 retour anticipé derrière le flag.
- `src/index.css` — 1 `@import "./styles/landing.css"`.
- `src/components/sections/AvantApres.tsx`, `SecurityBlock.tsx` — `export` des constantes de contenu.
- `src/components/sections/BlogPreview.tsx` — prop optionnelle `limit`.
- `src/components/Nav.tsx` — classe `cd-nav-enter` (apparition 300 ms) et hauteur réduite au scroll (`lg:py-2.5`).
- `.env.example` — documentation du flag.

Aucune route, classe CSS, prop, colonne ou lien Stripe existant n'a été renommé ou supprimé.

## 4. Design system 2.0 (extension, pas rebranding)

| Élément | Valeur | Logique |
|---|---|---|
| Palette conservée | navy-900 `#0d1b3d`, gold-500 `#c4a456`, cream-50 `#fbf9f4`, Cormorant Garamond / Inter / JetBrains Mono | ADN ClairDossier (VI.1) |
| Ajouts (`src/styles/landing.css`, `@theme`) | navy-950 `#060d22`, navy-925 `#0a1530`, silver-200 `#d6dbe6`, silver-400 `#9aa3b8`, sky-glow `#b3d2ef` | Une profondeur pour les chapitres cinéma, un argent froid pour le texte sur sombre. Aucun violet, cyan, néon. |
| Conteneur | `max-w-7xl` (1280) · gouttières 20 / 32 / 48 px | Identique au site |
| Sections | 80 / 96 / 128 px (chapitres : 80 / 112 / 144) | Respiration croissante avec la largeur |
| Type | H1 `clamp(2.8rem, 7.4vw, 6.6rem)` · lh 0.94 · ls −0.02em ; H2 chapitre `clamp(2.1rem, 4.4vw, 4rem)` · lh 1.02 ; kicker mono 0.72rem / 0.2em | Hiérarchie très forte, Cormorant à grande taille |
| Radii | 12 (intérieur) · 18 (tuiles) · 24 (scènes, cartes) · full (pills) | Échelle existante (`--radius-*`) |
| Ombres | `--shadow-stage`, `--shadow-float`, `--shadow-paper` | Profondeur sur sombre, papier sur sombre |
| Durées | micro 160 ms · UI 320 ms · reveal 640 ms · récit = scroll natif | Motion system VI.3 |
| Easings | expo-out, soft-out (existants), cinema `cubic-bezier(.19,1,.22,1)` | |
| Breakpoints | sm 640 · md 768 · lg 1024 (scènes épinglées) · xl 1280 · 2xl 1536 | Tailwind |
| Entrée hero | nav 0–300 ms · H1 300–900 ms · sous-titre 900 ms · CTA 1 100 ms · produit 1 300–2 000 ms | Spécification du brief, CSS pur (lisible sans JS, pré-rendu) |

## 5. Motion — principes appliqués

- **Aucune nouvelle dépendance** : Motion (déjà en place) pour les valeurs scroll-driven ; `position: sticky` natif pour les deux seules scènes épinglées (01 et 06). Pas de GSAP, pas de Lenis, pas de WebGL : la 3D est une perspective CSS.
- **Scroll natif toujours** : aucune interception, aucune inertie artificielle.
- **Mobile / tablette (< 1024 px)** : les scènes épinglées deviennent des compositions statiques équivalentes (même contenu) ; les chapitres gardent un reveal léger.
- **`prefers-reduced-motion`** : aucun style animé n'est posé (état final statique), flottements et parallaxe désactivés, sélecteurs sans transition.
- **Pré-rendu** : le hero est lisible sans JavaScript ; les scènes n'accèdent jamais à `window` au rendu (`useMediaQuery` retourne `false` côté serveur et au premier rendu client — aucun écart d'hydratation).

## 6. Vérifications

- `npm run typecheck` ✓ · `npm run build` (gen:md + sitemap + tsc + vite + prerender des 33 routes) ✓ · `npm test` (27 tests) ✓.
- Titre `<title>` de la home unique (contrôle du script de pré-rendu).
- Matrice de non-régression : addendum « Phase 4 » dans `NON_REGRESSION_MATRIX.md` (F-HOME-01…13 → PASS / REPLACED WITH EQUIVALENT / MERGED).
- Vérification navigateur (build de production servi par `vite preview`, HTML pré-rendu hydraté) : console vide, aucun avertissement d'hydratation ; 1440 × 900 (scènes épinglées 01 et 06, chapitres scroll-driven, bento, avant / avec, pour qui, confiance, tarifs, journal, final) ; 375 × 812 (compositions statiques, aucun débordement horizontal) ; ordre de tabulation et anneau de focus ; sélecteur « Pour qui » au clavier (flèches).
- Poids : chunk principal 206 Ko bruts / 60 Ko gzip (152 Ko bruts avant — l'ajout net de la landing est d'environ 15 Ko gzip, la composition historique étant éliminée du bundle quand le flag est ON). Motion et React inchangés, aucune dépendance ajoutée.
- Repli : `VITE_HOME_CINEMATIC=false npm run build` reconstruit exactement la home historique.
