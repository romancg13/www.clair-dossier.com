// Edge Function: submit-prospect (Vague 0 Lot 2.2 + chantier A1 v0)
//
// Chaîne : CORS strict → validation stricte (validate.ts) → limitation de
// débit (hachés salés IP/e-mail, aucune IP en clair stockée) → qualification
// déterministe A1 (scoring.ts) → INSERT avec journal d'audit (écrit AVANT la
// réponse) → accusé de réception au prospect + notification humaine minimisée
// (échec d'e-mail non bloquant : la demande est déjà en base).
//
// Secrets attendus (jamais dans le code) : SUPABASE_URL,
// SUPABASE_SERVICE_ROLE_KEY (injectés par la plateforme), RESEND_API_KEY
// (déjà présent pour notify-lead), PROSPECT_HASH_SALT (à créer).

import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateProspect } from './validate.ts';
import { qualifyProspect, SEUIL_ESCALADE } from './scoring.ts';

const SITE = 'https://www.clair-dossier.com';
const ADMIN_TO = 'prestige.seller@icloud.com';
const FROM = 'ClairDossier <noreply@clair-dossier.com>';

const ALLOWED_ORIGINS = new Set([
  'https://www.clair-dossier.com',
  'https://clair-dossier.com',
  'https://clair-dossier.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
]);

