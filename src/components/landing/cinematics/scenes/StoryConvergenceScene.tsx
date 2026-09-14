import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { CinematicCanvas } from '../CinematicCanvas';
import { CameraRig, type CameraPose } from '../camera/CameraRig';
import { SheetField, type SheetSpec } from '../primitives/SheetField';
import { LineField, type LineSpec } from '../primitives/LineField';
import { Dust, Halo } from '../primitives/Atmosphere';
import { PALETTE } from '../primitives/palette';
import { segment, useProgressRef } from '../hooks/useProgressRef';
import { usePointerRef } from '../hooks/usePointerRef';
import { useQuality } from '../hooks/useQuality';
import { budgetFor } from '../quality/QualityManager';
import type { SceneProps } from '../CinematicGate';

/**
 * Scène 02 — Le chaos devient dossier (arrière-plan de la scène épinglée 01).
 *
 * Derrière les douze pièces HTML qui convergent, un champ de feuilles en
 * profondeur raconte la même histoire à plus grande échelle : dispersées
 * jusqu'à p ≈ 0,24, elles convergent en cascade (0,24 → 0,66) vers une pile
 * ordonnée juste derrière le panneau « Pièces du dossier », avec un léger
 * dépassement puis retour. Après 0,7, le champ se retire doucement (fondu DOM
 * et recul) pour laisser le panneau seul : chaos → ordre → calme.
 * La caméra glisse d'un dolly-in imperceptible (z 12,5 → 10,8).
 * Desktop uniquement : la scène épinglée n'existe pas sous 1024 px.
 */

type Rest = [x: number, y: number, z: number, w: number, h: number, tint: number];

// Pile ordonnée derrière le panneau (deux colonnes légèrement décalées en profondeur).
const STACK: Rest[] = [
  [-2.6, 1.2, -4.2, 1.1, 1.45, 0],
  [2.6, 1.2, -4.3, 1.1, 1.45, 0],
  [-2.6, -0.4, -4.6, 1.1, 1.45, 0.5],
  [2.6, -0.4, -4.7, 1.1, 1.45, 0],
  [-2.6, -2.0, -5.0, 1.1, 1.45, 0],
  [2.6, -2.0, -5.1, 1.1, 1.45, 1],
  [-3.9, 0.4, -6.2, 1.0, 1.3, 0],
  [3.9, 0.4, -6.3, 1.0, 1.3, 0],
  [-3.9, -1.2, -6.6, 1.0, 1.3, 0.5],
  [3.9, -1.2, -6.7, 1.0, 1.3, 0],
  [0, 2.4, -6.0, 1.0, 1.3, 0],
  [0, -2.9, -6.4, 1.0, 1.3, 1],
  [-5.2, 1.6, -8.4, 1.1, 1.4, 0],
  [5.2, 1.6, -8.5, 1.1, 1.4, 0],
  [-5.2, -2.2, -8.8, 1.1, 1.4, 0],
  [5.2, -2.2, -8.9, 1.1, 1.4, 0.5],
  [-1.4, 3.2, -9.4, 1.0, 1.3, 0],
  [1.4, 3.2, -9.5, 1.0, 1.3, 0],
  [-1.4, -3.8, -9.8, 1.0, 1.3, 0],
  [1.4, -3.8, -9.9, 1.0, 1.3, 1],
  [-6.6, 0, -11.2, 1.2, 1.5, 0],
  [6.6, 0, -11.3, 1.2, 1.5, 0],
  [-3.2, 4.0, -12.4, 1.2, 1.5, 0.5],
  [3.2, 4.0, -12.5, 1.2, 1.5, 0],
  [-3.2, -4.6, -12.8, 1.2, 1.5, 0],
  [3.2, -4.6, -12.9, 1.2, 1.5, 0],
  [0, 0.4, -14.2, 1.4, 1.8, 0],
  [-7.8, 2.6, -15.0, 1.3, 1.7, 0],
  [7.8, -2.6, -15.1, 1.3, 1.7, 0.5],
  [0, 5.2, -15.6, 1.3, 1.7, 0],
];

