/**
 * L'invite système existe en deux exemplaires : la source canonique
 * (`src/ldi/prompt.ts`) et la copie que la fonction Deno importe
 * (`supabase/functions/ldi-analyze/prompt.ts`). La duplication est imposée par
 * l'environnement d'exécution — Deno ne peut pas importer un module TypeScript
 * sans extension depuis `src/`.
 *
 * Une divergence entre les deux serait invisible : le navigateur appliquerait
 * une invite, le serveur une autre. Ce test l'interdit.
 *
 * Pour resynchroniser : `npm run ldi:sync-prompt`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const ici = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ici, '..', '..', '..');

const CANONIQUE = join(RACINE, 'src', 'ldi', 'prompt.ts');
const COPIE = join(RACINE, 'supabase', 'functions', 'ldi-analyze', 'prompt.ts');

describe('invite système', () => {
  it('reste identique entre la source et la copie de la fonction edge', () => {
    const canonique = readFileSync(CANONIQUE, 'utf-8');
    const copie = readFileSync(COPIE, 'utf-8');

    assert.equal(
      copie,
      canonique,
      'src/ldi/prompt.ts et supabase/functions/ldi-analyze/prompt.ts ont divergé — exécuter `npm run ldi:sync-prompt`.'
    );
  });

  it('porte les corrections apportées au cahier des charges', () => {
    const source = readFileSync(CANONIQUE, 'utf-8');

    // Les deux erreurs du cahier des charges initial ne doivent pas revenir.
    assert.ok(!/72\s*h(?:eures)?\s*max/i.test(source));
    assert.match(source, /Il n'existe pas\s*\n?de plafond général de 72 heures/);

    // Les garde-fous non négociables.
    assert.match(source, /INTERDICTION DE PRODUIRE DE LA JURISPRUDENCE/);
    assert.match(source, /PAS DE PRONOSTIC CHIFFRÉ/);
  });
});
