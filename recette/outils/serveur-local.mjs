// Serveur local de recette : sert .vercel/output/static et la fonction API construite.
// Stockage EN MÉMOIRE (aucune persistance) : réservé aux essais locaux et aux tests de navigateur.
// Usage : node recette/outils/serveur-local.mjs [port]
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const root = new URL('../../.vercel/output/', import.meta.url).pathname;
const { default: api } = await import(join(root, 'functions/api.func/index.mjs'));
const port = Number(process.argv[2] ?? 4320);
process.env.RECETTE_SITE_URL ??= `http://127.0.0.1:${port}`;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.woff': 'font/woff', '.woff2': 'font/woff2', '.pdf': 'application/pdf', '.txt': 'text/plain', '.eml': 'message/rfc822', '.xlsx': 'application/octet-stream', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const m = /^\/((?:api|mcp|oauth|\.well-known)(?:\/.*)?)$/.exec(url.pathname);
  if (m) {
    url.searchParams.set('__p', m[1]);
    req.url = `/api?${url.searchParams}`;
    return api(req, res);
  }
  let f = normalize(join(root, 'static', decodeURIComponent(url.pathname)));
  try {
    if ((await stat(f)).isDirectory()) f = join(f, 'index.html');
    await stat(f);
  } catch {
    f = url.pathname.startsWith('/compte/dossier/') ? join(root, 'static/compte/index.html') : join(root, 'static/spa-shell.html');
  }
  try {
    res.writeHead(200, { 'content-type': types[extname(f)] ?? 'application/octet-stream' }).end(await readFile(f));
  } catch {
    res.writeHead(404).end('introuvable');
  }
}).listen(port, '127.0.0.1', () => console.log(`recette locale : http://127.0.0.1:${port}`));
