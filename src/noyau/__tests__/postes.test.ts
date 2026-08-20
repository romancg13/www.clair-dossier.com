/**
 * Grille de régularité — M3, le module central.
 *
 * Le test qui compte : les QUATORZE postes sortent pour TOUT dossier, y
 * compris vide, et chacun rend constat, grief ou manque — jamais un silence.
 * C'est la couverture exigée par §10.1 (« un des 14 postes n'est pas couvert
 * pour un dossier donné » = échec).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyserDossier } from '../../ldi/modules/chronologie';
import { detecterIrregularites } from '../../ldi/modules/nullites';
import type { Dossier } from '../../ldi/types';
import { completerDossierPenal, type DossierPenal, type ExtensionPenale } from '../modele';
import { executerP2, grilleRegularite } from '../postes';

function construire(base: Partial<Dossier> = {}, extension: Partial<ExtensionPenale> = {}): DossierPenal {
  return completerDossierPenal(
    {
      reference: 'POSTES-001',
      qualifications: [],
      regime: 'droit-commun',
      pieces: [],
      evenements: [],
      ...base,
    },
    extension
  );
}

function grille(dossier: DossierPenal) {
  const analyse = analyserDossier(dossier);
  const nullites = detecterIrregularites(dossier, analyse);
  return grilleRegularite(dossier, analyse, nullites);
}

describe('grille — couverture sans silence', () => {
  it('rend les 14 postes, dans l’ordre, sur un dossier VIDE', () => {
    const postes = grille(construire());
    assert.equal(postes.length, 14);
    assert.deepEqual(postes.map((p) => p.numero), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]);
    for (const poste of postes) {
      assert.ok(['constat', 'grief', 'manque'].includes(poste.synthese), `${poste.id} : synthèse invalide`);
      assert.ok(poste.constat.trim().length > 20, `${poste.id} : le constat doit dire quelque chose`);
      assert.ok(poste.attendu.length >= 2, `${poste.id} : « ce qui doit figurer » doit être énoncé`);
    }
  });

  it('un poste sans matière DIT qu’il est sans matière, il ne se tait pas', () => {
    const postes = grille(construire());
    const techniques = postes.find((p) => p.id === 'MESURES-TECHNIQUES')!;
    assert.match(techniques.constat, /Aucune mesure technique recensée/);
    const detention = postes.find((p) => p.id === 'DETENTION')!;
    assert.match(detention.constat, /n'est pas en détention provisoire/);
  });
});

describe('grille — versement des contrôles calculés', () => {
  it('une anomalie de garde à vue remonte comme grief au poste 3', () => {
    const dossier = construire({
      pieces: [{ id: 'P1', cote: 'D1', nature: 'proces-verbal', intitule: 'PV' }],
      evenements: [
        { id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00', description: 'Placement', sourcePieceId: 'P1' },
        // Notification des droits 4 h après le placement : anomalie GAV-02.
        { id: 'E2', nature: 'notification-droits', horodatage: '2026-03-14T12:00', description: 'Notification', sourcePieceId: 'P1' },
        { id: 'E3', nature: 'audition', horodatage: '2026-03-14T13:00', description: 'Audition', sourcePieceId: 'P1' },
      ],
    });
    const postes = grille(dossier);
    const gav = postes.find((p) => p.id === 'GARDE-A-VUE')!;

    assert.equal(gav.synthese, 'grief');
    assert.ok(gav.griefs.some((g) => g.enonce.includes('GAV-02')));
    // Le grief est ancré sur les événements de la mesure.
    for (const g of gav.griefs) assert.ok(g.appuis.length > 0, 'un grief sans appui ne vaut rien');
  });
});

describe('grille — autorisations et propagation', () => {
  const avecActes = () =>
    construire(
      { pieces: [{ id: 'P1', cote: 'D5', nature: 'proces-verbal', intitule: 'PV' }] },
      {
        actes: [
          { id: 'A1', type: 'géolocalisation du véhicule', dateHeure: '2026-03-01T08:00', autoritePrescriptrice: 'parquet', autorisationPrealable: 'non', cotes: ['D5'], actesSubsequents: ['A2'] },
          { id: 'A2', type: 'interpellation', dateHeure: '2026-03-14T07:45', autoritePrescriptrice: 'OPJ', autorisationPrealable: 'oui', cotes: ['D5'], actesSubsequents: ['A3'] },
          { id: 'A3', type: 'perquisition', dateHeure: null, autoritePrescriptrice: 'OPJ', autorisationPrealable: 'inconnu', cotes: ['D5'], actesSubsequents: [] },
        ],
      }
    );

  it('une mesure technique sans autorisation produit un grief, avec les actes contaminés', () => {
    const postes = grille(avecActes());
    const technique = postes.find((p) => p.id === 'MESURES-TECHNIQUES')!;

    assert.equal(technique.synthese, 'grief');
    const grief = technique.griefs[0];
    assert.match(grief.enonce, /sans autorisation préalable/);
    // Propagation : A1 → A2 → A3.
    assert.deepEqual([...grief.actesAffectes].sort(), ['A2', 'A3']);
  });

  it('une autorisation inconnue produit un MANQUE bloquant, pas un grief', () => {
    const postes = grille(avecActes());
    const perq = postes.find((p) => p.id === 'PERQUISITIONS')!;
    const manqueAutorisation = perq.manques.find((m) => m.nature.includes('Autorisation préalable'));

    assert.ok(manqueAutorisation, "l'inconnu appelle un geste, pas une accusation");
    assert.equal(manqueAutorisation.criticite, 'bloquant');
    // Et l'acte non daté produit son propre manque.
    assert.ok(perq.manques.some((m) => m.nature.includes('Horodatage')));
  });

  it('la recevabilité signale l’intérêt à agir manquant (poste 14)', () => {
    const dossier = construire(
      {},
      {
        actes: [{ id: 'A1', type: 'perquisition', dateHeure: '2026-03-14T09:00', autoritePrescriptrice: 'OPJ', autorisationPrealable: 'non', cotes: [], actesSubsequents: [] }],
        griefs: [{ id: 'G1', acteViseId: 'A1', irregularite: 'x', interetAAgir: '', cotesAffectees: [], actesSubsequentsContamines: [], forclusionEventuelle: null, appuis: ['A1'] }],
      }
    );
    const recevabilite = grille(dossier).find((p) => p.id === 'RECEVABILITE')!;
    assert.ok(recevabilite.manques.some((m) => m.nature.includes('Intérêt à agir')));
    assert.ok(recevabilite.manques.some((m) => m.nature.includes('Forclusion')));
  });
});

describe('grille comme passe P2', () => {
  it('scelle une sortie ancrée et déclare les 14 postes traités', () => {
    const dossier = construire({
      pieces: [{ id: 'P1', cote: 'D1', nature: 'proces-verbal', intitule: 'PV' }],
      evenements: [
        { id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00', description: 'Placement', sourcePieceId: 'P1' },
        { id: 'E2', nature: 'notification-droits', horodatage: '2026-03-14T08:05', description: 'Droits', sourcePieceId: 'P1' },
      ],
    });
    const analyse = analyserDossier(dossier);
    const nullites = detecterIrregularites(dossier, analyse);
    const { sortie } = executerP2(dossier, analyse, nullites, '2026-08-19T12:00:00Z');

    assert.equal(sortie.passe, 'P2');
    assert.equal(sortie.traite.length, 14);
    for (const r of sortie.resultats) assert.notEqual(r.ancrage, 'absent');
    // Les manques de la grille remontent dans la déclaration.
    assert.ok(sortie.manques.length > 0);
  });
});
