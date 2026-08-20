/**
 * Étapes 9-11 — preuve (P3), qualification (P4), moyens (P5), demandes (M12),
 * journal (M13), et la chaîne complète P1→P6.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { creerDemande, demandesEnAttente, reprendreDemande, traiterDemande, verifierDemande } from '../demandes';
import { completerDossierPenal, type DossierPenal } from '../modele';
import { executerChaine } from '../orchestrateur';
import { analyserElement } from '../preuve';
import { ELEMENTS_ATTENDUS, analyserQualification } from '../qualification';
import { moyenComplet, ordonnerMoyens } from '../moyens';
import { voletsPeine } from '../peine';

function dossierComplet(): DossierPenal {
  return completerDossierPenal(
    {
      reference: 'CHAINE-001',
      qualifications: ['transport de produits stupéfiants'],
      regime: 'criminalite-organisee',
      pieces: [
        { id: 'P1', cote: 'D12', nature: 'proces-verbal', intitule: 'PV interpellation', date: '2026-03-14' },
        { id: 'P2', cote: 'D40', nature: 'expertise', intitule: 'Analyse produit', date: '2026-03-20' },
      ],
      evenements: [
        { id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00', description: 'Placement', sourcePieceId: 'P1' },
        { id: 'E2', nature: 'notification-droits', horodatage: '2026-03-14T12:00', description: 'Droits (tardif)', sourcePieceId: 'P1' },
        { id: 'E3', nature: 'audition', horodatage: '2026-03-14T13:00', description: 'Audition', sourcePieceId: 'P1' },
      ],
    },
    {
      natures: ['detention-transport'],
      actes: [
        { id: 'A1', type: 'géolocalisation', dateHeure: '2026-03-01T08:00', autoritePrescriptrice: 'parquet', autorisationPrealable: 'non', cotes: ['D12'], actesSubsequents: [] },
      ],
      preuves: [
        { id: 'PR1', type: 'téléphonie — bornage', rattachementClient: 'ligne au nom de la mère', portee: 'présence de secteur', faiblesses: [], cotes: ['D12'] },
      ],
      qualificationsEnvisagees: [
        { id: 'Q1', intituleFonctionnel: 'transport de produits stupéfiants', elementsAttendus: [], elementsPresents: [{ element: 'Détention matérielle ou transport du produit', appuis: ['D12'] }], elementsManquants: [], aggravationsDiscutees: [] },
      ],
    }
  );
}

describe('P3 — analyse de preuve', () => {
  it('dissèque un bornage sans conclure sur les faits', () => {
    const a = analyserElement({ id: 'PR1', type: 'téléphonie — bornage', rattachementClient: '', portee: '', faiblesses: [], cotes: ['D12'] });
    assert.match(a.etablit, /zone de couverture/);
    assert.match(a.netablitPas, /qui tenait/);
    assert.match(a.ecartImputation, /\[INFORMATION MANQUANTE\]/);
    assert.ok(a.hypothesesAlternatives.length >= 1);
    // Jamais de conclusion sur la culpabilité.
    assert.ok(!/coupable|innocent/i.test(JSON.stringify(a)));
  });

  it('tout élément reçoit une analyse — le filet générique existe', () => {
    const a = analyserElement({ id: 'X', type: 'type inédit', rattachementClient: 'x', portee: '', faiblesses: [], cotes: [] });
    assert.ok(a.etablit.length > 10);
    assert.ok(a.netablitPas.length > 10);
  });
});

describe('P4 — qualification', () => {
  it('relie chaque élément à une cote ou à un manque', () => {
    const resultat = analyserQualification(
      {
        id: 'Q1',
        intituleFonctionnel: 'cession de produits stupéfiants',
        elementsAttendus: [],
        elementsPresents: [
          { element: ELEMENTS_ATTENDUS.cession[0], appuis: ['D12'] },
          { element: 'Élément sans appui', appuis: [] },
        ],
        elementsManquants: [],
        aggravationsDiscutees: [],
      },
      'cession'
    );

    // Les attendus non couverts deviennent des manques bloquants.
    assert.ok(resultat.manques.some((m) => m.criticite === 'bloquant'));
    // Un « présent » sans appui est reclassé, pas cru sur parole.
    assert.ok(resultat.manques.some((m) => m.nature.includes('sans appui')));
    assert.equal(resultat.qualification.elementsPresents.length, 1);
    assert.match(resultat.requalification ?? '', /usage ou la détention simple/);
  });

  it('les grilles fonctionnelles ne portent aucun numéro d’article (B2)', () => {
    const tout = JSON.stringify(ELEMENTS_ATTENDUS);
    assert.ok(!/\bart\.?\s*\d/i.test(tout));
    assert.ok(!/\d{3}-\d/.test(tout));
  });
});

describe('P5 — moyens et contradiction', () => {
  it('ordonne par catégorie procédurale, jamais autrement', () => {
    const moyens = ordonnerMoyens([
      { id: 'a', categorie: 'peine', enonce: '', appuis: [], references: [], ripostePrevue: 'x', contreRiposte: 'x', consequenceRecherchee: '' },
      { id: 'b', categorie: 'nullite', enonce: '', appuis: [], references: [], ripostePrevue: 'x', contreRiposte: 'x', consequenceRecherchee: '' },
      { id: 'c', categorie: 'in-limine-litis', enonce: '', appuis: [], references: [], ripostePrevue: 'x', contreRiposte: 'x', consequenceRecherchee: '' },
      { id: 'd', categorie: 'imputation', enonce: '', appuis: [], references: [], ripostePrevue: 'x', contreRiposte: 'x', consequenceRecherchee: '' },
    ]);
    assert.deepEqual(moyens.map((m) => m.id), ['c', 'b', 'd', 'a']);
  });

  it('un moyen sans riposte est incomplet', () => {
    assert.equal(moyenComplet({ id: 'x', categorie: 'nullite', enonce: '', appuis: [], references: [], ripostePrevue: '', contreRiposte: 'x', consequenceRecherchee: '' }), false);
  });
});

describe('chaîne P1→P6 — déterministe, ancrée, journalisée', () => {
  it('déroule les six passes et rend un verdict P6 conforme', () => {
    const resultat = executerChaine(dossierComplet(), { maintenant: '2026-08-20T08:00:00Z' });

    assert.deepEqual(resultat.sorties.map((s) => s.passe), ['P1', 'P2', 'P3', 'P4', 'P5', 'P6']);
    assert.equal(resultat.verdictP6.conforme, true, resultat.verdictP6.divergences.join(' | '));
    assert.equal(resultat.postes.length, 14);
    // La notification tardive et la géolocalisation sans autorisation
    // produisent des moyens de nullité, construits AVEC leur riposte.
    const nullites = resultat.moyens.filter((m) => m.categorie === 'nullite');
    assert.ok(nullites.length >= 2, `${nullites.length} moyen(s) de nullité`);
    for (const m of resultat.moyens) assert.equal(moyenComplet(m), true);
  });

  it('est rejouable : deux exécutions à la même heure rendent les mêmes sorties', () => {
    const a = executerChaine(dossierComplet(), { maintenant: '2026-08-20T08:00:00Z' });
    const b = executerChaine(dossierComplet(), { maintenant: '2026-08-20T08:00:00Z' });
    assert.deepEqual(
      a.sorties.map((s) => ({ ...s, horodatage: '' })),
      b.sorties.map((s) => ({ ...s, horodatage: '' }))
    );
  });

  it('fonctionne sur un dossier vide — mode déterministe seul, jamais inerte', () => {
    const vide = completerDossierPenal({ reference: 'VIDE-1', qualifications: [], regime: 'droit-commun', pieces: [], evenements: [] });
    const resultat = executerChaine(vide, { maintenant: '2026-08-20T08:00:00Z' });
    assert.equal(resultat.postes.length, 14);
    assert.equal(resultat.verdictP6.conforme, true);
  });

  it('journalise chaque passe SANS contenu de dossier (B11)', () => {
    const resultat = executerChaine(dossierComplet(), { maintenant: '2026-08-20T08:00:00Z' });
    const exporte = resultat.journal.exporter();

    assert.equal(resultat.journal.entrees().length, 6);
    // Aucun texte de pièce, d'énoncé ou de constat dans le journal. Les
    // fragments choisis sont du CONTENU de dossier — pas du vocabulaire
    // produit : « INTERPELLATION » est aussi le nom du poste 2, il ne prouve
    // rien.
    for (const fragment of ['stupéfiants', 'bornage', 'au nom de la mère', 'droits (tardif)', 'analyse produit']) {
      assert.ok(!exporte.toLowerCase().includes(fragment), `« ${fragment} » a fui dans le journal`);
    }
    // Mais les identifiants et les comptes y sont.
    assert.match(exporte, /"P2"/);
    assert.match(exporte, /resultats:/);
  });
});

describe('M12 — registre des demandes', () => {
  it('trace une demande de l’énoncé à la clôture, sans suppression possible', () => {
    let demande = creerDemande('CHAINE-001', 'Prépare la requête en nullité sur la géolocalisation.', '2026-08-20T09:00:00Z');
    assert.equal(demande.etat, 'ouverte');

    demande = traiterDemande(demande, { passes: ['P2', 'P5'], sortieId: 'liv-42' });
    assert.equal(demande.etat, 'traitee');
    assert.equal(demande.sortieProduite, 'liv-42');

    demande = verifierDemande(demande, '2026-08-20T10:00:00Z');
    assert.equal(demande.etat, 'close');
    assert.equal(demande.verifieeLe, '2026-08-20T10:00:00Z');
  });

  it('une demande partiellement traitée RESTE ouverte, avec ce qui manque', () => {
    let demande = creerDemande('X', 'Analyse complète.', '2026-08-20T09:00:00Z');
    demande = traiterDemande(demande, {
      passes: ['P3'],
      sortieId: 'liv-1',
      resteAFaire: ['La qualification n’a pas été passée : saisir la qualification poursuivie.'],
    });
    assert.equal(demande.etat, 'ouverte');
    assert.equal(demande.resteAFaire.length, 1);
    assert.equal(demandesEnAttente([demande]).length, 1);
  });

  it('reprendre une demande crée une nouvelle entrée et garde l’ancienne', () => {
    const ancienne = traiterDemande(creerDemande('X', 'Synthèse.', '2026-08-01T09:00:00Z'), { passes: ['P2'], sortieId: 'liv-9' });
    const { nouvelle, comparaison } = reprendreDemande(ancienne, '2026-08-20T09:00:00Z');
    assert.notEqual(nouvelle.id, ancienne.id);
    assert.equal(comparaison.ancienneSortie, 'liv-9');
    assert.equal(ancienne.etat, 'traitee', "l'ancienne ne change pas");
  });
});

describe('M7 — peine sans pronostic', () => {
  it('liste des paramètres et des pièces, jamais un chiffre', () => {
    const volets = voletsPeine(dossierComplet());
    assert.ok(volets.length >= 4);
    const tout = JSON.stringify(volets);
    assert.ok(!/\d+\s*(ans?|mois)\b/.test(tout), 'aucun quantum ne doit apparaître');
    assert.ok(!/\d+\s*%/.test(tout));
  });

  it('n’ouvre le volet douanier que si la taxonomie le porte', () => {
    const sans = voletsPeine(dossierComplet());
    assert.ok(!sans.some((v) => v.intitule.includes('douanières')));
    const avec = voletsPeine(completerDossierPenal(
      { reference: 'X', qualifications: [], regime: 'droit-commun', pieces: [], evenements: [] },
      { natures: ['volet-douanier'] }
    ));
    assert.ok(avec.some((v) => v.intitule.includes('douanières')));
  });
});
