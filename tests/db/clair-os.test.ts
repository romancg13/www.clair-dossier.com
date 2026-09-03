/**
 * Étape 13 — CLAIR-OS sur le dossier étalon : orchestration d'un dossier complet
 * (consolidation automatique dès la dernière pièce terminée, sous SENTINEL puis
 * ECHO), demande de l'utilisateur (il formule, CLAIR-OS route ; membre du tenant
 * seulement ; journal sans contenu), question juridique bloquée (E5), incohérence
 * inter-agents forcée puis arbitrée (E9), budget de tokens et coupe-circuit.
 */
import { describe, expect, it } from 'vitest';
import { executerFile } from '../../supabase/functions/_shared/pipeline/ingestion.ts';
import { valider } from '../../supabase/functions/_shared/schema/validateur.ts';
import { deposer, dossierEtalon, manifest, verite } from './etalon';
import { type Tx, withTx } from './harness';
import { creerStockageEtalon, creerStorePg } from './pipeline-store';

async function analyserEtalon(tx: Tx) {
  const f = await dossierEtalon(tx);
  const ids = new Map<string, string>();
  for (const p of manifest.pieces) ids.set(p.fichier, (await deposer(tx, f.a.id, f.dossierId, p.fichier)).id);
  await tx.asService();
  await tx.sql("select set_config('clair.acteur', 'agent', true)");
  const store = creerStorePg(tx.sql);
  const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-clair-os', maxTravaux: 300, modele: null });
  return { f, ids, store, bilan };
}

type RunClairOs = {
  id: string; statut: string; sentinel_verdict: string | null; echo_verdict: string | null;
  sortie: {
    escalades: { code: string }[];
    resultat: {
      avancement: { total: number; terminees: number; libelle: string };
      incoherences: { type: string; arbitrage: string; document_id: string }[];
      actions_attendues: { code: string; document_id: string | null }[];
      orchestrations: { id: string | null; intention: string; statut: string; escalade: string | null; plan: { agent: string; statut: string }[] }[];
      budget: { depasse: boolean };
    };
  };
};

