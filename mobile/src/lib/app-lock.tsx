/**
 * Verrou local de l'application (§7, §27) — OPTIONNEL, désactivé par défaut.
 *
 * Quand l'utilisateur l'active dans Compte → Sécurité, l'application se
 * reverrouille après un délai d'inactivité et redemande Face ID / Touch ID /
 * empreinte, avec repli sur le code de l'appareil. Le verrou ne remplace pas
 * l'authentification Supabase : il protège l'écran, pas le compte.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { loadPrefs } from './storage';
import { log } from './logger';

type LockState = {
  /** Le verrou est-il activé dans les préférences ? */
  enabled: boolean;
  /** L'écran est-il verrouillé maintenant ? */
  locked: boolean;
  unlock: () => Promise<boolean>;
  refreshPrefs: () => Promise<void>;
};

const AppLockContext = createContext<LockState | undefined>(undefined);

export async function biometricsAvailable(): Promise<{ available: boolean; label: string }> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    const label = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)
      ? 'Face ID'
      : types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
        ? 'Empreinte digitale'
        : "Code de l'appareil";
    return { available: hasHardware && enrolled, label };
  } catch (error) {
    log.error('lock.capabilities', error);
    return { available: false, label: "Code de l'appareil" };
  }
}

export function AppLockProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabled] = useState(false);
  const [delayMin, setDelayMin] = useState(2);
  const [locked, setLocked] = useState(false);
  const backgroundedAt = useRef<number | null>(null);

  const refreshPrefs = useCallback(async () => {
    const prefs = await loadPrefs();
    setEnabled(prefs.appLock);
    setDelayMin(prefs.appLockDelayMin);
    if (prefs.appLock) setLocked(true);
  }, []);

  useEffect(() => {
    void refreshPrefs();
  }, [refreshPrefs]);

  useEffect(() => {
    const onChange = (state: AppStateStatus) => {
      if (!enabled) return;
      if (state === 'background' || state === 'inactive') {
        backgroundedAt.current = Date.now();
        return;
      }
      if (state === 'active' && backgroundedAt.current) {
        const elapsedMin = (Date.now() - backgroundedAt.current) / 60000;
        if (elapsedMin >= delayMin) setLocked(true);
        backgroundedAt.current = null;
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [enabled, delayMin]);

  const unlock = useCallback(async (): Promise<boolean> => {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Déverrouiller ClairDossier',
      cancelLabel: 'Annuler',
      disableDeviceFallback: false,
    });
    if (result.success) {
      setLocked(false);
      return true;
    }
    return false;
  }, []);

  const value = useMemo<LockState>(() => ({ enabled, locked: enabled && locked, unlock, refreshPrefs }), [
    enabled,
    locked,
    unlock,
    refreshPrefs,
  ]);

  return <AppLockContext.Provider value={value}>{children}</AppLockContext.Provider>;
}

export function useAppLock(): LockState {
  const ctx = useContext(AppLockContext);
  if (!ctx) throw new Error('useAppLock doit être utilisé dans <AppLockProvider>.');
  return ctx;
}
