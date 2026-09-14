/**
 * Feature flags (MASTER_PROMPT II.7.4 étape 6, IX.5) — lecture unique, ici.
 *
 * Chaque flag est injecté comme LITTÉRAL à la compilation (`define` dans
 * vite.config.ts, valeur lue par src/lib/flag-parse.ts) : Rollup peut alors
 * éliminer la branche inactive (la composition historique n'est pas
 * embarquée quand la cinématique est active, et inversement).
 *
 * Hors Vite (tests node:test), le littéral n'existe pas : valeur par défaut.
 */
import { readFlag } from './flag-parse';

declare const __HOME_CINEMATIC__: boolean | undefined;
declare const __CINEMATICS__: boolean | undefined;

/**
 * Home cinématique (Phase 4 — Homepage elevation, 2026-09-14).
 *
 * ON par défaut sur la branche de travail `feature/clairdossier-next` (jamais
 * poussée : la branche est la porte). Repli instantané vers la composition
 * historique de src/pages/Home.tsx : variable d'environnement
 * `VITE_HOME_CINEMATIC=false` au moment du build.
 */
export const HOME_CINEMATIC: boolean =
  typeof __HOME_CINEMATIC__ === 'boolean' ? __HOME_CINEMATIC__ : readFlag(undefined, true);

/**
 * Couche 3D cinématique WebGL (Phase 4b, 2026-09-14) — progressive enhancement
 * au-dessus de la home cinématique. ON par défaut sur la branche ; les tiers
 * de qualité (src/components/landing/cinematics/quality) désactivent d'eux-mêmes
 * la 3D sur appareil faible, en motion réduite ou sans WebGL2.
 * Repli global : `VITE_CINEMATICS=false` au build.
 */
export const CINEMATICS: boolean =
  typeof __CINEMATICS__ === 'boolean' ? __CINEMATICS__ : readFlag(undefined, true);
