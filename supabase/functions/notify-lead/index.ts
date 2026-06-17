// Edge Function: notify-lead
// Déclenchée par un trigger pg_net à l'insertion d'un profil (nouvelle inscription)
// ou d'un dossier. Envoie un e-mail de notification à l'équipe via Resend.
// Payload attendu : { table: 'profiles' | 'dossiers', record: {...} }

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const FROM = 'ClairDossier <noreply@clair-dossier.com>';
const TO = 'contact.clairdossier@icloud.com';

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const table: string = payload?.table ?? '';
    const record = payload?.record ?? {};

    let subject = 'ClairDossier — nouvelle activité';
    let lines: string[] = [];

    if (table === 'profiles') {
      subject = 'ClairDossier — nouveau compte créé';
      lines = [
        "Un nouveau compte vient d'être créé sur ClairDossier.",
        `Structure : ${record.company_name ?? '—'}`,
        `Type : ${record.company_type ?? '—'}`,
        `Nom : ${record.full_name ?? '—'}`,
      ];
    } else if (table === 'dossiers') {
      subject = `ClairDossier — nouveau dossier : ${record.title ?? record.typology ?? ''}`;
      lines = [
        "Un nouveau dossier vient d'être transmis.",
        `Typologie : ${record.typology ?? '—'}`,
        `Titre : ${record.title ?? '—'}`,
        `Statut : ${record.status ?? '—'}`,
        `Revue juridique demandée : ${record.legal_review_requested ? 'oui' : 'non'}`,
      ];
    } else {
      return new Response(JSON.stringify({ skipped: true, table }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = `<div style="font-family:system-ui,-apple-system,sans-serif;line-height:1.6;color:#0d1b3d">
      <h2 style="font-size:18px;margin:0 0 12px">${subject}</h2>
      ${lines.map((l) => `<p style="margin:4px 0">${l}</p>`).join('')}
      <p style="margin-top:16px;font-size:12px;color:#64748b">Notification automatique — ClairDossier.</p>
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
