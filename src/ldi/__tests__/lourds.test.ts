import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { ingerer } from '../ingestion/ingestion';
import { BORNES_DEFAUT, type FichierEntrant } from '../ingestion/types';

const texteDesPages = (p: { texte: string }[]) => p.map((x) => x.texte).join('\n');

describe('chargement paresseux des dépendances lourdes', () => {
  it("n'importe pdfjs et postal-mime que dynamiquement", () => {
    const source = readFileSync('src/ldi/ingestion/lourds.ts', 'utf-8');
    for (const dep of ['pdfjs-dist', 'postal-mime']) {
      assert.ok(
        !new RegExp(`^import .*from '${dep}`, 'm').test(source),
        `${dep} est importé statiquement : il entrerait dans le bundle initial`
      );
      assert.ok(source.includes(`await import('${dep}`), `${dep} doit être chargé par import()`);
    }
  });

  it('ne référence aucune dépendance lourde depuis le noyau', () => {
    for (const f of ['src/ldi/ingestion/ingestion.ts', 'src/ldi/pipeline.ts', 'src/ldi/atelier.ts']) {
      const s = readFileSync(f, 'utf-8');
      for (const dep of ['pdfjs-dist', 'postal-mime', 'tesseract']) {
        assert.ok(
          !new RegExp(`from '${dep}|import\\('${dep}|require\\('${dep}`).test(s),
          `${f} importe ${dep}`
        );
      }
    }
  });

  it("n'est lui-même importé que par import() dynamique", () => {
    // Un seul `import { completerLourds } from './lourds'` statique quelque
    // part dans l'application suffirait à faire entrer 128 Ko gz dans le
    // bundle initial. Le découpage tiendrait toujours à la compilation, mais
    // le navigateur téléchargerait tout au premier écran, et personne ne s'en
    // apercevrait avant de mesurer.
    const fautifs: string[] = [];

    const parcourir = (repertoire: string): void => {
      for (const entree of readdirSync(repertoire, { withFileTypes: true })) {
        const chemin = join(repertoire, entree.name);
        if (entree.isDirectory()) {
          parcourir(chemin);
        } else if (/\.tsx?$/.test(entree.name) && !chemin.includes('ingestion')) {
          const source = readFileSync(chemin, 'utf-8');
          if (/^import\s[^;]*from\s+'[^']*lourds'/m.test(source)) fautifs.push(chemin);
        }
      }
    };

    parcourir('src');
    assert.deepEqual(fautifs, [], `import statique de lourds : ${fautifs.join(', ')}`);
  });
});

// ── Second passage : ce que l'ingestion synchrone a laissé de côté ────────

describe('completerLourds — courriels', () => {
  const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
  const eml = (): FichierEntrant => ({
    nom: 'courriel.eml',
    chemin: '',
    octets: new Uint8Array(readFileSync(join(FIXTURES, 'courriel.eml'))),
  });

  it('lit en-têtes et corps, et lève la quarantaine', async () => {
    const { completerLourds } = await import('../ingestion/lourds');
    const resultat = await completerLourds(ingerer([eml()]), BORNES_DEFAUT);
    const [message] = resultat.pieces;

    assert.equal(message.format, 'courriel');
    assert.match(message.pages[0].texte, /greffe@exemple\.fr/);
    assert.match(message.pages[0].texte, /Communication de pieces/);
    assert.match(message.pages[0].texte, /audience est fixee au 12 mars 2025/);
    assert.equal(message.pages[0].quarantaine, false);
  });

  it('extrait réellement le contenu des pièces jointes', async () => {
    const { completerLourds } = await import('../ingestion/lourds');
    const resultat = await completerLourds(ingerer([eml()]), BORNES_DEFAUT);
    const [jointe] = resultat.pieces[0].derivees;

    assert.equal(jointe.nomFichier, 'bordereau-greffe.csv');
    assert.equal(jointe.format, 'csv');
    // Une pièce jointe annoncée « pièce à part entière » doit être LUE, pas
    // seulement détachée : sinon le bordereau la compte sans la connaître.
    assert.match(texteDesPages(jointe.pages), /Proces-verbal/);
    assert.equal(jointe.pages.every((p) => p.quarantaine), false);
  });

  it('compte la pièce jointe dans les compteurs', async () => {
    const { completerLourds } = await import('../ingestion/lourds');
    const resultat = await completerLourds(ingerer([eml()]), BORNES_DEFAUT);

    assert.equal(resultat.compteurs.pieces, 2);
    assert.equal(resultat.compteurs.pagesEnQuarantaine, 0);
  });

  it('donne une cote à la pièce jointe, dérivée de celle du message', async () => {
    const { completerLourds } = await import('../ingestion/lourds');
    const { mettreEnEtat } = await import('../ingestion/mise-en-etat');
    const resultat = await completerLourds(ingerer([eml()]), BORNES_DEFAUT);
    const fiches = mettreEnEtat(resultat.pieces);

    // Deux pièces comptées, deux lignes au bordereau : un tableau qui en
    // montrerait une de moins que la tuile serait un écran qui ment.
    assert.equal(fiches.length, 2);
    assert.deepEqual(fiches.map((f) => f.cote.valeur), ['D1', 'D1.1']);
  });

  it('ne fait pas tomber le lot sur un courriel illisible', async () => {
    const { completerLourds } = await import('../ingestion/lourds');
    const casse: FichierEntrant = {
      nom: 'tronque.eml',
      chemin: '',
      octets: new Uint8Array([0x53, 0x75, 0x62, 0x6a]), // « Subj », rien de plus
    };
    const resultat = await completerLourds(ingerer([casse, eml()]), BORNES_DEFAUT);

    assert.equal(resultat.pieces.length, 2);
    assert.match(texteDesPages(resultat.pieces[1].pages), /greffe@exemple\.fr/);
  });
});
