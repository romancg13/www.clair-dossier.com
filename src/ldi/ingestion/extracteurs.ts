/**
 * LDI — extraction de texte par format.
 *
 * Chaque extracteur rend des pages avec leur méthode et leur confiance. Aucun
 * ne devine : quand il ne sait pas lire, il le dit et met la page en
 * quarantaine plutôt que de rendre une chaîne vide qui passerait pour un
 * document sans contenu.
 *
 * Tous prennent des octets et rendent des pages : ils sont donc testables en
 * Node, sans navigateur ni fichier réel.
 */
import { attribut, blocsAvant, contenusDe, decoderEntites, retirerBalises } from './xml';
import type { MethodeExtraction, PageExtraite } from './types';

/** Fabrique une page, en décidant seule de la quarantaine. */
export function page(
  numero: number,
  texte: string,
  methode: MethodeExtraction,
  confiance: number,
  seuil: number,
  motif = ''
): PageExtraite {
  const quarantaine = confiance < seuil;
  return {
    page: numero,
    texte,
    methode,
    confiance,
    quarantaine,
    motifQuarantaine: quarantaine
      ? motif || `Confiance d'extraction ${confiance.toFixed(2)} sous le seuil ${seuil.toFixed(2)}.`
      : '',
  };
}

const decodeur = new TextDecoder('utf-8', { fatal: false });

export function versTexte(octets: Uint8Array): string {
  return decodeur.decode(octets);
}

// ── Texte brut ────────────────────────────────────────────────────────────

export function extraireTexteBrut(octets: Uint8Array, seuil: number): PageExtraite[] {
  const texte = versTexte(octets).replace(/\r\n?/g, '\n');
  // Le remplacement U+FFFD signale un décodage raté : le fichier n'était pas
  // en UTF-8. Le texte reste exploitable, mais sa fidélité est entamée.
  const casses = (texte.match(/�/g) ?? []).length;
  const confiance = texte.length === 0 ? 0 : Math.max(0, 1 - casses / Math.max(texte.length, 1) * 20);

  return [
    page(
      1,
      texte,
      'texte-brut',
      confiance,
      seuil,
      casses > 0 ? `${casses} caractère(s) non décodable(s) : encodage probablement autre qu'UTF-8.` : ''
    ),
  ];
}

// ── DOCX ──────────────────────────────────────────────────────────────────

/**
 * Texte d'un `.docx`, un paragraphe par ligne.
 *
 * Les tabulations `<w:tab/>` deviennent des tabulations et les sauts `<w:br/>`
 * des retours : sans cela, un tableau de procédure se lirait comme une phrase
 * continue, et une chronologie recopiée deviendrait illisible.
 */
export function extraireDocx(documentXml: string, seuil: number): PageExtraite[] {
  const paragraphes = blocsAvant(documentXml, 'w:p').map(texteDuParagraphe);

  const texte = paragraphes.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return [
    page(
      1,
      texte,
      'xml-bureautique',
      texte.length > 0 ? 1 : 0,
      seuil,
      texte.length === 0 ? "Aucun texte n'a pu être lu dans le corps du document." : ''
    ),
  ];
}

/**
 * Texte d'un paragraphe, dans l'ordre du document.
 *
 * Le parcours est ORDONNÉ, et non « collecter les `<w:t>` puis recoller » :
 * les tabulations et sauts de ligne sont des balises autonomes, hors de tout
 * `<w:t>`. Les collecter séparément les aurait placés à côté du texte au lieu
 * d'entre les fragments — un tableau de procédure se serait lu « Colonne
 * AColonne B », et une chronologie recopiée serait devenue illisible.
 */
function texteDuParagraphe(bloc: string): string {
  let texte = '';
  const re = /<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>|<(?:\w+:)?(tab|br|cr)\b[^>]*\/?>/g;

  for (const m of bloc.matchAll(re)) {
    if (m[1] !== undefined) texte += decoderEntites(retirerBalises(m[1]));
    else if (m[2] === 'tab') texte += '\t';
    else texte += '\n';
  }
  return texte;
}

