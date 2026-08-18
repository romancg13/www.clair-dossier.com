/**
 * LDI — Module 4 : signaux de rédaction automatisée.
 *
 * ┌─ CE QUE CE MODULE NE FAIT PAS ──────────────────────────────────────────┐
 * │ Il ne détermine pas si un texte a été écrit par une IA. Aucune méthode   │
 * │ statistique publique ne le permet de façon fiable, et les taux de faux   │
 * │ positifs des détecteurs existants sont élevés, notamment sur les écrits  │
 * │ techniques normés — ce qu'est précisément un rapport d'expertise ou un   │
 * │ procès-verbal. Un style homogène est le produit normal d'une trame       │
 * │ imposée.                                                                 │
 * │                                                                          │
 * │ Le cahier des charges initial demandait un indice « confiance_human :    │
 * │ 87 % ». Ce module ne produit pas ce chiffre : une probabilité affichée   │
 * │ sur une méthode non calibrée transforme une intuition en apparence de    │
 * │ mesure, et c'est exactement ce qu'un contradicteur démonterait à         │
 * │ l'audience.                                                              │
 * │                                                                          │
 * │ Ce que le module produit : des mesures brutes, reproductibles et         │
 * │ vérifiables, qui servent à motiver une demande d'acte — fichier natif,   │
 * │ métadonnées, contre-expertise — et rien de plus.                         │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { AnalyseTextuelle, Piece, SignalTextuel } from '../types';

/**
 * Seuils de déclenchement.
 *
 * AVERTISSEMENT : valeurs de départ, fixées par jugement d'ingénierie et NON
 * calibrées sur un corpus annoté de procédures françaises. Elles décident de ce
 * qui est signalé à l'avocat, jamais de ce qui est vrai. Toute utilisation
 * sérieuse suppose une calibration sur un échantillon de pièces authentiques du
 * ressort concerné (cf. docs/LDI.md, § « Calibration »).
 */
export const SEUILS_DETECTION = {
  /** Écart-type de la longueur des phrases, en mots. Sous ce seuil : régularité inhabituelle. */
  ecartTypeLongueurPhrase: 5,
  /** Ratio de mots distincts sur les 300 premiers mots. */
  diversiteLexicale: 0.45,
  /** Part des quadrigrammes répétés au moins une fois. */
  repetitionQuadrigrammes: 0.02,
  /** Connecteurs logiques pour 100 mots. */
  densiteConnecteurs: 3.5,
  /** Nombre de signes de ponctuation distincts employés. */
  varietePonctuation: 3,
  /** En deçà, aucune mesure n'est fiable. */
  motsMinimum: 300,
} as const;

const CONNECTEURS = [
  'en outre',
  'par ailleurs',
  'toutefois',
  'néanmoins',
  'cependant',
  'de plus',
  'en effet',
  'ainsi',
  'de surcroît',
  'dès lors',
  'en revanche',
  'notamment',
  'il convient de',
  'il est important de',
  'en conclusion',
  'force est de constater',
];

const REGEX_MOT = /[\p{L}\p{N}''-]+/gu;

