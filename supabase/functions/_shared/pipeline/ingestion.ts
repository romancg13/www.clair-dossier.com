/**
 * Orchestration des étapes 1 à 5 du pipeline (PARTIE 7.1) pour UNE pièce, et
 * boucle de consommation de la file de travaux (PARTIE 7.4 : reprise sur erreur,
 * backoff côté base, verrou expirable, trace_id de bout en bout).
 *
 * Statuts de `dossier_documents.statut_ingestion` posés ici :
 *   recu → extraction (texte prêt pour le découpage, étape 7)
 *        → qualite_insuffisante (E4 : illisible, ou numérisé sans OCR disponible)
 *        → doublon (empreinte serveur identique à une pièce active du dossier)
 *        → echec (réception refusée : type, cohérence MIME, quota, fichier vide)
 * Les journaux applicatifs ne portent que des identifiants (PARTIE 11).
 */
import type { FournisseurModele } from "../agents/modele.ts";
import { executerVeritas, TYPE_TRAVAIL_VERITAS } from "../agents/veritas.ts";
import type { FournisseurEmbedding } from "./embedding.ts";
import { empreinteSha256 } from "./empreinte.ts";
import { extrairePagesPdf, type FournisseurOcr } from "./extraction.ts";
import { indexerDocument, TYPE_TRAVAIL_INDEXATION } from "./indexation.ts";
import { evaluerQualite, SEUIL_QUALITE } from "./qualite.ts";
import { controlerReception } from "./reception.ts";
import type { SortieUniverselle } from "../schema/validateur.ts";
import {
  ErreurDefinitive,
  type Escalade,
  type Incertitude,
  type PageExtraite,
  type SortieIndexation,
  type SortieIngestion,
  type StatutSortie,
  type Stockage,
  type Store,
  type Travail,
} from "./types.ts";

export const VERSION_INGESTION = "1.0";
export const TYPE_TRAVAIL_INGESTION = "ingestion";
/** Types de travaux consommés par le même exécutant, dans l'ordre de priorité de la file. */
export const TYPES_TRAVAUX = [TYPE_TRAVAIL_INGESTION, TYPE_TRAVAIL_INDEXATION, TYPE_TRAVAIL_VERITAS];

export type OptionsIngestion = {
  ocr?: FournisseurOcr | null;
  embedding?: FournisseurEmbedding;
  /** Fournisseur de modèle pour les agents ; null = extraction déterministe seule, dite comme telle. */
  modele?: FournisseurModele | null;
  nomModeleExtraction?: string;
  maintenant?: () => Date;
  /** Types de travaux à consommer (défaut : tous) — permet des exécutants dédiés. */
  types?: string[];
};

function messageErreur(e: unknown): string {
  return e instanceof Error ? `${e.name}: ${e.message}` : String(e);
}

