/**
 * Étape 7 — critère de sortie : « recherche hybride fonctionnelle et filtrée ».
 *
 * Le dossier étalon traverse ingestion puis indexation (file de travaux réelle),
 * les chunks sont vectorisés (1024 dimensions, index HNSW), puis la recherche
 * hybride est interrogée : résultats attendus de la vérité terrain pour A, rien
 * pour B ni hors du dossier, filtrage dans la requête SQL elle-même.
 */
import { describe, expect, it } from 'vitest';
import { executerFile } from '../../supabase/functions/_shared/pipeline/ingestion.ts';
import { rechercher } from '../../supabase/functions/_shared/pipeline/indexation.ts';
import { valider } from '../../supabase/functions/_shared/schema/validateur.ts';
import { deposer, dossierEtalon, manifest, verite } from './etalon';
import { type Tx, withTx } from './harness';
import { creerStockageEtalon, creerStorePg } from './pipeline-store';

async function indexerEtalon(tx: Tx) {
  const f = await dossierEtalon(tx);
  for (const p of manifest.pieces) await deposer(tx, f.a.id, f.dossierId, p.fichier);
  await tx.asService();
  await tx.sql("select set_config('clair.acteur', 'agent', true)");
  const store = creerStorePg(tx.sql);
  // Premier passage : ingestion ; les indexations mises en file par trigger sont
  // consommées dans la même boucle (la file est vidée jusqu'à épuisement).
  // Étapes 6 et 7 seulement : l'extraction (VERITAS, étape 9) a son propre test.
  const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-index', maxTravaux: 100, types: ['ingestion', 'indexation'] });
  return { f, store, bilan };
}

