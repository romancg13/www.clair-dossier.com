/**
 * Étape 3 — critère de sortie : « migrations appliquées, schéma vérifié ».
 * Vérifie par exécution que le socle IA (PARTIE 7.2) existe et que la dernière
 * migration est rejouable sans erreur.
 */
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTx } from './harness';

const TABLES_CIBLES = [
  'tenants',
  'tenant_members',
  'dossiers',
  'dossier_documents',
  'document_chunks',
  'entites',
  'entite_sources',
  'evenements',
  'evenement_sources',
  'echeances',
  'echeance_sources',
  'contradictions',
  'pieces_manquantes',
  'piece_manquante_sources',
  'productions',
  'agent_runs',
  'audit_log',
  'consentements',
];

describe('schéma du socle IA (PARTIE 7.2)', () => {
  it('contient toutes les tables cibles', async () => {
    await withTx(async (tx) => {
      const rows = await tx.sql<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
      );
      const names = rows.map((r) => r.table_name);
      for (const t of TABLES_CIBLES) expect(names, `table ${t}`).toContain(t);
      // Les tables historiques restent présentes (I11).
      for (const t of ['profiles', 'app_admins']) expect(names).toContain(t);
    });
  });

  it('a pgvector installé dans le schéma extensions', async () => {
    await withTx(async (tx) => {
      const rows = await tx.sql<{ extname: string; nspname: string }>(
        'select e.extname, n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace',
      );
      expect(rows.find((r) => r.extname === 'vector')?.nspname).toBe('extensions');
    });
  });

  it('étend dossier_documents avec les colonnes de versionnage et d’ingestion (I3)', async () => {
    await withTx(async (tx) => {
      const rows = await tx.sql<{ column_name: string }>(
        "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'dossier_documents'",
      );
      const cols = rows.map((r) => r.column_name);
      for (const c of [
        'tenant_id',
        'nom_normalise',
        'hash_sha256',
        'mime',
        'pages',
        'score_ocr',
        'categorie',
        'confiance_classification',
        'version',
        'parent_version_id',
        'statut_ingestion',
      ]) {
        expect(cols, `colonne ${c}`).toContain(c);
      }
      // Les colonnes historiques sont intactes.
      for (const c of ['file_path', 'file_name', 'size_bytes', 'kind', 'user_id']) expect(cols).toContain(c);
    });
  });

  it('active la RLS sur chaque nouvelle table et y attache des policies', async () => {
    await withTx(async (tx) => {
      const rls = await tx.sql<{ relname: string; relrowsecurity: boolean }>(
        "select c.relname, c.relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'public' and c.relkind = 'r'",
      );
      for (const t of TABLES_CIBLES) {
        expect(rls.find((r) => r.relname === t)?.relrowsecurity, `RLS ${t}`).toBe(true);
      }
      const pol = await tx.sql<{ tablename: string; n: string }>(
        "select tablename, count(*)::text as n from pg_policies where schemaname = 'public' group by tablename",
      );
      for (const t of TABLES_CIBLES) {
        expect(Number(pol.find((p) => p.tablename === t)?.n ?? 0), `policies ${t}`).toBeGreaterThan(0);
      }
    });
  });

  it('expose les fonctions de cloisonnement et de journalisation', async () => {
    await withTx(async (tx) => {
      const rows = await tx.sql<{ proname: string }>(
        "select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'",
      );
      const fns = rows.map((r) => r.proname);
      for (const f of [
        'is_admin',
        'is_tenant_member',
        'tenant_role',
        'can_write_tenant',
        'can_admin_tenant',
        'personal_tenant_id',
        'ensure_personal_tenant',
        'set_tenant_from_dossier',
        'verifier_ancrage',
        'verifier_ancrage_restant',
        'journaliser',
        'audit_log_immuable',
        'proteger_correction_humaine',
        'productions_validation_humaine',
        'plan_actuel',
        'est_appel_client',
        'tenant_members_garde',
        'dossiers_proteger_colonnes',
        'dossier_documents_proteger_metadonnees',
      ]) {
        expect(fns, `fonction ${f}`).toContain(f);
      }
    });
  });

  it('ne laisse aucune séquence du schéma public manipulable par les rôles clients', async () => {
    await withTx(async (tx) => {
      const rows = await tx.sql<{ seq: string; anon: boolean; authenticated: boolean }>(
        `select c.oid::regclass::text as seq,
                has_sequence_privilege('anon', c.oid, 'UPDATE') as anon,
                has_sequence_privilege('authenticated', c.oid, 'UPDATE') as authenticated
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'S'`,
      );
      expect(rows.length).toBeGreaterThan(0);
      for (const r of rows) {
        expect(r.anon, `anon sur ${r.seq}`).toBe(false);
        expect(r.authenticated, `authenticated sur ${r.seq}`).toBe(false);
      }
    });
  });

  it('n’expose aucune policy d’insertion client sur les tables de preuves et d’analyses', async () => {
    await withTx(async (tx) => {
      const rows = await tx.sql<{ tablename: string; cmd: string }>(
        "select tablename, cmd from pg_policies where schemaname = 'public' and cmd in ('INSERT', 'ALL')",
      );
      for (const t of [
        'document_chunks',
        'entites',
        'entite_sources',
        'evenements',
        'evenement_sources',
        'echeances',
        'echeance_sources',
        'contradictions',
        'pieces_manquantes',
        'piece_manquante_sources',
        'productions',
        'agent_runs',
        'audit_log',
      ]) {
        expect(rows.filter((r) => r.tablename === t), `insertion client sur ${t}`).toEqual([]);
      }
    });
  });

  it('est rejouable : ré-appliquer les migrations CLAIR-IA ne produit aucune erreur', () => {
    const script = resolve(__dirname, 'apply-migrations.sh');
    // Deux passages successifs : la migration doit être idempotente.
    for (let i = 0; i < 2; i++) {
      const out = execFileSync('bash', [script, '--replay'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      expect(out).toMatch(/applied\s+20260903090000_clair_ia_socle\.sql/);
      expect(out).toMatch(/skipped\s+20260615201942_clair_dossier_init\.sql/);
    }
  });
});
