/**
 * Étapes 1, 2, 4 et 5 du pipeline, sans base de données : réception (signature
 * binaire), empreinte, extraction PDF (unpdf) et score de qualité, sur les pièces
 * fictives du dossier étalon.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { empreinteSha256 } from '../../supabase/functions/_shared/pipeline/empreinte.ts';
import { extrairePagesPdf } from '../../supabase/functions/_shared/pipeline/extraction.ts';
import { evaluerQualite, scorerTexte, SEUIL_QUALITE } from '../../supabase/functions/_shared/pipeline/qualite.ts';
import { controlerReception, sniffMime, TYPES_ACCEPTES } from '../../supabase/functions/_shared/pipeline/reception.ts';
import type { DocumentIngestion } from '../../supabase/functions/_shared/pipeline/types.ts';
import { sha256Hex } from '../../src/lib/documents';

const DIR = resolve(__dirname, '../fixtures/dossier-etalon');
const bytes = (f: string) => new Uint8Array(readFileSync(resolve(DIR, f)));
const FACTURE = '01-facture-F-2026-0042.pdf';
const ILLISIBLE = '08-releve-bancaire-scan-illisible.pdf';

const docFictif = (extra: Partial<DocumentIngestion> = {}): DocumentIngestion => ({
  id: '00000000-0000-4000-8000-000000000001',
  tenant_id: '00000000-0000-4000-8000-000000000002',
  dossier_id: '00000000-0000-4000-8000-000000000003',
  file_path: 'u/d/x.pdf',
  file_name: 'x.pdf',
  size_bytes: null,
  mime: null,
  hash_sha256: null,
  kind: 'piece',
  statut_ingestion: 'recu',
  doublon_de_id: null,
  supprime_le: null,
  ...extra,
});

describe('réception (étape 1)', () => {
  it('reconnaît le type réel par sa signature binaire, indépendamment du nom', () => {
    expect(sniffMime(bytes(FACTURE))).toBe('application/pdf');
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg');
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('image/png');
    expect(sniffMime(new Uint8Array([0x50, 0x4b, 0x03, 0x04]))).toBeNull(); // zip / docx
    expect(sniffMime(new Uint8Array())).toBeNull();
  });

  it('refuse un type non pris en charge, une incohérence MIME, un fichier vide, un quota dépassé', () => {
    const quotaOk = { ok: true };
    expect(controlerReception(docFictif(), new Uint8Array([0x50, 0x4b, 0x03, 0x04]), quotaOk)).toMatchObject({
      ok: false, erreur: 'TYPE_NON_PRIS_EN_CHARGE',
    });
    expect(controlerReception(docFictif({ mime: 'image/png' }), bytes(FACTURE), quotaOk)).toMatchObject({
      ok: false, erreur: expect.stringMatching(/^MIME_INCOHERENT/),
    });
    expect(controlerReception(docFictif(), new Uint8Array(), quotaOk)).toMatchObject({ ok: false, erreur: 'FICHIER_VIDE' });
    expect(controlerReception(docFictif(), bytes(FACTURE), { ok: false, motif: 'TAILLE_MAX_DEPASSEE' })).toMatchObject({
      ok: false, erreur: 'QUOTA:TAILLE_MAX_DEPASSEE', controles: expect.objectContaining({ quota: 'TAILLE_MAX_DEPASSEE' }),
    });
  });

  it('accepte un PDF et dit que l’antivirus n’est pas disponible plutôt que de le prétendre', () => {
    const r = controlerReception(docFictif({ mime: 'application/pdf', size_bytes: 1 }), bytes(FACTURE), { ok: true });
    expect(r.ok).toBe(true);
    expect(r.controles.antivirus).toBe('non_disponible');
    expect(r.controles.taille).toMatch(/^TAILLE_DECLAREE_DIFFERENTE/);
    expect(TYPES_ACCEPTES).toEqual(['application/pdf', 'image/jpeg', 'image/png']);
  });
});

describe('empreinte (étape 2)', () => {
  it('coïncide avec node:crypto et avec l’implémentation client', async () => {
    const b = bytes(FACTURE);
    const attendu = createHash('sha256').update(b).digest('hex');
    expect(await empreinteSha256(b)).toBe(attendu);
    expect(await sha256Hex(b)).toBe(attendu);
  });
});

describe('extraction (étape 4)', () => {
  it('lit le texte natif page par page d’une pièce du dossier étalon', async () => {
    const { totalPages, textes } = await extrairePagesPdf(bytes(FACTURE));
    expect(totalPages).toBe(1);
    expect(textes[0]).toContain('FACTURE N° F-2026-0042');
    expect(textes[0]).toContain('1 200,00 €');
    expect(textes[0]).toContain('11 février 2026');
  });

  it('ne trouve aucun texte dans la pièce numérisée sans couche texte', async () => {
    const { totalPages, textes } = await extrairePagesPdf(bytes(ILLISIBLE));
    expect(totalPages).toBe(1);
    expect(textes[0].trim()).toBe('');
  });
});

describe('qualité (étape 5)', () => {
  it('note un texte administratif français au-dessus du seuil, un bruit en dessous, un vide à zéro', async () => {
    const { textes } = await extrairePagesPdf(bytes(FACTURE));
    expect(scorerTexte(textes[0])).toBeGreaterThanOrEqual(0.8);
    // Bruit sans aucune lettre ni chiffre (les symboles µ et ˆ sont des lettres Unicode : exclus).
    expect(scorerTexte('¤¤¤ §§§ ~~~ ### ¿¿¿ ±±± ¬¬¬ ¶¶¶ ··· ‰‰‰ ¤¤¤ §§§ ~~~ ###')).toBe(0);
    // Un seul mot correct noyé dans le bruit ne suffit pas.
    expect(scorerTexte('¤¤¤ §§§ ~~~ ### ¿¿¿ ±±± ¬¬¬ ¶¶¶ ··· ‰‰‰ facture ~~~ ###')).toBeLessThan(SEUIL_QUALITE);
    expect(scorerTexte('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a1b2c3d4e5f6')).toBeLessThan(SEUIL_QUALITE);
    expect(scorerTexte('Fa�tu�e n� 42 du 12 j�nvier 2026, mont�nt 1 2�0 �')).toBeLessThan(SEUIL_QUALITE);
    expect(scorerTexte('')).toBe(0);
    expect(scorerTexte('Trop court')).toBe(0);
  });

  it('qualifie chaque page : natif, sans texte (OCR requis), sous seuil', () => {
    const e = evaluerQualite([
      'Facture n° F-2026-0042 du 12 janvier 2026, montant total 1 200,00 € TTC, échéance le 11 février 2026.',
      '',
      '¤¤¤ §§§ ~~~ ### ¿¿¿ ±±± ¬¬¬ ¶¶¶ ··· ‰‰‰ ¤¤¤ §§§ abc ~~~ ###',
    ]);
    expect(e.pages.map((p) => p.methode)).toEqual(['natif', 'ocr_requis', 'natif']);
    expect(e.pages_sans_texte).toEqual([2]);
    expect(e.pages_sous_seuil).toEqual([3]);
    expect(e.score_document).not.toBeNull();
    expect(e.pages[0].score_qualite).toBeGreaterThanOrEqual(SEUIL_QUALITE);
  });
});
