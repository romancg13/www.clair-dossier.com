// Edge Function: email-inbound — réception d'e-mails (webhook Resend signé).
//
// Flux : e-mail transféré à l'adresse non devinable d'un dossier
// (d-<32 hex>@<sous-domaine de réception>) → webhook `email.received` signé
// (Svix) → routage par DESTINATAIRE enregistré (inbound_addresses, jamais par
// expéditeur) → contenu et pièces jointes récupérés RÉELLEMENT par l'API
// Resend → pièces acceptées stockées comme dépôts du dossier (mêmes règles de
// type/taille que le dépôt manuel) → le déclencheur documents_ai_enqueue
// existant poursuit si le traitement du dossier est activé.
//
// Garanties :
//  - signature Svix vérifiée (RESEND_INBOUND_WEBHOOK_SECRET), horodatage ± 5 min
//    (anti-rejeu) — sinon 401 ;
//  - idempotence : une ligne inbound_emails par email_id Resend (unicité) ;
//    un rejeu du webhook ne retraite rien ;
//  - débit : au plus 30 réceptions/heure par adresse ; au plus 10 pièces
//    jointes par e-mail (le reste est signalé, jamais silencieux) ;
//  - provenance conservée (expéditeur, sujet, verdicts SPF/DKIM/DMARC) sans
//    faire confiance à l'expéditeur pour le routage ;
//  - destinataire inconnu, adresse révoquée ou dossier clôturé : 200 sans
//    détail (rien n'est révélé) ;
//  - l'e-mail original reste chez le fournisseur : jamais supprimé ici, et
//    aucun lien contenu dans l'e-mail n'est suivi (seules les URL de
//    téléchargement DE PIÈCES JOINTES fournies par l'API Resend le sont) ;
//  - réponse réduite à { processed } (détail dans les journaux de fonction,
//    sans contenu confidentiel).
//
// NON VÉRIFIÉ DE BOUT EN BOUT (2026-11-18) : aucun domaine de réception ni
// compte Resend disponibles en recette. Le chemin exact de la liste des
// pièces jointes (`/emails/receiving/{id}/attachments`) vient de la page
// « list-received-email-attachments » de la documentation Resend : à
// confirmer au premier essai réel (l'échec est journalisé proprement).
//
// Déploiement : supabase functions deploy email-inbound --no-verify-jwt
// Secrets : RESEND_INBOUND_WEBHOOK_SECRET, RESEND_API_KEY,
// INBOUND_EMAIL_DOMAIN (sous-domaine MX dédié — jamais les MX principaux) ;
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY injectés par la plateforme.

import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  acceptAttachment,
  inboundLocalParts,
  sanitizeInboundName,
  verifySvixSignature,
} from '../_shared/inbound-email.ts';

const WEBHOOK_SECRET = Deno.env.get('RESEND_INBOUND_WEBHOOK_SECRET') ?? '';
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const DOMAIN = Deno.env.get('INBOUND_EMAIL_DOMAIN') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const RATE_PER_HOUR = 30;
const MAX_ATTACHMENTS = 10;
const BUCKET = 'documents';
const API = 'https://api.resend.com/emails/receiving';

const db = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

type AttachmentMeta = { id?: string; filename?: string | null; content_type?: string | null; size?: number | null; download_url?: string | null };

/** Liste des pièces jointes avec URL de téléchargement (valable 1 h). */
async function listAttachments(emailId: string): Promise<AttachmentMeta[] | null> {
  const res = await fetch(`${API}/${encodeURIComponent(emailId)}/attachments`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!res.ok) return null;
  const out = await res.json().catch(() => null);
  const list = Array.isArray(out) ? out : Array.isArray(out?.data) ? out.data : null;
  return list as AttachmentMeta[] | null;
}

