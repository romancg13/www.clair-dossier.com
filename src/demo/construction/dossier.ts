// DOSSIER FICTIF — démonstration « assurance construction ».
// SOURCE UNIQUE des données : l'écran (src/pages/DemoConstruction.tsx) et le PDF
// (report-pdf.ts, via report.ts) lisent cet objet ; rien n'est dupliqué ailleurs.
// Toutes les personnes, sociétés, adresses et montants sont inventés. Aucun document
// réel n'est lu : les constats ci-dessous sont saisis à la main pour la démonstration
// (traitement simulé). Aucune conclusion sur la cause, la responsabilité ou la garantie.
// Contrat vérifié par tests/demo-construction.test.ts : chaque passage cité figure mot
// pour mot à la page indiquée.

export type Status = 'etabli' | 'declaration' | 'a_verifier';

export const STATUS_LABEL: Record<Status, string> = {
  etabli: 'Fait établi',
  declaration: 'Déclaration',
  a_verifier: 'Point à vérifier',
};

export const STATUS_HINT: Record<Status, string> = {
  etabli: 'porté par une pièce du dossier',
  declaration: 'affirmée par une partie, non vérifiée',
  a_verifier: 'divergence entre pièces ou pièce absente',
};

export type PieceType = 'pv-reception' | 'declaration-sinistre' | 'compte-rendu' | 'devis' | 'courriel';

export interface Piece {
  id: string;
  numero: number;
  type: PieceType;
  typeLabel: string;
  title: string;
  /** Date du document (AAAA-MM-JJ). */
  date: string;
  author: string;
  /** Texte de chaque page ; paragraphes séparés par une ligne vide. */
  pages: readonly string[];
}

export interface SourceRef {
  pieceId: string;
  page: number;
  /** Passage exact, présent mot pour mot dans le texte de la page. */
  passage: string;
}

export interface ChronologyEvent {
  id: string;
  date: string;
  /** Événement décrit (deux entrées peuvent viser le même événement). */
  event: string;
  label: string;
  status: Status;
  sources: SourceRef[];
  contradictionId?: string;
}

export interface Finding {
  id: string;
  kind: 'contradiction' | 'piece-manquante' | 'constat';
  title: string;
  text: string;
  status: Status;
  sources: SourceRef[];
  /** Contradiction : même événement, versions divergentes. */
  event?: string;
  versions?: { date: string; according: string; sources: SourceRef[] }[];
  /** Pièce annoncée mais absente du dossier. */
  announced?: { title: string; date: string };
}

export interface Party {
  role: string;
  name: string;
}

export interface Dossier {
  reference: string;
  title: string;
  site: string;
  parties: readonly Party[];
  pieces: readonly Piece[];
  chronology: readonly ChronologyEvent[];
  findings: readonly Finding[];
}

const MO = 'SCCV Parc Imaginaire (fictive)';
const MENUISIER = 'Menuiseries Exemple (fictive)';
const SYNDIC = 'Syndic Exemple Gestion (fictif)';
const OCCUPANTE = 'Mme Lise Exemple, occupante (fictive)';
const ASSUREUR = 'Assureur DO Démonstration (fictif)';
const RESIDENCE = 'Résidence du Parc Imaginaire (fictive)';

const APPARITION = 'Première apparition des infiltrations';

const MOIS = 'janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre';
const AVANT_UNITE = new RegExp(`(\\d|\\b1er) (?=(?:${MOIS}|%|cm|m|€|h)(?![\\p{L}\\d]))`, 'gu');

/** Typographie française, idempotente : U+202F avant ; : ! ? » et après «, U+00A0 entre
 * un nombre et son unité ou son mois, après « n° » et entre groupes de milliers ; apostrophe ’.
 * Appliquée à la source (pages ET passages cités) : la citation mot pour mot reste exacte. */
export function typo<T>(v: T): T {
  if (typeof v === 'string') {
    return v
      .replace(/'/g, '’')
      .replace(/[ \u00a0]([;:!?»])/g, '\u202f$1')
      .replace(/« /g, '«\u202f')
      .replace(/([nN]°) /g, '$1\u00a0')
      .replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0')
      .replace(AVANT_UNITE, '$1\u00a0')
      .replace(/(\d\u00a0h) (?=\d)/g, '$1\u00a0') as T;
  }
  if (Array.isArray(v)) return v.map(typo) as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, typo(x)])) as T;
  return v;
}

const src = (pieceId: string, page: number, passage: string): SourceRef => ({ pieceId, page, passage: typo(passage) });

