/**
 * Gestionnaire de qualité 3D — état partagé par toutes les scènes.
 *
 *  - tier statique décidé une fois (DeviceTier.ts) ;
 *  - dégradation dynamique quand le framerate chute (PerformanceMonitor de
 *    drei, ou mesure équivalente) : high → medium → low → fallback, avec
 *    hystérésis (jamais de remontée automatique au-dessus du tier statique,
 *    et une seule remontée possible après une période stable) ;
 *  - fallback définitif sur perte de contexte WebGL répétée ou erreur.
 *
 * Aucune dépendance React : un tout petit store observable, lisible depuis
 * useFrame sans re-render, et depuis React via useSyncExternalStore.
 */
import { type CinematicQuality, detectQuality, dprFor } from './DeviceTier';

export type QualityState = {
  /** Tier décidé par le matériel et les préférences (plafond). */
  staticTier: CinematicQuality;
  /** Tier effectif après dégradations dynamiques. */
  tier: CinematicQuality;
  dpr: number;
  /** Raison lisible du dernier changement (debug, panneau /etat-du-produit à terme). */
  reason: string;
  contextLosses: number;
};

const ORDER: CinematicQuality[] = ['high', 'medium', 'low', 'fallback'];

type Listener = (state: QualityState) => void;

let state: QualityState | null = null;
const listeners = new Set<Listener>();

function emit() {
  if (!state) return;
  for (const l of listeners) l(state);
}

function initial(): QualityState {
  const staticTier = detectQuality();
  const deviceDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  return {
    staticTier,
    tier: staticTier,
    dpr: dprFor(staticTier, deviceDpr),
    reason: 'détection initiale',
    contextLosses: 0,
  };
}

export function getQuality(): QualityState {
  if (!state) state = initial();
  return state;
}

export function subscribeQuality(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setTier(tier: CinematicQuality, reason: string) {
  const s = getQuality();
  if (s.tier === tier) return;
  const deviceDpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  state = { ...s, tier, dpr: dprFor(tier, deviceDpr), reason };
  emit();
}

/** Un cran de moins (appelé par le moniteur de framerate). */
export function degradeQuality(reason: string): CinematicQuality {
  const s = getQuality();
  const next = ORDER[Math.min(ORDER.length - 1, ORDER.indexOf(s.tier) + 1)];
  setTier(next, reason);
  return next;
}

/** Un cran de plus, jamais au-dessus du tier statique. */
export function improveQuality(reason: string): CinematicQuality {
  const s = getQuality();
  const idx = ORDER.indexOf(s.tier);
  const cap = ORDER.indexOf(s.staticTier);
  const next = ORDER[Math.max(cap, idx - 1)];
  setTier(next, reason);
  return next;
}

/** Perte de contexte : la première est tolérée (recréation), la seconde force le repli. */
export function reportContextLoss(): CinematicQuality {
  const s = getQuality();
  state = { ...s, contextLosses: s.contextLosses + 1 };
  if (state.contextLosses >= 2) {
    setTier('fallback', 'contexte WebGL perdu à répétition');
  } else {
    emit();
  }
  return getQuality().tier;
}

/** Erreur fatale (import, initialisation, shader) : repli définitif. */
export function forceFallback(reason: string): void {
  setTier('fallback', reason);
}

/** Paramètres de scène dérivés du tier — une seule source pour toutes les scènes. */
export function budgetFor(tier: CinematicQuality) {
  switch (tier) {
    case 'high':
      return { sheets: 1, points: 1, lines: 1, pointer: 1, ambient: 1 };
    case 'medium':
      return { sheets: 0.7, points: 0.5, lines: 0.8, pointer: 0.7, ambient: 1 };
    case 'low':
      return { sheets: 0.45, points: 0.25, lines: 0.5, pointer: 0, ambient: 0.6 };
    default:
      return { sheets: 0, points: 0, lines: 0, pointer: 0, ambient: 0 };
  }
}
