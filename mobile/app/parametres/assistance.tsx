/**
 * Aide et diagnostic — l'utilisateur voit ce que l'application a enregistré
 * sur son fonctionnement (codes d'événements uniquement, aucune donnée
 * personnelle, aucun contenu de document) et peut le joindre à une demande.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '../../src/features/ScreenHeader';
import { Button, Card, Screen, SectionHeader, Text } from '../../src/ui';
import { clearLogs, recentLogs } from '../../src/lib/logger';
import { openExternal, openWeb } from '../../src/lib/links';
import { APP_ENV, APP_VERSION, SUPPORT_EMAIL, SUPPORT_PHONE, SUPPORT_PHONE_DISPLAY, WEB_LINKS } from '../../src/lib/config';
import { Platform } from 'react-native';
import { spacing } from '../../src/theme/tokens';

export default function Assistance() {
  const router = useRouter();
  const [logs, setLogs] = useState(recentLogs());

  const sendDiagnostic = () => {
    const body =
      `Bonjour,\n\nJ'ai besoin d'aide sur l'application ClairDossier.\n\n` +
      `Décrivez votre problème ici.\n\n---\n` +
      `Version : ${APP_VERSION} (${APP_ENV})\nAppareil : ${Platform.OS} ${Platform.Version}\n` +
      `Journal technique :\n${logs
        .slice(0, 15)
        .map((l) => `${l.at} ${l.level} ${l.event}${l.detail ? ` (${l.detail})` : ''}`)
        .join('\n')}\n`;
    void openExternal(
      `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Assistance application ClairDossier')}&body=${encodeURIComponent(body)}`,
    );
  };

  return (
    <Screen>
      <ScreenHeader title="Aide et diagnostic" onBack={() => router.back()} />

      <Card>
        <SectionHeader title="Nous joindre" />
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          <Button
            label={`Appeler — ${SUPPORT_PHONE_DISPLAY}`}
            variant="secondary"
            icon="phone"
            onPress={() => void openExternal(`tel:${SUPPORT_PHONE}`)}
          />
          <Button label="Écrire à l'assistance" variant="secondary" icon="mail" onPress={sendDiagnostic} />
          <Button label="Page contact" variant="ghost" onPress={() => void openWeb(WEB_LINKS.contact)} />
        </View>
      </Card>

      <View style={{ marginTop: spacing.xxl, gap: spacing.md }}>
        <SectionHeader
          title="Journal technique"
          caption="Codes d'événements uniquement — aucun document, aucune donnée personnelle."
          actionLabel="Effacer"
          onAction={() => {
            clearLogs();
            setLogs([]);
          }}
        />
        <Card tone="muted">
          {logs.length === 0 ? (
            <Text variant="small" tone="muted">
              Aucun événement enregistré.
            </Text>
          ) : (
            <View style={{ gap: spacing.xs }}>
              {logs.slice(0, 20).map((entry, i) => (
                <Text key={`${entry.at}-${i}`} variant="caption" tone={entry.level === 'error' ? 'danger' : 'muted'}>
                  {entry.at.slice(11, 19)} · {entry.event}
                  {entry.detail ? ` · ${entry.detail}` : ''}
                </Text>
              ))}
            </View>
          )}
        </Card>
        <Text variant="caption" tone="muted">
          Version {APP_VERSION} · {APP_ENV}
        </Text>
      </View>
    </Screen>
  );
}
