/**
 * P1-09. La réponse du modèle porte-t-elle les huit sections que l'invite
 * impose ? Fonction pure, donc testable sans appel réseau.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SECTIONS_IMPOSEES, validerStructure } from '../reponse';

const CONFORME = `### CE QUI EST DEMANDÉ
x
### CE QUE DIT LE DOSSIER
x
### ANALYSE
x
### RÉSULTATS
x
### ⚠️ RISQUES POUR LE CLIENT
x
### DILIGENCES
x
### SOURCES
x
### LIMITES
x`;

describe('validerStructure', () => {
  it('accepte une réponse portant toutes les sections imposées', () => {
    const r = validerStructure(CONFORME);
    assert.equal(r.conforme, true);
    assert.deepEqual(r.sectionsManquantes, []);
  });

  it('nomme précisément les sections absentes', () => {
    const r = validerStructure('### ANALYSE\nx\n### SOURCES\ny');
    assert.equal(r.conforme, false);
    assert.ok(r.sectionsManquantes.includes('LIMITES'));
    assert.ok(r.sectionsManquantes.includes('DILIGENCES'));
    assert.ok(!r.sectionsManquantes.includes('ANALYSE'));
  });

  it('refuse une réponse vide plutôt que de la laisser passer', () => {
    const r = validerStructure('');
    assert.equal(r.conforme, false);
    assert.equal(r.sectionsManquantes.length, SECTIONS_IMPOSEES.length);
  });

  it('produit une consigne corrective exploitable pour une seconde tentative', () => {
    const r = validerStructure('### ANALYSE\nx');
    assert.ok(r.consigneCorrective.includes('LIMITES'));
    assert.match(r.consigneCorrective, /section/i);
  });

  it("tolère les variations d'accentuation et de casse des titres", () => {
    const r = validerStructure(CONFORME.replace('### LIMITES', '### limites'));
    assert.equal(r.conforme, true);
  });

  it('reconnaît un titre accentué écrit sans ses accents', () => {
    // « RÉSULTATS » écrit « Resultats » : le modèle a rendu la section, il l'a
    // seulement mal orthographiée. Ce n'est pas un défaut de structure.
    const r = validerStructure(CONFORME.replace('### RÉSULTATS', '### Resultats'));
    assert.equal(r.conforme, true, r.sectionsManquantes.join(', '));
  });

  it("accepte un titre en gras plutôt qu'en markdown", () => {
    const gras = CONFORME.split('\n')
      .map((l) => (l.startsWith('### ') ? `**${l.slice(4)}**` : l))
      .join('\n');
    assert.equal(validerStructure(gras).conforme, true);
  });

  it("n'accepte pas une section seulement évoquée dans un paragraphe", () => {
    // Le mot « LIMITES » écrit au fil du texte ne remplace pas la rubrique.
    const r = validerStructure(CONFORME.replace('### LIMITES\nx', 'Voir plus haut les LIMITES.'));
    assert.equal(r.conforme, false);
    assert.deepEqual(r.sectionsManquantes, ['LIMITES']);
  });
});
