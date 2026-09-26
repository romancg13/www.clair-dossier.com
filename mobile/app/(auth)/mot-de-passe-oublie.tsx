/** Réinitialisation du mot de passe — le lien reçu ouvre le site sécurisé. */
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { AuthShell } from '../../src/features/AuthShell';
import { Banner, Button, Input } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';

export default function MotDePasseOublie() {
  const router = useRouter();
  const { sendPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim()) {
      setError('Renseignez votre adresse email.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await sendPasswordReset(email);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSent(true);
  };

  return (
    <AuthShell
      title="Mot de passe oublié"
      subtitle="Nous vous envoyons un lien de réinitialisation."
      onBack={() => router.back()}
    >
      {error ? <Banner tone="danger" message={error} /> : null}
      {sent ? (
        <Banner
          tone="success"
          title="Message envoyé"
          message="Si un compte existe avec cette adresse, vous recevez un lien de réinitialisation dans quelques instants."
        />
      ) : null}
      <Input
        label="Adresse email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        placeholder="vous@exemple.fr"
      />
      <Button label="Envoyer le lien" onPress={submit} loading={busy} />
      <Button label="Revenir à la connexion" variant="ghost" onPress={() => router.replace('/connexion')} />
    </AuthShell>
  );
}
