import assert from 'node:assert/strict';
import test from 'node:test';
import { deliverableKeyOf } from '../supabase/functions/_shared/analysis-model.ts';

test('les catégories explicites et les anciens titres exacts partagent la classification du dossier', () => {
  assert.equal(deliverableKeyOf('Note du cabinet.pdf', 'resume'), 'resume');
  assert.equal(deliverableKeyOf('Tableau_de_bord.pdf'), 'dashboard');
  assert.equal(deliverableKeyOf('Synthèse du dossier-v2.pdf'), 'resume');
  assert.equal(deliverableKeyOf('Échéances et calendrier.ics'), 'echeances');
  assert.equal(deliverableKeyOf('Tableau_de_bord_LEPARC.pdf', null, 'Leparc'), 'dashboard');
  assert.equal(deliverableKeyOf('Tableau_de_bord_LEPARC.pdf', null, 'Atelier Témoin'), null);
  for (const name of ['Synthèse et échéances.pdf', 'Tableau de bordure.pdf', 'Résumé de police.pdf', 'Dashboard-r3.pdf.exe', 'Note de suivi historique.pdf']) {
    assert.equal(deliverableKeyOf(name), null, name);
  }
});
