/** Rendu de la file d'import : état par fichier, progression, erreurs. */
import { StyleSheet, View } from 'react-native';
import { formatBytes } from '@clairdossier/core';
import { Badge, Card, ProgressBar, Text } from '../ui';
import { spacing } from '../theme/tokens';
import type { ImportItem } from './useImport';

const LABELS: Record<ImportItem['state'], { label: string; tone: 'neutral' | 'accent' | 'success' | 'danger' }> = {
  'en-attente': { label: 'En attente', tone: 'neutral' },
  envoi: { label: 'Envoi…', tone: 'accent' },
  termine: { label: 'Importé', tone: 'success' },
  echec: { label: 'Échec', tone: 'danger' },
  ignore: { label: 'Ignoré', tone: 'neutral' },
};

export function ImportProgress({ items }: { items: ImportItem[] }) {
  if (!items.length) return null;
  return (
    <Card>
      <View style={styles.list}>
        {items.map((item, index) => {
          const meta = LABELS[item.state];
          return (
            <View key={`${item.file.name}-${index}`} style={styles.row}>
              <View style={styles.head}>
                <Text variant="smallStrong" numberOfLines={1} style={styles.name}>
                  {item.file.name}
                </Text>
                <Badge label={meta.label} tone={meta.tone} />
              </View>
              {item.state === 'envoi' ? <ProgressBar value={item.progress} label={`Envoi de ${item.file.name}`} /> : null}
              {item.message ? (
                <Text variant="caption" tone={item.state === 'echec' ? 'danger' : 'muted'}>
                  {item.message}
                </Text>
              ) : item.file.size ? (
                <Text variant="caption" tone="muted">
                  {formatBytes(item.file.size)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.md },
  row: { gap: spacing.xs },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  name: { flex: 1 },
});
