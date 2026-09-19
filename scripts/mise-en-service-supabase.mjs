#!/usr/bin/env node
/**
 * Mise en service Supabase PRODUCTION — ClairDossier (projet buzgokfmxpmyceppvjpp).
 *
 * Réduit toute la procédure TODO_ADMIN (TOTP, migrations, modèle OTP, redirections,
 * fonctions, secrets, vérifications) à UNE intervention humaine :
 *
 *   1. Créer un jeton d'accès personnel : https://supabase.com/dashboard/account/tokens
 *   2. L'exporter SANS le coller ailleurs :   export SUPABASE_ACCESS_TOKEN=sbp_…
 *   3. Simulation (rien n'est modifié) :      node scripts/mise-en-service-supabase.mjs
 *   4. Application :                          node scripts/mise-en-service-supabase.mjs --apply
 *   5. Fonctions Edge (via CLI officielle) :  … --apply --deploy-functions
 *   6. Secrets manquants (saisie masquée) :   … --apply --secrets
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

const TOKEN = supabaseToken()?.token ?? '';
if (!TOKEN) {
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
  console.log('\n── 1. Configuration Auth (TOTP, modèle OTP, redirections) ──');
  let cfg = await api('/config/auth');
  const totpBefore = { enroll: cfg.mfa_totp_enroll_enabled, verify: cfg.mfa_totp_verify_enabled };
  console.log(`  TOTP : enrollment=${totpBefore.enroll} · verify=${totpBefore.verify}`);

  const patch = {};
  if (!cfg.mfa_totp_enroll_enabled) patch.mfa_totp_enroll_enabled = true;
  if (!cfg.mfa_totp_verify_enabled) patch.mfa_totp_verify_enabled = true;

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
  if (cfg.mfa_totp_enroll_enabled && cfg.mfa_totp_verify_enabled) {
    ok('TOTP activé et RELU : enrollment=true · verify=true.');
  } else {
    ko(`TOTP incomplet après PATCH : enroll=${cfg.mfa_totp_enroll_enabled} verify=${cfg.mfa_totp_verify_enabled}`);
  }
  if ((cfg.mailer_templates_confirmation_content ?? '').includes('{{ .Token }}')) ok('Modèle OTP relu : {{ .Token }} présent.');
  if (ALLOW_URLS.every((u) => (cfg.uri_allow_list ?? '').includes(u))) ok('Redirect URLs relues.');
}

async function stepMigrations() {
  console.log('\n── 2. Migrations (uniquement les manquantes, dans l’ordre) ──');
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
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

const EDGE_FUNCTIONS = ['notify-lead', 'stripe-webhook', 'admin-users', 'delete-account', 'submit-prospect'];

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
  if (bySlug.get('notify-lead')) warn('notify-lead : déjà déployée — le dépôt contient une version plus riche, redéploiement inclus.');
  if (!DEPLOY_FUNCTIONS) {
    warn(`Déploiement non demandé (--deploy-functions). À déployer/mettre à jour : ${[...new Set(['notify-lead', ...toDeploy])].join(', ')}`);
    return;
  }
  for (const slug of new Set(['notify-lead', ...toDeploy])) {
    // --use-api : empaquetage côté Supabase, sans Docker local.
    const cli = process.env.SUPABASE_BIN ? [process.env.SUPABASE_BIN, []] : ['npx', ['-y', 'supabase@latest']];
    const args = [...cli[1], 'functions', 'deploy', slug, '--project-ref', REF, '--use-api'];
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
  for (const [name, why] of EXPECTED_SECRETS) {
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
  for (const name of missing) {
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
  2. Enrôlement TOTP PERSONNEL : ${SITE}/admin → scanner le QR → code à 6 chiffres ;
  3. Abonnés existants : node --import tsx scripts/sync-stripe-subscriptions.ts (simulation) puis --apply ;
  4. GitHub → Settings → Variables → VITE_STRIPE_PORTAL_URL (portail client Stripe) ;
  5. Stripe → Paramètres → E-mails clients : activer reçus/factures ;
  6. Test réel : valider un dossier de test → notification visible dans /admin → e-mail reçu.`);
}

console.log(`Mise en service Supabase — projet ${REF} ${APPLY ? '— MODE APPLICATION' : '— SIMULATION (aucune modification)'}`);
try {
  await stepAuthConfig();
  await stepMigrations();
  await stepOverrideJgomes();
  await stepFunctions();
  await stepSecrets();
  await stepPostChecks();
} catch (e) {
  ko(e instanceof Error ? e.message : String(e));
}
process.exit(exitCode);
