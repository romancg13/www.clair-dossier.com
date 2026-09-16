/**
 * Coquille d'écran — fond de marque, zones sûres (encoche, Dynamic Island,
 * barre de gestes), en-tête optionnel et gestion du clavier.
 */
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme/tokens';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: ViewStyle;
  /** Écran plein (listes virtualisées) : pas de padding horizontal. */
  bleed?: boolean;
  footer?: ReactNode;
};

export function Screen({ children, scroll = true, refreshing, onRefresh, contentStyle, bleed, footer }: Props) {
  const insets = useSafeAreaInsets();
  const padding: ViewStyle = {
    paddingHorizontal: bleed ? 0 : spacing.lg,
    paddingBottom: spacing.xxxl + insets.bottom,
  };

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[padding, contentStyle]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.accentStrong}
            colors={[colors.surfaceInverse]}
            title="Actualisation…"
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padding, contentStyle]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
    >
      {body}
      {footer ? <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
});
