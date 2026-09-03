/**
 * Étape 6 — critère de sortie : « une pièce traverse le pipeline de bout en bout ».
 *
 * Exécution réelle : dépôt par le client (trigger → file de travaux), exécutant du
 * pipeline avec les procédures serveur de la base locale, texte extrait par unpdf
 * depuis les octets réels du dossier étalon, résultat comparé à verite-terrain.json.
 * Toutes les données sont fictives et annulées à la fin de chaque test.
 */
import { describe, expect, it } from 'vitest';
import { executerFile, ingererDocument, traiterProchainTravail } from '../../supabase/functions/_shared/pipeline/ingestion.ts';
import type { Travail } from '../../supabase/functions/_shared/pipeline/types.ts';
import { valider } from '../../supabase/functions/_shared/schema/validateur.ts';
import { bytesOf, deposer, dossierEtalon, hashOf, manifest, verite } from './etalon';
import { type Tx, withTx } from './harness';
import { creerStockageEtalon, creerStorePg } from './pipeline-store';

type TravailRow = Travail & { id: string; statut: string; erreur: string | null; prochaine_tentative_le: string };
type DocEtat = { file_name: string; statut_ingestion: string; ingestion_erreur: string | null; pages: number | null; hash_verifie_le: string | null };

/** Passe en contexte serveur (rôle de service, acteur « agent » comme le ferait l'exécutant). */
async function contexteExecutant(tx: Tx) {
  await tx.asService();
  await tx.sql("select set_config('clair.acteur', 'agent', true)");
}

async function travauxDuDossier(tx: Tx, dossierId: string) {
  return tx.sql<TravailRow>('select * from public.travaux where dossier_id = $1 order by id', [dossierId]);
}

