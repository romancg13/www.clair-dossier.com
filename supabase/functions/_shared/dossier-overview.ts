import { deadlineKey } from './ai-pipeline.ts';
import { KIND_LABEL, sources, type AnalysisData, type DeadlineRow, type PieceRef } from './analysis-model.ts';

export type ReportDeadline = {
  title: string; date: string | null; time: string | null; origin: string; basis: string;
  priority: string; sources: string; confirmed: boolean; responsible: string; done: boolean; uid: string;
};

function exactDate(value: string | null): boolean {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00Z');
  return Number.isFinite(date.getTime()) && date.toISOString().startsWith(value + 'T');
}

/** A date enters a calendar only when it is evidenced explicitly or retained by a human. */
export function reportDeadlines(analysis: AnalysisData, pieces: PieceRef[], rows?: DeadlineRow[]): ReportDeadline[] {
  const names = new Map(pieces.map(p => [p.id, p.file_name]));
  const fromAnalysis = analysis.deadlines.map((d): ReportDeadline => {
    const documented = d.evidence.some(e => names.has(e.document_id) && e.quote.trim());
    const disputed = analysis.contradictions.some(c => c.evidence.some(e =>
      d.evidence.some(reference => reference.document_id === e.document_id && reference.page === e.page && reference.quote === e.quote)));
    return {
      title: d.title, date: d.date, time: null, origin: KIND_LABEL[d.kind], basis: d.basis,
      priority: d.priority, sources: sources(d.evidence, names),
      confirmed: d.kind === 'mentioned' && !d.unverified && documented && !disputed && exactDate(d.date),
      responsible: d.responsible?.trim() || 'À préciser', done: false, uid: deadlineKey(d.title, d.date ?? '0000'),
    };
  });
  const sorted = (list: ReportDeadline[]) => list.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  if (!rows) return sorted(fromAnalysis);
  const byKey = new Map(fromAnalysis.map(d => [d.uid, d]));
  return sorted([...fromAnalysis.filter(d => !d.date), ...rows.map((r): ReportDeadline => {
    const base = r.ai_key ? byKey.get(r.ai_key) : undefined;
    const manual = !r.ai_key || r.user_edited;
    return {
      title: r.title, date: r.due_date, time: r.due_time, priority: r.priority, done: r.done,
      uid: r.ai_key ?? deadlineKey(r.title, r.due_date),
      origin: !r.ai_key ? 'Ajoutée manuellement' : r.user_edited ? `${base?.origin ?? 'Échéance détectée'} — corrigée par vous` : (base?.origin ?? 'Échéance détectée'),
      basis: base?.basis ?? r.description ?? '', sources: base?.sources ?? (manual ? 'Saisie dans le dossier' : 'Source à vérifier'),
      confirmed: exactDate(r.due_date) && (manual || Boolean(base?.confirmed && base.date === r.due_date)),
      responsible: base?.responsible ?? 'À préciser',
    };
  })]);
}

export function dossierOverview(analysis: AnalysisData, pieces: PieceRef[], generatedAt: Date, deadlineRows?: DeadlineRow[]) {
  const today = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(generatedAt);
  const upcoming = reportDeadlines(analysis, pieces, deadlineRows).filter(d => !d.done && d.date && d.date >= today);
  const next = upcoming.find(d => d.confirmed) ?? upcoming[0];
  const sentences = Array.from(new Intl.Segmenter('fr', { granularity: 'sentence' }).segment(analysis.summary_short), s => s.segment.trim()).slice(0, 2);
  return {
    situation: sentences.join(' ') || 'Les pièces exploitables ne permettent pas encore de décrire la situation.',
    action: analysis.next_actions.find(a => a.trim()) ?? 'Rien à faire pour le moment',
    responsible: analysis.action_owner?.trim() || 'À préciser',
    nextDate: next?.date ? { date: next.date, title: next.title, source: next.sources, confirmed: next.confirmed, responsible: next.responsible } : null,
  };
}
