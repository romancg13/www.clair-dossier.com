/**
 * Ligne de pièce — nom, catégorie, taille, date ; actions au menu long.
 * La catégorie affichée provient de la règle déterministe sur le NOM du
 * fichier (jamais du contenu), avec priorité à la correction utilisateur.
 */
import { Pressable, StyleSheet, View } from 'react-native';
import { CATEGORY_LABELS, effectiveCategory, formatBytes, type DossierDocument } from '@clairdossier/core';
import { Badge, Icon, Text } from '../ui';
import { formatShortDate } from '../lib/format';
import { colors, radius, spacing, MIN_TOUCH } from '../theme/tokens';

export function DocumentItem({
  document,
  onPress,
  onLongPress,
  showCategory = true,
}: {
  document: DossierDocument;
  onPress?: () => void;
  onLongPress?: () => void;
  showCategory?: boolean;
}) {
  const isDeliverable = document.kind === 'deliverable';
  const trashed = !!document.deleted_at;
  const category = effectiveCategory(document.file_name, document.category);
  const ext = document.file_name.split('.').pop()?.toLowerCase() ?? '';
  const icon = ext === 'pdf' ? 'file' : ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? 'image' : 'file';

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${document.file_name}${showCategory ? `, ${CATEGORY_LABELS[category]}` : ''}`}
      accessibilityHint="Appui long pour les actions"
      style={({ pressed }) => [styles.row, trashed && styles.trashed, pressed && styles.pressed]}
    >
      <View style={styles.glyph}>
        <Icon name={icon} size={18} color={colors.textSecondary} />
      </View>
      <View style={styles.body}>
        <Text variant="smallStrong" numberOfLines={2}>
          {document.file_name}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {showCategory && !isDeliverable ? `${CATEGORY_LABELS[category]} · ` : ''}
          {formatShortDate(document.created_at)}
          {document.size_bytes ? ` · ${formatBytes(document.size_bytes)}` : ''}
        </Text>
      </View>
      {isDeliverable ? <Badge label="ClairDossier" tone="accent" /> : null}
      {trashed ? <Badge label="Corbeille" tone="neutral" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + 8,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  trashed: { opacity: 0.6, backgroundColor: colors.surfaceMuted },
  pressed: { backgroundColor: colors.surfaceMuted },
  glyph: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
});
