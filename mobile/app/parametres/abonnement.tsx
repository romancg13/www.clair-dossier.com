/**
 * Abonnement — état lu depuis le serveur, jamais déduit par l'application.
 *
 * Aucun achat n'est proposé ici. Les règles des magasins d'applications
 * encadrent strictement la vente d'abonnements numériques dans une app
 * (achat intégré obligatoire sur la plupart des marchés, exceptions et
 * modalités variables selon le pays et la date) : ouvrir ce sujet demande une
 * décision produit et juridique, pas une initiative technique. L'application
 * se limite donc à afficher l'état transmis par le serveur et à renvoyer vers
 * l'assistance.
 */
import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { PLAN_LABELS, subscriptionSummary } from '@clairdossier/core';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { Banner, Button, Card, Screen, SectionHeader, Text } from '../../src/ui';
import { useAuth } from '../../src/lib/auth';
import { useEntitlements } from '../../src/data/entitlements';
import { openExternal } from '../../src/lib/links';
import { SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY } from '../../src/lib/config';
import { formatDate } from '../../src/lib/format';
import { spacing } from '../../src/theme/tokens';

export default function Abonnement() {
  const router = useRouter();
  const { user } = useAuth();
  const { data } = useEntitlements(user?.id);
  const state = data ?? { kind: 'unknown' as const, reason: 'not-published' as const };

  return (
    <Screen>
      <ScreenHeader title="Abonnement" onBack={() => router.back()} />

      <Card>
        <SectionHeader title="Votre formule" />
        <Text variant="body" style={{ marginTop: spacing.sm }}>
          {subscriptionSummary(state)}
        </Text>
        {state.kind === 'known' ? (
          <View style={{ marginTop: spacing.md, gap: spacing.xs }}>
            <Text variant="small" tone="secondary">
              Formule : {PLAN_LABELS[state.entitlements.plan]}
            </Text>
            {state.entitlements.current_period_end ? (
              <Text variant="small" tone="secondary">
                Période en cours jusqu'au {formatDate(state.entitlements.current_period_end)}
              </Text>
            ) : null}
            {state.entitlements.limits?.dossiers != null ? (
              <Text variant="small" tone="secondary">
                Dossiers inclus : {state.entitlements.limits.dossiers}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Card>

      <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
        <Banner
          tone="info"
          message="Les abonnements ne sont pas gérés dans l'application. Pour souscrire, changer de formule ou résilier, contactez l'assistance : c'est elle qui met votre espace à jour."
        />
        <Button
          label={`Appeler l'assistance — ${SUPPORT_PHONE_DISPLAY}`}
          variant="secondary"
          icon="phone"
          onPress={() => void openExternal(`tel:${SUPPORT_PHONE}`)}
        />
        <Button
          label="Écrire à l'assistance"
          variant="secondary"
          icon="mail"
          onPress={() =>
            void openExternal(
              `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Mon abonnement ClairDossier')}`,
            )
          }
        />
      </View>
    </Screen>
  );
}
