/** Ligne d'échéance — case à cocher, titre, date relative, priorité. */
import { Pressable, StyleSheet, View } from 'react-native';
import {
  DEADLINE_STATUS_LABELS,
  deadlineStatus,
  relativeDueLabel,
  type Deadline,
} from '@clairdossier/core';
import { Badge, Icon, Text } from '../ui';
import { formatDueDate } from '../lib/format';
import { colors, radius, spacing, MIN_TOUCH } from '../theme/tokens';

export function DeadlineItem({
  deadline,
  onToggle,
  onPress,
  contextLabel,
}: {
  deadline: Deadline;
  onToggle?: () => void;
  onPress?: () => void;
  contextLabel?: string;
}) {
  const status = deadlineStatus(deadline.due_date, deadline.done);
  const late = status === 'retard';

  return (
    <View style={[styles.row, late && styles.late]}>
      {onToggle ? (
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: deadline.done }}
          accessibilityLabel={`Marquer « ${deadline.title} » comme ${deadline.done ? 'à faire' : 'terminée'}`}
          style={[styles.check, deadline.done && styles.checked]}
        >
          {deadline.done ? <Icon name="check" size={14} color={colors.textOnInverse} /> : null}
        </Pressable>
      ) : null}

      <Pressable
        style={styles.body}
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={`${deadline.title}, ${formatDueDate(deadline.due_date)}, ${DEADLINE_STATUS_LABELS[status]}`}
      >
        <Text variant="smallStrong" numberOfLines={2} style={deadline.done ? styles.done : undefined}>
          {deadline.title}
        </Text>
        <Text variant="caption" tone={late ? 'danger' : 'muted'} numberOfLines={1}>
          {formatDueDate(deadline.due_date)}
          {deadline.due_time ? ` · ${deadline.due_time.slice(0, 5)}` : ''} · {relativeDueLabel(deadline.due_date)}
          {contextLabel ? ` · ${contextLabel}` : ''}
        </Text>
      </Pressable>

      {deadline.priority === 'haute' && !deadline.done ? <Badge label="Haute" tone="danger" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: MIN_TOUCH + 8,
  },
  late: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerSurface },
  body: { flex: 1, gap: 2 },
  check: {
    width: 26,
    height: 26,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checked: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  done: { textDecorationLine: 'line-through', color: colors.textMuted },
});
