// Authenticated identity headers are furnished by Sites dispatch on its assigned origin.
const origin = 'https://clairdossier-recette-atelier-20261118.j-gomes346249.chatgpt.site';
const consentPath = '/recette/connexion-chatgpt';
const tool = {
  name: 'lire_etat_dossier', description: 'Lire l’état, la révision, la dernière livraison et les anomalies techniques du dossier fictif autorisé.',
  inputSchema: {type:'object', properties:{}, additionalProperties:false},
  annotations: {readOnlyHint:true, destructiveHint:false, idempotentHint:true, openWorldHint:false},
};
const headers = {'Cache-Control':'private, no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'};
const statement = (db,sql,...values) => db.prepare(sql).bind(...values);
const json = (value,status=200) => Response.json(value,{headers,status});
const help = 'Ouvrez le dossier de recette, choisissez un profil abonné et autorisez la lecture dans « Autoriser ChatGPT à lire l’état de ce dossier ».';
function html(title,body,status=200) {
  const content = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · ClairDossier</title><style>body{max-width:38rem;margin:2rem auto;padding:1rem;font:17px/1.55 system-ui;color:#0d1b3d}h1{font-family:Georgia,serif}button,a{color:#0d1b3d}button{padding:.6rem;margin:.3rem}</style></head><body><main><a href="/">Revenir à mon dossier fictif</a><h1>${title}</h1>${body}</main></body></html>`;
  return new Response(content,{status,headers:{...headers,'Content-Type':'text/html; charset=utf-8','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"}});
}
async function boundedText(request,limit) {
  if (!request.body) return '';
  const reader=request.body.getReader(), decoder=new TextDecoder();
  let text='', count=0;
  for (;;) {
    const {value,done}=await reader.read();
    if (done) return text+decoder.decode();
    count+=value.length;
    if(count>limit){await reader.cancel();return null;}
    text+=decoder.decode(value,{stream:true});
  }
}
async function subject(request) {
  const value = request.headers.get('oai-authenticated-user-id');
  if (!value || value.length>512 || new URL(request.url).origin!==origin) return null;
  const hash = await crypto.subtle.digest('SHA-256',new TextEncoder().encode('clairdossier-recette-ateliers|'+value));
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
const success = value => ({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
const denied = message => ({isError:true,content:[{type:'text',text:message}]});
async function rpc(request,db) {
  if (request.method!=='POST') return json({error:'POST requis.'},405);
  if (!request.headers.get('Content-Type')?.includes('application/json')) return json({error:'Corps JSON requis.'},415);
  const bytes=await boundedText(request,8192);
  if(bytes===null) return json({error:'Requête trop volumineuse.'},413);
  let msg;
  try { msg=JSON.parse(bytes); } catch { return json({jsonrpc:'2.0',id:null,error:{code:-32700,message:'JSON invalide'}}); }
  if (!msg || msg.jsonrpc!=='2.0' || typeof msg.method!=='string') return json({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Requête invalide'}});
  if (msg.id===undefined) return new Response(null,{status:202,headers});
  const id=msg.id, ok=result=>json({jsonrpc:'2.0',id,result});
  if (msg.method==='server/discover') return ok({supportedVersions:['2026-07-28'],capabilities:{tools:{}}});
  if (msg.method==='initialize') return ok({protocolVersion:'2025-11-25',capabilities:{tools:{}},serverInfo:{name:'clairdossier-recette',version:'2.0.0'}});
  if (msg.method==='ping') return ok({});
  if (msg.method==='tools/list') return ok({tools:[tool]});
  if (msg.method!=='tools/call') return json({jsonrpc:'2.0',id,error:{code:-32601,message:'Méthode inconnue'}});
  const args=msg.params?.arguments;
  if (msg.params?.name!==tool.name || (args!==undefined && (!args || typeof args!=='object' || Array.isArray(args) || Object.keys(args).length)))
    return ok(denied('Outil ou paramètres inconnus.'));
  const owner=await subject(request);
  if (!owner) return ok(denied(help));
  const now=Date.now();
  const row=await statement(db,`SELECT r.status,r.published_revision,r.published_at FROM connector_grants g
    JOIN sandboxes s ON s.id=g.sandbox JOIN runs r ON r.sandbox=g.sandbox AND r.persona=g.persona
    WHERE g.subject=? AND g.expires>? AND s.expires>? AND s.persona=g.persona
    AND g.persona IN ('a','b') AND r.closed=0`,owner,now,now).first();
  if (!row) return ok(denied(help));
  return ok(success({etat:row.status,revision_livree:row.published_revision||Number(Boolean(row.published_at)),
    derniere_livraison:row.published_at?new Date(row.published_at).toISOString():null,
    anomalies:row.status==='failed'?['TRAITEMENT_INTERROMPU']:[]}));
}
export const handlesConnector = path => path==='/mcp' || path===consentPath;
export async function handleConnector(request,env,digestCookie) {
  const url=new URL(request.url);
  if(url.origin!==origin) return json({error:'Origine non autorisée.'},403);
  try {
    if(url.pathname==='/mcp') return await rpc(request,env.DB);
    if(!['GET','POST'].includes(request.method)) return html('Requête non prise en charge','<p>Utilisez le formulaire du dossier.</p>',405);
    const owner=await subject(request);
    if(!owner) return html('Autoriser la lecture depuis ChatGPT',
      '<p>Connectez-vous à ChatGPT dans ce navigateur pour rattacher votre propre dossier de recette.</p><p><a target="_top" href="/signin-with-chatgpt?return_to=%2Frecette%2Fconnexion-chatgpt">Se connecter avec ChatGPT</a></p>');
    if(request.method==='POST' && request.headers.get('Origin')!==origin) return html('Demande refusée','<p>Revenez au formulaire du dossier.</p>',403);
    const sandbox=await digestCookie(request), now=Date.now();
    if(request.method==='POST') {
      if (request.headers.get('Content-Type')?.split(';')[0]!=='application/x-www-form-urlencoded') return json({error:'Formulaire requis.'},415);
      const data=await boundedText(request,256);
      if(data===null) return json({error:'Formulaire trop volumineux.'},413);
      const form=new URLSearchParams(data);
      if(form.get('action')==='revoke') {
        await statement(env.DB,'DELETE FROM connector_grants WHERE subject=?',owner).run();
        return html('Accès révoqué','<p>ChatGPT devra obtenir une nouvelle autorisation pour lire l’état de votre dossier.</p>');
      }
      if(form.get('action')!=='allow') return json({error:'Action inconnue.'},400);
      const consent=await statement(env.DB,`INSERT INTO connector_grants(subject,sandbox,persona,expires)
        SELECT ?,s.id,s.persona,min(?,s.expires) FROM sandboxes s JOIN runs r ON r.sandbox=s.id AND r.persona=s.persona
        WHERE s.id=? AND s.expires>? AND s.persona IN ('a','b') AND r.closed=0
        ON CONFLICT(subject) DO UPDATE SET sandbox=excluded.sandbox,persona=excluded.persona,expires=excluded.expires
        RETURNING expires`,owner,now+900_000,sandbox,now).first();
      if(!consent) return html('Aucun dossier éligible','<p>Revenez au bac de recette. Choisissez le client A ou B puis déposez les pièces fictives dans un dossier ouvert.</p>',403);
      return html('Lecture autorisée','<p>Dans ChatGPT, sélectionnez l’app privée ClairDossier de recette et demandez « Lis l’état de mon dossier ». L’autorisation expire dans quinze minutes ou à la fin de la session de recette.</p><form method="post"><button name="action" value="revoke">Révoquer maintenant</button></form>');
    }
    const eligible = sandbox && await statement(env.DB,`SELECT s.persona FROM sandboxes s JOIN runs r ON r.sandbox=s.id AND r.persona=s.persona WHERE s.id=? AND s.expires>? AND s.persona IN ('a','b') AND r.closed=0`,sandbox,now).first();
    const grant = await statement(env.DB,'SELECT expires FROM connector_grants WHERE subject=? AND expires>?',owner,now).first();
    const permission = eligible ? `<p>Vous autorisez pendant quinze minutes l’app privée ChatGPT à lire l’état du dossier Atelier Témoin du client fictif ${eligible.persona==='b'?'B':'A'}, sa révision livrée, l’heure de dernière livraison et les anomalies techniques. Le contenu des pièces reste privé.</p><form method="post"><button name="action" value="allow">Autoriser cette lecture</button></form>` : '<p>Choisissez un profil abonné et déposez les pièces dans votre dossier fictif pour autoriser sa lecture.</p>';
    return html('Accès privé depuis ChatGPT',permission+(grant?'<form method="post"><button name="action" value="revoke">Révoquer mon autorisation</button></form>':''));
  } catch { return json({error:'Connecteur temporairement indisponible.'},503); }
}
