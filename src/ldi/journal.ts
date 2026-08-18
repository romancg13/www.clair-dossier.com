/**
 * LDI — journal d'exécution.
 *
 * Répond à la seule question que l'audit avait laissée sans réponse : « d'où
 * vient cette phrase, trois mois plus tard ? ».
 *
 * Le noyau étant déterministe, le journal n'a pas besoin de tout conserver. Il
 * lui suffit d'identifier l'entrée par une empreinte, de retenir la version du
 * moteur, et de tracer pour chaque constat les éléments du dossier qui l'ont
 * produit. Rejouer l'analyse sur le même dossier doit redonner exactement le
 * même rapport — et si ce n'est pas le cas, `rejouer()` dit ce qui a bougé :
 * le dossier, ou le moteur.
 *
 * Le journal ne recopie PAS le dossier. Sur un dossier pénal, dupliquer les
 * pièces multiplie les endroits où le secret professionnel doit être protégé,
 * pour un gain nul : l'original est déjà sur la machine de l'avocat.
 */
import { analyser } from './pipeline';
import { VERSION_LDI } from './prompt';
import { referencesDuRapport } from './sourcage';
import type { Dossier, RapportLdi } from './types';

export type ConstatJournalise = {
  /** Identifiant du point de contrôle, ou type de la contradiction. */
  id: string;
  nature: 'point-de-controle' | 'contradiction';
  resultat: string;
  /** Référence du texte invoqué, quand il y en a un. */
  fondement?: string;
  /** Identifiants des événements et pièces d'où sort le constat. */
  origine: string[];
};

export type Journal = {
  version: string;
  executeLe: string;
  dossier: {
    reference: string;
    empreinte: string;
    pieces: number;
    evenements: number;
  };
  constats: ConstatJournalise[];
  references: string[];
  rapportEmpreinte: string;
};

/**
 * Empreinte d'identité, calculée en FNV-1a 64 bits.
 *
 * Ce n'est PAS une empreinte cryptographique : elle sert à répondre à « est-ce
 * bien la même entrée ? », pas à résister à un adversaire qui chercherait une
 * collision. Choisie synchrone et sans dépendance pour fonctionner à
 * l'identique dans le navigateur et en ligne de commande.
 */
export function empreinte(valeur: unknown): string {
  const texte = typeof valeur === 'string' ? valeur : stableStringify(valeur);

  let h = 0xcbf29ce484222325n;
  const premier = 0x100000001b3n;
  const masque = 0xffffffffffffffffn;

  for (let i = 0; i < texte.length; i += 1) {
    h ^= BigInt(texte.charCodeAt(i));
    h = (h * premier) & masque;
  }
  return h.toString(16).padStart(16, '0');
}

/**
 * Sérialisation à clés ordonnées : deux objets équivalents donnent le même texte.
 *
 * L'ordre est celui des POINTS DE CODE, pas l'ordre linguistique.
 * `localeCompare` dépend de la locale et des données ICU du runtime : la même
 * empreinte pouvait différer entre le navigateur et la ligne de commande, et
 * `rejouer` aurait alors signalé un dossier modifié qui ne l'était pas.
 */
function stableStringify(valeur: unknown): string {
  if (valeur === null || typeof valeur !== 'object') return JSON.stringify(valeur) ?? 'null';
  if (Array.isArray(valeur)) return `[${valeur.map(stableStringify).join(',')}]`;

  const entrees = Object.entries(valeur as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entrees.join(',')}}`;
}

export function journaliser(dossier: Dossier, rapport: RapportLdi): Journal {
  const constats: ConstatJournalise[] = [
    ...rapport.nullites.points.map<ConstatJournalise>((p) => ({
      id: p.id,
      nature: 'point-de-controle',
      resultat: p.resultat,
      fondement: p.fondement.reference,
      // Les points s'appuient sur la chronologie entière ; on retient les
      // événements de la nature qu'ils examinent, à défaut de plus précis.
      origine: rapport.dossier.chronologie.map((e) => e.id),
    })),
    ...rapport.dossier.contradictions.map<ConstatJournalise>((c) => ({
      id: c.regle ?? c.type,
      nature: 'contradiction',
      resultat: c.severite,
      origine: c.elements,
    })),
  ];

  return {
    version: rapport.version,
    executeLe: rapport.genereLe,
    dossier: {
      reference: dossier.reference,
      empreinte: empreinte(dossier),
      pieces: dossier.pieces.length,
      evenements: dossier.evenements.length,
    },
    constats,
    references: referencesDuRapport(rapport),
    // L'horodatage de génération est retiré : il change à chaque exécution et
    // rendrait toute comparaison impossible.
    rapportEmpreinte: empreinteRapport(rapport),
  };
}

export type ControleRejeu = {
  identique: boolean;
  /** Ce qui a changé depuis la journalisation, en clair. */
  ecarts: string[];
};

/**
 * Confronte un journal à un dossier actuel. Dit ce qui a bougé plutôt que de
 * se contenter d'un booléen : sur une procédure, savoir que c'est le dossier
 * qui a changé — et non le moteur — est l'information utile.
 */
/**
 * Empreinte d'un rapport, heure de génération neutralisée.
 *
 * `genereLe` change à chaque exécution : l'inclure ferait échouer tout rejeu.
 * Une seule fonction pour la journalisation ET le rejeu — deux normalisations
 * séparées auraient fini par diverger, et le contrôle aurait alors signalé un
 * écart qui n'existe pas.
 */
function empreinteRapport(rapport: RapportLdi): string {
  return empreinte({ ...rapport, genereLe: '' });
}

export function rejouer(journal: Journal, dossier: Dossier): ControleRejeu {
  const ecarts: string[] = [];

  const actuelle = empreinte(dossier);
  if (actuelle !== journal.dossier.empreinte) {
    ecarts.push(
      `Le dossier a changé depuis la journalisation (empreinte ${journal.dossier.empreinte} → ${actuelle}).`
    );
  }

  // Le rapport lui-même est recalculé et confronté à l'empreinte enregistrée.
  // Sans cela, `rejouer` déclarait « identique » sur la seule foi du dossier et
  // du numéro de version : un changement de moteur à version constante — une
  // correction de seuil, un libellé de constat — passait inaperçu, alors que
  // c'est exactement ce qu'un contrôle de reproductibilité doit attraper.
  const rapportActuel = empreinteRapport(analyser(dossier));
  if (rapportActuel !== journal.rapportEmpreinte) {
    ecarts.push(
      `Le rapport produit aujourd'hui diffère de celui journalisé (empreinte ${journal.rapportEmpreinte} → ${rapportActuel}), à dossier inchangé : le moteur a changé de comportement.`
    );
  }

  // Un rapport reproduit par une autre version du moteur n'est pas le même
  // rapport : les seuils, les points de contrôle et les libellés ont pu bouger.
  if (journal.version !== VERSION_LDI) {
    ecarts.push(
      `La version du moteur a changé (${journal.version} → ${VERSION_LDI}) : les constats ne sont pas comparables tels quels.`
    );
  }

  return { identique: ecarts.length === 0, ecarts };
}
