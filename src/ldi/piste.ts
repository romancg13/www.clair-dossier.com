/**
 * LDI — accès aux API PISTE (Judilibre, Légifrance).
 *
 * ┌─ CE MODULE NE PRODUIT AUCUNE RÉFÉRENCE ─────────────────────────────────┐
 * │ Il relaie ce qu'une API officielle a répondu, et rien d'autre. Il ne     │
 * │ complète pas une entrée incomplète, il ne déduit pas une juridiction     │
 * │ absente, il n'a aucune base locale d'arrêts.                             │
 * │                                                                          │
 * │ Un numéro de pourvoi inventé est indétectable à l'œil et ne se découvre  │
 * │ faux qu'à l'audience. Le seul moyen sûr de n'en produire aucun est de    │
 * │ n'avoir aucun chemin de code capable d'en fabriquer.                     │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ CE QUI N'A PAS ÉTÉ VÉRIFIÉ ────────────────────────────────────────────┐
 * │ Ce module n'a JAMAIS été exercé contre le service PISTE réel : ce dépôt  │
 * │ ne détient aucun identifiant. Il est testé contre un service simulé, ce  │
 * │ qui vérifie la logique du relais et sa résistance aux réponses           │
 * │ inattendues — pas la forme exacte des requêtes que PISTE attend.         │
 * │                                                                          │
 * │ La liste de ce qui reste à confirmer est dans docs/RECHERCHE-JURIDIQUE.md│
 * │ Toute la lecture des réponses est donc défensive : ce qui n'a pas la     │
 * │ forme attendue est ignoré, jamais complété.                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

export type IdentifiantsPiste = {
  clientId: string;
  clientSecret: string;
  /** Point d'échange du jeton OAuth2. */
  urlOauth: string;
  /** Base de l'API Judilibre, barre finale comprise ou non. */
  urlJudilibre: string;
};

export type OptionsAppel = {
  /** Injection pour les tests, et pour Deno qui fournit son propre `fetch`. */
  fetchImpl?: typeof fetch;
  /** Délai maximal par appel réseau, en millisecondes. */
  delaiMs?: number;
  /** Horloge injectable — le cache de jeton se teste sans attendre. */
  maintenant?: () => number;
};

/** Décision restituée par la source, jamais construite ici. */
export type DecisionRelayee = {
  numero: string;
  date: string;
  juridiction: string;
  chambre: string;
  sommaire: string;
  /** URL de la décision chez l'éditeur, `null` si la source n'en donne pas. */
  url: string | null;
};

export type ResultatRelais = {
  reference: string;
  decisions: DecisionRelayee[];
  /**
   * `false` lorsque la source n'a pas répondu (réseau, délai, statut non 2xx).
   *
   * Distinguer ce cas d'une réponse vide est essentiel : dire « source
   * injoignable » alors que Judilibre a répondu « aucune décision » est une
   * affirmation fausse, dans un document dont l'avocat se sert.
   */
  interrogee: boolean;
  /** Ce que la source n'a pas su faire, dit en clair. Vide si tout va bien. */
  avertissement: string;
};

/** Nombre maximal de décisions retenues par référence. */
export const DECISIONS_MAX = 10;

/** Nombre maximal de références par appel — borne le quota consommé. */
export const REFERENCES_MAX = 8;

/** Marge avant expiration du jeton : on renouvelle avant d'être refusé. */
const MARGE_EXPIRATION_MS = 60_000;

/** Taille maximale d'une réponse lue, en octets. */
const REPONSE_MAX_OCTETS = 2_000_000;

type JetonCache = { valeur: string; expireA: number };

/**
 * Cache de jeton, par identifiant client.
 *
 * Un jeton OAuth vaut typiquement une heure : le redemander à chaque recherche
 * consommerait le quota d'authentification pour rien. Il n'est jamais écrit
 * ailleurs qu'ici, jamais renvoyé à l'appelant, jamais journalisé.
 */
const jetons = new Map<string, JetonCache>();

/** Vide le cache de jetons. Utilisé par les tests, et au changement de secret. */
export function oublierJetons(): void {
  jetons.clear();
}

