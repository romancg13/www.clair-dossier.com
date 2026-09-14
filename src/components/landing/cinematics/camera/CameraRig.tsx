import { useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { damp } from '../hooks/useProgressRef';
import type { PointerState } from '../hooks/usePointerRef';

/**
 * Pose caméra : position, cible et focale. Les scènes écrivent dans un objet
 * réutilisé (jamais d'allocation par frame).
 */
export type CameraPose = {
  x: number;
  y: number;
  z: number;
  tx: number;
  ty: number;
  tz: number;
  fov: number;
};

export type PoseFn = (progress: number, out: CameraPose) => void;

export function makePose(): CameraPose {
  return { x: 0, y: 0, z: 10, tx: 0, ty: 0, tz: 0, fov: 30 };
}

/**
 * Rig caméra centralisé (Phase 4b).
 *
 * Une seule boucle par scène applique : la pose pilotée par le scroll
 * (fonction `pose`), un amortissement exponentiel indépendant du framerate
 * (jamais de saut, jamais de tremblement), et une influence du pointeur
 * très faible (desktop) elle-même amortie. Les scènes ne touchent jamais la
 * caméra directement : elles fournissent `pose` et lisent `progressRef`.
 */
export function CameraRig({
  pose,
  progressRef,
  pointerRef,
  pointerDegrees = 2.5,
  lambda = 5,
  pointerLambda = 3,
}: {
  pose: PoseFn;
  progressRef: RefObject<number>;
  pointerRef?: RefObject<PointerState>;
  /** Amplitude maximale de la parallaxe pointeur, en degrés (0 = désactivée). */
  pointerDegrees?: number;
  /** Raideur de l'amortissement de la pose (plus grand = plus réactif). */
  lambda?: number;
  pointerLambda?: number;
}) {
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const target = useMemo(() => makePose(), []);
  const current = useMemo(() => makePose(), []);
  const lookAt = useMemo(() => new Vector3(), []);
  const pointer = useRef({ x: 0, y: 0 });
  const first = useRef(true);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20); // évite les rattrapages violents après un onglet caché
    pose(progressRef.current, target);

    if (first.current) {
      Object.assign(current, target);
      first.current = false;
    } else {
      current.x = damp(current.x, target.x, lambda, dt);
      current.y = damp(current.y, target.y, lambda, dt);
      current.z = damp(current.z, target.z, lambda, dt);
      current.tx = damp(current.tx, target.tx, lambda, dt);
      current.ty = damp(current.ty, target.ty, lambda, dt);
      current.tz = damp(current.tz, target.tz, lambda, dt);
      current.fov = damp(current.fov, target.fov, lambda, dt);
    }

    // Parallaxe pointeur : inertie, jamais un mappage direct.
    const p = pointerRef?.current;
    const px = p && p.active ? p.x : 0;
    const py = p && p.active ? p.y : 0;
    pointer.current.x = damp(pointer.current.x, px, pointerLambda, dt);
    pointer.current.y = damp(pointer.current.y, py, pointerLambda, dt);
    const rad = (pointerDegrees * Math.PI) / 180;
    const dist = Math.hypot(current.x - current.tx, current.y - current.ty, current.z - current.tz);
    const offX = Math.sin(pointer.current.x * 2 * rad) * dist;
    const offY = Math.sin(-pointer.current.y * 2 * rad) * dist * 0.6;

    camera.position.set(current.x + offX, current.y + offY, current.z);
    lookAt.set(current.tx, current.ty, current.tz);
    camera.lookAt(lookAt);
    if (Math.abs(camera.fov - current.fov) > 0.01) {
      camera.fov = current.fov;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}
