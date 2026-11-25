// Les six livrables ClairDossier, générés depuis UNE base structurée
// (analyse consolidée + chronologie déterministe + corrections humaines).
// Partagé par `ai-worker` (Deno, via deno.json) et le site (démo navigateur) ;
// testé sous Node (tests/deliverables.test.ts). Aucun HTML/JS produit par le
// modèle n'est exécuté : tout passe par des gabarits maîtrisés.
//
// La partie PURE (catalogue, types, chronologie, corrections, libellés) vit
// dans analysis-model.ts — importée par le site sans embarquer pdf-lib — et
// reste ré-exportée ici : l'API du worker et des tests est inchangée.
import { C, CW, Charte, type Cell, type ListBlock, type Piece, type TimelineItem } from './pdf-charte.ts';
import { buildIcs, deadlineKey, toCsv } from './ai-pipeline.ts';
import { buildDocx, buildXlsx, type DocBlock } from './office.ts';
import {
  DELIVERABLE_CATALOG,
  KIND_LABEL,
  FACT_LABEL,
  applyOverrides,
  coverageLabel,
  frDate,
  sources,
  type AnalysisData,
  type CoverageInfo,
  type DeadlineRow,
  type DeliverableKey,
  type EventOverride,
  type PieceRef,
  type RetainedEvent,
} from './analysis-model.ts';

export * from './analysis-model.ts';

/* ── Génération des livrables ───────────────────────────────────────────── */

export interface OutFile {
  key: DeliverableKey;
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export interface DeliverableInput {
  title: string;
  revision: number;
  generatedAt: Date;
  analysis: AnalysisData;
  coverage: CoverageInfo;
  pieces: PieceRef[];
  overrides?: EventOverride[];
  /** Échéances en base (corrections humaines et ajouts manuels) ; à défaut, celles de l'analyse. */
  deadlineRows?: DeadlineRow[];
  demo?: boolean;
}

export const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  ics: 'text/calendar;charset=utf-8',
} as const;

type MergedDeadline = { title: string; date: string | null; time: string | null; origin: string; basis: string; priority: string; sources: string; done: boolean; uid: string };

function mergeDeadlines(a: AnalysisData, rows: DeadlineRow[] | undefined, names: Map<string, string>): MergedDeadline[] {
  const fromAnalysis = a.deadlines.map((d) => ({
    title: d.title, date: d.date, time: null as string | null, origin: KIND_LABEL[d.kind], basis: d.basis, priority: d.priority,
    sources: sources(d.evidence, names), done: false, uid: d.date ? deadlineKey(d.title, d.date) : `nd-${deadlineKey(d.title, '0000')}`,
  }));
  if (!rows) return fromAnalysis;
  const byKey = new Map(fromAnalysis.map((d) => [d.uid, d]));
  const out: MergedDeadline[] = fromAnalysis.filter((d) => !d.date); // dates à déterminer : uniquement dans l'analyse
  for (const r of rows) {
    const base = r.ai_key ? byKey.get(r.ai_key) : undefined;
    out.push({
      title: r.title, date: r.due_date, time: r.due_time, priority: r.priority, done: r.done, uid: r.ai_key ?? deadlineKey(r.title, r.due_date),
      origin: !r.ai_key ? 'Ajoutée manuellement' : r.user_edited ? `${base?.origin ?? 'Échéance détectée'} — corrigée par vous` : (base?.origin ?? 'Échéance détectée'),
      basis: base?.basis ?? r.description ?? '', sources: base?.sources ?? '—',
    });
  }
  return out.sort((x, y) => (x.date ?? '9999').localeCompare(y.date ?? '9999'));
}

/* ── Rendu PDF : six compositions dans une même charte (pdf-charte.ts) ──── */

/** Données communes aux compositions : mêmes objets que pour XLSX, CSV, ICS et DOCX. */
interface Ctx {
  a: AnalysisData;
  cov: CoverageInfo;
  pieces: PieceRef[];
  names: Map<string, string>;
  events: RetainedEvent[];
  visible: RetainedEvent[];
  overrides: EventOverride[];
  deadlines: MergedDeadline[];
  upcoming: MergedDeadline[];
  today: string;
  stamp: string;
  legal: string;
  /** Ouvre un document à la charte (logo, bandeau, couverture, pied de page). */
  doc: (key: DeliverableKey, title: string) => Promise<Charte>;
}