// Limites : 5 demandes / heure / IP · 3 demandes / 24 h / e-mail.
const IP_LIMIT = 5;
const IP_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_LIMIT = 3;
const EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY') ?? '';
  if (!key) {
    console.warn('submit-prospect: RESEND_API_KEY absent — e-mail non envoyé.');
    return;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!res.ok) {
    console.error(`submit-prospect: envoi e-mail ${res.status} — ${await res.text()}`);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

Deno.serve(async (req) => {
  const headers = corsHeaders(req.headers.get('origin'));

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method' }), { status: 405, headers });
  }

  try {
    let payload: unknown;
    try {
      payload = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'json' }), { status: 400, headers });
    }

    const result = validateProspect(payload);
    if (!result.ok) {
      // Honeypot / soumission trop rapide : réponse 200 neutre (ne pas
      // renseigner les robots), rien n'est écrit.
      if (result.errors.includes('honeypot') || result.errors.includes('elapsed_ms')) {
        return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
      }
      return new Response(JSON.stringify({ error: 'validation', fields: result.errors }), {
        status: 400,
        headers,
      });
    }
    const prospect = result.value;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── Limitation de débit (hachés salés, aucune IP en clair) ──────────────
    const salt = Deno.env.get('PROSPECT_HASH_SALT') ?? 'clairdossier-prospects';
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('cf-connecting-ip') ??
      'inconnue';
    const ipHash = await sha256Hex(`${salt}:ip:${ip}`);
    const emailHash = await sha256Hex(`${salt}:email:${prospect.email}`);

    const since = (ms: number) => new Date(Date.now() - ms).toISOString();
    const [ipCount, emailCount] = await Promise.all([
      supabase
        .from('prospect_rate_limits')
        .select('id', { count: 'exact', head: true })
        .eq('ip_hash', ipHash)
        .gte('created_at', since(IP_WINDOW_MS)),
      supabase
        .from('prospect_rate_limits')
        .select('id', { count: 'exact', head: true })
        .eq('email_hash', emailHash)
        .gte('created_at', since(EMAIL_WINDOW_MS)),
    ]);
    if ((ipCount.count ?? 0) >= IP_LIMIT || (emailCount.count ?? 0) >= EMAIL_LIMIT) {
      return new Response(JSON.stringify({ error: 'rate_limit' }), { status: 429, headers });
    }
    await supabase.from('prospect_rate_limits').insert({ ip_hash: ipHash, email_hash: emailHash });
    // Purge opportuniste (rétention courte, minimisation)
    await supabase
      .from('prospect_rate_limits')
      .delete()
      .lt('created_at', since(EMAIL_WINDOW_MS));

    // ── Qualification déterministe A1 v0 ────────────────────────────────────
    const qual = qualifyProspect(prospect);

    // ── Écriture (journal d'audit AVANT toute sortie) ───────────────────────
    const auditEntry = {
      ts: new Date().toISOString(),
      actor: 'submit-prospect@a1-v0-deterministe',
      resource: 'prospects',
      action: 'creation',
      decision: qual.routage,
      score: qual.score_potentiel,
      motif: qual.motif,
      base_legale: 'mesures précontractuelles (art. 6.1.b RGPD)',
    };
    const { data: inserted, error: insertError } = await supabase
      .from('prospects')
      .insert({
        full_name: prospect.full_name,
        email: prospect.email,
        organization: prospect.organization,
        segment: prospect.segment,
        topic: prospect.topic,
        message: prospect.message,
        creneaux: prospect.creneaux,
        source_page: prospect.source_page,
        referrer: prospect.referrer,
        score_potentiel: qual.score_potentiel,
        routage: qual.routage,
        human_flags: qual.human_flags,
        audit_log: [auditEntry],
      })
      .select('id')
      .single();
    if (insertError || !inserted) {
      console.error('submit-prospect: insertion échouée', insertError);
      return new Response(JSON.stringify({ error: 'storage' }), { status: 500, headers });
    }

    const ref = String(inserted.id).slice(0, 8);

    // ── Accusé de réception au prospect ─────────────────────────────────────
    const ackHtml = `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0d1b3d">
      <h2 style="font-size:18px;margin:0 0 12px">Votre demande est bien reçue</h2>
      <p style="margin:4px 0">Bonjour ${escapeHtml(prospect.full_name)},</p>
      <p style="margin:4px 0">Nous avons bien enregistré votre demande (référence ${ref}…) et
      revenons vers vous rapidement — en journée, la réponse arrive en général sous quelques heures.</p>
      <p style="margin:4px 0">Vous pouvez aussi nous écrire directement :
      <a href="${SITE}/contact" style="color:#0d1b3d;font-weight:600">${SITE}/contact</a></p>
      <p style="margin-top:16px;font-size:12px;color:#64748b">ClairDossier — message automatique
      de confirmation. Vos données restent dans votre fiche de contact et ne sont jamais partagées ;
      détails : ${SITE}/politique-confidentialite</p>
    </div>`;
    await sendEmail(prospect.email, 'ClairDossier — votre demande est bien reçue', ackHtml);

    // ── Notification humaine minimisée (modèle notify-lead : pas de contenu) ─
    const urgent = qual.human_flags.includes('escalade_immediate');
    const notifHtml = `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0d1b3d">
      <h2 style="font-size:18px;margin:0 0 12px">${urgent ? '🔔 Prospect à fort potentiel' : 'Nouveau prospect'}</h2>
      <p style="margin:4px 0">Segment : ${escapeHtml(prospect.segment)} · nature : ${escapeHtml(prospect.topic)}</p>
      <p style="margin:4px 0">Score : ${qual.score_potentiel} (seuil d'escalade : ${SEUIL_ESCALADE}) · routage : ${qual.routage}</p>
      ${qual.human_flags.length ? `<p style="margin:4px 0">Signaux : ${qual.human_flags.map(escapeHtml).join(', ')}</p>` : ''}
      <p style="margin:4px 0;color:#64748b">Référence : ${ref}… — détail complet dans la table prospects (accès admin).</p>
      <p style="margin-top:16px;font-size:12px;color:#64748b">Notification automatique — aucune donnée nominative dans cet e-mail.</p>
    </div>`;
    await sendEmail(
      ADMIN_TO,
      urgent ? 'ClairDossier — prospect à fort potentiel' : 'ClairDossier — nouveau prospect',
      notifHtml
    );

    return new Response(JSON.stringify({ ok: true, routage: qual.routage }), {
      status: 201,
      headers,
    });
  } catch (e) {
    console.error('submit-prospect: erreur inattendue', e);
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers });
  }
});
