/**
 * Relais PISTE — tests contre un service simulé.
 *
 * ┌─ CE QUE CES TESTS PROUVENT, ET CE QU'ILS NE PROUVENT PAS ───────────────┐
 * │ Ils prouvent que le relais résiste à ce qu'une source peut lui renvoyer  │
 * │ de mal formé, et qu'il ne complète JAMAIS une référence incomplète.      │
 * │                                                                          │
 * │ Ils ne prouvent pas que la forme des requêtes correspond à ce que PISTE  │
 * │ attend : ce dépôt ne détient aucun identifiant. Voir                     │
 * │ docs/RECHERCHE-JURIDIQUE.md pour la liste de ce qui reste à confirmer.   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

import {
  DECISIONS_MAX,
  chercherJurisprudence,
  obtenirJeton,
  oublierJetons,
  versDecisionRelayee,
  type IdentifiantsPiste,
} from '../piste';

const IDENTIFIANTS: IdentifiantsPiste = {
  clientId: 'cabinet-test',
  clientSecret: 'secret-de-test',
  urlOauth: 'https://oauth.exemple/api/oauth/token',
  urlJudilibre: 'https://api.exemple/cassation/judilibre/v1.0',
};

type Appel = { url: string; init: RequestInit };

/** Service simulé : renvoie un jeton, puis la charge fournie. */
function service(
  charge: unknown,
  options: { statutRecherche?: number; statutJeton?: number; expiresIn?: number } = {}
): { fetchImpl: typeof fetch; appels: Appel[] } {
  const appels: Appel[] = [];

  const fetchImpl = (async (entree: string | URL | Request, init: RequestInit = {}) => {
    const url = String(entree);
    appels.push({ url, init });

    if (url.includes('/oauth/')) {
      return new Response(
        JSON.stringify({ access_token: 'jeton-simulé', expires_in: options.expiresIn ?? 3600 }),
        { status: options.statutJeton ?? 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(JSON.stringify(charge), {
      status: options.statutRecherche ?? 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }) as unknown as typeof fetch;

  return { fetchImpl, appels };
}

const ARRET = {
  number: '23-81.456',
  decision_date: '2024-03-12',
  jurisdiction: 'Cour de cassation',
  chamber: 'chambre criminelle',
  summary: 'Le défaut de notification du droit au silence fait grief.',
  url: 'https://www.courdecassation.fr/decision/exemple',
};

beforeEach(() => oublierJetons());

describe('relais PISTE — jeton', () => {
  it('obtient un jeton et ne le renvoie pas dans les résultats', async () => {
    const { fetchImpl } = service({ results: [ARRET] });
    const resultat = await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });

    assert.ok(!JSON.stringify(resultat).includes('jeton-simulé'), 'le jeton ne doit pas fuiter');
  });

  it('réutilise le jeton au lieu de le redemander à chaque recherche', async () => {
    const { fetchImpl, appels } = service({ results: [ARRET] });

    await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });
    await chercherJurisprudence('CPP, art. 63-3', IDENTIFIANTS, { fetchImpl });
    await chercherJurisprudence('CPP, art. 78-2', IDENTIFIANTS, { fetchImpl });

    assert.equal(appels.filter((a) => a.url.includes('/oauth/')).length, 1);
    assert.equal(appels.filter((a) => a.url.includes('/search')).length, 3);
  });

  it('renouvelle le jeton avant son expiration, pas après', async () => {
    const { fetchImpl, appels } = service({ results: [ARRET] }, { expiresIn: 120 });
    let horloge = 0;
    const maintenant = () => horloge;

    await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl, maintenant });
    // 70 s plus tard : il reste 50 s de validité, moins que la marge de 60 s.
    horloge = 70_000;
    await chercherJurisprudence('CPP, art. 63-3', IDENTIFIANTS, { fetchImpl, maintenant });

    assert.equal(appels.filter((a) => a.url.includes('/oauth/')).length, 2);
  });

  it('rend null plutôt qu’un jeton vide quand l’échange échoue', async () => {
    const { fetchImpl } = service({}, { statutJeton: 401 });
    assert.equal(await obtenirJeton(IDENTIFIANTS, { fetchImpl }), null);
  });

  it('n’envoie aucune requête de recherche sans jeton', async () => {
    const { fetchImpl, appels } = service({ results: [ARRET] }, { statutJeton: 500 });
    const resultat = await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });

    assert.equal(resultat.interrogee, false);
    assert.equal(appels.filter((a) => a.url.includes('/search')).length, 0);
    assert.match(resultat.avertissement, /identifiants de l'opérateur/);
  });

  it('ne place pas le secret client dans l’URL', async () => {
    const { fetchImpl, appels } = service({ results: [] });
    await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });

    for (const appel of appels) {
      assert.ok(!appel.url.includes('secret-de-test'), `secret dans l'URL : ${appel.url}`);
    }
  });
});

