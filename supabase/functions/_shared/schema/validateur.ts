/**
 * Validateur de schéma de sortie universel (PARTIE 6, étape 8 du plan de build).
 *
 * Deux couches, dans cet ordre :
 *   1. le contrat JSON Schema strict (ajv, draft 2020-12, formats, propriétés
 *      inconnues refusées) ;
 *   2. les règles sémantiques du cahier des charges que le schéma n'exprime pas.
 * Toute sortie non conforme est REJETÉE : elle ne part jamais vers l'utilisateur.
 * `sortieDeRejet` fabrique la sortie d'échec E8 qui la remplace (PARTIE 6 :
 * « Aucune sortie n'est transmise si le schéma échoue à la validation. Elle part
 * en E8 »), journalisable et elle-même conforme.
 */
import { Ajv2020, type ErrorObject } from "ajv/dist/2020";
import * as ajvFormatsModule from "ajv-formats";
import { SCHEMA_SORTIE_UNIVERSELLE, type CODES_ESCALADE, type NATURES, type STATUTS } from "./sortie-universelle.schema.ts";

// ajv-formats est un module CommonJS : selon le runtime (Node, Deno), la fonction est
// l'export par défaut ou le module lui-même. Même code, mêmes types, partout.
type AjouterFormats = (ajv: Ajv2020) => unknown;
const addFormats = ((ajvFormatsModule as unknown as { default?: unknown }).default ?? ajvFormatsModule) as AjouterFormats;

export type Nature = (typeof NATURES)[number];
export type Statut = (typeof STATUTS)[number];
export type CodeEscalade = (typeof CODES_ESCALADE)[number];

export type SourceAssertion = {
  document_id: string;
  chunk_id?: string;
  nom_fichier: string;
  page: number;
  extrait: string;
  offset_debut?: number;
  offset_fin?: number;
};

export type Assertion = {
  id: string;
  enonce: string;
  nature: Nature;
  confiance: number;
  critique?: boolean;
  sources: SourceAssertion[];
};

export type SortieUniverselle = {
  agent: string;
  version: string;
  dossier_id: string;
  trace_id: string;
  horodatage: string;
  statut: Statut;
  confiance_globale: number;
  resultat: Record<string, unknown>;
  assertions: Assertion[];
  incertitudes: { objet: string; impact: "faible" | "moyen" | "fort"; action: CodeEscalade | "aucune" }[];
  escalades: { code: CodeEscalade; motif: string; destinataire: "utilisateur" | "ECHO" | "CLAIR-OS" | "journal" }[];
  donnees_sensibles_detectees: string[];
  cout: { modele: string | null; tokens_entree: number; tokens_sortie: number };
  duree_ms: number;
};

export type ErreurValidation = { chemin: string; code: string; message: string };

export type ResultatValidation =
  | { valide: true; sortie: SortieUniverselle }
  | { valide: false; erreurs: ErreurValidation[] };

/** Natures admises sans aucune source (PARTIE 6, contrainte 1). */
export const NATURES_SANS_SOURCE: readonly Nature[] = ["declaration_client", "deduction"];
/** Tolérance d'égalité sur les confiances (arrondis au millième). */
const TOLERANCE = 0.0005;

const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true });
addFormats(ajv);
const validerSchema = ajv.compile(SCHEMA_SORTIE_UNIVERSELLE);

function depuisAjv(e: ErrorObject): ErreurValidation {
  const chemin = e.instancePath || "/";
  const detail = e.keyword === "additionalProperties" ? ` (${String((e.params as { additionalProperty?: string }).additionalProperty)})` : "";
  return { chemin, code: `schema.${e.keyword}`, message: `${e.message ?? "invalide"}${detail}` };
}

