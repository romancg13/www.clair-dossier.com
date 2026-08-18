/**
 * L'invite système existe en deux exemplaires : la source canonique
 * (`src/ldi/prompt.ts`) et la copie que la fonction Deno importe
 * (`supabase/functions/ldi-analyze/prompt.ts`). La duplication est imposée par
 * l'environnement d'exécution — Deno ne peut pas importer un module TypeScript
 * sans extension depuis `src/`.
 *
 * Une divergence entre les deux serait invisible : le navigateur appliquerait
 * une invite, le serveur une autre. Ce test l'interdit.
 *
 * Pour resynchroniser : `npm run ldi:sync-prompt`.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const ici = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ici, '..', '..', '..');

const EDGE = join(RACINE, 'supabase', 'functions', 'ldi-analyze');
const PARTAGES = ['prompt.ts', 'citations.ts', 'reponse.ts', 'confidentialite.ts', 'tracabilite.ts'];
const CANONIQUE = join(RACINE, 'src', 'ldi', 'prompt.ts');

describe('fichiers partagés avec la fonction edge', () => {
  it('restent identiques entre la source et la copie', () => {
    for (const fichier of PARTAGES) {
      assert.equal(
        readFileSync(join(EDGE, fichier), 'utf-8'),
        readFileSync(join(RACINE, 'src', 'ldi', fichier), 'utf-8'),
        `src/ldi/${fichier} et supabase/functions/ldi-analyze/${fichier} ont divergé — exécuter \`npm run ldi:sync-edge\`.`
      );
    }
  });

  it('porte les corrections apportées au cahier des charges', () => {
    const source = readFileSync(CANONIQUE, 'utf-8');

    // Les deux erreurs du cahier des charges initial ne doivent pas revenir.
    assert.ok(!/72\s*h(?:eures)?\s*max/i.test(source));
    assert.match(source, /Il n'existe pas\s*\n?de plafond général de 72 heures/);

    // Les garde-fous non négociables.
    assert.match(source, /INTERDICTION DE PRODUIRE DE LA JURISPRUDENCE/);
    assert.match(source, /PAS DE PRONOSTIC CHIFFRÉ/);
  });
});

/**
 * La fonction edge est écrite pour Deno : elle n'est ni couverte par `tsc`
 * (tsconfig n'inclut que `src`), ni exécutable par ce lanceur de tests. C'est
 * pourtant le seul composant qui détient la clé d'API et la barrière
 * d'authentification. Faute de pouvoir l'exécuter ici, on verrouille au moins
 * ses invariants structurels : une régression qui les supprimerait passerait
 * autrement la CI au vert.
 */
/**
 * L'autorité de citation du serveur est DÉRIVÉE du corpus. Une divergence
 * serait silencieuse et coûteuse dans les deux sens : un article légitime
 * cesserait d'être citable sans explication, ou un article retiré du corpus
 * resterait autorisé côté serveur.
 */
