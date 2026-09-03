/**
 * Étape 12 — ECHO sur le dossier étalon : chaque exécution contrôlée porte un
 * verdict ECHO tracé et une finalité ; la livraison est journalisée avec
 * identifiants et compteurs seulement ; un identifiant bancaire énoncé par un
 * modèle simulé n'est jamais persisté ; sans consentement quand la finalité
 * l'exige, rien n'est livré ; droits des personnes : export par le propriétaire,
 * purge serveur journalisée ; conservation : aucune purge sans durée fixée.
 */
import { describe, expect, it } from 'vitest';
import { type FournisseurModele, type RequeteModele } from '../../supabase/functions/_shared/agents/modele.ts';
import { PROMPTS_SYSTEME } from '../../supabase/functions/_shared/agents/prompts.generated.ts';
import { executerFile } from '../../supabase/functions/_shared/pipeline/ingestion.ts';
import { valider } from '../../supabase/functions/_shared/schema/validateur.ts';
import { deposer, dossierEtalon, manifest, verite } from './etalon';
import { type Tx, withTx } from './harness';
import { creerStockageEtalon, creerStorePg } from './pipeline-store';

// Valeur d'exemple au format IBAN (jeu d'essai, aucune donnée réelle).
const IBAN = 'FR76 3000 6000 0112 3456 7890 189';

/**
 * Modèle simulé qui répond selon la requête (l'ordre des travaux de la file n'est
 * pas garanti dans une même transaction) : la sortie préparée pour la pièce visée,
 * une sortie vide pour les autres pièces, un verdict d'acceptation pour SENTINEL et ECHO.
 */
function modeleCible(documentId: string, sortie: unknown): FournisseurModele & { requetes: RequeteModele[] } {
  const requetes: RequeteModele[] = [];
  const repondre = (req: RequeteModele, s: unknown) => ({ modele: req.modele, sortie: s, tokens_entree: 100, tokens_sortie: 50, arret: 'tool_use' });
  return {
    nom: 'simule-cible',
    requetes,
    async completer(req) {
      requetes.push(req);
      if (req.systeme === PROMPTS_SYSTEME.SENTINEL) return repondre(req, { verdict: 'accepte', anomalies: [], incertitudes: [] });
      if (req.systeme === PROMPTS_SYSTEME.ECHO) return repondre(req, { verdict: 'accepte', blocages: [], minimisations: [], categories_sensibles: [], incertitudes: [] });
      if (req.utilisateur.includes(`document_id : ${documentId}`)) return repondre(req, sortie);
      return repondre(req, { assertions: [], resultat: { entites: [], evenements: [] }, incertitudes: [], donnees_sensibles_detectees: [] });
    },
  };
}

async function preparer(tx: Tx) {
  const f = await dossierEtalon(tx);
  const ids = new Map<string, string>();
  for (const p of manifest.pieces) ids.set(p.fichier, (await deposer(tx, f.a.id, f.dossierId, p.fichier)).id);
  await tx.asService();
  await tx.sql("select set_config('clair.acteur', 'agent', true)");
  return { f, ids, store: creerStorePg(tx.sql) };
}

async function analyserEtalon(tx: Tx, options: Partial<Parameters<typeof executerFile>[2]> = {}) {
  const p = await preparer(tx);
  const bilan = await executerFile(p.store, creerStockageEtalon(), { executant: 'test-echo', maxTravaux: 300, modele: null, ...options });
  return { ...p, bilan };
}

