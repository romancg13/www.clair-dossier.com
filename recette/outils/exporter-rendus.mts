// Produit les rendus du dossier fictif dans un dossier local (contrôle visuel, recette).
// Usage : npx tsx recette/outils/exporter-rendus.mts <dossier-de-sortie>
import { mkdirSync, writeFileSync } from 'node:fs';
import { stack } from '../../tests/helpers/recette.ts';
const out = process.argv[2] ?? 'rendus-lumen';
mkdirSync(out, { recursive: true });
const s = stack();
await s.user('A');
await s.dossier('D1', 'A');
await s.depose('D1', 'A', 'L1', ['Courrier-bailleur-2026-10-12.pdf', 'Avis-echeance-T4-2026.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml']);
await s.run();
await s.depose('D1', 'A', 'L2', ['Bail-commercial-2021.pdf']);
await s.run();
const pub = await s.store.getPublished('D1');
for (const c of Object.values(pub)) for (const f of c!.files) writeFileSync(`${out}/${f.name}`, (await s.kv.getBytes(f.path))!);
writeFileSync(`${out}/vue.json`, JSON.stringify((await s.store.getView('D1'))!.view, null, 2));
console.log(Object.values(pub).flatMap((c) => c!.files.map((f) => `${f.name} ${f.size_bytes}`)).join('\n'));
