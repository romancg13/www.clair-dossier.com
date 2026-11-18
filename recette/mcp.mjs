import { createHash, randomBytes } from 'node:crypto';

const scope = 'dossier:status';
const mcpPath = '/recette/mcp';
const versions = ['2025-11-25', '2025-06-18', '2025-03-26'];
const routes = new Set([mcpPath, '/.well-known/oauth-protected-resource' + mcpPath,
  '/.well-known/oauth-protected-resource', '/.well-known/oauth-authorization-server',
  '/recette/oauth/authorize', '/recette/oauth/token', '/recette/oauth/revoke', '/recette/oauth/access']);
const tablesReady = new WeakSet();
const hash = value => createHash('sha256').update(value).digest('base64url');
const randomToken = () => randomBytes(32).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
const escape = value => String(value).replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function prepare(db) {
  if (tablesReady.has(db)) return;
  db.exec(`CREATE TABLE IF NOT EXISTS recette_mcp_grants (
    digest TEXT PRIMARY KEY, stage TEXT NOT NULL, client TEXT NOT NULL, redirect TEXT NOT NULL,
    state TEXT NOT NULL, challenge TEXT NOT NULL, admin_id TEXT NOT NULL, demo_id TEXT NOT NULL,
    dossier_id TEXT NOT NULL, resource TEXT NOT NULL, expires INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS recette_mcp_expiry ON recette_mcp_grants(expires);`);
  tablesReady.add(db);
}

function controls() {
  let origin;
  try { origin = new URL(process.env.RECETTE_MCP_ORIGIN).origin; } catch { return null; }
  const local = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin);
  if (!local && !origin.startsWith('https://')) return null;
  const clients = new Map([['clairdossier-claude-code', {
    title: 'Claude Code', redirects: ['http://localhost:31791/callback','http://127.0.0.1:31791/callback'],
  }]]);
  const redirect = process.env.RECETTE_CHATGPT_CALLBACK;
  if (/^https:\/\/chatgpt\.com\/(?:connector_platform_oauth_redirect|connector\/oauth\/[A-Za-z0-9_-]+)$/.test(redirect ?? '')) {
    clients.set('clairdossier-chatgpt', {title: 'ChatGPT', redirects:[redirect]});
  }
  return {origin, resource: origin + mcpPath, clients};
}

function reply(res, code, data, headers = {}) {
  let body = '';
  if (typeof data === 'string') body = data;
  else if (data !== undefined) {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    body = JSON.stringify(data);
  }
  res.writeHead(code, { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer',
    'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff', ...headers });
  res.end(body);
  return true;
}

