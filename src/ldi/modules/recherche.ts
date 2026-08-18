/**
 * LDI — Module 2 : recherche juridique.
 *
 * ┌─ GARANTIE CENTRALE ─────────────────────────────────────────────────────┐
 * │ Ce module ne produit AUCUNE décision de jurisprudence qu'il n'a pas      │
 * │ reçue d'une API officielle pendant l'exécution. Il n'embarque pas de     │
 * │ base locale d'arrêts, il n'en déduit pas, il n'en complète pas.          │
 * │ Sans configuration, il renvoie une liste vide et un avertissement.       │
 * │                                                                          │
 * │ C'est la contrepartie technique de l'exigence « zéro hallucination » :   │
 * │ un numéro de pourvoi inventé est indétectable à l'œil et ruine une       │
 * │ écriture. Le seul moyen sûr de ne pas en produire est de n'avoir aucun   │
 * │ chemin de code capable d'en fabriquer.                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import { trouverReference } from '../corpus/references';
import type {
  DecisionJurisprudentielle,
  EnonceJuridique,
  ResultatRecherche,
  SourceOfficielle,
} from '../types';

export type ConfigSource = {
  /** URL de base de l'API (PISTE / Judilibre / Légifrance selon le cas). */
  urlBase: string;
  /** Nom de l'en-tête d'authentification, ex. « KeyId » ou « Authorization ». */
  enteteAuth: string;
  /** Valeur de l'en-tête. Ne doit jamais provenir du bundle navigateur. */
  valeurAuth: string;
};

export type ConfigRecherche = {
  judilibre?: ConfigSource;
  legifrance?: ConfigSource;
  /** Injection pour les tests. */
  fetchImpl?: typeof fetch;
  /** Délai maximal par appel, en millisecondes. */
  timeoutMs?: number;
};

const AVERTISSEMENT_NON_CONFIGURE =
  "Aucune source officielle n'est configurée pour cette exécution : aucune jurisprudence n'est retournée. " +
  "Les références de jurisprudence doivent être recherchées manuellement sur Judilibre avant toute citation dans un acte.";

const AVERTISSEMENT_INJOIGNABLE =
  "La source officielle n'a pas pu être interrogée. Aucune décision n'est retournée : l'absence de résultat ne signifie pas l'absence de jurisprudence.";

const AVERTISSEMENT_AUCUN_RESULTAT =
  "La source officielle a répondu sans aucune décision pour cette référence. Une recherche manuelle sur Judilibre reste nécessaire avant toute citation.";

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10);
}

async function appeler(
  config: ConfigRecherche,
  source: ConfigSource,
  chemin: string,
  parametres: Record<string, string>
): Promise<unknown | null> {
  const doFetch = config.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!doFetch) return null;

  // Sans barre finale, `new URL('search', '…/v1.0')` remplace le dernier segment
  // au lieu de s'y ajouter : la requête partirait sur un chemin inexistant et le
  // module conclurait à tort que la source est injoignable.
  const base = source.urlBase.endsWith('/') ? source.urlBase : `${source.urlBase}/`;
  const url = new URL(chemin, base);
  for (const [cle, valeur] of Object.entries(parametres)) url.searchParams.set(cle, valeur);

  const controleur = new AbortController();
  const minuteur = setTimeout(() => controleur.abort(), config.timeoutMs ?? 10_000);
  try {
    const reponse = await doFetch(url.toString(), {
      headers: { [source.enteteAuth]: source.valeurAuth, Accept: 'application/json' },
      signal: controleur.signal,
    });
    if (!reponse.ok) return null;
    return (await reponse.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(minuteur);
  }
}

// ---------------------------------------------------------------------------
// Lecture défensive des réponses
// ---------------------------------------------------------------------------

function champ(objet: unknown, ...cles: string[]): string | undefined {
  if (typeof objet !== 'object' || objet === null) return undefined;
  const enregistrement = objet as Record<string, unknown>;
  for (const cle of cles) {
    const valeur = enregistrement[cle];
    if (typeof valeur === 'string' && valeur.trim() !== '') return valeur.trim();
  }
  return undefined;
}

/**
 * Convertit une entrée d'API en décision typée.
 * Retourne `null` dès qu'un élément d'identification manque : mieux vaut
 * ignorer un arrêt réel que produire une référence incomplète qu'un lecteur
 * pressé citerait telle quelle.
 */
export function versDecision(brut: unknown, source: SourceOfficielle): DecisionJurisprudentielle | null {
  const numero = champ(brut, 'number', 'numero', 'numeroPourvoi');
  const date = champ(brut, 'decision_date', 'date', 'dateDecision');
  if (!numero || !date) return null;

  // Aucune valeur par défaut. Nommer une juridiction que la source n'a pas
  // renvoyée, sur une décision par ailleurs marquée « vérifiée », c'est
  // fabriquer exactement la provenance que ce module existe pour garantir : un
  // arrêt de cour d'appel se serait présenté comme un arrêt de la chambre
  // criminelle. Même règle que pour `solution` juste en dessous — l'absence
  // s'écrit, elle ne se comble pas.
  const juridiction =
    champ(brut, 'jurisdiction', 'juridiction') ??
    'Juridiction non restituée par la source : lire la décision intégrale.';
  const solution =
    champ(brut, 'solution', 'summary', 'sommaire', 'text') ??
    'Solution non restituée par la source : lire la décision intégrale.';

  return {
    juridiction,
    date,
    numero,
    solution: solution.length > 400 ? `${solution.slice(0, 397)}…` : solution,
    statut: 'verifie',
    source,
  };
}

