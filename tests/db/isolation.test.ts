/**
 * Étape 4 — critère de sortie : « test d'isolation au vert ».
 *
 * Un utilisateur du tenant A ne doit accéder à AUCUNE ressource du tenant B, y
 * compris via la recherche vectorielle (PARTIE 10.4). Les flux existants de
 * l'application (création de dossier sans tenant_id, dépôt de pièce, admin global)
 * doivent continuer de fonctionner (I11). Les invariants du socle (ancrage I2,
 * journal immuable, validation humaine I5, protection des corrections F11,
 * abonnement côté serveur I7) sont vérifiés par exécution.
 *
 * Toutes les données sont fictives et annulées à la fin de chaque test.
 */
import { describe, expect, it } from 'vitest';
import { type Tx, withTx } from './harness';

type Fixture = {
  a: { id: string; tenantId: string };
  b: { id: string; tenantId: string };
  lecteur: { id: string };
  admin: { id: string };
  dossierA: string;
  documentA: string;
  chunkA: string;
};

/** Deux tenants (A, B), un lecteur rattaché à A, un admin global, un dossier de A avec une pièce et un chunk. */
async function fixture(tx: Tx): Promise<Fixture> {
  const a = await tx.createUser('a@test.invalid', { full_name: 'A Test', company_name: 'Atelier A' });
  const b = await tx.createUser('b@test.invalid', { full_name: 'B Test' });
  const lecteur = await tx.createUser('lecteur@test.invalid', { full_name: 'L Test' });
  const admin = await tx.createUser('admin@test.invalid', { full_name: 'Admin Test' });
  await tx.sql('insert into public.app_admins (user_id) values ($1)', [admin.id]);
  await tx.sql("insert into public.tenant_members (tenant_id, user_id, role) values ($1, $2, 'lecteur')", [
    a.tenantId,
    lecteur.id,
  ]);

  // Flux réel du tunnel : INSERT sans tenant_id, status 'transmis'.
  await tx.as(a.id);
  const d = await tx.sql<{ id: string; tenant_id: string }>(
    `insert into public.dossiers (user_id, typology, title, answers, legal_review_requested, status)
     values ($1, 'impaye-precontentieux', 'Facture F-TEST-001', '{"amount":"1200"}'::jsonb, false, 'transmis')
     returning id, tenant_id`,
    [a.id],
  );
  expect(d[0].tenant_id).toBe(a.tenantId);
  const doc = await tx.sql<{ id: string; tenant_id: string }>(
    `insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, size_bytes)
     values ($1::uuid, $2::uuid, $2::text || '/' || $1::text || '/1-facture.pdf', 'facture.pdf', 1234)
     returning id, tenant_id`,
    [d[0].id, a.id],
  );
  expect(doc[0].tenant_id).toBe(a.tenantId);

  // Le pipeline (service) découpe la pièce.
  await tx.asService();
  const chunk = await tx.sql<{ id: string }>(
    `insert into public.document_chunks (dossier_id, document_id, page, offset_debut, offset_fin, texte, embedding, embedding_modele)
     values ($1, $2, 1, 0, 42, 'Facture n° F-TEST-001 du 12 janvier 2026, montant 1 200 €.', '[0.1,0.2,0.3]', 'test-3d')
     returning id`,
    [d[0].id, doc[0].id],
  );

  return { a, b, lecteur, admin, dossierA: d[0].id, documentA: doc[0].id, chunkA: chunk[0].id };
}

