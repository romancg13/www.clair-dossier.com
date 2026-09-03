/**
 * Travail « indexation » (étapes 6 et 7 du pipeline) : découpage des pages
 * lisibles, vectorisation, enregistrement des chunks ; puis recherche hybride
 * (7.3) : embedding de la requête, fusion lexical + vectoriel côté base (filtrée
 * par tenant et dossier au niveau de la requête), reclassement déterministe.
 */
import { decouperDocument } from "./decoupage.ts";
import { embeddingLexicalHache, normaliserPourEmbedding, versTextePgvector, type FournisseurEmbedding } from "./embedding.ts";
import {
  ErreurDefinitive,
  type Chunk,
  type Incertitude,
  type ResultatRecherche,
  type SortieIndexation,
  type StatutSortie,
  type Store,
  type Travail,
} from "./types.ts";

export const VERSION_INDEXATION = "1.0";
export const TYPE_TRAVAIL_INDEXATION = "indexation";
/** Taille des lots envoyés au fournisseur d'embedding. */
export const LOT_EMBEDDING = 64;

export type OptionsIndexation = {
  embedding?: FournisseurEmbedding;
  maintenant?: () => Date;
};

export async function indexerDocument(store: Store, travail: Travail, options: OptionsIndexation = {}): Promise<SortieIndexation> {
  const debut = Date.now();
  const fournisseur = options.embedding ?? embeddingLexicalHache;
  const maintenant = options.maintenant ?? (() => new Date());
  if (!travail.document_id) throw new ErreurDefinitive("TRAVAIL_SANS_DOCUMENT");
  const doc = await store.lireDocument(travail.document_id);
  if (!doc) throw new ErreurDefinitive(`DOCUMENT_INCONNU:${travail.document_id}`);

  const incertitudes: Incertitude[] = [];
  const sortie: SortieIndexation = {
    agent: "INDEXATION",
    version: VERSION_INDEXATION,
    dossier_id: doc.dossier_id,
    trace_id: travail.trace_id,
    horodatage: maintenant().toISOString(),
    statut: "ok",
    confiance_globale: 1,
    resultat: {
      document_id: doc.id,
      statut_ingestion: doc.statut_ingestion,
      pages_indexees: [],
      pages_ignorees: [],
      nb_chunks: 0,
      nb_chunks_vectorises: 0,
      embedding_modele: fournisseur.nom,
      dimension: fournisseur.dimension,
    },
    assertions: [],
    incertitudes,
    escalades: [],
    donnees_sensibles_detectees: [],
    cout: { modele: null, tokens_entree: 0, tokens_sortie: 0 },
    duree_ms: 0,
  };
  const clore = (statut: StatutSortie) => {
    sortie.statut = statut;
    sortie.duree_ms = Date.now() - debut;
    return sortie;
  };
  // Rien à indexer : pièce retirée, doublon, échec de réception, ou texte pas encore prêt.
  if (doc.supprime_le || !["extraction", "decoupe", "vectorise"].includes(doc.statut_ingestion)) {
    return clore("ok");
  }

  const runId = await store.demarrerRun(
    "INDEXATION", doc.tenant_id, doc.dossier_id, travail.trace_id,
    `${doc.hash_sha256 ?? doc.id}:${fournisseur.nom}`, fournisseur.nom, VERSION_INDEXATION,
  );
  try {
    const pages = await store.lireDocumentPages(doc.id);
    const lisibles = pages.filter((p) => p.methode !== "ocr_requis" && p.texte.trim().length > 0);
    sortie.resultat.pages_indexees = lisibles.map((p) => p.page);
    sortie.resultat.pages_ignorees = pages.filter((p) => !lisibles.includes(p)).map((p) => p.page);
    if (sortie.resultat.pages_ignorees.length > 0) {
      incertitudes.push({ objet: `Pages non indexées (sans texte) : ${sortie.resultat.pages_ignorees.join(", ")}`, impact: "moyen", action: "E4" });
    }

    const chunks: Chunk[] = decouperDocument(lisibles);
    for (let i = 0; i < chunks.length; i += LOT_EMBEDDING) {
      const lot = chunks.slice(i, i + LOT_EMBEDDING);
      const vecteurs = await fournisseur.vectoriser(lot.map((c) => c.texte));
      lot.forEach((c, j) => {
        const v = vecteurs[j];
        if (v && v.length === fournisseur.dimension) {
          c.embedding = versTextePgvector(v);
          c.embedding_modele = fournisseur.nom;
        }
      });
    }
    sortie.resultat.nb_chunks = chunks.length;
    sortie.resultat.nb_chunks_vectorises = chunks.filter((c) => c.embedding).length;
    if (chunks.length > 0) await store.enregistrerChunks(doc.id, chunks);
    await store.marquerIngestion(doc.id, "vectorise", null, null, travail.trace_id);
    sortie.resultat.statut_ingestion = "vectorise";
    const statut: StatutSortie = sortie.resultat.pages_ignorees.length > 0 ? "partiel" : "ok";
    await store.terminerRun(runId, statut, clore(statut), 1, sortie.duree_ms, null);
    return sortie;
  } catch (e) {
    const message = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    await store.terminerRun(runId, "echec", clore("echec"), null, sortie.duree_ms, message);
    throw e;
  }
}

export type ParametresRecherche = {
  tenantId: string;
  dossierId: string;
  requete: string;
  limite?: number;
  embedding?: FournisseurEmbedding;
};

/**
 * Reclassement déterministe avant toute génération (7.3) : à fusion égale ou
 * proche, un passage qui couvre plus de termes de la requête passe devant.
 * Un reclasseur par modèle pourra s'y substituer (décision humaine, D-008).
 */
export function reclasser(resultats: ResultatRecherche[], requete: string): ResultatRecherche[] {
  const termes = new Set(normaliserPourEmbedding(requete));
  if (termes.size === 0) return resultats;
  const couverture = (texte: string) => {
    const mots = new Set(normaliserPourEmbedding(texte));
    let n = 0;
    for (const t of termes) if (mots.has(t)) n++;
    return n / termes.size;
  };
  return resultats
    .map((r) => ({ r, c: couverture(r.texte) }))
    .sort((a, b) => b.r.score_fusion + 0.02 * b.c - (a.r.score_fusion + 0.02 * a.c) || a.r.chunk_id.localeCompare(b.r.chunk_id))
    .map(({ r, c }) => ({ ...r, couverture_termes: Math.round(c * 1000) / 1000 }));
}

/** Recherche hybride dans UN dossier d'UN tenant ; les filtres sont appliqués dans la requête SQL. */
export async function rechercher(store: Store, params: ParametresRecherche): Promise<ResultatRecherche[]> {
  const fournisseur = params.embedding ?? embeddingLexicalHache;
  const [vecteur] = await fournisseur.vectoriser([params.requete]);
  const embedding = vecteur && vecteur.length === fournisseur.dimension ? versTextePgvector(vecteur) : null;
  const bruts = await store.rechercherChunks(params.tenantId, params.dossierId, params.requete, embedding, params.limite ?? 10);
  return reclasser(bruts, params.requete);
}
