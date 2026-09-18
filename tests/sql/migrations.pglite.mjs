// Tests SQL réels des migrations Supabase — PostgreSQL embarqué (PGlite).
//
// Rejoue TOUTES les migrations de supabase/migrations dans l'ordre, sur une
// base vierge dotée de bouchons minimaux des schémas gérés par Supabase
// (auth, storage, net), puis vérifie le comportement sous les rôles réels
// `authenticated` / `anon` avec RLS active :
//   cloisonnement A/B, quota atomique, idempotence, registre non recrédité,
//   exception illimitée j.gomes, AAL2, notifications, champs immuables.
//
// Hors CI (dépendance non déclarée dans package.json, volontairement) :
//   npm install --no-save @electric-sql/pglite
//   node tests/sql/migrations.pglite.mjs
// ou PGLITE_MODULE=/chemin/vers/@electric-sql/pglite/dist/index.js

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const mod = process.env.PGLITE_MODULE
  ? await import(pathToFileURL(process.env.PGLITE_MODULE).href)
  : await import('@electric-sql/pglite');
const { PGlite } = mod;

const db = new PGlite();

const STUBS = `
  create schema if not exists auth;
  create schema if not exists storage;
  create schema if not exists net;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  grant usage on schema public, auth, storage to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;

  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    email_confirmed_at timestamptz,
    raw_user_meta_data jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
  );
  create function auth.jwt() returns jsonb language sql stable as $$
    select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
  $$;
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(auth.jwt() ->> 'sub', '')::uuid
  $$;
  grant execute on function auth.jwt(), auth.uid() to anon, authenticated, service_role;

  create table storage.buckets (id text primary key, name text, public boolean);
  create table storage.objects (
    id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid
  );
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;

  create table net.calls (id bigserial primary key, url text, body jsonb, at timestamptz default now());
  create function net.http_post(
    url text, body jsonb default '{}'::jsonb, params jsonb default '{}'::jsonb,
    headers jsonb default '{}'::jsonb, timeout_milliseconds integer default 5000
  ) returns bigint language plpgsql security definer as $$
  declare v bigint;
  begin
    insert into net.calls (url, body) values (url, body) returning id into v;
    return v;
  end $$;
`;

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✖ ${name}\n      ${e.message.split('\n')[0]}`);
  } finally {
    await db.exec('reset role; reset request.jwt.claims;');
  }
}

async function asUser(id, aal = 'aal1') {
  const claims = JSON.stringify({ sub: id, role: 'authenticated', aal });
  await db.exec(`set role authenticated; set request.jwt.claims = '${claims}';`);
}
async function asAnon() {
  await db.exec(`set role anon; set request.jwt.claims = '{"role":"anon"}';`);
}
async function asSuperuser() {
  await db.exec('reset role; reset request.jwt.claims;');
}
async function q(sql, params) {
  return (await db.query(sql, params)).rows;
}
async function rejects(promise, pattern) {
  let error = null;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  assert.ok(error, 'une erreur était attendue');
  if (pattern) assert.match(error.message, pattern);
}

async function newUser(email, { confirmed = true, meta = {} } = {}) {
  await asSuperuser();
  const [row] = await q(
    `insert into auth.users (email, email_confirmed_at, raw_user_meta_data)
     values ($1, $2, $3) returning id`,
    [email, confirmed ? new Date().toISOString() : null, JSON.stringify(meta)],
  );
  return row.id;
}

async function insertDossier(userId, { status = 'transmis', key = null, title = 'Dossier test' } = {}) {
  await asUser(userId);
  const rows = await q(
    `insert into public.dossiers (user_id, typology, title, status, client_request_id)
     values ($1, 'autre', $2, $3, $4) returning id`,
    [userId, title, status, key],
  );
  return rows[0].id;
}

async function subscribe(userId, planId, { status = 'active', start, end } = {}) {
  await asSuperuser();
  const s = start ?? new Date(Date.now() - 5 * 86400000).toISOString();
  const e = end ?? new Date(Date.now() + 25 * 86400000).toISOString();
  await q(
    `insert into public.subscriptions (user_id, stripe_subscription_id, plan_id, status, current_period_start, current_period_end)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (stripe_subscription_id) do update
       set plan_id = excluded.plan_id, status = excluded.status,
           current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end`,
    [userId, `sub_${userId.slice(0, 8)}`, planId, status, s, e],
  );
}

// ── Mise en place ───────────────────────────────────────────────────────────
await db.exec(STUBS);

// Comptes existants AVANT les migrations (comme en production).
const ADMIN = await newUser('prestige.seller@icloud.com');
const JGOMES = await newUser('j.gomes@avocats-gojuris.fr');

const files = readdirSync(join(root, 'supabase', 'migrations')).filter((f) => f.endsWith('.sql')).sort();
for (const f of files) {
  const sql = readFileSync(join(root, 'supabase', 'migrations', f), 'utf8')
    // Extension non disponible dans PGlite : remplacée par le bouchon net.http_post.
    .replace(/create extension if not exists pg_net;/gi, '');
  try {
    await db.exec(sql);
  } catch (e) {
    console.error(`✖ Échec de la migration ${f} : ${e.message}`);
    process.exit(1);
  }
}
// Idempotence : rejouer la dernière migration ne doit ni échouer ni dupliquer.
const last = files[files.length - 1];
await db.exec(readFileSync(join(root, 'supabase', 'migrations', last), 'utf8').replace(/create extension if not exists pg_net;/gi, ''));
console.log(`Migrations appliquées : ${files.length} (+ rejeu de ${last})\n`);

const A = await newUser('a@test.fr', { meta: { first_name: 'Alice', last_name: 'Martin', company_type: 'pme', company_name: 'Martin SAS', phone: '+33 6 12 34 56 78' } });
const B = await newUser('b@test.fr', { meta: { first_name: 'Bruno', last_name: 'Durand', company_type: 'particulier', phone: 'pas-un-numero' } });
const UNVERIFIED = await newUser('nonverifie@test.fr', { confirmed: false });

console.log('Profils');
await test('inscription : prénom, nom, structure, téléphone conservés', async () => {
  const [p] = await q('select first_name, last_name, full_name, company_name, phone from public.profiles where id = $1', [A]);
  assert.equal(p.first_name, 'Alice');
  assert.equal(p.last_name, 'Martin');
  assert.equal(p.full_name, 'Alice Martin');
  assert.equal(p.company_name, 'Martin SAS');
  assert.equal(p.phone, '+33 6 12 34 56 78');
});
await test('inscription : téléphone invalide ignoré, compte créé quand même', async () => {
  const [p] = await q('select phone, first_name from public.profiles where id = $1', [B]);
  assert.equal(p.phone, null);
  assert.equal(p.first_name, 'Bruno');
});
await test('client ne peut pas se lever une suspension', async () => {
  await asSuperuser();
  await q(`update public.profiles set suspended_at = now(), suspension_reason = 'test' where id = $1`, [B]);
  await asUser(B);
  await q(`update public.profiles set suspended_at = null, suspension_reason = null where id = $1`, [B]);
  await asSuperuser();
  const [p] = await q('select suspended_at from public.profiles where id = $1', [B]);
  assert.notEqual(p.suspended_at, null);
  await q(`update public.profiles set suspended_at = null, suspension_reason = null where id = $1`, [B]);
});

console.log('Cloisonnement RLS A/B');
const dossierA = await insertDossier(A, { title: 'Recouvrement — Société X' });
const dossierB = await insertDossier(B, { title: 'Dossier de B' });
await test('A voit son dossier et jamais celui de B', async () => {
  await asUser(A);
  const rows = await q('select id from public.dossiers');
  assert.deepEqual(rows.map((r) => r.id), [dossierA]);
});
await test('A ne lit pas le dossier de B par identifiant (IDOR)', async () => {
  await asUser(A);
  assert.equal((await q('select id from public.dossiers where id = $1', [dossierB])).length, 0);
});
await test('A ne modifie ni ne supprime le dossier de B', async () => {
  await asUser(A);
  await q(`update public.dossiers set title = 'piraté' where id = $1`, [dossierB]);
  await q('delete from public.dossiers where id = $1', [dossierB]);
  await asSuperuser();
  const [d] = await q('select title from public.dossiers where id = $1', [dossierB]);
  assert.equal(d.title, 'Dossier de B');
});
await test('A ne peut pas créer un dossier au nom de B', async () => {
  await asUser(A);
  await rejects(q(`insert into public.dossiers (user_id, typology, title, status) values ($1, 'autre', 'x', 'transmis')`, [B]), /row-level security|FORBIDDEN/);
});
await test('anonyme : aucune lecture, aucune écriture', async () => {
  await asAnon();
  // Comportement de production (constaté par sonde API) : refus explicite.
  await rejects(q('select id from public.dossiers'), /permission denied|row-level security/);
  await rejects(q(`insert into public.dossiers (user_id, typology, title, status) values ($1, 'autre', 'x', 'transmis')`, [A]), /row-level security|permission/);
});
await test('client : ni écriture d\'abonnement, ni d\'exception, ni de registre, ni de notification', async () => {
  await asUser(A);
  await rejects(q(`insert into public.subscriptions (user_id, plan_id, status) values ($1, 'business-pme-premium', 'active')`, [A]), /row-level security/);
  await rejects(q(`insert into public.entitlement_overrides (user_id, mode, reason) values ($1, 'unlimited', 'moi')`, [A]), /row-level security/);
  await rejects(q(`insert into public.dossier_submissions (user_id) values ($1)`, [A]), /row-level security/);
  assert.equal((await q('select id from public.admin_notifications')).length, 0);
  await rejects(q('select * from public.dossier_entitlement($1)', [A]), /permission denied/);
});
await test('client ne voit pas les droits d\'un autre compte (fonction interne fermée)', async () => {
  await asUser(A);
  await rejects(q('select public.admin_list_entitlements()'), /FORBIDDEN/);
});

console.log('Soumission et notifications');
await test('dossier validé : horodaté, consommé, notifié une seule fois', async () => {
  await asSuperuser();
  const [d] = await q('select submitted_at, created_by from public.dossiers where id = $1', [dossierA]);
  assert.notEqual(d.submitted_at, null);
  assert.equal(d.created_by, A);
  assert.equal((await q('select id from public.dossier_submissions where dossier_id = $1', [dossierA])).length, 1);
  assert.equal((await q('select id from public.admin_notifications where dossier_id = $1', [dossierA])).length, 1);
  const calls = await q(`select body from net.calls where body ->> 'notification_id' is not null and body -> 'record' ->> 'id' = $1`, [dossierA]);
  assert.equal(calls.length, 1);
  assert.equal(JSON.stringify(calls[0].body).includes('Recouvrement'), false, 'aucun titre dans la notification');
});
await test('brouillon (application mobile) : ni consommation ni notification', async () => {
  const draft = await insertDossier(A, { status: 'brouillon' });
  await asSuperuser();
  assert.equal((await q('select id from public.dossier_submissions where dossier_id = $1', [draft])).length, 0);
  assert.equal((await q('select id from public.admin_notifications where dossier_id = $1', [draft])).length, 0);
  await asUser(A);
  await q(`update public.dossiers set status = 'transmis' where id = $1`, [draft]);
  await asSuperuser();
  assert.equal((await q('select id from public.dossier_submissions where dossier_id = $1', [draft])).length, 1);
  assert.equal((await q('select id from public.admin_notifications where dossier_id = $1', [draft])).length, 1);
});
await test('client ne peut pas falsifier submitted_at pour contourner le quota', async () => {
  await asUser(A);
  const [row] = await q(
    `insert into public.dossiers (user_id, typology, title, status, submitted_at) values ($1, 'autre', 'x', 'transmis', '2020-01-01') returning id, submitted_at`,
    [A],
  );
  assert.ok(new Date(row.submitted_at).getFullYear() >= 2026);
  await asSuperuser();
  assert.equal((await q('select id from public.dossier_submissions where dossier_id = $1', [row.id])).length, 1);
});
await test('double clic / double onglet : même clé = un seul dossier', async () => {
  const key = '11111111-2222-3333-4444-555555555555';
  await insertDossier(B, { key });
  await rejects(insertDossier(B, { key }), /duplicate key|unique/);
  await asSuperuser();
  assert.equal((await q('select id from public.dossiers where client_request_id = $1', [key])).length, 1);
});
await test('compte non vérifié : validation refusée', async () => {
  await rejects(insertDossier(UNVERIFIED), /EMAIL_NOT_VERIFIED/);
});
await test('compte suspendu : validation refusée', async () => {
  const S = await newUser('suspendu@test.fr');
  await asSuperuser();
  await q('update public.profiles set suspended_at = now() where id = $1', [S]);
  await rejects(insertDossier(S), /SUBMISSION_BLOCKED/);
});

console.log('Quotas');
const Q = await newUser('quota@test.fr');
await subscribe(Q, 'business-pme-20');
await test('offre à 20 : dossiers 1 → 20 autorisés', async () => {
  for (let i = 1; i <= 20; i++) {
    await insertDossier(Q, { title: `D${i}` });
    // Limitation de débit (10 / 10 min) : on vieillit le registre pour tester le quota seul.
    await asSuperuser();
    await q(`update public.dossier_submissions set submitted_at = submitted_at - interval '11 minutes' where user_id = $1`, [Q]);
  }
  await asUser(Q);
  const [{ get_my_dossier_entitlement: e }] = await q('select public.get_my_dossier_entitlement()');
  assert.equal(e.used, 20);
  assert.equal(e.dossier_limit, 20);
});
await test('offre à 20 : le 21ᵉ est refusé (message quota)', async () => {
  await rejects(insertDossier(Q, { title: 'D21' }), /DOSSIER_QUOTA_EXCEEDED/);
});
await test('brouillon toujours possible quand le quota est atteint, validation refusée', async () => {
  const draft = await insertDossier(Q, { status: 'brouillon' });
  await asUser(Q);
  await rejects(q(`update public.dossiers set status = 'transmis' where id = $1`, [draft]), /DOSSIER_QUOTA_EXCEEDED/);
});
await test('supprimer un dossier ne recrédite pas le quota', async () => {
  await asUser(Q);
  const [one] = await q(`select id from public.dossiers where user_id = $1 and status = 'transmis' limit 1`, [Q]);
  await q('delete from public.dossiers where id = $1', [one.id]);
  await rejects(insertDossier(Q, { title: 'après suppression' }), /DOSSIER_QUOTA_EXCEEDED/);
});
await test('archiver un brouillon ne consomme rien', async () => {
  const draft = await insertDossier(A, { status: 'brouillon', title: 'abandonné' });
  await asUser(A);
  await q(`update public.dossiers set status = 'archive' where id = $1`, [draft]);
  await asSuperuser();
  assert.equal((await q('select id from public.dossier_submissions where dossier_id = $1', [draft])).length, 0);
});
await test('archiver ne recrédite pas le quota', async () => {
  await asUser(Q);
  await q(`update public.dossiers set status = 'archive' where user_id = $1 and status <> 'brouillon'`, [Q]);
  await rejects(insertDossier(Q, { title: 'après archive' }), /DOSSIER_QUOTA_EXCEEDED/);
});
await test('renouvellement Stripe (nouvelle période) : quota de nouveau disponible', async () => {
  await subscribe(Q, 'business-pme-20', {
    start: new Date(Date.now() + 1000).toISOString(),
    end: new Date(Date.now() + 31 * 86400000).toISOString(),
  });
  await asSuperuser();
  await q(`update public.subscriptions set current_period_start = now() - interval '1 second' where user_id = $1`, [Q]);
  await insertDossier(Q, { title: 'nouvelle période' });
  await asUser(Q);
  const [{ get_my_dossier_entitlement: e }] = await q('select public.get_my_dossier_entitlement()');
  assert.equal(e.used, 1);
});
await test('paiement en échec (unpaid) : validation bloquée, dossiers conservés', async () => {
  const U = await newUser('impaye@test.fr');
  await subscribe(U, 'essentiel', { status: 'unpaid' });
  await rejects(insertDossier(U), /SUBMISSION_BLOCKED/);
});
await test('sans abonnement synchronisé : aucune limite inventée', async () => {
  const F = await newUser('gratuit@test.fr');
  await asUser(F);
  const [{ get_my_dossier_entitlement: e }] = await q('select public.get_my_dossier_entitlement()');
  assert.equal(e.applies, false);
  await insertDossier(F);
});
await test('client ne peut pas se donner une exception ni changer d\'offre', async () => {
  await asUser(Q, 'aal2');
  await rejects(q(`select public.admin_set_dossier_override($1, 'unlimited', null, 'moi', null)`, [Q]), /FORBIDDEN/);
  await rejects(q(`update public.subscriptions set plan_id = 'business-pme-premium' where user_id = $1`, [Q]).then(async () => {
    await asSuperuser();
    const [s] = await q('select plan_id from public.subscriptions where user_id = $1', [Q]);
    if (s.plan_id !== 'business-pme-20') throw new Error('offre modifiée');
    throw new Error('aucune ligne modifiée (attendu)');
  }), /aucune ligne modifiée/);
});

console.log('Exception j.gomes@avocats-gojuris.fr');
await subscribe(JGOMES, 'business-pme-20');
await test('override actif, permanent, résolu sur l\'identifiant durable', async () => {
  await asSuperuser();
  const rows = await q(`select mode, dossier_limit, expires_at, active from public.entitlement_overrides where user_id = $1`, [JGOMES]);
  assert.equal(rows.length, 1, 'une seule exception (rejeu idempotent)');
  assert.equal(rows[0].mode, 'unlimited');
  assert.equal(rows[0].expires_at, null);
  assert.equal(rows[0].active, true);
});
await test('dossiers 1 → 25 autorisés malgré une offre à 20', async () => {
  for (let i = 1; i <= 25; i++) {
    await insertDossier(JGOMES, { title: `JG${i}` });
    await asSuperuser();
    await q(`update public.dossier_submissions set submitted_at = submitted_at - interval '11 minutes' where user_id = $1`, [JGOMES]);
  }
  await asUser(JGOMES);
  const [{ get_my_dossier_entitlement: e }] = await q('select public.get_my_dossier_entitlement()');
  assert.equal(e.unlimited, true);
  assert.equal(e.used, 25);
});
await test('offre Stripe inchangée (plan 20 conservé)', async () => {
  await asSuperuser();
  const [s] = await q('select plan_id from public.subscriptions where user_id = $1', [JGOMES]);
  assert.equal(s.plan_id, 'business-pme-20');
});
await test('override survit au renouvellement (21 dossiers dans la nouvelle période)', async () => {
  // Nouvelle période commencée il y a 2 jours : les 25 validations précédentes
  // sont reculées avant son début (période passée).
  await asSuperuser();
  await q(`update public.dossier_submissions set submitted_at = now() - interval '3 days' where user_id = $1`, [JGOMES]);
  await subscribe(JGOMES, 'business-pme-20', {
    start: new Date(Date.now() - 2 * 86400000).toISOString(),
    end: new Date(Date.now() + 28 * 86400000).toISOString(),
  });
  for (let i = 0; i < 21; i++) {
    await insertDossier(JGOMES, { title: `R${i}` });
    await asSuperuser();
    await q(`update public.dossier_submissions set submitted_at = submitted_at - interval '11 minutes' where user_id = $1 and submitted_at > now() - interval '1 day'`, [JGOMES]);
  }
  await asUser(JGOMES);
  const [{ get_my_dossier_entitlement: e }] = await q('select public.get_my_dossier_entitlement()');
  assert.equal(e.used, 21);
  assert.equal(e.unlimited, true);
  assert.equal(e.dossier_limit, null);
});
await test('j.gomes ne peut pas modifier ni retirer son exception', async () => {
  await asUser(JGOMES, 'aal2');
  await q(`update public.entitlement_overrides set active = false where user_id = $1`, [JGOMES]);
  await q(`delete from public.entitlement_overrides where user_id = $1`, [JGOMES]);
  await asSuperuser();
  assert.equal((await q(`select id from public.entitlement_overrides where user_id = $1 and active`, [JGOMES])).length, 1);
});
await test('audit de création présent', async () => {
  await asSuperuser();
  const rows = await q(`select action from public.audit_logs where target_user_id = $1`, [JGOMES]);
  assert.ok(rows.some((r) => r.action === 'quota_override_cree'));
});

console.log('Super admin');
await test('admin voit l\'exception dans la vue des droits (AAL2)', async () => {
  await asUser(ADMIN, 'aal2');
  const rows = await q('select * from public.admin_list_entitlements()');
  const jg = rows.find((r) => r.email === 'j.gomes@avocats-gojuris.fr');
  assert.equal(jg.override_mode, 'unlimited');
  assert.equal(jg.plan_limit, 20);
  assert.equal(jg.unlimited, true);
});
await test('définir une exception exige AAL2', async () => {
  await asUser(ADMIN, 'aal1');
  await rejects(q(`select public.admin_set_dossier_override($1, 'custom_limit', 50, 'geste commercial', null)`, [Q]), /MFA_REQUIRED/);
});
await test('définir une exception exige un motif', async () => {
  await asUser(ADMIN, 'aal2');
  await rejects(q(`select public.admin_set_dossier_override($1, 'bonus', 5, '  ', null)`, [Q]), /REASON_REQUIRED/);
});
await test('bonus +N : débloque immédiatement, audité (ancienne → nouvelle valeur)', async () => {
  await asUser(ADMIN, 'aal2');
  await q(`select public.admin_set_dossier_override($1, 'custom_limit', 1, 'ajustement', null)`, [Q]);
  await rejects(insertDossier(Q, { title: 'limite 1' }), /DOSSIER_QUOTA_EXCEEDED/);
  await asUser(ADMIN, 'aal2');
  await q(`select public.admin_set_dossier_override($1, 'unlimited', null, 'geste commercial', null)`, [Q]);
  await insertDossier(Q, { title: 'débloqué' });
  await asSuperuser();
  const logs = await q(`select metadata from public.audit_logs where target_user_id = $1 order by created_at`, [Q]);
  assert.equal(logs.length, 2);
  assert.equal(logs[1].metadata.ancienne_valeur, 'custom_limit:1');
  assert.equal(logs[1].metadata.nouvelle_valeur, 'unlimited');
  assert.equal((await q(`select id from public.entitlement_overrides where user_id = $1 and active`, [Q])).length, 1);
});
await test('suppression définitive d\'un dossier : super admin + AAL2 uniquement', async () => {
  const target = await insertDossier(B, { title: 'à supprimer' });
  await asUser(ADMIN, 'aal1');
  await q('delete from public.dossiers where id = $1', [target]);
  await asSuperuser();
  assert.equal((await q('select id from public.dossiers where id = $1', [target])).length, 1, 'aal1 ne supprime pas');
  await asUser(ADMIN, 'aal2');
  await q('delete from public.dossiers where id = $1', [target]);
  await asSuperuser();
  assert.equal((await q('select id from public.dossiers where id = $1', [target])).length, 0);
  assert.equal((await q('select id from public.dossier_submissions where user_id = $1 and dossier_id is null', [B])).length, 1, 'consommation conservée');
});
await test('admin : prise en charge et vu, champs refusés au client', async () => {
  await asUser(ADMIN, 'aal2');
  await q(`update public.dossiers set admin_seen_at = now(), taken_by = $2, taken_at = now(), status = 'en-cours', current_step = 3 where id = $1`, [dossierA, ADMIN]);
  await asUser(A);
  await q(`update public.dossiers set taken_by = null, admin_seen_at = null, current_step = 5, deleted_at = now() where id = $1`, [dossierA]);
  await asSuperuser();
  const [d] = await q('select taken_by, admin_seen_at, current_step, deleted_at from public.dossiers where id = $1', [dossierA]);
  assert.equal(d.taken_by, ADMIN);
  assert.notEqual(d.admin_seen_at, null);
  assert.equal(d.current_step, 3);
  assert.equal(d.deleted_at, null);
});
await test('notifications : lisibles et marquables par l\'admin seulement', async () => {
  await asUser(ADMIN, 'aal2');
  const rows = await q('select id from public.admin_notifications');
  assert.ok(rows.length > 0);
  await q('update public.admin_notifications set read_at = now() where id = $1', [rows[0].id]);
  await asUser(B);
  assert.equal((await q('select id from public.admin_notifications')).length, 0);
});

console.log('Durcissement AAL2 + suppression exclusive (20260918100000)');
await test('admin en AAL1 : aucune donnée de tiers (dossiers, profils, e-mails, vue des droits)', async () => {
  await asUser(ADMIN, 'aal1');
  assert.equal((await q('select id from public.dossiers where user_id = $1', [A])).length, 0);
  assert.equal((await q('select id from public.profiles where id = $1', [A])).length, 0);
  assert.equal((await q('select * from public.admin_user_emails()')).length, 0);
  await rejects(q('select * from public.admin_list_entitlements()'), /MFA_REQUIRED/);
  await asUser(ADMIN, 'aal2');
  assert.ok((await q('select id from public.dossiers where user_id = $1', [A])).length > 0);
  assert.ok((await q('select * from public.admin_user_emails()')).length > 0);
});
await test('admin en AAL1 : modification d\'un dossier de tiers sans effet', async () => {
  await asSuperuser();
  const [before] = await q('select status from public.dossiers where id = $1', [dossierA]);
  await asUser(ADMIN, 'aal1');
  await q(`update public.dossiers set status = 'archive' where id = $1`, [dossierA]);
  await asSuperuser();
  const [after] = await q('select status from public.dossiers where id = $1', [dossierA]);
  assert.equal(after.status, before.status);
});
await test('corbeille dossier : super admin AAL2 uniquement, même par UPDATE direct', async () => {
  const cible = await insertDossier(B, { title: 'corbeille-exclusive' });
  // Le client propriétaire ne peut pas se mettre lui-même à la corbeille.
  await asUser(B);
  await q(`update public.dossiers set deleted_at = now() where id = $1`, [cible]);
  await asSuperuser();
  assert.equal((await q('select deleted_at from public.dossiers where id = $1', [cible]))[0].deleted_at, null);
  // Super admin AAL2 : mise à la corbeille puis restauration.
  await asUser(ADMIN, 'aal2');
  await q(`update public.dossiers set deleted_at = now(), deleted_by = $2, delete_reason = 'test' where id = $1`, [cible, ADMIN]);
  await asSuperuser();
  assert.notEqual((await q('select deleted_at from public.dossiers where id = $1', [cible]))[0].deleted_at, null);
  await asUser(ADMIN, 'aal2');
  await q(`update public.dossiers set deleted_at = null, deleted_by = null, delete_reason = null where id = $1`, [cible]);
  await asSuperuser();
  assert.equal((await q('select deleted_at from public.dossiers where id = $1', [cible]))[0].deleted_at, null);
});
await test('restauration : aucune nouvelle notification, aucune consommation supplémentaire', async () => {
  const cible = await insertDossier(B, { title: 'restauration-neutre' });
  await asSuperuser();
  const notifsAvant = (await q('select id from public.admin_notifications where dossier_id = $1', [cible])).length;
  const consoAvant = (await q('select id from public.dossier_submissions where dossier_id = $1', [cible])).length;
  await asUser(ADMIN, 'aal2');
  await q(`update public.dossiers set deleted_at = now(), deleted_by = $2, delete_reason = 'test' where id = $1`, [cible, ADMIN]);
  await q(`update public.dossiers set deleted_at = null, deleted_by = null, delete_reason = null where id = $1`, [cible]);
  await asSuperuser();
  assert.equal((await q('select id from public.admin_notifications where dossier_id = $1', [cible])).length, notifsAvant);
  assert.equal((await q('select id from public.dossier_submissions where dossier_id = $1', [cible])).length, consoAvant);
});
await test('client : suppression API limitée aux brouillons jamais validés', async () => {
  const brouillon = await insertDossier(B, { title: 'brouillon à nettoyer', status: 'brouillon' });
  const valide = await insertDossier(B, { title: 'validé intouchable' });
  await asUser(B);
  await q('delete from public.dossiers where id = $1', [brouillon]);
  await q('delete from public.dossiers where id = $1', [valide]);
  await asSuperuser();
  assert.equal((await q('select id from public.dossiers where id = $1', [brouillon])).length, 0, 'le brouillon se supprime');
  assert.equal((await q('select id from public.dossiers where id = $1', [valide])).length, 1, 'le dossier validé reste');
});
await test('offre annuelle : la limite du plan vaut par fenêtre mensuelle, pas une fois l\'an', async () => {
  const Y = await newUser('annuel@test.fr');
  const start = new Date(Date.now() - 40 * 86400000).toISOString();
  const end = new Date(Date.now() + 325 * 86400000).toISOString();
  await subscribe(Y, 'business-pme-20', { start, end });
  await asSuperuser();
  // 20 validations dans la PREMIÈRE fenêtre mensuelle (il y a 39 jours).
  for (let i = 0; i < 20; i++) {
    await q(`insert into public.dossier_submissions (user_id, submitted_at) values ($1, $2)`, [
      Y, new Date(Date.now() - 39 * 86400000).toISOString(),
    ]);
  }
  const [win] = await q('select period_start, period_end, dossier_limit, used from public.dossier_entitlement($1)', [Y]);
  assert.equal(win.used, 0, 'la fenêtre courante ne compte pas le mois précédent');
  assert.ok(new Date(win.period_end) - new Date(win.period_start) <= 32 * 86400000, 'fenêtre au plus mensuelle');
  // La fenêtre courante applique bien la limite : 20 acceptés, 21e refusé
  // (semés il y a 2 h pour ne pas déclencher la limitation de débit 10/10 min).
  await asSuperuser();
  for (let i = 0; i < 20; i++) {
    await q(`insert into public.dossier_submissions (user_id, submitted_at) values ($1, now() - interval '2 hours')`, [Y]);
  }
  await rejects(insertDossier(Y, { title: '21e du mois' }), /DOSSIER_QUOTA_EXCEEDED/);
});
await test('verrou structurel : une seule ligne super_admin possible', async () => {
  await asSuperuser();
  await rejects(
    q(`insert into public.app_admins (user_id, role) values ($1, 'super_admin')`, [B]),
    /duplicate key|unique/i,
  );
});

// ── Chantier 13 : suppression directe depuis « Vos dossiers » ───────────────
// Le frontend (src/pages/Account.tsx) réutilise l'appel de la console :
//   update dossiers set deleted_at, deleted_by, delete_reason … returning id, deleted_at
// Ces tests prouvent que la base seule décide : refus pour le client A sur le
// dossier de B, pour un admin « support », pour le super admin en AAL1 ;
// acceptation pour le seul super admin AAL2, avec audit écrit par la base
// (migration 20260918120000) ; rien d'autre n'est touché.
console.log('Suppression directe « Vos dossiers » — chantier 13 (20260918120000)');
const SUPPORT = await newUser('support@test.fr');
await asSuperuser();
await q(`insert into public.app_admins (user_id, role) values ($1, 'support')`, [SUPPORT]);
// Bouchon Storage : en production, le rôle authenticated a ces privilèges sur
// storage.objects (la RLS décide). Sans eux, tout refus serait trivial.
await db.exec('grant select, insert, update, delete on storage.objects to authenticated;');

const cible13 = await insertDossier(B, { title: 'Chantier 13 — dossier de B' });
await asUser(B);
await q(
  `insert into public.dossier_documents (dossier_id, user_id, file_path, file_name) values ($1, $2, $3, 'piece.pdf')`,
  [cible13, B, `${B}/${cible13}/piece.pdf`],
);
await q(
  `insert into public.dossier_deadlines (dossier_id, user_id, title, due_date) values ($1, $2, 'Relance', current_date + 7)`,
  [cible13, B],
);
await asSuperuser();
await q(`insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)`, [`${B}/${cible13}/piece.pdf`, B]);
await q(`insert into storage.objects (bucket_id, name, owner) values ('documents', $1, $2)`, [`${B}/purge/ancien.pdf`, B]);

async function etat13(id = cible13) {
  await asSuperuser();
  const [d] = await q('select user_id, status, deleted_at, deleted_by, delete_reason from public.dossiers where id = $1', [id]);
  return d;
}
async function compteurs13(id = cible13) {
  await asSuperuser();
  const n = async (sql) => (await q(sql, [id])).length;
  return {
    pieces: await n('select id from public.dossier_documents where dossier_id = $1'),
    echeances: await n('select id from public.dossier_deadlines where dossier_id = $1'),
    consommations: await n('select id from public.dossier_submissions where dossier_id = $1'),
    notifications: await n('select id from public.admin_notifications where dossier_id = $1'),
    fichiers: (await q(`select id from storage.objects where name like $1`, [`${B}/${id}/%`])).length,
  };
}
// Toutes les tentatives d'écriture « destructrices » sur le dossier cible.
async function tentatives13(actor, aal) {
  await asUser(actor, aal);
  await q('delete from public.dossiers where id = $1', [cible13]);
  await q(`update public.dossiers set status = 'archive' where id = $1`, [cible13]);
  await q(`update public.dossiers set deleted_at = now(), deleted_by = $2, delete_reason = 'x' where id = $1`, [cible13, actor]);
  await q('update public.dossiers set user_id = $2 where id = $1', [cible13, actor]);
  await q(`delete from storage.objects where bucket_id = 'documents' and name like $1`, [`${B}/%`]);
  await q(`update storage.objects set name = $2 where name = $1`, [`${B}/${cible13}/piece.pdf`, `${actor}/vol.pdf`]);
}
function intact13(d) {
  assert.equal(d.user_id, B, 'propriétaire inchangé');
  assert.equal(d.status, 'transmis', 'statut inchangé');
  assert.equal(d.deleted_at, null, 'pas de corbeille');
  assert.equal(d.deleted_by, null);
}

await test('client A sur le dossier de B : DELETE, statut, corbeille, propriétaire, Storage — sans effet (AAL1 et AAL2)', async () => {
  const avant = await compteurs13();
  for (const aal of ['aal1', 'aal2']) {
    await tentatives13(A, aal);
    intact13(await etat13());
  }
  assert.deepEqual(await compteurs13(), avant);
  await asSuperuser();
  assert.equal((await q(`select id from storage.objects where name like $1`, [`${B}/%`])).length, 2, 'fichiers de B intacts');
});
await test('client A : ni lecture du dossier, ni des fichiers, ni du journal de B', async () => {
  await asUser(A, 'aal2');
  assert.equal((await q('select id from public.dossiers where id = $1', [cible13])).length, 0);
  assert.equal((await q(`select id from storage.objects where name like $1`, [`${B}/%`])).length, 0);
  assert.equal((await q('select id from public.audit_logs')).length, 0);
  assert.equal((await q('select public.super_admin_aal2() as ok'))[0].ok, false);
});
await test('admin « support » (non super) : corbeille, suppression, propriétaire, Storage refusés même en AAL2', async () => {
  const avant = await compteurs13();
  await tentatives13(SUPPORT, 'aal1');
  intact13(await etat13());
  // En AAL2, le support traite les dossiers (statut : droit existant de la
  // console, hors suppression) mais ne peut NI les mettre à la corbeille,
  // NI les supprimer, NI en changer le propriétaire, NI effacer un fichier.
  await asUser(SUPPORT, 'aal2');
  await q(`update public.dossiers set deleted_at = now(), deleted_by = $2, delete_reason = 'x' where id = $1`, [cible13, SUPPORT]);
  await q('update public.dossiers set user_id = $2 where id = $1', [cible13, SUPPORT]);
  await q('delete from public.dossiers where id = $1', [cible13]);
  await q(`delete from storage.objects where bucket_id = 'documents' and name like $1`, [`${B}/%`]);
  intact13(await etat13());
  assert.deepEqual(await compteurs13(), avant);
  await asUser(SUPPORT, 'aal2');
  assert.equal((await q('select public.super_admin_aal2() as ok'))[0].ok, false);
  await rejects(q(`select public.admin_set_dossier_override($1, 'unlimited', null, 'x', null)`, [B]), /FORBIDDEN/);
});
await test('admin « support » en AAL1 : aucun dossier de tiers exposé', async () => {
  await asUser(SUPPORT, 'aal1');
  assert.equal((await q('select id from public.dossiers where user_id = $1', [B])).length, 0);
  assert.equal((await q('select * from public.admin_user_emails()')).length, 0);
});
await test('super admin en AAL1 : DELETE, statut, corbeille, propriétaire, Storage — sans effet', async () => {
  const avant = await compteurs13();
  await tentatives13(ADMIN, 'aal1');
  intact13(await etat13());
  assert.deepEqual(await compteurs13(), avant);
  await asUser(ADMIN, 'aal1');
  assert.equal((await q('select public.super_admin_aal2() as ok'))[0].ok, false);
  assert.equal((await q('select id from public.dossiers where id = $1', [cible13])).length, 0, 'aucune donnée de tiers avant AAL2');
});
await test('RPC : aucune fonction appelable ne supprime, ne met à la corbeille ni ne réattribue un dossier', async () => {
  await asSuperuser();
  const fns = await q(`
    select p.proname, p.prosrc
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype <> 'trigger'::regtype
      and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
           or has_function_privilege('anon', p.oid, 'EXECUTE'))`);
  assert.ok(fns.length > 0);
  const ecrit = fns.filter((f) =>
    /\b(update|delete\s+from|insert\s+into)\s+(public\.)?dossiers\b/i.test(f.prosrc) ||
    /\b(update|delete\s+from)\s+storage\.objects\b/i.test(f.prosrc),
  );
  assert.deepEqual(ecrit.map((f) => f.proname), []);
  // Sonde de capacité utilisée par l'interface : vraie pour le seul super admin AAL2.
  await asUser(ADMIN, 'aal2');
  assert.equal((await q('select public.super_admin_aal2() as ok'))[0].ok, true);
  await asAnon();
  await rejects(q('select public.super_admin_aal2()'), /permission denied/);
});
await test('journal indisponible : la mise à la corbeille est annulée (pas d\'action sans trace)', async () => {
  const autre = await insertDossier(B, { title: 'Chantier 13 — atomicité' });
  await asSuperuser();
  await db.exec(`alter table public.audit_logs add constraint t13_journal_bloque check (action <> 'dossier_corbeille') not valid;`);
  try {
    await asUser(ADMIN, 'aal2');
    await rejects(
      q(`update public.dossiers set deleted_at = now(), deleted_by = $2, delete_reason = 'x' where id = $1 returning id, deleted_at`, [autre, ADMIN]),
      /t13_journal_bloque|check constraint/,
    );
  } finally {
    await asSuperuser();
    await db.exec('alter table public.audit_logs drop constraint t13_journal_bloque;');
  }
  assert.equal((await etat13(autre)).deleted_at, null);
});
await test('super admin AAL2 : mise à la corbeille acceptée, relue, auditée par la base', async () => {
  const avant = await compteurs13();
  await asUser(ADMIN, 'aal2');
  // Même appel que la console et que la vue « Vos dossiers ».
  const rows = await q(
    `update public.dossiers set deleted_at = now(), deleted_by = $2, delete_reason = 'Créé par erreur'
     where id = $1 returning id, deleted_at`,
    [cible13, ADMIN],
  );
  assert.equal(rows.length, 1);
  assert.notEqual(rows[0].deleted_at, null, 'deleted_at relu dans la réponse');
  // Relecture serveur distincte (comme l'interface avant de retirer la carte).
  const [relu] = await q('select deleted_at from public.dossiers where id = $1', [cible13]);
  assert.notEqual(relu.deleted_at, null);
  await asSuperuser();
  const d = await etat13();
  assert.equal(d.user_id, B);
  assert.equal(d.deleted_by, ADMIN);
  assert.equal(d.delete_reason, 'Créé par erreur');
  const logs = await q(`select actor_id, actor_role, target_user_id, metadata from public.audit_logs where action = 'dossier_corbeille' and resource_id = $1`, [cible13]);
  assert.equal(logs.length, 1, 'une entrée d\'audit écrite par la base');
  assert.equal(logs[0].actor_id, ADMIN);
  assert.equal(logs[0].actor_role, 'super_admin');
  assert.equal(logs[0].target_user_id, B);
  assert.equal(logs[0].metadata.source, 'base');
  assert.equal(logs[0].metadata.motif, 'Créé par erreur');
  // Soft delete : pièces, échéances, fichiers, quota (aucun recrédit) et
  // notifications strictement inchangés.
  assert.deepEqual(await compteurs13(), avant);
});
await test('dossier en corbeille : le propriétaire ne peut ni le restaurer ni le réattribuer', async () => {
  await asUser(B);
  await q('update public.dossiers set deleted_at = null, deleted_by = null, delete_reason = null where id = $1', [cible13]);
  await q('update public.dossiers set user_id = $2 where id = $1', [cible13, A]);
  const d = await etat13();
  assert.notEqual(d.deleted_at, null);
  assert.equal(d.user_id, B);
});
await test('super admin AAL2 : changement de propriétaire toujours ignoré', async () => {
  await asUser(ADMIN, 'aal2');
  await q('update public.dossiers set user_id = $2 where id = $1', [cible13, ADMIN]);
  assert.equal((await etat13()).user_id, B);
});
await test('restauration (console) : auditée par la base, sans notification ni consommation', async () => {
  const avant = await compteurs13();
  await asUser(ADMIN, 'aal2');
  const rows = await q(
    'update public.dossiers set deleted_at = null, deleted_by = null, delete_reason = null where id = $1 returning deleted_at',
    [cible13],
  );
  assert.equal(rows[0].deleted_at, null);
  await asSuperuser();
  const logs = await q(`select actor_id, metadata from public.audit_logs where action = 'dossier_restaure' and resource_id = $1`, [cible13]);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].actor_id, ADMIN);
  assert.equal(logs[0].metadata.source, 'base');
  assert.deepEqual(await compteurs13(), avant);
});
await test('journal d\'audit : ni falsifiable par un client, ni modifiable ou effaçable par le super admin', async () => {
  await asUser(A, 'aal2');
  await rejects(
    q(`insert into public.audit_logs (actor_id, action, resource_type, resource_id) values ($1, 'dossier_restaure', 'dossier', $2)`, [A, cible13]),
    /row-level security/,
  );
  await asUser(ADMIN, 'aal2');
  await q(`update public.audit_logs set action = 'effacé' where resource_id = $1`, [cible13]);
  await q('delete from public.audit_logs where resource_id = $1', [cible13]);
  await asSuperuser();
  const actions = (await q('select action from public.audit_logs where resource_id = $1 order by created_at', [cible13])).map((r) => r.action);
  assert.deepEqual(actions, ['dossier_corbeille', 'dossier_restaure']);
});
await test('Storage : effacement d\'un fichier réservé au super admin AAL2 (chemin de suppression définitive, inchangé)', async () => {
  await asUser(ADMIN, 'aal2');
  await q(`delete from storage.objects where bucket_id = 'documents' and name = $1`, [`${B}/purge/ancien.pdf`]);
  await asSuperuser();
  assert.equal((await q('select id from storage.objects where name = $1', [`${B}/purge/ancien.pdf`])).length, 0);
  assert.equal((await q('select id from storage.objects where name = $1', [`${B}/${cible13}/piece.pdf`])).length, 1, 'la corbeille n\'a jamais touché aux fichiers');
});

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
