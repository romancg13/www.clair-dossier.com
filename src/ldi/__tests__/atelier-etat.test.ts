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
  activerConservation,
  conserver,
  etatConservation,
  ouvrirConservation,
  purger,
  purgerHeritage,
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

const PHRASE = 'la clef du cabinet est longue';

describe('conservation locale — coffre chiffré', () => {
  it("n'écrit rien tant que la conservation n'est pas activée", async () => {
    const support = supportMemoire();
    assert.equal(support.contenu.size, 0, 'aucune clé ne doit être écrite');
    assert.equal((await ouvrirConservation(PHRASE, support)).ok, false);
  });

  it('scelle, puis rend le plan de travail à qui a la phrase', async () => {
    const support = supportMemoire();
    const { coffre } = await activerConservation(PHRASE, [], '2026-08-18T09:00:00Z', support);

    assert.equal(await conserver(coffre, [dossier('X-1')], '2026-08-18T10:00:00Z', support), true);

    const ouvert = await ouvrirConservation(PHRASE, support);
    assert.equal(ouvert.ok, true);
    assert.equal(ouvert.ok && ouvert.dossiers.length, 1);
    assert.equal(ouvert.ok && ouvert.dossiers[0].reference, 'X-1');

    const etat = etatConservation(support);
    assert.equal(etat.active, true);
    assert.equal(etat.ecritLe, '2026-08-18T10:00:00Z');
    assert.ok(etat.octets > 0);
  });

  it("n'écrit aucune donnée de dossier en clair sur le support", async () => {
    const support = supportMemoire();
    const { coffre } = await activerConservation(PHRASE, [], '2026-08-18T09:00:00Z', support);
    await conserver(coffre, [dossier('SECRET-914')], '2026-08-18T10:00:00Z', support);

    // Ce que lit un tiers qui copie le profil du navigateur.
    const surLeSupport = [...support.contenu.values()].join('\n');
    for (const fragment of ['SECRET-914', 'proces-verbal', 'debut-garde-a-vue', '313-1']) {
      assert.ok(!surLeSupport.includes(fragment), `« ${fragment} » lisible sur le support`);
    }
  });

  it('refuse la mauvaise phrase sans détruire le coffre', async () => {
    const support = supportMemoire();
    const { coffre } = await activerConservation(PHRASE, [], '2026-08-18T09:00:00Z', support);
    await conserver(coffre, [dossier('X-2')], '2026-08-18T10:00:00Z', support);

    const rate = await ouvrirConservation('une autre phrase bien assez longue', support);
    assert.equal(rate.ok, false);

    // Un essai manqué ne doit rien coûter : le coffre reste ouvrable.
    const reussi = await ouvrirConservation(PHRASE, support);
    assert.equal(reussi.ok, true);
    assert.equal(reussi.ok && reussi.dossiers[0].reference, 'X-2');
  });

  it('purge sans exiger la phrase', async () => {
    const support = supportMemoire();
    const { coffre } = await activerConservation(PHRASE, [], '2026-08-18T09:00:00Z', support);
    await conserver(coffre, [dossier()], '2026-08-18T10:00:00Z', support);

    purger(support);

    const etat = etatConservation(support);
    assert.equal(etat.active, false);
    assert.equal(etat.octets, 0, 'purger doit effacer, pas seulement cesser d’écrire');
    // Une phrase oubliée ne doit jamais rendre les données indélébiles.
    assert.equal((await ouvrirConservation(PHRASE, support)).ok, false);
  });

  it('ignore un coffre corrompu au lieu de le passer au moteur', async () => {
    const support = supportMemoire();
    support.setItem('ldi.atelier.coffre', '{ ceci n’est pas du JSON');

    assert.equal(etatConservation(support).active, false);
    assert.equal((await ouvrirConservation(PHRASE, support)).ok, false);
    // Ce qui reste à purger doit rester visible.
    assert.ok(etatConservation(support).octets > 0);
  });

  it('signale un héritage en clair plutôt que de l’effacer en silence', async () => {
    const support = supportMemoire();
    support.setItem('ldi.atelier.dossiers', JSON.stringify([dossier('ANCIEN-1')]));
    support.setItem('ldi.atelier.conservation', 'oui');

    assert.equal(etatConservation(support).heritageEnClair, true);

    purgerHeritage(support);
    assert.equal(etatConservation(support).heritageEnClair, false);
    assert.equal(support.contenu.size, 0);
  });

  it('se comporte comme indisponible là où aucun support n’existe', async () => {
    const etat = etatConservation(null);
    assert.equal(etat.disponible, false);
    assert.equal(etat.active, false);
    assert.equal((await ouvrirConservation(PHRASE, null)).ok, false);
    assert.doesNotThrow(() => purger(null));
    assert.doesNotThrow(() => purgerHeritage(null));
  });
});

