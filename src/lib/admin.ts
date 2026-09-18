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

/* ── Suppression directe depuis « Vos dossiers » (vue admin, chantier 13) ──
 * Même mécanisme que la console : mise à la CORBEILLE (soft delete) par
 * UPDATE de deleted_at, que la base réserve au super admin en AAL2
 * (dossiers_guard, migration 20260918100000). Rien n'est purgé : pièces,
 * échéances, registre de quota et restauration (console) sont conservés.
 * Les fonctions pures ci-dessous sont testées (tests/admin-delete.test.ts). */

/** Réponse de la sonde serveur super_admin_aal2() pour l'appelant courant. */
export type ServerTrashCheck = 'oui' | 'non' | 'absente' | 'inconnue';

export type TrashRights = {
  /** is_admin() — relu à chaque chargement. */
  isAdmin: boolean;
  /** is_super_admin() (repli is_admin() si la migration manque) ; null = inconnu. */
  superAdmin: boolean | null;
  /** Session vérifiée côté navigateur (niveau AAL2 du jeton). */
  aal2: boolean;
  /** Colonne deleted_at présente (sonde hasDossierTrash). */
  trashColumn: boolean;
  /** Confirmation serveur : super admin ET AAL2 d'après le jeton reçu par la base. */
  server: ServerTrashCheck;
};

export type TrashMenuState =
  | { kind: 'hidden' }
  | { kind: 'disabled'; reason: string }
  | { kind: 'enabled' };

export const TRASH_REASONS = {
  support: 'Réservé au super administrateur.',
  migration: 'Corbeille indisponible : migration à appliquer.',
  mfa: "Vérification en deux étapes requise : ouvrez la console d'administration.",
  network: 'Droits non vérifiables (réseau) : actualisez la page.',
  unconfirmed: 'Droits non confirmés par le serveur : reconnectez-vous à la console.',
} as const;

/**
 * Menu « … » d'une carte dossier : masqué pour un client ; pour un admin,
 * actif UNIQUEMENT si super admin + session AAL2 + corbeille disponible +
 * confirmation serveur, sinon désactivé avec la raison lisible.
 */
export function trashMenuState(r: TrashRights): TrashMenuState {
  if (!r.isAdmin) return { kind: 'hidden' };
  // Réseau d'abord : une sonde en échec ne doit pas afficher une fausse raison.
  if (r.server === 'inconnue') return { kind: 'disabled', reason: TRASH_REASONS.network };
  if (r.superAdmin === false) return { kind: 'disabled', reason: TRASH_REASONS.support };
  if (!r.trashColumn || r.server === 'absente') return { kind: 'disabled', reason: TRASH_REASONS.migration };
  if (!r.aal2) return { kind: 'disabled', reason: TRASH_REASONS.mfa };
  if (r.server !== 'oui' || r.superAdmin !== true) return { kind: 'disabled', reason: TRASH_REASONS.unconfirmed };
  return { kind: 'enabled' };
}

/** Fonction RPC absente du schéma (migration non appliquée) ? */
export function isMissingFunction(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'PGRST202' || error.code === '42883') return true;
  return /could not find the function|function .* does not exist/i.test(error.message ?? '');
}

/**
 * Sonde serveur NON mise en cache : la session peut passer d'AAL1 à AAL2
 * (console) sans rechargement. Ne renvoie qu'un booléen pour l'appelant.
 */
export async function checkSuperAdminAal2(): Promise<ServerTrashCheck> {
  try {
    const { data, error } = await (await client()).rpc('super_admin_aal2');
    if (!error) return data === true ? 'oui' : 'non';
    return isMissingFunction(error) ? 'absente' : 'inconnue';
  } catch {
    return 'inconnue';
  }
}

export type OwnerIdentity = {
  /** Libellé principal : structure, sinon nom, sinon e-mail, sinon identifiant tronqué. */
  label: string;
  /** Précision secondaire (nom et/ou e-mail) ; null si rien de plus à montrer. */
  detail: string | null;
  source: 'profil' | 'email' | 'identifiant';
};

export function shortUserId(id: string): string {
  return `${id.slice(0, 8)}…`;
}

/** Propriétaire d'un dossier pour la confirmation : jamais l'UUID complet. */
export function ownerIdentity(o: {
  companyName?: string | null;
  fullName?: string | null;
  email?: string | null;
  userId: string;
}): OwnerIdentity {
  const clean = (v?: string | null) => (v ?? '').trim() || null;
  const company = clean(o.companyName);
  const name = clean(o.fullName);
  const email = clean(o.email);
  if (company || name) {
    const extra = [company && name && name !== company ? name : null, email].filter(Boolean).join(' · ');
    return { label: (company ?? name) as string, detail: extra || null, source: 'profil' };
  }
  if (email) return { label: email, detail: null, source: 'email' };
  return { label: `Compte ${shortUserId(o.userId)}`, detail: null, source: 'identifiant' };
}

