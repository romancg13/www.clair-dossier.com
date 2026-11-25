// Prestations à la demande (brouillons, jamais envoyés ni publiés automatiquement) :
//  - 3 publications LinkedIn datées à partir d'un brief de communication ;
//  - demande groupée des justificatifs indispensables ;
//  - fiche de préparation de rendez-vous.
// Déterministe : aucune promesse de portée, créneaux qualifiés de « tests » sans données d'audience.

export interface BriefLinkedIn {
  cible: string;
  offre: string;
  ton: 'sobre' | 'chaleureux' | 'expert';
  zone: string;
  objectif: 'visites' | 'demandes' | 'notoriete';
  /** Données d'audience fournies par le client (facultatif) : créneaux observés comme performants. */
  audience?: { jour: number; heure: string }[];
  fuseau?: string;
}

export interface PostLinkedIn {
  accroche: string;
  texte: string;
  appel: string;
  hashtags: string[];
  jour: string;
  date: string;
  heure: string;
  fuseau: string;
  decalage: string;
  utc: string;
  raison: string;
  mesure: string;
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Décalage UTC d'un fuseau à une date donnée (« +01:00 » / « +02:00 » pour Paris). */
export function offsetAt(date: string, time: string, tz: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).formatToParts(new Date(guess));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asLocal = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  const off = Math.round((asLocal - guess) / 60000);
  const sign = off >= 0 ? '+' : '-';
  return `${sign}${String(Math.floor(Math.abs(off) / 60)).padStart(2, '0')}:${String(Math.abs(off) % 60).padStart(2, '0')}`;
}

function toUtc(date: string, time: string, offset: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const sign = offset[0] === '-' ? -1 : 1;
  const [oh, om] = offset.slice(1).split(':').map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh, mm) - sign * (oh * 60 + om) * 60000).toISOString();
}

const isoDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/** Prochaines dates (≥ J+2) tombant sur les jours de semaine demandés, dans l'ordre. */
function nextSlots(today: string, wanted: { jour: number; heure: string }[], count: number): { date: string; heure: string; jour: number }[] {
  const out: { date: string; heure: string; jour: number }[] = [];
  let t = Date.parse(`${today}T12:00:00Z`) + 2 * 86_400_000;
  let i = 0;
  while (out.length < count && i < 60) {
    const dow = new Date(t).getUTCDay();
    const slot = wanted[out.length % wanted.length];
    if (dow === slot.jour) out.push({ date: isoDay(t), heure: slot.heure, jour: dow });
    t += 86_400_000;
    i++;
  }
  return out;
}

const tags = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^A-Za-z0-9]+/).filter((w) => w.length > 3).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase());

export function postsLinkedIn(brief: BriefLinkedIn, today: string): PostLinkedIn[] {
  const tz = brief.fuseau ?? 'Europe/Paris';
  const tested = !brief.audience?.length;
  const slots = nextSlots(today, tested ? [{ jour: 2, heure: '08:30' }, { jour: 4, heure: '12:15' }, { jour: 2, heure: '17:30' }] : brief.audience!, 3);
  const appel = brief.objectif === 'demandes' ? 'Écrivez-nous pour en parler : réponse sous 48 h ouvrées.' : brief.objectif === 'visites' ? 'Le détail est sur notre site (lien en commentaire).' : 'Abonnez-vous pour suivre les prochains conseils.';
  const vous = brief.ton === 'chaleureux' ? 'Vous' : 'Vous';
  const bodies: { accroche: string; texte: string; raison: string }[] = [
    {
      accroche: `${brief.cible} : combien de temps passez-vous à retrouver une pièce ?`,
      texte: `${vous} connaissez la scène : un courrier arrive, une date approche, et le document utile est quelque part entre une boîte mail et un dossier partagé.\n\n${brief.offre} répond à ce problème simplement : un seul endroit, les dates importantes repérées, la prochaine action indiquée.\n\nPour les ${brief.cible.toLowerCase()} de ${brief.zone}, c'est du temps rendu au travail qui compte.`,
      raison: tested ? 'Créneau de test : début de matinée en semaine, avant les réunions.' : 'Créneau où votre audience est la plus présente selon vos données.',
    },
    {
      accroche: `Trois vérifications avant de répondre à une réclamation`,
      texte: `1. Le montant réclamé correspond-il au document de détail joint ?\n2. La date limite est-elle écrite, ou seulement supposée ?\n3. Manque-t-il une pièce citée (contrat, bail, devis) ?\n\nCe sont les trois points que ${brief.offre} met en avant dès le dépôt des pièces, avec la source de chaque information.`,
      raison: tested ? 'Créneau de test : pause de midi, lecture plus longue.' : 'Deuxième créneau le plus actif de votre audience.',
    },
    {
      accroche: `${brief.zone} : un dossier clair, sans y passer la soirée`,
      texte: `Nous accompagnons ${brief.cible.toLowerCase()} qui veulent savoir où en est chaque dossier sans tout relire.\n\nVous déposez vos pièces une fois ; vous retrouvez la situation, les dates et la prochaine action dans votre espace.`,
      raison: tested ? 'Créneau de test : fin de journée, consultation mobile.' : 'Troisième créneau de votre audience, pour comparer.',
    },
  ];
  const hashtagBase = [...new Set([...tags(brief.cible).slice(0, 1), ...tags(brief.zone).slice(0, 1), 'GestionDocumentaire', 'Organisation'])].slice(0, 4).map((t) => `#${t}`);
  return slots.map((s, i) => {
    const decalage = offsetAt(s.date, s.heure, tz);
    return {
      accroche: bodies[i].accroche,
      texte: bodies[i].texte,
      appel,
      hashtags: hashtagBase,
      jour: JOURS[s.jour],
      date: s.date,
      heure: s.heure,
      fuseau: tz,
      decalage,
      utc: toUtc(s.date, s.heure, decalage),
      raison: bodies[i].raison,
      mesure: brief.objectif === 'demandes' ? 'Suivre les demandes reçues dans les 7 jours.' : brief.objectif === 'visites' ? 'Suivre les visites du site issues de LinkedIn.' : 'Suivre les impressions et les nouveaux abonnés.',
    };
  });
}

