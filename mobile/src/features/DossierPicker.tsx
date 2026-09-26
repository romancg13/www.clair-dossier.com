/** Sélecteur de dossier de destination (import, scan). */
import { FlatList, StyleSheet, View } from 'react-native';
import { dossierDisplayTitle, statusLabel, typologyLabel } from '@clairdossier/core';
import { Button, EmptyState, ListRow, Sheet } from '../ui';
import type { DossierListItem } from '../data/dossiers';

export function DossierPicker({
  visible,
  dossiers,
  onSelect,
  onClose,
  onCreate,
}: {
  visible: boolean;
  dossiers: DossierListItem[];
  onSelect: (dossier: DossierListItem) => void;
  onClose: () => void;
  onCreate: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      title="Choisir un dossier"
      onClose={onClose}
      footer={<Button label="Créer un dossier" variant="secondary" icon="plus" onPress={onCreate} />}
    >
      {dossiers.length === 0 ? (
        <EmptyState
          title="Aucun dossier"
          description="Créez un premier dossier pour y ranger vos pièces."
          actionLabel="Créer un dossier"
          onAction={onCreate}
        />
      ) : (
        <FlatList
          data={dossiers}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <ListRow
              title={dossierDisplayTitle(item)}
              subtitle={`${typologyLabel(item.typology)} · ${statusLabel(item.status)}`}
              icon="folder"
              onPress={() => onSelect(item)}
            />
          )}
        />
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sep: { height: 1, backgroundColor: 'transparent' },
});
