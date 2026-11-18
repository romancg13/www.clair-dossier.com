#!/usr/bin/env node
/**
 * Mise en service Supabase PRODUCTION — ClairDossier (projet buzgokfmxpmyceppvjpp).
 *
 * Réduit toute la procédure TODO_ADMIN (migrations, modèle OTP, redirections,
 * fonctions, secrets, vérifications) à UNE intervention humaine :
 *
 *   1. Créer un jeton d'accès personnel : https://supabase.com/dashboard/account/tokens
 *   2. L'exporter SANS le coller ailleurs :   export SUPABASE_ACCESS_TOKEN=sbp_…
 *   3. Simulation (rien n'est modifié) :      node scripts/mise-en-service-supabase.mjs
 *   4. Application :                          node scripts/mise-en-service-supabase.mjs --apply
 *   5. Fonctions Edge (via CLI officielle) :  … --apply --deploy-functions
 *   6. Secrets manquants (saisie masquée) :   … --apply --secrets
 *
 *   Moteur IA SEUL (aucune autre migration, aucune autre fonction, aucun
 *   réglage d'authentification — jamais d'objet de paiement) :
 *     node scripts/mise-en-service-supabase.mjs --ia-seulement            (simulation)
 *     … --ia-seulement --apply --deploy-functions --secrets
 *
 * Garanties :
 *   - AUCUNE valeur secrète affichée ni journalisée (jeton lu de l'environnement,
 *     secrets saisis sans écho, seules les *présences* sont rapportées) ;
 *   - simulation par défaut : sans --apply, uniquement des lectures ;
 *   - migrations : seules les MANQUANTES sont appliquées, dans l'ordre, chacune
 *     re-vérifiée par sonde après application (jamais de rejeu d'une migration
 *     déjà en place, jamais de reset/seed) ;
 *   - garde anti-mauvais-projet : le socle 2026-06 (dossiers, is_admin) doit être
 *     présent, sinon arrêt immédiat ;
 *   - un modèle d'e-mail personnalisé existant n'est JAMAIS écrasé : s'il ne
 *     contient pas {{ .Token }}, le texte à ajouter est affiché, rien de plus.
 *
 * Endpoints : Management API officielle (spec https://api.supabase.com/api/v1-json) —
 * GET/PATCH /v1/projects/{ref}/config/auth · POST /v1/projects/{ref}/database/query
 * GET /v1/projects/{ref}/functions · GET/POST /v1/projects/{ref}/secrets
 */

import { supabaseToken } from './lib/credentials.mjs';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { approbationsManquantes, charger, empreinte, enregistrer, marquer, valide } from './lib/ia-etat.mjs';
import readline from 'node:readline';

const REF = 'buzgokfmxpmyceppvjpp';
const API = `https://api.supabase.com/v1/projects/${REF}`;
const SITE = 'https://www.clair-dossier.com';
// Clé PUBLIQUE anon (celle du bundle du site) — sert uniquement aux sondes REST.
const ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ1emdva2ZteHBteWNlcHB2anBwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NDk5NjksImV4cCI6MjA5NzEyNTk2OX0.MBRiuEYKl-b4_dNYpWKjWRm8qaFAXfwHjyAvf3Kzn2U';
const SUPABASE_URL = `https://${REF}.supabase.co`;

const APPLY = process.argv.includes('--apply');
const DEPLOY_FUNCTIONS = process.argv.includes('--deploy-functions');
const SECRETS = process.argv.includes('--secrets');
// Périmètre strict du moteur IA : jamais Stripe, abonnements, auth ni autre fonction.
const IA_ONLY = process.argv.includes('--ia-seulement');
const IA_MIGRATIONS = ['20261023120000_moteur_documentaire_ia.sql', '20261102120000_ia_console_privee.sql', '20261104120000_ia_budget_global.sql'];
const IA_SECRETS = ['ANTHROPIC_API_KEY', 'AI_WORKER_TOKEN', 'AI_BUDGET_CENTS_PER_USER_MONTH', 'AI_BUDGET_CENTS_GLOBAL_MONTH', 'AI_MODEL_EXTRACT', 'AI_MODEL_CONSOLIDATE', 'RESEND_API_KEY'];
const APPROUVER = process.argv.includes('--approuver');

