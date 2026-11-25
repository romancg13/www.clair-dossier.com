// Accès à la pile Supabase LOCALE de recette (docker) : clés, SQL d'observation,
// garde réseau, service des fonctions Edge. Aucun accès distant : le script
// refuse toute URL qui n'est pas locale.
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const HOTE_PRODUCTION = 'buzgokfmxpmyceppvjpp.supabase.co';
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Répertoire d'exécution HORS dépôt (fichiers d'environnement, journaux). */
export function repertoireExecution() {
  const dir = process.env.RECETTE_RUN_DIR || path.join(os.tmpdir(), 'clairdossier-recette-locale');
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  return dir;
}

/** Clés de la pile locale (`supabase status -o env` dans le workdir). */
export function lireEnvironnement(workdir) {
  const res = spawnSync('npx', ['-y', 'supabase@latest', 'status', '-o', 'env'], { cwd: workdir, encoding: 'utf8', timeout: 180_000 });
  if (res.status !== 0) throw new Error(`supabase status a échoué dans ${workdir} : ${String(res.stderr).slice(0, 300)}`);
  const env = {};
  for (const ligne of res.stdout.split('\n')) {
    const m = ligne.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  for (const cle of ['API_URL', 'ANON_KEY', 'SERVICE_ROLE_KEY']) {
    if (!env[cle]) throw new Error(`clé ${cle} absente de « supabase status »`);
  }
  const hote = new URL(env.API_URL).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(hote)) {
    throw new Error(`REFUS : ${env.API_URL} n'est pas une pile locale (recette locale uniquement)`);
  }
  return env;
}