/** Traite une pièce de bout en bout. Ne lève que pour une erreur transitoire (à réessayer). */
export async function ingererDocument(
  store: Store,
  stockage: Stockage,
  travail: Travail,
  options: OptionsIngestion = {},
): Promise<SortieIngestion> {
  const debut = Date.now();
  const maintenant = options.maintenant ?? (() => new Date());
  if (!travail.document_id) throw new ErreurDefinitive("TRAVAIL_SANS_DOCUMENT");
  const doc = await store.lireDocument(travail.document_id);
  if (!doc) throw new ErreurDefinitive(`DOCUMENT_INCONNU:${travail.document_id}`);

  const incertitudes: Incertitude[] = [];
  const escalades: Escalade[] = [];
  const sortie: SortieIngestion = {
    agent: "INGESTION",
    version: VERSION_INGESTION,
    dossier_id: doc.dossier_id,
    trace_id: travail.trace_id,
    horodatage: maintenant().toISOString(),
    statut: "ok",
    confiance_globale: 1,
    resultat: {
      document_id: doc.id,
      statut_ingestion: doc.statut_ingestion,
      erreur: null,
      hash_sha256: doc.hash_sha256,
      mime: doc.mime,
      pages: 0,
      pages_sans_texte: [],
      pages_sous_seuil: [],
      score_qualite: null,
      doublon_de_id: doc.doublon_de_id,
      controles: { quota: "ok", type: "ok", taille: "ok", antivirus: "non_disponible" },
    },
    assertions: [],
    incertitudes,
    escalades,
    donnees_sensibles_detectees: [],
    cout: { modele: null, tokens_entree: 0, tokens_sortie: 0 },
    duree_ms: 0,
  };
  const clore = (statut: StatutSortie) => {
    sortie.statut = statut;
    sortie.duree_ms = Date.now() - debut;
    return sortie;
  };

  // Rien à faire : pièce retirée, doublon déjà établi, ou déjà passée par ici.
  if (doc.supprime_le || doc.statut_ingestion === "doublon" || doc.kind !== "piece") {
    return clore("ok");
  }

  const runId = await store.demarrerRun(
    "INGESTION", doc.tenant_id, doc.dossier_id, travail.trace_id,
    doc.hash_sha256 ?? `sans-empreinte:${doc.id}`, null, VERSION_INGESTION,
  );

  try {
    // ── 1. RÉCEPTION ────────────────────────────────────────────────────────
    const quota = await store.verifierQuota(doc.id);
    const bytes = quota.ok ? await stockage.telecharger(doc.file_path) : new Uint8Array();
    const reception = controlerReception(doc, bytes, quota);
    sortie.resultat.controles = reception.controles;
    if (!reception.ok) {
      await store.marquerIngestion(doc.id, "echec", reception.erreur, null, travail.trace_id);
      sortie.resultat.statut_ingestion = "echec";
      sortie.resultat.erreur = reception.erreur;
      sortie.confiance_globale = 0;
      incertitudes.push({ objet: `Réception refusée : ${reception.erreur}`, impact: "fort", action: "aucune" });
      await store.terminerRun(runId, "echec", clore("echec"), 0, sortie.duree_ms, reception.erreur);
      return sortie;
    }
    if (reception.controles.taille !== "ok") {
      incertitudes.push({ objet: `Taille déclarée différente de la taille réelle (${reception.controles.taille})`, impact: "faible", action: "aucune" });
    }

    // ── 2. EMPREINTE (serveur, fait foi) ────────────────────────────────────
    const hash = await empreinteSha256(bytes);
    await store.enregistrerEmpreinte(doc.id, hash, reception.mime, bytes.length, null);
    sortie.resultat.hash_sha256 = hash;
    sortie.resultat.mime = reception.mime;
    const apresEmpreinte = await store.lireDocument(doc.id);
    if (apresEmpreinte?.statut_ingestion === "doublon") {
      // Aucun traitement payant sur un doublon strict (7.1, étape 2).
      sortie.resultat.statut_ingestion = "doublon";
      sortie.resultat.doublon_de_id = apresEmpreinte.doublon_de_id;
      await store.terminerRun(runId, "ok", clore("ok"), 1, sortie.duree_ms, null);
      return sortie;
    }

    // ── 3. STOCKAGE ─────────────────────────────────────────────────────────
    // L'immutabilité est garantie par la base et le bucket (étape 5) : rien à écrire.

    // ── 4. EXTRACTION ───────────────────────────────────────────────────────
    let textes: string[];
    if (reception.mime === "application/pdf") {
      const extraction = await extrairePagesPdf(bytes);
      textes = extraction.textes;
      if (quota.max_pages_par_piece && extraction.totalPages > quota.max_pages_par_piece) {
        const erreur = `QUOTA:PAGES_MAX_DEPASSEES:${extraction.totalPages}>${quota.max_pages_par_piece}`;
        await store.marquerIngestion(doc.id, "echec", erreur, extraction.totalPages, travail.trace_id);
        sortie.resultat.statut_ingestion = "echec";
        sortie.resultat.erreur = erreur;
        sortie.resultat.pages = extraction.totalPages;
        sortie.confiance_globale = 0;
        await store.terminerRun(runId, "echec", clore("echec"), 0, sortie.duree_ms, erreur);
        return sortie;
      }
    } else {
      textes = [""]; // image : aucune couche texte
    }

    // ── 5. QUALITÉ ──────────────────────────────────────────────────────────
    const evaluation = evaluerQualite(textes);
    let pages: PageExtraite[] = evaluation.pages;
    if (evaluation.pages_sans_texte.length > 0 && options.ocr) {
      const reconnues = await options.ocr.reconnaitre(bytes, reception.mime, evaluation.pages_sans_texte);
      const parPage = new Map(reconnues.map((r) => [r.page, r.texte]));
      const textesOcr = textes.map((t, i) => parPage.get(i + 1) ?? t);
      const reevaluation = evaluerQualite(textesOcr);
      pages = reevaluation.pages.map((p) => (parPage.has(p.page) && p.methode === "natif" ? { ...p, methode: "ocr" } : p));
      evaluation.pages_sans_texte = reevaluation.pages_sans_texte;
      evaluation.pages_sous_seuil = reevaluation.pages_sous_seuil;
      evaluation.score_document = reevaluation.score_document;
    }
    await store.enregistrerPages(doc.id, pages);
    sortie.resultat.pages = pages.length;
    sortie.resultat.pages_sans_texte = evaluation.pages_sans_texte;
    sortie.resultat.pages_sous_seuil = evaluation.pages_sous_seuil;
    sortie.resultat.score_qualite = evaluation.score_document;

    const toutesSansTexte = evaluation.pages_sans_texte.length === pages.length;
    const sousSeuil = evaluation.score_document !== null && evaluation.score_document < SEUIL_QUALITE;
    let statutDoc: string;
    let erreur: string | null = null;
    let statutSortie: StatutSortie = "ok";
    if (toutesSansTexte) {
      statutDoc = "qualite_insuffisante";
      erreur = options.ocr ? "OCR_SANS_RESULTAT" : "OCR_REQUIS_NON_DISPONIBLE";
      escalades.push({
        code: "E4",
        destinataire: "utilisateur",
        motif: options.ocr
          ? "Pièce numérisée dont la lecture optique n'a produit aucun texte exploitable : une version texte ou une numérisation plus nette est nécessaire."
          : "Pièce numérisée sans couche texte : la lecture optique n'est pas disponible pour l'instant. Déposez une version texte (PDF natif) si vous en disposez.",
      });
      statutSortie = "escalade";
    } else if (sousSeuil) {
      statutDoc = "qualite_insuffisante";
      erreur = `LISIBILITE_INSUFFISANTE:${evaluation.score_document}`;
      escalades.push({
        code: "E4",
        destinataire: "utilisateur",
        motif: `Texte extrait peu lisible (score ${evaluation.score_document} < ${SEUIL_QUALITE}) : une nouvelle numérisation ou une version texte est nécessaire.`,
      });
      statutSortie = "escalade";
    } else {
      statutDoc = "extraction";
      if (evaluation.pages_sans_texte.length > 0) {
        escalades.push({
          code: "E4",
          destinataire: "utilisateur",
          motif: `Pages sans texte exploitable : ${evaluation.pages_sans_texte.join(", ")}. Elles ne seront pas analysées tant qu'une version lisible n'est pas fournie.`,
        });
        incertitudes.push({ objet: `Pages non lues : ${evaluation.pages_sans_texte.join(", ")}`, impact: "moyen", action: "E4" });
        statutSortie = "partiel";
      }
      if (evaluation.pages_sous_seuil.length > 0) {
        incertitudes.push({ objet: `Pages peu lisibles : ${evaluation.pages_sous_seuil.join(", ")}`, impact: "moyen", action: "E4" });
        if (statutSortie === "ok") statutSortie = "partiel";
      }
    }
    await store.marquerIngestion(doc.id, statutDoc, erreur, pages.length, travail.trace_id);
    sortie.resultat.statut_ingestion = statutDoc;
    sortie.resultat.erreur = erreur;
    sortie.confiance_globale = evaluation.score_document ?? 0;
    await store.terminerRun(runId, statutSortie, clore(statutSortie), sortie.confiance_globale, sortie.duree_ms, erreur);
    return sortie;
  } catch (e) {
    const message = messageErreur(e);
    await store.terminerRun(runId, "echec", clore("echec"), null, sortie.duree_ms, message);
    throw e;
  }
}

