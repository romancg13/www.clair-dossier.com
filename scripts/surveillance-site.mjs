/**
 * Surveillance quotidienne hébergée (GitHub Actions, .github/workflows/surveillance.yml).
 * Aucune donnée client, aucun secret : uniquement des requêtes publiques.
 *
 * Échec (= alerte GitHub au propriétaire) SEULEMENT si une action est requise :
 * site indisponible, lien de paiement inattendu, indexation bloquée.
 * L'état du moteur IA est rapporté sans jamais faire échouer le contrôle.
 */
import { appendFileSync, readFileSync } from 'node:fs';

const SITE = 'https://www.clair-dossier.com';
const SUPABASE = 'https://buzgokfmxpmyceppvjpp.supabase.co';
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emdva2ZteHBteWNlcHB2anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5NjksImV4cCI6MjA5NzEyNTk2OX0.MBRiuEYKl-b4_dNYpWKjWRm8qaFAXfwHjyAvf3Kzn2U';
const ROUTES = ['/', '/tarifs/', '/fonctionnalites/', '/securite/', '/etat-du-produit/', '/contact/', '/cgv/', '/politique-confidentialite/', '/mentions-legales/', '/sitemap.xml', '/robots.txt', '/llms.txt'];

const lignes = [];
let echecs = 0;
const ok = (m) => lignes.push(`- ✅ ${m}`);
const info = (m) => lignes.push(`- ℹ️ ${m}`);
const ko = (m) => {
  lignes.push(`- ❌ ${m}`);
  echecs++;
};
const get = (url, init) => fetch(url, { redirect: 'follow', ...init }).catch(() => null);

// 1. Disponibilité
for (const r of ROUTES) {
  const res = await get(SITE + r);
  if (!res || res.status !== 200) ko(`${r} → ${res ? res.status : 'injoignable'}`);
}
if (!echecs) ok(`${ROUTES.length} routes publiques en HTTP 200`);
const version = await get(`${SITE}/version.json?t=${Date.now()}`).then((r) => r?.json()).catch(() => null);
if (version?.commit) {
  const attendu = process.env.GITHUB_SHA;
  if (attendu && version.commit !== attendu) info(`version servie ${version.commit.slice(0, 7)} ≠ main ${attendu.slice(0, 7)} (déploiement en cours ou en échec)`);
  else ok(`version servie ${version.commit.slice(0, 7)} (construite le ${version.builtAt})`);
}

// 2. Paiements gelés : aucun lien de paiement inattendu sur le site public
const gel = JSON.parse(readFileSync(new URL('../tests/paiements-geles.json', import.meta.url), 'utf8'));
const autorises = new Set(gel.liensStripe);
const vus = new Set();
for (const r of ['/', '/tarifs/']) {
  const html = await get(SITE + r).then((x) => x?.text()).catch(() => '');
  for (const l of html?.match(/https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+/g) ?? []) vus.add(l);
}
const inattendus = [...vus].filter((l) => !autorises.has(l));
if (inattendus.length) ko(`lien(s) de paiement absent(s) de la référence gelée : ${inattendus.join(', ')}`);
else ok(`liens de paiement servis conformes à la référence gelée (${vus.size} vus)`);

// 3. Indexation
const robots = await get(`${SITE}/robots.txt`).then((r) => r?.text()).catch(() => '');
if (/^Disallow:\s*\/\s*$/m.test(robots ?? '')) ko('robots.txt bloque tout le site');
else ok('robots.txt sans blocage global');

// 4. Moteur IA (rapport seulement)
const table = await get(`${SUPABASE}/rest/v1/ai_jobs?select=id&limit=0`, { headers: { apikey: ANON, Authorization: `Bearer ${ANON}` } });
const worker = await get(`${SUPABASE}/functions/v1/ai-worker`, { method: 'OPTIONS' });
const installe = table && table.status !== 404;
const deploye = worker && worker.status !== 404;
info(`moteur IA : migrations ${installe ? 'présentes' : 'absentes'}, ai-worker ${deploye ? 'déployé' : 'non déployé'} — ${installe && deploye ? 'infrastructure en place (état détaillé : console admin « IA privée »)' : 'inactif, aucun dossier traité'}`);
const panneau = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8').includes("VITE_AI_ENGINE: '1'");
info(`panneau IA client : ${panneau ? 'ACTIVÉ dans le build' : 'désactivé (VITE_AI_ENGINE absent)'}`);

const rapport = `## Surveillance ClairDossier — ${new Date().toISOString().slice(0, 10)}\n\n${lignes.join('\n')}\n\n${echecs ? `**${echecs} problème(s) à traiter.**` : 'Aucune action requise.'}\n`;
console.log(rapport);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, rapport);
process.exit(echecs ? 1 : 0);
