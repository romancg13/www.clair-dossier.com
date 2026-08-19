/**
 * Client du relais de jurisprudence, et invariants structurels de la fonction
 * edge correspondante.
 *
 * La fonction est écrite pour Deno : elle n'est ni couverte par `tsc`, ni
 * exécutable par ce lanceur. C'est pourtant elle qui détient les identifiants
 * PISTE et la barrière d'authentification. Faute de pouvoir l'exécuter ici, on
 * verrouille ses invariants — une régression qui les supprimerait passerait
 * autrement la CI au vert.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { CORPUS } from '../corpus/references';
import {
  REFERENCES_MAX_CLIENT,
  REFERENCES_RECHERCHABLES,
  chercherDecisions,
  lireReponse,
} from '../jurisprudence';
import { REFERENCES_MAX } from '../piste';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const EDGE = join(RACINE, 'supabase', 'functions', 'ldi-jurisprudence');

const ARRET = {
  numero: '23-81.456',
  date: '2024-03-12',
  juridiction: 'Cour de cassation',
  chambre: 'chambre criminelle',
  sommaire: 'Le défaut de notification du droit au silence fait grief.',
  url: 'https://www.courdecassation.fr/decision/exemple',
};

/** Invocateur simulé : capture ce qui part, rend ce qu'on lui dit de rendre. */
function invocateur(reponse: unknown, erreur: { message?: string; context?: { status?: number } } | null = null) {
  const envois: { nom: string; body: unknown }[] = [];
  return {
    envois,
    invoquer: async (nom: string, options: { body: unknown }) => {
      envois.push({ nom, body: options.body });
      return { data: reponse, error: erreur };
    },
  };
}

describe('client de recherche — ce qui part du poste', () => {
  it('n’envoie que des références du corpus', async () => {
    const { invoquer, envois } = invocateur({ resultats: [] });

    await chercherDecisions(
      ['CPP, art. 63-1', 'garde à vue Dupont 14 mars stupéfiants', 'CPP, art. 78-2'],
      invoquer
    );

    // La phrase saisissable en clair a été écartée AVANT tout appel réseau.
    const envoyees = (envois[0].body as { references: string[] }).references;
    assert.deepEqual(envoyees, ['CPP, art. 63-1', 'CPP, art. 78-2']);
  });

  it('n’appelle rien du tout si aucune référence n’est recevable', async () => {
    const { invoquer, envois } = invocateur({ resultats: [] });
    const r = await chercherDecisions(['faits du 14 mars', 'M. Dupont'], invoquer);

    assert.equal(envois.length, 0, 'aucun appel ne doit partir');
    assert.equal(r.ok, false);
    assert.match(!r.ok ? r.message : '', /pas de recherche en texte libre/);
  });

  it('propose exactement les références du corpus', () => {
    assert.deepEqual([...REFERENCES_RECHERCHABLES], CORPUS.map((e) => e.reference));
  });

  it('garde la borne client alignée sur celle du relais', () => {
    // `piste.ts` porte les jetons PISTE : il est destiné au serveur et ne doit
    // pas entrer dans le bundle du navigateur. La borne est donc doublée côté
    // client, et ce test empêche les deux valeurs de diverger en silence.
    assert.equal(REFERENCES_MAX_CLIENT, REFERENCES_MAX);
  });

  it("ne fait pas entrer le relais PISTE dans le bundle du navigateur", () => {
    const composant = readFileSync(
      join(RACINE, 'src', 'components', 'ldi', 'VueRecherche.tsx'),
      'utf-8'
    );
    // Un import de valeur depuis `piste` créerait le chemin par lequel des
    // identifiants finiraient un jour branchés côté client.
    assert.ok(
      !/^import\s+(?!type\s)[^;]*from\s+'[^']*\/piste'/m.test(composant),
      'VueRecherche importe une valeur depuis piste.ts'
    );
  });
});

