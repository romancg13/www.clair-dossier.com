import {createHash} from 'node:crypto';
import {readFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

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
const files = {
  logo:['../specimen/clairdossier.webp','image/webp'],
  devis:['../fixtures/devis.pdf','application/pdf'],
  scan:['../fixtures/scan.png','image/png'],
  report:['../specimen/tableau-de-bord.pdf','application/pdf'],
  initialPack:['../editions/atelier-temoin-r1.zip','application/zip'],
};
const assets={}, fixtureHashes={};
for (const [id,[file,type]] of Object.entries(files)) {
  const data = await readFile(resolve(here,file));
  assets[id] = {data:data.toString('base64'),type};
  if (id==='devis' || id==='scan') fixtureHashes[id]=createHash('sha256').update(data).digest('hex');
}
const fixtureList=[{id:'devis',name:'Devis CD-041.pdf',url:'/fixtures/devis.pdf'},
  {id:'scan',name:'Bon de réception.png',url:'/fixtures/scan.png'}];
const page=await readFile(resolve(here,'page.html'),'utf8');
const declarations=Object.entries({page,assets,fixtureHashes,fixtureList,processor}).map(([name,value])=>'export const '+name+' = '+JSON.stringify(value)+';').join('\n');
await mkdir(outDir,{recursive:true});
await build({
  stdin:{contents:`import worker from './worker.mjs';
    const release = ${JSON.stringify(release)};
    export default { ...worker, fetch(req,env,ctx) {
      const url = new URL(req.url);
      if (release && url.pathname === '/' && url.searchParams.has('version') && url.searchParams.get('version') !== release.commit) {
        return new Response('Le dossier de démonstration a changé de version. Ouvrez le lien de la dernière remise pour essayer cette édition.', {status:409,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Robots-Tag':'noindex'}});
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
