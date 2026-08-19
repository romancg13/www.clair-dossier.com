/**
 * Noyau v4 — modèle, invariants, contrat de passes, moteur de délais.
 *
 * Le test central est celui de B16 : un énoncé sans appui n'atteint JAMAIS
 * les résultats d'une passe. Tout le reste du produit repose dessus.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  VERSION_SCHEMA,
  actesContamines,
  completerDossierPenal,
  controlerInvariants,
  versionAcceptee,
  type DossierPenal,
} from '../modele';
import {
  MOTEUR_DETERMINISTE,
  calculerAncrage,
  identifiantsConnus,
  porteUnExport,
  scellerSortie,
  verifierAncrage,
} from '../passes';
import { joursRestants, termeGardeAVue, trierEcheances, urgenceDe } from '../delais';

function dossier(): DossierPenal {
  return completerDossierPenal(
    {
      reference: 'NOYAU-001',
      qualifications: ['transport et détention de produits stupéfiants'],
      regime: 'criminalite-organisee',
      pieces: [
        { id: 'P1', cote: 'D12', nature: 'proces-verbal', intitule: 'PV d’interpellation', date: '2026-03-14' },
        { id: 'P2', cote: 'D13', nature: 'proces-verbal', intitule: 'PV de perquisition', date: '2026-03-14' },
      ],
      evenements: [
        { id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00', description: 'Placement', sourcePieceId: 'P1' },
      ],
    },
    {
      faits: [
        { id: 'F1', enonce: 'Interpellation du client à 7 h 45.', periode: '2026-03-14', statut: 'allegue', cotes: ['D12'] },
        { id: 'F2', enonce: 'Fait sans aucune cote.', periode: null, statut: 'allegue', cotes: [] },
      ],
      actes: [
        { id: 'A1', type: 'interpellation', dateHeure: '2026-03-14T07:45', autoritePrescriptrice: 'OPJ', autorisationPrealable: 'inconnu', cotes: ['D12'], actesSubsequents: ['A2'] },
        { id: 'A2', type: 'perquisition', dateHeure: '2026-03-14T09:30', autoritePrescriptrice: 'OPJ', autorisationPrealable: 'inconnu', cotes: ['D13'], actesSubsequents: ['A3'] },
        { id: 'A3', type: 'saisie', dateHeure: '2026-03-14T10:00', autoritePrescriptrice: 'OPJ', autorisationPrealable: 'non', cotes: ['D13'], actesSubsequents: [] },
      ],
      moyens: [
        { id: 'M1', categorie: 'nullite', enonce: 'Nullité de la perquisition.', appuis: ['A2'], references: [], ripostePrevue: 'Assentiment allégué.', contreRiposte: 'Aucun écrit d’assentiment coté.', consequenceRecherchee: 'Annulation de D13 et des actes subséquents.' },
        { id: 'M2', categorie: 'imputation', enonce: 'Moyen sans appui de fait ni d’acte.', appuis: ['D12'], references: [], ripostePrevue: 'x', contreRiposte: 'x', consequenceRecherchee: 'x' },
      ],
      griefs: [
        { id: 'G1', acteViseId: 'A2', irregularite: 'Absence d’assentiment écrit.', interetAAgir: 'Domicile du client.', cotesAffectees: ['D13'], actesSubsequentsContamines: [], forclusionEventuelle: null, appuis: ['A2'] },
      ],
    }
  );
}

describe('modèle — invariants', () => {
  it('signale un moyen qui ne cite ni fait ni acte', () => {
    const violations = controlerInvariants(dossier());
    const moyen = violations.find((v) => v.entite === 'Moyen' && v.id === 'M2');
    assert.ok(moyen, 'M2 ne cite qu’une cote : il doit être signalé');
  });

  it('signale un fait sans cote, sans le corriger', () => {
    const d = dossier();
    const violations = controlerInvariants(d);
    assert.ok(violations.some((v) => v.entite === 'Fait' && v.id === 'F2'));
    // Le fait reste tel quel : signaler n'est pas corriger.
    assert.equal(d.faits[1].cotes.length, 0);
  });

  it('signale une cote citée qui n’existe pas', () => {
    const d = dossier();
    d.faits[0].cotes = ['D99'];
    assert.ok(controlerInvariants(d).some((v) => v.regle.includes('D99')));
  });

  it('refuse une version de schéma inconnue', () => {
    assert.equal(versionAcceptee(VERSION_SCHEMA), true);
    assert.equal(versionAcceptee('2.0'), false);
    assert.equal(versionAcceptee(undefined), false);
  });

  it('propage un grief aux actes subséquents, transitivement', () => {
    const d = dossier();
    assert.deepEqual(actesContamines(d, d.griefs[0]).sort(), ['A2', 'A3']);
  });

  it('survit à un cycle dans le graphe des actes', () => {
    const d = dossier();
    d.actes[2].actesSubsequents = ['A1']; // A3 → A1 → A2 → A3
    assert.deepEqual(actesContamines(d, d.griefs[0]).sort(), ['A1', 'A2', 'A3']);
  });
});

describe('passes — ancrage obligatoire (B16)', () => {
  it('calcule l’ancrage, ne le croit pas sur parole', () => {
    const connus = identifiantsConnus(dossier());
    assert.equal(calculerAncrage(['A1', 'D12'], connus), 'direct');
    assert.equal(calculerAncrage(['A1', 'X-INCONNU'], connus), 'partiel');
    assert.equal(calculerAncrage(['X-INCONNU'], connus), 'absent');
    assert.equal(calculerAncrage([], connus), 'absent');
  });

  it('bloque un énoncé sans appui AVANT les résultats, avec le motif', () => {
    const sortie = scellerSortie('P2', dossier(), [
      { enonce: 'La perquisition est intervenue sans assentiment écrit.', appuis: ['A2'] },
      { enonce: 'Le client a certainement menti.', appuis: [] },
      { enonce: 'Un arrêt bien connu le confirme.', appuis: ['JURIS-INVENTEE'] },
    ]);

    assert.equal(sortie.resultats.length, 1);
    assert.equal(sortie.resultats[0].ancrage, 'direct');
    assert.equal(sortie.ecarte.length, 2);
    assert.match(sortie.ecarte[0].motif, /B16/);
    assert.match(sortie.ecarte[1].motif, /n'existe au dossier/);
  });

  it('P6 recalcule l’ancrage indépendamment et voit une falsification', () => {
    const sortie = scellerSortie('P3', dossier(), [
      { enonce: 'Élément rattaché au client par la seule proximité.', appuis: ['D12'] },
    ]);
    // Falsification : quelqu'un promeut l'ancrage à la main.
    sortie.resultats[0].appuis = ['INEXISTANT'];
    const controle = verifierAncrage(sortie, dossier());
    assert.equal(controle.conforme, false);
    assert.ok(controle.divergences.length >= 1);
  });

  it('un énoncé partiel ne peut pas fonder seul un export', () => {
    const connus = identifiantsConnus(dossier());
    const partiel = { enonce: 'x', appuis: ['A1', 'HORS-DOSSIER'], ancrage: calculerAncrage(['A1', 'HORS-DOSSIER'], connus) };
    assert.equal(partiel.ancrage, 'partiel');
    assert.equal(porteUnExport([partiel]), false);
    assert.equal(porteUnExport([partiel, { enonce: 'y', appuis: ['A1'], ancrage: 'direct' }]), true);
  });

  it('déclare le moteur employé dans chaque sortie (B19)', () => {
    const sortie = scellerSortie('P1', dossier(), []);
    assert.deepEqual(sortie.moteur, MOTEUR_DETERMINISTE);
    assert.equal(sortie.moteur.consentementDistant, false);
  });
});

describe('moteur de délais — méthode et entrées exposées', () => {
  it('calcule le terme de garde à vue en montrant tout', () => {
    const calcul = termeGardeAVue('2026-03-14T08:00:00Z', 'criminalite-organisee');
    assert.equal(calcul.resultat, '2026-03-18T08:00:00.000Z'); // 96 h
    assert.match(calcul.methode, /96 heures/);
    assert.equal(calcul.entrees.length, 2);
    assert.ok(calcul.fondement, 'le texte fondant la durée doit être cité');
    assert.match(calcul.avertissement, /à vérifier auprès de la source officielle/i);
  });

  it('rend null plutôt qu’un terme deviné quand le début manque', () => {
    const calcul = termeGardeAVue(null, 'droit-commun');
    assert.equal(calcul.resultat, null);
    assert.match(calcul.avertissement, /n'est pas daté/);
  });

  it('classe l’urgence depuis les échéances ouvertes, dépassées comprises', () => {
    const maintenant = '2026-08-19T12:00:00Z';
    const e = (date: string, etat: 'ouverte' | 'tenue' = 'ouverte') => ({
      id: date, intitule: 'x', date, type: 'procedural' as const, etat,
    });
    assert.equal(urgenceDe([], maintenant), 'sans-echeance-courte');
    assert.equal(urgenceDe([e('2026-08-20')], maintenant), 'sous-48h');
    assert.equal(urgenceDe([e('2026-08-25')], maintenant), 'sous-7j');
    assert.equal(urgenceDe([e('2026-09-10')], maintenant), 'sous-30j');
    assert.equal(urgenceDe([e('2027-01-01')], maintenant), 'sans-echeance-courte');
    // Dépassée mais ouverte : elle brûle encore plus, elle ne disparaît pas.
    assert.equal(urgenceDe([e('2026-08-01')], maintenant), 'sous-48h');
    // Tenue : elle ne compte plus.
    assert.equal(urgenceDe([e('2026-08-20', 'tenue')], maintenant), 'sans-echeance-courte');
  });

  it('trie le bandeau : ouvertes d’abord, puis par date', () => {
    const tri = trierEcheances([
      { id: 'a', intitule: 'x', date: '2026-09-01', type: 'audience', etat: 'tenue' },
      { id: 'b', intitule: 'x', date: '2026-08-25', type: 'procedural', etat: 'ouverte' },
      { id: 'c', intitule: 'x', date: '2026-08-20', type: 'detention', etat: 'ouverte' },
    ]);
    assert.deepEqual(tri.map((e) => e.id), ['c', 'b', 'a']);
  });

  it('compte les jours restants, négatifs après le terme', () => {
    const e = { id: 'x', intitule: 'x', date: '2026-08-21', type: 'procedural' as const, etat: 'ouverte' as const };
    assert.equal(joursRestants(e, '2026-08-19T12:00:00Z'), 2);
    assert.ok(joursRestants(e, '2026-08-25T12:00:00Z') < 0);
  });
});