describe('cloisonnement par tenant', () => {
  it('le tenant B ne voit aucune ressource du tenant A (dossiers, pièces, chunks, journal)', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.b.id);
      for (const table of [
        'dossiers',
        'dossier_documents',
        'document_chunks',
        'entites',
        'evenements',
        'echeances',
        'contradictions',
        'pieces_manquantes',
        'productions',
        'agent_runs',
      ]) {
        const rows = await tx.sql(`select 1 from public.${table}`);
        expect(rows.length, `table ${table} vue par B`).toBe(0);
      }
      const tenants = await tx.sql<{ id: string }>('select id from public.tenants');
      expect(tenants.map((t) => t.id)).toEqual([f.b.tenantId]);
      // Le journal : B ne voit que les entrées de son propre tenant, jamais celles de A.
      const journal = await tx.sql<{ tenant_id: string; dossier_id: string | null }>(
        'select tenant_id, dossier_id from public.audit_log',
      );
      expect(journal.length).toBeGreaterThan(0);
      for (const row of journal) {
        expect(row.tenant_id).toBe(f.b.tenantId);
        expect(row.dossier_id).not.toBe(f.dossierA);
      }
    });
  });

  it('la recherche vectorielle et lexicale est filtrée par la RLS (0 résultat pour B, 1 pour A)', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.b.id);
      const vecB = await tx.sql(
        "select id from public.document_chunks order by embedding <-> '[0,0,0]'::extensions.vector limit 5",
      );
      expect(vecB.length).toBe(0);
      const lexB = await tx.sql(
        "select id from public.document_chunks where texte_tsv @@ plainto_tsquery('french', 'facture')",
      );
      expect(lexB.length).toBe(0);

      await tx.as(f.a.id);
      const vecA = await tx.sql<{ id: string }>(
        "select id from public.document_chunks order by embedding <-> '[0,0,0]'::extensions.vector limit 5",
      );
      expect(vecA.map((r) => r.id)).toEqual([f.chunkA]);
      const lexA = await tx.sql(
        "select id from public.document_chunks where texte_tsv @@ plainto_tsquery('french', 'facture')",
      );
      expect(lexA.length).toBe(1);
    });
  });

  it('B ne peut ni créer un dossier dans le tenant de A, ni y déposer une pièce, ni y écrire une entité', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.b.id);
      await tx.expectError(
        () =>
          tx.sql(
            "insert into public.dossiers (user_id, tenant_id, typology, title, status) values ($1, $2, 'autre', 'intrusion', 'transmis')",
            [f.b.id, f.a.tenantId],
          ),
        /row-level security/,
      );
      await tx.expectError(
        () =>
          tx.sql(
            "insert into public.dossier_documents (dossier_id, user_id, file_path, file_name) values ($1, $2, 'x/y/z.pdf', 'z.pdf')",
            [f.dossierA, f.b.id],
          ),
        /row-level security/,
      );
      await tx.expectError(
        () =>
          tx.sql(
            "insert into public.entites (dossier_id, type, valeur_normalisee, confiance) values ($1, 'personne', 'X', 0.9)",
            [f.dossierA],
          ),
        /row-level security/,
      );
    });
  });

  it('A ne peut pas déplacer son dossier vers un autre tenant, même s’il en est membre', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.a.id);
      await tx.expectError(
        () => tx.sql('update public.dossiers set tenant_id = $1 where id = $2', [f.b.tenantId, f.dossierA]),
        /TENANT_DOSSIER_IMMUABLE|row-level security/,
      );
      // Membre des deux tenants : le déplacement laisserait pièces et chunks dans l'ancien tenant.
      await tx.asService();
      await tx.sql("insert into public.tenant_members (tenant_id, user_id, role) values ($1, $2, 'membre')", [
        f.b.tenantId,
        f.a.id,
      ]);
      await tx.as(f.a.id);
      await tx.expectError(
        () => tx.sql('update public.dossiers set tenant_id = $1 where id = $2', [f.b.tenantId, f.dossierA]),
        /TENANT_DOSSIER_IMMUABLE/,
      );
      // Une pièce ne change pas non plus de dossier, et le créateur n'est pas réassignable.
      const d2 = await tx.sql<{ id: string }>(
        "insert into public.dossiers (user_id, typology, title, status) values ($1, 'autre', 'D2', 'transmis') returning id",
        [f.a.id],
      );
      await tx.expectError(
        () => tx.sql('update public.dossier_documents set dossier_id = $1 where id = $2', [d2[0].id, f.documentA]),
        /DOSSIER_IMMUABLE/,
      );
      await tx.expectError(
        () => tx.sql('update public.dossiers set user_id = $1 where id = $2', [f.b.id, f.dossierA]),
        /CREATEUR_DOSSIER_IMMUABLE|row-level security/,
      );
    });
  });

  it('un lecteur du tenant voit le dossier mais ne peut rien écrire', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.lecteur.id);
      const rows = await tx.sql('select id from public.dossiers');
      expect(rows.length).toBe(1);
      await tx.expectError(
        () =>
          tx.sql(
            "insert into public.productions (dossier_id, agent, type, contenu_texte) values ($1, 'HERMES', 'relance', 'Brouillon')",
            [f.dossierA],
          ),
        /row-level security/,
      );
      await tx.expectError(
        () => tx.sql("update public.dossiers set title = 'modifié par lecteur' where id = $1", [f.dossierA]),
        /row-level security|0 ligne/,
      ).catch(async () => {
        // Une policy UPDATE non satisfaite peut aussi se traduire par 0 ligne modifiée.
        const t = await tx.sql<{ title: string }>('select title from public.dossiers where id = $1', [f.dossierA]);
        expect(t[0].title).toBe('Facture F-TEST-001');
      });
    });
  });

  it("l'admin global voit tout en lecture et peut déposer un livrable (flux existant)", async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.admin.id);
      expect((await tx.sql('select id from public.dossiers')).length).toBe(1);
      expect((await tx.sql('select id from public.document_chunks')).length).toBe(1);
      const liv = await tx.sql<{ tenant_id: string }>(
        `insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, size_bytes, kind)
         values ($1::uuid, $2::uuid, $2::text || '/' || $1::text || '/deliverable-1-synthese.pdf', 'synthese.pdf', 10, 'deliverable')
         returning tenant_id`,
        [f.dossierA, f.a.id],
      );
      expect(liv[0].tenant_id).toBe(f.a.tenantId);
      // Le client retrouve le livrable via sa propre policy.
      await tx.as(f.a.id);
      const docs = await tx.sql<{ kind: string }>('select kind from public.dossier_documents order by created_at');
      expect(docs.map((d) => d.kind)).toEqual(['piece', 'deliverable']);
    });
  });
});