export interface ViewLike {
  dossier: { title: string; as_of: string };
  tableau: { action: { label: string } };
  resume: { missing: { label: string; why: string }[]; contradictions: { text: string }[] };
  pieces: { name: string }[];
  /** Échéances confirmées à venir (jamais une date « à confirmer » : un brouillon n'affirme que ce qui est écrit). */
  echeances: { confirmed: { date: string; title: string }[] };
}

const fr = (iso: string) => iso.split('-').reverse().join('/');

export function demandeJustificatifs(v: ViewLike, destinataire: string): { objet: string; corps: string; elements: string[] } {
  const elements = [...v.resume.missing.map((m) => m.label), ...v.resume.contradictions.map((c) => `les justificatifs expliquant l'écart relevé (${c.text.replace(/\.$/, '')})`)].slice(0, 6);
  // Seule une échéance de réponse confirmée justifie la phrase : une proposition de rendez-vous ou une date
  // de paiement n'est pas une « réponse attendue ».
  const reponse = v.echeances.confirmed.find((d) => /r[ée]ponse|r[ée]pondre/i.test(d.title));
  const corps = `Bonjour,\n\nPour traiter le dossier « ${v.dossier.title} », pourriez-vous nous transmettre en une seule fois :\n${elements.map((e) => `- ${e}`).join('\n') || '- (aucun élément manquant relevé à ce jour)'}\n${reponse ? `\nUne réponse est attendue avant le ${fr(reponse.date)} : un envoi dans les prochains jours nous permettrait de la préparer.\n` : ''}\nMerci par avance.\n\nCordialement,`;
  return { objet: `Dossier « ${v.dossier.title} » : justificatifs à transmettre${destinataire ? ` (${destinataire})` : ''}`, corps, elements };
}

export function ficheRendezVous(v: ViewLike): { objectif: string; questions: string[]; pieces: string[] } {
  const questions = [
    ...v.resume.contradictions.map((c) => `Comment expliquez-vous cette différence : ${c.text.replace(/^Montants différents : |^Date différente pour /, '').replace(/\.$/, '')} ?`),
    ...v.resume.missing.map((m) => `Pouvez-vous nous remettre ${m.label} ?`),
    ...(v.echeances.confirmed[0] ? [`Quelles suites prévoyez-vous avant le ${fr(v.echeances.confirmed[0].date)} ?`] : []),
  ].slice(0, 3);
  while (questions.length < 3) questions.push(['Quel est le calendrier envisagé pour la suite ?', 'Quels documents vous manquent de notre côté ?', 'Qui est votre interlocuteur pour ce dossier ?'][questions.length]);
  return { objectif: `Faire le point sur « ${v.dossier.title} » et obtenir les éléments pour : ${v.tableau.action.label.toLowerCase()}.`, questions, pieces: v.pieces.map((p) => p.name).slice(0, 8) };
}