function buildSheets(budget: number): SheetSpec[] {
  const count = Math.max(8, Math.round(STACK.length * budget));
  return STACK.slice(0, count).map((r, i) => {
    const [x, y, z, w, h, tint] = r;
    // Dispersion de départ : loin, large, incliné — déterministe par index.
    const a = ((i * 53) % 17) / 17 - 0.5;
    const b = ((i * 29) % 13) / 13 - 0.5;
    return {
      from: [x * 2.6 + a * 6, y * 2.2 + b * 5, z - 6 - Math.abs(a) * 8, a * 1.1, b * 1.3, a * 0.8],
      to: [x, y, z, 0, 0, a * 0.04],
      size: [w, h],
      delay: ((i * 7) % 10) * 0.045,
      tint,
      drift: 0.6 + Math.abs(b) * 0.6,
    };
  });
}

function buildLines(budget: number): LineSpec[] {
  if (budget <= 0) return [];
  const n = Math.max(3, Math.round(8 * budget));
  return STACK.slice(0, n).map((r, i) => ({
    a: [r[0], r[1], r[2]],
    b: [r[0] * 0.25, r[1] * 0.25, -3.6],
    delay: 0.45 + (i % 4) * 0.08,
    weight: 0.35 + ((i * 5) % 3) * 0.15,
  }));
}

export default function StoryConvergenceScene({ progress, onReady }: SceneProps) {
  const quality = useQuality();
  const budget = budgetFor(quality.tier);
  const scrollRef = useProgressRef(progress);
  const pointerRef = usePointerRef(budget.pointer > 0);
  const sheets = useMemo(() => buildSheets(budget.sheets), [budget.sheets]);
  const lines = useMemo(() => buildLines(budget.lines), [budget.lines]);

  return (
    <CinematicCanvas onReady={onReady} fov={32} cameraZ={12.5}>
      <StoryContent
        sheets={sheets}
        lines={lines}
        scrollRef={scrollRef}
        pointerRef={pointerRef}
        pointerDegrees={1.5 * budget.pointer}
        dust={Math.round(70 * budget.points)}
        ambient={budget.ambient}
      />
    </CinematicCanvas>
  );
}

function StoryContent({
  sheets,
  lines,
  scrollRef,
  pointerRef,
  pointerDegrees,
  dust,
  ambient,
}: {
  sheets: SheetSpec[];
  lines: LineSpec[];
  scrollRef: React.RefObject<number>;
  pointerRef: React.RefObject<{ x: number; y: number; active: number }>;
  pointerDegrees: number;
  dust: number;
  ambient: number;
}) {
  // Progression du champ : fenêtre [0,24 ; 0,66] du scroll de la scène épinglée.
  const fieldRef = useRef(0);
  const group = useRef<Group>(null);
  useFrame(() => {
    const p = scrollRef.current;
    fieldRef.current = segment(p, 0.24, 0.66);
    // Retrait doux après la convergence : le champ recule et descend un peu.
    const out = segment(p, 0.7, 1);
    if (group.current) {
      group.current.position.z = -out * 2.2;
      group.current.position.y = -out * 0.6;
    }
  });

  const pose = useMemo(
    () =>
      (_: number, out: CameraPose) => {
        const p = scrollRef.current;
        const dolly = segment(p, 0.1, 0.7);
        out.x = 0;
        out.y = 0.3 - 0.3 * dolly;
        out.z = 12.5 - 1.7 * dolly;
        out.tx = 0;
        out.ty = -0.1 * dolly;
        out.tz = -4;
        out.fov = 32 - 1.2 * dolly;
      },
    [scrollRef],
  );

  return (
    <>
      <CameraRig pose={pose} progressRef={fieldRef} pointerRef={pointerRef} pointerDegrees={pointerDegrees} lambda={4.5} />
      <Halo position={[0, 0.2, -9]} size={26} color={PALETTE.sky} opacity={0.075} soft={2.6} />
      <group ref={group}>
        <SheetField sheets={sheets} progressRef={fieldRef} drift={ambient * 0.8} settleAmount={1} fog={PALETTE.navy950} fogNear={12} fogFar={30} opacity={0.9} />
        <LineField lines={lines} progressRef={fieldRef} color={PALETTE.sky} opacity={0.28} />
      </group>
      {dust > 0 && <Dust count={dust} color={PALETTE.silver} opacity={0.2} center={[0, 0, -8]} spread={[26, 14, 16]} />}
    </>
  );
}
