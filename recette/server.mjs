// Adaptateur de recette isolé. Aucune dépendance Auth, Stripe ou Supabase réelle.
import { createServer } from 'node:http';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, statSync, chmodSync } from 'node:fs';
import { resolve, dirname, extname, isAbsolute, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { fixtures, volume, hash } from './fixtures.mjs';
import { HttpError, openStore } from './store.mjs';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const prefix = '/api/recette';
const ttl = 5 * 60 * 1000;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};
const same = (a, b) =>
  typeof a === 'string' &&
  typeof b === 'string' &&
  timingSafeEqual(Buffer.from(hash(a), 'hex'), Buffer.from(hash(b), 'hex'));
const json = (res, value, status = 200) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(value));
};
const error = (status, msg) => new HttpError(status, msg);
async function readBody(req) {
  if (req.headers['content-type']?.split(';')[0] !== 'application/json')
    throw error(415, 'Corps JSON requis.');
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) throw error(413, 'Lot trop volumineux.');
    chunks.push(chunk);
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
    return body;
  } catch {
    throw error(400, 'Requête JSON invalide.');
  }
}
function checkOrigin(req, origin) {
  if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site')
    throw error(403, 'Origine non autorisée.');
}
export async function startServer({
  dbPath,
  port = 4174,
  host = '127.0.0.1',
  origin,
  secure = false,
  dist = resolve(root, 'dist'),
  adminSecret,
  intervalMs = 250,
  extractor,
} = {}) {
  if (!dbPath || !isAbsolute(dbPath))
    throw Error('RECETTE_DB doit être le chemin absolu de la base de recette.');
  if (!['localhost', '127.0.0.1', '::1'].includes(host) && (!secure || !origin?.startsWith('https://')))
    throw Error('Une origine HTTPS isolée est obligatoire pour une écoute publique.');
  if (origin && /(^|\.)clair-dossier\.com$/i.test(new URL(origin).hostname))
    throw Error('Domaine de production interdit en recette.');
  mkdirSync(dirname(dbPath), { recursive: true, mode: 0o700 });
  const store = openStore(dbPath);
  chmodSync(dbPath, 0o600);
  // Une clé privée du volume signe les liens ; le cookie lie la signature à
  // la session correspondante. Un redémarrage préserve les liens encore valides.
  store.db.exec('CREATE TABLE IF NOT EXISTS server_keys (name TEXT PRIMARY KEY, value BLOB NOT NULL)');
  store.db.prepare('INSERT OR IGNORE INTO server_keys VALUES (?, ?)').run('download', randomBytes(32));
  const signingKey = store.db.prepare('SELECT value FROM server_keys WHERE name = ?').get('download').value;
  const signature = (token, path, expiry) => createHmac('sha256', signingKey)
    .update([token, path, expiry].join('|')).digest('base64url');
  const modules = {};
  for (const file of ['mcp', 'services']) {
    const url = new URL('./' + file + '.mjs', import.meta.url);
    if (existsSync(url)) modules[file] = await import(url.href);
  }
  const cookie = (name, token, age, path = '/') =>
    name +
    '=' +
    token +
    '; Max-Age=' +
    age +
    '; Path=' +
    path +
    '; HttpOnly; SameSite=Lax' +
    (secure ? '; Secure' : '');
  const mailPath = prefix + '/recuperation';
  const sessionCookies = (started) => [
    cookie('cd_recette', started.token, 86400),
    cookie('cd_boite', started.mailbox, 86400, mailPath),
    cookie('cd_confirmation', '', 0, mailPath + '/confirmer'),
  ];
  const server = createServer(async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader('X-Frame-Options', 'DENY');
      const url = new URL(req.url, 'http://localhost');
      const expected = origin || 'http://' + req.headers.host;
      const token = req.headers.cookie?.match(/(?:^|;\s*)cd_recette=([\w-]{42,44})(?:;|$)/)?.[1];
      let session = store.session(token);
      if (url.pathname === '/recette/autoriser-admin') {
        if (!adminSecret) throw error(503, 'Accès administrateur de recette non configuré.');
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.setHeader(
            'Content-Security-Policy',
            "default-src 'none'; form-action 'self'; frame-ancestors 'none'",
          );
          return res.end(
            '<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Autoriser le suivi privé</title><main><h1>Suivi privé de recette</h1><p>Utilisez le compte administrateur de test fourni par votre hébergeur pour autoriser la lecture de ce dossier fictif.</p><form method="post"><button>Ouvrir ma session admin de recette</button></form></main></html>',
          );
        }
        if (req.method !== 'POST') throw error(405, 'Méthode non autorisée.');
        if (req.headers.origin !== expected) throw error(403, 'Origine non autorisée.');
        const basic = req.headers.authorization?.match(/^Basic ([A-Za-z0-9+/=]+)$/i);
        if (!basic || !same(Buffer.from(basic[1], 'base64').toString('utf8'), 'recette:' + adminSecret)) {
          res.setHeader('WWW-Authenticate', 'Basic realm="ClairDossier recette", charset="UTF-8"');
          throw error(401, 'Connexion administrateur requise.');
        }
        const started = store.startSession(token, 'admin', true);
        res.setHeader('Set-Cookie', sessionCookies(started));
        res.writeHead(303, { Location: '/recette/oauth/access' });
        return res.end();
      }
      const mcp = modules.mcp;
      if (
        mcp &&
        (await mcp.handleMcp({
          req,
          res,
          url,
          db: store.db,
          session,
          readConnectorStatus: store.readConnectorStatus,
        }))
      )
        return;
      if (url.pathname === prefix + '/health' && req.method === 'GET')
        return json(res, { service: 'clairdossier-recette' });
      if (url.pathname.startsWith(prefix + '/')) {
        const path = url.pathname.slice(prefix.length);
        if (!['GET', 'POST'].includes(req.method)) throw error(405, 'Méthode non autorisée.');
        checkOrigin(req, expected);
        let currentToken = token;
        const link = (kind, id) => {
          const endpoint = prefix + '/' + kind + '/' + id,
            expires = Date.now() + ttl;
          return endpoint + '?expires=' + expires + '&sig=' + signature(currentToken, endpoint, expires);
        };
        const post = req.method === 'POST';
        if (post && (path === '/recuperation' || path === '/recuperation/confirmer')) {
          const mailbox = req.headers.cookie?.match(/(?:^|;\s*)cd_boite=([\w-]{42,44})(?:;|$)/)?.[1];
          const body = await readBody(req);
          if (path === '/recuperation') {
            const receipt = store.requestRecovery(mailbox, body.persona);
            res.setHeader('Set-Cookie', cookie('cd_confirmation', receipt, 600, mailPath + '/confirmer'));
            return json(res, { pending: true, recipient: 'Client fictif ' + body.persona.toUpperCase() });
          }
          const receipt = req.headers.cookie?.match(/(?:^|;\s*)cd_confirmation=([\w-]{42,44})(?:;|$)/)?.[1];
          const started = store.confirmRecovery(mailbox, receipt, token);
          currentToken = started.token;
          res.setHeader('Set-Cookie', sessionCookies(started));
          return json(res, store.state(started.session, link));
        }
        if (post && path === '/session') {
          const body = await readBody(req);
          const admin = Boolean(adminSecret && same(adminSecret, req.headers['x-recette-admin']));
          const started = store.startSession(token, body.persona, admin);
          session = started.session;
          currentToken = started.token;
          res.setHeader('Set-Cookie', sessionCookies(started));
          return json(res, store.state(session, link));
        }
        if (!post && path.startsWith('/fixtures/')) {
          const id = path.slice('/fixtures/'.length);
          const f = id === volume.id ? volume : fixtures.get(id);
          if (!f) throw error(404, 'Pièce fictive inconnue.');
          res.setHeader('Content-Type', f.mime);
          res.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(f.name));
          return res.end(f.bytes);
        }
        if (!session) throw error(401, 'Ouvrez une session de recette.');
        if (!post && path === '/state') return json(res, store.state(session, link));
        if (post && path === '/logout') {
          await readBody(req);
          store.logout(token);
          res.setHeader('Set-Cookie', cookie('cd_recette', '', 0));
          return json(res, { signedOut: true });
        }
        if (!session.subscribed) throw error(402, 'Un abonnement de recette actif est requis.');
        if (!post && /^\/(objects|files)\/[\w-]+$/.test(path)) {
          const [kind, id] = path.slice(1).split('/');
          const expires = Number(url.searchParams.get('expires'));
          if (
            !Number.isSafeInteger(expires) ||
            expires < Date.now() ||
            expires > Date.now() + ttl ||
            !same(url.searchParams.get('sig'), signature(token, url.pathname, expires))
          )
            throw error(403, 'Lien privé expiré ou invalide.');
          const f =
            kind === 'objects'
              ? store.get(
                  'SELECT name,mime,bytes FROM objects WHERE dossier_id=? AND id=?',
                  session.dossierId,
                  id,
                )
              : store.get(
                  'SELECT name,mime,bytes FROM files WHERE dossier_id=? AND id=?',
                  session.dossierId,
                  id,
                );
          if (!f) throw error(404, 'Document indisponible.');
          res.setHeader('Content-Type', f.mime);
          const mode =
            kind === 'files' && f.mime === 'application/pdf' && url.searchParams.get('inline') === '1'
              ? 'inline'
              : 'attachment';
          res.setHeader('Content-Disposition', mode + "; filename*=UTF-8''" + encodeURIComponent(f.name));
          return res.end(f.bytes);
        }
        const body = post ? await readBody(req) : {};
        if (path === '/services' && modules.services) {
          const d = store.authorized(session.dossierId);
          if (!d || d.account_id !== session.accountId) throw error(403, 'Dossier indisponible.');
          if (post && d.closed) throw error(409, 'Ce dossier est clôturé.');
          return json(
            res,
            await modules.services.handleServices({
              method: req.method,
              body,
              db: store.db,
              session,
              analysis: d.analysis ? JSON.parse(d.analysis) : null,
            }),
          );
        }
        let receipt;
        if (post && path === '/lots') receipt = store.addLot(session, body);
        else if (post && path === '/corrections') store.correct(session, body);
        else if (post && path === '/cloture') store.close(session, body.closed);
        else if (post && path === '/review') store.approval(session);
        else throw error(404, 'Route de recette inconnue.');
        return json(res, { ...store.state(session, link), receipt });
      }
      if (!['GET', 'HEAD'].includes(req.method)) throw error(405, 'Méthode non autorisée.');
      if (url.pathname === '/robots.txt') {
        res.setHeader('Content-Type', 'text/plain');
        return res.end('User-agent: *\nDisallow: /\n');
      }
      let file = resolve(dist, '.' + decodeURIComponent(url.pathname));
      if (file !== dist && !file.startsWith(dist + sep)) throw error(404, 'Fichier inconnu.');
      if (existsSync(file) && statSync(file).isDirectory()) file = resolve(file, 'index.html');
      if (!existsSync(file) && !extname(url.pathname)) file = resolve(dist, 'index.html');
      if (!existsSync(file) || !statSync(file).isFile())
        throw error(404, 'Interface de recette indisponible.');
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
      if (req.method === 'HEAD') return res.end();
      createReadStream(file)
        .on('error', () => res.destroy())
        .pipe(res);
    } catch (e) {
      if (res.headersSent) return res.end();
      const status = Number.isInteger(e.status) && e.status >= 400 && e.status < 600 ? e.status : 500;
      json(res, { error: status < 500 ? e.message : 'Erreur technique de recette.' }, status);
    }
  });
  let work = null;
  let nextPurge = Date.now();
  const timer = setInterval(() => {
    if (Date.now() >= nextPurge) {
      store.run('DELETE FROM demos WHERE expires<=?', Date.now());
      nextPurge = Date.now() + 60000;
    }
    if (!work)
      work = store
        .tick(extractor)
        .catch(() => {
          /* Reprise sur le prochain bail, sans contenu client dans les journaux. */
        })
        .finally(() => {
          work = null;
        });
  }, intervalMs);
  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(port, host, ok);
  });
  return {
    server,
    store,
    address: server.address(),
    shutdown: async () => {
      clearInterval(timer);
      await new Promise((done) => server.close(done));
      if (work) await work;
      store.db.close();
    },
  };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const hosted = process.env.NODE_ENV === 'production' || process.env.RECETTE_HOSTED === '1';
  const path = process.env.RECETTE_DB;
  if (hosted) {
    const volume = process.env.RECETTE_VOLUME;
    if (
      !volume ||
      !isAbsolute(volume) ||
      !path ||
      !resolve(path).startsWith(resolve(volume) + sep) ||
      !existsSync(volume) ||
      !process.env.RECETTE_ORIGIN?.startsWith('https://')
    )
      throw Error('Volume durable monté et origine HTTPS de recette obligatoires.');
  }
  const app = await startServer({
    dbPath: path,
    port: Number(process.env.PORT || 4174),
    host: process.env.RECETTE_HOST || (hosted ? '0.0.0.0' : '127.0.0.1'),
    origin: process.env.RECETTE_ORIGIN,
    secure: hosted,
    adminSecret: process.env.RECETTE_ADMIN_SECRET,
  });
  process.stdout.write('Serveur de recette prêt sur le port ' + app.address.port + '.\n');
  for (const signal of ['SIGTERM', 'SIGINT'])
    process.once(signal, async () => {
      await app.shutdown();
    });
}
