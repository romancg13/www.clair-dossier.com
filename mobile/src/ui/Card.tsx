/** Carte — surface blanche, filet crème, ombre discrète (identité du site). */
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme/tokens';

export function Card({
  children,
  style,
  padded = true,
  tone = 'surface',
}: {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
  tone?: 'surface' | 'muted' | 'inverse' | 'danger';
}) {
  return (
    <View style={[styles.card, TONES[tone], padded && { padding: spacing.lg }, style]}>{children}</View>
  );
}

const TONES: Record<string, ViewStyle> = {
  surface: { backgroundColor: colors.surface, borderColor: colors.border },
  muted: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  inverse: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  danger: { backgroundColor: colors.dangerSurface, borderColor: colors.dangerBorder },
};

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    ...shadow.card,
  },
});
