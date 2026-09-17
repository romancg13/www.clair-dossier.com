/**
 * Scanner — capture multi-pages, prévisualisation, réorganisation, PDF, envoi.
 *
 * Parcours : cadrer → capturer → (rotation / suppression / réordonnancement)
 * → générer le PDF → envoyer dans le dossier choisi. L'autorisation caméra
 * n'est demandée qu'ici, au moment où elle sert (§31), et le refus n'empêche
 * pas d'utiliser le reste de l'application.
 */
import { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { userMessage } from '@clairdossier/core';
import { Badge, Banner, Button, Icon, ProgressBar, Text } from '../src/ui';
import { useImport } from '../src/features/useImport';
import { useAuth } from '../src/lib/auth';
import { MAX_PAGES, buildPdf, defaultScanName, discardScan, preparePage, rotatePage, type ScanPage } from '../src/lib/scanner';
import { colors, radius, spacing, HIT_SLOP } from '../src/theme/tokens';

export default function Scanner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { dossierId } = useLocalSearchParams<{ dossierId?: string }>();
  const { user } = useAuth();
  const importer = useImport(user?.id ?? '');
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [pages, setPages] = useState<ScanPage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const capture = useCallback(async () => {
    if (busy || pages.length >= MAX_PAGES) return;
    setBusy(true);
    setError(null);
    try {
      const shot = await camera.current?.takePictureAsync({ quality: 0.9, skipProcessing: false, shutterSound: false });
      if (shot?.uri) {
        const page = await preparePage(shot.uri);
        setPages((prev) => [...prev, page]);
      }
    } catch (e) {
      setError(userMessage(e, "La capture n'a pas abouti."));
    } finally {
      setBusy(false);
    }
  }, [busy, pages.length]);

  const removePage = (id: string) => {
    setPages((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) discardScan([target]);
      return prev.filter((p) => p.id !== id);
    });
  };

  const rotate = async (page: ScanPage) => {
    const rotated = await rotatePage(page);
    setPages((prev) => prev.map((p) => (p.id === page.id ? rotated : p)));
  };

  const movePage = (index: number, direction: -1 | 1) => {
    setPages((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      const [item] = next.splice(index, 1);
      if (item) next.splice(target, 0, item);
      return next;
    });
  };

  const finish = async () => {
    if (!pages.length || !user) return;
    if (!dossierId) {
      setError('Aucun dossier de destination. Revenez en arrière et choisissez un dossier.');
      return;
    }
    setBusy(true);
    setError(null);
    setProgress(0);
    try {
      const pdf = await buildPdf(pages, defaultScanName());
      setProgress(0.3);
      const summary = await importer.run([pdf], String(dossierId));
      discardScan(pages, pdf);
      setProgress(1);
      setBusy(false);
      if (summary.failed > 0) {
        setError("Le PDF n'a pas pu être envoyé. Vérifiez votre connexion puis réessayez.");
        return;
      }
      setPages([]);
      router.replace(`/dossier/${dossierId}`);
    } catch (e) {
      setBusy(false);
      setProgress(null);
      setError(userMessage(e, "Le document n'a pas pu être préparé."));
    }
  };

  const quit = () => {
    if (pages.length) {
      Alert.alert('Abandonner le scan ?', `${pages.length} page(s) non enregistrée(s) seront perdues.`, [
        { text: 'Continuer le scan', style: 'cancel' },
        {
          text: 'Abandonner',
          style: 'destructive',
          onPress: () => {
            discardScan(pages);
            router.back();
          },
        },
      ]);
      return;
    }
    router.back();
  };

  if (!permission) return <View style={styles.root} />;

  if (!permission.granted) {
    return (
      <View style={[styles.root, styles.permission, { paddingTop: insets.top + spacing.xxl }]}>
        <Icon name="camera" size={34} color={colors.accentStrong} />
        <Text variant="title" center>
          Autoriser l'appareil photo
        </Text>
        <Text variant="small" tone="secondary" center>
          ClairDossier utilise l'appareil photo uniquement pour scanner les documents que vous ajoutez à un
          dossier. Aucune image n'est envoyée sans votre action.
        </Text>
        <Button label="Autoriser" onPress={() => void requestPermission()} fullWidth={false} />
        <Button label="Revenir" variant="ghost" onPress={() => router.back()} fullWidth={false} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <CameraView ref={camera} style={styles.camera} facing="back" autofocus="on" animateShutter={false}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={quit} hitSlop={HIT_SLOP} accessibilityRole="button" accessibilityLabel="Fermer le scanner">
            <Icon name="close" size={24} color={colors.textOnInverse} />
          </Pressable>
          <Badge label={`${pages.length}/${MAX_PAGES} page${pages.length > 1 ? 's' : ''}`} tone="inverse" />
        </View>
        <View style={styles.frame} pointerEvents="none">
          <View style={[styles.corner, styles.tl]} />
          <View style={[styles.corner, styles.tr]} />
          <View style={[styles.corner, styles.bl]} />
          <View style={[styles.corner, styles.br]} />
        </View>
      </CameraView>

      <View style={[styles.panel, { paddingBottom: insets.bottom + spacing.lg }]}>
        {error ? <Banner tone="danger" message={error} /> : null}
        {progress !== null ? <ProgressBar value={progress} label="Préparation du document" /> : null}

        {pages.length > 0 ? (
          <FlatList
            horizontal
            data={pages}
            keyExtractor={(item) => item.id}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.thumbs}
            renderItem={({ item, index }) => (
              <View style={styles.thumbWrap}>
                <Image source={{ uri: item.uri }} style={styles.thumb} contentFit="cover" />
                <Text variant="caption" tone="muted" center>
                  {index + 1}
                </Text>
                <View style={styles.thumbActions}>
                  <Pressable onPress={() => movePage(index, -1)} hitSlop={HIT_SLOP} accessibilityLabel={`Déplacer la page ${index + 1} avant`}>
                    <Icon name="chevron-left" size={16} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => void rotate(item)} hitSlop={HIT_SLOP} accessibilityLabel={`Pivoter la page ${index + 1}`}>
                    <Icon name="refresh" size={16} color={colors.textSecondary} />
                  </Pressable>
                  <Pressable onPress={() => removePage(item.id)} hitSlop={HIT_SLOP} accessibilityLabel={`Supprimer la page ${index + 1}`}>
                    <Icon name="trash" size={16} color={colors.dangerText} />
                  </Pressable>
                  <Pressable onPress={() => movePage(index, 1)} hitSlop={HIT_SLOP} accessibilityLabel={`Déplacer la page ${index + 1} après`}>
                    <Icon name="chevron-right" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>
            )}
          />
        ) : (
          <Text variant="small" tone="secondary" center>
            Posez le document à plat, cadrez-le dans les repères, puis appuyez sur le déclencheur.
          </Text>
        )}

        <View style={styles.controls}>
          <Pressable
            onPress={capture}
            disabled={busy || pages.length >= MAX_PAGES}
            accessibilityRole="button"
            accessibilityLabel="Capturer une page"
            style={({ pressed }) => [styles.shutter, pressed && { opacity: 0.8 }, busy && { opacity: 0.4 }]}
          >
            <View style={styles.shutterInner} />
          </Pressable>
        </View>

        <Button
          label={pages.length ? `Enregistrer ${pages.length} page${pages.length > 1 ? 's' : ''} en PDF` : 'Enregistrer'}
          icon="check"
          onPress={finish}
          disabled={!pages.length || busy}
          loading={busy && progress !== null}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  permission: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xxl, backgroundColor: colors.background },
  camera: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  frame: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, margin: spacing.xxl, marginTop: 90, marginBottom: 90 },
  corner: { position: 'absolute', width: 28, height: 28, borderColor: colors.accent },
  tl: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: radius.sm },
  tr: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: radius.sm },
  bl: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: radius.sm },
  br: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: radius.sm },
  panel: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  thumbs: { gap: spacing.md, paddingVertical: spacing.xs },
  thumbWrap: { alignItems: 'center', gap: 2 },
  thumb: { width: 62, height: 84, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
  thumbActions: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  controls: { alignItems: 'center' },
  shutter: {
    width: 62,
    height: 62,
    borderRadius: radius.full,
    borderWidth: 3,
    borderColor: colors.surfaceInverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: { width: 48, height: 48, borderRadius: radius.full, backgroundColor: colors.surfaceInverse },
});
