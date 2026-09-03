/**
 * Découpage (offsets exacts, tailles, déterminisme) et vectorisation lexicale
 * hachée (dimension, norme, déterminisme, proximité), sans base de données.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { decouperDocument, decouperPage, segmenter, TAILLE_CIBLE, TAILLE_MAX } from '../../supabase/functions/_shared/pipeline/decoupage.ts';
import {
  cosinus,
  DIMENSION_EMBEDDING,
  embeddingLexicalHache,
  fnv1a32,
  normaliserPourEmbedding,
  vectoriserHache,
  versTextePgvector,
} from '../../supabase/functions/_shared/pipeline/embedding.ts';
import { extrairePagesPdf } from '../../supabase/functions/_shared/pipeline/extraction.ts';
import { reclasser } from '../../supabase/functions/_shared/pipeline/indexation.ts';

const DIR = resolve(__dirname, '../fixtures/dossier-etalon');
const bytes = (f: string) => new Uint8Array(readFileSync(resolve(DIR, f)));

const LONG = Array.from({ length: 40 }, (_, i) => `Phrase numéro ${i + 1} du paragraphe de test, avec un montant de ${100 + i},00 € et une date du ${(i % 28) + 1} mars 2026.`).join(' ');

describe('découpage (étape 6 du pipeline)', () => {
  it('chaque chunk se retrouve exactement dans le texte de la page par ses offsets', async () => {
    for (const f of ['01-facture-F-2026-0042.pdf', '05-mise-en-demeure-2026-02-20.pdf']) {
      const { textes } = await extrairePagesPdf(bytes(f));
      const chunks = decouperDocument(textes.map((texte, i) => ({ page: i + 1, texte })));
      expect(chunks.length, f).toBeGreaterThan(0);
      for (const c of chunks) {
        expect(textes[c.page - 1].slice(c.offset_debut, c.offset_fin), f).toBe(c.texte);
        expect(c.texte.trim().length).toBeGreaterThan(0);
        expect(c.offset_fin - c.offset_debut).toBeLessThanOrEqual(TAILLE_MAX);
      }
    }
  });

  it('regroupe les phrases jusqu’à la taille cible, sans chevauchement et dans l’ordre', () => {
    const chunks = decouperPage(LONG, 3);
    expect(chunks.length).toBeGreaterThan(3);
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i];
      expect(c.page).toBe(3);
      expect(LONG.slice(c.offset_debut, c.offset_fin)).toBe(c.texte);
      expect(c.offset_fin - c.offset_debut).toBeLessThanOrEqual(TAILLE_CIBLE);
      if (i > 0) expect(c.offset_debut).toBeGreaterThanOrEqual(chunks[i - 1].offset_fin);
      // Un chunk finit sur une fin de phrase.
      expect(c.texte.trimEnd()).toMatch(/[.!?]$/);
    }
    expect(decouperPage(LONG, 3)).toEqual(chunks); // déterministe
  });

  it('coupe de force un texte sans ponctuation plus long que la taille maximale', () => {
    const sansPonctuation = Array.from({ length: 400 }, (_, i) => `mot${i}`).join(' ');
    const chunks = decouperPage(sansPonctuation, 1);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.offset_fin - c.offset_debut).toBeLessThanOrEqual(TAILLE_MAX);
      expect(sansPonctuation.slice(c.offset_debut, c.offset_fin)).toBe(c.texte);
    }
    expect(chunks.map((c) => c.texte).join(' ').replace(/\s+/g, ' ')).toBe(sansPonctuation);
  });

  it('ignore les blancs et ne produit rien pour une page vide', () => {
    expect(decouperPage('', 1)).toEqual([]);
    expect(decouperPage('   \n\n  ', 1)).toEqual([]);
    expect(segmenter('Bonjour.  Au revoir !\nLigne suivante').length).toBe(3);
  });
});

describe('vectorisation lexicale hachée (étape 7 du pipeline)', () => {
  it('produit un vecteur de 1024 dimensions, de norme 1, déterministe', async () => {
    const [v1] = await embeddingLexicalHache.vectoriser(['Facture impayée, montant 1 200,00 € TTC.']);
    const v2 = vectoriserHache('Facture impayée, montant 1 200,00 € TTC.');
    expect(v1).not.toBeNull();
    expect(v1!.length).toBe(DIMENSION_EMBEDDING);
    expect(Math.sqrt(v1!.reduce((s, x) => s + x * x, 0))).toBeCloseTo(1, 4);
    expect(v1).toEqual(v2);
    expect(versTextePgvector([0.5, -0.25])).toBe('[0.5,-0.25]');
    expect(fnv1a32('clair')).toBe(fnv1a32('clair'));
    expect(fnv1a32('clair')).not.toBe(fnv1a32('claire'));
  });

  it('rapproche des textes proches et éloigne des textes sans rapport', () => {
    const a = vectoriserHache('Montant de la facture impayée : 1 200 euros, échéance dépassée.')!;
    const b = vectoriserHache('La facture impayée porte un montant de 1 200 euros.')!;
    const c = vectoriserHache('Chronologie du contrat de travail et entretien préalable au licenciement.')!;
    expect(cosinus(a, b)).toBeGreaterThan(cosinus(a, c) + 0.2);
  });

  it('normalise accents, casse et groupes de chiffres ; renvoie null sans aucun mot', () => {
    expect(normaliserPourEmbedding('Échéance : 1 200,00 € — Société Exemple')).toEqual(['echeance', '1200', '00', 'societe', 'exemple']);
    expect(vectoriserHache('??? !!!')).toBeNull();
  });

  it('reclasse en faveur des passages couvrant plus de termes de la requête, de façon stable', () => {
    const base = { document_id: 'd', file_name: 'f', page: 1, offset_debut: 0, offset_fin: 10, rang_lexical: null, rang_vectoriel: null };
    const resultats = [
      { ...base, chunk_id: 'b', texte: 'mise en demeure du 20 février', score_fusion: 0.03 },
      { ...base, chunk_id: 'a', texte: 'mise en demeure de payer sous huit jours', score_fusion: 0.03 },
    ];
    const r = reclasser(resultats, 'mise en demeure huit jours');
    expect(r.map((x) => x.chunk_id)).toEqual(['a', 'b']);
    expect(r[0].couverture_termes).toBe(1);
  });
});
