/**
 * Non-régression visuelle : captures pleine page puis comparaison pixel à pixel.
 *
 *   npm install --no-save playwright-core@1 pixelmatch@6 pngjs@7
 *   node scripts/visual-diff.mjs snap <url_de_base> <dossier>
 *   node scripts/visual-diff.mjs diff <dossier_référence> <dossier>
 *
 * Chrome installé (aucun navigateur téléchargé). Captures « static » : motion
 * réduite émulée, polices chargées, page parcourue (apparitions déclenchées) —
 * ce sont elles qui font foi. Captures « motion » : animations actives,
 * comparées pour information (3D et animations non déterministes).
 */
import { mkdirSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const PAGES = ['/', '/tarifs/', '/fonctionnalites/', '/securite/', '/connexion', '/inscription', '/demo'];
const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const STRICT_MAX = 0.0005; // 0,05 % des pixels : anticrénelage seulement

const fileName = (page, size, mode) => `${page.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'accueil'}-${size}-${mode}.png`;

async function snap(base, out) {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const [size, viewport] of Object.entries(SIZES)) {
    for (const mode of ['static', 'motion']) {
      const ctx = await browser.newContext({ viewport, reducedMotion: mode === 'static' ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      for (const path of PAGES) {
        await page.goto(base.replace(/\/$/, '') + path, { waitUntil: 'networkidle' });
        await page.evaluate(async () => {
          await document.fonts.ready;
          for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 120));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForTimeout(mode === 'static' ? 1500 : 4000);
        await page.screenshot({ path: join(out, fileName(path, size, mode)), fullPage: true, animations: mode === 'static' ? 'disabled' : 'allow' });
      }
      await ctx.close();
    }
  }
  await browser.close();
  console.log(`${readdirSync(out).length} captures dans ${out}`);
}

function diff(ref, cur) {
  let failures = 0;
  for (const name of readdirSync(ref).filter((f) => f.endsWith('.png')).sort()) {
    if (!existsSync(join(cur, name))) continue;
    const a = PNG.sync.read(readFileSync(join(ref, name)));
    const b = PNG.sync.read(readFileSync(join(cur, name)));
    const strict = name.endsWith('-static.png');
    if (a.width !== b.width || a.height !== b.height) {
      console.log(`${strict ? '✖' : '·'} ${name} : dimensions ${a.width}×${a.height} → ${b.width}×${b.height}`);
      if (strict) failures++;
      continue;
    }
    const n = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
    const ratio = n / (a.width * a.height);
    const ok = !strict || ratio <= STRICT_MAX;
    if (!ok) failures++;
    console.log(`${ok ? '✔' : '✖'} ${name} : ${(ratio * 100).toFixed(3)} %${strict ? '' : ' (motion, informatif)'}`);
  }
  console.log(`\n${failures} différence(s) bloquante(s)`);
  process.exit(failures ? 1 : 0);
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'snap') await snap(a, b);
else if (cmd === 'diff') diff(a, b);
else console.error('usage : snap <url> <dossier> | diff <ref> <dossier>');
