// Le même état sourcé alimente l'écran, les PDF, les tableaux et le calendrier d'une révision.
import {
  buildDeliverables,
  buildChronology,
  renderPdf,
  MIME,
} from '../../supabase/functions/_shared/deliverables.ts';
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

function atelierReport({
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
}) {
  const { pieces, facts, events, deadlineQuote } = projectSources(extraction);
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
  const preparation = [
    { heading: 'Objet du suivi', text: summary },
    {
      heading: 'Avant la prise de contact',
      text: hasScan
        ? 'Vérifier la référence des fenêtres et préparer le bon de réception avant de demander sa signature. [Bon de réception numérisé.png, p. 1]'
        : 'Réunir le bon de réception cité par le devis et vérifier son état de signature.',
    },
    ...(hasDevis ? [{ heading: 'Échéance à rappeler', text: displayedDate + ' · ' + dateSource }] : []),
    {
      heading: 'À conserver après l’échange',
      text: 'Classer la réponse écrite et, si elle est obtenue, la copie signée dans ce dossier.',
    },
  ];
  return { title, analysis, pieces, deadlineRows, overrides, preparation };
}

const fileTitles = {
  dashboard: 'Tableau de bord',
  resume: 'Synthèse des faits',
  chronologie: 'Chronologie',
  echeances: 'Échéances et calendrier',
  dates: 'Dates et corrections',
  relances: 'Projet de courriel',
  manquants: 'Pièces et confirmations attendues',
  preparation: 'Fiche de préparation',
};

/** Toutes les éditions proviennent de la même projection métier que la situation affichée. */
export async function renderReport(input) {
  const { revision, publishedAt, pdfOnly = false } = input;
  const { title, analysis, pieces, deadlineRows, overrides, preparation } = input.analysis
    ? input
    : atelierReport(input);
  if (!title || !pieces.length) throw Error('Une pièce source et un dossier sont requis.');
  const stamp = new Date(publishedAt);
  const categories = pdfOnly
    ? ['dashboard']
    : [
        'dashboard',
        'resume',
        ...(analysis.events.length ? ['chronologie', 'dates'] : []),
        ...(analysis.deadlines.length ? ['echeances'] : []),
        ...(analysis.reminder_drafts.length ? ['relances'] : []),
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
    pieces: pieces.map((piece) => ({ ...piece, created_at: piece.created_at || stamp.toISOString() })),
    deadlineRows,
    overrides,
    demo: true,
    categories,
  });
  const pdf = files.find((f) => f.key === 'dashboard').bytes;
  if (!pdfOnly) {
    const subtitle =
      title +
      ' · révision ' +
      revision +
      ' · ' +
      stamp.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
    const missing = analysis.missing_items.flatMap((m) => [
      { kind: 'heading', text: m.text },
      { kind: 'para', text: m.why },
    ]);
    files.push({
      key: 'manquants',
      name: `Pieces-a-confirmer-r${revision}.pdf`,
      mime: MIME.pdf,
      bytes: await renderPdf(
        'Pièces et confirmations attendues',
        subtitle,
        missing.length
          ? missing
          : [
              {
                kind: 'para',
                text: 'Aucune pièce indispensable supplémentaire n’a été identifiée dans ce lot.',
              },
            ],
        true,
      ),
    });
    files.push({
      key: 'preparation',
      name: `Preparation-logistique-r${revision}.pdf`,
      mime: MIME.pdf,
      bytes: await renderPdf(
        'Fiche de préparation',
        subtitle,
        preparation.flatMap((s) => [
          { kind: 'heading', text: s.heading },
          { kind: 'para', text: s.text },
        ]),
        true,
      ),
    });
  }
  const published = files.map((f) => ({ ...f, category: f.key, title: fileTitles[f.key] }));
  const pack = pdfOnly
    ? null
    : zipSync(Object.fromEntries(files.map((f) => [f.name, f.bytes])), { level: 0, mtime: stamp });
  return { pdf, pack, count: files.length, files: published };
}
