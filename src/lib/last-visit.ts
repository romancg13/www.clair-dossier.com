/**
 * Dernière visite d'un dossier — commodité PAR APPAREIL (localStorage), jamais
 * en base : sert uniquement à afficher « ce qui a changé depuis votre dernière
 * visite ». Le repère ne contient qu'un horodatage, un numéro de révision et
 * des empreintes d'échéances (aucun intitulé, aucun nom de pièce). Stockage
 * indisponible (navigation privée stricte, quota) : rien n'est lu ni écrit,
 * l'encart n'apparaît simplement pas.
 */
import type { VisitMark } from "../../supabase/functions/_shared/attention.ts";
import type { KeyValueStore } from "./drafts";

const PREFIX = "clairdossier_visite_v1:";

function defaultStore(): KeyValueStore | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Repère de la dernière visite de ce dossier sur cet appareil, ou null. */
export function readVisit(dossierId: string, store: KeyValueStore | null = defaultStore()): VisitMark | null {
  if (!store) return null;
  try {
    const raw = store.getItem(PREFIX + dossierId);
    const v = raw ? (JSON.parse(raw) as Partial<VisitMark> | null) : null;
    if (!v || typeof v.at !== "string" || Number.isNaN(new Date(v.at).getTime())) return null;
    return {
      at: v.at,
      revision: typeof v.revision === "number" ? v.revision : null,
      deadlineKeys: Array.isArray(v.deadlineKeys) ? v.deadlineKeys.filter((k): k is string => typeof k === "string") : [],
    };
  } catch {
    return null;
  }
}

/** Enregistre le repère de la visite en cours (silencieux si le stockage est indisponible). */
export function writeVisit(dossierId: string, mark: VisitMark, store: KeyValueStore | null = defaultStore()): void {
  if (!store) return;
  try {
    store.setItem(PREFIX + dossierId, JSON.stringify(mark));
  } catch {
    /* stockage plein ou refusé : commodité seulement */
  }
}
