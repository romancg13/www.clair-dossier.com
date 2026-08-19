/**
 * LDI — coffre chiffré du plan de travail.
 *
 * ┌─ CE QUE CE MODULE PROTÈGE, ET CE QU'IL NE PROTÈGE PAS ──────────────────┐
 * │ IL PROTÈGE contre la lecture du support : un poste volé, un profil de    │
 * │ navigateur copié, un collègue qui ouvre les outils de développement sur  │
 * │ la machine du cabinet. Sans la phrase, le contenu du coffre est du bruit.│
 * │                                                                          │
 * │ IL NE PROTÈGE PAS contre un navigateur compromis. Une extension          │
 * │ malveillante lit la phrase pendant qu'elle est frappée, et le contenu    │
 * │ déchiffré pendant que le coffre est ouvert. Le chiffrement au repos ne   │
 * │ répond pas à cette menace-là, et prétendre le contraire serait pire que  │
 * │ ne rien chiffrer : l'avocat baisserait sa garde.                         │
 * │                                                                          │
 * │ IL NE PROTÈGE PAS non plus d'une phrase faible. Le facteur de travail    │
 * │ ci-dessous rend l'essai coûteux, pas impossible.                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Aucune dépendance : `crypto.subtle` est fourni par la plateforme, dans le
 * navigateur comme dans Node. C'est aussi ce qui rend le module testable sans
 * navigateur — et donc réellement testé.
 *
 * ┌─ LA PHRASE N'EST ÉCRITE NULLE PART ─────────────────────────────────────┐
 * │ Ni en clair, ni empreintée, ni dans une clé de stockage, ni dans l'URL.  │
 * │ Il n'existe donc AUCUN moyen de vérifier une phrase sans tenter de       │
 * │ déchiffrer, et aucun moyen de récupérer un coffre dont la phrase est     │
 * │ perdue. C'est un choix : une trappe de secours est une trappe.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/**
 * Nombre d'itérations PBKDF2.
 *
 * Mesuré sur ce projet : 1 200 000 itérations coûtent 178 ms en Node, soit
 * quelques centaines de millisecondes dans un navigateur. C'est le prix d'une
 * ouverture de coffre — payé une fois par session, jamais à chaque écriture,
 * puisque la clé dérivée est conservée en mémoire.
 *
 * Le compte est ÉCRIT DANS L'ENVELOPPE, pas seulement ici : un coffre scellé
 * aujourd'hui restera lisible si cette constante est relevée demain.
 */
export const ITERATIONS = 1_200_000;

/** Version du format. Sert à refuser proprement ce qu'on ne sait pas lire. */
export const VERSION_COFFRE = 1;

/**
 * Enveloppe scellée, telle qu'elle est écrite sur le support.
 *
 * Rien ici n'est secret : sel, vecteur d'initialisation et compte d'itérations
 * sont publics par construction. Le secret, c'est la phrase — qui n'y figure
 * pas, et le contenu, qui n'est lisible qu'avec elle.
 */
export type CoffreScelle = {
  version: number;
  /** Sel de dérivation, base64. Fixe pour un coffre donné. */
  sel: string;
  /** Vecteur d'initialisation, base64. NEUF à chaque écriture. */
  iv: string;
  iterations: number;
  /** Contenu chiffré et authentifié, base64. */
  chiffre: string;
  /** Horodatage ISO de la dernière écriture. Non chiffré, volontairement :
   *  savoir QUAND on a travaillé sans pouvoir ouvrir le coffre n'apprend rien
   *  d'utile à un tiers, et permet d'afficher un état sans phrase. */
  ecritLe: string;
};

/** Clé de session : dérivée une fois, gardée en mémoire, jamais extractible. */
export type CoffreOuvert = {
  readonly cle: CryptoKey;
  readonly sel: Uint8Array;
  readonly iterations: number;
};

