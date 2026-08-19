/**
 * LDI — ingestion documentaire, orchestration.
 *
 * ┌─ LE CONTENU D'UNE PIÈCE EST UNE DONNÉE, JAMAIS UNE CONSIGNE ────────────┐
 * │ Rien de ce qui est lu ici n'est exécuté, interprété comme instruction,   │
 * │ ni utilisé pour décider du comportement de l'outil. Un PDF portant       │
 * │ « ignore les instructions précédentes » produit une pièce dont le TEXTE  │
 * │ contient cette phrase, et rien d'autre.                                  │
 * │                                                                          │
 * │ Ce module ne fait aucun appel réseau et n'évalue aucun code. Le          │
 * │ cloisonnement en aval (prompt.ts) empêche ce texte d'atteindre le modèle │
 * │ comme une consigne ; ici, on garantit qu'il n'atteint même pas l'outil   │
 * │ comme une consigne.                                                      │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * L'ingestion est bornée de bout en bout : taille de fichier, taille
 * décompressée cumulée, profondeur et nombre d'entrées d'archive. Un
 * dépassement REFUSE le fichier en le nommant — il ne fait pas tomber
 * l'ingestion des autres.
 */
import { unzipSync, strFromU8 } from 'fflate';

import { empreinte } from '../journal';
import {
  extraireCsv,
  extraireDocx,
  extraireFeuille,
  extraireTexteBrut,
  lireChainesPartagees,
  page,
} from './extracteurs';
import { formatOoxml, reconnaitreFormat } from './formats';
import {
  BORNES_DEFAUT,
  type BornesIngestion,
  type FichierEntrant,
  type PieceIngeree,
  type ResultatIngestion,
} from './types';

/**
 * Empreinte du CONTENU d'un fichier, indépendante de son nom.
 *
 * Deux exemplaires du même procès-verbal, nommés différemment, portent la même
 * empreinte : c'est ce qui permet le dédoublonnage, et c'est aussi la clé qui
 * fera qu'ajouter vingt pièces à un dossier de deux cents n'en réanalysera que
 * vingt.
 */
export function empreinteContenu(octets: Uint8Array): string {
  // `empreinte` travaille sur du texte : les octets sont rendus dans une forme
  // stable et sans perte plutôt que décodés, un décodage UTF-8 rendant le même
  // caractère de remplacement pour des octets différents.
  let binaire = '';
  for (let i = 0; i < octets.length; i += 1) binaire += String.fromCharCode(octets[i]);
  return empreinte(binaire);
}

type Contexte = {
  bornes: BornesIngestion;
  /** Cumul décompressé, partagé par toute l'ingestion. */
  decompresse: { total: number };
  resultat: ResultatIngestion;
  /** empreinte → nom du premier fichier porteur. */
  vues: Map<string, string>;
};

/**
 * Ingère un lot de fichiers.
 *
 * Synchrone et sans réseau pour tout ce qui n'est pas PDF : les formats
 * bureautiques et textuels sont traités ici même. Le PDF, qui exige une
 * dépendance lourde, est traité par `ingererPdf` chargé paresseusement.
 */
export function ingerer(
  fichiers: FichierEntrant[],
  bornes: BornesIngestion = BORNES_DEFAUT
): ResultatIngestion {
  const ctx: Contexte = {
    bornes,
    decompresse: { total: 0 },
    resultat: {
      pieces: [],
      doublons: [],
      refuses: [],
      compteurs: { pieces: 0, pagesTotal: 0, pagesEnQuarantaine: 0, pagesCorrigees: 0 },
    },
    vues: new Map(),
  };

  for (const fichier of fichiers) traiter(fichier, ctx, 0);

  recompter(ctx.resultat);
  return ctx.resultat;
}

