// Edge Function: notify-lead
//
// 1. Nouveau compte (trigger `on_new_profile_notify`) : e-mail à l'équipe —
//    comportement historique inchangé.
// 2. Dossier VALIDÉ (trigger `dossiers_after_submit`, migration
//    20260917120000) : notification administrateur e-mail + SMS, idempotente
//    (une ligne `admin_notifications` par dossier, statut par canal).
// 3. Relance depuis /admin (`retry: true`) : réservée à un administrateur
//    authentifié, 5 tentatives au plus.
//
// Minimisation : ni titre, ni contenu, ni pièce, ni lien de stockage — le nom
// du client et un lien vers l'espace administrateur authentifié uniquement.
// L'échec d'un envoi n'a AUCUN effet sur le dossier, déjà enregistré.
//
// Configuration serveur (jamais dans le frontend) :
//   RESEND_API_KEY                     — e-mail (déjà en place)
//   ADMIN_NOTIFICATION_EMAIL           — destinataire (repli : adresse historique)
//   ADMIN_NOTIFICATION_PHONE           — destinataire SMS (format +33…)
//   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER — SMS
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY — injectés par la plateforme

import { createClient } from 'npm:@supabase/supabase-js@2';
import { adminNotificationText } from '../_shared/stripe-sync.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = 'ClairDossier <noreply@clair-dossier.com>';
const TO = Deno.env.get('ADMIN_NOTIFICATION_EMAIL') || 'prestige.seller@icloud.com';
const ADMIN_PHONE = Deno.env.get('ADMIN_NOTIFICATION_PHONE') ?? '';
const TWILIO_SID = Deno.env.get('TWILIO_ACCOUNT_SID') ?? '';
const TWILIO_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN') ?? '';
const TWILIO_FROM = Deno.env.get('TWILIO_FROM_NUMBER') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SITE = 'https://www.clair-dossier.com';
const MAX_RETRIES = 5;

const ALLOWED_ORIGINS = new Set([
  'https://www.clair-dossier.com',
  'https://clair-dossier.com',
  'http://localhost:5173',
  'http://localhost:4173',
]);

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

async function sendEmail(subject: string, text: string, link: string): Promise<'sent' | 'failed' | 'not_configured'> {
  if (!RESEND_API_KEY) return 'not_configured';
  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0d1b3d">
    <h2 style="font-size:18px;margin:0 0 12px">${subject}</h2>
    <p style="margin:4px 0">${text}</p>
    <p style="margin:16px 0 4px"><a href="${link}" style="color:#0d1b3d;font-weight:600">Ouvrir l’espace administrateur →</a></p>
    <p style="margin-top:16px;font-size:12px;color:#64748b">Notification automatique — ClairDossier. Aucune donnée sensible n’est incluse dans cet e-mail.</p>
  </div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [TO], subject, html, text: `${text}\n${link}` }),
  });
  return res.ok ? 'sent' : 'failed';
}

async function sendSms(text: string): Promise<'sent' | 'failed' | 'not_configured'> {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM || !ADMIN_PHONE) return 'not_configured';
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOKEN}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ From: TWILIO_FROM, To: ADMIN_PHONE, Body: text }),
  });
  return res.ok ? 'sent' : 'failed';
}