describe('ECHO sur le dossier étalon (RGPD, données sensibles, traçabilité)', () => {
  it('chaque exécution VERITAS / ATLAS porte un verdict ECHO et une finalité ; la livraison est journalisée sans aucun contenu de pièce', async () => {
    await withTx(async (tx) => {
      const { f, bilan, ids } = await analyserEtalon(tx);
      expect(bilan.echecs).toBe(0);
      const controles = await tx.sql<{ agent: string; n: string; sans_verdict: string; sans_finalite: string }>(
        `select agent, count(*)::text as n, count(*) filter (where echo_verdict is null or echo_run_id is null)::text as sans_verdict,
                count(*) filter (where finalite is distinct from 'analyse_ia')::text as sans_finalite
           from public.agent_runs where dossier_id = $1 and agent in ('VERITAS', 'ATLAS') group by agent order by agent`, [f.dossierId],
      );
      expect(controles.map((c) => [c.agent, c.sans_verdict, c.sans_finalite])).toEqual([['ATLAS', '0', '0'], ['VERITAS', '0', '0']]);
      const nbControles = Number(controles[0].n) + Number(controles[1].n);
      // (La consolidation CLAIR-OS, étape 13, passe aussi par ECHO : on ne compte ici que les contrôles de VERITAS et ATLAS.)
      const echos = await tx.sql<{ n: string; verdicts: string[]; agents: string[] }>(
        `select count(*)::text as n, array_agg(distinct statut) as verdicts, array_agg(distinct sortie->>'agent_controle') as agents
           from public.agent_runs where dossier_id = $1 and agent = 'ECHO' and sortie->>'agent_controle' in ('VERITAS', 'ATLAS')`, [f.dossierId],
      );
      expect(Number(echos[0].n)).toBe(nbControles);
      expect(echos[0].verdicts).toEqual(['ok']);
      expect(echos[0].agents.sort()).toEqual(['ATLAS', 'VERITAS']);
      // Chaque verdict renvoie à une exécution ECHO réelle.
      const liens = await tx.sql<{ n: string }>(
        `select count(*)::text as n from public.agent_runs r join public.agent_runs e on e.id = r.echo_run_id
          where r.dossier_id = $1 and r.agent in ('VERITAS', 'ATLAS') and e.agent = 'ECHO' and r.echo_verdict in ('accepte', 'minimise')`, [f.dossierId],
      );
      expect(Number(liens[0].n)).toBe(nbControles);
      // Verdicts attendus par pièce (vérité terrain) : l'IBAN fictif de la facture est masqué, jamais livré.
      const veritas = await tx.sql<{ doc: string; echo_verdict: string; texte: string; sensibles: string[] }>(
        `select sortie->'resultat'->>'document_id' as doc, echo_verdict, sortie::text as texte,
                array(select jsonb_array_elements_text(sortie->'donnees_sensibles_detectees')) as sensibles
           from public.agent_runs where dossier_id = $1 and agent = 'VERITAS'`, [f.dossierId],
      );
      const nomDe = new Map(Array.from(ids.entries()).map(([nom, id]) => [id, nom]));
      const verdicts = Object.fromEntries(veritas.map((r) => [nomDe.get(r.doc), r.echo_verdict]));
      expect(verdicts).toEqual(verite.echo_attendu.verdict_par_piece);
      for (const r of veritas) {
        const nom = nomDe.get(r.doc)!;
        expect(r.sensibles, nom).toEqual(verite.echo_attendu.donnees_sensibles_par_piece[nom] ?? []);
        expect(r.texte, nom).not.toContain(verite.echo_attendu.valeur_jamais_livree);
        if (r.echo_verdict === 'minimise') expect(r.texte, nom).toContain('•');
      }
      const atlas = await tx.sql<{ echo_verdict: string }>("select distinct echo_verdict from public.agent_runs where dossier_id = $1 and agent = 'ATLAS'", [f.dossierId]);
      expect(atlas).toEqual([{ echo_verdict: 'accepte' }]);
      // Journal : une ligne par livraison, trace, acteur agent, compteurs seulement.
      const journal = await tx.sql<{ n: string; sans_trace: string; acteurs: string[]; cles: string[]; fuite: string }>(
        `select count(*)::text as n, count(*) filter (where trace_id is null)::text as sans_trace,
                array_agg(distinct acteur_type) as acteurs,
                (select array_agg(distinct k order by k) from public.audit_log a2, jsonb_object_keys(a2.apres) k where a2.dossier_id = $1 and a2.action = 'sortie.livree') as cles,
                count(*) filter (where apres::text ~ 'F-2026-0042|1 200,00|Exemple SARL|Atelier')::text as fuite
           from public.audit_log where dossier_id = $1 and action = 'sortie.livree' and objet_type = 'agent_run' and apres->>'agent' in ('VERITAS', 'ATLAS')`, [f.dossierId],
      );
      expect(Number(journal[0].n)).toBe(nbControles);
      expect(journal[0].sans_trace).toBe('0');
      expect(journal[0].acteurs).toEqual(['agent']);
      expect(journal[0].cles).toEqual(['agent', 'echo', 'escalades', 'finalite', 'nb_assertions', 'nb_masques', 'nb_retirees_echo', 'statut']);
      expect(journal[0].fuite).toBe('0');
      // Les sorties tracées restent conformes au schéma après ECHO.
      const sorties = await tx.sql<{ sortie: unknown }>("select sortie from public.agent_runs where dossier_id = $1 and agent in ('VERITAS', 'ATLAS')", [f.dossierId]);
      for (const s of sorties) expect(valider(s.sortie)).toMatchObject({ valide: true });
    });
  });

  it('un identifiant bancaire énoncé par le modèle est bloqué : ni entité, ni valeur dans la sortie tracée ; le reste est livré', async () => {
    await withTx(async (tx) => {
      const { f, store, ids } = await analyserEtalon(tx, { types: ['ingestion', 'indexation'] });
      const piece = '05-mise-en-demeure-2026-02-20.pdf';
      const docId = ids.get(piece)!;
      const src = (extrait: string) => ({ document_id: docId, nom_fichier: piece, page: 1, extrait });
      const modele = modeleCible(docId, {
        assertions: [
          { id: 'a1', enonce: "L'expéditeur de la mise en demeure est Atelier Fictif SAS.", nature: 'piece', confiance: 0.97, sources: [src('ATELIER FICTIF SAS')] },
          { id: 'a2', enonce: `Le règlement à Atelier Fictif SAS est attendu sur le compte ${IBAN}.`, nature: 'piece', confiance: 0.95, sources: [src('ATELIER FICTIF SAS')] },
        ],
        resultat: {
          entites: [
            { assertion_id: 'a1', type: 'societe', valeur_normalisee: 'Atelier Fictif SAS', valeur_brute: 'ATELIER FICTIF SAS' },
            { assertion_id: 'a2', type: 'reference', valeur_normalisee: IBAN.replace(/ /g, ''), valeur_brute: IBAN },
          ],
          evenements: [],
        },
        incertitudes: [],
        donnees_sensibles_detectees: [],
      });
      const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-echo-iban', modele, types: ['veritas'] });
      expect(bilan.echecs).toBe(0);
      expect(bilan.termines).toBe(verite.ingestion_attendue.extraction.length);
      expect(modele.requetes.some((r) => r.utilisateur.includes(`document_id : ${docId}`))).toBe(true);
      expect((await tx.sql("select 1 from public.entites where dossier_id = $1 and valeur_normalisee like 'FR76%'", [f.dossierId])).length).toBe(0);
      expect((await tx.sql("select 1 from public.entites where dossier_id = $1 and type = 'societe' and valeur_normalisee = 'Atelier Fictif SAS'", [f.dossierId])).length).toBe(1);
      const [run] = await tx.sql<{ echo_verdict: string; statut: string; sortie: { assertions: { id: string }[]; escalades: { code: string }[]; donnees_sensibles_detectees: string[] }; texte: string }>(
        "select echo_verdict, statut, sortie, sortie::text as texte from public.agent_runs where dossier_id = $1 and agent = 'VERITAS' and sortie->'resultat'->>'document_id' = $2", [f.dossierId, docId],
      );
      expect(run.echo_verdict).toBe('bloque');
      expect(run.statut).toBe('escalade');
      expect(run.sortie.assertions.map((a) => a.id)).toContain('ma1');
      expect(run.sortie.assertions.map((a) => a.id)).not.toContain('ma2');
      expect(run.sortie.escalades.map((e) => e.code)).toContain('E7');
      expect(run.sortie.donnees_sensibles_detectees).toContain('iban');
      expect(run.texte).not.toContain('3000 6000');
      expect(run.texte).not.toContain('FR7630006000');
      // Ni l'exécution ECHO, ni le journal ne portent la valeur (F10).
      const fuites = await tx.sql<{ n: string }>(
        `select (select count(*) from public.agent_runs where dossier_id = $1 and sortie::text ~ '3000 6000|FR7630006000')
              + (select count(*) from public.audit_log where dossier_id = $1 and coalesce(apres::text, '') ~ '3000 6000|FR7630006000') as n`, [f.dossierId],
      );
      expect(String(fuites[0].n)).toBe('0');
      const [doc] = await tx.sql<{ statut_ingestion: string }>('select statut_ingestion from public.dossier_documents where id = $1', [docId]);
      expect(doc.statut_ingestion).toBe('analyse');
    });
  });

  it('quand la finalité exige un consentement absent, rien n’est livré ni persisté (E7) ; la livraison reprend une fois le consentement recueilli', async () => {
    await withTx(async (tx) => {
      const { f, store, ids } = await preparer(tx);
      await tx.sql("update public.finalites set consentement_requis = true where code = 'analyse_ia'");
      const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-echo-consent', maxTravaux: 300, modele: null, types: ['ingestion', 'indexation', 'veritas'] });
      expect(bilan.echecs).toBe(0);
      expect((await tx.sql('select 1 from public.entites where dossier_id = $1', [f.dossierId])).length).toBe(0);
      const runs = await tx.sql<{ echo_verdict: string; statut: string; sortie: { assertions: unknown[]; escalades: { code: string }[] } }>(
        "select echo_verdict, statut, sortie from public.agent_runs where dossier_id = $1 and agent = 'VERITAS'", [f.dossierId],
      );
      expect(runs.length).toBe(verite.ingestion_attendue.extraction.length);
      for (const r of runs) {
        expect(r.echo_verdict).toBe('bloque');
        expect(r.statut).toBe('escalade');
        expect(r.sortie.assertions).toEqual([]);
        expect(r.sortie.escalades.map((e) => e.code)).toContain('E7');
        expect(valider(r.sortie)).toMatchObject({ valide: true });
      }
      // Les pièces ne sont pas passées à « analyse » : aucun inventaire n'a été mis en file.
      const statuts = await tx.sql<{ statut_ingestion: string; n: string }>(
        'select statut_ingestion, count(*)::text as n from public.dossier_documents where dossier_id = $1 group by 1 order by 1', [f.dossierId],
      );
      expect(statuts.find((s) => s.statut_ingestion === 'analyse')).toBeUndefined();
      expect(statuts.find((s) => s.statut_ingestion === 'vectorise')?.n).toBe(String(verite.ingestion_attendue.extraction.length));
      expect((await tx.sql("select 1 from public.travaux where dossier_id = $1 and type = 'atlas'", [f.dossierId])).length).toBe(0);
      expect(Number((await tx.sql<{ n: string }>("select count(*)::text as n from public.audit_log where dossier_id = $1 and action = 'sortie.bloquee'", [f.dossierId]))[0].n)).toBe(runs.length);

      // Consentement recueilli pour le tenant : la réanalyse livre.
      expect((await tx.sql<{ ok: boolean }>("select public.consentement_effectif($1, 'analyse_ia') as ok", [f.a.tenantId]))[0].ok).toBe(false);
      await tx.sql("insert into public.consentements (tenant_id, user_id, finalite, base_legale, accorde) values ($1, $2, 'analyse_ia', 'consentement', true)", [f.a.tenantId, f.a.id]);
      expect((await tx.sql<{ ok: boolean }>("select public.consentement_effectif($1, 'analyse_ia') as ok", [f.a.tenantId]))[0].ok).toBe(true);
      for (const nom of verite.ingestion_attendue.extraction) {
        await tx.sql("select public.planifier_travail('veritas', $1::uuid, $2::uuid, $3::uuid)", [f.a.tenantId, f.dossierId, ids.get(nom)]);
      }
      const reprise = await executerFile(store, creerStockageEtalon(), { executant: 'test-echo-consent-2', modele: null, types: ['veritas'] });
      expect(reprise.echecs).toBe(0);
      expect((await tx.sql('select 1 from public.entites where dossier_id = $1', [f.dossierId])).length).toBeGreaterThan(0);
      expect((await tx.sql("select 1 from public.agent_runs where dossier_id = $1 and agent = 'VERITAS' and echo_verdict in ('accepte', 'minimise')", [f.dossierId])).length).toBe(runs.length);
      expect((await tx.sql("select 1 from public.dossier_documents where dossier_id = $1 and statut_ingestion = 'analyse'", [f.dossierId])).length).toBe(runs.length);
      // Retrait du consentement : plus effectif.
      await tx.sql("update public.consentements set retire_le = now() where tenant_id = $1 and finalite = 'analyse_ia'", [f.a.tenantId]);
      expect((await tx.sql<{ ok: boolean }>("select public.consentement_effectif($1, 'analyse_ia') as ok", [f.a.tenantId]))[0].ok).toBe(false);
    });
  });

  it('droits des personnes : export complet par le propriétaire, rien pour un autre utilisateur ; purge serveur journalisée puis cascade', async () => {
    await withTx(async (tx) => {
      const { f } = await analyserEtalon(tx);
      await tx.as(f.a.id);
      const [{ e }] = await tx.sql<{ e: { dossier: { id: string; typology: string }; pieces: { hash_sha256: string | null }[]; entites: unknown[]; evenements: unknown[]; journal: { action: string }[]; exporte_le: string } }>(
        'select public.exporter_dossier($1) as e', [f.dossierId],
      );
      expect(e.dossier).toMatchObject({ id: f.dossierId, typology: 'impaye-precontentieux' });
      expect(e.pieces.length).toBe(manifest.pieces.length);
      expect(e.pieces.every((p) => typeof p.hash_sha256 === 'string')).toBe(true);
      expect(e.entites.length).toBeGreaterThan(0);
      expect(e.journal.some((j) => j.action === 'sortie.livree')).toBe(true);
      expect(e.exporte_le).toBeTruthy();
      // Un autre utilisateur n'obtient rien (RLS du lecteur, SECURITY INVOKER).
      await tx.as(f.b.id);
      expect((await tx.sql<{ e: unknown }>('select public.exporter_dossier($1) as e', [f.dossierId]))[0].e).toBeNull();
      // Un client ne purge pas.
      await tx.as(f.a.id);
      await tx.expectError(() => tx.sql('select public.purger_dossier($1)', [f.dossierId]), /SERVEUR_UNIQUEMENT|permission denied/);

      await tx.asService();
      const [avant] = await tx.sql<{ docs: string; entites: string; chunks: string; audit: string }>(
        `select (select count(*) from public.dossier_documents where dossier_id = $1)::text as docs,
                (select count(*) from public.entites where dossier_id = $1)::text as entites,
                (select count(*) from public.document_chunks c join public.dossier_documents d on d.id = c.document_id where d.dossier_id = $1)::text as chunks,
                (select count(*) from public.audit_log where dossier_id = $1)::text as audit`, [f.dossierId],
      );
      expect(Number(avant.entites)).toBeGreaterThan(0);
      expect(Number(avant.chunks)).toBeGreaterThan(0);
      const [{ r }] = await tx.sql<{ r: { dossier_id: string; nb_documents: number; nb_entites: number; motif: string } }>("select public.purger_dossier($1, 'test_conservation') as r", [f.dossierId]);
      expect(r).toEqual({ dossier_id: f.dossierId, nb_documents: Number(avant.docs), nb_entites: Number(avant.entites), motif: 'test_conservation' });
      await tx.checkDeferred();
      const [apres] = await tx.sql<{ dossiers: string; docs: string; entites: string; chunks: string; audit: string }>(
        `select (select count(*) from public.dossiers where id = $1)::text as dossiers,
                (select count(*) from public.dossier_documents where dossier_id = $1)::text as docs,
                (select count(*) from public.entites where dossier_id = $1)::text as entites,
                (select count(*) from public.document_chunks c join public.dossier_documents d on d.id = c.document_id where d.dossier_id = $1)::text as chunks,
                (select count(*) from public.audit_log where dossier_id = $1)::text as audit`, [f.dossierId],
      );
      expect(apres).toMatchObject({ dossiers: '0', docs: '0', entites: '0', chunks: '0' });
      // Le journal, immuable, garde l'historique, la purge elle-même (identifiants et compteurs)
      // et les suppressions qu'elle entraîne : il ne perd jamais une ligne.
      expect(Number(apres.audit)).toBeGreaterThan(Number(avant.audit));
      const [purge] = await tx.sql<{ n: string; acteur_type: string; avant: { nb_documents: number }; apres: { motif: string } }>(
        "select count(*) over ()::text as n, acteur_type, avant, apres from public.audit_log where dossier_id = $1 and action = 'dossier.purge'", [f.dossierId],
      );
      expect(purge).toMatchObject({ n: '1', acteur_type: 'systeme', avant: { nb_documents: Number(avant.docs) }, apres: { motif: 'test_conservation' } });
      expect((await tx.sql("select 1 from public.audit_log where dossier_id = $1 and acteur_type not in ('agent', 'systeme', 'utilisateur', 'admin')", [f.dossierId])).length).toBe(0);
    });
  });

  it('conservation : aucune purge sans durée fixée ; date d’archivage posée par le statut ; fonctions serveur refusées aux clients', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      await tx.asService();
      expect(await tx.sql('select * from public.dossiers_a_purger()')).toEqual([]);
      // Les politiques existent (valeur par défaut « * ») mais sans durée : rien n'est jamais purgé automatiquement.
      const politiques = await tx.sql<{ typology: string; duree_jours_apres_archive: number | null }>('select typology, duree_jours_apres_archive from public.politiques_conservation order by typology');
      expect(politiques.some((p) => p.typology === '*')).toBe(true);
      expect(politiques.every((p) => p.duree_jours_apres_archive === null)).toBe(true);
      // L'utilisateur archive son dossier : archive_le est posé par le serveur, pas par lui.
      await tx.as(f.a.id);
      await tx.sql("update public.dossiers set status = 'archive', archive_le = '2000-01-01' where id = $1", [f.dossierId]);
      const [d] = await tx.sql<{ archive_le: Date | null }>('select archive_le from public.dossiers where id = $1', [f.dossierId]);
      expect(d.archive_le).not.toBeNull();
      expect(new Date(d.archive_le!).getFullYear()).toBeGreaterThan(2000);
      await tx.sql("update public.dossiers set archive_le = '2000-01-01' where id = $1", [f.dossierId]);
      expect(new Date((await tx.sql<{ archive_le: Date }>('select archive_le from public.dossiers where id = $1', [f.dossierId]))[0].archive_le).getFullYear()).toBeGreaterThan(2000);
      // Un client ne lit pas la liste de purge, n'enregistre pas de verdict ; il lit les finalités et son consentement.
      await tx.expectError(() => tx.sql('select * from public.dossiers_a_purger()'), /permission denied/);
      await tx.expectError(() => tx.sql("select public.enregistrer_controle_echo($1, null, 'accepte')", [f.dossierId]), /SERVEUR_UNIQUEMENT|permission denied/);
      await tx.expectError(() => tx.sql("select public.purger_dossier($1)", [f.dossierId]), /SERVEUR_UNIQUEMENT|permission denied/);
      expect((await tx.sql<{ code: string }>('select code from public.finalites order by code')).map((r) => r.code)).toEqual(['analyse_ia', 'notification_equipe', 'transmission_professionnel']);
      expect((await tx.sql<{ ok: boolean }>("select public.consentement_effectif($1, 'analyse_ia') as ok", [f.a.tenantId]))[0].ok).toBe(false);
      // Statut sorti d'archive : la date disparaît.
      await tx.sql("update public.dossiers set status = 'en-cours' where id = $1", [f.dossierId]);
      expect((await tx.sql<{ archive_le: Date | null }>('select archive_le from public.dossiers where id = $1', [f.dossierId]))[0].archive_le).toBeNull();
      // Une durée fixée par un humain et écoulée : le dossier est listé, avec sa date de purge prévue.
      await tx.asService();
      await tx.sql("update public.dossiers set status = 'archive' where id = $1", [f.dossierId]);
      await tx.sql("update public.dossiers set archive_le = now() - interval '10 days' where id = $1", [f.dossierId]);
      expect(await tx.sql('select * from public.dossiers_a_purger()')).toEqual([]);
      await tx.sql("insert into public.politiques_conservation (typology, duree_jours_apres_archive, motif) values ('impaye-precontentieux', 5, 'test') on conflict (typology) do update set duree_jours_apres_archive = excluded.duree_jours_apres_archive");
      const a = await tx.sql<{ dossier_id: string; typology: string; purge_prevue_le: Date }>('select * from public.dossiers_a_purger()');
      expect(a).toEqual([expect.objectContaining({ dossier_id: f.dossierId, typology: 'impaye-precontentieux' })]);
      expect(new Date(a[0].purge_prevue_le).getTime()).toBeLessThan(Date.now());
    });
  });
});
