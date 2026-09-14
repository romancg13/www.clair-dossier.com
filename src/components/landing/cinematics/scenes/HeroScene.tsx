import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CinematicCanvas } from '../CinematicCanvas';
import { CameraRig, type CameraPose } from '../camera/CameraRig';
import { SheetField, type SheetSpec } from '../primitives/SheetField';
import { LineField, type LineSpec } from '../primitives/LineField';
import { Dust, Halo } from '../primitives/Atmosphere';
import { PALETTE } from '../primitives/palette';
import { expoOut, useProgressRef } from '../hooks/useProgressRef';
import { usePointerRef } from '../hooks/usePointerRef';
import { useQuality } from '../hooks/useQuality';
import { budgetFor } from '../quality/QualityManager';
import { useMediaQuery } from '../../useCinematic';
import type { SceneProps } from '../CinematicGate';

/**
 * Scène 01 — Le dossier suspendu (hero).
 *
 * Un environnement en profondeur AUTOUR du contenu HTML existant (H1, CTA,
 * carte « Dossier de démonstration ») : feuilles documentaires sur trois
 * plans, quelques lignes fines, un halo, un peu de poussière.
 *
 * Temps :
 *  - à la première frame, les feuilles partent de poses légèrement plus
 *    lointaines/désordonnées et viennent se poser (cascade, 2,6 s, expo.out,
 *    léger settle) — « le dossier se suspend » ;
 *  - la caméra effectue un dolly-in imperceptible (z 11 → 9,8) et un très
 *    léger resserrement de focale (30° → 28,5°) ;
 *  - au scroll (progression 0 → 1 quand le hero quitte l'écran), la caméra
 *    monte un peu moins vite que la page : parallaxe de profondeur ;
 *  - desktop : parallaxe pointeur ±2,5°, amortie.
 * Rien ne tourne en continu ; le flottement ambiant est de quelques mm.
 *
 * Repères monde (caméra z ≈ 10, FOV 30°) : hauteur visible ≈ 5,4 u à z = 0,
 * largeur ≈ 8,6 u en 16:10. La carte HTML occupe la colonne droite (x ≈ +2,1).
 */

const INTRO_SECONDS = 2.6;

type Rest = [x: number, y: number, z: number, rx: number, ry: number, rz: number, w: number, h: number, tint: number, drift: number];

// Poses de repos — desktop. Plans : avant (z > 1), milieu (−1…−5), fond (−8…−14).
const REST_DESKTOP: Rest[] = [
  // milieu, autour de la carte (colonne droite) — jamais devant elle
  [4.35, 1.75, -3.2, 0.05, -0.36, 0.05, 0.62, 0.84, 0, 1],
  [0.55, -2.15, -2.9, -0.04, 0.3, -0.05, 0.56, 0.76, 0, 1],
  [4.75, -1.15, -4.2, 0.08, -0.48, 0.09, 0.66, 0.9, 1, 0.8],
  [1.15, 2.55, -4.8, -0.06, 0.24, -0.08, 0.5, 0.68, 0, 0.9],
  [2.9, -2.9, -5.6, 0.02, 0.14, 0.04, 0.8, 0.56, 1, 0.7],
  [0.2, 0.7, -6.4, -0.03, 0.4, 0.03, 0.54, 0.72, 0, 0.8],
  [5.4, 0.5, -6.8, 0.06, -0.52, -0.04, 0.58, 0.78, 0, 0.9],
  // fond (brume crème) — des deux côtés, très pâle
  [-3.7, 1.5, -9.6, -0.08, 0.5, 0.12, 0.72, 0.96, 0, 0.6],
  [-2.4, -1.9, -11.6, 0.1, 0.36, -0.08, 0.78, 1.02, 1, 0.6],
  [5.6, 2.7, -10.4, 0.04, -0.6, 0.06, 0.72, 0.96, 0, 0.5],
  [-4.8, -0.2, -13.4, -0.05, 0.56, 0.02, 0.84, 1.14, 0, 0.5],
  [2.0, 3.5, -12.8, 0.12, 0.2, -0.14, 0.78, 1.02, 0, 0.5],
  [6.6, -2.3, -12.4, -0.06, -0.46, 0.1, 0.84, 1.08, 0, 0.5],
  [-1.2, 3.0, -8.8, 0.02, 0.44, 0.08, 0.6, 0.78, 0, 0.7],
  [3.3, -3.6, -10.0, -0.1, -0.2, 0.04, 0.72, 0.9, 1, 0.6],
  [-5.9, 2.3, -12.0, 0.06, 0.66, 0.0, 0.78, 1.02, 0, 0.5],
];

// Poses de repos — mobile : moins de feuilles, autour de la carte (bas de l'écran).
const REST_MOBILE: Rest[] = [
  [-2.0, -0.9, -3.2, 0.04, 0.34, 0.06, 0.5, 0.68, 0, 1],
  [2.0, -1.7, -3.6, -0.05, -0.36, -0.06, 0.52, 0.7, 0, 1],
  [-1.6, -3.1, -5.0, 0.02, 0.2, 0.1, 0.56, 0.74, 1, 0.8],
  [2.2, 0.7, -5.8, 0.06, -0.3, 0.02, 0.5, 0.66, 0, 0.8],
  [-2.5, 1.9, -9.2, -0.08, 0.5, 0.08, 0.72, 0.96, 0, 0.6],
  [2.7, 3.1, -11.0, 0.04, -0.5, -0.06, 0.72, 0.96, 0, 0.5],
  [-0.6, 3.7, -13.2, 0.1, 0.2, 0.04, 0.84, 1.08, 0, 0.5],
  [1.1, -4.1, -10.2, -0.06, -0.2, 0.06, 0.66, 0.84, 0, 0.6],
];

