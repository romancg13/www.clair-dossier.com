// Bundle build.mjs supplies only synthetic inputs, their verified hashes, the sample report and the page.
import { page, assets, fixtureHashes, fixtureList, processor } from './assets.mjs';
import { handleDossierServices } from './services.mjs';
import { renderReport } from './report.mjs';
import { handlesConnector, handleConnector } from './connector.mjs';

const DAY = 86_400_000;
const cookieName = '__Host-cd_essai';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const unpack = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const hex = a => Array.from(new Uint8Array(a), b => b.toString(16).padStart(2, '0')).join('');
const sha = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
const query = (db, sql, ...args) => db.prepare(sql).bind(...args);
const originalDate='2026-12-08';
const dataReplay={
  devis:['DEVIS CD-041','Devis émis le 10/11/2026.','Objet : remplacement de trois fenêtres.','Prix TTC : 18400 EUR.','Retour du procès-verbal demandé au plus tard le 08/12/2026.'],
  scan:['Atelier Temoin | Devis CD-041','Reception des trois fenetres le 15/11/2026.','Le bon ne porte pas de signature.'],
};
const frenchDate=iso=>new Intl.DateTimeFormat('fr-FR',{dateStyle:'long',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
const realDate=value=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;

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

async function extractPublicFixture(id, bytes) {
  const digest=await sha(bytes);
  if (digest!==fixtureHashes[id]) throw new Error('fixture');
  if (processor) {
    const expectedMethod=id==='scan'?'tesseract-wasm-eng':'pdf-text';
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),6000);
    try {
      const target=new URL('/api/extraction',processor.origin);
      target.searchParams.set('revision',processor.revision);
      target.searchParams.set('fixture',id);
      // The public immutable specimen is identified by name. No upload, cookie or private status crosses origins.
      const response=await fetch(target,{signal:controller.signal,redirect:'manual',headers:{Accept:'application/json'}});
      if(response.ok && response.headers.get('content-type')?.includes('application/json')){
        const result=await response.json();
        if(result?.fixture===id && result.revision===processor.revision && result.sha256===digest &&
          result.method===expectedMethod && Array.isArray(result.lines) && result.lines.length<=48 &&
          result.lines.every(line=>typeof line==='string' && line.length<=320)) {
          const text=result.lines.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
          const reliable=id==='scan' ? /15\/11\/2026/.test(text) && /pas de signature/.test(text)
            : /18\s?400/.test(text) && /08\/12\/2026/.test(text) && /trois fenetres/.test(text);
          if(reliable) return {method:expectedMethod,sha256:digest,processorRevision:processor.revision,lines:result.lines};
        }
      }
    } catch { /* Une lecture distante indisponible conserve la méthode réellement utilisée. */ }
    finally {clearTimeout(timer);}
  }
  return {method:'fixture-replay',sha256:digest,lines:dataReplay[id]};
}

function valueFrom(lines, regex) {
  const text=lines.join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  return text.match(regex)?.[1] ?? null;
}
function toIsoDate(fr) {return fr.split('/').reverse().join('-');}
function resultFor(extraction, retainedDate, corrections) {
  const hasDevis=Boolean(extraction.devis), hasScan=Boolean(extraction.scan);
  const extractedDate=hasDevis?toIsoDate(valueFrom(extraction.devis.lines,/au plus tard le (\d{2}\/\d{2}\/\d{4})/i)):null;
  const amount=hasDevis?Number(valueFrom(extraction.devis.lines,/Prix TTC\s*:\s*([0-9 ]+)\s*EUR/i)?.replaceAll(' ','')):null;
  const receptionDate=hasScan?toIsoDate(valueFrom(extraction.scan.lines,/fenetres le (\d{2}\/\d{2}\/\d{4})/i)):null;
  if ((hasDevis && (!realDate(extractedDate) || !amount)) || (hasScan && !realDate(receptionDate))) throw new Error('incomplete evidence');
  const date=hasDevis?(retainedDate || extractedDate):null;
  const original=hasDevis?'Le devis CD-041 porte sur trois fenêtres pour '+new Intl.NumberFormat('fr-FR').format(amount)+' € TTC (devis, page 1).':'Le devis ne figure pas dans ce lot.';
  const observation=hasScan?'Le bon du '+frenchDate(receptionDate)+' ne porte pas de signature (bon numérisé, page 1).':'Le bon de réception ne figure pas dans ce lot.';
  const action=hasScan?'Demander le bon de réception signé.':'Joindre le bon de réception.';
  const last=corrections.at(-1);
  const dateSource=!hasDevis?'Aucune échéance documentée dans ce lot.':last?
    'Date retenue par '+last.author+' : '+last.reason+' (valeur extraite du devis, p. 1 : 8 décembre 2026).':'Devis CD-041, page 1.';
  const draft=hasScan?'Objet : bon de réception à signer — Chantier Atelier Témoin\nBonjour, pourriez-vous me transmettre une copie signée du bon de réception des trois fenêtres ? Merci.\nÀ vérifier avant tout envoi.':'';
  return {summary:original+' '+observation, draft, date, dateSource, action, originalDate:extractedDate, hasDevis,hasScan};
}

