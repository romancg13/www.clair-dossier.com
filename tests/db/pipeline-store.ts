/**
 * Implémentations de test des interfaces du pipeline :
 *   - Store sur la connexion Postgres du test (mêmes procédures serveur qu'en production) ;
 *   - Stockage sur les fichiers du dossier étalon, avec injection d'échecs pour
 *     vérifier la reprise sur erreur.
 */
import { resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
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
        `select id, file_name, kind, statut_ingestion, categorie, confiance_classification, pages, supprime_le, created_at,
                categorie_humaine, quasi_doublon_de_id, similarite
           from public.dossier_documents where dossier_id = $1::uuid order by created_at, id`,
        [dossierId],
      );
      return rows.map((r) => ({
        ...r,
        created_at: new Date(r.created_at).toISOString(),
        supprime_le: r.supprime_le === null ? null : new Date(r.supprime_le).toISOString(),
        confiance_classification: r.confiance_classification === null ? null : Number(r.confiance_classification),
        similarite: r.similarite === null || r.similarite === undefined ? null : Number(r.similarite),
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
    async enregistrerControleEcho(runId, echoRunId, verdict) {
      await sql('select public.enregistrer_controle_echo($1::uuid, $2::uuid, $3::text)', [runId, echoRunId, verdict]);
    },
    async lireContexteConformite(dossierId, finalite) {
      const [d] = await sql<{ tenant_id: string; typology: string | null }>('select tenant_id, typology from public.dossiers where id = $1::uuid', [dossierId]);
      const [f] = await sql<{ code: string; base_legale: string; consentement_requis: boolean; categories_sensibles_admises: string[] }>(
        'select code, base_legale, consentement_requis, categories_sensibles_admises from public.finalites where code = $1::text', [finalite],
      );
      const [c] = await sql<{ ok: boolean }>('select public.consentement_effectif($1::uuid, $2::text) as ok', [d.tenant_id, finalite]);
      return { finalite: f ?? null, consentement_effectif: c.ok === true, typology: d.typology, tenant_id: d.tenant_id };
    },
    async journaliser(action, objetType, objetId, tenantId, dossierId, apres, traceId) {
      await sql(
        "select public.journaliser($1::text, $2::text, $3::uuid, $4::uuid, $5::uuid, null, $6::jsonb, 'agent', $7::uuid)",
        [action, objetType, objetId, tenantId, dossierId, JSON.stringify(apres), traceId],
      );
    },
    async lireDossier(dossierId) {
      const rows = await sql<DossierResume>('select id, tenant_id, typology, title, status from public.dossiers where id = $1::uuid', [dossierId]);
      return rows[0] ?? null;
    },
    async lireRuns(dossierId) {
      const rows = await sql<{ id: string; agent: string; statut: string; confiance: string | null; sentinel_verdict: string | null; echo_verdict: string | null; document_id: string | null; escalades: Escalade[] | null; resultat: Record<string, unknown> | null; tokens_entree: number | null; tokens_sortie: number | null; created_at: Date; trace_id: string }>(
        `select id, agent, statut, confiance, sentinel_verdict, echo_verdict, sortie->'resultat'->>'document_id' as document_id,
                sortie->'escalades' as escalades, sortie->'resultat' as resultat, tokens_entree, tokens_sortie, created_at, trace_id
           from public.agent_runs where dossier_id = $1::uuid and agent not in ('SENTINEL', 'ECHO') order by created_at desc, id desc`,
        [dossierId],
      );
      return rows.map((r) => ({
        ...r, confiance: r.confiance === null ? null : Number(r.confiance), escalades: r.escalades ?? [], resultat: r.resultat ?? {},
        tokens_entree: r.tokens_entree ?? 0, tokens_sortie: r.tokens_sortie ?? 0, created_at: new Date(r.created_at).toISOString(),
      }));
    },
    async lireResumeAnalyses(dossierId) {
      const [c] = await sql<{ nb_entites: string; nb_a_verifier: string; nb_verrouillees: string; nb_evenements: string; tokens_total: string }>(
        `select (select count(*) from public.entites where dossier_id = $1::uuid)::text as nb_entites,
                (select count(*) from public.entites where dossier_id = $1::uuid and nature = 'a_verifier')::text as nb_a_verifier,
                (select count(*) from public.entites where dossier_id = $1::uuid and verrouille_humain)::text as nb_verrouillees,
                (select count(*) from public.evenements where dossier_id = $1::uuid)::text as nb_evenements,
                (select coalesce(sum(coalesce(tokens_entree, 0) + coalesce(tokens_sortie, 0)), 0) from public.agent_runs where dossier_id = $1::uuid)::text as tokens_total`,
        [dossierId],
      );
      const liens = await sql<{ document_id: string; cle: string }>(
        `select distinct c.document_id, e.type || ':' || e.valeur_normalisee as cle
           from public.entites e join public.entite_sources s on s.entite_id = e.id join public.document_chunks c on c.id = s.chunk_id
          where e.dossier_id = $1::uuid order by 1, 2`,
        [dossierId],
      );
      const parDocument: Record<string, string[]> = {};
      for (const l of liens) (parDocument[l.document_id] ??= []).push(l.cle);
      return {
        nb_entites: Number(c.nb_entites), nb_entites_a_verifier: Number(c.nb_a_verifier), nb_entites_verrouillees: Number(c.nb_verrouillees),
        nb_evenements: Number(c.nb_evenements), entites_par_document: parDocument, tokens_total: Number(c.tokens_total),
      };
    },
    async lireBudget(dossierId) {
      const [r] = await sql<{ b: Budget }>('select public.budget_dossier($1::uuid) as b', [dossierId]);
      return { ...r.b, consomme: Number(r.b.consomme), depasse: r.b.depasse === true };
    },
    async lireOrchestrationsEnAttente(dossierId) {
      const rows = await sql<Orchestration & { created_at: Date }>(
        `select id, tenant_id, dossier_id, trace_id, source, demande, intention, statut, created_at from public.orchestrations
          where dossier_id = $1::uuid and statut in ('planifiee', 'en_cours') order by created_at, id`,
        [dossierId],
      );
      return rows.map((r) => ({ ...r, created_at: new Date(r.created_at).toISOString() }));
    },
    async enregistrerOrchestration(id, statut, intention, plan, agentRunId, escalade, resume) {
      await sql('select public.enregistrer_orchestration($1::uuid, $2::text, $3::text, $4::jsonb, $5::uuid, $6::text, $7::jsonb)', [
        id, statut, intention, JSON.stringify(plan), agentRunId, escalade, JSON.stringify(resume),
      ]);
    },
    async planifierTravail(type, tenantId, dossierId, documentId, charge, priorite) {
      const [r] = await sql<{ id: string | null }>('select public.planifier_travail($1::text, $2::uuid, $3::uuid, $4::uuid, $5::jsonb, $6::integer) as id', [
        type, tenantId, dossierId, documentId, JSON.stringify(charge), priorite,
      ]);
      return r.id === null ? null : Number(r.id);
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
