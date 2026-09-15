/**
 * Console d'administration — helpers.
 *
 * Sécurité : l'interface n'est qu'une COMMODITÉ. Chaque lecture/écriture passe
 * par le client Supabase et n'aboutit que si la RLS côté base l'autorise
 * (is_admin() / is_super_admin(), SECURITY DEFINER — voir migrations
 * 20260621144123 et 20260915150000). Aucun privilège ne dépend du frontend.
 *
 * Rétrocompatibilité : chaque capacité (rôle super_admin, journal d'audit,
 * corbeille des dossiers, notes internes) est détectée à l'exécution ; la
 * console se replie proprement tant que la migration n'est pas appliquée.
 */

async function client() {
  const { supabase } = await import('./supabase');
  return supabase;
}

const cache: Record<string, Promise<boolean>> = {};
function probe(key: string, run: () => Promise<boolean>): Promise<boolean> {
  if (!(key in cache)) cache[key] = run().catch(() => false);
  return cache[key];
}

/** L'appelant est-il super_admin (RPC dédiée) ? Retombe sur is_admin() si la
 *  migration n'est pas appliquée (l'admin global historique = super admin). */
export function checkSuperAdmin(): Promise<boolean> {
  return probe('super-admin', async () => {
    const sb = await client();
    const { data, error } = await sb.rpc('is_super_admin');
    if (!error) return data === true;
    const { data: legacy } = await sb.rpc('is_admin');
    return legacy === true;
  });
}

export function hasAuditLogs(): Promise<boolean> {
  return probe('audit-logs', async () => {
    const { error } = await (await client()).from('audit_logs').select('id').limit(1);
    return !error;
  });
}

export function hasAdminNotes(): Promise<boolean> {
  return probe('admin-notes', async () => {
    const { error } = await (await client()).from('admin_notes').select('id').limit(1);
    return !error;
  });
}

export function hasDossierTrash(): Promise<boolean> {
  return probe('dossier-trash', async () => {
    const { error } = await (await client()).from('dossiers').select('id,deleted_at').limit(1);
    return !error;
  });
}

/** Journal d'audit — meilleur effort, jamais bloquant, jamais de contenu confidentiel. */
export async function logAudit(
  action: string,
  resourceType: string,
  resourceId?: string | null,
  targetUserId?: string | null,
  metadata?: Record<string, string>,
): Promise<void> {
  try {
    if (!(await hasAuditLogs())) return;
    const sb = await client();
    const { data } = await sb.auth.getUser();
    const actor = data.user?.id;
    if (!actor) return;
    await sb.from('audit_logs').insert({
      actor_id: actor,
      action,
      resource_type: resourceType,
      resource_id: resourceId ?? null,
      target_user_id: targetUserId ?? null,
      metadata: metadata ?? {},
    });
  } catch {
    /* jamais bloquant */
  }
}

/** Confirmation forte pour l'irréversible : l'admin tape SUPPRIMER. */
export function confirmIrreversible(what: string): boolean {
  const typed = window.prompt(
    `${what}\n\nCette action est IRRÉVERSIBLE. Tapez SUPPRIMER pour confirmer :`,
  );
  return typed?.trim().toUpperCase() === 'SUPPRIMER';
}
