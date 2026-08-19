import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';

describe('chargement paresseux des dépendances lourdes', () => {
  it("n'importe pdfjs et postal-mime que dynamiquement", () => {
    const source = readFileSync('src/ldi/ingestion/lourds.ts', 'utf-8');
    for (const dep of ['pdfjs-dist', 'postal-mime']) {
      assert.ok(
        !new RegExp(`^import .*from '${dep}`, 'm').test(source),
        `${dep} est importé statiquement : il entrerait dans le bundle initial`
      );
      assert.ok(source.includes(`await import('${dep}`), `${dep} doit être chargé par import()`);
    }
  });

  it('ne référence aucune dépendance lourde depuis le noyau', () => {
    for (const f of ['src/ldi/ingestion/ingestion.ts', 'src/ldi/pipeline.ts', 'src/ldi/atelier.ts']) {
      const s = readFileSync(f, 'utf-8');
      for (const dep of ['pdfjs-dist', 'postal-mime', 'tesseract']) {
        assert.ok(!s.includes(dep), `${f} référence ${dep}`);
      }
    }
  });
});