function buildSheets(rest: Rest[], budget: number): SheetSpec[] {
  const count = Math.max(4, Math.round(rest.length * budget));
  return rest.slice(0, count).map((r, i) => {
    const [x, y, z, rx, ry, rz, w, h, tint, drift] = r;
    // Départ : un peu plus loin, un peu plus dispersé, un peu plus incliné (déterministe).
    const s = ((i * 37) % 11) / 11 - 0.5;
    const away = 1.8 + Math.abs(s) * 1.6;
    return {
      from: [x + s * 1.6, y - 0.9 + s * 0.6, z - away, rx + s * 0.5, ry + s * 0.7, rz + s * 0.35],
      to: [x, y, z, rx, ry, rz],
      size: [w, h],
      delay: (i % 7) * 0.055,
      tint,
      drift,
    };
  });
}

function buildLines(desktop: boolean, budget: number): LineSpec[] {
  if (budget <= 0) return [];
  const card: [number, number, number] = desktop ? [2.1, 0.1, -0.6] : [0, -1.4, -0.8];
  const anchors: Array<[number, number, number]> = desktop
    ? [
        [4.35, 1.75, -3.2],
        [0.55, -2.15, -2.9],
        [4.75, -1.15, -4.2],
        [1.15, 2.55, -4.8],
        [0.2, 0.7, -6.4],
        [5.4, 0.5, -6.8],
      ]
    : [
        [-2.0, -0.9, -3.2],
        [2.0, -1.7, -3.6],
        [2.2, 0.7, -5.8],
      ];
  const n = Math.max(2, Math.round(anchors.length * budget));
  return anchors.slice(0, n).map((a, i) => ({
    a,
    // La ligne s'arrête juste avant la carte HTML (elle « y entre »).
    b: [card[0] + (a[0] - card[0]) * 0.22, card[1] + (a[1] - card[1]) * 0.22, card[2]],
    delay: 0.35 + (i % 4) * 0.09,
    weight: 0.5 + ((i * 3) % 4) * 0.12,
  }));
}

export default function HeroScene({ progress, onReady }: SceneProps) {
  const quality = useQuality();
  const budget = budgetFor(quality.tier);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const scrollRef = useProgressRef(progress);
  const pointerRef = usePointerRef(budget.pointer > 0);

  const sheets = useMemo(() => buildSheets(desktop ? REST_DESKTOP : REST_MOBILE, budget.sheets), [desktop, budget.sheets]);
  const lines = useMemo(() => buildLines(desktop, budget.lines), [desktop, budget.lines]);

  return (
    <CinematicCanvas onReady={onReady} fov={30} cameraZ={11}>
      <HeroContent
        sheets={sheets}
        lines={lines}
        scrollRef={scrollRef}
        pointerRef={pointerRef}
        pointerDegrees={2.5 * budget.pointer}
        dust={Math.round(90 * budget.points)}
        ambient={budget.ambient}
        desktop={desktop}
      />
    </CinematicCanvas>
  );
}

function HeroContent({
  sheets,
  lines,
  scrollRef,
  pointerRef,
  pointerDegrees,
  dust,
  ambient,
  desktop,
}: {
  sheets: SheetSpec[];
  lines: LineSpec[];
  scrollRef: React.RefObject<number>;
  pointerRef: React.RefObject<{ x: number; y: number; active: number }>;
  pointerDegrees: number;
  dust: number;
  ambient: number;
  desktop: boolean;
}) {
  // Progression d'entrée (temps) : 0 → 1 en INTRO_SECONDS, linéaire ici,
  // l'easing (expo.out + settle) étant appliqué dans les shaders.
  const introRef = useRef(0);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    elapsed.current += Math.min(delta, 0.05);
    introRef.current = Math.min(1, elapsed.current / INTRO_SECONDS);
  });

  const pose = useMemo(
    () =>
      (_: number, out: CameraPose) => {
        const intro = expoOut(introRef.current);
        const scroll = scrollRef.current;
        out.x = 0;
        out.y = -0.35 * scroll; // la caméra suit la page, un peu moins vite : parallaxe
        out.z = 11 - 1.2 * intro;
        out.tx = 0;
        out.ty = -0.35 * scroll + 0.1 * intro;
        out.tz = 0;
        out.fov = 30 - 1.5 * intro;
      },
    [scrollRef],
  );

  const haloPos = useMemo<[number, number, number]>(() => (desktop ? [2.4, 0.4, -7] : [0, -1.2, -7]), [desktop]);

  return (
    <>
      <CameraRig pose={pose} progressRef={introRef} pointerRef={pointerRef} pointerDegrees={pointerDegrees} lambda={4} />
      <Halo position={haloPos} size={22} color={PALETTE.sky} opacity={0.07} soft={2.4} />
      <Halo position={[-3.5, -2.6, -9]} size={16} color={PALETTE.gold} opacity={0.035} soft={2.8} />
      <SheetField
        sheets={sheets}
        progressRef={introRef}
        drift={ambient}
        settleAmount={1}
        fog={PALETTE.cream}
        fogNear={7}
        fogFar={21}
        opacity={0.86}
        cardColor={PALETTE.glass}
        cardEdge={PALETTE.glassEdge}
      />
      <LineField lines={lines} progressRef={introRef} color={PALETTE.navy900} opacity={0.16} />
      {dust > 0 && <Dust count={dust} color={PALETTE.navy900} opacity={0.1} center={[1.5, 0, -7]} spread={[20, 12, 14]} />}
    </>
  );
}
