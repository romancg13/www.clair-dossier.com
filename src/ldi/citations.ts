/**
 * LDI — vérificateur de citations.
 *
 * ┌─ POURQUOI CE MODULE EXISTE ─────────────────────────────────────────────┐
 * │ L'invite système interdit au modèle de citer de mémoire. Une consigne    │
 * │ d'invite n'est pas un garde-fou : elle n'est ni exécutée, ni vérifiable, │
 * │ ni opposable. Ce module est le contrôle qui s'exécute APRÈS génération,  │
 * │ sur le texte produit, avant qu'il n'atteigne l'avocat.                   │
 * │                                                                          │
 * │ Règle d'autorisation, volontairement étroite :                           │
 * │   — un article n'est citable que s'il figure dans les références du      │
 * │     contexte (l'index interne, résolu sur sa source) ;                   │
 * │   — un numéro de pourvoi n'est citable que s'il provient d'une décision  │
 * │     effectivement retournée par une source officielle.                   │
 * │                                                                          │
 * │ Ce que le texte du dossier contient n'entre JAMAIS dans l'ensemble       │
 * │ autorisé. C'est le point décisif : le contexte transmis au modèle inclut │
 * │ des extraits de pièces, et une référence fausse écrite dans une pièce —  │
 * │ par erreur, par la partie adverse, ou recopiée d'un chatbot — satisferait │
 * │ autrement la règle « ne cite que le contexte ». Le paramètre             │
 * │ `texteDuDossier` sert uniquement à qualifier l'alerte, jamais à l'ouvrir. │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
/**
 * Formes minimales attendues, déclarées ici plutôt qu'importées : ce fichier est
 * copié tel quel dans la fonction Deno, qui ne peut pas importer depuis `src/`.
 * `EnonceJuridique` et `DecisionJurisprudentielle` les satisfont structurellement.
 */
export type ReferenceCitable = { reference: string };
export type DecisionCitable = { numero: string };

export type Citations = {
  /** Numéros de pourvoi, sous la forme rencontrée dans le texte. */
  pourvois: string[];
  /** Numéros d'article (« 63-4-2 », « 222-37 »). */
  articles: string[];
  ecli: string[];
};

export type ContexteVerification = {
  /** Références autorisées : celles du contexte fourni au modèle. */
  references: ReferenceCitable[];
  /** Décisions effectivement retournées par une source officielle. */
  decisions: DecisionCitable[];
  /**
   * Texte d'origine dossier, facultatif. Sert à dire à l'avocat qu'une citation
   * rejetée provenait d'une pièce — pas à l'autoriser.
   */
  texteDuDossier?: string;
};

export type ResultatVerification = {
  conforme: boolean;
  /** Citations qu'aucune source n'appuie. */
  inconnues: string[];
  /** Texte annoté : chaque citation non vérifiée est signalée sur place. */
  texte: string;
  /** Message prêt à afficher, vide si tout est vérifié. */
  rapport: string;
};

// Deux formes rencontrées : « 21-80.642 » et « 19-84111 ».
const RE_POURVOI = /\b\d{2}-\d{2}\.\d{3}\b|\b\d{2}-\d{5}\b/g;
const RE_ARTICLE = /\b(?:articles?|art\.)\s+(\d+(?:-\d+)*)/gi;
const RE_ECLI = /\bECLI:[A-Z]{2}:[A-Z0-9]+:\d{4}:[A-Z0-9.]+\b/g;

/** Compare des numéros en ignorant points et espaces. */
function normaliser(valeur: string): string {
  return valeur.replace(/[.\s]/g, '');
}

function uniques(valeurs: string[]): string[] {
  return [...new Set(valeurs)];
}

export function extraireCitations(texte: string): Citations {
  const articles: string[] = [];
  for (const m of texte.matchAll(RE_ARTICLE)) articles.push(m[1]);

  return {
    pourvois: uniques(texte.match(RE_POURVOI) ?? []),
    articles: uniques(articles),
    ecli: uniques(texte.match(RE_ECLI) ?? []),
  };
}

