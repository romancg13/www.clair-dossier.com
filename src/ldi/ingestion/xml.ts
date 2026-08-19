/**
 * LDI — lecture de texte dans du XML de bureautique.
 *
 * ┌─ POURQUOI PAS UN VRAI ANALYSEUR XML ────────────────────────────────────┐
 * │ `DOMParser` n'existe qu'au navigateur : les tests ne pourraient pas      │
 * │ s'exécuter, et l'ingestion serait la seule partie du moteur non          │
 * │ vérifiable en Node. Une bibliothèque d'analyse ajouterait du poids pour  │
 * │ un besoin étroit : on ne cherche pas à comprendre ces documents, on      │
 * │ cherche à en extraire du TEXTE et des TABLES.                            │
 * │                                                                          │
 * │ Ce module lit donc une forme connue — OOXML — au lieu de prétendre lire  │
 * │ du XML quelconque. La distinction est importante : il ne gère ni les     │
 * │ espaces de noms arbitraires, ni les DTD, ni les sections CDATA, et il ne │
 * │ doit jamais servir à lire un XML d'origine inconnue.                     │
 * │                                                                          │
 * │ Voir `docs/DEPENDANCES.md` pour ce que ce choix économise (232 Ko gz) et │
 * │ ce qu'il coûte en fidélité.                                              │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

/** Les cinq entités prédéfinies de XML. Les autres sont numériques. */
const ENTITES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

/**
 * Décode les entités XML d'un fragment textuel.
 *
 * Une entité inconnue est laissée telle quelle plutôt que supprimée : mieux
 * vaut un « &eacute; » visible dans une pièce, que l'avocat repérera, qu'un
 * trou silencieux au milieu d'une déclaration.
 */
export function decoderEntites(texte: string): string {
  return texte.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (brut, corps: string) => {
    if (corps[0] === '#') {
      const n =
        corps[1] === 'x' || corps[1] === 'X'
          ? Number.parseInt(corps.slice(2), 16)
          : Number.parseInt(corps.slice(1), 10);
      if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return brut;
      try {
        return String.fromCodePoint(n);
      } catch {
        return brut;
      }
    }
    return ENTITES[corps] ?? brut;
  });
}

/** Retire toute balise d'un fragment, sans toucher au texte. */
export function retirerBalises(fragment: string): string {
  return fragment.replace(/<[^>]*>/g, '');
}

/**
 * Contenus textuels de chaque occurrence d'une balise, dans l'ordre du
 * document. Le préfixe d'espace de noms est facultatif : `<w:t>` et `<t>`
 * répondent au même appel.
 */
export function contenusDe(xml: string, balise: string): string[] {
  const re = new RegExp(
    '<(?:\\w+:)?' + echapper(balise) + '\\b[^>]*>([\\s\\S]*?)</(?:\\w+:)?' + echapper(balise) + '>',
    'g'
  );
  const out: string[] = [];
  for (const m of xml.matchAll(re)) out.push(decoderEntites(retirerBalises(m[1])));
  return out;
}

/**
 * Découpe un document sur une balise fermante, en rendant chaque bloc.
 * Sert à isoler les paragraphes d'un `.docx` ou les lignes d'une feuille.
 */
export function blocsAvant(xml: string, baliseFermante: string): string[] {
  const re = new RegExp('</(?:\\w+:)?' + echapper(baliseFermante) + '>');
  const morceaux = xml.split(re);
  // Le dernier morceau suit la dernière balise fermante : ce n'est pas un bloc.
  return morceaux.slice(0, -1);
}

/** Valeur d'un attribut sur la première balise d'un fragment. */
export function attribut(fragment: string, nom: string): string | undefined {
  const m = new RegExp(echapper(nom) + '="([^"]*)"').exec(fragment);
  return m ? decoderEntites(m[1]) : undefined;
}

function echapper(valeur: string): string {
  return valeur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
