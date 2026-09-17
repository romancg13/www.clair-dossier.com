/**
 * Sécurité — mot de passe et verrouillage local.
 * Le verrou biométrique protège l'écran de cet appareil ; il ne remplace pas
 * l'authentification du compte et ne donne accès à aucune donnée hors ligne.
 */
import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { Banner, Button, Card, Input, Screen, SectionHeader, Text } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { biometricsAvailable, useAppLock } from '../../src/lib/app-lock';
import { loadPrefs, savePrefs } from '../../src/lib/storage';
import { colors, spacing } from '../../src/theme/tokens';

export default function Securite() {
  const router = useRouter();
  const { updatePassword } = useAuth();
  const { refreshPrefs } = useAppLock();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [lockOn, setLockOn] = useState(false);
  const [biometrics, setBiometrics] = useState<{ available: boolean; label: string }>({ available: false, label: '' });

  useEffect(() => {
    void loadPrefs().then((p) => setLockOn(p.appLock));
    void biometricsAvailable().then(setBiometrics);
  }, []);

  const toggleLock = async (value: boolean) => {
    setLockOn(value);
    await savePrefs({ appLock: value });
    await refreshPrefs();
  };

  const submit = async () => {
    if (password.length < 6) {
      setMessage({ tone: 'danger', text: 'Le mot de passe doit contenir au moins 6 caractères.' });
      return;
    }
    if (password !== confirm) {
      setMessage({ tone: 'danger', text: 'Les deux mots de passe ne correspondent pas.' });
      return;
    }
    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);
    if (result.error) {
      setMessage({ tone: 'danger', text: result.error });
      return;
    }
    setPassword('');
    setConfirm('');
    setMessage({ tone: 'success', text: 'Mot de passe modifié.' });
  };

  return (
    <Screen>
      <ScreenHeader title="Sécurité" onBack={() => router.back()} />

      <Card>
        <SectionHeader title="Verrouiller l'application" caption={biometrics.available ? biometrics.label : 'Aucune biométrie configurée sur cet appareil'} />
        <View style={styles.switchRow}>
          <Text variant="small" tone="secondary" style={styles.flex}>
            Demander une authentification à la réouverture de l'application, après quelques minutes d'inactivité.
          </Text>
          <Switch
            value={lockOn}
            onValueChange={toggleLock}
            disabled={!biometrics.available}
            accessibilityLabel="Verrouiller l'application"
            trackColor={{ true: colors.accent, false: colors.border }}
          />
        </View>
        {!biometrics.available ? (
          <Text variant="caption" tone="muted">
            Configurez Face ID, une empreinte ou un code dans les réglages de votre appareil pour activer cette option.
          </Text>
        ) : null}
      </Card>

      <View style={styles.block}>
        <SectionHeader title="Mot de passe" caption="Il protège votre compte sur tous vos appareils et sur le site." />
        {message ? <Banner tone={message.tone} message={message.text} /> : null}
        <Input label="Nouveau mot de passe" value={password} onChangeText={setPassword} secureTextEntry textContentType="newPassword" help="6 caractères minimum." />
        <Input label="Confirmer" value={confirm} onChangeText={setConfirm} secureTextEntry textContentType="newPassword" />
        <Button label="Modifier le mot de passe" onPress={submit} loading={busy} />
      </View>
    </Screen>
  );
}

const styles = {
  switchRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: spacing.md, marginTop: spacing.sm },
  flex: { flex: 1 },
  block: { marginTop: spacing.xxl, gap: spacing.md },
};
