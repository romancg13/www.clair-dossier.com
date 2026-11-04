import { useMemo } from 'react';
import { CinematicCanvas } from '../CinematicCanvas';
import { CameraRig, type CameraPose } from '../camera/CameraRig';
import { SheetField, type SheetSpec } from '../primitives/SheetField';
import { Dust, Halo } from '../primitives/Atmosphere';
import { PALETTE } from '../primitives/palette';
import { useProgressRef } from '../hooks/useProgressRef';
import { usePointerRef } from '../hooks/usePointerRef';
import { useQuality } from '../hooks/useQuality';
import { budgetFor } from '../quality/QualityManager';
import type { SceneProps } from '../CinematicGate';

/**
 * Scène 06 — Convergence finale, puis calme.
 *
 * À l'approche de la section finale (progression 0 → 1), les feuilles vues
 * dans les chapitres précédents reviennent des bords et se rangent en une
 * composition symétrique et paisible derrière l'aperçu du dossier ; la
 * caméra recule légèrement (z 9,5 → 11) : complexité → simplicité.
 * Une fois en place, plus aucun mouvement important : un flottement ambiant
 * quasi imperceptible, c'est la respiration finale avant l'appel à l'action.
 */

type Rest = [x: number, y: number, z: number, w: number, h: number, tint: number];

const REST: Rest[] = [
  [-4.6, 1.4, -3.6, 1.0, 1.35, 0],
  [4.6, 1.4, -3.7, 1.0, 1.35, 0],
  [-4.9, -1.5, -4.4, 1.0, 1.35, 0.5],
  [4.9, -1.5, -4.5, 1.0, 1.35, 0],
  [-6.4, 0, -6.8, 1.1, 1.45, 0],
  [6.4, 0, -6.9, 1.1, 1.45, 1],
  [-2.8, 3.4, -7.6, 1.0, 1.3, 0],
  [2.8, 3.4, -7.7, 1.0, 1.3, 0],
  [-2.6, -3.6, -8.0, 1.0, 1.3, 0.5],
  [2.6, -3.6, -8.1, 1.0, 1.3, 0],
  [-7.6, 2.8, -10.4, 1.2, 1.5, 0],
  [7.6, 2.8, -10.5, 1.2, 1.5, 0],
  [-7.4, -3.0, -10.8, 1.2, 1.5, 0],
  [7.4, -3.0, -10.9, 1.2, 1.5, 0.5],
  [0, 4.8, -11.6, 1.2, 1.5, 0],
  [0, -5.0, -12.0, 1.2, 1.5, 1],
  [-4.0, 5.6, -13.8, 1.3, 1.7, 0],
  [4.0, 5.6, -13.9, 1.3, 1.7, 0],
  [-9.2, 0.6, -14.6, 1.3, 1.7, 0],
  [9.2, 0.6, -14.7, 1.3, 1.7, 0],
];

function buildSheets(budget: number): SheetSpec[] {
  const count = Math.max(6, Math.round(REST.length * budget));
  return REST.slice(0, count).map((r, i) => {
    const [x, y, z, w, h, tint] = r;
    const a = ((i * 41) % 11) / 11 - 0.5;
    const side = x < 0 ? -1 : x > 0 ? 1 : a < 0 ? -1 : 1;
    return {
      from: [x + side * 7 + a * 2, y * 1.6 + a * 3, z - 4, a * 0.9, side * 0.9, a * 0.6],
      to: [x, y, z, 0, side * 0.12, a * 0.03],
      size: [w, h],
      delay: ((i * 3) % 6) * 0.06,
      tint,
      drift: 0.5,
    };
  });
}

export default function FinalConvergenceScene({ progress, onReady }: SceneProps) {
  const quality = useQuality();
  const budget = budgetFor(quality.tier);
  const scrollRef = useProgressRef(progress);
  const pointerRef = usePointerRef(budget.pointer > 0);
  const sheets = useMemo(() => buildSheets(budget.sheets), [budget.sheets]);

  const pose = useMemo(
    () =>
      (p: number, out: CameraPose) => {
        out.x = 0;
        out.y = 0.2 - 0.2 * p;
        out.z = 9.5 + 1.5 * p;
        out.tx = 0;
        out.ty = 0;
        out.tz = -3;
        out.fov = 31 - 1.0 * p;
      },
    [],
  );

  return (
    <CinematicCanvas onReady={onReady} fov={31} cameraZ={9.5}>
      <CameraRig pose={pose} progressRef={scrollRef} pointerRef={pointerRef} pointerDegrees={1.2 * budget.pointer} lambda={3.5} />
      <Halo position={[0, 0.4, -8]} size={24} color={PALETTE.sky} opacity={0.07} soft={2.6} />
      <Halo position={[0, -3.6, -10]} size={18} color={PALETTE.gold} opacity={0.03} soft={3} />
      <SheetField sheets={sheets} progressRef={scrollRef} drift={budget.ambient * 0.4} settleAmount={1} fog={PALETTE.navy950} fogNear={11} fogFar={28} opacity={0.88} />
      {budget.points > 0 && <Dust count={Math.round(60 * budget.points)} color={PALETTE.silver} opacity={0.18} center={[0, 0, -7]} spread={[26, 14, 14]} />}
    </CinematicCanvas>
  );
}
