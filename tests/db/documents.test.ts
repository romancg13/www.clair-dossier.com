/**
 * Étape 5 — critère de sortie : « doublon strict détecté sur le jeu d'essai ».
 *
 * Les pièces du dossier étalon (tests/fixtures/dossier-etalon, données fictives)
 * sont déposées comme le ferait le client (empreinte SHA-256 calculée à partir des
 * octets réels), puis la détection est comparée à verite-terrain.json. Vérifie
 * aussi l'immutabilité du stockage (I3) : pas de destruction d'original par le
 * client, suppression logique, bucket sans écrasement ni suppression d'original.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type Tx, withTx } from './harness';

const DIR = resolve(__dirname, '../fixtures/dossier-etalon');
type Piece = { fichier: string; role: string };
type VeriteTerrain = {
  doublons_stricts: { piece: string; original: string }[];
  quasi_doublons: { piece: string; original: string }[];
};
const manifest = JSON.parse(readFileSync(resolve(DIR, 'manifest.json'), 'utf8')) as { pieces: Piece[] };
const verite = JSON.parse(readFileSync(resolve(DIR, 'verite-terrain.json'), 'utf8')) as VeriteTerrain;
const hashOf = (fichier: string) => createHash('sha256').update(readFileSync(resolve(DIR, fichier))).digest('hex');
const sizeOf = (fichier: string) => readFileSync(resolve(DIR, fichier)).length;
const estUnePieceEtalon = (fichier: string) => existsSync(resolve(DIR, fichier));

type DocRow = { id: string; file_name: string; statut_ingestion: string; doublon_de_id: string | null };

async function dossierEtalon(tx: Tx) {
  const a = await tx.createUser('etalon@test.invalid', { full_name: 'A Étalon' });
  const b = await tx.createUser('autre@test.invalid', { full_name: 'B Autre' });
  const admin = await tx.createUser('admin-etalon@test.invalid', { full_name: 'Admin' });
  await tx.sql('insert into public.app_admins (user_id) values ($1)', [admin.id]);
  await tx.sql("insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing");
  await tx.as(a.id);
  const d = await tx.sql<{ id: string }>(
    `insert into public.dossiers (user_id, typology, title, status)
     values ($1, 'impaye-precontentieux', 'Impayé — Atelier Fictif SAS c/ Société Exemple SARL', 'transmis') returning id`,
    [a.id],
  );
  return { a, b, admin, dossierId: d[0].id };
}

/**
 * Dépose une pièce comme le client : chemin <user>/<dossier>/<nom>, empreinte et MIME
 * transmis. Pour un nom hors dossier étalon, l'empreinte est celle fournie (ou absente).
 */
async function deposer(
  tx: Tx,
  userId: string,
  dossierId: string,
  fichier: string,
  extra: { hash?: string | null; kind?: string } = {},
) {
  const etalon = estUnePieceEtalon(fichier);
  const hash = extra.hash !== undefined ? extra.hash : etalon ? hashOf(fichier) : null;
  const rows = await tx.sql<DocRow>(
    `insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, size_bytes, hash_sha256, mime, kind)
     values ($1::uuid, $2::uuid, $2::text || '/' || $1::text || '/' || $3::text, $3::text, $4::bigint, $5::text, 'application/pdf', $6::text)
     returning id, file_name, statut_ingestion, doublon_de_id`,
    [dossierId, userId, fichier, etalon ? sizeOf(fichier) : 10, hash, extra.kind ?? 'piece'],
  );
  return rows[0];
}

