// Jeu de données UNIQUE des six rendus : la page web du dossier et les exports
// (PDF, DOCX, XLSX, CSV, ICS) lisent exactement les mêmes valeurs. Pur, sans
// dépendance : importable par le site, le worker et l'adaptateur de recette.
import { applyOverrides, type ChronoEvent, type DeadlineRow, type DeliverableKey, type EventOverride, type PieceRef } from '../analysis-model.ts';
import { deadlineKey } from '../ai-pipeline.ts';

export type Reliab = { level: 'elevee' | 'a_verifier'; reasons: string[] };
export type Owner = 'client' | 'cabinet' | 'tiers' | 'personne';
export interface Src {
  piece: string;
  where: string | null;
  quote: string;
}

type Ev = { document_id: string; page: number | null; locator?: string | null; quote: string; status?: 'found' | 'not_found' | 'unknown' };

/** Données d'analyse attendues (v3 ; une v2 reste lisible, champs absents tolérés). */
export interface ViewAnalysis {
  situation?: string;
  summary_short: string;
  summary_long: string;
  parties: { name: string; role: string; evidence: Ev[] }[];
  facts: { text: string; status: string; evidence: Ev[] }[];
  key_facts?: { text: string; status: string; evidence: Ev[] }[];
  amounts?: { label: string; amount: number; currency: string; kind: string; evidence: Ev[] }[];
  deadlines: { title: string; date: string | null; kind: 'mentioned' | 'computed' | 'hypothesis'; basis: string; priority: string; owner?: Owner; owner_name?: string | null; evidence: Ev[] }[];
  contradictions: { text: string; kind?: string; event_keys?: string[]; evidence: Ev[] }[];
  missing_items: { text: string; why: string; kind?: string; short_label?: string; evidence?: Ev[] }[];
  milestones?: { event_key: string; importance: 'majeure' | 'utile' }[];
  primary_action?: { label: string; owner: Owner; rationale: string; due_date: string | null };
  attention_points: string[];
  next_actions: string[];
  reminder_drafts: { audience: string; subject: string; body: string; suggested_date: string | null; recipient_hint: string; condition?: string; related_deadline?: string | null }[];
  events: (ChronoEvent & { evidence: Ev[] })[];
}

export interface ViewInput {
  /** Identifiant du dossier : rend l'UID des événements ICS propre au dossier. */
  dossierId?: string;
  title: string;
  revision: number;
  generatedAt: Date;
  analysis: ViewAnalysis;
  coverage: { total: number; extracted: number; unsupported: number; failed: number; pending: number; complete: boolean; duplicates?: number; deferred?: number };
  pieces: PieceRef[];
  overrides: EventOverride[];
  deadlineRows: DeadlineRow[];
  provider: string;
}

export interface DeadlineView {
  key: string;
  date: string;
  time: string | null;
  title: string;
  owner: string;
  nature: string;
  source: Src | null;
  reliability: Reliab;
  done: boolean;
}

export interface RenduView {
  version: 1;
  dossier: { id: string | null; title: string; revision: number; as_of: string; provider: string; simulation: boolean; coverage_label: string; complete: boolean };
  tableau: {
    situation: string;
    action: { label: string; owner: Owner; owner_label: string; rationale: string; due_date: string | null; target: 'pieces' | 'dates' | 'resume' | 'relances' | 'echeances' | null };
    next_date: (DeadlineView & { status: 'confirmee' | 'a_confirmer' }) | null;
    cabinet: string | null;
    alerts: string[];
  };
  resume: {
    facts: { text: string; status: string; source: Src | null; reliability: Reliab }[];
    missing: { label: string; why: string; kind: string; source: Src | null }[];
    amounts: { label: string; amount: number; kind: string; source: Src | null; reliability: Reliab }[];
    contradictions: { text: string; sources: Src[] }[];
    parties: { name: string; role: string }[];
    details: string;
  };
  chronologie: {
    milestones: { key: string; date: string; label: string; importance: 'majeure' | 'utile'; reliability: Reliab; source: Src | null; corrected: boolean }[];
    all: { key: string; date: string; extracted: string; precision: string; nature: string; label: string; sources: Src[]; corrected: boolean; reason: string | null; hidden: boolean }[];
  };
  dates: {
    rows: { key: string; label: string; extracted: string; retained: string; status: 'extraite' | 'corrigee' | 'masquee'; flag: string | null; reason: string | null; author: string | null; edited_at: string | null; source: Src | null }[];
    history: { at: string; key: string; retained: string | null; label: string | null; hidden: boolean; reason: string; author: string }[];
  };
  echeances: { confirmed: DeadlineView[]; to_confirm: DeadlineView[]; past: DeadlineView[]; none_confirmed: boolean };
  relances: { drafts: { subject: string; recipient: string; body: string; condition: string; related_deadline: string | null; audience: string }[] };
  pieces: { id: string; name: string }[];
}

