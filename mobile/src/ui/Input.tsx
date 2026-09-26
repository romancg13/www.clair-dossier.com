/**
 * Champ de saisie — libellé toujours visible (jamais un simple placeholder),
 * aide contextuelle, erreur annoncée, 16 pt minimum (pas de zoom iOS).
 */
import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { Text } from './Text';
import { colors, radius, spacing, MIN_TOUCH } from '../theme/tokens';

export type InputProps = TextInputProps & {
  label: string;
  help?: string;
  error?: string | null;
  required?: boolean;
};

export const Input = forwardRef<TextInput, InputProps>(function Input(
  { label, help, error, required, style, multiline, ...rest },
  ref,
) {
  return (
    <View style={styles.wrap}>
      <Text variant="smallStrong" tone="secondary">
        {label}
        {required ? ' *' : ''}
      </Text>
      <TextInput
        ref={ref}
        {...rest}
        multiline={multiline}
        style={[styles.input, multiline && styles.multiline, !!error && styles.inputError, style]}
        placeholderTextColor={colors.textMuted}
        accessibilityLabel={label}
        accessibilityHint={help}
        selectionColor={colors.accentStrong}
      />
      {error ? (
        <Text variant="caption" tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : help ? (
        <Text variant="caption" tone="muted">
          {help}
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  input: {
    minHeight: MIN_TOUCH,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: colors.textPrimary,
  },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  inputError: { borderColor: colors.dangerBorder, backgroundColor: colors.dangerSurface },
});