describe('contenu de coffre v2 — plan de travail entier', () => {
  const bibliotheque = {
    trames: [{ id: 't-1', intitule: 'Conclusions type', type: 'conclusions', corps: '[[CORPS]]', ajouteeLe: '2026-08-01T00:00:00Z' }],
    consignes: [],
  };
  const demande = {
    id: 'dm-1',
    dossierReference: 'X-1',
    enonce: 'vérifier la notification des droits',
    date: '2026-08-18T09:00:00Z',
    etat: 'a-verifier' as const,
    passesDeclenchees: ['P2'],
    sortieProduite: null,
    resteAFaire: [],
    verifieeLe: null,
  };

  it('scelle et restitue dossiers, bibliothèque et demandes ensemble', async () => {
    const support = supportMemoire();
    const { coffre } = await activerConservation(PHRASE, { dossiers: [], bibliotheque, demandes: [demande] }, '2026-08-18T09:00:00Z', support);
    await conserver(coffre, { dossiers: [dossier('X-1')], bibliotheque, demandes: [demande] }, '2026-08-18T10:00:00Z', support);

    const ouvert = await ouvrirConservation(PHRASE, support);
    assert.equal(ouvert.ok, true);
    if (!ouvert.ok) return;
    assert.equal(ouvert.contenu.dossiers[0].reference, 'X-1');
    assert.equal(ouvert.contenu.bibliotheque.trames[0].intitule, 'Conclusions type');
    assert.equal(ouvert.contenu.demandes[0].id, 'dm-1');
    // L'ancien champ reste servi : personne ne casse en lisant `dossiers`.
    assert.equal(ouvert.dossiers[0].reference, 'X-1');
  });

  it('lit un coffre v1 (tableau nu) : dossiers rendus, bibliothèque vide', async () => {
    const support = supportMemoire();
    // Reconstitution d'un coffre v1 : sceller directement un tableau, comme
    // l'ancienne version le faisait.
    const { creerCoffre, sceller } = await import('../coffre');
    const coffre = await creerCoffre(PHRASE);
    const enveloppe = await sceller(coffre, JSON.stringify([dossier('ANCIEN-7')]), '2026-01-01T00:00:00Z');
    support.setItem('ldi.atelier.coffre', JSON.stringify(enveloppe));

    const ouvert = await ouvrirConservation(PHRASE, support);
    assert.equal(ouvert.ok, true);
    if (!ouvert.ok) return;
    assert.equal(ouvert.contenu.dossiers[0].reference, 'ANCIEN-7');
    assert.deepEqual(ouvert.contenu.bibliotheque, { trames: [], consignes: [] });
    assert.deepEqual(ouvert.contenu.demandes, []);
  });

  it('une partie illisible ne fait pas perdre les autres', async () => {
    const support = supportMemoire();
    const { creerCoffre, sceller } = await import('../coffre');
    const coffre = await creerCoffre(PHRASE);
    const corrompu = { version: 2, dossiers: [dossier('X-9')], bibliotheque: 'pas-un-objet', demandes: [{ sans: 'forme' }] };
    const enveloppe = await sceller(coffre, JSON.stringify(corrompu), '2026-01-01T00:00:00Z');
    support.setItem('ldi.atelier.coffre', JSON.stringify(enveloppe));

    const ouvert = await ouvrirConservation(PHRASE, support);
    assert.equal(ouvert.ok, true);
    if (!ouvert.ok) return;
    assert.equal(ouvert.contenu.dossiers[0].reference, 'X-9');
    assert.deepEqual(ouvert.contenu.bibliotheque, { trames: [], consignes: [] });
    assert.deepEqual(ouvert.contenu.demandes, []);
  });

  it('aucune trame ni consigne en clair sur le support', async () => {
    const support = supportMemoire();
    await activerConservation(PHRASE, { dossiers: [], bibliotheque, demandes: [demande] }, '2026-08-18T09:00:00Z', support);
    const surLeSupport = [...support.contenu.values()].join('\n');
    for (const fragment of ['Conclusions type', 'notification des droits', 'dm-1']) {
      assert.ok(!surLeSupport.includes(fragment), `« ${fragment} » lisible sur le support`);
    }
  });
});
