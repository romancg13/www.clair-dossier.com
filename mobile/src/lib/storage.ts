/**
 * Stockage local — §28.
 *
 * Deux espaces, tous deux dans le magasin sécurisé de l'appareil
 * (Keychain iOS · Keystore Android) :
 *   - la SESSION Supabase (jetons) : fragmentée, car SecureStore limite chaque
 *     valeur à ~2 Ko et un jeton JWT les dépasse ;
 *   - les PRÉFÉRENCES (onboarding vu, verrou biométrique, rappels locaux) :
 *     un seul petit objet JSON.
 *
 * `wipeLocalData()` efface tout : déconnexion, suppression de compte,
 * changement d'utilisateur, session révoquée.
 */
import * as SecureStore from 'expo-secure-store';
import { log } from './logger';

const CHUNK_SIZE = 1800;
const PREFS_KEY = 'clairdossier.prefs';
const SESSION_PREFIX = 'clairdossier.session';

/* ── Session fragmentée ──────────────────────────────────────────────────── */

async function setChunked(key: string, value: string): Promise<void> {
  const chunks = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(`${key}.n`, String(chunks));
  for (let i = 0; i < chunks; i += 1) {
    await SecureStore.setItemAsync(`${key}.${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
}

async function getChunked(key: string): Promise<string | null> {
  const countRaw = await SecureStore.getItemAsync(`${key}.n`);
  if (!countRaw) return null;
  const count = Number(countRaw);
  if (!Number.isInteger(count) || count < 1) return null;
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const part = await SecureStore.getItemAsync(`${key}.${i}`);
    if (part === null) return null; // fragment manquant : session invalide
    out += part;
  }
  return out;
}

async function deleteChunked(key: string): Promise<void> {
  const countRaw = await SecureStore.getItemAsync(`${key}.n`);
  const count = Number(countRaw ?? 0);
  for (let i = 0; i < (Number.isInteger(count) ? count : 0); i += 1) {
    await SecureStore.deleteItemAsync(`${key}.${i}`);
  }
  await SecureStore.deleteItemAsync(`${key}.n`);
}

/** Adaptateur de stockage pour supabase-js (jetons jamais en clair). */
export const secureSessionStorage = {
  getItem: async (key: string): Promise<string | null> => {
    try {
      return await getChunked(`${SESSION_PREFIX}.${key}`);
    } catch (error) {
      log.error('session.read', error);
      return null;
    }
  },
  setItem: async (key: string, value: string): Promise<void> => {
    try {
      await setChunked(`${SESSION_PREFIX}.${key}`, value);
    } catch (error) {
      log.error('session.write', error);
    }
  },
  removeItem: async (key: string): Promise<void> => {
    try {
      await deleteChunked(`${SESSION_PREFIX}.${key}`);
    } catch (error) {
      log.error('session.remove', error);
    }
  },
};

/* ── Préférences ─────────────────────────────────────────────────────────── */

export type Prefs = {
  onboardingDone: boolean;
  /** Verrou local par biométrie / code de l'appareil. */
  appLock: boolean;
  /** Délai d'inactivité avant reverrouillage (minutes). */
  appLockDelayMin: number;
  /** Rappels d'échéances programmés SUR L'APPAREIL (aucun envoi serveur). */
  localReminders: boolean;
  /** Jours d'avance des rappels locaux. */
  reminderOffsets: number[];
  /** Notifications à distance : accord explicite de l'utilisateur. */
  pushOptIn: boolean;
  /** Dernier compte connu — sert à purger le cache si l'utilisateur change. */
  lastUserId: string | null;
};

export const DEFAULT_PREFS: Prefs = {
  onboardingDone: false,
  appLock: false,
  appLockDelayMin: 2,
  localReminders: false,
  reminderOffsets: [7, 1, 0],
  pushOptIn: false,
  lastUserId: null,
};

let cache: Prefs | null = null;

export async function loadPrefs(): Promise<Prefs> {
  if (cache) return cache;
  try {
    const raw = await SecureStore.getItemAsync(PREFS_KEY);
    cache = raw ? { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<Prefs>) } : { ...DEFAULT_PREFS };
  } catch (error) {
    log.error('prefs.read', error);
    cache = { ...DEFAULT_PREFS };
  }
  return cache;
}

export async function savePrefs(patch: Partial<Prefs>): Promise<Prefs> {
  const next = { ...(await loadPrefs()), ...patch };
  cache = next;
  try {
    await SecureStore.setItemAsync(PREFS_KEY, JSON.stringify(next));
  } catch (error) {
    log.error('prefs.write', error);
  }
  return next;
}

/** Efface session + préférences (déconnexion, suppression de compte). */
export async function wipeLocalData(keepOnboarding = true): Promise<void> {
  const prefs = await loadPrefs();
  // Jetons + artefacts d'authentification (vérificateur PKCE compris).
  for (const key of ['clairdossier-auth', 'clairdossier-auth-code-verifier']) {
    await deleteChunked(`${SESSION_PREFIX}.${key}`).catch(() => {});
    await SecureStore.deleteItemAsync(`${SESSION_PREFIX}.${key}`).catch(() => {});
  }
  await SecureStore.deleteItemAsync(PREFS_KEY).catch(() => {});
  cache = null;
  if (keepOnboarding && prefs.onboardingDone) {
    await savePrefs({ onboardingDone: true });
  }
  log.info('local.wiped');
}