// Publication des anciens dossiers à deux pièces, lors de leur première relecture après la migration.
async function restoreLegacy(db,sandbox) {
  const legacy=await query(db,`SELECT id FROM runs WHERE sandbox=? AND persona=? AND published_revision=0 AND published_at IS NOT NULL AND output_pdf IS NOT NULL`,sandbox.id,sandbox.persona).first();
  if(!legacy)return;
  const provenance=JSON.stringify({devis:{method:'fixture-replay'},scan:{method:'fixture-replay'}});
  await db.batch([
    query(db,`INSERT OR IGNORE INTO deliveries(run_id,revision,published_at,summary,draft,deadline,date_source,action,extraction,pdf)
      SELECT id,1,published_at,summary,draft,?,'Devis CD-041, page 1.','Demander le bon de réception signé.',?,output_pdf FROM runs
      WHERE id=? AND published_revision=0 AND published_at IS NOT NULL AND output_pdf IS NOT NULL`,originalDate,provenance,legacy.id),
    query(db,`INSERT OR IGNORE INTO lot_events(run_id,revision,submitted,published_at,published_revision)
      SELECT id,1,submitted,published_at,1 FROM runs WHERE id=? AND published_revision=0 AND published_at IS NOT NULL`,legacy.id),
    query(db,'UPDATE runs SET published_revision=1 WHERE id=? AND published_revision=0 AND EXISTS (SELECT 1 FROM deliveries WHERE run_id=runs.id AND revision=1)',legacy.id),
  ]);
}

async function drainOne(db) {
  const now=Date.now(),lease=crypto.randomUUID();
  const job=await query(db,`UPDATE runs SET status='processing',lease=?,lease_end=?,attempts=attempts+1
    WHERE id=(SELECT r.id FROM runs r JOIN sandboxes s ON s.id=r.sandbox WHERE s.expires>? AND r.closed=0 AND r.attempts<3
    AND ((r.status='queued' AND r.due<=?) OR (r.status='processing' AND r.lease_end<=?)) ORDER BY r.due LIMIT 1)
    RETURNING id,revision,input_pdf,input_scan,retained_date,corrections,attempts,
      (SELECT extraction FROM deliveries d WHERE d.run_id=runs.id AND d.revision=runs.published_revision) cached`,lease,now+20000,now,now,now).first();
  if(!job)return false;
  try {
    const cached=job.cached?JSON.parse(job.cached):{};
    const entries=await Promise.all([['devis', job.input_pdf],['scan',job.input_scan]].filter(([,v])=>v?.length || v?.byteLength).map(async([id,v])=>{
      const previous=cached[id];
      if(previous?.sha256===fixtureHashes[id] && (previous.processorRevision===processor?.revision || !processor) && previous.lines?.length) return [id,previous];
      return [id,await extractPublicFixture(id,new Uint8Array(v))];
    }));
    if(!entries.length)throw new Error('empty');
    const extraction=Object.fromEntries(entries), corrections=JSON.parse(job.corrections);
    const report=resultFor(extraction,job.retained_date,corrections);
    const {pdf,pack,count}=await renderReport({...report,extraction,corrections,revision:job.revision,publishedAt:Date.now(),pdfOnly:job.attempts>=3});
    const publishedAt=Date.now();
    const totalBytes=pdf.byteLength+(pack?.byteLength??0);
    if(totalBytes>1500000)throw Error('render_too_large');
    const live=`id=? AND revision=? AND lease=? AND status='processing' AND closed=0 AND EXISTS (SELECT 1 FROM sandboxes s WHERE s.id=runs.sandbox AND s.expires>?)`;
    const check=[job.id,job.revision,lease,Date.now()];
    await db.batch([
      query(db,`INSERT OR IGNORE INTO deliveries(run_id,revision,published_at,summary,draft,deadline,date_source,action,extraction,pdf,pack,file_count)
        SELECT id,revision,?,?,?,?,?,?,?,?,?,? FROM runs WHERE ${live} AND
        (SELECT coalesce(sum(length(pdf)+coalesce(length(pack),0)),0) FROM deliveries)+? <= 100000000`,
        publishedAt,report.summary,report.draft,report.date,report.dateSource,report.action,JSON.stringify(extraction),pdf,pack,count,...check,totalBytes),
      query(db,`UPDATE lot_events SET published_at=?,published_revision=?
        WHERE run_id=? AND published_at IS NULL AND revision<=? AND EXISTS(SELECT 1 FROM deliveries d WHERE d.run_id=? AND d.revision=?)`,
        publishedAt,job.revision,job.id,job.revision,job.id,job.revision),
      query(db,`UPDATE runs SET status='published',published_at=?,published_revision=revision,summary=?,draft=?,output_pdf=NULL,notifications=lots,lease=NULL
        WHERE ${live} AND EXISTS (SELECT 1 FROM deliveries d WHERE d.run_id=runs.id AND d.revision=runs.revision)`,publishedAt,report.summary,report.draft,...check),
      query(db,`UPDATE runs SET status='failed',lease=NULL WHERE ${live}`,...check),
    ]);
  }catch {
    await query(db,`UPDATE runs SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,lease=NULL,due=?
      WHERE id=? AND revision=? AND lease=?`,Date.now()+500,job.id,job.revision,lease).run();
  }
  return true;
}

