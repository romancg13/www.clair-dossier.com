/** Groupe de choix — alternative tactile au <select> du web. */
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { colors, radius, spacing, MIN_TOUCH } from '../theme/tokens';

export type Choice = { id: string; label: string; description?: string };

export function ChoiceGroup({
  label,
  options,
  value,
  onChange,
  columns = 2,
}: {
  label?: string;
  options: Choice[];
  value: string | undefined;
  onChange: (id: string) => void;
  columns?: 1 | 2;
}) {
  return (
    <View style={styles.wrap} accessibilityRole="radiogroup" accessibilityLabel={label}>
      {label ? (
        <Text variant="smallStrong" tone="secondary">
          {label}
        </Text>
      ) : null}
      <View style={styles.grid}>
        {options.map((option) => {
          const selected = option.id === value;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.description ? `${option.label}. ${option.description}` : option.label}
              style={[
                styles.option,
                columns === 2 ? styles.half : styles.full,
                selected && styles.selected,
              ]}
            >
              <Text variant="smallStrong" tone={selected ? 'primary' : 'secondary'}>
                {option.label}
              </Text>
              {option.description ? (
                <Text variant="caption" tone="muted">
                  {option.description}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    minHeight: MIN_TOUCH,
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  half: { flexGrow: 1, flexBasis: '46%' },
  full: { flexGrow: 1, flexBasis: '100%' },
  selected: { borderColor: colors.accent, backgroundColor: '#fdf7e7' },
});
