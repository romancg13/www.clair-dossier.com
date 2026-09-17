/**
 * Configuration d'exécution — lue une seule fois, ici.
 *
 * Tout ce qui est lisible depuis le bundle est PUBLIC (§26) : on n'y met que
 * l'URL Supabase, la clé « anon » (protégée par les policies RLS) et des
 * constantes d'affichage. Aucun secret serveur, aucune clé d'IA.
 */
import Constants from 'expo-constants';

type Extra = {
  siteUrl?: string;
  appEnv?: string;
  supportPhone?: string;
  supportEmail?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** L'application se dégrade proprement si la configuration manque (écran explicite). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const APP_ENV = (extra.appEnv ?? process.env.EXPO_PUBLIC_ENV ?? 'development') as
  | 'development'
  | 'preview'
  | 'production';

export const SITE_URL = extra.siteUrl ?? process.env.EXPO_PUBLIC_SITE_URL ?? 'https://www.clair-dossier.com';

/** Service Assistance ClairDossier (identité publique unique — I.5). */
export const SUPPORT_PHONE = extra.supportPhone ?? '0491959032';
export const SUPPORT_PHONE_DISPLAY = '04 91 95 90 32';
export const SUPPORT_EMAIL = extra.supportEmail ?? 'contact.clairdossier@icloud.com';

/** Pages publiques réutilisées par l'application (une seule source d'URL). */
export const WEB_LINKS = {
  cgv: `${SITE_URL}/cgv`,
  privacy: `${SITE_URL}/politique-confidentialite`,
  legal: `${SITE_URL}/mentions-legales`,
  cookies: `${SITE_URL}/cookies`,
  security: `${SITE_URL}/securite`,
  pricing: `${SITE_URL}/tarifs`,
  productStatus: `${SITE_URL}/etat-du-produit`,
  contact: `${SITE_URL}/contact`,
  account: `${SITE_URL}/compte`,
  resetRedirect: `${SITE_URL}/connexion`,
} as const;

export const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';
