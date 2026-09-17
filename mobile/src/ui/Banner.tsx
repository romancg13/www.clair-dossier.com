/** Bandeau d'information ou d'alerte, à l'intérieur d'un écran. */
import { StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { colors, radius, spacing } from '../theme/tokens';

type Tone = 'info' | 'warning' | 'danger' | 'success';

const TONES: Record<Tone, { bg: string; border: string; fg: string; icon: IconName }> = {
  info: { bg: colors.surfaceMuted, border: colors.border, fg: colors.textSecondary, icon: 'info' },
  warning: { bg: '#fdf7e7', border: colors.accentSoft, fg: colors.accentStrong, icon: 'alert' },
  danger: { bg: colors.dangerSurface, border: colors.dangerBorder, fg: colors.dangerText, icon: 'alert' },
  success: { bg: colors.successSurface, border: colors.successBorder, fg: colors.success, icon: 'check' },
};

export function Banner({ tone = 'info', title, message }: { tone?: Tone; title?: string; message: string }) {
  const t = TONES[tone];
  return (
    <View
      style={[styles.banner, { backgroundColor: t.bg, borderColor: t.border }]}
      accessibilityLiveRegion={tone === 'danger' ? 'assertive' : 'polite'}
      accessibilityRole="alert"
    >
      <Icon name={t.icon} size={18} color={t.fg} />
      <View style={styles.texts}>
        {title ? (
          <Text variant="smallStrong" style={{ color: t.fg }}>
            {title}
          </Text>
        ) : null}
        <Text variant="small" style={{ color: t.fg }}>
          {message}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  texts: { flex: 1, gap: 2 },
});