async function reconcile(db, initialDelay=0) {
  if(initialDelay)await delay(initialDelay);
  await query(db,"UPDATE runs SET status='failed',lease=NULL WHERE status='processing' AND attempts>=3 AND lease_end<=?",Date.now()).run();
  for(let i=0;i<4;i++){if(!await drainOne(db))break;await delay(520);}
}

async function runFor(db,sandbox) {
  const row=await query(db,`SELECT r.id,r.status,r.submitted submittedAt,r.published_at publishedAt,r.notifications,r.summary,r.draft,
    r.revision,r.published_revision publishedRevision,r.closed,length(r.input_pdf)>0 hasPdf,length(r.input_scan)>0 hasScan,r.corrections,
    d.deadline date,d.date_source dateSource,d.action,d.extraction,coalesce(d.file_count,0) fileCount FROM runs r LEFT JOIN deliveries d ON d.run_id=r.id AND d.revision=r.published_revision
    WHERE r.sandbox=? AND r.persona=?`,sandbox.id,sandbox.persona).first();
  if(!row)return null;
  const {id,hasPdf,hasScan,corrections,extraction,...publicRow}=row;
  const past=(await query(db,'SELECT revision,published_at publishedAt,file_count fileCount FROM deliveries WHERE run_id=? ORDER BY revision DESC',id).all()).results;
  const lotEvents=(await query(db,'SELECT revision,submitted submittedAt,published_at publishedAt,published_revision publishedRevision FROM lot_events WHERE run_id=? ORDER BY revision',id).all()).results;
  const coversBoth=Boolean(extraction && JSON.parse(extraction).devis && JSON.parse(extraction).scan);
  return {...publicRow,lotEvents,packStatus:publicRow.fileCount>1?'complete':publicRow.fileCount===1?'pdf-only':'pending',hasInitialPack:Boolean(assets.initialPack && coversBoth),extractedDate:hasPdf?originalDate:null,extractedDateSource:hasPdf?'Devis CD-041, page 1.':null,closed:Boolean(row.closed),inputs:[...(hasPdf?['devis']:[]),...(hasScan?['scan']:[])],corrections:JSON.parse(corrections),
    extraction:extraction?JSON.parse(extraction):null,history:past.map(r=>({...r,href:'/api/livraison.pdf?revision='+r.revision,packHref:r.fileCount>1?'/api/livraison.zip?revision='+r.revision:null}))};
}

