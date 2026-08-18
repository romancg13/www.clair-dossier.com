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
 * Ces références sont les SEULES que le serveur peut autoriser de lui-même.
 * L'ensemble transmis par l'appelant est intersecté avec celui-ci : il peut le
 * restreindre, jamais l'élargir. Aucun numéro de pourvoi n'y figure — le
 * serveur n'interroge aucune source de jurisprudence, donc il n'en autorise
 * aucun, et c'est le comportement correct.
 */
export const REFERENCES_AUTORITE: readonly string[] = ${JSON.stringify(references, null, 2)};
`;

writeFileSync('supabase/functions/ldi-analyze/corpus-autorite.ts', contenu, 'utf-8');
process.stdout.write(`${references.length} références écrites dans l'autorité de la fonction edge.\n`);