describe('invariants du socle', () => {
  it('journal d’audit : alimenté automatiquement, lisible par le tenant, jamais modifiable', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.a.id);
      const mine = await tx.sql<{ action: string }>('select action from public.audit_log order by id');
      expect(mine.map((r) => r.action)).toEqual(expect.arrayContaining(['dossier.cree', 'document.depose']));
      // Insertion directe interdite au client.
      await tx.expectError(
        () => tx.sql("insert into public.audit_log (action, objet_type) values ('forge', 'x')"),
        /permission denied|row-level security/,
      );
      // Même le rôle de service ne peut ni modifier ni supprimer.
      await tx.asService();
      await tx.expectError(() => tx.sql("update public.audit_log set action = 'x'"), /AUDIT_LOG_IMMUABLE/);
      await tx.expectError(() => tx.sql('delete from public.audit_log'), /AUDIT_LOG_IMMUABLE/);
      // B ne voit aucune entrée concernant le tenant ou le dossier de A.
      await tx.as(f.b.id);
      const vuParB = await tx.sql<{ tenant_id: string; dossier_id: string | null }>(
        'select tenant_id, dossier_id from public.audit_log',
      );
      expect(vuParB.filter((r) => r.tenant_id === f.a.tenantId || r.dossier_id === f.dossierA).length).toBe(0);
    });
  });

  it('ancrage obligatoire (I2) : pas d’entité, d’événement ni d’échéance sans source ; la dernière source ne peut pas être supprimée', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.asService();
      await tx.expectError(
        () =>
          tx.sql(
            "insert into public.entites (dossier_id, type, valeur_normalisee, confiance) values ($1, 'montant', '1200', 0.95)",
            [f.dossierA],
          ),
        /ANCRAGE_REQUIS/,
      );
      await tx.expectError(
        () =>
          tx.sql(
            "insert into public.evenements (dossier_id, date, nature, description, confiance) values ($1, '2026-01-12', 'facture', 'Émission', 0.97)",
            [f.dossierA],
          ),
        /ANCRAGE_REQUIS/,
      );
      await tx.expectError(
        () =>
          tx.sql(
            "insert into public.echeances (dossier_id, date, nature, base_de_calcul, confiance) values ($1, '2026-02-11', 'paiement', 'facture + 30 jours', 0.96)",
            [f.dossierA],
          ),
        /ANCRAGE_REQUIS/,
      );
      // Avec source : accepté.
      const e = await tx.sql<{ id: string }>(
        "insert into public.entites (dossier_id, type, valeur_normalisee, confiance) values ($1, 'montant', '1200', 0.95) returning id",
        [f.dossierA],
      );
      await tx.sql(
        "insert into public.entite_sources (entite_id, chunk_id, extrait, offset_debut, offset_fin) values ($1, $2, 'montant 1 200 €', 30, 42)",
        [e[0].id, f.chunkA],
      );
      await tx.checkDeferred();
      // Supprimer la dernière source est refusé.
      await tx.expectError(
        () => tx.sql('delete from public.entite_sources where entite_id = $1', [e[0].id]),
        /ANCRAGE_REQUIS/,
      );
      // Une déclaration du client n'exige pas de source (PARTIE 6), mais le dit.
      await tx.sql(
        "insert into public.entites (dossier_id, type, valeur_normalisee, nature, confiance) values ($1, 'personne', 'Débiteur déclaré', 'declaration_client', 0.5)",
        [f.dossierA],
      );
      await tx.checkDeferred();
    });
  });

  it('validation humaine obligatoire (I5) : aucune production « validée » ou « envoyée » sans validateur', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.asService();
      const p = await tx.sql<{ id: string; statut_validation: string }>(
        "insert into public.productions (dossier_id, agent, type, contenu_texte) values ($1, 'HERMES', 'relance', 'Brouillon') returning id, statut_validation",
        [f.dossierA],
      );
      expect(p[0].statut_validation).toBe('brouillon_ia');
      await tx.expectError(
        () => tx.sql("update public.productions set statut_validation = 'valide_humainement' where id = $1", [p[0].id]),
        /VALIDATION_HUMAINE_REQUISE/,
      );
      await tx.expectError(
        () => tx.sql("update public.productions set statut_validation = 'envoye' where id = $1", [p[0].id]),
        /VALIDATION_HUMAINE_REQUISE/,
      );
      await tx.sql("update public.productions set statut_validation = 'valide_humainement', valide_par = $2 where id = $1", [
        p[0].id,
        f.a.id,
      ]);
      const v = await tx.sql<{ valide_le: string | null }>('select valide_le from public.productions where id = $1', [p[0].id]);
      expect(v[0].valide_le).not.toBeNull();
    });
  });

  it('une correction humaine n’est jamais écrasée par un agent (F11)', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.asService();
      const e = await tx.sql<{ id: string }>(
        "insert into public.entites (dossier_id, type, valeur_normalisee, confiance) values ($1, 'montant', '1200', 0.95) returning id",
        [f.dossierA],
      );
      await tx.sql('insert into public.entite_sources (entite_id, chunk_id) values ($1, $2)', [e[0].id, f.chunkA]);
      // L'utilisateur corrige et verrouille.
      await tx.as(f.a.id);
      await tx.sql("update public.entites set valeur_normalisee = '1250', verrouille_humain = true where id = $1", [e[0].id]);
      // Un agent (réanalyse) tente d'écraser : refusé.
      await tx.asService();
      await tx.sql("select set_config('clair.acteur', 'agent', true)");
      await tx.expectError(
        () => tx.sql("update public.entites set valeur_normalisee = '1200' where id = $1", [e[0].id]),
        /CORRECTION_HUMAINE_PROTEGEE/,
      );
      await tx.sql("select set_config('clair.acteur', '', true)");
      const v = await tx.sql<{ valeur_normalisee: string }>('select valeur_normalisee from public.entites where id = $1', [e[0].id]);
      expect(v[0].valeur_normalisee).toBe('1250');
    });
  });

  it('les droits d’abonnement ne sont modifiables que côté serveur (I7)', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.a.id);
      await tx.expectError(
        () => tx.sql("update public.tenants set plan = 'business-pme-pro', statut_abonnement = 'actif' where id = $1", [f.a.tenantId]),
        /ABONNEMENT_SERVEUR_UNIQUEMENT/,
      );
      const before = await tx.sql<{ plan: string }>('select plan from public.plan_actuel($1)', [f.a.tenantId]);
      expect(before[0].plan).toBe('gratuit');
      await tx.asService();
      await tx.sql("update public.tenants set plan = 'essentiel', statut_abonnement = 'actif' where id = $1", [f.a.tenantId]);
      await tx.as(f.a.id);
      const after = await tx.sql<{ plan: string; statut_abonnement: string }>('select * from public.plan_actuel($1)', [f.a.tenantId]);
      expect(after[0]).toEqual({ plan: 'essentiel', statut_abonnement: 'actif' });
      // B ne lit pas le plan de A.
      await tx.as(f.b.id);
      expect((await tx.sql('select * from public.plan_actuel($1)', [f.a.tenantId])).length).toBe(0);
    });
  });
});

