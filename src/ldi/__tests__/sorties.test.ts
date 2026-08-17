import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { analyserPiece, SEUILS_DETECTION } from '../modules/detection-ia';
import { genererDocument } from '../modules/documents';
import { analyser, rendreMarkdown } from '../pipeline';
import type { Dossier, Piece } from '../types';

const dossier: Dossier = {
  reference: 'TEST-002',
  qualifications: ['CP, art. 222-37'],
  regime: 'droit-commun',
  pieces: [{ id: 'P1', nature: 'proces-verbal', intitule: 'PV de placement', date: '2026-03-14' }],
  evenements: [
    {
      id: 'E1',
      nature: 'debut-garde-a-vue',
      horodatage: '2026-03-14T08:00',
      description: 'Placement',
      sourcePieceId: 'P1',
    },
    {
      id: 'E2',
      nature: 'audition',
      horodatage: '2026-03-14T09:00',
      description: 'Audition n°1 sur les faits',
      sourcePieceId: 'P1',
    },
  ],
};

function piece(texte: string): Piece {
  return { id: 'PX', nature: 'expertise', intitule: 'Rapport', texte };
}

describe('analyserPiece', () => {
  it('refuse de conclure sous le seuil de mots exploitables', () => {
    const analyse = analyserPiece(piece('Le rapport conclut à la présence de traces.'));
    assert.equal(analyse.fiable, false);
    assert.match(analyse.conclusion, /trop court/);
    assert.match(analyse.conclusion, /Aucune conclusion/);
  });

  it('relève des signaux sur un texte artificiellement uniforme', () => {
    const phrase = 'En outre le rapport constate la présence de traces sur le support analysé. ';
    const analyse = analyserPiece(piece(phrase.repeat(60)));

    assert.equal(analyse.fiable, true);
    assert.ok(analyse.motsAnalyses >= SEUILS_DETECTION.motsMinimum);
    assert.ok(analyse.signauxDeclenches >= 3);
    assert.match(analyse.recommandation, /fichier natif/);
  });

  it("n'exprime jamais de probabilité sur l'auteur du texte", () => {
    const phrase = 'En outre le rapport constate la présence de traces sur le support analysé. ';
    const analyse = analyserPiece(piece(phrase.repeat(60)));

    const rendu = JSON.stringify(analyse);
    assert.ok(!/\d\s?%/.test(rendu), 'aucun pourcentage ne doit apparaître');
    assert.match(analyse.conclusion, /ne (?:signifie|établit|détermine)|justifie une vérification/);
  });

  it('énonce toujours la portée de chaque mesure', () => {
    const analyse = analyserPiece(piece('Mot '.repeat(400)));
    for (const signal of analyse.signaux) {
      assert.ok(signal.interpretation.length > 40, `${signal.id} sans interprétation`);
    }
  });
});

describe('pipeline', () => {
  it('produit un rapport complet et reproductible', () => {
    const a = analyser(dossier);
    const b = analyser(dossier);

    assert.equal(a.dossier.reference, 'TEST-002');
    assert.deepEqual(a.dossier.contradictions, b.dossier.contradictions);
    assert.deepEqual(a.nullites.points, b.nullites.points);
    assert.ok(a.limites.length >= 5);
  });

  it("n'exprime aucun pronostic chiffré, nulle part dans le rapport", () => {
    const rendu = JSON.stringify(analyser(dossier));
    assert.ok(!/"(?:chance|probabilite|probability)[^"]*"\s*:/i.test(rendu));
    assert.ok(!/\d{1,3}\s?%/.test(rendu), 'aucun pourcentage de succès ne doit être produit');
  });

  it('classe les axes du plus étayé au plus exploratoire', () => {
    const rang = { etayee: 0, plausible: 1, exploratoire: 2 } as const;
    const axes = analyser(dossier).strategie.axes;
    for (let i = 1; i < axes.length; i += 1) {
      assert.ok(rang[axes[i - 1].solidite] <= rang[axes[i].solidite]);
    }
  });

  it('rappelle la purge des nullités dans les risques', () => {
    const risques = analyser(dossier).strategie.risques.join(' ');
    assert.match(risques, /173/);
  });

  it('rend un markdown lisible qui porte ses limites', () => {
    const markdown = rendreMarkdown(analyser(dossier));
    assert.match(markdown, /# Rapport d'analyse/);
    assert.match(markdown, /## 8\. Limites de ce rapport/);
    assert.match(markdown, /n'est pas une consultation juridique/);
  });
});

describe('genererDocument', () => {
  it('balise tous les emplacements laissés à l’avocat', () => {
    const rapport = analyser(dossier);
    const doc = genererDocument('requete-nullite', rapport.dossier, rapport.strategie);

    assert.ok(doc.aCompleter.length >= 4);
    assert.ok(doc.corps.includes('[À COMPLÉTER'));
    assert.match(doc.corps, /doit être vérifié, complété et signé par\s+l'avocat/);
  });

  it('marque dans le corps du texte toute référence non vérifiée', () => {
    const rapport = analyser(dossier);
    const doc = genererDocument('requete-nullite', rapport.dossier, rapport.strategie);

    for (const reference of doc.referencesCitees) {
      if (reference.statut !== 'verifie') {
        assert.ok(
          doc.corps.includes(`${reference.reference} **[à vérifier`),
          `${reference.reference} citée sans marque de vérification`
        );
      }
    }
  });

  it("n'insère aucun numéro de pourvoi", () => {
    const rapport = analyser(dossier);
    for (const type of ['requete-nullite', 'memoire-defense', 'demande-mise-en-liberte', 'memoire-appel'] as const) {
      const doc = genererDocument(type, rapport.dossier, rapport.strategie);
      assert.ok(!/\b\d{2}-\d{2}\.\d{3}\b/.test(doc.corps), `${type} contient un numéro de pourvoi`);
    }
  });

  it('rappelle la règle de purge dans la requête en nullité', () => {
    const rapport = analyser(dossier);
    const doc = genererDocument('requete-nullite', rapport.dossier, rapport.strategie);
    assert.match(doc.corps, /moyens non soulevés dans la présente requête/);
    assert.match(doc.corps, /plus l'être ultérieurement/);
  });
});
