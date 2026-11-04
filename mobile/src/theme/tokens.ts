/**
 * Design system mobile — reprise fidèle des jetons du site
 * (`src/index.css`, bloc `@theme`). Toute couleur, tout rayon et toute ombre
 * de l'application vient d'ici : aucune valeur en dur dans les écrans.
 */

export const palette = {
  navy900: '#0d1b3d',
  navy800: '#152348',
  navy700: '#1e2c52',
  navy600: '#2a3960',

  gold500: '#c4a456',
  gold400: '#e6c97d',
  gold300: '#f0d99a',
  /** Or lisible sur fond clair (contraste AA sur crème). */
  gold700: '#7a5f28',

  cream50: '#fbf9f4',
  cream100: '#f5f0e6',
  cream200: '#ebe2cf',

  ink: '#0a1228',
  slate500: '#5a6378',
  slate400: '#7c8497',
  slate300: '#a3aab9',

  white: '#ffffff',

  /** Alertes — mêmes teintes que le site (Tailwind red-*). */
  red700: '#b91c1c',
  red600: '#dc2626',
  red200: '#fecaca',
  red50: '#fef2f2',

  green700: '#15803d',
  green50: '#f0fdf4',
  green200: '#bbf7d0',
} as const;

/** Rôles sémantiques : c'est ce que les écrans utilisent. */
export const colors = {
  background: palette.cream50,
  surface: palette.white,
  surfaceMuted: palette.cream100,
  surfaceInverse: palette.navy900,
  border: palette.cream200,
  borderStrong: palette.slate300,
  textPrimary: palette.ink,
  textSecondary: palette.slate500,
  textMuted: palette.slate400,
  textOnInverse: palette.cream50,
  accent: palette.gold500,
  accentStrong: palette.gold700,
  accentSoft: palette.gold300,
  danger: palette.red600,
  dangerText: palette.red700,
  dangerSurface: palette.red50,
  dangerBorder: palette.red200,
  success: palette.green700,
  successSurface: palette.green50,
  successBorder: palette.green200,
  overlay: 'rgba(10, 18, 40, 0.45)',
} as const;

/** Échelle d'espacement 4 pt. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 18,
  xl: 24,
  full: 9999,
} as const;

export const fonts = {
  display: 'CormorantGaramond_600SemiBold',
  displayRegular: 'CormorantGaramond_500Medium',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansLight: 'Inter_300Light',
} as const;

/** Échelle typographique (taille / interligne / graisse). */
export const type = {
  display: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32 },
  sectionTitle: { fontFamily: fonts.sansSemiBold, fontSize: 17, lineHeight: 24 },
  body: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24 },
  bodyStrong: { fontFamily: fonts.sansMedium, fontSize: 16, lineHeight: 24 },
  small: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  smallStrong: { fontFamily: fonts.sansMedium, fontSize: 14, lineHeight: 20 },
  caption: { fontFamily: fonts.sans, fontSize: 12, lineHeight: 17 },
  overline: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
} as const;

export const shadow = {
  card: {
    shadowColor: palette.navy900,
    shadowOpacity: 0.06,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  raised: {
    shadowColor: palette.navy900,
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
} as const;

/** Cible tactile minimale (Apple HIG 44 pt · Material 48 dp). */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TOUCH = 44;
