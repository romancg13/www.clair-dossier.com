/**
 * États d'écran — chargement, vide, erreur.
 * Règle §50 : l'erreur affichée est compréhensible, ne révèle rien de
 * technique, et propose toujours une action.
 */
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import { Button } from './Button';
import { Icon, type IconName } from './Icon';
import { colors, radius, spacing } from '../theme/tokens';

export function LoadingState({ label = 'Chargement…' }: { label?: string }) {
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.surfaceInverse} />
      <Text variant="small" tone="muted">
        {label}
      </Text>
    </View>
  );
}

export function EmptyState({
  icon = 'folder',
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.block}>
      <View style={styles.glyph}>
        <Icon name={icon} size={26} color={colors.accentStrong} />
      </View>
      <Text variant="sectionTitle" center>
        {title}
      </Text>
      {description ? (
        <Text variant="small" tone="secondary" center>
          {description}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} fullWidth={false} style={{ marginTop: spacing.sm }} />
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
  retryLabel = 'Réessayer',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <View style={styles.block} accessibilityLiveRegion="polite">
      <View style={[styles.glyph, { backgroundColor: colors.dangerSurface }]}>
        <Icon name="alert" size={26} color={colors.dangerText} />
      </View>
      <Text variant="small" tone="secondary" center>
        {message}
      </Text>
      {onRetry ? <Button label={retryLabel} variant="secondary" onPress={onRetry} fullWidth={false} icon="refresh" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: spacing.md },
  block: { paddingVertical: spacing.xxxl, alignItems: 'center', gap: spacing.md },
  glyph: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
