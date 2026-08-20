/**
 * Non-régression sur les interdits (§10.1) — la suite échoue si l'un des
 * garde-fous du mandat disparaît. Chaque test nomme la règle qu'il tient.
 *
 * Ces tests balaient les SOURCES : ils attrapent la régression au commit,
 * pas à l'audience.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

import { completerDossierPenal } from '../modele';
import { executerChaine } from '../orchestrateur';
import { grilleRegularite } from '../postes';
import { analyserDossier } from '../../ldi/modules/chronologie';
import { detecterIrregularites } from '../../ldi/modules/nullites';
import { genererLivrable, type TypeLivrable } from '../livrables';
import { importerDossier } from '../serialisation';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Retire commentaires de ligne et de bloc : un exemple documenté n'est pas une donnée. */
function sansCommentaires(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
}

function sources(repertoire: string, exclure: RegExp = /$^/): string[] {
  const resultat: string[] = [];
  for (const entree of readdirSync(repertoire, { withFileTypes: true })) {
    const chemin = join(repertoire, entree.name);
    if (exclure.test(chemin)) continue;
    if (entree.isDirectory()) resultat.push(...sources(chemin, exclure));
    else if (/\.(tsx?|css|html)$/.test(entree.name)) resultat.push(chemin);
  }
  return resultat;
}

describe('interdits — sources du dépôt', () => {
  it('aucun numéro de pourvoi en dur hors tests et fixtures (B1/B2)', () => {
    for (const fichier of sources(join(RACINE, 'src'), /__tests__|fixtures/)) {
      const s = sansCommentaires(readFileSync(fichier, 'utf-8'));
      assert.ok(
        !/\b\d{2}-\d{2}\.\d{3}\b/.test(s),
        `${fichier.slice(RACINE.length + 1)} : numéro de pourvoi en dur`
      );
    }
  });

  it('aucune police ni script chargé depuis un domaine externe (B10)', () => {
    const balaye = [...sources(join(RACINE, 'src')), join(RACINE, 'index.html')];
    for (const fichier of balaye) {
      const s = readFileSync(fichier, 'utf-8');
      for (const motif of [/https?:\/\/fonts\./i, /https?:\/\/cdn\./i, /<script[^>]+src=["']https?:/i, /@import\s+url\(["']?https?:/i]) {
        assert.ok(!motif.test(s), `${fichier.slice(RACINE.length + 1)} : ressource externe`);
      }
    }
  });

  it('aucun secret ni variable VITE_ dans les sources (B8)', () => {
    for (const fichier of sources(join(RACINE, 'src'))) {
      const s = readFileSync(fichier, 'utf-8');
      assert.ok(!/import\.meta\.env\.VITE_/.test(s), `${fichier.slice(RACINE.length + 1)} : variable VITE_ lue — elle serait inlinée dans le bundle`);
      assert.ok(!/sk-ant-[a-zA-Z0-9]/.test(s), `${fichier.slice(RACINE.length + 1)} : clé d'API en dur`);
    }
  });

  it("l'interface n'importe jamais le module réseau `piste` ni `moteur` (B7/B8)", () => {
    for (const fichier of sources(join(RACINE, 'src', 'components'))) {
      const s = readFileSync(fichier, 'utf-8');
      assert.ok(!/from '[^']*(piste|noyau\/moteur)'/.test(s), `${fichier.slice(RACINE.length + 1)} : import réseau dans l'interface`);
    }
  });
});

describe('interdits — comportement', () => {
  const dossierDemo = () => {
    const resultat = importerDossier(readFileSync(join(RACINE, 'examples', 'dossier-demonstration.json'), 'utf-8'));
    if (!resultat.ok) throw new Error(resultat.message);
    return resultat.dossier;
  };

  it('aucune sortie de livrable ne contient un pourcentage (B4)', () => {
    const chaine = executerChaine(dossierDemo(), { maintenant: '2026-08-20T08:00:00Z' });
    const TYPES: TypeLivrable[] = ['synthese', 'grille', 'requete-nullite', 'conclusions', 'plaidoirie', 'mise-en-liberte', 'actes-a-solliciter', 'questionnaire-client', 'rapport-ancrage'];
    for (const type of TYPES) {
      const livrable = genererLivrable(type, chaine);
      assert.ok(!/\d+\s*%/.test(livrable.corps), `${type} : pourcentage`);
      assert.ok(!/est\s+coupable|est\s+innocent/i.test(livrable.corps), `${type} : affirmation de culpabilité (B15)`);
    }
  });

  it('les quatorze postes sont couverts pour TOUT dossier — y compris vide (§10.1)', () => {
    for (const dossier of [
      dossierDemo(),
      completerDossierPenal({ reference: 'VIDE', qualifications: [], regime: 'droit-commun', pieces: [], evenements: [] }),
    ]) {
      const analyse = analyserDossier(dossier);
      const postes = grilleRegularite(dossier, analyse, detecterIrregularites(dossier, analyse));
      assert.equal(postes.length, 14, `${dossier.reference} : ${postes.length} postes`);
      for (const poste of postes) {
        assert.ok(['constat', 'grief', 'manque'].includes(poste.synthese), `${dossier.reference}/${poste.id} : silence`);
      }
    }
  });

  it("le parcours de démonstration traverse la chaîne et exporte (bout en bout)", () => {
    const chaine = executerChaine(dossierDemo(), { maintenant: '2026-08-20T08:00:00Z' });
    assert.equal(chaine.verdictP6.conforme, true, chaine.verdictP6.divergences.join(' | '));

    const requete = genererLivrable('requete-nullite', chaine);
    assert.equal(requete.verdict.autorise, true, JSON.stringify(requete.verdict.anomalies[0] ?? ''));
    assert.match(requete.corps, /PAR CES MOTIFS/);
    assert.match(requete.corps, /Riposte prévisible/);

    const ancrage = genererLivrable('rapport-ancrage', chaine);
    assert.equal(ancrage.verdict.autorise, true);
    // Le dossier de démonstration se présente comme fictif, partout.
    assert.match(readFileSync(join(RACINE, 'examples', 'dossier-demonstration.json'), 'utf-8'), /fictif/i);
  });

  it('des fragments de deux dossiers ne partagent jamais un univers d’ancrage (B18)', async () => {
    const { identifiantsConnus } = await import('../passes');
    const a = completerDossierPenal({ reference: 'A', qualifications: [], regime: 'droit-commun', pieces: [{ id: 'PA', nature: 'proces-verbal', intitule: 'x' }], evenements: [] });
    const b = completerDossierPenal({ reference: 'B', qualifications: [], regime: 'droit-commun', pieces: [{ id: 'PB', nature: 'proces-verbal', intitule: 'x' }], evenements: [] });

    // L'univers d'un dossier ne contient RIEN de l'autre : un énoncé de B
    // appuyé sur une pièce de A serait rejeté comme non ancré.
    assert.equal(identifiantsConnus(a).has('PB'), false);
    assert.equal(identifiantsConnus(b).has('PA'), false);
  });
});
