/**
 * Chantier 0, lot 1 — quatre dettes relevées en revue et vérifiées dans le code.
 *
 * Elles ont un point commun : chacune fait dire au système quelque chose d'un
 * peu plus fort que ce qu'il sait. Un ordre qui dépend de la machine, un régime
 * accepté sans être connu, un rejeu qui déclare « identique » sans avoir
 * comparé, un état de classement qu'aucune donnée ne peut atteindre.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { EtatDossier, LIBELLES_ETAT, etatDossier } from '../atelier';
import { DUREE_MAX_GAV_HEURES } from '../corpus/references';
import { empreinte, journaliser, rejouer } from '../journal';
import { trierChronologie } from '../modules/chronologie';
import { analyser } from '../pipeline';
import type { Dossier, Evenement, RegimeProcedural } from '../types';
import { validerDossier } from '../validation';

function evenement(
  p: Partial<Evenement> & Pick<Evenement, 'id' | 'nature' | 'horodatage'>
): Evenement {
  return { description: p.nature, ...p } as Evenement;
}

function dossier(over: Partial<Dossier> = {}): Dossier {
  return {
    reference: 'DETTE-001',
    qualifications: ['CP, art. 313-1'],
    regime: 'droit-commun',
    pieces: [{ id: 'P1', nature: 'proces-verbal', intitule: 'PV', date: '2026-03-14' }],
    evenements: [
      evenement({ id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00', sourcePieceId: 'P1' }),
      evenement({ id: 'E2', nature: 'notification-droits', horodatage: '2026-03-14T08:05', sourcePieceId: 'P1' }),
    ],
    ...over,
  };
}

// ── #1 — déterminisme de l'ordre ──────────────────────────────────────────

describe('ordre indépendant de la locale', () => {
  it("n'appelle plus localeCompare dans les chemins déterministes", async () => {
    const { readFileSync } = await import('node:fs');
    // L'APPEL, pas le mot : les commentaires qui expliquent pourquoi on s'en
    // passe doivent rester lisibles sans faire échouer le test.
    for (const f of ['src/ldi/journal.ts', 'src/ldi/modules/chronologie.ts']) {
      assert.ok(
        !/\.localeCompare\s*\(/.test(readFileSync(f, 'utf-8')),
        `${f} : l'ordre dépendrait de la locale et des données ICU du runtime`
      );
    }
  });

  it('ordonne les événements non datés de façon stable', () => {
    // Identifiants choisis pour que l'ordre alphabétique linguistique et
    // l'ordre par point de code diffèrent : « É » précède « Z » en français,
    // mais lui succède en Unicode.
    const evenements = [
      evenement({ id: 'Zulu', nature: 'audition', horodatage: 'date illisible' }),
      evenement({ id: 'Émile', nature: 'audition', horodatage: 'date illisible' }),
      evenement({ id: 'alpha', nature: 'audition', horodatage: 'date illisible' }),
    ];
    const ordre = trierChronologie(evenements).map((e) => e.id);
    assert.deepEqual(ordre, [...ordre].sort(), 'l’ordre doit être celui des points de code');
  });

  it('produit la même empreinte quel que soit l’ordre des clés', () => {
    const a = { zebre: 1, Émile: 2, alpha: 3 };
    const b = { alpha: 3, Émile: 2, zebre: 1 };
    assert.equal(empreinte(a), empreinte(b));
  });
});

// ── #2 et #3 — régime procédural ──────────────────────────────────────────

describe('régime procédural', () => {
  it('refuse un régime inconnu au lieu de lui appliquer 48 h par défaut', () => {
    const v = validerDossier({ ...dossier(), regime: 'regime-invente' });
    assert.equal(v.ok, false);
    assert.match(v.ok === false ? v.message : '', /r[ée]gime/i);
  });

  it('accepte les trois régimes du code', () => {
    for (const regime of ['droit-commun', 'criminalite-organisee', 'terrorisme'] as const) {
      assert.equal(validerDossier({ ...dossier(), regime }).ok, true, regime);
    }
  });

  it('tolère un régime absent — le pipeline retient le droit commun', () => {
    const sansRegime = { ...dossier() } as Partial<Dossier>;
    delete sansRegime.regime;
    assert.equal(validerDossier(sansRegime).ok, true);
  });

  it('couvre chaque régime déclaré par une durée maximale', () => {
    // Le typage doit rendre l'oubli impossible ; le test le constate.
    const regimes: RegimeProcedural[] = ['droit-commun', 'criminalite-organisee', 'terrorisme'];
    for (const r of regimes) {
      assert.ok(DUREE_MAX_GAV_HEURES[r], `aucune durée déclarée pour ${r}`);
      assert.ok(DUREE_MAX_GAV_HEURES[r].heures > 0);
    }
  });
});

// ── #4 — rejeu ────────────────────────────────────────────────────────────

describe('rejeu du journal', () => {
  it('confirme un dossier et un moteur inchangés', () => {
    const d = dossier();
    const controle = rejouer(journaliser(d, analyser(d)), d);
    assert.equal(controle.identique, true, controle.ecarts.join(' · '));
  });

  it('signale un rapport qui a changé sans que le dossier bouge', () => {
    // Empreinte de rapport falsifiée : c'est le seul moyen de simuler ici un
    // moteur dont la sortie a changé à version constante — précisément le cas
    // qu'un rejeu ne détectait pas.
    const d = dossier();
    const journal = journaliser(d, analyser(d));
    const falsifie = { ...journal, rapportEmpreinte: '0000000000000000' };

    const controle = rejouer(falsifie, d);
    assert.equal(controle.identique, false);
    assert.ok(
      controle.ecarts.some((e) => /rapport/i.test(e)),
      `aucun écart ne mentionne le rapport : ${controle.ecarts.join(' · ')}`
    );
  });

  it('signale toujours un dossier modifié', () => {
    const d = dossier();
    const journal = journaliser(d, analyser(d));
    const modifie = dossier({ reference: 'DETTE-002' });
    assert.equal(rejouer(journal, modifie).identique, false);
  });
});

// ── C4 — état de classement inatteignable ─────────────────────────────────

describe('états de classement', () => {
  it("n'expose aucun état qu'aucune donnée ne peut produire", () => {
    // GAV-01 et PRESC-01 ne retournent que `non-etabli` : `nonEtablis` vaut
    // donc au moins 2 pour tout dossier pourvu d'au moins une pièce. Un état
    // exigeant `nonEtablis === 0` est mort par construction.
    const etats = Object.keys(LIBELLES_ETAT) as EtatDossier[];
    assert.ok(!etats.includes('sans-anomalie' as EtatDossier));
  });

  it('classe tout dossier pourvu de pièces en anomalie ou à vérifier', () => {
    const r = analyser(dossier());
    assert.ok(['anomalie', 'a-verifier'].includes(etatDossier(r)), etatDossier(r));
  });

  it('conserve la mise en garde sur la portée du contrôle', () => {
    // La nuance perdue avec l'état supprimé doit rester portée par « À vérifier ».
    assert.match(LIBELLES_ETAT['a-verifier'].explication, /non établis|dix points|contrôle/i);
  });
});

// ── #8 et #9 — sourçage ───────────────────────────────────────────────────

describe('sourçage : ce que le silence d’une source signifie', () => {
  it('distingue une source injoignable d’une source sans texte exploitable', async () => {
    const { verifierTexte } = await import('../modules/recherche');
    const config = {
      legifrance: { urlBase: 'https://exemple.test/', enteteAuth: 'KeyId', valeurAuth: 'x' },
    };

    // Réponse HTTP correcte, mais sans champ de texte : la source a répondu.
    const repondSansTexte = async () =>
      new Response(JSON.stringify({ id: 'X' }), { status: 200, headers: { 'content-type': 'application/json' } });
    const injoignable = async () => {
      throw new Error('réseau coupé');
    };

    const original = globalThis.fetch;
    try {
      globalThis.fetch = repondSansTexte as typeof fetch;
      const sansTexte = await verifierTexte('CPP, art. 63', config);

      globalThis.fetch = injoignable as typeof fetch;
      const coupee = await verifierTexte('CPP, art. 63', config);

      assert.equal(sansTexte.statut, 'a-verifier');
      assert.equal(coupee.statut, 'a-verifier');
      assert.notEqual(
        sansTexte.note,
        coupee.note,
        'les deux situations doivent être distinguables par le lecteur'
      );
      assert.match(sansTexte.note ?? '', /sans texte exploitable|n'a pas retourné/i);
    } finally {
      globalThis.fetch = original;
    }
  });
});

describe('sourçage : concurrence bornée', () => {
  it("n'ouvre jamais plus d'un petit nombre de requêtes simultanées", async () => {
    const { sourcerRapport } = await import('../sourcage');
    const { analyser: analyserPipeline } = await import('../pipeline');

    let enCours = 0;
    let pic = 0;
    const original = globalThis.fetch;
    try {
      globalThis.fetch = (async () => {
        enCours += 1;
        pic = Math.max(pic, enCours);
        await new Promise((r) => setTimeout(r, 1));
        enCours -= 1;
        return new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } });
      }) as typeof fetch;

      await sourcerRapport(analyserPipeline(dossier()), {
        legifrance: { urlBase: 'https://exemple.test/', enteteAuth: 'KeyId', valeurAuth: 'x' },
        judilibre: { urlBase: 'https://exemple.test/', enteteAuth: 'KeyId', valeurAuth: 'x' },
      });

      // Les API officielles appliquent des quotas par seconde : un dossier de
      // cinquante références ouvrait cent requêtes d'un coup, et les rejets
      // ressemblaient alors à une source injoignable.
      assert.ok(pic > 0, 'le test doit réellement passer par fetch');
      assert.ok(pic <= 8, `pic de ${pic} requêtes simultanées : la concurrence n'est pas bornée`);
    } finally {
      globalThis.fetch = original;
    }
  });
});