/** Règles que JSON Schema n'exprime pas. */
export function reglesSemantiques(s: SortieUniverselle): ErreurValidation[] {
  const erreurs: ErreurValidation[] = [];
  const ids = new Set<string>();
  s.assertions.forEach((a, i) => {
    const chemin = `/assertions/${i}`;
    if (ids.has(a.id)) erreurs.push({ chemin: `${chemin}/id`, code: "assertion.id_duplique", message: `identifiant d'assertion répété : ${a.id}` });
    ids.add(a.id);
    if (a.sources.length === 0 && !NATURES_SANS_SOURCE.includes(a.nature)) {
      erreurs.push({
        chemin: `${chemin}/sources`,
        code: "assertion.sans_source",
        message: `une assertion de nature « ${a.nature} » exige au moins une source (I2) ; seules ${NATURES_SANS_SOURCE.join(" et ")} en sont dispensées`,
      });
    }
    a.sources.forEach((src, j) => {
      if (src.offset_debut !== undefined && src.offset_fin !== undefined && src.offset_fin <= src.offset_debut) {
        erreurs.push({ chemin: `${chemin}/sources/${j}`, code: "source.offsets_incoherents", message: "offset_fin doit être strictement supérieur à offset_debut" });
      }
      if ((src.offset_debut === undefined) !== (src.offset_fin === undefined)) {
        erreurs.push({ chemin: `${chemin}/sources/${j}`, code: "source.offsets_incomplets", message: "offset_debut et offset_fin vont ensemble" });
      }
    });
  });

  // confiance_globale = min des assertions critiques (à défaut, de toutes les assertions), jamais une moyenne.
  const critiques = s.assertions.filter((a) => a.critique === true);
  const reference = critiques.length > 0 ? critiques : s.assertions;
  if (reference.length > 0) {
    const minimum = Math.min(...reference.map((a) => a.confiance));
    if (Math.abs(s.confiance_globale - minimum) > TOLERANCE) {
      erreurs.push({
        chemin: "/confiance_globale",
        code: "confiance.pas_le_minimum",
        message: `confiance_globale (${s.confiance_globale}) doit être la confiance minimale des assertions ${critiques.length > 0 ? "critiques" : ""} (${minimum}), non une moyenne`,
      });
    }
  }

  if (s.escalades.length > 0 && s.statut === "ok") {
    erreurs.push({ chemin: "/statut", code: "statut.ok_avec_escalade", message: "une sortie qui escalade n'est pas « ok » : partiel, escalade ou echec" });
  }
  if (s.statut === "escalade" && s.escalades.length === 0) {
    erreurs.push({ chemin: "/escalades", code: "statut.escalade_sans_code", message: "statut « escalade » sans aucune escalade codée" });
  }
  if (s.statut === "ok" && s.incertitudes.some((i) => i.action !== "aucune")) {
    erreurs.push({ chemin: "/statut", code: "statut.ok_avec_action", message: "une incertitude qui appelle une escalade rend la sortie au mieux « partiel »" });
  }
  return erreurs;
}

/** Valide une sortie brute (objet JSON déjà désérialisé). */
export function valider(brut: unknown): ResultatValidation {
  if (!validerSchema(brut)) {
    return { valide: false, erreurs: (validerSchema.errors ?? []).map(depuisAjv) };
  }
  const sortie = brut as SortieUniverselle;
  const erreurs = reglesSemantiques(sortie);
  return erreurs.length === 0 ? { valide: true, sortie } : { valide: false, erreurs };
}

/**
 * Sortie de remplacement quand la validation échoue : échec E8, sans assertion,
 * qui nomme le motif exact. Elle est elle-même conforme au schéma.
 */
export function sortieDeRejet(params: {
  agent: string;
  version?: string;
  dossier_id: string;
  trace_id: string;
  erreurs: ErreurValidation[];
  duree_ms?: number;
  maintenant?: () => Date;
}): SortieUniverselle {
  const motif = params.erreurs
    .slice(0, 5)
    .map((e) => `${e.chemin} ${e.code}`)
    .join(" ; ");
  return {
    agent: params.agent,
    version: params.version ?? "1.0",
    dossier_id: params.dossier_id,
    trace_id: params.trace_id,
    horodatage: (params.maintenant ?? (() => new Date()))().toISOString(),
    statut: "echec",
    confiance_globale: 0,
    resultat: { rejet_schema: true, nb_erreurs: params.erreurs.length, erreurs: params.erreurs.slice(0, 20) },
    assertions: [],
    incertitudes: [{ objet: "Sortie de l'agent rejetée par le validateur de schéma", impact: "fort", action: "E8" }],
    escalades: [{ code: "E8", motif: `Sortie non conforme au schéma universel : ${motif}`, destinataire: "utilisateur" }],
    donnees_sensibles_detectees: [],
    cout: { modele: null, tokens_entree: 0, tokens_sortie: 0 },
    duree_ms: params.duree_ms ?? 0,
  };
}

/** Valide ou remplace : ce qui sort d'ici est toujours conforme. */
export function validerOuRejeter(brut: unknown, contexte: { agent: string; dossier_id: string; trace_id: string }): {
  sortie: SortieUniverselle;
  rejetee: boolean;
  erreurs: ErreurValidation[];
} {
  const r = valider(brut);
  if (r.valide) return { sortie: r.sortie, rejetee: false, erreurs: [] };
  return { sortie: sortieDeRejet({ ...contexte, erreurs: r.erreurs }), rejetee: true, erreurs: r.erreurs };
}
