/**
 * Fiche « Pilote ClairDossier — assurance construction » (src/demo/construction/pilote.ts) :
 * chiffres exacts, deux décisions distinctes, aucune promesse, aucun nom de personne.
 */
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  PILOTE,
  PILOTE_DOSSIERS,
  PILOTE_PRIX,
  PILOTE_PRIX_PAR_DOSSIER,
  PILOTE_SEMAINES,
  PILOTE_TVA,
  piloteTextes,
} from '../src/demo/construction/pilote.ts';
import { formatEuro } from '../src/data/pricing.ts';

const PAGE = readFileSync(new URL('../src/pages/PiloteConstruction.tsx', import.meta.url), 'utf8');

test('prix, volume et durée exacts ; prix par dossier calculé', () => {
  assert.equal(PILOTE_PRIX, 1500);
  assert.equal(PILOTE_DOSSIERS, 50);
  assert.equal(PILOTE_SEMAINES, 6);
  assert.equal(PILOTE_PRIX_PAR_DOSSIER, 30);
  assert.equal(formatEuro(PILOTE_PRIX).replace(/\s/g, ' '), '1 500 €');
  assert.equal(formatEuro(PILOTE_PRIX_PAR_DOSSIER).replace(/\s/g, ' '), '30 €');
  assert.match(PILOTE.decision, /50 dossiers pendant 6 semaines/);
  assert.match(PILOTE.decision.replace(/\s/g, ' '), /1 500 €/);
  // 30 € n'est jamais écrit en dur : il découle des deux valeurs.
  assert.ok(!/=\s*30\b/.test(readFileSync(new URL('../src/demo/construction/pilote.ts', import.meta.url), 'utf8')));
});

test('prix écrit « HT » avec la mention 293 B ; même régime de TVA que /tarifs et les CGV', () => {
  assert.match(PILOTE.decision.replace(/\s/g, ' '), /1 500 € HT/);
  assert.match(PAGE, /unite="HT, pour le pilote"/);
  assert.match(PAGE, /HT par dossier/);
  assert.match(
    PILOTE_TVA.replace(/\s/g, ' '),
    /TVA non applicable, article 293 B du CGI \(franchise en base\) : le prix HT est le prix payé\./,
  );
  const legal = readFileSync(new URL('../src/data/legal.ts', import.meta.url), 'utf8');
  assert.match(legal, /TVA non applicable, article 293 B du Code général des impôts/);
});

test('le calendrier couvre les 6 semaines, sans trou ni chevauchement', () => {
  let next = 1;
  for (const p of PILOTE.calendrier) {
    assert.equal(p.debut, next, `${p.titre} doit commencer semaine ${next}`);
    assert.ok(p.fin >= p.debut);
    next = p.fin + 1;
  }
  assert.equal(next - 1, PILOTE_SEMAINES);
  assert.deepEqual(
    PILOTE.calendrier.map((p) => p.titre),
    ['Cadrage et trame commune', 'Traitement', 'Mesure et bilan'],
  );
});

test('deux décisions distinctes après le pilote : trame commune et licence réseau', () => {
  assert.equal(PILOTE.decisionsApres.length, 2);
  const [a, b] = PILOTE.decisionsApres.map((d) => d.titre);
  assert.notEqual(a, b);
  assert.match(a, /trame commune de rapport/i);
  assert.match(b, /licence réseau/i);
  assert.match(PILOTE.decisionsNote, /distinctes/);
});