const PIECES: Piece[] = typo([
  {
    id: 'piece-1',
    numero: 1,
    type: 'pv-reception',
    typeLabel: 'PV de réception',
    title: 'Procès-verbal de réception des travaux',
    date: '2024-03-14',
    author: MO,
    pages: [
      `PROCÈS-VERBAL DE RÉCEPTION DES TRAVAUX — DOCUMENT FICTIF

Opération : ${RESIDENCE}, bâtiment B, 24 logements.

Maître d’ouvrage : ${MO}. Entreprise du lot n° 7 « Menuiseries extérieures » : ${MENUISIER}.

Le maître d’ouvrage déclare prononcer la réception des travaux du lot n° 7 à la date du 14 mars 2024, avec les réserves énumérées en page 2.

Fait en deux exemplaires, le 14 mars 2024.`,
      `ANNEXE — LISTE DES RÉSERVES

Réserve n° 1 — Hall du bâtiment B : reprise de la peinture du chambranle de la porte d’entrée.

Réserve n° 2 — Logement B12, séjour : baie coulissante, réglage du vantail et reprise du joint en pied de menuiserie.

Réserve n° 3 — Logement B07, chambre : remplacement d’une poignée de fenêtre.

Signatures du maître d’ouvrage et de l’entreprise (fictifs).`,
    ],
  },
  {
    id: 'piece-2',
    numero: 2,
    type: 'declaration-sinistre',
    typeLabel: 'Déclaration de sinistre',
    title: 'Déclaration de sinistre à l’assureur dommages-ouvrage',
    date: '2025-02-20',
    author: SYNDIC,
    pages: [
      `DÉCLARATION DE SINISTRE — DOMMAGES-OUVRAGE — DOCUMENT FICTIF

Expéditeur : ${SYNDIC}, pour le syndicat des copropriétaires de la ${RESIDENCE}.
Destinataire : ${ASSUREUR}.
Date : 20 février 2025.

Nous vous déclarons des infiltrations d’eau dans le séjour du logement B12, en pied de la baie coulissante. Selon l’occupante, les infiltrations sont apparues pour la première fois le 6 janvier 2025.

Désordres déclarés : traces d’humidité au sol et en bas de cloison, gonflement de la plinthe.

Nous restons à votre disposition pour organiser une visite du logement.`,
    ],
  },
  {
    id: 'piece-3',
    numero: 3,
    type: 'compte-rendu',
    typeLabel: 'Compte rendu de visite',
    title: 'Compte rendu de la visite du 11 mars 2025',
    date: '2025-03-11',
    author: 'Cabinet Expertise Démo (fictif)',
    pages: [
      `COMPTE RENDU DE VISITE — DOCUMENT FICTIF

Visite du 11 mars 2025 au logement B12, ${RESIDENCE}.

Personnes présentes : l’occupante du logement, un représentant du syndic et un représentant de l’entreprise du lot menuiseries (tous fictifs).

Objet : constatations relatives aux infiltrations déclarées en pied de la baie coulissante du séjour.`,
      `CONSTATATIONS

Des traces d’humidité sont visibles en pied de la baie coulissante du séjour, sur environ 1,20 m de largeur.

La plinthe située sous le seuil de la baie présente un gonflement.

Une mesure à l’humidimètre réalisée au pied de la cloison indique 28 % (valeur relevée en un point, sans cartographie).

Le joint en pied de menuiserie présente une discontinuité visible sur environ 15 cm.`,
      `DOCUMENTS ÉVOQUÉS

L’occupante indique qu’un rapport de recherche de fuite du 12 février 2025 aurait été réalisé à la demande du syndic. Ce rapport n’a pas été remis lors de la visite.

Suite à donner : documents à réunir avant toute analyse.

Le présent compte rendu relate des constatations ; il ne se prononce pas sur l’origine des désordres.`,
    ],
  },
  {
    id: 'piece-4',
    numero: 4,
    type: 'devis',
    typeLabel: 'Devis',
    title: 'Devis de reprise n° D-DEMO-0303',
    date: '2025-03-03',
    author: MENUISIER,
    pages: [
      `DEVIS N° D-DEMO-0303 — DOCUMENT FICTIF

Émetteur : ${MENUISIER}. Date : 3 mars 2025.

Objet : reprise en pied de la baie coulissante du séjour, logement B12.

Prestations : dépose et repose du seuil, remplacement du joint en pied de menuiserie, remplacement de la plinthe.

Montant total : 2 840,00 € HT (montant fictif).`,
    ],
  },
  {
    id: 'piece-5',
    numero: 5,
    type: 'courriel',
    typeLabel: 'Courriel',
    title: 'Courriel de l’occupante au syndic',
    date: '2024-11-19',
    author: OCCUPANTE,
    pages: [
      `COURRIEL — DOCUMENT FICTIF

De : ${OCCUPANTE}
À : ${SYNDIC}
Date : 19 novembre 2024, 08 h 42
Objet : eau sous la baie du séjour

Bonjour,

Depuis hier, de l’eau apparaît au sol au pied de la baie coulissante du séjour, après la pluie. La plinthe commence à se décoller.

Pouvez-vous faire intervenir quelqu’un ?

Cordialement.`,
    ],
  },
]);

