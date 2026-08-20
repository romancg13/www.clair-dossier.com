/**
 * P1-05 — axe G, noté 1/5 à l'audit. La question à laquelle le système ne
 * savait pas répondre : « d'où vient cette phrase, trois mois plus tard ? ».
 * Le noyau étant déterministe, un journal n'a pas besoin de tout stocker : il
 * lui suffit d'identifier l'entrée et de tracer, pour chaque constat, les
 * éléments du dossier qui l'ont produit.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { empreinte, journaliser, rejouer } from '../journal';
import { analyser } from '../pipeline';
import type { Dossier } from '../types';

function dossier(): Dossier {
  return {
    reference: 'JRN-001',
    qualifications: ['CP, art. 222-37'],
    regime: 'droit-commun',
    pieces: [{ id: 'P1', nature: 'proces-verbal', intitule: 'PV', date: '2026-03-14' }],
    evenements: [
      { id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00', description: 'Placement', sourcePieceId: 'P1' },
      { id: 'E2', nature: 'notification-droits', horodatage: '2026-03-14T09:20', description: 'Droits', sourcePieceId: 'P1' },
    ],
  };
}

describe('empreinte', () => {
  it('est stable pour une même entrée et change au moindre écart', () => {
    assert.equal(empreinte('abc'), empreinte('abc'));
    assert.notEqual(empreinte('abc'), empreinte('abd'));
    assert.notEqual(empreinte(''), empreinte('a'));
  });

  it('ne dépend pas de l’ordre des clés d’un objet', () => {
    assert.equal(empreinte({ a: 1, b: 2 }), empreinte({ b: 2, a: 1 }));
  });
});

describe('journaliser', () => {
  it('identifie l’entrée sans avoir à la recopier', () => {
    const j = journaliser(dossier(), analyser(dossier()));

    assert.equal(j.dossier.reference, 'JRN-001');
    assert.equal(j.dossier.pieces, 1);
    assert.equal(j.dossier.evenements, 2);
    assert.match(j.dossier.empreinte, /^[0-9a-f]{16}$/);
    assert.ok(j.version.length > 0);
  });

  it('trace, pour chaque constat, les éléments du dossier qui l’ont produit', () => {
    const j = journaliser(dossier(), analyser(dossier()));

    const notification = j.constats.find((c) => c.id === 'GAV-02');
    assert.ok(notification, 'le point de contrôle doit être journalisé');
    assert.equal(notification?.fondement, 'CPP, art. 63-1');
    assert.ok(notification?.origine.length ?? 0 > 0, 'la provenance doit être renseignée');
  });

  it('enregistre les références invoquées, pour retrouver ce qui restait à vérifier', () => {
    const j = journaliser(dossier(), analyser(dossier()));
    assert.ok(j.references.includes('CPP, art. 63-1'));
    assert.ok(j.references.every((r) => typeof r === 'string'));
  });
});

describe('rejouer', () => {
  it('confirme qu’un dossier inchangé reproduit le même rapport', () => {
    const d = dossier();
    const j = journaliser(d, analyser(d));

    const controle = rejouer(j, d);
    assert.equal(controle.identique, true);
    assert.deepEqual(controle.ecarts, []);
  });

  it('détecte qu’une pièce du dossier a bougé depuis la journalisation', () => {
    const d = dossier();
    const j = journaliser(d, analyser(d));

    const modifie = dossier();
    modifie.evenements[1].horodatage = '2026-03-14T08:05';

    const controle = rejouer(j, modifie);
    assert.equal(controle.identique, false);
    assert.ok(controle.ecarts.some((e) => /dossier/i.test(e)));
  });

  it('détecte un changement de version du moteur', () => {
    const d = dossier();
    const j = { ...journaliser(d, analyser(d)), version: '0.0.1-ancienne' };

    const controle = rejouer(j, d);
    assert.equal(controle.identique, false);
    assert.ok(controle.ecarts.some((e) => /version/i.test(e)));
  });
});