export type EchecOuverture = {
  ok: false;
  /**
   * `phrase-ou-alteration` couvre les deux cas indistinguables : phrase fausse
   * ou contenu modifié. AES-GCM échoue de la même façon pour l'un et l'autre,
   * et prétendre les départager serait inventer une information.
   */
  motif: 'phrase-ou-alteration' | 'format-inconnu' | 'enveloppe-illisible';
  message: string;
};

const encodeur = new TextEncoder();
const decodeur = new TextDecoder();

function sousCrypto(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    // Sans `crypto.subtle`, on ne dégrade pas vers un stockage en clair : on
    // refuse. Un repli silencieux vers le clair est exactement le défaut que
    // ce module existe pour empêcher.
    throw new Error(
      "Chiffrement indisponible sur ce support (crypto.subtle absent). Aucun repli en clair n'est prévu : la conservation reste désactivée."
    );
  }
  return c.subtle;
}

/** Octets aléatoires, du générateur de la plateforme — jamais de `Math.random`. */
function alea(n: number): Uint8Array {
  const octets = new Uint8Array(n);
  globalThis.crypto.getRandomValues(octets);
  return octets;
}

export function versBase64(octets: Uint8Array): string {
  let binaire = '';
  for (let i = 0; i < octets.length; i += 1) binaire += String.fromCharCode(octets[i]);
  return btoa(binaire);
}

export function depuisBase64(texte: string): Uint8Array {
  const binaire = atob(texte);
  const octets = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i += 1) octets[i] = binaire.charCodeAt(i);
  return octets;
}

/**
 * Dérive la clé de chiffrement depuis la phrase.
 *
 * `extractable: false` : la clé ne peut plus être relue par du script une fois
 * dérivée, y compris par le nôtre. C'est ce qui distingue une clé WebCrypto
 * d'un tableau d'octets qu'on croirait secret.
 */