test('périmètre : aucune conclusion, aucun envoi automatique, préalable contractuel', () => {
  const non = PILOTE.nePasFaire.join(' ');
  assert.match(non, /Aucune conclusion sur la cause, la responsabilité ou la garantie/);
  assert.match(non, /Aucun envoi automatique/);
  assert.match(PILOTE.prealable, /convention de pilote/);
  assert.match(PILOTE.prealable, /accord de sous-traitance des données/);
  assert.match(PILOTE.prealable, /avant le dépôt de la moindre pièce réelle/);
  // Formulation neutre : la convention fixe les modalités, les CG s'appliquent à défaut (pas d'exclusivité).
  assert.match(PILOTE.prealable, /modalités de traitement des pièces/);
  assert.match(PILOTE.prealable, /à défaut, nos conditions générales s'appliquent et excluent toute lecture automatique des documents/);
  assert.ok(!/de lui seul/.test(PILOTE.prealable));
  // Fidèle à la démo : inventaire numéroté et paginé, pas de classement par nature.
  assert.match(PILOTE.prepare[0], /inventaire des pièces du dossier/);
  assert.ok(!/par nature/.test(PILOTE.prepare.join(' ')));
});

test('aucune promesse dans les textes', () => {
  // « la garantie » (couverture d'assurance) n'est citée que comme exclue du périmètre.
  const PROMESSE = /garanti|économis(e|ez|erez|ons)\b|jusqu['’]à \d+ ?%|\bROI\b|\d+ ?% de (gain|temps)/i;
  for (const t of piloteTextes()) {
    if (/garantie/i.test(t)) assert.match(t, /^Aucune conclusion sur/, `« garantie » hors exclusion : ${t}`);
    const sansExclusion = t.replace(/la garantie\b/gi, '');
    assert.ok(!PROMESSE.test(sansExclusion), `promesse interdite : ${t}`);
  }
  assert.match(PILOTE.mesure.note, /Aucun gain n'est annoncé/);
  assert.equal(PILOTE.extension.intro, 'Seuils fixés ensemble au cadrage.');
});

test('aucun nom de personne : référents par rôle, aucune civilité, majuscules connues', () => {
  for (const r of PILOTE.referents) assert.deepEqual(Object.keys(r).sort(), ['mission', 'role']);
  const CIVILITE = /\b(M\.|Mme|Mlle|Me|Maître|Monsieur|Madame)\s/;
  // Mot à majuscule hors début de phrase : doit être connu (sinon, vérifier qu'il ne s'agit pas d'un nom).
  const CONNUS = new Set(['ClairDossier', 'TVA', 'HT', 'CGI', 'B', 'Service', 'Assistance', 'Aucun', 'Aucune']);
  for (const t of piloteTextes()) {
    assert.ok(!CIVILITE.test(t), `civilité : ${t}`);
    const milieu = t.replace(/(^|[.:;—]\s+)\p{Lu}[\p{L}'’-]*/gu, '$1');
    for (const mot of milieu.match(/(?<!\p{L})\p{Lu}[\p{L}'’-]*/gu) ?? []) {
      assert.ok(CONNUS.has(mot), `mot à majuscule inconnu (nom de personne ?) : « ${mot} » dans « ${t} »`);
    }
  }
});

test('la page lit la fiche, le contact officiel et expose les repères de test', () => {
  assert.match(PAGE, /from '\.\.\/demo\/construction\/pilote'/);
  assert.match(PAGE, /PHONE_DISPLAY/);
  assert.match(PAGE, /noindex/);
  assert.match(PAGE, /id="main"/);
  assert.match(PAGE, /window\.print\(\)/);
  assert.match(PAGE, /to="\/demo\/assurance-construction"/);
  for (const id of ['pilote-price', 'pilote-volume', 'pilote-duration', 'pilote-print']) {
    assert.match(PAGE, new RegExp(`"${id}"`), `data-testid ${id} manquant`);
  }
  assert.ok(!/\b(fetch|XMLHttpRequest|sendBeacon)\b/.test(PAGE), 'aucun appel réseau');
});

test('typographie française : jamais une ligne qui commence par « : » ou « ; »', () => {
  for (const t of piloteTextes()) assert.ok(!/ [;:!?]/.test(t), `espace sécable avant ponctuation double : ${t}`);
});