async function avecDelai(
  appel: typeof fetch,
  url: string,
  init: RequestInit,
  delaiMs: number
): Promise<Response | null> {
  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), delaiMs);
  try {
    return await appel(url, { ...init, signal: controleur.signal });
  } catch {
    // Réseau coupé, délai dépassé, réponse illisible : la source est tenue
    // pour injoignable. Elle n'est jamais tenue pour « sans résultat ».
    return null;
  } finally {
    clearTimeout(minuterie);
  }
}

/**
 * Lit un corps JSON en refusant les réponses démesurées.
 *
 * Une réponse de plusieurs centaines de mégaoctets ne se distingue pas d'une
 * réponse normale avant de l'avoir lue : la borne existe pour que le relais
 * échoue proprement plutôt que d'épuiser la mémoire de la fonction.
 */
async function jsonBorne(reponse: Response): Promise<unknown | null> {
  const annonce = Number(reponse.headers.get('content-length'));
  if (Number.isFinite(annonce) && annonce > REPONSE_MAX_OCTETS) return null;

  try {
    const texte = await reponse.text();
    if (texte.length > REPONSE_MAX_OCTETS) return null;
    return JSON.parse(texte) as unknown;
  } catch {
    return null;
  }
}

/**
 * Obtient un jeton OAuth2 par le flux `client_credentials`.
 *
 * Renvoie `null` sur tout échec — jamais un jeton vide qu'un appel suivant
 * enverrait comme s'il était valide.
 */
export async function obtenirJeton(
  identifiants: IdentifiantsPiste,
  options: OptionsAppel = {}
): Promise<string | null> {
  const appel = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!appel) return null;

  const horloge = options.maintenant ?? (() => Date.now());
  const enCache = jetons.get(identifiants.clientId);
  if (enCache && enCache.expireA - MARGE_EXPIRATION_MS > horloge()) return enCache.valeur;

  const corps = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: identifiants.clientId,
    client_secret: identifiants.clientSecret,
    scope: 'openid',
  });

  const reponse = await avecDelai(
    appel,
    identifiants.urlOauth,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: corps.toString(),
    },
    options.delaiMs ?? 10_000
  );

  if (!reponse || !reponse.ok) return null;

  const charge = await jsonBorne(reponse);
  const jeton = texte(charge, 'access_token');
  if (!jeton) return null;

  const duree = Number((charge as Record<string, unknown>)?.expires_in);
  const valide = Number.isFinite(duree) && duree > 0 ? duree * 1000 : 3_600_000;
  jetons.set(identifiants.clientId, { valeur: jeton, expireA: horloge() + valide });

  return jeton;
}

/** Premier champ non vide parmi les noms donnés. Lecture volontairement souple. */
function texte(objet: unknown, ...cles: string[]): string | undefined {
  if (typeof objet !== 'object' || objet === null) return undefined;
  const enregistrement = objet as Record<string, unknown>;
  for (const cle of cles) {
    const valeur = enregistrement[cle];
    if (typeof valeur === 'string' && valeur.trim() !== '') return valeur.trim();
  }
  return undefined;
}

function liste(charge: unknown): unknown[] {
  if (Array.isArray(charge)) return charge;
  if (typeof charge === 'object' && charge !== null) {
    const enregistrement = charge as Record<string, unknown>;
    for (const cle of ['results', 'resultats', 'items', 'data']) {
      if (Array.isArray(enregistrement[cle])) return enregistrement[cle] as unknown[];
    }
  }
  return [];
}

/**
 * Convertit une entrée de réponse en décision.
 *
 * Rend `null` dès que le numéro ou la date manquent. Mieux vaut perdre un
 * arrêt réel que produire une référence incomplète qu'un lecteur pressé
 * citerait telle quelle — et une date absente, remplacée par un défaut, est
 * exactement le genre d'erreur qui se découvre à l'audience.
 *
 * La juridiction et le sommaire, eux, sont facultatifs : leur absence
 * s'ÉCRIT, elle ne se comble pas.
 */
