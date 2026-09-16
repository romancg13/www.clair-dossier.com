/**
 * Échéances — agenda unique, tous dossiers confondus.
 *
 * Les rappels proposés ici sont LOCAUX (programmés sur l'appareil) : aucune
 * relance n'est envoyée par nos serveurs aujourd'hui (voir /etat-du-produit).
 * L'interface le dit explicitement pour ne rien laisser croire d'autre.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { deadlineStatus, userMessage, type Deadline, type DeadlineStatus } from '@clairdossier/core';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { DeadlineItem } from '../../src/features/DeadlineItem';
import { Banner, EmptyState, ErrorState, SkeletonList, Text } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { useAllDeadlines, useToggleDeadline } from '../../src/data/deadlines';
import { useDossiers } from '../../src/data/dossiers';
import { loadPrefs } from '../../src/lib/storage';
import { rescheduleReminders } from '../../src/lib/notifications';
import { colors, spacing } from '../../src/theme/tokens';
import { dossierDisplayTitle } from '@clairdossier/core';

const ORDER: DeadlineStatus[] = ['retard', 'a-venir', 'terminee'];
const TITLES: Record<DeadlineStatus, string> = {
  retard: 'En retard',
  'a-venir': 'À venir',
  terminee: 'Terminées',
};

export default function Echeances() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id;
  const { data, isPending, isError, error, refetch, isRefetching } = useAllDeadlines(userId);
  const dossiers = useDossiers(userId);
  const toggle = useToggleDeadline(userId ?? '');
  const [remindersOn, setRemindersOn] = useState(false);

  useEffect(() => {
    loadPrefs().then((p) => setRemindersOn(p.localReminders)).catch(() => {});
  }, []);

  // Les rappels locaux suivent l'état réel des échéances : à chaque
  // rafraîchissement, on reprogramme l'ensemble (opération idempotente).
  useEffect(() => {
    if (!data) return;
    loadPrefs()
      .then((prefs) => rescheduleReminders(data, prefs.reminderOffsets, prefs.localReminders))
      .catch(() => {});
  }, [data]);

  const titleFor = useCallback(
    (dossierId: string) => {
      const dossier = (dossiers.data ?? []).find((d) => d.id === dossierId);
      return dossier ? dossierDisplayTitle(dossier) : 'Dossier';
    },
    [dossiers.data],
  );

  const sections = useMemo(() => {
    const groups: Record<DeadlineStatus, Deadline[]> = { retard: [], 'a-venir': [], terminee: [] };
    for (const deadline of data ?? []) groups[deadlineStatus(deadline.due_date, deadline.done)].push(deadline);
    return ORDER.filter((key) => groups[key].length > 0).map((key) => ({ key, title: TITLES[key], data: groups[key] }));
  }, [data]);

  return (
    <SectionList
      style={styles.root}
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.content, { paddingBottom: spacing.huge + insets.bottom }]}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.accentStrong} />
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <ScreenHeader title="Échéances" subtitle="Toutes vos dates clés, le plus urgent en premier." />
          {!remindersOn ? (
            <Banner
              tone="info"
              message="Activez les rappels sur cet appareil depuis Compte → Notifications. ClairDossier n'envoie aucune relance automatique."
            />
          ) : null}
        </View>
      }
      renderSectionHeader={({ section }) => (
        <Text variant="overline" tone={section.key === 'retard' ? 'danger' : 'muted'} style={styles.sectionTitle}>
          {section.title}
        </Text>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      SectionSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => (
        <DeadlineItem
          deadline={item}
          contextLabel={titleFor(item.dossier_id)}
          onToggle={() => toggle.mutate(item)}
          onPress={() => router.push(`/dossier/${item.dossier_id}`)}
        />
      )}
      ListEmptyComponent={
        isPending ? (
          <SkeletonList rows={3} />
        ) : isError ? (
          <ErrorState message={userMessage(error)} onRetry={() => void refetch()} />
        ) : (
          <EmptyState
            icon="calendar"
            title="Aucune échéance"
            description="Ajoutez une date clé depuis un dossier : paiement attendu, réponse à donner, fin de contrat."
            actionLabel="Voir mes dossiers"
            onAction={() => router.push('/dossiers')}
          />
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  header: { gap: spacing.lg, paddingBottom: spacing.md },
  sectionTitle: { marginTop: spacing.lg, marginBottom: spacing.xs },
});
