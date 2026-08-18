/**
 * LDI — provenance des références juridiques.
 *
 * ┌─ LE PRINCIPE ───────────────────────────────────────────────────────────┐
 * │ L'autorité d'une citation ne peut jamais être DÉCLARÉE par une partie.  │
 * │                                                                          │
 * │ Une référence transmise par un client, recopiée dans une pièce, ou       │
 * │ produite par un modèle de langage est un ALLÉGUÉ. Elle ne devient        │
 * │ citable qu'après résolution auprès d'une source officielle, ou après     │
 * │ vérification personnelle de l'avocat sur la source — geste tracé,        │
 * │ horodaté, distinct de la vérification automatique.                       │
 * │                                                                          │
 * │ C'était le défaut P1-12 : la fonction edge recevait son ensemble         │
 * │ citable de l'appelant et le traitait comme une autorité. Un appelant     │
 * │ authentifié pouvait donc faire bénir un pourvoi inexistant.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Ce module est SANS DÉPENDANCE : il est recopié tel quel dans la fonction
 * Deno, qui doit pouvoir appliquer la même règle sans faire confiance au
 * client.
 */

/**
 * États possibles d'une référence. L'ordre du type est celui de la confiance
 * croissante, et il n'existe pas d'autre état : ce qui n'a pas été résolu est
 * `allegue`, jamais « probablement bon ».
 */
export type EtatReference = 'allegue' | 'introuvable' | 'verifie-avocat' | 'verifie-api';

export type ReferenceTracee = {
  /** Référence telle qu'écrite, sans normalisation. */
  reference: string;
  etat: EtatReference;
  /**
   * Qui a établi cet état. Pour `verifie-api`, l'éditeur ayant répondu ;
   * pour `verifie-avocat`, la mention du contrôle manuel.
   */
  origine: string;
  /** Horodatage ISO de la résolution. `null` tant qu'elle n'a pas eu lieu. */
  resoluLe: string | null;
};

export const LIBELLES_ETAT_REFERENCE: Record<EtatReference, string> = {
  allegue: 'Allégué — non vérifié',
  introuvable: 'Introuvable à la source',
  'verifie-avocat': "Vérifié par l'avocat",
  'verifie-api': 'Vérifié auprès de la source officielle',
};

/** Les deux seuls états qui autorisent une citation dans un acte. */
const CITABLES: EtatReference[] = ['verifie-api', 'verifie-avocat'];

export function estCitable(ref: ReferenceTracee): boolean {
  return CITABLES.includes(ref.etat);
}

/**
 * Toute référence entrant par une frontière non fiable — corps de requête,
 * texte de pièce, sortie de modèle — quel que soit l'état qu'elle prétend
 * porter.
 *
 * Le paramètre n'accepte volontairement pas d'état : accepter un état déclaré,
 * même pour le contredire ensuite, laisserait un jour passer une valeur qu'on
 * aurait oublié d'écraser.
 */
export function allegue(reference: string, origine: string): ReferenceTracee {
  return { reference, etat: 'allegue', origine, resoluLe: null };
}

/**
 * Promotion après réponse d'une source officielle. C'est le SEUL chemin
 * automatique vers un état citable, et il exige une réponse effectivement
 * obtenue — pas une tentative, pas un cache expiré sans contrôle.
 */
export function resolueParApi(
  reference: string,
  editeur: string,
  resoluLe: string
): ReferenceTracee {
  return { reference, etat: 'verifie-api', origine: editeur, resoluLe };
}

/**
 * Vérification personnelle de l'avocat sur la source.
 *
 * ┌─ POURQUOI CE CHEMIN EXISTE ─────────────────────────────────────────────┐
 * │ Sans lui, l'avocat qui a lu l'article dans son code papier n'a aucune    │
 * │ issue : l'outil refuse d'exporter une référence qu'il sait exacte. Il    │
 * │ sortirait alors de l'outil pour rédiger ailleurs — et la règle,          │
 * │ contournée, ne protégerait plus rien.                                    │
 * │                                                                          │
 * │ L'état reste DISTINCT de `verifie-api` : il engage la personne qui l'a   │
 * │ posé, il est horodaté, et l'export le mentionne. Ce n'est pas une porte  │
 * │ dérobée, c'est une signature.                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function verifieeParAvocat(
  reference: string,
  parQui: string,
  resoluLe: string
): ReferenceTracee {
  return {
    reference,
    etat: 'verifie-avocat',
    origine: `Contrôle manuel — ${parQui}`,
    resoluLe,
  };
}

/** Source interrogée, référence absente de son fonds. */
export function introuvable(
  reference: string,
  editeur: string,
  resoluLe: string
): ReferenceTracee {
  return { reference, etat: 'introuvable', origine: editeur, resoluLe };
}

export type ControleExport = {
  autorise: boolean;
  /** Références qui bloquent, avec leur état. */
  bloquantes: ReferenceTracee[];
  /** Message prêt à afficher, vide si l'export est autorisé. */
  message: string;
};

/**
 * Contrôle avant export d'un acte.
 *
 * Bloque sur `allegue` ET sur `introuvable`. Le second cas mérite d'être
 * souligné : une référence dont la source a dit ne pas la connaître est plus
 * dangereuse qu'une référence jamais vérifiée, parce qu'elle a l'apparence
 * d'avoir été contrôlée.
 */
export function controlerExport(references: ReferenceTracee[]): ControleExport {
  const bloquantes = references.filter((r) => !estCitable(r));

  if (bloquantes.length === 0) {
    return { autorise: true, bloquantes: [], message: '' };
  }

  const parEtat = (etat: EtatReference) =>
    bloquantes.filter((r) => r.etat === etat).map((r) => r.reference);

  const alleguees = parEtat('allegue');
  const absentes = parEtat('introuvable');

  const lignes = ["Export refusé : des références ne sont pas citables en l'état."];
  if (alleguees.length > 0) {
    lignes.push(
      `${alleguees.length} allégué(e)(s), jamais confrontée(s) à une source : ${alleguees.join(', ')}.`
    );
  }
  if (absentes.length > 0) {
    lignes.push(
      `${absentes.length} introuvable(s) à la source interrogée : ${absentes.join(', ')}. Une référence que la source ne connaît pas ne doit pas figurer dans un acte.`
    );
  }
  lignes.push(
    "Résoudre chaque référence auprès de sa source officielle, ou la marquer comme vérifiée personnellement, avant d'exporter."
  );

  return { autorise: false, bloquantes, message: lignes.join(' ') };
}

/**
 * Restreint un ensemble candidat à ce qu'une autorité de confiance connaît.
 *
 * C'est la forme exécutable du principe : l'appelant peut RÉDUIRE l'ensemble
 * citable, jamais l'élargir. Une référence qu'il propose et que l'autorité
 * ignore n'est pas autorisée — elle est simplement absente du résultat.
 */
export function intersecter(candidates: string[], connuesDeLAutorite: Set<string>): string[] {
  return candidates.filter((c) => connuesDeLAutorite.has(c));
}
