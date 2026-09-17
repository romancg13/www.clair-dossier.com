/**
 * Bouton — 3 intentions (primaire navy, secondaire bordé, discret) et une
 * variante danger. Cible tactile ≥ 44 pt, retour haptique léger, état occupé
 * explicite et annoncé aux lecteurs d'écran.
 */
import { useCallback } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Text } from './Text';
import { Icon, type IconName } from './Icon';
import { colors, radius, spacing, MIN_TOUCH } from '../theme/tokens';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'md' | 'sm';

export type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  style?: ViewStyle;
  testID?: string;
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  disabled = false,
  fullWidth = true,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const inactive = disabled || loading;

  const handlePress = useCallback(() => {
    if (inactive || !onPress) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onPress();
  }, [inactive, onPress]);

  const tint =
    variant === 'primary' ? colors.textOnInverse : variant === 'danger' ? colors.dangerText : colors.textPrimary;

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' && styles.sm,
        VARIANTS[variant],
        fullWidth && { alignSelf: 'stretch' },
        pressed && !inactive && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={tint} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={18} color={tint} /> : null}
          <Text variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'} style={{ color: tint }}>
            {label}
          </Text>
          {iconRight ? <Icon name={iconRight} size={18} color={tint} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const VARIANTS: Record<Variant, ViewStyle> = {
  primary: { backgroundColor: colors.surfaceInverse },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.borderStrong },
  ghost: { backgroundColor: 'transparent' },
  danger: { backgroundColor: colors.dangerSurface, borderWidth: 1, borderColor: colors.dangerBorder },
};

const styles = StyleSheet.create({
  base: {
    minHeight: MIN_TOUCH,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { minHeight: 38, paddingVertical: spacing.sm, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pressed: { opacity: 0.85, transform: [{ scale: 0.99 }] },
  inactive: { opacity: 0.45 },
});
