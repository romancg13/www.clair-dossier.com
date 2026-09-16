/**
 * Accueil — l'essentiel en un écran : ce qui presse, ce qui bouge, et les
 * trois actions les plus fréquentes, accessibles en une seule interaction.
 */
import { useCallback, useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { countDeadlines, userMessage } from '@clairdossier/core';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { DossierCard } from '../../src/features/DossierCard';
import { DeadlineItem } from '../../src/features/DeadlineItem';
import {
  Banner,
  Card,
  EmptyState,
  ErrorState,
  Icon,
  Screen,
  SectionHeader,
  SkeletonList,
  Text,
  type IconName,
} from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { useDossiers } from '../../src/data/dossiers';
import { useAllDeadlines } from '../../src/data/deadlines';
import { useRecentActivity } from '../../src/data/events';
import { useProfile } from '../../src/data/profile';
import { formatRelative } from '../../src/lib/format';
import { colors, radius, spacing } from '../../src/theme/tokens';

export default function Accueil() {
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  const dossiers = useDossiers(userId);
  const deadlines = useAllDeadlines(userId);
  const activity = useRecentActivity(userId);
  const profile = useProfile(userId);

  const refreshing = dossiers.isRefetching || deadlines.isRefetching;
  const refresh = useCallback(() => {
    void qc.invalidateQueries();
  }, [qc]);

  const open = useMemo(() => (deadlines.data ?? []).filter((d) => !d.done), [deadlines.data]);
  const counts = useMemo(() => countDeadlines(open), [open]);
  const urgent = open.slice(0, 3);
  const recent = (dossiers.data ?? []).slice(0, 3);
  const greeting = profile.data?.company_name || profile.data?.full_name || 'Bonjour';

  return (
    <Screen refreshing={refreshing} onRefresh={refresh}>
      <ScreenHeader title={greeting} subtitle="Vos dossiers, vos pièces et vos échéances." />

      <View style={styles.actions}>
        <QuickAction icon="scan" label="Scanner" onPress={() => router.push('/scanner')} />
        <QuickAction icon="download" label="Importer" onPress={() => router.push('/importer')} />
        <QuickAction icon="plus" label="Nouveau dossier" onPress={() => router.push('/dossier/nouveau')} />
      </View>

      {counts.retard > 0 ? (
        <View style={styles.block}>
          <Banner
            tone="danger"
            title={`${counts.retard} échéance${counts.retard > 1 ? 's' : ''} en retard`}
            message="Traitez-les en priorité : elles apparaissent en premier dans l'onglet Échéances."
          />
        </View>
      ) : null}

      <View style={styles.block}>
        <SectionHeader
          title="À faire"
          caption={open.length ? `${open.length} échéance${open.length > 1 ? 's' : ''} ouverte${open.length > 1 ? 's' : ''}` : undefined}
          actionLabel={open.length > 3 ? 'Tout voir' : undefined}
          onAction={() => router.push('/echeances')}
        />
        {deadlines.isPending ? (
          <SkeletonList rows={2} />
        ) : deadlines.isError ? (
          <ErrorState message={userMessage(deadlines.error)} onRetry={() => void deadlines.refetch()} />
        ) : urgent.length === 0 ? (
          <Card tone="muted">
            <Text variant="small" tone="secondary">
              Aucune échéance ouverte. Ajoutez-en une depuis un dossier pour ne rien laisser passer.
            </Text>
          </Card>
        ) : (
          <View style={styles.list}>
            {urgent.map((deadline) => (
              <DeadlineItem
                key={deadline.id}
                deadline={deadline}
                onPress={() => router.push(`/dossier/${deadline.dossier_id}`)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={styles.block}>
        <SectionHeader
          title="Dossiers récents"
          actionLabel={(dossiers.data ?? []).length > 3 ? 'Tout voir' : undefined}
          onAction={() => router.push('/dossiers')}
        />
        {dossiers.isPending ? (
          <SkeletonList rows={2} />
        ) : dossiers.isError ? (
          <ErrorState message={userMessage(dossiers.error)} onRetry={() => void dossiers.refetch()} />
        ) : recent.length === 0 ? (
          <EmptyState
            title="Votre premier dossier"
            description="Réunissez contrat, factures et échanges d'une même affaire en un seul endroit."
            actionLabel="Créer un dossier"
            onAction={() => router.push('/dossier/nouveau')}
          />
        ) : (
          <View style={styles.list}>
            {recent.map((dossier) => (
              <DossierCard key={dossier.id} dossier={dossier} onPress={() => router.push(`/dossier/${dossier.id}`)} />
            ))}
          </View>
        )}
      </View>

      {(activity.data ?? []).length > 0 ? (
        <View style={styles.block}>
          <SectionHeader title="Activité" caption="Ce qui a changé récemment" />
          <Card>
            <View style={styles.list}>
              {(activity.data ?? []).map((event) => (
                <Pressable
                  key={event.id}
                  onPress={() => router.push(`/dossier/${event.dossier_id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={`${event.label}, ${formatRelative(event.created_at)}`}
                  style={styles.activityRow}
                >
                  <View style={styles.dot} />
                  <Text variant="small" style={styles.flex} numberOfLines={2}>
                    {event.label}
                  </Text>
                  <Text variant="caption" tone="muted">
                    {formatRelative(event.created_at)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>
        </View>
      ) : null}

      <View style={styles.block}>
        <Card tone="muted">
          <View style={styles.noteRow}>
            <Icon name="shield" size={18} color={colors.accentStrong} />
            <Text variant="caption" tone="secondary" style={styles.flex}>
              Vos pièces restent dans un espace privé, isolé par compte. ClairDossier ne procède à aucune lecture
              ni exploitation automatique de vos documents.
            </Text>
          </View>
        </Card>
      </View>
    </Screen>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceMuted }]}
    >
      <Icon name={icon} size={22} color={colors.surfaceInverse} />
      <Text variant="caption" tone="secondary" center numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.md },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  block: { marginTop: spacing.xxl, gap: spacing.md },
  list: { gap: spacing.sm },
  activityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xs },
  dot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.accent },
  flex: { flex: 1 },
  noteRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
});
