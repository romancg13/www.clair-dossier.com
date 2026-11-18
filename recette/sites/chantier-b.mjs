// Chantier et intervenants fictifs. Ces deux originaux constituent le corpus du nouveau client B.
import { buildChronology } from '../../supabase/functions/_shared/analysis-model.ts';
import { deadlineKey } from '../../supabase/functions/_shared/ai-pipeline.ts';

export const title = 'Réception des volets · Atelier du Canal';
export const fixtures = {
  'devis-b': {
    name: 'Devis CAN-072 — volets.pdf',
    lines: [
      'DEVIS CAN-072 — ATELIER DU CANAL',
      'Devis du 02/11/2026.',
      'Objet : remise en état de deux volets battants.',
      'Prix TTC : 2 760 EUR.',
      'Confirmation écrite de la levée de réserve attendue au plus tard le 15/12/2026.',
      'Le bon de réception consigne les réserves constatées sur le chantier.',
    ],
  },
  'reception-b': {
    name: 'Bon de réception — volets.png',
    lines: [
      'BON DE RECEPTION - ATELIER DU CANAL',
      'Chantier CAN-072. Reception du 17/11/2026.',
      'Le client a signe le bon avec une reserve.',
      'Poignee du volet cote cour a resserrer.',
      'La reserve reste ouverte.',
    ],
  },
};
export const B_TITLE = title;
export const B_FIXTURES = fixtures;

const estimate = 'devis-b',
  receipt = 'reception-b';
const normalize = (line) =>
  line
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
const patterns = {
  [estimate]: [
    /can-072/,
    /02\/11\/2026/,
    /deux volets battants/,
    /2\s?760\s*(?:eur|€)/,
    /15\/12\/2026/,
  ],
  [receipt]: [
    /can-072/,
    /17\/11\/2026/,
    /signe le bon avec une reserve/,
    /poignee du volet cote cour a resserrer/,
    /reserve reste ouverte/,
  ],
};

export function evidenceValid(id, lines) {
  if (
    !Object.hasOwn(patterns, id) ||
    !Array.isArray(lines) ||
    !lines.length ||
    lines.some((line) => typeof line !== 'string')
  )
    return false;
  const text = normalize(lines.join(' '));
  return patterns[id].every((pattern) => pattern.test(text));
}

function evidence(extraction, id, pattern) {
  const line = extraction[id]?.lines.find((value) => pattern.test(normalize(value)));
  return line ? [{ document_id: id, page: 1, quote: line }] : [];
}

