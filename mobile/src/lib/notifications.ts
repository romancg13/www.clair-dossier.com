/**
 * Notifications — §15.
 *
 * Deux mécanismes distincts, jamais confondus dans l'interface :
 *
 *  1. RAPPELS LOCAUX (disponibles) : programmés sur l'appareil pour les
 *     échéances que l'utilisateur a lui-même saisies. Rien ne part d'un
 *     serveur, rien n'est envoyé à un tiers, et ils fonctionnent hors ligne.
 *
 *  2. NOTIFICATIONS À DISTANCE (infrastructure prête, émission non activée) :
 *     l'appareil peut enregistrer son jeton pour recevoir des messages, mais
 *     ClairDossier n'émet aujourd'hui aucune notification automatique
 *     (voir /etat-du-produit — « Relances automatiques à échéance : prévu »).
 *     L'interface ne promet donc rien de tel.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { reminderInstant, relativeDueLabel, type Deadline } from '@clairdossier/core';
import { supabase } from './supabase';
import { log } from './logger';

export const DEADLINE_CHANNEL = 'echeances';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DEADLINE_CHANNEL, {
    name: 'Échéances',
    description: 'Rappels des échéances que vous avez enregistrées.',
    importance: Notifications.AndroidImportance.DEFAULT,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    vibrationPattern: [0, 200],
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined';

export async function permissionState(): Promise<PermissionState> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';
  return settings.canAskAgain ? 'undetermined' : 'denied';
}

/** Demande l'autorisation au moment où elle est réellement utile (§31). */
export async function requestPermission(): Promise<boolean> {
  await ensureAndroidChannel();
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: false },
  });
  return asked.granted;
}

/* ── 1. Rappels locaux ───────────────────────────────────────────────────── */

const REMINDER_PREFIX = 'echeance:';

/** Annule tous les rappels d'échéance programmés par l'application. */
export async function cancelAllReminders(): Promise<void> {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((n) => typeof n.identifier === 'string' && n.identifier.startsWith(REMINDER_PREFIX))
      .map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)),
  );
}

/**
 * Reprogramme l'ensemble des rappels locaux à partir des échéances ouvertes.
 * Idempotent : on annule tout, puis on replanifie — pas de doublon possible.
 */
export async function rescheduleReminders(
  deadlines: Deadline[],
  offsets: number[],
  enabled: boolean,
): Promise<number> {
  await cancelAllReminders();
  if (!enabled) return 0;
  if (!(await permissionState().then((s) => s === 'granted'))) return 0;
  await ensureAndroidChannel();

  let count = 0;
  for (const deadline of deadlines) {
    if (deadline.done) continue;
    for (const offset of offsets) {
      const at = reminderInstant(deadline.due_date, deadline.due_time, offset);
      if (!at) continue;
      try {
        await Notifications.scheduleNotificationAsync({
          identifier: `${REMINDER_PREFIX}${deadline.id}:${offset}`,
          content: {
            title: deadline.title,
            body: `Échéance ${relativeDueLabel(deadline.due_date, at).toLowerCase()}.`,
            data: { dossierId: deadline.dossier_id },
            sound: false,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: at,
            channelId: DEADLINE_CHANNEL,
          },
        });
        count += 1;
      } catch (error) {
        log.error('reminder.schedule', error);
      }
    }
  }
  log.info('reminder.rescheduled', `count=${count}`);
  return count;
}

/* ── 2. Notifications à distance ─────────────────────────────────────────── */

export type PushRegistration =
  | { status: 'registered'; token: string }
  | { status: 'unavailable'; reason: 'simulateur' | 'projet-expo-absent' | 'permission' | 'erreur' };

/**
 * Enregistre l'appareil pour les notifications à distance.
 * Le jeton est stocké dans `device_push_tokens` (RLS : le propriétaire seul).
 * Si la table n'existe pas encore, l'enregistrement est simplement ignoré.
 */
export async function registerForPush(userId: string): Promise<PushRegistration> {
  if (!Device.isDevice) return { status: 'unavailable', reason: 'simulateur' };
  if (!(await requestPermission())) return { status: 'unavailable', reason: 'permission' };

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
  if (!projectId) return { status: 'unavailable', reason: 'projet-expo-absent' };

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const { error } = await supabase.from('device_push_tokens').upsert(
      {
        user_id: userId,
        token,
        platform: Platform.OS,
        app_version: Constants.expoConfig?.version ?? null,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );
    if (error) {
      log.warn('push.store', 'table absente ou refusée');
      return { status: 'unavailable', reason: 'erreur' };
    }
    return { status: 'registered', token };
  } catch (error) {
    log.error('push.register', error);
    return { status: 'unavailable', reason: 'erreur' };
  }
}

/** Révoque le jeton de CET appareil (déconnexion, retrait du consentement). */
export async function unregisterPush(userId: string): Promise<void> {
  try {
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
    if (!projectId) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await supabase.from('device_push_tokens').delete().eq('user_id', userId).eq('token', token);
  } catch (error) {
    log.error('push.unregister', error);
  }
}
