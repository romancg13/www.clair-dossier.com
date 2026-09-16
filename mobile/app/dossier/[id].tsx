/**
 * Dossier — résumé, pièces, échéances, activité, transmission.
 *
 * Tout ce qui est affiché vient du dossier lui-même : aucune interprétation,
 * aucun résumé généré. Le classement des pièces suit la règle déterministe
 * partagée avec le site (nom de fichier), corrigeable d'un appui long.
 */
import { useCallback, useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  CATEGORY_LABELS,
  PIECE_CATEGORIES,
  STEP_MESSAGES,
  STEP_NEXT_ACTIONS,
  TIMELINE_STEPS,
  answerLabel,
  currentStep,
  dossierDisplayTitle,
  effectiveCategory,
  groupByCategory,
  isDateKey,
  matchesQuery,
  statusLabel,
  typologyLabel,
  userMessage,
  type Deadline,
  type DossierDocument,
} from '@clairdossier/core';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { Segmented } from '../../src/features/Segmented';
import { DocumentItem } from '../../src/features/DocumentItem';
import { DeadlineItem } from '../../src/features/DeadlineItem';
import { DeadlineSheet } from '../../src/features/DeadlineSheet';
import { ImportProgress } from '../../src/features/ImportProgress';
import { useImport } from '../../src/features/useImport';
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  ListRow,
  Screen,
  SectionHeader,
  Sheet,
  SkeletonList,
  Text,
} from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { useDossier, useRenameDossier, useUpdateDossierStatus, logDossierEvent } from '../../src/data/dossiers';
import {
  useDeleteDocumentForever,
  useDocuments,
  useReclassifyDocument,
  useRenameDocument,
  useRestoreDocument,
  useTrashDocument,
} from '../../src/data/documents';
import { useDeadlines, useDeleteDeadline, useSaveDeadline, useToggleDeadline } from '../../src/data/deadlines';
import { useEvents } from '../../src/data/events';
import { openDocument, pickDocuments, pickFromLibrary, shareDocument } from '../../src/lib/files';
import { buildSynthesis, transmitByEmail, transmitByWhatsApp } from '../../src/lib/transmission';
import { formatDate, formatRelative } from '../../src/lib/format';
import { colors, radius, spacing } from '../../src/theme/tokens';

type Tab = 'resume' | 'pieces' | 'echeances' | 'activite';

