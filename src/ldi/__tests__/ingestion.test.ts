/**
 * Ingestion documentaire — tests sur fichiers réels, versionnés dans
 * `__tests__/fixtures/`.
 *
 * Le plus important d'entre eux est celui du fichier piégé : le contenu d'une
 * pièce est une DONNÉE, jamais une consigne. C'est un test de sécurité, pas de
 * fonctionnalité.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { BORNES_DEFAUT, type FichierEntrant } from '../ingestion/types';
import { empreinteContenu, ingerer } from '../ingestion/ingestion';
import { extensionDe, reconnaitreFormat } from '../ingestion/formats';
import { contenusDe, decoderEntites } from '../ingestion/xml';
import { construireMessage } from '../prompt';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');

function fichier(nom: string, chemin = ''): FichierEntrant {
  return { nom, chemin, octets: new Uint8Array(readFileSync(join(FIXTURES, nom))) };
}

function octetsDe(texte: string): Uint8Array {
  return new TextEncoder().encode(texte);
}

const texteDesPages = (p: { texte: string }[]) => p.map((x) => x.texte).join('\n');

// ── Reconnaissance de format ──────────────────────────────────────────────

describe('reconnaissance de format', () => {
  it('lit les octets avant de croire l’extension', () => {
    // Un PDF renommé en .txt reste un PDF ; l'extension est une allégation.
    const pdfRenomme = octetsDe('%PDF-1.7\n…');
    assert.equal(reconnaitreFormat('note.txt', pdfRenomme), 'pdf');
  });

  it('reconnaît les archives OOXML comme archives, à ouvrir ensuite', () => {
    assert.equal(reconnaitreFormat('piece.docx', fichier('piece.docx').octets), 'archive');
    assert.equal(reconnaitreFormat('scelles.xlsx', fichier('scelles.xlsx').octets), 'archive');
  });

  it('ne prend pas un binaire pour du texte', () => {
    const binaire = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0xff, 0xfe]);
    assert.equal(reconnaitreFormat('sans-extension', binaire), 'inconnu');
  });

  it('extrait l’extension sans se tromper sur les points', () => {
    assert.equal(extensionDe('D1.pv.audition.PDF'), 'pdf');
    assert.equal(extensionDe('sans-extension'), '');
    assert.equal(extensionDe('.cache'), '');
  });
});

// ── Lecture XML ───────────────────────────────────────────────────────────

describe('lecture XML de bureautique', () => {
  it('décode les entités, y compris numériques', () => {
    assert.equal(decoderEntites('D&apos;AUDITION &lt;x&gt; &amp; &#233;t&#xe9;'), "D'AUDITION <x> & été");
  });

  it('laisse visible une entité inconnue plutôt que de la supprimer', () => {
    // Un trou silencieux dans une déclaration est pire qu'une entité visible.
    assert.equal(decoderEntites('caf&eacute;'), 'caf&eacute;');
  });

  it('ignore le préfixe d’espace de noms', () => {
    assert.deepEqual(contenusDe('<w:t>a</w:t><t>b</t>', 't'), ['a', 'b']);
  });
});

// ── Extraction par format ─────────────────────────────────────────────────

describe('extraction docx', () => {
  const r = ingerer([fichier('piece.docx')]);
  const piece = r.pieces[0];

  it('rend un paragraphe par ligne', () => {
    assert.equal(piece.format, 'docx');
    const lignes = piece.pages[0].texte.split('\n');
    assert.equal(lignes[0], "PROCÈS-VERBAL D'AUDITION");
    assert.equal(lignes[1], 'Le 14 mars 2026 à 08h00, nous, OPJ.');
  });

  it('conserve les tabulations plutôt que de coller les colonnes', () => {
    assert.ok(
      piece.pages[0].texte.includes('Colonne A\tColonne B'),
      `tabulation perdue : ${JSON.stringify(piece.pages[0].texte)}`
    );
  });

  it('décode les entités du corps', () => {
    assert.ok(piece.pages[0].texte.includes('Entités <test> & caractères.'));
  });

  it('déclare sa méthode d’extraction', () => {
    assert.equal(piece.pages[0].methode, 'xml-bureautique');
    assert.equal(piece.pages[0].quarantaine, false);
  });
});

describe('extraction tableur', () => {
  const piece = ingerer([fichier('scelles.xlsx')]).pieces[0];

  it('rend une page par feuille', () => {
    assert.equal(piece.format, 'tableur');
    assert.equal(piece.pages.length, 2, 'deux feuilles, deux pages');
  });

  it('résout les chaînes partagées', () => {
    assert.ok(piece.pages[0].texte.includes('Cote\tIntitulé'));
    assert.ok(piece.pages[0].texte.includes('D1\tPV de placement'));
  });

  it('distingue chaîne en ligne et valeur numérique', () => {
    assert.ok(piece.pages[0].texte.includes('42\ten ligne'));
  });

  it('recolle un texte enrichi éclaté en plusieurs fragments', () => {
    assert.ok(
      piece.pages[1].texte.includes('Scellé n°3'),
      `fragments non recollés : ${JSON.stringify(piece.pages[1].texte)}`
    );
  });

  it('préserve la structure de table plutôt que de l’aplatir en prose', () => {
    for (const ligne of piece.pages[0].texte.split('\n')) {
      assert.ok(!/\. /.test(ligne), `la table a été mise en prose : ${ligne}`);
    }
  });
});

describe('extraction CSV', () => {
  const piece = ingerer([fichier('bordereau.csv')]).pieces[0];

  it('déduit le point-virgule des exports français', () => {
    const lignes = piece.pages[0].texte.split('\n');
    assert.equal(lignes[0], 'Cote\tIntitulé\tDate');
  });

  it('respecte les guillemets contenant le séparateur… et une virgule', () => {
    assert.ok(
      piece.pages[0].texte.includes('D1\tPV de placement, garde à vue\t2026-03-14'),
      piece.pages[0].texte
    );
  });
});

// ── Archives, doublons, bornes ────────────────────────────────────────────

describe('archives et doublons', () => {
  const r = ingerer([fichier('lot.zip')]);

  it('ingère chaque pièce de l’archive', () => {
    assert.ok(r.pieces.length >= 2, `${r.pieces.length} pièce(s) extraite(s)`);
    assert.ok(r.pieces.some((p) => p.nomFichier === 'D1-pv.txt'));
  });

  it('conserve l’arborescence d’origine comme métadonnée', () => {
    const d1 = r.pieces.find((p) => p.nomFichier === 'D1-pv.txt');
    assert.match(d1?.chemin ?? '', /procedure/);
  });

  it('reconnaît un doublon exact malgré un nom différent', () => {
    assert.equal(r.doublons.length, 1);
    assert.equal(r.doublons[0].nomFichier, 'D1-pv-copie.txt');
    // L'original est désigné par son chemin complet, pas par son seul nom :
    // dans un dossier de deux cents pièces, plusieurs « D1-pv.txt » peuvent
    // coexister dans des répertoires différents.
    assert.equal(r.doublons[0].identiqueA, 'lot.zip/procedure/D1-pv.txt');
  });

  it('refuse un fichier vide en le nommant', () => {
    assert.ok(r.refuses.some((x) => x.nomFichier === 'vide.txt'));
  });

  it('donne la même empreinte à deux copies du même contenu', () => {
    const a = octetsDe('contenu identique');
    const b = octetsDe('contenu identique');
    assert.equal(empreinteContenu(a), empreinteContenu(b));
    assert.notEqual(empreinteContenu(a), empreinteContenu(octetsDe('contenu different')));
  });
});

describe('bornes d’ingestion', () => {
  it('refuse un fichier au-delà de la borne, sans faire tomber les autres', () => {
    const gros = { nom: 'gros.txt', chemin: '', octets: new Uint8Array(2048) };
    const petit = { nom: 'petit.txt', chemin: '', octets: octetsDe('contenu utile') };

    const r = ingerer([gros, petit], { ...BORNES_DEFAUT, tailleMaxFichier: 1024 });
    assert.equal(r.refuses.length, 1);
    assert.equal(r.refuses[0].nomFichier, 'gros.txt');
    assert.equal(r.pieces.length, 1, "le fichier suivant doit rester ingéré");
  });

  it('borne le cumul décompressé contre les bombes de décompression', () => {
    const r = ingerer([fichier('lot.zip')], { ...BORNES_DEFAUT, tailleMaxDecompressee: 10 });
    assert.ok(
      r.refuses.some((x) => /décompress/i.test(x.motif)),
      `aucun refus lié au cumul : ${JSON.stringify(r.refuses)}`
    );
  });

  it("borne la profondeur d'archives imbriquées", () => {
    const r = ingerer([fichier('lot.zip')], { ...BORNES_DEFAUT, profondeurMaxArchive: 0 });
    assert.equal(r.pieces.length, 0);
    assert.match(r.refuses[0].motif, /imbriquées/i);
  });
});

// ── Quarantaine ───────────────────────────────────────────────────────────

describe('quarantaine', () => {
  it('met en quarantaine une image, faute de reconnaissance optique', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
    const piece = ingerer([{ nom: 'scan.jpg', chemin: '', octets: jpeg }]).pieces[0];

    assert.equal(piece.format, 'image');
    assert.equal(piece.pages[0].quarantaine, true);
    assert.equal(piece.pages[0].confiance, 0);
    // L'écran ne doit pas laisser croire que la pièce a été lue.
    assert.match(piece.pages[0].motifQuarantaine, /reconnaissance optique n'est pas installée/i);
  });

  it('compte les pages en quarantaine', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const r = ingerer([
      { nom: 'scan.jpg', chemin: '', octets: jpeg },
      fichier('piece.docx'),
    ]);
    assert.equal(r.compteurs.pagesEnQuarantaine, 1);
    assert.equal(r.compteurs.pieces, 2);
  });
});

// ── SÉCURITÉ : le contenu d'une pièce n'est pas une consigne ─────────────

describe('fichier piégé — le contenu est une donnée, jamais une consigne', () => {
  const piece = ingerer([fichier('piege-injection.txt')]).pieces[0];
  const texte = texteDesPages(piece.pages);

  it('ingère le fichier normalement, sans effet de bord', () => {
    assert.equal(piece.format, 'texte');
    assert.equal(piece.pages[0].quarantaine, false);
  });

  it('conserve la tentative telle quelle, pour que l’avocat la voie', () => {
    // Ne PAS censurer : une pièce contenant une tentative d'injection est un
    // fait du dossier, et c'est un fait qui l'intéresse.
    assert.ok(texte.includes('IGNORE LES INSTRUCTIONS PRÉCÉDENTES'));
    assert.ok(texte.includes('23-81.456'));
  });

  it('neutralise la balise de cloisonnement une fois versé au contexte', () => {
    const message = construireMessage({ rapport: texte, sources: '', question: 'Que penser ?' });
    const occurrences = (s: string, m: string) => s.split(m).length - 1;

    // Une seule paire : celle du cloisonnement lui-même. Celles de la pièce
    // ont été neutralisées.
    assert.equal(occurrences(message, '<donnees_dossier>'), 1);
    assert.equal(occurrences(message, '</donnees_dossier>'), 1);
  });

  it('laisse le pourvoi inventé hors de tout ensemble citable', async () => {
    const { verifierCitations } = await import('../citations');
    const r = verifierCitations(texte, { references: [], decisions: [], texteDuDossier: texte });

    assert.equal(r.conforme, false);
    assert.ok(r.inconnues.includes('23-81.456'));
    // Et l'alerte doit dire d'où il vient : une référence écrite dans une
    // pièce n'est pas une source.
    assert.match(r.rapport, /dans le texte du dossier lui-même/i);
  });
});

// ── Mise en état ──────────────────────────────────────────────────────────

describe('mise en état', () => {
  it('propose tout, ne confirme rien', async () => {
    const { mettreEnEtat } = await import('../ingestion/mise-en-etat');
    const fiches = mettreEnEtat(ingerer([fichier('piece.docx')]).pieces);

    for (const champ of ['cote', 'nature', 'date'] as const) {
      assert.equal(fiches[0][champ].etat, 'propose', `${champ} ne doit pas naître confirmé`);
    }
  });

  it('joint l’extrait qui a produit la proposition', async () => {
    const { mettreEnEtat } = await import('../ingestion/mise-en-etat');
    const fiches = mettreEnEtat(ingerer([fichier('piece.docx')]).pieces);

    // « PV d'audition » → `audition`, la nature qui distingue réellement : la
    // quasi-totalité des pièces d'enquête sont des procès-verbaux.
    assert.equal(fiches[0].nature.valeur, 'audition');
    assert.match(fiches[0].nature.justificatif, /AUDITION/i);
    assert.equal(fiches[0].date.valeur, '2026-03-14');
    assert.match(fiches[0].date.justificatif, /14 mars 2026/);
  });

  it('lit les trois écritures de date rencontrées en procédure', async () => {
    const { datesDuTexte } = await import('../ingestion/mise-en-etat');
    for (const forme of ['le 2026-03-14 à 8h', 'le 14/03/2026 à 8h', 'le 14 mars 2026 à 8h']) {
      assert.equal(datesDuTexte(forme)[0]?.iso, '2026-03-14', forme);
    }
  });

  it('rejette une date impossible plutôt que de la décaler', async () => {
    const { datesDuTexte } = await import('../ingestion/mise-en-etat');
    assert.deepEqual(datesDuTexte('le 30/02/2026'), []);
    assert.deepEqual(datesDuTexte('le 2026-02-30'), []);
  });

  it("n'invente aucune date quand le document n'en porte pas", async () => {
    const { mettreEnEtat } = await import('../ingestion/mise-en-etat');
    const sansDate = { nom: 'note.txt', chemin: '', octets: octetsDe('Aucune date ici.') };
    const fiches = mettreEnEtat(ingerer([sansDate]).pieces);
    assert.equal(fiches[0].date.valeur, null);
  });

  it('ne passe à confirmé que sur demande explicite', async () => {
    const { mettreEnEtat, confirmer, corriger } = await import('../ingestion/mise-en-etat');
    const fiche = mettreEnEtat(ingerer([fichier('piece.docx')]).pieces)[0];

    assert.equal(confirmer(fiche.cote).etat, 'confirme');
    const corrigee = corriger(fiche.nature, 'expertise');
    assert.equal(corrigee.etat, 'corrige');
    assert.equal(corrigee.valeur, 'expertise');
  });
});

describe('bordereau', () => {
  it('signale les mentions non relues au lieu de les taire', async () => {
    const { mettreEnEtat, bordereau } = await import('../ingestion/mise-en-etat');
    const texte = bordereau(mettreEnEtat(ingerer([fichier('piece.docx')]).pieces), 'CAB-2026-001');

    assert.match(texte, /propositions automatiques non relues/i);
    assert.match(texte, /engage l'avocat qui le signe/i);
    // L'astérisque suit la valeur : « D1 * », mention non relue.
    assert.match(texte, /\| D1 \* \|/);
  });

  it('signale les pièces dont des pages n’ont pas été lues', async () => {
    const { mettreEnEtat, bordereau } = await import('../ingestion/mise-en-etat');
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    const fiches = mettreEnEtat(ingerer([{ nom: 'scan.jpg', chemin: '', octets: jpeg }]).pieces);

    assert.match(bordereau(fiches, 'X'), /pages non lues/i);
  });

  it('produit des pièces exploitables par le pipeline', async () => {
    const { mettreEnEtat, versPieces } = await import('../ingestion/mise-en-etat');
    const { analyser } = await import('../pipeline');

    const fiches = mettreEnEtat(ingerer([fichier('piece.docx'), fichier('bordereau.csv')]).pieces);
    const rapport = analyser({
      reference: 'ING-001',
      qualifications: [],
      regime: 'droit-commun',
      pieces: versPieces(fiches),
      evenements: [],
    });

    assert.equal(rapport.dossier.piecesTotal, 2);
    assert.equal(rapport.dossier.reference, 'ING-001');
  });
});

// ── Formats à extraction différée ─────────────────────────────────────────

describe('extraction différée (PDF, courriel)', () => {
  const EML = octetsDe(
    [
      'From: Greffe <greffe@exemple.fr>',
      'To: Maitre <avocat@exemple.fr>',
      'Subject: Convocation',
      'Date: Mon, 3 Feb 2025 09:00:00 +0100',
      'Content-Type: text/plain; charset=utf-8',
      '',
      'Vous êtes convoqué le 12 mars 2025.',
      '',
    ].join('\r\n')
  );

  it('conserve le format « courriel » jusqu’à l’extraction', () => {
    // Rendu « inconnu » par l'ingestion, un .eml n'est jamais repris par le
    // second passage, qui filtre sur le format : le courriel serait perdu en
    // silence, sous une étiquette « Format non reconnu » fausse.
    const [piece] = ingerer([{ nom: 'convocation.eml', chemin: '', octets: EML }]).pieces;

    assert.equal(piece.format, 'courriel');
    assert.equal(piece.pages[0].quarantaine, true);
    assert.match(piece.pages[0].motifQuarantaine, /Courriel reconnu, pas encore lu/);
  });

  it('retient les octets des seuls formats à extraction différée', () => {
    const { pieces } = ingerer([
      { nom: 'convocation.eml', chemin: '', octets: EML },
      fichier('piece.pdf'),
      fichier('bordereau.csv'),
    ]);

    const parNom = new Map(pieces.map((p) => [p.nomFichier, p]));
    assert.ok(parNom.get('convocation.eml')?.octetsSource, 'le courriel doit garder ses octets');
    assert.ok(parNom.get('piece.pdf')?.octetsSource, 'le PDF doit garder ses octets');
    // Les octets conservés sont bien ceux du fichier, pas une copie tronquée :
    // c'est sur eux que le second passage travaille.
    assert.equal(parNom.get('piece.pdf')?.octetsSource?.length, parNom.get('piece.pdf')?.octets);
    // Le CSV est déjà lu : garder ses octets retiendrait le dossier en mémoire.
    assert.equal(parNom.get('bordereau.csv')?.octetsSource, undefined);
  });

  it('ne renvoie l’avocat vers aucune fonction inexistante', () => {
    // Le motif de quarantaine est LU par l'avocat dans l'interface. Y nommer
    // une fonction qui n'a jamais existé lui ferait chercher dans le vide.
    const source = readFileSync('src/ldi/ingestion/ingestion.ts', 'utf-8');
    assert.ok(!source.includes('ingererPdf'), 'référence à `ingererPdf`, fonction inexistante');

    const [pdf] = ingerer([fichier('piece.pdf')]).pieces;
    assert.equal(pdf.format, 'pdf');
    assert.equal(pdf.pages[0].quarantaine, true);
    // Le motif dit que la pièce EXISTE et n'est pas encore lue — un « format
    // non reconnu » ferait croire à l'avocat qu'il a déposé un fichier abîmé.
    assert.match(pdf.pages[0].motifQuarantaine, /PDF reconnu, pas encore lu/);
  });
});

// ── Ce qui n'entre pas au dossier doit rester identifiable ────────────────

describe('écartés — désignation', () => {
  it('distingue deux fichiers homonymes refusés', () => {
    // `lot.zip` contient `procedure/vide.txt`, vide lui aussi. Deux lignes
    // « vide.txt — Fichier vide » laisseraient croire à un doublon d'affichage,
    // alors qu'il s'agit de deux pièces manquantes distinctes.
    const { refuses } = ingerer([
      { nom: 'vide.txt', chemin: '', octets: new Uint8Array() },
      fichier('lot.zip'),
    ]);

    assert.equal(refuses.length, 2);
    const designations = refuses.map((r) => `${r.chemin ? `${r.chemin}/` : ''}${r.nomFichier}`);
    assert.equal(new Set(designations).size, 2, `désignations ambiguës : ${designations.join(' | ')}`);
    assert.ok(designations.some((d) => d.includes('lot.zip')), 'le refus issu de l’archive doit la nommer');
  });

  it('situe le doublon et son original', () => {
    const { doublons } = ingerer([fichier('lot.zip')]);
    const [copie] = doublons;

    assert.equal(copie.nomFichier, 'D1-pv-copie.txt');
    assert.match(copie.chemin, /lot\.zip/);
    // Sans le chemin de l'original, l'avocat ne sait pas quel exemplaire a été
    // conservé — la question exacte que pose un dossier communiqué en double.
    assert.match(copie.identiqueA, /lot\.zip\/procedure\/D1-pv\.txt$/);
  });

  it('ne fait pas d’un chemin de répertoire un chemin de fichier', () => {
    // `chemin` désigne où la pièce se trouve, jamais la pièce elle-même.
    const piece = ingerer([fichier('lot.zip')]).pieces.find((p) => p.nomFichier === 'D1-pv.txt');
    assert.equal(piece?.chemin, 'lot.zip/procedure');
  });
});
