/**
 * M1 — un dossier complet se crée, s'exporte, se réimporte à l'identique,
 * sans réseau, sans perte. C'est le critère d'acceptation du module, mot à
 * mot.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { empreinte } from '../../ldi/journal';
import { completerDossierPenal } from '../modele';
import { allerRetourIdentique, exporterDossier, importerDossier } from '../serialisation';

const dossierComplet = () =>
  completerDossierPenal(
    {
      reference: 'SER-001',
      qualifications: ['détention et transport de produits stupéfiants'],
      regime: 'criminalite-organisee',
      pieces: [{ id: 'P1', cote: 'D1', nature: 'proces-verbal', intitule: 'PV', date: '2026-03-14' }],
      evenements: [
        { id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00', description: 'Placement', sourcePieceId: 'P1' },
      ],
    },
    {
      initialesClient: 'K.B.',
      juridiction: 'TJ fictif',
      phase: 'enquete',
      statutLiberte: 'detention-provisoire',
      natures: ['detention-transport', 'trafic-aggrave'],
      avancement: 'controle',
      echeances: [{ id: 'EC1', intitule: 'Débat JLD', date: '2026-09-01', type: 'detention', etat: 'ouverte' }],
      faits: [{ id: 'F1', enonce: 'Interpellation à 7 h 45.', periode: '2026-03-14', statut: 'allegue', cotes: ['D1'] }],
      actes: [{ id: 'A1', type: 'interpellation', dateHeure: '2026-03-14T07:45', autoritePrescriptrice: 'OPJ', autorisationPrealable: 'inconnu', cotes: ['D1'], actesSubsequents: [] }],
      moyens: [{ id: 'M1', categorie: 'nullite', enonce: 'x', appuis: ['A1'], references: [], ripostePrevue: 'r', contreRiposte: 'c', consequenceRecherchee: 'q' }],
      manques: [{ id: 'MQ1', nature: 'Heure de fin de GAV', criticite: 'important', necessairePour: 'durée', action: 'demander le PV de fin' }],
    }
  );

describe('M1 — export / réimport', () => {
  it('rend un dossier IDENTIQUE, empreinte comprise', () => {
    const dossier = dossierComplet();
    assert.equal(allerRetourIdentique(dossier), true);

    const json = exporterDossier(dossier);
    const reimporte = importerDossier(json);
    assert.ok(reimporte.ok);
    if (reimporte.ok) {
      assert.equal(empreinte(reimporte.dossier), empreinte(dossier));
      assert.deepEqual(reimporte.dossier.echeances, dossier.echeances);
      assert.deepEqual(reimporte.dossier.moyens, dossier.moyens);
    }
  });

  it('refuse une version de schéma inconnue, sans rien deviner', () => {
    const json = exporterDossier(dossierComplet()).replace('"versionSchema": "3.0"', '"versionSchema": "9.9"');
    const resultat = importerDossier(json);
    assert.equal(resultat.ok, false);
    assert.match(!resultat.ok ? resultat.message : '', /Version de schéma inconnue/);
  });

  it('accepte un dossier d’analyse historique et pose des défauts VIDES', () => {
    const resultat = importerDossier(
      JSON.stringify({ reference: 'H-1', qualifications: [], regime: 'droit-commun', pieces: [], evenements: [] })
    );
    assert.ok(resultat.ok);
    if (resultat.ok) {
      assert.deepEqual(resultat.dossier.moyens, []);
      assert.equal(resultat.dossier.avancement, 'a-constituer');
      assert.equal(resultat.dossier.initialesClient, '');
    }
  });

  it('refuse un JSON illisible avec le motif', () => {
    const resultat = importerDossier('{ pas du json');
    assert.equal(resultat.ok, false);
  });
});