export default function DossierDetail() {
  const router = useRouter();
  const qc = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const dossierId = String(id);
  const { user } = useAuth();
  const userId = user?.id ?? '';

  const dossier = useDossier(dossierId, userId);
  const documents = useDocuments(dossierId, userId);
  const deadlines = useDeadlines(dossierId, userId);
  const events = useEvents(dossierId, userId);

  const rename = useRenameDossier(userId);
  const updateStatus = useUpdateDossierStatus(userId);
  const renameDoc = useRenameDocument(dossierId, userId);
  const reclassify = useReclassifyDocument(dossierId, userId);
  const trashDoc = useTrashDocument(dossierId, userId);
  const restoreDoc = useRestoreDocument(dossierId, userId);
  const deleteDoc = useDeleteDocumentForever(dossierId, userId);
  const saveDeadline = useSaveDeadline(userId);
  const toggleDeadline = useToggleDeadline(userId);
  const deleteDeadline = useDeleteDeadline(userId);
  const importer = useImport(userId);

  const [tab, setTab] = useState<Tab>('resume');
  const [query, setQuery] = useState('');
  const [showTrash, setShowTrash] = useState(false);
  const [actionDoc, setActionDoc] = useState<DossierDocument | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ kind: 'dossier' | 'document'; value: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [categorySheet, setCategorySheet] = useState(false);
  const [deadlineSheet, setDeadlineSheet] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState<Deadline | null>(null);
  const [transmitSheet, setTransmitSheet] = useState(false);

  const allDocs = documents.data ?? [];
  const activeDocs = useMemo(() => allDocs.filter((d) => !d.deleted_at), [allDocs]);
  const trashedDocs = useMemo(() => allDocs.filter((d) => d.deleted_at), [allDocs]);
  const visibleDocs = useMemo(() => {
    const base = showTrash ? trashedDocs : activeDocs;
    if (!query.trim()) return base;
    return base.filter((d) =>
      matchesQuery([d.file_name, CATEGORY_LABELS[effectiveCategory(d.file_name, d.category)]], query),
    );
  }, [activeDocs, trashedDocs, showTrash, query]);
  const grouped = useMemo(() => groupByCategory(visibleDocs), [visibleDocs]);

  const refresh = useCallback(() => {
    void qc.invalidateQueries();
  }, [qc]);

  const addFiles = async (source: 'photos' | 'fichiers') => {
    try {
      const files = source === 'photos' ? await pickFromLibrary() : await pickDocuments();
      if (!files.length) return;
      await importer.run(files, dossierId, {
        onDuplicate: (warning) =>
          new Promise<boolean>((resolve) => {
            Alert.alert('Pièce déjà présente ?', warning, [
              { text: 'Ne pas importer', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Importer quand même', onPress: () => resolve(true) },
            ]);
          }),
      });
    } catch {
      Alert.alert('Import impossible', "L'accès aux fichiers n'a pas abouti. Réessayez.");
    }
  };

  const confirmTrash = (doc: DossierDocument) => {
    setActionDoc(null);
    Alert.alert(
      'Mettre à la corbeille ?',
      `« ${doc.file_name} » sera retirée du dossier. Vous pourrez la restaurer.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Mettre à la corbeille', style: 'destructive', onPress: () => trashDoc.mutate(doc) },
      ],
    );
  };

  const confirmDelete = (doc: DossierDocument) => {
    setActionDoc(null);
    Alert.alert(
      'Supprimer définitivement ?',
      `« ${doc.file_name} » sera effacée. Cette action est irréversible.`,
      [
        { text: 'Annuler', style: 'cancel' },
        { text: 'Supprimer', style: 'destructive', onPress: () => deleteDoc.mutate(doc) },
      ],
    );
  };

  const transmit = async (method: 'whatsapp' | 'email') => {
    if (!dossier.data) return;
    const message = buildSynthesis(dossier.data, activeDocs.length, user?.email);
    const ok =
      method === 'whatsapp'
        ? await transmitByWhatsApp(message)
        : await transmitByEmail(`Dossier ${typologyLabel(dossier.data.typology)}`, message);
    setTransmitSheet(false);
    if (!ok) {
      Alert.alert('Envoi impossible', "Aucune application compatible n'a pu être ouverte sur cet appareil.");
      return;
    }
    await logDossierEvent(dossierId, userId, 'dossier_transmis', method === 'whatsapp' ? 'WhatsApp' : 'E-mail');
    // Le statut ne passe à « Transmis » qu'après une action réelle de l'utilisateur.
    if (dossier.data.status === 'brouillon') {
      updateStatus.mutate({ id: dossierId, status: 'transmis' });
    }
  };

  if (dossier.isPending) {
    return (
      <Screen>
        <ScreenHeader title="Dossier" onBack={() => router.back()} />
        <SkeletonList rows={4} />
      </Screen>
    );
  }

  if (dossier.isError || !dossier.data) {
    return (
      <Screen>
        <ScreenHeader title="Dossier" onBack={() => router.back()} />
        <ErrorState message={userMessage(dossier.error, 'Ce dossier est introuvable.')} onRetry={() => void dossier.refetch()} />
      </Screen>
    );
  }

  const data = dossier.data;
  const step = currentStep(data.status);
  const answers = Object.entries(data.answers ?? {}).filter(([key]) => key !== 'profil');

  return (
    <Screen refreshing={documents.isRefetching} onRefresh={refresh}>
      <ScreenHeader
        title={dossierDisplayTitle(data)}
        subtitle={`${typologyLabel(data.typology)} · créé le ${formatDate(data.created_at)}`}
        onBack={() => router.back()}
        right={<Badge label={statusLabel(data.status)} tone={data.status === 'valide' ? 'success' : 'accent'} />}
      />

      <Segmented
        value={tab}
        onChange={setTab}
        options={[
          { id: 'resume', label: 'Résumé' },
          { id: 'pieces', label: 'Pièces', count: activeDocs.length },
          { id: 'echeances', label: 'Échéances', count: (deadlines.data ?? []).filter((d) => !d.done).length },
          { id: 'activite', label: 'Activité' },
        ]}
      />

      {tab === 'resume' ? (
        <View style={styles.block}>
          <Card>
            <SectionHeader title={`Étape ${step} sur 5`} caption={TIMELINE_STEPS[step - 1]} />
            <View style={styles.steps}>
              {TIMELINE_STEPS.map((label, i) => (
                <View key={label} style={[styles.stepDot, i < step && styles.stepDotDone]} accessibilityLabel={`Étape ${i + 1} : ${label}`} />
              ))}
            </View>
            <Text variant="small" tone="secondary" style={styles.spaced}>
              {STEP_MESSAGES[step]}
            </Text>
            <Banner tone="info" title="Prochaine action" message={STEP_NEXT_ACTIONS[step] ?? ''} />
          </Card>

          <Card>
            <SectionHeader title="Informations" actionLabel="Renommer" onAction={() => {
              setRenameTarget({ kind: 'dossier', value: data.title ?? '' });
              setRenameValue(data.title ?? '');
            }} />
            <View style={styles.rows}>
              {answers.length === 0 ? (
                <Text variant="small" tone="muted">
                  Aucune information renseignée à la création.
                </Text>
              ) : (
                answers.map(([key, value]) => (
                  <View key={key} style={styles.infoRow}>
                    <Text variant="caption" tone="muted">
                      {answerLabel(key)}
                    </Text>
                    <Text variant="small">
                      {isDateKey(key) && value ? formatDate(String(value)) : String(value) || 'Non renseigné'}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </Card>

          <Button label="Transmettre ce dossier" icon="share" onPress={() => setTransmitSheet(true)} />
          <Text variant="caption" tone="muted" center>
            Rien n'est envoyé automatiquement : vous relisez la synthèse avant tout envoi.
          </Text>
        </View>
      ) : null}

      {tab === 'pieces' ? (
        <View style={styles.block}>
          <View style={styles.actionsRow}>
            <Button label="Scanner" icon="scan" size="sm" fullWidth={false} style={styles.grow} onPress={() => router.push({ pathname: '/scanner', params: { dossierId } })} />
            <Button label="Photos" icon="image" size="sm" variant="secondary" fullWidth={false} style={styles.grow} onPress={() => void addFiles('photos')} />
            <Button label="Fichiers" icon="file" size="sm" variant="secondary" fullWidth={false} style={styles.grow} onPress={() => void addFiles('fichiers')} />
          </View>

          {importer.items.length ? <ImportProgress items={importer.items} /> : null}

          <Input
            label="Rechercher une pièce"
            value={query}
            onChangeText={setQuery}
            placeholder="Nom du fichier, catégorie…"
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />

          {trashedDocs.length > 0 ? (
            <Button
              label={showTrash ? `Revenir aux pièces (${activeDocs.length})` : `Corbeille (${trashedDocs.length})`}
              variant="ghost"
              size="sm"
              icon={showTrash ? 'folder' : 'trash'}
              onPress={() => setShowTrash((v) => !v)}
            />
          ) : null}

          {documents.isPending ? (
            <SkeletonList rows={3} />
          ) : documents.isError ? (
            <ErrorState message={userMessage(documents.error)} onRetry={() => void documents.refetch()} />
          ) : visibleDocs.length === 0 ? (
            <EmptyState
              icon="file"
              title={showTrash ? 'Corbeille vide' : query ? 'Aucun résultat' : 'Aucune pièce'}
              description={showTrash ? undefined : 'Scannez un document ou importez un fichier pour commencer.'}
            />
          ) : (
            grouped.map((group) => (
              <View key={group.id} style={styles.group}>
                <Text variant="overline" tone="muted">
                  {group.label} · {group.items.length}
                </Text>
                <View style={styles.rows}>
                  {group.items.map((doc) => (
                    <DocumentItem
                      key={doc.id}
                      document={doc}
                      onPress={() => void openDocument(doc.file_path).catch(() => Alert.alert('Ouverture impossible', "Le document n'a pas pu être ouvert. Réessayez."))}
                      onLongPress={() => setActionDoc(doc)}
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      ) : null}

      {tab === 'echeances' ? (
        <View style={styles.block}>
          <Button
            label="Ajouter une échéance"
            icon="plus"
            onPress={() => {
              setEditingDeadline(null);
              setDeadlineSheet(true);
            }}
          />
          {deadlines.isPending ? (
            <SkeletonList rows={2} />
          ) : (deadlines.data ?? []).length === 0 ? (
            <EmptyState
              icon="calendar"
              title="Aucune échéance"
              description="Notez les dates qui comptent : paiement attendu, réponse à donner, fin de contrat."
            />
          ) : (
            <View style={styles.rows}>
              {(deadlines.data ?? []).map((deadline) => (
                <DeadlineItem
                  key={deadline.id}
                  deadline={deadline}
                  onToggle={() => toggleDeadline.mutate(deadline)}
                  onPress={() => {
                    setEditingDeadline(deadline);
                    setDeadlineSheet(true);
                  }}
                />
              ))}
            </View>
          )}
        </View>
      ) : null}

      {tab === 'activite' ? (
        <View style={styles.block}>
          {events.isPending ? (
            <SkeletonList rows={3} />
          ) : (events.data ?? []).length === 0 ? (
            <EmptyState icon="clock" title="Aucune activité" description="Les actions sur ce dossier apparaîtront ici." />
          ) : (
            <Card>
              <View style={styles.rows}>
                {(events.data ?? []).map((event) => (
                  <View key={event.id} style={styles.eventRow}>
                    <View style={styles.dot} />
                    <Text variant="small" style={styles.grow} numberOfLines={2}>
                      {event.label}
                    </Text>
                    <Text variant="caption" tone="muted">
                      {formatRelative(event.created_at)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}
        </View>
      ) : null}

      {/* ── Actions sur une pièce ── */}
      <Sheet visible={!!actionDoc} title={actionDoc?.file_name ?? ''} onClose={() => setActionDoc(null)}>
        {actionDoc ? (
          <View style={styles.rows}>
            {!actionDoc.deleted_at ? (
              <>
                <ListRow title="Ouvrir" icon="file" onPress={() => { const d = actionDoc; setActionDoc(null); void openDocument(d.file_path); }} />
                <ListRow title="Partager / enregistrer" icon="share" onPress={() => { const d = actionDoc; setActionDoc(null); void shareDocument(d.file_path, d.file_name).catch(() => Alert.alert('Partage impossible', "Le document n'a pas pu être préparé. Réessayez.")); }} />
                <ListRow title="Renommer" icon="edit" onPress={() => { setRenameTarget({ kind: 'document', value: actionDoc.id }); setRenameValue(actionDoc.file_name); }} />
                <ListRow title="Changer de catégorie" icon="filter" onPress={() => setCategorySheet(true)} />
                <ListRow title="Mettre à la corbeille" icon="trash" danger onPress={() => confirmTrash(actionDoc)} />
              </>
            ) : (
              <>
                <ListRow title="Restaurer" icon="restore" onPress={() => { const d = actionDoc; setActionDoc(null); restoreDoc.mutate(d); }} />
                <ListRow title="Supprimer définitivement" icon="trash" danger onPress={() => confirmDelete(actionDoc)} />
              </>
            )}
          </View>
        ) : null}
      </Sheet>

      {/* ── Catégorie ── */}
      <Sheet visible={categorySheet} title="Catégorie de la pièce" onClose={() => setCategorySheet(false)}>
        <View style={styles.rows}>
          {PIECE_CATEGORIES.map((category) => (
            <ListRow
              key={category.id}
              title={category.label}
              icon={actionDoc && effectiveCategory(actionDoc.file_name, actionDoc.category) === category.id ? 'check' : 'folder'}
              onPress={() => {
                if (!actionDoc) return;
                reclassify.mutate({ id: actionDoc.id, category: category.id, label: actionDoc.file_name });
                setCategorySheet(false);
                setActionDoc(null);
              }}
            />
          ))}
        </View>
      </Sheet>

      {/* ── Renommage ── */}
      <Sheet
        visible={!!renameTarget}
        title={renameTarget?.kind === 'dossier' ? 'Renommer le dossier' : 'Renommer la pièce'}
        onClose={() => setRenameTarget(null)}
        footer={
          <Button
            label="Enregistrer"
            onPress={() => {
              if (!renameTarget || !renameValue.trim()) return;
              if (renameTarget.kind === 'dossier') rename.mutate({ id: dossierId, title: renameValue });
              else renameDoc.mutate({ id: renameTarget.value, fileName: renameValue });
              setRenameTarget(null);
              setActionDoc(null);
            }}
            loading={rename.isPending || renameDoc.isPending}
          />
        }
      >
        <Input
          label={renameTarget?.kind === 'dossier' ? 'Nom du dossier' : 'Nom du fichier'}
          value={renameValue}
          onChangeText={setRenameValue}
          autoFocus
          help={renameTarget?.kind === 'dossier' ? 'Un nom parlant vous fera gagner du temps plus tard.' : undefined}
        />
      </Sheet>

      {/* ── Échéance ── */}
      <DeadlineSheet
        visible={deadlineSheet}
        deadline={editingDeadline}
        saving={saveDeadline.isPending}
        onClose={() => setDeadlineSheet(false)}
        onSave={(input) => {
          saveDeadline.mutate(
            {
              id: input.id,
              dossierId,
              title: input.title,
              description: input.description,
              dueDate: input.dueDate,
              dueTime: input.dueTime,
              priority: input.priority,
            },
            { onSuccess: () => setDeadlineSheet(false) },
          );
        }}
        onDelete={
          editingDeadline
            ? () => {
                const target = editingDeadline;
                setDeadlineSheet(false);
                Alert.alert('Supprimer cette échéance ?', target.title, [
                  { text: 'Annuler', style: 'cancel' },
                  { text: 'Supprimer', style: 'destructive', onPress: () => deleteDeadline.mutate(target) },
                ]);
              }
            : undefined
        }
      />

      {/* ── Transmission ── */}
      <Sheet visible={transmitSheet} title="Transmettre le dossier" onClose={() => setTransmitSheet(false)}>
        <Banner
          tone="info"
          message="Vous allez ouvrir votre application de messagerie avec une synthèse pré-remplie. Rien n'est envoyé tant que vous ne validez pas l'envoi vous-même."
        />
        <Card tone="muted">
          <Text variant="caption" tone="secondary">
            {dossier.data ? buildSynthesis(dossier.data, activeDocs.length, user?.email) : ''}
          </Text>
        </Card>
        <View style={styles.rows}>
          <Button label="Par WhatsApp" icon="whatsapp" onPress={() => void transmit('whatsapp')} />
          <Button label="Par e-mail" icon="mail" variant="secondary" onPress={() => void transmit('email')} />
        </View>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: spacing.lg, gap: spacing.md },
  rows: { gap: spacing.sm, marginTop: spacing.sm },
  group: { gap: spacing.xs, marginTop: spacing.md },
  spaced: { marginTop: spacing.md, marginBottom: spacing.md },
  steps: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.md },
  stepDot: { flex: 1, height: 4, borderRadius: radius.full, backgroundColor: colors.border },
  stepDotDone: { backgroundColor: colors.accent },
  infoRow: { gap: 2, paddingVertical: spacing.xs, borderBottomWidth: 1, borderBottomColor: colors.border },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  grow: { flex: 1 },
  eventRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 6, height: 6, borderRadius: radius.full, backgroundColor: colors.accent },
});
