/**
 * Implémentation Supabase (rôle de service) des interfaces Store et Stockage.
 * Toutes les écritures passent par les procédures serveur de la migration
 * 20260903150000 (SECURITY DEFINER, refusées à tout appel client).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Chunk,
  DocumentIngestion,
  DocumentResume,
  PageExtraite,
  PageTexte,
  Quota,
  ResultatRecherche,
  StatutSortie,
  Stockage,
  Store,
  Travail,
} from "./types.ts";

const COLONNES_DOCUMENT =
  "id,tenant_id,dossier_id,file_path,file_name,size_bytes,mime,hash_sha256,kind,statut_ingestion,doublon_de_id,supprime_le";

function verifier<T>(r: { data: T; error: { message: string; code?: string } | null }, contexte: string): T {
  if (r.error) throw new Error(`${contexte}: ${r.error.code ?? ""} ${r.error.message}`.trim());
  return r.data;
}

export function creerStoreSupabase(client: SupabaseClient): Store {
  return {
    async prendreTravail(types, executant) {
      const rows = verifier(await client.rpc("prendre_travail", { p_types: types, p_executant: executant }), "prendre_travail") as
        | (Omit<Travail, "id"> & { id: number | string })[]
        | null;
      const t = rows?.[0];
      return t ? { ...t, id: Number(t.id) } : null;
    },
    async terminerTravail(id, resultat) {
      verifier(await client.rpc("terminer_travail", { p_id: id, p_resultat: resultat }), "terminer_travail");
    },
    async echouerTravail(id, erreur, definitif = false) {
      verifier(await client.rpc("echouer_travail", { p_id: id, p_erreur: erreur, p_definitif: definitif }), "echouer_travail");
    },
    async lireDocument(id) {
      const data = verifier(
        await client.from("dossier_documents").select(COLONNES_DOCUMENT).eq("id", id).maybeSingle(),
        "lireDocument",
      );
      return (data as DocumentIngestion | null) ?? null;
    },
    async verifierQuota(documentId) {
      return verifier(await client.rpc("verifier_quota_ingestion", { p_document_id: documentId }), "verifier_quota_ingestion") as Quota;
    },
    async enregistrerEmpreinte(documentId, hash, mime, taille, pages = null) {
      verifier(
        await client.rpc("enregistrer_empreinte", {
          p_document_id: documentId, p_hash_sha256: hash, p_mime: mime, p_size_bytes: taille, p_pages: pages,
        }),
        "enregistrer_empreinte",
      );
    },
    async enregistrerPages(documentId, pages: PageExtraite[]) {
      verifier(await client.rpc("enregistrer_pages", { p_document_id: documentId, p_pages: pages }), "enregistrer_pages");
    },
    async marquerIngestion(documentId, statut, erreur, pages, traceId) {
      verifier(
        await client.rpc("marquer_ingestion", {
          p_document_id: documentId, p_statut: statut, p_erreur: erreur, p_pages: pages, p_trace_id: traceId,
        }),
        "marquer_ingestion",
      );
    },
    async demarrerRun(agent, tenantId, dossierId, traceId, entreeHash, modele, version) {
      return verifier(
        await client.rpc("demarrer_run", {
          p_agent: agent, p_tenant_id: tenantId, p_dossier_id: dossierId, p_trace_id: traceId,
          p_entree_hash: entreeHash, p_modele: modele, p_version: version,
        }),
        "demarrer_run",
      ) as string;
    },
    async terminerRun(runId, statut: StatutSortie, sortie, confiance, dureeMs, erreur, tokensEntree = null, tokensSortie = null) {
      verifier(
        await client.rpc("terminer_run", {
          p_run_id: runId, p_statut: statut, p_sortie: sortie, p_confiance: confiance, p_duree_ms: dureeMs, p_erreur: erreur,
          p_tokens_entree: tokensEntree, p_tokens_sortie: tokensSortie,
        }),
        "terminer_run",
      );
    },
    async lireChunks(documentId) {
      const data = verifier(
        await client.from("document_chunks").select("id,page,offset_debut,offset_fin,texte").eq("document_id", documentId).order("page").order("offset_debut"),
        "lireChunks",
      );
      return ((data as (Chunk & { id: string })[] | null) ?? []);
    },
    async enregistrerEntites(dossierId, entites) {
      const rows = (verifier(await client.rpc("enregistrer_entites", { p_dossier_id: dossierId, p_entites: entites }), "enregistrer_entites") as
        | { id_entite: string; verrouillee: boolean; creee: boolean }[]
        | null) ?? [];
      return rows.map((r) => ({ entite_id: r.id_entite, verrouillee: r.verrouillee, creee: r.creee }));
    },
    async enregistrerEvenements(dossierId, evenements) {
      const rows = (verifier(await client.rpc("enregistrer_evenements", { p_dossier_id: dossierId, p_evenements: evenements }), "enregistrer_evenements") as
        | { id_evenement: string; verrouillee: boolean; creee: boolean }[]
        | null) ?? [];
      return rows.map((r) => ({ evenement_id: r.id_evenement, verrouillee: r.verrouillee, creee: r.creee }));
    },
    async lireDocumentPages(documentId) {
      const data = verifier(
        await client.from("document_pages").select("page,texte,methode").eq("document_id", documentId).order("page"),
        "lireDocumentPages",
      );
      return (data as PageTexte[] | null) ?? [];
    },
    async enregistrerChunks(documentId, chunks: Chunk[]) {
      verifier(await client.rpc("enregistrer_chunks", { p_document_id: documentId, p_chunks: chunks }), "enregistrer_chunks");
    },
    async rechercherChunks(tenantId, dossierId, requete, embedding, limite) {
      const data = verifier(
        await client.rpc("rechercher_chunks", {
          p_tenant_id: tenantId, p_dossier_id: dossierId, p_requete: requete, p_embedding: embedding, p_limite: limite,
        }),
        "rechercher_chunks",
      );
      return ((data as ResultatRecherche[] | null) ?? []).map((r) => ({ ...r, score_fusion: Number(r.score_fusion) }));
    },
    async lireDocumentsDossier(dossierId) {
      const data = verifier(
        await client.from("dossier_documents")
          .select("id,file_name,kind,statut_ingestion,categorie,confiance_classification,pages,supprime_le,created_at")
          .eq("dossier_id", dossierId).order("created_at"),
        "lireDocumentsDossier",
      );
      return ((data as DocumentResume[] | null) ?? []).map((d) => ({
        ...d, confiance_classification: d.confiance_classification === null ? null : Number(d.confiance_classification),
      }));
    },
    async enregistrerClassification(documentId, categorie, confiance, nomNormalise, quasiDoublonDeId, similarite, traceId) {
      return verifier(
        await client.rpc("enregistrer_classification", {
          p_document_id: documentId, p_categorie: categorie, p_confiance: confiance, p_nom_normalise: nomNormalise,
          p_quasi_doublon_de_id: quasiDoublonDeId, p_similarite: similarite, p_trace_id: traceId,
        }),
        "enregistrer_classification",
      ) as { categorie_appliquee: boolean; categorie_humaine: boolean };
    },
  };
}

export function creerStockageSupabase(client: SupabaseClient, bucket = "documents"): Stockage {
  return {
    async telecharger(filePath) {
      const { data, error } = await client.storage.from(bucket).download(filePath);
      if (error || !data) throw new Error(`telecharger: ${error?.message ?? "objet absent"}`);
      return new Uint8Array(await data.arrayBuffer());
    },
  };
}
