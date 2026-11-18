// Bundle build.mjs supplies only synthetic inputs, their verified hashes, the sample report and the page.
import { page, assets, fixtureHashes, fixtureList } from './assets.mjs';

const DAY = 86_400_000;
const cookieName = '__Host-cd_essai';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const unpack = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = a => Array.from(new Uint8Array(a), b => b.toString(16).padStart(2, '0')).join('');
const sha = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
const query = (db, sql, ...args) => db.prepare(sql).bind(...args);
const summary = 'Le devis CD-041 (p. 1) porte sur trois fenêtres pour 18 400 € TTC et demande le retour du procès-verbal le 8 décembre 2026. Le bon de réception numérisé (p. 1) est sans signature. Demandez un exemplaire signé.';
const draft = 'Objet : bon de réception à signer — Devis CD-041\nBonjour, pouvez-vous me transmettre le bon de réception signé correspondant au devis CD-041 ? Je pourrai ainsi compléter le dossier avant le 8 décembre 2026. Merci.\nBrouillon à vérifier avant envoi.';

function respond(data, status = 200, headers = {}) {
  let body = data;
  if (typeof data === 'object' && !(data instanceof ArrayBuffer) && !ArrayBuffer.isView(data)) {
    body = JSON.stringify(data);
    headers['Content-Type'] = 'application/json; charset=utf-8';
  }
  return new Response(body, {status, headers:{
    'Cache-Control':'private, no-store', 'X-Robots-Tag':'noindex, nofollow, noarchive',
    'Referrer-Policy':'no-referrer', 'X-Content-Type-Options':'nosniff', 'X-Frame-Options':'DENY', ...headers,
  }});
}
const error = (message,status) => respond({error:message},status);
async function readBody(request) {
  if (request.headers.get('Content-Type')?.split(';')[0] !== 'application/json' || !request.body)
    return null;
  const reader = request.body.getReader();
  const parts = [];
  let size = 0;
  while (true) {
    const {value,done} = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 40_000) { await reader.cancel(); return null; }
    parts.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) { bytes.set(part,offset); offset += part.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { return null; }
}

async function digestCookie(request) {
  const raw = request.headers.get('Cookie')?.match(/(?:^|;\s*)__Host-cd_essai=([a-f0-9]{64})(?:;|$)/)?.[1];
  return raw ? sha(new TextEncoder().encode(raw)) : null;
}

// The run row contains both input bytes, the lease and the latest publication. Duplicates share the same row.
async function drainOne(db) {
  const now = Date.now();
  const lease = crypto.randomUUID();
  const claimed = await query(db,`UPDATE runs SET status='processing', lease=?, lease_end=?, attempts=attempts+1
    WHERE id=(SELECT r.id FROM runs r JOIN sandboxes s ON s.id=r.sandbox
      WHERE s.expires>? AND r.attempts<3 AND ((r.status='queued' AND r.due<=?) OR (r.status='processing' AND r.lease_end<=?))
      ORDER BY r.due LIMIT 1) RETURNING id, input_pdf, input_scan`,lease,now+12_000,now,now,now).first();
  if (!claimed) return false;
  try {
    // Hosted extraction is replayed from the local PDF/OCR run solely for this exact pair of hashes.
    const [pdf,scan] = await Promise.all([sha(new Uint8Array(claimed.input_pdf)),sha(new Uint8Array(claimed.input_scan))]);
    if (pdf !== fixtureHashes.devis || scan !== fixtureHashes.scan) throw new Error('fixture');
    await query(db,`UPDATE runs SET status='published',published_at=?,summary=?,draft=?,output_pdf=?,notifications=1,lease=NULL
      WHERE id=? AND lease=? AND status='processing' AND EXISTS (SELECT 1 FROM sandboxes WHERE id=runs.sandbox AND expires>?)`,
      Date.now(),summary,draft,unpack(assets.report.data).buffer,claimed.id,lease,Date.now()).run();
  } catch {
    await query(db,`UPDATE runs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END, lease=NULL, due=? WHERE id=? AND lease=?`,Date.now()+500,claimed.id,lease).run();
  }
  return true;
}

async function reconcile(db, initialDelay = 0) {
  if (initialDelay) await delay(initialDelay);
  const now = Date.now();
  await query(db,"UPDATE runs SET status='failed',lease=NULL WHERE status='processing' AND attempts>=3 AND lease_end<=?",now).run();
  for (let i=0;i<4;i++) {
    if (!await drainOne(db)) break;
    await delay(520);
  }
}

async function runFor(db,sandbox) {
  const row = await query(db,`SELECT status,submitted AS submittedAt,published_at AS publishedAt,
    notifications,summary,draft FROM runs WHERE sandbox=? AND persona=?`,sandbox.id,sandbox.persona).first();
  return row ?? null;
}

