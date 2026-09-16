/** Ligne de liste tactile — titre, sous-titre, pastille, chevron. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { colors, radius, spacing, MIN_TOUCH } from '../theme/tokens';

export function ListRow({
  title,
  subtitle,
  icon,
  right,
  onPress,
  onLongPress,
  danger,
  accessibilityHint,
  testID,
}: {
  title: string;
  subtitle?: string;
  icon?: IconName;
  right?: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  danger?: boolean;
  accessibilityHint?: string;
  testID?: string;
}) {
  const content = (
    <View style={styles.row}>
      {icon ? (
        <View style={styles.glyph}>
          <Icon name={icon} size={19} color={danger ? colors.dangerText : colors.textSecondary} />
        </View>
      ) : null}
      <View style={styles.texts}>
        <Text variant="bodyStrong" tone={danger ? 'danger' : 'primary'} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={18} color={colors.textMuted} /> : null)}
    </View>
  );

  if (!onPress && !onLongPress) return <View style={styles.static}>{content}</View>;

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.static, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  static: {
    minHeight: MIN_TOUCH + 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  texts: { flex: 1, gap: 2 },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
