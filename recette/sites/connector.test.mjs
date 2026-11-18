import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {test} from 'node:test';
import {handleConnector} from './connector.mjs';

test('la lecture MCP utilise le consentement du compte Sites, un seul dossier et son droit actuel',async t=>{
  const sql=new DatabaseSync(':memory:');
  t.after(()=>sql.close());
  for(const migration of readdirSync(new URL('./drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) {
    sql.exec(readFileSync(new URL('./drizzle/'+migration,import.meta.url),'utf8'));
  }
  const db={prepare(statement){const prepared=sql.prepare(statement);return {bind(...values){return {
    first:()=>prepared.get(...values),run:()=>prepared.run(...values),
  };}};}};
  const now=Date.now(), env={DB:db}, origin='https://clairdossier-recette-atelier-20261118.j-gomes346249.chatgpt.site';
  for(const id of ['demo1','demo2']) {
    sql.prepare("INSERT INTO sandboxes VALUES(?,'a',?)").run(id,now+86400000);
    sql.prepare("INSERT INTO runs(id,sandbox,persona,status,submitted,due,input_pdf,input_scan,published_revision,published_at) VALUES(?,?, 'a','published',0,0,?, ?,1,?)")
      .run(id+'-dossier',id,new Uint8Array(1),new Uint8Array(1),now);
  }
  const consentPath='/recette/connexion-chatgpt';
  let account=null, sandbox=null;
  const send=async(path,body,contentType)=>{
    const headers={Origin:origin};
    if(account) headers['oai-authenticated-user-id']=account;
    if(contentType) headers['Content-Type']=contentType;
    return handleConnector(new Request(origin+path,{method:body?'POST':'GET',headers,body}),env,async()=>sandbox);
  };
  const ask=async(method,params)=>{
    const reply=await send('/mcp',JSON.stringify({jsonrpc:'2.0',id:1,method,params}),'application/json');
    return (await reply.json()).result;
  };
  const read=()=>ask('tools/call',{name:'lire_etat_dossier',arguments:{}});
  const consent=action=>send(consentPath,'action='+action+'&dossier='+sandbox+'-dossier','application/x-www-form-urlencoded');
  assert.equal((await ask('tools/list')).tools[0].name,'lire_etat_dossier');
  assert.equal((await read()).isError,true);
  assert.match(await (await send(consentPath)).text(),/signin-with-chatgpt/);
  account='utilisateur-A-fixture';sandbox='demo1';
  assert.equal((await read()).isError,true);
  assert.equal((await consent('allow')).status,200);
  const visible=(await read()).structuredContent;
  assert.deepEqual(visible,{etat:'published',revision_livree:1,derniere_livraison:new Date(now).toISOString(),anomalies:[]});
  account='utilisateur-B-fixture';sandbox='demo2';
  assert.equal((await read()).isError,true);
  account='utilisateur-A-fixture';sandbox='demo1';
  sql.exec("UPDATE runs SET closed=1 WHERE sandbox='demo1'");
  assert.equal((await read()).isError,true);
  sql.exec("UPDATE runs SET closed=0 WHERE sandbox='demo1'");
  await consent('revoke');
  assert.equal((await read()).isError,true);
  await consent('allow');
  sql.exec('UPDATE connector_grants SET expires=0');
  assert.equal((await read()).isError,true);
});