export function decouperPhrases(texte: string): string[] {
  return texte
    .split(/(?<=[.!?…])\s+/u)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function extraireMots(texte: string): string[] {
  return (texte.toLowerCase().match(REGEX_MOT) ?? []).filter((m) => m.length > 0);
}

function ecartType(valeurs: number[]): number {
  if (valeurs.length < 2) return 0;
  const moyenne = valeurs.reduce((a, b) => a + b, 0) / valeurs.length;
  const variance = valeurs.reduce((a, b) => a + (b - moyenne) ** 2, 0) / (valeurs.length - 1);
  return Math.sqrt(variance);
}

/** Part des quadrigrammes apparaissant plus d'une fois. */
export function tauxRepetitionQuadrigrammes(mots: string[]): number {
  if (mots.length < 8) return 0;
  const comptes = new Map<string, number>();
  for (let i = 0; i + 4 <= mots.length; i += 1) {
    const cle = mots.slice(i, i + 4).join(' ');
    comptes.set(cle, (comptes.get(cle) ?? 0) + 1);
  }
  let repetes = 0;
  for (const n of comptes.values()) if (n > 1) repetes += 1;
  return comptes.size === 0 ? 0 : repetes / comptes.size;
}

/**
 * Un comptage par sous-chaîne gonfle la mesure : « de plusieurs » compterait
 * comme « de plus », « en effets » comme « en effet ». Le module publie ce
 * nombre comme une mesure brute et reproductible — il doit compter des mots.
 */
const REGEX_CONNECTEURS = CONNECTEURS.map(
  (c) =>
    new RegExp(
      // String.raw est indispensable : dans un littéral de gabarit ordinaire,
      // « \p » se réduit à « p ». Les bornes devenaient la classe littérale
      // [p{L}p{N}], et « de plus » était alors compté dans « de plusieurs » —
      // une densité de connecteurs surévaluée, remontée telle quelle à
      // l'avocat. Le même piège avait été corrigé dans confidentialite.ts,
      // par concaténation ; il était resté ici.
      String.raw`(?<![\p{L}\p{N}])${c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\p{L}\p{N}])`,
      'giu'
    )
);

function densiteConnecteurs(texte: string, nbMots: number): number {
  let total = 0;
  for (const regex of REGEX_CONNECTEURS) {
    total += (texte.match(regex) ?? []).length;
  }
  return nbMots === 0 ? 0 : (total / nbMots) * 100;
}

function varietePonctuation(texte: string): number {
  const signes = new Set<string>();
  for (const c of texte) if (',;:—–()[]«»"\'!?…-'.includes(c)) signes.add(c);
  return signes.size;
}

// ---------------------------------------------------------------------------
// Entrée du module
// ---------------------------------------------------------------------------

export function analyserPiece(piece: Piece): AnalyseTextuelle {
  const texte = piece.texte ?? '';
  const mots = extraireMots(texte);
  const phrases = decouperPhrases(texte);
  const fiable = mots.length >= SEUILS_DETECTION.motsMinimum;

  const longueurs = phrases.map((p) => extraireMots(p).length).filter((n) => n > 0);
  const ecart = ecartType(longueurs);

  const fenetre = mots.slice(0, 300);
  const diversite = fenetre.length === 0 ? 1 : new Set(fenetre).size / fenetre.length;

  const repetition = tauxRepetitionQuadrigrammes(mots);
  const connecteurs = densiteConnecteurs(texte, mots.length);
  const ponctuation = varietePonctuation(texte);

  const signaux: SignalTextuel[] = [
    {
      id: 'regularite-phrases',
      intitule: 'Régularité de la longueur des phrases',
      valeur: Number(ecart.toFixed(2)),
      seuil: SEUILS_DETECTION.ecartTypeLongueurPhrase,
      declenche: longueurs.length >= 5 && ecart < SEUILS_DETECTION.ecartTypeLongueurPhrase,
      interpretation:
        "Une longueur de phrase très régulière est fréquente dans les textes générés. Elle l'est tout autant dans les documents rédigés sur trame imposée : à elle seule, la mesure ne dit rien.",
    },
    {
      id: 'diversite-lexicale',
      intitule: 'Diversité lexicale (300 premiers mots)',
      valeur: Number(diversite.toFixed(3)),
      seuil: SEUILS_DETECTION.diversiteLexicale,
      declenche: fiable && diversite < SEUILS_DETECTION.diversiteLexicale,
      interpretation:
        "Un vocabulaire pauvre peut signaler une production automatique comme un rédacteur pressé recopiant ses propres formules.",
    },
    {
      id: 'repetition-quadrigrammes',
      intitule: 'Répétition de séquences de quatre mots',
      valeur: Number(repetition.toFixed(4)),
      seuil: SEUILS_DETECTION.repetitionQuadrigrammes,
      declenche: repetition > SEUILS_DETECTION.repetitionQuadrigrammes,
      interpretation:
        "Des séquences identiques réapparaissant dans le texte. À rapprocher d'un éventuel copier-coller entre pièces du dossier — comparaison inter-pièces plus parlante que la mesure isolée.",
    },
    {
      id: 'densite-connecteurs',
      intitule: 'Densité de connecteurs logiques (pour 100 mots)',
      valeur: Number(connecteurs.toFixed(2)),
      seuil: SEUILS_DETECTION.densiteConnecteurs,
      declenche: connecteurs > SEUILS_DETECTION.densiteConnecteurs,
      interpretation:
        "Un enchaînement très articulé (« en outre », « par ailleurs », « il convient de ») est caractéristique des rédactions génératives, et aussi des rédacteurs formés à l'écrit administratif.",
    },
    {
      id: 'variete-ponctuation',
      intitule: 'Variété de la ponctuation',
      valeur: ponctuation,
      seuil: SEUILS_DETECTION.varietePonctuation,
      declenche: fiable && ponctuation < SEUILS_DETECTION.varietePonctuation,
      interpretation:
        "Une ponctuation uniforme (points seuls) accompagne souvent les textes générés. Les procès-verbaux authentiques comportent en général abréviations, tirets et incises.",
    },
  ];

  const declenches = signaux.filter((s) => s.declenche).length;

  let conclusion: string;
  if (!fiable) {
    conclusion = `Texte trop court (${mots.length} mots, minimum ${SEUILS_DETECTION.motsMinimum}) : aucune mesure exploitable. Aucune conclusion ne peut être tirée dans un sens ou dans l'autre.`;
  } else if (declenches === 0) {
    conclusion = "Aucun signal relevé. Cela n'établit pas que la pièce a été rédigée par une personne.";
  } else if (declenches <= 2) {
    conclusion = `${declenches} signal(aux) sur ${signaux.length}. Faisceau faible, compatible avec une rédaction humaine sur trame normée.`;
  } else {
    conclusion = `${declenches} signaux sur ${signaux.length}. Faisceau notable : il justifie une vérification documentaire, pas une conclusion sur l'auteur.`;
  }

  const recommandation =
    declenches >= 3 && fiable
      ? "Demander le fichier natif et ses métadonnées (auteur, logiciel, dates de création et de modification), l'identité et la qualification du rédacteur, ainsi que les pièces de travail. Envisager une demande de contre-expertise sur le fond plutôt que sur le style : le contenu se conteste mieux que la manière."
      : "Aucune démarche fondée sur ces seules mesures. Si la pièce est contestée, la contester sur son contenu, sa méthode et ses conclusions.";

  return {
    pieceId: piece.id,
    motsAnalyses: mots.length,
    fiable,
    signaux,
    signauxDeclenches: declenches,
    conclusion,
    recommandation,
  };
}

/** Analyse toutes les pièces porteuses d'un texte exploitable. */
export function analyserPieces(pieces: Piece[]): AnalyseTextuelle[] {
  return pieces.filter((p) => p.texte && p.texte.trim().length > 0).map(analyserPiece);
}