async function submit(db,sandbox,data,ctx) {
  if(!Array.isArray(data?.uploads)||data.uploads.length<1||data.uploads.length>2)return error('Choisissez une ou deux pièces du jeu fictif.',400);
  const inputs=new Map();
  for(const raw of data.uploads) {
    if(typeof raw!=='string'||raw.length>30000)return error('Format de pièce invalide.',400);
    let bytes;try{bytes=unpack(raw);}catch{return error('Format de pièce invalide.',400);}
    const hash=await sha(bytes);
    if(hash!==fixtureHashes.devis && hash!==fixtureHashes.scan)return error('Seules les pièces fictives fournies sont admises.',422);
    inputs.set(hash,bytes);
  }
  const pdf=inputs.get(fixtureHashes.devis) || new Uint8Array(), scan=inputs.get(fixtureHashes.scan) || new Uint8Array();
  const now=Date.now(),command=crypto.randomUUID();
  const batch=await db.batch([query(db,`INSERT INTO runs(id,sandbox,persona,status,submitted,due,input_pdf,input_scan,last_added,lot_command)
    SELECT ?,id,persona,'queued',?,?,?,?,?,? FROM sandboxes WHERE id=? AND persona=? AND persona IN ('a','b') AND expires>?
    ON CONFLICT(sandbox,persona) DO UPDATE SET status='queued',revision=runs.revision+1,lots=runs.lots+1,attempts=0,lease=NULL,
      last_added=(length(runs.input_pdf)=0 AND length(excluded.input_pdf)>0)+(length(runs.input_scan)=0 AND length(excluded.input_scan)>0),
      submitted=excluded.submitted,due=excluded.due,lot_command=excluded.lot_command,input_pdf=CASE WHEN length(runs.input_pdf)=0 THEN excluded.input_pdf ELSE runs.input_pdf END,
      input_scan=CASE WHEN length(runs.input_scan)=0 THEN excluded.input_scan ELSE runs.input_scan END
    WHERE runs.closed=0 AND runs.revision<16 AND ((length(runs.input_pdf)=0 AND length(excluded.input_pdf)>0) OR (length(runs.input_scan)=0 AND length(excluded.input_scan)>0))
    RETURNING last_added,revision`,crypto.randomUUID(),now,now+550,pdf,scan,inputs.size,command,sandbox.id,sandbox.persona,now),
    query(db,`INSERT OR IGNORE INTO lot_events(run_id,revision,submitted) SELECT id,revision,submitted FROM runs
      WHERE sandbox=? AND persona=? AND lot_command=?`,sandbox.id,sandbox.persona,command)]);
  const inserted=batch[0].results[0];
  if(!inserted) {
    const existing=await query(db,'SELECT closed,revision FROM runs WHERE sandbox=? AND persona=?',sandbox.id,sandbox.persona).first();
    if(existing?.closed)return error('Ce dossier est clôturé.',409);
    if(existing?.revision>=16)return error('Le quota de révisions de ce bac est atteint.',429);
    return error('Les pièces de ce lot ont déjà été déposées.',409);
  }
  ctx.waitUntil(reconcile(db,600));
  return respond({status:'queued',revision:inserted.revision,added:inserted.last_added,duplicates:data.uploads.length-inserted.last_added},202);
}

async function correct(db,sandbox,data,ctx){
  const date=data?.date,reason=data?.reason?.trim?.(),base=data?.revision;
  if(!realDate(date)||typeof reason!=='string'||!reason||reason.length>180||/[\u0000-\u001f]/.test(reason)||!Number.isInteger(base))return error('Indiquez une date valide et un motif court.',400);
  const now=Date.now();
  const updated=await query(db,`UPDATE runs SET retained_date=?,corrections=json_insert(corrections,'$[#]',json_object(
    'date',?,'reason',?,'author',?,'createdAt',?,'revision',revision+1)),revision=revision+1,status='queued',attempts=0,lease=NULL,submitted=?,due=?
    WHERE sandbox=? AND persona=? AND closed=0 AND revision=? AND published_revision=revision AND revision<15 AND length(input_pdf)>0 AND COALESCE(retained_date,?)<>?
    AND EXISTS(SELECT 1 FROM sandboxes WHERE id=runs.sandbox AND persona=runs.persona AND expires>?) RETURNING revision`,
    date,date,reason,'Client fictif '+sandbox.persona.toUpperCase(),now,now,now+550,sandbox.id,sandbox.persona,base,originalDate,date,now).first();
  if(!updated)return error('Correction indisponible. Relisez la dernière livraison et choisissez une nouvelle date.',409);
  ctx.waitUntil(reconcile(db,600));
  return respond({status:'queued',revision:updated.revision},202);
}

