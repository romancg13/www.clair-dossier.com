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
const PARTAGES = ['prompt.ts', 'citations.ts'];
const CANONIQUE = join(RACINE, 'src', 'ldi', 'prompt.ts');
const COPIE = join(EDGE, 'prompt.ts');

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

  it("n'autorise aucune citation par défaut", () => {
    // Sans ensemble transmis, `chaines()` retourne [] : rien n'est citable.
    assert.match(source, /referencesAutorisees = chaines/);
    assert.match(source, /pourvoisAutorises = chaines/);
  });
});
