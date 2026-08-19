/**
 * LDI — de la pièce ingérée à la pièce du dossier.
 *
 * ┌─ CHAQUE MÉTADONNÉE EST UNE PROPOSITION ─────────────────────────────────┐
 * │ Rien de ce qui est déduit ici n'est réputé confirmé. Une date lue dans   │
 * │ un texte, une nature devinée d'un intitulé : ce sont des lectures, et    │
 * │ elles arrivent avec l'EXTRAIT qui les a produites, pour que l'avocat     │
 * │ puisse juger sur pièce au lieu de faire confiance.                        │
 * │                                                                          │
 * │ D'où l'état `propose` par défaut. Il n'existe aucun chemin par lequel    │
 * │ une extraction devient `confirme` sans geste humain : la seule fonction  │
 * │ qui produit cet état exige qu'on la lui demande.                          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import type { NaturePiece, Piece } from '../types';
import type { PieceIngeree } from './types';

export type EtatMetadonnee = 'propose' | 'confirme' | 'corrige';

export type Metadonnee<T> = {
  valeur: T;
  etat: EtatMetadonnee;
  /** Extrait du document qui a produit la proposition. Vide si aucune. */
  justificatif: string;
};

export type FicheMiseEnEtat = {
  empreinte: string;
  nomFichier: string;
  cote: Metadonnee<string>;
  nature: Metadonnee<NaturePiece>;
  date: Metadonnee<string | null>;
  /** Nombre de pages, et combien attendent une relecture. */
  pages: { total: number; quarantaine: number };
  /** Vrai si tout le texte de la pièce provient d'une couche non relue. */
  texteNonRelu: boolean;
};

function propose<T>(valeur: T, justificatif = ''): Metadonnee<T> {
  return { valeur, etat: 'propose', justificatif };
}

/**
 * Confirme une métadonnée. Seule voie vers l'état `confirme`, et elle exige un
 * appel explicite : aucune extraction ne peut s'auto-confirmer.
 */
export function confirmer<T>(m: Metadonnee<T>): Metadonnee<T> {
  return { ...m, etat: 'confirme' };
}

/** Corrige une métadonnée à la main. L'état retient que la machine s'est trompée. */
export function corriger<T>(m: Metadonnee<T>, valeur: T): Metadonnee<T> {
  return { valeur, etat: 'corrige', justificatif: m.justificatif };
}

/**
 * Dates trouvées dans un texte, sous les formes rencontrées en procédure.
 * Rendues au format ISO, avec l'extrait qui les entoure.
 */
const MOIS: Record<string, string> = {
  janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', août: '08', aout: '08', septembre: '09', octobre: '10', novembre: '11',
  décembre: '12', decembre: '12',
};

const RE_DATES = [
  // 2026-03-14
  /\b(\d{4})-(\d{2})-(\d{2})\b/g,
  // 14/03/2026 ou 14.03.2026
  /\b(\d{1,2})[/.](\d{1,2})[/.](\d{4})\b/g,
  // 14 mars 2026
  new RegExp(`\\b(\\d{1,2})\\s+(${Object.keys(MOIS).join('|')})\\s+(\\d{4})\\b`, 'gi'),
];