async function closeDossier(db,sandbox,data,ctx) {
  if(typeof data?.closed!=='boolean')return error('Indiquez l’état de clôture.',400);
  const row=await query(db,`UPDATE runs SET closed=?,status=CASE WHEN status='processing' THEN 'queued' ELSE status END,
    attempts=CASE WHEN status='processing' THEN 0 ELSE attempts END,lease=NULL,due=?
    WHERE sandbox=? AND persona=? AND EXISTS(SELECT 1 FROM sandboxes WHERE id=runs.sandbox AND persona=runs.persona AND expires>?) RETURNING closed`,
    Number(data.closed),Date.now(),sandbox.id,sandbox.persona,Date.now()).first();
  if(!row)return error('Aucun dossier déposé.',404);
  if(!row.closed)ctx.waitUntil(reconcile(db));
  return respond({closed:Boolean(row.closed)});
}

export default {
  async fetch(request,env,ctx) {
    const url = new URL(request.url), path = url.pathname;
    if(handlesConnector(path)) return handleConnector(request,env,digestCookie);
    if (request.method === 'GET') {
      if (path === '/' || path === '/recette/') return respond(page,200,{'Content-Type':'text/html; charset=utf-8'});
      if (path === '/robots.txt') return respond('User-agent: *\nDisallow: /\n',200,{'Content-Type':'text/plain'});
      const entry = {'/assets/logo.webp':assets.logo,'/fixtures/devis.pdf':assets.devis,'/fixtures/scan.png':assets.scan}[path];
      if (entry) return respond(unpack(entry.data),200,{'Content-Type':entry.type});
    }
    if (!['/api/services','/api/session','/api/depot','/api/dossier','/api/livraison.pdf','/api/correction','/api/cloture','/api/edition-initiale.zip','/api/livraison.zip'].includes(path)) return error('Route inconnue.',404);
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
      if(sandbox && sandbox.persona!=='sans')await restoreLegacy(db,sandbox);
      if (path === '/api/dossier' && request.method === 'GET') {
        ctx.waitUntil(reconcile(db));
        return respond({persona:sandbox?.persona ?? null,run:sandbox ? await runFor(db,sandbox) : null,fixtures:fixtureList});
      }
      if (!sandbox) return error('Choisissez un profil de recette.',401);
      if (sandbox.persona === 'sans') return error('Un abonnement fictif actif est requis avant le dépôt.',402);
      if(path==='/api/services') {
        const result=await handleDossierServices(db,sandbox,request.method,request.method==='POST'?await readBody(request):null);
        return respond(result.data,result.status);
      }
      if(path==='/api/edition-initiale.zip' && request.method==='GET') {
        const dbRow=await query(db,`SELECT d.extraction FROM runs r JOIN deliveries d ON d.run_id=r.id AND d.revision=r.published_revision
          WHERE r.sandbox=? AND r.persona=?`,sandbox.id,sandbox.persona).first();
        const sources=dbRow?JSON.parse(dbRow.extraction):{};
        if(!assets.initialPack || !sources.devis || !sources.scan)return error('Édition initiale indisponible.',404);
        return respond(unpack(assets.initialPack.data),200,{'Content-Type':'application/zip','Content-Disposition':'attachment; filename=Edition-initiale-fictive.zip'});
      }
      if (['/api/livraison.pdf','/api/livraison.zip'].includes(path) && request.method === 'GET') {
        const rev=url.searchParams.get('revision');
        if(rev!==null && !/^[1-9]\d?$/.test(rev))return error('Révision inconnue.',404);
        const archive=path.endsWith('.zip');
        const field=archive?'pack':'pdf';
        const row=await query(db,`SELECT d.${field} bytes,d.revision FROM runs r JOIN deliveries d ON d.run_id=r.id
          WHERE r.sandbox=? AND r.persona=? AND d.revision=coalesce(?,r.published_revision)`,sandbox.id,sandbox.persona,rev===null?null:Number(rev)).first();
        if(!row?.bytes)return error('Livraison indisponible.',404);
        return respond(new Uint8Array(row.bytes),200,{'Content-Type':archive?'application/zip':'application/pdf','Content-Disposition':
          'attachment; filename='+(archive?'Livraison-r'+row.revision+'.zip':'Tableau-de-bord-r'+row.revision+'.pdf')});
      }
      if(request.method!=='POST')return error('Méthode non autorisée.',405);
      const data=await readBody(request);
      if(path==='/api/depot')return await submit(db,sandbox,data,ctx);
      if(path==='/api/correction')return await correct(db,sandbox,data,ctx);
      if(path==='/api/cloture')return await closeDossier(db,sandbox,data,ctx);
      return error('Méthode non autorisée.',405);
    } catch { return error('Le service de recette est temporairement indisponible.',503); }
  },
  async scheduled(_event,env,ctx) { ctx.waitUntil(reconcile(env.DB)); },
};
