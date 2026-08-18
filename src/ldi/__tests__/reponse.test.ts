/**
 * P1-09 et P1-10. Deux contrôles qui portent sur la réponse du modèle :
 * sa structure est-elle celle que l'invite impose, et ce qu'elle a coûté.
 * Tous deux sont des fonctions pures, donc testables sans appel réseau.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SECTIONS_IMPOSEES,
  controlerAvantAppel,
  estimerCout,
  TARIFS_PAR_MILLION,
  validerStructure,
} from '../reponse';

const CONFORME = `### CE QUI EST DEMANDÉ
x
### CE QUE DIT LE DOSSIER
x
### ANALYSE
x
### RÉSULTATS
x
### ⚠️ RISQUES POUR LE CLIENT
x
### DILIGENCES
x
### SOURCES
x
### LIMITES
x`;

describe('validerStructure', () => {
  it('accepte une réponse portant toutes les sections imposées', () => {
    const r = validerStructure(CONFORME);
    assert.equal(r.conforme, true);
    assert.deepEqual(r.sectionsManquantes, []);
  });

  it('nomme précisément les sections absentes', () => {
    const r = validerStructure('### ANALYSE\nx\n### SOURCES\ny');
    assert.equal(r.conforme, false);
    assert.ok(r.sectionsManquantes.includes('LIMITES'));
    assert.ok(r.sectionsManquantes.includes('DILIGENCES'));
    assert.ok(!r.sectionsManquantes.includes('ANALYSE'));
  });

  it('refuse une réponse vide plutôt que de la laisser passer', () => {
    const r = validerStructure('');
    assert.equal(r.conforme, false);
    assert.equal(r.sectionsManquantes.length, SECTIONS_IMPOSEES.length);
  });

  it('produit une consigne corrective exploitable pour une seconde tentative', () => {
    const r = validerStructure('### ANALYSE\nx');
    assert.ok(r.consigneCorrective.includes('LIMITES'));
    assert.match(r.consigneCorrective, /section/i);
  });

  it("tolère les variations d'accentuation et de casse des titres", () => {
    const r = validerStructure(CONFORME.replace('### LIMITES', '### limites'));
    assert.equal(r.conforme, true);
  });

  it('reconnaît un titre accentué écrit sans ses accents', () => {
    // « RÉSULTATS » écrit « Resultats » : le modèle a rendu la section, il l'a
    // seulement mal orthographiée. Ce n'est pas un défaut de structure.
    const r = validerStructure(CONFORME.replace('### RÉSULTATS', '### Resultats'));
    assert.equal(r.conforme, true, r.sectionsManquantes.join(', '));
  });

  it("accepte un titre en gras plutôt qu'en markdown", () => {
    const gras = CONFORME.split('\n')
      .map((l) => (l.startsWith('### ') ? `**${l.slice(4)}**` : l))
      .join('\n');
    assert.equal(validerStructure(gras).conforme, true);
  });

  it("n'accepte pas une section seulement évoquée dans un paragraphe", () => {
    // Le mot « LIMITES » écrit au fil du texte ne remplace pas la rubrique.
    const r = validerStructure(CONFORME.replace('### LIMITES\nx', 'Voir plus haut les LIMITES.'));
    assert.equal(r.conforme, false);
    assert.deepEqual(r.sectionsManquantes, ['LIMITES']);
  });
});

describe('estimerCout', () => {
  it('calcule à partir des tarifs déclarés, sans rien inventer', () => {
    const c = estimerCout({ entree: 1_000_000, sortie: 0, cacheLu: 0 }, TARIFS_PAR_MILLION);
    assert.equal(c.euros, null, "aucune conversion de devise n'est faite");
    assert.equal(c.dollars, TARIFS_PAR_MILLION.entree);
  });

  it('compte la sortie plus cher que l’entrée', () => {
    const entree = estimerCout({ entree: 100_000, sortie: 0, cacheLu: 0 }, TARIFS_PAR_MILLION);
    const sortie = estimerCout({ entree: 0, sortie: 100_000, cacheLu: 0 }, TARIFS_PAR_MILLION);
    assert.ok(sortie.dollars > entree.dollars);
  });

  it('facture la lecture de cache moins cher que l’entrée pleine', () => {
    const plein = estimerCout({ entree: 100_000, sortie: 0, cacheLu: 0 }, TARIFS_PAR_MILLION);
    const cache = estimerCout({ entree: 0, sortie: 0, cacheLu: 100_000 }, TARIFS_PAR_MILLION);
    assert.ok(cache.dollars < plein.dollars);
  });

  it('signale un dépassement du plafond par dossier', () => {
    const c = estimerCout({ entree: 1_000_000, sortie: 1_000_000, cacheLu: 0 }, TARIFS_PAR_MILLION, 1);
    assert.equal(c.plafondDepasse, true);
    assert.match(c.avertissement, /plafond/i);
  });

  it('ne signale rien sous le plafond', () => {
    const c = estimerCout({ entree: 1000, sortie: 500, cacheLu: 0 }, TARIFS_PAR_MILLION, 10);
    assert.equal(c.plafondDepasse, false);
    assert.equal(c.avertissement, '');
  });
});

describe('controlerAvantAppel', () => {
  it("laisse passer tant que le plafond n'est pas atteint", () => {
    assert.equal(controlerAvantAppel(2, 5).autorise, true);
    assert.equal(controlerAvantAppel(2, 5).message, '');
  });

  it("refuse l'appel une fois le plafond atteint, avant toute dépense", () => {
    const r = controlerAvantAppel(5, 5);
    assert.equal(r.autorise, false);
    assert.match(r.message, /plafond/i);
  });

  it('laisse passer un premier appel, compteur à zéro', () => {
    assert.equal(controlerAvantAppel(0, 5).autorise, true);
  });

  it('refuse plutôt que de laisser passer un compteur illisible', () => {
    // Le piège : toute comparaison avec NaN est fausse, donc un compteur
    // corrompu ouvrirait la porte à chaque appel si le contrôle se contentait
    // d'un « < ». Il échoue fermé.
    for (const valeur of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      const r = controlerAvantAppel(valeur, 5);
      assert.equal(r.autorise, false, `valeur refusée attendue pour ${valeur}`);
      assert.ok(r.message.length > 0);
    }
  });
});
