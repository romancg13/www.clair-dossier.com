// Edge Function: admin-users — suspension / réactivation d'un compte client.
//
// Suspendre un compte exige l'API d'administration de Supabase Auth (clé de
// service) : impossible et interdit depuis le navigateur. La fonction vérifie :
//   1. le jeton de l'appelant (signature validée par Supabase Auth) ;
//   2. le rôle super_admin (table app_admins, lue côté serveur) ;
//   3. une session AAL2 (MFA vérifié) ;
//   4. un motif ; jamais sur soi-même ni sur un autre administrateur.
// Les données du client sont CONSERVÉES ; seul l'accès est bloqué.
// Chaque action est journalisée dans audit_logs.
//
// Secrets injectés par la plateforme : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE = 'https://www.clair-dossier.com';
const ALLOWED_ORIGINS = new Set([
  'https://www.clair-dossier.com',
  'https://clair-dossier.com',
  'http://localhost:5173',
  'http://localhost:4173',
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function reply(status: number, body: unknown, origin: string | null): Response {
  return new Response(JSON.stringify(body), { status, headers: cors(origin) });
}

/** Lit la revendication `aal` d'un jeton DÉJÀ validé par auth.getUser. */
function aalOf(token: string): string | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.aal === 'string' ? payload.aal : null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' }, origin);
  if (!SUPABASE_URL || !SERVICE_ROLE) return reply(500, { error: 'not_configured' }, origin);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const { data: caller } = await admin.auth.getUser(token);
  const callerId = caller?.user?.id;
  if (!callerId) return reply(401, { error: 'unauthorized' }, origin);

  const { data: role } = await admin.from('app_admins').select('role').eq('user_id', callerId).maybeSingle();
  if ((role as { role?: string } | null)?.role !== 'super_admin') return reply(403, { error: 'forbidden' }, origin);
  if (aalOf(token) !== 'aal2') return reply(403, { error: 'mfa_required' }, origin);

  let body: { action?: string; user_id?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return reply(400, { error: 'invalid_request' }, origin);
  }
  const target = body.user_id ?? '';
  const reason = (body.reason ?? '').trim();
  if (!UUID.test(target)) return reply(400, { error: 'invalid_user' }, origin);
  if (target === callerId) return reply(400, { error: 'cannot_target_self' }, origin);
  const { data: targetIsAdmin } = await admin.from('app_admins').select('user_id').eq('user_id', target).maybeSingle();
  if (targetIsAdmin) return reply(400, { error: 'cannot_target_admin' }, origin);

  if (body.action === 'suspend') {
    if (!reason) return reply(400, { error: 'reason_required' }, origin);
    const { error } = await admin.auth.admin.updateUserById(target, { ban_duration: '876000h' });
    if (error) return reply(502, { error: 'auth_update_failed' }, origin);
    await admin.from('profiles').update({ suspended_at: new Date().toISOString(), suspension_reason: reason }).eq('id', target);
  } else if (body.action === 'reactivate') {
    const { error } = await admin.auth.admin.updateUserById(target, { ban_duration: 'none' });
    if (error) return reply(502, { error: 'auth_update_failed' }, origin);
    await admin.from('profiles').update({ suspended_at: null, suspension_reason: null }).eq('id', target);
  } else {
    return reply(400, { error: 'invalid_action' }, origin);
  }

  await admin.from('audit_logs').insert({
    actor_id: callerId,
    actor_role: 'super_admin',
    action: body.action === 'suspend' ? 'compte_suspendu' : 'compte_reactive',
    resource_type: 'utilisateur',
    resource_id: target,
    target_user_id: target,
    metadata: reason ? { motif: reason } : {},
  });

  return reply(200, { ok: true, action: body.action }, origin);
});
