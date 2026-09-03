/**
 * Implémentation Supabase (rôle de service) des interfaces Store et Stockage.
 * Toutes les écritures passent par les procédures serveur de la migration
 * 20260903150000 (SECURITY DEFINER, refusées à tout appel client).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Budget,
  Chunk,
  DocumentIngestion,
  DocumentResume,
  DossierResume,
  Escalade,
  Orchestration,
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
          .select("id,file_name,kind,statut_ingestion,categorie,confiance_classification,pages,supprime_le,created_at,categorie_humaine,quasi_doublon_de_id,similarite")
          .eq("dossier_id", dossierId).order("created_at"),
        "lireDocumentsDossier",
      );
      return ((data as DocumentResume[] | null) ?? []).map((d) => ({
        ...d, confiance_classification: d.confiance_classification === null ? null : Number(d.confiance_classification),
        similarite: d.similarite === null || d.similarite === undefined ? null : Number(d.similarite),
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
    async enregistrerControle(runId, sentinelRunId, verdict, iterations) {
      verifier(
        await client.rpc("enregistrer_controle", { p_run_id: runId, p_sentinel_run_id: sentinelRunId, p_verdict: verdict, p_iterations: iterations }),
        "enregistrer_controle",
      );
    },
    async enregistrerControleEcho(runId, echoRunId, verdict) {
      verifier(await client.rpc("enregistrer_controle_echo", { p_run_id: runId, p_echo_run_id: echoRunId, p_verdict: verdict }), "enregistrer_controle_echo");
    },
    async lireContexteConformite(dossierId, finalite) {
      const dossier = verifier(await client.from("dossiers").select("tenant_id,typology").eq("id", dossierId).single(), "lireContexteConformite.dossier") as { tenant_id: string; typology: string | null };
      const f = verifier(
        await client.from("finalites").select("code,base_legale,consentement_requis,categories_sensibles_admises").eq("code", finalite).maybeSingle(),
        "lireContexteConformite.finalite",
      ) as { code: string; base_legale: string; consentement_requis: boolean; categories_sensibles_admises: string[] } | null;
      const consentement = verifier(await client.rpc("consentement_effectif", { p_tenant_id: dossier.tenant_id, p_finalite: finalite }), "consentement_effectif") as boolean;
      return { finalite: f, consentement_effectif: consentement === true, typology: dossier.typology, tenant_id: dossier.tenant_id };
    },
    async journaliser(action, objetType, objetId, tenantId, dossierId, apres, traceId) {
      verifier(
        await client.rpc("journaliser", {
          p_action: action, p_objet_type: objetType, p_objet_id: objetId, p_tenant_id: tenantId, p_dossier_id: dossierId,
          p_avant: null, p_apres: apres, p_acteur_type: "agent", p_trace_id: traceId,
        }),
        "journaliser",
      );
    },
    async lireDossier(dossierId) {
      const data = verifier(await client.from("dossiers").select("id,tenant_id,typology,title,status").eq("id", dossierId).maybeSingle(), "lireDossier");
      return (data as DossierResume | null) ?? null;
    },
    async lireRuns(dossierId) {
      const data = verifier(
        await client.from("agent_runs")
          .select("id,agent,statut,confiance,sentinel_verdict,echo_verdict,sortie,tokens_entree,tokens_sortie,created_at,trace_id")
          .eq("dossier_id", dossierId).not("agent", "in", "(SENTINEL,ECHO)").order("created_at", { ascending: false }),
        "lireRuns",
      ) as { id: string; agent: string; statut: string; confiance: number | string | null; sentinel_verdict: string | null; echo_verdict: string | null; sortie: { resultat?: Record<string, unknown>; escalades?: Escalade[] } | null; tokens_entree: number | null; tokens_sortie: number | null; created_at: string; trace_id: string }[] | null;
      return (data ?? []).map((r) => ({
        id: r.id, agent: r.agent, statut: r.statut, confiance: r.confiance === null ? null : Number(r.confiance),
        sentinel_verdict: r.sentinel_verdict, echo_verdict: r.echo_verdict,
        document_id: typeof r.sortie?.resultat?.document_id === "string" ? r.sortie.resultat.document_id : null,
        escalades: r.sortie?.escalades ?? [], resultat: r.sortie?.resultat ?? {},
        tokens_entree: r.tokens_entree ?? 0, tokens_sortie: r.tokens_sortie ?? 0, created_at: r.created_at, trace_id: r.trace_id,
      }));
    },
    async lireResumeAnalyses(dossierId) {
      const entites = verifier(
        await client.from("entites").select("id,type,valeur_normalisee,nature,verrouille_humain,entite_sources(document_chunks(document_id))").eq("dossier_id", dossierId),
        "lireResumeAnalyses.entites",
      ) as { type: string; valeur_normalisee: string; nature: string; verrouille_humain: boolean; entite_sources: { document_chunks: { document_id: string } | null }[] }[] | null;
      const parDocument: Record<string, Set<string>> = {};
      for (const e of entites ?? []) {
        for (const s of e.entite_sources ?? []) {
          const d = s.document_chunks?.document_id;
          if (!d) continue;
          (parDocument[d] ??= new Set()).add(`${e.type}:${e.valeur_normalisee}`);
        }
      }
      const evenements = verifier(await client.from("evenements").select("id", { count: "exact", head: true }).eq("dossier_id", dossierId), "lireResumeAnalyses.evenements");
      void evenements;
      const nbEvenements = (await client.from("evenements").select("id", { count: "exact", head: true }).eq("dossier_id", dossierId)).count ?? 0;
      const runs = verifier(await client.from("agent_runs").select("tokens_entree,tokens_sortie").eq("dossier_id", dossierId), "lireResumeAnalyses.runs") as { tokens_entree: number | null; tokens_sortie: number | null }[] | null;
      return {
        nb_entites: (entites ?? []).length,
        nb_entites_a_verifier: (entites ?? []).filter((e) => e.nature === "a_verifier").length,
        nb_entites_verrouillees: (entites ?? []).filter((e) => e.verrouille_humain).length,
        nb_evenements: nbEvenements,
        entites_par_document: Object.fromEntries(Object.entries(parDocument).map(([k, v]) => [k, Array.from(v).sort()])),
        tokens_total: (runs ?? []).reduce((s, r) => s + (r.tokens_entree ?? 0) + (r.tokens_sortie ?? 0), 0),
      };
    },
    async lireBudget(dossierId) {
      const b = verifier(await client.rpc("budget_dossier", { p_dossier_id: dossierId }), "budget_dossier") as Budget;
      return { ...b, consomme: Number(b.consomme), depasse: b.depasse === true };
    },
    async lireOrchestrationsEnAttente(dossierId) {
      const data = verifier(
        await client.from("orchestrations").select("id,tenant_id,dossier_id,trace_id,source,demande,intention,statut,created_at")
          .eq("dossier_id", dossierId).in("statut", ["planifiee", "en_cours"]).order("created_at"),
        "lireOrchestrationsEnAttente",
      );
      return (data as Orchestration[] | null) ?? [];
    },
    async enregistrerOrchestration(id, statut, intention, plan, agentRunId, escalade, resume) {
      verifier(
        await client.rpc("enregistrer_orchestration", {
          p_id: id, p_statut: statut, p_intention: intention, p_plan: plan, p_agent_run_id: agentRunId, p_escalade: escalade, p_resume: resume,
        }),
        "enregistrer_orchestration",
      );
    },
    async planifierTravail(type, tenantId, dossierId, documentId, charge, priorite) {
      const id = verifier(
        await client.rpc("planifier_travail", { p_type: type, p_tenant_id: tenantId, p_dossier_id: dossierId, p_document_id: documentId, p_charge: charge, p_priorite: priorite }),
        "planifier_travail",
      ) as number | string | null;
      return id === null ? null : Number(id);
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
