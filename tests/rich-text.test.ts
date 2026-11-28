import { test } from 'node:test';
import assert from 'node:assert/strict';
import { boldSegments } from '../src/lib/rich-text.ts';

test('réponse de l’assistant : le gras est rendu, le reste demeure du texte brut', () => {
  assert.deepEqual(boldSegments('**À faire :** vérifier le relevé.'), [
    { text: 'À faire :', bold: true },
    { text: ' vérifier le relevé.', bold: false },
  ]);
  assert.deepEqual(boldSegments('Aucun balisage <b>ici</b>.'), [{ text: 'Aucun balisage <b>ici</b>.', bold: false }]);
  assert.deepEqual(boldSegments('2 ** 3 et ** seul'), [{ text: '2 ** 3 et ** seul', bold: false }]);
  assert.deepEqual(boldSegments(''), []);
});
