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
await test('admin voit l\'exception dans la vue des droits (AAL indifférente en lecture)', async () => {
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

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