// ── Tableur ───────────────────────────────────────────────────────────────

/**
 * Table d'une feuille de calcul, lignes séparées par des retours et cellules
 * par des tabulations.
 *
 * La structure est préservée : aplatir un tableau en prose détruit exactement
 * ce qui fait sa valeur probante — la correspondance entre une colonne et une
 * valeur.
 */
export function extraireFeuille(
  feuilleXml: string,
  chainesPartagees: string[],
  seuil: number,
  numeroPage = 1
): PageExtraite {
  const lignes: string[] = [];

  for (const ligne of blocsAvant(feuilleXml, 'row')) {
    const cellules: string[] = [];
    for (const m of ligne.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)) {
      cellules.push(valeurCellule(m[1], m[2], chainesPartagees));
    }
    // Une ligne entièrement vide reste une ligne : la supprimer décalerait
    // toutes les suivantes par rapport au document d'origine.
    lignes.push(cellules.join('\t'));
  }

  const texte = lignes.join('\n').trim();
  return page(
    numeroPage,
    texte,
    'xml-bureautique',
    texte.length > 0 ? 1 : 0,
    seuil,
    texte.length === 0 ? 'Feuille vide ou illisible.' : ''
  );
}

function valeurCellule(attributs: string, corps: string, partagees: string[]): string {
  const type = attribut(attributs, 't');

  if (type === 's') {
    const index = Number(contenusDe(corps, 'v')[0] ?? '');
    return Number.isInteger(index) && index >= 0 && index < partagees.length
      ? partagees[index]
      : '';
  }
  if (type === 'inlineStr') return contenusDe(corps, 't').join('');
  if (type === 'str') return contenusDe(corps, 'v')[0] ?? '';

  return contenusDe(corps, 'v')[0] ?? '';
}

/** Chaînes partagées d'un classeur, dans l'ordre de leur index. */
export function lireChainesPartagees(sharedStringsXml: string): string[] {
  // Une entrée `<si>` peut contenir plusieurs `<t>` (texte enrichi) : ils sont
  // recollés, sinon un intitulé de colonne mis en forme arriverait tronqué.
  return blocsAvant(sharedStringsXml, 'si').map((si) => contenusDe(si, 't').join(''));
}

// ── CSV ───────────────────────────────────────────────────────────────────

/**
 * Lecture CSV avec guillemets et séparateur déduit.
 *
 * Le séparateur est deviné sur la première ligne — le point-virgule est
 * fréquent dans les exports français, où la virgule sert de décimale.
 */
export function extraireCsv(octets: Uint8Array, seuil: number): PageExtraite[] {
  const brut = versTexte(octets).replace(/\r\n?/g, '\n');
  const premiere = brut.split('\n')[0] ?? '';
  const separateur =
    (premiere.match(/;/g) ?? []).length > (premiere.match(/,/g) ?? []).length ? ';' : ',';

  const lignes: string[][] = [];
  let champ = '';
  let ligne: string[] = [];
  let entreGuillemets = false;

  for (let i = 0; i < brut.length; i += 1) {
    const c = brut[i];
    if (entreGuillemets) {
      if (c === '"') {
        if (brut[i + 1] === '"') {
          champ += '"';
          i += 1;
        } else entreGuillemets = false;
      } else champ += c;
      continue;
    }
    if (c === '"') entreGuillemets = true;
    else if (c === separateur) {
      ligne.push(champ);
      champ = '';
    } else if (c === '\n') {
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = '';
    } else champ += c;
  }
  if (champ !== '' || ligne.length > 0) {
    ligne.push(champ);
    lignes.push(ligne);
  }

  const texte = lignes.map((l) => l.join('\t')).join('\n').trim();
  return [
    page(
      1,
      texte,
      'texte-brut',
      texte.length > 0 ? 1 : 0,
      seuil,
      entreGuillemets ? 'Guillemet ouvert non refermé : la table peut être tronquée.' : ''
    ),
  ];
}