/** Identifiant de projet local (config.toml) → noms des conteneurs docker. */
export function projetLocal(workdir) {
  const toml = readFileSync(path.join(workdir, 'supabase', 'config.toml'), 'utf8');
  const m = toml.match(/^project_id\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error('project_id introuvable dans supabase/config.toml');
  return m[1];
}

/** SQL d'observation / préparation sur la base LOCALE (psql dans le conteneur). */
export function creerSql(projet) {
  const conteneur = process.env.RECETTE_DB_CONTAINER || `supabase_db_${projet}`;
  const sql = (requete) =>
    execFileSync('docker', ['exec', '-i', conteneur, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', requete], { encoding: 'utf8', timeout: 60_000, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  sql.conteneur = conteneur;
  return sql;
}

/**
 * GARDE RÉSEAU. Plusieurs déclencheurs du schéma appellent, via pg_net, des
 * fonctions de PRODUCTION (notify-lead à chaque profil / dossier validé). En
 * recette locale ces appels ne doivent jamais partir : le nom d'hôte de
 * production est résolu vers 127.0.0.1 DANS le conteneur de base locale
 * (/etc/hosts, réversible, sans toucher au schéma), puis l'effet est vérifié
 * par un appel témoin qui doit échouer en « connexion refusée ».
 */
export async function poserGardeReseau(sql) {
  execFileSync('docker', ['exec', '-u', 'root', sql.conteneur, 'sh', '-c', `grep -q '${HOTE_PRODUCTION}' /etc/hosts || echo '127.0.0.1 ${HOTE_PRODUCTION} # garde recette locale' >> /etc/hosts`], { timeout: 30_000 });
  const id = sql(`select net.http_get('https://${HOTE_PRODUCTION}/recette-garde')`);
  for (let i = 0; i < 20; i++) {
    await pause(500);
    const ligne = sql(`select coalesce(status_code::text,'') || '|' || coalesce(error_msg,'') from net._http_response where id = ${Number(id)}`);
    if (!ligne) continue;
    const [code, erreur] = ligne.split('|');
    if (code) throw new Error(`garde réseau inefficace : l'hôte de production a répondu HTTP ${code}`);
    return `appel témoin vers ${HOTE_PRODUCTION} bloqué (${erreur || 'sans réponse'})`;
  }
  throw new Error('garde réseau : appel témoin sans résultat (pg_net inactif ?)');
}

/** La garde est-elle toujours en place dans le conteneur de base locale ? */
export function gardeEnPlace(sql) {
  const res = spawnSync('docker', ['exec', sql.conteneur, 'grep', '-c', HOTE_PRODUCTION, '/etc/hosts'], { encoding: 'utf8' });
  return res.status === 0 && Number(String(res.stdout).trim()) > 0;
}

/* ── Service des fonctions Edge ─────────────────────────────────────────── */

/** Copie le certificat racine du proxy sortant dans le dossier monté (hors dépôt). */
function certificatPourConteneur(workdir) {
  const source = [process.env.RECETTE_CA_BUNDLE, process.env.SSL_CERT_FILE, process.env.NODE_EXTRA_CA_CERTS].find((p) => p && existsSync(p));
  if (!source) return null;
  const dir = path.join(workdir, 'supabase', 'functions', '_ca');
  mkdirSync(dir, { recursive: true });
  const cible = path.join(dir, 'ca-bundle.crt');
  copyFileSync(source, cible);
  return cible;
}

export function ecrireFichierEnv(nom, variables, workdir) {
  const ca = certificatPourConteneur(workdir);
  const lignes = Object.entries({
    ...variables,
    ...(ca ? { DENO_TLS_CA_STORE: 'system', SSL_CERT_FILE: ca, DENO_CERT: ca } : {}),
  }).map(([k, v]) => `${k}=${v}`);
  const fichier = path.join(repertoireExecution(), nom);
  writeFileSync(fichier, lignes.join('\n') + '\n', { mode: 0o600 });
  return fichier;
}

function conteneurEdgePresent(projet) {
  const res = spawnSync('docker', ['ps', '--format', '{{.Names}}'], { encoding: 'utf8' });
  return String(res.stdout).split('\n').includes(`supabase_edge_runtime_${projet}`);
}

export function creerServiceFonctions({ workdir, projet, apiUrl }) {
  let enfant = null;
  const fichierPid = path.join(repertoireExecution(), 'serve.pid');

  async function arreter() {
    const pids = [];
    if (enfant?.pid) pids.push(enfant.pid);
    if (existsSync(fichierPid)) {
      const ancien = Number(readFileSync(fichierPid, 'utf8'));
      if (ancien > 1 && !pids.includes(ancien)) pids.push(ancien);
    }
    for (const pid of pids) {
      try {
        process.kill(-pid, 'SIGINT'); // groupe de processus (npx → supabase)
      } catch {
        /* déjà terminé */
      }
    }
    for (let i = 0; i < 40 && pids.length && conteneurEdgePresent(projet); i++) await pause(500);
    enfant = null;
    writeFileSync(fichierPid, '0');
  }

  /** (Re)lance `supabase functions serve` avec ce fichier d'environnement et attend le démarrage réel du worker. */
  async function servir(fichierEnv, { detacher = false } = {}) {
    await arreter();
    const journal = openSync(path.join(repertoireExecution(), 'serve.log'), 'a');
    enfant = spawn('npx', ['-y', 'supabase@latest', 'functions', 'serve', '--no-verify-jwt', '--env-file', fichierEnv], { cwd: workdir, detached: true, stdio: ['ignore', journal, journal] });
    writeFileSync(fichierPid, String(enfant.pid));
    if (detacher) enfant.unref();
    const debut = Date.now();
    let dernier = '';
    while (Date.now() - debut < 240_000) {
      await pause(1500);
      try {
        // Sans jeton : la fonction elle-même répond 401 (preuve qu'elle a démarré).
        const r = await fetch(`${apiUrl}/functions/v1/ai-worker`, { method: 'POST', signal: AbortSignal.timeout(120_000) });
        dernier = `HTTP ${r.status} ${(await r.text()).slice(0, 160)}`;
        if (r.status === 401 && dernier.includes('appelant')) return Date.now() - debut;
      } catch (e) {
        dernier = e instanceof Error ? e.message : String(e);
      }
    }
    throw new Error(`fonctions Edge non démarrées après 240 s (${dernier})`);
  }

  return { servir, arreter };
}

/** Le code servi (copie du workdir) est-il identique à celui du dépôt ? */
export function ecartsAvecDepot(workdir, depot, fichiers) {
  const ecarts = [];
  for (const f of fichiers) {
    const a = path.join(depot, 'supabase', 'functions', f);
    const b = path.join(workdir, 'supabase', 'functions', f);
    if (!existsSync(b) || readFileSync(a, 'utf8') !== readFileSync(b, 'utf8')) ecarts.push(f);
  }
  return ecarts;
}
