/**
 * M8 + pack de sources — les neuf livrables, leurs mentions imposées, la
 * résolution des références, et le passage par la gate.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { completerDossierPenal, type DossierPenal } from '../modele';
import { executerChaine } from '../orchestrateur';
import { LIBELLES_LIVRABLE, genererLivrable, type TypeLivrable } from '../livrables';
import type { TrameCabinet } from '../consignes';
import { construirePack, lirePack, resoudreReference, type SourceRecuperee } from '../sources';

function dossier(): DossierPenal {
  return completerDossierPenal(
    {
      reference: 'LIV-001',
      qualifications: ['transport de produits stupéfiants'],
      regime: 'droit-commun',
      pieces: [{ id: 'P1', cote: 'D12', nature: 'proces-verbal', intitule: 'PV', date: '2026-03-14' }],
      evenements: [
        { id: 'E1', nature: 'debut-garde-a-vue', horodatage: '2026-03-14T08:00', description: 'Placement', sourcePieceId: 'P1' },
        { id: 'E2', nature: 'notification-droits', horodatage: '2026-03-14T12:00', description: 'Droits tardifs', sourcePieceId: 'P1' },
        { id: 'E3', nature: 'audition', horodatage: '2026-03-14T13:00', description: 'Audition', sourcePieceId: 'P1' },
      ],
    },
    { natures: ['detention-transport'], statutLiberte: 'detention-provisoire' }
  );
}

const SOURCE: SourceRecuperee = {
  identifiant: 'CPP, art. 63-1',
  date: '2026-01-01',
  source: 'Légifrance',
  url: 'https://www.legifrance.gouv.fr/exemple',
  recupereLe: '2026-08-20',
  type: 'texte',
  contenu: 'Texte tel que rendu par la source.',
  depuisCache: false,
};

const TYPES: TypeLivrable[] = [
  'synthese', 'grille', 'requete-nullite', 'conclusions', 'plaidoirie',
  'mise-en-liberte', 'actes-a-solliciter', 'questionnaire-client', 'rapport-ancrage',
];

describe('M8 — cadre commun des neuf livrables', () => {
  const chaine = executerChaine(dossier(), { maintenant: '2026-08-20T08:00:00Z' });

  it('porte la mention « projet » en tête ET en pied, et les vérifications', () => {
    for (const type of TYPES) {
      const livrable = genererLivrable(type, chaine);
      const lignes = livrable.corps.split('\n');
      assert.match(lignes[0], /PROJET — à vérifier, compléter et signer par l'avocat/, type);
      assert.match(lignes[lignes.length - 1], /PROJET — à vérifier/, type);
      assert.ok(livrable.corps.includes('Vérifications indispensables avant dépôt'), type);
    }
  });

  it('les manques apparaissent en zone visible, jamais absents', () => {
    const synthese = genererLivrable('synthese', chaine);
    assert.match(synthese.corps, /CE QUI MANQUE AU DOSSIER/);
  });

  it('un moyen sans source porte la mention imposée', () => {
    const nullite = genererLivrable('requete-nullite', chaine);
    assert.match(nullite.corps, /fondement à vérifier auprès de la source officielle/);
  });

  it('une référence résolue s’affiche avec ses cinq métadonnées', () => {
    const chaineAvecRef = executerChaine(dossier(), { maintenant: '2026-08-20T08:00:00Z' });
    chaineAvecRef.moyens[0].references = ['CPP, art. 63-1'];
    const livrable = genererLivrable('requete-nullite', chaineAvecRef, { sources: [SOURCE] });
    assert.match(livrable.corps, /CPP, art\. 63-1 \(Légifrance, 2026-01-01, https:\/\/www\.legifrance\.gouv\.fr\/exemple, récupéré le 2026-08-20\)/);
  });

  it('chaque livrable passe par la gate et en porte le verdict', () => {
    for (const type of TYPES) {
      const livrable = genererLivrable(type, chaine);
      assert.ok(livrable.verdict, `${type} : verdict absent`);
      // Le dossier de test est sain : la gate doit laisser passer.
      assert.equal(livrable.verdict.autorise, true, `${type} bloqué : ${JSON.stringify(livrable.verdict.anomalies[0] ?? '')}`);
    }
  });

  it('la nullité rend le dispositif PAR CES MOTIFS et les moyens en quatre temps', () => {
    const nullite = genererLivrable('requete-nullite', chaine);
    assert.match(nullite.corps, /PAR CES MOTIFS/);
    assert.match(nullite.corps, /\*\*Appuis :\*\*/);
    assert.match(nullite.corps, /\*\*Conséquence recherchée :\*\*/);
    assert.match(nullite.corps, /Riposte prévisible/);
  });

  it('aucun livrable ne contient de pronostic chiffré', () => {
    for (const type of TYPES) {
      const livrable = genererLivrable(type, chaine);
      assert.ok(!/\d+\s*%/.test(livrable.corps), `${type} contient un pourcentage`);
    }
  });

  it('le rapport d’ancrage liste les appuis de chaque énoncé', () => {
    const rapport = genererLivrable('rapport-ancrage', chaine);
    assert.match(rapport.corps, /\[direct\]/);
    assert.match(rapport.corps, /appuis :/);
    assert.match(rapport.corps, /elle ne se dépose pas/i);
  });

  it('la demande de mise en liberté vérifie le statut avant de rédiger', () => {
    const libre = completerDossierPenal(
      { reference: 'X', qualifications: [], regime: 'droit-commun', pieces: [], evenements: [] },
      { statutLiberte: 'libre' }
    );
    const chaineLibre = executerChaine(libre, { maintenant: '2026-08-20T08:00:00Z' });
    const dml = genererLivrable('mise-en-liberte', chaineLibre);
    assert.match(dml.corps, /suppose une détention provisoire/);
  });
});

