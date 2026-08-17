/**
 * LDI — minimisation avant tout appel externe.
 *
 * Un dossier pénal est couvert par le secret professionnel de l'avocat. Dès
 * lors qu'une partie du dossier quitte la machine — appel à un modèle de
 * langage, API tierce — elle doit être réduite à ce qui est strictement utile
 * au raisonnement demandé.
 *
 * Ce module remplace les identifiants directs par des pseudonymes stables.
 * La table de correspondance ne quitte jamais l'appelant : elle sert à
 * réintégrer les vrais noms dans le rendu final, en local.
 *
 * Limite à connaître : la pseudonymisation par motifs ne couvre pas tout. Une
 * adresse écrite en toutes lettres, un surnom, un détail de contexte peuvent
 * ré-identifier une personne. `noms` permet à l'avocat de déclarer
 * explicitement les identités à masquer — c'est le mécanisme le plus fiable du
 * module, et il suppose une action humaine.
 */

export type TableCorrespondance = Map<string, string>;

export type ResultatMinimisation = {
  texte: string;
  /** pseudonyme → valeur d'origine. Reste strictement local. */
  correspondances: TableCorrespondance;
};

type Motif = { nom: string; regex: RegExp };

/**
 * Motifs d'identifiants directs. Ordre significatif : les motifs les plus
 * spécifiques passent d'abord pour ne pas être tronçonnés par les suivants.
 */
const MOTIFS: Motif[] = [
  // Le domaine est décrit label par label : une classe `[\w.-]+` finale
  // avalerait le point de fin de phrase et produirait deux pseudonymes
  // différents pour une même adresse.
  { nom: 'EMAIL', regex: /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g },
  { nom: 'IBAN', regex: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}\b/g },
  // NIR : 13 chiffres + clé sur 2 chiffres, avec séparateurs facultatifs.
  { nom: 'NIR', regex: /\b[12]\s?\d{2}\s?\d{2}\s?\d{2,3}\s?\d{2,3}\s?\d{2,3}\s?\d{2}\b/g },
  { nom: 'IMMATRICULATION', regex: /\b[A-Z]{2}-\d{3}-[A-Z]{2}\b/g },
  { nom: 'TELEPHONE', regex: /(?:\+33|0)\s?[1-9](?:[\s.-]?\d{2}){4}\b/g },
];

function pseudonymiser(
  texte: string,
  motif: Motif,
  correspondances: TableCorrespondance,
  compteurs: Map<string, number>
): string {
  return texte.replace(motif.regex, (trouve) => {
    for (const [pseudo, origine] of correspondances) {
      if (origine === trouve) return pseudo;
    }
    const n = (compteurs.get(motif.nom) ?? 0) + 1;
    compteurs.set(motif.nom, n);
    const pseudo = `[${motif.nom}_${n}]`;
    correspondances.set(pseudo, trouve);
    return pseudo;
  });
}

function echapper(valeur: string): string {
  return valeur.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Remplace identifiants directs et noms déclarés par des pseudonymes stables.
 *
 * @param noms Identités déclarées par l'avocat (« Jean Dupont », « SARL X »).
 *             Sans cette liste, les patronymes ne sont pas détectés.
 */
export function minimiser(texte: string, noms: string[] = []): ResultatMinimisation {
  const correspondances: TableCorrespondance = new Map();
  const compteurs = new Map<string, number>();
  let resultat = texte;

  // Les noms déclarés d'abord : ils peuvent contenir des motifs génériques.
  const parLongueur = [...noms].filter((n) => n.trim().length > 1).sort((a, b) => b.length - a.length);
  parLongueur.forEach((nom, index) => {
    const pseudo = `[PERSONNE_${index + 1}]`;
    const regex = new RegExp(echapper(nom.trim()), 'gi');
    if (regex.test(resultat)) {
      correspondances.set(pseudo, nom.trim());
      resultat = resultat.replace(regex, pseudo);
    }
  });

  for (const motif of MOTIFS) {
    resultat = pseudonymiser(resultat, motif, correspondances, compteurs);
  }

  return { texte: resultat, correspondances };
}

/** Réintègre les valeurs d'origine dans un texte produit à partir du texte minimisé. */
export function restaurer(texte: string, correspondances: TableCorrespondance): string {
  let resultat = texte;
  for (const [pseudo, origine] of correspondances) {
    resultat = resultat.split(pseudo).join(origine);
  }
  return resultat;
}

/**
 * Estime le risque résiduel de ré-identification, pour affichage à l'avocat.
 * Volontairement grossier : il alerte, il ne rassure pas.
 */
export function alertesResiduelles(texte: string): string[] {
  const alertes: string[] = [];

  if (/\b\d{1,3}(?:\s|,)?(?:bis|ter)?\s?(?:rue|avenue|boulevard|impasse|place|chemin)\b/i.test(texte)) {
    alertes.push("Le texte contient ce qui ressemble à une adresse postale : elle n'est pas pseudonymisée automatiquement.");
  }
  if (/\b(?:né|née)\s+le\s+\d{1,2}/i.test(texte)) {
    alertes.push('Une date de naissance apparaît en clair.');
  }
  // Suites de mots capitalisés : patronymes probables non déclarés.
  const capitalises = texte.match(/\b[A-ZÉÈÊÀÂÎÔÛÇ][a-zéèêàâîôûç]+\s+[A-ZÉÈÊÀÂÎÔÛÇ][a-zéèêàâîôûç]+\b/g);
  if (capitalises && capitalises.length > 0) {
    alertes.push(
      `${capitalises.length} suite(s) de mots capitalisés subsistent : vérifier qu'aucun patronyme n'a été oublié dans la liste des noms déclarés.`
    );
  }
  return alertes;
}
