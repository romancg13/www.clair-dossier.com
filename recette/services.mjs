// Prestations de recette : les textes de communication proviennent uniquement du brief.
const goals = new Set(['Demandes de devis', 'Visites du profil', 'Échanges en commentaire']);
const tones = new Set(['Direct', 'Pédagogique', 'Convivial']);
export const zones = ['Europe/Paris', 'America/Montreal', 'Indian/Reunion', 'UTC'];
const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function invalid(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}

function field(value, label, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max || /[\u0000-\u001F]/.test(value)) invalid(`Vérifiez le champ « ${label} ».`);
  return value.trim();
}

function hashtag(words) {
  return '#' + words.normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-zA-Z0-9]+/).filter(Boolean)
    .slice(0, 3).map(w => w[0].toUpperCase() + w.slice(1)).join('').slice(0, 38);
}

/** Returns a local publication date and an offset that follows the zone on that day. */
function slot(previous, weekday, hour, zone) {
  const date = new Date(previous + 'T12:00:00Z');
  do { date.setUTCDate(date.getUTCDate() + 1); } while (date.getUTCDay() !== weekday);
  const day = date.toISOString().slice(0, 10);
  const zoneLabel = new Intl.DateTimeFormat('fr-FR', { timeZone: zone, timeZoneName: 'shortOffset', hour: '2-digit' })
    .formatToParts(date).find(p => p.type === 'timeZoneName').value;
  return {
    date: day, day: dayNames[weekday], hour: String(hour).padStart(2, '0') + ':00', zone, offset: zoneLabel,
    display: new Intl.DateTimeFormat('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' }).format(date),
  };
}

export function linkedin(brief, now = new Date()) {
  const audience = field(brief.audience, 'Cible', 80);
  const offer = field(brief.offer, 'Offre', 140);
  const region = field(brief.region, 'Zone', 80);
  const { goal, tone, zone = 'Europe/Paris' } = brief;
  if (!goals.has(goal) || !tones.has(tone) || !zones.includes(zone)) invalid('Sélectionnez un objectif, un ton et un fuseau proposés.');
  const custom = brief.preferredDay !== undefined && brief.preferredDay !== null && brief.preferredDay !== '';
  const preferredDay = Number(brief.preferredDay), preferredHour = Number(brief.preferredHour);
  if (custom && (!Number.isInteger(preferredDay) || preferredDay < 0 || preferredDay > 6 ||
      !Number.isInteger(preferredHour) || preferredHour < 7 || preferredHour > 20)) invalid('Vérifiez le jour et l’heure relevés pour votre audience.');
  const metric = goal === 'Demandes de devis' ? 'demandes de devis reçues' : goal === 'Visites du profil' ? 'visites du profil' : 'commentaires et impressions';
  const openings = tone === 'Convivial'
    ? ['Et si on parlait de votre prochain projet ?', 'Un petit conseil avant de demander un devis.', 'Quel serait votre premier critère de choix ?']
    : tone === 'Pédagogique'
      ? ['Trois éléments pour cadrer votre besoin.', 'Comment comparer deux propositions ?', 'Du premier échange au cahier des charges.']
      : ['Avant de demander un devis, posez le cadre.', 'Un prix seul ne décrit pas une prestation.', 'Quelle décision voulez-vous pouvoir prendre ?'];
  const calls = goal === 'Demandes de devis'
    ? ['Écrivez-nous avec ces trois éléments pour demander un devis.', 'Envoyez-nous votre besoin pour demander une proposition détaillée.', 'Un devis vous serait utile ? Indiquez-nous votre priorité en message privé.']
    : goal === 'Visites du profil'
      ? ['Retrouvez notre présentation sur le profil.', 'Consultez notre profil pour préparer le premier échange.', 'Rendez-vous sur notre profil pour prendre contact.']
      : ['Quel élément précisez-vous en premier ? Dites-le en commentaire.', 'Quel critère ajoutez-vous à cette liste ?', 'Quelle question posez-vous avant de vous décider ?'];
  // Le brief prérempli décrit ce métier. N'utiliser ses détails que s'ils figurent dans le brief.
  const menuiseries = /menuiser/i.test(offer) && /syndic|copropri/i.test(audience);
  const paragraphs = menuiseries ? [
    `Vous préparez la rénovation des fenêtres d'une copropriété ? Vous envisagez la prestation « ${offer} » ? Commencez par repérer les fenêtres concernées, celles dont la fermeture pose problème et les contraintes d’accès. Dans le secteur de ${region}, ce premier relevé permet de préparer les questions à poser sur place.`,
    `Deux propositions pour le même immeuble peuvent couvrir des interventions différentes. L’une prévoit-elle les finitions ? L’autre inclut-elle les protections des parties communes ? Pour un projet de copropriété, la prestation « ${offer} » est l’occasion de poser ces questions avant d’inscrire un montant à l’ordre du jour.`,
    `Avant une réunion de copropriété, essayez de formuler la décision attendue en une seule phrase. S’agit-il de faire examiner des menuiseries qui ferment mal, de comparer des solutions ou de chiffrer des travaux ? Si votre projet porte sur « ${offer} » dans le secteur de ${region}, ajoutez cette phrase à votre demande : elle donnera un cap au premier échange.`,
  ] : [
    `Vous représentez le public « ${audience} » et vous envisagez « ${offer} » dans le secteur de ${region} ? Pour préparer le premier échange, indiquez ce que vous souhaitez obtenir, votre échéance et la contrainte qui compte le plus pour vous.`,
    `Vous envisagez « ${offer} » dans le secteur de ${region} ? Notez sur une même feuille le périmètre prévu, ce qui reste à votre charge et les délais proposés. Cette comparaison aide à repérer ce qu’il reste à demander.`,
    `Quand on prépare un projet, une question change souvent la discussion : qu’est-ce qui vous ferait dire que le résultat vous convient ? Pour notre offre « ${offer} », nous proposons de partir de ce critère lors du premier échange avec le public « ${audience} ».`,
  ];
  const labels = [...new Set([hashtag(region), hashtag(audience), goal === 'Demandes de devis' ? '#Devis' : '#Projet'])].filter(tag => tag.length > 1);
  let previous = new Intl.DateTimeFormat('sv-SE', { timeZone: zone }).format(now);
  return {
    title: 'Trois brouillons LinkedIn', metric, audience, channel: 'Aucune publication automatique',
    posts: paragraphs.map((paragraph, index) => {
      const when = slot(previous, custom ? preferredDay : [2, 4, 2][index], custom ? preferredHour : [8, 12, 17][index], zone);
      previous = when.date;
      const reason = custom
        ? `Créneau relevé pour « ${audience} » dans votre brief. Comparez les ${metric} sur ces trois dates.`
        : [`Créneau test pour « ${audience} » : mesurer la réponse en début de journée.`, `Créneau test à la pause de midi pour « ${audience} » : comparer les ${metric} au premier post.`, `Créneau test en fin de journée pour « ${audience} » : comparer la réponse aux deux horaires précédents.`][index];
      return { text: [openings[index], paragraph, calls[index], labels.join(' ')].join('\n\n'), when, reason };
    }),
  };
}