describe('relais PISTE — lecture des réponses', () => {
  it('restitue une décision complète sans rien y ajouter', async () => {
    const { fetchImpl } = service({ results: [ARRET] });
    const { decisions, interrogee } = await chercherJurisprudence(
      'CPP, art. 63-1',
      IDENTIFIANTS,
      { fetchImpl }
    );

    assert.equal(interrogee, true);
    assert.deepEqual(decisions, [
      {
        numero: '23-81.456',
        date: '2024-03-12',
        juridiction: 'Cour de cassation',
        chambre: 'chambre criminelle',
        sommaire: 'Le défaut de notification du droit au silence fait grief.',
        url: 'https://www.courdecassation.fr/decision/exemple',
      },
    ]);
  });

  it('écarte une entrée sans numéro ou sans date', () => {
    assert.equal(versDecisionRelayee({ decision_date: '2024-03-12' }), null);
    assert.equal(versDecisionRelayee({ number: '23-81.456' }), null);
    assert.equal(versDecisionRelayee({}), null);
    assert.equal(versDecisionRelayee(null), null);
    assert.equal(versDecisionRelayee('23-81.456'), null);
  });

  it('n’invente pas la juridiction absente d’une réponse', () => {
    const d = versDecisionRelayee({ number: '23-81.456', decision_date: '2024-03-12' });

    // Un défaut « Cour de cassation, chambre criminelle » présenterait un arrêt
    // de cour d'appel comme un arrêt de la chambre criminelle.
    assert.match(d?.juridiction ?? '', /non restituée par la source/);
    assert.equal(d?.chambre, '');
  });

  it('signale combien d’entrées ont été écartées', async () => {
    const { fetchImpl } = service({
      results: [ARRET, { number: 'sans date' }, { decision_date: '2024-01-01' }],
    });
    const resultat = await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });

    assert.equal(resultat.decisions.length, 1);
    assert.match(resultat.avertissement, /2 entrée\(s\) écartée\(s\)/);
  });

  it('distingue « injoignable » de « aucun résultat »', async () => {
    const vide = service({ results: [] });
    const rienTrouve = await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, {
      fetchImpl: vide.fetchImpl,
    });
    assert.equal(rienTrouve.interrogee, true);
    assert.match(rienTrouve.avertissement, /a répondu sans aucune décision/);

    const casse = service({}, { statutRecherche: 503 });
    const injoignable = await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, {
      fetchImpl: casse.fetchImpl,
    });
    assert.equal(injoignable.interrogee, false);
    assert.match(injoignable.avertissement, /n'a pas pu être interrogée/);
  });

  it('accepte les quatre formes d’enveloppe de liste', async () => {
    for (const cle of ['results', 'resultats', 'items', 'data']) {
      const { fetchImpl } = service({ [cle]: [ARRET] });
      const r = await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });
      assert.equal(r.decisions.length, 1, `enveloppe « ${cle} » non reconnue`);
      oublierJetons();
    }

    const { fetchImpl } = service([ARRET]);
    assert.equal(
      (await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl })).decisions.length,
      1
    );
  });

  it('borne le nombre de décisions restituées', async () => {
    const beaucoup = Array.from({ length: 50 }, (_, i) => ({
      ...ARRET,
      number: `23-81.${String(400 + i)}`,
    }));
    const { fetchImpl } = service({ results: beaucoup });
    const r = await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });

    assert.equal(r.decisions.length, DECISIONS_MAX);
  });

  it('tronque un sommaire démesuré au lieu de le renvoyer entier', () => {
    const d = versDecisionRelayee({ ...ARRET, summary: 'x'.repeat(5000) });
    assert.ok((d?.sommaire.length ?? 0) <= 600);
    assert.match(d?.sommaire ?? '', /…$/);
  });

  it('refuse une réponse illisible sans la confondre avec un résultat vide', async () => {
    const fetchImpl = (async (entree: string | URL | Request) => {
      const url = String(entree);
      if (url.includes('/oauth/')) {
        return new Response(JSON.stringify({ access_token: 'j', expires_in: 3600 }), {
          status: 200,
        });
      }
      return new Response('<html>maintenance</html>', { status: 200 });
    }) as unknown as typeof fetch;

    const r = await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });
    assert.equal(r.interrogee, false);
    assert.match(r.avertissement, /pas exploitable/);
  });

  it('refuse une réponse démesurée annoncée par son en-tête', async () => {
    const fetchImpl = (async (entree: string | URL | Request) => {
      const url = String(entree);
      if (url.includes('/oauth/')) {
        return new Response(JSON.stringify({ access_token: 'j', expires_in: 3600 }), {
          status: 200,
        });
      }
      return new Response(JSON.stringify({ results: [ARRET] }), {
        status: 200,
        headers: { 'content-length': String(50_000_000) },
      });
    }) as unknown as typeof fetch;

    const r = await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });
    assert.equal(r.decisions.length, 0);
    assert.equal(r.interrogee, false);
  });
});

describe('relais PISTE — forme de la requête', () => {
  it('cherche sur la référence passée, et rien d’autre', async () => {
    const { fetchImpl, appels } = service({ results: [] });
    await chercherJurisprudence('CPP, art. 63-4-2', IDENTIFIANTS, { fetchImpl });

    const recherche = new URL(appels.find((a) => a.url.includes('/search'))!.url);
    assert.equal(recherche.searchParams.get('query'), 'CPP, art. 63-4-2');
    // Aucun autre paramètre porteur de contenu : rien du dossier ne peut
    // partir dans une requête de recherche.
    assert.deepEqual(
      [...recherche.searchParams.keys()].sort(),
      ['field', 'page_size', 'query', 'resolve_references']
    );
  });

  it('ajoute la barre finale manquante au lieu d’écraser le dernier segment', async () => {
    const { fetchImpl, appels } = service({ results: [] });
    await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });

    const recherche = appels.find((a) => a.url.includes('search'))!.url;
    assert.match(recherche, /judilibre\/v1\.0\/search/);
  });

  it('porte le jeton en en-tête, jamais en paramètre', async () => {
    const { fetchImpl, appels } = service({ results: [] });
    await chercherJurisprudence('CPP, art. 63-1', IDENTIFIANTS, { fetchImpl });

    const recherche = appels.find((a) => a.url.includes('/search'))!;
    const entetes = recherche.init.headers as Record<string, string>;
    assert.equal(entetes.Authorization, 'Bearer jeton-simulé');
    assert.ok(!recherche.url.includes('jeton-simulé'));
  });
});
