/**
 * Étape 9 — critère de sortie : « aucune entité sans source sur le dossier étalon ».
 *
 * Le dossier étalon traverse ingestion → indexation → VERITAS dans la base locale.
 * Sans fournisseur de modèle (aucune clé ici), VERITAS n'exécute que ses
 * extractions déterministes et le dit ; un modèle simulé vérifie ensuite le chemin
 * complet (ancrage vérifié, fabrication rejetée, événement persisté avec source,
 * verrou humain respecté, réanalyse idempotente).
 */
import { describe, expect, it } from 'vitest';
import { modeleSimule } from '../../supabase/functions/_shared/agents/modele.ts';
import { executerFile } from '../../supabase/functions/_shared/pipeline/ingestion.ts';
import { valider } from '../../supabase/functions/_shared/schema/validateur.ts';
import { deposer, dossierEtalon, manifest, verite } from './etalon';
import { type Tx, withTx } from './harness';
import { creerStockageEtalon, creerStorePg } from './pipeline-store';

async function analyserEtalon(tx: Tx, options: Parameters<typeof executerFile>[2] extends infer O ? Partial<O> : never = {}) {
  const f = await dossierEtalon(tx);
  const ids = new Map<string, string>();
  for (const p of manifest.pieces) ids.set(p.fichier, (await deposer(tx, f.a.id, f.dossierId, p.fichier)).id);
  await tx.asService();
  await tx.sql("select set_config('clair.acteur', 'agent', true)");
  const store = creerStorePg(tx.sql);
  const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-veritas', maxTravaux: 200, modele: null, ...options });
  return { f, store, bilan, ids };
}

const SANS_SOURCE = `
  select count(*)::text as n from public.entites e
   where not exists (select 1 from public.entite_sources s where s.entite_id = e.id)
     and e.nature not in ('declaration_client', 'deduction')`;

