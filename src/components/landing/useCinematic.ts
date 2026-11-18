import { type RefObject } from 'react';
import { useMotionValue, useReducedMotion, useScroll, type MotionValue } from 'motion/react';
import { useMediaQuery, useReducedMotionSafe } from '../primitives/useMediaQuery';

export { useMediaQuery };

type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>['offset'];

/**
 * Vrai quand les scènes épinglées (sticky + scroll-driven) sont pertinentes :
 * largeur ≥ 1024 px ET motion non réduite. Sinon les chapitres rendent leur
 * composition statique (mobile, tablette, prefers-reduced-motion).
 */
export function useCinematic(): boolean {
  const reduce = useReducedMotion();
  const desktop = useMediaQuery('(min-width: 1024px)');
  return desktop && !reduce;
}

/**
 * Progression 0 → 1 d'une section à son passage dans le viewport. Moins de
 * mouvement demandé : progression figée à 1 (état final), les styles restent
 * pilotés par motion — un style simplement retiré garderait l'état initial
 * écrit au pré-rendu.
 */
export function useSectionProgress(
  ref: RefObject<HTMLElement | null>,
  offset: ScrollOffset = ['start 85%', 'start 30%'],
): { p: MotionValue<number> } {
  const reduce = useReducedMotionSafe();
  const { scrollYProgress } = useScroll({ target: ref, offset, layoutEffect: false });
  const done = useMotionValue(1);
  return { p: reduce ? done : scrollYProgress };
}
