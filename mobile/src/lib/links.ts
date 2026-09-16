/**
 * Liens profonds — §16.
 *
 * Les URL du site continuent de fonctionner : si l'application est installée,
 * `https://www.clair-dossier.com/compte/dossier/<id>` ouvre directement le
 * dossier ; sinon le navigateur affiche la page web (repli natif iOS/Android).
 *
 * Aucune donnée sensible n'est lue dans l'URL : on n'y trouve qu'un
 * identifiant de dossier, déjà protégé par les policies RLS côté serveur.
 */
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { routeForPath } from '@clairdossier/core';
import { colors } from '../theme/tokens';

export { routeForNotificationData } from '@clairdossier/core';

/**
 * Convertit une URL entrante (site ou schéma `clairdossier://`) en route
 * interne. La règle de correspondance est partagée et testée dans
 * packages/core ; ici on ne fait que l'analyse de l'URL.
 */
export function routeForUrl(url: string): string | null {
  try {
    return routeForPath(Linking.parse(url).path ?? '');
  } catch {
    return null;
  }
}

/** Ouvre une page publique du site dans le navigateur intégré. */
export async function openWeb(url: string): Promise<void> {
  await WebBrowser.openBrowserAsync(url, {
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    toolbarColor: colors.background,
    controlsColor: colors.surfaceInverse,
    dismissButtonStyle: 'close',
  });
}

/** Ouvre une application externe (téléphone, e-mail, WhatsApp) si disponible. */
export async function openExternal(url: string): Promise<boolean> {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) return false;
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
