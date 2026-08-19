/**
 * Couche d'intelligence — instructions par passe, moteur local, mode distant
 * verrouillé (D-2/D-3), consignes injectées et visibles.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { bibliothequeVide, blocConsignes, consignesApplicables, creerConsigne, reviserConsigne } from '../consignes';
import { VERSION_INSTRUCTIONS, instructionDePasse } from '../instructions';
import {
  REFUS_DISTANT_INACTIF,
  REFUS_SANS_CONSENTEMENT,
  creerMoteurDistant,
  creerMoteurLocal,
} from '../moteur';
import type { IdPasse } from '../passes';

const PASSES: IdPasse[] = ['P0', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6'];

describe('instructions par passe', () => {
  it('existent pour les sept passes, versionnées, gabarit complet', () => {
    for (const passe of PASSES) {
      const texte = instructionDePasse(passe, []);
      assert.match(texte, new RegExp(`INSTRUCTION DE PASSE ${passe} · version ${VERSION_INSTRUCTIONS.replace('.', '\\.')}`));
      for (const section of ['RÔLE', 'PÉRIMÈTRE', 'ENTRÉES', 'CONSIGNES', 'INTERDITS', 'ANCRAGE', 'FORMAT', 'EN CAS DE VIDE']) {
        assert.ok(texte.includes(section), `${passe} : section « ${section} » absente`);
      }
    }
  });

  it('ne contient AUCUNE référence juridique en dur (B2)', () => {
    for (const passe of PASSES) {
      const texte = instructionDePasse(passe, []);
      assert.ok(!/\bart(?:icle)?\.?\s*\d/i.test(texte), `${passe} : numéro d'article en dur`);
      assert.ok(!/\b\d{2}-\d{2}\.\d{3}\b/.test(texte), `${passe} : numéro de pourvoi en dur`);
      assert.ok(!/\bCPP\b|\bcode p[eé]nal\b/i.test(texte), `${passe} : code cité en dur`);
    }
  });

  it('rappelle les interdits B4, B13, B15, B17, B18 dans chaque passe', () => {
    const texte = instructionDePasse('P3', []);
    for (const b of ['B4', 'B13', 'B15', 'B17', 'B18']) assert.ok(texte.includes(b), `${b} absent`);
    assert.match(texte, /jamais une hypothèse comblante/);
  });
});

describe('consignes du cabinet — injectées et visibles', () => {
  it('une consigne saisie une fois entre dans chaque instruction suivante', () => {
    let bibliotheque = bibliothequeVide();
    bibliotheque = { ...bibliotheque, consignes: [creerConsigne('Toujours citer la cote entre parenthèses après chaque fait.', 'cabinet')] };

    const applicables = consignesApplicables(bibliotheque, 'X-1');
    const instruction = instructionDePasse('P5', applicables);
    assert.match(instruction, /Toujours citer la cote entre parenthèses/);
  });

  it('la consigne de dossier prime : elle arrive après celle du cabinet', () => {
    const cabinet = creerConsigne('Synthèse en une page.', 'cabinet');
    const dossier = creerConsigne('Pour ce dossier : synthèse détaillée.', 'dossier', { dossierReference: 'X-1' });
    const bloc = blocConsignes(consignesApplicables({ trames: [], consignes: [cabinet, dossier] }, 'X-1'));

    assert.ok(bloc.indexOf('une page') < bloc.indexOf('détaillée'), 'la consigne de dossier doit être lue en dernier');
  });

  it('réviser désactive l’ancienne version sans la supprimer (B21)', () => {
    const initiale = creerConsigne('Version 1.', 'cabinet');
    let bibliotheque = { trames: [], consignes: [initiale] };
    bibliotheque = reviserConsigne(bibliotheque, initiale.id, 'Version 2.');

    assert.equal(bibliotheque.consignes.length, 2, "l'historique reste");
    assert.equal(bibliotheque.consignes[0].active, false);
    assert.equal(bibliotheque.consignes[1].active, true);
    assert.equal(consignesApplicables(bibliotheque, 'X').length, 1);
  });

  it('une consigne de dossier ne fuit pas vers un autre dossier (B18)', () => {
    const bibliotheque = { trames: [], consignes: [creerConsigne('Propre au dossier A.', 'dossier', { dossierReference: 'A' })] };
    assert.equal(consignesApplicables(bibliotheque, 'A').length, 1);
    assert.equal(consignesApplicables(bibliotheque, 'B').length, 0);
  });
});

describe('moteur local (D-2)', () => {
  it("refuse À LA CONSTRUCTION toute URL non locale", () => {
    assert.throws(() => creerMoteurLocal({ url: 'https://api.exemple.com', modele: 'x' }), /mensonge d'étiquette/);
    assert.doesNotThrow(() => creerMoteurLocal({ url: 'http://127.0.0.1:11434', modele: 'x', fetchImpl: (async () => new Response('{}')) as typeof fetch }));
    assert.doesNotThrow(() => creerMoteurLocal({ url: 'http://localhost:11434', modele: 'x', fetchImpl: (async () => new Response('{}')) as typeof fetch }));
  });

  it('parle le dialecte attendu et rend le texte du modèle', async () => {
    const appels: { url: string; body: unknown }[] = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      appels.push({ url: String(url), body: JSON.parse(String(init?.body)) });
      return new Response(JSON.stringify({ response: 'Réponse du modèle.' }), { status: 200 });
    }) as unknown as typeof fetch;

    const moteur = creerMoteurLocal({ url: 'http://127.0.0.1:11434', modele: 'mistral', fetchImpl });
    const reponse = await moteur.generer('INSTRUCTION', 'CONTEXTE');

    assert.deepEqual(reponse, { ok: true, texte: 'Réponse du modèle.' });
    assert.match(appels[0].url, /127\.0\.0\.1:11434\/api\/generate/);
    const corps = appels[0].body as { model: string; system: string; prompt: string; stream: boolean };
    assert.equal(corps.model, 'mistral');
    assert.equal(corps.stream, false);
  });

  it('échoue proprement — et dit que le déterministe reste disponible', async () => {
    const fetchImpl = (async () => { throw new Error('ECONNREFUSED'); }) as unknown as typeof fetch;
    const moteur = creerMoteurLocal({ url: 'http://127.0.0.1:11434', modele: 'x', fetchImpl });
    const reponse = await moteur.generer('i', 'c');
    assert.equal(reponse.ok, false);
    assert.match(!reponse.ok ? reponse.erreur : '', /mode déterministe reste pleinement disponible/);
  });
});

describe('moteur distant (D-3) — construit, verrouillé', () => {
  const fetchJamaisAppele = (async () => {
    throw new Error('AUCUN appel réseau ne doit partir quand un verrou tient');
  }) as unknown as typeof fetch;

  it('refuse sans la variable d’environnement, même consentement donné', async () => {
    const moteur = creerMoteurDistant({
      active: undefined,
      cleApi: 'sk-x',
      modele: 'm',
      consentement: { dossierReference: 'X-1', horodatage: '2026-08-19T12:00:00Z' },
      fetchImpl: fetchJamaisAppele,
    });
    const reponse = await moteur.generer('i', 'c');
    assert.deepEqual(reponse, { ok: false, erreur: REFUS_DISTANT_INACTIF });
  });

  it('refuse sans consentement de dossier, même variable posée', async () => {
    const moteur = creerMoteurDistant({
      active: 'oui',
      cleApi: 'sk-x',
      modele: 'm',
      consentement: null,
      fetchImpl: fetchJamaisAppele,
    });
    const reponse = await moteur.generer('i', 'c');
    assert.deepEqual(reponse, { ok: false, erreur: REFUS_SANS_CONSENTEMENT });
    assert.equal(moteur.descriptif.consentementDistant, false);
  });

  it('les deux verrous levés : l’appel part, la réponse revient', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ content: [{ type: 'text', text: 'Analyse.' }] }), { status: 200 })) as unknown as typeof fetch;
    const moteur = creerMoteurDistant({
      active: 'oui',
      cleApi: 'sk-x',
      modele: 'm',
      consentement: { dossierReference: 'X-1', horodatage: '2026-08-19T12:00:00Z' },
      fetchImpl,
    });
    const reponse = await moteur.generer('i', 'c');
    assert.deepEqual(reponse, { ok: true, texte: 'Analyse.' });
    assert.equal(moteur.descriptif.consentementDistant, true);
  });

  it('ne relaie jamais le corps d’erreur amont (B11)', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: { message: 'contenu sensible reflété' } }), { status: 429 })) as unknown as typeof fetch;
    const moteur = creerMoteurDistant({
      active: 'oui', cleApi: 'sk-x', modele: 'm',
      consentement: { dossierReference: 'X', horodatage: 'x' },
      fetchImpl,
    });
    const reponse = await moteur.generer('i', 'c');
    assert.equal(reponse.ok, false);
    assert.ok(!(!reponse.ok && reponse.erreur.includes('sensible')));
  });
});
