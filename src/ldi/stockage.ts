/**
 * LDI — conservation locale du plan de travail, dans un coffre chiffré.
 *
 * ┌─ UN ARBITRAGE, PAS UNE COMMODITÉ ───────────────────────────────────────┐
 * │ Perdre son travail en rafraîchissant une page est rédhibitoire dès qu'un │
 * │ dossier dépasse quelques pièces (défaut P1-11). Mais ce qu'on conserve   │
 * │ ici, ce sont des pièces de procédure pénale couvertes par le secret      │
 * │ professionnel, sur un support que le navigateur laisse accessible.       │
 * │                                                                          │
 * │ D'où quatre règles, tenues par le code :                                 │
 * │   1. RIEN n'est écrit tant que l'avocat n'a pas activé la conservation ; │
 * │   2. ce qui est écrit est CHIFFRÉ — il n'existe pas de mode en clair ;   │
 * │   3. l'état est LISIBLE sans la phrase : quand, combien d'octets ;       │
 * │   4. la désactivation PURGE immédiatement, et n'exige pas la phrase.     │
 * │                                                                          │
 * │ La règle 4 mérite un mot : exiger la phrase pour effacer transformerait  │
 * │ une phrase oubliée en données indélébiles. On doit toujours pouvoir se   │
 * │ débarrasser de ce qu'on ne peut plus lire.                               │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * La clé vit en mémoire, le temps de l'onglet. Recharger la page redemande la
 * phrase : c'est le prix, et c'est aussi la garantie qu'aucune session laissée
 * ouverte ne survit à la fermeture du navigateur.
 */
import {
  creerCoffre,
  estEnveloppe,
  ouvrirCoffre,
  sceller,
  type CoffreOuvert,
  type CoffreScelle,
} from './coffre';
import type { Dossier } from './types';

const CLE_COFFRE = 'ldi.atelier.coffre';

/** Ancienne clé, en clair. Purgée à la première occasion — voir `migrer`. */
const CLES_HERITEES = ['ldi.atelier.dossiers', 'ldi.atelier.conservation', 'ldi.atelier.ecritLe'];

/** Sous-ensemble de `Storage` réellement utilisé — facilite le test. */
export type StockageMinimal = {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
  removeItem(cle: string): void;
};

/**
 * `localStorage` n'existe ni en test ni au rendu serveur, et son accès lève
 * dans un navigateur où le stockage de site est bloqué. Absent, tout le module
 * se comporte comme une conservation indisponible — jamais comme une erreur.
 */
