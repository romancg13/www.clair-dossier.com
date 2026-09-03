/**
 * Implémentations de test des interfaces du pipeline :
 *   - Store sur la connexion Postgres du test (mêmes procédures serveur qu'en production) ;
 *   - Stockage sur les fichiers du dossier étalon, avec injection d'échecs pour
 *     vérifier la reprise sur erreur.
 */
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
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
} from '../../supabase/functions/_shared/pipeline/types.ts';
import type { Tx } from './harness';
import { DIR } from './etalon';

type Sql = Tx['sql'];

export function creerStorePg(sql: Sql): Store {
  return {
    async prendreTravail(types, executant) {
      const rows = await sql<Travail & { id: string | number }>(
        'select * from public.prendre_travail($1::text[], $2::text)',
        [types, executant],
      );
      const t = rows[0];
      return t ? { ...t, id: Number(t.id) } : null;
    },
    async terminerTravail(id, resultat) {
      await sql('select public.terminer_travail($1::bigint, $2::jsonb)', [id, JSON.stringify(resultat)]);
    },
    async echouerTravail(id, erreur, definitif = false) {
      await sql('select public.echouer_travail($1::bigint, $2::text, $3::boolean)', [id, erreur, definitif]);
    },
    async lireDocument(id) {
      const rows = await sql<DocumentIngestion>(
        `select id, tenant_id, dossier_id, file_path, file_name, size_bytes, mime, hash_sha256, kind,
                statut_ingestion, doublon_de_id, supprime_le
           from public.dossier_documents where id = $1::uuid`,
        [id],
      );
      const d = rows[0];
      return d ? { ...d, size_bytes: d.size_bytes === null ? null : Number(d.size_bytes) } : null;
    },
    async verifierQuota(documentId) {
      const rows = await sql<{ q: Quota }>('select public.verifier_quota_ingestion($1::uuid) as q', [documentId]);
      return rows[0].q;
    },
    async enregistrerEmpreinte(documentId, hash, mime, taille, pages = null) {
      await sql('select public.enregistrer_empreinte($1::uuid, $2::text, $3::text, $4::bigint, $5::integer)', [
        documentId, hash, mime, taille, pages,
      ]);
    },
    async enregistrerPages(documentId, pages: PageExtraite[]) {
      await sql('select public.enregistrer_pages($1::uuid, $2::jsonb)', [documentId, JSON.stringify(pages)]);
    },
    async marquerIngestion(documentId, statut, erreur, pages, traceId) {
      await sql('select public.marquer_ingestion($1::uuid, $2::text, $3::text, $4::integer, $5::uuid)', [
        documentId, statut, erreur, pages, traceId,
      ]);
    },
    async demarrerRun(agent, tenantId, dossierId, traceId, entreeHash, modele, version) {
      const rows = await sql<{ id: string }>(
        'select public.demarrer_run($1::text, $2::uuid, $3::uuid, $4::uuid, $5::text, $6::text, $7::text) as id',
        [agent, tenantId, dossierId, traceId, entreeHash, modele, version],
      );
      return rows[0].id;
    },
    async terminerRun(runId, statut: StatutSortie, sortie, confiance, dureeMs, erreur, tokensEntree = null, tokensSortie = null) {
      await sql('select public.terminer_run($1::uuid, $2::text, $3::jsonb, $4::numeric, $5::integer, $6::text, $7::integer, $8::integer)', [
        runId, statut, JSON.stringify(sortie), confiance, dureeMs, erreur, tokensEntree, tokensSortie,
      ]);
    },
    async lireChunks(documentId) {
      return sql<Chunk & { id: string }>(
        'select id, page, offset_debut, offset_fin, texte from public.document_chunks where document_id = $1::uuid order by page, offset_debut',
        [documentId],
      );
    },
    async enregistrerEntites(dossierId, entites) {
      return sql<{ entite_id: string; verrouillee: boolean; creee: boolean }>(
        'select id_entite as entite_id, verrouillee, creee from public.enregistrer_entites($1::uuid, $2::jsonb)',
        [dossierId, JSON.stringify(entites)],
      );
    },
    async enregistrerEvenements(dossierId, evenements) {
      return sql<{ evenement_id: string; verrouillee: boolean; creee: boolean }>(
        'select id_evenement as evenement_id, verrouillee, creee from public.enregistrer_evenements($1::uuid, $2::jsonb)',
        [dossierId, JSON.stringify(evenements)],
      );
    },
    async lireDocumentPages(documentId) {
      return sql<PageTexte>('select page, texte, methode from public.document_pages where document_id = $1::uuid order by page', [documentId]);
    },
    async enregistrerChunks(documentId, chunks: Chunk[]) {
      await sql('select public.enregistrer_chunks($1::uuid, $2::jsonb)', [documentId, JSON.stringify(chunks)]);
    },
    async rechercherChunks(tenantId, dossierId, requete, embedding, limite) {
      const rows = await sql<ResultatRecherche & { score_fusion: number | string }>(
        'select * from public.rechercher_chunks($1::uuid, $2::uuid, $3::text, $4::extensions.vector, $5::integer)',
        [tenantId, dossierId, requete, embedding, limite],
      );
      return rows.map((r) => ({ ...r, score_fusion: Number(r.score_fusion) }));
    },
    async lireDocumentsDossier(dossierId) {
      const rows = await sql<DocumentResume & { created_at: Date | string; supprime_le: Date | string | null }>(
        `select id, file_name, kind, statut_ingestion, categorie, confiance_classification, pages, supprime_le, created_at
           from public.dossier_documents where dossier_id = $1::uuid order by created_at, id`,
        [dossierId],
      );
      return rows.map((r) => ({
        ...r,
        created_at: new Date(r.created_at).toISOString(),
        supprime_le: r.supprime_le === null ? null : new Date(r.supprime_le).toISOString(),
        confiance_classification: r.confiance_classification === null ? null : Number(r.confiance_classification),
      }));
    },
    async enregistrerClassification(documentId, categorie, confiance, nomNormalise, quasiDoublonDeId, similarite, traceId) {
      const rows = await sql<{ r: { categorie_appliquee: boolean; categorie_humaine: boolean } }>(
        'select public.enregistrer_classification($1::uuid, $2::text, $3::numeric, $4::text, $5::uuid, $6::numeric, $7::uuid) as r',
        [documentId, categorie, confiance, nomNormalise, quasiDoublonDeId, similarite, traceId],
      );
      return rows[0].r;
    },
    async enregistrerControle(runId, sentinelRunId, verdict, iterations) {
      await sql('select public.enregistrer_controle($1::uuid, $2::uuid, $3::text, $4::integer)', [runId, sentinelRunId, verdict, iterations]);
    },
  };
}

export type OptionsStockageTest = {
  /** Octets servis pour un nom de fichier donné (prioritaire sur le dossier étalon). */
  contenus?: Record<string, Uint8Array>;
  /** Nombre d'échecs à simuler avant de servir le fichier (reprise sur erreur). */
  echecs?: Record<string, number>;
};

/** Stockage de test : sert les octets du dossier étalon d'après le nom de fichier du chemin. */
export function creerStockageEtalon(options: OptionsStockageTest = {}): Stockage & { appels: string[] } {
  const restants = { ...(options.echecs ?? {}) };
  const appels: string[] = [];
  return {
    appels,
    async telecharger(filePath) {
      const nom = filePath.split('/').pop() ?? filePath;
      appels.push(nom);
      if ((restants[nom] ?? 0) > 0) {
        restants[nom]--;
        throw new Error(`stockage indisponible (simulation) : ${nom}`);
      }
      if (options.contenus?.[nom]) return options.contenus[nom];
      const chemin = resolve(DIR, nom);
      if (!existsSync(chemin)) throw new Error(`objet absent : ${nom}`);
      return new Uint8Array(readFileSync(chemin));
    },
  };
}
