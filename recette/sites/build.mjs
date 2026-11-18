import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), dest = process.argv[2];
if (!dest) throw Error('Indiquer le répertoire de sortie de recette.');
const files = {
  logo:['../specimen/clairdossier.webp','image/webp'],
  devis:['../fixtures/devis.pdf','application/pdf'],
  scan:['../fixtures/scan.png','image/png'],
  report:['../specimen/tableau-de-bord.pdf','application/pdf'],
};
const assets = {}, fixtureHashes = {};
for (const [id,[file,type]] of Object.entries(files)) {
  const data = await readFile(resolve(here,file));
  assets[id] = {data:data.toString('base64'),type};
  if (id==='devis' || id==='scan') fixtureHashes[id]=createHash('sha256').update(data).digest('hex');
}
const fixtureList = [{id:'devis',name:'Devis CD-041.pdf',url:'/fixtures/devis.pdf'},
  {id:'scan',name:'Bon de réception.png',url:'/fixtures/scan.png'}];
const page = await readFile(resolve(here,'page.html'),'utf8');
const source = await readFile(resolve(here,'worker.mjs'),'utf8');
const prelude = Object.entries({page,assets,fixtureHashes,fixtureList}).map(([name,value])=>'const '+name+' = '+JSON.stringify(value)+';').join('\n');
await mkdir(dest,{recursive:true});
await writeFile(resolve(dest,'index.js'),source.replace("import { page, assets, fixtureHashes, fixtureList } from './assets.mjs';",()=>prelude));