const TOKEN = supabaseToken()?.token ?? '';
if (!TOKEN && !IA_ONLY) {
  console.error(
    'SUPABASE_ACCESS_TOKEN absent.\n' +
      '  0. le plus simple : `supabase login` (session réutilisée automatiquement), sinon :\n' +
      '  1. https://supabase.com/dashboard/account/tokens → « Generate new token »\n' +
      '  2. export SUPABASE_ACCESS_TOKEN=sbp_…   (dans CE terminal, jamais dans un fichier du dépôt)\n' +
      '  3. relancer ce script.',
  );
  process.exit(2);
}

const here = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(here, '..', 'supabase', 'migrations');

let exitCode = 0;
const ok = (m) => console.log(`  ✔ ${m}`);
const warn = (m) => console.log(`  ⚠ ${m}`);
const ko = (m) => {
  console.log(`  ✖ ${m}`);
  exitCode = 1;
};

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* réponse non JSON */
  }
  if (!res.ok) {
    // Jamais le jeton ni le corps envoyé dans l'erreur.
    throw new Error(`${method} ${path} → HTTP ${res.status}${json?.message ? ` — ${json.message}` : ''}`);
  }
  return json;
}

/** SQL en lecture seule (sondes, preuves). */
async function sqlRead(query) {
  return api('/database/query', { method: 'POST', body: { query, read_only: true } });
}
/** SQL d'application (migrations) — uniquement sous --apply. */
async function sqlWrite(query) {
  return api('/database/query', { method: 'POST', body: { query } });
}

async function probe(sql) {
  const rows = await sqlRead(sql);
  return Array.isArray(rows) && rows.length > 0 && Object.values(rows[0])[0] !== null && Object.values(rows[0])[0] !== false;
}

/* Sonde de présence par migration (marqueur créé par le fichier, jamais retiré ensuite). */
const MARKERS = {
  '20260615201942_clair_dossier_init.sql': "select to_regclass('public.dossiers')",
  '20260617110728_dossier_lead_notification.sql': "select exists (select 1 from pg_extension where extname = 'pg_net')",
  '20260621144123_admin_global_access.sql': "select to_regprocedure('public.is_admin()')",
  '20260622062648_admin_user_emails.sql': "select to_regprocedure('public.admin_user_emails()')",
  '20260628093000_dossier_deliverables.sql':
    "select exists (select 1 from information_schema.columns where table_schema='public' and table_name='dossier_documents' and column_name='kind')",
  '20260701093000_admin_delete_documents.sql':
    "select exists (select 1 from pg_policies where schemaname='public' and policyname='docs_delete_admin')",
  '20260829120000_prospects.sql': "select to_regclass('public.prospects')",
  '20260915120000_gestion_documentaire.sql': "select to_regclass('public.dossier_deadlines')",
  '20260915150000_super_admin.sql': "select to_regclass('public.audit_logs')",
  '20260916120000_mobile_push_tokens.sql': "select to_regclass('public.push_tokens')",
  '20260917120000_automatisation_quotas.sql': "select to_regclass('public.plan_entitlements')",
  '20260918100000_admin_aal2_suppression_exclusive.sql': "select to_regprocedure('public.admin_aal2()')",
  '20260918120000_audit_corbeille_serveur.sql':
    "select exists (select 1 from pg_trigger where tgname = 'dossiers_audit_corbeille')",
  '20260918130000_prospects_partenariat.sql':
    "select exists (select 1 from information_schema.columns where table_schema='public' and table_name='prospects' and column_name='partner_type')",
  '20260919120000_corbeille_client.sql': "select to_regprocedure('public.client_trash_enabled()')",
  '20260920120000_admin_sans_mfa.sql': "select to_regprocedure('public.admin_delete_enabled()')",
  '20261012120000_revenus_abonnements.sql':
    "select exists (select 1 from information_schema.columns where table_schema='public' and table_name='subscriptions' and column_name='unit_amount')",
  '20261023120000_moteur_documentaire_ia.sql': "select to_regclass('public.ai_jobs')",
  '20261102120000_ia_console_privee.sql': "select to_regprocedure('public.ai_admin_overview()')",
  '20261103120000_campagne_clics.sql': "select to_regclass('public.campaign_clicks')",
  '20261104120000_ia_budget_global.sql': "select to_regprocedure('public.ai_global_month_cost_cents()')",
};
// Socle qui DOIT déjà exister (sinon : mauvais projet → arrêt).
const SOCLE = [
  '20260615201942_clair_dossier_init.sql',
  '20260617110728_dossier_lead_notification.sql',
  '20260621144123_admin_global_access.sql',
];