/** Dépôt vérifié : objet envoyé puis ligne insérée ; objet retiré si l'insert échoue. */
async function storePiece(
  dossierId: string,
  userId: string,
  fileName: string,
  bytes: Uint8Array,
  contentType: string | null,
): Promise<boolean> {
  const path = `${userId}/${dossierId}/email-${Date.now()}-${sanitizeInboundName(fileName)}`;
  const up = await db.storage.from(BUCKET).upload(path, bytes as unknown as ArrayBuffer, {
    contentType: contentType ?? 'application/octet-stream',
    upsert: false,
  });
  if (up.error) return false;
  const ins = await db
    .from('dossier_documents')
    .insert({ dossier_id: dossierId, user_id: userId, file_path: path, file_name: fileName.slice(0, 200), kind: 'piece', size_bytes: bytes.byteLength })
    .select('id')
    .maybeSingle();
  if (ins.error || !ins.data) {
    await db.storage.from(BUCKET).remove([path]);
    return false;
  }
  return true;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'POST attendu' });
  if (!WEBHOOK_SECRET || !RESEND_API_KEY || !DOMAIN || !SUPABASE_URL || !SERVICE_ROLE) {
    return json(503, { error: 'configuration incomplète : rien n’est traité' });
  }
  const body = await req.text();
  const signed = await verifySvixSignature({
    secret: WEBHOOK_SECRET,
    id: req.headers.get('svix-id'),
    timestamp: req.headers.get('svix-timestamp'),
    signature: req.headers.get('svix-signature'),
    body,
  });
  if (!signed) return json(401, { error: 'signature invalide' });

  let event: { type?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(body);
  } catch {
    return json(400, { error: 'corps illisible' });
  }
  const data = event?.data ?? {};
  const emailId = typeof data.email_id === 'string' ? data.email_id : null;
  if (event?.type !== 'email.received' || !emailId) return json(200, { processed: 0 });

  // Routage par destinataire enregistré (received_for = enveloppe réelle).
  const recipients = ([] as unknown[])
    .concat(Array.isArray(data.received_for) ? data.received_for : [])
    .concat(Array.isArray(data.to) ? data.to : [])
    .concat(Array.isArray(data.cc) ? data.cc : []) as string[];
  const locals = inboundLocalParts(recipients, DOMAIN);
  if (!locals.length) return json(200, { processed: 0 });

  const { data: addr } = await db
    .from('inbound_addresses')
    .select('id,user_id,dossier_id')
    .in('local_part', locals)
    .is('revoked_at', null)
    .limit(1)
    .maybeSingle();
  if (!addr) return json(200, { processed: 0 });

  const { data: dossier } = await db.from('dossiers').select('id,user_id,deleted_at').eq('id', addr.dossier_id).maybeSingle();
  if (!dossier || dossier.deleted_at) return json(200, { processed: 0 });

  // Idempotence / anti-rejeu : une ligne par email_id (unicité en base).
  const ins = await db
    .from('inbound_emails')
    .insert({
      address_id: addr.id,
      user_id: addr.user_id,
      dossier_id: addr.dossier_id,
      provider_email_id: emailId,
      message_id: typeof data.message_id === 'string' ? data.message_id.slice(0, 500) : null,
      from_addr: typeof data.from === 'string' ? data.from.slice(0, 320) : null,
      subject: typeof data.subject === 'string' ? data.subject.slice(0, 500) : null,
      attachment_count: Array.isArray(data.attachments) ? data.attachments.length : 0,
    })
    .select('id')
    .maybeSingle();
  if (ins.error || !ins.data) return json(200, { processed: 0 }); // rejeu : déjà traité

  const rowId = ins.data.id as string;
  const conclude = async (status: string, error: string | null, stored: number): Promise<Response> => {
    await db.from('inbound_emails').update({ status, error, stored_count: stored }).eq('id', rowId);
    return json(200, { processed: stored });
  };

  const { data: closed } = await db.rpc('dossier_is_closed', { p_dossier: addr.dossier_id });
  if (closed === true) return conclude('rejected', 'dossier clôturé', 0);

  // Débit horaire par adresse (la ligne courante comprise).
  const { count } = await db
    .from('inbound_emails')
    .select('id', { count: 'exact', head: true })
    .eq('address_id', addr.id)
    .gte('created_at', new Date(Date.now() - 3_600_000).toISOString());
  if ((count ?? 0) > RATE_PER_HOUR) return conclude('rejected', 'débit horaire dépassé', 0);

  // Contenu réel (API Resend) : verdicts d'authentification + texte de l'e-mail.
  const emailRes = await fetch(`${API}/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
  });
  if (!emailRes.ok) return conclude('error', `récupération du contenu : HTTP ${emailRes.status}`, 0);
  const email = await emailRes.json().catch(() => null) as
    | { text?: string | null; authentication?: { spf?: string; dkim?: string; dmarc?: string }; attachments?: AttachmentMeta[] }
    | null;
  if (!email) return conclude('error', 'contenu illisible', 0);
  await db
    .from('inbound_emails')
    .update({
      spf: email.authentication?.spf ?? null,
      dkim: email.authentication?.dkim ?? null,
      dmarc: email.authentication?.dmarc ?? null,
    })
    .eq('id', rowId);

  // Pièces jointes : URL de téléchargement fournies par l'API seulement.
  const declared = Array.isArray(email.attachments) ? email.attachments : [];
  let withUrls: AttachmentMeta[] = declared.filter((a) => typeof a?.download_url === 'string');
  if (declared.length > 0 && withUrls.length === 0) {
    withUrls = (await listAttachments(emailId)) ?? [];
  }
  const problems: string[] = [];
  if (declared.length > MAX_ATTACHMENTS) problems.push(`${declared.length - MAX_ATTACHMENTS} pièce(s) au-delà de la limite de ${MAX_ATTACHMENTS} ignorée(s)`);
  let stored = 0;
  for (const a of withUrls.slice(0, MAX_ATTACHMENTS)) {
    const name = (a.filename ?? '').trim() || 'piece-jointe';
    const refuse = acceptAttachment({ filename: a.filename, size: a.size ?? null });
    if (refuse) {
      problems.push(refuse);
      continue;
    }
    if (typeof a.download_url !== 'string') {
      problems.push(`« ${name} » : URL de téléchargement absente`);
      continue;
    }
    const fileRes = await fetch(a.download_url);
    if (!fileRes.ok) {
      problems.push(`« ${name} » : téléchargement HTTP ${fileRes.status}`);
      continue;
    }
    const bytes = new Uint8Array(await fileRes.arrayBuffer());
    const sizeRefuse = acceptAttachment({ filename: name, size: bytes.byteLength });
    if (sizeRefuse) {
      problems.push(sizeRefuse);
      continue;
    }
    if (await storePiece(addr.dossier_id, addr.user_id, name, bytes, a.content_type ?? null)) stored += 1;
    else problems.push(`« ${name} » : dépôt impossible`);
  }

  // Aucune pièce enregistrée : le texte de l'e-mail devient une pièce .txt,
  // pour que le message ne soit pas perdu (signalé comme tel).
  if (stored === 0 && typeof email.text === 'string' && email.text.trim()) {
    const txt = new TextEncoder().encode(email.text.slice(0, 200_000));
    if (await storePiece(addr.dossier_id, addr.user_id, `email-${new Date().toISOString().slice(0, 10)}.txt`, txt, 'text/plain')) stored += 1;
  }

  await db.from('dossier_events').insert({
    dossier_id: addr.dossier_id,
    user_id: addr.user_id,
    type: 'email_recu',
    label: `E-mail reçu — ${stored} pièce${stored > 1 ? 's' : ''} ajoutée${stored > 1 ? 's' : ''}${problems.length ? ` (${problems.length} refusée${problems.length > 1 ? 's' : ''})` : ''}`,
  });
  return conclude(stored > 0 ? 'stored' : 'rejected', problems.length ? problems.join(' ; ').slice(0, 1000) : null, stored);
});
