/**
 * Le module 2 était écrit, testé — et appelé par aucun chemin de production.
 * La garantie « aucune jurisprudence hors source officielle » existait en
 * architecture, pas en exécution. Ces tests vérifient le câblage.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyser } from '../pipeline';
import { referencesDuRapport, sourcerRapport } from '../sourcage';
import type { Dossier } from '../types';

const dossier: Dossier = {
  reference: 'SRC-001',
  qualifications: ['CP, art. 222-37'],
  regime: 'droit-commun',
  pieces: [{ id: 'P1', nature: 'proces-verbal', intitule: 'PV', date: '2026-03-14' }],
  evenements: [
    {
      id: 'E1',
      nature: 'debut-garde-a-vue',
      horodatage: '2026-03-14T08:00',
      description: 'Placement',
      sourcePieceId: 'P1',
    },
  ],
};

function fauxFetch(charge: unknown, ok = true): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(charge), { status: ok ? 200 : 500 })) as unknown as typeof fetch;
}

describe('referencesDuRapport', () => {
  it('collecte les références effectivement citées par le rapport', () => {
    const refs = referencesDuRapport(analyser(dossier));
    assert.ok(refs.includes('CPP, art. 63-1'), 'le fondement de GAV-02 doit y être');
    assert.ok(refs.includes('CPP, art. 171'), 'le régime de nullité doit y être');
    assert.equal(new Set(refs).size, refs.length, 'aucun doublon');
  });
});

describe('sourcerRapport', () => {
  it('sans configuration, verse l’index mais n’autorise aucun pourvoi', async () => {
    const s = await sourcerRapport(analyser(dossier));

    // Les articles de l'index sont versés au contexte — avec leur statut, qui
    // dit qu'ils n'ont pas été relus. C'est ce qui permet au modèle de citer un
    // article sans jamais pouvoir citer une décision.
    assert.ok(s.textes.length > 0);
    assert.ok(s.textes.every((t) => t.statut === 'a-verifier'));
    assert.match(s.bloc, /a-verifier/);

    assert.deepEqual(s.decisions, []);
    assert.deepEqual(s.pourvoisAutorises, [], 'aucun pourvoi citable hors réponse d’API');
    assert.match(s.bloc, /Aucun numéro de pourvoi n'est citable/);
    assert.match(s.avertissement, /Aucune source officielle/);
  });

  it('interroge la source et restitue les décisions obtenues', async () => {
    const s = await sourcerRapport(analyser(dossier), {
      judilibre: { urlBase: 'https://exemple.test/j/', enteteAuth: 'KeyId', valeurAuth: 'k' },
      fetchImpl: fauxFetch({
        results: [{ number: '21-80.642', decision_date: '2021-09-07', solution: 'Rejet' }],
      }),
    });

    assert.ok(s.decisions.length > 0);
    assert.ok(s.pourvoisAutorises.includes('21-80.642'));
    assert.match(s.bloc, /21-80\.642/);
    assert.match(s.bloc, /Judilibre/);
  });

  it('ne fabrique aucune décision quand la source est injoignable', async () => {
    const s = await sourcerRapport(analyser(dossier), {
      judilibre: { urlBase: 'https://exemple.test/j/', enteteAuth: 'KeyId', valeurAuth: 'k' },
      fetchImpl: fauxFetch({}, false),
    });

    assert.deepEqual(s.decisions, []);
    assert.deepEqual(s.pourvoisAutorises, []);
    assert.match(s.avertissement, /injoignable|n'a pas pu être interrogée/i);
  });
});