const OTP_TEMPLATE = `<h2>Confirmez votre inscription ClairDossier</h2>
<p>Votre code de vérification :</p>
<p style="font-size:24px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>Saisissez ce code sur la page d'inscription, ou utilisez ce lien :</p>
<p><a href="{{ .ConfirmationURL }}">Confirmer mon adresse e-mail</a></p>
<p style="font-size:12px;color:#64748b">Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>`;

const ALLOW_URLS = [`${SITE}/**`, 'https://clair-dossier.com/**'];

async function stepAuthConfig() {
  console.log('\n── 1. Configuration Auth (modèle OTP, redirections) ──');
  let cfg = await api('/config/auth');
  // TOTP : plus exigé par la console (migration 20260920120000) — jamais modifié ici.

  const patch = {};

  const template = cfg.mailer_templates_confirmation_content ?? '';
  if (template.includes('{{ .Token }}')) {
    ok('Modèle « Confirm signup » : contient déjà {{ .Token }}.');
  } else if (!template.trim()) {
    patch.mailer_templates_confirmation_content = OTP_TEMPLATE;
    if (!(cfg.mailer_subjects_confirmation ?? '').trim()) {
      patch.mailer_subjects_confirmation = 'Votre code de confirmation ClairDossier';
    }
    console.log('  Modèle « Confirm signup » : par défaut → sera remplacé (code {{ .Token }} + lien).');
  } else {
    warn(
      'Modèle « Confirm signup » PERSONNALISÉ sans {{ .Token }} — non modifié. ' +
        'Ajoutez-y : <p style="font-size:24px;font-weight:bold">{{ .Token }}</p>',
    );
  }

  const allow = (cfg.uri_allow_list ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const missing = ALLOW_URLS.filter((u) => !allow.includes(u));
  if (missing.length) {
    patch.uri_allow_list = [...allow, ...missing].join(',');
    console.log(`  Redirect URLs : à ajouter → ${missing.join(' · ')}`);
  } else {
    ok('Redirect URLs : déjà en place.');
  }

  if (!Object.keys(patch).length) {
    ok('Configuration Auth : rien à modifier.');
    return;
  }
  if (!APPLY) {
    warn(`SIMULATION — champs qui seraient modifiés : ${Object.keys(patch).join(', ')} (relancer avec --apply).`);
    return;
  }
  await api('/config/auth', { method: 'PATCH', body: patch });
  cfg = await api('/config/auth'); // relecture = preuve
  if ((cfg.mailer_templates_confirmation_content ?? '').includes('{{ .Token }}')) ok('Modèle OTP relu : {{ .Token }} présent.');
  if (ALLOW_URLS.every((u) => (cfg.uri_allow_list ?? '').includes(u))) ok('Redirect URLs relues.');
}

async function stepMigrations() {
  console.log('\n── 2. Migrations (uniquement les manquantes, dans l’ordre) ──');
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .filter((f) => !IA_ONLY || IA_MIGRATIONS.includes(f))
    .sort();
  for (const f of SOCLE) {
    if (!(await probe(MARKERS[f]))) {
      ko(`SOCLE ABSENT (${f}) — ce projet ne ressemble PAS à la production ClairDossier. ARRÊT.`);
      process.exit(1);
    }
  }
  ok('Socle 2026-06 présent (bon projet).');

  const missing = [];
  for (const f of files) {
    const marker = MARKERS[f];
    if (!marker) {
      warn(`${f} : aucune sonde connue — à examiner manuellement.`);
      continue;
    }
    const present = await probe(marker);
    console.log(`  ${present ? '✔ appliquée ' : '· manquante '} ${f}`);
    if (!present) missing.push(f);
  }
  if (!missing.length) {
    ok('Toutes les migrations sont appliquées.');
    return;
  }
  if (!APPLY) {
    warn(`SIMULATION — ${missing.length} migration(s) seraient appliquées : ${missing.join(', ')}`);
    return;
  }
  for (const f of missing) {
    const sql = readFileSync(join(MIGRATIONS_DIR, f), 'utf8');
    process.stdout.write(`  → application de ${f}… `);
    await sqlWrite(sql);
    if (await probe(MARKERS[f])) console.log('OK (sonde re-vérifiée)');
    else {
      console.log('ÉCHEC');
      ko(`${f} : la sonde ne confirme pas l'application. ARRÊT (rien d'autre n'est tenté).`);
      process.exit(1);
    }
  }
}

async function stepOverrideJgomes() {
  console.log('\n── 3. Exception j.gomes@avocats-gojuris.fr (preuve production) ──');
  if (!(await probe("select to_regclass('public.entitlement_overrides')"))) {
    warn('Tables quotas absentes (migrations non appliquées) — preuve impossible à ce stade.');
    return;
  }
  const rows = await sqlRead(`
    select o.mode, o.active, o.expires_at, u.id as user_id
    from public.entitlement_overrides o
    join auth.users u on u.id = o.user_id
    where lower(u.email) = 'j.gomes@avocats-gojuris.fr' and o.active`);
  if (!rows?.length) {
    ko('Compte j.gomes introuvable ou sans override actif — rejouer le bloc 8 de 20260917120000 après création du compte.');
    return;
  }
  const o = rows[0];
  if (o.mode === 'unlimited' && o.active && o.expires_at === null) ok('Override : unlimited · actif · sans expiration.');
  else ko(`Override inattendu : ${JSON.stringify({ mode: o.mode, active: o.active, expires_at: o.expires_at })}`);
  const eff = await sqlRead(
    `select applies, unlimited, dossier_limit from public.dossier_entitlement('${o.user_id}'::uuid)`,
  );
  if (eff?.[0]?.unlimited === true) ok('Droit effectif : dossiers ILLIMITÉS (dossier_entitlement).');
  else ko(`Droit effectif inattendu : ${JSON.stringify(eff?.[0])}`);
}

const EDGE_FUNCTIONS = IA_ONLY
  ? ['ai-worker']
  : ['notify-lead', 'stripe-webhook', 'admin-users', 'delete-account', 'submit-prospect', 'ai-worker'];

async function stepFunctions() {
  console.log('\n── 4. Fonctions Edge ──');
  const deployed = await api('/functions');
  const bySlug = new Map((deployed ?? []).map((f) => [f.slug, f]));
  for (const slug of EDGE_FUNCTIONS) {
    const f = bySlug.get(slug);
    if (f) console.log(`  ✔ déployée ${slug} (version ${f.version}, verify_jwt=${f.verify_jwt})`);
    else console.log(`  · absente  ${slug}`);
  }
  const toDeploy = EDGE_FUNCTIONS.filter((s) => !bySlug.get(s));
  // notify-lead : redéployer aussi si déjà présente (version enrichie e-mail+SMS dans le dépôt).
  if (!IA_ONLY && bySlug.get('notify-lead')) warn('notify-lead : déjà déployée — le dépôt contient une version plus riche, redéploiement inclus.');
  if (!DEPLOY_FUNCTIONS) {
    warn(`Déploiement non demandé (--deploy-functions). À déployer/mettre à jour : ${[...new Set([...(IA_ONLY ? [] : ['notify-lead']), ...toDeploy])].join(', ')}`);
    return;
  }
  for (const slug of new Set([...(IA_ONLY ? [] : ['notify-lead']), ...toDeploy])) {
    // --use-api : empaquetage côté Supabase, sans Docker local.
    const cli = process.env.SUPABASE_BIN ? [process.env.SUPABASE_BIN, []] : ['npx', ['-y', 'supabase@3.0.0']];
    // CLI v3 (version épinglée et vérifiée) : la cible se passe par --remote=<ref>.
    const args = [...cli[1], 'functions', 'deploy', slug, `--remote=${REF}`, '--use-api'];
    if (slug === 'stripe-webhook') args.push('--no-verify-jwt'); // signature Stripe vérifiée DANS la fonction
    console.log(`  → supabase functions deploy ${slug} --use-api${slug === 'stripe-webhook' ? ' --no-verify-jwt' : ''}`);
    const r = spawnSync(cli[0], args, {
      cwd: join(here, '..'),
      stdio: 'inherit',
      env: { ...process.env, SUPABASE_ACCESS_TOKEN: TOKEN },
    });
    if (r.status !== 0) ko(`Déploiement de ${slug} en échec (code ${r.status}).`);
    else ok(`${slug} déployée.`);
  }
}

const EXPECTED_SECRETS = [
  ['RESEND_API_KEY', 'e-mail admin (déjà utilisé par notify-lead historiquement)'],
  ['STRIPE_SECRET_KEY', 'clé restreinte lecture Subscriptions/Customers/Prices/Products'],
  ['STRIPE_WEBHOOK_SECRET', 'whsec_… de l’endpoint créé au dashboard Stripe'],
  ['ANTHROPIC_API_KEY', 'moteur documentaire IA (ai-worker) — sans elle le worker répond 503 et ne réclame rien'],
  ['AI_WORKER_TOKEN', 'jeton d’appel du worker — GÉNÉRÉ automatiquement (jamais affiché) et copié dans Vault'],
  ['AI_BUDGET_CENTS_PER_USER_MONTH', 'plafond mensuel par compte, en centimes (décision du propriétaire, aucun défaut)'],
  ['AI_BUDGET_CENTS_GLOBAL_MONTH', 'plafond mensuel tous comptes, en centimes (décision du propriétaire, aucun défaut)'],
  ['AI_MODEL_EXTRACT', 'modèle d’extraction retenu (ex. claude-sonnet-5-5) — à défaut claude-opus-5-5'],
  ['AI_MODEL_CONSOLIDATE', 'modèle de consolidation retenu — à défaut claude-opus-5-5'],
  ['ADMIN_NOTIFICATION_EMAIL', 'facultatif — défaut : prestige.seller@icloud.com'],
  ['ADMIN_NOTIFICATION_PHONE', 'facultatif — SMS admin (+33…)'],
  ['TWILIO_ACCOUNT_SID', 'facultatif — SMS'],
  ['TWILIO_AUTH_TOKEN', 'facultatif — SMS'],
  ['TWILIO_FROM_NUMBER', 'facultatif — SMS'],
];

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const onData = (char) => {
      if (!['\n', '\r', ''].includes(String(char))) {
        readline.moveCursor(process.stdout, -String(char).length, 0);
        process.stdout.write('*'.repeat(String(char).length));
      }
    };
    process.stdin.on('data', onData);
    rl.question(question, (answer) => {
      process.stdin.off('data', onData);
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function stepSecrets() {
  console.log('\n── 5. Secrets serveur (présence seulement, jamais les valeurs) ──');
  const existing = new Set(((await api('/secrets')) ?? []).map((s) => s.name));
  const missing = [];
  for (const [name, why] of EXPECTED_SECRETS.filter(([n]) => !IA_ONLY || IA_SECRETS.includes(n))) {
    if (existing.has(name)) ok(`${name} : présent.`);
    else {
      console.log(`  · absent   ${name} — ${why}`);
      missing.push(name);
    }
  }
  if (!missing.length || !SECRETS) {
    if (missing.length) warn(`Pour les saisir (masqué) : relancer avec --apply --secrets.`);
    return;
  }
  if (!APPLY) {
    warn('--secrets exige --apply.');
    return;
  }
  const toSet = [];
  if (IA_ONLY && missing.includes('AI_WORKER_TOKEN')) {
    // Généré DANS Postgres (jamais dans le texte d'une requête ni à l'écran),
    // puis relu pour le poser à l'identique en secret de la fonction.
    await sqlWrite(`do $$ begin
      if not exists (select 1 from vault.secrets where name = 'clairdossier_ai_worker_token') then
        perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'clairdossier_ai_worker_token', 'Appel pg_cron -> ai-worker (ClairDossier)');
      end if; end $$`);
    const lu = await sqlRead(`select decrypted_secret as v from vault.decrypted_secrets where name = 'clairdossier_ai_worker_token' limit 1`);
    if (!lu?.[0]?.v) throw new Error('Vault : jeton du worker introuvable après création.');
    toSet.push({ name: 'AI_WORKER_TOKEN', value: lu[0].v });
    ok('AI_WORKER_TOKEN créé dans Vault et posé en secret de fonction (valeur jamais affichée).');
  }
  for (const name of missing.filter((n) => !(IA_ONLY && n === 'AI_WORKER_TOKEN'))) {
    const v = await promptHidden(`  ${name} (entrée = ignorer) : `);
    if (v) toSet.push({ name, value: v });
  }
  if (toSet.length) {
    await api('/secrets', { method: 'POST', body: toSet });
    ok(`${toSet.length} secret(s) posé(s) : ${toSet.map((s) => s.name).join(', ')}.`);
  }
}

async function stepPostChecks() {
  console.log('\n── 6. Vérifications finales (sondes anonymes, comme un visiteur) ──');
  for (const t of ['plan_entitlements', 'subscriptions', 'admin_notifications', 'entitlement_overrides']) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${t}?select=*&limit=0`, {
      headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
    });
    // 401/200 = la table existe (RLS décide) ; 404 = migration absente.
    if (res.status === 404) ko(`REST ${t} → 404 (migration non appliquée).`);
    else ok(`REST ${t} → ${res.status} (table présente, RLS active).`);
  }
  for (const f of EDGE_FUNCTIONS) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${f}`, { method: 'OPTIONS' });
    console.log(`  fonctions/${f} → HTTP ${res.status}${res.status === 404 ? ' (non déployée)' : ''}`);
  }
  console.log(`
Reste à faire À LA MAIN (non pilotable par l'API) :
  1. Dashboard STRIPE → Webhooks → endpoint ${SUPABASE_URL}/functions/v1/stripe-webhook
     (événements : checkout.session.completed, customer.subscription.*, invoice.paid,
      invoice.payment_failed) → copier whsec_… → relancer ce script avec --apply --secrets ;
  2. Abonnés existants : node --import tsx scripts/sync-stripe-subscriptions.ts (simulation) puis --apply ;
  3. GitHub → Settings → Variables → VITE_STRIPE_PORTAL_URL (portail client Stripe) ;
  4. Stripe → Paramètres → E-mails clients : activer reçus/factures ;
  5. Test réel : valider un dossier de test → notification visible dans /admin → e-mail reçu.`);
}

console.log(`Mise en service Supabase — projet ${REF} ${APPLY ? '— MODE APPLICATION' : '— SIMULATION (aucune modification)'}${IA_ONLY ? ' — PÉRIMÈTRE MOTEUR IA SEUL' : ''}`);
/* ── Moteur IA : mise en service reprenable (npm run ia:commission) ─────────── */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function probeSafe(sql) {
  try {
    return await probe(sql);
  } catch {
    return false;
  }
}

async function runIa() {
  const root = join(here, '..');
  const emp = empreinte(root);
  let etat = charger(root);
  const besoins = [];
  console.log(`\nPlan : contrôles → migrations IA (${IA_MIGRATIONS.length}) → fonction ai-worker → secrets IA → planificateur → recette → approbations.`);
  console.log('Hors périmètre, jamais touchés : Stripe, abonnements, tarifs, authentification, autres fonctions et migrations.\n');

  console.log('── 0. Contrôles préalables ──');
  const gel = spawnSync(process.execPath, ['--import', 'tsx', '--test', 'tests/paiements-geles.test.ts'], { cwd: root, encoding: 'utf8' });
  if (gel.status !== 0) {
    ko('Gel des paiements rompu (fichier ou lien de paiement modifié) — ARRÊT, rien n’est installé.');
    enregistrer(root, { ...etat, statut: 'INCIDENT', empreinte: emp });
    return;
  }
  ok('Paiements : fichiers et liens Stripe identiques à la référence gelée.');
  const head = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).stdout.trim();
  console.log(`  · code ${head}, empreinte IA ${emp}`);
  if (etat.empreinte && etat.empreinte !== emp) warn('Code IA modifié depuis le dernier passage : infrastructure et recette seront revérifiées.');
  etat = { ...etat, empreinte: emp, commit: head };

  console.log('\n── 1. Accès au projet de production ──');
  let acces = false;
  if (!TOKEN) besoins.push('acces');
  else {
    const res = await fetch(API, { headers: { Authorization: `Bearer ${TOKEN}` } });
    acces = res.ok;
    if (acces) ok(`Projet ${REF} accessible avec la session courante.`);
    else {
      ko(`Projet ${REF} inaccessible (HTTP ${res.status}) : la session Supabase de cette machine n’est pas celle du propriétaire.`);
      besoins.push('acces');
    }
  }

  if (acces) {
    console.log('\n── 2. Migrations IA ──');
    await stepMigrations();
    const migOk = (await Promise.all(IA_MIGRATIONS.map((f) => probeSafe(MARKERS[f])))).every(Boolean);
    etat = marquer(etat, 'migrations', migOk, emp, migOk ? 'sondes des 3 migrations IA présentes' : 'migration(s) IA manquante(s)');
    if (!migOk) besoins.push('migrations');

    await stepFunctions();
    const fn = ((await api('/functions')) ?? []).find((f) => f.slug === 'ai-worker');
    etat = marquer(etat, 'worker', Boolean(fn), emp, fn ? `ai-worker version ${fn.version}` : 'ai-worker absent');
    if (!fn) besoins.push('worker');

    await stepSecrets();
    const presents = new Set(((await api('/secrets')) ?? []).map((x) => x.name));
    const manquants = ['ANTHROPIC_API_KEY', 'AI_WORKER_TOKEN', 'AI_BUDGET_CENTS_PER_USER_MONTH', 'AI_BUDGET_CENTS_GLOBAL_MONTH'].filter((n) => !presents.has(n));
    etat = marquer(etat, 'secrets', !manquants.length, emp, manquants.length ? `manquants : ${manquants.join(', ')}` : 'secrets IA présents');
    if (manquants.length) besoins.push(`secrets:${manquants.join(',')}`);
    if (presents.has('AI_ENGINE_PAUSED')) etat = { ...etat, pause: true };
    else etat = { ...etat, pause: false };

    console.log('\n── 3. Planificateur (pg_cron → ai-worker) ──');
    let cron = await probeSafe("select exists (select 1 from cron.job where jobname = 'clairdossier-ai-worker')");
    if (!cron && APPLY && migOk) {
      await sqlWrite('create extension if not exists pg_cron');
      const sql = readFileSync(join(MIGRATIONS_DIR, '20261102120000_ia_console_privee.sql'), 'utf8');
      await sqlWrite(sql.slice(sql.indexOf('-- ── 7. Horloge')));
      cron = await probeSafe("select exists (select 1 from cron.job where jobname = 'clairdossier-ai-worker')");
    }
    const vault = await probeSafe("select exists (select 1 from vault.secrets where name = 'clairdossier_ai_worker_token')");
    const sched = cron && vault;
    if (sched) ok('Tâche clairdossier-ai-worker planifiée (chaque minute) avec jeton Vault.');
    else warn(`Planificateur incomplet (cron ${cron ? 'ok' : 'absent'}, jeton Vault ${vault ? 'ok' : 'absent'}) — relancer avec --apply.`);
    etat = marquer(etat, 'planificateur', sched, emp, `cron=${cron} vault=${vault}`);
    if (!sched) besoins.push('planificateur');

    console.log('\n── 4. Recette réelle (dossier pilote fictif) ──');
    const pilote = process.env.IA_DOSSIER_PILOTE ?? etat.pilote ?? '';
    if (!UUID.test(pilote)) {
      warn('Aucun dossier pilote : IA_DOSSIER_PILOTE=<uuid> npm run ia:commission (dossier de TEST, pièces fictives).');
      if (!valide(etat, 'recette', emp)) besoins.push('recette');
    } else {
      etat = { ...etat, pilote };
      const pub = await probeSafe(`select exists (select 1 from public.ai_analyses where dossier_id = '${pilote}' and review_status = 'published' and (coverage->>'complete')::boolean)`);
      const docs = await sqlRead(`select count(*)::int as n from public.dossier_documents where dossier_id = '${pilote}' and generated_by = 'ai' and deleted_at is null`).catch(() => [{ n: 0 }]);
      const n = docs?.[0]?.n ?? 0;
      const recette = pub && n >= 13;
      etat = marquer(etat, 'recette', recette, emp, `analyse publiée=${pub}, livrables IA=${n}/13`);
      if (recette) ok(`Recette réussie sur ${pilote} : analyse complète publiée, ${n} fichiers livrés.`);
      else {
        warn(`Recette incomplète (analyse publiée=${pub}, ${n}/13 fichiers) — déposer les pièces de test et attendre le traitement.`);
        besoins.push('recette');
      }
    }
  }

  if (APPROUVER) {
    console.log('\n── 5. Approbations du propriétaire ──');
    const qui = spawnSync('git', ['config', 'user.name'], { cwd: root, encoding: 'utf8' }).stdout.trim() || 'inconnu';
    for (const [id, libelle] of approbationsManquantes(etat)) {
      const rep = await promptHidden(`  ${libelle}\n  Tapez « J'APPROUVE ${id} » pour l'enregistrer (entrée = passer) : `);
      if (rep === `J'APPROUVE ${id}`) {
        etat = { ...etat, approbations: [...(etat.approbations ?? []), { id, par: qui, le: new Date().toISOString(), commit: head }] };
        ok(`${id} approuvé par ${qui}.`);
      }
    }
  }

  const infra = ['migrations', 'worker', 'secrets', 'planificateur'].every((id) => valide(etat, id, emp));
  const recette = valide(etat, 'recette', emp);
  const manquantes = approbationsManquantes(etat);
  const panneau = readFileSync(join(root, '.github', 'workflows', 'deploy.yml'), 'utf8').includes("VITE_AI_ENGINE: '1'");
  const statut = etat.pause ? 'SUSPENDU'
    : !infra ? 'CONFIGURATION_REQUISE'
    : !recette ? 'INFRA_PRETE'
    : manquantes.length || !panneau ? 'VALIDATION_REQUISE'
    : 'ACTIF';
  etat = { ...etat, statut, besoins };
  enregistrer(root, etat);

  console.log(`\n══ STATUT : ${statut} ══`);
  if (statut !== 'ACTIF') {
    console.log('Actions restantes (détail : docs/ia/CHECKLIST_PROPRIETAIRE.md) :');
    const libelles = {
      acces: 'Se connecter avec le compte PROPRIÉTAIRE du projet Supabase : npx -y supabase login',
      migrations: 'Appliquer les migrations IA : npm run ia:commission -- --apply',
      worker: 'Déployer ai-worker : npm run ia:commission -- --apply --deploy-functions',
      planificateur: 'Planifier le worker : npm run ia:commission -- --apply',
      recette: 'Recette réelle sur un dossier de test : IA_DOSSIER_PILOTE=<uuid> npm run ia:commission',
    };
    for (const b of besoins) {
      if (b.startsWith('secrets:')) console.log(`  • Poser les secrets (saisie masquée) : npm run ia:commission -- --apply --secrets  [${b.slice(8)}]`);
      else console.log(`  • ${libelles[b] ?? b}`);
    }
    for (const [id, l] of manquantes) console.log(`  • Approbation « ${id} » : ${l} → npm run ia:commission -- --approuver`);
    if (!manquantes.length && !panneau) console.log("  • Publier les textes approuvés puis activer le panneau : VITE_AI_ENGINE: '1' dans .github/workflows/deploy.yml (PR).");
    if (etat.pause) console.log('  • Moteur en arrêt d’urgence (secret AI_ENGINE_PAUSED présent) : le retirer pour reprendre.');
  }
  console.log(`État enregistré : .ia-commission/etat.json — relancer la même commande pour reprendre.`);
  if (statut !== 'ACTIF' && exitCode === 0) exitCode = 3;
}

if (IA_ONLY) {
  await runIa().catch((e) => ko(e instanceof Error ? e.message : String(e)));
  process.exit(exitCode);
}
try {
  if (!IA_ONLY) await stepAuthConfig();
  await stepMigrations();
  if (!IA_ONLY) await stepOverrideJgomes();
  await stepFunctions();
  await stepSecrets();
  if (!IA_ONLY) await stepPostChecks();
} catch (e) {
  ko(e instanceof Error ? e.message : String(e));
}
process.exit(exitCode);
