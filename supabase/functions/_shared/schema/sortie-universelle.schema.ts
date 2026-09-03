/**
 * Schéma de sortie universel (PARTIE 6) — contrat JSON strict que tout agent émet
 * et que le validateur applique avant toute transmission. Source de vérité : ce
 * fichier ; `docs/schemas/sortie-universelle.schema.json` en est la copie générée
 * (`npm run gen:schema`), vérifiée en CI.
 *
 * Ce que JSON Schema n'exprime pas est appliqué par `validateur.ts` :
 *   - une assertion sans source n'est admise que si nature ∈ {declaration_client, deduction} ;
 *   - confiance_globale = minimum des confiances des assertions critiques (jamais une moyenne) ;
 *   - cohérence statut ↔ escalades ; identifiants d'assertion uniques ; offsets ordonnés.
 */

/** Agents de l'architecture (PARTIE 4) et processus déterministes du pipeline. */
export const AGENTS = ["CLAIR-OS", "ARIA", "ATLAS", "VERITAS", "CHRONOS", "SYNTHIA", "LEXIA", "HERMES", "SENTINEL", "ECHO"] as const;
export const PROCESSUS = ["INGESTION", "INDEXATION"] as const;
export const STATUTS = ["ok", "partiel", "escalade", "echec"] as const;
export const NATURES = ["piece", "declaration_client", "deduction", "a_verifier"] as const;
export const IMPACTS = ["faible", "moyen", "fort"] as const;
/** Escalades fermées (PARTIE 5.2). Aucun autre code n'existe. */
export const CODES_ESCALADE = ["E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8", "E9"] as const;
export const DESTINATAIRES = ["utilisateur", "ECHO", "CLAIR-OS", "journal"] as const;

const UUID = { type: "string", format: "uuid" } as const;
const CONFIANCE = { type: "number", minimum: 0, maximum: 1 } as const;
const ENTIER_POSITIF = { type: "integer", minimum: 0 } as const;

export const SCHEMA_SORTIE_UNIVERSELLE = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://www.clair-dossier.com/schemas/sortie-universelle.schema.json",
  title: "ClairDossier — sortie universelle d'agent (PARTIE 6)",
  type: "object",
  additionalProperties: false,
  required: [
    "agent", "version", "dossier_id", "trace_id", "horodatage", "statut", "confiance_globale",
    "resultat", "assertions", "incertitudes", "escalades", "donnees_sensibles_detectees", "cout", "duree_ms",
  ],
  properties: {
    agent: { type: "string", enum: [...AGENTS, ...PROCESSUS] },
    version: { type: "string", pattern: "^[0-9]+\\.[0-9]+(\\.[0-9]+)?$" },
    dossier_id: UUID,
    trace_id: UUID,
    horodatage: { type: "string", format: "date-time" },
    statut: { type: "string", enum: [...STATUTS] },
    confiance_globale: CONFIANCE,
    resultat: { type: "object" },
    assertions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "enonce", "nature", "confiance", "sources"],
        properties: {
          id: { type: "string", minLength: 1, maxLength: 64 },
          enonce: { type: "string", minLength: 1 },
          nature: { type: "string", enum: [...NATURES] },
          confiance: CONFIANCE,
          /** Donnée critique (date, délai, montant, référence) : compte dans confiance_globale. */
          critique: { type: "boolean" },
          sources: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              required: ["document_id", "nom_fichier", "page", "extrait"],
              properties: {
                document_id: UUID,
                chunk_id: UUID,
                nom_fichier: { type: "string", minLength: 1 },
                page: { type: "integer", minimum: 1 },
                extrait: { type: "string", minLength: 1 },
                offset_debut: ENTIER_POSITIF,
                offset_fin: ENTIER_POSITIF,
              },
            },
          },
        },
      },
    },
    incertitudes: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["objet", "impact", "action"],
        properties: {
          objet: { type: "string", minLength: 1 },
          impact: { type: "string", enum: [...IMPACTS] },
          action: { type: "string", enum: [...CODES_ESCALADE, "aucune"] },
        },
      },
    },
    escalades: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "motif", "destinataire"],
        properties: {
          code: { type: "string", enum: [...CODES_ESCALADE] },
          motif: { type: "string", minLength: 1 },
          destinataire: { type: "string", enum: [...DESTINATAIRES] },
        },
      },
    },
    donnees_sensibles_detectees: { type: "array", items: { type: "string", minLength: 1 } },
    cout: {
      type: "object",
      additionalProperties: false,
      required: ["modele", "tokens_entree", "tokens_sortie"],
      properties: {
        modele: { type: ["string", "null"] },
        tokens_entree: ENTIER_POSITIF,
        tokens_sortie: ENTIER_POSITIF,
      },
    },
    duree_ms: ENTIER_POSITIF,
  },
} as const;
