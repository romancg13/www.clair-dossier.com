/**
 * Registre des scènes 3D (Phase 4b) — UNE seule table pour :
 *   - activer / désactiver une scène (`enabled: false` → la composition
 *     HTML/CSS existante reste seule, sans aucun import) ;
 *   - retrouver le fichier de chaque scène ;
 *   - piloter le chargement différé (import dynamique → chunk `three` + scène).
 *
 * Chaque scène exporte par défaut un composant `(props: SceneProps) => JSX`.
 * Le hôte HTML (composant de la landing) monte `<CinematicGate load={...}>`.
 */
import type { ComponentType } from 'react';
import type { SceneProps } from './CinematicGate';

export type SceneId = 'hero' | 'story' | 'structure' | 'timeline' | 'deadlines' | 'final';

export type SceneEntry = {
  enabled: boolean;
  load: () => Promise<{ default: ComponentType<SceneProps> }>;
  /** Où vit le composant HTML qui l'accueille. */
  host: string;
};

export const CINEMATIC_SCENES: Record<SceneId, SceneEntry> = {
  hero: { enabled: true, load: () => import('./scenes/HeroScene'), host: 'landing/HeroCinematic.tsx' },
  story: { enabled: true, load: () => import('./scenes/StoryConvergenceScene'), host: 'landing/StoryScene.tsx' },
  structure: { enabled: false, load: () => import('./scenes/DocumentLayersScene'), host: 'landing/ChapterStructure.tsx' },
  timeline: { enabled: false, load: () => import('./scenes/TimelineSpaceScene'), host: 'landing/ChapterTimeline.tsx' },
  deadlines: { enabled: false, load: () => import('./scenes/DeadlineArcScene'), host: 'landing/ChapterDeadlines.tsx' },
  final: { enabled: true, load: () => import('./scenes/FinalConvergenceScene'), host: 'landing/FinalCinematic.tsx' },
};

export function sceneEnabled(id: SceneId): boolean {
  return CINEMATIC_SCENES[id].enabled;
}
