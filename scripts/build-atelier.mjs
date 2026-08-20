/**
 * Assemble l'atelier autonome : UN fichier HTML, ouvrable en double-clic.
 *
 *   npm run atelier:autonome  →  dist-autonome/defense-os.html
 */
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

execSync('npx vite build -c vite.autonome.config.ts', { stdio: 'inherit' });

const brut = 'dist-autonome-brut';
const assets = join(brut, 'assets');
const fichiers = readdirSync(assets);
const js = fichiers.filter((f) => f.endsWith('.js'));
const css = fichiers.filter((f) => f.endsWith('.css'));
if (js.length !== 1 || css.length !== 1) {
  throw new Error(`attendu 1 js et 1 css, trouvé ${js.length} js / ${css.length} css — le repli des imports a échoué`);
}

let html = readFileSync(join(brut, 'index.html'), 'utf-8');
// Un script inliné se termine au premier « </script> » rencontré — y compris
// dans une chaîne du bundle. L'échappement est donc obligatoire, et « <!-- »
// subit le même sort pour ne pas ouvrir un commentaire HTML dans le script.
const script = readFileSync(join(assets, js[0]), 'utf-8')
  .replaceAll('</script', '<\\/script')
  .replaceAll('<!--', '<\\!--');
const style = readFileSync(join(assets, css[0]), 'utf-8');
const favicon = readFileSync('public/favicon.svg', 'utf-8');

// Remplacements par FONCTION : un « $& » dans le bundle serait interprété
// comme motif de remplacement par String.replace et injecterait le texte
// recherché au milieu du script — c'est arrivé, et ça casse tout.
html = html
  .replace(/<script type="module"[^>]*><\/script>/, '')
  .replace(/<link rel="stylesheet"[^>]*>/, () => `<style>\n${style}\n</style>`)
  .replace(/<link rel="icon"[^>]*>/, () => `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}" />`)
  .replace('</body>', () => `<script>\n${script}\n</script>\n</body>`);

mkdirSync('dist-autonome', { recursive: true });
writeFileSync('dist-autonome/defense-os.html', html, 'utf-8');
rmSync(brut, { recursive: true, force: true });

const octets = Buffer.byteLength(html);
process.stdout.write(`dist-autonome/defense-os.html — ${(octets / 1024 / 1024).toFixed(1)} Mo, un seul fichier.\n`);