export type TrashOutcome = { ok: true; deletedAt: string } | { ok: false; error: string };

export const TRASH_ERRORS = {
  refused:
    "Mise à la corbeille refusée par le serveur : rien n'a été modifié. Votre session vérifiée a peut-être expiré — reconnectez-vous à la console puis réessayez.",
  network: "Le serveur n'a pas répondu : rien n'a été confirmé. Vérifiez votre connexion puis réessayez.",
  notPersisted: "La base n'a pas confirmé la mise à la corbeille : le dossier reste en place. Actualisez la page.",
} as const;

function isNetworkError(error: unknown): boolean {
  const m = String((error as { message?: string } | null)?.message ?? error ?? '');
  return /failed to fetch|network|load failed|timeout|abort/i.test(m);
}

/**
 * Écriture puis relecture serveur. Succès UNIQUEMENT si la réponse
 * d'écriture porte un deleted_at renseigné (un refus RLS renvoie 0 ligne
 * sans erreur ; le déclencheur remet deleted_at à null hors super admin
 * AAL2) et si une relecture distincte ne le contredit pas.
 */
export async function trashWithServerCheck(api: {
  update: () => Promise<{ rows: { deleted_at: string | null }[] | null; error: unknown }>;
  reread: () => Promise<{ row: { deleted_at: string | null } | null; error: unknown }>;
}): Promise<TrashOutcome> {
  let res: Awaited<ReturnType<typeof api.update>>;
  try {
    res = await api.update();
  } catch (e) {
    return { ok: false, error: isNetworkError(e) ? TRASH_ERRORS.network : TRASH_ERRORS.refused };
  }
  const written = res.rows?.[0]?.deleted_at ?? null;
  if (res.error || !written) {
    return { ok: false, error: res.error && isNetworkError(res.error) ? TRASH_ERRORS.network : TRASH_ERRORS.refused };
  }
  try {
    const check = await api.reread();
    if (!check.error && check.row && !check.row.deleted_at) {
      return { ok: false, error: TRASH_ERRORS.notPersisted };
    }
  } catch {
    /* relecture impossible : la réponse d'écriture (post-commit) fait foi */
  }
  return { ok: true, deletedAt: written };
}

/** La carte n'est retirée QU'APRÈS confirmation serveur. */
export async function trashThenRemove(
  perform: () => Promise<TrashOutcome>,
  remove: () => void,
): Promise<TrashOutcome> {
  const outcome = await perform();
  if (outcome.ok) remove();
  return outcome;
}

/** Anti double-clic : un seul appel en vol, les suivants sont ignorés (null). */
export function createSingleFlight() {
  let running = false;
  return async function run<T>(fn: () => Promise<T>): Promise<T | null> {
    if (running) return null;
    running = true;
    try {
      return await fn();
    } finally {
      running = false;
    }
  };
}

/**
 * Journal sans doublon : si la base journalise déjà l'action (déclencheur de
 * la migration 20260918120000, metadata.source = 'base'), rien n'est ajouté ;
 * sinon, repli sur le journal navigateur (meilleur effort, jamais bloquant).
 */
export async function logAuditUnlessServer(
  action: string,
  resourceType: string,
  resourceId: string,
  targetUserId?: string | null,
  metadata?: Record<string, string>,
): Promise<void> {
  try {
    if (await hasAuditLogs()) {
      const { data, error } = await (await client())
        .from('audit_logs')
        .select('id')
        .eq('action', action)
        .eq('resource_id', resourceId)
        .contains('metadata', { source: 'base' })
        .limit(1);
      if (!error && (data?.length ?? 0) > 0) return;
    }
  } catch {
    /* repli navigateur ci-dessous */
  }
  await logAudit(action, resourceType, resourceId, targetUserId, metadata);
}

/** Mise à la corbeille d'un dossier — même appel que la console (/admin). */
export async function trashDossierAsSuperAdmin(input: {
  id: string;
  userId: string;
  actorId: string | null;
  reason: string;
}): Promise<TrashOutcome> {
  const sb = await client();
  const outcome = await trashWithServerCheck({
    update: async () => {
      const { data, error } = await sb
        .from('dossiers')
        .update({ deleted_at: new Date().toISOString(), deleted_by: input.actorId, delete_reason: input.reason || null })
        .eq('id', input.id)
        .select('id,deleted_at');
      return { rows: data as { deleted_at: string | null }[] | null, error };
    },
    reread: async () => {
      const { data, error } = await sb.from('dossiers').select('id,deleted_at').eq('id', input.id).maybeSingle();
      return { row: data as { deleted_at: string | null } | null, error };
    },
  });
  if (outcome.ok) {
    void logAuditUnlessServer('dossier_corbeille', 'dossier', input.id, input.userId, {
      motif: input.reason,
      origine: 'vue-compte',
    });
  }
  return outcome;
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
