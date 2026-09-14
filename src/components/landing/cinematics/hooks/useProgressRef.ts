import { useEffect, useRef, type RefObject } from 'react';
import { type MotionValue } from 'motion/react';

/**
 * Pont Motion → Three (Phase 4b).
 *
 * Le scroll de la page est piloté par Motion (useScroll / useTransform dans
 * les composants de la landing). Les scènes 3D LISENT ces MotionValues dans
 * useFrame sans jamais provoquer de re-render React : la valeur courante est
 * recopiée dans une ref à chaque changement (abonnement `on('change')`).
 *
 * Un seul moteur de scroll sur la page : aucun ScrollTrigger, aucun second
 * listener de scroll, aucune inertie artificielle.
 */
export function useProgressRef(value: MotionValue<number> | null | undefined, initial = 0): RefObject<number> {
  const ref = useRef<number>(value ? value.get() : initial);
  useEffect(() => {
    if (!value) return;
    ref.current = value.get();
    return value.on('change', (v) => {
      ref.current = v;
    });
  }, [value]);
  return ref;
}

/** Lissage exponentiel indépendant du framerate : t = 1 − e^(−λ·dt). */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Interpolation bornée d'un progrès [a, b] → [0, 1]. */
export function segment(p: number, a: number, b: number): number {
  if (b <= a) return p >= b ? 1 : 0;
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}

/** expo.out — même courbe que l'easing CSS `--ease-out-expo` de la landing. */
export function expoOut(t: number): number {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

/** power4.out */
export function power4Out(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u * u;
}

/**
 * Léger dépassement puis retour (settle) — back.out très amorti.
 * c1 = 0.35 ≈ 2 % de dépassement ; 1.70158 serait le back.out standard (~10 %).
 */
export function settle(t: number, c1 = 0.35): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const u = t - 1;
  return 1 + (c1 + 1) * u * u * u + c1 * u * u;
}
