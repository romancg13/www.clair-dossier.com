import {createHash} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import empreintes from '../fixtures/empreintes.json' with {type:'json'};
import {FOOD_FIXTURES} from './collecte.mjs';
import {B_FIXTURES} from './chantier-b.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const [outDir, releasePath] = process.argv.slice(2);
if (!outDir) throw Error('Indiquer le répertoire de sortie de recette.');
const release = releasePath ? JSON.parse(await readFile(releasePath,'utf8')) : null;
if (release && !/^[0-9a-f]{40}$/.test(release.commit)) throw Error('Révision de recette invalide.');
const processor = release?.processor ?? null;
if (processor) {
  const service = new URL(processor.origin);
  if (service.protocol!=='https:' || service.origin!==processor.origin || service.username || service.password ||
      !/^clairdossier-demo(?:-[a-z0-9-]+)?\.vercel\.app$/.test(service.hostname) || !/^[a-f0-9]{40}$/.test(processor.revision))
    throw Error('Le processeur doit désigner un déploiement et une révision du projet de recette.');
}
const sources = {
  a: [
    ['devis','devis.pdf','Devis CD-041.pdf'],
    ['scan','scan.png','Bon de réception.png'],
  ],
  b: Object.entries(B_FIXTURES).map(([id,spec])=>[id,id+(id==='reception-b'?'.png':'.pdf'),spec.name]),
  c: Object.entries(FOOD_FIXTURES).map(([id,spec])=>[id,id+(id==='quai'?'.png':'.pdf'),spec.name]),
};
const files = {
  logo:['../specimen/clairdossier.webp','image/webp'],
  report:['../specimen/tableau-de-bord.pdf','application/pdf'],
  initialPack:['../editions/atelier-temoin-r1.zip','application/zip'],
};
const lists = {a:[],b:[],c:[]};
for (const [persona,entries] of Object.entries(sources)) {
  for (const [id,filename,name] of entries) {
    const pdf = filename.endsWith('.pdf');
    files[id] = ['../fixtures/'+filename,pdf?'application/pdf':'image/png'];
    lists[persona].push({id,name,url:'/fixtures/'+filename,sha256:empreintes[id],method:pdf?'pdf-text':'tesseract-wasm-eng'});
  }
}
const assets={};
for (const [id,[file,type]] of Object.entries(files)) {
  const data=await readFile(resolve(here,file));
  if (file.startsWith('../fixtures/') && createHash('sha256').update(data).digest('hex')!==empreintes[id]) {
    throw Error('Empreinte de la pièce fictive incorrecte : '+id);
  }
  assets[id]={data:data.toString('base64'),type};
}
const [template,stylesheet,javascript]=await Promise.all(['page.html','page.css','page.js'].map(file=>readFile(resolve(here,file),'utf8')));
const html=template.replace('<!--STYLE_DEMO-->',()=>'<style>'+stylesheet+'</style>')
  .replace('<!--SCRIPT_DEMO-->',()=>'<script>'+javascript+'</script>');
const page=processor?html.replace('data-preview-pricing hidden',`href="${new URL('/tarifs/',processor.origin).href}"`):html;
const values={page,assets,fixtureHashes:empreintes,fixtureList:lists.a,bFixtureList:lists.b,foodFixtureList:lists.c,processor};
const declarations=Object.entries(values).map(([name,value])=>'export const '+name+' = '+JSON.stringify(value)+';').join('\n');
await mkdir(outDir,{recursive:true});
await build({
  stdin:{contents:`import worker from './worker.mjs';
    const release = ${JSON.stringify(release)};
    export default { ...worker, fetch(req,env,ctx) {
      const url = new URL(req.url);
      const versions = url.searchParams.getAll('version');
      const dossierPath = ['/', '/recette', '/recette/'].includes(url.pathname);
      if (release && dossierPath && versions.length && (versions.length!==1 || versions[0]!==release.commit)) {
        const requestedClient=url.searchParams.getAll('client');
        const current=requestedClient.length===1 && requestedClient[0]==='banque-alimentaire'?'/?client=banque-alimentaire':'/';
        const body='<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Édition archivée · ClairDossier</title><main><h1>Ce lien correspond à une ancienne édition.</h1><p>Une nouvelle version du dossier de démonstration est disponible.</p><p><a href="'+current+'">Ouvrir l’édition actuelle</a></p></main></html>';
        return new Response(req.method==='HEAD'?null:body,{status:409,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','Referrer-Policy':'no-referrer'}});
      }
      if (release && req.method === 'GET' && url.pathname === '/version.json') {
        return Response.json(release,{headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
      }
      return worker.fetch(req,env,ctx);
    }};`,resolveDir:here,sourcefile:'site-recipe-entry.mjs'},
  outfile:resolve(outDir,'index.js'),bundle:true,platform:'browser',format:'esm',target:'es2022',minify:true,
  plugins:[{name:'assets-recette',setup(es){
    es.onResolve({filter:/^\.\/assets\.mjs$/},()=>({path:'fixture-assets',namespace:'recette'}));
    es.onLoad({filter:/.*/,namespace:'recette'},()=>({contents:declarations,loader:'js'}));
  }}],
});
