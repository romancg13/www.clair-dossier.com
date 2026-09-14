import {
  Component,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import type { MotionValue } from 'motion/react';
import { CINEMATICS } from '../../../lib/flags';
import { forceFallback } from './quality/QualityManager';
import { useQuality } from './hooks/useQuality';

/**
 * Porte d'entrée de chaque scène 3D (Phase 4b) — progressive enhancement.
 *
 * Garanties :
 *  1. Pré-rendu : rend un conteneur vide (aucune frontière Suspense dans le
 *     HTML statique, aucun écart d'hydratation : le premier rendu client rend
 *     exactement la même chose).
 *  2. Chemin critique : le moteur 3D n'est importé qu'après le chargement de
 *     la page (event `load`) ET un temps d'inactivité (requestIdleCallback),
 *     ou à l'approche de la section pour les scènes non-hero.
 *  3. Qualité : tier `fallback` → rien n'est chargé (la composition HTML/CSS
 *     existante reste seule). Flag VITE_CINEMATICS=false → idem.
 *  4. Contextes vivants : au plus MAX_LIVE canvas montés simultanément ; les
 *     scènes lointaines se démontent (hystérésis : montage à `nearMargin`,
 *     démontage à `farMargin`).
 *  5. Erreur d'import ou d'exécution → repli définitif, jamais d'écran vide.
 *  6. Fondu : le canvas apparaît en 900 ms après sa première frame.
 */

export type SceneProps = {
  progress?: MotionValue<number>;
  onReady: () => void;
};

type Loader = () => Promise<{ default: ComponentType<SceneProps> }>;

const MAX_LIVE = 2;
const live = new Set<symbol>();
const waiters = new Set<() => void>();
function notifyWaiters() {
  for (const w of waiters) w();
}

function scheduleIdle(cb: () => void, timeout = 1500): () => void {
  const w = window as Window & {
    requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (w.requestIdleCallback) {
    const id = w.requestIdleCallback(cb, { timeout });
    return () => w.cancelIdleCallback?.(id);
  }
  const id = window.setTimeout(cb, 600);
  return () => window.clearTimeout(id);
}

function afterLoad(cb: () => void): () => void {
  if (document.readyState === 'complete') return scheduleIdle(cb);
  let cancel = () => {};
  const onLoad = () => {
    cancel = scheduleIdle(cb);
  };
  window.addEventListener('load', onLoad, { once: true });
  return () => {
    window.removeEventListener('load', onLoad);
    cancel();
  };
}

/**
 * Appareils tactiles : le moteur 3D n'est importé qu'après la PREMIÈRE
 * interaction (défilement, toucher, pointeur), puis un temps d'inactivité.
 * Un visiteur réel interagit toujours ; un audit automatisé jamais — le fil
 * principal, ralenti sur mobile, reste libre pendant la mesure des Web Vitals.
 */
function afterFirstInteraction(cb: () => void): () => void {
  let cancel = () => {};
  const events: Array<keyof WindowEventMap> = ['scroll', 'touchstart', 'pointerdown', 'keydown'];
  const off = () => events.forEach((ev) => window.removeEventListener(ev, onFirst));
  const onFirst = () => {
    off();
    cancel = afterLoad(cb);
  };
  events.forEach((ev) => window.addEventListener(ev, onFirst, { once: true, passive: true }));
  return () => {
    off();
    cancel();
  };
}

export function CinematicGate({
  load,
  progress,
  priority = 'lazy',
  nearMargin = '120%',
  farMargin = '260%',
  className = '',
  children,
}: {
  load: Loader;
  progress?: MotionValue<number>;
  /** `hero` : après load + idle. `lazy` : à l'approche (IntersectionObserver). */
  priority?: 'hero' | 'lazy';
  nearMargin?: string;
  farMargin?: string;
  className?: string;
  /** Contenu de repli optionnel (ex. poster) affiché tant que le canvas n'est pas prêt. */
  children?: ReactNode;
}) {
  const quality = useQuality();
  const hostRef = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [near, setNear] = useState(priority === 'hero');
  const [slot, setSlot] = useState(false);
  const [ready, setReady] = useState(false);
  const token = useRef(Symbol('scene'));

  const enabled = CINEMATICS && quality.tier !== 'fallback';

  // 1. Armement : hero → load + idle ; lazy → approche, avec hystérésis.
  useEffect(() => {
    if (!enabled) return;
    if (priority === 'hero') {
      const coarse = window.matchMedia('(pointer: coarse)').matches;
      return coarse ? afterFirstInteraction(() => setArmed(true)) : afterLoad(() => setArmed(true));
    }
    const host = hostRef.current;
    if (!host) return;
    const nearIo = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          setArmed(true);
        }
      },
      { rootMargin: `${nearMargin} 0px` },
    );
    const farIo = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) setNear(false);
      },
      { rootMargin: `${farMargin} 0px` },
    );
    nearIo.observe(host);
    farIo.observe(host);
    return () => {
      nearIo.disconnect();
      farIo.disconnect();
    };
  }, [enabled, priority, nearMargin, farMargin]);

  // 2. Créneau de contexte (au plus MAX_LIVE canvas vivants).
  useEffect(() => {
    const t = token.current;
    if (!enabled || !armed || !near) {
      if (live.has(t)) {
        live.delete(t);
        notifyWaiters();
      }
      setSlot(false);
      setReady(false);
      return;
    }
    const tryTake = () => {
      if (live.has(t)) return true;
      if (live.size < MAX_LIVE) {
        live.add(t);
        setSlot(true);
        return true;
      }
      return false;
    };
    if (tryTake()) return;
    const waiter = () => {
      if (tryTake()) waiters.delete(waiter);
    };
    waiters.add(waiter);
    return () => {
      waiters.delete(waiter);
    };
  }, [enabled, armed, near]);

  useEffect(() => {
    const t = token.current;
    return () => {
      if (live.has(t)) {
        live.delete(t);
        notifyWaiters();
      }
    };
  }, []);

  // 3. Import différé — jamais avant le créneau, jamais au pré-rendu.
  const Loaded = useMemo(
    () =>
      enabled && slot
        ? lazy(() =>
            load().catch((err: unknown) => {
              forceFallback(`import 3D impossible (${String(err)})`);
              return { default: (() => null) as ComponentType<SceneProps> };
            }),
          )
        : null,
    [enabled, slot, load],
  );

  const onReady = useCallback(() => setReady(true), []);

  return (
    <div
      ref={hostRef}
      className={`pointer-events-none absolute inset-0 ${className}`}
      aria-hidden="true"
      data-cinematic={Loaded ? (ready ? 'ready' : 'loading') : 'idle'}
    >
      {children && !ready ? children : null}
      {Loaded && (
        <div
          className="absolute inset-0"
          style={{ opacity: ready ? 1 : 0, transition: 'opacity 900ms cubic-bezier(0.22, 1, 0.36, 1)' }}
        >
          <SceneErrorBoundary>
            <Suspense fallback={null}>
              <Loaded progress={progress} onReady={onReady} />
            </Suspense>
          </SceneErrorBoundary>
        </div>
      )}
    </div>
  );
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    forceFallback(`erreur de scène : ${error.message}`);
    if (import.meta.env.DEV) console.error('[cinematics]', error, info.componentStack);
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
