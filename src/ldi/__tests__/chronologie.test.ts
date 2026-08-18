import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyserDossier, parseHorodatage, trierChronologie } from '../modules/chronologie';
import { detecterIrregularites } from '../modules/nullites';
import type { Dossier, Evenement } from '../types';

function evenement(partiel: Partial<Evenement> & Pick<Evenement, 'id' | 'nature' | 'horodatage'>): Evenement {
  return { description: partiel.nature, ...partiel } as Evenement;
}

/** Garde à vue régulière : sert de témoin négatif à tous les détecteurs. */
function dossierConforme(): Dossier {
  return {
    reference: 'TEST-001',
    qualifications: ['CP, art. 222-37'],
    regime: 'droit-commun',
    pieces: [
      { id: 'P1', nature: 'proces-verbal', intitule: 'PV de placement', date: '2026-03-14' },
      { id: 'P2', nature: 'audition', intitule: 'PV audition n°1', date: '2026-03-14' },
      { id: 'P3', nature: 'proces-verbal', intitule: 'PV de fin de garde à vue', date: '2026-03-15' },
    ],
    evenements: [
      evenement({ id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00', sourcePieceId: 'P1' }),
      evenement({ id: 'E2', nature: 'notification-droits', horodatage: '2026-03-14T08:10', sourcePieceId: 'P1' }),
      evenement({ id: 'E3', nature: 'demande-avocat', horodatage: '2026-03-14T08:15', sourcePieceId: 'P1' }),
      evenement({ id: 'E4', nature: 'avis-avocat', horodatage: '2026-03-14T08:25', sourcePieceId: 'P1' }),
      evenement({ id: 'E5', nature: 'arrivee-avocat', horodatage: '2026-03-14T09:40', sourcePieceId: 'P2' }),
      evenement({
        id: 'E6',
        nature: 'audition',
        horodatage: '2026-03-14T10:00',
        description: 'Audition n°1 sur les faits',
        sourcePieceId: 'P2',
      }),
      evenement({ id: 'E7', nature: 'fin-garde-a-vue', horodatage: '2026-03-15T07:30', sourcePieceId: 'P3' }),
    ],
  };
}

describe('parseHorodatage', () => {
  it('interprète les horodatages en UTC, indépendamment du fuseau de la machine', () => {
    const instant = parseHorodatage('2026-03-14T08:20');
    assert.equal(instant?.minutes, Date.UTC(2026, 2, 14, 8, 20) / 60_000);
    assert.equal(instant?.avecHeure, true);
  });

  it('accepte une date seule et le signale', () => {
    const instant = parseHorodatage('2026-03-14');
    assert.equal(instant?.avecHeure, false);
  });

  it('rejette ce qui ne se lit pas', () => {
    assert.equal(parseHorodatage('hier matin'), null);
    assert.equal(parseHorodatage('2026-13-01'), null);
    assert.equal(parseHorodatage('2026-03-14T25:00'), null);
  });
});

describe('trierChronologie', () => {
  it('range les événements par heure et relègue les horodatages illisibles', () => {
    const tries = trierChronologie([
      evenement({ id: 'B', nature: 'audition', horodatage: '2026-03-14T10:00' }),
      evenement({ id: 'X', nature: 'autre', horodatage: 'inconnu' }),
      evenement({ id: 'A', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00' }),
    ]);
    assert.deepEqual(tries.map((e) => e.id), ['A', 'B', 'X']);
  });
});

describe('analyserDossier — témoin négatif', () => {
  it('ne relève aucune contradiction sur une procédure régulière', () => {
    const analyse = analyserDossier(dossierConforme());
    assert.deepEqual(analyse.contradictions, []);
  });

  it('ne déclenche aucune anomalie procédurale sur une procédure régulière', () => {
    const dossier = dossierConforme();
    const rapport = detecterIrregularites(dossier, analyserDossier(dossier));
    assert.deepEqual(rapport.anomalies.map((a) => a.id), []);
  });
});

describe('analyserDossier — détecteurs', () => {
  it('relève une audition antérieure à la notification des droits', () => {
    const dossier = dossierConforme();
    dossier.evenements = dossier.evenements.map((e) =>
      e.id === 'E2' ? { ...e, horodatage: '2026-03-14T11:00' } : e
    );

    const contradictions = analyserDossier(dossier).contradictions;
    const trouvee = contradictions.find((c) => c.constat.includes('avant la notification des droits'));
    assert.ok(trouvee, 'la contradiction doit être relevée');
    assert.equal(trouvee?.severite, 'critique');
  });

  it('relève un dépassement de la durée de garde à vue de droit commun', () => {
    const dossier = dossierConforme();
    // 08:00 le 14 → 10:00 le 16 = 50 h, sans aucune prolongation actée.
    dossier.evenements = dossier.evenements.map((e) =>
      e.id === 'E7' ? { ...e, horodatage: '2026-03-16T10:00' } : e
    );

    const contradiction = analyserDossier(dossier).contradictions.find((c) => c.type === 'duree-legale');
    assert.ok(contradiction);
    assert.match(contradiction!.constat, /50 h/);
  });

  it("accepte exactement 48 h lorsqu'une prolongation est actée", () => {
    const dossier = dossierConforme();
    // Départ 2026-03-14T08:00 → 48 h pile = 2026-03-16T08:00. La borne se teste
    // à la borne, sinon un décalage d'une heure passerait inaperçu.
    dossier.evenements = [
      ...dossier.evenements.map((e) => (e.id === 'E7' ? { ...e, horodatage: '2026-03-16T08:00', sourcePieceId: undefined } : e)),
      evenement({ id: 'E8', nature: 'prolongation-garde-a-vue', horodatage: '2026-03-15T07:00', sourcePieceId: 'P1' }),
    ];

    const contradictions = analyserDossier(dossier).contradictions.filter((c) => c.type === 'duree-legale');
    assert.deepEqual(contradictions, []);
  });

  it('relève le dépassement une minute après la borne de 48 h', () => {
    const dossier = dossierConforme();
    dossier.evenements = [
      ...dossier.evenements.map((e) => (e.id === 'E7' ? { ...e, horodatage: '2026-03-16T08:01', sourcePieceId: undefined } : e)),
      evenement({ id: 'E8', nature: 'prolongation-garde-a-vue', horodatage: '2026-03-15T07:00', sourcePieceId: 'P1' }),
    ];

    const contradiction = analyserDossier(dossier).contradictions.find((c) => c.type === 'duree-legale');
    assert.ok(contradiction, 'une minute au-delà du plafond doit être relevée');
  });

  it('rejette une date de calendrier impossible au lieu de la reporter', () => {
    // Date.UTC transforme le 30 février en 2 mars sans rien signaler : l'acte
    // resterait dans la chronologie à un instant qui n'est pas le sien.
    assert.equal(parseHorodatage('2026-02-30T10:00'), null);
    assert.equal(parseHorodatage('2026-04-31'), null);
    assert.ok(parseHorodatage('2024-02-29') !== null, 'une année bissextile reste valide');
  });

  it('relève deux prolongations en droit commun', () => {
    const dossier = dossierConforme();
    dossier.evenements = [
      ...dossier.evenements,
      evenement({ id: 'E8', nature: 'prolongation-garde-a-vue', horodatage: '2026-03-15T07:00' }),
      evenement({ id: 'E9', nature: 'prolongation-garde-a-vue', horodatage: '2026-03-16T07:00' }),
    ];

    const contradiction = analyserDossier(dossier).contradictions.find((c) =>
      c.constat.includes('prolongations sont actées')
    );
    assert.ok(contradiction);
  });

  it("relève une première audition ouverte avant le délai de deux heures de l'art. 63-4-2 CPP", () => {
    const dossier = dossierConforme();
    dossier.evenements = dossier.evenements
      .filter((e) => e.id !== 'E5') // pas d'avocat présent
      .map((e) => (e.id === 'E6' ? { ...e, horodatage: '2026-03-14T09:00' } : e));

    const analyse = analyserDossier(dossier);
    const contradiction = analyse.contradictions.find((c) => c.regle === 'carence-avocat-63-4-2');
    assert.ok(contradiction);
    assert.equal(contradiction?.severite, 'critique');

    // Le point de contrôle doit s'appuyer sur l'identifiant de règle, pas sur le
    // libellé : une reformulation du constat ne doit pas le désactiver.
    assert.equal(detecterIrregularites(dossier, analyse).points.find((p) => p.id === 'GAV-04')?.resultat, 'anomalie');
  });

  it("ne relève rien lorsque l'audition ne porte que sur l'identité", () => {
    const dossier = dossierConforme();
    dossier.evenements = dossier.evenements
      .filter((e) => e.id !== 'E5')
      .map((e) =>
        e.id === 'E6'
          ? { ...e, horodatage: '2026-03-14T09:00', description: "Audition sur les éléments d'identité" }
          : e
      );

    const contradictions = analyserDossier(dossier).contradictions.filter((c) => c.constat.includes('63-4-2'));
    assert.deepEqual(contradictions, []);
  });

  it("relève une pièce datée avant l'événement qu'elle établit", () => {
    const dossier = dossierConforme();
    dossier.pieces = dossier.pieces.map((p) => (p.id === 'P2' ? { ...p, date: '2026-03-12' } : p));

    const contradiction = analyserDossier(dossier).contradictions.find((c) => c.type === 'anteriorite-piece');
    assert.ok(contradiction);
    assert.equal(contradiction?.severite, 'critique');
  });

  it('relève une présence simultanée en deux lieux', () => {
    const dossier = dossierConforme();
    dossier.evenements = [
      ...dossier.evenements,
      evenement({
        id: 'E10',
        nature: 'audition',
        horodatage: '2026-03-14T10:00',
        personne: 'MIS_EN_CAUSE',
        lieu: 'Commissariat A',
        dureeMinutes: 60,
      }),
      evenement({
        id: 'E11',
        nature: 'perquisition',
        horodatage: '2026-03-14T10:30',
        personne: 'MIS_EN_CAUSE',
        lieu: 'Domicile B',
        dureeMinutes: 30,
      }),
    ];

    const contradiction = analyserDossier(dossier).contradictions.find((c) => c.type === 'presence-simultanee');
    assert.ok(contradiction);
  });

  it('signale une notification des droits manquante', () => {
    const dossier = dossierConforme();
    dossier.evenements = dossier.evenements.filter((e) => e.nature !== 'notification-droits');

    const analyse = analyserDossier(dossier);
    assert.ok(analyse.contradictions.some((c) => c.constat.includes('Aucun événement de notification')));

    const rapport = detecterIrregularites(dossier, analyse);
    assert.equal(rapport.points.find((p) => p.id === 'GAV-02')?.resultat, 'anomalie');
  });
});

describe('detecterIrregularites', () => {
  it('laisse chaque point à « non établi » sur un dossier vide plutôt que de le déclarer conforme', () => {
    const dossier: Dossier = { reference: 'VIDE', qualifications: [], pieces: [], evenements: [] };
    const rapport = detecterIrregularites(dossier, analyserDossier(dossier));

    assert.equal(rapport.points.length, rapport.nonEtablis.length);
    assert.equal(rapport.anomalies.length, 0);
    assert.ok(rapport.points.every((p) => p.resultat !== 'conforme'));
  });

  it('rattache chaque point de contrôle à un fondement textuel', () => {
    const dossier = dossierConforme();
    const rapport = detecterIrregularites(dossier, analyserDossier(dossier));

    for (const point of rapport.points) {
      assert.ok(point.fondement.reference.length > 0, `${point.id} sans fondement`);
      assert.ok(point.fondement.source?.url.startsWith('https://'), `${point.id} sans URL de source`);
    }
  });
});