describe('durcissement vérifié par exécution (scénarios d’attaque rejoués)', () => {
  it('journal : un client ne journalise que dans ses tenants et ne choisit pas son type d’acteur', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.b.id);
      await tx.expectError(
        () => tx.sql("select public.journaliser('forge', 'x', null, $1, null, null, null, 'admin')", [f.a.tenantId]),
        /AUDIT_TENANT_INTERDIT/,
      );
      await tx.expectError(
        () => tx.sql("select public.journaliser('forge', 'x', null, $1, $2)", [f.b.tenantId, f.dossierA]),
        /AUDIT_DOSSIER_INCOHERENT/,
      );
      const id = await tx.sql<{ journaliser: string }>(
        "select public.journaliser('note', 'x', null, $1, null, null, null, 'admin')",
        [f.b.tenantId],
      );
      await tx.asService();
      const row = await tx.sql<{ acteur_type: string; acteur: string }>(
        'select acteur_type, acteur from public.audit_log where id = $1',
        [id[0].journaliser],
      );
      expect(row[0]).toEqual({ acteur_type: 'utilisateur', acteur: f.b.id });
      // La séquence du journal n'est pas manipulable par un client (setval n'est pas transactionnel).
      const seq = await tx.sql<{ ok: boolean }>(
        "select has_sequence_privilege('authenticated', pg_get_serial_sequence('public.audit_log', 'id'), 'UPDATE') as ok",
      );
      expect(seq[0].ok).toBe(false);
    });
  });

  it('verrou humain (F11) : ni suppression par un agent, ni écriture serveur sans identité humaine', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.asService();
      const e = await tx.sql<{ id: string }>(
        "insert into public.entites (dossier_id, type, valeur_normalisee, confiance) values ($1, 'montant', '1200', 0.95) returning id",
        [f.dossierA],
      );
      await tx.sql('insert into public.entite_sources (entite_id, chunk_id) values ($1, $2)', [e[0].id, f.chunkA]);
      await tx.as(f.a.id);
      await tx.sql('update public.entites set verrouille_humain = true where id = $1', [e[0].id]);
      const meta = await tx.sql<{ modifie_par: string | null }>('select modifie_par from public.entites where id = $1', [e[0].id]);
      expect(meta[0].modifie_par).toBe(f.a.id);
      await tx.asService();
      // Agent explicite : refusé en suppression.
      await tx.sql("select set_config('clair.acteur', 'agent', true)");
      await tx.expectError(() => tx.sql('delete from public.entites where id = $1', [e[0].id]), /CORRECTION_HUMAINE_PROTEGEE/);
      // Serveur sans contexte : réputé agent, refusé.
      await tx.sql("select set_config('clair.acteur', '', true)");
      await tx.expectError(
        () => tx.sql("update public.entites set valeur_normalisee = 'x' where id = $1", [e[0].id]),
        /CORRECTION_HUMAINE_PROTEGEE/,
      );
      // Contexte système explicite (purge, support) : autorisé.
      await tx.sql("select set_config('clair.acteur', 'systeme', true)");
      await tx.sql("update public.entites set confiance = 1 where id = $1", [e[0].id]);
      await tx.sql("select set_config('clair.acteur', '', true)");
      // L'humain lève son verrou : l'agent peut de nouveau écrire.
      await tx.as(f.a.id);
      await tx.sql('update public.entites set verrouille_humain = false where id = $1', [e[0].id]);
      await tx.asService();
      await tx.sql("select set_config('clair.acteur', 'agent', true)");
      await tx.sql("update public.entites set valeur_normalisee = '1200' where id = $1", [e[0].id]);
      await tx.sql("select set_config('clair.acteur', '', true)");
    });
  });

  it('pièces : le client ne réécrit pas les métadonnées d’ingestion, mais peut renommer', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.a.id);
      for (const set of [
        "kind = 'deliverable'",
        "statut_ingestion = 'termine'",
        `hash_sha256 = '${'a'.repeat(64)}'`,
        "file_path = 'ailleurs/x.pdf'",
        'user_id = $2',
        'version = 2',
      ]) {
        await tx.expectError(
          () => tx.sql(`update public.dossier_documents set ${set} where id = $1`, set.includes('$2') ? [f.documentA, f.b.id] : [f.documentA]),
          /METADONNEES_PIECE_SERVEUR_UNIQUEMENT/,
        );
      }
      await tx.sql("update public.dossier_documents set file_name = 'facture-janvier.pdf', categorie = 'facture' where id = $1", [f.documentA]);
      // Le serveur, lui, fait avancer l'ingestion.
      await tx.asService();
      await tx.sql("update public.dossier_documents set statut_ingestion = 'extraction', hash_sha256 = $2 where id = $1", [
        f.documentA,
        'b'.repeat(64),
      ]);
    });
  });

  it('preuves : aucun client n’insère de chunk, d’entité ni d’ancrage (I1), ni ne supprime un chunk', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.a.id);
      await tx.expectError(
        () =>
          tx.sql(
            "insert into public.document_chunks (dossier_id, document_id, page, offset_debut, offset_fin, texte) values ($1, $2, 2, 0, 10, 'faux texte')",
            [f.dossierA, f.documentA],
          ),
        /row-level security/,
      );
      await tx.expectError(
        () =>
          tx.sql(
            "insert into public.entites (dossier_id, type, valeur_normalisee, nature, confiance) values ($1, 'montant', '999999', 'declaration_client', 1)",
            [f.dossierA],
          ),
        /row-level security/,
      );
      await tx.sql('delete from public.document_chunks where id = $1', [f.chunkA]);
      await tx.asService();
      expect((await tx.sql('select id from public.document_chunks where id = $1', [f.chunkA])).length).toBe(1);
      const e = await tx.sql<{ id: string }>(
        "insert into public.entites (dossier_id, type, valeur_normalisee, confiance) values ($1, 'montant', '1200', 0.95) returning id",
        [f.dossierA],
      );
      await tx.sql('insert into public.entite_sources (entite_id, chunk_id) values ($1, $2)', [e[0].id, f.chunkA]);
      await tx.as(f.a.id);
      await tx.expectError(
        () => tx.sql('insert into public.entite_sources (entite_id, chunk_id, extrait) values ($1, $2, $3)', [e[0].id, f.chunkA, 'x']),
        /row-level security|duplicate key/,
      );
      await tx.sql('delete from public.entite_sources where entite_id = $1', [e[0].id]);
      await tx.asService();
      expect((await tx.sql('select 1 from public.entite_sources where entite_id = $1', [e[0].id])).length).toBe(1);
    });
  });

  it('suppression physique d’une pièce (serveur) : les analyses IA orphelines sont supprimées et journalisées ; une correction humaine bloque, sauf purge « systeme »', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.asService();
      const e = await tx.sql<{ id: string }>(
        "insert into public.entites (dossier_id, type, valeur_normalisee, confiance) values ($1, 'montant', '1200', 0.95) returning id",
        [f.dossierA],
      );
      await tx.sql('insert into public.entite_sources (entite_id, chunk_id) values ($1, $2)', [e[0].id, f.chunkA]);
      await tx.checkDeferred();
      // Le client ne détruit jamais un original (I3, étape 5) : il le retire logiquement.
      await tx.as(f.a.id);
      await tx.expectError(
        () => tx.sql('delete from public.dossier_documents where id = $1', [f.documentA]),
        /PIECE_ORIGINALE_CONSERVEE/,
      );
      // Le serveur supprime physiquement (purge) : l'entité IA sans autre source disparaît.
      await tx.asService();
      await tx.sql('delete from public.dossier_documents where id = $1', [f.documentA]);
      await tx.checkDeferred();
      expect((await tx.sql('select 1 from public.entites where id = $1', [e[0].id])).length).toBe(0);
      const journal = await tx.sql<{ objet_id: string; acteur_type: string }>(
        "select objet_id, acteur_type from public.audit_log where action = 'analyse.orpheline_supprimee'",
      );
      expect(journal).toEqual([{ objet_id: e[0].id, acteur_type: 'systeme' }]);
    });
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.asService();
      const e = await tx.sql<{ id: string }>(
        "insert into public.entites (dossier_id, type, valeur_normalisee, confiance, verrouille_humain) values ($1, 'montant', '1250', 0.95, true) returning id",
        [f.dossierA],
      );
      await tx.sql('insert into public.entite_sources (entite_id, chunk_id) values ($1, $2)', [e[0].id, f.chunkA]);
      await tx.checkDeferred();
      // Sans contexte « systeme » explicite, une correction humaine bloque la suppression.
      await tx.expectError(
        () => tx.sql('delete from public.dossier_documents where id = $1', [f.documentA]),
        /PIECE_FONDE_CORRECTION_HUMAINE/,
      );
      expect((await tx.sql('select 1 from public.dossier_documents where id = $1', [f.documentA])).length).toBe(1);
      // Purge explicite (droit à l'effacement) : tout disparaît, et c'est journalisé.
      await tx.sql("select set_config('clair.acteur', 'systeme', true)");
      await tx.sql('delete from public.dossier_documents where id = $1', [f.documentA]);
      await tx.checkDeferred();
      await tx.sql("select set_config('clair.acteur', '', true)");
      expect((await tx.sql('select 1 from public.entites where id = $1', [e[0].id])).length).toBe(0);
      expect((await tx.sql("select 1 from public.audit_log where action = 'analyse.orpheline_supprimee' and objet_id = $1", [e[0].id])).length).toBe(1);
    });
  });

  it('membres : seul un propriétaire touche aux propriétaires, et il en reste toujours un', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.sql("insert into public.tenant_members (tenant_id, user_id, role) values ($1, $2, 'administrateur')", [
        f.a.tenantId,
        f.b.id,
      ]);
      await tx.as(f.b.id);
      await tx.expectError(
        () => tx.sql("update public.tenant_members set role = 'proprietaire' where tenant_id = $1 and user_id = $2", [f.a.tenantId, f.b.id]),
        /ROLE_PROPRIETAIRE_RESERVE/,
      );
      await tx.expectError(
        () => tx.sql('delete from public.tenant_members where tenant_id = $1 and user_id = $2', [f.a.tenantId, f.a.id]),
        /ROLE_PROPRIETAIRE_RESERVE/,
      );
      await tx.as(f.a.id);
      await tx.expectError(
        () => tx.sql('delete from public.tenant_members where tenant_id = $1 and user_id = $2', [f.a.tenantId, f.a.id]),
        /DERNIER_PROPRIETAIRE/,
      );
      await tx.sql("update public.tenant_members set role = 'proprietaire' where tenant_id = $1 and user_id = $2", [f.a.tenantId, f.b.id]);
      await tx.sql('delete from public.tenant_members where tenant_id = $1 and user_id = $2', [f.a.tenantId, f.a.id]);
      await tx.asService();
      const rest = await tx.sql<{ user_id: string; role: string }>(
        'select user_id, role from public.tenant_members where tenant_id = $1 order by role',
        [f.a.tenantId],
      );
      expect(rest).toEqual([
        { user_id: f.lecteur.id, role: 'lecteur' },
        { user_id: f.b.id, role: 'proprietaire' },
      ]);
    });
  });

  it('productions : le validateur est l’utilisateur authentifié ; validée = contenu figé ; envoyée = irréversible', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.asService();
      const p = await tx.sql<{ id: string }>(
        "insert into public.productions (dossier_id, agent, type, contenu_texte) values ($1, 'HERMES', 'relance', 'Brouillon') returning id",
        [f.dossierA],
      );
      await tx.as(f.a.id);
      await tx.expectError(
        () =>
          tx.sql("update public.productions set statut_validation = 'valide_humainement', valide_par = $2 where id = $1", [p[0].id, f.b.id]),
        /VALIDATEUR_INCOHERENT/,
      );
      await tx.sql("update public.productions set statut_validation = 'valide_humainement', valide_par = $2 where id = $1", [p[0].id, f.a.id]);
      await tx.expectError(
        () => tx.sql("update public.productions set contenu_texte = 'modifié après validation' where id = $1", [p[0].id]),
        /PRODUCTION_VALIDEE_IMMUABLE/,
      );
      await tx.sql("update public.productions set statut_validation = 'envoye' where id = $1", [p[0].id]);
      await tx.expectError(
        () => tx.sql("update public.productions set statut_validation = 'a_relire' where id = $1", [p[0].id]),
        /ENVOI_IRREVERSIBLE/,
      );
      const row = await tx.sql<{ envoye_le: string | null; contenu_texte: string }>(
        'select envoye_le, contenu_texte from public.productions where id = $1',
        [p[0].id],
      );
      expect(row[0].envoye_le).not.toBeNull();
      expect(row[0].contenu_texte).toBe('Brouillon');
    });
  });

  it('tenant et consentements : type de tenant réservé au serveur, consentement non déplaçable', async () => {
    await withTx(async (tx) => {
      const f = await fixture(tx);
      await tx.as(f.a.id);
      await tx.expectError(
        () => tx.sql("update public.tenants set type = 'organisation' where id = $1", [f.a.tenantId]),
        /ABONNEMENT_SERVEUR_UNIQUEMENT/,
      );
      await tx.sql("update public.tenants set raison_sociale = 'Atelier A (renommé)' where id = $1", [f.a.tenantId]);
      const c = await tx.sql<{ id: string }>(
        "insert into public.consentements (tenant_id, user_id, finalite, base_legale) values ($1, $2, 'analyse_ia', 'contrat') returning id",
        [f.a.tenantId, f.a.id],
      );
      await tx.sql('update public.consentements set accorde = false, retire_le = now() where id = $1', [c[0].id]);
      await tx.expectError(
        () => tx.sql('update public.consentements set tenant_id = $2 where id = $1', [c[0].id, f.b.tenantId]),
        /row-level security/,
      );
    });
  });
});

