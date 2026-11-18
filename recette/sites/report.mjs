// Le même état sourcé alimente l'écran, les PDF, les tableaux et le calendrier d'une révision.
import { buildDeliverables, buildChronology } from '../../supabase/functions/_shared/deliverables.ts';
import { deadlineKey } from '../../supabase/functions/_shared/ai-pipeline.ts';
import { zipSync } from 'fflate';

function projectSources(extraction) {
  const pieces = [],
    facts = [],
    extractedEvents = [];
  const labels = { devis: 'Devis CD-041.pdf', scan: 'Bon de réception numérisé.png' };
  let deadlineQuote;
  function event(piece, line, label, kind) {
    const day = line.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
    if (!day) return;
    extractedEvents.push({
      document_id: piece,
      data: {
        dates: [
          {
            date: day.split('/').reverse().join('-'),
            precision: 'day',
            kind,
            label,
            evidence: [{ page: 1, quote: line }],
          },
        ],
      },
    });
  }
  for (const [id, result] of Object.entries(extraction)) {
    pieces.push({ id, file_name: labels[id], created_at: '' });
    for (const line of result.lines) {
      const text = line.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const evidence = [{ document_id: id, page: 1, quote: line }];
      if (
        /^Objet\s*:|^Prix TTC\s*:|pas de signature|^Reception des trois|^Retour du proces-verbal/i.test(text)
      ) {
        facts.push({ text: line, status: 'documented', evidence });
      }
      if (/^Devis emis le/i.test(text)) event(id, line, 'Émission du devis CD-041', 'document_date');
      if (/^Reception des trois/i.test(text)) event(id, line, 'Réception des trois fenêtres', 'event_date');
      if (/^Retour du proces-verbal/i.test(text)) {
        deadlineQuote = evidence;
        event(id, line, 'Retour du procès-verbal', 'event_date');
      }
    }
  }
  return { pieces, facts, events: buildChronology(extractedEvents), deadlineQuote };
}

export async function renderReport({
  revision,
  publishedAt,
  summary,
  action,
  date,
  dateSource,
  originalDate,
  hasDevis,
  hasScan,
  draft,
  corrections,
  extraction,
  pdfOnly = false,
}) {
  const stamp = new Date(publishedAt);
  const { pieces, facts, events, deadlineQuote } = projectSources(extraction);
  for (const piece of pieces) piece.created_at = stamp.toISOString();
  const deadlines = hasDevis
    ? [
        {
          title: 'Retour du procès-verbal',
          date: originalDate,
          kind: 'mentioned',
          basis: 'Date explicite du devis.',
          priority: 'normale',
          responsible: 'Client',
          evidence: deadlineQuote,
        },
      ]
    : [];
  const corrected = corrections.length > 0;
  const analysis = {
    summary_short: summary,
    summary_long: summary,
    action_owner: 'Client',
    parties: [],
    facts,
    deadlines,
    contradictions: [],
    missing_items: [
      hasScan
        ? {
            text: 'Bon de réception signé',
            why: 'Le bon de réception déposé indique qu’il ne porte pas de signature.',
          }
        : { text: 'Bon de réception', why: 'Le devis demande le retour du procès-verbal.' },
    ],
    attention_points: corrected ? [dateSource] : [],
    next_actions: [corrected ? action + ' ' + dateSource : action],
    reminder_drafts: draft
      ? [
          {
            audience: 'third_party',
            subject: 'Bon de réception à signer – Chantier Atelier Témoin',
            body: draft.split('\n').slice(1).join('\n'),
            suggested_date: null,
            recipient_hint: 'Atelier Témoin, coordonnées à vérifier',
          },
        ]
      : [],
    events,
  };
  const overrides = corrections.map((c) => ({
    event_key: deadlineKey('Retour du procès-verbal', originalDate),
    retained_date: c.date,
    label: null,
    hidden: false,
    reason: c.reason,
    author: c.author,
    created_at: new Date(c.createdAt).toISOString(),
  }));
  const displayedDate = date
    ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long', timeZone: 'UTC' }).format(
        new Date(date + 'T12:00:00Z'),
      )
    : null;
  const title =
    'Atelier Témoin' +
    (displayedDate ? ' · Date retenue : ' + displayedDate : ' · Aucune échéance documentée');
  const deadlineRows = corrected
    ? [
        {
          ai_key: null,
          title: 'Retour du procès-verbal · date corrigée par le client',
          due_date: date,
          due_time: null,
          priority: 'normale',
          done: false,
          user_edited: true,
          description: dateSource,
        },
      ]
    : undefined;
  const categories = pdfOnly
    ? ['dashboard']
    : [
        'dashboard',
        'resume',
        ...(events.length ? ['chronologie', 'dates'] : []),
        ...(hasDevis ? ['echeances'] : []),
        ...(hasScan ? ['relances'] : []),
      ];
  const files = await buildDeliverables({
    title,
    revision,
    generatedAt: stamp,
    analysis,
    coverage: {
      total: pieces.length,
      extracted: pieces.length,
      unsupported: 0,
      failed: 0,
      pending: 0,
      complete: true,
    },
    pieces,
    deadlineRows,
    overrides,
    demo: true,
    categories,
  });
  const pdf = files.find((f) => f.key === 'dashboard').bytes;
  // Les formats Office et PDF sont déjà compressés. Le ZIP évite une seconde compression coûteuse.
  const pack = pdfOnly
    ? null
    : zipSync(Object.fromEntries(files.map((f) => [f.name, f.bytes])), { level: 0, mtime: stamp });
  return { pdf, pack, count: files.length };
}