export function versDecisionRelayee(brut: unknown): DecisionRelayee | null {
  const numero = texte(brut, 'number', 'numero', 'numeroPourvoi');
  const date = texte(brut, 'decision_date', 'date', 'dateDecision');
  if (!numero || !date) return null;

  const sommaire =
    texte(brut, 'summary', 'sommaire', 'solution', 'text') ??
    'Sommaire non restitué par la source : lire la décision intégrale.';

  return {
    numero,
    date,
    juridiction:
      texte(brut, 'jurisdiction', 'juridiction') ??
      'Juridiction non restituée par la source : lire la décision intégrale.',
    chambre: texte(brut, 'chamber', 'chambre') ?? '',
    sommaire: sommaire.length > 600 ? `${sommaire.slice(0, 597)}…` : sommaire,
    url: texte(brut, 'url', 'lien') ?? null,
  };
}

/**
 * Interroge Judilibre pour une référence de texte.
 *
 * La référence est passée telle quelle : elle vient du corpus, jamais d'un
 * champ libre. C'est ce qui garantit qu'aucun élément du dossier ne peut
 * partir dans une requête de recherche.
 */
export async function chercherJurisprudence(
  reference: string,
  identifiants: IdentifiantsPiste,
  options: OptionsAppel = {}
): Promise<ResultatRelais> {
  const appel = options.fetchImpl ?? (typeof fetch === 'function' ? fetch : undefined);
  if (!appel) {
    return { reference, decisions: [], interrogee: false, avertissement: SANS_RESEAU };
  }

  const jeton = await obtenirJeton(identifiants, options);
  if (!jeton) {
    return { reference, decisions: [], interrogee: false, avertissement: SANS_JETON };
  }

  // Sans barre finale, `new URL('search', '…/v1.0')` remplace le dernier
  // segment au lieu de s'y ajouter : la requête partirait sur un chemin
  // inexistant et le relais conclurait à tort que la source est injoignable.
  const base = identifiants.urlJudilibre.endsWith('/')
    ? identifiants.urlJudilibre
    : `${identifiants.urlJudilibre}/`;

  const url = new URL('search', base);
  url.searchParams.set('query', reference);
  url.searchParams.set('field', 'text');
  url.searchParams.set('resolve_references', 'true');
  url.searchParams.set('page_size', String(DECISIONS_MAX));

  const reponse = await avecDelai(
    appel,
    url.toString(),
    { headers: { Authorization: `Bearer ${jeton}`, Accept: 'application/json' } },
    options.delaiMs ?? 10_000
  );

  if (!reponse || !reponse.ok) {
    return { reference, decisions: [], interrogee: false, avertissement: INJOIGNABLE };
  }

  const charge = await jsonBorne(reponse);
  if (charge === null) {
    return { reference, decisions: [], interrogee: false, avertissement: REPONSE_ILLISIBLE };
  }

  const brutes = liste(charge);
  const decisions = brutes
    .map(versDecisionRelayee)
    .filter((d): d is DecisionRelayee => d !== null)
    .slice(0, DECISIONS_MAX);

  const ignorees = brutes.length - decisions.length;

  return {
    reference,
    decisions,
    interrogee: true,
    avertissement:
      decisions.length === 0
        ? AUCUN_RESULTAT
        : ignorees > 0
          ? `${ignorees} entrée(s) écartée(s) faute de numéro ou de date : une référence incomplète ne doit pas être citée.`
          : '',
  };
}

const SANS_RESEAU =
  "Aucun accès réseau dans cet environnement : aucune décision n'est retournée.";

const SANS_JETON =
  "L'authentification auprès de PISTE a échoué : aucune décision n'est retournée. Vérifier les identifiants de l'opérateur.";

const INJOIGNABLE =
  "La source officielle n'a pas pu être interrogée. L'absence de résultat ne signifie pas l'absence de jurisprudence.";

const REPONSE_ILLISIBLE =
  "La source officielle a répondu, mais sa réponse n'est pas exploitable. Aucune décision n'est retournée.";

const AUCUN_RESULTAT =
  "La source officielle a répondu sans aucune décision pour cette référence. Une recherche manuelle sur Judilibre reste nécessaire avant toute citation.";