describe('client de recherche — lecture de la réponse', () => {
  it('restitue les décisions relayées', async () => {
    const { invoquer } = invocateur({
      resultats: [
        { reference: 'CPP, art. 63-1', decisions: [ARRET], interrogee: true, avertissement: '' },
      ],
      ecartees: [],
      origine: 'Judilibre, via PISTE — relayé sans modification',
      consulteLe: '2026-08-19',
      reserve: 'lire la décision intégrale',
    });

    const r = await chercherDecisions(['CPP, art. 63-1'], invoquer);
    assert.equal(r.ok, true);
    assert.equal(r.ok && r.resultats[0].decisions[0].numero, '23-81.456');
    assert.match(r.ok ? r.origine : '', /relayé sans modification/);
  });

  it('écarte une décision sans numéro ou sans date', () => {
    const r = lireReponse({
      resultats: [
        {
          reference: 'CPP, art. 63-1',
          interrogee: true,
          decisions: [ARRET, { numero: '', date: '2024-01-01' }, { numero: '24-80.111' }, null, 'x'],
        },
      ],
    });

    assert.equal(r.ok, true);
    assert.equal(r.ok && r.resultats[0].decisions.length, 1);
  });

  it('ne fabrique aucune décision à partir d’une réponse abîmée', () => {
    for (const abime of [null, undefined, 42, 'texte', { resultats: 'pas un tableau' }]) {
      const r = lireReponse(abime);
      if (r.ok) assert.deepEqual(r.resultats, [], `${JSON.stringify(abime)} a produit des résultats`);
    }
  });

  it('distingue « non configurée » de « en panne »', async () => {
    const nonConfiguree = invocateur(null, { context: { status: 503 } });
    const a = await chercherDecisions(['CPP, art. 63-1'], nonConfiguree.invoquer);
    assert.equal(a.ok, false);
    assert.equal(!a.ok && a.configuree, false);
    // Ne pas laisser croire à une absence de jurisprudence.
    assert.match(!a.ok ? a.message : '', /ne signifie pas l'absence de jurisprudence/);

    const enPanne = invocateur(null, { message: 'boum', context: { status: 500 } });
    const b = await chercherDecisions(['CPP, art. 63-1'], enPanne.invoquer);
    assert.equal(b.ok, false);
    assert.equal(!b.ok && b.configuree, true);
  });
});

describe('fonction edge ldi-jurisprudence — invariants structurels', () => {
  const source = readFileSync(join(EDGE, 'index.ts'), 'utf-8');

  it('refuse tout appel non authentifié avant de consommer le quota', () => {
    const barriere = source.indexOf('utilisateurAuthentifie(req)');
    const appel = source.indexOf('chercherJurisprudence(');
    assert.ok(barriere !== -1, 'la barrière doit être appelée');
    assert.ok(barriere < appel, "l'authentification doit précéder l'appel sortant");
    assert.match(source, /Authentification requise/);
  });

  it('intersecte les références avec le corpus détenu par le serveur', () => {
    // C'est la seule chose qui empêche un appelant authentifié d'envoyer du
    // contenu de dossier dans une requête sortante.
    assert.match(source, /REFERENCES_AUTORITE\.map\(\(r\) => r\.toLowerCase\(\)\)/);
    assert.match(source, /const retenues = proposees\.filter/);
    assert.ok(
      !/query:\s*corps\./.test(source) && !/chercherJurisprudence\(corps\./.test(source),
      'le corps de requête ne doit jamais alimenter directement la recherche'
    );
  });

  it('refuse plutôt que de chercher « au cas où »', () => {
    assert.match(source, /if \(retenues\.length === 0\)/);
    assert.match(source, /422/);
  });

  it('ne dégrade pas vers un résultat approximatif sans identifiants', () => {
    assert.match(source, /if \(!IDENTIFIANTS\)/);
    assert.match(source, /503/);
    assert.match(source, /aucune n'est produite à la place/);
  });

  it('annonce la provenance et la réserve de lecture', () => {
    assert.match(source, /origine: 'Judilibre, via PISTE — relayé sans modification'/);
    assert.match(source, /un sommaire ne fait pas la portée d'une décision/);
  });

  it('interroge les références en série, pas en parallèle', () => {
    // Huit requêtes simultanées sur un quota d'opérateur sont le meilleur
    // moyen de se faire limiter.
    assert.ok(!/Promise\.all/.test(source), 'les appels ne doivent pas être parallélisés');
    assert.match(source, /for \(const reference of retenues\)/);
  });

  it('ne renvoie jamais le secret ni le jeton au client', () => {
    assert.ok(!/LDI_PISTE_CLIENT_SECRET[\s\S]{0,200}json\(/.test(source));
    assert.ok(!/jeton/i.test(source.split('Deno.serve')[1] ?? ''));
  });
});

describe('autorité de la fonction de recherche', () => {
  it('correspond exactement au corpus courant', () => {
    const genere = readFileSync(join(EDGE, 'corpus-autorite.ts'), 'utf-8');

    for (const { reference } of CORPUS) {
      assert.ok(
        genere.includes(JSON.stringify(reference)),
        `${reference} absente — exécuter \`npm run ldi:gen-corpus-edge\``
      );
    }
    assert.equal((genere.match(/^\s{2}"/gm) ?? []).length, CORPUS.length);
  });

  it('reste identique au relais canonique', () => {
    // `piste.ts` existe en deux exemplaires : Deno ne peut pas importer depuis
    // `src/`. Une divergence serait invisible et changerait ce qui part sur le
    // réseau sans que rien ne le signale.
    assert.equal(
      readFileSync(join(EDGE, 'piste.ts'), 'utf-8'),
      readFileSync(join(RACINE, 'src', 'ldi', 'piste.ts'), 'utf-8'),
      'src/ldi/piste.ts et sa copie edge ont divergé — exécuter `npm run ldi:sync-edge`'
    );
  });
});