describe('pack de sources (§9.2)', () => {
  it('fait l’aller-retour construire → lire', () => {
    const pack = construirePack([SOURCE], '2026-08-20T08:00:00Z');
    const relu = lirePack(JSON.stringify(pack));
    assert.ok(relu.ok);
    if (relu.ok) {
      assert.equal(relu.sources.length, 1);
      assert.equal(relu.rejetees.length, 0);
    }
  });

  it('rejette une entrée incomplète EN NOMMANT ce qui manque, sans refuser le pack', () => {
    const pack = construirePack([SOURCE, { ...SOURCE, identifiant: 'CPP, art. 76', url: '', recupereLe: '' }]);
    const relu = lirePack(JSON.stringify(pack));
    assert.ok(relu.ok);
    if (relu.ok) {
      assert.equal(relu.sources.length, 1);
      assert.equal(relu.rejetees.length, 1);
      assert.match(relu.rejetees[0].motif, /URL officielle/);
      assert.match(relu.rejetees[0].motif, /horodatage de récupération/);
    }
  });

  it('refuse un fichier qui n’est pas un pack, ou d’une autre version', () => {
    assert.equal(lirePack('{"type":"autre"}').ok, false);
    const pack = construirePack([SOURCE]);
    assert.equal(lirePack(JSON.stringify({ ...pack, version: '9' })).ok, false);
  });

  it('résout une référence, insensible à la casse, et rend null sinon', () => {
    assert.ok(resoudreReference('cpp, ART. 63-1', [SOURCE]));
    assert.equal(resoudreReference('CPP, art. 76', [SOURCE]), null);
  });

  it("LIBELLES_LIVRABLE couvre les neuf types", () => {
    assert.equal(Object.keys(LIBELLES_LIVRABLE).length, 9);
  });
});