export default {
  async fetch(request,env,ctx) {
    const url = new URL(request.url), path = url.pathname;
    if (request.method === 'GET') {
      if (path === '/' || path === '/recette/') return respond(page,200,{'Content-Type':'text/html; charset=utf-8'});
      if (path === '/robots.txt') return respond('User-agent: *\nDisallow: /\n',200,{'Content-Type':'text/plain'});
      const entry = {'/assets/logo.webp':assets.logo,'/fixtures/devis.pdf':assets.devis,'/fixtures/scan.png':assets.scan}[path];
      if (entry) return respond(unpack(entry.data),200,{'Content-Type':entry.type});
    }
    if (!['/api/session','/api/depot','/api/dossier','/api/livraison.pdf'].includes(path)) return error('Route inconnue.',404);
    if (!env.DB) return error('Stockage de recette indisponible.',503);
    if (request.method === 'POST' && request.headers.get('Origin') !== url.origin) return error('Origine invalide.',403);
    const db = env.DB;
    try {
      const id = await digestCookie(request);
      const sandbox = id ? await query(db,'SELECT id,persona FROM sandboxes WHERE id=? AND expires>?',id,Date.now()).first() : null;
      if (path === '/api/session' && request.method === 'POST') {
        const data = await readBody(request);
        if (!['a','b','sans'].includes(data?.persona)) return error('Profil de recette inconnu.',400);
        if (sandbox) {
          await query(db,'UPDATE sandboxes SET persona=? WHERE id=?',data.persona,id).run();
          return respond({persona:data.persona});
        }
        const raw = hex(crypto.getRandomValues(new Uint8Array(32)));
        const digest = await sha(new TextEncoder().encode(raw));
        const now = Date.now();
        await db.batch([query(db,'DELETE FROM sandboxes WHERE expires<=?',now),
          query(db,'INSERT INTO sandboxes(id,persona,expires) SELECT ?,?,? WHERE (SELECT count(*) FROM sandboxes)<256',digest,data.persona,now+DAY)]);
        if (!await query(db,'SELECT id FROM sandboxes WHERE id=?',digest).first()) return error('Capacité de recette atteinte.',429);
        return respond({persona:data.persona},201,{'Set-Cookie':cookieName+'='+raw+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400'});
      }
      if (path === '/api/dossier' && request.method === 'GET') {
        ctx.waitUntil(reconcile(db));
        return respond({persona:sandbox?.persona ?? null,run:sandbox ? await runFor(db,sandbox) : null,fixtures:fixtureList});
      }
      if (!sandbox) return error('Choisissez un profil de recette.',401);
      if (sandbox.persona === 'sans') return error('Un abonnement fictif actif est requis avant le dépôt.',402);
      if (path === '/api/livraison.pdf' && request.method === 'GET') {
        const row = await query(db,"SELECT output_pdf FROM runs WHERE sandbox=? AND persona=? AND status='published'",sandbox.id,sandbox.persona).first();
        return row ? respond(new Uint8Array(row.output_pdf),200,{'Content-Type':'application/pdf','Content-Disposition':'attachment; filename=Tableau-de-bord-Atelier-Temoin.pdf'}) : error('Livraison indisponible.',404);
      }
      if (path !== '/api/depot' || request.method !== 'POST') return error('Méthode non autorisée.',405);
      const data = await readBody(request);
      if (!Array.isArray(data?.uploads) || data.uploads.length !== 2) return error('Le devis et le bon de réception fictifs sont requis.',400);
      const inputs = new Map();
      for (const raw of data.uploads) {
        if (typeof raw !== 'string' || raw.length>30000) return error('Format de pièce invalide.',400);
        let bytes;
        try { bytes = unpack(raw); } catch { return error('Format de pièce invalide.',400); }
        inputs.set(await sha(bytes),bytes.buffer);
      }
      const pdf = inputs.get(fixtureHashes.devis), scan = inputs.get(fixtureHashes.scan);
      if (!pdf || !scan) return error('Seules les deux pièces fictives de cette recette sont acceptées.',422);
      const submitted = Date.now();
      const inserted = await query(db,`INSERT INTO runs (id,sandbox,persona,status,submitted,due,input_pdf,input_scan)
        SELECT ?,id,persona,'queued',?,?,?,? FROM sandboxes WHERE id=? AND persona=? AND persona IN ('a','b') AND expires>?
        ON CONFLICT(sandbox,persona) DO NOTHING RETURNING id`,
        crypto.randomUUID(),submitted,submitted+600,pdf,scan,sandbox.id,sandbox.persona,submitted).first();
      ctx.waitUntil(reconcile(db,650));
      return inserted ? respond({status:'queued'},202) : error('Ce lot a déjà été déposé.',409);
    } catch { return error('Le service de recette est temporairement indisponible.',503); }
  },
  async scheduled(_event,env,ctx) { ctx.waitUntil(reconcile(env.DB)); },
};
