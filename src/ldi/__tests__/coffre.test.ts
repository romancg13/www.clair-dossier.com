/**
 * Coffre chiffré — tests d'exécution réelle sur `crypto.subtle`.
 *
 * Rien n'est simulé ici : les clés sont vraiment dérivées, les contenus
 * vraiment chiffrés. Un test de chiffrement qui remplace la primitive par un
 * substitut ne prouve rien de ce qu'on veut prouver.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ITERATIONS,
  LONGUEUR_MIN_PHRASE,
  VERSION_COFFRE,
  creerCoffre,
  depuisBase64,
  estEnveloppe,
  ouvrirCoffre,
  sceller,
  versBase64,
} from '../coffre';

const PHRASE = 'le dossier de mars est au greffe';
const CONTENU = JSON.stringify([
  { reference: 'CAB-2025-001', pieces: [{ cote: 'D1', intitule: 'PV de garde à vue' }] },
]);

async function coffrePlein(phrase = PHRASE, contenu = CONTENU) {
  const ouvert = await creerCoffre(phrase);
  return sceller(ouvert, contenu, '2026-08-19T10:00:00.000Z');
}

describe('coffre — aller-retour', () => {
  it('rend exactement ce qui a été scellé', async () => {
    const resultat = await ouvrirCoffre(await coffrePlein(), PHRASE);

    assert.equal(resultat.ok, true);
    assert.equal(resultat.ok && resultat.contenu, CONTENU);
  });

  it('n’écrit le contenu en clair nulle part dans l’enveloppe', async () => {
    const enveloppe = await coffrePlein();
    const tout = JSON.stringify(enveloppe);

    // Le test qui compte : ce qu'un tiers lit sur le support.
    for (const fragment of ['CAB-2025-001', 'garde à vue', 'D1', 'pieces']) {
      assert.ok(!tout.includes(fragment), `« ${fragment} » lisible dans l'enveloppe`);
    }
  });

  it('n’écrit pas la phrase, ni rien qui permette de la vérifier', async () => {
    const tout = JSON.stringify(await coffrePlein());

    assert.ok(!tout.includes(PHRASE));
    for (const mot of PHRASE.split(' ')) {
      if (mot.length >= 5) assert.ok(!tout.includes(mot), `« ${mot} » lisible dans l'enveloppe`);
    }
  });
});

describe('coffre — refus', () => {
  it('refuse une phrase incorrecte sans dire laquelle des deux causes', async () => {
    const resultat = await ouvrirCoffre(await coffrePlein(), 'une phrase entièrement fausse');

    assert.equal(resultat.ok, false);
    assert.equal(!resultat.ok && resultat.motif, 'phrase-ou-alteration');
    // L'outil ne prétend pas départager phrase fausse et altération : il ne le
    // peut pas, et l'affirmer serait inventer une information.
    assert.match(!resultat.ok ? resultat.message : '', /indistinguables/);
  });

  it('refuse un contenu modifié d’un seul octet', async () => {
    const enveloppe = await coffrePlein();
    const octets = depuisBase64(enveloppe.chiffre);
    octets[0] ^= 0x01;

    const resultat = await ouvrirCoffre({ ...enveloppe, chiffre: versBase64(octets) }, PHRASE);
    assert.equal(resultat.ok, false);
    assert.equal(!resultat.ok && resultat.motif, 'phrase-ou-alteration');
  });

  it('refuse une enveloppe dont le compte d’itérations a été abaissé', async () => {
    // Sans liaison de l'en-tête au chiffré, abaisser `iterations` à 1 rendrait
    // l'attaque par force brute triviale pour qui a copié le support.
    const enveloppe = await coffrePlein();
    const resultat = await ouvrirCoffre({ ...enveloppe, iterations: 1 }, PHRASE);

    assert.equal(resultat.ok, false);
  });

  it('refuse un compte d’itérations absurde avant toute dérivation', async () => {
    const enveloppe = await coffrePlein();

    for (const mauvais of [0, -1, 1.5, Number.NaN]) {
      const r = await ouvrirCoffre({ ...enveloppe, iterations: mauvais }, PHRASE);
      assert.equal(r.ok, false, `itérations = ${mauvais} accepté`);
      assert.equal(!r.ok && r.motif, 'enveloppe-illisible');
    }
  });

  it('refuse une version qu’il ne sait pas lire, sans rien détruire', async () => {
    const enveloppe = await coffrePlein();
    const resultat = await ouvrirCoffre({ ...enveloppe, version: VERSION_COFFRE + 1 }, PHRASE);

    assert.equal(resultat.ok, false);
    assert.equal(!resultat.ok && resultat.motif, 'format-inconnu');
    assert.match(!resultat.ok ? resultat.message : '', /Rien n'est modifié/);
  });

  it('refuse une phrase trop courte au scellement', async () => {
    await assert.rejects(
      () => creerCoffre('court'),
      (e: Error) => e.message.includes(String(LONGUEUR_MIN_PHRASE))
    );
  });
});

describe('coffre — propriétés cryptographiques', () => {
  it('tire un vecteur d’initialisation neuf à chaque scellement', async () => {
    // Réutiliser un IV avec la même clé en AES-GCM anéantit la confidentialité.
    const ouvert = await creerCoffre(PHRASE);
    const vus = new Set<string>();

    for (let i = 0; i < 20; i += 1) {
      vus.add((await sceller(ouvert, CONTENU, '2026-08-19T10:00:00.000Z')).iv);
    }

    assert.equal(vus.size, 20);
  });

  it('produit un chiffré différent à chaque scellement du même contenu', async () => {
    const ouvert = await creerCoffre(PHRASE);
    const a = await sceller(ouvert, CONTENU, '2026-08-19T10:00:00.000Z');
    const b = await sceller(ouvert, CONTENU, '2026-08-19T10:00:00.000Z');

    assert.notEqual(a.chiffre, b.chiffre);
  });

  it('tire un sel différent pour deux coffres, même phrase identique', async () => {
    const a = await creerCoffre(PHRASE);
    const b = await creerCoffre(PHRASE);

    // Sans cela, deux cabinets utilisant la même phrase partageraient une clé,
    // et une table précalculée servirait pour les deux.
    assert.notEqual(versBase64(a.sel), versBase64(b.sel));
  });

  it('conserve la clé sous une forme non extractible', async () => {
    const { cle } = await creerCoffre(PHRASE);

    assert.equal(cle.extractable, false);
    await assert.rejects(() => globalThis.crypto.subtle.exportKey('raw', cle));
  });

  it('écrit le compte d’itérations dans l’enveloppe', async () => {
    const enveloppe = await coffrePlein();

    // Relever la constante demain ne doit pas rendre illisibles les coffres
    // scellés aujourd'hui.
    assert.equal(enveloppe.iterations, ITERATIONS);
    const relu = await ouvrirCoffre(enveloppe, PHRASE);
    assert.equal(relu.ok, true);
  });
});

describe('coffre — reconnaissance d’enveloppe', () => {
  it('accepte une enveloppe complète et refuse tout le reste', async () => {
    assert.equal(estEnveloppe(await coffrePlein()), true);

    for (const mauvais of [null, undefined, 42, 'texte', [], {}, { version: 1 }]) {
      assert.equal(estEnveloppe(mauvais), false, `${JSON.stringify(mauvais)} accepté`);
    }
  });

  it('refuse une enveloppe amputée d’un seul champ', async () => {
    const enveloppe = await coffrePlein();

    for (const champ of ['version', 'sel', 'iv', 'iterations', 'chiffre', 'ecritLe'] as const) {
      const ampute = { ...enveloppe };
      delete ampute[champ];
      assert.equal(estEnveloppe(ampute), false, `enveloppe sans « ${champ} » acceptée`);
    }
  });
});