const S = typo({
  reception: src('piece-1', 1, 'prononcer la réception des travaux du lot n° 7 à la date du 14 mars 2024, avec les réserves énumérées en page 2'),
  reserve: src('piece-1', 2, 'Réserve n° 2 — Logement B12, séjour : baie coulissante, réglage du vantail et reprise du joint en pied de menuiserie.'),
  courrielDate: src('piece-5', 1, 'Date : 19 novembre 2024, 08 h 42'),
  depuisHier: src('piece-5', 1, 'Depuis hier, de l’eau apparaît au sol au pied de la baie coulissante du séjour'),
  declarationDate: src('piece-2', 1, 'Selon l’occupante, les infiltrations sont apparues pour la première fois le 6 janvier 2025.'),
  declarationEnvoi: src('piece-2', 1, 'Date : 20 février 2025.'),
  declarationDestinataire: src('piece-2', 1, `Destinataire : ${ASSUREUR}.`),
  rechercheFuite: src('piece-3', 3, 'un rapport de recherche de fuite du 12 février 2025 aurait été réalisé à la demande du syndic'),
  nonRemis: src('piece-3', 3, 'Ce rapport n’a pas été remis lors de la visite.'),
  devis: src('piece-4', 1, 'Montant total : 2 840,00 € HT (montant fictif).'),
  devisDate: src('piece-4', 1, 'Date : 3 mars 2025.'),
  visite: src('piece-3', 1, 'Visite du 11 mars 2025 au logement B12'),
  objet: src('piece-3', 1, 'constatations relatives aux infiltrations déclarées en pied de la baie coulissante du séjour'),
  humidite: src('piece-3', 2, 'Des traces d’humidité sont visibles en pied de la baie coulissante du séjour, sur environ 1,20 m de largeur.'),
  plinthe: src('piece-3', 2, 'La plinthe située sous le seuil de la baie présente un gonflement.'),
  humidimetre: src('piece-3', 2, 'Une mesure à l’humidimètre réalisée au pied de la cloison indique 28 % (valeur relevée en un point, sans cartographie).'),
  joint: src('piece-3', 2, 'Le joint en pied de menuiserie présente une discontinuité visible sur environ 15 cm.'),
} as const);

/** Références de sources réutilisées par le projet de rapport (même objet, aucune copie). */
export const SOURCES = S;

const CONTRADICTION_ID = 'contradiction-apparition';

const CHRONOLOGY: ChronologyEvent[] = typo([
  { id: 'evt-reception', date: '2024-03-14', event: 'Réception des travaux', label: 'Réception des travaux du lot menuiseries, prononcée avec réserves', status: 'etabli', sources: [S.reception] },
  { id: 'evt-reserve', date: '2024-03-14', event: 'Réserve sur la baie du séjour', label: 'Réserve n° 2 : baie coulissante du séjour du logement B12', status: 'etabli', sources: [S.reserve] },
  { id: 'evt-apparition-courriel', date: '2024-11-18', event: APPARITION, label: 'Première apparition de l’eau selon l’occupante (date déduite de « depuis hier », courriel du 19 novembre 2024)', status: 'declaration', sources: [S.depuisHier, S.courrielDate], contradictionId: CONTRADICTION_ID },
  { id: 'evt-courriel', date: '2024-11-19', event: 'Courriel de l’occupante', label: 'Courriel de l’occupante au syndic', status: 'etabli', sources: [S.courrielDate] },
  { id: 'evt-apparition-declaration', date: '2025-01-06', event: APPARITION, label: 'Première apparition des infiltrations selon la déclaration de sinistre (d’après l’occupante)', status: 'declaration', sources: [S.declarationDate], contradictionId: CONTRADICTION_ID },
  { id: 'evt-recherche-fuite', date: '2025-02-12', event: 'Recherche de fuite', label: 'Rapport de recherche de fuite — mentionné, non remis', status: 'a_verifier', sources: [S.rechercheFuite, S.nonRemis] },
  { id: 'evt-declaration', date: '2025-02-20', event: 'Déclaration de sinistre', label: 'Déclaration de sinistre datée du 20 février 2025, à l’attention de l’assureur dommages-ouvrage (date d’envoi et de réception non établies par les pièces)', status: 'etabli', sources: [S.declarationEnvoi, S.declarationDestinataire] },
  { id: 'evt-devis', date: '2025-03-03', event: 'Devis de reprise', label: 'Devis de reprise émis par l’entreprise du lot menuiseries', status: 'etabli', sources: [S.devisDate, S.devis] },
  { id: 'evt-visite', date: '2025-03-11', event: 'Visite', label: 'Visite du logement et constatations', status: 'etabli', sources: [S.visite] },
]);

