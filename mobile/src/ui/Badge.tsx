/** Pastille d'état — statut de dossier, échéance, catégorie. */
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing } from '../theme/tokens';

type Tone = 'neutral' | 'accent' | 'danger' | 'success' | 'inverse';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: Tone }) {
  const t = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Text variant="caption" style={{ color: t.fg }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const TONES: Record<Tone, { bg: string; fg: string; border: string }> = {
  neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary, border: colors.border },
  accent: { bg: '#fdf7e7', fg: colors.accentStrong, border: colors.accentSoft },
  danger: { bg: colors.dangerSurface, fg: colors.dangerText, border: colors.dangerBorder },
  success: { bg: colors.successSurface, fg: colors.success, border: colors.successBorder },
  inverse: { bg: colors.surfaceInverse, fg: colors.textOnInverse, border: colors.surfaceInverse },
};

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    maxWidth: '100%',
  },
});
