/**
 * Maintenance hébergée (GitHub Actions, .github/workflows/maintenance.yml).
 *   node scripts/maintenance.mjs hebdo    — liens du sitemap, audit npm, santé des workflows
 *   node scripts/maintenance.mjs mensuel  — synthèse des incidents sur 30 jours + rappels manuels
 * Lecture seule, aucune donnée client, aucun secret (GITHUB_TOKEN en lecture).
 * Échec (= alerte GitHub) seulement si une action est requise.
 */
import { appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const MODE = process.argv[2] === 'mensuel' ? 'mensuel' : 'hebdo';
const SITE = 'https://www.clair-dossier.com';
const REPO = process.env.GITHUB_REPOSITORY ?? 'romancg13/www.clair-dossier.com';
const lignes = [];
let echecs = 0;
const ok = (m) => lignes.push(`- ✅ ${m}`);
const info = (m) => lignes.push(`- ℹ️ ${m}`);
const ko = (m) => {
  lignes.push(`- ❌ ${m}`);
  echecs++;
};
const get = (url, init) => fetch(url, { redirect: 'follow', ...init }).catch(() => null);
const gh = (path) =>
  get(`https://api.github.com/repos/${REPO}/${path}`, {
    headers: { Accept: 'application/vnd.github+json', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) },
  }).then((r) => (r?.ok ? r.json() : null));

/** Exécutions des 30 (ou 7) derniers jours, par workflow. */
async function bilanWorkflows(jours) {
  const depuis = new Date(Date.now() - jours * 86400_000).toISOString().slice(0, 10);
  const data = await gh(`actions/runs?per_page=100&created=>=${depuis}`);
  if (!data) return info('historique des workflows non lisible');
  const parNom = new Map();
  for (const r of data.workflow_runs) {
    if (r.status !== 'completed') continue;
    const s = parNom.get(r.name) ?? { total: 0, echecs: [] };
    s.total++;
    if (!['success', 'skipped'].includes(r.conclusion)) s.echecs.push(`${r.conclusion} ${r.head_sha.slice(0, 7)} ${r.created_at.slice(0, 10)}`);
    parNom.set(r.name, s);
  }
  for (const [nom, s] of parNom) {
    if (s.echecs.length) info(`${nom} : ${s.echecs.length}/${s.total} exécution(s) non réussie(s) — ${s.echecs.slice(0, 3).join(' ; ')}`);
    else ok(`${nom} : ${s.total} exécution(s), toutes réussies`);
  }
  // Une branche principale dont le dernier déploiement a échoué est une action requise.
  const deploy = await gh('actions/workflows/deploy.yml/runs?branch=main&per_page=1');
  const d = deploy?.workflow_runs?.[0];
  if (d?.status === 'completed' && d.conclusion !== 'success') ko(`dernier déploiement de production en échec : ${d.html_url}`);
  // Une surveillance quotidienne qui ne tourne plus est une alerte silencieuse.
  const surv = await gh('actions/workflows/surveillance.yml/runs?per_page=1');
  const s = surv?.workflow_runs?.[0];
  if (!s || Date.now() - Date.parse(s.created_at) > 3 * 86400_000) ko('surveillance quotidienne sans exécution depuis plus de 3 jours');
}

async function hebdo() {
  // 1. Liens : toutes les URL du sitemap répondent 200.
  const xml = (await get(`${SITE}/sitemap.xml`).then((r) => r?.text())) ?? '';
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  if (!urls.length) ko('sitemap.xml vide ou injoignable');
  const casses = [];
  for (const u of urls) {
    const r = await get(u, { method: 'HEAD' });
    if (!r || r.status !== 200) casses.push(`${u} → ${r ? r.status : 'injoignable'}`);
  }
  if (casses.length) ko(`${casses.length} URL du sitemap en erreur : ${casses.slice(0, 5).join(', ')}`);
  else if (urls.length) ok(`${urls.length} URL du sitemap en HTTP 200`);

  // 2. Dépendances : vulnérabilités élevées/critiques dans le code livré = action requise.
  for (const [dossier, prod] of [['.', true], ['mobile', false]]) {
    try {
      const out = execFileSync('npm', ['audit', '--package-lock-only', '--json', ...(prod ? ['--omit=dev'] : [])], { cwd: dossier, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      report(dossier, prod, JSON.parse(out));
    } catch (e) {
      // npm audit sort en code ≠ 0 dès qu'il trouve une vulnérabilité : le JSON reste sur stdout.
      try {
        report(dossier, prod, JSON.parse(e.stdout));
      } catch {
        info(`audit npm ${dossier} : non exécutable (${e.message.split('\n')[0]})`);
      }
    }
  }

  // 3. Santé des automatisations sur 7 jours.
  await bilanWorkflows(7);
}

function report(dossier, prod, audit) {
  const v = audit.metadata?.vulnerabilities ?? {};
  const graves = (v.high ?? 0) + (v.critical ?? 0);
  const libelle = `audit npm ${dossier === '.' ? 'site' : 'mobile'}${prod ? ' (code livré)' : ''} : ${v.total ?? 0} vulnérabilité(s) dont ${graves} élevée(s)/critique(s)`;
  if (graves && prod) ko(libelle);
  else if (graves) info(`${libelle} — à traiter via une PR de dépendances`);
  else ok(libelle);
}

async function mensuel() {
  await bilanWorkflows(30);
  info('À vérifier par le propriétaire (non automatisable sans accès) : date de la dernière sauvegarde Supabase et test de restauration sur projet isolé ; membres et droits du dépôt GitHub, de l’équipe Vercel et du projet Supabase ; factures Supabase / Vercel / Stripe / fournisseur IA.');
}

await (MODE === 'mensuel' ? mensuel() : hebdo());
const titre = MODE === 'mensuel' ? 'Bilan mensuel' : 'Maintenance hebdomadaire';
const rapport = `## ${titre} ClairDossier — ${new Date().toISOString().slice(0, 10)}\n\n${lignes.join('\n')}\n\n${echecs ? `**${echecs} problème(s) à traiter.**` : 'Aucune action requise.'}\n`;
console.log(rapport);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, rapport);
process.exit(echecs ? 1 : 0);
