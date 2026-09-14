import { useSyncExternalStore } from 'react';
import { getQuality, subscribeQuality, type QualityState } from '../quality/QualityManager';

const SSR_STATE: QualityState = {
  staticTier: 'fallback',
  tier: 'fallback',
  dpr: 1,
  reason: 'pré-rendu',
  contextLosses: 0,
};

/** État de qualité 3D côté React (re-render uniquement quand le tier change). */
export function useQuality(): QualityState {
  return useSyncExternalStore(subscribeQuality, getQuality, () => SSR_STATE);
}
