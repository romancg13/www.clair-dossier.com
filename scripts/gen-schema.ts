/**
 * Écrit la copie JSON du schéma de sortie universel (PARTIE 6) depuis la source
 * TypeScript, pour la documentation et les outils externes. La CI vérifie que la
 * copie commitée est à jour. Usage : npm run gen:schema
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SCHEMA_SORTIE_UNIVERSELLE } from "../supabase/functions/_shared/schema/sortie-universelle.schema.ts";

const dir = resolve(fileURLToPath(new URL(".", import.meta.url)), "../docs/schemas");
mkdirSync(dir, { recursive: true });
const cible = resolve(dir, "sortie-universelle.schema.json");
writeFileSync(cible, `${JSON.stringify(SCHEMA_SORTIE_UNIVERSELLE, null, 2)}\n`);
console.log(`schéma écrit : ${cible}`);