describe('empreinte et doublons stricts (pipeline 7.1, étape 2)', () => {
  it('détecte 100 % des doublons stricts du dossier étalon, et aucun faux positif', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      const parNom = new Map<string, DocRow>();
      for (const p of manifest.pieces) parNom.set(p.fichier, await deposer(tx, f.a.id, f.dossierId, p.fichier));
      const parId = new Map(Array.from(parNom.values()).map((r) => [r.id, r.file_name]));

      const detectes = Array.from(parNom.values())
        .filter((r) => r.statut_ingestion === 'doublon')
        .map((r) => ({ piece: r.file_name, original: parId.get(r.doublon_de_id ?? '') }))
        .sort((x, y) => x.piece.localeCompare(y.piece));
      const attendus = [...verite.doublons_stricts].sort((x, y) => x.piece.localeCompare(y.piece));
      expect(detectes).toEqual(attendus);

      // Le quasi-doublon (même texte, autre rendu) n'est pas un doublon strict.
      for (const q of verite.quasi_doublons) {
        expect(parNom.get(q.piece)?.statut_ingestion).toBe('recu');
        expect(parNom.get(q.piece)?.doublon_de_id).toBeNull();
      }
      // Les originaux restent des pièces à traiter.
      for (const p of manifest.pieces.filter((x) => x.role === 'original')) {
        expect(parNom.get(p.fichier)?.statut_ingestion, p.fichier).toBe('recu');
      }
      // Journal : une entrée par doublon, dans le tenant du client.
      await tx.asService();
      const journal = await tx.sql<{ n: string }>(
        "select count(*)::text as n from public.audit_log where action = 'document.doublon' and tenant_id = $1 and dossier_id = $2",
        [f.a.tenantId, f.dossierId],
      );
      expect(Number(journal[0].n)).toBe(verite.doublons_stricts.length);
    });
  });

  it('les copies pointent toutes l’original (pas de chaîne), un livrable n’est jamais un doublon, un autre dossier non plus', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      const original = await deposer(tx, f.a.id, f.dossierId, '01-facture-F-2026-0042.pdf');
      const copie1 = await deposer(tx, f.a.id, f.dossierId, '02-facture-F-2026-0042-copie.pdf');
      const copie2 = await deposer(tx, f.a.id, f.dossierId, 'copie-3.pdf', { hash: hashOf('01-facture-F-2026-0042.pdf') });
      expect(copie1.doublon_de_id).toBe(original.id);
      expect(copie2.doublon_de_id).toBe(original.id);

      await tx.as(f.admin.id);
      const livrable = await deposer(tx, f.a.id, f.dossierId, 'synthese.pdf', {
        hash: hashOf('01-facture-F-2026-0042.pdf'),
        kind: 'deliverable',
      });
      expect(livrable.statut_ingestion).toBe('recu');
      expect(livrable.doublon_de_id).toBeNull();

      await tx.as(f.a.id);
      const autre = await tx.sql<{ id: string }>(
        "insert into public.dossiers (user_id, typology, title, status) values ($1, 'autre', 'Autre dossier', 'transmis') returning id",
        [f.a.id],
      );
      const dansAutre = await deposer(tx, f.a.id, autre[0].id, '01-facture-F-2026-0042.pdf');
      expect(dansAutre.statut_ingestion).toBe('recu');
    });
  });

  it('une empreinte enregistrée par le serveur après coup (client sans WebCrypto) déclenche la détection, et la divergence est journalisée', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      const original = await deposer(tx, f.a.id, f.dossierId, '01-facture-F-2026-0042.pdf');
      const sansHash = await tx.sql<DocRow>(
        `insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, size_bytes)
         values ($1::uuid, $2::uuid, $2::text || '/' || $1::text || '/legacy.pdf', 'legacy.pdf', 10) returning id, file_name, statut_ingestion, doublon_de_id`,
        [f.dossierId, f.a.id],
      );
      expect(sansHash[0].statut_ingestion).toBe('recu');
      // Réservée au serveur.
      await tx.expectError(
        () => tx.sql('select public.enregistrer_empreinte($1, $2)', [sansHash[0].id, hashOf('01-facture-F-2026-0042.pdf')]),
        /permission denied|SERVEUR_UNIQUEMENT/,
      );
      await tx.asService();
      await tx.sql('select public.enregistrer_empreinte($1, $2, $3, $4, $5)', [
        sansHash[0].id,
        hashOf('01-facture-F-2026-0042.pdf'),
        'application/pdf',
        sizeOf('01-facture-F-2026-0042.pdf'),
        1,
      ]);
      const apres = await tx.sql<DocRow & { hash_verifie_le: string | null; pages: number }>(
        'select id, file_name, statut_ingestion, doublon_de_id, hash_verifie_le, pages from public.dossier_documents where id = $1',
        [sansHash[0].id],
      );
      expect(apres[0].statut_ingestion).toBe('doublon');
      expect(apres[0].doublon_de_id).toBe(original.id);
      expect(apres[0].hash_verifie_le).not.toBeNull();
      expect(apres[0].pages).toBe(1);

      // Empreinte client fausse : le serveur corrige et journalise la divergence.
      await tx.as(f.a.id);
      const menteur = await deposer(tx, f.a.id, f.dossierId, '04-bon-de-commande-BC-2025-118.pdf', { hash: 'f'.repeat(64) });
      expect(menteur.statut_ingestion).toBe('recu');
      await tx.asService();
      await tx.sql('select public.enregistrer_empreinte($1, $2)', [menteur.id, hashOf('04-bon-de-commande-BC-2025-118.pdf')]);
      const div = await tx.sql<{ n: string }>(
        "select count(*)::text as n from public.audit_log where action = 'document.empreinte_divergente' and objet_id = $1",
        [menteur.id],
      );
      expect(Number(div[0].n)).toBe(1);
      await tx.expectError(() => tx.sql('select public.enregistrer_empreinte($1, $2)', [menteur.id, 'XYZ']), /EMPREINTE_INVALIDE/);
    });
  });
});

