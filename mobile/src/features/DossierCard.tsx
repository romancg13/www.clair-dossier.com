/** Carte de dossier — titre, typologie, statut, date de mise à jour. */
import { Pressable, StyleSheet, View } from 'react-native';
import {
  dossierDisplayTitle,
  isGenericTitle,
  statusLabel,
  typologyLabel,
} from '@clairdossier/core';
import { Badge, Icon, Text } from '../ui';
import { formatRelative } from '../lib/format';
import { colors, radius, shadow, spacing } from '../theme/tokens';

export type DossierCardItem = {
  id: string;
  title: string | null;
  typology: string;
  status: string;
  updated_at: string;
};

const STATUS_TONE: Record<string, 'neutral' | 'accent' | 'success' | 'inverse'> = {
  brouillon: 'neutral',
  transmis: 'accent',
  'en-cours': 'accent',
  valide: 'success',
  archive: 'neutral',
};

export function DossierCard({
  dossier,
  onPress,
  right,
}: {
  dossier: DossierCardItem;
  onPress: () => void;
  right?: string;
}) {
  const generic = isGenericTitle(dossier.title);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${dossierDisplayTitle(dossier)}, ${typologyLabel(dossier.typology)}, ${statusLabel(dossier.status)}`}
      accessibilityHint="Ouvre le dossier"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <View style={styles.titles}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {dossierDisplayTitle(dossier)}
          </Text>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {typologyLabel(dossier.typology)} · {right ?? formatRelative(dossier.updated_at)}
          </Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textMuted} />
      </View>
      <View style={styles.footer}>
        <Badge label={statusLabel(dossier.status)} tone={STATUS_TONE[dossier.status] ?? 'neutral'} />
        {generic ? <Badge label="À renommer" tone="neutral" /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  pressed: { backgroundColor: colors.surfaceMuted },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  titles: { flex: 1, gap: 2 },
  footer: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
