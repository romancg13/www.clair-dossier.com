// Moteur de recette limité aux deux pièces fictives livrées avec le dépôt.
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { gunzipSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const fixtures = new Map([
  ['devis', {
    read: () => readFile(new URL('../recette/fixtures/devis.pdf', import.meta.url)),
    sha256: 'ae8189109c52965537faaa11921ae31c63823f57c9c5a29598a49f9b7bfc3898',
    method: 'pdf-text',
  }],
  ['scan', {
    read: () => readFile(new URL('../recette/fixtures/scan.png', import.meta.url)),
    sha256: 'a7fc08e708aab24a320711f6ca485e144ba0d9c305a32013165651758a03f871',
    method: 'tesseract-wasm-eng',
  }],
]);

async function readScan(bytes) {
  // Ce build du cœur intègre son WASM et n’a pas de chargeur de langue distant.
  const createCore = require('tesseract.js-core/tesseract-core-lstm.wasm.js');
  const model = await readFile(new URL('./node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz', import.meta.url));
  const core = await createCore();
  core.FS.writeFile('/eng.traineddata', gunzipSync(model));
  core.FS.writeFile('/input', bytes);
  const api = new core.TessBaseAPI();
  try {
    if (api.Init(null, 'eng', 1) !== 0 || api.SetImageFile(1, 0) !== 0) {
      throw new Error('Initialisation OCR impossible');
    }
    api.SetPageSegMode(6);
    return api.GetUTF8Text();
  } finally {
    api.End();
    core.destroy(api);
  }
}

async function extract(fixture, revision) {
  const source = fixtures.get(fixture);
  const bytes = await source.read();
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (source.sha256 !== sha256) throw new Error('Empreinte du corpus incorrecte');
  let text;
  if (fixture === 'scan') {
    text = await readScan(bytes);
  } else {
    const { extractText } = await import('unpdf');
    const pdf = await extractText(new Uint8Array(bytes), { mergePages: true });
    if (pdf.totalPages !== 1) throw new Error('PDF inattendu');
    text = pdf.text;
  }
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 16 || lines.some((line) => line.length > 256)) {
    throw new Error('Extraction inattendue');
  }
  return { fixture, revision, sha256, method: source.method, lines };
}

// Au plus deux calculs par instance. Le cache partagé de Vercel est lié au SHA.
const results = new Map();
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (process.env.VERCEL_ENV !== 'preview') return res.status(404).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end();
  }
  const revision = process.env.VERCEL_GIT_COMMIT_SHA;
  const search = new URL(req.url, 'http://localhost').searchParams;
  const fixture = search.get('fixture');
  if (!fixtures.has(fixture) || search.size !== 2 || search.getAll('revision').length !== 1) {
    return res.status(400).end();
  }
  if (!/^[0-9a-f]{40}$/.test(revision ?? '') || search.get('revision') !== revision) {
    return res.status(409).end();
  }
  if (!results.has(fixture)) {
    results.set(fixture, extract(fixture, revision).catch((error) => {
      results.delete(fixture);
      throw error;
    }));
  }
  try {
    const result = await results.get(fixture);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('Vercel-CDN-Cache-Control', 'public, s-maxage=86400');
    return res.status(200).json(result);
  } catch {
    return res.status(503).end();
  }
}
