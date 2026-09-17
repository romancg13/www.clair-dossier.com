/** En-tête d'écran — titre en Cormorant, sous-titre, action optionnelle. */
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, Text } from '../ui';
import { colors, spacing, HIT_SLOP } from '../theme/tokens';

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + spacing.sm }]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          hitSlop={HIT_SLOP}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          style={styles.back}
        >
          <Icon name="chevron-left" size={22} color={colors.textSecondary} />
        </Pressable>
      ) : null}
      <View style={styles.row}>
        <View style={styles.texts}>
          <Text variant="title" numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text variant="small" tone="secondary" numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: spacing.lg, gap: spacing.sm },
  back: { width: 32, height: 32, justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  texts: { flex: 1, gap: 2 },
});
