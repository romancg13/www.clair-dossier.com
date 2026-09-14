import { useEffect, useState, type RefObject } from 'react';
import { useReducedMotion, useScroll, type MotionValue } from 'motion/react';

type ScrollOffset = NonNullable<Parameters<typeof useScroll>[0]>['offset'];

/**
 * Media query SSR-safe : `false` au pré-rendu et au premier rendu client
 * (aucun écart d'hydratation), puis la valeur réelle après montage.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, [query]);
  return matches;
}

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
 * Progression 0 → 1 d'une section à son passage dans le viewport.
 * `reduce` permet aux composants de ne poser AUCUN style animé (état final
 * statique) quand l'utilisateur demande moins de mouvement.
 */
export function useSectionProgress(
  ref: RefObject<HTMLElement | null>,
  offset: ScrollOffset = ['start 85%', 'start 30%'],
): { p: MotionValue<number>; reduce: boolean } {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset, layoutEffect: false });
  return { p: scrollYProgress, reduce: Boolean(reduce) };
}
