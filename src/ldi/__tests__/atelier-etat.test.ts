/**
 * Deux mécanismes d'atelier qui touchent à des promesses fortes :
 *   — le cache ne doit jamais servir le rapport d'un AUTRE état de dossier ;
 *   — la conservation ne doit jamais écrire sans consentement, ni laisser
 *     quoi que ce soit derrière elle quand on la coupe.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { creerCacheAnalyse } from '../cache';
import {
  conserver,
  definirConservation,
  etatConservation,
  purger,
  relire,
  type StockageMinimal,
} from '../stockage';
import type { Dossier } from '../types';

function dossier(reference = 'CACHE-001'): Dossier {
  return {
    reference,
    qualifications: ['CP, art. 313-1'],
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
}

/** Support en mémoire : le test ne dépend pas d'un navigateur. */
function supportMemoire(): StockageMinimal & { contenu: Map<string, string> } {
  const contenu = new Map<string, string>();
  return {
    contenu,
    getItem: (c) => contenu.get(c) ?? null,
    setItem: (c, v) => void contenu.set(c, v),
    removeItem: (c) => void contenu.delete(c),
  };
}

describe('cache d’analyse', () => {
  it('rend le même rapport pour un dossier inchangé, sans réanalyser', () => {
    const cache = creerCacheAnalyse();
    const d = dossier();
    const a = cache.analyser(d);
    const b = cache.analyser(d);

    assert.equal(a, b, 'la même référence d’objet doit être servie');
    assert.deepEqual(cache.statistiques(), { entrees: 1, succes: 1, defauts: 1 });
  });

  it('réanalyse dès que le dossier change', () => {
    const cache = creerCacheAnalyse();
    const d = dossier();
    const avant = cache.analyser(d);

    const modifie = { ...d, pieces: [...d.pieces, { id: 'P2', nature: 'audition' as const, intitule: 'PV 2' }] };
    const apres = cache.analyser(modifie);

    assert.notEqual(avant, apres);
    assert.equal(apres.dossier.piecesTotal, 2);
    assert.equal(cache.statistiques().defauts, 2);
  });

  it('ne confond pas deux dossiers distincts', () => {
    const cache = creerCacheAnalyse();
    assert.equal(cache.analyser(dossier('A')).dossier.reference, 'A');
    assert.equal(cache.analyser(dossier('B')).dossier.reference, 'B');
  });

  it('reste borné et évince les entrées les plus anciennes', () => {
    const cache = creerCacheAnalyse(2);
    cache.analyser(dossier('A'));
    cache.analyser(dossier('B'));
    cache.analyser(dossier('C'));

    assert.equal(cache.statistiques().entrees, 2, 'la capacité doit être respectée');
    // « A » a été évincé : le redemander est un défaut de cache, pas un succès.
    const avant = cache.statistiques().defauts;
    cache.analyser(dossier('A'));
    assert.equal(cache.statistiques().defauts, avant + 1);
  });

  it('sert un rapport figé : l’heure est celle de la première production', () => {
    const cache = creerCacheAnalyse();
    const d = dossier();
    assert.equal(cache.analyser(d).genereLe, cache.analyser(d).genereLe);
  });
});

describe('conservation locale', () => {
  it("n'écrit rien tant que la conservation n'est pas activée", () => {
    const support = supportMemoire();
    assert.equal(conserver([dossier()], '2026-08-18T10:00:00Z', support), false);
    assert.equal(support.contenu.size, 0, 'aucune clé ne doit être écrite');
    assert.deepEqual(relire(support), []);
  });

  it('écrit et relit le plan de travail une fois activée', () => {
    const support = supportMemoire();
    definirConservation(true, support);

    assert.equal(conserver([dossier('X-1')], '2026-08-18T10:00:00Z', support), true);
    const relu = relire(support);
    assert.equal(relu.length, 1);
    assert.equal(relu[0].reference, 'X-1');

    const etat = etatConservation(support);
    assert.equal(etat.active, true);
    assert.equal(etat.dossiersConserves, 1);
    assert.equal(etat.ecritLe, '2026-08-18T10:00:00Z');
    assert.ok(etat.octets > 0);
  });

  it('purge réellement quand on coupe la conservation', () => {
    const support = supportMemoire();
    definirConservation(true, support);
    conserver([dossier()], '2026-08-18T10:00:00Z', support);

    const etat = definirConservation(false, support);
    assert.equal(etat.active, false);
    assert.equal(etat.dossiersConserves, 0);
    assert.equal(etat.octets, 0, 'couper la conservation doit effacer, pas seulement cesser d’écrire');
    assert.deepEqual(relire(support), []);
  });

  it('ignore un contenu corrompu au lieu de le passer au moteur', () => {
    const support = supportMemoire();
    definirConservation(true, support);
    support.setItem('ldi.atelier.dossiers', '{ ceci n’est pas du JSON');
    assert.deepEqual(relire(support), []);

    support.setItem('ldi.atelier.dossiers', JSON.stringify([{ reference: 'incomplet' }]));
    assert.deepEqual(relire(support), [], 'un dossier sans tableaux requis doit être écarté');
  });

  it('annonce les octets restants même quand le contenu est illisible', () => {
    const support = supportMemoire();
    definirConservation(true, support);
    support.setItem('ldi.atelier.dossiers', 'contenu illisible');
    const etat = etatConservation(support);
    assert.equal(etat.dossiersConserves, 0);
    assert.ok(etat.octets > 0, 'ce qui reste à purger doit rester visible');
  });

  it('se comporte comme désactivée là où aucun support n’existe', () => {
    const etat = etatConservation(null);
    assert.equal(etat.disponible, false);
    assert.equal(etat.active, false);
    assert.equal(conserver([dossier()], '2026-08-18T10:00:00Z', null), false);
    assert.deepEqual(relire(null), []);
    assert.doesNotThrow(() => purger(null));
  });
});
