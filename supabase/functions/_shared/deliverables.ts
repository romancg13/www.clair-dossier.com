// Les six livrables ClairDossier, générés depuis UNE base structurée
// (analyse consolidée + chronologie déterministe + corrections humaines).
// Partagé par `ai-worker` (Deno, via deno.json) et le site (démo navigateur) ;
// testé sous Node (tests/deliverables.test.ts). Aucun HTML/JS produit par le
// modèle n'est exécuté : tout passe par des gabarits maîtrisés.
//
// La partie PURE (catalogue, types, chronologie, corrections, libellés) vit
// dans analysis-model.ts — importée par le site sans embarquer pdf-lib — et
// reste ré-exportée ici : l'API du worker et des tests est inchangée.
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import brand from './pdf-brand.json' with { type: 'json' };
import { dossierOverview, reportDeadlines, type ReportDeadline } from './dossier-overview.ts';
import { buildIcs, toCsv } from './ai-pipeline.ts';
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
} from './analysis-model.ts';

export * from './analysis-model.ts';

/* ── Rendu PDF (gabarit A4 et polices ClairDossier incorporées) ─────────────────────── */

type PdfBlock = DocBlock | { kind: 'page' };

// Couverture latine des deux fontes embarquées, avec normalisation des espaces PDF.
const WINANSI_OK = /[\x20-\x7E\xA0-\xFFŒœŠšŸŽž–—‘’‚“”„†‡•…‰‹›€™]/;
function pdfSafe(s: string): string {
  return Array.from(s.replace(/[    ]/g, ' ').replace(/→/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<='))
    .map((c) => (c === '\n' || WINANSI_OK.test(c) ? c : '?'))
    .join('');
}

const NAVY = rgb(0x0d / 255, 0x1b / 255, 0x3d / 255);
const GOLD = rgb(0xc7 / 255, 0xa6 / 255, 0x54 / 255);
const SLATE = rgb(0.39, 0.45, 0.55);

async function renderPdf(title: string, subtitle: string, blocks: PdfBlock[], demo: boolean): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor('ClairDossier');
  pdf.setProducer('ClairDossier');
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(brand.inter, { subset: true });
  const bold = await pdf.embedFont(brand['cormorant-garamond'], { subset: true });
  const logo = await pdf.embedPng(brand.logo);
  const W = 595.28, H = 841.89, M = 54, LH = 14.5;
  let page: PDFPage;
  let y = 0;
  const wrap = (text: string, f: PDFFont, size: number, width: number): string[] => {
    const out: string[] = [];
    for (const para of pdfSafe(text).split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/)) {
        const t = line ? `${line} ${word}` : word;
        if (f.widthOfTextAtSize(t, size) > width && line) {
          out.push(line);
          line = word;
        } else line = t;
      }
      out.push(line);
    }
    return out;
  };
  const header = (first: boolean) => {
    page = pdf.addPage([W, H]);
    page.drawImage(logo, { x: M, y: H - 52, width: 112, height: 27 });
    if (demo) {
      const label = 'Démonstration · données fictives';
      page.drawText(label, { x: W - M - font.widthOfTextAtSize(label, 9), y: H - 43, size: 9, font, color: SLATE });
    }
    page.drawLine({ start: { x: M, y: H - 65 }, end: { x: W - M, y: H - 65 }, thickness: 1, color: GOLD });
    y = H - 97;
    if (first) {
      page.drawText(pdfSafe(title), { x: M, y, size: 27, font: bold, color: NAVY });
      y -= 22;
      for (const line of wrap(subtitle, font, 9, W - 2 * M)) {
        page.drawText(line, { x: M, y, size: 9, font, color: SLATE });
        y -= 13;
      }
      y -= 16;
    }
  };
  const ensure = (h: number) => {
    if (y - h < M + 20) header(false);
  };
  const text = (s: string, f: PDFFont, size: number, color = NAVY, indent = 0) => {
    for (const l of wrap(s, f, size, W - 2 * M - indent)) {
      ensure(LH);
      page.drawText(l, { x: M + indent, y, size, font: f, color });
      y -= LH * (size / 10.5);
    }
  };
  header(true);
  for (const b of blocks) {
    switch (b.kind) {
      case 'title':
      case 'subtitle':
        break; // portés par l'en-tête
      case 'page':
        header(false);
        break;
      case 'heading':
        y -= 8;
        ensure(3 * LH);
        page!.drawRectangle({ x: M, y: y - 3, width: 3, height: 12, color: GOLD });
        text(b.text, bold, 15, NAVY, 10);
        y -= 3;
        break;
      case 'bullet':
        text(`•  ${b.text}`, font, 11, NAVY, 6);
        break;
      case 'note':
        y -= 6;
        text(b.text, font, 9, SLATE);
        break;
      default:
        text(b.text, font, 11.5);
        y -= 4;
    }
  }
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: M, y: 40 }, end: { x: W - M, y: 40 }, thickness: 0.4, color: GOLD });
    p.drawText(pdfSafe('Source : pièces du dossier. Vérifiez les faits avant toute démarche.'), { x: M, y: 28, size: 8, font, color: SLATE });
    p.drawText(`${i + 1}/${pages.length}`, { x: W - M - 20, y: 28, size: 8, font, color: SLATE });
  });
  return pdf.save();
}

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
  /** Limite le rendu aux catégories affectées par la révision. */
  categories?: DeliverableKey[];
}

