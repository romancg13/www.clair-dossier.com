/**
 * Mesure UX reproductible d'un build prérendu (dist/) :
 *   node scripts/mesure-ux.mjs <dist> [sortie.json]
 * Pour chaque page et largeur (390/1440, mouvement réduit, page parcourue) :
 * mots visibles dans <main> (hors aria-hidden), sections de premier niveau,
 * liens/boutons dans <main>, hauteur de page, entrées du menu principal.
 * Nécessite : npm install --no-save playwright-core@1 (Chrome installé).
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const PAGES = ['/', '/fonctionnalites/', '/securite/', '/tarifs/', '/blog/', '/etat-du-produit/'];
const WIDTHS = { mobile: 390, desktop: 1440 };
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.woff2': 'font/woff2', '.png': 'image/png', '.jpg': 'image/jpeg', '.webmanifest': 'application/manifest+json' };

const [dist, out] = process.argv.slice(2);
if (!dist) {
  console.error('usage : node scripts/mesure-ux.mjs <dist> [sortie.json]');
  process.exit(1);
}

async function resolveFile(urlPath) {
  const clean = normalize(decodeURIComponent(urlPath.split('?')[0])).replace(/^(\.\.[/\\])+/, '');
  for (const candidate of [clean, join(clean, 'index.html'), `${clean}.html`]) {
    const file = join(dist, candidate);
    try {
      if ((await stat(file)).isFile()) return file;
    } catch {
      /* candidat suivant */
    }
  }
  return join(dist, 'spa-shell.html');
}

const server = createServer(async (req, res) => {
  const file = await resolveFile(req.url ?? '/');
  res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
  res.end(await readFile(file));
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;

const browser = await chromium.launch({ channel: 'chrome' });
const result = {};
try {
  for (const [label, width] of Object.entries(WIDTHS)) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    for (const path of PAGES) {
      await page.goto(base + path, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 80));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(600);
      const m = await page.evaluate(() => {
        const main = document.querySelector('main') ?? document.body;
        const clone = main.cloneNode(true);
        clone.querySelectorAll('[aria-hidden="true"], script, style, noscript').forEach((n) => n.remove());
        // innerText du clone détaché ignore la mise en page : on reprend le texte des nœuds visibles.
        const visibleText = [...main.querySelectorAll('*')]
          .filter((el) => !el.closest('[aria-hidden="true"]') && el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
          .flatMap((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent))
          .join(' ');
        const words = visibleText.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
        const sections = [...main.querySelectorAll('section')].filter((s) => !s.parentElement?.closest('section')).length;
        const interactive = [...main.querySelectorAll('a[href], button')].filter((el) => el.getClientRects().length && !el.closest('[aria-hidden="true"]'));
        const nav = document.querySelector('header nav, nav[aria-label]');
        const navItems = nav ? [...nav.querySelectorAll('a[href], button')].filter((el) => el.getClientRects().length).map((el) => el.textContent.trim()).filter(Boolean) : [];
        return {
          mots: words,
          sections,
          liensBoutons: interactive.length,
          h1: document.querySelector('h1')?.textContent.trim() ?? null,
          h2: [...main.querySelectorAll('h2')].filter((h) => h.getClientRects().length).map((h) => h.textContent.trim()),
          hauteur: document.documentElement.scrollHeight,
          menu: navItems,
          title: document.title,
          canonical: document.querySelector('link[rel=canonical]')?.href ?? null,
          description: document.querySelector('meta[name=description]')?.content ?? null,
        };
      });
      result[`${path}@${label}`] = m;
      console.log(`${label.padEnd(7)} ${path.padEnd(18)} mots=${m.mots} sections=${m.sections} liens=${m.liensBoutons} hauteur=${m.hauteur}`);
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
if (out) writeFileSync(out, JSON.stringify(result, null, 2));
