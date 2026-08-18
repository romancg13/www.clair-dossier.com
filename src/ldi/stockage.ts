/**
 * LDI — conservation locale du plan de travail.
 *
 * ┌─ UN ARBITRAGE, PAS UNE COMMODITÉ ───────────────────────────────────────┐
 * │ Perdre son travail en rafraîchissant une page est rédhibitoire dès qu'un │
 * │ dossier dépasse quelques pièces (défaut P1-11). Mais ce qu'on conserve   │
 * │ ici, ce sont des pièces de procédure pénale couvertes par le secret      │
 * │ professionnel, écrites en clair dans le navigateur, où elles survivent   │
 * │ à la fermeture de l'onglet et à la déconnexion.                          │
 * │                                                                          │
 * │ D'où trois règles, tenues par le code :                                  │
 * │   1. RIEN n'est écrit tant que l'avocat n'a pas activé la conservation ; │
 * │   2. l'état est LISIBLE — combien de dossiers, quelle taille, quand ;    │
 * │   3. la désactivation PURGE immédiatement, elle ne se contente pas de    │
 * │      cesser d'écrire.                                                     │
 * │                                                                          │
 * │ La règle 3 est la seule qui compte vraiment : un réglage qui laisse les  │
 * │ données derrière lui est un réglage qui ment.                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Ce module ne chiffre rien et ne prétend pas le faire : le navigateur reste
 * un support en clair. Sur un poste partagé, la réponse n'est pas ce réglage,
 * c'est la ligne de commande.
 */
import type { Dossier } from './types';

const CLE_DOSSIERS = 'ldi.atelier.dossiers';
const CLE_CONSENTEMENT = 'ldi.atelier.conservation';
const CLE_ECRIT_LE = 'ldi.atelier.ecritLe';

/** Sous-ensemble de `Storage` réellement utilisé — facilite le test. */
export type StockageMinimal = {
  getItem(cle: string): string | null;
  setItem(cle: string, valeur: string): void;
  removeItem(cle: string): void;
};

/**
 * `localStorage` n'existe ni en test ni au rendu serveur, et son accès lève
 * dans un navigateur où les cookies tiers sont bloqués. Absent, tout le module
 * se comporte comme une conservation désactivée — jamais comme une erreur.
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
  /** L'avocat a-t-il explicitement activé la conservation ? */
  active: boolean;
  /** Conservation possible sur ce support ? Faux en CLI, en test, ou si bloquée. */
  disponible: boolean;
  dossiersConserves: number;
  /** Taille approximative en octets de ce qui est réellement écrit. */
  octets: number;
  /** Horodatage ISO de la dernière écriture, `null` si rien n'est conservé. */
  ecritLe: string | null;
};

export function etatConservation(support = stockageParDefaut()): EtatConservation {
  if (!support) {
    return { active: false, disponible: false, dossiersConserves: 0, octets: 0, ecritLe: null };
  }

  const brut = support.getItem(CLE_DOSSIERS);
  let dossiersConserves = 0;
  if (brut) {
    try {
      const parse: unknown = JSON.parse(brut);
      if (Array.isArray(parse)) dossiersConserves = parse.length;
    } catch {
      // Contenu illisible : compté pour zéro dossier, mais ses octets restent
      // annoncés — l'avocat doit voir qu'il reste quelque chose à purger.
      dossiersConserves = 0;
    }
  }

  return {
    active: support.getItem(CLE_CONSENTEMENT) === 'oui',
    disponible: true,
    dossiersConserves,
    octets: brut ? brut.length : 0,
    ecritLe: support.getItem(CLE_ECRIT_LE),
  };
}

/**
 * Active ou coupe la conservation.
 *
 * Couper PURGE. C'est le point du module : un interrupteur qui laisserait les
 * dossiers en place ferait croire à une suppression qui n'a pas eu lieu.
 */
export function definirConservation(active: boolean, support = stockageParDefaut()): EtatConservation {
  if (!support) return etatConservation(support);

  if (active) {
    support.setItem(CLE_CONSENTEMENT, 'oui');
  } else {
    support.removeItem(CLE_CONSENTEMENT);
    purger(support);
  }

  return etatConservation(support);
}

/** Efface tout ce que ce module a pu écrire. Sans effet si rien n'est écrit. */
export function purger(support = stockageParDefaut()): void {
  if (!support) return;
  support.removeItem(CLE_DOSSIERS);
  support.removeItem(CLE_ECRIT_LE);
}

/**
 * Écrit le plan de travail — uniquement si la conservation est active.
 *
 * Retourne `false` quand rien n'a été écrit, pour que l'appelant puisse le
 * dire à l'avocat plutôt que de le supposer.
 */
export function conserver(
  dossiers: Dossier[],
  maintenant: string,
  support = stockageParDefaut()
): boolean {
  if (!support || support.getItem(CLE_CONSENTEMENT) !== 'oui') return false;

  try {
    support.setItem(CLE_DOSSIERS, JSON.stringify(dossiers));
    support.setItem(CLE_ECRIT_LE, maintenant);
    return true;
  } catch {
    // Quota dépassé, mode privé, écriture refusée : l'échec est signalé, pas
    // avalé. Un plan de travail qu'on croit conservé et qui ne l'est pas est
    // pire qu'un plan de travail dont on sait qu'il ne l'est pas.
    return false;
  }
}

/**
 * Relit le plan de travail conservé.
 *
 * Ne renvoie QUE ce qui satisfait la forme minimale attendue : un contenu
 * corrompu, ou écrit par une version antérieure, est ignoré plutôt que passé
 * au moteur d'analyse. La validation complète reste celle de `validerDossier`.
 */
export function relire(support = stockageParDefaut()): Dossier[] {
  if (!support || support.getItem(CLE_CONSENTEMENT) !== 'oui') return [];

  const brut = support.getItem(CLE_DOSSIERS);
  if (!brut) return [];

  try {
    const parse: unknown = JSON.parse(brut);
    if (!Array.isArray(parse)) return [];
    return parse.filter((d): d is Dossier => {
      if (typeof d !== 'object' || d === null) return false;
      const c = d as Partial<Dossier>;
      return (
        typeof c.reference === 'string' &&
        Array.isArray(c.evenements) &&
        Array.isArray(c.pieces) &&
        Array.isArray(c.qualifications)
      );
    });
  } catch {
    return [];
  }
}