export function datesDuTexte(texte: string): { iso: string; extrait: string }[] {
  const out: { iso: string; extrait: string }[] = [];

  for (const [i, re] of RE_DATES.entries()) {
    for (const m of texte.matchAll(re)) {
      let iso: string | null = null;
      if (i === 0) iso = `${m[1]}-${m[2]}-${m[3]}`;
      else if (i === 1) iso = `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
      else {
        const mois = MOIS[m[2].toLowerCase()];
        if (mois) iso = `${m[3]}-${mois}-${pad(m[1])}`;
      }
      if (!iso || !dateReelle(iso)) continue;

      const debut = Math.max(0, (m.index ?? 0) - 40);
      out.push({
        iso,
        extrait: texte.slice(debut, (m.index ?? 0) + m[0].length + 40).replace(/\s+/g, ' ').trim(),
      });
    }
  }
  return out;
}

function pad(n: string): string {
  return n.padStart(2, '0');
}

/** Rejette le 30 février : `Date.UTC` déborde silencieusement au lieu d'échouer. */
function dateReelle(iso: string): boolean {
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 1, j));
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j;
}

/**
 * Indices de nature, cherchés dans l'intitulé et les premières lignes.
 *
 * Volontairement grossier, et c'est assumé : la nature exacte se lit dans le
 * document, pas dans son nom de fichier. La proposition sert à pré-remplir un
 * formulaire, jamais à décider.
 *
 * L'ordre est significatif — du PLUS SPÉCIFIQUE au plus générique. Un
 * « procès-verbal d'audition » est donc classé `audition` : presque toute pièce
 * d'enquête est un procès-verbal, si bien que cette nature ne distingue rien.
 * Ce qui distingue, c'est l'acte que le procès-verbal constate.
 */
const INDICES: { nature: NaturePiece; motif: RegExp }[] = [
  { nature: 'audition', motif: /\baudition\b|\binterrogatoire\b/i },
  { nature: 'expertise', motif: /\bexpertise\b|\brapport d.expert/i },
  { nature: 'temoignage', motif: /\btémoignage\b|\btemoignage\b|\btémoin\b/i },
  { nature: 'ecoute', motif: /\bécoute\b|\binterception\b/i },
  { nature: 'photographie', motif: /\bphotographie\b|\bcliché\b/i },
  { nature: 'piece-technique', motif: /\bscellé\b|\bscelle\b|\bexploitation technique\b/i },
  { nature: 'proces-verbal', motif: /\bproc[èe]s[- ]verbal\b|\bP\.?V\.?\b/i },
];

export function natureProposee(
  nomFichier: string,
  texte: string
): { nature: NaturePiece; justificatif: string } {
  const entete = `${nomFichier}\n${texte.slice(0, 400)}`;
  for (const { nature, motif } of INDICES) {
    const m = motif.exec(entete);
    if (m) {
      const debut = Math.max(0, (m.index ?? 0) - 30);
      return {
        nature,
        justificatif: entete.slice(debut, (m.index ?? 0) + m[0].length + 30).replace(/\s+/g, ' ').trim(),
      };
    }
  }
  return { nature: 'autre', justificatif: '' };
}

/**
 * Construit les fiches de mise en état.
 *
 * La cote est proposée par numérotation d'ordre — `D1`, `D2`… — parce qu'aucune
 * lecture ne permet de deviner la cotation d'un cabinet. Elle est donc
 * `propose` comme le reste, et réversible.
 */
export function mettreEnEtat(pieces: PieceIngeree[], prefixeCote = 'D'): FicheMiseEnEtat[] {
  return pieces.map((piece, i) => {
    const texte = piece.pages.map((p) => p.texte).join('\n');
    const dates = datesDuTexte(texte);
    const { nature, justificatif } = natureProposee(piece.nomFichier, texte);

    return {
      empreinte: piece.empreinte,
      nomFichier: piece.nomFichier,
      cote: propose(`${prefixeCote}${i + 1}`),
      nature: propose(nature, justificatif),
      // La date la plus ancienne du document : celle de l'acte, le plus souvent.
      // Proposition, avec son extrait — l'avocat tranche.
      date: dates.length > 0
        ? propose(
            dates.reduce((a, b) => (a.iso <= b.iso ? a : b)).iso,
            dates.reduce((a, b) => (a.iso <= b.iso ? a : b)).extrait
          )
        : propose(null, ''),
      pages: {
        total: piece.pages.length,
        quarantaine: piece.pages.filter((p) => p.quarantaine).length,
      },
      texteNonRelu: piece.pages.every((p) => p.methode === 'ocr'),
    };
  });
}

/** Convertit les fiches en pièces de dossier, prêtes pour l'analyse. */
export function versPieces(fiches: FicheMiseEnEtat[]): Piece[] {
  return fiches.map((f) => ({
    id: f.cote.valeur,
    cote: f.cote.valeur,
    nature: f.nature.valeur,
    intitule: f.nomFichier,
    ...(f.date.valeur ? { date: f.date.valeur } : {}),
  }));
}

/**
 * Bordereau de communication de pièces.
 *
 * Les métadonnées encore `propose` sont marquées : un bordereau déposé au
 * greffe ne peut pas reposer sur des lectures automatiques non relues, et le
 * document doit le dire au lieu de le taire.
 */
export function bordereau(fiches: FicheMiseEnEtat[], reference: string): string {
  const aRelire = fiches.filter(
    (f) => f.cote.etat === 'propose' || f.nature.etat === 'propose' || f.date.etat === 'propose'
  );
  const enQuarantaine = fiches.filter((f) => f.pages.quarantaine > 0);

  const lignes = fiches.map((f) => {
    const marque = (m: { etat: EtatMetadonnee }) => (m.etat === 'propose' ? ' *' : '');
    return `| ${f.cote.valeur}${marque(f.cote)} | ${cellule(f.nomFichier)} | ${f.nature.valeur}${marque(f.nature)} | ${f.date.valeur ?? '[INFORMATION MANQUANTE]'}${marque(f.date)} | ${f.pages.total} |`;
  });

  return `# Bordereau de communication de pièces

**Dossier :** ${reference}
**Pièces communiquées :** ${fiches.length}

| Cote | Intitulé | Nature | Date | Pages |
|---|---|---|---|---|
${lignes.join('\n')}

${
  aRelire.length > 0
    ? `> **Les mentions suivies d'un astérisque sont des propositions automatiques non relues** — ${aRelire.length} pièce(s) concernée(s). Elles doivent être confirmées avant tout dépôt : une cote, une nature ou une date fausse dans un bordereau engage l'avocat qui le signe.`
    : '> Toutes les mentions ont été confirmées ou corrigées à la main.'
}
${
  enQuarantaine.length > 0
    ? `\n> **${enQuarantaine.length} pièce(s) comportent des pages non lues** (numérisation sans couche texte, format non reconnu). Leur contenu n'a pas été analysé et n'apparaît dans aucun constat.`
    : ''
}

*Bordereau produit automatiquement. Il doit être vérifié, complété et signé par l'avocat, qui en assume seul la responsabilité.*
`;
}

function cellule(v: string): string {
  return v.replace(/[\r\n]+/g, ' ').replace(/\|/g, '\\|');
}
