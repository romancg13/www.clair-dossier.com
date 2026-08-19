/**
 * Le plan de navigation de l'atelier n'est pas qu'une liste de libellés : il
 * porte deux promesses vérifiables.
 *
 *   1. Une entrée annoncée comme active mène à une vue réellement branchée.
 *      Un menu qui ouvre un écran vide fait perdre du temps au mauvais moment.
 *   2. Le périmètre NON couvert reste affiché, avec sa raison. C'est ce qui
 *      empêche de croire qu'une capacité existe parce qu'elle est nommée.
 *
 * Ces tests portent sur un fichier de `src/components/` : c'est assumé. La
 * frontière qui compte ici n'est pas React contre moteur, c'est « affirmation
 * vérifiable » contre « affirmation décorative ».
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import {
  CAPACITES_PREVUES,
  NAVIGATION,
  entreePour,
  vueValide,
  type Vue,
} from '../../components/ldi/navigation';

const ENTREES = NAVIGATION.flatMap((s) => s.entrees);

describe('plan de navigation', () => {
  it('ne propose aucune entrée sans vue correspondante', () => {
    for (const e of ENTREES) {
      assert.equal(entreePour(e.vue)?.vue, e.vue, `${e.intitule} doit être résoluble`);
    }
  });

  it("n'expose aucun identifiant de vue en double", () => {
    const vues = ENTREES.map((e) => e.vue);
    assert.equal(new Set(vues).size, vues.length);
  });

  it('décrit chaque entrée : un libellé seul ne dit pas ce qu’on va trouver', () => {
    for (const e of ENTREES) {
      assert.ok(e.resume.trim().length > 20, `${e.intitule} doit porter un résumé utile`);
    }
  });

  it('ramène une valeur d’URL inconnue au tableau de bord', () => {
    for (const valeur of [null, '', 'inexistante', '../../etc/passwd', 'PARAMETRES']) {
      assert.equal(vueValide(valeur), 'tableau-de-bord', `valeur rejetée attendue : ${valeur}`);
    }
  });

  it('accepte les vues réellement déclarées', () => {
    for (const e of ENTREES) {
      assert.equal(vueValide(e.vue), e.vue);
    }
  });
});

describe('périmètre non couvert', () => {
  it('énonce une raison pour chaque capacité absente', () => {
    assert.ok(CAPACITES_PREVUES.length > 0);
    for (const c of CAPACITES_PREVUES) {
      assert.ok(c.pourquoi.trim().length > 30, `${c.intitule} doit dire pourquoi elle manque`);
    }
  });

  it("maintient l'écart assumé sur la détection d'IA", () => {
    // Ce refus est un choix documenté, pas un manque de temps : le formuler
    // comme un simple « à venir » le rendrait révocable par inadvertance.
    const audit = CAPACITES_PREVUES.find((c) => /audit ia/i.test(c.intitule));
    assert.ok(audit, "l'écart sur l'audit IA doit rester visible");
    assert.match(audit.pourquoi, /aucun outil ne détermine/i);
  });

  it('ne présente aucune capacité absente comme disponible', () => {
    const intitulesActifs = ENTREES.filter((e) => e.etat === 'actif').map((e) => e.intitule.toLowerCase());
    for (const c of CAPACITES_PREVUES) {
      assert.ok(
        !intitulesActifs.includes(c.intitule.toLowerCase()),
        `${c.intitule} ne peut pas être à la fois active et non couverte`
      );
    }
  });
});

describe('vues couvertes par le rendu', () => {
  /**
   * Vues réellement rendues, LUES dans la page plutôt que recopiées.
   *
   * Une liste tenue à la main dérive dans les deux sens : une vue ajoutée au
   * plan sans être rendue mène à un écran vide, et une vue rendue sans être au
   * plan devient inatteignable. Extraire les conditions du composant supprime
   * les deux dérives au lieu d'en surveiller une seule.
   */
  const RENDUES: Vue[] = (() => {
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'pages', 'LdiAtelier.tsx'),
      'utf-8'
    );
    return [...source.matchAll(/vue === '([a-z-]+)'/g)].map((m) => m[1] as Vue);
  })();

  it('lit bien les vues rendues dans la page', () => {
    // Si l'extraction ne trouve rien, les deux tests suivants passeraient à
    // vide : ils compareraient une liste absente à une liste non vide.
    assert.ok(RENDUES.length >= 5, `${RENDUES.length} vue(s) extraite(s) de LdiAtelier.tsx`);
  });

  it('rend toutes les vues déclarées actives', () => {
    for (const e of ENTREES) {
      if (e.etat !== 'actif') continue;
      assert.ok(RENDUES.includes(e.vue), `la vue ${e.vue} est annoncée mais non rendue`);
    }
  });

  it('ne rend aucune vue absente du plan', () => {
    const declarees = new Set(ENTREES.map((e) => e.vue));
    for (const v of RENDUES) {
      assert.ok(declarees.has(v), `la vue ${v} est rendue mais absente du plan`);
    }
  });
});
