/**
 * Journal d'activité d'un dossier (table `dossier_events`, immuable côté client).
 * Extrait de `src/lib/dossier-workspace.ts` : les libellés écrits en base par le
 * mobile doivent être strictement les mêmes que ceux écrits par le web.
 */

export type EventType =
  | 'document_ajoute'
  | 'document_renomme'
  | 'document_reclasse'
  | 'document_corbeille'
  | 'document_restaure'
  | 'document_supprime'
  | 'dossier_renomme'
  | 'echeance_creee'
  | 'echeance_modifiee'
  | 'echeance_terminee'
  | 'echeance_supprimee'
  | 'telechargement_groupe';

export const EVENT_LABELS: Record<EventType, string> = {
  document_ajoute: 'Document ajouté',
  document_renomme: 'Document renommé',
  document_reclasse: 'Document reclassé',
  document_corbeille: 'Document placé dans la corbeille',
  document_restaure: 'Document restauré',
  document_supprime: 'Document supprimé définitivement',
  dossier_renomme: 'Dossier renommé',
  echeance_creee: 'Échéance ajoutée',
  echeance_modifiee: 'Échéance modifiée',
  echeance_terminee: 'Échéance terminée',
  echeance_supprimee: 'Échéance supprimée',
  telechargement_groupe: 'Téléchargement groupé des pièces',
};

/** Libellé exact enregistré dans `dossier_events.label` (même règle que le web). */
export function eventLabel(type: EventType, detail?: string): string {
  return detail ? `${EVENT_LABELS[type]} — ${detail}` : EVENT_LABELS[type];
}

export type DossierEvent = {
  id: string;
  dossier_id: string;
  user_id: string;
  type: string;
  label: string;
  created_at: string;
};