describe('trames du cabinet (M11) — substitution dans les livrables', () => {
  const chaine = executerChaine(dossier(), { maintenant: '2026-08-20T08:00:00Z' });

  const trame = (surcharge: Partial<TrameCabinet> = {}): TrameCabinet => ({
    id: 't-conclusions1',
    intitule: 'Conclusions type du cabinet',
    type: 'conclusions',
    corps: 'POUR : [[INITIALES]]\nDossier [[REFERENCE]], devant [[JURIDICTION]]\n\nPLAISE AU TRIBUNAL\n\n[[CORPS]]\n\nSOUS TOUTES RÉSERVES',
    ajouteeLe: '2026-08-01T00:00:00Z',
    ...surcharge,
  });

  it('insère le corps généré à l’emplacement [[CORPS]] et remplit les métadonnées', () => {
    const livrable = genererLivrable('conclusions', chaine, { trames: [trame()] });
    assert.match(livrable.corps, /PLAISE AU TRIBUNAL/);
    assert.match(livrable.corps, /SOUS TOUTES RÉSERVES/);
    assert.match(livrable.corps, /Dossier LIV-001, devant \[À COMPLÉTER : juridiction\]/);
    // Le contenu généré est bien À L'INTÉRIEUR de la trame.
    assert.ok(
      livrable.corps.indexOf('PLAISE AU TRIBUNAL') < livrable.corps.indexOf('PAR CES MOTIFS'),
      'le corps généré doit suivre l’en-tête de la trame'
    );
    assert.ok(
      livrable.corps.indexOf('PAR CES MOTIFS') < livrable.corps.indexOf('SOUS TOUTES RÉSERVES'),
      'le pied de la trame doit suivre le corps généré'
    );
    assert.deepEqual(livrable.trameEmployee, { id: 't-conclusions1', intitule: 'Conclusions type du cabinet' });
  });

  it('le cadre PROJET et les vérifications survivent à toute trame', () => {
    const livrable = genererLivrable('conclusions', chaine, { trames: [trame()] });
    const lignes = livrable.corps.split('\n');
    assert.match(lignes[0], /PROJET — à vérifier/);
    assert.match(lignes[lignes.length - 1], /PROJET — à vérifier/);
    assert.match(livrable.corps, /Vérifications indispensables avant dépôt/);
    assert.match(livrable.corps, /La trame du cabinet employée est la bonne/);
  });

  it('nomme la trame employée dans le corps, en zone visible', () => {
    const livrable = genererLivrable('conclusions', chaine, { trames: [trame()] });
    assert.match(livrable.corps, /Trame du cabinet employée :\*\* Conclusions type du cabinet \(t-conclusions1/);
  });

  it('sans [[CORPS]], la trame devient un préambule — le contenu généré n’est jamais écrasé', () => {
    const sansEmplacement = trame({ corps: 'EN-TÊTE DU CABINET SEULEMENT' });
    const livrable = genererLivrable('conclusions', chaine, { trames: [sansEmplacement] });
    assert.match(livrable.corps, /EN-TÊTE DU CABINET SEULEMENT/);
    assert.match(livrable.corps, /PAR CES MOTIFS/);
  });

  it('la plus récente du type l’emporte ; les autres types sont ignorés', () => {
    const ancienne = trame({ id: 't-vieille', intitule: 'Ancienne', ajouteeLe: '2026-01-01T00:00:00Z' });
    const autreType = trame({ id: 't-nullite', intitule: 'Nullité type', type: 'requete-nullite' });
    const livrable = genererLivrable('conclusions', chaine, { trames: [ancienne, autreType, trame()] });
    assert.equal(livrable.trameEmployee?.id, 't-conclusions1');

    const sansTrame = genererLivrable('plaidoirie', chaine, { trames: [ancienne, autreType, trame()] });
    assert.equal(sansTrame.trameEmployee, null);
  });

  it('le rapport d’ancrage n’est JAMAIS habillé — c’est l’outil de contrôle', () => {
    const pourAncrage = trame({ type: 'rapport-ancrage', id: 't-ancrage' });
    const livrable = genererLivrable('rapport-ancrage', chaine, { trames: [pourAncrage] });
    assert.equal(livrable.trameEmployee, null);
    assert.ok(!livrable.corps.includes('PLAISE AU TRIBUNAL'));
  });

  it('une trame qui affirme la culpabilité est bloquée par la gate (B15)', () => {
    const fautive = trame({ corps: 'La culpabilité est acquise.\n\n[[CORPS]]' });
    const livrable = genererLivrable('conclusions', chaine, { trames: [fautive] });
    assert.equal(livrable.verdict.autorise, false);
    assert.ok(livrable.verdict.anomalies.some((a) => /culpabilité|B15/i.test(a.regle + a.detail)));
  });

  it('un corps ou une trame contenant $& reste littéral — aucune injection de motif', () => {
    const avecDollar = trame({ corps: 'Barème $& du cabinet\n[[CORPS]]' });
    const livrable = genererLivrable('conclusions', chaine, { trames: [avecDollar] });
    assert.match(livrable.corps, /Barème \$& du cabinet/);
  });
});
