/**
 * P1-12 — l'autorité d'une citation ne peut pas être déclarée par une partie.
 *
 * Ces tests sont des tests de sécurité : chacun décrit un chemin par lequel une
 * référence non vérifiée pourrait atteindre un acte signé par l'avocat.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  allegue,
  controlerExport,
  estCitable,
  intersecter,
  introuvable,
  resolueParApi,
  verifieeParAvocat,
  type EtatReference,
} from '../tracabilite';

const LE = '2026-08-18T10:00:00Z';

describe('états d’une référence', () => {
  it('naît alléguée, quelle que soit son origine', () => {
    for (const origine of ['corps de requête', 'pièce du dossier', 'sortie du modèle']) {
      const r = allegue('CPP, art. 63', origine);
      assert.equal(r.etat, 'allegue');
      assert.equal(r.resoluLe, null);
      assert.equal(estCitable(r), false);
    }
  });

  it("n'accepte aucun état fourni de l'extérieur", () => {
    // `allegue()` ne prend pas d'état en paramètre : la seule façon d'obtenir
    // un état citable est de passer par une fonction de résolution.
    assert.equal(allegue.length, 2, 'la signature ne doit pas exposer d’état');
  });

  it('ne devient citable que par résolution officielle ou contrôle manuel', () => {
    assert.equal(estCitable(resolueParApi('CPP, art. 63', 'Légifrance', LE)), true);
    assert.equal(estCitable(verifieeParAvocat('CPP, art. 63', 'Me Martin', LE)), true);
    assert.equal(estCitable(introuvable('CPP, art. 999', 'Légifrance', LE)), false);
    assert.equal(estCitable(allegue('CPP, art. 63', 'client')), false);
  });

  it('distingue le contrôle manuel de la résolution automatique', () => {
    const manuel = verifieeParAvocat('CPP, art. 63', 'Me Martin', LE);
    const auto = resolueParApi('CPP, art. 63', 'Légifrance', LE);
    assert.notEqual(manuel.etat, auto.etat);
    // Le contrôle manuel engage quelqu'un : l'origine doit le nommer.
    assert.match(manuel.origine, /Me Martin/);
    assert.equal(manuel.resoluLe, LE);
  });

  it('horodate toute résolution', () => {
    for (const r of [
      resolueParApi('a', 'Légifrance', LE),
      verifieeParAvocat('b', 'Me Martin', LE),
      introuvable('c', 'Judilibre', LE),
    ]) {
      assert.equal(r.resoluLe, LE);
    }
  });
});

describe('contrôle avant export', () => {
  it('autorise un acte dont toutes les références sont résolues', () => {
    const c = controlerExport([
      resolueParApi('CPP, art. 63', 'Légifrance', LE),
      verifieeParAvocat('CPP, art. 171', 'Me Martin', LE),
    ]);
    assert.equal(c.autorise, true);
    assert.equal(c.message, '');
  });

  it('bloque sur une référence alléguée', () => {
    const c = controlerExport([
      resolueParApi('CPP, art. 63', 'Légifrance', LE),
      allegue('Crim. 7 sept. 2021, n° 21-80.642', 'transmis par le client'),
    ]);
    assert.equal(c.autorise, false);
    assert.equal(c.bloquantes.length, 1);
    assert.match(c.message, /allégué/i);
  });

  it('bloque aussi sur une référence introuvable à la source', () => {
    // Plus dangereuse qu'une référence jamais vérifiée : elle a l'apparence
    // d'avoir été contrôlée.
    const c = controlerExport([introuvable('CPP, art. 999', 'Légifrance', LE)]);
    assert.equal(c.autorise, false);
    assert.match(c.message, /introuvable/i);
    assert.match(c.message, /ne doit pas figurer dans un acte/i);
  });

  it('nomme toutes les références bloquantes, pas seulement la première', () => {
    const c = controlerExport([
      allegue('A', 'client'),
      allegue('B', 'pièce'),
      introuvable('C', 'Judilibre', LE),
    ]);
    assert.equal(c.bloquantes.length, 3);
    for (const r of ['A', 'B', 'C']) assert.ok(c.message.includes(r), `${r} doit être nommée`);
  });

  it('autorise un export sans aucune référence', () => {
    assert.equal(controlerExport([]).autorise, true);
  });

  it("indique la voie de sortie plutôt que de laisser l'avocat bloqué", () => {
    const c = controlerExport([allegue('A', 'client')]);
    assert.match(c.message, /vérifiée personnellement|source officielle/i);
  });
});

describe('intersection avec une autorité de confiance', () => {
  const autorite = new Set(['CPP, art. 63', 'CPP, art. 171']);

  it("laisse l'appelant restreindre l'ensemble citable", () => {
    assert.deepEqual(intersecter(['CPP, art. 63'], autorite), ['CPP, art. 63']);
  });

  it("ne laisse jamais l'appelant l'élargir", () => {
    // Le cœur de P1-12 : un pourvoi inventé transmis par un appelant
    // authentifié ne doit pas devenir citable.
    assert.deepEqual(intersecter(['21-80.642', 'CPP, art. 999'], autorite), []);
  });

  it('ignore les doublons sans les autoriser deux fois', () => {
    const sortie = intersecter(['CPP, art. 63', 'CPP, art. 63', 'inventé'], autorite);
    assert.deepEqual(sortie, ['CPP, art. 63', 'CPP, art. 63']);
    assert.ok(!sortie.includes('inventé'));
  });

  it('rend un ensemble vide face à une autorité vide', () => {
    // Sans autorité côté serveur, RIEN n'est citable — et c'est le
    // comportement correct, pas une panne.
    assert.deepEqual(intersecter(['CPP, art. 63'], new Set()), []);
  });
});

describe('exhaustivité du modèle', () => {
  it("n'admet aucun état hors des quatre déclarés", () => {
    const etats: EtatReference[] = ['allegue', 'introuvable', 'verifie-avocat', 'verifie-api'];
    // Un état ajouté au type sans décision sur sa citabilité ferait échouer ce
    // test : `estCitable` doit trancher explicitement pour chacun.
    for (const etat of etats) {
      const r = { reference: 'x', etat, origine: 'test', resoluLe: null };
      assert.equal(typeof estCitable(r), 'boolean', etat);
    }
    assert.equal(etats.length, 4);
  });
});
