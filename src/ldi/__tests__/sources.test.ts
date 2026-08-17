/**
 * Ces tests portent sur la garantie centrale du système : le module de
 * recherche ne peut produire aucune référence qu'il n'a pas reçue d'une source
 * officielle. Ils sont écrits comme des tests de non-régression sur une
 * exigence de sécurité, pas comme des tests de fonctionnalité.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { alertesResiduelles, minimiser, restaurer } from '../confidentialite';
import { CORPUS, trouverReference } from '../corpus/references';
import { rechercher, rechercherJurisprudence, verifierTexte, versDecision } from '../modules/recherche';

function fauxFetch(charge: unknown, ok = true): typeof fetch {
  return (async () =>
    new Response(JSON.stringify(charge), {
      status: ok ? 200 : 500,
      headers: { 'Content-Type': 'application/json' },
    })) as unknown as typeof fetch;
}

const CONFIG_JUDILIBRE = {
  urlBase: 'https://exemple.test/judilibre/',
  enteteAuth: 'KeyId',
  valeurAuth: 'cle-de-test',
};

describe('rechercherJurisprudence — garantie anti-fabrication', () => {
  it('ne retourne aucune décision sans source configurée', async () => {
    assert.deepEqual(await rechercherJurisprudence('CPP, art. 63'), []);
  });

  it('ne retourne aucune décision lorsque la source est injoignable', async () => {
    const decisions = await rechercherJurisprudence('CPP, art. 63', {
      judilibre: CONFIG_JUDILIBRE,
      fetchImpl: (async () => {
        throw new Error('réseau indisponible');
      }) as unknown as typeof fetch,
    });
    assert.deepEqual(decisions, []);
  });

  it('ne retourne aucune décision lorsque la source répond en erreur', async () => {
    const decisions = await rechercherJurisprudence('CPP, art. 63', {
      judilibre: CONFIG_JUDILIBRE,
      fetchImpl: fauxFetch({ results: [{ number: '22-80.000', decision_date: '2023-01-25' }] }, false),
    });
    assert.deepEqual(decisions, []);
  });

  it('écarte les entrées auxquelles il manque un élément d’identification', async () => {
    const decisions = await rechercherJurisprudence('CPP, art. 63', {
      judilibre: CONFIG_JUDILIBRE,
      fetchImpl: fauxFetch({
        results: [
          { solution: 'Cassation partielle' }, // ni numéro ni date
          { number: '21-80.642' }, // sans date
          { decision_date: '2021-09-07' }, // sans numéro
        ],
      }),
    });
    assert.deepEqual(decisions, []);
  });

  it('restitue une décision complète en la marquant vérifiée et sourcée', async () => {
    const decisions = await rechercherJurisprudence('CPP, art. 171', {
      judilibre: CONFIG_JUDILIBRE,
      fetchImpl: fauxFetch({
        results: [
          {
            number: '21-80.642',
            decision_date: '2021-09-07',
            jurisdiction: 'Cour de cassation, chambre criminelle',
            solution: 'Rejet',
          },
        ],
      }),
    });

    assert.equal(decisions.length, 1);
    assert.equal(decisions[0].numero, '21-80.642');
    assert.equal(decisions[0].statut, 'verifie');
    assert.equal(decisions[0].source?.editeur, 'Judilibre');
  });

  it('tronque une solution trop longue au lieu de la reformuler', () => {
    const decision = versDecision(
      { number: '21-80.642', decision_date: '2021-09-07', solution: 'x'.repeat(600) },
      { editeur: 'Judilibre', url: 'https://exemple.test', consulteLe: '2026-08-17' }
    );
    assert.ok((decision?.solution.length ?? 0) <= 400);
    assert.ok(decision?.solution.endsWith('…'));
  });
});

describe('rechercher', () => {
  it('avertit explicitement quand aucune source n’est configurée', async () => {
    const resultat = await rechercher('CPP, art. 63');
    assert.deepEqual(resultat.decisions, []);
    assert.match(resultat.avertissement ?? '', /Aucune source officielle/);
  });
});

describe('verifierTexte', () => {
  it('laisse une référence de l’index au statut « à vérifier » sans accès à Légifrance', async () => {
    const enonce = await verifierTexte('CPP, art. 63');
    assert.equal(enonce.statut, 'a-verifier');
    assert.ok(enonce.source?.url.includes('legifrance'));
  });

  it('ne fabrique aucun énoncé pour une référence inconnue', async () => {
    const enonce = await verifierTexte('CPP, art. 999-99');
    assert.equal(enonce.statut, 'non-verifiable');
    assert.match(enonce.enonce, /absente de l'index/);
  });
});

describe('corpus', () => {
  it('ne contient aucune entrée marquée « vérifiée » à froid', () => {
    assert.ok(CORPUS.every((e) => e.statut === 'a-verifier'));
  });

  it('associe une URL officielle à chaque entrée', () => {
    for (const entree of CORPUS) {
      assert.ok(entree.source?.url.startsWith('https://'), `${entree.reference} sans URL`);
    }
  });

  it('retrouve une entrée sans tenir compte de la casse', () => {
    assert.equal(trouverReference('cpp, art. 63')?.reference, 'CPP, art. 63');
    assert.equal(trouverReference('inconnu'), undefined);
  });
});

describe('minimisation', () => {
  it('masque les identifiants directs et permet de les rétablir', () => {
    const source =
      'Contacter Jean Dupont au 06 12 34 56 78 ou à jean.dupont@exemple.fr — véhicule AB-123-CD.';
    const { texte, correspondances } = minimiser(source, ['Jean Dupont']);

    assert.ok(!texte.includes('Jean Dupont'));
    assert.ok(!texte.includes('06 12 34 56 78'));
    assert.ok(!texte.includes('jean.dupont@exemple.fr'));
    assert.ok(!texte.includes('AB-123-CD'));
    assert.equal(restaurer(texte, correspondances), source);
  });

  it('attribue un pseudonyme stable à une même valeur répétée', () => {
    const { texte } = minimiser('Écrire à a@b.fr puis relancer a@b.fr.');
    assert.equal(texte.match(/\[EMAIL_1\]/g)?.length, 2);
    assert.ok(!texte.includes('EMAIL_2'));
  });

  it('signale le risque résiduel plutôt que de laisser croire à une anonymisation', () => {
    const alertes = alertesResiduelles('Domicilié 12 rue des Lilas, né le 4 mars 1988, vu avec Marc Petit.');
    assert.ok(alertes.some((a) => a.includes('adresse')));
    assert.ok(alertes.some((a) => a.includes('naissance')));
    assert.ok(alertes.some((a) => a.includes('capitalisés')));
  });
});
