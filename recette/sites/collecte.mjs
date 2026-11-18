import { deadlineKey } from '../../supabase/functions/_shared/ai-pipeline.ts';

// Scénario pédagogique. Noms de sites, don, poids, dates et créneaux sont inventés pour la démonstration.
export const FOOD_TITLE = 'Banque Alimentaire des Bouches-du-Rhône · Collecte du 19 novembre 2026';
export const FOOD_FIXTURES = {
  don: {
    name: 'Proposition de don du 16 novembre.pdf',
    lines: [
      'Proposition de don · exercice COL-19',
      'Proposition du 16/11/2026.',
      'Don proposé : pâtes sèches et conserves de légumes.',
      'Mise à disposition : réserve de l’Épicerie des Amandiers (site fictif).',
      'Date prévue de la collecte : 19/11/2026.',
      'Le don et la réception définitive restent à constater sur un bon signé.',
    ],
  },
  inventaire: {
    name: 'Inventaire prévisionnel des cartons.pdf',
    lines: [
      'Inventaire prévisionnel · exercice COL-19',
      'Inventaire préparé le 17/11/2026.',
      'Pâtes sèches : 12 cartons de 6 kg, soit 72 kg.',
      'Conserves de légumes : 8 cartons de 9 kg, soit 72 kg.',
      'Total prévu : 20 cartons, 144 kg.',
      'Quantités à rapprocher du comptage réalisé à la réception.',
    ],
  },
  tournee: {
    name: 'Courriel de préparation de tournée.pdf',
    lines: [
      'Courriel de préparation · exercice COL-19',
      'Message du 18/11/2026. De : coordination de tournée. À : équipe de réception.',
      'Enlèvement prévu le 19/11/2026 à 09:30 à la réserve des Amandiers.',
      'Réception prévue le 19/11/2026 à 10:30 au dépôt relais des Oliviers (site fictif).',
      'Heures locales de Marseille (Europe/Paris).',
      'Le conducteur attend la confirmation du quai avant son départ.',
    ],
  },
  quai: {
    name: 'Fiche de quai numérisée.png',
    lines: [
      'FICHE DE QUAI - EXERCICE COL-19',
      'Fiche preparee le 18/11/2026.',
      'Quai B propose au depot relais des Oliviers.',
      'Confirmation du quai attendue le 19/11/2026 avant 08:30.',
      'Responsable : coordination de collecte.',
      'Le quai B reste a confirmer par la reception.',
    ],
  },
};

const normalized = (s) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/’/g, "'")
    .toLowerCase();
const iso = (fr) => fr.split('/').reverse().join('-');
const french = (isoDay) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(isoDay + 'T12:00:00Z'));
const signals = {
  don: [
    /proposition du 16\/11\/2026/,
    /pates seches et conserves/,
    /epicerie des amandiers/,
    /19\/11\/2026/,
    /bon signe/,
  ],
  inventaire: [/17\/11\/2026/, /12 cartons de 6 kg/, /8 cartons de 9 kg/, /20 cartons,?\s*144 kg/],
  tournee: [
    /18\/11\/2026/,
    /enlevement prevu le 19\/11\/2026 a 09:30/,
    /reception prevue le 19\/11\/2026 a 10:30/,
    /depot relais des oliviers/,
  ],
  quai: [/18\/11\/2026/, /quai b propose/, /19\/11\/2026 avant 08:30/, /coordination de collecte/],
};
export function foodEvidenceValid(id, lines) {
  if (!Object.hasOwn(signals, id) || !Array.isArray(lines)) return false;
  const text = normalized(lines.join(' '));
  return signals[id].every((test) => test.test(text));
}

