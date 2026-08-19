/**
 * Frontières du produit — ce que le bundle navigateur n'a PAS le droit de
 * contenir, et ce que l'invite système doit continuer de dire.
 *
 * L'atelier fonctionne fichier ouvert en local : il ne détient ni secret, ni
 * code d'appel d'API (B8), et n'émet aucune requête sortante de lui-même (B7).
 * Tout ce qui touche au réseau vit dans la CLI. Ces tests balaient les
 * sources de l'interface : une régression qui réintroduirait un appel réseau
 * dans le navigateur passerait autrement la CI au vert.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const ici = dirname(fileURLToPath(import.meta.url));
const RACINE = join(ici, '..', '..', '..');
const CANONIQUE = join(RACINE, 'src', 'ldi', 'prompt.ts');

/** Tous les fichiers .ts/.tsx sous un répertoire, récursivement. */
function sources(repertoire: string): string[] {
  const resultat: string[] = [];
  for (const entree of readdirSync(repertoire, { withFileTypes: true })) {
    const chemin = join(repertoire, entree.name);
    if (entree.isDirectory()) resultat.push(...sources(chemin));
    else if (/\.tsx?$/.test(entree.name)) resultat.push(chemin);
  }
  return resultat;
}

/** Fichiers qui ENTRENT dans le bundle navigateur : interface + pages. */
const FICHIERS_INTERFACE = [
  ...sources(join(RACINE, 'src', 'components')),
  ...sources(join(RACINE, 'src', 'pages')),
  join(RACINE, 'src', 'App.tsx'),
  join(RACINE, 'src', 'main.tsx'),
];

describe('frontière navigateur — B7/B8', () => {
  it("ne contient aucun code d'appel d'API, même désactivé, même mort", () => {
    for (const fichier of FICHIERS_INTERFACE) {
      const s = readFileSync(fichier, 'utf-8');
      for (const interdit of ['supabase', 'anthropic', "from '../../ldi/piste'", "from '../ldi/piste'", 'api.piste.gouv.fr', 'fetch(']) {
        assert.ok(
          !s.toLowerCase().includes(interdit.toLowerCase()),
          `${fichier.slice(RACINE.length + 1)} contient « ${interdit} » : le bundle navigateur ne doit porter aucun appel d'API`
        );
      }
    }
  });

  it('ne porte aucune trace du produit précédent', () => {
    const balaye = [
      ...FICHIERS_INTERFACE,
      ...sources(join(RACINE, 'src', 'ldi')).filter((f) => !f.includes('__tests__')),
      join(RACINE, 'index.html'),
      join(RACINE, 'package.json'),
    ];
    for (const fichier of balaye) {
      const s = readFileSync(fichier, 'utf-8').toLowerCase();
      assert.ok(
        !s.includes('clairdossier') && !s.includes('clair-dossier'),
        `${fichier.slice(RACINE.length + 1)} porte encore une trace de l'ancien produit`
      );
    }
  });

  it("ne réintroduit pas de détection de textes générés (B5)", () => {
    for (const fichier of sources(join(RACINE, 'src'))) {
      if (fichier.includes('__tests__')) continue;
      const s = readFileSync(fichier, 'utf-8');
      assert.ok(
        !/detection-ia|SEUILS_DETECTION|AnalyseTextuelle/.test(s),
        `${fichier.slice(RACINE.length + 1)} référence le module de détection supprimé`
      );
    }
  });
});

describe('invite système — garde-fous', () => {
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
