/** Connexion — mêmes comptes que le site : aucun compte à recréer (§49). */
import { useState } from 'react';
import { View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthShell } from '../../src/features/AuthShell';
import { Banner, Button, Input, Text } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { spacing } from '../../src/theme/tokens';

export default function Connexion() {
  const router = useRouter();
  const { signIn, configured } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) {
      setError('Renseignez votre email et votre mot de passe.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.replace('/(app)');
  };

  return (
    <AuthShell
      title="Connexion"
      subtitle="Retrouvez vos dossiers, vos pièces et vos échéances."
      footer={
        <View style={{ gap: spacing.sm }}>
          <Link href="/mot-de-passe-oublie" asChild>
            <Text variant="smallStrong" tone="accent" accessibilityRole="link">
              Mot de passe oublié ?
            </Text>
          </Link>
          <Link href="/inscription" asChild>
            <Text variant="small" tone="secondary" accessibilityRole="link">
              Pas encore de compte ? Créer un compte gratuit
            </Text>
          </Link>
        </View>
      }
    >
      {!configured ? (
        <Banner
          tone="danger"
          title="Service indisponible"
          message="La connexion au service n'est pas configurée sur cette version de l'application."
        />
      ) : null}
      {error ? <Banner tone="danger" message={error} /> : null}

      <Input
        label="Adresse email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        placeholder="vous@exemple.fr"
      />
      <Input
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
        placeholder="••••••••"
      />
      <Button label="Se connecter" onPress={submit} loading={busy} disabled={!configured} />
    </AuthShell>
  );
}
