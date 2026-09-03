/**
 * Les prompts système vivent dans prompts/<agent>.system.md (PARTIE 5 : gabarit en
 * 10 sections). Les Edge Functions n'embarquent que des modules importés : ce script
 * copie chaque prompt dans un module TypeScript généré, vérifié en CI.
 * Usage : npm run gen:prompts
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(fileURLToPath(new URL(".", import.meta.url)), "..");
const dossierPrompts = resolve(racine, "prompts");
const cible = resolve(racine, "supabase/functions/_shared/agents/prompts.generated.ts");

const SECTIONS = [
  "## 1. IDENTITÉ", "## 2. OBJECTIF", "## 3. DONNÉES AUTORISÉES", "## 4. RAISONNEMENT", "## 5. OUTILS",
  "## 6. SEUILS DE CONFIANCE", "## 7. GUARDRAILS", "## 8. ESCALADES", "## 9. FORMAT DE SORTIE", "## 10. MÉTRIQUES ET FALLBACK",
];

const fichiers = readdirSync(dossierPrompts).filter((f) => f.endsWith(".system.md")).sort();
const entrees: string[] = [];
for (const f of fichiers) {
  const agent = f.replace(/\.system\.md$/, "").toUpperCase().replace("CLAIR-OS", "CLAIR-OS");
  const contenu = readFileSync(resolve(dossierPrompts, f), "utf8");
  const manquantes = SECTIONS.filter((s) => !contenu.includes(s));
  if (manquantes.length > 0) {
    throw new Error(`${f} : sections obligatoires absentes (PARTIE 5) : ${manquantes.join(", ")}`);
  }
  entrees.push(`  ${JSON.stringify(agent)}: ${JSON.stringify(contenu)},`);
}

writeFileSync(
  cible,
  [
    "// Fichier GÉNÉRÉ par scripts/gen-prompts.ts à partir de prompts/*.system.md — ne pas modifier à la main.",
    "// Source de vérité : prompts/<agent>.system.md (gabarit PARTIE 5, 10 sections obligatoires).",
    "export const PROMPTS_SYSTEME: Record<string, string> = {",
    ...entrees,
    "};",
    "",
  ].join("\n"),
);
console.log(`prompts générés : ${fichiers.length} → ${cible}`);
