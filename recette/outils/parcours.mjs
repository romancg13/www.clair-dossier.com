// Parcours réel dans un navigateur (Playwright) contre une URL de recette.
// Usage : node recette/outils/parcours.mjs <url> <dossier-captures>
// Mesure : dépôt → premier résultat → fin ; vérifie l'absence de geste admin et la reprise après fermeture.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const [base, out = 'captures-parcours'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'fr-FR', timezoneId: 'Europe/Paris', reducedMotion: 'reduce' });
let page = await ctx.newPage();
const errors = [];
const watch = (p) => { p.on('pageerror', (e) => errors.push(String(e).slice(0, 200))); p.on('console', (m) => m.type() === 'error' && errors.push(m.text().slice(0, 200))); };
watch(page);
const res = {};

// 1. Accueil
await page.goto(`${base}/`, { waitUntil: 'networkidle' });
res.h1 = await page.locator('h1').first().innerText();
await page.screenshot({ path: `${out}/1-accueil-390.png` });
// 2. Sans abonnement → offres
await page.goto(`${base}/connexion`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: 'Sans abonnement' }).click();
await page.waitForURL(/\/tarifs/);
res.sans_abonnement_redirige = page.url().replace(base, '');
await page.screenshot({ path: `${out}/2-tarifs-390.png`, fullPage: true });
const refus = await page.evaluate(async () => (await fetch('/api/dossiers', { method: 'POST', headers: { 'x-clairdossier': '1', 'content-type': 'application/json' }, body: JSON.stringify({ titre: 'x' }) })).status);
res.creation_sans_abonnement = refus;
// 3. Paiement de recette (simulé) puis activation par événement signé
await page.goto(`${base}/abonnement?formule=essentiel`, { waitUntil: 'networkidle' });
await page.getByRole('button', { name: /Payer/ }).click();
await page.waitForURL(/\/compte\?paiement=/);
await page.getByText(/Abonnement .* actif/).waitFor({ timeout: 30000 });
res.abonnement = 'actif après événement signé';
// 4. Nouveau dossier + dépôt du lot initial (4 pièces dont un scan)
await page.getByRole('link', { name: 'Nouveau dossier' }).click();
await page.getByLabel('Nom du dossier').fill('Régularisation de charges 2025');
await page.getByLabel('Votre objectif').fill('Savoir quoi répondre au bailleur avant la date demandée.');
await page.getByRole('button', { name: /Créer et déposer/ }).click();
await page.waitForURL(/\/compte\/dossier\//);
const dossierUrl = page.url();
const t0 = Date.now();
await page.getByRole('button', { name: 'lot initial (4)' }).click();
await page.getByText(/Pièces reçues/).waitFor({ timeout: 60000 });
res.depot_ms = Date.now() - t0;
// 5. Fermeture de l'onglet, réouverture plus tard
await page.close();
log('onglet fermé');
await new Promise((r) => setTimeout(r, 5000));
page = await ctx.newPage();
watch(page);
let first = null;
for (let i = 0; i < 90; i++) {
  await page.goto(dossierUrl, { waitUntil: 'networkidle' });
  const ready = await page.getByText('Résultats disponibles').count();
  if (ready && !first) first = Date.now() - t0;
  if (ready && !(await page.getByText(/Lecture de vos pièces/).count())) break;
  await new Promise((r) => setTimeout(r, 4000));
}
res.premier_resultat_ms = first;
res.fin_ms = Date.now() - t0;
res.geste = await page.locator('main button').filter({ hasText: /Joindre|Vérifier|Préparer|Redéposer/ }).first().innerText().catch(() => null);
res.situation = await page.locator('main p').filter({ hasText: /^Au / }).first().innerText().catch(() => null);
await page.screenshot({ path: `${out}/3-dossier-390.png`, fullPage: true });
// 6. Complément : bail + doublon
const t1 = Date.now();
await page.getByRole('button', { name: 'bail + doublon' }).click();
await page.getByText(/Pièces reçues/).waitFor({ timeout: 60000 });
for (let i = 0; i < 90; i++) {
  await page.waitForTimeout(4000);
  await page.reload({ waitUntil: 'networkidle' });
  if (!(await page.getByText(/Lecture de vos pièces/).count()) && (await page.getByText('Doublon : prise en compte une seule fois').count())) break;
}
res.complement_ms = Date.now() - t1;
res.geste_apres_complement = await page.locator('main button').filter({ hasText: /Joindre|Vérifier|Préparer|Redéposer/ }).first().innerText().catch(() => null);
// 7. Correction de date depuis le geste
if (res.geste_apres_complement === 'Vérifier la date') {
  await page.getByRole('button', { name: 'Vérifier la date' }).click();
  const row = page.locator('li', { hasText: 'Date contredite' }).first();
  await row.getByRole('button', { name: 'Corriger' }).click();
  await row.getByLabel('Date retenue').fill('2021-03-05');
  await row.getByLabel('Raison').fill('Date figurant sur le bail signé');
  await row.getByRole('button', { name: 'Enregistrer' }).click();
  await page.getByText(/Correction enregistrée/).waitFor();
  res.correction = 'enregistrée';
}
await page.setViewportSize({ width: 1440, height: 900 });
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/4-dossier-1440.png`, fullPage: true });
// 8. Notifications : boîte de recette
await page.goto(`${base}/boite`, { waitUntil: 'networkidle' });
res.notifications = await page.getByText('Vos résultats ClairDossier sont disponibles').count();
res.erreurs_console = errors;
writeFileSync(`${out}/resultats.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
await browser.close();
