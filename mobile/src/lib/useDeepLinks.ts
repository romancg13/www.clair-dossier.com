/**
 * Prise en charge des liens profonds et des notifications.
 *
 * Les URL du site (`/compte/dossier/:id`) ne portent pas les mêmes chemins que
 * les routes de l'application : la correspondance est explicite (links.ts) et
 * toute URL non reconnue est ignorée — jamais de navigation devinée.
 */
import { useEffect, useRef } from 'react';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { routeForNotificationData, routeForUrl } from './links';
import { log } from './logger';

export function useDeepLinks(ready: boolean, authenticated: boolean): void {
  const router = useRouter();
  const pending = useRef<string | null>(null);

  // Mémorise la destination tant que l'application n'est pas prête ou que
  // l'utilisateur n'est pas connecté (on ouvre alors la connexion d'abord).
  useEffect(() => {
    let alive = true;

    const go = (route: string | null) => {
      if (!route) return;
      if (!ready || !authenticated) {
        pending.current = route;
        return;
      }
      log.info('deeplink.open');
      router.push(route as never);
    };

    Linking.getInitialURL()
      .then((url) => alive && url && go(routeForUrl(url)))
      .catch(() => {});

    const linkSub = Linking.addEventListener('url', ({ url }) => go(routeForUrl(url)));

    const notifSub = Notifications.addNotificationResponseReceivedListener((response) => {
      go(routeForNotificationData(response.notification.request.content.data));
    });

    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (alive && response) go(routeForNotificationData(response.notification.request.content.data));
      })
      .catch(() => {});

    return () => {
      alive = false;
      linkSub.remove();
      notifSub.remove();
    };
  }, [ready, authenticated, router]);

  // Rejoue la destination en attente dès que c'est possible.
  useEffect(() => {
    if (ready && authenticated && pending.current) {
      const route = pending.current;
      pending.current = null;
      router.push(route as never);
    }
  }, [ready, authenticated, router]);
}
