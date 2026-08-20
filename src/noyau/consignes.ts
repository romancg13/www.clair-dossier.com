/**
 * DEFENSE OS — M11 : bibliothèque du cabinet et consignes permanentes.
 *
 * ┌─ CE QUE L'AVOCAT DIT UNE FOIS, IL NE LE RÉPÈTE PLUS ────────────────────┐
 * │ Une consigne saisie ici est injectée dans CHAQUE passe concernée, et     │
 * │ chaque génération affiche celles qui lui ont été appliquées. Sans cette  │
 * │ visibilité, une consigne oubliée par le moteur passerait pour appliquée. │
 * │                                                                          │
 * │ Deux portées : « cabinet » (transversale) et « dossier » (prime sur le   │
 * │ cabinet quand elle porte le même sujet). Les deux corpus restent         │
 * │ STRICTEMENT séparés des pièces (B18) : la bibliothèque contient des      │
 * │ trames du cabinet, jamais du contenu de dossier.                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Les consignes sont versionnées : modifier une consigne en crée une nouvelle
 * version et désactive l'ancienne — l'historique dit ce qui a été appliqué à
 * quelle génération, ce qu'un écrasement en place effacerait.
 */
import { empreinte } from '../ldi/journal';
import type { Consigne } from './modele';

export type TrameCabinet = {
  id: string;
  intitule: string;
  /** Type de livrable que la trame habille. */
  type: string;
  corps: string;
  ajouteeLe: string;
};

/** Là où la trame reçoit le corps généré. Sans lui, la trame sert de préambule. */
export const EMPLACEMENT_CORPS = '[[CORPS]]';

/** Emplacements de métadonnées admis dans une trame, tous facultatifs. */
export const EMPLACEMENTS_DOSSIER = ['[[REFERENCE]]', '[[INITIALES]]', '[[JURIDICTION]]'] as const;

/**
 * La trame qui habille un type de livrable : la plus récemment ajoutée pour ce
 * type. Les trames antérieures restent dans la bibliothèque (B21) — elles ne
 * sont simplement plus employées.
 */
export function trameApplicable(trames: TrameCabinet[], type: string): TrameCabinet | null {
  const candidates = trames.filter((t) => t.type === type);
  if (candidates.length === 0) return null;
  return candidates.reduce((a, b) => (b.ajouteeLe >= a.ajouteeLe ? b : a));
}

/**
 * Habille un corps généré avec une trame du cabinet.
 *
 * Les remplacements se font par découpage, jamais par motif : un corps ou une
 * trame contenant `$&` doit rester littéral (leçon consignée du build
 * autonome). Une trame sans `[[CORPS]]` devient un préambule — le corps généré
 * suit, jamais écrasé : une trame ne peut pas faire disparaître l'analyse.
 */
export function appliquerTrame(
  trame: TrameCabinet,
  corps: string,
  dossier: { reference: string; initialesClient?: string; juridiction?: string }
): string {
  // `||` et non `??` : les défauts du schéma pénal sont des chaînes VIDES, et
  // une trame ne doit jamais rendre un champ vide là où l'avocat attend une
  // valeur — le manque se dit.
  let habille = trame.corps
    .split('[[REFERENCE]]').join(dossier.reference)
    .split('[[INITIALES]]').join(dossier.initialesClient || '[À COMPLÉTER : initiales]')
    .split('[[JURIDICTION]]').join(dossier.juridiction || '[À COMPLÉTER : juridiction]');

  habille = habille.includes(EMPLACEMENT_CORPS)
    ? habille.split(EMPLACEMENT_CORPS).join(corps)
    : `${habille.trimEnd()}\n\n${corps}`;

  return habille;
}

export type Bibliotheque = {
  trames: TrameCabinet[];
  consignes: Consigne[];
};

export function bibliothequeVide(): Bibliotheque {
  return { trames: [], consignes: [] };
}

/** Crée une consigne active. L'identifiant dérive du contenu et de la date. */
export function creerConsigne(
  enonce: string,
  portee: 'cabinet' | 'dossier',
  options: { dossierReference?: string; auteur?: string; date?: string } = {}
): Consigne {
  const date = options.date ?? new Date().toISOString();
  return {
    id: `c-${empreinte(`${enonce}|${portee}|${date}`).slice(0, 12)}`,
    portee,
    dossierReference: portee === 'dossier' ? (options.dossierReference ?? null) : null,
    enonce: enonce.trim(),
    date,
    auteur: options.auteur ?? 'cabinet',
    active: true,
  };
}

/**
 * Remplace une consigne par une nouvelle version : l'ancienne est désactivée,
 * jamais supprimée (B21 — aucune purge silencieuse).
 */
export function reviserConsigne(
  bibliotheque: Bibliotheque,
  idAncienne: string,
  nouvelEnonce: string,
  date = new Date().toISOString()
): Bibliotheque {
  const ancienne = bibliotheque.consignes.find((c) => c.id === idAncienne);
  if (!ancienne) return bibliotheque;

  const nouvelle = creerConsigne(nouvelEnonce, ancienne.portee, {
    dossierReference: ancienne.dossierReference ?? undefined,
    auteur: ancienne.auteur,
    date,
  });

  return {
    ...bibliotheque,
    consignes: [
      ...bibliotheque.consignes.map((c) => (c.id === idAncienne ? { ...c, active: false } : c)),
      nouvelle,
    ],
  };
}

/**
 * Consignes applicables à une génération : celles du cabinet, puis celles du
 * dossier — qui PRIMENT en cas de même sujet, donc arrivent après pour que le
 * moteur les lise en dernier ressort. Seules les actives comptent.
 */
export function consignesApplicables(
  bibliotheque: Bibliotheque,
  dossierReference: string
): Consigne[] {
  const actives = bibliotheque.consignes.filter((c) => c.active);
  return [
    ...actives.filter((c) => c.portee === 'cabinet'),
    ...actives.filter((c) => c.portee === 'dossier' && c.dossierReference === dossierReference),
  ];
}

/**
 * Bloc d'injection pour une instruction de passe. Rendu déterministe : mêmes
 * consignes, même bloc — c'est ce qui permet d'afficher exactement ce qui a
 * été appliqué (B19/B20).
 */
export function blocConsignes(consignes: Consigne[]): string {
  if (consignes.length === 0) return 'CONSIGNES : aucune consigne enregistrée.';
  return [
    'CONSIGNES DU CABINET (les consignes de dossier priment) :',
    ...consignes.map((c) => `- [${c.portee}${c.dossierReference ? ` · ${c.dossierReference}` : ''}] ${c.enonce}`),
  ].join('\n');
}

/** Identifiants des consignes appliquées — ce que la génération journalise. */
export function idsAppliques(consignes: Consigne[]): string[] {
  return consignes.map((c) => c.id);
}
