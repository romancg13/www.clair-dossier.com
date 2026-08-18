/**
 * L'atelier classe des dossiers. Un classement faux est pire qu'absent : on
 * cherche un dossier là où il n'est pas, et on conclut qu'il n'y a rien.
 *
 * Ces tests verrouillent surtout ce que le classement NE fait PAS — inventer
 * une catégorie, réordonner des échéances, produire un score.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  anomaliesRegroupees,
  classer,
  etatDossier,
  ficheDossier,
  filtrer,
  indicateurs,
  LIBELLES_ETAT,
  ordonner,
  totaux,
} from '../atelier';
import { analyser } from '../pipeline';
import type { Dossier, Evenement } from '../types';

function evenement(
  p: Partial<Evenement> & Pick<Evenement, 'id' | 'nature' | 'horodatage'>
): Evenement {
  return { description: p.nature, ...p } as Evenement;
}

/** Garde à vue régulière — témoin négatif. */
function dossierRegulier(reference = 'REG-001'): Dossier {
  return {
    reference,
    qualifications: ['CP, art. 313-1'],
    regime: 'droit-commun',
    pieces: [
      { id: 'P1', nature: 'proces-verbal', intitule: 'PV placement', date: '2026-03-14' },
      { id: 'P2', nature: 'audition', intitule: 'PV audition', date: '2026-03-14' },
      { id: 'P3', nature: 'proces-verbal', intitule: 'PV fin', date: '2026-03-15' },
    ],
    evenements: [
      evenement({ id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00', sourcePieceId: 'P1' }),
      evenement({ id: 'E2', nature: 'notification-droits', horodatage: '2026-03-14T08:10', sourcePieceId: 'P1' }),
      evenement({ id: 'E3', nature: 'demande-avocat', horodatage: '2026-03-14T08:15', sourcePieceId: 'P1' }),
      evenement({ id: 'E4', nature: 'avis-avocat', horodatage: '2026-03-14T08:25', sourcePieceId: 'P1' }),
      evenement({ id: 'E5', nature: 'arrivee-avocat', horodatage: '2026-03-14T09:40', sourcePieceId: 'P2' }),
      evenement({ id: 'E6', nature: 'audition', horodatage: '2026-03-14T10:00', sourcePieceId: 'P2' }),
      evenement({ id: 'E7', nature: 'fin-garde-a-vue', horodatage: '2026-03-15T07:30', sourcePieceId: 'P3' }),
    ],
  };
}

/** Garde à vue dont la fin précède le début : anomalie garantie. */
function dossierAnomalie(reference = 'ANO-001'): Dossier {
  return {
    reference,
    qualifications: ['CP, art. 222-37'],
    regime: 'criminalite-organisee',
    pieces: [{ id: 'P1', nature: 'proces-verbal', intitule: 'PV', date: '2026-03-14' }],
    evenements: [
      evenement({ id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T18:00', sourcePieceId: 'P1' }),
      evenement({ id: 'E2', nature: 'fin-garde-a-vue', horodatage: '2026-03-14T09:00', sourcePieceId: 'P1' }),
    ],
  };
}

function dossierVide(reference = 'VID-001'): Dossier {
  return { reference, qualifications: [], regime: 'droit-commun', pieces: [], evenements: [] };
}

const fiche = (d: Dossier) => ficheDossier(analyser(d));

describe('indicateurs', () => {
  it('compte les pièces et les événements réellement présents', () => {
    const i = indicateurs(analyser(dossierRegulier()));
    assert.equal(i.pieces, 3);
    assert.equal(i.evenements, 7);
  });

  it("ne compte comme daté qu'un événement portant une heure exploitable", () => {
    const d = dossierRegulier();
    d.evenements.push(evenement({ id: 'E8', nature: 'audition', horodatage: '2026-03-16', sourcePieceId: 'P2' }));
    const i = indicateurs(analyser(d));
    assert.equal(i.evenements, 8);
    assert.equal(i.evenementsDates, 7, "la date sans heure ne doit pas compter comme datée");
  });

  it('ne produit aucun pourcentage ni score', () => {
    const i = indicateurs(analyser(dossierAnomalie()));
    for (const [cle, valeur] of Object.entries(i)) {
      assert.equal(typeof valeur, 'number', cle);
      assert.ok(Number.isInteger(valeur), `${cle} doit être un compte entier, pas un ratio`);
    }
  });
});

describe('etatDossier', () => {
  it('classe en anomalie un dossier dont un point de contrôle a relevé un écart', () => {
    assert.equal(etatDossier(analyser(dossierAnomalie())), 'anomalie');
  });

  it('distingue un dossier sans pièce d’un dossier sans anomalie', () => {
    assert.equal(etatDossier(analyser(dossierVide())), 'vide');
    assert.notEqual(etatDossier(analyser(dossierRegulier())), 'vide');
  });

  it("n'affirme jamais la régularité de la procédure", () => {
    // Le libellé le plus favorable que le système puisse produire doit rappeler
    // que le contrôle est partiel. C'est la lecture erronée la plus coûteuse.
    assert.match(LIBELLES_ETAT['sans-anomalie'].explication, /ne signifie pas que la procédure est régulière/i);
    for (const libelle of Object.values(LIBELLES_ETAT)) {
      assert.ok(!/conforme|régulier\b|valide/i.test(libelle.court), libelle.court);
    }
  });
});

describe('classer', () => {
  const fiches = [fiche(dossierRegulier()), fiche(dossierAnomalie()), fiche(dossierVide())];

  it('groupe par état en plaçant devant ce qui appelle une action', () => {
    const groupes = classer(fiches, 'etat');
    assert.equal(groupes[0].cle, 'anomalie');
    assert.ok(groupes.every((g) => g.fiches.length > 0), 'aucun groupe vide ne doit être rendu');
  });

  it('groupe par régime tel qu’il est déclaré au dossier', () => {
    const groupes = classer(fiches, 'regime');
    const orga = groupes.find((g) => g.cle === 'criminalite-organisee');
    assert.equal(orga?.fiches.length, 1);
    assert.equal(orga?.fiches[0].reference, 'ANO-001');
  });

  it('reprend les qualifications verbatim, sans les normaliser', () => {
    const groupes = classer(fiches, 'qualification');
    const cles = groupes.map((g) => g.cle);
    assert.ok(cles.includes('CP, art. 313-1'));
    assert.ok(cles.includes('CP, art. 222-37'));
    assert.ok(cles.includes('(non renseignée)'), 'un dossier sans qualification reste visible');
  });

  it('fait apparaître dans deux groupes un dossier à deux qualifications', () => {
    const d = dossierRegulier('MULTI-001');
    d.qualifications = ['CP, art. 313-1', 'CP, art. 324-1'];
    const groupes = classer([fiche(d)], 'qualification');
    assert.equal(groupes.length, 2);
    assert.ok(groupes.every((g) => g.fiches[0].reference === 'MULTI-001'));
  });

  it('ne perd aucun dossier sur les axes exclusifs', () => {
    for (const axe of ['etat', 'regime'] as const) {
      const total = classer(fiches, axe).reduce((n, g) => n + g.fiches.length, 0);
      assert.equal(total, fiches.length, `axe ${axe}`);
    }
  });
});

describe('ordonner', () => {
  it('place les dossiers porteurs d’anomalies en tête', () => {
    const ordonnees = ordonner([fiche(dossierRegulier()), fiche(dossierAnomalie())]);
    assert.equal(ordonnees[0].reference, 'ANO-001');
  });

  it('est reproductible à contenu égal', () => {
    const fiches = [fiche(dossierAnomalie('B')), fiche(dossierAnomalie('A')), fiche(dossierRegulier('C'))];
    const a = ordonner(fiches).map((f) => f.reference);
    const b = ordonner([...fiches].reverse()).map((f) => f.reference);
    assert.deepEqual(a, b, "l'ordre ne doit pas dépendre de l'ordre d'entrée");
  });
});

describe('échéances et totaux', () => {
  it('reprend les échéances sans les réordonner ni les dater', () => {
    const rapport = analyser(dossierAnomalie());
    assert.deepEqual(ficheDossier(rapport).echeances, rapport.strategie.echeances);
  });

  it('additionne les comptes de tous les dossiers', () => {
    const t = totaux([fiche(dossierRegulier()), fiche(dossierAnomalie())]);
    assert.equal(t.dossiers, 2);
    assert.equal(t.pieces, 4);
    assert.ok(t.anomalies >= 1);
  });

  it('renvoie des totaux à zéro sur un atelier vide', () => {
    const t = totaux([]);
    assert.equal(t.dossiers, 0);
    assert.equal(t.pieces, 0);
    assert.equal(t.anomalies, 0);
  });
});

describe('anomaliesRegroupees', () => {
  it('classe les anomalies de tous les dossiers, les plus sévères en tête', () => {
    const liste = anomaliesRegroupees([analyser(dossierAnomalie()), analyser(dossierRegulier())]);
    assert.ok(liste.length > 0);
    const poids = { critique: 3, majeure: 2, mineure: 1 } as const;
    for (let i = 1; i < liste.length; i += 1) {
      assert.ok(poids[liste[i - 1].severite] >= poids[liste[i].severite]);
    }
  });

  it('rattache chaque anomalie à son dossier', () => {
    const liste = anomaliesRegroupees([analyser(dossierAnomalie('X-1'))]);
    assert.ok(liste.every((a) => a.reference === 'X-1'));
  });
});

describe('filtrer', () => {
  const fiches = [fiche(dossierRegulier()), fiche(dossierAnomalie())];

  it('trouve un dossier par sa référence et par sa qualification', () => {
    assert.equal(filtrer(fiches, 'ANO').length, 1);
    assert.equal(filtrer(fiches, '313-1').length, 1);
  });

  it('rend tout sur une requête vide', () => {
    assert.equal(filtrer(fiches, '   ').length, 2);
  });
});
