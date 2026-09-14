import { useEffect, useRef, type RefObject } from 'react';

export type PointerState = { x: number; y: number; active: number };

/**
 * Pointeur normalisé [-0,5 ; 0,5] relatif au viewport — desktop et souris
 * uniquement (jamais de dépendance au curseur sur mobile). Lu dans useFrame
 * et amorti par le rig caméra : jamais mappé directement sur la caméra.
 */
export function usePointerRef(enabled: boolean): RefObject<PointerState> {
  const ref = useRef<PointerState>({ x: 0, y: 0, active: 0 });
  useEffect(() => {
    if (!enabled) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      const s = ref.current;
      s.x = e.clientX / window.innerWidth - 0.5;
      s.y = e.clientY / window.innerHeight - 0.5;
      s.active = 1;
    };
    const onLeave = () => {
      ref.current.active = 0;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [enabled]);
  return ref;
}
