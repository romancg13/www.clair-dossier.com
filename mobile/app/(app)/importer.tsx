/**
 * Importer — trois sources (appareil photo, photos, fichiers) et un dossier de
 * destination. L'écran affiche l'état réel de chaque envoi : progression,
 * succès, échec relançable. Rien n'est jamais présenté comme terminé tant que
 * le serveur ne l'a pas confirmé (§35).
 */
import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { dossierDisplayTitle } from '@clairdossier/core';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { DossierPicker } from '../../src/features/DossierPicker';
import { ImportProgress } from '../../src/features/ImportProgress';
import { useImport } from '../../src/features/useImport';
import { Banner, Button, Card, Icon, ListRow, Screen, SectionHeader, Text } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { useDossiers, type DossierListItem } from '../../src/data/dossiers';
import { pickDocuments, pickFromLibrary, type PickedFile } from '../../src/lib/files';
import { colors, spacing } from '../../src/theme/tokens';

export default function Importer() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const dossiers = useDossiers(userId);
  const [target, setTarget] = useState<DossierListItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { items, running, run, retryFailed, reset } = useImport(userId);

  const ensureTarget = useCallback((): DossierListItem | null => {
    if (target) return target;
    const list = dossiers.data ?? [];
    if (list.length === 1) {
      setTarget(list[0] as DossierListItem);
      return list[0] as DossierListItem;
    }
    setPickerOpen(true);
    return null;
  }, [dossiers.data, target]);

  const importFiles = useCallback(
    async (files: PickedFile[]) => {
      if (!files.length) return;
      const destination = ensureTarget();
      if (!destination) {
        setError('Choisissez d’abord le dossier de destination.');
        return;
      }
      setError(null);
      const summary = await run(files, destination.id, {
        onDuplicate: (warning) =>
          new Promise<boolean>((resolve) => {
            Alert.alert('Pièce déjà présente ?', warning, [
              { text: 'Ne pas importer', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Importer quand même', onPress: () => resolve(true) },
            ]);
          }),
      });
      if (summary.done > 0 && summary.failed === 0) {
        Alert.alert(
          'Import terminé',
          `${summary.done} pièce${summary.done > 1 ? 's' : ''} ajoutée${summary.done > 1 ? 's' : ''} à « ${dossierDisplayTitle(destination)} ».`,
          [
            { text: 'Rester ici', style: 'cancel' },
            { text: 'Ouvrir le dossier', onPress: () => router.push(`/dossier/${destination.id}`) },
          ],
        );
      }
    },
    [ensureTarget, router, run],
  );

  const fromLibrary = async () => {
    try {
      await importFiles(await pickFromLibrary());
    } catch {
      setError("L'accès aux photos n'a pas abouti. Vérifiez les autorisations dans les réglages.");
    }
  };

  const fromFiles = async () => {
    try {
      await importFiles(await pickDocuments());
    } catch {
      setError("L'accès aux fichiers n'a pas abouti. Réessayez.");
    }
  };

  const openScanner = () => {
    const destination = ensureTarget();
    if (!destination) {
      setError('Choisissez d’abord le dossier de destination.');
      return;
    }
    router.push({ pathname: '/scanner', params: { dossierId: destination.id } });
  };

  return (
    <Screen>
      <ScreenHeader title="Importer" subtitle="Scannez, photographiez ou choisissez un fichier." />

      <Card>
        <SectionHeader title="Dossier de destination" />
        <View style={styles.target}>
          {target ? (
            <ListRow
              title={dossierDisplayTitle(target)}
              subtitle="Appuyez pour changer de dossier"
              icon="folder"
              onPress={() => setPickerOpen(true)}
            />
          ) : (
            <Button label="Choisir un dossier" variant="secondary" icon="folder" onPress={() => setPickerOpen(true)} />
          )}
        </View>
      </Card>

      {error ? (
        <View style={styles.block}>
          <Banner tone="warning" message={error} />
        </View>
      ) : null}

      <View style={styles.block}>
        <SectionHeader title="Source" caption="25 Mo maximum par pièce · PDF, images, Word, texte" />
        <View style={styles.sources}>
          <ListRow
            title="Scanner un document"
            subtitle="Plusieurs pages, assemblées en un seul PDF"
            icon="scan"
            onPress={openScanner}
          />
          <ListRow title="Depuis mes photos" subtitle="Sélection multiple" icon="image" onPress={fromLibrary} />
          <ListRow title="Depuis mes fichiers" subtitle="iCloud, Drive, stockage de l'appareil" icon="file" onPress={fromFiles} />
        </View>
      </View>

      {items.length ? (
        <View style={styles.block}>
          <SectionHeader
            title="Envois"
            actionLabel={running ? undefined : 'Effacer'}
            onAction={running ? undefined : reset}
          />
          <ImportProgress items={items} />
          {!running && items.some((i) => i.state === 'echec') && target ? (
            <Button
              label="Relancer les envois en échec"
              variant="secondary"
              icon="refresh"
              onPress={() => void retryFailed(target.id)}
            />
          ) : null}
        </View>
      ) : null}

      <View style={styles.block}>
        <Card tone="muted">
          <View style={styles.note}>
            <Icon name="lock" size={18} color={colors.accentStrong} />
            <Text variant="caption" tone="secondary" style={styles.flex}>
              Vos pièces sont envoyées chiffrées vers un espace privé. Elles ne sont accessibles qu'avec votre
              compte, par des liens temporaires, et ne sont jamais lues automatiquement.
            </Text>
          </View>
        </Card>
      </View>

      <DossierPicker
        visible={pickerOpen}
        dossiers={dossiers.data ?? []}
        onSelect={(dossier) => {
          setTarget(dossier);
          setPickerOpen(false);
          setError(null);
        }}
        onClose={() => setPickerOpen(false)}
        onCreate={() => {
          setPickerOpen(false);
          router.push('/dossier/nouveau');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  target: { marginTop: spacing.sm },
  block: { marginTop: spacing.xxl, gap: spacing.md },
  sources: { gap: spacing.sm },
  note: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
});