function prepare(kind, analysis) {
  if (!analysis) invalid('Déposez et faites traiter les pièces fictives de ce dossier.', 409);
  if (kind === 'justificatifs') {
    return {
      title: 'Demande groupée de justificatifs',
      text: analysis.missing_items.length
        ? 'Bonjour,\n\nPour compléter le dossier, pourriez-vous joindre les éléments suivants ?\n\n' +
          analysis.missing_items.map(m => `• ${m.text} — ${m.why}`).join('\n') +
          '\n\nSi un élément est indisponible, indiquez-le simplement. Merci.'
        : 'Aucune pièce indispensable supplémentaire n’a été identifiée dans le lot traité.',
    };
  }
  const action = analysis.next_actions[0] || 'Faire le point sur la suite du dossier';
  const questions = [
    `Qui prend en charge la prochaine action (« ${action} ») ?`,
    analysis.deadlines.length ? `Quelle pièce permet de confirmer la date de « ${analysis.deadlines[0].title} » ?` : 'Une date doit-elle être confirmée auprès d’un interlocuteur ?',
    analysis.missing_items.length ? `Comment obtenir « ${analysis.missing_items[0].text} » ?` : 'Quel document conserver pour attester de la prochaine étape ?',
  ];
  return {
    title: 'Fiche de préparation du rendez-vous',
    text: `Objectif\n${action}\n\nTrois questions\n${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\nPièces à apporter\n${analysis.missing_items.length ? analysis.missing_items.map(m => '• ' + m.text + ' (si disponible)').join('\n') : 'La dernière synthèse et les pièces auxquelles elle renvoie.'}`,
  };
}

export function handleServices({ method, body, db, session, analysis }) {
  db.exec(`CREATE TABLE IF NOT EXISTS recipe_services (
    dossier TEXT NOT NULL REFERENCES dossiers(id) ON DELETE CASCADE,
    kind TEXT NOT NULL, content TEXT NOT NULL, updated TEXT NOT NULL,
    PRIMARY KEY(dossier, kind))`);
  const id = session.dossierId;
  if (method === 'POST') {
    if (!['linkedin', 'justificatifs', 'rendezvous'].includes(body?.kind)) invalid('Format de prestation inconnu.');
    const result = body.kind === 'linkedin' ? linkedin(body.brief ?? {}) : prepare(body.kind, analysis);
    db.prepare(`INSERT INTO recipe_services(dossier,kind,content,updated) VALUES (?,?,?,?)
      ON CONFLICT(dossier,kind) DO UPDATE SET content=excluded.content,updated=excluded.updated`)
      .run(id, body.kind, JSON.stringify(result), new Date().toISOString());
  }
  return { services: db.prepare('SELECT kind,content,updated FROM recipe_services WHERE dossier=? ORDER BY updated DESC').all(id)
    .map(r => ({ kind: r.kind, updated: r.updated, result: JSON.parse(r.content) })) };
}
