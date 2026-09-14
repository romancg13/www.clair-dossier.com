import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import type { WebGLRenderer } from 'three';
import { reportContextLoss } from './quality/QualityManager';
import { FpsGovernor } from './quality/FpsGovernor';
import { useQuality } from './hooks/useQuality';

/**
 * Enveloppe commune de toutes les scènes (Phase 4b).
 *
 *  - DPR issu du tier de qualité (jamais le devicePixelRatio brut) ;
 *  - `flat` : pas de tone mapping, couleurs de la charte exactes ;
 *  - fond transparent : la scène vit derrière la composition HTML existante ;
 *  - boucle de rendu active uniquement quand la scène est visible
 *    (IntersectionObserver → frameloop 'always' / 'never') ;
 *  - gouverneur de framerate (FpsGovernor) → dégradation prudente du tier partagé,
 *    jamais de repli complet sur le seul framerate ;
 *  - perte de contexte → une recréation tolérée, puis repli ;
 *  - `pointer-events: none` : les CTA et le contenu restent cliquables.
 */
export function CinematicCanvas({
  children,
  onReady,
  className = '',
  fov = 30,
  cameraZ = 10,
  near = 0.1,
  far = 60,
}: {
  children: ReactNode;
  onReady?: () => void;
  className?: string;
  fov?: number;
  cameraZ?: number;
  near?: number;
  far?: number;
}) {
  const quality = useQuality();
  const hostRef = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);

  // Aucun rendu tant que la scène n'est pas à l'écran (économie GPU/CPU).
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const io = new IntersectionObserver(
      (entries) => setVisible(entries.some((e) => e.isIntersecting)),
      { rootMargin: '20% 0px' },
    );
    io.observe(host);
    return () => io.disconnect();
  }, []);

  const lowTier = quality.tier === 'low';

  return (
    <div ref={hostRef} className={`absolute inset-0 ${className}`} aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <Canvas
        dpr={quality.dpr}
        flat
        frameloop={visible ? 'always' : 'never'}
        gl={{
          antialias: !lowTier,
          alpha: true,
          stencil: false,
          depth: true,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: true,
          preserveDrawingBuffer: false,
        }}
        camera={{ fov, near, far, position: [0, 0, cameraZ] }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
          attachContextGuards(gl);
        }}
        style={{ pointerEvents: 'none' }}
      >
        <FpsGovernor />
        {children}
        {onReady && <ReadySignal onReady={onReady} />}
      </Canvas>
    </div>
  );
}

function attachContextGuards(gl: WebGLRenderer) {
  const el = gl.domElement;
  const onLost = (e: Event) => {
    // Laisser le navigateur restaurer le contexte une fois ; au-delà, repli.
    e.preventDefault();
    // R3F force la perte de contexte au démontage (forceContextLoss) : une
    // perte n'est comptée que si le canvas est encore dans la page 1,5 s plus
    // tard sans avoir été restauré.
    let restored = false;
    const onRestored = () => {
      restored = true;
    };
    el.addEventListener('webglcontextrestored', onRestored, { once: true });
    window.setTimeout(() => {
      el.removeEventListener('webglcontextrestored', onRestored);
      if (el.isConnected && !restored) reportContextLoss();
    }, 1500);
  };
  el.addEventListener('webglcontextlost', onLost, false);
}

/** Signale la première frame rendue (déclenche le fondu poster → canvas). */
function ReadySignal({ onReady }: { onReady: () => void }) {
  const gl = useThree((s) => s.gl);
  useEffect(() => {
    let raf = 0;
    // Deux frames : la première compile les shaders, la seconde est peinte.
    raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => onReady());
    });
    return () => cancelAnimationFrame(raf);
  }, [gl, onReady]);
  return null;
}
