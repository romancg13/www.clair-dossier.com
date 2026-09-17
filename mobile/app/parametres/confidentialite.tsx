/**
 * Mes données — information claire et actions concrètes (RGPD, §29).
 * Aucune affirmation de conformité n'est inventée ici : on décrit ce que
 * l'application fait techniquement et on renvoie aux documents officiels.
 */
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { Button, Card, ListRow, Screen, SectionHeader, Text } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { requestDataExport } from '../../src/lib/account';
import { openWeb } from '../../src/lib/links';
import { WEB_LINKS } from '../../src/lib/config';
import { spacing } from '../../src/theme/tokens';

const FACTS = [
  "Vos pièces sont stockées dans un espace privé ; l'isolation par compte est appliquée en base de données.",
  "L'application ne conserve sur l'appareil que votre session (dans le magasin sécurisé du système) et vos préférences.",
  'Aucune pièce téléchargée pour être consultée ou partagée ne reste sur votre appareil : la copie est effacée après usage.',
  "Aucune lecture ni exploitation automatique de vos documents n'est effectuée (engagement contractuel).",
  "Aucun traceur publicitaire, aucune mesure d'audience tierce dans l'application.",
];

export default function Confidentialite() {
  const router = useRouter();
  const { user } = useAuth();

  return (
    <Screen>
      <ScreenHeader title="Mes données" onBack={() => router.back()} />

      <Card>
        <SectionHeader title="Ce que fait l'application" />
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          {FACTS.map((fact) => (
            <Text key={fact} variant="small" tone="secondary">
              • {fact}
            </Text>
          ))}
        </View>
      </Card>

      <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
        <SectionHeader title="Exercer vos droits" caption="Accès, rectification, effacement, portabilité." />
        <Card padded={false}>
          <ListRow
            title="Demander l'export de mes données"
            subtitle="Dossiers, pièces, échéances, journal d'activité"
            icon="download"
            onPress={() => void requestDataExport(user?.email)}
          />
          <ListRow
            title="Supprimer mon compte"
            subtitle="Suppression définitive du compte et des données"
            icon="trash"
            danger
            onPress={() => router.push('/parametres/supprimer')}
          />
        </Card>
        <Button label="Politique de confidentialité" variant="secondary" icon="file" onPress={() => void openWeb(WEB_LINKS.privacy)} />
        <Button label="Sécurité et hébergement" variant="secondary" icon="lock" onPress={() => void openWeb(WEB_LINKS.security)} />
      </View>
    </Screen>
  );
}
