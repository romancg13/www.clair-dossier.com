/**
 * Texte — seule porte d'entrée typographique de l'application.
 * `variant` mappe l'échelle de src/theme/tokens.ts ; la taille suit toujours
 * les réglages système (Dynamic Type / taille de police Android).
 */
import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { colors, type as typeScale } from '../theme/tokens';

type Variant = keyof typeof typeScale;
type Tone = 'primary' | 'secondary' | 'muted' | 'accent' | 'inverse' | 'danger' | 'success';

const TONES: Record<Tone, string> = {
  primary: colors.textPrimary,
  secondary: colors.textSecondary,
  muted: colors.textMuted,
  accent: colors.accentStrong,
  inverse: colors.textOnInverse,
  danger: colors.dangerText,
  success: colors.success,
};

export type TextProps = RNTextProps & {
  variant?: Variant;
  tone?: Tone;
  center?: boolean;
};

export function Text({ variant = 'body', tone = 'primary', center, style, ...rest }: TextProps) {
  const base = typeScale[variant] as TextStyle;
  return (
    <RNText
      {...rest}
      style={[base, { color: TONES[tone] }, center && { textAlign: 'center' }, style]}
      // Les très grandes tailles système cassent les mises en page denses :
      // on borne sans jamais empêcher l'agrandissement (accessibilité).
      maxFontSizeMultiplier={rest.maxFontSizeMultiplier ?? 1.6}
    />
  );
}
