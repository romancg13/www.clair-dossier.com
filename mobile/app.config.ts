import type { ExpoConfig, ConfigContext } from 'expo/config';

/**
 * Configuration Expo — ClairDossier mobile (iOS · iPadOS · Android).
 *
 * Règles tenues ici :
 *  - aucun secret : seules des variables EXPO_PUBLIC_* (embarquées dans le
 *    bundle, donc publiques par nature) sont lues ;
 *  - chaque permission native porte une justification en français, affichée
 *    à l'utilisateur au moment où elle est réellement nécessaire ;
 *  - identité visuelle reprise du site (logo officiel, navy #0d1b3d,
 *    crème #fbf9f4).
 */

const SITE_URL = process.env.EXPO_PUBLIC_SITE_URL ?? 'https://www.clair-dossier.com';
const APP_ENV = (process.env.EXPO_PUBLIC_ENV ?? 'development') as 'development' | 'preview' | 'production';

const NAVY = '#0d1b3d';
const CREAM = '#fbf9f4';

/** Suffixe d'identifiant par environnement : les 3 variantes cohabitent sur un appareil. */
const ID_SUFFIX = APP_ENV === 'production' ? '' : APP_ENV === 'preview' ? '.preview' : '.dev';
const NAME_SUFFIX = APP_ENV === 'production' ? '' : APP_ENV === 'preview' ? ' (préprod)' : ' (dev)';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: `ClairDossier${NAME_SUFFIX}`,
  slug: 'clairdossier',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'clairdossier',
  userInterfaceStyle: 'light',
  backgroundColor: CREAM,
  primaryColor: NAVY,
  locales: { fr: './locales/fr.json' },
  assetBundlePatterns: ['**/*'],
  extra: {
    siteUrl: SITE_URL,
    appEnv: APP_ENV,
    supportPhone: '0491959032',
    supportEmail: 'contact.clairdossier@icloud.com',
    // eas: { projectId: '…' } — renseigné par `eas init` (action humaine, compte Expo requis).
  },
  ios: {
    bundleIdentifier: `com.clairdossier.app${ID_SUFFIX}`,
    buildNumber: '1',
    supportsTablet: true,
    // Le clavier et la mise en page sont prévus pour l'orientation portrait sur
    // iPhone ; l'iPad accepte les deux sens.
    requireFullScreen: false,
    associatedDomains: ['applinks:www.clair-dossier.com', 'applinks:clair-dossier.com'],
    config: { usesNonExemptEncryption: false },
    infoPlist: {
      CFBundleDisplayName: 'ClairDossier',
      CFBundleAllowMixedLocalizations: true,
      ITSAppUsesNonExemptEncryption: false,
      UIBackgroundModes: ['remote-notification'],
    },
    privacyManifests: {
      NSPrivacyAccessedAPITypes: [
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryFileTimestamp', NSPrivacyAccessedAPITypeReasons: ['C617.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryUserDefaults', NSPrivacyAccessedAPITypeReasons: ['CA92.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategoryDiskSpace', NSPrivacyAccessedAPITypeReasons: ['E174.1'] },
        { NSPrivacyAccessedAPIType: 'NSPrivacyAccessedAPICategorySystemBootTime', NSPrivacyAccessedAPITypeReasons: ['35F9.1'] },
      ],
    },
  },
  android: {
    package: `com.clairdossier.app${ID_SUFFIX}`,
    versionCode: 1,
    // Android 16 impose le bord-à-bord : aucune option à activer (géré nativement).
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      monochromeImage: './assets/android-icon-monochrome.png',
      backgroundColor: NAVY,
    },
    permissions: ['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS', 'android.permission.USE_BIOMETRIC'],
    blockedPermissions: ['android.permission.RECORD_AUDIO'],
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          { scheme: 'https', host: 'www.clair-dossier.com', pathPrefix: '/compte' },
          { scheme: 'https', host: 'clair-dossier.com', pathPrefix: '/compte' },
          { scheme: 'https', host: 'www.clair-dossier.com', pathPrefix: '/dossier' },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    'expo-font',
    [
      'expo-splash-screen',
      { image: './assets/splash-icon.png', imageWidth: 180, resizeMode: 'contain', backgroundColor: CREAM },
    ],
    [
      'expo-camera',
      {
        cameraPermission:
          "ClairDossier utilise l'appareil photo pour scanner un document et l'ajouter à votre dossier. Aucune image n'est envoyée sans votre action.",
        recordAudioAndroid: false,
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'ClairDossier accède à vos photos pour importer un document existant dans un dossier. Seuls les fichiers que vous choisissez sont envoyés.',
        cameraPermission:
          "ClairDossier utilise l'appareil photo pour scanner un document et l'ajouter à votre dossier.",
      },
    ],
    [
      'expo-local-authentication',
      {
        faceIDPermission:
          "ClairDossier utilise Face ID pour verrouiller l'accès à vos dossiers sur cet appareil.",
      },
    ],
    [
      'expo-notifications',
      {
        icon: './assets/notification-icon.png',
        color: NAVY,
        defaultChannel: 'echeances',
      },
    ],
    [
      'expo-build-properties',
      {
        android: { compileSdkVersion: 36, targetSdkVersion: 36, minSdkVersion: 24 },
        ios: { deploymentTarget: '16.4' },
      },
    ],
  ],
  // Nouvelle architecture React Native : activée par défaut en SDK 57 (RN 0.86).
  experiments: { typedRoutes: true },
});
