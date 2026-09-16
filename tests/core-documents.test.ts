/**
 * packages/core — pièces : classification, validation, doublons, chemins.
 * Ces règles pilotent ce qui est écrit en base par le SITE et par
 * l'APPLICATION MOBILE : une divergence corromprait les données.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCEPTED_EXTENSIONS,
  CATEGORY_LABELS,
  MAX_FILE_BYTES,
  classifyFileName,
  duplicateWarning,
  effectiveCategory,
  formatBytes,
  groupByCategory,
  sanitizeFileName,
  storagePath,
  validateUploadMeta,
} from '../packages/core/src/index';

test('classification : le nom de fichier suffit, accents et casse ignorés', () => {
  assert.equal(classifyFileName('Facture_2026-014.pdf'), 'factures');
  assert.equal(classifyFileName('MISE-EN-DEMEURE.pdf'), 'courriers');
  assert.equal(classifyFileName('Contrat de bail.docx'), 'contrats');
  assert.equal(classifyFileName('Devis n°3.pdf'), 'devis');
  assert.equal(classifyFileName('assignation-tgi.pdf'), 'procedure');
  assert.equal(classifyFileName('Relevé bancaire.pdf'), 'paiements');
  assert.equal(classifyFileName('KBIS.pdf'), 'administratif');
  assert.equal(classifyFileName('photo-4712.jpg'), 'autres');
});

test('classification : chaque catégorie retournée a un libellé', () => {
  for (const name of ['facture.pdf', 'inconnu.bin', 'contrat.pdf', 'echange-mail.pdf']) {
    assert.ok(CATEGORY_LABELS[classifyFileName(name)], `libellé manquant pour ${name}`);
  }
});

test('catégorie effective : la correction utilisateur prime, une valeur inconnue est ignorée', () => {
  assert.equal(effectiveCategory('facture.pdf', 'courriers'), 'courriers');
  assert.equal(effectiveCategory('facture.pdf', 'categorie-inexistante'), 'factures');
  assert.equal(effectiveCategory('facture.pdf', null), 'factures');
});

test('validation : extension, taille, fichier vide', () => {
  assert.equal(validateUploadMeta({ name: 'contrat.pdf', size: 1024 }), null);
  assert.match(String(validateUploadMeta({ name: 'virus.exe', size: 10 })), /format non accepté/);
  assert.match(String(validateUploadMeta({ name: 'gros.pdf', size: MAX_FILE_BYTES + 1 })), /trop volumineux/);
  assert.match(String(validateUploadMeta({ name: 'vide.pdf', size: 0 })), /vide/);
  for (const ext of ACCEPTED_EXTENSIONS) {
    assert.equal(validateUploadMeta({ name: `piece.${ext}`, size: 10 }), null);
  }
});

test('doublons : même nom (insensible à la casse) puis même taille, jamais bloquant', () => {
  const existing = [{ file_name: 'Facture.pdf', size_bytes: 2048 }];
  assert.match(String(duplicateWarning({ name: 'facture.PDF', size: 99 }, existing)), /même nom/);
  assert.match(String(duplicateWarning({ name: 'autre.pdf', size: 2048 }, existing)), /taille identique/);
  assert.equal(duplicateWarning({ name: 'autre.pdf', size: 7 }, existing), null);
  assert.equal(duplicateWarning({ name: 'autre.pdf', size: 0 }, [{ file_name: 'x.pdf', size_bytes: 0 }]), null);
});

test('chemin de stockage : le compte est TOUJOURS le premier segment (cloisonnement RLS)', () => {
  const path = storagePath('user-1', 'dossier-1', 'Mise en demeure (2).pdf', 1_700_000_000_000);
  assert.equal(path, 'user-1/dossier-1/1700000000000-Mise_en_demeure_2_.pdf');
  assert.equal(path.split('/')[0], 'user-1');
  assert.ok(!path.includes('..'), 'aucune remontée de chemin possible');
});

test('assainissement : caractères dangereux retirés, longueur bornée', () => {
  assert.equal(sanitizeFileName('../../etc/passwd'), '.._.._etc_passwd');
  assert.equal(sanitizeFileName('a'.repeat(200)).length, 80);
});

test('tailles : formatage français', () => {
  assert.equal(formatBytes(0), '');
  assert.equal(formatBytes(512), '512 o');
  assert.equal(formatBytes(2048), '2 Ko');
  assert.equal(formatBytes(1024 * 1024 * 3.5), '3,5 Mo');
});

test('regroupement : ordre des catégories respecté, pièces conservées', () => {
  const docs = [
    { file_name: 'photo.jpg', category: null },
    { file_name: 'facture.pdf', category: null },
    { file_name: 'contrat.pdf', category: null },
  ];
  const groups = groupByCategory(docs);
  assert.deepEqual(groups.map((g) => g.id), ['contrats', 'factures', 'autres']);
  assert.equal(groups.reduce((n, g) => n + g.items.length, 0), docs.length);
});