describe('VERITAS sur le dossier étalon (extraction ancrée, I2)', () => {
  it('aucune entité sans source ; toutes les entités attendues de la vérité terrain sont présentes (rappel 100 %)', async () => {
    await withTx(async (tx) => {
      const { f, bilan } = await analyserEtalon(tx);
      expect(bilan.echecs).toBe(0);
      const attendus = verite.ingestion_attendue.extraction.length;
      // ingestion + indexation + veritas pour chaque pièce lisible ; ingestion seule pour l'illisible.
      expect(bilan.traites).toBe(manifest.pieces.length - verite.ingestion_attendue.doublon.length + 2 * attendus);

      expect((await tx.sql<{ n: string }>(SANS_SOURCE))[0].n).toBe('0');
      const entites = await tx.sql<{ type: string; valeur_normalisee: string; nature: string; nb: string; pieces: string[] }>(
        `select e.type, e.valeur_normalisee, e.nature, count(s.chunk_id)::text as nb,
                array_agg(distinct d.file_name order by d.file_name) as pieces
           from public.entites e
           join public.entite_sources s on s.entite_id = e.id
           join public.document_chunks c on c.id = s.chunk_id
           join public.dossier_documents d on d.id = c.document_id
          where e.dossier_id = $1 group by e.id order by e.type, e.valeur_normalisee`,
        [f.dossierId],
      );
      expect(entites.length).toBeGreaterThan(10);
      const manquantes = verite.entites_attendues.filter(
        (a) => !entites.some((e) => e.type === a.type && e.valeur_normalisee === a.valeur_normalisee && a.pieces.every((p) => e.pieces.includes(p))),
      );
      expect(manquantes, 'entités attendues absentes').toEqual([]);
      for (const e of entites) {
        expect(Number(e.nb)).toBeGreaterThan(0);
        expect(e.nature).toBe('piece');
      }
      // Les extraits des sources se relisent dans les chunks (ancrage réel, pas déclaratif).
      const ancrage = await tx.sql<{ ok: boolean }>(
        `select bool_and(position(regexp_replace(s.extrait, '\\s+', ' ', 'g') in regexp_replace(c.texte, '\\s+', ' ', 'g')) > 0) as ok
           from public.entite_sources s join public.document_chunks c on c.id = s.chunk_id`,
      );
      expect(ancrage[0].ok).toBe(true);
      // Statuts : les pièces lisibles sont « analyse » ; les sorties VERITAS sont conformes et disent l'absence de modèle.
      const docs = await tx.sql<{ file_name: string; statut_ingestion: string }>(
        'select file_name, statut_ingestion from public.dossier_documents where dossier_id = $1 order by file_name', [f.dossierId],
      );
      for (const nom of verite.ingestion_attendue.extraction) expect(docs.find((d) => d.file_name === nom)?.statut_ingestion, nom).toBe('analyse');
      const runs = await tx.sql<{ sortie: { statut: string; incertitudes: { objet: string }[]; cout: { modele: string | null } }; statut: string; modele: string | null }>(
        "select sortie, statut, modele from public.agent_runs where agent = 'VERITAS'",
      );
      expect(runs.length).toBe(attendus);
      for (const r of runs) {
        expect(valider(r.sortie)).toMatchObject({ valide: true });
        expect(r.sortie.incertitudes.some((i) => /non configurée/.test(i.objet))).toBe(true);
        expect(r.modele).toBeNull();
      }
      // Cloisonnement : B ne voit aucune entité ; A voit les siennes.
      await tx.as(f.b.id);
      expect((await tx.sql('select 1 from public.entites')).length).toBe(0);
      await tx.as(f.a.id);
      expect((await tx.sql('select 1 from public.entites')).length).toBe(entites.length);
    });
  });

  it('réanalyser est idempotent : mêmes entités, mêmes sources, aucune duplication', async () => {
    await withTx(async (tx) => {
      const { f, store, ids } = await analyserEtalon(tx);
      const avant = await tx.sql<{ e: string; s: string }>(
        'select (select count(*) from public.entites where dossier_id = $1)::text as e, (select count(*) from public.entite_sources)::text as s', [f.dossierId],
      );
      for (const nom of verite.ingestion_attendue.extraction) {
        await tx.sql("select public.planifier_travail('veritas', $1::uuid, $2::uuid, $3::uuid)", [f.a.tenantId, f.dossierId, ids.get(nom)]);
      }
      const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-veritas-2', modele: null, types: ['veritas'] });
      expect(bilan.termines).toBe(verite.ingestion_attendue.extraction.length);
      const apres = await tx.sql<{ e: string; s: string }>(
        'select (select count(*) from public.entites where dossier_id = $1)::text as e, (select count(*) from public.entite_sources)::text as s', [f.dossierId],
      );
      expect(apres).toEqual(avant);
    });
  });

  it('avec un modèle : assertion ancrée persistée avec sa source, fabrication rejetée, correction humaine jamais écrasée (F11)', async () => {
    await withTx(async (tx) => {
      const { f, store, ids } = await analyserEtalon(tx);
      const docId = ids.get('05-mise-en-demeure-2026-02-20.pdf')!;
      const source = (extrait: string) => ({ document_id: docId, nom_fichier: '05-mise-en-demeure-2026-02-20.pdf', page: 1, extrait });
      // L'utilisateur corrige et verrouille la date d'échéance extraite.
      await tx.as(f.a.id);
      const [echeance] = await tx.sql<{ id: string }>(
        "select id from public.entites where dossier_id = $1 and type = 'date' and valeur_normalisee = '2026-02-11'", [f.dossierId],
      );
      await tx.sql("update public.entites set valeur_brute = 'onze février (corrigé)', verrouille_humain = true where id = $1", [echeance.id]);
      await tx.asService();
      await tx.sql("select set_config('clair.acteur', 'agent', true)");

      const modele = modeleSimule([{
        assertions: [
          { id: 'a1', enonce: "L'expéditeur de la mise en demeure est Atelier Fictif SAS.", nature: 'piece', confiance: 0.97, sources: [source('ATELIER FICTIF SAS')] },
          { id: 'a2', enonce: 'La mise en demeure est datée du 20 février 2026.', nature: 'piece', confiance: 0.98, critique: true, sources: [source('Paris-Test, le 20 février 2026')] },
          { id: 'a3', enonce: 'Le débiteur a promis de payer le 25 février 2026.', nature: 'piece', confiance: 0.95, sources: [source('nous paierons le 25 février 2026')] },
          { id: 'a4', enonce: "L'échéance était le 11 février 2026.", nature: 'piece', confiance: 0.99, critique: true, sources: [source('échue le 11 février 2026')] },
        ],
        resultat: {
          entites: [
            { assertion_id: 'a1', type: 'societe', valeur_normalisee: 'Atelier Fictif SAS', valeur_brute: 'ATELIER FICTIF SAS' },
            { assertion_id: 'a3', type: 'date', valeur_normalisee: '2026-02-25', valeur_brute: '25 février 2026' },
            { assertion_id: 'a4', type: 'date', valeur_normalisee: '2026-02-11', valeur_brute: '11 février 2026' },
          ],
          evenements: [
            { assertion_id: 'a2', date: '2026-02-20', date_precision: 'certaine', nature: 'mise_en_demeure', description: 'Mise en demeure de payer la facture F-2026-0042' },
            { assertion_id: 'a3', date: '2026-02-25', date_precision: 'certaine', nature: 'promesse_paiement', description: 'Promesse de paiement' },
          ],
        },
        incertitudes: [],
        donnees_sensibles_detectees: [],
      }]);
      await tx.sql("select public.planifier_travail('veritas', $1::uuid, $2::uuid, $3::uuid)", [f.a.tenantId, f.dossierId, docId]);
      const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-veritas-3', modele, types: ['veritas'] });
      expect(bilan).toMatchObject({ traites: 1, termines: 1 });

      expect((await tx.sql<{ n: string }>(SANS_SOURCE))[0].n).toBe('0');
      const societe = await tx.sql<{ nature: string; nb: string }>(
        `select e.nature, count(s.chunk_id)::text as nb from public.entites e join public.entite_sources s on s.entite_id = e.id
          where e.dossier_id = $1 and e.type = 'societe' and e.valeur_normalisee = 'Atelier Fictif SAS' group by e.id`, [f.dossierId],
      );
      expect(societe).toEqual([{ nature: 'piece', nb: '1' }]);
      // Fabrication (a3) : ni entité, ni événement.
      expect((await tx.sql("select 1 from public.entites where dossier_id = $1 and valeur_normalisee = '2026-02-25'", [f.dossierId])).length).toBe(0);
      expect((await tx.sql("select 1 from public.evenements where dossier_id = $1 and nature = 'promesse_paiement'", [f.dossierId])).length).toBe(0);
      const evenements = await tx.sql<{ nature: string; date: string; nb: string }>(
        `select e.nature, e.date::text as date, count(s.chunk_id)::text as nb from public.evenements e join public.evenement_sources s on s.evenement_id = e.id
          where e.dossier_id = $1 group by e.id`, [f.dossierId],
      );
      expect(evenements).toEqual([{ nature: 'mise_en_demeure', date: '2026-02-20', nb: '1' }]);
      // F11 : la correction humaine de l'échéance est intacte ; sa nouvelle source a été ajoutée.
      const [verrou] = await tx.sql<{ valeur_brute: string; verrouille_humain: boolean; nb: string }>(
        `select e.valeur_brute, e.verrouille_humain, count(s.chunk_id)::text as nb from public.entites e join public.entite_sources s on s.entite_id = e.id
          where e.id = $1 group by e.id`, [echeance.id],
      );
      expect(verrou.valeur_brute).toBe('onze février (corrigé)');
      expect(verrou.verrouille_humain).toBe(true);
      expect(Number(verrou.nb)).toBeGreaterThan(1);
      const run = await tx.sql<{ sortie: { statut: string; cout: { modele: string }; resultat: { nb_rejets_ancrage: number } }; tokens_entree: number }>(
        "select sortie, tokens_entree from public.agent_runs where agent = 'VERITAS' and modele is not null",
      );
      expect(run.length).toBe(1);
      expect(run[0].sortie.resultat.nb_rejets_ancrage).toBe(1);
      expect(run[0].tokens_entree).toBe(1000);
      expect(valider(run[0].sortie)).toMatchObject({ valide: true });
    });
  });

  it('les procédures d’écriture refusent toute entité sans source et tout appel client', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      await tx.expectError(
        () => tx.sql("select * from public.enregistrer_entites($1::uuid, '[{\"type\":\"personne\",\"valeur_normalisee\":\"X\",\"confiance\":0.9,\"sources\":[]}]'::jsonb)", [f.dossierId]),
        /permission denied|SERVEUR_UNIQUEMENT/,
      );
      await tx.asService();
      await tx.expectError(
        () => tx.sql("select * from public.enregistrer_entites($1::uuid, '[{\"type\":\"personne\",\"valeur_normalisee\":\"X\",\"confiance\":0.9,\"sources\":[]}]'::jsonb)", [f.dossierId]),
        /ANCRAGE_REQUIS/,
      );
      await tx.expectError(
        () => tx.sql("select * from public.enregistrer_evenements($1::uuid, '[{\"date\":\"2026-01-01\",\"nature\":\"x\",\"description\":\"y\",\"confiance\":0.9,\"sources\":[]}]'::jsonb)", [f.dossierId]),
        /ANCRAGE_REQUIS/,
      );
    });
  });
});
