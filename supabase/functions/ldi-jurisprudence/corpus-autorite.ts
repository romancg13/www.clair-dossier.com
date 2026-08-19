/**
 * Autorité de citation de la fonction edge — FICHIER GÉNÉRÉ, ne pas modifier.
 *
 * Régénérer : `npm run ldi:gen-corpus-edge`
 *
 * Ces références de TEXTE sont les seules que le serveur tient de lui-même.
 * L'ensemble transmis par l'appelant est intersecté avec celui-ci : il peut le
 * restreindre, jamais l'élargir.
 *
 * Deux fonctions s'en servent, pour deux bornes différentes :
 *   — `ldi-analyze` borne ce que le modèle a le droit de citer ;
 *   — `ldi-jurisprudence` borne ce qu'il est permis de RECHERCHER, ce qui
 *     interdit du même coup qu'un élément du dossier parte dans une requête.
 *
 * Aucun numéro de pourvoi n'y figure, et il ne faut pas qu'il y en ait : un
 * arrêt n'est jamais une autorité détenue à l'avance. Il n'existe qu'en tant
 * que réponse rendue par une API officielle pendant l'exécution, et c'est
 * précisément ce qui le rend citable.
 */
export const REFERENCES_AUTORITE: readonly string[] = [
  "CEDH, art. 6",
  "CEDH, art. 8",
  "CP, art. 222-37",
  "CP, art. 313-1",
  "CP, art. 324-1",
  "CP, art. 432-11",
  "CPP, art. 171",
  "CPP, art. 173",
  "CPP, art. 174",
  "CPP, art. 62-2",
  "CPP, art. 63",
  "CPP, art. 63-1",
  "CPP, art. 63-3",
  "CPP, art. 63-3-1",
  "CPP, art. 63-4-2",
  "CPP, art. 7",
  "CPP, art. 706-88",
  "CPP, art. 706-88-1",
  "CPP, art. 76",
  "CPP, art. 78-2",
  "CPP, art. 8",
  "CPP, art. 802",
  "CPP, art. 9-1"
];
