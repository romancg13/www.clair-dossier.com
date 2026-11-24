// Modèle PUR du projet de rapport (démonstration, dossier fictif, traitement simulé).
// buildReport(dossier, corrections) → sections et paragraphes, lus par l'écran ET par
// le PDF (report-pdf.ts). Toutes les données viennent de dossier.ts.
// Le projet ne conclut jamais sur la cause, la responsabilité ou la garantie : la
// section correspondante est réservée à l'appréciation de l'expert.
import {
  SOURCES as S,
  STATUS_HINT,
  STATUS_LABEL,
  frLongDate,
  pieceById,
  sourceLabel,
  typo,
  type Dossier,
  type SourceRef,
  type Status,
} from './dossier.ts';

export interface LabeledSource extends SourceRef {
  /** « Pièce 5 — Courriel, p. 1 » */
  label: string;
}

export interface ReportParagraph {
  id: string;
  text: string;
  /** null : paragraphe réservé à l'expert (aucun constat, aucune conclusion). */
  status: Status | null;
  sources: LabeledSource[];
  /** Paragraphe signalé à corriger (reste posé après correction, pour l'historique). */
  flag?: { reason: string };
  /** Corrigé par l'expert. */
  corrected: boolean;
}

export interface ReportSection {
  id: string;
  title: string;
  paragraphs: ReportParagraph[];
}

export interface Report {
  reference: string;
  title: string;
  site: string;
  label: string;
  legend: { status: Status; label: string; hint: string }[];
  pieces: { numero: number; typeLabel: string; title: string; date: string; pages: number }[];
  sections: ReportSection[];
  flagged: { id: string; original: string; suggestion: string; reason: string };
}

export type Corrections = Readonly<Record<string, string>>;

export const FLAGGED_PARAGRAPH_ID = 'p-apparition';
export const REPORT_LABEL = 'Projet préparé pour la démonstration — traitement simulé';
export const VALIDATION_LABEL = 'Validé par l’expert (démonstration)';

/** « Validé par l’expert (démonstration) — 24/11/2026 à 14:32 » (heure de Paris). */
export function validationLabel(at: Date): string {
  const tz = { timeZone: 'Europe/Paris' } as const;
  const day = at.toLocaleDateString('fr-FR', { ...tz, day: '2-digit', month: '2-digit', year: 'numeric' });
  const time = at.toLocaleTimeString('fr-FR', { ...tz, hour: '2-digit', minute: '2-digit' });
  return `${VALIDATION_LABEL} — ${day} à ${time}`;
}

export function reportFileName(r: Pick<Report, 'reference'>): string {
  return `Rapport-${r.reference}-valide.pdf`;
}

export function isReadyToValidate(r: Report): boolean {
  return r.sections.every((s) => s.paragraphs.every((p) => !p.flag || p.corrected));
}

function flaggedDraft(d: Dossier) {
  const c = d.findings.find((f) => f.kind === 'contradiction');
  if (!c?.versions || c.versions.length < 2) throw new Error('Démonstration : contradiction attendue dans le dossier.');
  const [early, late] = c.versions;
  const ref = (s: SourceRef) => `pièce ${pieceById(d, s.pieceId)?.numero}, p. ${s.page}`;
  const courrielDate = pieceById(d, early.sources[0].pieceId)?.date;
  return {
    // Erreur volontaire du projet simulé : une date unique, présentée comme établie.
    original: typo(`Les infiltrations sont apparues pour la première fois le ${frLongDate(late.date)}.`),
    // Cite les deux pièces mot pour mot (passages de la source unique).
    suggestion: typo(
      `La date de première apparition des infiltrations diffère selon les pièces : le ${frLongDate(early.date)}, date déduite de « depuis hier » dans le courriel de l’occupante` +
      `${courrielDate ? ` du ${frLongDate(courrielDate)}` : ''} (${ref(early.sources[0])} : « ${early.sources[0].passage} »), le ${frLongDate(late.date)} selon la déclaration de sinistre (${ref(late.sources[0])} : « ${late.sources[0].passage} »). ` +
      'Date de première apparition à confirmer.',
    ),
    reason: typo(
      `Ce paragraphe retient une date unique (${frLongDate(late.date)}), présentée comme un fait établi, alors que le courriel de l’occupante (${ref(early.sources[0])}) ` +
      `situe la première apparition au ${frLongDate(early.date)} (date déduite de « depuis hier »).`,
    ),
    correctedSources: [early.sources[0], late.sources[0]],
    originalSources: [late.sources[0]],
  };
}

