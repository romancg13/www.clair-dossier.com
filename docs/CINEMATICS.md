# Cinématiques 3D — guide de maintenance (Phase 4b, 2026-09-14)

Couche WebGL progressive au-dessus de la home cinématique (Phase 4). Stack : Three 0.186 · React Three Fiber 9 · drei 10 (types seulement pour l'instant) — aucune autre dépendance, pas de GSAP ni Lenis : Motion reste l'unique moteur de scroll (les scènes lisent ses MotionValues dans `useFrame`).

## Où modifier quoi
| Besoin | Fichier |
|---|---|
| Activer / désactiver une scène | `src/components/landing/cinematics/scenes.ts` (`enabled`) — ou tout couper : `VITE_CINEMATICS=false` au build |
| Scène hero (feuilles, lignes, halo, dolly-in 2,6 s) | `cinematics/scenes/HeroScene.tsx` — poses `REST_DESKTOP` / `REST_MOBILE`, `INTRO_SECONDS`, `pose()` |
| Scène chaos → dossier (arrière-plan de la scène épinglée 01) | `cinematics/scenes/StoryConvergenceScene.tsx` — `STACK`, fenêtre `segment(p, 0.24, 0.66)` |
| Scène finale (convergence puis calme) | `cinematics/scenes/FinalConvergenceScene.tsx` — `REST`, `pose()` |
| Timings scroll | chaque scène lit `progress` (MotionValue fourni par l'hôte : `useScroll` du composant landing) ; les fenêtres sont des `segment(p, a, b)` |
| Chemins caméra | `pose(progress, out)` de chaque scène, appliqué par `cinematics/camera/CameraRig.tsx` (amortissement `lambda`, parallaxe pointeur `pointerDegrees`) |
| Tiers de qualité et DPR | `cinematics/quality/DeviceTier.ts` (`classify`, `dprFor`), budgets par tier dans `QualityManager.ts` (`budgetFor`), dégradation dynamique dans `quality/FpsGovernor.tsx` |
| Chargement différé, plafond de 2 contextes, repli | `cinematics/CinematicGate.tsx` (`MAX_LIVE`, `nearMargin` / `farMargin`) |
| Enveloppe Canvas (DPR, `flat`, pause hors écran, perte de contexte) | `cinematics/CinematicCanvas.tsx` |
| Primitives (feuilles instanciées GPU, lignes tracées, halo, poussière) | `cinematics/primitives/*.tsx`, couleurs dans `primitives/palette.ts` (= tokens CSS) |
| Points d'ancrage HTML | `landing/HeroCinematic.tsx`, `landing/StoryScene.tsx` (scène épinglée), `landing/FinalCinematic.tsx` — une ligne `<CinematicGate …>` chacun |

## Règles
- Aucun asset : géométrie procédurale, shaders inline, aucune texture, aucun GLB, aucun CDN. (Si un GLB devient nécessaire : GLB + gltfpack/meshopt, KTX2 pour les textures, à documenter ici.)
- Pré-rendu : la porte rend un conteneur vide côté serveur et au premier rendu client ; le moteur n'est importé qu'après `load` + idle (hero) ou à l'approche (autres). LCP = H1 HTML, inchangé.
- `prefers-reduced-motion`, Save-Data, absence de WebGL2, rendu logiciel, < 2 Go → tier `fallback` = aucune 3D, page Phase 4 intacte. Mobile = tier ≤ medium, compositions allégées (hero uniquement ; les scènes 02 et 06 sont desktop).
- Zéro allocation par frame : les interpolations sont dans les shaders (`uProgress`), la caméra réutilise ses objets.
- Poster : les dégradés CSS existants (le hero HTML) servent de poster ; aucun bitmap dans le chemin critique.