const PDF_FOOT = 'Document généré automatiquement (IA) à partir des pièces du dossier — à vérifier ; ne constitue pas un conseil juridique.';
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n > 1 ? many : one}`;
const FACT_TONE = { documented: 'navy', asserted_by_party: 'cream', inferred: 'outline', missing: 'gold' } as const;

/** 1. Résumé : l'essentiel d'abord (situation, faits clés, vigilance, prochaine action), détails en annexe. */
async function resumePdf(x: Ctx): Promise<Uint8Array> {
  const { a, names } = x;
  const c = await x.doc('resume', 'Résumé du dossier');
  const fact = (f: AnalysisData['facts'][number]) => ({ text: f.text, tag: FACT_LABEL[f.status], tone: FACT_TONE[f.status], sub: `Source : ${sources(f.evidence, names)}` });
  c.panel('encadre-situation', [
    { text: 'LA SITUATION EN BREF', size: 7.5, font: c.f.bold, color: C.gold700, emph: false },
    { text: a.summary_short, size: 11.5, before: 5 },
  ], { bg: C.cream50, bar: C.gold });
  c.section('Faits clés');
  if (a.facts.length) c.numbered(a.facts.slice(0, 5).map(fact));
  else c.text('Aucun fait relevé dans les pièces exploitées.', { color: C.slate });
  if (a.attention_points.length || a.contradictions.length) {
    c.gap(4);
    c.panel('encadre-vigilance', [
      { text: 'VIGILANCE', size: 7.5, font: c.f.bold, color: C.gold700, emph: false },
      ...a.attention_points.map((t, i): Piece => ({ text: `•  ${t}`, size: 9.8, before: i ? 4 : 6 })),
      ...a.contradictions.map((k): Piece => ({ text: `•  Contradiction entre pièces : ${k.text}`, size: 9.8, before: 4 })),
    ], { bg: C.white, border: C.gold, bar: C.gold700 });
  }
  if (a.next_actions.length) {
    c.panel('encadre-action', [
      { text: 'PROCHAINE ACTION', size: 7.5, font: c.f.bold, color: C.gold300, emph: false },
      { text: a.next_actions[0], size: 12, font: c.f.bold, color: C.white, before: 5 },
      ...(a.next_actions.length > 1 ? [{ text: 'ENSUITE', size: 7, font: c.f.bold, color: C.gold300, before: 9, emph: false } as Piece] : []),
      ...a.next_actions.slice(1).map((t, i): Piece => ({ text: `${i + 2}.  ${t}`, size: 9.5, color: C.cream100, before: 3 })),
    ], { bg: C.navy, bar: C.gold });
  }

  c.annex('Annexes — détails et sources');
  c.section('Synthèse détaillée');
  c.text(a.summary_long, { size: 9.8 });
  c.section('Parties');
  if (a.parties.length) {
    c.table([{ label: 'Partie', w: 150 }, { label: 'Rôle', w: 170 }, { label: 'Source', w: CW - 320 }], a.parties.map((p): Cell[] => [
      [{ text: p.name, size: 8.8, font: c.f.bold, color: C.navy }],
      p.role,
      [{ text: sources(p.evidence, names), size: 7.8, color: C.slate, emph: false }],
    ]));
  } else c.text('Aucune partie identifiée.', { color: C.slate });
  if (a.facts.length > 5) {
    c.section('Autres faits relevés');
    c.numbered(a.facts.slice(5).map(fact), 6);
  }
  c.section('Contradictions entre pièces');
  if (a.contradictions.length) c.bullets(a.contradictions.map((k) => ({ text: k.text, sub: `Sources : ${sources(k.evidence, names)}` })));
  else c.text('Aucune contradiction relevée entre les pièces exploitées.', { color: C.slate });
  c.section('Éléments manquants');
  if (a.missing_items.length) c.bullets(a.missing_items.map((m) => ({ text: m.text, sub: m.why })));
  else c.text('Aucun.', { color: C.slate });
  c.section(`Pièces exploitées (${x.pieces.length})`);
  const half = Math.ceil(x.pieces.length / 2);
  const ref = (i: number): Cell[] => (x.pieces[i] ? [[{ text: String(i + 1), size: 7.8, color: C.slate, emph: false }], [{ text: x.pieces[i].file_name, size: 8.4, emph: false }]] : ['', '']);
  c.table([{ label: 'N°', w: 28 }, { label: 'Pièce', w: CW / 2 - 28 }, { label: 'N°', w: 28 }, { label: 'Pièce', w: CW / 2 - 28 }], Array.from({ length: half }, (_, i) => [...ref(i), ...ref(i + half)]), 'tableau-pieces');
  c.note(x.legal);
  return c.finish();
}

/** 2. Dashboard : tuiles d'indicateurs réels, jauge de couverture, prochaine échéance, listes en colonnes. */
async function dashboardPdf(x: Ctx): Promise<Uint8Array> {
  const { a, cov, upcoming } = x;
  const c = await x.doc('dashboard', 'Tableau de bord du dossier');
  const next = upcoming[0];
  c.tiles([
    { value: `${cov.extracted}/${cov.total}`, label: 'pièces exploitées', sub: cov.complete ? 'analyse complète' : 'analyse partielle' },
    { value: String(upcoming.length), label: 'échéances à venir', sub: next ? `prochaine : ${frDate(next.date)}` : 'aucune à ce jour' },
    { value: String(a.contradictions.length), label: 'contradictions relevées', sub: 'entre pièces du dossier' },
    { value: String(a.missing_items.length), label: 'éléments manquants', sub: 'à compléter' },
  ]);
  c.gauge(`Couverture documentaire : ${plural(cov.extracted, 'pièce exploitée', 'pièces exploitées')} sur ${cov.total}`, cov.total ? cov.extracted / cov.total : 0);
  c.text(`${plural(x.visible.length, 'événement daté', 'événements datés')}  ·  ${a.facts.filter((f) => f.status === 'documented').length}/${a.facts.length} faits documentés  ·  ${plural(a.reminder_drafts.length, 'projet', 'projets')} de relance`, { size: 8.5, color: C.slate, emph: false });
  c.gap(12);
  if (next?.date) {
    const days = Math.round((Date.parse(next.date.slice(0, 10)) - Date.parse(x.today)) / 86_400_000);
    c.panel('encadre-prochaine-echeance', [
      { text: 'PROCHAINE ÉCHÉANCE', size: 7.5, font: c.f.bold, color: C.gold300, emph: false },
      { text: `${frDate(next.date)}${next.time ? ` à ${next.time.slice(0, 5)}` : ''} — ${next.title}`, size: 12.5, font: c.f.bold, color: C.white, before: 5 },
      { text: `${next.origin}  ·  priorité ${next.priority}${Number.isFinite(days) ? `  ·  ${days <= 0 ? 'aujourd’hui' : `dans ${plural(days, 'jour')}`}` : ''}`, size: 8.5, color: C.cream100, before: 4, emph: false },
    ], { bg: C.navy, bar: C.gold });
  }
  c.section('En bref');
  c.text(a.summary_short, { size: 10 });

  const more = (n: number, where: string) => (n > 6 ? [{ text: `… et ${n - 6} de plus — voir « ${where} ».` }] : []);
  const blocks: ListBlock[] = [
    { title: 'Prochaines échéances', empty: 'Aucune échéance à venir.', items: [...upcoming.slice(0, 6).map((d) => ({ text: `${frDate(d.date)} — ${d.title}`, sub: d.origin })), ...more(upcoming.length, 'Échéances et calendrier')] },
    { title: 'Points d’attention', empty: 'Aucun.', items: [...a.attention_points.slice(0, 6).map((t) => ({ text: t })), ...more(a.attention_points.length, 'Résumé du dossier')] },
    { title: 'Pièces manquantes', empty: 'Aucune.', items: a.missing_items.map((m) => ({ text: m.text })) },
    { title: 'Derniers ajouts', empty: 'Aucune pièce.', items: [...x.pieces].sort((p, q) => q.created_at.localeCompare(p.created_at)).slice(0, 5).map((p) => ({ text: p.file_name, sub: `déposée le ${frDate(p.created_at.slice(0, 10))}` })) },
  ];
  for (const pair of [[blocks[0], blocks[1]], [blocks[2], blocks[3]]] as [ListBlock, ListBlock][]) {
    if (c.columns(pair)) continue;
    // Listes trop longues pour tenir côte à côte : repli en rubriques successives.
    for (const b of pair) {
      c.section(b.title);
      if (b.items.length) c.bullets(b.items);
      else c.text(b.empty, { color: C.slate });
    }
  }
  c.note(`${coverageLabel(cov)}. ${x.legal}`);
  return c.finish();
}

/** 3. Chronologie : frise verticale regroupée par mois, sources sous chaque événement. */
async function chronologiePdf(x: Ctx): Promise<Uint8Array> {
  const { visible, names } = x;
  const c = await x.doc('chronologie', 'Chronologie');
  const edited = visible.filter((e) => e.edited).length;
  const approx = visible.filter((e) => e.precision !== 'day').length;
  c.text(`Événements (${visible.length})${visible.length ? ` — du ${frDate(visible[0].retained_date)} au ${frDate(visible[visible.length - 1].retained_date)}` : ''}`, { size: 12, font: c.f.bold, color: C.navy });
  c.gap(2);
  c.text(`${plural(edited, 'date corrigée', 'dates corrigées')} par vous  ·  ${plural(approx, 'date approximative', 'dates approximatives')}`, { size: 8.5, color: C.slate, emph: false });
  c.text('Pastille pleine : événement  ·  pastille vide : date portée par un document  ·  pastille or : date corrigée par vous', { size: 7.8, color: C.slate, emph: false });
  c.gap(14);
  if (!visible.length) c.text('Aucun événement daté dans les pièces exploitées.', { color: C.slate });
  c.timeline(visible.map((e): TimelineItem => ({
    iso: e.retained_date || e.date,
    date: frDate(e.retained_date),
    hint: e.precision !== 'day' ? 'approx.' : undefined,
    label: e.retained_label,
    detail: [
      e.kind === 'document_date' ? 'Date du document' : 'Événement',
      ...(e.edited ? [`date corrigée (extraite : ${frDate(e.date)}${e.reason ? ` ; motif : ${e.reason}` : ''})`] : []),
      `Source : ${sources(e.evidence, names)}`,
    ].join('  ·  '),
    marker: e.edited ? 'edited' : e.kind === 'document_date' ? 'document' : 'event',
  })));
  c.note('Les dates approximatives restent indiquées comme telles ; une date corrigée par vous prévaut sur la date extraite (historique dans « Dates modifiables »).');
  return c.finish();
}

/**
 * 4. Dates modifiables : tableau date extraite / date retenue / motif / auteur, puis historique.
 * Le livrable catalogué reste XLSX + CSV (formats modifiables) ; cette composition
 * imprimable n'est PAS ajoutée aux 13 fichiers générés — elle est exposée pour un
 * aperçu ou un export à la demande, sur décision produit.
 */
async function datesPdf(x: Ctx): Promise<Uint8Array> {
  const { events, names } = x;
  const c = await x.doc('dates', 'Dates modifiables');
  const edited = events.filter((e) => e.edited && !e.hidden).length;
  const hidden = events.filter((e) => e.hidden).length;
  c.text(`${plural(events.length, 'date')} : ${plural(edited, 'corrigée')} par vous, ${plural(hidden, 'masquée')}, ${events.length - edited - hidden} telle(s) qu’extraite(s)`, { size: 11, font: c.f.bold, color: C.navy, emph: false });
  c.gap(2);
  c.text('La date retenue prévaut dans la chronologie ; la date extraite de la pièce est toujours conservée. Les corrections se font dans le fichier XLSX ou dans votre espace.', { size: 8.5, color: C.slate, emph: false });
  c.gap(12);
  const small = (text: string): Piece[] => [{ text, size: 8, emph: false }];
  c.table(
    [{ label: 'Extraite', w: 60 }, { label: 'Retenue', w: 60 }, { label: 'Événement et source', w: CW - 336 }, { label: 'Statut', w: 52 }, { label: 'Motif', w: 92 }, { label: 'Auteur', w: 72 }],
    events.map((e): Cell[] => [
      [{ text: frDate(e.date), size: 8.6, color: e.edited ? C.slate : C.ink, emph: false }],
      [{ text: frDate(e.retained_date), size: 8.8, font: c.f.bold, color: e.edited ? C.gold700 : C.navy }],
      [{ text: e.retained_label, size: 8.6 }, { text: sources(e.evidence, names), size: 7.2, color: C.slate, emph: false, before: 1 }],
      [{ text: e.hidden ? 'masquée' : e.edited ? 'corrigée' : 'extraite', size: 8, font: e.edited || e.hidden ? c.f.bold : c.f.reg, color: e.edited ? C.gold700 : C.slate }],
      small(e.reason ?? ''),
      [{ text: e.author ?? '', size: 8, emph: false }, ...(e.edited_at ? [{ text: `le ${frDate(e.edited_at.slice(0, 10))}`, size: 7.2, color: C.slate, emph: false } as Piece] : [])],
    ]),
    'tableau-corrections',
  );
  const history = [...x.overrides].sort((p, q) => p.created_at.localeCompare(q.created_at));
  c.section(`Historique des corrections (${history.length})`);
  if (history.length) {
    const label = new Map(events.map((e) => [e.key, e.label]));
    c.table(
      [{ label: 'Horodatage (UTC)', w: 84 }, { label: 'Événement', w: CW - 364 }, { label: 'Date retenue', w: 62 }, { label: 'Masquage', w: 50 }, { label: 'Motif', w: 98 }, { label: 'Auteur', w: 70 }],
      history.map((o): Cell[] => [small(o.created_at.replace('T', ' ').slice(0, 16)), small(o.label ?? label.get(o.event_key) ?? o.event_key), [{ text: frDate(o.retained_date), size: 8.4, font: c.f.bold, color: C.navy }], small(o.hidden ? 'masquée' : ''), small(o.reason), small(o.author)]),
      'tableau-historique',
    );
  } else c.text('Aucune correction enregistrée : toutes les dates sont celles extraites des pièces.', { color: C.slate });
  c.note('Chaque correction est conservée avec son motif et son auteur ; aucune date extraite n’est effacée.');
  return c.finish();
}

/** 5. Échéances : un tableau par statut (mentionnée, calculée, hypothèse, autres). */
async function echeancesPdf(x: Ctx): Promise<Uint8Array> {
  const { deadlines } = x;
  const c = await x.doc('echeances', 'Échéances et calendrier');
  const known = Object.values(KIND_LABEL);
  const groups = [
    { label: 'Dates mentionnées dans les pièces', short: 'mentionnée(s) dans les pièces', hint: 'figurent telles quelles dans une pièce', tone: 'navy', list: deadlines.filter((d) => d.origin.startsWith(KIND_LABEL.mentioned)) },
    { label: 'Dates calculées', short: 'calculée(s)', hint: 'déduites d’un délai indiqué dans une pièce', tone: 'gold', list: deadlines.filter((d) => d.origin.startsWith(KIND_LABEL.computed)) },
    { label: 'Hypothèses à confirmer par un professionnel', short: 'hypothèse(s) à confirmer', hint: 'non validées juridiquement', tone: 'cream', list: deadlines.filter((d) => d.origin.startsWith(KIND_LABEL.hypothesis)) },
    { label: 'Échéances détectées ou ajoutées', short: 'détectée(s) ou ajoutée(s)', hint: 'saisies ou détectées hors analyse', tone: 'outline', list: deadlines.filter((d) => !known.some((k) => d.origin.startsWith(k))) },
  ] as const;
  c.text(`${plural(deadlines.length, 'échéance')}, dont ${plural(x.upcoming.length, 'à venir', 'à venir')}`, { size: 12, font: c.f.bold, color: C.navy, emph: false });
  c.gap(2);
  c.text(groups.filter((g) => g.list.length).map((g) => `${g.list.length} ${g.short}`).join('  ·  ') || 'Aucune échéance relevée dans les pièces exploitées.', { size: 8.5, color: C.slate, emph: false });
  const cols = [{ label: 'Date', w: 82 }, { label: 'Échéance, base et source', w: CW - 82 - 64 - 62 }, { label: 'Priorité', w: 64 }, { label: 'État', w: 62 }];
  for (const g of groups) {
    if (!g.list.length) continue;
    c.groupBand(g.label, g.list.length, g.hint, g.tone);
    c.table(cols, g.list.map((d): Cell[] => [
      [{ text: `${frDate(d.date)}${d.time ? `\n${d.time.slice(0, 5)}` : ''}`, size: 9.4, font: c.f.bold, color: C.navy }],
      [
        { text: d.title, size: 9.2, font: c.f.bold, color: C.navy },
        { text: `${d.origin}${d.basis ? ` — ${d.basis}` : ''}`, size: 8.2, before: 2 },
        { text: `Source : ${d.sources}`, size: 7.4, color: C.slate, emph: false, before: 2 },
      ],
      [{ text: d.priority, size: 8.4, font: d.priority === 'haute' ? c.f.bold : c.f.reg, color: d.priority === 'haute' ? C.gold700 : C.ink }],
      [{ text: d.done ? 'terminée' : 'à venir', size: 8.4, color: d.done ? C.slate : C.ink }],
    ]), 'tableau-echeances');
  }
  c.note('Une date calculée ou une hypothèse n’est pas une date juridiquement validée. Le calendrier ICS joint s’importe dans Outlook, Google Agenda ou Calendrier (dates sans heure conservées comme journées entières).');
  return c.finish();
}

/** 6. Relances : une carte par projet de message (objet, destinataire proposé, message). */
async function relancesPdf(x: Ctx): Promise<Uint8Array> {
  const drafts = x.a.reminder_drafts;
  const c = await x.doc('relances', 'Relances — projets de messages');
  c.panel('bandeau-brouillons', [
    { text: 'BROUILLONS — AUCUN ENVOI AUTOMATIQUE', size: 8.5, font: c.f.bold, color: C.navy, emph: false },
    { text: 'Ces messages sont des projets à relire et à adapter. ClairDossier n’envoie rien : tout envoi reste votre décision.', size: 9, before: 3, emph: false },
  ], { bg: C.cream50, border: C.gold, pad: 11 });
  const own = drafts.filter((r) => r.audience === 'client').length;
  c.text(`${plural(drafts.length, 'projet')} : ${own} pour vous  ·  ${drafts.length - own} vers un tiers (à valider avant tout envoi)`, { size: 8.5, color: C.slate, emph: false });
  if (!drafts.length) c.text('Aucun projet de relance proposé pour ce dossier.', { color: C.slate });
  drafts.forEach((r, i) => c.message({
    n: i + 1,
    audience: r.audience === 'client' ? 'Pour vous' : 'Vers un tiers — à valider avant tout envoi',
    when: r.suggested_date ? `Prévu le ${frDate(r.suggested_date)}` : 'Date à définir',
    subject: r.subject,
    to: r.recipient_hint,
    body: r.body,
  }));
  c.note('Les courriers adressés à des tiers (mise en demeure, reconnaissance, renonciation…) sont des projets : ils ne sont jamais envoyés par ClairDossier et doivent être relus, au besoin par un professionnel du droit.');
  return c.finish();
}

/** Prépare les données communes (corrections appliquées, échéances fusionnées) et la fabrique de documents. */
function context(input: DeliverableInput): Ctx {
  const { analysis: a, coverage: cov, revision: rev, title, demo = false } = input;
  const names = new Map(input.pieces.map((p) => [p.id, p.file_name]));
  const stamp = input.generatedAt.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const events = applyOverrides(a.events, input.overrides ?? []);
  const deadlines = mergeDeadlines(a, input.deadlineRows, names);
  const today = input.generatedAt.toISOString().slice(0, 10);
  return {
    a, cov, names, stamp, events, deadlines, today,
    pieces: input.pieces,
    visible: events.filter((e) => !e.hidden),
    overrides: input.overrides ?? [],
    upcoming: deadlines.filter((d) => !d.done && d.date && d.date >= today),
    legal: 'Document généré automatiquement par ClairDossier à partir des pièces déposées. Il doit être vérifié et ne constitue ni un conseil ni un acte juridique.',
    doc: (key, docTitle) => {
      const i = DELIVERABLE_CATALOG.findIndex((d) => d.key === key);
      return Charte.create({
        title: docTitle,
        kicker: `Document ${i + 1}/${DELIVERABLE_CATALOG.length} · ${DELIVERABLE_CATALOG[i].label}`,
        dossier: title,
        meta: `Révision ${rev} · généré le ${stamp}`,
        coverage: coverageLabel(cov),
        partial: !cov.complete,
        demo,
        legal: PDF_FOOT,
      });
    },
  };
}

/** Composition imprimable « Dates modifiables » (hors catalogue : voir datesPdf). */
export function buildDatesPdf(input: DeliverableInput): Promise<Uint8Array> {
  return datesPdf(context(input));
}

export async function buildDeliverables(input: DeliverableInput): Promise<OutFile[]> {
  const { analysis: a, coverage: cov, revision: rev, title } = input;
  const ctx = context(input);
  const { names, events, visible, deadlines, legal } = ctx;
  const sub = `${title} — révision ${rev} — ${ctx.stamp} — ${coverageLabel(cov)}`;
  const enc = new TextEncoder();
  const name = (key: DeliverableKey, ext: string) => `${DELIVERABLE_CATALOG.find((d) => d.key === key)!.slug}-r${rev}.${ext}`;
  const files: OutFile[] = [];

  // 1. Résumé IA (PDF + DOCX)
  const resume: DocBlock[] = [
    { kind: 'title', text: 'Résumé du dossier' },
    { kind: 'subtitle', text: sub },
    { kind: 'heading', text: 'En bref' },
    { kind: 'para', text: a.summary_short },
    { kind: 'heading', text: 'Synthèse détaillée' },
    { kind: 'para', text: a.summary_long },
    { kind: 'heading', text: 'Parties' },
    ...a.parties.map((p): DocBlock => ({ kind: 'bullet', text: `${p.name} — ${p.role} [${sources(p.evidence, names)}]` })),
    { kind: 'heading', text: 'Faits' },
    ...a.facts.map((f): DocBlock => ({ kind: 'bullet', text: `[${FACT_LABEL[f.status]}] ${f.text} [${sources(f.evidence, names)}]` })),
    { kind: 'heading', text: 'Points d’attention' },
    ...a.attention_points.map((t): DocBlock => ({ kind: 'bullet', text: t })),
    { kind: 'heading', text: 'Contradictions entre pièces' },
    ...(a.contradictions.length ? a.contradictions.map((c): DocBlock => ({ kind: 'bullet', text: `${c.text} [${sources(c.evidence, names)}]` })) : [{ kind: 'para', text: 'Aucune contradiction relevée entre les pièces exploitées.' } as DocBlock]),
    { kind: 'heading', text: 'Éléments manquants' },
    ...(a.missing_items.length ? a.missing_items.map((m): DocBlock => ({ kind: 'bullet', text: `${m.text} — ${m.why}` })) : [{ kind: 'para', text: 'Aucun.' } as DocBlock]),
    { kind: 'heading', text: 'Prochaines actions proposées' },
    ...a.next_actions.map((t): DocBlock => ({ kind: 'bullet', text: t })),
    { kind: 'heading', text: 'Pièces exploitées' },
    ...input.pieces.map((p): DocBlock => ({ kind: 'bullet', text: p.file_name })),
    { kind: 'note', text: legal },
  ];
  files.push({ key: 'resume', name: name('resume', 'pdf'), mime: MIME.pdf, bytes: await resumePdf(ctx) });
  files.push({ key: 'resume', name: name('resume', 'docx'), mime: MIME.docx, bytes: buildDocx(resume, `Résumé — ${title}`) });

  // 2. Dashboard (PDF ; la version interactive est l'onglet DashBoard de l'espace client)
  files.push({ key: 'dashboard', name: name('dashboard', 'pdf'), mime: MIME.pdf, bytes: await dashboardPdf(ctx) });

  // 3. Chronologie (PDF + XLSX + CSV)
  const chronoRows = visible.map((e) => [frDate(e.retained_date), frDate(e.date), e.precision === 'day' ? 'jour' : e.precision === 'month' ? 'mois' : e.precision === 'year' ? 'année' : 'inconnue', e.kind === 'document_date' ? 'Date du document' : 'Événement', e.retained_label, sources(e.evidence, names), e.edited ? 'oui' : 'non', e.reason ?? '']);
  files.push({ key: 'chronologie', name: name('chronologie', 'pdf'), mime: MIME.pdf, bytes: await chronologiePdf(ctx) });
  const chronoHeaders = ['Date retenue', 'Date extraite', 'Précision', 'Nature', 'Événement', 'Sources', 'Corrigée', 'Motif de correction'];
  files.push({ key: 'chronologie', name: name('chronologie', 'xlsx'), mime: MIME.xlsx, bytes: buildXlsx([{ name: 'Chronologie', headers: chronoHeaders, rows: chronoRows, widths: [13, 13, 10, 16, 48, 40, 10, 30] }]) });
  files.push({ key: 'chronologie', name: name('chronologie', 'csv'), mime: MIME.csv, bytes: enc.encode(toCsv(chronoHeaders, chronoRows)) });

  // 4. Dates modifiables (XLSX + CSV) — état retenu + historique complet
  const datesHeaders = ['Clé', 'Date extraite', 'Date retenue', 'Événement', 'Sources', 'Statut', 'Motif', 'Auteur', 'Modifiée le'];
  const datesRows = events.map((e) => [e.key, frDate(e.date), frDate(e.retained_date), e.retained_label, sources(e.evidence, names), e.hidden ? 'masquée' : e.edited ? 'corrigée' : 'extraite', e.reason ?? '', e.author ?? '', e.edited_at ? frDate(e.edited_at.slice(0, 10)) : '']);
  const history = [...(input.overrides ?? [])].sort((x, y) => x.created_at.localeCompare(y.created_at)).map((o) => [o.created_at.replace('T', ' ').slice(0, 16), o.event_key, frDate(o.retained_date), o.label ?? '', o.hidden ? 'masquée' : '', o.reason, o.author]);
  files.push({ key: 'dates', name: name('dates', 'xlsx'), mime: MIME.xlsx, bytes: buildXlsx([
    { name: 'Dates', headers: datesHeaders, rows: datesRows, widths: [26, 13, 13, 44, 36, 11, 30, 20, 13] },
    { name: 'Historique', headers: ['Horodatage (UTC)', 'Clé', 'Date retenue', 'Libellé retenu', 'Masquage', 'Motif', 'Auteur'], rows: history, widths: [18, 26, 13, 36, 10, 36, 20] },
  ]) });
  files.push({ key: 'dates', name: name('dates', 'csv'), mime: MIME.csv, bytes: enc.encode(toCsv(datesHeaders, datesRows)) });

  // 5. Échéances et calendrier (PDF + ICS + XLSX)
  files.push({ key: 'echeances', name: name('echeances', 'pdf'), mime: MIME.pdf, bytes: await echeancesPdf(ctx) });
  files.push({ key: 'echeances', name: name('echeances', 'ics'), mime: MIME.ics, bytes: enc.encode(buildIcs(deadlines.filter((d) => d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date) && !d.done).map((d) => ({ uid: `${d.uid}@clair-dossier.com`, date: d.date!, time: d.time, summary: `${title} — ${d.title}`, description: `${d.origin}. ${d.basis}` })), `ClairDossier — ${title}`, input.generatedAt)) });
  files.push({ key: 'echeances', name: name('echeances', 'xlsx'), mime: MIME.xlsx, bytes: buildXlsx([{ name: 'Échéances', headers: ['Date', 'Heure', 'Échéance', 'Nature', 'Base / motif', 'Priorité', 'Statut', 'Sources'], rows: deadlines.map((d) => [frDate(d.date), d.time?.slice(0, 5) ?? '', d.title, d.origin, d.basis, d.priority, d.done ? 'terminée' : 'à venir', d.sources]), widths: [12, 8, 40, 32, 44, 10, 10, 36] }]) });

  // 6. Relances e-mails (DOCX éditable + PDF) — brouillons uniquement
  const drafts: DocBlock[] = [
    { kind: 'title', text: 'Relances — projets de messages' },
    { kind: 'subtitle', text: `${sub} — BROUILLONS : aucun envoi automatique` },
    ...a.reminder_drafts.flatMap((r): DocBlock[] => [
      { kind: 'heading', text: `${r.audience === 'client' ? 'Pour vous' : 'Vers un tiers — à valider avant tout envoi'} · ${r.suggested_date ? `prévu le ${frDate(r.suggested_date)}` : 'date à définir'}` },
      { kind: 'para', text: `Destinataire : ${r.recipient_hint}` },
      { kind: 'para', text: `Objet : ${r.subject}` },
      { kind: 'para', text: r.body },
    ]),
    { kind: 'note', text: 'Les courriers adressés à des tiers (mise en demeure, reconnaissance, renonciation…) sont des projets : ils ne sont jamais envoyés par ClairDossier et doivent être relus, au besoin par un professionnel du droit.' },
  ];
  files.push({ key: 'relances', name: name('relances', 'docx'), mime: MIME.docx, bytes: buildDocx(drafts, `Relances — ${title}`) });
  files.push({ key: 'relances', name: name('relances', 'pdf'), mime: MIME.pdf, bytes: await relancesPdf(ctx) });
  return files;
}