describe('pipeline d’ingestion, étapes 1 à 5 (PARTIE 7.1)', () => {
  it('une pièce déposée par le client traverse le pipeline : file → réception → empreinte → extraction → qualité', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      const piece = await deposer(tx, f.a.id, f.dossierId, '01-facture-F-2026-0042.pdf');

      // Le dépôt a mis la pièce en file (trigger), visible par le client comme avancement.
      const enFile = await tx.sql<{ type: string; statut: string; document_id: string }>(
        'select type, statut, document_id from public.travaux',
      );
      expect(enFile).toEqual([{ type: 'ingestion', statut: 'en_attente', document_id: piece.id }]);
      // Aucun client ne prend un travail.
      await tx.expectError(
        () => tx.sql("select * from public.prendre_travail(array['ingestion'], 'intrus')"),
        /permission denied|SERVEUR_UNIQUEMENT/,
      );

      await contexteExecutant(tx);
      const stockage = creerStockageEtalon();
      // Étapes 1 à 5 seulement : l'indexation (étape 7) a son propre test.
      const bilan = await executerFile(creerStorePg(tx.sql), stockage, { executant: 'test-1', types: ['ingestion'] });
      expect(bilan).toMatchObject({ traites: 1, termines: 1, reessais: 0, echecs: 0 });
      expect(stockage.appels).toEqual(['01-facture-F-2026-0042.pdf']);

      const [doc] = await tx.sql<DocEtat>(
        'select file_name, statut_ingestion, ingestion_erreur, pages, hash_verifie_le from public.dossier_documents where id = $1',
        [piece.id],
      );
      expect(doc).toMatchObject({ statut_ingestion: 'extraction', ingestion_erreur: null, pages: 1 });
      expect(doc.hash_verifie_le).not.toBeNull();

      const pages = await tx.sql<{ page: number; texte: string; methode: string; score_qualite: string }>(
        'select page, texte, methode, score_qualite from public.document_pages where document_id = $1 order by page',
        [piece.id],
      );
      expect(pages.length).toBe(1);
      expect(pages[0]).toMatchObject({ page: 1, methode: 'natif' });
      expect(pages[0].texte).toContain('F-2026-0042');
      expect(Number(pages[0].score_qualite)).toBeGreaterThanOrEqual(0.6);

      const [travail] = await travauxDuDossier(tx, f.dossierId);
      expect(travail.statut).toBe('termine');
      const runs = await tx.sql<{ agent: string; statut: string; trace_id: string; entree_hash: string; sortie: { statut: string; escalades: unknown[]; resultat: { controles: { antivirus: string } } } }>(
        'select agent, statut, trace_id, entree_hash, sortie from public.agent_runs where dossier_id = $1',
        [f.dossierId],
      );
      expect(runs.length).toBe(1);
      expect(runs[0]).toMatchObject({ agent: 'INGESTION', statut: 'ok', trace_id: travail.trace_id, entree_hash: hashOf('01-facture-F-2026-0042.pdf') });
      expect(runs[0].sortie.escalades).toEqual([]);
      expect(runs[0].sortie.resultat.controles.antivirus).toBe('non_disponible');
      // Cache par entrée (7.4).
      const cache = await tx.sql<{ id: string | null }>("select public.run_en_cache('INGESTION', '1.0', $1) as id", [hashOf('01-facture-F-2026-0042.pdf')]);
      expect(cache[0].id).not.toBeNull();
      // Journal : l'avancement est tracé avec le trace_id du travail.
      const journal = await tx.sql<{ trace_id: string }>(
        "select trace_id from public.audit_log where action = 'document.ingestion' and objet_id = $1",
        [piece.id],
      );
      expect(journal.map((j) => j.trace_id)).toEqual([travail.trace_id]);

      // Le client lit le texte de sa pièce ; un autre tenant ne voit rien.
      await tx.as(f.a.id);
      expect((await tx.sql('select 1 from public.document_pages')).length).toBe(1);
      // Avancement visible : l'ingestion est terminée, l'indexation (étape 7) attend son tour.
      const avancement = await tx.sql<{ type: string; statut: string }>('select type, statut from public.travaux order by id');
      expect(avancement).toEqual([
        { type: 'ingestion', statut: 'termine' },
        { type: 'indexation', statut: 'en_attente' },
      ]);
      await tx.as(f.b.id);
      expect((await tx.sql('select 1 from public.document_pages')).length).toBe(0);
      expect((await tx.sql('select 1 from public.travaux')).length).toBe(0);
    });
  });

  it('le dossier étalon complet aboutit aux statuts de la vérité terrain (extraction / doublon / qualité insuffisante)', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      for (const p of manifest.pieces) await deposer(tx, f.a.id, f.dossierId, p.fichier);
      await contexteExecutant(tx);
      const bilan = await executerFile(creerStorePg(tx.sql), creerStockageEtalon(), { executant: 'test-etalon', maxTravaux: 50, types: ['ingestion'] });
      // Les doublons stricts n'entrent jamais dans la file : aucun traitement payant.
      expect(bilan.traites).toBe(manifest.pieces.length - verite.ingestion_attendue.doublon.length);
      expect(bilan.echecs).toBe(0);

      const docs = await tx.sql<DocEtat>(
        'select file_name, statut_ingestion, ingestion_erreur, pages, hash_verifie_le from public.dossier_documents where dossier_id = $1 order by file_name',
        [f.dossierId],
      );
      const parStatut: Record<string, string[]> = {};
      for (const d of docs) (parStatut[d.statut_ingestion] ??= []).push(d.file_name);
      expect(parStatut).toEqual(verite.ingestion_attendue);

      const illisible = docs.find((d) => d.file_name === verite.documents_illisibles[0].piece)!;
      expect(illisible.ingestion_erreur).toBe('OCR_REQUIS_NON_DISPONIBLE');
      // Contrat de schéma (PARTIE 10.4) : chaque sortie persistée du pipeline est conforme au schéma universel.
      const sorties = await tx.sql<{ sortie: unknown; agent: string }>('select sortie, agent from public.agent_runs where sortie is not null');
      expect(sorties.length).toBeGreaterThan(0);
      for (const s of sorties) expect(valider(s.sortie), s.agent).toMatchObject({ valide: true });
      const escalades = await tx.sql<{ escalades: { code: string; destinataire: string }[] }>(
        "select escalades from public.agent_runs where statut = 'escalade'",
      );
      expect(escalades.length).toBe(1);
      expect(escalades[0].escalades).toEqual([expect.objectContaining({ code: 'E4', destinataire: 'utilisateur' })]);
      const pagesIllisible = await tx.sql<{ methode: string }>(
        'select p.methode from public.document_pages p join public.dossier_documents d on d.id = p.document_id where d.file_name = $1',
        [illisible.file_name],
      );
      expect(pagesIllisible).toEqual([{ methode: 'ocr_requis' }]);
      // Toutes les pièces traitées ont une empreinte vérifiée par le serveur.
      for (const d of docs.filter((x) => x.statut_ingestion !== 'doublon')) expect(d.hash_verifie_le, d.file_name).not.toBeNull();
    });
  });

  it('une pièce déposée sans empreinte (ancien client) est reconnue doublon par l’empreinte serveur et n’est pas analysée', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      await deposer(tx, f.a.id, f.dossierId, '01-facture-F-2026-0042.pdf');
      const legacy = await deposer(tx, f.a.id, f.dossierId, '02-facture-F-2026-0042-copie.pdf', { hash: null, mime: null });
      expect(legacy.statut_ingestion).toBe('recu');
      await contexteExecutant(tx);
      const bilan = await executerFile(creerStorePg(tx.sql), creerStockageEtalon(), { executant: 'test-legacy', types: ['ingestion'] });
      expect(bilan.traites).toBe(2);
      const [doc] = await tx.sql<DocEtat & { doublon_de_id: string | null }>(
        'select file_name, statut_ingestion, ingestion_erreur, pages, hash_verifie_le, doublon_de_id from public.dossier_documents where id = $1',
        [legacy.id],
      );
      expect(doc.statut_ingestion).toBe('doublon');
      expect(doc.doublon_de_id).not.toBeNull();
      expect((await tx.sql('select 1 from public.document_pages where document_id = $1', [legacy.id])).length).toBe(0);
    });
  });

  it('réception refusée : type non pris en charge, MIME incohérent, quota de taille — la pièce est en échec avec le motif exact', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      const zip = await deposer(tx, f.a.id, f.dossierId, 'archive.zip', { hash: 'a'.repeat(64), mime: 'application/zip' });
      const menteur = await deposer(tx, f.a.id, f.dossierId, 'photo.png', { hash: 'b'.repeat(64), mime: 'image/png' });
      await tx.asService();
      await tx.sql("update public.plan_limites set max_octets_par_piece = 100 where plan = '*'");
      const lourd = await deposer(tx, f.a.id, f.dossierId, '04-bon-de-commande-BC-2025-118.pdf');
      await contexteExecutant(tx);
      const stockage = creerStockageEtalon({
        contenus: {
          'archive.zip': new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]),
          // Déclarée PNG, mais les octets sont ceux d'un PDF.
          'photo.png': new Uint8Array(bytesOf('01-facture-F-2026-0042.pdf')),
        },
      });
      const bilan = await executerFile(creerStorePg(tx.sql), stockage, { executant: 'test-refus', types: ['ingestion'] });
      expect(bilan).toMatchObject({ traites: 3, termines: 3, echecs: 0 });
      const etats = await tx.sql<DocEtat & { id: string }>(
        'select id, file_name, statut_ingestion, ingestion_erreur, pages, hash_verifie_le from public.dossier_documents where dossier_id = $1',
        [f.dossierId],
      );
      const etat = (id: string) => etats.find((e) => e.id === id)!;
      expect(etat(zip.id)).toMatchObject({ statut_ingestion: 'echec', ingestion_erreur: 'TYPE_NON_PRIS_EN_CHARGE' });
      expect(etat(menteur.id).statut_ingestion).toBe('echec');
      expect(etat(menteur.id).ingestion_erreur).toMatch(/^MIME_INCOHERENT:image\/png!=application\/pdf/);
      expect(etat(lourd.id)).toMatchObject({ statut_ingestion: 'echec', ingestion_erreur: 'QUOTA:TAILLE_MAX_DEPASSEE' });
      // Le quota est évalué avant tout téléchargement : la pièce trop lourde n'a pas été lue.
      expect(stockage.appels).not.toContain('04-bon-de-commande-BC-2025-118.pdf');
    });
  });

  it('reprise sur erreur : un stockage indisponible remet le travail en file avec backoff, puis réussit ; un échec répété devient définitif et journalisé', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      const piece = await deposer(tx, f.a.id, f.dossierId, '05-mise-en-demeure-2026-02-20.pdf');
      await contexteExecutant(tx);
      const store = creerStorePg(tx.sql);
      const stockage = creerStockageEtalon({ echecs: { '05-mise-en-demeure-2026-02-20.pdf': 1 } });

      const premier = await traiterProchainTravail(store, stockage, 'test-reprise', { types: ['ingestion'] });
      expect(premier?.issue).toBe('reessai');
      let [t] = await travauxDuDossier(tx, f.dossierId);
      expect(t.statut).toBe('en_attente');
      expect(t.tentatives).toBe(1);
      expect(t.erreur).toMatch(/stockage indisponible/);
      expect(new Date(t.prochaine_tentative_le).getTime()).toBeGreaterThan(Date.now() + 20_000);
      // Pas encore l'heure : la file est vide pour l'exécutant.
      expect(await traiterProchainTravail(store, stockage, 'test-reprise', { types: ['ingestion'] })).toBeNull();
      // L'exécution en échec est tracée elle aussi.
      const runsEchec = await tx.sql<{ statut: string; erreur: string }>("select statut, erreur from public.agent_runs where statut = 'echec'");
      expect(runsEchec.length).toBe(1);

      await tx.sql('update public.travaux set prochaine_tentative_le = now() where id = $1', [t.id]);
      const second = await traiterProchainTravail(store, stockage, 'test-reprise', { types: ['ingestion'] });
      expect(second?.issue).toBe('termine');
      [t] = await travauxDuDossier(tx, f.dossierId);
      expect(t.statut).toBe('termine');
      expect(t.tentatives).toBe(2);
      const [doc] = await tx.sql<DocEtat>('select file_name, statut_ingestion, ingestion_erreur, pages, hash_verifie_le from public.dossier_documents where id = $1', [piece.id]);
      expect(doc.statut_ingestion).toBe('extraction');

      // Échec définitif après épuisement des tentatives.
      const autre = await deposer(tx, f.a.id, f.dossierId, 'introuvable.pdf', { hash: 'c'.repeat(64) });
      await tx.sql('update public.travaux set max_tentatives = 1 where document_id = $1', [autre.id]);
      const echec = await traiterProchainTravail(store, creerStockageEtalon(), 'test-reprise', { types: ['ingestion'] });
      expect(echec?.issue).toBe('echec');
      const [te] = await tx.sql<TravailRow>('select * from public.travaux where document_id = $1', [autre.id]);
      expect(te.statut).toBe('echec');
      expect(te.erreur).toMatch(/objet absent/);
      const journal = await tx.sql("select 1 from public.audit_log where action = 'travail.echec' and dossier_id = $1", [f.dossierId]);
      expect(journal.length).toBe(1);
    });
  });

  it('idempotence : un même document n’a jamais deux travaux actifs, et une réexécution ne duplique pas les pages', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      const piece = await deposer(tx, f.a.id, f.dossierId, '07-courriel-relance-2026-02-13.pdf');
      await contexteExecutant(tx);
      const ids = await tx.sql<{ id: string }>(
        "select public.planifier_travail('ingestion', $1::uuid, $2::uuid, $3::uuid) as id",
        [f.a.tenantId, f.dossierId, piece.id],
      );
      const [existant] = await travauxDuDossier(tx, f.dossierId);
      expect(ids[0].id).toBe(existant.id);
      expect((await travauxDuDossier(tx, f.dossierId)).length).toBe(1);

      const store = creerStorePg(tx.sql);
      const stockage = creerStockageEtalon();
      const travail = (await store.prendreTravail(['ingestion'], 'test-idem'))!;
      await ingererDocument(store, stockage, travail);
      await ingererDocument(store, stockage, travail);
      const pages = await tx.sql('select 1 from public.document_pages where document_id = $1', [piece.id]);
      expect(pages.length).toBe(1);
    });
  });

  it('un verrou expiré (exécutant disparu) rend le travail à la file', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      await deposer(tx, f.a.id, f.dossierId, '01-facture-F-2026-0042.pdf');
      await contexteExecutant(tx);
      const store = creerStorePg(tx.sql);
      const pris = await store.prendreTravail(['ingestion'], 'exécutant-mort');
      expect(pris).not.toBeNull();
      expect(await store.prendreTravail(['ingestion'], 'autre')).toBeNull();
      await tx.sql("update public.travaux set verrou_le = now() - interval '11 minutes' where id = $1", [pris!.id]);
      const repris = await store.prendreTravail(['ingestion'], 'autre');
      expect(repris?.id).toBe(pris!.id);
      expect(repris?.tentatives).toBe(2);
    });
  });
});