function page(res, code, title, content) {
  return reply(res, code, `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · ClairDossier</title></head><body><main><h1>${title}</h1>${content}</main></body></html>`,
    {'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"});
}

async function body(req, type) {
  if (req.headers['content-type']?.split(';')[0].trim() !== type) return null;
  const chunks = [];
  let bytes = 0;
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 16384) return null;
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  try { return type === 'application/json' ? JSON.parse(raw) : new URLSearchParams(raw); }
  catch { return null; }
}

function authorization({req,res,url,db,session,settings,readConnectorStatus}) {
  if (session?.role !== 'admin' || !session.demoId || !session.dossierId) {
    return page(res,403,'Connexion à la recette requise','<p>Dans un nouvel onglet, <a href=/recette/autoriser-admin target=_blank rel=noopener>ouvrez votre session administrateur de recette</a>. Revenez sur cette page et actualisez-la pour vérifier la demande.</p>');
  }
  if (req.method === 'GET') {
    const q = url.searchParams;
    const client = q.get('client_id');
    const app = settings.clients.get(client);
    if (!app || !app.redirects.includes(q.get('redirect_uri')) || q.get('code_challenge_method') !== 'S256' ||
        q.get('response_type') !== 'code' || q.get('resource') !== settings.resource ||
        (q.get('scope') ?? scope) !== scope || !/^[A-Za-z0-9_-]{43}$/.test(q.get('code_challenge') ?? '') ||
        !q.get('state') || q.get('state').length > 1024)
      return reply(res,400,{error:'invalid_request'});
    if (!readConnectorStatus({demoId:session.demoId,dossierId:session.dossierId}))
      return page(res,403,'Dossier indisponible','<p>Ouvrez un dossier fictif éligible avant de reprendre la connexion.</p>');
    const ticket = randomToken();
    db.prepare("DELETE FROM recette_mcp_grants WHERE expires <= ? OR (stage='consent' AND admin_id=? AND client=?)")
      .run(now(),session.accountId,client);
    db.prepare("INSERT INTO recette_mcp_grants VALUES (?,'consent',?,?,?,?,?,?,?,?,?)").run(
      hash(ticket), client, q.get('redirect_uri'), q.get('state'), q.get('code_challenge'),
      session.accountId, session.demoId, session.dossierId, settings.resource, now()+300);
    return page(res,200,'Autoriser un accès de lecture',
      `<p>${escape(app.title)} demande l’état, la dernière livraison et les anomalies techniques du dossier fictif <strong>${escape(session.dossierId)}</strong>. Les pièces et leur contenu restent privés. L’autorisation expire après quinze minutes.</p><form method="post"><input type="hidden" name="ticket" value="${ticket}"><button name="decision" value="allow">Autoriser la lecture</button> <button name="decision" value="deny">Refuser</button></form>`);
  }
  if (req.method !== 'POST') return reply(res,405,undefined,{Allow:'GET, POST'});
  return approve();
  async function approve() {
    if (req.headers.origin !== settings.origin) return reply(res,403,{error:'access_denied'});
    const form = await body(req,'application/x-www-form-urlencoded');
    if (!form) return reply(res,400,{error:'invalid_request'});
    const digest = hash(form.get('ticket') ?? '');
    const grant = db.prepare("DELETE FROM recette_mcp_grants WHERE digest=? AND stage='consent' AND admin_id=? AND demo_id=? AND dossier_id=? AND resource=? AND expires>? RETURNING *")
      .get(digest,session.accountId,session.demoId,session.dossierId,settings.resource,now());
    if (!grant || !settings.clients.get(grant.client)?.redirects.includes(grant.redirect))
      return reply(res,400,{error:'invalid_request'});
    const next = new URL(grant.redirect);
    next.searchParams.set('state',grant.state);
    next.searchParams.set('iss',settings.origin);
    if (form.get('decision') !== 'allow' || !readConnectorStatus({demoId:grant.demo_id,dossierId:grant.dossier_id}))
      next.searchParams.set('error','access_denied');
    else {
      const code = randomToken();
      db.prepare("INSERT INTO recette_mcp_grants VALUES (?,'code',?,?,'',?,?,?,?,?,?)").run(
        hash(code),grant.client,grant.redirect,grant.challenge,grant.admin_id,grant.demo_id,grant.dossier_id,settings.resource,now()+60);
      next.searchParams.set('code',code);
    }
    return reply(res,303,undefined,{Location:next.href});
  }
}

async function exchange(req,res,db,settings,readConnectorStatus) {
  if (req.method !== 'POST') return reply(res,405,undefined,{Allow:'POST'});
  const q = await body(req,'application/x-www-form-urlencoded');
  if (!q || !settings.clients.has(q.get('client_id')) || q.get('grant_type') !== 'authorization_code' ||
      q.get('resource') !== settings.resource || !/^[A-Za-z0-9._~-]{43,128}$/.test(q.get('code_verifier') ?? ''))
    return reply(res,400,{error:'invalid_request'});
  const codeDigest = hash(q.get('code') ?? '');
  const grant = db.prepare("SELECT * FROM recette_mcp_grants WHERE digest=? AND stage='code' AND client=? AND redirect=? AND challenge=? AND resource=? AND expires>?")
    .get(codeDigest,q.get('client_id'),q.get('redirect_uri') ?? '',hash(q.get('code_verifier')),settings.resource,now());
  if (!grant || !settings.clients.get(grant.client)?.redirects.includes(grant.redirect) ||
      !readConnectorStatus({demoId:grant.demo_id,dossierId:grant.dossier_id})) return reply(res,400,{error:'invalid_grant'});
  const token = randomToken();
  const update = db.prepare("UPDATE recette_mcp_grants SET digest=?, stage='access', challenge='', expires=? WHERE digest=? AND stage='code' AND expires>?")
    .run(hash(token),now()+900,codeDigest,now());
  if (update.changes !== 1) return reply(res,400,{error:'invalid_grant'});
  return reply(res,200,{access_token:token,token_type:'Bearer',expires_in:900,scope});
}

async function rpc(req,res,db,settings,readConnectorStatus) {
  if (req.headers.origin && req.headers.origin !== settings.origin) return reply(res,403,{error:'origin_denied'});
  const bearer = /^Bearer ([A-Za-z0-9_-]{43})$/i.exec(req.headers.authorization ?? '');
  const grant = bearer && db.prepare("SELECT * FROM recette_mcp_grants WHERE digest=? AND stage='access' AND resource=? AND expires>?").get(hash(bearer[1]),settings.resource,now());
  const status = grant && settings.clients.get(grant.client)?.redirects.includes(grant.redirect) &&
    readConnectorStatus({demoId:grant.demo_id,dossierId:grant.dossier_id});
  if (!status) return reply(res,401,undefined,{
    'WWW-Authenticate':`Bearer resource_metadata="${settings.origin}/.well-known/oauth-protected-resource${mcpPath}", scope="${scope}"`});
  if (req.method !== 'POST') return reply(res,405,undefined,{Allow:'POST'});
  const msg = await body(req,'application/json');
  const error = (id,code,message) => reply(res,200,{jsonrpc:'2.0',id,error:{code,message}});
  if (!msg || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string')
    return error(null,-32600,'Requête invalide');
  if (msg.id === undefined) return reply(res,202);
  if (typeof msg.id !== 'string' && !Number.isInteger(msg.id)) return error(null,-32600,'Identifiant invalide');
  const ok = result => reply(res,200,{jsonrpc:'2.0',id:msg.id,result});
  if (msg.method === 'initialize') return ok({
    protocolVersion: versions.includes(msg.params?.protocolVersion) ? msg.params.protocolVersion : versions[0],
    serverInfo:{name:'clairdossier-recette',version:'1.0.0'},capabilities:{tools:{}},
  });
  if (msg.method === 'ping') return ok({});
  if (msg.method === 'tools/list') return ok({tools:[{name:'lire_etat_dossier',description:'Lire l’état du dossier fictif autorisé, sa dernière livraison et ses anomalies techniques.',
    inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}}]});
  if (msg.method !== 'tools/call') return error(msg.id,-32601,'Méthode inconnue');
  if (msg.params?.name !== 'lire_etat_dossier' || (msg.params.arguments !== undefined &&
      (msg.params.arguments === null || typeof msg.params.arguments !== 'object' || Array.isArray(msg.params.arguments) || Object.keys(msg.params.arguments).length)))
    return error(msg.id,-32602,'Outil ou paramètres inconnus');
  const view = {dossier:grant.dossier_id,etat:status.status,revision:status.revision,
    derniere_livraison:status.publishedAt,anomalies:status.anomalies};
  return ok({content:[{type:'text',text:JSON.stringify(view)}],structuredContent:view});
}

export async function handleMcp({req,res,url,db,session,readConnectorStatus}) {
  if (!routes.has(url.pathname)) return false;
  const s = controls();
  if (!s || typeof readConnectorStatus !== 'function') return reply(res,503,{error:'connector_unconfigured'});
  prepare(db);
  const path = url.pathname;
  if (path.startsWith('/.well-known/')) {
    if (req.method !== 'GET') return reply(res,405,undefined,{Allow:'GET'});
    if (path === '/.well-known/oauth-authorization-server') return reply(res,200,{
      issuer:s.origin,authorization_endpoint:s.origin+'/recette/oauth/authorize',token_endpoint:s.origin+'/recette/oauth/token',
      revocation_endpoint:s.origin+'/recette/oauth/revoke',scopes_supported:[scope],response_types_supported:['code'],
      grant_types_supported:['authorization_code'],token_endpoint_auth_methods_supported:['none'],code_challenge_methods_supported:['S256'],
      authorization_response_iss_parameter_supported:true,
    });
    return reply(res,200,{resource:s.resource,authorization_servers:[s.origin],scopes_supported:[scope],bearer_methods_supported:['header']});
  }
  if (path === mcpPath) return rpc(req,res,db,s,readConnectorStatus);
  if (path.endsWith('/authorize')) return authorization({req,res,url,db,session,settings:s,readConnectorStatus});
  if (path.endsWith('/token')) return exchange(req,res,db,s,readConnectorStatus);
  if (path.endsWith('/revoke')) {
    if (req.method !== 'POST') return reply(res,405,undefined,{Allow:'POST'});
    const q = await body(req,'application/x-www-form-urlencoded');
    if (!q || !s.clients.has(q.get('client_id'))) return reply(res,400,{error:'invalid_client'});
    db.prepare("DELETE FROM recette_mcp_grants WHERE digest=? AND client=? AND resource=?").run(hash(q.get('token') ?? ''),q.get('client_id'),s.resource);
    return reply(res,200);
  }
  if (session?.role !== 'admin') return page(res,403,'Connexion administrateur requise','<p>Ouvrez votre session de recette.</p>');
  if (req.method === 'GET') return page(res,200,'Accès des applications',
    '<p>Retirez toutes vos autorisations de lecture dans ce bac de recette.</p><form method="post"><button>Révoquer mes autorisations</button></form>');
  if (req.method !== 'POST') return reply(res,405,undefined,{Allow:'GET, POST'});
  if (req.headers.origin !== s.origin) return reply(res,403,{error:'access_denied'});
  db.prepare('DELETE FROM recette_mcp_grants WHERE admin_id=? AND demo_id=? AND resource=?').run(session.accountId,session.demoId,s.resource);
  return page(res,200,'Accès révoqués','<p>Les applications devront à nouveau obtenir votre autorisation.</p>');
}