export const OWNER_LABEL: Record<Owner, string> = { client: 'Vous', cabinet: 'Votre cabinet', tiers: 'Un tiers', personne: 'Personne' };
const FACT_STATUS: Record<string, string> = { documented: 'documenté', asserted_by_party: 'déclaré par une partie', inferred: 'déduit', missing: 'manquant' };
const NATURE: Record<string, string> = { mentioned: 'Date écrite dans une pièce', computed: 'Date calculée', hypothesis: 'À confirmer' };

export function reliabilityOf(ev: Ev[], opts: { contradicted?: boolean; kind?: 'mentioned' | 'computed' | 'hypothesis' } = {}): Reliab {
  const reasons: string[] = [];
  if (!ev.length) reasons.push('non sourcé');
  else if (!ev.some((e) => e.status === 'found')) reasons.push(ev.some((e) => e.status === 'unknown') ? 'lecture visuelle à vérifier' : 'extrait non retrouvé dans la pièce');
  if (opts.contradicted) reasons.push('contredit par une autre pièce');
  if (opts.kind === 'hypothesis') reasons.push('date proposée, non confirmée');
  if (opts.kind === 'computed') reasons.push('date calculée, non écrite dans une pièce');
  return { level: reasons.length ? 'a_verifier' : 'elevee', reasons };
}