export const MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv;charset=utf-8',
  ics: 'text/calendar;charset=utf-8',
} as const;

export async function buildDeliverables(input: DeliverableInput): Promise<OutFile[]> {
  const { analysis: a, coverage: cov, revision: rev, title, demo = false } = input;
  const names = new Map(input.pieces.map((p) => [p.id, p.file_name]));
  const stamp = input.generatedAt.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' });
  const sub = `${title} — révision ${rev} — ${stamp} — ${coverageLabel(cov)}`;
  const enc = new TextEncoder();
  const name = (key: DeliverableKey, ext: string) => `${DELIVERABLE_CATALOG.find((d) => d.key === key)!.slug}-r${rev}.${ext}`;
  const events = applyOverrides(a.events, input.overrides ?? []);
  const visible = events.filter((e) => !e.hidden);
  const deadlines = reportDeadlines(a, input.pieces, input.deadlineRows);
  const overview = dossierOverview(a, input.pieces, input.generatedAt, input.deadlineRows);
  const requested = (key: DeliverableKey) => !input.categories || input.categories.includes(key);
  const files: OutFile[] = [];
  const legal = 'Document généré automatiquement par ClairDossier à partir des pièces déposées. Il doit être vérifié et ne constitue ni un conseil ni un acte juridique.';

  // 1. Résumé IA (PDF + DOCX)
  if (requested('resume')) {
    const keyFacts = a.facts.filter(f => f.status !== 'missing' && !f.unverified && f.evidence.some(e => names.has(e.document_id) && e.quote.trim())).slice(0, 5);
    const others = a.facts.filter(f => !keyFacts.includes(f));
    const factBlock = (f: AnalysisData['facts'][number]): DocBlock => ({
      kind: 'bullet', text: `${f.text} · ${f.unverified ? 'à vérifier' : FACT_LABEL[f.status]} [${sources(f.evidence, names)}]`,
    });
    const resume: DocBlock[] = [
      { kind: 'title', text: 'Résumé du dossier' },
      { kind: 'subtitle', text: sub },
      { kind: 'heading', text: 'Faits déterminants' },
      ...(keyFacts.length ? keyFacts.map(factBlock) : [{ kind: 'para', text: 'Aucun fait suffisamment sourcé dans les pièces exploitées.' } as DocBlock]),
      { kind: 'heading', text: 'Détail de la synthèse' },
      { kind: 'para', text: a.summary_long },
      ...a.parties.map((p): DocBlock => ({ kind: 'bullet', text: `${p.name} — ${p.role} [${sources(p.evidence, names)}]` })),
      ...(others.length ? [{ kind: 'heading', text: 'Autres éléments signalés' } as DocBlock, ...others.map(factBlock)] : []),
      ...(a.attention_points.length ? [{ kind: 'heading', text: 'Points d’attention' } as DocBlock, ...a.attention_points.map((t): DocBlock => ({ kind: 'bullet', text: t }))] : []),
      { kind: 'heading', text: 'Contradictions entre pièces' },
      ...(a.contradictions.length ? a.contradictions.map((c): DocBlock => ({ kind: 'bullet', text: `${c.text} [${sources(c.evidence, names)}]` })) : [{ kind: 'para', text: 'Aucune contradiction relevée entre les pièces exploitées.' } as DocBlock]),
      { kind: 'heading', text: 'Pièces ou informations absentes du lot' },
      ...(a.missing_items.length ? a.missing_items.map((m): DocBlock => ({ kind: 'bullet', text: `${m.text} — ${m.why}` })) : [{ kind: 'para', text: 'Aucune absence signalée.' } as DocBlock]),
      ...(a.next_actions.length ? [{ kind: 'heading', text: 'Prochaines actions proposées' } as DocBlock, ...a.next_actions.map((t): DocBlock => ({ kind: 'bullet', text: t }))] : []),
      { kind: 'heading', text: 'Pièces exploitées' },
      ...input.pieces.map((p): DocBlock => ({ kind: 'bullet', text: p.file_name })),
      { kind: 'note', text: legal },
    ];
    files.push({ key: 'resume', name: name('resume', 'pdf'), mime: MIME.pdf, bytes: await renderPdf('Résumé du dossier', sub, resume, demo) });
    files.push({ key: 'resume', name: name('resume', 'docx'), mime: MIME.docx, bytes: buildDocx(resume, `Résumé — ${title}`) });
  }

  // 2. Dashboard (PDF ; la version interactive est l'onglet DashBoard de l'espace client)
  if (requested('dashboard')) {
    const next = overview.nextDate;
    const dashboard: PdfBlock[] = [
      { kind: 'heading', text: `Situation au ${stamp}` },
      { kind: 'para', text: overview.situation },
      { kind: 'heading', text: 'Prochaine action' },
      { kind: 'para', text: overview.action },
      ...(a.next_actions.length ? [{ kind: 'note', text: `Responsable · ${overview.responsible}` } as DocBlock] : []),
      { kind: 'heading', text: 'Prochaine date' },
      { kind: 'para', text: next ? `${frDate(next.date)} — ${next.title}` : 'Aucune échéance à venir documentée.' },
      ...(next ? [{ kind: 'note', text: `${next.confirmed ? 'Date confirmée' : 'Date à confirmer'} · ${next.source}. Responsable · ${next.responsible}.` } as DocBlock] : []),
    ];
    files.push({ key: 'dashboard', name: name('dashboard', 'pdf'), mime: MIME.pdf, bytes: await renderPdf('Tableau de bord du dossier', sub, dashboard, demo) });
  }

  // 3. Chronologie (PDF + XLSX + CSV)
  if (requested('chronologie')) {
    const eventBlock = (e: typeof visible[number]): DocBlock => ({
      kind: 'bullet', text: `${frDate(e.retained_date)}${e.precision !== 'day' ? ' (approx.)' : ''} — ${e.retained_label} · ${e.kind === 'document_date' ? 'date du document' : 'événement'}${e.edited ? ' · corrigé' : ''} [${sources(e.evidence, names)}]`,
    });
    // Privilégier les pièces des faits retenus, puis les événements métier. La précision reste affichée à part.
    const focalPieces = new Set(a.facts.filter(f => !f.unverified && f.status !== 'missing').flatMap(f => f.evidence.map(e => e.document_id)));
    const priority = (e: typeof visible[number]) => (e.kind === 'event_date' ? 1 : 0) + (e.evidence.some(ref => focalPieces.has(ref.document_id)) ? 2 : 0);
    const chosen = new Set([...visible].sort((x, y) => priority(y) - priority(x)).slice(0, 5).map(e => e.key));
    const milestones = visible.filter(e => chosen.has(e.key));
    const chronoRows = visible.map((e) => [frDate(e.retained_date), frDate(e.date), e.precision === 'day' ? 'jour' : e.precision === 'month' ? 'mois' : e.precision === 'year' ? 'année' : 'inconnue', e.kind === 'document_date' ? 'Date du document' : 'Événement', e.retained_label, sources(e.evidence, names), e.edited ? 'oui' : 'non', e.reason ?? '']);
    files.push({ key: 'chronologie', name: name('chronologie', 'pdf'), mime: MIME.pdf, bytes: await renderPdf('Chronologie', sub, [
      { kind: 'heading', text: 'Jalons du dossier' },
      ...(milestones.length ? milestones.map(eventBlock) : [{ kind: 'para', text: 'Aucun événement daté dans les pièces exploitées.' } as DocBlock]),
      ...(visible.length > milestones.length ? [{ kind: 'page' } as PdfBlock, { kind: 'heading', text: `Annexe · chronologie complète (${visible.length})` } as DocBlock, ...visible.map(eventBlock)] : []),
      { kind: 'note', text: 'Les dates approximatives restent indiquées comme telles ; une date corrigée par vous prévaut sur la date extraite (historique dans « Dates modifiables »).' },
    ], demo) });
    const chronoHeaders = ['Date retenue', 'Date extraite', 'Précision', 'Nature', 'Événement', 'Sources', 'Corrigée', 'Motif de correction'];
    files.push({ key: 'chronologie', name: name('chronologie', 'xlsx'), mime: MIME.xlsx, bytes: buildXlsx([{ name: 'Chronologie', headers: chronoHeaders, rows: chronoRows, widths: [13, 13, 10, 16, 48, 40, 10, 30] }]) });
    files.push({ key: 'chronologie', name: name('chronologie', 'csv'), mime: MIME.csv, bytes: enc.encode(toCsv(chronoHeaders, chronoRows)) });
  }

  // 4. Dates modifiables (XLSX + CSV) — état retenu + historique complet
  if (requested('dates')) {
    const datesHeaders = ['Clé', 'Date extraite', 'Date retenue', 'Événement', 'Sources', 'Statut', 'Motif', 'Auteur', 'Modifiée le'];
    const datesRows = events.map((e) => [e.key, frDate(e.date), frDate(e.retained_date), e.retained_label, sources(e.evidence, names), e.hidden ? 'masquée' : e.edited ? 'corrigée' : 'extraite', e.reason ?? '', e.author ?? '', e.edited_at ? frDate(e.edited_at.slice(0, 10)) : '']);
    const history = [...(input.overrides ?? [])].sort((x, y) => x.created_at.localeCompare(y.created_at)).map((o) => [o.created_at.replace('T', ' ').slice(0, 16), o.event_key, frDate(o.retained_date), o.label ?? '', o.hidden ? 'masquée' : '', o.reason, o.author]);
    files.push({ key: 'dates', name: name('dates', 'xlsx'), mime: MIME.xlsx, bytes: buildXlsx([
      { name: 'Dates', headers: datesHeaders, rows: datesRows, widths: [26, 13, 13, 44, 36, 11, 30, 20, 13] },
      { name: 'Historique', headers: ['Horodatage (UTC)', 'Clé', 'Date retenue', 'Libellé retenu', 'Masquage', 'Motif', 'Auteur'], rows: history, widths: [18, 26, 13, 36, 10, 36, 20] },
    ]) });
    files.push({ key: 'dates', name: name('dates', 'csv'), mime: MIME.csv, bytes: enc.encode(toCsv(datesHeaders, datesRows)) });
  }

  // 5. Échéances et calendrier (PDF + ICS + XLSX)
  if (requested('echeances')) {
    const group = (label: string, list: ReportDeadline[]): PdfBlock[] => list.length
      ? [{ kind: 'heading', text: `${label} (${list.length})` }, ...list.map((d): DocBlock => ({ kind: 'bullet', text: `${frDate(d.date)}${d.time ? ` ${d.time.slice(0, 5)}` : ''} — ${d.title} — ${d.confirmed ? 'confirmée' : 'à confirmer'} · responsable : ${d.responsible}${d.done ? ' — terminée' : ''}${d.basis ? ` — ${d.basis}` : ''} [${d.sources}]` }))]
      : [];
    files.push({ key: 'echeances', name: name('echeances', 'pdf'), mime: MIME.pdf, bytes: await renderPdf('Échéances et calendrier', sub, [
      ...(!deadlines.some(d => d.confirmed && !d.done) ? [{ kind: 'para', text: 'Aucune échéance confirmée à inscrire au calendrier.' } as DocBlock] : []),
      ...group('Dates mentionnées dans les pièces', deadlines.filter((d) => d.origin.startsWith(KIND_LABEL.mentioned))),
      ...group('Dates calculées', deadlines.filter((d) => d.origin.startsWith(KIND_LABEL.computed))),
      ...group('Hypothèses à confirmer par un professionnel', deadlines.filter((d) => d.origin.startsWith(KIND_LABEL.hypothesis))),
      ...group('Échéances détectées ou ajoutées', deadlines.filter((d) => !Object.values(KIND_LABEL).some((k) => d.origin.startsWith(k)))),
      { kind: 'note', text: 'Une date calculée ou une hypothèse n’est pas une date juridiquement validée. Le calendrier ICS joint s’importe dans Outlook, Google Agenda ou Calendrier (dates sans heure conservées comme journées entières).' },
    ], demo) });
    files.push({ key: 'echeances', name: name('echeances', 'ics'), mime: MIME.ics, bytes: enc.encode(buildIcs(deadlines.filter((d) => d.confirmed && d.date && !d.done).map((d) => ({ uid: `${d.uid}@clair-dossier.com`, date: d.date!, time: d.time, summary: `${title} — ${d.title}`, description: `${d.origin}. ${d.basis}` })), `ClairDossier — ${title}`, input.generatedAt)) });
    files.push({ key: 'echeances', name: name('echeances', 'xlsx'), mime: MIME.xlsx, bytes: buildXlsx([{ name: 'Échéances', headers: ['Date', 'Heure', 'Échéance', 'Nature', 'Base / motif', 'Priorité', 'Statut', 'Sources'], rows: deadlines.map((d) => [frDate(d.date), d.time?.slice(0, 5) ?? '', d.title, d.origin, d.basis, d.priority, d.done ? 'terminée' : 'à venir', d.sources]), widths: [12, 8, 40, 32, 44, 10, 10, 36] }]) });
  }

  // 6. Relances e-mails (DOCX éditable + PDF) — brouillons uniquement
  if (requested('relances')) {
    const drafts: DocBlock[] = [
      { kind: 'title', text: 'Relances — projets de messages' },
      { kind: 'subtitle', text: `${sub} — BROUILLONS : aucun envoi automatique` },
      ...(!a.reminder_drafts.length ? [{ kind: 'para', text: 'Aucune relance à préparer pour ce dossier.' } as DocBlock] : []),
      ...a.reminder_drafts.flatMap((r): DocBlock[] => [
        { kind: 'heading', text: `${r.audience === 'client' ? 'Pour vous' : 'Vers un tiers — à valider avant tout envoi'} · ${r.suggested_date ? `prévu le ${frDate(r.suggested_date)}` : 'date à définir'}` },
        { kind: 'para', text: `Destinataire : ${r.recipient_hint}` },
        { kind: 'para', text: `Objet : ${r.subject}` },
        { kind: 'para', text: r.body },
        { kind: 'note', text: r.audience === 'third_party' ? 'Avant un envoi, vérifier le destinataire, les pièces citées et la situation actuelle.' : 'À utiliser après vérification de la situation actuelle.' },
      ]),
      { kind: 'note', text: 'Les courriers adressés à des tiers (mise en demeure, reconnaissance, renonciation…) sont des projets : ils ne sont jamais envoyés par ClairDossier et doivent être relus, au besoin par un professionnel du droit.' },
    ];
    files.push({ key: 'relances', name: name('relances', 'docx'), mime: MIME.docx, bytes: buildDocx(drafts, `Relances — ${title}`) });
    files.push({ key: 'relances', name: name('relances', 'pdf'), mime: MIME.pdf, bytes: await renderPdf('Relances — projets de messages', `${sub} — brouillons`, drafts, demo) });
  }

  return files;
}
