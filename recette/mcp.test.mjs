import { strict as assert } from 'node:assert';
import { createHash, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { handleMcp } from './mcp.mjs';

test('consentement personnel, lecture limitée au dossier, expiration et révocation', async t => {
  const db = new DatabaseSync(':memory:');
  let session = null;
  let eligible = true;
  const admin = {accountId:'admin-test',role:'admin',demoId:'bac-A',dossierId:'dossier-A'};
  const status = {status:'published',revision:1,publishedAt:'2026-11-18T10:00:00Z',anomalies:[]};
  const readConnectorStatus = ({demoId,dossierId}) => eligible && demoId === 'bac-A' && dossierId === 'dossier-A' ? status : null;
  const server = createServer(async (req,res) => {
    const url = new URL(req.url,'http://localhost');
    await handleMcp({req,res,url,db,session,readConnectorStatus});
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const previous = {origin:process.env.RECETTE_MCP_ORIGIN,callback:process.env.RECETTE_CHATGPT_CALLBACK};
  const callback = 'https://chatgpt.com/connector_platform_oauth_redirect';
  process.env.RECETTE_MCP_ORIGIN = origin;
  process.env.RECETTE_CHATGPT_CALLBACK = callback;
  t.after(async () => {
    await new Promise(resolve=>server.close(resolve));
    db.close();
    for (const [key,value] of [['RECETTE_MCP_ORIGIN',previous.origin],['RECETTE_CHATGPT_CALLBACK',previous.callback]]) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const resource = origin + '/recette/mcp';
  const form = (path,data) => fetch(origin+path,{method:'POST',body:new URLSearchParams(data),headers:{Origin:origin},redirect:'manual'});
  const rpc = (token,method,params) => fetch(resource,{method:'POST',
    headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
    body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});
  const challenge = await fetch(resource);
  assert.equal(challenge.status,401);
  assert.match(challenge.headers.get('www-authenticate'),/oauth-protected-resource/);
  const metadata = await (await fetch(origin+'/.well-known/oauth-protected-resource/recette/mcp')).json();
  assert.equal(metadata.resource,resource);
  assert.deepEqual(metadata.scopes_supported,['dossier:status']);
  const serverMetadata = await (await fetch(origin+'/.well-known/oauth-authorization-server')).json();
  assert.deepEqual(serverMetadata.code_challenge_methods_supported,['S256']);
  for (const [client,redirect] of [['clairdossier-claude-code','http://localhost:31791/callback'],['clairdossier-chatgpt',callback]]) {
    const verifier = randomBytes(48).toString('base64url');
    const params = new URLSearchParams({client_id:client,redirect_uri:redirect,state:'fixture-state',
      code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',
      response_type:'code',scope:'dossier:status',resource});
    session = null;
    const url = serverMetadata.authorization_endpoint+'?'+params;
    assert.equal((await fetch(url)).status,403);
    session = admin;
    const consent = await (await fetch(url)).text();
    const ticket = /name="ticket" value="([^"]+)"/.exec(consent)[1];
    const approval = await form('/recette/oauth/authorize',{ticket,decision:'allow'});
    assert.equal(approval.status,303);
    const next = new URL(approval.headers.get('location'));
    assert.equal(next.origin+next.pathname,redirect);
    assert.equal(next.searchParams.get('state'),'fixture-state');
    const exchange = {grant_type:'authorization_code',client_id:client,redirect_uri:redirect,
      code:next.searchParams.get('code'),code_verifier:verifier,resource};
    const tokenResponse = await form('/recette/oauth/token',exchange);
    assert.equal(tokenResponse.status,200);
    const {access_token:token} = await tokenResponse.json();
    assert.equal((await form('/recette/oauth/token',exchange)).status,400);
    session = null;
    assert.equal((await (await rpc(token,'initialize',{protocolVersion:'2025-06-18'})).json()).result.protocolVersion,'2025-06-18');
    assert.equal((await (await rpc(token,'tools/list',{})).json()).result.tools.length,1);
    const result = await (await rpc(token,'tools/call',{name:'lire_etat_dossier',arguments:{}})).json();
    assert.deepEqual(result.result.structuredContent,{dossier:'dossier-A',etat:'published',revision:1,
      derniere_livraison:status.publishedAt,anomalies:[]});
    eligible = false;
    assert.equal((await rpc(token,'tools/list',{})).status,401);
    eligible = true;
    if (client === 'clairdossier-claude-code') {
      assert.equal((await form('/recette/oauth/revoke',{client_id:client,token})).status,200);
    } else {
      db.prepare("UPDATE recette_mcp_grants SET expires=0 WHERE stage='access'").run();
    }
    assert.equal((await rpc(token,'tools/list',{})).status,401);
  }
});
