/** Titre de section avec action facultative à droite. */
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { spacing, HIT_SLOP } from '../theme/tokens';

export function SectionHeader({
  title,
  caption,
  actionLabel,
  onAction,
}: {
  title: string;
  caption?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.texts}>
        <Text variant="sectionTitle">{title}</Text>
        {caption ? (
          <Text variant="caption" tone="muted">
            {caption}
          </Text>
        ) : null}
      </View>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel={actionLabel}>
          <Text variant="smallStrong" tone="accent">
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.md },
  texts: { flex: 1, gap: 2 },
});
