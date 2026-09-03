/**
 * Harnais des tests de base de données.
 *
 * Chaque test s'exécute dans UNE transaction annulée à la fin (rollback) : aucune
 * donnée ne persiste, aucune donnée réelle n'est jamais utilisée (interdit n° 15).
 * Les contraintes différées (ancrage des sources) sont vérifiées à la demande via
 * `set constraints all immediate`.
 */
import { Client } from 'pg';

export const PG = {
  host: process.env.PGHOST ?? '/tmp/clair-pg',
  port: Number(process.env.PGPORT ?? 54329),
  user: process.env.PGUSER ?? 'postgres',
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE ?? 'clair_test',
};

export type Tx = {
  /** Requête exécutée avec le rôle courant (par défaut : postgres, hors RLS). */
  sql: <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<T[]>;
  /** Passe sous le rôle `authenticated` avec l'identité `userId` (auth.uid()). */
  as: (userId: string | null) => Promise<void>;
  /** Revient au rôle de service (postgres) : fixtures, assertions hors RLS. */
  asService: () => Promise<void>;
  /** Force la vérification des contraintes différées maintenant. */
  checkDeferred: () => Promise<void>;
  /** Point de sauvegarde pour tester un échec attendu sans casser la transaction. */
  expectError: (fn: () => Promise<unknown>, pattern: RegExp) => Promise<void>;
  /** Crée un utilisateur (auth.users → trigger profil → trigger tenant). */
  createUser: (email: string, meta?: Record<string, unknown>) => Promise<{ id: string; tenantId: string }>;
};

export async function withTx(fn: (tx: Tx) => Promise<void>): Promise<void> {
  const client = new Client(PG);
  await client.connect();
  let savepoint = 0;
  try {
    await client.query('begin');
    // Comme sur Supabase, le schéma `extensions` (pgvector) est dans le search_path.
    await client.query('set local search_path = public, extensions');
    const tx: Tx = {
      sql: async (text, params) => (await client.query(text, params as never)).rows,
      as: async (userId) => {
        await client.query('reset role');
        await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? '']);
        await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
        await client.query('set local role authenticated');
      },
      asService: async () => {
        await client.query('reset role');
        await client.query("select set_config('request.jwt.claim.sub', '', true)");
        await client.query("select set_config('request.jwt.claim.role', '', true)");
      },
      checkDeferred: async () => {
        await client.query('set constraints all immediate');
        await client.query('set constraints all deferred');
      },
      expectError: async (op, pattern) => {
        const name = `sp_${++savepoint}`;
        await client.query(`savepoint ${name}`);
        let message = '';
        try {
          await op();
          // Les contraintes différées ne lèvent qu'à la sortie : on force ici.
          await client.query('set constraints all immediate');
          await client.query('set constraints all deferred');
        } catch (e) {
          message = e instanceof Error ? e.message : String(e);
        }
        await client.query(`rollback to savepoint ${name}`);
        if (!message) {
          throw new Error(`Une erreur correspondant à ${pattern} était attendue, aucune erreur levée`);
        }
        if (!pattern.test(message)) {
          throw new Error(`Erreur inattendue : ${message} (attendu : ${pattern})`);
        }
      },
      createUser: async (email, meta = {}) => {
        await client.query('reset role');
        const rows = (
          await client.query(
            'insert into auth.users (email, raw_user_meta_data) values ($1, $2::jsonb) returning id',
            [email, JSON.stringify(meta)],
          )
        ).rows as { id: string }[];
        const id = rows[0].id;
        const t = (await client.query('select public.personal_tenant_id($1) as tenant_id', [id])).rows as {
          tenant_id: string | null;
        }[];
        if (!t[0].tenant_id) throw new Error(`Aucun tenant personnel créé pour ${email}`);
        return { id, tenantId: t[0].tenant_id };
      },
    };
    await fn(tx);
  } finally {
    try {
      await client.query('rollback');
    } finally {
      await client.end();
    }
  }
}

/** UUID v4 fictif, stable pour les tests (aucune donnée réelle). */
export function fakeUuid(n: number): string {
  const hex = n.toString(16).padStart(12, '0');
  return `00000000-0000-4000-8000-${hex}`;
}
