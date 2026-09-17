#!/usr/bin/env node
/**
 * Publie les fichiers de liens universels sur le site, une fois les
 * identifiants connus (Team ID Apple, empreinte SHA-256 Android).
 *
 * Usage :
 *   node scripts/install-well-known.mjs --team-id ABCDE12345 --sha256 AA:BB:...
 *
 * Le script refuse d'écrire un fichier incomplet : mieux vaut aucun fichier
 * qu'un fichier invalide (la vérification Apple/Google échouerait en silence).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const mobileRoot = resolve(here, '..');
const siteRoot = resolve(mobileRoot, '..');

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : undefined;
}

const teamId = arg('team-id');
const sha256 = arg('sha256');

if (!teamId || !/^[A-Z0-9]{10}$/.test(teamId)) {
  console.error('✖ --team-id manquant ou invalide (10 caractères alphanumériques majuscules).');
  process.exit(1);
}
if (!sha256 || !/^([A-F0-9]{2}:){31}[A-F0-9]{2}$/i.test(sha256)) {
  console.error('✖ --sha256 manquant ou invalide (32 octets séparés par « : »).');
  process.exit(1);
}

const targetDir = resolve(siteRoot, 'public/.well-known');
mkdirSync(targetDir, { recursive: true });

const aasa = readFileSync(resolve(mobileRoot, 'config/well-known/apple-app-site-association.template.json'), 'utf8')
  .replaceAll('__TEAM_ID__', teamId);
const assetlinks = readFileSync(resolve(mobileRoot, 'config/well-known/assetlinks.template.json'), 'utf8')
  .replaceAll('__SHA256__', sha256.toUpperCase());

JSON.parse(aasa);
JSON.parse(assetlinks);

// Apple exige un fichier SANS extension, servi en application/json.
writeFileSync(resolve(targetDir, 'apple-app-site-association'), aasa);
writeFileSync(resolve(targetDir, 'assetlinks.json'), assetlinks);

console.log('✔ public/.well-known/apple-app-site-association');
console.log('✔ public/.well-known/assetlinks.json');
console.log('→ Déployez le site (push sur main) puis vérifiez les deux URL en HTTPS.');
