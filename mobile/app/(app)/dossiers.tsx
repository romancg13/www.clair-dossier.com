/**
 * Dossiers — liste complète, recherche instantanée et filtres par statut.
 * Liste virtualisée : l'écran reste fluide quel que soit le nombre de dossiers.
 */
import { useDeferredValue, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  STATUS_LABELS,
  matchesQuery,
  typologyLabel,
  userMessage,
} from '@clairdossier/core';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { DossierCard } from '../../src/features/DossierCard';
import { Button, EmptyState, ErrorState, Input, SkeletonList, Text } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { useDossiers } from '../../src/data/dossiers';
import { colors, radius, spacing } from '../../src/theme/tokens';
import { Pressable, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FILTERS: { id: string; label: string }[] = [
  { id: 'tous', label: 'Tous' },
  ...Object.entries(STATUS_LABELS).map(([id, label]) => ({ id, label })),
];

export default function Dossiers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { data, isPending, isError, error, refetch, isRefetching } = useDossiers(user?.id);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('tous');
  const deferred = useDeferredValue(query);

  const filtered = useMemo(() => {
    const list = data ?? [];
    return list.filter((d) => {
      if (status !== 'tous' && d.status !== status) return false;
      return matchesQuery([d.title, typologyLabel(d.typology)], deferred);
    });
  }, [data, deferred, status]);

  return (
    <View style={styles.root}>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.content, { paddingBottom: spacing.huge + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.accentStrong} />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <ScreenHeader
              title="Dossiers"
              subtitle={data?.length ? `${data.length} dossier${data.length > 1 ? 's' : ''}` : undefined}
            />
            <Input
              label="Rechercher"
              value={query}
              onChangeText={setQuery}
              placeholder="Nom du dossier, type…"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="search"
              clearButtonMode="while-editing"
            />
            <View style={styles.filters}>
              {FILTERS.map((f) => {
                const active = f.id === status;
                return (
                  <Pressable
                    key={f.id}
                    onPress={() => setStatus(f.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`Filtrer : ${f.label}`}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text variant="caption" tone={active ? 'inverse' : 'secondary'}>
                      {f.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        }
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        renderItem={({ item }) => (
          <DossierCard dossier={item} onPress={() => router.push(`/dossier/${item.id}`)} />
        )}
        ListEmptyComponent={
          isPending ? (
            <SkeletonList rows={4} />
          ) : isError ? (
            <ErrorState message={userMessage(error)} onRetry={() => void refetch()} />
          ) : (data ?? []).length === 0 ? (
            <EmptyState
              title="Aucun dossier"
              description="Un dossier réunit les pièces, les échéances et le suivi d'une même affaire."
              actionLabel="Créer un dossier"
              onAction={() => router.push('/dossier/nouveau')}
            />
          ) : (
            <EmptyState
              icon="search"
              title="Aucun résultat"
              description="Modifiez votre recherche ou changez de filtre."
            />
          )
        }
      />

      <View style={[styles.fabWrap, { bottom: spacing.lg + insets.bottom }]} pointerEvents="box-none">
        <Button
          label="Nouveau dossier"
          icon="plus"
          fullWidth={false}
          onPress={() => router.push('/dossier/nouveau')}
          style={styles.fab}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg },
  header: { gap: spacing.lg, paddingBottom: spacing.lg },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipActive: { backgroundColor: colors.surfaceInverse, borderColor: colors.surfaceInverse },
  fabWrap: { position: 'absolute', right: spacing.lg, alignItems: 'flex-end' },
  fab: { shadowColor: colors.surfaceInverse, shadowOpacity: 0.25, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
});