describe('CLAIR-OS sur le dossier étalon (orchestration d’un dossier complet)', () => {
  it('dès que la dernière pièce est terminée, le dossier est consolidé automatiquement : orchestration, verdicts SENTINEL et ECHO, état lisible, journal', async () => {
    await withTx(async (tx) => {
      const { f, ids, bilan } = await analyserEtalon(tx);
      expect(bilan.echecs).toBe(0);
      expect(bilan.bloques).toBe(0);
      const orchestrations = await tx.sql<{ source: string; statut: string; intention: string; escalade: string | null; agent_run_id: string | null; resume: { avancement: string; nb_incoherences: number } }>(
        'select source, statut, intention, escalade, agent_run_id, resume from public.orchestrations where dossier_id = $1 order by created_at', [f.dossierId],
      );
      expect(orchestrations).toEqual([expect.objectContaining({ source: 'autopilot', statut: 'terminee', intention: 'organiser', escalade: null })]);
      expect(orchestrations[0].agent_run_id).not.toBeNull();
      expect(orchestrations[0].resume).toMatchObject({ avancement: verite.orchestration_attendue.libelle, nb_incoherences: verite.orchestration_attendue.incoherences_e9 });
      const runs = await tx.sql<RunClairOs>("select id, statut, sentinel_verdict, echo_verdict, sortie from public.agent_runs where dossier_id = $1 and agent = 'CLAIR-OS'", [f.dossierId]);
      expect(runs.length).toBe(1);
      const [run] = runs;
      expect(run.id).toBe(orchestrations[0].agent_run_id);
      expect(['ok', 'partiel']).toContain(run.statut);
      expect(run.sentinel_verdict).toBe('accepte');
      expect(run.echo_verdict).toBe('accepte');
      expect(valider(run.sortie)).toMatchObject({ valide: true });
      expect(run.sortie.escalades).toEqual([]);
      const r = run.sortie.resultat;
      expect(r.avancement).toEqual({ total: verite.orchestration_attendue.pieces_total, terminees: verite.orchestration_attendue.pieces_terminees, en_cours: 0, libelle: verite.orchestration_attendue.libelle });
      expect(r.incoherences.filter((i) => i.arbitrage === 'utilisateur').length).toBe(verite.orchestration_attendue.incoherences_e9);
      expect(r.incoherences).toEqual([]);
      const nomDe = new Map(Array.from(ids.entries()).map(([nom, id]) => [id, nom]));
      expect(r.actions_attendues.map((a) => `${a.code}:${nomDe.get(a.document_id ?? '')}`)).toEqual(verite.orchestration_attendue.actions_attendues.map((a) => `${a.code}:${a.piece}`));
      expect(r.orchestrations[0].plan.every((e) => e.statut === 'fait')).toBe(true);
      expect(r.budget.depasse).toBe(false);
      // Journal : demande automatique puis terminaison, identifiants et compteurs seulement.
      const journal = await tx.sql<{ action: string; apres: Record<string, unknown> }>(
        "select action, apres from public.audit_log where dossier_id = $1 and action like 'orchestration.%' order by id", [f.dossierId],
      );
      expect(journal.map((j) => j.action)).toEqual(['orchestration.terminee']);
      expect(Object.keys(journal[0].apres).sort()).toEqual(['agent_run_id', 'escalade', 'intention', 'nb_etapes', 'source']);
      // L'état d'avancement est lisible par le propriétaire (12.3), pas par un autre utilisateur.
      await tx.as(f.a.id);
      const [{ e }] = await tx.sql<{ e: { pieces: { total: number; terminees: number }; entites: number; derniere_orchestration: { statut: string; source: string } } }>('select public.etat_dossier($1) as e', [f.dossierId]);
      expect(e.pieces).toMatchObject({ total: 9, terminees: 9 });
      expect(e.entites).toBeGreaterThan(0);
      expect(e.derniere_orchestration).toMatchObject({ statut: 'terminee', source: 'autopilot' });
      expect((await tx.sql<{ n: string }>('select count(*)::text as n from public.orchestrations where dossier_id = $1', [f.dossierId]))[0].n).toBe('1');
      await tx.as(f.b.id);
      expect((await tx.sql<{ e: unknown }>('select public.etat_dossier($1) as e', [f.dossierId]))[0].e).toBeNull();
      expect((await tx.sql('select 1 from public.orchestrations where dossier_id = $1', [f.dossierId])).length).toBe(0);
    });
  });

  it('l’utilisateur formule une demande, jamais un agent : membre du tenant seulement, journal sans contenu, un seul travail actif par dossier, réponse honnête sur ce qui n’existe pas encore', async () => {
    await withTx(async (tx) => {
      const { f, store } = await analyserEtalon(tx);
      await tx.as(f.b.id);
      await tx.expectError(() => tx.sql("select public.demander_orchestration($1, 'Où en est mon dossier ?')", [f.dossierId]), /DOSSIER_INTERDIT/);
      await tx.as(null);
      await tx.expectError(() => tx.sql("select public.demander_orchestration($1, 'Où en est mon dossier ?')", [f.dossierId]), /AUTHENTIFICATION_REQUISE|permission denied/);
      await tx.as(f.a.id);
      await tx.expectError(() => tx.sql("select public.demander_orchestration($1, '   ')", [f.dossierId]), /DEMANDE_VIDE/);
      const [{ o1 }] = await tx.sql<{ o1: string }>("select public.demander_orchestration($1, 'Où en est mon dossier ?') as o1", [f.dossierId]);
      const [{ o2 }] = await tx.sql<{ o2: string }>("select public.demander_orchestration($1, 'Fais-moi la chronologie du dossier') as o2", [f.dossierId]);
      expect(o1).not.toBe(o2);
      // Le client ne planifie pas lui-même de travail et ne modifie pas une orchestration.
      await tx.expectError(() => tx.sql("select public.planifier_travail('clair_os', $1, $2)", [f.a.tenantId, f.dossierId]), /SERVEUR_UNIQUEMENT|permission denied/);
      await tx.expectError(() => tx.sql("update public.orchestrations set statut = 'terminee' where id = $1", [o1]), /permission denied/);
      await tx.asService();
      const actifs = await tx.sql<{ n: string }>("select count(*)::text as n from public.travaux where dossier_id = $1 and type = 'clair_os' and statut in ('en_attente', 'en_cours')", [f.dossierId]);
      expect(actifs[0].n).toBe('1');
      const demandes = await tx.sql<{ apres: Record<string, unknown> }>("select apres from public.audit_log where dossier_id = $1 and action = 'orchestration.demandee' order by id", [f.dossierId]);
      expect(demandes.length).toBe(2);
      for (const d of demandes) expect(Object.keys(d.apres)).toEqual(['longueur_demande']);
      expect(JSON.stringify(demandes)).not.toMatch(/chronologie|dossier \?/);

      await tx.sql("select set_config('clair.acteur', 'agent', true)");
      const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-clair-os-demande', modele: null, types: ['clair_os'] });
      expect(bilan).toMatchObject({ traites: 1, termines: 1, echecs: 0 });
      // (Dans une même transaction, created_at est identique : on trie par intention.)
      const rows = await tx.sql<{ id: string; statut: string; intention: string; escalade: string | null; agent_run_id: string; plan: { agent: string; statut: string; detail?: string }[] }>(
        'select id, statut, intention, escalade, agent_run_id, plan from public.orchestrations where dossier_id = $1 and source = $2 order by intention', [f.dossierId, 'utilisateur'],
      );
      expect(rows.map((r) => [r.id, r.intention, r.statut, r.escalade])).toEqual([[o2, 'chronologie', 'terminee', null], [o1, 'statut', 'terminee', null]]);
      expect(rows[0].agent_run_id).toBe(rows[1].agent_run_id);
      const chronos = rows[0].plan.find((e) => e.agent === 'CHRONOS')!;
      expect(chronos.statut).toBe('non_disponible');
      expect(chronos.detail).toMatch(/pas encore disponible/);
      expect((await tx.sql("select 1 from public.agent_runs where dossier_id = $1 and agent in ('CHRONOS', 'SYNTHIA', 'HERMES', 'LEXIA')", [f.dossierId])).length).toBe(0);
      const [run] = await tx.sql<RunClairOs>('select id, statut, sentinel_verdict, echo_verdict, sortie from public.agent_runs where id = $1', [rows[0].agent_run_id]);
      expect(run.sortie.resultat.orchestrations.map((o) => [o.id, o.intention, o.statut]).sort()).toEqual([[o1, 'statut', 'terminee'], [o2, 'chronologie', 'terminee']].sort());
      expect(run.sentinel_verdict).toBe('accepte');
      expect(run.echo_verdict).toBe('accepte');
      expect(valider(run.sortie)).toMatchObject({ valide: true });
    });
  });

  it('une question de conseil juridique est bloquée (E5) avec le message de frontière de service ; aucun agent n’est déclenché', async () => {
    await withTx(async (tx) => {
      const { f, store } = await analyserEtalon(tx);
      await tx.as(f.a.id);
      const [{ o }] = await tx.sql<{ o: string }>("select public.demander_orchestration($1, 'Ai-je le droit de refuser de payer les pénalités de retard ?') as o", [f.dossierId]);
      await tx.asService();
      await tx.sql("select set_config('clair.acteur', 'agent', true)");
      const avant = (await tx.sql<{ n: string }>('select count(*)::text as n from public.travaux where dossier_id = $1', [f.dossierId]))[0].n;
      const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-clair-os-e5', modele: null, types: ['clair_os'] });
      expect(bilan).toMatchObject({ traites: 1, termines: 1, echecs: 0 });
      const [row] = await tx.sql<{ statut: string; intention: string; escalade: string; plan: unknown[]; agent_run_id: string }>('select statut, intention, escalade, plan, agent_run_id from public.orchestrations where id = $1', [o]);
      expect(row).toMatchObject({ statut: 'bloquee', intention: 'question_juridique', escalade: 'E5', plan: [] });
      const [run] = await tx.sql<RunClairOs>('select id, statut, sentinel_verdict, echo_verdict, sortie from public.agent_runs where id = $1', [row.agent_run_id]);
      expect(run.statut).toBe('escalade');
      expect(run.sortie.escalades.map((e) => e.code)).toEqual(['E5']);
      expect(JSON.stringify(run.sortie.escalades)).toMatch(/professionnel du droit/);
      // Aucun travail supplémentaire n'a été mis en file par cette demande.
      expect((await tx.sql<{ n: string }>('select count(*)::text as n from public.travaux where dossier_id = $1', [f.dossierId]))[0].n).toBe(avant);
      expect((await tx.sql<{ n: string }>("select count(*)::text as n from public.audit_log where dossier_id = $1 and action = 'orchestration.bloquee'", [f.dossierId]))[0].n).toBe('1');
    });
  });

  it('incohérence inter-agents forcée (ATLAS × VERITAS) : E9 remontée avec les deux lectures ; la correction humaine la résout', async () => {
    await withTx(async (tx) => {
      const { f, ids, store } = await analyserEtalon(tx);
      const courrier = ids.get(verite.injection_attendue.piece)!;
      // ATLAS aurait classé « facture » (confiance haute) un courrier sans montant : lectures divergentes.
      await tx.sql("update public.dossier_documents set categorie = 'facture', confiance_classification = 0.95, categorie_humaine = false where id = $1", [courrier]);
      await tx.sql("select public.planifier_travail('clair_os', $1::uuid, $2::uuid)", [f.a.tenantId, f.dossierId]);
      await tx.sql("select set_config('clair.acteur', 'agent', true)");
      // (created_at est le même pour toute la transaction : l'exécution est retrouvée par le travail qui l'a produite.)
      const runDuTravail = async (travailId: number) =>
        (await tx.sql<RunClairOs>("select r.id, r.statut, r.sentinel_verdict, r.echo_verdict, r.sortie from public.travaux t join public.agent_runs r on r.id = (t.resultat->>'agent_run_id')::uuid where t.id = $1", [travailId]))[0];
      let bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-clair-os-e9', modele: null, types: ['clair_os'] });
      expect(bilan).toMatchObject({ traites: 1, termines: 1, echecs: 0 });
      let run = await runDuTravail(bilan.travaux[0].id);
      expect(run.statut).toBe('escalade');
      expect(run.sortie.escalades.map((e) => e.code)).toEqual(['E9']);
      expect(JSON.stringify(run.sortie.escalades[0])).toMatch(new RegExp(verite.injection_attendue.piece.replace('.', '\\.')));
      expect(run.sortie.resultat.incoherences).toEqual([expect.objectContaining({ type: 'categorie_sans_montant', arbitrage: 'utilisateur', document_id: courrier })]);
      expect(run.sortie.resultat.actions_attendues.some((a) => a.code === 'E9' && a.document_id === courrier)).toBe(true);
      expect(run.sentinel_verdict).toBe('accepte');
      expect(run.echo_verdict).toBe('accepte');
      expect(valider(run.sortie)).toMatchObject({ valide: true });
      // L'utilisateur reclasse lui-même la pièce (ici en « devis », toujours sans montant) : sa lecture prime (F11), l'incohérence est résolue sans E9.
      await tx.as(f.a.id);
      await tx.sql("update public.dossier_documents set categorie = 'devis' where id = $1", [courrier]);
      await tx.asService();
      expect((await tx.sql<{ categorie_humaine: boolean }>('select categorie_humaine from public.dossier_documents where id = $1', [courrier]))[0].categorie_humaine).toBe(true);
      await tx.sql("select public.planifier_travail('clair_os', $1::uuid, $2::uuid)", [f.a.tenantId, f.dossierId]);
      await tx.sql("select set_config('clair.acteur', 'agent', true)");
      bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-clair-os-e9-2', modele: null, types: ['clair_os'] });
      expect(bilan).toMatchObject({ traites: 1, termines: 1, echecs: 0 });
      run = await runDuTravail(bilan.travaux[0].id);
      expect(run.sortie.escalades).toEqual([]);
      expect(run.sortie.resultat.incoherences).toEqual([expect.objectContaining({ type: 'categorie_sans_montant', arbitrage: 'resolue_categorie_humaine' })]);
    });
  });

  it('budget de tokens : aucun plafond par défaut ; un plafond atteint coupe les analyses par modèle (journalisé) et CLAIR-OS le dit', async () => {
    await withTx(async (tx) => {
      const { f, ids, store } = await analyserEtalon(tx);
      const [{ b }] = await tx.sql<{ b: { plan: string; budget_tokens_par_dossier: number | null; consomme: number; depasse: boolean } }>('select public.budget_dossier($1) as b', [f.dossierId]);
      expect(b).toMatchObject({ budget_tokens_par_dossier: null, depasse: false });
      expect(b.plan).toBeTruthy();
      // Un humain fixe un plafond ; une exécution passée a consommé au-delà.
      await tx.sql("insert into public.budgets_tokens (plan, tokens_par_dossier, motif) values ($1, 1000, 'test') on conflict (plan) do update set tokens_par_dossier = excluded.tokens_par_dossier", [b.plan]);
      const [{ r }] = await tx.sql<{ r: string }>("select public.demarrer_run('VERITAS', $1::uuid, $2::uuid, gen_random_uuid(), 'budget-test', 'simule', '1.0') as r", [f.a.tenantId, f.dossierId]);
      await tx.sql("select public.terminer_run($1::uuid, 'ok', '{}'::jsonb, 1, 10, null, 900, 300)", [r]);
      expect((await tx.sql<{ b: { depasse: boolean; consomme: number } }>('select public.budget_dossier($1) as b', [f.dossierId]))[0].b).toMatchObject({ depasse: true, consomme: 1200 });
      // Une nouvelle extraction est coupée avant d'appeler quoi que ce soit ; la consolidation, elle, s'exécute et rapporte le blocage.
      const docId = ids.get('05-mise-en-demeure-2026-02-20.pdf')!;
      const runsAvant = (await tx.sql<{ n: string }>("select count(*)::text as n from public.agent_runs where dossier_id = $1 and agent = 'VERITAS'", [f.dossierId]))[0].n;
      await tx.sql("select public.planifier_travail('veritas', $1::uuid, $2::uuid, $3::uuid)", [f.a.tenantId, f.dossierId, docId]);
      await tx.sql("select public.planifier_travail('clair_os', $1::uuid, $2::uuid)", [f.a.tenantId, f.dossierId]);
      await tx.sql("select set_config('clair.acteur', 'agent', true)");
      const bilan = await executerFile(store, creerStockageEtalon(), { executant: 'test-clair-os-budget', modele: null, types: ['veritas', 'clair_os'] });
      expect(bilan).toMatchObject({ traites: 2, termines: 1, bloques: 1, echecs: 0 });
      expect((await tx.sql<{ n: string }>("select count(*)::text as n from public.agent_runs where dossier_id = $1 and agent = 'VERITAS'", [f.dossierId]))[0].n).toBe(runsAvant);
      const [travail] = await tx.sql<{ statut: string; resultat: { statut: string; motif: string } }>("select statut, resultat from public.travaux where dossier_id = $1 and type = 'veritas' order by id desc limit 1", [f.dossierId]);
      expect(travail).toEqual({ statut: 'termine', resultat: expect.objectContaining({ statut: 'bloque', motif: 'budget_tokens_depasse' }) });
      const coupures = await tx.sql<{ apres: Record<string, unknown> }>("select apres from public.audit_log where dossier_id = $1 and action = 'budget.coupe_circuit'", [f.dossierId]);
      expect(coupures.length).toBe(1);
      expect(coupures[0].apres).toMatchObject({ type: 'veritas', document_id: docId, consomme: 1200, budget_tokens_par_dossier: 1000 });
      const travailClairOs = bilan.travaux.find((t) => t.document_id === null)!;
      const [run] = await tx.sql<RunClairOs>("select r.id, r.statut, r.sentinel_verdict, r.echo_verdict, r.sortie from public.travaux t join public.agent_runs r on r.id = (t.resultat->>'agent_run_id')::uuid where t.id = $1", [travailClairOs.id]);
      expect(run.sortie.resultat.budget).toMatchObject({ depasse: true });
      expect(run.sortie.resultat.orchestrations[0].statut).toBe('bloquee');
      // Le client ne lit pas le budget par cette fonction serveur.
      await tx.as(f.a.id);
      await tx.expectError(() => tx.sql('select public.budget_dossier($1)', [f.dossierId]), /SERVEUR_UNIQUEMENT|permission denied/);
    });
  });
});