const FINDINGS: Finding[] = typo([
  {
    id: CONTRADICTION_ID,
    kind: 'contradiction',
    title: 'Deux dates pour la première apparition des infiltrations',
    text: 'Le courriel de l’occupante du 19 novembre 2024 situe la première apparition au 18 novembre 2024 (date déduite de « depuis hier ») ; la déclaration de sinistre indique le 6 janvier 2025, selon l’occupante. Les pièces ne permettent pas de trancher : date à confirmer.',
    status: 'a_verifier',
    event: APPARITION,
    versions: [
      { date: '2024-11-18', according: 'Courriel de l’occupante du 19 novembre 2024 (date déduite de « depuis hier »)', sources: [S.depuisHier, S.courrielDate] },
      { date: '2025-01-06', according: 'Déclaration de sinistre du syndic', sources: [S.declarationDate] },
    ],
    sources: [S.depuisHier, S.declarationDate],
  },
  {
    id: 'piece-manquante-recherche-fuite',
    kind: 'piece-manquante',
    title: 'Rapport de recherche de fuite annoncé, absent du dossier',
    text: 'Le compte rendu de visite mentionne un rapport de recherche de fuite du 12 février 2025, non remis. Il ne figure pas parmi les pièces : à obtenir avant toute analyse.',
    status: 'a_verifier',
    announced: { title: 'Rapport de recherche de fuite', date: '2025-02-12' },
    sources: [S.rechercheFuite, S.nonRemis],
  },
  { id: 'constat-reserve', kind: 'constat', title: 'Réserve à la réception sur la baie du séjour', text: 'La réserve n° 2 vise la baie coulissante du séjour du logement B12 (réglage du vantail, joint en pied de menuiserie).', status: 'etabli', sources: [S.reserve] },
  { id: 'constat-humidite', kind: 'constat', title: 'Traces d’humidité en pied de baie', text: 'Traces d’humidité sur environ 1,20 m et plinthe gonflée, constatées lors de la visite du 11 mars 2025.', status: 'etabli', sources: [S.humidite, S.plinthe] },
  { id: 'constat-humidimetre', kind: 'constat', title: 'Mesure à l’humidimètre', text: '28 % relevés en un seul point, sans cartographie de l’humidité.', status: 'etabli', sources: [S.humidimetre] },
  { id: 'constat-joint', kind: 'constat', title: 'Joint en pied de menuiserie', text: 'Discontinuité visible du joint sur environ 15 cm, relevée sans interprétation.', status: 'etabli', sources: [S.joint] },
  { id: 'constat-devis', kind: 'constat', title: 'Devis de reprise', text: 'Devis de 2 840,00 € HT (montant fictif). Un devis décrit des travaux proposés : il n’établit pas une cause.', status: 'etabli', sources: [S.devis] },
]);

export const DOSSIER: Dossier = typo({
  reference: 'DEMO-IC-2025-014',
  title: 'Infiltrations déclarées en pied de baie coulissante — séjour du logement B12',
  site: `${RESIDENCE}, bâtiment B`,
  parties: [
    { role: 'Maître d’ouvrage', name: MO },
    { role: 'Entreprise du lot menuiseries', name: MENUISIER },
    { role: 'Syndic', name: SYNDIC },
    { role: 'Occupante', name: 'Mme Lise Exemple (fictive)' },
    { role: 'Assureur dommages-ouvrage', name: ASSUREUR },
  ],
  pieces: PIECES,
  chronology: CHRONOLOGY,
  findings: FINDINGS,
});

export function pieceById(d: Dossier, id: string): Piece | undefined {
  return d.pieces.find((p) => p.id === id);
}

export function pageText(d: Dossier, pieceId: string, page: number): string | undefined {
  return pieceById(d, pieceId)?.pages[page - 1];
}

/** Tous les éléments sourcés présentés à l'écran (chronologie + constats). */
export function allSourcedItems(d: Dossier): { id: string; status: Status; sources: SourceRef[] }[] {
  return [...d.chronology, ...d.findings];
}

/** « Pièce 5 — Courriel, p. 1 » */
export function sourceLabel(d: Dossier, s: SourceRef): string {
  const p = pieceById(d, s.pieceId);
  return p ? `Pièce ${p.numero} — ${p.typeLabel}, p. ${s.page}` : `Pièce inconnue, p. ${s.page}`;
}

const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

/** 2024-11-18 → « 18 novembre 2024 » (sans fuseau : la date est une date civile). */
export function frLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return typo(`${d === 1 ? '1er' : d} ${MONTHS[m - 1]} ${y}`);
}