/** Notification d'un dossier validé — idempotente, statut enregistré par canal. */
async function notifyDossier(notificationId: string, retry: boolean, authHeader: string | null, origin: string | null) {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  if (retry) {
    // Relance manuelle : administrateur authentifié uniquement.
    const token = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
    const { data: caller } = await admin.auth.getUser(token);
    const callerId = caller?.user?.id;
    if (!callerId) return reply(401, { error: 'unauthorized' }, origin);
    const { data: isAdmin } = await admin.from('app_admins').select('user_id').eq('user_id', callerId).maybeSingle();
    if (!isAdmin) return reply(403, { error: 'forbidden' }, origin);

    const { data: current } = await admin
      .from('admin_notifications')
      .select('retry_count,email_status,sms_status')
      .eq('id', notificationId)
      .maybeSingle();
    const row = current as { retry_count: number; email_status: string; sms_status: string } | null;
    if (!row) return reply(404, { error: 'not_found' }, origin);
    if (row.retry_count >= MAX_RETRIES) return reply(429, { error: 'too_many_retries' }, origin);
    await admin
      .from('admin_notifications')
      .update({
        retry_count: row.retry_count + 1,
        email_status: row.email_status === 'sent' ? 'sent' : 'pending',
        sms_status: row.sms_status === 'sent' ? 'sent' : 'pending',
      })
      .eq('id', notificationId);
  }

  // Appel automatique : seules les notifications récentes et en attente sont
  // traitées (un rejeu du même appel ne renvoie rien).
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data: claimedEmail } = await admin
    .from('admin_notifications')
    .update({ email_status: 'sending', last_attempt_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('email_status', 'pending')
    .gte('created_at', retry ? '1970-01-01' : since)
    .select('id,user_id');
  const { data: claimedSms } = await admin
    .from('admin_notifications')
    .update({ sms_status: 'sending', last_attempt_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('sms_status', 'pending')
    .gte('created_at', retry ? '1970-01-01' : since)
    .select('id,user_id');

  const claimed = (claimedEmail?.[0] ?? claimedSms?.[0]) as { user_id: string | null } | undefined;
  if (!claimed) return reply(200, { skipped: true }, origin);

  let name: string | null = null;
  if (claimed.user_id) {
    const { data: profile } = await admin
      .from('profiles')
      .select('first_name,last_name,full_name')
      .eq('id', claimed.user_id)
      .maybeSingle();
    const p = profile as { first_name: string | null; last_name: string | null; full_name: string | null } | null;
    name = [p?.first_name, p?.last_name].filter(Boolean).join(' ') || p?.full_name || null;
  }
  const text = adminNotificationText(name);
  const link = `${SITE}/admin`;

  const result: Record<string, string> = {};
  const errors: string[] = [];
  if (claimedEmail?.length) {
    try {
      result.email_status = await sendEmail('ClairDossier — nouveau dossier', text, link);
    } catch {
      result.email_status = 'failed';
    }
    if (result.email_status === 'failed') errors.push('e-mail : envoi refusé par le prestataire');
  }
  if (claimedSms?.length) {
    try {
      result.sms_status = await sendSms(text);
    } catch {
      result.sms_status = 'failed';
    }
    if (result.sms_status === 'failed') errors.push('SMS : envoi refusé par le prestataire');
  }
  await admin
    .from('admin_notifications')
    .update({ ...result, last_error: errors.length ? errors.join(' · ') : null })
    .eq('id', notificationId);

  return reply(200, { notification: notificationId, ...result }, origin);
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors(origin) });
  try {
    const payload = await req.json();
    const table: string = payload?.table ?? '';
    const record = payload?.record ?? {};
    const notificationId: string | undefined = payload?.notification_id;

    if (table === 'dossiers' && notificationId && SUPABASE_URL && SERVICE_ROLE) {
      return await notifyDossier(notificationId, payload?.retry === true, req.headers.get('authorization'), origin);
    }

    // ── Comportement historique (nouveau compte ; dossier sans migration) ──
    // Anti-abus : l'appel n'est honoré que pour un enregistrement réel et
    // récent (sinon n'importe qui pourrait déclencher des e-mails en boucle).
    if (SUPABASE_URL && SERVICE_ROLE && (table === 'profiles' || table === 'dossiers')) {
      const admin = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: real } = await admin
        .from(table)
        .select('id')
        .eq('id', String(record.id ?? ''))
        .gte('created_at', since)
        .maybeSingle();
      if (!real) return reply(200, { skipped: true, reason: 'not_recent' }, origin);
    }
    const ref: string = String(record.id ?? '').slice(0, 8);
    let subject = 'ClairDossier — nouvelle activité';
    let intro = '';
    let link = `${SITE}/compte`;

    if (table === 'profiles') {
      subject = 'ClairDossier — nouveau compte';
      intro = 'Un nouveau compte vient d’être créé.';
      link = `${SITE}/admin`;
    } else if (table === 'dossiers') {
      subject = 'ClairDossier — nouveau dossier';
      intro = 'Un nouveau dossier vient d’être enregistré.';
      link = record.id ? `${SITE}/compte/dossier/${record.id}` : `${SITE}/compte`;
    } else {
      return reply(200, { skipped: true, table }, origin);
    }

    const html = `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0d1b3d">
      <h2 style="font-size:18px;margin:0 0 12px">${subject}</h2>
      <p style="margin:4px 0">${intro}</p>
      ${ref ? `<p style="margin:4px 0;color:#64748b">Référence : ${ref}…</p>` : ''}
      <p style="margin:16px 0 4px"><a href="${link}" style="color:#0d1b3d;font-weight:600">Ouvrir l’espace admin pour consulter le détail →</a></p>
      <p style="margin-top:16px;font-size:12px;color:#64748b">Notification automatique — ClairDossier. Aucune donnée sensible n’est incluse dans cet e-mail.</p>
    </div>`;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [TO], subject, html }),
    });
    const body = await res.text();
    return new Response(body, { status: res.status, headers: cors(origin) });
  } catch {
    return reply(400, { error: 'invalid_request' }, origin);
  }
});