/** Regroupe uniquement les observations des pièces effectivement versées dans le lot. */
export function foodReport(extraction, retainedDate = null, corrections = []) {
  const ids = Object.keys(FOOD_FIXTURES).filter((id) => extraction[id]);
  for (const id of ids)
    if (!foodEvidenceValid(id, extraction[id].lines)) throw new Error('collecte:extraction_incomplete');
  const pieces = ids.map((id) => ({ id, file_name: FOOD_FIXTURES[id].name, created_at: '' }));
  const facts = [],
    events = [],
    deadlines = [],
    deadlineRows = [],
    preparation = [],
    missing_items = [];
  const quote = (id, pattern) => {
    const result = extraction[id]?.lines.find((line) => pattern.test(normalized(line)));
    if (!result) throw new Error('collecte:repere_absent');
    return [{ document_id: id, page: 1, quote: result }];
  };
  const cite = (id) => FOOD_FIXTURES[id].name + ', p. 1';
  const fact = (text, evidence) => facts.push({ text, status: 'documented', evidence });
  function event(label, evidence, kind = 'event_date') {
    const value = evidence[0].quote.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
    if (!value) throw new Error('collecte:date_absente');
    const date = iso(value);
    events.push({ date, precision: 'day', kind, label, evidence, key: deadlineKey(label, date) });
    return date;
  }
  function timed(title, ref, responsible) {
    const date = event(title, ref);
    const time = ref[0].quote.match(/\b\d{2}:\d{2}\b/)?.[0];
    if (!time) throw new Error('collecte:heure_absente');
    deadlines.push({
      title,
      date,
      time,
      kind: 'mentioned',
      basis: ref[0].quote,
      priority: 'normale',
      responsible,
      evidence: ref,
    });
    deadlineRows.push({
      title,
      ai_key: deadlineKey(title, date),
      due_date: date,
      due_time: time + ':00',
      priority: 'normale',
      done: false,
      user_edited: false,
      description: ref[0].quote,
    });
    return date;
  }
  let originalDate = null,
    date = null;
  let dateSource = 'Aucune date limite de confirmation du quai dans les pièces déposées.';
  const extractedDateSource = extraction.quai ? cite('quai') : null;
  const overrides = [];
  if (extraction.don) {
    fact('L’épicerie propose des pâtes sèches et des conserves de légumes.', quote('don', /don propose/));
    event('Émission de la proposition de don', quote('don', /proposition du/), 'document_date');
    event('Collecte prévue dans la proposition de don', quote('don', /date prevue de la collecte/));
    preparation.push({
      heading: 'Au point de départ',
      text:
        'Rendez-vous à la réserve de l’Épicerie des Amandiers, site fictif. La proposition de don reste à rapprocher du bon effectivement signé. [' +
        cite('don') +
        ']',
    });
  } else
    missing_items.push({
      text: 'Proposition de don',
      why: 'L’origine du don et l’accord initial ne sont pas documentés dans ce lot.',
    });
  if (extraction.inventaire) {
    fact(
      'L’inventaire prévoit 20 cartons, pour un poids total de 144 kg.',
      quote('inventaire', /total prevu/),
    );
    fact('Le lot comprend 12 cartons de pâtes de 6 kg (72 kg) et 8 cartons de conserves de 9 kg (72 kg).', [
      ...quote('inventaire', /12 cartons de 6 kg/),
      ...quote('inventaire', /8 cartons de 9 kg/),
    ]);
    event(
      'Établissement de l’inventaire prévisionnel',
      quote('inventaire', /inventaire prepare le/),
      'document_date',
    );
    preparation.push({
      heading: 'Comptage à la réception',
      text:
        'Prévision de chargement : 12 cartons de pâtes et 8 de conserves, soit 20 cartons et 144 kg. Relever les quantités reçues et noter les écarts sur le bon. [' +
        cite('inventaire') +
        ']',
    });
  } else
    missing_items.push({
      text: 'Inventaire des cartons',
      why: 'Le nombre de cartons et le poids prévu restent à vérifier.',
    });
  if (extraction.tournee) {
    const pickup = quote('tournee', /enlevement prevu le/);
    const arrival = quote('tournee', /reception prevue le/);
    fact('Enlèvement prévu à 09 h 30 et réception à 10 h 30 le 19 novembre 2026, heure de Marseille.', [
      ...pickup,
      ...arrival,
    ]);
    event('Envoi du courriel de préparation de tournée', quote('tournee', /message du/), 'document_date');
    timed('Enlèvement prévu à la réserve des Amandiers', pickup, 'Équipe de transport');
    timed('Réception prévue au dépôt relais des Oliviers', arrival, 'Équipe de réception');
    preparation.push({
      heading: 'Tournée du 19 novembre',
      text:
        'À 09 h 30, enlèvement à la réserve des Amandiers. À 10 h 30, réception au dépôt relais des Oliviers. Heures locales de Marseille. Confirmer l’accès avant le départ. [' +
        cite('tournee') +
        ']',
    });
  } else
    missing_items.push({
      text: 'Courriel de tournée',
      why: 'Les horaires d’enlèvement et de réception ne figurent pas dans ce lot.',
    });
  if (extraction.quai) {
    fact(
      'La fiche propose le quai B. Sa confirmation par la réception reste attendue.',
      quote('quai', /quai b propose/),
    );
    const label = 'Confirmation attendue du quai B';
    const ref = quote('quai', /confirmation du quai attendue/);
    originalDate = timed(label, ref, 'Coordination de collecte');
    const latest = corrections.at(-1);
    date = retainedDate || originalDate;
    dateSource = latest
      ? 'Date corrigée par ' +
        latest.author +
        ' · ' +
        latest.reason +
        ' (valeur extraite : ' +
        french(originalDate) +
        ' à 08 h 30, ' +
        cite('quai') +
        ').'
      : cite('quai') + ' · confirmation attendue avant 08 h 30 (Europe/Paris).';
    if (latest) {
      const row = deadlineRows.at(-1);
      row.due_date = date;
      row.user_edited = true;
      for (const c of corrections)
        overrides.push({
          event_key: deadlineKey(label, originalDate),
          retained_date: c.date,
          label: null,
          hidden: false,
          reason: c.reason,
          author: c.author,
          created_at: new Date(c.createdAt).toISOString(),
        });
    }
    preparation.push({
      heading: 'Accès au quai',
      text:
        'La coordination doit obtenir une confirmation écrite du quai B avant 08 h 30 le ' +
        french(date) +
        '. [' +
        dateSource +
        ']',
    });
    missing_items.push({
      text: 'Confirmation écrite du quai B',
      why: 'Le quai figure comme proposé sur la fiche numérisée. [' + cite('quai') + ']',
    });
  } else
    missing_items.push({
      text: 'Fiche de quai ou confirmation écrite de réception',
      why: 'Le quai et l’heure limite de confirmation restent à documenter.',
    });
  if (extraction.don)
    missing_items.push({
      text: 'Bon de remise et réception signé après la collecte',
      why:
        'La proposition de don prévoit un constat après remise. Le lot décrit une opération à venir. [' +
        cite('don') +
        ']',
    });
  const summary = [
    extraction.inventaire
      ? 'L’inventaire prévoit 20 cartons de denrées pour 144 kg.'
      : extraction.don
        ? 'L’épicerie propose un don de pâtes et de conserves pour la collecte du 19 novembre.'
        : 'Les pièces déposées décrivent la préparation de la collecte.',
    extraction.quai
      ? 'Le quai B reste à confirmer par la réception.'
      : extraction.tournee
        ? 'La tournée prévoit un enlèvement à 09 h 30 et une réception à 10 h 30, sans quai confirmé dans ce lot.'
        : 'Aucun créneau de réception confirmé ne figure dans ce lot.',
  ].join(' ');
  const action = extraction.quai
    ? 'Faire confirmer le quai B par la réception.'
    : 'Demander la fiche de quai et les consignes d’accès.';
  const subject = extraction.quai
    ? 'Collecte COL-19 · confirmation du quai B'
    : 'Collecte COL-19 · accès au point de réception';
  const body = extraction.quai
    ? `Bonjour,\n\nLa fiche de quai propose le quai B pour la collecte COL-19. Pouvez-vous confirmer le point d’accès à la coordination avant le ${french(date)} à 08 h 30 (heure de Marseille), ou nous indiquer un autre quai ?${extraction.tournee ? ' La réception est prévue à 10 h 30 le 19 novembre.' : ''}\n\nMerci,\nL’équipe de coordination (exercice fictif)`
    : 'Bonjour,\n\nPouvez-vous préciser le point de réception et le rôle à contacter pour accéder au quai de la collecte COL-19 ? Le lot reçu ne comporte pas la fiche de quai.\n\nMerci,\nL’équipe de coordination (exercice fictif)';
  const draft = 'Objet : ' + subject + '\n' + body;
  const analysis = {
    summary_short: summary,
    summary_long:
      summary +
      ' Les quantités et le calendrier décrivent une préparation de collecte fictive. Le lot ne comporte aucun bon attestant une remise effective.',
    action_owner: 'Coordination de collecte',
    parties: [],
    facts,
    deadlines,
    contradictions: [],
    missing_items,
    attention_points: ['Vérifier le quai avec la réception et consigner les quantités réellement remises.'],
    next_actions: [action],
    reminder_drafts: [
      {
        audience: 'third_party',
        subject,
        body,
        recipient_hint: 'Équipe de réception du dépôt relais, rôle fictif',
        suggested_date: null,
      },
    ],
    events,
  };
  return {
    title: FOOD_TITLE,
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
