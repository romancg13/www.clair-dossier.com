/**
 * Création de compte — mêmes champs et mêmes métadonnées que le site
 * (`full_name`, `company_name`, `company_type`) : le déclencheur SQL existant
 * crée le profil, sans migration ni schéma parallèle.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthShell } from '../../src/features/AuthShell';
import { Banner, Button, Card, Input, Text } from '../../src/ui';
import { useAuth, type CompanyType } from '../../src/lib/auth';
import { COMPANY_TYPES } from '../../src/data/profile';
import { openWeb } from '../../src/lib/links';
import { WEB_LINKS } from '../../src/lib/config';
import { ChoiceGroup } from '../../src/features/ChoiceGroup';
import { spacing } from '../../src/theme/tokens';

export default function Inscription() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState<CompanyType>('artisan');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      setError('Renseignez un email valide et un mot de passe de 6 caractères minimum.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await signUp(email, password, {
      fullName: fullName.trim() || undefined,
      companyName: companyName.trim() || undefined,
      companyType,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setDone(true);
  };

  if (done) {
    return (
      <AuthShell title="Compte créé" subtitle="Une dernière étape avant de commencer." onBack={() => router.replace('/connexion')}>
        <Card>
          <Text variant="body">
            Vérifiez votre boîte mail : un message de confirmation vient de vous être envoyé. Une fois votre
            adresse confirmée, connectez-vous avec vos identifiants.
          </Text>
        </Card>
        <Button label="Aller à la connexion" onPress={() => router.replace('/connexion')} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Créer un compte"
      subtitle="Gratuit. Vos dossiers restent isolés de tous les autres comptes."
      onBack={() => router.back()}
      footer={
        <View style={{ gap: spacing.sm }}>
          <Text variant="caption" tone="muted">
            En créant un compte, vous acceptez les conditions générales et la politique de confidentialité de
            ClairDossier.
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.lg }}>
            <Text variant="caption" tone="accent" onPress={() => void openWeb(WEB_LINKS.cgv)} accessibilityRole="link">
              Conditions générales
            </Text>
            <Text
              variant="caption"
              tone="accent"
              onPress={() => void openWeb(WEB_LINKS.privacy)}
              accessibilityRole="link"
            >
              Confidentialité
            </Text>
          </View>
          <Text
            variant="small"
            tone="secondary"
            accessibilityRole="link"
            onPress={() => router.replace('/connexion')}
          >
            J'ai déjà un compte
          </Text>
        </View>
      }
    >
      {error ? <Banner tone="danger" message={error} /> : null}

      <Input label="Nom et prénom" value={fullName} onChangeText={setFullName} autoComplete="name" textContentType="name" placeholder="Camille Martin" />
      <Input
        label="Structure"
        value={companyName}
        onChangeText={setCompanyName}
        placeholder="Nom de votre entreprise"
        help="Facultatif : utile pour retrouver vos dossiers."
      />
      <ChoiceGroup
        label="Type d'activité"
        options={COMPANY_TYPES}
        value={companyType}
        onChange={(id) => setCompanyType(id as CompanyType)}
      />
      <Input
        label="Adresse email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        required
        placeholder="vous@exemple.fr"
      />
      <Input
        label="Mot de passe"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        required
        help="6 caractères minimum."
      />
      <Button label="Créer mon compte" onPress={submit} loading={busy} />
    </AuthShell>
  );
}