function traiter(fichier: FichierEntrant, ctx: Contexte, profondeur: number): void {
  const { bornes, resultat } = ctx;

  if (fichier.octets.length === 0) {
    resultat.refuses.push({ nomFichier: fichier.nom, motif: 'Fichier vide.' });
    return;
  }
  if (fichier.octets.length > bornes.tailleMaxFichier) {
    resultat.refuses.push({
      nomFichier: fichier.nom,
      motif: `Fichier de ${Math.round(fichier.octets.length / 1024 / 1024)} Mo : au-delà de la borne de ${Math.round(bornes.tailleMaxFichier / 1024 / 1024)} Mo.`,
    });
    return;
  }

  const empreinteFichier = empreinteContenu(fichier.octets);
  const dejaVu = ctx.vues.get(empreinteFichier);
  if (dejaVu) {
    resultat.doublons.push({
      nomFichier: fichier.nom,
      empreinte: empreinteFichier,
      identiqueA: dejaVu,
    });
    return;
  }
  ctx.vues.set(empreinteFichier, fichier.nom);

  const format = reconnaitreFormat(fichier.nom, fichier.octets);

  if (format === 'archive') {
    ouvrirArchive(fichier, ctx, profondeur, empreinteFichier);
    return;
  }

  resultat.pieces.push(extraire(fichier, format, empreinteFichier, bornes));
}

/**
 * Ouvre une archive — `.zip`, mais aussi `.docx` et `.xlsx`, qui en sont.
 *
 * Les bornes sont vérifiées AVANT d'accumuler : une bombe de décompression se
 * reconnaît à ce qu'elle dépasse le cumul autorisé, pas à ce qu'elle épuise la
 * mémoire.
 */
function ouvrirArchive(
  fichier: FichierEntrant,
  ctx: Contexte,
  profondeur: number,
  empreinteFichier: string
): void {
  const { bornes, resultat } = ctx;

  if (profondeur >= bornes.profondeurMaxArchive) {
    resultat.refuses.push({
      nomFichier: fichier.nom,
      motif: `Archives imbriquées au-delà de ${bornes.profondeurMaxArchive} niveaux : ouverture refusée.`,
    });
    return;
  }

  let entrees: Record<string, Uint8Array>;
  try {
    entrees = unzipSync(fichier.octets);
  } catch (e) {
    resultat.refuses.push({
      nomFichier: fichier.nom,
      motif: `Archive illisible — ${(e as Error).message}`,
    });
    return;
  }

  const noms = Object.keys(entrees);

  // Un `.docx` ou un `.xlsx` est une archive : on la traite comme un document,
  // pas comme un lot de fichiers.
  const ooxml = formatOoxml(noms);
  if (ooxml === 'docx') {
    resultat.pieces.push(pieceDocx(fichier, entrees, empreinteFichier, bornes));
    return;
  }
  if (ooxml === 'tableur') {
    resultat.pieces.push(pieceTableur(fichier, entrees, empreinteFichier, bornes));
    return;
  }

  if (noms.length > bornes.entreesMaxArchive) {
    resultat.refuses.push({
      nomFichier: fichier.nom,
      motif: `Archive de ${noms.length} entrées : au-delà de la borne de ${bornes.entreesMaxArchive}.`,
    });
    return;
  }

  for (const nom of noms) {
    const octets = entrees[nom];
    // Les répertoires sont des entrées vides : rien à ingérer. Un FICHIER vide,
    // en revanche, descend jusqu'au refus nommé — dans un dossier de procédure,
    // une pièce de zéro octet est une pièce manquante, et l'avocat doit
    // l'apprendre ici plutôt qu'à l'audience.
    if (nom.endsWith('/')) continue;

    ctx.decompresse.total += octets.length;
    if (ctx.decompresse.total > bornes.tailleMaxDecompressee) {
      resultat.refuses.push({
        nomFichier: `${fichier.nom} → ${nom}`,
        motif:
          "Cumul décompressé au-delà de la borne : le reste de l'archive n'est pas ouvert (bombe de décompression possible).",
      });
      return;
    }

    traiter(
      {
        nom: nom.split('/').pop() ?? nom,
        // L'arborescence d'origine est conservée : elle porte souvent le
        // classement du cabinet, et la perdre revient à perdre un tri déjà fait.
        chemin: fichier.chemin ? `${fichier.chemin}/${fichier.nom}/${nom}` : `${fichier.nom}/${nom}`,
        octets,
      },
      ctx,
      profondeur + 1
    );
  }
}

