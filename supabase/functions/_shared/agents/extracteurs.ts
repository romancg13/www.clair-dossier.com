/**
 * Extraction DÉTERMINISTE (règle 0.2 : jamais un modèle pour ce qu'une expression
 * régulière résout) des éléments à forme fixe : dates, montants, références,
 * SIREN / SIRET, courriels, IBAN. Chaque extraction porte sa page, ses offsets
 * exacts dans le texte de la page et l'extrait (la phrase) qui la contient :
 * l'ancrage est acquis par construction.
 */
import { segmenter } from "../pipeline/decoupage.ts";

export type TypeEntite =
  | "personne" | "societe" | "adresse" | "courriel" | "telephone" | "date" | "montant"
  | "reference" | "siren" | "siret" | "clause" | "role";

export type Extraction = {
  type: TypeEntite;
  valeur_normalisee: string;
  valeur_brute: string;
  page: number;
  offset_debut: number;
  offset_fin: number;
  extrait: string;
  extrait_debut: number;
  extrait_fin: number;
  /** Confiance de la règle (précision mesurée sur le jeu d'essai ; jamais 1). */
  confiance: number;
};

export type DonneeSensible = { type: "iban" | "nir"; page: number };

const MOIS: Record<string, number> = {
  janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7,
  aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12,
};

function dateValide(a: number, m: number, j: number): boolean {
  if (m < 1 || m > 12 || j < 1 || j > 31 || a < 1900 || a > 2100) return false;
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

const iso = (a: number, m: number, j: number) => `${a}-${String(m).padStart(2, "0")}-${String(j).padStart(2, "0")}`;

/** Phrase (segment) contenant la position, bornée à 300 caractères. */
export function extraitAutour(texte: string, debut: number, fin: number): { extrait: string; extrait_debut: number; extrait_fin: number } {
  const segment = segmenter(texte).find((s) => s.debut <= debut && fin <= s.fin);
  let d = segment?.debut ?? Math.max(0, debut - 80);
  let f = segment?.fin ?? Math.min(texte.length, fin + 80);
  if (f - d > 300) {
    d = Math.max(d, debut - 120);
    f = Math.min(f, fin + 120);
  }
  return { extrait: texte.slice(d, f), extrait_debut: d, extrait_fin: f };
}

type Regle = { type: TypeEntite; regex: RegExp; confiance: number; normaliser: (m: RegExpMatchArray) => string | null };

const REGLES: Regle[] = [
  {
    type: "date", confiance: 0.99,
    regex: /\b(\d{1,2})(?:er)?\s+(janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[uû]t|septembre|octobre|novembre|d[ée]cembre)\s+(\d{4})\b/giu,
    normaliser: (m) => {
      const j = Number(m[1]); const mo = MOIS[m[2].toLowerCase()]; const a = Number(m[3]);
      return mo && dateValide(a, mo, j) ? iso(a, mo, j) : null;
    },
  },
  {
    type: "date", confiance: 0.98,
    regex: /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g,
    normaliser: (m) => (dateValide(Number(m[3]), Number(m[2]), Number(m[1])) ? iso(Number(m[3]), Number(m[2]), Number(m[1])) : null),
  },
  {
    type: "date", confiance: 0.98,
    regex: /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    normaliser: (m) => (dateValide(Number(m[1]), Number(m[2]), Number(m[3])) ? iso(Number(m[1]), Number(m[2]), Number(m[3])) : null),
  },
  {
    type: "montant", confiance: 0.98,
    regex: /(?<![\d,.])(\d{1,3}(?:[   ]\d{3})+|\d+)(?:[,.](\d{2}))?\s?(€|euros?\b|EUR\b)/gu,
    normaliser: (m) => `${m[1].replace(/[   ]/g, "")}.${m[2] ?? "00"}`,
  },
  {
    type: "reference", confiance: 0.97,
    regex: /\b([A-Z]{1,4}-\d{4}-\d{3,6})\b/g,
    normaliser: (m) => m[1],
  },
  {
    type: "reference", confiance: 0.95,
    regex: /\b(\d[A-Z]\s?\d{3}\s?\d{3}\s?\d{4}\s?\d)\b/g, // n° de recommandé
    normaliser: (m) => m[1].replace(/\s/g, ""),
  },
  {
    type: "siret", confiance: 0.98,
    regex: /\bSIRET\s*:?\s*(\d{3}\s?\d{3}\s?\d{3}\s?\d{5})\b/gi,
    normaliser: (m) => m[1].replace(/\s/g, ""),
  },
  {
    type: "siren", confiance: 0.98,
    regex: /\bSIREN\s*:?\s*(\d{3}\s?\d{3}\s?\d{3})\b/gi,
    normaliser: (m) => m[1].replace(/\s/g, ""),
  },
  {
    type: "courriel", confiance: 0.99,
    regex: /\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g,
    normaliser: (m) => m[0].toLowerCase(),
  },
];

const IBAN = /\bFR\d{2}(?:[  ]?[0-9A-Z]{4}){5}[  ]?[0-9A-Z]{3}\b/g;
const NIR = /\b[12]\s?\d{2}\s?(?:0[1-9]|1[0-2])\s?(?:\d{2}|2[AB])\s?\d{3}\s?\d{3}\s?\d{2}\b/g;

/** Toutes les extractions déterministes d'une page, dédoublonnées par (type, valeur, position). */
export function extrairePage(texte: string, page: number): { extractions: Extraction[]; sensibles: DonneeSensible[] } {
  const extractions: Extraction[] = [];
  const vus = new Set<string>();
  for (const regle of REGLES) {
    for (const m of texte.matchAll(regle.regex)) {
      const valeur = regle.normaliser(m);
      if (!valeur || m.index === undefined) continue;
      const debut = m.index;
      const fin = debut + m[0].length;
      const cle = `${regle.type}:${valeur}:${debut}`;
      if (vus.has(cle)) continue;
      vus.add(cle);
      extractions.push({
        type: regle.type, valeur_normalisee: valeur, valeur_brute: m[0].trim(), page, offset_debut: debut, offset_fin: fin,
        ...extraitAutour(texte, debut, fin), confiance: regle.confiance,
      });
    }
  }
  const sensibles: DonneeSensible[] = [];
  if (IBAN.test(texte)) sensibles.push({ type: "iban", page });
  IBAN.lastIndex = 0;
  if (NIR.test(texte)) sensibles.push({ type: "nir", page });
  NIR.lastIndex = 0;
  return { extractions: extractions.sort((a, b) => a.offset_debut - b.offset_debut), sensibles };
}

/** Motifs d'injection de prompt (PARTIE 9.2) : détection déterministe, en complément du modèle. */
const INJECTION = [
  /ignore[sz]?\s+(?:les|toutes\s+les|tes)\s+(?:instructions|consignes)/i,
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /tu\s+es\s+(?:maintenant\s+)?autoris[ée]/i,
  /envoie[sz]?\s+(?:ce|le)\s+dossier\s+[àa]/i,
  /(?:^|\n)\s*(?:system|assistant)\s*:/i,
  /\bsystem\s+prompt\b/i,
];

export function detecterInjection(texte: string): string | null {
  for (const motif of INJECTION) {
    const m = texte.match(motif);
    if (m) return m[0];
  }
  return null;
}