export function parisDay(d: Date): string {
  return new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

function targetOf(label: string): RenduView['tableau']['action']['target'] {
  const l = label.toLowerCase();
  if (/joindre|redéposer|ajouter/.test(l)) return 'pieces';
  if (/date/.test(l)) return 'dates';
  if (/réponse|relance|répondre/.test(l)) return 'relances';
  if (/montant|vérifier|synthèse|résumé/.test(l)) return 'resume';
  if (/rien à faire/.test(l)) return null;
  return 'echeances';
}

export function buildView(i: ViewInput): RenduView {
  const a = i.analysis;
  const names = new Map(i.pieces.map((p) => [p.id, p.file_name]));
  const src = (ev: Ev[] | undefined): Src | null => {
    const e = ev?.find((x) => x.status === 'found') ?? ev?.[0];
    if (!e) return null;
    return { piece: names.get(e.document_id) ?? 'pièce', where: e.page ? `p. ${e.page}` : (e.locator ?? null), quote: e.quote.slice(0, 220) };
  };
  const today = parisDay(i.generatedAt);
  const contradictedKeys = new Set((a.contradictions ?? []).flatMap((c) => c.event_keys ?? []));

  // Dernière correction humaine par clé (même règle que applyOverrides).
  const latest = new Map<string, EventOverride>();
  for (const o of [...i.overrides].sort((x, y) => x.created_at.localeCompare(y.created_at))) latest.set(o.event_key, o);
  // Événement d'origine d'une échéance (rendez-vous proposé…) : même clé, sinon même date et même extrait cité.
  // La clé seule ne suffit pas : celle de l'échéance porte souvent un suffixe (« proposition, non confirmée »).
  const cite = (e: Ev) => `${e.document_id}\u0000${e.quote}`;
  const eventOf = (d: ViewAnalysis['deadlines'][number], key: string): string | null => {
    if (a.events.some((e) => e.key === key)) return key;
    const quotes = new Set(d.evidence.map(cite));
    return a.events.find((e) => e.date === d.date && (e.evidence as Ev[]).some((x) => quotes.has(cite(x))))?.key ?? null;
  };

  // Échéances : analyse + lignes en base (corrections et ajouts manuels prioritaires).
  const fromAnalysis = a.deadlines.filter((d) => d.date && /^\d{4}-\d{2}-\d{2}$/.test(d.date)).map((d) => {
    const key = deadlineKey(d.title, d.date!);
    return { d, key, event: eventOf(d, key) };
  });
  const byKey = new Map(fromAnalysis.map((x) => [x.key, x.d]));
  const linkedEvent = new Map(fromAnalysis.map((x) => [x.key, x.event]));
  const rows = new Map<string, DeadlineView & { kind: string; manual: boolean }>();
  for (const { d, key } of fromAnalysis) {
    rows.set(key, { key, date: d.date!, time: null, title: d.title, owner: d.owner_name ?? OWNER_LABEL[d.owner ?? 'client'], nature: NATURE[d.kind], source: src(d.evidence), reliability: reliabilityOf(d.evidence, { kind: d.kind }), done: false, kind: d.kind, manual: false });
  }
  for (const r of i.deadlineRows) {
    const key = r.ai_key ?? deadlineKey(r.title, r.due_date);
    const base = r.ai_key ? byKey.get(r.ai_key) : undefined;
    const manual = !r.ai_key || r.user_edited;
    rows.set(key, {
      key, date: r.due_date, time: r.due_time, title: r.title, owner: base?.owner_name ?? OWNER_LABEL[base?.owner ?? 'client'],
      nature: !r.ai_key ? 'Ajoutée par vous' : r.user_edited ? `${NATURE[base?.kind ?? 'mentioned']} — corrigée par vous` : NATURE[base?.kind ?? 'mentioned'],
      source: base ? src(base.evidence) : null,
      reliability: manual ? { level: 'elevee', reasons: [] } : reliabilityOf(base?.evidence ?? [], { kind: base?.kind ?? 'mentioned' }),
      done: r.done, kind: manual ? 'mentioned' : (base?.kind ?? 'mentioned'), manual,
    });
  }
  // Corrections faites dans « Dates modifiables » : reprises par les échéances (date retenue, masquage).
  // La nature ne change pas : une proposition corrigée reste « à confirmer » et hors ICS.
  for (const [key, r] of rows) {
    const target = linkedEvent.get(key) ?? key;
    const o = r.manual ? undefined : latest.get(target);
    if (!o) continue;
    if (o.hidden) {
      rows.delete(key);
      continue;
    }
    const date = o.retained_date && /^\d{4}-\d{2}-\d{2}$/.test(o.retained_date) ? o.retained_date : r.date;
    rows.set(key, { ...r, date, title: target === key && o.label ? o.label : r.title, nature: `${r.nature} — corrigée par vous` });
  }
  const all = [...rows.values()].sort((x, y) => x.date.localeCompare(y.date));
  const strip = ({ kind: _k, manual: _m, ...rest }: DeadlineView & { kind: string; manual: boolean }): DeadlineView => rest;
  const future = all.filter((d) => d.date >= today && !d.done);
  const confirmed = future.filter((d) => d.kind === 'mentioned' && d.reliability.level === 'elevee').map(strip);
  const toConfirm = future.filter((d) => !(d.kind === 'mentioned' && d.reliability.level === 'elevee')).map(strip);
  const past = all.filter((d) => d.date < today || d.done).map(strip);
  const nextConfirmed = confirmed[0] ?? null;
  const nextAny = nextConfirmed ? { ...nextConfirmed, status: 'confirmee' as const } : toConfirm[0] ? { ...toConfirm[0], status: 'a_confirmer' as const } : null;

  const pa = a.primary_action ?? { label: a.next_actions[0] ?? 'Voir ma synthèse', owner: 'client' as Owner, rationale: a.summary_short, due_date: null };
  const events = applyOverrides(a.events, i.overrides);
  const evByKey = new Map(events.map((e) => [e.key, e]));
  const milestones = (a.milestones ?? [])
    .map((m) => ({ m, e: evByKey.get(m.event_key) }))
    .filter((x): x is { m: { event_key: string; importance: 'majeure' | 'utile' }; e: (typeof events)[number] } => Boolean(x.e && !x.e.hidden))
    .map(({ m, e }) => ({ key: e.key, date: e.retained_date, label: e.retained_label, importance: m.importance, reliability: reliabilityOf(e.evidence as Ev[], { contradicted: contradictedKeys.has(e.key) && !e.edited }), source: src(e.evidence as Ev[]), corrected: e.edited }))
    .sort((x, y) => x.date.localeCompare(y.date));
  // « Dates modifiables » : les événements, plus les échéances sans événement d'origine (dates limites
  // écrites, dont celles du calendrier ICS), pour que toute date d'un rendu soit corrigeable.
  type DateRow = RenduView['dates']['rows'][number];
  const eventRows = events.map((e): DateRow => ({ key: e.key, label: e.retained_label, extracted: e.date, retained: e.retained_date, status: e.hidden ? 'masquee' : e.edited ? 'corrigee' : 'extraite', flag: contradictedKeys.has(e.key) && !e.edited ? 'Date contredite par une autre pièce : à vérifier' : null, reason: e.reason ?? null, author: e.author ?? null, edited_at: e.edited_at ?? null, source: src(e.evidence as Ev[]) }));
  const deadlineDateRows = [...new Map(fromAnalysis.filter((x) => !x.event).map((x) => [x.key, x])).values()].map(({ d, key }): DateRow => {
    const o = latest.get(key);
    return { key, label: o?.label ?? d.title, extracted: d.date!, retained: o?.retained_date ?? d.date!, status: o?.hidden ? 'masquee' : o ? 'corrigee' : 'extraite', flag: null, reason: o?.reason ?? null, author: o?.author ?? null, edited_at: o?.created_at ?? null, source: src(d.evidence) };
  });
  const coverageLabel = i.coverage.complete
    ? `Analyse complète — ${i.coverage.extracted} pièce${i.coverage.extracted > 1 ? 's' : ''} exploitée${i.coverage.extracted > 1 ? 's' : ''}`
    : `Analyse partielle — ${i.coverage.extracted}/${i.coverage.total} pièces exploitées${i.coverage.unsupported ? `, ${i.coverage.unsupported} non lisible(s)` : ''}${i.coverage.deferred ? `, ${i.coverage.deferred} en attente de lecture` : ''}${i.coverage.failed ? `, ${i.coverage.failed} en échec` : ''}${i.coverage.pending ? `, ${i.coverage.pending} en cours` : ''}`;

  return {
    version: 1,
    dossier: { id: i.dossierId ?? null, title: i.title, revision: i.revision, as_of: today, provider: i.provider, simulation: i.provider === 'regles', coverage_label: coverageLabel, complete: i.coverage.complete },
    tableau: {
      situation: a.situation ?? a.summary_short,
      action: { label: pa.label, owner: pa.owner, owner_label: OWNER_LABEL[pa.owner], rationale: pa.rationale, due_date: pa.due_date, target: targetOf(pa.label) },
      next_date: nextAny,
      cabinet: pa.owner === 'cabinet' ? pa.rationale : a.deadlines.find((d) => d.owner === 'cabinet' && d.date && d.date >= today)?.title ?? null,
      alerts: [...a.contradictions.map((c) => c.text), ...a.missing_items.map((m) => m.text)].slice(0, 3),
    },
    resume: {
      facts: (a.key_facts?.length ? a.key_facts : a.facts).slice(0, 5).map((f) => ({ text: f.text, status: FACT_STATUS[f.status] ?? f.status, source: src(f.evidence), reliability: reliabilityOf(f.evidence) })),
      missing: a.missing_items.map((m) => ({ label: m.short_label ?? m.text, why: m.why, kind: m.kind ?? 'usual', source: src(m.evidence) })),
      amounts: (a.amounts ?? []).map((x) => ({ label: x.label, amount: x.amount, kind: x.kind, source: src(x.evidence), reliability: reliabilityOf(x.evidence) })),
      contradictions: a.contradictions.map((c) => ({ text: c.text, sources: c.evidence.map((e) => src([e])!).filter(Boolean) })),
      parties: a.parties.map((p) => ({ name: p.name, role: p.role })),
      details: a.summary_long,
    },
    chronologie: {
      milestones,
      all: events.map((e) => ({ key: e.key, date: e.retained_date, extracted: e.date, precision: e.precision, nature: e.kind === 'document_date' ? 'Date de la pièce' : 'Événement', label: e.retained_label, sources: (e.evidence as Ev[]).map((x) => src([x])!).filter(Boolean), corrected: e.edited, reason: e.reason ?? null, hidden: e.hidden })),
    },
    dates: {
      rows: [...eventRows, ...deadlineDateRows].sort((x, y) => x.retained.localeCompare(y.retained) || x.label.localeCompare(y.label, 'fr')),
      history: [...i.overrides].sort((x, y) => x.created_at.localeCompare(y.created_at)).map((o) => ({ at: o.created_at, key: o.event_key, retained: o.retained_date, label: o.label, hidden: o.hidden, reason: o.reason, author: o.author })),
    },
    echeances: { confirmed, to_confirm: toConfirm, past, none_confirmed: confirmed.length === 0 },
    relances: { drafts: a.reminder_drafts.map((r) => ({ subject: r.subject, recipient: r.recipient_hint, body: r.body, condition: r.condition ?? 'Brouillon : à relire et adapter avant tout envoi.', related_deadline: r.related_deadline ?? null, audience: r.audience })) },
    pieces: i.pieces.map((p) => ({ id: p.id, name: p.file_name })),
  };
}

/** Sous-ensemble de la vue qui détermine chaque catégorie (empreinte sans horodatage). */
export function categoryData(v: RenduView): Record<DeliverableKey, unknown> {
  const head = { title: v.dossier.title, coverage: v.dossier.coverage_label, simulation: v.dossier.simulation };
  return {
    dashboard: { head, t: v.tableau },
    resume: { head, r: v.resume },
    chronologie: { head, c: v.chronologie },
    dates: { head, d: v.dates },
    echeances: { head, e: v.echeances },
    relances: { head, r: v.relances },
  };
}
