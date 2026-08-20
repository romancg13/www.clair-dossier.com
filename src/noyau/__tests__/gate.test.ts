/**
 * Gate d'export (M9) — chaque cause de blocage de §10.2, testée une à une,
 * avec le chemin exact vérifié. La gate est le module qui rend tous les
 * autres livrables : elle se teste avant eux.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { completerDossierPenal, type DossierPenal, type Moyen } from '../modele';
import { controlerExport, referenceComplete, rendreVerdict } from '../gate';
import { scellerSortie } from '../passes';

function dossier(): DossierPenal {
  return completerDossierPenal(
    {
      reference: 'GATE-001',
      qualifications: [],
      regime: 'droit-commun',
      pieces: [{ id: 'P1', cote: 'D5', nature: 'proces-verbal', intitule: 'PV' }],
      evenements: [],
    },
    {
      actes: [{ id: 'A1', type: 'perquisition', dateHeure: '2026-03-14T09:30', autoritePrescriptrice: 'OPJ', autorisationPrealable: 'inconnu', cotes: ['D5'], actesSubsequents: [] }],
    }
  );
}

function moyen(surcharge: Partial<Moyen> = {}): Moyen {
  return {
    id: 'M1',
    categorie: 'nullite',
    enonce: 'Nullité de la perquisition.',
    appuis: ['A1'],
    references: ['CPP, art. 76'],
    ripostePrevue: 'Assentiment allégué par le parquet.',
    contreRiposte: 'Aucun écrit d’assentiment n’est coté.',
    consequenceRecherchee: 'Annulation de D5.',
    ...surcharge,
  };
}

const corpsSain = 'Le grief est articulé sur la cote D5. Fondement à vérifier auprès de la source officielle.';

describe('gate d’export — chaque cause de blocage', () => {
  it('laisse passer un livrable sain', () => {
    const verdict = controlerExport({ nom: 'requête', corps: corpsSain, moyens: [moyen()] }, dossier());
    assert.equal(verdict.autorise, true);
    assert.equal(rendreVerdict(verdict), 'Export autorisé : aucune anomalie.');
  });

  it('bloque tout pourcentage, avec la ligne exacte', () => {
    const verdict = controlerExport(
      { nom: 'note', corps: 'Première ligne.\nLes chances sont de 80 % environ.' },
      dossier()
    );
    assert.equal(verdict.autorise, false);
    assert.equal(verdict.anomalies[0].chemin, 'note · corps (ligne 2)');
    assert.match(verdict.anomalies[0].regle, /B4/);
  });

  it('bloque « chances de succès » même sans chiffre', () => {
    const verdict = controlerExport({ nom: 'note', corps: 'Bonnes chances de succès.' }, dossier());
    assert.equal(verdict.autorise, false);
  });

  it('bloque une affirmation de culpabilité (B15)', () => {
    const verdict = controlerExport({ nom: 'note', corps: 'Il est coupable des faits.' }, dossier());
    assert.equal(verdict.autorise, false);
    assert.match(verdict.anomalies[0].regle, /B15/);
  });

  it('déclenche le fil de détente B13', () => {
    const verdict = controlerExport(
      { nom: 'note', corps: 'Il conviendrait de faire pression sur le témoin principal.' },
      dossier()
    );
    assert.equal(verdict.autorise, false);
    assert.match(verdict.anomalies[0].regle, /B13/);
  });

  it('bloque une référence aux métadonnées incomplètes (B3), en nommant ce qui manque', () => {
    const verdict = controlerExport(
      {
        nom: 'note',
        corps: corpsSain,
        references: [{ identifiant: 'CPP, art. 76', date: '2026-01-01', source: 'Légifrance', url: '', recupereLe: '' }],
      },
      dossier()
    );
    assert.equal(verdict.autorise, false);
    assert.match(verdict.anomalies[0].detail, /URL officielle/);
    assert.match(verdict.anomalies[0].detail, /horodatage de récupération/);
  });

  it('accepte une référence complète', () => {
    assert.equal(
      referenceComplete({ identifiant: 'x', date: 'x', source: 'x', url: 'x', recupereLe: 'x' }),
      true
    );
  });

  it('bloque un moyen sans riposte anticipée (P5), avec le chemin du moyen', () => {
    const verdict = controlerExport(
      { nom: 'conclusions', corps: corpsSain, moyens: [moyen({ ripostePrevue: '' })] },
      dossier()
    );
    assert.equal(verdict.autorise, false);
    assert.equal(verdict.anomalies[0].chemin, 'conclusions · moyens[0] (M1)');
    assert.match(verdict.anomalies[0].regle, /P5/);
  });

  it('bloque un moyen citant une cote inexistante', () => {
    const verdict = controlerExport(
      { nom: 'conclusions', corps: corpsSain, moyens: [moyen({ appuis: ['D999'] })] },
      dossier()
    );
    assert.equal(verdict.autorise, false);
    assert.match(verdict.anomalies[0].detail, /D999/);
  });

  it('exige la mention imposée quand un moyen n’a aucune source', () => {
    const verdict = controlerExport(
      { nom: 'conclusions', corps: 'Corps sans la mention.', moyens: [moyen({ references: [] })] },
      dossier()
    );
    assert.equal(verdict.autorise, false);
    assert.match(verdict.anomalies[0].regle, /§9\.1/);
  });

  it('bloque un envoi distant sans consentement enregistré (B19)', () => {
    const sortie = scellerSortie('P3', dossier(), [], {
      moteur: { type: 'distant', modele: 'x', consentementDistant: false },
    });
    const verdict = controlerExport({ nom: 'note', corps: corpsSain, sorties: [sortie] }, dossier());
    assert.equal(verdict.autorise, false);
    assert.match(verdict.anomalies[0].regle, /B19/);
  });

  it('laisse passer un envoi distant CONSENTI', () => {
    const sortie = scellerSortie('P3', dossier(), [], {
      moteur: { type: 'distant', modele: 'x', consentementDistant: true },
    });
    const verdict = controlerExport({ nom: 'note', corps: corpsSain, sorties: [sortie] }, dossier());
    assert.equal(verdict.autorise, true);
  });

  it('bloque sur une contradiction critique de dates', () => {
    const verdict = controlerExport(
      {
        nom: 'note',
        corps: corpsSain,
        contradictions: [
          { type: 'duree-legale', severite: 'critique', constat: 'La garde à vue dépasse la durée maximale.', verificationSuggeree: 'x', elements: [] },
        ],
      },
      dossier()
    );
    assert.equal(verdict.autorise, false);
    assert.match(verdict.anomalies[0].regle, /date bloquante/);
  });

  it('cumule les anomalies au lieu de s’arrêter à la première', () => {
    const verdict = controlerExport(
      { nom: 'note', corps: 'Il est coupable, avec 90 % de chances de succès.', moyens: [moyen({ ripostePrevue: '' })] },
      dossier()
    );
    assert.ok(verdict.anomalies.length >= 3, `${verdict.anomalies.length} anomalies`);
    assert.match(rendreVerdict(verdict), /Export bloqué — \d+ anomalie/);
  });
});
