// Edge Function: notify-lead
// Déclenchée par un trigger pg_net à l'insertion d'un profil (nouvelle inscription)
// ou d'un dossier. Envoie un e-mail de notification à l'équipe via Resend.
// Payload attendu : { table: 'profiles' | 'dossiers', record: {...} }

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = 'ClairDossier <noreply@clair-dossier.com>';
const TO = 'prestige.seller@icloud.com';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const table: string = payload?.table ?? '';
    const record = payload?.record ?? {};

    // Minimisation RGPD (cahier directeur) : aucune donnée nominative, aucun titre,
    // aucune typologie/nature de dossier ni montant dans l'objet OU le corps de l'e-mail.
    // On notifie seulement le TYPE d'activité + un identifiant opaque + un lien vers
    // l'espace admin (authentifié) où le détail reste consultable en sécurité.
    const SITE = 'https://www.clair-dossier.com';
    const ref: string = String(record.id ?? '').slice(0, 8);
    let subject = 'ClairDossier — nouvelle activité';
    let intro = '';
    let link = `${SITE}/compte`;

    if (table === 'profiles') {
      subject = 'ClairDossier — nouveau compte';
      intro = 'Un nouveau compte vient d’être créé.';
      link = `${SITE}/compte`;
    } else if (table === 'dossiers') {
      subject = 'ClairDossier — nouveau dossier';
      intro = 'Un nouveau dossier vient d’être enregistré.';
      link = record.id ? `${SITE}/compte/dossier/${record.id}` : `${SITE}/compte`;
    } else {
      return new Response(JSON.stringify({ skipped: true, table }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
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
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to: [TO], subject, html }),
    });

    const body = await res.text();
    return new Response(body, {
      status: res.status,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
