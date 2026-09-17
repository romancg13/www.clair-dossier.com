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

/* ── Automatisation (migration 20260917120000) ──────────────────────────── */

/** Moteur de droits / notifications administrateur disponible ? */
export function hasAutomationEngine(): Promise<boolean> {
  return probe('automation-engine', async () => {
    const { error } = await (await client()).from('admin_notifications').select('id').limit(1);
    return !error;
  });
}

export type AdminEntitlementRow = {
  user_id: string;
  email: string | null;
  suspended_at: string | null;
  plan_id: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  plan_limit: number | null;
  override_mode: 'unlimited' | 'custom_limit' | 'bonus' | null;
  override_limit: number | null;
  override_reason: string | null;
  applies: boolean;
  unlimited: boolean;
  effective_limit: number | null;
  used: number;
  period_end: string | null;
};

export async function fetchAdminEntitlements(): Promise<AdminEntitlementRow[] | null> {
  try {
    if (!(await hasAutomationEngine())) return null;
    const { data, error } = await (await client()).rpc('admin_list_entitlements');
    return error ? null : ((data as AdminEntitlementRow[] | null) ?? []);
  } catch {
    return null;
  }
}

/**
 * Authentification RÉCENTE avant une action irréversible : le facteur TOTP
 * doit avoir été vérifié dans les `maxAgeMinutes` dernières minutes, sinon un
 * nouveau code est demandé. La base exige en plus une session AAL2.
 */
export async function requireRecentMfa(maxAgeMinutes = 10): Promise<boolean> {
  const sb = await client();
  const { data: aal } = await sb.auth.mfa.getAuthenticatorAssuranceLevel();
  const methods = (aal?.currentAuthenticationMethods ?? []) as Array<string | { method: string; timestamp: number }>;
  const totp = methods.find((m): m is { method: string; timestamp: number } => typeof m === 'object' && m.method === 'totp');
  if (aal?.currentLevel === 'aal2' && totp && Date.now() / 1000 - totp.timestamp < maxAgeMinutes * 60) {
    return true;
  }
  const { data: factors } = await sb.auth.mfa.listFactors();
  const factor = factors?.totp.find((f) => f.status === 'verified');
  if (!factor) return false;
  const code = window.prompt('Action sensible : saisissez un nouveau code à 6 chiffres de votre application d’authentification.');
  if (!code || !/^[0-9]{6}$/.test(code.trim())) return false;
  const { data: challenge, error: cErr } = await sb.auth.mfa.challenge({ factorId: factor.id });
  if (cErr || !challenge) return false;
  const { error: vErr } = await sb.auth.mfa.verify({ factorId: factor.id, challengeId: challenge.id, code: code.trim() });
  return !vErr;
}

/** Appel d'une fonction serveur d'administration (jeton de session joint). */
export async function invokeAdminFunction(
  name: 'admin-users' | 'notify-lead',
  body: Record<string, unknown>,
): Promise<{ ok: boolean; error: string | null }> {
  try {
    const { data, error } = await (await client()).functions.invoke(name, { body });
    if (error) return { ok: false, error: error.message };
    return { ok: true, error: (data as { error?: string } | null)?.error ?? null };
  } catch {
    return { ok: false, error: 'network' };
  }
}
