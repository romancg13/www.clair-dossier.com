/**
 * Notifications — deux mécanismes présentés SÉPARÉMENT et sans promesse :
 *
 *  · Rappels d'échéances sur cet appareil : disponibles, programmés localement.
 *  · Notifications à distance : l'appareil peut s'enregistrer, mais
 *    ClairDossier n'émet aujourd'hui aucune notification automatique
 *    (voir /etat-du-produit). On le dit, on ne le laisse pas deviner.
 */
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { Banner, Button, Card, Screen, SectionHeader, Text } from '../../src/ui';
import { ChoiceGroup } from '../../src/features/ChoiceGroup';
import { useAuth } from '../../src/lib/auth';
import { useAllDeadlines } from '../../src/data/deadlines';
import { loadPrefs, savePrefs } from '../../src/lib/storage';
import {
  permissionState,
  registerForPush,
  requestPermission,
  rescheduleReminders,
  unregisterPush,
  type PermissionState,
} from '../../src/lib/notifications';
import { openWeb } from '../../src/lib/links';
import { WEB_LINKS } from '../../src/lib/config';
import { colors, spacing } from '../../src/theme/tokens';

const OFFSET_CHOICES = [
  { id: '7,1,0', label: '7 j, 1 j, le jour même' },
  { id: '3,0', label: '3 j et le jour même' },
  { id: '1', label: 'La veille' },
  { id: '0', label: 'Le jour même' },
];

export default function NotificationsSettings() {
  const router = useRouter();
  const { user } = useAuth();
  const deadlines = useAllDeadlines(user?.id);
  const [local, setLocal] = useState(false);
  const [offsets, setOffsets] = useState('7,1,0');
  const [push, setPush] = useState(false);
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const [scheduled, setScheduled] = useState<number | null>(null);
  const [pushNote, setPushNote] = useState<string | null>(null);

  useEffect(() => {
    void loadPrefs().then((p) => {
      setLocal(p.localReminders);
      setOffsets(p.reminderOffsets.join(','));
      setPush(p.pushOptIn);
    });
    void permissionState().then(setPermission);
  }, []);

  const applyReminders = async (enabled: boolean, list: string) => {
    const parsed = list.split(',').map(Number).filter((n) => Number.isFinite(n));
    await savePrefs({ localReminders: enabled, reminderOffsets: parsed });
    const count = await rescheduleReminders(deadlines.data ?? [], parsed, enabled);
    setScheduled(enabled ? count : null);
  };

  const toggleLocal = async (value: boolean) => {
    if (value) {
      const granted = await requestPermission();
      setPermission(await permissionState());
      if (!granted) {
        setLocal(false);
        return;
      }
    }
    setLocal(value);
    await applyReminders(value, offsets);
  };

  const changeOffsets = async (id: string) => {
    setOffsets(id);
    if (local) await applyReminders(true, id);
  };

  const togglePush = async (value: boolean) => {
    setPush(value);
    await savePrefs({ pushOptIn: value });
    if (!user) return;
    if (value) {
      const result = await registerForPush(user.id);
      setPushNote(
        result.status === 'registered'
          ? "Cet appareil est enregistré. Aucune notification n'est émise aujourd'hui."
          : result.reason === 'simulateur'
            ? 'Les notifications à distance ne fonctionnent pas sur simulateur.'
            : result.reason === 'permission'
              ? "Autorisez les notifications dans les réglages de l'appareil."
              : "L'enregistrement n'est pas encore disponible sur votre espace.",
      );
    } else {
      await unregisterPush(user.id);
      setPushNote(null);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Notifications" onBack={() => router.back()} />

      <Card>
        <SectionHeader title="Rappels d'échéances" caption="Programmés sur cet appareil, sans passer par nos serveurs." />
        <View style={styles.switchRow}>
          <Text variant="small" tone="secondary" style={styles.flex}>
            Recevoir un rappel avant chaque échéance que vous avez enregistrée.
          </Text>
          <Switch
            value={local}
            onValueChange={toggleLocal}
            accessibilityLabel="Activer les rappels d'échéances"
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        {permission === 'denied' ? (
          <Banner
            tone="warning"
            message="Les notifications sont refusées pour ClairDossier. Autorisez-les dans les réglages de votre appareil."
          />
        ) : null}
        {local ? (
          <View style={styles.block}>
            <ChoiceGroup label="Quand ?" options={OFFSET_CHOICES} value={offsets} onChange={changeOffsets} columns={1} />
            {scheduled !== null ? (
              <Text variant="caption" tone="muted">
                {scheduled} rappel{scheduled > 1 ? 's' : ''} programmé{scheduled > 1 ? 's' : ''} sur cet appareil.
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      <View style={styles.section}>
        <Card>
          <SectionHeader title="Notifications à distance" caption="Infrastructure prête — aucune émission automatique à ce jour." />
          <View style={styles.switchRow}>
            <Text variant="small" tone="secondary" style={styles.flex}>
              Autoriser ClairDossier à enregistrer cet appareil pour de futures notifications (analyse terminée,
              document déposé par l'équipe).
            </Text>
            <Switch
              value={push}
              onValueChange={togglePush}
              accessibilityLabel="Autoriser les notifications à distance"
              trackColor={{ true: colors.accent, false: colors.border }}
            />
          </View>
          {pushNote ? <Text variant="caption" tone="muted">{pushNote}</Text> : null}
          <Button
            label="Ce que fait le produit aujourd'hui"
            variant="ghost"
            size="sm"
            fullWidth={false}
            onPress={() => void openWeb(WEB_LINKS.productStatus)}
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = {
  switchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md, marginTop: spacing.sm },
  flex: { flex: 1 },
  block: { marginTop: spacing.lg, gap: spacing.sm },
  section: { marginTop: spacing.xxl },
};