/** Numéros d'article contenus dans une référence normalisée (« CPP, art. 63 »). */
function numerosAutorises(references: ReferenceCitable[]): Set<string> {
  const out = new Set<string>();
  for (const r of references) {
    for (const m of r.reference.matchAll(RE_ARTICLE)) out.add(m[1]);
  }
  return out;
}

/** Emplacement exact d'une citation dans un texte. */
type Zone = { valeur: string; debut: number; fin: number };

/**
 * Repère chaque citation avec son décalage. La valeur retournée est celle que
 * `extraireCitations` produit — numéro d'article capturé, pourvoi ou ECLI
 * entier — pour que la comparaison avec l'ensemble rejeté porte sur la même
 * chose des deux côtés.
 */
function zonesDesCitations(texte: string): Zone[] {
  const zones: Zone[] = [];

  for (const m of texte.matchAll(RE_ARTICLE)) {
    // Le numéro seul, pas le « art. » qui le précède : l'annotation se pose
    // après le numéro.
    const debut = m.index + m[0].length - m[1].length;
    zones.push({ valeur: m[1], debut, fin: debut + m[1].length });
  }
  for (const re of [RE_POURVOI, RE_ECLI]) {
    for (const m of texte.matchAll(re)) {
      zones.push({ valeur: m[0], debut: m.index, fin: m.index + m[0].length });
    }
  }

  return zones;
}

export function verifierCitations(
  sortie: string,
  contexte: ContexteVerification
): ResultatVerification {
  const citations = extraireCitations(sortie);

  const articlesOk = numerosAutorises(contexte.references);
  const pourvoisOk = new Set(contexte.decisions.map((d) => normaliser(d.numero)));

  const inconnues: string[] = [
    ...citations.articles.filter((a) => !articlesOk.has(a)),
    ...citations.pourvois.filter((p) => !pourvoisOk.has(normaliser(p))),
    // Un ECLI n'est jamais autorisé tant qu'aucune décision n'en porte un.
    ...citations.ecli,
  ];

  if (inconnues.length === 0) {
    return { conforme: true, inconnues: [], texte: sortie, rapport: '' };
  }

  const rejetees = new Set(inconnues);

  // Annotation sur place : la mention reste collée à la citation, elle ne peut
  // pas être perdue en recopiant un paragraphe.
  //
  // Par DÉCALAGE, jamais par sous-chaîne. Un numéro rejeté est souvent nu
  // (« 63 ») et se retrouve dans des références parfaitement autorisées :
  // annoter toutes ses occurrences transformait « 63-4-2 » en
  // « 63 [CITATION NON VÉRIFIÉE]-4-2 ». Le contrôle abîmait ainsi les citations
  // qu'il venait de valider, et l'avocat lisait une alerte au milieu d'un
  // article régulier.
  const aAnnoter = zonesDesCitations(sortie).filter((z) => rejetees.has(z.valeur));

  // De la fin vers le début : chaque insertion décale ce qui suit.
  let texte = sortie;
  for (const zone of [...aAnnoter].sort((a, b) => b.fin - a.fin)) {
    texte = `${texte.slice(0, zone.fin)} [CITATION NON VÉRIFIÉE — retirée du contexte]${texte.slice(zone.fin)}`;
  }

  // Même exigence de précision pour l'attribution au dossier : « 63 » présent
  // dans « 63-4-2 » d'une pièce ne prouve pas que « 63 » vienne de cette pièce.
  const citationsDuDossier = contexte.texteDuDossier
    ? new Set(zonesDesCitations(contexte.texteDuDossier).map((z) => z.valeur))
    : new Set<string>();
  const duDossier = inconnues.filter((i) => citationsDuDossier.has(i));

  const lignes = [
    `${inconnues.length} citation(s) ne sont appuyées par aucune source interrogée : ${inconnues.join(', ')}.`,
    "Elles ne doivent pas être reprises. Non trouvé dans les sources interrogées.",
  ];
  if (duDossier.length > 0) {
    lignes.push(
      `Dont ${duDossier.length} figurant dans le texte du dossier lui-même (${duDossier.join(', ')}) : une référence écrite dans une pièce n'est pas une source. Vérifier son origine.`
    );
  }

  return { conforme: false, inconnues, texte, rapport: lignes.join(' ') };
}
