/**
 * Suppression du compte — exigée par les deux magasins d'applications et par
 * le droit à l'effacement. Confirmation explicite obligatoire ; l'application
 * ne prétend jamais qu'une suppression a eu lieu si le serveur ne l'a pas
 * confirmée.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { Banner, Button, Card, Input, Screen, Text } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import {
  DELETION_CONFIRMATION_WORD,
  deleteAccount,
  isDeletionConfirmed,
  requestDeletionByEmail,
} from '../../src/lib/account';
import { spacing } from '../../src/theme/tokens';

export default function Supprimer() {
  const router = useRouter();
  const { user } = useAuth();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'danger' | 'warning'; text: string } | null>(null);

  const submit = async () => {
    if (!isDeletionConfirmed(confirm)) {
      setNotice({ tone: 'warning', text: `Saisissez « ${DELETION_CONFIRMATION_WORD} » pour confirmer.` });
      return;
    }
    setBusy(true);
    const outcome = await deleteAccount();
    setBusy(false);
    if (outcome.status === 'deleted') {
      router.replace('/connexion');
      return;
    }
    setNotice({ tone: outcome.status === 'unavailable' ? 'warning' : 'danger', text: outcome.message });
  };

  return (
    <Screen>
      <ScreenHeader title="Supprimer mon compte" onBack={() => router.back()} />

      <Card tone="danger">
        <Text variant="bodyStrong" tone="danger">
          Cette action est définitive
        </Text>
        <Text variant="small" tone="secondary" style={{ marginTop: spacing.sm }}>
          Votre compte, vos dossiers, vos pièces déposées, vos échéances et votre journal d'activité sont
          supprimés. Les documents ne pourront pas être récupérés. Si vous avez besoin d'une copie, demandez
          d'abord un export depuis « Mes données ».
        </Text>
      </Card>

      <View style={{ marginTop: spacing.xxl, gap: spacing.lg }}>
        {notice ? <Banner tone={notice.tone} message={notice.text} /> : null}
        <Input
          label={`Tapez « ${DELETION_CONFIRMATION_WORD} » pour confirmer`}
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="characters"
          autoCorrect={false}
        />
        <Button
          label="Supprimer définitivement mon compte"
          variant="danger"
          loading={busy}
          disabled={!isDeletionConfirmed(confirm)}
          onPress={submit}
        />
        <Button
          label="Demander la suppression par e-mail"
          variant="ghost"
          icon="mail"
          onPress={() => void requestDeletionByEmail(user?.email)}
        />
      </View>
    </Screen>
  );
}
