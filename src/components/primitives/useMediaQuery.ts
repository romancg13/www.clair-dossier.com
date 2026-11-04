import { useEffect, useState, useSyncExternalStore } from 'react';

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

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

function subscribeReducedMotion(onChange: () => void): () => void {
  const mql = window.matchMedia(REDUCED_MOTION);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/**
 * prefers-reduced-motion, SSR-safe. Le hook de motion lit la media query dès
 * l'hydratation : le rendu client diffère alors du HTML pré-rendu (états
 * initiaux en opacity:0), React conserve l'attribut du serveur et le contenu
 * reste invisible pour qui demande moins de mouvement. Ici : `false` pendant
 * l'hydratation (instantané serveur), valeur réelle dès le premier rendu
 * d'un composant monté ensuite (navigation interne, sans image vide).
 */
export function useReducedMotionSafe(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false,
  );
}