export type ResultatTravail =
  | { travail: Travail; issue: "termine"; sortie: SortieIngestion | SortieIndexation | SortieUniverselle }
  | { travail: Travail; issue: "reessai" | "echec"; erreur: string };

/** Prend et traite UN travail (ingestion ou indexation) ; null si la file est vide. */
export async function traiterProchainTravail(
  store: Store,
  stockage: Stockage,
  executant: string,
  options: OptionsIngestion = {},
): Promise<ResultatTravail | null> {
  const travail = await store.prendreTravail(options.types ?? TYPES_TRAVAUX, executant);
  if (!travail) return null;
  try {
    if (travail.type === TYPE_TRAVAIL_INDEXATION) {
      const sortie = await indexerDocument(store, travail, { embedding: options.embedding, maintenant: options.maintenant });
      await store.terminerTravail(travail.id, {
        statut: sortie.statut,
        statut_ingestion: sortie.resultat.statut_ingestion,
        nb_chunks: sortie.resultat.nb_chunks,
        nb_chunks_vectorises: sortie.resultat.nb_chunks_vectorises,
        duree_ms: sortie.duree_ms,
      });
      return { travail, issue: "termine", sortie };
    }
    if (travail.type === TYPE_TRAVAIL_VERITAS) {
      const bilan = await executerVeritas(store, travail, { modele: options.modele ?? null, nomModele: options.nomModeleExtraction, maintenant: options.maintenant });
      await store.terminerTravail(travail.id, {
        statut: bilan.sortie.statut,
        nb_entites: bilan.entites.length,
        nb_evenements: bilan.evenements.length,
        nb_rejets_ancrage: bilan.rejets.length,
        escalades: bilan.sortie.escalades.map((e) => e.code),
        duree_ms: bilan.sortie.duree_ms,
      });
      return { travail, issue: "termine", sortie: bilan.sortie };
    }
    if (travail.type !== TYPE_TRAVAIL_INGESTION) {
      throw new ErreurDefinitive(`TYPE_TRAVAIL_INCONNU:${travail.type}`);
    }
    const sortie = await ingererDocument(store, stockage, travail, options);
    await store.terminerTravail(travail.id, {
      statut: sortie.statut,
      statut_ingestion: sortie.resultat.statut_ingestion,
      erreur: sortie.resultat.erreur,
      pages: sortie.resultat.pages,
      escalades: sortie.escalades.map((e) => e.code),
      duree_ms: sortie.duree_ms,
    });
    return { travail, issue: "termine", sortie };
  } catch (e) {
    const erreur = messageErreur(e);
    const definitif = e instanceof ErreurDefinitive;
    await store.echouerTravail(travail.id, erreur, definitif);
    const epuise = definitif || travail.tentatives >= travail.max_tentatives;
    return { travail, issue: epuise ? "echec" : "reessai", erreur };
  }
}