describe('non-régression des flux existants (I11)', () => {
  it('un utilisateur sans profil peut encore créer un dossier (tenant personnel créé à la volée)', async () => {
    await withTx(async (tx) => {
      const u = await tx.createUser('sansprofil@test.invalid');
      await tx.sql('delete from public.profiles where id = $1', [u.id]);
      await tx.sql('delete from public.tenant_members where user_id = $1', [u.id]);
      await tx.as(u.id);
      const d = await tx.sql<{ tenant_id: string | null }>(
        "insert into public.dossiers (user_id, typology, title, status) values ($1, 'autre', 'Sans profil', 'transmis') returning tenant_id",
        [u.id],
      );
      expect(d[0].tenant_id).not.toBeNull();
      expect((await tx.sql('select id from public.dossiers')).length).toBe(1);
    });
  });

  it("l'inscription crée un profil ET un tenant personnel dont l'utilisateur est propriétaire", async () => {
    await withTx(async (tx) => {
      const u = await tx.createUser('nouveau@test.invalid', { full_name: 'N Test', company_name: 'SARL N' });
      const t = await tx.sql<{ type: string; raison_sociale: string; role: string }>(
        'select t.type, t.raison_sociale, m.role from public.tenants t join public.tenant_members m on m.tenant_id = t.id where m.user_id = $1',
        [u.id],
      );
      expect(t).toEqual([{ type: 'personnel', raison_sociale: 'SARL N', role: 'proprietaire' }]);
    });
  });
});
