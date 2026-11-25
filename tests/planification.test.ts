// Une demande en langage naturel confirmée → paramètres exacts de l'automatisation enregistrée en base.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toWorkflow } from '../supabase/functions/_shared/intelligence/core.ts';
import { planificationDe } from '../supabase/functions/_shared/intelligence/planification.ts';

const p = (t: string) => planificationDe(toWorkflow(t));
test('demandes du fondateur traduites en automatisations réelles', () => {
  assert.deepEqual(p('Prépare automatiquement le bilan de mes dossiers tous les vendredis.'), { action: 'bilan_dossiers', frequence: 'hebdo', jour: 5, heure: 8 });
  assert.deepEqual(p('Surveille mes contrats et préviens-moi avant leurs renouvellements.'), { action: 'prevenir_echeances', frequence: 'quotidien', jour: null, heure: 8 });
  assert.deepEqual(p('Analyse chaque facture reçue et rappelle-moi son échéance.'), { action: 'prevenir_echeances', frequence: 'piece', jour: null, heure: 8 });
  assert.deepEqual(p('Chaque mois, fais le bilan'), { action: 'bilan_dossiers', frequence: 'mensuel', jour: null, heure: 8 });
  assert.deepEqual(p('Chaque jour, prépare le bilan de mes dossiers.'), { action: 'bilan_dossiers', frequence: 'quotidien', jour: null, heure: 8 });
  assert.deepEqual(p('Tous les lundis, prépare le bilan de mes dossiers.'), { action: 'bilan_dossiers', frequence: 'hebdo', jour: 1, heure: 8 });
});
test('rien d’exécutable : null, jamais une automatisation inventée', () => {
  assert.equal(planificationDe(null), null);
  assert.equal(planificationDe({ declencheur: 'chaque lundi à 8 h', conditions: [], actions: ['préparer un projet de relance (brouillon, jamais envoyé)'], frequence: 'hebdomadaire', fuseau: 'Europe/Paris', budget: '', arret: '' }), null);
});