function listeDeResultats(charge: unknown): unknown[] {
  if (Array.isArray(charge)) return charge;
  if (typeof charge === 'object' && charge !== null) {
    const enregistrement = charge as Record<string, unknown>;
    for (const cle of ['results', 'resultats', 'items', 'data']) {
      if (Array.isArray(enregistrement[cle])) return enregistrement[cle] as unknown[];
    }
  }
  return [];
}

// ---------------------------------------------------------------------------
// API du module
// ---------------------------------------------------------------------------

export type ResultatJurisprudence = {
  decisions: DecisionJurisprudentielle[];
  /**
   * `false` lorsque la source n'a pas répondu (réseau, délai, statut non 2xx).
   * Distinguer ce cas d'une réponse vide est essentiel : dire « source
   * injoignable » alors que Judilibre a répondu « aucune décision » est une
   * affirmation fausse, dans un rapport dont l'avocat se sert.
   */
  interrogee: boolean;
};

/**
 * Recherche la jurisprudence associée à une référence de texte.
 * Le paramètre `config` est explicite : aucun secret n'est lu depuis
 * `import.meta.env`, pour qu'aucune clé ne puisse se retrouver dans un bundle
 * navigateur par inadvertance.
 */
export async function rechercherJurisprudence(
  reference: string,
  config: ConfigRecherche = {}
): Promise<ResultatJurisprudence> {
  if (!config.judilibre) return { decisions: [], interrogee: false };

  const charge = await appeler(config, config.judilibre, 'search', {
    query: reference,
    field: 'text',
    resolve_references: 'true',
  });
  if (charge === null) return { decisions: [], interrogee: false };

  const source: SourceOfficielle = {
    editeur: 'Judilibre',
    url: config.judilibre.urlBase,
    consulteLe: aujourdhui(),
  };

  return {
    decisions: listeDeResultats(charge)
      .map((brut) => versDecision(brut, source))
      .filter((d): d is DecisionJurisprudentielle => d !== null),
    interrogee: true,
  };
}

/**
 * Confronte une référence de l'index interne au texte publié sur Légifrance.
 * Seule cette fonction peut faire passer un énoncé au statut `verifie`.
 */
export async function verifierTexte(
  reference: string,
  config: ConfigRecherche = {}
): Promise<EnonceJuridique> {
  const entree = trouverReference(reference);
  const base: EnonceJuridique = entree
    ? { reference: entree.reference, enonce: entree.enonce, statut: 'a-verifier', source: entree.source, note: entree.note }
    : {
        reference,
        enonce: "Référence absente de l'index interne.",
        statut: 'non-verifiable',
        note: "Aucun énoncé n'est produit pour une référence inconnue du corpus.",
      };

  if (!entree || !config.legifrance) return base;

  // NOTE — la forme exacte de la requête (chemin, verbe, nom des paramètres)
  // dépend de l'API PISTE effectivement ouverte à l'opérateur et doit être
  // reprise de sa documentation en vigueur. Elle est ici volontairement
  // générique. La lecture défensive plus bas garantit le comportement qui
  // compte : une requête mal formée ou une réponse inattendue laisse l'énoncé
  // au statut `a-verifier` au lieu d'inventer un texte.
  const charge = await appeler(config, config.legifrance, 'consult/getArticle', {
    id: entree.source?.url ?? entree.reference,
  });
  if (charge === null) {
    return { ...base, note: [base.note, AVERTISSEMENT_INJOIGNABLE].filter(Boolean).join(' ') };
  }

  const texte = champ(charge, 'texte', 'text', 'content');
  if (!texte) {
    // Retourner `base` tel quel rendait ce cas indiscernable d'une source
    // jamais configurée : même statut, même note vide. Or les deux appellent
    // des gestes différents — vérifier ses identifiants, ou aller lire la
    // référence à la main. C'est la distinction que `interrogee` restaure
    // déjà côté jurisprudence.
    return {
      ...base,
      note: [
        base.note,
        "La source officielle a répondu, mais sans texte exploitable pour cette référence : statut maintenu à « à vérifier », lecture manuelle nécessaire.",
      ]
        .filter(Boolean)
        .join(' '),
    };
  }

  // Un énoncé « vérifié » sans URL est invérifiable par le lecteur : le statut
  // ne peut pas être promu sans provenance résoluble.
  const urlSource = entree.source?.url;
  if (!urlSource) {
    return {
      ...base,
      note: [base.note, "Aucune URL de source n'est associée à cette référence : statut maintenu à « à vérifier »."]
        .filter(Boolean)
        .join(' '),
    };
  }

  return {
    ...base,
    // L'énoncé retenu est celui de la source, pas celui de l'index.
    enonce: texte,
    statut: 'verifie',
    source: { editeur: 'Légifrance', url: urlSource, consulteLe: aujourdhui() },
  };
}

/** Recherche complète pour une référence : texte + jurisprudence associée. */
export async function rechercher(
  reference: string,
  config: ConfigRecherche = {}
): Promise<ResultatRecherche> {
  const [texte, jurisprudence] = await Promise.all([
    verifierTexte(reference, config),
    rechercherJurisprudence(reference, config),
  ]);

  let avertissement: string | undefined;
  if (!config.judilibre) avertissement = AVERTISSEMENT_NON_CONFIGURE;
  else if (!jurisprudence.interrogee) avertissement = AVERTISSEMENT_INJOIGNABLE;
  else if (jurisprudence.decisions.length === 0) avertissement = AVERTISSEMENT_AUCUN_RESULTAT;

  return { reference, texte, decisions: jurisprudence.decisions, avertissement };
}
