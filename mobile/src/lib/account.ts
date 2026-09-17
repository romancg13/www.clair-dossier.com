/**
 * Suppression de compte — exigence des deux magasins d'applications
 * (App Store 5.1.1(v) · Google Play « Suppression du compte ») et droit à
 * l'effacement du RGPD (§29).
 *
 * L'application ne peut pas effacer un compte toute seule : la suppression
 * d'un utilisateur `auth.users` demande un privilège serveur. Elle appelle
 * donc la fonction Edge `delete-account` (supabase/functions/delete-account),
 * qui vérifie le jeton de l'appelant et n'efface QUE ses propres données.
 *
 * Tant que cette fonction n'est pas déployée, l'application le dit clairement
 * et propose la voie documentée (demande à l'assistance), sans jamais laisser
 * croire que la suppression a eu lieu.
 */
import { supabase } from './supabase';
import { SUPPORT_EMAIL } from './config';
import { openExternal } from './links';
import { wipeLocalData } from './storage';
import { log } from './logger';

export type DeletionOutcome =
  | { status: 'deleted' }
  | { status: 'unavailable'; message: string }
  | { status: 'error'; message: string };

const CONFIRMATION = 'SUPPRIMER';

export function isDeletionConfirmed(input: string): boolean {
  return input.trim().toUpperCase() === CONFIRMATION;
}

export const DELETION_CONFIRMATION_WORD = CONFIRMATION;

export async function deleteAccount(): Promise<DeletionOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { confirm: CONFIRMATION },
    });
    if (error) {
      const status = (error as { status?: number }).status;
      if (status === 404 || status === 403) {
        return {
          status: 'unavailable',
          message:
            "La suppression automatique n'est pas encore activée sur votre espace. Écrivez-nous : votre compte et vos documents seront supprimés sous 30 jours.",
        };
      }
      log.error('account.delete', error);
      return {
        status: 'error',
        message: "La suppression n'a pas pu aboutir. Réessayez ou contactez l'assistance.",
      };
    }
    if ((data as { deleted?: boolean } | null)?.deleted !== true) {
      return {
        status: 'error',
        message: "La suppression n'a pas été confirmée par le serveur. Contactez l'assistance.",
      };
    }
    await supabase.auth.signOut().catch(() => {});
    await wipeLocalData(false);
    log.info('account.deleted');
    return { status: 'deleted' };
  } catch (error) {
    log.error('account.delete', error);
    return {
      status: 'error',
      message: "La suppression n'a pas pu aboutir. Vérifiez votre connexion puis réessayez.",
    };
  }
}

/** Voie de secours : demande écrite à l'assistance, pré-remplie. */
export async function requestDeletionByEmail(accountEmail?: string | null): Promise<boolean> {
  const subject = 'Demande de suppression de compte';
  const body =
    `Bonjour,\n\nJe demande la suppression définitive de mon compte ClairDossier` +
    `${accountEmail ? ` (${accountEmail})` : ''} et de l'ensemble de mes données et documents.\n\n` +
    `Merci de me confirmer la suppression.\n`;
  return openExternal(
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  );
}

/** Export des données du compte (droit d'accès, RGPD art. 15/20). */
export async function requestDataExport(accountEmail?: string | null): Promise<boolean> {
  const subject = 'Demande d’export de mes données';
  const body =
    `Bonjour,\n\nJe demande l'export des données associées à mon compte ClairDossier` +
    `${accountEmail ? ` (${accountEmail})` : ''} : dossiers, pièces déposées, échéances et journal d'activité.\n\nMerci.\n`;
  return openExternal(
    `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  );
}