describe('autorité de citation de la fonction edge', () => {
  it('correspond exactement au corpus courant', async () => {
    const { CORPUS } = await import('../corpus/references');
    const genere = readFileSync(join(EDGE, 'corpus-autorite.ts'), 'utf-8');

    const attendues = CORPUS.map((e) => e.reference).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    for (const reference of attendues) {
      assert.ok(
        genere.includes(JSON.stringify(reference)),
        `${reference} absente de l'autorité — exécuter \`npm run ldi:gen-corpus-edge\``
      );
    }

    const comptees = (genere.match(/^\s{2}"/gm) ?? []).length;
    assert.equal(comptees, attendues.length, "l'autorité contient des entrées hors corpus");
  });

  it("n'autorise aucun numéro de pourvoi", () => {
    // Le serveur n'interroge aucune source de jurisprudence : il ne peut donc
    // en autoriser aucune, et l'autorité ne doit pas en contenir par accident.
    const genere = readFileSync(join(EDGE, 'corpus-autorite.ts'), 'utf-8');
    const lignes = genere.split('\n').filter((l) => /^\s{2}"/.test(l));
    for (const ligne of lignes) {
      assert.ok(
        !/\b\d{2}-\d{2}\.\d{3}\b|\b\d{2}-\d{5}\b/.test(ligne),
        `numéro de pourvoi dans l'autorité : ${ligne.trim()}`
      );
    }
  });
});

describe('fonction edge — invariants structurels', () => {
  const source = readFileSync(join(EDGE, 'index.ts'), 'utf-8');

  it("refuse l'appel avant toute dépense si l'utilisateur n'est pas authentifié", () => {
    const barriere = source.indexOf('utilisateurAuthentifie(req)');
    const appel = source.indexOf('messages.create');
    assert.ok(barriere !== -1, 'la barrière doit être appelée');
    assert.ok(barriere < appel, "l'authentification doit précéder l'appel facturé");
    assert.match(source, /Authentification requise/);
  });

  it('vérifie les citations avant de renvoyer la sortie du modèle', () => {
    const verif = source.indexOf('verifierCitations');
    const retour = source.indexOf('analyse: verification.texte');
    assert.ok(verif !== -1, 'le vérificateur doit être appelé');
    assert.ok(verif < retour, 'la vérification doit précéder le renvoi');
  });

  it("ne relaie jamais la charge d'erreur amont au client", () => {
    assert.ok(
      !/detail:\s*reponse\.stop_details/.test(source),
      'stop_details peut contenir des fragments de la requête'
    );
    assert.ok(!/error:\s*e\.message/.test(source), "le message amont ne doit pas être renvoyé");
  });

  it("ne prend jamais l'appelant pour autorité de citation (P1-12)", () => {
    // L'ensemble proposé passe par une intersection avec l'autorité serveur :
    // l'appelant restreint, il n'élargit pas.
    assert.match(source, /intersecter\(proposees, new Set\(REFERENCES_AUTORITE\)\)/);
    // Les listes du corps ne doivent plus alimenter directement le vérificateur.
    assert.ok(
      !/pourvoisAutorises = chaines\(corps/.test(source),
      'les pourvois ne peuvent pas venir du corps de requête'
    );
    assert.match(source, /const pourvoisAutorises: string\[\] = \[\]/);
  });

  it("annonce la provenance de l'ensemble citable dans la réponse", () => {
    // « conforme » ne doit jamais se lire comme « vérifié auprès d'une source ».
    assert.match(source, /origine: 'corpus détenu par le serveur'/);
    assert.match(source, /referencesEcartees/);
  });

  it('borne le nombre de tentatives par la constante partagée', () => {
    // Une boucle bornée par un littéral se désynchroniserait de TENTATIVES_MAX
    // sans que rien ne le signale : la relance corrective doit lire la source.
    assert.match(source, /tentative <= TENTATIVES_MAX/);
    assert.ok(!/tentative <= \d/.test(source), 'la borne ne doit pas être un littéral');
  });

  it('renvoie le résultat du contrôle de structure au lieu de le taire', () => {
    const controle = source.indexOf('validerStructure(texte)');
    const retour = source.indexOf('conforme: structure.conforme');
    assert.ok(controle !== -1, 'la structure doit être contrôlée');
    assert.ok(retour !== -1, 'le résultat doit figurer dans la réponse');
    assert.ok(controle < retour);
  });

  it('refuse un rapport portant des identifiants directs, avant tout appel', () => {
    const controle = source.indexOf('identifiantsDirectsResiduels(rapport)');
    const appel = source.indexOf('messages.create');
    assert.ok(controle !== -1, 'la minimisation doit être contrôlée côté serveur');
    assert.ok(controle < appel, "le contrôle doit précéder l'envoi au fournisseur");
    // Refus, pas nettoyage : masquer à la volée ferait croire à une
    // minimisation qui n'a pas eu lieu.
    assert.match(source, /l'appel est refusé/);
  });

  it('contrôle le plafond de dépense avant tout appel facturé', () => {
    const controle = source.indexOf('controlerAvantAppel(coutEngage, PLAFOND)');
    const appel = source.indexOf('messages.create');
    assert.ok(controle !== -1, 'le plafond doit être contrôlé');
    assert.ok(controle < appel, "le contrôle du plafond doit précéder l'appel facturé");
    assert.match(source, /if \(!plafond\.autorise\)/);
  });

  it('renvoie les blocs du modèle tels quels lors de la relance', () => {
    // Ne remonter que le texte retirerait les blocs de réflexion, que l'API
    // exige inchangés : la relance échouerait là où elle doit protéger.
    assert.match(source, /content: reponse\.content/);
  });

  it('refuse un cumul de dépense non numérique au lieu de le convertir', () => {
    // `Number(null)`, `Number('')` et `Number([])` valent 0 : une conversion
    // seule laisserait passer un compteur corrompu.
    assert.ok(
      !/Number\(corps\.coutEngage\)/.test(source),
      'le cumul doit être contrôlé par son type, pas converti'
    );
    assert.match(source, /typeof corps\.coutEngage === 'number'/);
  });

  it("additionne l'usage de toutes les tentatives", () => {
    // Une relance est un second appel facturé. Un « = » à la place d'un « += »
    // ferait disparaître le coût de la première tentative.
    for (const champ of ['entree', 'sortie', 'cacheLu', 'cacheEcrit']) {
      assert.match(source, new RegExp(`jetons\\.${champ} \\+=`), `jetons.${champ} doit être cumulé`);
    }
  });
});