async function deriver(phrase: string, sel: Uint8Array, iterations: number): Promise<CryptoKey> {
  const subtle = sousCrypto();

  const matiere = await subtle.importKey('raw', encodeur.encode(phrase), 'PBKDF2', false, [
    'deriveKey',
  ]);

  return subtle.deriveKey(
    { name: 'PBKDF2', salt: sel as BufferSource, iterations, hash: 'SHA-256' },
    matiere,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * En-tête lié au chiffré comme donnée authentifiée.
 *
 * Sans cette liaison, on pourrait réécrire `iterations` dans l'enveloppe sans
 * que rien ne le signale. Le déchiffrement échouerait de toute façon — mais il
 * échouerait pour une raison qu'on ne saurait pas nommer.
 */
function enTete(version: number, iterations: number, sel: Uint8Array): Uint8Array {
  return encodeur.encode(`ldi.coffre/${version}/${iterations}/${versBase64(sel)}`);
}

/** Crée un coffre neuf : sel tiré au hasard, clé dérivée, rien d'écrit encore. */
export async function creerCoffre(phrase: string): Promise<CoffreOuvert> {
  exigerPhrase(phrase);
  const sel = alea(16);
  return { cle: await deriver(phrase, sel, ITERATIONS), sel, iterations: ITERATIONS };
}

/**
 * Ouvre un coffre existant avec la phrase fournie.
 *
 * L'ouverture DÉCHIFFRE réellement : c'est le seul moyen de savoir si la
 * phrase est la bonne, puisque rien qui permettrait de la vérifier autrement
 * n'est conservé.
 */
export async function ouvrirCoffre(
  enveloppe: CoffreScelle,
  phrase: string
): Promise<({ ok: true; coffre: CoffreOuvert; contenu: string }) | EchecOuverture> {
  if (enveloppe.version !== VERSION_COFFRE) {
    return {
      ok: false,
      motif: 'format-inconnu',
      message: `Coffre en version ${enveloppe.version}, cette application lit la version ${VERSION_COFFRE}. Rien n'est modifié.`,
    };
  }

  let sel: Uint8Array;
  let iv: Uint8Array;
  let chiffre: Uint8Array;
  try {
    sel = depuisBase64(enveloppe.sel);
    iv = depuisBase64(enveloppe.iv);
    chiffre = depuisBase64(enveloppe.chiffre);
  } catch {
    return {
      ok: false,
      motif: 'enveloppe-illisible',
      message: "L'enveloppe du coffre est illisible. Le contenu n'est pas récupérable par cette application.",
    };
  }

  if (!Number.isInteger(enveloppe.iterations) || enveloppe.iterations < 1) {
    return {
      ok: false,
      motif: 'enveloppe-illisible',
      message: "Compte d'itérations invalide dans l'enveloppe : ouverture refusée.",
    };
  }

  const cle = await deriver(phrase, sel, enveloppe.iterations);

  try {
    const clair = await sousCrypto().decrypt(
      {
        name: 'AES-GCM',
        iv: iv as BufferSource,
        additionalData: enTete(enveloppe.version, enveloppe.iterations, sel) as BufferSource,
      },
      cle,
      chiffre as BufferSource
    );

    return {
      ok: true,
      coffre: { cle, sel, iterations: enveloppe.iterations },
      contenu: decodeur.decode(clair),
    };
  } catch {
    return {
      ok: false,
      motif: 'phrase-ou-alteration',
      message:
        "Le coffre ne s'ouvre pas : phrase incorrecte, ou contenu modifié depuis le scellement. Ces deux causes sont indistinguables et l'outil ne les départage pas.",
    };
  }
}

/**
 * Scelle un contenu dans un coffre ouvert.
 *
 * Un vecteur d'initialisation NEUF est tiré à chaque appel. Réutiliser un IV
 * avec la même clé en AES-GCM ne dégrade pas la confidentialité : elle
 * l'anéantit. C'est la seule règle de ce module qu'on ne peut pas assouplir.
 */
export async function sceller(
  coffre: CoffreOuvert,
  contenu: string,
  maintenant: string
): Promise<CoffreScelle> {
  const iv = alea(12);

  const chiffre = await sousCrypto().encrypt(
    {
      name: 'AES-GCM',
      iv: iv as BufferSource,
      additionalData: enTete(VERSION_COFFRE, coffre.iterations, coffre.sel) as BufferSource,
    },
    coffre.cle,
    encodeur.encode(contenu) as BufferSource
  );

  return {
    version: VERSION_COFFRE,
    sel: versBase64(coffre.sel),
    iv: versBase64(iv),
    iterations: coffre.iterations,
    chiffre: versBase64(new Uint8Array(chiffre)),
    ecritLe: maintenant,
  };
}

/**
 * Longueur minimale d'une phrase.
 *
 * Douze caractères, pas huit : le facteur de travail rend l'essai coûteux, il
 * ne le rend pas impossible, et une phrase courte reste une phrase courte.
 * Aucune exigence de casse ou de symboles — elles produisent des phrases
 * courtes et notées sur un papier, pas des phrases fortes.
 */
export const LONGUEUR_MIN_PHRASE = 12;

export function exigerPhrase(phrase: string): void {
  if (phrase.length < LONGUEUR_MIN_PHRASE) {
    throw new Error(
      `Phrase de ${phrase.length} caractère(s) : il en faut au moins ${LONGUEUR_MIN_PHRASE}. Une phrase entière, faite de mots, vaut mieux qu'un mot de passe court et compliqué.`
    );
  }
}

/**
 * Vérifie qu'une valeur relue du support a bien la forme d'une enveloppe.
 *
 * Ce qui n'a pas cette forme est refusé AVANT toute tentative de dérivation :
 * inutile de faire payer 1,2 million d'itérations pour un contenu qui n'est
 * pas un coffre.
 */
export function estEnveloppe(valeur: unknown): valeur is CoffreScelle {
  if (typeof valeur !== 'object' || valeur === null) return false;
  const c = valeur as Partial<CoffreScelle>;
  return (
    typeof c.version === 'number' &&
    typeof c.sel === 'string' &&
    typeof c.iv === 'string' &&
    typeof c.iterations === 'number' &&
    typeof c.chiffre === 'string' &&
    typeof c.ecritLe === 'string'
  );
}
