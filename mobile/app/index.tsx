/**
 * Aiguillage de démarrage : onboarding → connexion → application.
 * Aucun écran n'est affiché tant que l'état de session n'est pas connu, pour
 * éviter le clignotement « connecté / déconnecté » au lancement.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { loadPrefs } from '../src/lib/storage';
import { colors } from '../src/theme/tokens';

export default function Index() {
  const { loading, session } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    loadPrefs()
      .then((p) => setOnboarded(p.onboardingDone))
      .catch(() => setOnboarded(true));
  }, []);

  if (loading || onboarded === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.surfaceInverse} />
      </View>
    );
  }

  if (!onboarded) return <Redirect href="/onboarding" />;
  if (!session) return <Redirect href="/connexion" />;
  return <Redirect href="/(app)" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
});
