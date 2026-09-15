import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  classifyFileName,
  deadlineStatus,
  effectiveCategory,
  isGenericTitle,
  validateUpload,
} from '../src/lib/dossier-workspace.ts';

test('classification déterministe par nom de fichier', () => {
  assert.equal(classifyFileName('Facture F-2026-042.pdf'), 'factures');
  assert.equal(classifyFileName('devis-signe.pdf'), 'devis');
  assert.equal(classifyFileName('Contrat de sous-traitance.docx'), 'contrats');
  assert.equal(classifyFileName('Courrier recommandé AR.pdf'), 'courriers');
  assert.equal(classifyFileName('mise_en_demeure_v2.pdf'), 'courriers');
  assert.equal(classifyFileName('E-mail accord 12 sept.txt'), 'emails');
  assert.equal(classifyFileName('assignation-tribunal.pdf'), 'procedure');
  assert.equal(classifyFileName('releve-virement-oct.pdf'), 'paiements');
  assert.equal(classifyFileName('Extrait Kbis client.pdf'), 'administratif');
  assert.equal(classifyFileName('photo-chantier.jpg'), 'autres');
});

test('la correction utilisateur prime sur la règle', () => {
  assert.equal(effectiveCategory('facture.pdf', 'contrats'), 'contrats');
  assert.equal(effectiveCategory('facture.pdf', null), 'factures');
  assert.equal(effectiveCategory('facture.pdf', 'categorie-inconnue'), 'factures');
});

test('statut des échéances', () => {
  const today = new Date('2026-09-15T12:00:00');
  assert.equal(deadlineStatus('2026-09-14', false, today), 'retard');
  assert.equal(deadlineStatus('2026-09-15', false, today), 'a-venir'); // jusqu'à 23 h 59
  assert.equal(deadlineStatus('2026-10-01', false, today), 'a-venir');
  assert.equal(deadlineStatus('2026-09-01', true, today), 'terminee');
});

test('titres génériques détectés (catégorie utilisée comme titre)', () => {
  assert.equal(isGenericTitle(null), true);
  assert.equal(isGenericTitle('  '), true);
  assert.equal(isGenericTitle('Autre'), true);
  assert.equal(isGenericTitle('Facture / paiement'), true);
  assert.equal(isGenericTitle('Recouvrement honoraires — Société X'), false);
});

test("validation d'upload : format, taille, fichier vide", () => {
  const ok = new File([new Uint8Array(10)], 'devis.pdf');
  assert.equal(validateUpload(ok), null);
  const badExt = new File([new Uint8Array(10)], 'script.exe');
  assert.match(validateUpload(badExt) ?? '', /format non accepté/);
  const empty = new File([], 'vide.pdf');
  assert.match(validateUpload(empty) ?? '', /vide/);
  const big = new File([new Uint8Array(26 * 1024 * 1024)], 'gros.pdf');
  assert.match(validateUpload(big) ?? '', /volumineux/);
});

test('détection de doublons documentaires', async () => {
  const { duplicateWarning } = await import('../src/lib/dossier-workspace.ts');
  const existing = [
    { file_name: 'Devis signé.pdf', size_bytes: 1200 },
    { file_name: 'facture.pdf', size_bytes: 800 },
  ];
  assert.match(duplicateWarning({ name: 'devis signé.PDF', size: 999 }, existing) ?? '', /même nom/);
  assert.match(duplicateWarning({ name: 'autre.pdf', size: 800 }, existing) ?? '', /taille identique/);
  assert.equal(duplicateWarning({ name: 'nouveau.pdf', size: 555 }, existing), null);
  assert.equal(duplicateWarning({ name: 'vide.pdf', size: 0 }, existing), null);
});
