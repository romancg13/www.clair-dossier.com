/**
 * Recette du rethème (outil de session, non committé) :
 *   snap  <url> <dossier>   captures pleine page 390/768/1440 (motion réduite,
 *                           polices chargées, page parcourue) + géométrie DOM
 *   geom  <ref> <dossier>   compare les rectangles DOM (position/taille) —
 *                           doit être IDENTIQUE : le rethème ne bouge rien
 *   pix   <ref> <dossier>   % de pixels différents par capture — doit être
 *                           NETTEMENT > 0 : le changement chromatique se voit
 */
import { mkdirSync, readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const PAGES = ['/', '/tarifs/', '/fonctionnalites/', '/securite/', '/etat-du-produit/', '/connexion', '/inscription'];
const SIZES = { mobile: { width: 390, height: 844 }, tablette: { width: 768, height: 1024 }, desktop: { width: 1440, height: 900 } };

const slug = (p) => p.replace(/^\/|\/$/g, '').replace(/\//g, '_') || 'accueil';

async function snap(base, out) {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome' });
  for (const [size, viewport] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    for (const path of PAGES) {
      await page.goto(base.replace(/\/$/, '') + path, { waitUntil: 'networkidle' });
      await page.evaluate(async () => {
        await document.fonts.ready;
        for (let y = 0; y < document.body.scrollHeight; y += window.innerHeight / 2) {
          window.scrollTo(0, y);
          await new Promise((r) => setTimeout(r, 100));
        }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: join(out, `${slug(path)}-${size}.png`), fullPage: true, animations: 'disabled' });
      // Géométrie : rectangle de chaque élément visible, hors attributs de couleur.
      const rects = await page.evaluate(() =>
        [...document.querySelectorAll('body *')]
          .filter((el) => el.getClientRects().length)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return `${el.tagName}#${el.id}.${[...el.classList].filter((c) => !/(bg|text|border|from|to|via|shadow|fill|stroke)-/.test(c)).sort().join('.')}|${Math.round(r.x)},${Math.round(r.y + window.scrollY)},${Math.round(r.width)},${Math.round(r.height)}`;
          }),
      );
      writeFileSync(join(out, `${slug(path)}-${size}.rects.txt`), rects.join('\n'));
    }
    await ctx.close();
  }
  await browser.close();
  console.log(`${readdirSync(out).length} fichiers dans ${out}`);
}

function compare(ref, cur, mode) {
  let bad = 0;
  for (const name of readdirSync(ref).sort()) {
    if (!existsSync(join(cur, name))) continue;
    if (mode === 'geom' && name.endsWith('.rects.txt')) {
      const a = readFileSync(join(ref, name), 'utf8').split('\n');
      const b = readFileSync(join(cur, name), 'utf8').split('\n');
      const diff = a.filter((l, i) => b[i] !== l).length + Math.abs(a.length - b.length);
      const ok = diff === 0;
      if (!ok) bad++;
      console.log(`${ok ? '✔' : '✖'} ${name} : ${diff} rectangle(s) différent(s) sur ${a.length}`);
    }
    if (mode === 'pix' && name.endsWith('.png')) {
      const a = PNG.sync.read(readFileSync(join(ref, name)));
      const b = PNG.sync.read(readFileSync(join(cur, name)));
      if (a.width !== b.width || a.height !== b.height) {
        console.log(`✖ ${name} : dimensions ${a.width}×${a.height} → ${b.width}×${b.height}`);
        bad++;
        continue;
      }
      const n = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 });
      console.log(`  ${name} : ${((n / (a.width * a.height)) * 100).toFixed(1)} % de pixels changés`);
    }
  }
  if (mode === 'geom') {
    console.log(`\n${bad} page(s) avec géométrie modifiée`);
    process.exit(bad ? 1 : 0);
  }
}

const [cmd, a, b] = process.argv.slice(2);
if (cmd === 'snap') await snap(a, b);
else compare(a, b, cmd);
