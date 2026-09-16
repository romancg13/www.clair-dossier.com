/** Création / modification d'une échéance. */
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { isISODate, isTimeOfDay, toISODate, type Deadline, type DeadlinePriority } from '@clairdossier/core';
import { Banner, Button, Input, Sheet } from '../ui';
import { ChoiceGroup } from './ChoiceGroup';
import { spacing } from '../theme/tokens';

const PRIORITIES = [
  { id: 'haute', label: 'Haute' },
  { id: 'normale', label: 'Normale' },
  { id: 'basse', label: 'Basse' },
];

export function DeadlineSheet({
  visible,
  deadline,
  onClose,
  onSave,
  onDelete,
  saving,
}: {
  visible: boolean;
  deadline: Deadline | null;
  onClose: () => void;
  onSave: (input: { id?: string; title: string; description: string; dueDate: string; dueTime: string; priority: DeadlinePriority }) => void;
  onDelete?: () => void;
  saving?: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState(toISODate(new Date()));
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState<DeadlinePriority>('normale');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(deadline?.title ?? '');
    setDescription(deadline?.description ?? '');
    setDueDate(deadline?.due_date ?? toISODate(new Date()));
    setDueTime(deadline?.due_time?.slice(0, 5) ?? '');
    setPriority(deadline?.priority ?? 'normale');
    setError(null);
  }, [visible, deadline]);

  const submit = () => {
    if (!title.trim()) return setError('Donnez un intitulé à cette échéance.');
    if (!isISODate(dueDate)) return setError('La date doit être au format AAAA-MM-JJ.');
    if (dueTime && !isTimeOfDay(dueTime)) return setError("L'heure doit être au format HH:MM.");
    setError(null);
    onSave({ id: deadline?.id, title, description, dueDate, dueTime, priority });
  };

  return (
    <Sheet
      visible={visible}
      title={deadline ? 'Modifier l’échéance' : 'Nouvelle échéance'}
      onClose={onClose}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Button label="Enregistrer" onPress={submit} loading={saving} />
          {deadline && onDelete ? <Button label="Supprimer" variant="danger" onPress={onDelete} /> : null}
        </View>
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      <Input label="Intitulé" value={title} onChangeText={setTitle} required placeholder="Réponse à donner, paiement attendu…" />
      <Input label="Date" value={dueDate} onChangeText={setDueDate} placeholder="AAAA-MM-JJ" keyboardType="numbers-and-punctuation" required help="Format : 2026-10-15" />
      <Input label="Heure" value={dueTime} onChangeText={setDueTime} placeholder="HH:MM" keyboardType="numbers-and-punctuation" help="Facultatif." />
      <ChoiceGroup label="Priorité" options={PRIORITIES} value={priority} onChange={(id) => setPriority(id as DeadlinePriority)} />
      <Input label="Note" value={description} onChangeText={setDescription} multiline help="Facultatif — le contexte utile le jour venu." />
    </Sheet>
  );
}
