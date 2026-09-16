/**
 * Compte — profil, sécurité, notifications, abonnement, confidentialité,
 * assistance, suppression du compte, déconnexion.
 */
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { subscriptionSummary } from '@clairdossier/core';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { Card, ListRow, Screen, SectionHeader, Text } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { useProfile } from '../../src/data/profile';
import { useEntitlements } from '../../src/data/entitlements';
import { openExternal, openWeb } from '../../src/lib/links';
import { APP_VERSION, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY, WEB_LINKS } from '../../src/lib/config';
import { initials } from '../../src/lib/format';
import { colors, radius, spacing } from '../../src/theme/tokens';

export default function Compte() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const profile = useProfile(user?.id);
  const entitlements = useEntitlements(user?.id);

  const displayName = profile.data?.company_name || profile.data?.full_name || 'Votre compte';

  return (
    <Screen>
      <ScreenHeader title="Compte" />

      <Card>
        <View style={styles.identity}>
          <View style={styles.avatar}>
            <Text variant="sectionTitle" tone="inverse">
              {initials(profile.data?.full_name ?? profile.data?.company_name)}
            </Text>
          </View>
          <View style={styles.identityText}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {displayName}
            </Text>
            <Text variant="caption" tone="muted" numberOfLines={1}>
              {user?.email ?? ''}
            </Text>
          </View>
        </View>
      </Card>

      <View style={styles.block}>
        <SectionHeader title="Mon espace" />
        <Card padded={false}>
          <ListRow title="Profil" subtitle="Nom, structure, type d'activité" icon="user" onPress={() => router.push('/parametres/profil')} />
          <ListRow
            title="Abonnement"
            subtitle={subscriptionSummary(entitlements.data ?? { kind: 'unknown', reason: 'not-published' })}
            icon="shield"
            onPress={() => router.push('/parametres/abonnement')}
          />
          <ListRow title="Sécurité" subtitle="Mot de passe, verrouillage de l'application" icon="lock" onPress={() => router.push('/parametres/securite')} />
          <ListRow title="Notifications" subtitle="Rappels d'échéances sur cet appareil" icon="bell" onPress={() => router.push('/parametres/notifications')} />
        </Card>
      </View>

      <View style={styles.block}>
        <SectionHeader title="Confidentialité et données" />
        <Card padded={false}>
          <ListRow title="Mes données" subtitle="Export, suppression, conservation" icon="shield" onPress={() => router.push('/parametres/confidentialite')} />
          <ListRow title="Politique de confidentialité" icon="file" onPress={() => void openWeb(WEB_LINKS.privacy)} />
          <ListRow title="Conditions générales" icon="file" onPress={() => void openWeb(WEB_LINKS.cgv)} />
          <ListRow title="Mentions légales" icon="file" onPress={() => void openWeb(WEB_LINKS.legal)} />
          <ListRow title="Sécurité et hébergement" icon="lock" onPress={() => void openWeb(WEB_LINKS.security)} />
        </Card>
      </View>

      <View style={styles.block}>
        <SectionHeader title="Assistance" />
        <Card padded={false}>
          <ListRow
            title="Service Assistance ClairDossier"
            subtitle={SUPPORT_PHONE_DISPLAY}
            icon="phone"
            onPress={() => void openExternal(`tel:${SUPPORT_PHONE}`)}
          />
          <ListRow title="Aide et diagnostic" icon="help" onPress={() => router.push('/parametres/assistance')} />
          <ListRow title="État du produit" subtitle="Ce qui fonctionne, ce qui est prévu" icon="info" onPress={() => void openWeb(WEB_LINKS.productStatus)} />
        </Card>
      </View>

      <View style={styles.block}>
        <Card padded={false}>
          <ListRow title="Se déconnecter" icon="logout" onPress={() => void signOut()} />
          <ListRow title="Supprimer mon compte" icon="trash" danger onPress={() => router.push('/parametres/supprimer')} />
        </Card>
      </View>

      <Text variant="caption" tone="muted" center style={styles.version}>
        ClairDossier {APP_VERSION}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceInverse,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: 2 },
  block: { marginTop: spacing.xxl, gap: spacing.md },
  version: { marginTop: spacing.xxl },
});