describe('découpage, vectorisation, index cloisonné, recherche hybride (PARTIE 7.1 étapes 6–7, 7.3)', () => {
  it('les pièces lisibles sont découpées et vectorisées ; les statuts et l’index sont en place', async () => {
    await withTx(async (tx) => {
      const { f, bilan } = await indexerEtalon(tx);
      const attendus = verite.ingestion_attendue.extraction.length;
      expect(bilan.echecs).toBe(0);
      // ingestion (pièces non doublons) + indexation (pièces lisibles)
      expect(bilan.traites).toBe(manifest.pieces.length - verite.ingestion_attendue.doublon.length + attendus);

      const docs = await tx.sql<{ file_name: string; statut_ingestion: string; n: string; vectorises: string }>(
        `select d.file_name, d.statut_ingestion, count(c.id)::text as n, count(c.embedding)::text as vectorises
           from public.dossier_documents d left join public.document_chunks c on c.document_id = d.id
          where d.dossier_id = $1 group by d.id order by d.file_name`,
        [f.dossierId],
      );
      for (const nom of verite.ingestion_attendue.extraction) {
        const d = docs.find((x) => x.file_name === nom)!;
        expect(d.statut_ingestion, nom).toBe('vectorise');
        expect(Number(d.n), nom).toBeGreaterThan(0);
        expect(d.vectorises, nom).toBe(d.n);
      }
      for (const nom of [...verite.ingestion_attendue.doublon, ...verite.ingestion_attendue.qualite_insuffisante]) {
        expect(Number(docs.find((x) => x.file_name === nom)!.n), nom).toBe(0);
      }
      const dims = await tx.sql<{ d: number }>('select distinct extensions.vector_dims(embedding) as d from public.document_chunks');
      expect(dims).toEqual([{ d: 1024 }]);
      const modeles = await tx.sql<{ m: string }>('select distinct embedding_modele as m from public.document_chunks');
      expect(modeles).toEqual([{ m: 'lexical-hache-fnv1a-1024' }]);
      const index = await tx.sql<{ indexdef: string }>(
        "select indexdef from pg_indexes where schemaname = 'public' and tablename = 'document_chunks' and indexname = 'document_chunks_embedding_hnsw_idx'",
      );
      expect(index[0]?.indexdef).toMatch(/USING hnsw/);
      // Chaque chunk se relit exactement dans sa page (offsets conservés).
      const coherence = await tx.sql<{ ok: boolean }>(
        `select bool_and(substring(p.texte from c.offset_debut + 1 for c.offset_fin - c.offset_debut) = c.texte) as ok
           from public.document_chunks c join public.document_pages p on p.document_id = c.document_id and p.page = c.page`,
      );
      expect(coherence[0].ok).toBe(true);
      const runs = await tx.sql<{ agent: string; statut: string; n: string }>(
        "select agent, statut, count(*)::text as n from public.agent_runs group by agent, statut order by agent, statut",
      );
      expect(runs).toEqual(expect.arrayContaining([{ agent: 'INDEXATION', statut: 'ok', n: String(attendus) }]));
      // Contrat de schéma : les sorties d'indexation persistées sont conformes au schéma universel.
      const sorties = await tx.sql<{ sortie: unknown }>("select sortie from public.agent_runs where agent = 'INDEXATION'");
      expect(sorties.length).toBe(attendus);
      for (const s of sorties) expect(valider(s.sortie)).toMatchObject({ valide: true });
    });
  });

  it('la recherche hybride renvoie les pièces attendues par la vérité terrain, avec page et passage', async () => {
    await withTx(async (tx) => {
      const { f, store } = await indexerEtalon(tx);
      for (const cas of verite.recherche_attendue) {
        const resultats = await rechercher(store, { tenantId: f.a.tenantId, dossierId: f.dossierId, requete: cas.requete, limite: 5 });
        expect(resultats.length, cas.requete).toBeGreaterThan(0);
        expect(cas.pieces_attendues, cas.requete).toContain(resultats[0].file_name);
        expect(resultats[0].page).toBeGreaterThanOrEqual(1);
        expect(resultats[0].texte.length).toBeGreaterThan(0);
        expect(resultats[0].score_fusion).toBeGreaterThan(0);
        // Les deux voies contribuent : au moins un résultat porte un rang lexical ET un rang vectoriel.
        expect(resultats.some((r) => r.rang_lexical !== null && r.rang_vectoriel !== null), cas.requete).toBe(true);
      }
      // Requête vide : rien, sans erreur. Requête sans aucun mot : voie lexicale seule, sans erreur.
      expect(await rechercher(store, { tenantId: f.a.tenantId, dossierId: f.dossierId, requete: '   ' })).toEqual([]);
      expect(Array.isArray(await rechercher(store, { tenantId: f.a.tenantId, dossierId: f.dossierId, requete: '???' }))).toBe(true);
    });
  });

  it('le filtrage est dans la requête : rien pour un autre tenant, rien hors du dossier, rien pour une pièce retirée', async () => {
    await withTx(async (tx) => {
      const { f, store } = await indexerEtalon(tx);
      const requete = verite.recherche_attendue[0].requete;
      // Même rôle de service (contourne la RLS) : le filtre tenant + dossier explicite suffit.
      expect(await rechercher(store, { tenantId: f.b.tenantId, dossierId: f.dossierId, requete })).toEqual([]);
      const autre = await tx.sql<{ id: string }>(
        "insert into public.dossiers (user_id, typology, title, status) values ($1, 'autre', 'Autre dossier de A', 'transmis') returning id",
        [f.a.id],
      );
      expect(await rechercher(store, { tenantId: f.a.tenantId, dossierId: autre[0].id, requete })).toEqual([]);

      // En tant que B, via la fonction SQL exposée (RLS + filtre) : rien, même avec les identifiants de A.
      await tx.as(f.b.id);
      const parB = await tx.sql('select * from public.rechercher_chunks($1::uuid, $2::uuid, $3::text)', [f.a.tenantId, f.dossierId, requete]);
      expect(parB).toEqual([]);
      // En tant que A : résultats ; puis la pièce retirée disparaît des résultats.
      await tx.as(f.a.id);
      const parA = await tx.sql<{ file_name: string; document_id: string }>(
        'select file_name, document_id from public.rechercher_chunks($1::uuid, $2::uuid, $3::text)',
        [f.a.tenantId, f.dossierId, requete],
      );
      expect(parA[0].file_name).toBe(verite.recherche_attendue[0].pieces_attendues[0]);
      await tx.sql('update public.dossier_documents set supprime_le = now() where id = $1', [parA[0].document_id]);
      const apres = await tx.sql<{ file_name: string }>(
        'select file_name from public.rechercher_chunks($1::uuid, $2::uuid, $3::text)',
        [f.a.tenantId, f.dossierId, requete],
      );
      expect(apres.map((r) => r.file_name)).not.toContain(parA[0].file_name);
    });
  });

  it('réindexer une pièce est idempotent (aucun doublon de chunk) et le journal trace chaque étape', async () => {
    await withTx(async (tx) => {
      const { f, store } = await indexerEtalon(tx);
      const [doc] = await tx.sql<{ id: string; n: string }>(
        `select d.id, count(c.id)::text as n from public.dossier_documents d join public.document_chunks c on c.document_id = d.id
          where d.file_name = $1 group by d.id`,
        ['05-mise-en-demeure-2026-02-20.pdf'],
      );
      await tx.sql("select public.planifier_travail('indexation', $1::uuid, $2::uuid, $3::uuid)", [f.a.tenantId, f.dossierId, doc.id]);
      const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-reindex', types: ['indexation'] });
      expect(bilan).toMatchObject({ traites: 1, termines: 1 });
      const [apres] = await tx.sql<{ n: string }>('select count(*)::text as n from public.document_chunks where document_id = $1', [doc.id]);
      expect(apres.n).toBe(doc.n);
      const journal = await tx.sql<{ apres: { statut_ingestion: string } }>(
        "select apres from public.audit_log where action = 'document.ingestion' and objet_id = $1 order by id",
        [doc.id],
      );
      expect(journal.map((j) => j.apres.statut_ingestion)).toEqual(['extraction', 'vectorise', 'vectorise']);
    });
  });
});