export function buildReport(d: Dossier, corrections: Corrections): Report {
  const label = (s: SourceRef): LabeledSource => ({ ...s, label: sourceLabel(d, s) });
  const para = (id: string, text: string, status: Status | null, sources: SourceRef[]): ReportParagraph => ({
    id,
    text: typo(text),
    status,
    sources: sources.map(label),
    corrected: false,
  });

  const draft = flaggedDraft(d);
  const typed = corrections[FLAGGED_PARAGRAPH_ID]?.trim() ?? '';
  const corrected = typed !== '' && typed !== draft.original;
  const flaggedParagraph: ReportParagraph = {
    ...para(
      FLAGGED_PARAGRAPH_ID,
      corrected ? typed : draft.original,
      corrected ? 'a_verifier' : 'etabli',
      corrected ? draft.correctedSources : draft.originalSources,
    ),
    // Texte saisi par l'expert repris tel quel (aucune retouche typographique).
    text: corrected ? typed : draft.original,
    flag: { reason: draft.reason },
    corrected,
  };

  const inventory = d.pieces
    .map((p) => `pièce ${p.numero}, ${p.typeLabel.replace(/^[A-Z](?=[a-zà-ÿ])/, (c) => c.toLowerCase())} du ${frLongDate(p.date)} (${p.pages.length} p.)`)
    .join(' ; ');

  const sections: ReportSection[] = [
    {
      id: 'objet',
      title: 'Objet et pièces examinées',
      paragraphs: [
        para('p-objet', `Le présent projet porte sur des infiltrations déclarées en pied de la baie coulissante du séjour du logement B12 (${d.site}).`, 'etabli', [S.objet]),
        para(
          'p-pieces',
          `Pièces examinées : ${inventory}. Chaque élément ci-dessous renvoie à une pièce et à une page.`,
          'etabli',
          d.pieces.map((p) => ({ pieceId: p.id, page: 1, passage: p.pages[0].split('\n')[0] })),
        ),
      ],
    },
    {
      id: 'chronologie',
      title: 'Chronologie',
      paragraphs: [
        para('p-reception', 'La réception des travaux du lot menuiseries a été prononcée le 14 mars 2024, avec réserves ; la réserve n° 2 vise la baie coulissante du séjour du logement B12.', 'etabli', [S.reception, S.reserve]),
        flaggedParagraph,
        para('p-declaration', 'Déclaration de sinistre datée du 20 février 2025, à l’attention de l’assureur dommages-ouvrage (date d’envoi et de réception non établies par les pièces).', 'etabli', [S.declarationEnvoi, S.declarationDestinataire]),
        para('p-devis', 'Un devis de reprise du 3 mars 2025, d’un montant de 2 840,00 € HT (montant fictif), figure au dossier. Il décrit des travaux proposés et n’établit pas, à lui seul, l’origine des désordres.', 'etabli', [S.devisDate, S.devis]),
      ],
    },
    {
      id: 'constatations',
      title: typo('Constatations de la visite du 11 mars 2025'),
      paragraphs: [
        para('p-constats', 'Traces d’humidité visibles en pied de la baie coulissante sur environ 1,20 m ; plinthe gonflée sous le seuil ; discontinuité visible du joint en pied de menuiserie sur environ 15 cm.', 'etabli', [S.humidite, S.plinthe, S.joint]),
        para('p-mesure', 'Une mesure à l’humidimètre indique 28 %, valeur relevée en un seul point, sans cartographie.', 'etabli', [S.humidimetre]),
      ],
    },
    {
      id: 'verifier',
      title: 'Points à vérifier',
      paragraphs: [
        para('p-manquant', 'Le compte rendu de visite mentionne un rapport de recherche de fuite du 12 février 2025, qui aurait été réalisé à la demande du syndic et n’a pas été remis. Ce document est absent du dossier : à obtenir.', 'a_verifier', [S.rechercheFuite, S.nonRemis]),
      ],
    },
    {
      id: 'appreciation',
      title: 'Cause, responsabilités et garanties',
      paragraphs: [
        para('p-appreciation', 'Cette section relève de l’appréciation de l’expert. Aucune conclusion n’est générée sur la cause des désordres, les responsabilités ou les garanties : la démonstration organise les pièces et signale les points à vérifier, sans conclure.', null, []),
      ],
    },
  ];

  return {
    reference: d.reference,
    title: d.title,
    site: d.site,
    label: REPORT_LABEL,
    legend: (Object.keys(STATUS_LABEL) as Status[]).map((s) => ({ status: s, label: STATUS_LABEL[s], hint: STATUS_HINT[s] })),
    pieces: d.pieces.map((p) => ({ numero: p.numero, typeLabel: p.typeLabel, title: p.title, date: p.date, pages: p.pages.length })),
    sections,
    flagged: { id: FLAGGED_PARAGRAPH_ID, original: draft.original, suggestion: draft.suggestion, reason: draft.reason },
  };
}