function pieceDocx(
  fichier: FichierEntrant,
  entrees: Record<string, Uint8Array>,
  empreinteFichier: string,
  bornes: BornesIngestion
): PieceIngeree {
  const brut = entrees['word/document.xml'];
  const pages = brut
    ? extraireDocx(strFromU8(brut), bornes.seuilConfiance)
    : [page(1, '', 'aucune', 0, bornes.seuilConfiance, 'Corps du document introuvable dans l’archive.')];

  return base(fichier, 'docx', empreinteFichier, pages);
}

function pieceTableur(
  fichier: FichierEntrant,
  entrees: Record<string, Uint8Array>,
  empreinteFichier: string,
  bornes: BornesIngestion
): PieceIngeree {
  const partagees = entrees['xl/sharedStrings.xml']
    ? lireChainesPartagees(strFromU8(entrees['xl/sharedStrings.xml']))
    : [];

  // Une feuille par page : un classeur de procédure sépare souvent les scellés,
  // les auditions et les frais, et les recoller effacerait cette séparation.
  const feuilles = Object.keys(entrees)
    .filter((n) => /^xl\/worksheets\/sheet\d+\.xml$/.test(n))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  const pages = feuilles.map((nom, i) =>
    extraireFeuille(strFromU8(entrees[nom]), partagees, bornes.seuilConfiance, i + 1)
  );

  return base(
    fichier,
    'tableur',
    empreinteFichier,
    pages.length > 0
      ? pages
      : [page(1, '', 'aucune', 0, bornes.seuilConfiance, 'Aucune feuille de calcul trouvée.')]
  );
}

function extraire(
  fichier: FichierEntrant,
  format: ReturnType<typeof reconnaitreFormat>,
  empreinteFichier: string,
  bornes: BornesIngestion
): PieceIngeree {
  const seuil = bornes.seuilConfiance;

  switch (format) {
    case 'csv':
      return base(fichier, format, empreinteFichier, extraireCsv(fichier.octets, seuil));
    case 'texte':
      return base(fichier, format, empreinteFichier, extraireTexteBrut(fichier.octets, seuil));
    case 'image':
      return base(fichier, format, empreinteFichier, [
        page(
          1,
          '',
          'aucune',
          0,
          seuil,
          "Image sans couche texte : la reconnaissance optique n'est pas installée (voir docs/DEPENDANCES.md). La pièce est conservée, son contenu n'est pas lu."
        ),
      ]);
    case 'pdf':
      return base(fichier, format, empreinteFichier, [
        page(
          1,
          '',
          'aucune',
          0,
          seuil,
          "PDF non traité par l'ingestion synchrone : utiliser `ingererPdf`, qui charge son extracteur à la demande."
        ),
      ]);
    default:
      return base(fichier, 'inconnu', empreinteFichier, [
        page(1, '', 'aucune', 0, seuil, 'Format non reconnu : la pièce est conservée, non lue.'),
      ]);
  }
}

function base(
  fichier: FichierEntrant,
  format: PieceIngeree['format'],
  empreinteFichier: string,
  pages: PieceIngeree['pages']
): PieceIngeree {
  return {
    empreinte: empreinteFichier,
    nomFichier: fichier.nom,
    chemin: fichier.chemin,
    format,
    octets: fichier.octets.length,
    pages,
    derivees: [],
    avertissements: pages.filter((p) => p.quarantaine).map((p) => p.motifQuarantaine),
  };
}

/** Recompte à partir des pièces, plutôt que d'incrémenter au fil de l'eau. */
export function recompter(resultat: ResultatIngestion): void {
  const toutes = (p: PieceIngeree[]): PieceIngeree[] =>
    p.flatMap((x) => [x, ...toutes(x.derivees)]);

  const pieces = toutes(resultat.pieces);
  const pages = pieces.flatMap((p) => p.pages);

  resultat.compteurs = {
    pieces: pieces.length,
    pagesTotal: pages.length,
    pagesEnQuarantaine: pages.filter((p) => p.quarantaine).length,
    pagesCorrigees: pages.filter((p) => !p.quarantaine && p.methode === 'aucune').length,
  };
}
