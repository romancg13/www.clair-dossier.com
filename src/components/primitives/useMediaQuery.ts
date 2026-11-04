import { useEffect, useState } from 'react';

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
 * prefers-reduced-motion, SSR-safe. Le hook de motion lit la media query dès
 * l'hydratation : le rendu client diffère alors du HTML pré-rendu (états
 * initiaux en opacity:0), React conserve l'attribut du serveur et le contenu
 * reste invisible pour qui demande moins de mouvement.
 */
export function useReducedMotionSafe(): boolean {
  return useMediaQuery('(prefers-reduced-motion: reduce)');
}