describe('stockage immuable (pipeline 7.1, étape 3 ; I3)', () => {
  it('le client ne détruit pas un original : suppression logique seulement, irréversible, journalisée', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      const piece = await deposer(tx, f.a.id, f.dossierId, '01-facture-F-2026-0042.pdf');
      await tx.expectError(
        () => tx.sql('delete from public.dossier_documents where id = $1', [piece.id]),
        /PIECE_ORIGINALE_CONSERVEE/,
      );
      await tx.sql('update public.dossier_documents set supprime_le = now() where id = $1', [piece.id]);
      const apres = await tx.sql<{ supprime_par: string | null; supprime_le: string | null }>(
        'select supprime_par, supprime_le from public.dossier_documents where id = $1',
        [piece.id],
      );
      expect(apres[0].supprime_par).toBe(f.a.id);
      expect(apres[0].supprime_le).not.toBeNull();
      await tx.expectError(
        () => tx.sql('update public.dossier_documents set supprime_le = null where id = $1', [piece.id]),
        /SUPPRESSION_LOGIQUE_IRREVERSIBLE/,
      );
      await tx.expectError(
        () => tx.sql('update public.dossier_documents set supprime_par = $2 where id = $1', [piece.id, f.b.id]),
        /METADONNEES_PIECE_SERVEUR_UNIQUEMENT/,
      );
      // Une pièce retirée ne sert plus de référence : un nouveau dépôt identique n'est pas un doublon.
      const redepot = await deposer(tx, f.a.id, f.dossierId, '02-facture-F-2026-0042-copie.pdf');
      expect(redepot.statut_ingestion).toBe('recu');
      await tx.asService();
      const journal = await tx.sql<{ action: string }>(
        "select action from public.audit_log where objet_id = $1 and action in ('document.retire', 'document.supprime') order by id",
        [piece.id],
      );
      expect(journal.map((j) => j.action)).toEqual(['document.retire']);
      // L'original est toujours là (rôle de service, hors RLS).
      expect((await tx.sql('select 1 from public.dossier_documents where id = $1', [piece.id])).length).toBe(1);
    });
  });

  it('l’admin peut toujours supprimer un livrable (flux existant), jamais une pièce du client', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      const piece = await deposer(tx, f.a.id, f.dossierId, '01-facture-F-2026-0042.pdf');
      await tx.as(f.admin.id);
      const livrable = await deposer(tx, f.a.id, f.dossierId, 'deliverable-synthese.pdf', { kind: 'deliverable' });
      await tx.sql('delete from public.dossier_documents where id = $1', [livrable.id]);
      await tx.expectError(
        () => tx.sql('delete from public.dossier_documents where id = $1', [piece.id]),
        /PIECE_ORIGINALE_CONSERVEE/,
      );
    });
  });

  it('bucket « documents » : aucun écrasement possible, suppression réservée aux livrables', async () => {
    await withTx(async (tx) => {
      const f = await dossierEtalon(tx);
      const policies = await tx.sql<{ policyname: string; cmd: string }>(
        "select policyname, cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' and cmd in ('UPDATE', 'ALL')",
      );
      expect(policies).toEqual([]);

      const piece = await deposer(tx, f.a.id, f.dossierId, '01-facture-F-2026-0042.pdf');
      await tx.as(f.admin.id);
      const livrable = await deposer(tx, f.a.id, f.dossierId, 'deliverable-synthese.pdf', { kind: 'deliverable' });
      const chemins = await tx.sql<{ id: string; file_path: string }>(
        'select id, file_path from public.dossier_documents where id = any($1::uuid[])',
        [[piece.id, livrable.id]],
      );
      const chemin = (id: string) => chemins.find((c) => c.id === id)!.file_path;

      // Le client dépose ses deux objets (policy historique docs_storage_insert_own).
      await tx.as(f.a.id);
      for (const id of [piece.id, livrable.id]) {
        await tx.sql("insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)", [chemin(id), f.a.id]);
      }
      // Il ne peut pas retirer l'original du bucket…
      await tx.sql('delete from storage.objects where name = $1', [chemin(piece.id)]);
      await tx.asService();
      expect((await tx.sql('select 1 from storage.objects where name = $1', [chemin(piece.id)])).length).toBe(1);
      // … mais le livrable, oui (flux admin existant : l'admin supprime l'objet puis la ligne).
      await tx.as(f.admin.id);
      await tx.sql('delete from storage.objects where name = $1', [chemin(livrable.id)]);
      await tx.asService();
      expect((await tx.sql('select 1 from storage.objects where name = $1', [chemin(livrable.id)])).length).toBe(0);
    });
  });
});
