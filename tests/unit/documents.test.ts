/**
 * Empreinte SHA-256 (module partagé client / serveur) et intégrité du dossier étalon
 * (PARTIE 10.1 : 2 doublons stricts, 1 quasi-doublon). Données fictives uniquement.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { sanitizeName, sha256Hex } from '../../src/lib/documents';

const DIR = resolve(__dirname, '../fixtures/dossier-etalon');

type Piece = {
  fichier: string;
  role: 'original' | 'doublon_strict' | 'quasi_doublon' | 'illisible';
  copie_de?: string;
  quasi_doublon_de?: string;
  texte?: string[];
};
type Manifest = { pieces: Piece[] };
type VeriteTerrain = {
  doublons_stricts: { piece: string; original: string }[];
  quasi_doublons: { piece: string; original: string }[];
};

const manifest = JSON.parse(readFileSync(resolve(DIR, 'manifest.json'), 'utf8')) as Manifest;
const verite = JSON.parse(readFileSync(resolve(DIR, 'verite-terrain.json'), 'utf8')) as VeriteTerrain;
const bytes = (fichier: string) => readFileSync(resolve(DIR, fichier));
const nodeSha256 = (buf: Buffer) => createHash('sha256').update(buf).digest('hex');

/** Chaînes de texte du flux de contenu PDF (opérateur Tj), pour comparer le texte rendu. */
function textesTj(buf: Buffer): string[] {
  const latin1 = buf.toString('latin1');
  return Array.from(latin1.matchAll(/\(((?:\\.|[^\\)])*)\) Tj/g), (m) => m[1]);
}

describe('sha256Hex', () => {
  it('donne la même empreinte que node:crypto sur chaque pièce du dossier étalon', async () => {
    for (const p of manifest.pieces) {
      const buf = bytes(p.fichier);
      expect(await sha256Hex(new Uint8Array(buf)), p.fichier).toBe(nodeSha256(buf));
    }
  });

  it('accepte un Blob et un ArrayBuffer', async () => {
    const buf = Buffer.from('ClairDossier — jeu de test', 'utf8');
    const attendu = nodeSha256(buf);
    expect(await sha256Hex(new Blob([buf]))).toBe(attendu);
    expect(await sha256Hex(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))).toBe(attendu);
  });
});

describe('sanitizeName', () => {
  it('ne garde que des caractères sûrs et 80 caractères au plus (comportement historique)', () => {
    expect(sanitizeName('Facture n° 42 (janvier).PDF')).toBe('Facture_n_42_janvier_.PDF');
    expect(sanitizeName('a'.repeat(100)).length).toBe(80);
  });
});

describe('dossier étalon', () => {
  it('contient exactement 2 doublons stricts et 1 quasi-doublon (PARTIE 10.1), cohérents avec la vérité terrain', () => {
    const stricts = manifest.pieces.filter((p) => p.role === 'doublon_strict');
    const quasis = manifest.pieces.filter((p) => p.role === 'quasi_doublon');
    expect(stricts.length).toBe(2);
    expect(quasis.length).toBe(1);
    expect(verite.doublons_stricts.map((d) => [d.piece, d.original])).toEqual(
      stricts.map((p) => [p.fichier, p.copie_de]),
    );
    expect(verite.quasi_doublons.map((d) => [d.piece, d.original])).toEqual(
      quasis.map((p) => [p.fichier, p.quasi_doublon_de]),
    );
  });

  it('un doublon strict est identique octet pour octet à son original', () => {
    for (const d of verite.doublons_stricts) {
      expect(nodeSha256(bytes(d.piece)), d.piece).toBe(nodeSha256(bytes(d.original)));
    }
  });

  it('un quasi-doublon a le même texte mais pas la même empreinte', () => {
    for (const d of verite.quasi_doublons) {
      expect(nodeSha256(bytes(d.piece))).not.toBe(nodeSha256(bytes(d.original)));
      expect(textesTj(bytes(d.piece))).toEqual(textesTj(bytes(d.original)));
    }
  });

  it('chaque pièce est un PDF ; texte natif non vide, sauf la pièce illisible qui n’en a aucun', () => {
    for (const p of manifest.pieces) {
      const buf = bytes(p.fichier);
      expect(buf.subarray(0, 5).toString('latin1'), p.fichier).toBe('%PDF-');
      expect(buf.toString('latin1').trimEnd().endsWith('%%EOF'), p.fichier).toBe(true);
      if (p.role === 'illisible') expect(textesTj(buf).length, p.fichier).toBe(0);
      else expect(textesTj(buf).length, p.fichier).toBeGreaterThan(3);
    }
    expect(manifest.pieces.filter((p) => p.role === 'illisible').length).toBe(1);
  });

  it('ne contient aucune coordonnée réelle : domaines .invalid et SIREN fictifs', () => {
    for (const p of manifest.pieces) {
      const texte = (p.texte ?? []).join('\n');
      for (const courriel of texte.matchAll(/[\w.-]+@([\w.-]+)/g)) {
        expect(courriel[1], `courriel dans ${p.fichier}`).toMatch(/\.invalid$/);
      }
      for (const siren of texte.matchAll(/SIREN (\d{3} \d{3} \d{3})/g)) {
        expect(siren[1], `SIREN dans ${p.fichier}`).toMatch(/^000 000 00\d$/);
      }
    }
  });
});
