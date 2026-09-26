/** Écran de verrouillage local — masque l'application tant que l'utilisateur
 *  ne s'est pas authentifié avec la biométrie ou le code de l'appareil. */
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { Button, Text } from '../ui';
import { useAppLock } from '../lib/app-lock';
import { colors, radius, spacing } from '../theme/tokens';

export function LockScreen() {
  const { unlock } = useAppLock();
  const [failed, setFailed] = useState(false);

  const attempt = async () => {
    const ok = await unlock();
    setFailed(!ok);
  };

  useEffect(() => {
    void attempt();
    // Une seule tentative automatique à l'affichage ; ensuite l'utilisateur agit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.root} accessibilityViewIsModal accessibilityLabel="Application verrouillée">
      <Image source={require('../../assets/splash-icon.png')} style={styles.logo} contentFit="contain" />
      <Text variant="title" center>
        ClairDossier est verrouillé
      </Text>
      <Text variant="small" tone="secondary" center style={styles.help}>
        {failed
          ? "L'authentification n'a pas abouti. Réessayez pour accéder à vos dossiers."
          : 'Authentifiez-vous pour retrouver vos dossiers sur cet appareil.'}
      </Text>
      <Button label="Déverrouiller" icon="fingerprint" onPress={attempt} fullWidth={false} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingHorizontal: spacing.xxl,
  },
  logo: { width: 76, height: 76, borderRadius: radius.md },
  help: { maxWidth: 320 },
});