export type BilanFile = {
  executant: string;
  traites: number;
  termines: number;
  reessais: number;
  echecs: number;
  duree_ms: number;
  /** Identifiants seulement (PARTIE 11 : aucune donnée de dossier dans les journaux). */
  travaux: { id: number; document_id: string | null; issue: ResultatTravail["issue"] }[];
};

/** Consomme la file jusqu'à épuisement, au plus `maxTravaux` ou `dureeMaxMs`. */
export async function executerFile(
  store: Store,
  stockage: Stockage,
  params: { executant: string; maxTravaux?: number; dureeMaxMs?: number } & OptionsIngestion,
): Promise<BilanFile> {
  const debut = Date.now();
  const bilan: BilanFile = { executant: params.executant, traites: 0, termines: 0, reessais: 0, echecs: 0, duree_ms: 0, travaux: [] };
  const max = params.maxTravaux ?? 20;
  const dureeMax = params.dureeMaxMs ?? 50_000;
  while (bilan.traites < max && Date.now() - debut < dureeMax) {
    const r = await traiterProchainTravail(store, stockage, params.executant, params);
    if (!r) break;
    bilan.traites++;
    if (r.issue === "termine") bilan.termines++;
    else if (r.issue === "reessai") bilan.reessais++;
    else bilan.echecs++;
    bilan.travaux.push({ id: r.travail.id, document_id: r.travail.document_id, issue: r.issue });
  }
  bilan.duree_ms = Date.now() - debut;
  return bilan;
}