export function report(extraction, retainedDate = null, corrections = []) {
  const ids = [estimate, receipt].filter((id) => evidenceValid(id, extraction[id]?.lines));
  const hasEstimate = ids.includes(estimate),
    hasReceipt = ids.includes(receipt);
  const originalDate = hasEstimate ? '2026-12-15' : null;
  const date = originalDate ? retainedDate || originalDate : null;
  const deadlineTitle = 'Confirmation écrite de la levée de réserve';
  const extractedDateSource = hasEstimate
    ? 'Devis CAN-072, page 1.'
    : 'Aucune échéance documentée dans le bon de réception.';
  const latest = corrections.at(-1);
  const dateSource =
    date && latest
      ? 'Correction du client du ' +
        new Date(latest.createdAt).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' }) +
        ' : ' +
        latest.reason +
        '. Date extraite du devis CAN-072, page 1.'
      : extractedDateSource;
  const sentences = [];
  if (hasEstimate)
    sentences.push(
      'Le devis CAN-072 prévoit la remise en état de deux volets battants pour 2 760 € TTC.',
    );
  if (hasReceipt)
    sentences.push(
      'Le bon signé laisse ouverte une réserve sur la poignée du volet côté cour, à resserrer.',
    );
  const summary = sentences.join(' ') || 'Aucune pièce du chantier du Canal n’est lisible.';
  const action = hasReceipt
    ? 'Demander à l’Atelier du Canal la confirmation écrite du resserrage de la poignée.'
    : hasEstimate
      ? 'Joindre le bon de réception pour vérifier les éventuelles réserves.'
      : 'Joindre une pièce lisible.';
  const subject = 'Chantier CAN-072 — confirmation du resserrage de la poignée';
  const message =
    'Bonjour, le bon de réception du 17 novembre signale une réserve sur la poignée du volet côté cour. Pouvez-vous confirmer par écrit si le resserrage a été effectué et à quelle date ? Merci.';
  const draft = hasReceipt ? 'Objet : ' + subject + '\n' + message : null;
  const pieces = ids.map((id) => ({ id, file_name: fixtures[id].name, created_at: '' }));
  const facts = [],
    extractedDates = [];
  function addFact(id, pattern, text) {
    const refs = evidence(extraction, id, pattern);
    if (refs.length) facts.push({ text, status: 'documented', evidence: refs });
  }
  function addEvent(id, pattern, when, label, kind) {
    const refs = evidence(extraction, id, pattern);
    if (refs.length)
      extractedDates.push({
        document_id: id,
        data: {
          dates: [
            {
              date: when,
              precision: 'day',
              kind,
              label,
              evidence: refs.map(({ page, quote }) => ({ page, quote })),
            },
          ],
        },
      });
  }
  if (hasEstimate) {
    addFact(
      estimate,
      /deux volets battants/,
      'Le devis porte sur la remise en état de deux volets battants.',
    );
    addFact(estimate, /2\s?760/, 'Le prix indiqué au devis est de 2 760 € TTC.');
    addEvent(estimate, /02\/11\/2026/, '2026-11-02', 'Émission du devis CAN-072', 'document_date');
    addEvent(estimate, /15\/12\/2026/, originalDate, deadlineTitle, 'event_date');
  }
  if (hasReceipt) {
    addFact(receipt, /signe le bon/, 'Le bon est signé avec une réserve.');
    addFact(receipt, /poignee/, 'La poignée du volet côté cour doit être resserrée.');
    addFact(receipt, /reste ouverte/, 'La réserve est ouverte sur le bon de réception.');
    addEvent(
      receipt,
      /17\/11\/2026/,
      '2026-11-17',
      'Réception des volets avec réserve',
      'event_date',
    );
  }
  const deadlineEvidence = hasEstimate ? evidence(extraction, estimate, /15\/12\/2026/) : [];
  const deadlines = hasEstimate
    ? [
        {
          title: deadlineTitle,
          date: originalDate,
          kind: 'mentioned',
          basis: extractedDateSource,
          responsible: 'Client',
          priority: 'normale',
          evidence: deadlineEvidence,
        },
      ]
    : [];
  const missing_items = [];
  if (!hasReceipt && hasEstimate)
    missing_items.push({
      text: 'Bon de réception du chantier CAN-072',
      why: 'Le devis renvoie au bon de réception pour les réserves constatées (devis, p. 1).',
    });
  if (hasReceipt) {
    missing_items.push({
      text: 'Confirmation écrite de la levée de réserve',
      why: 'Le bon de réception indique que la réserve reste ouverte (bon, p. 1). Aucune confirmation de son traitement ne figure dans le lot.',
    });
    if (!hasEstimate)
      missing_items.push({
        text: 'Devis CAN-072',
        why: 'Le bon mentionne le chantier CAN-072 (p. 1). Le devis permettrait de vérifier montant et date attendue.',
      });
  }
  const analysis = {
    summary_short: summary,
    summary_long: summary,
    action_owner: 'Client',
    parties: [],
    facts,
    deadlines,
    contradictions: [],
    missing_items,
    attention_points: date && latest ? [dateSource] : [],
    next_actions: [action],
    events: buildChronology(extractedDates),
    reminder_drafts: hasReceipt
      ? [
          {
            audience: 'third_party',
            subject,
            body: message,
            recipient_hint: 'Atelier du Canal, coordonnées à vérifier',
            suggested_date: null,
          },
        ]
      : [],
  };
  const overrides = hasEstimate
    ? corrections.map((c) => ({
        event_key: deadlineKey(deadlineTitle, originalDate),
        retained_date: c.date,
        label: null,
        hidden: false,
        reason: c.reason,
        author: c.author,
        created_at: new Date(c.createdAt).toISOString(),
      }))
    : [];
  const deadlineRows =
    hasEstimate && latest
      ? [
          {
            ai_key: deadlineKey(deadlineTitle, originalDate),
            title: deadlineTitle,
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
    {
      heading: 'Objectif',
      text: hasReceipt
        ? 'Vérifier comment lever la réserve sur la poignée côté cour (bon de réception, p. 1).'
        : 'Vérifier la réception des deux volets prévus au devis CAN-072 (p. 1).',
    },
    {
      heading: 'Questions à poser',
      text: hasReceipt
        ? 'Qui reprend la poignée du volet côté cour ? À quelle date ? Quelle confirmation écrite sera remise ?'
        : 'Quand les volets ont-ils été réceptionnés ? Où se trouve le bon signé ? Quelles réserves éventuelles y figurent ?',
    },
    {
      heading: 'Pièces à apporter',
      text: pieces.length
        ? pieces.map((p) => p.file_name + ' (p. 1)').join(' · ')
        : 'Aucune pièce lisible.',
    },
  ];
  return {
    title,
    summary,
    action,
    date,
    originalDate,
    extractedDateSource,
    dateSource,
    draft,
    analysis,
    pieces,
    deadlineRows,
    overrides,
    preparation,
  };
}
export const chantierReport = report;
export const bEvidenceValid = evidenceValid;
export const bReport = report;