function stockageParDefaut(): StockageMinimal | null {
  try {
    if (typeof globalThis.localStorage === 'undefined') return null;
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

export type EtatConservation = {
  /** Un coffre existe-t-il sur ce support ? Lisible sans la phrase. */
  active: boolean;
  /** Conservation possible ici ? Faux sans `localStorage` ou sans `crypto.subtle`. */
  disponible: boolean;
  /** Taille du coffre scellé, en octets. Ne dit rien de son contenu. */
  octets: number;
  /** Horodatage ISO du dernier scellement, `null` si aucun coffre. */
  ecritLe: string | null;
  /**
   * Reste-t-il des données de l'ancien format, écrites en clair ?
   *
   * Affiché plutôt que purgé en silence : l'avocat doit savoir que du clair a
   * existé sur ce poste, et pas seulement qu'il n'y en a plus.
   */
  heritageEnClair: boolean;
};

/** Le chiffrement est-il seulement possible ici ? Aucun repli en clair. */
export function chiffrementDisponible(): boolean {
  try {
    return typeof globalThis.crypto?.subtle !== 'undefined';
  } catch {
    return false;
  }
}

function lireEnveloppe(support: StockageMinimal): CoffreScelle | null {
  const brut = support.getItem(CLE_COFFRE);
  if (!brut) return null;

  try {
    const parse: unknown = JSON.parse(brut);
    return estEnveloppe(parse) ? parse : null;
  } catch {
    return null;
  }
}

export function etatConservation(support = stockageParDefaut()): EtatConservation {
  if (!support || !chiffrementDisponible()) {
    return { active: false, disponible: false, octets: 0, ecritLe: null, heritageEnClair: false };
  }

  const brut = support.getItem(CLE_COFFRE);
  const enveloppe = lireEnveloppe(support);

  return {
    active: enveloppe !== null,
    disponible: true,
    octets: brut ? brut.length : 0,
    ecritLe: enveloppe?.ecritLe ?? null,
    heritageEnClair: CLES_HERITEES.some((c) => support.getItem(c) !== null),
  };
}

/**
 * Efface l'ancien stockage en clair.
 *
 * Séparé de la purge du coffre, et déclenché par l'avocat : effacer en silence
 * lui cacherait qu'un plan de travail a été conservé sans chiffrement sur ce
 * poste — un fait qui, dans un cabinet, peut demander autre chose qu'un clic.
 */
export function purgerHeritage(support = stockageParDefaut()): void {
  if (!support) return;
  for (const cle of CLES_HERITEES) support.removeItem(cle);
}

/**
 * Crée le coffre et y scelle un premier contenu.
 *
 * Écrase un coffre existant : c'est la seule façon de changer de phrase, et
 * l'appelant doit avoir prévenu. Lève si la phrase est trop courte.
 */
export async function activerConservation(
  phrase: string,
  dossiers: Dossier[],
  maintenant: string,
  support = stockageParDefaut()
): Promise<{ coffre: CoffreOuvert; etat: EtatConservation }> {
  if (!support) throw new Error("Aucun support de conservation sur cet appareil.");

  const coffre = await creerCoffre(phrase);
  const enveloppe = await sceller(coffre, JSON.stringify(dossiers), maintenant);
  support.setItem(CLE_COFFRE, JSON.stringify(enveloppe));

  return { coffre, etat: etatConservation(support) };
}

export type Ouverture =
  | { ok: true; coffre: CoffreOuvert; dossiers: Dossier[] }
  | { ok: false; message: string };

/**
 * Ouvre le coffre et rend les dossiers qu'il contient.
 *
 * Ne rend QUE ce qui satisfait la forme minimale attendue : un contenu écrit
 * par une version antérieure est ignoré plutôt que passé au moteur d'analyse.
 * La validation complète reste celle de `validerDossier`.
 */
export async function ouvrirConservation(
  phrase: string,
  support = stockageParDefaut()
): Promise<Ouverture> {
  if (!support) return { ok: false, message: "Aucun support de conservation sur cet appareil." };

  const enveloppe = lireEnveloppe(support);
  if (!enveloppe) return { ok: false, message: 'Aucun coffre sur ce poste.' };

  const resultat = await ouvrirCoffre(enveloppe, phrase);
  if (!resultat.ok) return { ok: false, message: resultat.message };

  let parse: unknown;
  try {
    parse = JSON.parse(resultat.contenu);
  } catch {
    // Le coffre s'est ouvert : la phrase était bonne et le contenu authentique.
    // C'est donc la FORME du contenu qui ne convient pas, pas le chiffrement.
    return { ok: false, message: 'Coffre ouvert, mais son contenu n’est pas un plan de travail lisible.' };
  }

  return {
    ok: true,
    coffre: resultat.coffre,
    dossiers: Array.isArray(parse) ? parse.filter(estDossier) : [],
  };
}

function estDossier(d: unknown): d is Dossier {
  if (typeof d !== 'object' || d === null) return false;
  const c = d as Partial<Dossier>;
  return (
    typeof c.reference === 'string' &&
    Array.isArray(c.evenements) &&
    Array.isArray(c.pieces) &&
    Array.isArray(c.qualifications)
  );
}

/**
 * Scelle le plan de travail dans un coffre déjà ouvert.
 *
 * Retourne `false` quand rien n'a été écrit, pour que l'appelant puisse le
 * dire à l'avocat plutôt que de le supposer : un plan de travail qu'on croit
 * conservé et qui ne l'est pas est pire qu'un plan dont on sait qu'il ne l'est
 * pas.
 */
export async function conserver(
  coffre: CoffreOuvert,
  dossiers: Dossier[],
  maintenant: string,
  support = stockageParDefaut()
): Promise<boolean> {
  if (!support) return false;

  try {
    const enveloppe = await sceller(coffre, JSON.stringify(dossiers), maintenant);
    support.setItem(CLE_COFFRE, JSON.stringify(enveloppe));
    return true;
  } catch {
    // Quota dépassé, mode privé, écriture refusée : l'échec est signalé, pas
    // avalé.
    return false;
  }
}

/**
 * Efface le coffre. N'exige pas la phrase — et ne doit pas l'exiger.
 *
 * Une phrase oubliée rendrait sinon les données indélébiles : on doit toujours
 * pouvoir se débarrasser de ce qu'on ne peut plus lire.
 */
export function purger(support = stockageParDefaut()): void {
  if (!support) return;
  support.removeItem(CLE_COFFRE);
}
