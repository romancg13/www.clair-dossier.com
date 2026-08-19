/**
 * Génère l'autorité de citation de la fonction edge à partir du corpus.
 *
 * ┌─ POURQUOI GÉNÉRER PLUTÔT QUE RECOPIER ──────────────────────────────────┐
 * │ La fonction Deno ne peut pas importer depuis `src/`. Elle a pourtant     │
 * │ besoin de savoir quels articles elle peut autoriser, sans le demander à  │
 * │ l'appelant — c'est tout l'objet de P1-12.                                │
 * │                                                                          │
 * │ Une liste recopiée à la main divergerait du corpus au premier ajout, et  │
 * │ la divergence serait invisible : un article légitime cesserait d'être    │
 * │ citable sans que rien ne l'explique. Elle est donc DÉRIVÉE, et un test   │
 * │ vérifie que le fichier engagé correspond au corpus courant.              │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 *   npm run ldi:gen-corpus-edge
 */
import { writeFileSync } from 'node:fs';

import { CORPUS } from '../src/ldi/corpus/references';

const references = CORPUS.map((e) => e.reference).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

const contenu = `/**
 * Autorité de citation de la fonction edge — FICHIER GÉNÉRÉ, ne pas modifier.
 *
 * Régénérer : \`npm run ldi:gen-corpus-edge\`
 *
 * Ces références de TEXTE sont les seules que le serveur tient de lui-même.
 * L'ensemble transmis par l'appelant est intersecté avec celui-ci : il peut le
 * restreindre, jamais l'élargir.
 *
 * Deux fonctions s'en servent, pour deux bornes différentes :
 *   — \`ldi-analyze\` borne ce que le modèle a le droit de citer ;
 *   — \`ldi-jurisprudence\` borne ce qu'il est permis de RECHERCHER, ce qui
 *     interdit du même coup qu'un élément du dossier parte dans une requête.
 *
 * Aucun numéro de pourvoi n'y figure, et il ne faut pas qu'il y en ait : un
 * arrêt n'est jamais une autorité détenue à l'avance. Il n'existe qu'en tant
 * que réponse rendue par une API officielle pendant l'exécution, et c'est
 * précisément ce qui le rend citable.
 */
export const REFERENCES_AUTORITE: readonly string[] = ${JSON.stringify(references, null, 2)};
`;

// Les deux fonctions edge tiennent la même autorité. `ldi-analyze` s'en sert
// pour borner ce que le modèle peut citer ; `ldi-jurisprudence` pour borner ce
// qu'on accepte de rechercher. Deux copies dérivées valent mieux qu'une copie
// recopiée : c'est le même corpus, et le test le vérifie pour chacune.
const CIBLES = [
  'supabase/functions/ldi-analyze/corpus-autorite.ts',
  'supabase/functions/ldi-jurisprudence/corpus-autorite.ts',
];

for (const cible of CIBLES) writeFileSync(cible, contenu, 'utf-8');
process.stdout.write(
  `${references.length} références écrites dans ${CIBLES.length} autorités de fonction edge.\n`
);
