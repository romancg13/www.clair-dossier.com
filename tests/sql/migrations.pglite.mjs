// Tests SQL réels des migrations Supabase — PostgreSQL embarqué (PGlite).
//
// Rejoue TOUTES les migrations de supabase/migrations dans l'ordre, sur une
// base vierge dotée de bouchons minimaux des schémas gérés par Supabase
// (auth, storage, net), puis vérifie le comportement sous les rôles réels
// `authenticated` / `anon` avec RLS active :
//   cloisonnement A/B, quota atomique, idempotence, registre non recrédité,
//   exception illimitée j.gomes, console admin sans MFA (rôle serveur seul),
//   notifications, champs immuables.
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
    console.log(`  ✖ ${name}\n      ${e.message.split('\n').slice(0, 6).join(' | ')}`);
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
await test('pièce : B ne peut ni rattacher ni déplacer une pièce vers le dossier de A (20261125150000)', async () => {
  await asUser(B);
  await rejects(
    q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1, $2, $3, 'x.pdf', 'piece')`, [dossierA, B, `${B}/x.pdf`]),
    /row-level security/,
  );
  const [own] = await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1, $2, $3, 'y.pdf', 'piece') returning id`, [dossierB, B, `${B}/y.pdf`]);
  await rejects(q('update public.dossier_documents set dossier_id = $1 where id = $2', [dossierA, own.id]), /row-level security/);
  await q(`update public.dossier_documents set file_name = 'z.pdf' where id = $1`, [own.id]);
  await q('delete from public.dossier_documents where id = $1', [own.id]);
  // Même règle pour le déplacement d'une échéance.
  const [dl] = await q(`insert into public.dossier_deadlines (dossier_id, user_id, title, due_date) values ($1, $2, 'Isolation', current_date + 7) returning id`, [dossierB, B]);
  await rejects(q('update public.dossier_deadlines set dossier_id = $1 where id = $2', [dossierA, dl.id]), /row-level security/);
  await q(`update public.dossier_deadlines set title = 'Isolation 2' where id = $1`, [dl.id]);
  await q('delete from public.dossier_deadlines where id = $1', [dl.id]);
  await asSuperuser();
  const [n] = await q('select count(*)::int as n from public.dossier_documents where dossier_id = $1 and user_id = $2', [dossierA, B]);
  assert.equal(n.n, 0);
});
await test('diagnostic lecture seule : distingue correctif absent / appliqué, sans rien écrire', async () => {
  const kit = readFileSync(join(root, 'supabase', 'verification', '20261125_isolation_lecture_seule.sql'), 'utf8');
  const blocs = kit.split(/\n(?=-- \[\d\])/).slice(1).map((b) => b.replace(/^--.*$/gm, '').trim().replace(/;$/, ''));
  assert.equal(blocs.length, 8);
  for (const b of blocs) assert.match(b, /^select\b/i, 'chaque bloc est un SELECT');
  assert.doesNotMatch(kit.replace(/^--.*$/gm, ''), /\b(insert|update|delete|drop|alter|create|grant|truncate)\b/i);
  await asSuperuser();
  const verdict = async () => (await q(blocs[0])).map((r) => r.correctif_applique);
  assert.deepEqual(await verdict(), [true, true, true]);
  await db.exec(readFileSync(join(root, 'supabase', 'rollback', '20261125150000_pieces_dossier_proprietaire.down.sql'), 'utf8'));
  assert.deepEqual(await verdict(), [false, false, false]);
  // Sans le correctif, B rattache une pièce au dossier de A : le diagnostic le compte.
  await asUser(B);
  const [intrus] = await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1, $2, $3, 'intrus.pdf', 'piece') returning id`, [dossierA, B, `${B}/intrus.pdf`]);
  await asSuperuser();
  assert.equal(Number((await q(blocs[1]))[0].pieces_hors_proprietaire), 1);
  await q('delete from public.dossier_documents where id = $1', [intrus.id]);
  await db.exec(readFileSync(join(root, 'supabase', 'migrations', '20261125150000_pieces_dossier_proprietaire.sql'), 'utf8'));
  assert.deepEqual(await verdict(), [true, true, true]);
  assert.equal(Number((await q(blocs[1]))[0].pieces_hors_proprietaire), 0);
  for (const b of blocs.slice(2)) await q(b);
});
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
await test('revenus : le client lit le montant de son abonnement mais ne peut pas le modifier', async () => {
  await asSuperuser();
  await q(`update public.subscriptions set unit_amount = 4900, currency = 'eur', billing_interval = 'month' where user_id = $1`, [Q]);
  await rejects(q(`update public.subscriptions set unit_amount = -1 where user_id = $1`, [Q]), /check constraint|violates/);
  await asUser(Q);
  const [own] = await q('select unit_amount from public.subscriptions where user_id = $1', [Q]);
  assert.equal(own.unit_amount, 4900);
  await q(`update public.subscriptions set unit_amount = 1 where user_id = $1`, [Q]);
  await asSuperuser();
  const [s] = await q('select unit_amount from public.subscriptions where user_id = $1', [Q]);
  assert.equal(s.unit_amount, 4900);
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
// Depuis 20260920120000, le niveau de session (aal1 / aal2) n'a plus aucun
// effet : seul le rôle lu dans app_admins décide. Les sessions admin ci-dessous
// sont donc ouvertes en aal1 (connexion normale, sans TOTP).
await test('admin voit l\'exception dans la vue des droits (session normale, sans MFA)', async () => {
  await asUser(ADMIN, 'aal1');
  const rows = await q('select * from public.admin_list_entitlements()');
  const jg = rows.find((r) => r.email === 'j.gomes@avocats-gojuris.fr');
  assert.equal(jg.override_mode, 'unlimited');
  assert.equal(jg.plan_limit, 20);
  assert.equal(jg.unlimited, true);
});
await test('définir une exception : rôle super admin exigé, MFA non — un client reste refusé même en aal2', async () => {
  for (const aal of ['aal1', 'aal2']) {
    await asUser(A, aal);
    await rejects(q(`select public.admin_set_dossier_override($1, 'custom_limit', 50, 'geste commercial', null)`, [Q]), /FORBIDDEN/);
    await rejects(q('select * from public.admin_list_entitlements()'), /FORBIDDEN/);
  }
});
await test('définir une exception exige un motif', async () => {
  await asUser(ADMIN, 'aal1');
  await rejects(q(`select public.admin_set_dossier_override($1, 'bonus', 5, '  ', null)`, [Q]), /REASON_REQUIRED/);
});
await test('bonus +N : débloque immédiatement, audité (ancienne → nouvelle valeur)', async () => {
  await asUser(ADMIN, 'aal1');
  await q(`select public.admin_set_dossier_override($1, 'custom_limit', 1, 'ajustement', null)`, [Q]);
  await rejects(insertDossier(Q, { title: 'limite 1' }), /DOSSIER_QUOTA_EXCEEDED/);
  await asUser(ADMIN, 'aal1');
  await q(`select public.admin_set_dossier_override($1, 'unlimited', null, 'geste commercial', null)`, [Q]);
  await insertDossier(Q, { title: 'débloqué' });
  await asSuperuser();
  const logs = await q(`select metadata from public.audit_logs where target_user_id = $1 order by created_at`, [Q]);
  assert.equal(logs.length, 2);
  assert.equal(logs[1].metadata.ancienne_valeur, 'custom_limit:1');
  assert.equal(logs[1].metadata.nouvelle_valeur, 'unlimited');
  assert.equal((await q(`select id from public.entitlement_overrides where user_id = $1 and active`, [Q])).length, 1);
});
await test('suppression définitive d\'un dossier : super admin uniquement (sans MFA) — un autre client refusé même en aal2', async () => {
  const target = await insertDossier(B, { title: 'à supprimer' });
  for (const aal of ['aal1', 'aal2']) {
    await asUser(A, aal);
    await q('delete from public.dossiers where id = $1', [target]);
    await asSuperuser();
    assert.equal((await q('select id from public.dossiers where id = $1', [target])).length, 1, `client A (${aal}) ne supprime pas le dossier de B`);
  }
  await asUser(ADMIN, 'aal1');
  await q('delete from public.dossiers where id = $1', [target]);
  await asSuperuser();
  assert.equal((await q('select id from public.dossiers where id = $1', [target])).length, 0);
  assert.equal((await q('select id from public.dossier_submissions where user_id = $1 and dossier_id is null', [B])).length, 1, 'consommation conservée');
});
await test('admin : prise en charge et vu, champs refusés au client', async () => {
  await asUser(ADMIN, 'aal1');
  await q(`update public.dossiers set admin_seen_at = now(), taken_by = $2, taken_at = now(), status = 'en-cours', current_step = 3 where id = $1`, [dossierA, ADMIN]);
  await asUser(A);
  // deleted_by ne se forge pas hors du parcours corbeille (la corbeille du
  // propriétaire est testée plus bas, migration 20260919120000).
  await q(`update public.dossiers set taken_by = null, admin_seen_at = null, current_step = 5, deleted_by = $2 where id = $1`, [dossierA, A]);
  await asSuperuser();
  const [d] = await q('select taken_by, admin_seen_at, current_step, deleted_at, deleted_by from public.dossiers where id = $1', [dossierA]);
  assert.equal(d.taken_by, ADMIN);
  assert.notEqual(d.admin_seen_at, null);
  assert.equal(d.current_step, 3);
  assert.equal(d.deleted_at, null);
  assert.equal(d.deleted_by, null);
});
await test('notifications : lisibles et marquables par l\'admin seulement', async () => {
  await asUser(ADMIN, 'aal1');
  const rows = await q('select id from public.admin_notifications');
  assert.ok(rows.length > 0);
  await q('update public.admin_notifications set read_at = now() where id = $1', [rows[0].id]);
  await asUser(B);
  assert.equal((await q('select id from public.admin_notifications')).length, 0);
});

console.log('Console admin sans MFA (20260920120000) + suppression exclusive (20260918100000)');
await test('admin en session normale (sans MFA) : lit dossiers, profils, e-mails et vue des droits de tous les clients', async () => {
  await asUser(ADMIN, 'aal1');
  assert.ok((await q('select id from public.dossiers where user_id = $1', [A])).length > 0);
  assert.ok((await q('select id from public.dossiers where user_id = $1', [B])).length > 0);
  assert.equal((await q('select id from public.profiles where id = $1', [A])).length, 1);
  assert.ok((await q('select * from public.admin_user_emails()')).length > 0);
  assert.ok((await q('select * from public.admin_list_entitlements()')).length > 0);
});
await test('utilisateur non admin : aucune fonction admin, aucune donnée de tiers — même en aal2', async () => {
  for (const aal of ['aal1', 'aal2']) {
    await asUser(B, aal);
    assert.equal((await q('select id from public.dossiers where user_id = $1', [A])).length, 0);
    assert.equal((await q('select id from public.profiles where id = $1', [A])).length, 0);
    assert.equal((await q('select * from public.admin_user_emails()')).length, 0);
    assert.equal((await q('select id from public.admin_notifications')).length, 0);
    assert.equal((await q('select id from public.admin_notes')).length, 0);
    assert.equal((await q('select id from public.audit_logs')).length, 0);
    await rejects(q('select * from public.admin_list_entitlements()'), /FORBIDDEN/);
    for (const probe of ['is_admin', 'is_super_admin', 'admin_aal2', 'super_admin_aal2', 'admin_delete_enabled']) {
      assert.equal((await q(`select public.${probe}() as ok`))[0].ok, false, `${probe}() faux pour un client (${aal})`);
    }
  }
});
await test('app_admins : ni lisible ni modifiable par un utilisateur (pas d\'auto-promotion)', async () => {
  await asUser(B, 'aal2');
  await rejects(q('select user_id from public.app_admins'), /permission denied/);
  await rejects(q(`insert into public.app_admins (user_id, role) values ($1, 'support')`, [B]), /permission denied/);
  await asSuperuser();
  assert.equal((await q('select user_id from public.app_admins where user_id = $1', [B])).length, 0);
});
await test('client : modification d\'un dossier de tiers sans effet (aal1 et aal2) ; admin en session normale : acceptée', async () => {
  await asSuperuser();
  const [before] = await q('select status from public.dossiers where id = $1', [dossierA]);
  for (const aal of ['aal1', 'aal2']) {
    await asUser(B, aal);
    await q(`update public.dossiers set status = 'archive', title = 'piraté' where id = $1`, [dossierA]);
    await asSuperuser();
    const [after] = await q('select status, title from public.dossiers where id = $1', [dossierA]);
    assert.equal(after.status, before.status);
    assert.notEqual(after.title, 'piraté');
  }
  await asUser(ADMIN, 'aal1');
  const rows = await q('update public.dossiers set current_step = 4 where id = $1 returning current_step', [dossierA]);
  assert.equal(rows[0].current_step, 4);
});
await test('corbeille dossier : un tiers non super admin ne peut rien, le super admin (sans MFA) peut tout', async () => {
  const cible = await insertDossier(B, { title: 'corbeille-exclusive' });
  // Un autre client ne peut pas mettre le dossier de B à la corbeille.
  await asUser(A);
  await q(`update public.dossiers set deleted_at = now() where id = $1`, [cible]);
  await asSuperuser();
  assert.equal((await q('select deleted_at from public.dossiers where id = $1', [cible]))[0].deleted_at, null);
  // Super admin, session normale : mise à la corbeille puis restauration.
  await asUser(ADMIN, 'aal1');
  await q(`update public.dossiers set deleted_at = now(), deleted_by = $2, delete_reason = 'test' where id = $1`, [cible, ADMIN]);
  await asSuperuser();
  assert.notEqual((await q('select deleted_at from public.dossiers where id = $1', [cible]))[0].deleted_at, null);
  await asUser(ADMIN, 'aal1');
  await q(`update public.dossiers set deleted_at = null, deleted_by = null, delete_reason = null where id = $1`, [cible]);
  await asSuperuser();
  assert.equal((await q('select deleted_at from public.dossiers where id = $1', [cible]))[0].deleted_at, null);
});
await test('restauration : aucune nouvelle notification, aucune consommation supplémentaire', async () => {
  const cible = await insertDossier(B, { title: 'restauration-neutre' });
  await asSuperuser();
  const notifsAvant = (await q('select id from public.admin_notifications where dossier_id = $1', [cible])).length;
  const consoAvant = (await q('select id from public.dossier_submissions where dossier_id = $1', [cible])).length;
  await asUser(ADMIN, 'aal1');
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
// dossier de B et pour un admin « support » (quel que soit le niveau de
// session) ; acceptation pour le seul super admin, en session normale sans MFA
// (20260920120000), avec audit écrit par la base (20260918120000) ; rien
// d'autre n'est touché.
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
// statut = false : pour un admin « support », traiter un dossier (statut) est
// un droit existant de la console — seul le reste doit rester sans effet.
async function tentatives13(actor, aal, { statut = true } = {}) {
  await asUser(actor, aal);
  await q('delete from public.dossiers where id = $1', [cible13]);
  if (statut) await q(`update public.dossiers set status = 'archive' where id = $1`, [cible13]);
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
  assert.equal((await q('select public.admin_delete_enabled() as ok'))[0].ok, false);
});
await test('admin « support » (non super) : corbeille, suppression, propriétaire, Storage refusés — aal1 comme aal2', async () => {
  const avant = await compteurs13();
  // Le support traite les dossiers (statut : droit existant de la console,
  // hors suppression) mais ne peut NI les mettre à la corbeille, NI les
  // supprimer, NI en changer le propriétaire, NI effacer un fichier.
  for (const aal of ['aal1', 'aal2']) {
    await tentatives13(SUPPORT, aal, { statut: false });
    intact13(await etat13());
    assert.deepEqual(await compteurs13(), avant);
    await asUser(SUPPORT, aal);
    assert.equal((await q('select public.super_admin_aal2() as ok'))[0].ok, false);
    assert.equal((await q('select public.admin_delete_enabled() as ok'))[0].ok, false);
    await rejects(q(`select public.admin_set_dossier_override($1, 'unlimited', null, 'x', null)`, [B]), /FORBIDDEN/);
    await rejects(q('select * from public.admin_list_entitlements()'), /FORBIDDEN/);
  }
});
await test('admin « support » : lit les dossiers des clients (rôle admin), sans MFA', async () => {
  await asUser(SUPPORT, 'aal1');
  assert.ok((await q('select id from public.dossiers where user_id = $1', [B])).length > 0);
  assert.ok((await q('select * from public.admin_user_emails()')).length > 0);
});
await test('super admin en session normale (sans MFA) : sondes vraies, dossier de tiers lisible', async () => {
  await asUser(ADMIN, 'aal1');
  assert.equal((await q('select public.super_admin_aal2() as ok'))[0].ok, true);
  assert.equal((await q('select public.admin_delete_enabled() as ok'))[0].ok, true);
  assert.equal((await q('select id from public.dossiers where id = $1', [cible13])).length, 1);
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
  // Sonde de capacité utilisée par l'interface : vraie pour le seul super admin.
  await asUser(ADMIN, 'aal1');
  assert.equal((await q('select public.admin_delete_enabled() as ok'))[0].ok, true);
  await asAnon();
  await rejects(q('select public.super_admin_aal2()'), /permission denied/);
  await rejects(q('select public.admin_delete_enabled()'), /permission denied/);
});
await test('journal indisponible : la mise à la corbeille est annulée (pas d\'action sans trace)', async () => {
  const autre = await insertDossier(B, { title: 'Chantier 13 — atomicité' });
  await asSuperuser();
  await db.exec(`alter table public.audit_logs add constraint t13_journal_bloque check (action <> 'dossier_corbeille') not valid;`);
  try {
    await asUser(ADMIN, 'aal1');
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
await test('super admin (sans MFA) : mise à la corbeille acceptée, relue, auditée par la base', async () => {
  const avant = await compteurs13();
  await asUser(ADMIN, 'aal1');
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
await test('super admin : changement de propriétaire toujours ignoré', async () => {
  await asUser(ADMIN, 'aal1');
  await q('update public.dossiers set user_id = $2 where id = $1', [cible13, ADMIN]);
  assert.equal((await etat13()).user_id, B);
});
await test('restauration (console) : auditée par la base, sans notification ni consommation', async () => {
  const avant = await compteurs13();
  await asUser(ADMIN, 'aal1');
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
  await asUser(ADMIN, 'aal1');
  await q(`update public.audit_logs set action = 'effacé' where resource_id = $1`, [cible13]);
  await q('delete from public.audit_logs where resource_id = $1', [cible13]);
  await asSuperuser();
  const actions = (await q('select action from public.audit_logs where resource_id = $1 order by created_at', [cible13])).map((r) => r.action);
  assert.deepEqual(actions, ['dossier_corbeille', 'dossier_restaure']);
});
await test('Storage : effacement d\'un fichier réservé au super admin (chemin de suppression définitive, inchangé)', async () => {
  await asUser(ADMIN, 'aal1');
  await q(`delete from storage.objects where bucket_id = 'documents' and name = $1`, [`${B}/purge/ancien.pdf`]);
  await asSuperuser();
  assert.equal((await q('select id from storage.objects where name = $1', [`${B}/purge/ancien.pdf`])).length, 0);
  assert.equal((await q('select id from storage.objects where name = $1', [`${B}/${cible13}/piece.pdf`])).length, 1, 'la corbeille n\'a jamais touché aux fichiers');
});

// ── Corbeille client (migration 20260919120000) ─────────────────────────────
const C = await newUser('c@test.fr');
const etatC = async (id) => {
  await asSuperuser();
  return (await q('select user_id, deleted_at, deleted_by, delete_reason from public.dossiers where id = $1', [id]))[0];
};
await test('client : met SON dossier à la corbeille — date et auteur imposés par la base', async () => {
  const cible = await insertDossier(C, { title: 'corbeille-client' });
  await asUser(C);
  await q(`update public.dossiers set deleted_at = '2000-01-01', deleted_by = $2, delete_reason = $3, user_id = $2 where id = $1`, [cible, A, 'x'.repeat(400)]);
  const d = await etatC(cible);
  assert.notEqual(d.deleted_at, null);
  assert.ok(new Date(d.deleted_at).getFullYear() >= 2026, 'date forcée à now()');
  assert.equal(d.deleted_by, C, 'auteur forcé au propriétaire');
  assert.equal(d.user_id, C, 'propriétaire inchangé');
  assert.equal(d.delete_reason.length, 300);
});
await test('client : restaure ce qu\'il a supprimé, sans consommation ni notification, audit « client »', async () => {
  const cible = await insertDossier(C, { title: 'corbeille-client-restauree' });
  await asSuperuser();
  const notifs = (await q('select id from public.admin_notifications where dossier_id = $1', [cible])).length;
  const conso = (await q('select id from public.dossier_submissions where dossier_id = $1', [cible])).length;
  await asUser(C);
  await q('update public.dossiers set deleted_at = now() where id = $1', [cible]);
  await q('update public.dossiers set deleted_at = null where id = $1', [cible]);
  const d = await etatC(cible);
  assert.equal(d.deleted_at, null);
  assert.equal(d.deleted_by, null);
  assert.equal((await q('select id from public.admin_notifications where dossier_id = $1', [cible])).length, notifs);
  assert.equal((await q('select id from public.dossier_submissions where dossier_id = $1', [cible])).length, conso, 'aucun recrédit, aucune double consommation');
  const logs = await q(`select action, actor_role from public.audit_logs where resource_id = $1 order by created_at`, [cible]);
  assert.deepEqual(logs.map((l) => `${l.action}:${l.actor_role}`), ['dossier_corbeille:client', 'dossier_restaure:client']);
});
await test('client A : ni corbeille ni restauration sur le dossier de C (IDOR), même en AAL2', async () => {
  const cible = await insertDossier(C, { title: 'idor-corbeille' });
  for (const aal of ['aal1', 'aal2']) {
    await asUser(A, aal);
    await q('update public.dossiers set deleted_at = now(), deleted_by = $2 where id = $1', [cible, A]);
    assert.equal((await etatC(cible)).deleted_at, null);
  }
  await asUser(C);
  await q('update public.dossiers set deleted_at = now() where id = $1', [cible]);
  await asUser(A, 'aal2');
  await q('update public.dossiers set deleted_at = null where id = $1', [cible]);
  assert.notEqual((await etatC(cible)).deleted_at, null, 'A ne restaure pas le dossier de C');
  await asUser(A);
  assert.equal((await q('select id from public.dossiers where id = $1', [cible])).length, 0, 'A ne voit pas la corbeille de C');
});
await test('client : un dossier mis à la corbeille par l\'administration reste sous son contrôle', async () => {
  const cible = await insertDossier(C, { title: 'corbeille-admin' });
  await asUser(ADMIN, 'aal1');
  await q(`update public.dossiers set deleted_at = now(), deleted_by = $2, delete_reason = 'moderation' where id = $1`, [cible, ADMIN]);
  await asUser(C);
  await q('update public.dossiers set deleted_at = null where id = $1', [cible]);
  const d = await etatC(cible);
  assert.notEqual(d.deleted_at, null);
  assert.equal(d.deleted_by, ADMIN);
  await asUser(C);
  assert.equal((await q('select id from public.dossiers where id = $1 and deleted_at is not null', [cible])).length, 1, 'visible dans SA corbeille');
});
await test('sonde client_trash_enabled : authentifié oui, anonyme refusé', async () => {
  await asUser(A);
  assert.equal((await q('select public.client_trash_enabled() as ok'))[0].ok, true);
  await asAnon();
  await rejects(q('select public.client_trash_enabled()'), /permission denied/);
});

// ── Matrice de suppression (mission 2026-09-20) ─────────────────────────────
// Mêmes requêtes que l'interface : corbeille = UPDATE de deleted_at relu ;
// suppression définitive = DELETE relu. Toutes les sessions sont en aal1.
console.log('Matrice de suppression admin / client A / client B (20260920120000)');
// Comptes dédiés : la garde anti-abus (RATE_LIMITED) plafonne à 10 validations
// par compte sur 10 minutes, déjà consommées par A et B plus haut.
const MA = await newUser('matrice-a@test.fr');
const MB = await newUser('matrice-b@test.fr');
const corbeille = (id, actor) =>
  q(`update public.dossiers set deleted_at = now(), deleted_by = $2, delete_reason = 'test' where id = $1 returning id, deleted_at`, [id, actor]);
await test('client A et client B : chacun supprime SON dossier ; le dossier de l\'autre est refusé (0 ligne)', async () => {
  const deA = await insertDossier(MA, { title: 'matrice — dossier de A' });
  const deB = await insertDossier(MB, { title: 'matrice — dossier de B' });
  for (const [acteur, sien, autre] of [[MA, deA, deB], [MB, deB, deA]]) {
    await asUser(acteur);
    assert.equal((await corbeille(autre, acteur)).length, 0, 'corbeille du dossier d\'un tiers : 0 ligne');
    assert.equal((await q('delete from public.dossiers where id = $1 returning id', [autre])).length, 0, 'DELETE forgé sur un tiers : 0 ligne');
    const rows = await corbeille(sien, acteur);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].deleted_at, null, 'son propre dossier part à la corbeille');
  }
  await asSuperuser();
  for (const [id, proprietaire] of [[deA, MA], [deB, MB]]) {
    const [d] = await q('select user_id, deleted_by from public.dossiers where id = $1', [id]);
    assert.equal(d.user_id, proprietaire);
    assert.equal(d.deleted_by, proprietaire, 'auteur imposé par la base');
  }
});
await test('owner_id forgé : un client ne s\'approprie pas le dossier d\'un tiers pour le supprimer', async () => {
  const deB = await insertDossier(MB, { title: 'matrice — appropriation' });
  await asUser(MA);
  await q('update public.dossiers set user_id = $2, deleted_at = now() where id = $1', [deB, MA]);
  await asSuperuser();
  const [d] = await q('select user_id, deleted_at from public.dossiers where id = $1', [deB]);
  assert.equal(d.user_id, MB);
  assert.equal(d.deleted_at, null);
});
await test('anonyme : ni corbeille ni suppression', async () => {
  const deA = await insertDossier(MA, { title: 'matrice — anonyme' });
  await asAnon();
  await rejects(q('update public.dossiers set deleted_at = now() where id = $1', [deA]), /permission denied|row-level security/);
  await rejects(q('delete from public.dossiers where id = $1', [deA]), /permission denied|row-level security/);
  await asSuperuser();
  assert.equal((await q('select deleted_at from public.dossiers where id = $1', [deA]))[0].deleted_at, null);
});
await test('admin (sans MFA) : met à la corbeille le dossier de A puis celui de B, et les restaure', async () => {
  const deA = await insertDossier(MA, { title: 'matrice — admin sur A' });
  const deB = await insertDossier(MB, { title: 'matrice — admin sur B' });
  await asUser(ADMIN, 'aal1');
  for (const id of [deA, deB]) {
    const rows = await corbeille(id, ADMIN);
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].deleted_at, null);
  }
  const restaures = await q('update public.dossiers set deleted_at = null, deleted_by = null, delete_reason = null where id = any($1) returning deleted_at', [[deA, deB]]);
  assert.deepEqual(restaures.map((r) => r.deleted_at), [null, null]);
  await asSuperuser();
  const logs = await q(`select action from public.audit_logs where resource_id = any($1) order by created_at`, [[deA, deB]]);
  assert.equal(logs.filter((l) => l.action === 'dossier_corbeille').length, 2, 'chaque mise à la corbeille est auditée');
  assert.equal(logs.filter((l) => l.action === 'dossier_restaure').length, 2);
});
await test('admin (sans MFA) : suppression définitive des dossiers de A et de B — cascades, aucun orphelin, quota conservé', async () => {
  const cibles = [];
  for (const proprietaire of [MA, MB]) {
    const id = await insertDossier(proprietaire, { title: 'matrice — suppression définitive' });
    await asUser(proprietaire);
    await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name) values ($1, $2, $3, 'piece.pdf')`, [id, proprietaire, `${proprietaire}/${id}/piece.pdf`]);
    await q(`insert into public.dossier_deadlines (dossier_id, user_id, title, due_date) values ($1, $2, 'Relance', current_date + 7)`, [id, proprietaire]);
    await q(`insert into public.dossier_events (dossier_id, user_id, type, label) values ($1, $2, 'note', 'Événement')`, [id, proprietaire]);
    await asUser(ADMIN, 'aal1');
    await q(`insert into public.admin_notes (target_user_id, dossier_id, author_id, body) values ($1, $2, $3, 'note interne')`, [proprietaire, id, ADMIN]);
    cibles.push(id);
  }
  await asSuperuser();
  const consoAvant = (await q('select id from public.dossier_submissions where user_id = any($1)', [[MA, MB]])).length;
  await asUser(ADMIN, 'aal1');
  for (const id of cibles) {
    assert.equal((await q('delete from public.dossiers where id = $1 returning id', [id])).length, 1);
  }
  await asSuperuser();
  for (const table of ['dossier_documents', 'dossier_deadlines', 'dossier_events', 'admin_notes']) {
    assert.equal((await q(`select id from public.${table} where dossier_id = any($1)`, [cibles])).length, 0, `${table} : aucune ligne orpheline`);
  }
  assert.equal((await q('select id from public.dossier_submissions where user_id = any($1)', [[MA, MB]])).length, consoAvant, 'registre de quota conservé (aucun recrédit)');
  assert.equal((await q('select id from public.dossier_submissions where dossier_id = any($1)', [cibles])).length, 0, 'registre détaché du dossier supprimé');
});

console.log('Lien court /v — clics agrégés');
await test('anon incrémente via la RPC seulement ; seul l’admin lit', async () => {
  await asAnon();
  await q(`select public.record_campaign_click('village-justice')`);
  await q(`select public.record_campaign_click('village-justice')`);
  await q(`select public.record_campaign_click('inconnue')`);
  await rejects(q('select * from public.campaign_clicks'), /permission denied/);
  await rejects(q(`insert into public.campaign_clicks (source, day, clicks) values ('village-justice', current_date, 999)`), /permission denied/);
  const A = await newUser('lecteur.clics@exemple.fr');
  await asUser(A);
  assert.equal((await q('select * from public.campaign_clicks')).length, 0, 'non-admin : aucune ligne');
  await rejects(q(`update public.campaign_clicks set clicks = 0`), /permission denied/);
  await asUser(ADMIN);
  const rows = await q('select source, clicks from public.campaign_clicks');
  assert.deepEqual(rows, [{ source: 'village-justice', clicks: 2 }], 'une ligne/jour, source inconnue ignorée');
  await asSuperuser();
  await q(`update public.campaign_clicks set clicks = 5000`);
  await asAnon();
  await q(`select public.record_campaign_click('village-justice')`);
  await asSuperuser();
  assert.equal((await q('select clicks from public.campaign_clicks'))[0].clicks, 5000, 'plafond journalier');
});

// ── Moteur documentaire IA (20261023120000) ──────────────────────────────────
async function asService() {
  await db.exec(`set role service_role; set request.jwt.claims = '{"role":"service_role"}';`);
}
const IA_A = await newUser('ia-a@test.local');
const IA_B = await newUser('ia-b@test.local');
const IA_DOSSIER_A = await insertDossier(IA_A, { title: 'Dossier IA A' });
const IA_DOSSIER_B = await insertDossier(IA_B, { title: 'Dossier IA B' });

await test('IA : activation refusée sans abonnement, par un tiers, et en anonyme', async () => {
  await asUser(IA_A);
  await rejects(q('select public.enable_ai_processing($1, $2)', [IA_DOSSIER_A, 'ia-2026-10']), /SUBSCRIPTION_REQUIRED/);
  await asAnon();
  await rejects(q('select public.enable_ai_processing($1, $2)', [IA_DOSSIER_A, 'ia-2026-10']), /AUTH_REQUIRED|permission denied/);
  await subscribe(IA_B, 'essentiel');
  await asUser(IA_B);
  await rejects(q('select public.enable_ai_processing($1, $2)', [IA_DOSSIER_A, 'ia-2026-10']), /FORBIDDEN/);
  await asSuperuser();
  assert.equal((await q('select 1 from public.ai_jobs where dossier_id = $1', [IA_DOSSIER_A])).length, 0, 'aucun travail créé');
});

await test('IA : rien n\'est mis en file pour un dossier non activé ; impossible d\'activer en écrivant la table', async () => {
  await asUser(IA_A);
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1, $2, $3, 'piece.pdf', 'piece')`, [IA_DOSSIER_A, IA_A, `${IA_A}/${IA_DOSSIER_A}/piece.pdf`]);
  await rejects(q('insert into public.dossier_ai_settings (dossier_id, user_id, enabled_at) values ($1, $2, now())', [IA_DOSSIER_A, IA_A]), /row-level security|permission denied/);
  await asSuperuser();
  assert.equal((await q('select 1 from public.ai_jobs where dossier_id = $1', [IA_DOSSIER_A])).length, 0);
});

await test('IA : activation par le titulaire abonné → trace, pièces existantes en file, consolidation temporisée unique', async () => {
  await subscribe(IA_A, 'essentiel');
  await asUser(IA_A);
  await q('select public.enable_ai_processing($1, $2)', [IA_DOSSIER_A, 'ia-2026-10']);
  const [s] = await q('select enabled_at, enabled_by, terms_version from public.dossier_ai_settings where dossier_id = $1', [IA_DOSSIER_A]);
  assert.ok(s.enabled_at);
  assert.equal(s.enabled_by, IA_A);
  assert.equal(s.terms_version, 'ia-2026-10');
  assert.equal((await q(`select 1 from public.dossier_events where dossier_id = $1 and type = 'ia_activee'`, [IA_DOSSIER_A])).length, 1);
  // Deuxième pièce : extraction propre + la MÊME consolidation (repoussée), jamais deux.
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1, $2, $3, 'piece2.pdf', 'piece')`, [IA_DOSSIER_A, IA_A, `${IA_A}/${IA_DOSSIER_A}/piece2.pdf`]);
  // Un livrable déposé par l'admin n'entraîne aucune extraction.
  await asSuperuser();
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1, $2, $3, 'livrable.pdf', 'deliverable')`, [IA_DOSSIER_A, IA_A, `${IA_A}/${IA_DOSSIER_A}/deliverable-x.pdf`]);
  const jobs = await q(`select kind, status, run_after > now() as differe from public.ai_jobs where dossier_id = $1 order by kind`, [IA_DOSSIER_A]);
  assert.deepEqual(jobs.map((j) => j.kind), ['consolidate', 'extract', 'extract']);
  assert.equal(jobs[0].differe, true, 'consolidation temporisée');
  // Isolation : B ne voit ni les réglages ni les travaux de A.
  await asUser(IA_B);
  assert.equal((await q('select 1 from public.dossier_ai_settings where dossier_id = $1', [IA_DOSSIER_A])).length, 0);
  assert.equal((await q('select 1 from public.ai_jobs where dossier_id = $1', [IA_DOSSIER_A])).length, 0);
  await asUser(IA_A);
  assert.equal((await q('select 1 from public.ai_jobs where dossier_id = $1', [IA_DOSSIER_A])).length, 3);
});

await test('IA : réclamation réservée au service role ; bail, tentatives bornées, backoff, requeue des baux expirés', async () => {
  await asUser(IA_A);
  await rejects(q(`select * from public.ai_claim_jobs('w', 5)`), /FORBIDDEN|permission denied/);
  await asAnon();
  await rejects(q(`select * from public.ai_claim_jobs('w', 5)`), /FORBIDDEN|permission denied/);
  await asService();
  const claimed = await q(`select id, kind, status, attempts, locked_by from public.ai_claim_jobs('w1', 5)`);
  assert.deepEqual(claimed.map((j) => j.kind), ['extract', 'extract'], 'la consolidation temporisée n\'est pas encore réclamable');
  assert.ok(claimed.every((j) => j.status === 'running' && j.attempts === 1 && j.locked_by === 'w1'));
  assert.equal((await q(`select id from public.ai_claim_jobs('w2', 5)`)).length, 0, 'un travail réclamé ne l\'est pas deux fois');
  const [j1, j2] = claimed;
  await q('select public.ai_finish_job($1, true)', [j1.id]);
  await q('select public.ai_finish_job($1, false, $2)', [j2.id, 'panne fournisseur']);
  let rows = await q('select id, status, attempts, last_error, run_after > now() as differe from public.ai_jobs where id = any($1) order by status', [[j1.id, j2.id]]);
  assert.deepEqual(rows.map((r) => [r.status, r.attempts]), [['done', 1], ['queued', 1]]);
  assert.equal(rows[1].last_error, 'panne fournisseur');
  assert.equal(rows[1].differe, true, 'backoff');
  // Bail expiré : le travail retourne en file au prochain passage.
  await q(`update public.ai_jobs set run_after = now() - interval '1 minute' where id = $1`, [j2.id]);
  await q(`select id from public.ai_claim_jobs('w3', 5)`);
  await q(`update public.ai_jobs set lease_until = now() - interval '1 minute' where id = $1`, [j2.id]);
  const again = await q(`select id, attempts from public.ai_claim_jobs('w4', 5)`);
  assert.deepEqual(again.map((r) => [r.id, r.attempts]), [[j2.id, 3]]);
  await q('select public.ai_finish_job($1, false, $2)', [j2.id, 'troisième échec']);
  rows = await q('select status, finished_at is not null as fini from public.ai_jobs where id = $1', [j2.id]);
  assert.deepEqual(rows, [{ status: 'failed', fini: true }], 'max_attempts atteint');
});

await test('IA : extractions et analyses écrites par le service, lues par le seul titulaire ; coût mensuel', async () => {
  await asSuperuser();
  const [doc] = await q(`select id from public.dossier_documents where dossier_id = $1 and kind = 'piece' limit 1`, [IA_DOSSIER_A]);
  await asService();
  await q(`insert into public.ai_extractions (dossier_id, user_id, document_id, status, model, data, cost_cents) values ($1, $2, $3, 'ok', 'claude-opus-5-5', '{"summary":"x"}', 12.5)`, [IA_DOSSIER_A, IA_A, doc.id]);
  await q(`insert into public.ai_analyses (dossier_id, user_id, revision, data, cost_cents) values ($1, $2, 1, '{"summary_short":"y"}', 7.5)`, [IA_DOSSIER_A, IA_A]);
  assert.equal(Number((await q('select public.ai_month_cost_cents($1) as c', [IA_A]))[0].c), 20);
  // Console privée (20261102) : une analyse non publiée n'existe pas pour le titulaire.
  await asUser(IA_A);
  assert.equal((await q('select 1 from public.ai_analyses where dossier_id = $1', [IA_DOSSIER_A])).length, 0, 'analyse en attente invisible du titulaire');
  await asService();
  await q(`update public.ai_analyses set review_status = 'published', published_at = now() where dossier_id = $1 and revision = 1`, [IA_DOSSIER_A]);
  await asUser(IA_A);
  assert.equal((await q('select 1 from public.ai_analyses where dossier_id = $1', [IA_DOSSIER_A])).length, 1, 'analyse publiée visible');
  await rejects(q(`insert into public.ai_analyses (dossier_id, user_id, revision, data) values ($1, $2, 2, '{}')`, [IA_DOSSIER_A, IA_A]), /row-level security|permission denied/);
  await rejects(q('select public.ai_month_cost_cents($1)', [IA_A]), /permission denied/);
  await asUser(IA_B);
  assert.equal((await q('select 1 from public.ai_analyses where dossier_id = $1', [IA_DOSSIER_A])).length, 0);
  assert.equal((await q('select 1 from public.ai_extractions where dossier_id = $1', [IA_DOSSIER_A])).length, 0);
});

await test('IA : échéances — l\'upsert du worker respecte les corrections humaines', async () => {
  await asService();
  await q(`insert into public.dossier_deadlines (dossier_id, user_id, title, due_date, ai_key) values ($1, $2, 'Réponse', '2026-11-03', '2026-11-03:reponse')`, [IA_DOSSIER_A, IA_A]);
  await q(`insert into public.dossier_deadlines (dossier_id, user_id, title, due_date, ai_key) values ($1, $2, 'Audience', '2026-12-01', '2026-12-01:audience')`, [IA_DOSSIER_A, IA_A]);
  // Échéance manuelle (sans clé) : jamais en conflit.
  await asUser(IA_A);
  await q(`insert into public.dossier_deadlines (dossier_id, user_id, title, due_date) values ($1, $2, 'Perso', '2026-11-20')`, [IA_DOSSIER_A, IA_A]);
  await q(`update public.dossier_deadlines set due_date = '2026-11-05' where dossier_id = $1 and ai_key = '2026-11-03:reponse'`, [IA_DOSSIER_A]);
  await asService();
  const edited = await q(`select ai_key, user_edited from public.dossier_deadlines where dossier_id = $1 and ai_key is not null order by ai_key`, [IA_DOSSIER_A]);
  assert.deepEqual(edited, [{ ai_key: '2026-11-03:reponse', user_edited: true }, { ai_key: '2026-12-01:audience', user_edited: false }]);
  // Réanalyse : le worker ne touche pas la ligne corrigée, met à jour l'autre.
  const frozen = (await q(`select ai_key from public.dossier_deadlines where dossier_id = $1 and user_edited`, [IA_DOSSIER_A])).map((r) => r.ai_key);
  const rows = [['2026-11-03:reponse', 'Réponse (v2)', '2026-11-03'], ['2026-12-01:audience', 'Audience (v2)', '2026-12-01']].filter((r) => !frozen.includes(r[0]));
  for (const [key, title, date] of rows) {
    await q(`insert into public.dossier_deadlines (dossier_id, user_id, ai_key, title, due_date) values ($1, $2, $3, $4, $5)
             on conflict (dossier_id, ai_key) do update set title = excluded.title, due_date = excluded.due_date`, [IA_DOSSIER_A, IA_A, key, title, date]);
  }
  const after = await q(`select title, due_date::text as d from public.dossier_deadlines where dossier_id = $1 and ai_key is not null order by ai_key`, [IA_DOSSIER_A]);
  assert.deepEqual(after, [{ title: 'Réponse', d: '2026-11-05' }, { title: 'Audience (v2)', d: '2026-12-01' }]);
});

await test('IA : désactivation → travaux annulés, plus aucune mise en file', async () => {
  await asUser(IA_A);
  await q('select public.disable_ai_processing($1)', [IA_DOSSIER_A]);
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1, $2, $3, 'piece3.pdf', 'piece')`, [IA_DOSSIER_A, IA_A, `${IA_A}/${IA_DOSSIER_A}/piece3.pdf`]);
  await asSuperuser();
  const open = await q(`select 1 from public.ai_jobs where dossier_id = $1 and status in ('queued','running')`, [IA_DOSSIER_A]);
  assert.equal(open.length, 0);
  assert.equal((await q('select enabled_at from public.dossier_ai_settings where dossier_id = $1', [IA_DOSSIER_A]))[0].enabled_at, null);
  assert.equal((await q(`select 1 from public.dossier_events where dossier_id = $1 and type = 'ia_desactivee'`, [IA_DOSSIER_A])).length, 1);
  // Le dossier B, jamais activé, n'a rien.
  assert.equal((await q('select 1 from public.ai_jobs where dossier_id = $1', [IA_DOSSIER_B])).length, 0);
});

// ── Moteur IA : corrections, clôture, notifications, volume ─────────────────
const IA_C = await newUser('ia-c@test.local');
await subscribe(IA_C, 'essentiel');
const IA_DOSSIER_C = await insertDossier(IA_C, { title: 'Dossier IA C' });
async function addPiece(userId, dossierId, name) {
  await asUser(userId);
  const [r] = await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1, $2, $3, $4, 'piece') returning id`, [dossierId, userId, `${userId}/${dossierId}/${name}`, name]);
  return r.id;
}
const openJobs = async (dossierId, kind) => {
  await asSuperuser();
  return (await q(`select id from public.ai_jobs where dossier_id = $1 and kind = $2 and status in ('queued','running')`, [dossierId, kind])).length;
};

await test('IA : bail expiré au-delà du maximum de tentatives → échec définitif (jamais de boucle infinie)', async () => {
  await addPiece(IA_C, IA_DOSSIER_C, 'c1.pdf');
  await asUser(IA_C);
  await q('select public.enable_ai_processing($1, $2)', [IA_DOSSIER_C, 'ia-2026-10']);
  await asSuperuser();
  const [j] = await q(`select id from public.ai_jobs where dossier_id = $1 and kind = 'extract'`, [IA_DOSSIER_C]);
  await q(`update public.ai_jobs set status = 'running', attempts = 3, lease_until = now() - interval '1 minute' where id = $1`, [j.id]);
  await asService();
  const claimed = await q(`select id from public.ai_claim_jobs('w', 5)`);
  assert.ok(!claimed.some((c) => c.id === j.id), 'non réclamé à nouveau');
  await asSuperuser();
  const [row] = await q('select status, last_error from public.ai_jobs where id = $1', [j.id]);
  assert.equal(row.status, 'failed');
  assert.match(row.last_error, /interrompu/);
});

await test('IA : corrections de chronologie — append-only, auteur imposé, isolation, rendu sans appel IA', async () => {
  await asUser(IA_C);
  await q(`insert into public.ai_event_overrides (dossier_id, user_id, event_key, retained_date, reason, created_by, author_role) values ($1, $2, '2026-09-20:relance', '2026-09-22', 'cachet de la poste', $3, 'equipe')`, [IA_DOSSIER_C, IA_C, ADMIN]);
  await rejects(q(`insert into public.ai_event_overrides (dossier_id, user_id, event_key, reason) values ($1, $2, 'k', 'x')`, [IA_DOSSIER_C, IA_C]), /check/);
  await rejects(q(`insert into public.ai_event_overrides (dossier_id, user_id, event_key, retained_date, reason) values ($1, $2, 'k', 'demain', 'motif ok')`, [IA_DOSSIER_C, IA_C]), /check/);
  const [o] = await q('select created_by, author_role from public.ai_event_overrides where dossier_id = $1', [IA_DOSSIER_C]);
  assert.deepEqual(o, { created_by: IA_C, author_role: 'titulaire' }, 'auteur et rôle imposés par la base');
  assert.equal((await q(`update public.ai_event_overrides set reason = 'réécrit' where dossier_id = $1 returning id`, [IA_DOSSIER_C])).length, 0, 'aucune réécriture');
  assert.equal((await q('delete from public.ai_event_overrides where dossier_id = $1 returning id', [IA_DOSSIER_C])).length, 0, 'aucune suppression');
  assert.equal(await openJobs(IA_DOSSIER_C, 'render'), 1, 'rendu temporisé mis en file');
  // Tiers : ni lecture ni écriture ; owner_id forgé refusé.
  await asUser(IA_B);
  assert.equal((await q('select 1 from public.ai_event_overrides where dossier_id = $1', [IA_DOSSIER_C])).length, 0);
  await rejects(q(`insert into public.ai_event_overrides (dossier_id, user_id, event_key, reason) values ($1, $2, 'k', 'motif tiers')`, [IA_DOSSIER_C, IA_C]), /row-level security/);
  await rejects(q(`insert into public.ai_event_overrides (dossier_id, user_id, event_key, reason) values ($1, $2, 'k', 'motif forgé')`, [IA_DOSSIER_C, IA_B]), /row-level security/);
  // Administration : correction tracée comme « équipe ».
  await asUser(ADMIN);
  await q(`insert into public.ai_event_overrides (dossier_id, user_id, event_key, hidden, reason) values ($1, $2, '2026-09-20:relance', true, 'doublon de pièce')`, [IA_DOSSIER_C, IA_C]);
  await asSuperuser();
  assert.deepEqual((await q('select author_role from public.ai_event_overrides where dossier_id = $1 order by created_at', [IA_DOSSIER_C])).map((r) => r.author_role), ['titulaire', 'equipe']);
});

await test('IA : clôture (titulaire ou admin) → travaux annulés et plus rien en file ; réouverture → reprise des seules pièces non lues', async () => {
  await asService();
  const [p1] = await q(`select id from public.dossier_documents where dossier_id = $1 and kind = 'piece'`, [IA_DOSSIER_C]);
  await q(`insert into public.ai_extractions (dossier_id, user_id, document_id, status) values ($1, $2, $3, 'ok') on conflict (document_id) do nothing`, [IA_DOSSIER_C, IA_C, p1.id]);
  await asUser(IA_B);
  await rejects(q(`insert into public.dossier_events (dossier_id, user_id, type, label) values ($1, $2, 'dossier_cloture', 'x')`, [IA_DOSSIER_C, IA_C]), /row-level security/);
  await asUser(IA_C);
  await q(`insert into public.dossier_events (dossier_id, user_id, type, label) values ($1, $2, 'dossier_cloture', 'Dossier clôturé')`, [IA_DOSSIER_C, IA_C]);
  assert.equal(await openJobs(IA_DOSSIER_C, 'render'), 0, 'travaux en attente annulés');
  await addPiece(IA_C, IA_DOSSIER_C, 'c2.pdf');
  assert.equal(await openJobs(IA_DOSSIER_C, 'extract'), 0, 'rien en file pour un dossier clôturé');
  await asUser(IA_C);
  await rejects(q('select public.enable_ai_processing($1, $2)', [IA_DOSSIER_C, 'ia-2026-10']), /DOSSIER_CLOTURE/);
  await rejects(q('select public.dossier_is_closed($1)', [IA_DOSSIER_C]), /permission denied/);
  // Réouverture par l'administration : seule la pièce jamais lue est reprise.
  await new Promise((r) => setTimeout(r, 5));
  await asUser(ADMIN);
  await q(`insert into public.dossier_events (dossier_id, user_id, type, label) values ($1, $2, 'dossier_rouvert', 'Dossier rouvert')`, [IA_DOSSIER_C, IA_C]);
  await asSuperuser();
  const ex = await q(`select d.file_name from public.ai_jobs j join public.dossier_documents d on d.id = j.document_id where j.dossier_id = $1 and j.kind = 'extract' and j.status = 'queued'`, [IA_DOSSIER_C]);
  assert.deepEqual(ex.map((r) => r.file_name), ['c2.pdf']);
  assert.equal(await openJobs(IA_DOSSIER_C, 'consolidate'), 1);
});

await test('IA : registre des notifications — un seul e-mail par dossier et révision ; lecture par le seul titulaire', async () => {
  await asService();
  await q(`insert into public.ai_notifications (dossier_id, user_id, kind, revision) values ($1, $2, 'client_livrables_disponibles', 1)`, [IA_DOSSIER_C, IA_C]);
  await rejects(q(`insert into public.ai_notifications (dossier_id, user_id, kind, revision) values ($1, $2, 'client_livrables_disponibles', 1)`, [IA_DOSSIER_C, IA_C]), /duplicate key/);
  await rejects(q(`insert into public.ai_notifications (dossier_id, user_id, kind, revision) values ($1, $2, 'mise_en_demeure_tiers', 2)`, [IA_DOSSIER_C, IA_C]), /check/);
  await asUser(IA_C);
  assert.equal((await q('select 1 from public.ai_notifications where dossier_id = $1', [IA_DOSSIER_C])).length, 1);
  await rejects(q(`insert into public.ai_notifications (dossier_id, user_id, kind, revision) values ($1, $2, 'client_livrables_disponibles', 9)`, [IA_DOSSIER_C, IA_C]), /row-level security/);
  await asUser(IA_B);
  assert.equal((await q('select 1 from public.ai_notifications where dossier_id = $1', [IA_DOSSIER_C])).length, 0);
});

await test('IA : dossier de 190 pièces → 190 extractions + 1 consolidation, réclamation par lots sans doublon', async () => {
  const D = await insertDossier(IA_C, { title: 'Dossier volumineux' });
  await asUser(IA_C);
  await q('select public.enable_ai_processing($1, $2)', [D, 'ia-2026-10']);
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind)
           select $1::uuid, $2::uuid, $2::text || '/' || $1::text || '/p' || g || '.pdf', 'p' || g || '.pdf', 'piece' from generate_series(1, 190) g`, [D, IA_C]);
  assert.equal(await openJobs(D, 'extract'), 190);
  assert.equal(await openJobs(D, 'consolidate'), 1, 'une seule consolidation, temporisée');
  await asUser(IA_C);
  await q('select public.enable_ai_processing($1, $2)', [D, 'ia-2026-10']);
  assert.equal(await openJobs(D, 'extract'), 190, 'réactivation : aucun doublon');
  await asService();
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    for (const r of await q(`select id from public.ai_claim_jobs('lot', 20)`)) {
      assert.ok(!seen.has(r.id), 'jamais réclamé deux fois');
      seen.add(r.id);
    }
  }
  assert.ok(seen.size >= 190, `${seen.size} travaux réclamés`);
});



// ── Console IA privée (20261102) : relecture, publication contrôlée, RPC admin ──
const PV_A = await newUser('pv-a@test.local');
const PV_B = await newUser('pv-b@test.local');
const PV_ADMIN = await newUser('pv-admin@test.local');
await asSuperuser();
await q(`insert into public.app_admins (user_id, role) values ($1, 'support')`, [PV_ADMIN]);
// Le test « retour arrière niveau 1 » ci-dessus a neutralisé le moteur : on le réarme pour ces tests.
await q('grant execute on function public.enable_ai_processing(uuid, text) to authenticated');
const PV_D = await insertDossier(PV_A, { title: 'Dossier relecture' });
await subscribe(PV_A, 'essentiel');
const pvPiece = await addPiece(PV_A, PV_D, 'contrat.pdf');

await test('Console IA : RPC réservées à l’administration (titulaire, tiers, anonyme refusés)', async () => {
  await asUser(PV_A);
  await rejects(q(`select public.ai_set_review_mode($1, 'auto')`, [PV_D]), /FORBIDDEN/);
  await rejects(q(`select public.ai_approve_revision($1, 1, null)`, [PV_D]), /FORBIDDEN/);
  await rejects(q(`select public.ai_reject_revision($1, 1, 'motif')`, [PV_D]), /FORBIDDEN/);
  assert.equal((await q('select * from public.ai_admin_overview()')).length, 0, 'vue vide pour un non-admin');
  assert.equal((await q('select * from public.ai_admin_month_cost()')).length, 0);
  await asUser(PV_B);
  await rejects(q(`select public.ai_set_review_mode($1, 'auto')`, [PV_D]), /FORBIDDEN/);
  await asAnon();
  await rejects(q(`select public.ai_set_review_mode($1, 'auto')`, [PV_D]), /AUTH_REQUIRED|permission denied/);
});

await test('Console IA : mode de relecture posé par l’admin sans activer le moteur ; manuel par défaut', async () => {
  await asUser(PV_ADMIN);
  await q(`select public.ai_set_review_mode($1, 'auto')`, [PV_D]);
  await rejects(q(`select public.ai_set_review_mode($1, 'n_importe_quoi')`, [PV_D]), /MODE_INVALIDE/);
  await asSuperuser();
  const [s] = await q('select enabled_at, review_mode from public.dossier_ai_settings where dossier_id = $1', [PV_D]);
  assert.equal(s.enabled_at, null, 'le mode ne vaut pas activation');
  assert.equal(s.review_mode, 'auto');
  assert.equal((await q('select 1 from public.ai_jobs where dossier_id = $1', [PV_D])).length, 0, 'aucun travail créé');
  await asUser(PV_ADMIN);
  await q(`select public.ai_set_review_mode($1, 'manual')`, [PV_D]);
  await asUser(PV_A);
  await q('select public.enable_ai_processing($1, $2)', [PV_D, 'ia-2026-10']);
  await asSuperuser();
  const [s2] = await q('select enabled_at, review_mode from public.dossier_ai_settings where dossier_id = $1', [PV_D]);
  assert.ok(s2.enabled_at, 'activation conservée');
  assert.equal(s2.review_mode, 'manual', 'activation ne réinitialise pas le mode');
  assert.equal((await q(`select 1 from public.audit_logs where action = 'ia_mode_relecture' and resource_id = $1::text`, [PV_D])).length, 2, 'journalisé');
});

await test('Console IA : l’admin ne peut activer qu’avec une référence d’accord écrit, conservée et journalisée', async () => {
  const D2 = await insertDossier(PV_B, { title: 'Dossier accord écrit' });
  await asUser(PV_ADMIN);
  await rejects(q('select public.enable_ai_processing($1, $2)', [D2, 'ia-2026-10']), /FORBIDDEN/, 'la RPC titulaire refuse un admin');
  await rejects(q('select public.ai_admin_enable($1, $2, $3)', [D2, 'ia-2026-10', 'ok']), /CONSENTEMENT_REQUIS/);
  await q('select public.ai_admin_enable($1, $2, $3)', [D2, 'ia-2026-10', 'Courriel du titulaire du 2 novembre 2026']);
  await asUser(PV_B);
  await rejects(q('select public.ai_admin_enable($1, $2, $3)', [D2, 'ia-2026-10', 'Courriel du titulaire du 2 novembre 2026']), /FORBIDDEN/);
  await asSuperuser();
  const [s] = await q('select enabled_at, enabled_by, consent_reference from public.dossier_ai_settings where dossier_id = $1', [D2]);
  assert.ok(s.enabled_at);
  assert.equal(s.enabled_by, PV_ADMIN);
  assert.equal(s.consent_reference, 'Courriel du titulaire du 2 novembre 2026');
  assert.equal((await q(`select 1 from public.audit_logs where action = 'ia_activation_admin' and resource_id = $1::text`, [D2])).length, 1);
  assert.equal((await q(`select 1 from public.dossier_events where dossier_id = $1 and type = 'ia_activee'`, [D2])).length, 1);
});

await test('Console IA : livrables en attente invisibles du titulaire (table ET statut), visibles de l’admin', async () => {
  await asService();
  await q(`insert into public.ai_analyses (dossier_id, user_id, revision, data, cost_cents) values ($1, $2, 1, '{"summary_short":"brouillon"}', 3)`, [PV_D, PV_A]);
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind, generated_by, ai_revision, review_status)
           values ($1, $2, $3, 'synthese.pdf', 'deliverable', 'ai', 1, 'pending')`, [PV_D, PV_A, `ai-review/${PV_A}/${PV_D}/deliverable-1-synthese.pdf`]);
  await asUser(PV_A);
  assert.equal((await q(`select 1 from public.dossier_documents where dossier_id = $1 and kind = 'deliverable'`, [PV_D])).length, 0, 'livrable en attente caché');
  assert.equal((await q(`select 1 from public.dossier_documents where id = $1`, [pvPiece])).length, 1, 'les pièces restent visibles');
  assert.equal((await q('select 1 from public.ai_analyses where dossier_id = $1', [PV_D])).length, 0, 'analyse en attente cachée');
  await asUser(PV_ADMIN);
  assert.equal((await q(`select 1 from public.dossier_documents where dossier_id = $1 and kind = 'deliverable'`, [PV_D])).length, 1, 'admin voit le livrable');
  const rows = await q('select * from public.ai_admin_overview() where dossier_id = $1', [PV_D]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].review_mode, 'manual');
  assert.equal(rows[0].pending_revision, 1);
  assert.equal(rows[0].last_review_status, 'pending');
  assert.equal(rows[0].pieces, 1);
  const [cost] = await q('select * from public.ai_admin_month_cost()');
  assert.ok(Number(cost.analysis_cents) >= 3);
});

await test('Console IA : approbation → travail publish unique, puis publication par le worker rend tout visible', async () => {
  await asUser(PV_ADMIN);
  await q('select public.ai_approve_revision($1, 1, $2)', [PV_D, 'relu, conforme']);
  await q('select public.ai_approve_revision($1, 1, null)', [PV_D]); // idempotent
  await asSuperuser();
  const jobs = await q(`select kind, status, revision from public.ai_jobs where dossier_id = $1 and kind = 'publish'`, [PV_D]);
  assert.deepEqual(jobs, [{ kind: 'publish', status: 'queued', revision: 1 }]);
  const [a] = await q('select review_status, reviewed_by, review_note from public.ai_analyses where dossier_id = $1 and revision = 1', [PV_D]);
  assert.equal(a.review_status, 'approved');
  assert.equal(a.reviewed_by, PV_ADMIN);
  assert.equal(a.review_note, 'relu, conforme');
  await asUser(PV_A);
  assert.equal((await q(`select 1 from public.dossier_documents where dossier_id = $1 and kind = 'deliverable'`, [PV_D])).length, 0, 'toujours caché avant publication effective');
  // Le worker (service) réclame le travail et publie.
  await asService();
  const claimed = await q(`select id, kind, revision from public.ai_claim_jobs('t', 5)`);
  const pub = claimed.find((j) => j.kind === 'publish' && j.revision === 1);
  assert.ok(pub, 'travail publish réclamé');
  await q(`update public.dossier_documents set review_status = 'approved', file_path = replace(file_path, 'ai-review/', '') where dossier_id = $1 and ai_revision = 1`, [PV_D]);
  await q(`update public.ai_analyses set review_status = 'published', published_at = now() where dossier_id = $1 and revision = 1`, [PV_D]);
  await q('select public.ai_finish_job($1, true)', [pub.id]);
  await asUser(PV_A);
  assert.equal((await q(`select 1 from public.dossier_documents where dossier_id = $1 and kind = 'deliverable'`, [PV_D])).length, 1, 'livrable publié visible');
  assert.equal((await q('select 1 from public.ai_analyses where dossier_id = $1', [PV_D])).length, 1, 'analyse publiée visible');
  await asUser(PV_B);
  assert.equal((await q(`select 1 from public.dossier_documents where dossier_id = $1`, [PV_D])).length, 0, 'tiers : rien');
  await asUser(PV_ADMIN);
  await rejects(q('select public.ai_reject_revision($1, 1, $2)', [PV_D, 'trop tard']), /DEJA_PUBLIEE/);
});

await test('Console IA : rejet motivé → révision et livrables marqués rejetés, travail publish annulé, titulaire ne voit rien', async () => {
  await asService();
  await q(`insert into public.ai_analyses (dossier_id, user_id, revision, data) values ($1, $2, 2, '{"summary_short":"v2"}')`, [PV_D, PV_A]);
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind, generated_by, ai_revision, review_status)
           values ($1, $2, $3, 'synthese.pdf', 'deliverable', 'ai', 2, 'pending')`, [PV_D, PV_A, `ai-review/${PV_A}/${PV_D}/deliverable-2-synthese.pdf`]);
  await asUser(PV_ADMIN);
  await rejects(q('select public.ai_reject_revision($1, 2, $2)', [PV_D, '']), /MOTIF_REQUIS/);
  await q('select public.ai_approve_revision($1, 2, null)', [PV_D]);
  await q('select public.ai_reject_revision($1, 2, $2)', [PV_D, 'citations non vérifiables']);
  await asSuperuser();
  const [a] = await q('select review_status, review_note from public.ai_analyses where dossier_id = $1 and revision = 2', [PV_D]);
  assert.equal(a.review_status, 'rejected');
  const [doc] = await q('select review_status, file_path from public.dossier_documents where dossier_id = $1 and ai_revision = 2', [PV_D]);
  assert.equal(doc.review_status, 'rejected');
  assert.match(doc.file_path, /^ai-review\//, 'fichier jamais déplacé');
  assert.equal((await q(`select 1 from public.ai_jobs where dossier_id = $1 and kind = 'publish' and revision = 2 and status = 'cancelled'`, [PV_D])).length, 1);
  await asUser(PV_A);
  assert.equal((await q(`select 1 from public.dossier_documents where dossier_id = $1 and ai_revision = 2`, [PV_D])).length, 0);
  // La révision publiée (1) reste visible.
  assert.equal((await q(`select revision from public.ai_analyses where dossier_id = $1`, [PV_D])).map((r) => r.revision).join(), '1');
});

await test('Console IA : relance d’un travail en échec réservée à l’admin, compteur remis à zéro', async () => {
  await asService();
  const [j] = await q(`insert into public.ai_jobs (dossier_id, user_id, kind, document_id, status, attempts, last_error, finished_at)
                       values ($1, $2, 'extract', $3, 'failed', 3, 'erreur réseau', now()) returning id`, [PV_D, PV_A, pvPiece]);
  await asUser(PV_A);
  await rejects(q('select public.ai_retry_job($1)', [j.id]), /FORBIDDEN/);
  await asUser(PV_ADMIN);
  // Une extraction de la même pièce est déjà en file (activation) : relance refusée tant qu'elle est ouverte.
  await rejects(q('select public.ai_retry_job($1)', [j.id]), /TRAVAIL_DEJA_EN_FILE/);
  await asService();
  await q(`update public.ai_jobs set status = 'cancelled', finished_at = now() where dossier_id = $1 and status in ('queued','running')`, [PV_D]);
  await asUser(PV_ADMIN);
  await q('select public.ai_retry_job($1)', [j.id]);
  await rejects(q('select public.ai_retry_job($1)', [j.id]), /TRAVAIL_NON_ECHOUE/);
  await asSuperuser();
  const [r] = await q('select status, attempts, last_error, run_after <= now() as pret from public.ai_jobs where id = $1', [j.id]);
  assert.equal(r.status, 'queued');
  assert.equal(r.attempts, 0);
  assert.equal(r.last_error, null);
  assert.equal(r.pret, true);
  const ov = await q('select jobs_open, jobs_failed from public.ai_admin_overview() where dossier_id = $1', [PV_D]).catch(() => []);
  await asUser(PV_ADMIN);
  const [o] = await q('select jobs_open, jobs_failed from public.ai_admin_overview() where dossier_id = $1', [PV_D]);
  assert.ok(o.jobs_open >= 1);
  assert.equal(o.jobs_failed, 0);
  void ov;
});

await test('IA : plafond global mensuel — lisible par le worker seul, total exact tous comptes', async () => {
  await asUser(IA_A);
  await rejects(q('select public.ai_global_month_cost_cents()'), /permission denied/);
  await asAnon();
  await rejects(q('select public.ai_global_month_cost_cents()'), /permission denied/);
  await asSuperuser();
  const [attendu] = await q(`select coalesce((select sum(cost_cents) from public.ai_extractions where created_at >= date_trunc('month', now())), 0)
    + coalesce((select sum(cost_cents) from public.ai_analyses where created_at >= date_trunc('month', now())), 0) as n`);
  await asService();
  const [r] = await q('select public.ai_global_month_cost_cents() as n');
  assert.equal(Number(r.n), Number(attendu.n));
});

await test('IA : bilan de santé quotidien — écrit par la tâche planifiée seule, lu par l’admin seul, chiffres exacts', async () => {
  await asUser(IA_A);
  await rejects(q('select public.ai_health_snapshot()'), /permission denied/);
  await asService();
  await q('select public.ai_health_snapshot()');
  await q('select public.ai_health_snapshot()'); // rejouable : une ligne par jour
  await asSuperuser();
  const [attendu] = await q(`select count(*) filter (where status = 'failed' and updated_at >= now() - interval '1 day')::int as f,
                                    count(*) filter (where status in ('queued','running'))::int as o from public.ai_jobs`);
  await asUser(ADMIN);
  const rows = await q('select jobs_failed, jobs_open, needs_action from public.ai_health_reports where day = current_date');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].jobs_failed, attendu.f);
  assert.equal(rows[0].jobs_open, attendu.o);
  await asUser(IA_A);
  assert.equal((await q('select * from public.ai_health_reports')).length, 0, 'client : aucune lecture');
});

// ── Quotas IA par offre (migration 20261118) ────────────────────────────────
await test('IA : quotas par offre — résolution offre/dérogation, décompte, rôles, cloisonnement', async () => {
  const QA = await newUser('quota-a@test.local');
  const QB = await newUser('quota-b@test.local');
  // Fonctions de décompte : rôle serveur seul ; get_my_ai_quota : titulaire.
  await asUser(QA);
  await rejects(q('select * from public.ai_quota_state($1)', [QA]), /permission denied/);
  await rejects(q('select public.ai_quota_allows_pages($1, 1)', [QA]), /permission denied/);
  await rejects(q(`select public.ai_consume_action($1, null, 'question')`, [QA]), /permission denied/);
  const [none] = await q('select * from public.get_my_ai_quota()');
  assert.equal(none.pages_limit, null, 'sans abonnement : aucune limite applicable (moteur déjà inaccessible)');
  // Offre Essentiel : 50 pages, 0 action (grille proposée).
  await subscribe(QA, 'essentiel');
  await asUser(QA);
  const [ess] = await q('select * from public.get_my_ai_quota()');
  assert.equal(ess.pages_limit, 50);
  assert.equal(ess.actions_limit, 0);
  assert.equal(ess.pages_used, 0);
  // 48 pages consommées (extraction réussie) ; l'échec ne consomme rien.
  const DQ = await insertDossier(QA, { title: 'Quota pages' });
  await asSuperuser();
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1::uuid, $2::uuid, $2::text || '/' || $1::text || '/q.pdf', 'q.pdf', 'piece')`, [DQ, QA]);
  const [docQ] = await q('select id from public.dossier_documents where dossier_id = $1 order by created_at desc limit 1', [DQ]);
  await q(`insert into public.ai_extractions (dossier_id, user_id, document_id, status, pages) values ($1, $2, $3, 'ok', 48) on conflict (document_id) do update set status = 'ok', pages = 48`, [DQ, QA, docQ.id]);
  await asService();
  assert.equal((await q('select public.ai_quota_allows_pages($1, 2) as a', [QA]))[0].a, true, '48 + 2 ≤ 50');
  assert.equal((await q('select public.ai_quota_allows_pages($1, 3) as a', [QA]))[0].a, false, '48 + 3 > 50 : pause, rien de consommé');
  assert.equal((await q('select public.ai_quota_allows_pages($1, null) as a', [QA]))[0].a, true, 'pièce sans pagination = 1 page');
  // 0 action incluse : refusée et jamais journalisée (pas de décompte sans journal).
  assert.equal((await q(`select public.ai_consume_action($1, $2, 'question') as a`, [QA, DQ]))[0].a, false);
  await asSuperuser();
  assert.equal((await q('select count(*)::int n from public.ai_action_events'))[0].n, 0);
  // Dérogation (offre personnalisée en recette) : prioritaire sur l'offre.
  await q(`insert into public.entitlement_overrides (user_id, mode, dossier_limit, reason, ai_pages_month, ai_actions_month)
           values ($1, 'custom_limit', 100, 'contrat fictif de recette', 10000, 2)`, [QA]);
  await asService();
  assert.equal((await q('select public.ai_quota_allows_pages($1, 500) as a', [QA]))[0].a, true, 'plafond contractuel prioritaire');
  assert.equal((await q(`select public.ai_consume_action($1, $2, 'brouillon') as a`, [QA, DQ]))[0].a, true);
  assert.equal((await q(`select public.ai_consume_action($1, $2, 'question') as a`, [QA, DQ]))[0].a, true);
  assert.equal((await q(`select public.ai_consume_action($1, $2, 'question') as a`, [QA, DQ]))[0].a, false, '2 actions épuisées : suspension sans facturation');
  // Journal et usage : visibles du titulaire seul (cloisonnement A/B).
  await asUser(QA);
  assert.equal((await q('select count(*)::int n from public.ai_action_events'))[0].n, 2);
  assert.equal((await q('select * from public.get_my_ai_quota()'))[0].actions_used, 2);
  await asUser(QB);
  assert.equal((await q('select count(*)::int n from public.ai_action_events'))[0].n, 0, 'B ne voit pas les actions de A');
  await rejects(q(`insert into public.ai_action_events (user_id, kind) values ($1, 'question')`, [QB]), /row-level security/);
  // « Dossiers illimités » ≠ consommation illimitée : Premium reste plafonnée.
  await subscribe(QB, 'business-pme-premium');
  await asUser(QB);
  const [prem] = await q('select * from public.get_my_ai_quota()');
  assert.equal(prem.pages_limit, 5000);
  assert.equal(prem.actions_limit, 1000);
});

// ── Réception e-mail entrante (migration 20261118130000) ────────────────────
await test('E-mail entrant : adresse par dossier — offre, format, idempotence, révocation, cloisonnement, clôture', async () => {
  const EA = await newUser('email-a@test.local');
  const EB = await newUser('email-b@test.local');
  // Essentiel : fonctionnalité non incluse (grille de recette).
  await subscribe(EA, 'essentiel');
  const DA = await insertDossier(EA, { title: 'Réception e-mail' });
  await asUser(EA);
  await rejects(q('select * from public.create_inbound_address($1)', [DA]), /FEATURE_NOT_INCLUDED/);
  // email_inbound_included : rôle serveur seul.
  await rejects(q('select public.email_inbound_included($1)', [EA]), /permission denied/);
  // Entrepreneur : incluse ; adresse non devinable ; rappel idempotent.
  await subscribe(EA, 'entrepreneur');
  await asUser(EA);
  const [a1] = await q('select * from public.create_inbound_address($1)', [DA]);
  assert.match(a1.local_part, /^d-[0-9a-f]{32}$/);
  const [a2] = await q('select * from public.create_inbound_address($1)', [DA]);
  assert.equal(a2.local_part, a1.local_part, 'rappel : même adresse active');
  // Pas titulaire : refusé ; cloisonnement A/B ; écriture directe interdite.
  await asUser(EB);
  await rejects(q('select * from public.create_inbound_address($1)', [DA]), /FORBIDDEN/);
  assert.equal((await q('select count(*)::int n from public.inbound_addresses'))[0].n, 0, 'B ne voit pas l’adresse de A');
  await rejects(
    q(`insert into public.inbound_addresses (user_id, dossier_id, local_part) values ($1, $2, 'd-${'0'.repeat(32)}')`, [EB, DA]),
    /row-level security/,
  );
  // Journal des réceptions : écrit par le serveur, anti-rejeu par unicité, lu par le titulaire seul.
  await asService();
  await q(
    `insert into public.inbound_emails (address_id, user_id, dossier_id, provider_email_id, from_addr, subject, spf, dkim, dmarc)
     select a.id, a.user_id, a.dossier_id, 're_1', 'exp@externe.fr', 'Facture mars', 'pass', 'pass', 'pass'
       from public.inbound_addresses a where a.local_part = $1`,
    [a1.local_part],
  );
  await rejects(
    q(`insert into public.inbound_emails (user_id, dossier_id, provider_email_id) values ($1, $2, 're_1')`, [EA, DA]),
    /duplicate key/,
  );
  await asUser(EA);
  assert.equal((await q('select count(*)::int n from public.inbound_emails'))[0].n, 1);
  await asUser(EB);
  assert.equal((await q('select count(*)::int n from public.inbound_emails'))[0].n, 0, 'B ne voit pas les réceptions de A');
  await rejects(q(`update public.inbound_emails set subject = 'x' where provider_email_id = 're_1'`).then(async () => {
    await asSuperuser();
    const [r] = await q(`select subject from public.inbound_emails where provider_email_id = 're_1'`);
    if (r.subject !== 'x') throw new Error('row-level security: aucune ligne modifiée');
  }), /row-level security/);
  // Révocation : plus d'adresse active, historique conservé, nouvelle adresse différente.
  await asUser(EA);
  await q('select public.revoke_inbound_address($1)', [DA]);
  assert.equal((await q('select count(*)::int n from public.inbound_addresses where revoked_at is null'))[0].n, 0);
  assert.equal((await q('select count(*)::int n from public.inbound_emails'))[0].n, 1, 'historique conservé');
  const [a3] = await q('select * from public.create_inbound_address($1)', [DA]);
  assert.notEqual(a3.local_part, a1.local_part, 'une adresse révoquée n’est jamais réutilisée');
  // Dossier clôturé : création refusée.
  await q(`insert into public.dossier_events (dossier_id, user_id, type, label) values ($1, $2, 'dossier_cloture', 'Dossier clôturé')`, [DA, EA]);
  await q('select public.revoke_inbound_address($1)', [DA]);
  await rejects(q('select * from public.create_inbound_address($1)', [DA]), /DOSSIER_CLOTURE/);
});

// ── Essai prospect (migration 20261125120000) ───────────────────────────────
const CGU_ESSAI = 'essai-2026-11';
async function trialOpen(userId) {
  await asService();
  return (await q('select * from public.trial_open($1)', [userId]))[0];
}
async function trialClaim(userId, dossierId, key, terms = CGU_ESSAI) {
  await asService();
  return (await q('select * from public.trial_claim_slot($1, $2, $3, $4)', [userId, dossierId, key, terms]))[0];
}
async function trialDossier(userId, title, pieces = 1) {
  const id = await insertDossier(userId, { status: 'brouillon', title });
  const docs = [];
  for (let i = 0; i < pieces; i++) docs.push(await addPiece(userId, id, `piece-${i + 1}.pdf`));
  return { id, docs };
}
async function trialRow(userId) {
  await asSuperuser();
  return (await q('select * from public.trial_accounts where user_id = $1', [userId]))[0];
}
async function trialSlots(userId) {
  await asSuperuser();
  return q('select s.* from public.trial_slots s join public.trial_accounts a on a.id = s.trial_id where a.user_id = $1 order by s.slot_no', [userId]);
}
async function trialMotifs(kind) {
  await asSuperuser();
  return (await q(`select detail ->> 'motif' as m from public.trial_events where kind = $1 order by created_at`, [kind])).map((r) => r.m);
}
const jobOf = async (dossierId, kind) => {
  await asSuperuser();
  return (await q(`select id from public.ai_jobs where dossier_id = $1 and kind = $2 order by created_at desc limit 1`, [dossierId, kind]))[0]?.id;
};
const P1 = await newUser('Prospect.Un+promo@GoogleMail.com');
const P2 = await newUser('prospect-deux@test.local');
const P3 = await newUser('prospect-trois@test.local');
const P1D1 = await trialDossier(P1, 'Essai P1 — dossier 1', 2);
const P1D2 = await trialDossier(P1, 'Essai P1 — dossier 2');
const P1D3 = await trialDossier(P1, 'Essai P1 — dossier 3');

await test('Essai : inactif par défaut — rien ne s\'ouvre, aucune RPC serveur accessible au client', async () => {
  await asSuperuser();
  const [s] = await q('select enabled, max_trials, budget_cents from public.trial_settings');
  assert.deepEqual([s.enabled, s.max_trials, s.budget_cents], [false, 0, 0], 'fermé, plafond 0, budget 0');
  assert.equal((await q('select count(*)::int n from public.trial_settings'))[0].n, 1, 'rejeu de la migration : une seule ligne');
  assert.equal((await trialOpen(P1)).reason, 'ESSAIS_FERMES');
  assert.equal((await trialClaim(P1, P1D1.id, 'cle-essai-0001')).reason, 'ESSAI_ABSENT');
  for (const as of [() => asUser(P1), asAnon]) {
    await as();
    await rejects(q('select * from public.trial_open($1)', [P1]), /FORBIDDEN|permission denied/);
    await as();
    await rejects(q('select * from public.trial_claim_slot($1, $2, $3, $4)', [P1, P1D1.id, 'cle-essai-0001', CGU_ESSAI]), /permission denied/);
    await as();
    await rejects(q('select public.trial_allows($1, 1)', [P1D1.id]), /permission denied/);
    await as();
    await rejects(q(`select public.trial_check($1, 'extract', null, 1)`, [P1D1.id]), /permission denied/);
    await as();
    await rejects(q('select public.trial_admin_configure(true, 100, 14, 500)'), /FORBIDDEN|AUTH_REQUIRED|permission denied/);
    await as();
    await rejects(q(`select public.trial_admin_suspend($1, 'motif')`, [P1]), /FORBIDDEN|AUTH_REQUIRED|permission denied/);
  }
  await asSuperuser();
  assert.equal((await q('select enabled from public.trial_settings'))[0].enabled, false);
  assert.equal((await q('select count(*)::int n from public.trial_accounts'))[0].n, 0);
});

await test('Essai : ouverture — réglages propriétaire exigés, e-mail vérifié, empreinte normalisée (casse, +tag, points Gmail)', async () => {
  await asUser(ADMIN);
  await q('select public.trial_admin_configure(true, null, null, null)');
  assert.equal((await trialOpen(P1)).reason, 'BUDGET_NON_FIXE', 'aucune dépense sans budget fixé');
  await asUser(ADMIN);
  await q('select public.trial_admin_configure(null, null, null, 500)');
  assert.equal((await trialOpen(P1)).reason, 'PLAFOND_GLOBAL_ATTEINT', 'plafond global 0');
  await asUser(ADMIN);
  await q('select public.trial_admin_configure(null, 3, 14, null)');
  assert.equal((await trialOpen(UNVERIFIED)).reason, 'EMAIL_NON_VERIFIE');
  const o = await trialOpen(P1);
  assert.deepEqual([o.ok, o.reason], [true, 'OUVERT']);
  const again = await trialOpen(P1);
  assert.deepEqual([again.ok, again.reason, again.trial_id], [true, 'DEJA_OUVERT', o.trial_id], 'un seul essai par compte');
  // Alias du même titulaire (points, +tag, casse, googlemail) : refusé.
  for (const alias of ['prospectun@gmail.com', 'P.r.o.s.p.e.c.t.u.n+autre@gmail.com']) {
    const twin = await newUser(alias);
    const r = await trialOpen(twin);
    assert.deepEqual([r.ok, r.reason], [false, 'EMAIL_DEJA_UTILISE'], alias);
  }
  await asSuperuser();
  const [f] = await q(`select public.trial_email_fingerprint('a.b+x@test.fr') = public.trial_email_fingerprint('A.B@test.fr') as tag,
                              public.trial_email_fingerprint('a.b@test.fr') = public.trial_email_fingerprint('ab@test.fr') as points,
                              public.trial_email_fingerprint('sans-arobase') as invalide`);
  assert.deepEqual([f.tag, f.points, f.invalide], [true, false, null], 'points significatifs hors Gmail');
  const t = await trialRow(P1);
  assert.match(t.email_fingerprint, /^[0-9a-f]{64}$/, 'adresse jamais conservée en clair');
  assert.equal(t.budget_cents, 500);
  assert.ok(new Date(t.expires_at) > new Date(Date.now() + 13 * 86400000), 'expiration à 14 jours');
  assert.equal((await q('select count(*)::int n from public.trial_accounts'))[0].n, 1);
});

await test('Essai : 2 analyses OK, 3e refusée (y compris via API) ; idempotence ; manifeste figé au lancement', async () => {
  const r1 = await trialClaim(P1, P1D1.id, 'cle-essai-0001');
  assert.deepEqual([r1.ok, r1.reason, r1.slot, r1.replayed], [true, 'RESERVE', 1, false]);
  const [s1] = await trialSlots(P1);
  assert.equal(s1.piece_count, 2);
  assert.deepEqual(s1.manifest.map((m) => m.id).sort(), [...P1D1.docs].sort(), 'manifeste = pièces présentes au lancement');
  assert.ok(s1.manifest.every((m) => /^[0-9a-f]{64}$/.test(m.empreinte)));
  const [set] = await q('select enabled_at, enabled_by, terms_version from public.dossier_ai_settings where dossier_id = $1', [P1D1.id]);
  assert.ok(set.enabled_at);
  assert.equal(set.terms_version, CGU_ESSAI, 'consentement tracé');
  assert.equal(await openJobs(P1D1.id, 'extract'), 2);
  assert.equal(await openJobs(P1D1.id, 'consolidate'), 1);
  // Reprise technique : même clé → même emplacement, aucun décompte, aucun travail en double.
  const replay = await trialClaim(P1, P1D1.id, 'cle-essai-0001');
  assert.deepEqual([replay.ok, replay.reason, replay.slot, replay.replayed], [true, 'REJEU', 1, true]);
  const other = await trialClaim(P1, P1D1.id, 'cle-essai-autre');
  assert.deepEqual([other.ok, other.reason, other.slot, other.replayed], [true, 'DOSSIER_DEJA_RESERVE', 1, true]);
  const conflict = await trialClaim(P1, P1D2.id, 'cle-essai-0001');
  assert.deepEqual([conflict.ok, conflict.reason], [false, 'CLE_IDEMPOTENCE_CONFLIT']);
  assert.equal((await trialClaim(P1, P1D2.id, 'court')).reason, 'CLE_IDEMPOTENCE_INVALIDE');
  assert.equal((await trialSlots(P1)).length, 1, 'un seul emplacement consommé');
  assert.equal(await openJobs(P1D1.id, 'extract'), 2);
  // Conditions exigées ; dossier d'autrui refusé.
  assert.equal((await trialClaim(P1, P1D2.id, 'cle-essai-0002', ' ')).reason, 'CONDITIONS_REQUISES');
  assert.equal((await trialClaim(P1, dossierA, 'cle-essai-0002')).reason, 'DOSSIER_INTROUVABLE');
  const r2 = await trialClaim(P1, P1D2.id, 'cle-essai-0002');
  assert.deepEqual([r2.ok, r2.slot], [true, 2]);
  // Troisième : refusée, rien n'est activé ni mis en file.
  const r3 = await trialClaim(P1, P1D3.id, 'cle-essai-0003');
  assert.deepEqual([r3.ok, r3.reason, r3.slot], [false, 'EMPLACEMENTS_EPUISES', null]);
  assert.equal((await trialSlots(P1)).length, 2);
  assert.equal((await q('select 1 from public.dossier_ai_settings where dossier_id = $1', [P1D3.id])).length, 0);
  assert.equal((await q('select 1 from public.ai_jobs where dossier_id = $1', [P1D3.id])).length, 0);
  // Via l'API, en tant que prospect : aucune voie.
  await asUser(P1);
  await rejects(q('select public.enable_ai_processing($1, $2)', [P1D3.id, CGU_ESSAI]), /SUBSCRIPTION_REQUIRED/);
  await asUser(P1);
  await rejects(q('select * from public.trial_claim_slot($1, $2, $3, $4)', [P1, P1D3.id, 'cle-essai-0004', CGU_ESSAI]), /permission denied/);
  await asUser(P1);
  await rejects(q(`insert into public.trial_slots (trial_id, slot_no, idempotency_key, dossier_id, manifest, manifest_hash, piece_count)
                   values ($1, 1, 'cle-directe-01', $2, '[]', 'x', 1)`, [s1.trial_id, P1D3.id]), /row-level security/);
  await asUser(P1);
  await rejects(q(`insert into public.ai_jobs (dossier_id, user_id, kind) values ($1, $2, 'consolidate')`, [P1D3.id, P1]), /row-level security/);
  await asUser(P1);
  await rejects(q('insert into public.dossier_ai_settings (dossier_id, user_id, enabled_at) values ($1, $2, now())', [P1D3.id, P1]), /row-level security/);
  await asUser(P1);
  await q(`update public.trial_accounts set budget_cents = 999999, expires_at = now() + interval '10 years' where user_id = $1`, [P1]);
  await q('update public.trial_slots set analysis_done_at = null, pages_used = 0');
  assert.equal((await trialRow(P1)).budget_cents, 500, 'écriture client sans effet (RLS)');
  const motifs = await trialMotifs('emplacement_refuse');
  assert.ok(motifs.includes('EMPLACEMENTS_EPUISES') && motifs.includes('CLE_IDEMPOTENCE_CONFLIT'), 'refus journalisés');
});

await test('Essai : concurrence simulée — la contrainte interdit tout 3e emplacement ou doublon, même hors RPC', async () => {
  // PGlite n'a qu'une connexion : on rejoue ce que tenterait une transaction
  // concurrente ayant franchi le contrôle (insertion directe, rôle serveur).
  const [s1, s2] = await trialSlots(P1);
  const ins = (no, key, dossier) => q(
    `insert into public.trial_slots (trial_id, slot_no, idempotency_key, dossier_id, manifest, manifest_hash, piece_count)
     values ($1, $2, $3, $4, '[]', 'x', 1)`, [s1.trial_id, no, key, dossier]);
  await asService();
  await rejects(ins(3, 'cle-course-0003', P1D3.id), /check constraint/);
  await rejects(ins(2, 'cle-course-0002', P1D3.id), /unique|duplicate/);
  await rejects(ins(1, 'cle-course-0001', P1D3.id), /unique|duplicate/);
  await rejects(ins(0, 'cle-course-0000', P1D3.id), /check constraint/);
  // Consommation jamais effacée ni réécrite, quel que soit le rôle.
  await rejects(q('delete from public.trial_slots where id = $1', [s2.id]), /ESSAI_IMMUABLE/);
  await rejects(q('update public.trial_slots set dossier_id = $1 where id = $2', [P1D3.id, s2.id]), /ESSAI_IMMUABLE/);
  await rejects(q(`update public.trial_slots set manifest = '[]' where id = $1`, [s1.id]), /ESSAI_IMMUABLE/);
  await rejects(q('delete from public.trial_accounts where id = $1', [s1.trial_id]), /ESSAI_IMMUABLE/);
  await rejects(q('truncate public.trial_slots'), /ESSAI_IMMUABLE|permission denied/);
  await asSuperuser();
  await rejects(q('truncate public.trial_slots, public.trial_events, public.trial_accounts cascade'), /ESSAI_IMMUABLE/);
  await rejects(q(`update public.trial_events set kind = 'efface'`), /ESSAI_JOURNAL_IMMUABLE/);
  await rejects(q('delete from public.trial_events'), /ESSAI_JOURNAL_IMMUABLE/);
  assert.equal((await trialSlots(P1)).length, 2);
});

await test('Essai : garde de mise en file et du worker — manifeste seul, pages, reprise sans double décompte, une analyse par emplacement', async () => {
  // Pièce ajoutée APRÈS le lancement : jamais mise en file.
  const late = await addPiece(P1, P1D1.id, 'ajout-tardif.pdf');
  await asSuperuser();
  assert.equal((await q('select 1 from public.ai_jobs where document_id = $1', [late])).length, 0, 'pièce hors manifeste : aucun travail');
  assert.ok((await trialMotifs('mise_en_file_refusee')).includes('PIECE_HORS_MANIFESTE'));
  assert.equal((await trialSlots(P1))[0].piece_count, 2, 'manifeste inchangé');
  await asService();
  const check = async (kind, doc, pages = null) => (await q('select public.trial_check($1, $2, $3, $4) as r', [P1D1.id, kind, doc, pages]))[0].r;
  assert.equal(await check('extract', late), 'PIECE_HORS_MANIFESTE');
  assert.equal(await check('extract', P1D1.docs[0], 5), null);
  assert.equal(await check('extract', P1D1.docs[0], 61), 'PAGES_ESSAI_EPUISEES', 'plafond de pages par analyse (60)');
  assert.equal(await check('render', null), null, 'rendu : aucun appel IA');
  assert.equal(await check('publish', null), null);
  // Worker : travail d'extraction du manifeste permis ; rien n'est décompté par le contrôle.
  const jx = await jobOf(P1D1.id, 'extract');
  const jc = await jobOf(P1D1.id, 'consolidate');
  await asService();
  assert.equal((await q('select public.trial_allows($1, 3) as r', [jx]))[0].r, null);
  assert.equal((await q('select public.trial_allows($1, 61) as r', [jx]))[0].r, 'PAGES_ESSAI_EPUISEES');
  // Consolidation : reprise du MÊME travail (tentatives 2, 3…) = un seul décompte.
  for (let i = 0; i < 3; i++) assert.equal((await q('select public.trial_allows($1, null) as r', [jc]))[0].r, null);
  let [s1] = await trialSlots(P1);
  assert.deepEqual([s1.analysis_job_id, s1.analysis_job_count], [jc, 1], 'reprise technique : pas de double décompte');
  // Résultats réels (écrits par le worker) : pages et dépense reportées sur l'essai.
  await asService();
  const ext = (doc, pages, cost) => q(
    `insert into public.ai_extractions (dossier_id, user_id, document_id, status, pages, cost_cents, created_at)
     values ($1, $2, $3, 'ok', $4, $5, clock_timestamp())
     on conflict (document_id) do update set status = 'ok', pages = excluded.pages, cost_cents = excluded.cost_cents, created_at = excluded.created_at`,
    [P1D1.id, P1, doc, pages, cost]);
  await ext(P1D1.docs[0], 4, 12.5);
  await ext(P1D1.docs[1], null, 7.5);
  await q(`update public.ai_extractions set data = '{}' where document_id = $1`, [P1D1.docs[0]]);
  [s1] = await trialSlots(P1);
  assert.equal(s1.pages_used, 5, '4 pages + 1 pièce sans pagination ; mise à jour sans relecture non comptée');
  assert.equal(Number((await trialRow(P1)).spent_cents), 20);
  // « Aucune pièce exploitable » (model null) n'est pas une analyse ; l'analyse réelle clôt l'emplacement.
  await asService();
  await q(`insert into public.ai_analyses (dossier_id, user_id, revision, model, data) values ($1, $2, 1, null, '{}')`, [P1D1.id, P1]);
  assert.equal((await trialSlots(P1))[0].analysis_done_at, null);
  await asService();
  await q(`insert into public.ai_analyses (dossier_id, user_id, revision, model, data, cost_cents) values ($1, $2, 2, 'modele-test', '{"summary_short":"x"}', 30)`, [P1D1.id, P1]);
  [s1] = await trialSlots(P1);
  assert.ok(s1.analysis_done_at, 'analyse livrée');
  assert.equal(Number((await trialRow(P1)).spent_cents), 50);
  await asService();
  assert.equal((await q('select public.trial_allows($1, null) as r', [jc]))[0].r, 'ANALYSE_DEJA_LIVREE');
  // Aucune nouvelle consolidation en file (corbeille / restauration d'une pièce, réouverture…).
  await asSuperuser();
  await q(`update public.ai_jobs set status = 'done', finished_at = now() where dossier_id = $1 and status in ('queued', 'running')`, [P1D1.id]);
  await q(`select public.ai_enqueue($1, 'consolidate', null)`, [P1D1.id]);
  await q(`select public.ai_enqueue($1, 'extract', $2)`, [P1D1.id, late]);
  assert.equal(await openJobs(P1D1.id, 'consolidate'), 0, 'analyse déjà livrée : pas de seconde');
  assert.equal(await openJobs(P1D1.id, 'extract'), 0);
  await q(`select public.ai_enqueue($1, 'render', null)`, [P1D1.id]);
  assert.equal(await openJobs(P1D1.id, 'render'), 1, 'rendu après correction toujours possible');
  // Pièce du manifeste modifiée après coup (chemin / taille) : refusée.
  await q(`update public.dossier_documents set size_bytes = 424242 where id = $1`, [P1D2.docs[0]]);
  await asService();
  assert.equal((await q(`select public.trial_check($1, 'extract', $2, 1) as r`, [P1D2.id, P1D2.docs[0]]))[0].r, 'PIECE_MODIFIEE');
  await asSuperuser();
  await q(`update public.dossier_documents set size_bytes = null where id = $1`, [P1D2.docs[0]]);
  // Au plus trois travaux de consolidation distincts par emplacement (échecs compris).
  for (let i = 1; i <= 4; i++) {
    const j = await jobOf(P1D2.id, 'consolidate');
    await asService();
    const r = (await q('select public.trial_allows($1, null) as r', [j]))[0].r;
    assert.equal(r, i <= 3 ? null : 'TENTATIVES_ANALYSE_EPUISEES', `travail distinct n° ${i}`);
    await asSuperuser();
    await q(`update public.ai_jobs set status = 'failed', finished_at = now() where id = $1`, [j]);
    await q(`select public.ai_enqueue($1, 'consolidate', null)`, [P1D2.id]);
  }
  assert.equal((await trialSlots(P1))[1].analysis_job_count, 3);
  assert.ok((await trialMotifs('controle_refuse')).includes('TENTATIVES_ANALYSE_EPUISEES'));
});

await test('Essai : suppression (pièces, dossier, compte) puis nouvelle tentative — toujours refusée, dépense conservée', async () => {
  await asSuperuser();
  await q('delete from public.dossier_documents where dossier_id = $1', [P1D1.id]);
  await q('delete from public.dossiers where id = $1', [P1D1.id]);
  await q('update public.dossiers set deleted_at = now() where id = $1', [P1D2.id]);
  assert.equal((await q('select 1 from public.ai_extractions where dossier_id = $1', [P1D1.id])).length, 0, 'résultats partis avec le dossier');
  assert.equal((await trialSlots(P1)).length, 2, 'emplacements conservés');
  assert.equal(Number((await trialRow(P1)).spent_cents), 50, 'dépense conservée');
  const D4 = await trialDossier(P1, 'Essai P1 — dossier 4');
  const r = await trialClaim(P1, D4.id, 'cle-essai-0005');
  assert.deepEqual([r.ok, r.reason], [false, 'EMPLACEMENTS_EPUISES']);
  // Nouvelle session / réémission d'accès : rien n'est lié à la session.
  assert.equal((await trialOpen(P1)).reason, 'DEJA_OUVERT');
  // Compte supprimé puis recréé (alias de la même adresse) : l'essai existant est rattaché.
  const before = await trialRow(P1);
  await asSuperuser();
  await q('delete from auth.users where id = $1', [P1]);
  assert.equal((await q('select count(*)::int n from public.trial_accounts where id = $1', [before.id]))[0].n, 1, 'essai conservé sans le compte');
  const P1BIS = await newUser('p.rospect.un+retour@gmail.com');
  const o = await trialOpen(P1BIS);
  assert.deepEqual([o.ok, o.reason, o.trial_id], [true, 'RATTACHE', before.id]);
  assert.equal((await trialSlots(P1BIS)).length, 2);
  const D5 = await trialDossier(P1BIS, 'Essai P1 bis');
  assert.equal((await trialClaim(P1BIS, D5.id, 'cle-essai-0006')).reason, 'EMPLACEMENTS_EPUISES');
  assert.equal((await q('select count(*)::int n from public.trial_accounts'))[0].n, 1);
});

const P2D1 = await trialDossier(P2, 'Essai P2 — dossier 1');
const P2D2 = await trialDossier(P2, 'Essai P2 — dossier 2');
await test('Essai : expiration — plus aucune réservation ni lecture, résultats conservés', async () => {
  assert.equal((await trialOpen(P2)).reason, 'OUVERT');
  assert.equal((await trialClaim(P2, P2D1.id, 'cle-p2-0001')).slot, 1);
  const jx = await jobOf(P2D1.id, 'extract');
  await asSuperuser();
  await q(`update public.trial_accounts set expires_at = now() - interval '1 minute' where user_id = $1`, [P2]);
  const r = await trialClaim(P2, P2D2.id, 'cle-p2-0002');
  assert.deepEqual([r.ok, r.reason], [false, 'ESSAI_EXPIRE']);
  await asService();
  assert.equal((await q('select public.trial_allows($1, 1) as r', [jx]))[0].r, 'ESSAI_EXPIRE');
  assert.equal((await q(`select public.trial_check($1, 'consolidate', null, null) as r`, [P2D1.id]))[0].r, 'ESSAI_EXPIRE');
  assert.equal((await q(`select public.trial_check($1, 'render', null, null) as r`, [P2D1.id]))[0].r, null);
  // Reprise d'une réservation déjà faite : toujours reconnue, sans rien relancer.
  assert.equal((await trialClaim(P2, P2D1.id, 'cle-p2-0001')).reason, 'REJEU');
  assert.equal((await trialSlots(P2)).length, 1);
});

const P3D1 = await trialDossier(P3, 'Essai P3 — dossier 1');
const P3D2 = await trialDossier(P3, 'Essai P3 — dossier 2');
await test('Essai : suspension par un administrateur, budget individuel, plafond global', async () => {
  assert.equal((await trialOpen(P3)).reason, 'OUVERT');
  const P4 = await newUser('prospect-quatre@test.local');
  assert.equal((await trialOpen(P4)).reason, 'PLAFOND_GLOBAL_ATTEINT', '3 essais ouverts, plafond 3');
  assert.equal((await trialClaim(P3, P3D1.id, 'cle-p3-0001')).slot, 1);
  assert.equal(await openJobs(P3D1.id, 'extract'), 1);
  await asUser(P3);
  await rejects(q(`select public.trial_admin_suspend($1, 'auto-suspension')`, [P3]), /FORBIDDEN/);
  await asUser(P3);
  await rejects(q('select public.trial_admin_resume($1)', [P3]), /FORBIDDEN/);
  await asUser(P3);
  await rejects(q('select public.trial_admin_set_budget($1, 99999)', [P3]), /FORBIDDEN/);
  await asUser(ADMIN);
  await rejects(q(`select public.trial_admin_suspend($1, ' ')`, [P3]), /MOTIF_REQUIS/);
  await asUser(ADMIN);
  await q(`select public.trial_admin_suspend($1, 'usage abusif présumé')`, [P3]);
  const jx = await jobOf(P3D1.id, 'extract');
  assert.equal(await openJobs(P3D1.id, 'extract'), 0, 'travaux en attente annulés');
  assert.equal(await openJobs(P3D1.id, 'consolidate'), 0);
  assert.equal((await trialClaim(P3, P3D2.id, 'cle-p3-0002')).reason, 'ESSAI_SUSPENDU');
  await asService();
  assert.equal((await q('select public.trial_allows($1, 1) as r', [jx]))[0].r, 'ESSAI_SUSPENDU');
  await asSuperuser();
  await q(`select public.ai_enqueue($1, 'extract', $2)`, [P3D1.id, P3D1.docs[0]]);
  assert.equal(await openJobs(P3D1.id, 'extract'), 0, 'suspendu : rien n\'est remis en file');
  // Reprise, puis budget individuel épuisé.
  await asUser(ADMIN);
  await q('select public.trial_admin_resume($1)', [P3]);
  await asUser(ADMIN);
  await q('select public.trial_admin_set_budget($1, 0)', [P3]);
  assert.equal((await trialClaim(P3, P3D2.id, 'cle-p3-0002')).reason, 'BUDGET_ESSAI_EPUISE');
  await asService();
  assert.equal((await q(`select public.trial_check($1, 'extract', $2, 1) as r`, [P3D1.id, P3D1.docs[0]]))[0].r, 'BUDGET_ESSAI_EPUISE');
  await asUser(ADMIN);
  await q('select public.trial_admin_set_budget($1, 500)', [P3]);
  assert.equal((await trialClaim(P3, P3D2.id, 'cle-p3-0002')).slot, 2);
  // Interrupteur global : fermeture = arrêt immédiat des lectures d'essai.
  await asUser(ADMIN);
  await q('select public.trial_admin_configure(false, null, null, null)');
  await asService();
  assert.equal((await q(`select public.trial_check($1, 'extract', $2, 1) as r`, [P3D2.id, P3D2.docs[0]]))[0].r, 'ESSAIS_FERMES');
  await asUser(ADMIN);
  await q('select public.trial_admin_configure(true, null, null, null)');
  await asSuperuser();
  const kinds = (await q(`select kind from public.trial_events where user_id = $1`, [P3])).map((e) => e.kind);
  for (const k of ['ouverture', 'suspension', 'reprise', 'budget_modifie', 'emplacement_reserve', 'emplacement_refuse']) assert.ok(kinds.includes(k), `journal : ${k}`);
});

await test('Essai : isolation RLS — un prospect ne voit que son essai ; journal et réglages réservés à l\'administration', async () => {
  await asUser(P2);
  const mine = await q('select user_id from public.trial_accounts');
  assert.deepEqual(mine.map((r) => r.user_id), [P2]);
  const slots = await q('select dossier_id from public.trial_slots');
  assert.deepEqual(slots.map((r) => r.dossier_id), [P2D1.id]);
  assert.equal((await q('select 1 from public.trial_events')).length, 0, 'journal privé');
  assert.equal((await q('select 1 from public.trial_settings')).length, 0);
  await asUser(P3);
  assert.deepEqual((await q('select user_id from public.trial_accounts')).map((r) => r.user_id), [P3]);
  assert.equal((await q('select 1 from public.trial_slots where dossier_id = $1', [P2D1.id])).length, 0, 'P3 ne voit pas l\'emplacement de P2');
  assert.equal((await q('select 1 from public.trial_events')).length, 0, 'motif de suspension invisible du prospect');
  await asUser(A);
  assert.equal((await q('select 1 from public.trial_accounts')).length, 0);
  assert.equal((await q('select 1 from public.trial_slots')).length, 0);
  await asAnon();
  assert.equal((await q('select 1 from public.trial_accounts').catch(() => [])).length, 0);
  assert.equal((await q('select 1 from public.trial_slots').catch(() => [])).length, 0);
  await asUser(P3);
  await rejects(q(`insert into public.trial_events (kind) values ('faux')`), /row-level security/);
  await asUser(P3);
  await rejects(q(`insert into public.trial_accounts (user_id, email_fingerprint, expires_at, budget_cents) values ($1, 'x', now() + interval '1 day', 1)`, [A]), /row-level security/);
  await asUser(ADMIN);
  assert.equal((await q('select 1 from public.trial_accounts')).length, 3);
  assert.ok((await q('select 1 from public.trial_events')).length > 10);
  assert.equal((await q('select 1 from public.trial_settings')).length, 1);
});

await test('Essai : abonnés strictement inchangés ; un prospect devenu abonné sort du périmètre de l\'essai', async () => {
  // Abonné sans essai : même mise en file qu'avant, aucun passage par le journal d'essai.
  await asSuperuser();
  const events = (await q('select count(*)::int n from public.trial_events'))[0].n;
  const SUB = await newUser('abonne-sans-essai@test.local');
  await subscribe(SUB, 'essentiel');
  const D = await insertDossier(SUB, { title: 'Abonné — dossier' });
  await addPiece(SUB, D, 'avant.pdf');
  await asUser(SUB);
  await q('select public.enable_ai_processing($1, $2)', [D, 'ia-2026-10']);
  const second = await addPiece(SUB, D, 'apres.pdf');
  assert.equal(await openJobs(D, 'extract'), 2, 'pièce ajoutée après activation : mise en file (pas de manifeste)');
  assert.equal(await openJobs(D, 'consolidate'), 1);
  const jx = await jobOf(D, 'extract');
  const jc = await jobOf(D, 'consolidate');
  await asService();
  assert.equal((await q('select public.trial_allows($1, 9999) as r', [jx]))[0].r, null);
  assert.equal((await q('select public.trial_allows($1, null) as r', [jc]))[0].r, null);
  assert.equal((await q(`select public.trial_check($1, 'extract', $2, 9999) as r`, [D, second]))[0].r, null);
  assert.equal((await q('select public.ai_quota_allows_pages($1, 51) as a', [SUB]))[0].a, false, 'quota de l\'offre toujours appliqué');
  await q(`insert into public.ai_extractions (dossier_id, user_id, document_id, status, pages, cost_cents) values ($1, $2, $3, 'ok', 2, 5)`, [D, SUB, second]);
  await asSuperuser();
  assert.equal((await q('select count(*)::int n from public.trial_events'))[0].n, events, 'aucune trace d\'essai pour un abonné');
  assert.equal((await q('select count(*)::int n from public.trial_accounts where user_id = $1', [SUB]))[0].n, 0);
  // Une fermeture des essais n'affecte pas l'abonné.
  await asUser(ADMIN);
  await q('select public.trial_admin_configure(false, null, null, null)');
  await addPiece(SUB, D, 'encore.pdf');
  assert.equal(await openJobs(D, 'extract'), 3);
  await asUser(ADMIN);
  await q('select public.trial_admin_configure(true, null, null, null)');
  // Prospect P3 (2 emplacements pris) : pièce tardive refusée, puis il s'abonne → règles de l'offre.
  const late = await addPiece(P3, P3D2.id, 'tardive.pdf');
  await asSuperuser();
  assert.equal((await q('select 1 from public.ai_jobs where document_id = $1', [late])).length, 0);
  await subscribe(P3, 'essentiel');
  const after = await addPiece(P3, P3D2.id, 'apres-abonnement.pdf');
  await asSuperuser();
  assert.equal((await q(`select 1 from public.ai_jobs where document_id = $1 and status = 'queued'`, [after])).length, 1, 'abonné : plus de manifeste');
  const D3 = await insertDossier(P3, { title: 'P3 abonné — 3e dossier' });
  await asUser(P3);
  await q('select public.enable_ai_processing($1, $2)', [D3, 'ia-2026-10']);
  assert.ok((await q('select enabled_at from public.dossier_ai_settings where dossier_id = $1', [D3]))[0].enabled_at, 'troisième dossier : par abonnement uniquement');
});

await test('Essai : prospect devenu abonné — paiement en retard ou résiliation en période payée = toujours abonné ; abonnement terminé = essai de nouveau', async () => {
  // Revue adverse : la garde ne retenait que « active / trialing ». Or l'abonnement
  // courant (dossier_entitlement, quotas de l'offre) couvre aussi la période de grâce
  // Stripe (past_due) et la résiliation tant que la période payée court : un client
  // payant voyait ses deux premiers dossiers (ceux de l'essai) cesser d'être traités,
  // en silence, alors que ses autres dossiers continuaient.
  for (const [status, label] of [['past_due', 'paiement en retard'], ['canceled', 'résilié, période payée en cours']]) {
    await subscribe(P3, 'essentiel', { status });
    await asService();
    assert.ok((await q('select pages_limit from public.ai_quota_state($1)', [P3]))[0].pages_limit > 0, `${label} : quota de l'offre toujours ouvert`);
    const piece = await addPiece(P3, P3D2.id, `client-${status}.pdf`);
    await asSuperuser();
    assert.equal((await q(`select 1 from public.ai_jobs where document_id = $1 and status = 'queued'`, [piece])).length, 1, `${label} : dossier d'essai traité comme les autres dossiers du client`);
    const j = await jobOf(P3D2.id, 'extract');
    await asService();
    assert.equal((await q('select public.trial_allows($1, 9999) as r', [j]))[0].r, null, `${label} : worker non bloqué par l'essai`);
  }
  // Abonnement réellement terminé (période payée échue) : la garde d'essai s'applique de nouveau.
  await subscribe(P3, 'essentiel', { status: 'canceled', start: new Date(Date.now() - 40 * 86400000).toISOString(), end: new Date(Date.now() - 86400000).toISOString() });
  const apres = await addPiece(P3, P3D2.id, 'apres-fin-abonnement.pdf');
  await asSuperuser();
  assert.equal((await q('select 1 from public.ai_jobs where document_id = $1', [apres])).length, 0, 'abonnement terminé : pièce hors manifeste refusée');
  await asUser(P3);
  await rejects(q('select public.enable_ai_processing($1, $2)', [P3D1.id, 'ia-2026-10']), /SUBSCRIPTION_REQUIRED/);
  // État attendu par le test de retour arrière : P3 abonné actif.
  await subscribe(P3, 'essentiel');
});

await test('Essai : retour arrière niveau 1 — garde retirée, dossiers d\'essai non abonnés désactivés, compteurs conservés', async () => {
  await asSuperuser();
  const slots = (await q('select count(*)::int n from public.trial_slots'))[0].n;
  const journal = (await q('select count(*)::int n from public.trial_events'))[0].n;
  await db.exec(readFileSync(join(root, 'supabase', 'rollback', '20261125120000_essai_prospect.down.sql'), 'utf8'));
  const [r] = await q(`select to_regprocedure('public.trial_claim_slot(uuid, uuid, text, text)') as c, to_regprocedure('public.trial_allows(uuid, integer)') as a,
                              to_regclass('public.trial_slots') as t,
                              (select count(*)::int from pg_trigger where tgname = 'ai_jobs_trial_gate') as g`);
  assert.deepEqual([r.c, r.a, r.g], [null, null, 0]);
  assert.ok(r.t, 'tables conservées');
  assert.equal((await q('select count(*)::int n from public.trial_slots'))[0].n, slots);
  assert.equal((await q('select count(*)::int n from public.trial_events'))[0].n, journal);
  assert.equal((await q('select enabled from public.trial_settings'))[0].enabled, false);
  assert.equal((await q('select enabled_at from public.dossier_ai_settings where dossier_id = $1', [P2D1.id]))[0].enabled_at, null, 'dossier d\'essai (non abonné) désactivé');
  assert.equal(await openJobs(P2D1.id, 'extract'), 0);
  assert.ok((await q('select enabled_at from public.dossier_ai_settings where dossier_id = $1', [P3D2.id]))[0].enabled_at, 'prospect devenu abonné : dossier laissé actif');
  await rejects(q('delete from public.trial_slots'), /ESSAI_IMMUABLE/);
});

// ── Messagerie directe (migration 20261125130000) ───────────────────────────
const MAIL_ENC = 'v1.' + 'A'.repeat(16) + '.' + 'B'.repeat(40);
await test('Messagerie directe : droit par offre, cloisonnement, jetons inaccessibles et jamais en clair', async () => {
  const MA = await newUser('mail-a@test.local');
  const MB = await newUser('mail-b@test.local');
  await subscribe(MA, 'essentiel');
  await asUser(MA);
  assert.equal((await q('select public.mail_connect_access() as ok'))[0].ok, false, 'Essentiel : non inclus');
  await rejects(q('select public.mail_connect_included($1)', [MA]), /permission denied/);
  await rejects(q('select public.mail_connection_has_reception($1)', [MA]), /permission denied/);
  await subscribe(MA, 'entrepreneur');
  await asUser(MA);
  assert.equal((await q('select public.mail_connect_access() as ok'))[0].ok, true, 'Entrepreneur : inclus');
  await asAnon();
  await rejects(q('select public.mail_connect_access()'), /permission denied/);

  // Aucune écriture directe par un client : ni connexion, ni message, ni jeton.
  await asUser(MA);
  await rejects(q(`insert into public.mail_connections (user_id, provider) values ($1, 'gmail')`, [MA]), /row-level security/);
  await asSuperuser();
  const [c] = await q(`insert into public.mail_connections (user_id, provider, address) values ($1, 'gmail', 'a@example.com') returning id, status, history_import, import_since`, [MA]);
  assert.equal(c.status, 'pending');
  assert.equal(c.history_import, false, 'historique global désactivé par défaut');
  assert.ok(Math.abs(Date.now() - new Date(c.import_since).getTime()) < 60_000, 'périmètre : à partir de la connexion');
  await rejects(q(`insert into public.mail_connections (user_id, provider) values ($1, 'yahoo')`, [MB]), /check/);

  // Jetons : format chiffré imposé par la base, table sans aucun accès client.
  await rejects(q(`insert into public.mail_connection_tokens (connection_id, refresh_token_enc) values ($1, '1//jeton-en-clair')`, [c.id]), /check/);
  await rejects(q(`insert into public.mail_connection_tokens (connection_id, refresh_token_enc, access_token_enc) values ($1, $2, 'ya29.en-clair')`, [c.id, MAIL_ENC]), /check/);
  await q(`insert into public.mail_connection_tokens (connection_id, refresh_token_enc, access_token_enc) values ($1, $2, $2)`, [c.id, MAIL_ENC]);
  for (const who of [MA, MB]) {
    await asUser(who);
    await rejects(q('select * from public.mail_connection_tokens'), /permission denied/);
    await rejects(q(`insert into public.mail_connection_tokens (connection_id, refresh_token_enc) values ($1, $2)`, [c.id, MAIL_ENC]), /permission denied/);
    await rejects(q('delete from public.mail_connection_tokens'), /permission denied/);
  }
  await asAnon();
  await rejects(q('select * from public.mail_connection_tokens'), /permission denied/);
  await asSuperuser();
  const [rls] = await (q(`select relrowsecurity as on, (select count(*)::int from pg_policies where tablename = 'mail_connection_tokens') as policies from pg_class where oid = 'public.mail_connection_tokens'::regclass`));
  assert.equal(rls.on, true);
  assert.equal(rls.policies, 0, 'aucune policy : rôle serveur seul');

  // Cloisonnement : le titulaire lit sa connexion, pas un autre compte.
  await asUser(MA);
  assert.equal((await q('select count(*)::int n from public.mail_connections'))[0].n, 1);
  await q(`update public.mail_connections set status = 'connected', address = 'pirate@example.com'`);
  await asUser(MB);
  assert.equal((await q('select count(*)::int n from public.mail_connections'))[0].n, 0, 'B ne voit pas la connexion de A');
  await asSuperuser();
  const [still] = await q('select status, address from public.mail_connections where id = $1', [c.id]);
  assert.deepEqual([still.status, still.address], ['pending', 'a@example.com'], 'aucune mise à jour directe par le client');

  // Une boîte n'est reliée qu'à un compte ; une connexion active par fournisseur.
  await rejects(q(`insert into public.mail_connections (user_id, provider, address) values ($1, 'gmail', 'A@Example.com')`, [MB]), /mail_connections_mailbox_once/);
  await rejects(q(`insert into public.mail_connections (user_id, provider, address) values ($1, 'gmail', 'autre@example.com')`, [MA]), /mail_connections_one_active/);
});

await test('Messagerie directe : « connected » après réception réelle, dédup, classement, pause/reprise, déconnexion', async () => {
  const MA = await newUser('mail-c@test.local');
  const MB = await newUser('mail-d@test.local');
  await subscribe(MA, 'entrepreneur');
  await subscribe(MB, 'entrepreneur');
  const DA = await insertDossier(MA, { title: 'Dossier messagerie' });
  const DB = await insertDossier(MB, { title: 'Dossier de B' });
  await asSuperuser();
  const [c] = await q(`insert into public.mail_connections (user_id, provider, address, sync_cursor, subscription_id, watch_expires_at) values ($1, 'microsoft', 'c@contoso.com', 'https://graph.microsoft.com/v1.0/x', 'sub-1', now() + interval '3 days') returning id`, [MA]);
  await q(`insert into public.mail_connection_tokens (connection_id, refresh_token_enc) values ($1, $2)`, [c.id, MAIL_ENC]);

  // « connected » refusé tant qu'aucun message réel n'est enregistré.
  await rejects(q(`update public.mail_connections set status = 'connected' where id = $1`, [c.id]), /MAIL_CONNECTED_REQUIRES_RECEPTION/);
  await rejects(q(`insert into public.mail_connections (user_id, provider, status) values ($1, 'gmail', 'connected')`, [MA]), /MAIL_CONNECTED_REQUIRES_RECEPTION/);
  // Un message hors périmètre (filtered) ou en cours (received) ne confirme rien.
  await q(`insert into public.mail_messages (connection_id, user_id, provider, message_id, status) values ($1, $2, 'microsoft', 'hors-perimetre', 'filtered'), ($1, $2, 'microsoft', 'en-cours', 'received')`, [c.id, MA]);
  await rejects(q(`update public.mail_connections set status = 'connected' where id = $1`, [c.id]), /MAIL_CONNECTED_REQUIRES_RECEPTION/);
  const [m1] = await q(`insert into public.mail_messages (connection_id, user_id, provider, message_id, from_addr, subject, status, suggested_dossier_id) values ($1, $2, 'microsoft', 'M1', 'f@example.org', 'Contrat', 'a_classer', $3) returning id`, [c.id, MA, DA]);
  await q(`update public.mail_connections set status = 'connected' where id = $1`, [c.id]);

  // Dédup : fournisseur + identifiant, par compte.
  await rejects(q(`insert into public.mail_messages (connection_id, user_id, provider, message_id) values ($1, $2, 'microsoft', 'M1')`, [c.id, MA]), /mail_messages_dedup/);
  const [cb] = await q(`insert into public.mail_connections (user_id, provider, address) values ($1, 'microsoft', 'd@contoso.com') returning id`, [MB]);
  await q(`insert into public.mail_messages (connection_id, user_id, provider, message_id, status) values ($1, $2, 'microsoft', 'M1', 'a_classer')`, [cb.id, MB]);

  // Cloisonnement des messages et du journal ; aucune écriture directe.
  await asUser(MB);
  assert.equal((await q(`select count(*)::int n from public.mail_messages where user_id = $1`, [MA]))[0].n, 0, 'B ne voit pas les messages de A');
  await rejects(q('select public.mail_message_assign($1, $2)', [m1.id, DB]), /FORBIDDEN/);
  await rejects(q('select public.mail_message_ignore($1)', [m1.id]), /FORBIDDEN/);
  await rejects(q('select public.mail_connection_pause($1)', [c.id]), /FORBIDDEN/);
  await rejects(q('select public.mail_connection_resume($1)', [c.id]), /FORBIDDEN/);
  await rejects(q('select public.mail_connection_disconnect($1)', [c.id]), /FORBIDDEN/);
  await asUser(MA);
  assert.equal((await q('select count(*)::int n from public.mail_messages'))[0].n, 3);
  await q(`update public.mail_messages set status = 'stored', dossier_id = $1`, [DA]);
  await rejects(q(`insert into public.mail_messages (connection_id, user_id, provider, message_id) values ($1, $2, 'microsoft', 'faux')`, [c.id, MA]), /row-level security/);
  await rejects(q(`insert into public.mail_connection_events (connection_id, user_id, type) values ($1, $2, 'faux')`, [c.id, MA]), /row-level security/);
  assert.equal((await q(`select status from public.mail_messages where id = $1`, [m1.id]))[0].status, 'a_classer', 'aucune mise à jour directe');
  // Aucune remise à zéro par suppression directe (dédup, réception, journal).
  await q('delete from public.mail_messages');
  await q('delete from public.mail_connection_events');
  await q('delete from public.mail_connections');
  assert.equal((await q('select count(*)::int n from public.mail_messages'))[0].n, 3, 'aucune suppression directe');
  assert.equal((await q('select count(*)::int n from public.mail_connections'))[0].n, 1, 'aucune suppression directe');
  // Le classement ne vaut que pour SON message : celui d'un autre compte, même
  // vers le dossier de ce compte, est refusé (paramètres d'un autre utilisateur).
  await asUser(MB);
  await rejects(q('select public.mail_message_assign($1, $2)', [m1.id, DA]), /FORBIDDEN/);
  await asUser(MA);

  // Classement par le titulaire : dossier d'un autre refusé, puis mise en file.
  await rejects(q('select public.mail_message_assign($1, $2)', [m1.id, DB]), /FORBIDDEN/);
  await q('select public.mail_message_assign($1, $2)', [m1.id, DA]);
  const [queued] = await q('select status, dossier_id, classified_at from public.mail_messages where id = $1', [m1.id]);
  assert.deepEqual([queued.status, queued.dossier_id], ['queued', DA]);
  assert.ok(queued.classified_at);
  await rejects(q('select public.mail_message_assign($1, $2)', [m1.id, DA]), /MAIL_MESSAGE_NOT_PENDING/);
  await rejects(q('select public.mail_message_ignore($1)', [m1.id]), /MAIL_MESSAGE_NOT_PENDING/);
  await asSuperuser();
  const [m2] = await q(`insert into public.mail_messages (connection_id, user_id, provider, message_id, status) values ($1, $2, 'microsoft', 'M2', 'a_classer') returning id`, [c.id, MA]);
  await q(`insert into public.dossier_events (dossier_id, user_id, type, label) values ($1, $2, 'dossier_cloture', 'Dossier clôturé')`, [DA, MA]);
  await asUser(MA);
  await rejects(q('select public.mail_message_assign($1, $2)', [m2.id, DA]), /DOSSIER_CLOTURE/);
  await q('select public.mail_message_ignore($1)', [m2.id]);
  assert.equal((await q('select status from public.mail_messages where id = $1', [m2.id]))[0].status, 'ignored');

  // Pause puis reprise : le périmètre repart de maintenant, curseur remis à zéro.
  await asSuperuser();
  await q(`update public.mail_connections set import_since = now() - interval '10 days' where id = $1`, [c.id]);
  await asUser(MA);
  await q('select public.mail_connection_pause($1)', [c.id]);
  await q('select public.mail_connection_pause($1)', [c.id]);
  assert.equal((await q('select status from public.mail_connections where id = $1', [c.id]))[0].status, 'paused');
  await subscribe(MA, 'essentiel');
  await asUser(MA);
  await rejects(q('select public.mail_connection_resume($1)', [c.id]), /FEATURE_NOT_INCLUDED/);
  await subscribe(MA, 'entrepreneur');
  await asUser(MA);
  await q('select public.mail_connection_resume($1)', [c.id]);
  const [res] = await q('select status, sync_cursor, watch_expires_at, import_since from public.mail_connections where id = $1', [c.id]);
  assert.equal(res.status, 'connected', 'déjà confirmée par une réception réelle');
  assert.equal(res.sync_cursor, null);
  assert.equal(res.watch_expires_at, null);
  assert.ok(Date.now() - new Date(res.import_since).getTime() < 60_000, 'rien de la pause n’est importé');
  assert.equal((await q(`select count(*)::int n from public.mail_connection_events where connection_id = $1 and type in ('pause', 'reprise')`, [c.id]))[0].n, 2);
  // Reprise d'une connexion jamais confirmée : retour à « pending », pas « connected ».
  await asSuperuser();
  await q(`delete from public.mail_messages where connection_id = $1`, [cb.id]);
  await asUser(MB);
  await q('select public.mail_connection_pause($1)', [cb.id]);
  await q('select public.mail_connection_resume($1)', [cb.id]);
  assert.equal((await q('select status from public.mail_connections where id = $1', [cb.id]))[0].status, 'pending');

  // Déconnexion : statut révoqué ET jetons effacés ; historique conservé ; terminal.
  await asUser(MA);
  await q('select public.mail_connection_disconnect($1)', [c.id]);
  const [rev] = await q('select status, revoked_at, sync_cursor, subscription_id from public.mail_connections where id = $1', [c.id]);
  assert.equal(rev.status, 'revoked');
  assert.ok(rev.revoked_at);
  assert.deepEqual([rev.sync_cursor, rev.subscription_id], [null, null]);
  assert.equal((await q('select count(*)::int n from public.mail_messages where connection_id = $1', [c.id]))[0].n, 4, 'historique conservé');
  await rejects(q('select public.mail_connection_resume($1)', [c.id]), /MAIL_CONNECTION_REVOKED/);
  await rejects(q('select public.mail_connection_pause($1)', [c.id]), /MAIL_CONNECTION_REVOKED/);
  await q('select public.mail_connection_disconnect($1)', [c.id]);
  await asSuperuser();
  assert.equal((await q('select count(*)::int n from public.mail_connection_tokens where connection_id = $1', [c.id]))[0].n, 0, 'jetons effacés');
  await rejects(q(`update public.mail_connections set status = 'pending' where id = $1`, [c.id]), /MAIL_CONNECTION_REVOKED/);
  // Reconnecter = nouvelle connexion (nouvelle autorisation), même boîte possible.
  await q(`insert into public.mail_connections (user_id, provider, address) values ($1, 'microsoft', 'c@contoso.com')`, [MA]);
});

await test('Messagerie directe : retour arrière niveau 1 — jetons effacés, connexions révoquées, historique conservé', async () => {
  await asSuperuser();
  const messages = (await q('select count(*)::int n from public.mail_messages'))[0].n;
  assert.ok((await q(`select count(*)::int n from public.mail_connections where status <> 'revoked'`))[0].n > 0);
  await db.exec(readFileSync(join(root, 'supabase', 'rollback', '20261125130000_messagerie_directe.down.sql'), 'utf8'));
  assert.equal((await q('select count(*)::int n from public.mail_connection_tokens'))[0].n, 0);
  assert.equal((await q(`select count(*)::int n from public.mail_connections where status <> 'revoked'`))[0].n, 0);
  assert.equal((await q('select count(*)::int n from public.mail_messages'))[0].n, messages, 'historique conservé');
  const [r] = await q(`select to_regprocedure('public.mail_connection_resume(uuid)') as r, to_regprocedure('public.mail_connect_access()') as a, to_regclass('public.mail_connections') as t`);
  assert.equal(r.r, null);
  assert.equal(r.a, null);
  assert.ok(r.t, 'tables conservées');
  // La migration est rejouable après le retour arrière (idempotente).
  await db.exec(readFileSync(join(root, 'supabase', 'migrations', '20261125130000_messagerie_directe.sql'), 'utf8'));
  assert.ok((await q(`select to_regprocedure('public.mail_connection_resume(uuid)') as r`))[0].r);
});

// ── Supervision fondateur (migration 20261125140000) ────────────────────────
await test('Supervision : lecture agrégée — non-admin refusé, agrégats exacts, aucun contenu', async () => {
  const alerte = (o, code) => o.alertes.find((a) => a.code === code)?.valeur ?? 0;
  const overview = async () => (await q('select public.admin_supervision_overview() as o'))[0].o;
  // Refus : anonyme, client, écriture directe des réglages.
  await asAnon();
  await rejects(q('select public.admin_supervision_overview()'), /permission denied/);
  await asUser(A);
  await rejects(q('select public.admin_supervision_overview()'), /FORBIDDEN/);
  await rejects(q(`select public.ai_admin_set_pause(true, 'tentative client')`), /FORBIDDEN/);
  await rejects(q('select public.ai_admin_set_budget_alert(100)'), /FORBIDDEN/);
  assert.equal((await q('select * from public.ai_engine_control')).length, 0, 'client : réglages illisibles');
  await asUser(ADMIN);
  await q('update public.ai_engine_control set paused_at = now()');
  await asSuperuser();
  assert.equal((await q('select paused_at from public.ai_engine_control'))[0].paused_at, null, 'aucune écriture directe, même admin');

  await asUser(ADMIN);
  const before = await overview();
  assert.equal(before.version, 1);
  assert.equal(before.moteur.installe, true);
  assert.equal(before.moteur.en_pause, false);

  // Données fictives : deux comptes, pièces, extractions, travaux, e-mails.
  const S1 = await newUser('supervision-1@test.local');
  const S2 = await newUser('supervision-2@test.local');
  await subscribe(S1, 'essentiel'); // 50 pages, 0 action
  await subscribe(S2, 'entrepreneur'); // 150 pages, 20 actions
  const D1 = await insertDossier(S1, { title: 'Titre confidentiel S1' });
  const D2 = await insertDossier(S2, { title: 'Titre confidentiel S2' });
  await asSuperuser();
  const doc = async (d, u, name, size, deleted = false) => (await q(
    `insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind, size_bytes, deleted_at)
     values ($1::uuid, $2::uuid, $2::text || '/' || $1::text || '/' || $3::text, $3::text, 'piece', $4::bigint,
             case when $5::boolean then now() end) returning id`,
    [d, u, name, size, deleted],
  ))[0].id;
  const d1a = await doc(D1, S1, 'secret-contrat.pdf', 1000);
  await doc(D1, S1, 'secret-corbeille.pdf', 2500, true);
  await doc(D1, S1, 'secret-sans-taille.pdf', null);
  const d2a = await doc(D2, S2, 'secret-facture.pdf', 4000);
  await q(`insert into public.ai_extractions (dossier_id, user_id, document_id, status, pages, cost_cents, data)
           values ($1, $2, $3, 'ok', 45, 12.5, '{"texte":"contenu extrait confidentiel"}')`, [D1, S1, d1a]);
  await q(`insert into public.ai_extractions (dossier_id, user_id, document_id, status, pages, cost_cents)
           values ($1, $2, $3, 'ok', 150, 30)`, [D2, S2, d2a]);
  await q(`insert into public.ai_analyses (dossier_id, user_id, revision, data, cost_cents)
           values ($1, $2, 1, '{"resume":"synthèse confidentielle"}', 7.5)`, [D1, S1]);
  const job = async (kind, status, attempts, runAfter, lastError, finished) => (await q(
    `insert into public.ai_jobs (dossier_id, user_id, kind, status, attempts, run_after, last_error, finished_at)
     values ($1, $2, $3, $4, $5, now() - $6::interval, $7, case when $8::boolean then now() end) returning id`,
    [D1, S1, kind, status, attempts, runAfter, lastError, finished],
  ))[0].id;
  const stuck = await job('consolidate', 'queued', 1, '2 hours', 'erreur passagère boom', false);
  await job('extract', 'failed', 3, '0 seconds', 'erreur définitive boom', true);
  await job('render', 'failed', 3, '0 seconds', 'erreur définitive boom', true);
  await job('extract', 'failed', 3, '0 seconds', 'traitement interrompu (délai dépassé ou panne du worker)', true);
  await job('extract', 'failed', 1, '0 seconds', 'BUDGET: plafond mensuel atteint — traitement en pause', true);
  await job('publish', 'done', 1, '0 seconds', null, true);
  await q(`insert into public.inbound_emails (user_id, dossier_id, provider_email_id, from_addr, subject, status)
           values ($1, $2, 'sup_err', 'exp@externe.fr', 'Objet confidentiel', 'error'),
                  ($1, $2, 'sup_ok', 'exp@externe.fr', 'Objet confidentiel', 'stored')`, [S1, D1]);

  await asUser(ADMIN);
  const o = await overview();
  const at = (obj, path) => path.split('.').reduce((v, k) => v?.[k], obj) ?? 0;
  const delta = (path) => at(o, path) - at(before, path);
  // File : états, reprises, blocages, échecs par catégorie.
  assert.equal(delta('file.par_statut.queued'), 1);
  assert.equal(delta('file.par_statut.failed'), 4);
  assert.equal(delta('file.par_statut.done'), 1);
  assert.equal(delta('file.bloques'), 1);
  assert.equal(delta('file.reprises_en_cours'), 1);
  assert.equal(delta('file.termines_24h'), 1);
  assert.equal(delta('file.echecs_24h'), 4);
  assert.equal(delta('file.echecs_definitifs_7j'), 3, 'hors pauses budget');
  assert.equal(delta('file.pauses_budget_mois'), 1);
  assert.equal(delta('file.erreurs_30j.budget_ou_quota'), 1);
  assert.equal(delta('file.erreurs_30j.interruption'), 1);
  assert.equal(delta('file.erreurs_30j.autre'), 2);
  assert.equal(delta('file.dossiers_multi_echecs_7j'), 1);
  assert.equal(delta('file.ouverts_par_type.consolidate'), 1);
  // Traitements, coût global, e-mails, stockage, abonnements.
  assert.equal(delta('traitements_mois.extractions_ok'), 2);
  assert.equal(delta('traitements_mois.pages_lues'), 195);
  assert.equal(delta('traitements_mois.analyses'), 1);
  assert.equal(delta('budget.cout_global_mois_cents'), 50);
  assert.equal(delta('emails_entrants.recus_30j'), 2);
  assert.equal(delta('emails_entrants.stockes_30j'), 1);
  assert.equal(delta('emails_entrants.en_erreur_7j'), 1);
  assert.equal(delta('stockage.octets'), 7500);
  assert.equal(delta('stockage.documents'), 4);
  assert.equal(delta('stockage.documents_sans_taille'), 1);
  assert.equal(delta('stockage.octets_corbeille'), 2500);
  assert.equal(delta('abonnements.par_statut.active'), 2);
  assert.equal(delta('abonnements.en_cours_par_offre.essentiel'), 1);
  assert.equal(delta('abonnements.en_cours_par_offre.entrepreneur'), 1);
  assert.equal(delta('comptes_total'), 2);
  // Par compte : valeurs exactes.
  const c1 = o.comptes.find((c) => c.user_id === S1);
  const c2 = o.comptes.find((c) => c.user_id === S2);
  assert.deepEqual(c1, {
    user_id: S1, offre: 'essentiel', statut_abonnement: 'active', cout_ia_mois_cents: 20,
    pages_utilisees: 45, pages_limite: 50, actions_utilisees: 0, actions_limite: 0, quota_pct: 90,
    octets: 3500, documents: 3, dossiers: 1,
  });
  assert.equal(c2.cout_ia_mois_cents, 30);
  assert.equal(c2.quota_pct, 100);
  assert.equal(c2.pages_limite, 150);
  assert.equal(c2.actions_limite, 20);
  assert.equal(c2.octets, 4000);
  assert.ok(o.comptes.indexOf(c2) < o.comptes.indexOf(c1), 'tri : coût décroissant');
  // Alertes de saturation.
  assert.equal(alerte(o, 'QUOTA_80') - alerte(before, 'QUOTA_80'), 1);
  assert.equal(alerte(o, 'QUOTA_ATTEINT') - alerte(before, 'QUOTA_ATTEINT'), 1);
  assert.equal(alerte(o, 'FILE_BLOQUEE'), o.file.bloques);
  assert.equal(alerte(o, 'ECHECS_REPETES'), o.file.echecs_definitifs_7j);
  assert.equal(alerte(o, 'PAUSES_BUDGET'), o.file.pauses_budget_mois);
  assert.equal(alerte(o, 'EMAILS_EN_ERREUR'), o.emails_entrants.en_erreur_7j);
  assert.equal(alerte(o, 'BUDGET_GLOBAL_80') + alerte(o, 'BUDGET_GLOBAL_ATTEINT'), 0, 'sans repère : aucune alerte budget');
  // Repère d'alerte du budget global : 80 % puis atteint ; valeur invalide refusée.
  const G = o.budget.cout_global_mois_cents;
  await rejects(q('select public.ai_admin_set_budget_alert(0)'), /PARAMETRE_INVALIDE/);
  await q('select public.ai_admin_set_budget_alert($1)', [Math.ceil(G / 0.9)]);
  const o80 = await overview();
  assert.ok(alerte(o80, 'BUDGET_GLOBAL_80') >= 80 && alerte(o80, 'BUDGET_GLOBAL_80') < 100);
  assert.equal(o80.budget.repere_alerte_cents, Math.ceil(G / 0.9));
  await q('select public.ai_admin_set_budget_alert($1)', [Math.max(1, Math.floor(G))]);
  assert.ok(alerte(await overview(), 'BUDGET_GLOBAL_ATTEINT') >= 100);
  await q('select public.ai_admin_set_budget_alert(null)');
  assert.equal((await overview()).budget.repere_alerte_cents, null);
  // Aucun contenu : ni nom de fichier, ni titre, ni texte extrait, ni libellé d'erreur, ni e-mail.
  const brut = JSON.stringify(o);
  for (const interdit of ['secret-', 'onfidentiel', 'boom', 'plafond mensuel', '@']) {
    assert.ok(!brut.includes(interdit), `fuite : ${interdit}`);
  }
  // Historique des actions : super admin seul ; l'admin support lit le reste.
  assert.equal(o.actions_admin.visible, true);
  assert.ok(o.actions_admin.dernieres.length <= 30);
  await asUser(SUPPORT);
  const os = await overview();
  assert.equal(os.actions_admin.visible, false);
  assert.equal(os.actions_admin.dernieres, undefined);
  assert.equal(os.abonnements.derogations_actives, null);
  assert.equal(os.file.par_statut.failed, o.file.par_statut.failed);

  // Pause sécurisée : motif obligatoire, plus rien n'est réclamé, journalisée, réversible.
  await asUser(ADMIN);
  await rejects(q(`select public.ai_admin_set_pause(true, ' ')`), /MOTIF_REQUIS/);
  await q(`select public.ai_admin_set_pause(true, 'maintenance de recette')`);
  const op = await overview();
  assert.equal(op.moteur.en_pause, true);
  assert.equal(alerte(op, 'MOTEUR_EN_PAUSE'), 1);
  assert.equal(alerte(op, 'FILE_BLOQUEE'), 0, 'en pause : l’attente en file n’est pas une alerte');
  assert.ok(!JSON.stringify(op).includes('maintenance de recette'), 'le motif reste hors de la lecture agrégée');
  const depuis = op.moteur.en_pause_depuis;
  await q(`select public.ai_admin_set_pause(true, 'second appel')`);
  assert.equal((await overview()).moteur.en_pause_depuis, depuis, 'pause idempotente : date d’origine conservée');
  await asService();
  assert.equal((await q(`select id from public.ai_claim_jobs('pause', 20)`)).length, 0, 'en pause : rien n’est réclamé');
  await asUser(A);
  await rejects(q(`select * from public.ai_claim_jobs('client', 1)`), /FORBIDDEN|permission denied/);
  await asSuperuser();
  const [still] = await q('select status, attempts from public.ai_jobs where id = $1', [stuck]);
  assert.deepEqual(still, { status: 'queued', attempts: 1 }, 'travail intact pendant la pause');
  await asUser(ADMIN);
  await q('select public.ai_admin_set_pause(false)');
  assert.equal((await overview()).moteur.en_pause, false);
  await asService();
  const repris = await q(`select id from public.ai_claim_jobs('reprise', 20)`);
  assert.ok(repris.some((j) => j.id === stuck), 'reprise : le travail en attente est réclamé');
  await asSuperuser();
  const journal = await q(`select action, actor_id, metadata from public.audit_logs where action like 'ia_moteur_%' order by created_at, action`);
  assert.deepEqual(journal.map((j) => j.action).sort(), ['ia_moteur_pause', 'ia_moteur_pause', 'ia_moteur_reprise']);
  assert.ok(journal.every((j) => j.actor_id === ADMIN));
  assert.ok(journal.some((j) => j.metadata.motif === 'maintenance de recette'));
  await asUser(ADMIN);
  assert.ok((await overview()).actions_admin.par_action_30j.ia_moteur_reprise >= 1);
});

// Dernier test : le retour arrière modifie le schéma pour la suite.
await test('IA : retour arrière niveau 1 — moteur neutralisé, données conservées', async () => {
  const D = await insertDossier(IA_C, { title: 'Avant retour arrière' });
  await asUser(IA_C);
  await q('select public.enable_ai_processing($1, $2)', [D, 'ia-2026-10']);
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1::uuid, $2::uuid, $2::text || '/' || $1::text || '/a.pdf', 'a.pdf', 'piece')`, [D, IA_C]);
  assert.equal(await openJobs(D, 'extract'), 1);
  await asSuperuser();
  const before = (await q('select count(*)::int n from public.ai_jobs'))[0].n;
  await db.exec(readFileSync(join(root, 'supabase', 'rollback', '20261023120000_moteur_documentaire_ia.down.sql'), 'utf8'));
  assert.equal(await openJobs(D, 'extract'), 0, 'travaux ouverts annulés');
  assert.equal((await q('select count(*)::int n from public.ai_jobs'))[0].n, before, 'historique conservé');
  assert.equal((await q('select public.ai_engine_enabled() as on'))[0].on, false);
  await asUser(IA_C);
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1::uuid, $2::uuid, $2::text || '/' || $1::text || '/b.pdf', 'b.pdf', 'piece')`, [D, IA_C]);
  assert.equal(await openJobs(D, 'extract'), 0, 'nouvelle pièce : aucune mise en file');
  await asUser(IA_C);
  await rejects(q('select public.enable_ai_processing($1, $2)', [D, 'ia-2026-10']), /permission denied/);
});

await test('IA : retour arrière 20261104 — fonctions retirées, bilans conservés', async () => {
  await asSuperuser();
  await db.exec(readFileSync(join(root, 'supabase', 'rollback', '20261104120000_ia_budget_global.down.sql'), 'utf8'));
  const [r] = await q(`select to_regprocedure('public.ai_global_month_cost_cents()') as g, to_regprocedure('public.ai_health_snapshot()') as h, to_regclass('public.ai_health_reports') as t`);
  assert.equal(r.g, null);
  assert.equal(r.h, null);
  assert.ok(r.t, 'table des bilans conservée');
});

await test('Supervision : retour arrière 20261125 — lecture retirée, file restaurée, réglages conservés', async () => {
  await asSuperuser();
  await q('update public.ai_engine_control set paused_at = now()');
  await db.exec(readFileSync(join(root, 'supabase', 'rollback', '20261125140000_supervision_fondateur.down.sql'), 'utf8'));
  const [r] = await q(`select to_regprocedure('public.admin_supervision_overview()') as o,
                              to_regprocedure('public.ai_admin_set_pause(boolean, text)') as p,
                              to_regclass('public.ai_engine_control') as t,
                              pg_get_functiondef('public.ai_claim_jobs(text, integer)'::regprocedure) as def`);
  assert.equal(r.o, null);
  assert.equal(r.p, null);
  assert.ok(r.t, 'réglages conservés');
  assert.ok(!r.def.includes('ai_engine_control'), 'ai_claim_jobs : corps d’origine');
  await asService();
  await q(`select id from public.ai_claim_jobs('apres-retour', 1)`);
  await asUser(A);
  await rejects(q(`select * from public.ai_claim_jobs('client', 1)`), /FORBIDDEN|permission denied/);
});

// Production au 2026-11-25 : moteur IA non installé (20261023 → 20261118 absentes).
// La supervision doit s'installer et répondre quand même (blocs IA à null).
await test('Supervision : installation sans le moteur IA — lecture disponible, blocs IA à null', async () => {
  const db2 = new PGlite();
  await db2.exec(STUBS);
  const insert = async (email) =>
    (await db2.query(`insert into auth.users (email, email_confirmed_at) values ($1, now()) returning id`, [email])).rows[0].id;
  const admin2 = await insert('prestige.seller@icloud.com');
  const sansIa = files.filter((f) => f < '20261023' || f.startsWith('20261103') || f.startsWith('20261125140000') || f.startsWith('20261125150000'));
  assert.ok(sansIa.includes('20261125140000_supervision_fondateur.sql'));
  for (const f of sansIa) {
    await db2.exec(readFileSync(join(root, 'supabase', 'migrations', f), 'utf8').replace(/create extension if not exists pg_net;/gi, ''));
  }
  const client2 = await insert('client@test.local');
  const as = (id) => db2.exec(`set role authenticated; set request.jwt.claims = '${JSON.stringify({ sub: id, role: 'authenticated' })}';`);
  const overview = async () => (await db2.query('select public.admin_supervision_overview() as o')).rows[0].o;
  await as(client2);
  await rejects(overview(), /FORBIDDEN/);
  await as(admin2);
  const o = await overview();
  assert.equal(o.moteur.installe, false);
  assert.equal(o.file, null);
  assert.equal(o.traitements_mois, null);
  assert.equal(o.emails_entrants, null);
  assert.equal(o.budget.cout_global_mois_cents, 0);
  assert.deepEqual(o.alertes, []);
  assert.equal(o.stockage.documents, 0);
  assert.equal(o.actions_admin.visible, true);
  await db2.query(`select public.ai_admin_set_pause(true, 'pause sans moteur')`);
  assert.equal((await overview()).moteur.en_pause, true);
  await db2.close();
});

console.log('\nClairDossier Intelligence dans l’espace client (20261126120000)');
await test('intelligence : installable sans le moteur IA (même base que la production actuelle)', async () => {
  const { PGlite } = await import('@electric-sql/pglite');
  const db3 = new PGlite();
  await db3.exec(STUBS);
  const sansIa = files.filter((f) => f < '20261023' || f.startsWith('20261103') || f.startsWith('20261125140000') || f.startsWith('20261125150000') || f.startsWith('20261126120000'));
  for (const f of sansIa) await db3.exec(readFileSync(join(root, 'supabase', 'migrations', f), 'utf8').replace(/create extension if not exists pg_net;/gi, ''));
  const r = await db3.query(`select to_regclass('public.client_automations') as t, to_regclass('public.ai_jobs') as ia`);
  assert.equal(r.rows[0].t, 'client_automations');
  assert.equal(r.rows[0].ia, null, 'le moteur IA n’est pas installé');
  await db3.close();
});
const IA = await newUser('ia.titulaire@test.fr');
const IB = await newUser('ia.autre@test.fr');
const IS = await newUser('ia.sans.abonnement@test.fr');
await subscribe(IA, 'essentiel', { status: 'active' });
await subscribe(IB, 'essentiel', { status: 'active' });
const dIA = await insertDossier(IA, { title: 'Bail commercial' });
const dIB = await insertDossier(IB, { title: 'Dossier de B' });
await test('intelligence : historique et préférences privés, rattachement au dossier d’autrui refusé', async () => {
  await asUser(IA);
  await q(`insert into public.assistant_turns (user_id, dossier_id, author, body) values ($1, $2, 'vous', 'Résume ce dossier')`, [IA, dIA]);
  await rejects(q(`insert into public.assistant_turns (user_id, dossier_id, author, body) values ($1, $2, 'vous', 'intrusion')`, [IA, dIB]), /row-level security/);
  await q(`insert into public.assistant_preferences (user_id, body) values ($1, 'Vouvoyer mes interlocuteurs')`, [IA]);
  await rejects(q(`insert into public.assistant_preferences (user_id, body) values ($1, 'VOUVOYER mes interlocuteurs')`, [IA]), /duplicate|unique/);
  await rejects(q(`insert into public.assistant_preferences (user_id, body) values ($1, 'x')`, [IB]), /row-level security/);
  for (let i = 0; i < 11; i++) await q(`insert into public.assistant_preferences (user_id, body) values ($1, $2)`, [IA, `Règle ${i}`]);
  await rejects(q(`insert into public.assistant_preferences (user_id, body) values ($1, 'Règle de trop')`, [IA]), /PREFERENCES_PLEINES/);
  await asUser(IB);
  assert.equal((await q('select count(*)::int as n from public.assistant_turns')).at(0).n, 0);
  assert.equal((await q('select count(*)::int as n from public.assistant_preferences')).at(0).n, 0);
});
await test('intelligence : automatisation créée seulement par un abonné, par fonction, rejouable sans doublon', async () => {
  await asUser(IS);
  await rejects(q(`select * from public.create_client_automation('bilan_dossiers', 'hebdo', 5::smallint, 8::smallint)`), /SUBSCRIPTION_REQUIRED/);
  await asUser(IA);
  await rejects(q(`insert into public.client_automations (user_id, action, frequence, title) values ($1, 'bilan_dossiers', 'quotidien', 'x')`, [IA]), /row-level security/);
  const [a1] = await q(`select * from public.create_client_automation('bilan_dossiers', 'hebdo', 5::smallint, 8::smallint)`);
  const [a2] = await q(`select * from public.create_client_automation('bilan_dossiers', 'hebdo', 5::smallint, 8::smallint)`);
  assert.equal(a1.id, a2.id, 'même demande confirmée deux fois = une seule automatisation');
  assert.ok(a1.next_run_at, 'prochaine échéance calculée');
  const local = (await q(`select to_char($1::timestamptz at time zone 'Europe/Paris', 'ID HH24:MI') as l`, [a1.next_run_at]))[0].l;
  assert.equal(local, '5 08:00', 'vendredi 8 h, heure de Paris');
  await asUser(IB);
  await rejects(q(`select * from public.set_client_automation_status($1, 'annuler')`, [a1.id]), /AUTOMATISATION_INTROUVABLE/);
  assert.equal((await q('select count(*)::int as n from public.client_automations')).at(0).n, 0, 'B ne voit pas l’automatisation de A');
  await rejects(q(`select public.run_client_automations()`), /permission denied/);
});
await test('intelligence : exécution par la base — une preuve par échéance, alertes sans doublon, bilan, arrêt sans abonnement', async () => {
  await asSuperuser();
  const auj = (await q(`select (now() at time zone 'Europe/Paris')::date as d`))[0].d;
  await q(`insert into public.dossier_deadlines (dossier_id, user_id, title, due_date) values ($1, $2, 'Réponse au bailleur', $3::date + 6)`, [dIA, IA, auj]);
  await q(`insert into public.dossier_deadlines (dossier_id, user_id, title, due_date) values ($1, $2, 'Lointaine', $3::date + 90)`, [dIA, IA, auj]);
  await q(`insert into public.dossier_deadlines (dossier_id, user_id, title, due_date) values ($1, $2, 'Secret de B', $3::date + 2)`, [dIB, IB, auj]);
  await asUser(IA);
  const [al] = await q(`select * from public.create_client_automation('prevenir_echeances', 'quotidien', null, 8::smallint)`);
  await asSuperuser();
  await q(`update public.client_automations set next_run_at = now() - interval '1 minute'`);
  const r1 = (await q(`select public.run_client_automations() as r`))[0].r;
  assert.equal(r1.executees, 2, 'les deux automatisations dues de A');
  const r2 = (await q(`select public.run_client_automations(now() + interval '1 second') as r`))[0].r;
  assert.equal(r2.executees, 0, 'rien n’est refait avant la prochaine échéance');
  await asUser(IA);
  const notes = await q('select kind, title, body from public.client_notifications order by kind');
  assert.deepEqual(notes.map((n) => n.kind), ['bilan', 'echeance']);
  assert.match(notes[1].title, /dans 6 jours/);
  assert.doesNotMatch(JSON.stringify(notes), /Secret de B|Lointaine/);
  const runs = await q('select status from public.client_automation_runs where automation_id = $1', [al.id]);
  assert.deepEqual(runs.map((x) => x.status), ['faite']);
  // Rejouer la même échéance (deux passages simultanés) : aucune seconde exécution, aucune seconde alerte.
  await asSuperuser();
  const due = (await q('select due from public.client_automation_runs where automation_id = $1', [al.id]))[0].due;
  await q(`update public.client_automations set next_run_at = $2 where id = $1`, [al.id, due]);
  assert.equal((await q(`select public.run_client_automations() as r`))[0].r.ignorees, 1);
  assert.equal((await q(`select count(*)::int as n from public.client_notifications where user_id = $1 and kind = 'echeance'`, [IA]))[0].n, 1);
  // Abonnement terminé : arrêt avec motif, aucune exécution.
  await q(`update public.client_automations set next_run_at = now() - interval '1 minute' where id = $1`, [al.id]);
  await q(`update public.subscriptions set status = 'canceled' where user_id = $1`, [IA]);
  await q(`select public.run_client_automations()`);
  const [st] = await q('select status, motif from public.client_automations where id = $1', [al.id]);
  assert.deepEqual([st.status, st.motif], ['arretee', 'Abonnement inactif']);
  await q(`update public.subscriptions set status = 'active' where user_id = $1`, [IA]);
});
await test('intelligence : « à chaque pièce reçue » devient dû au dépôt d’une pièce', async () => {
  await asUser(IA);
  const [p] = await q(`select * from public.create_client_automation('bilan_dossiers', 'piece', null, 8::smallint)`);
  assert.equal(p.next_run_at, null);
  await q(`insert into public.dossier_documents (dossier_id, user_id, file_path, file_name, kind) values ($1, $2, $3, 'facture.pdf', 'piece')`, [dIA, IA, `${IA}/facture.pdf`]);
  await asSuperuser();
  assert.notEqual((await q('select next_run_at from public.client_automations where id = $1', [p.id]))[0].next_run_at, null);
});
await test('intelligence : retour arrière propre puis réinstallation', async () => {
  await asSuperuser();
  await db.exec(readFileSync(join(root, 'supabase', 'rollback', '20261126120000_intelligence_espace_client.down.sql'), 'utf8'));
  assert.equal((await q(`select to_regclass('public.client_automations') as t`))[0].t, null);
  await db.exec(readFileSync(join(root, 'supabase', 'migrations', '20261126120000_intelligence_espace_client.sql'), 'utf8'));
  assert.equal((await q(`select to_regclass('public.client_automations') as t`))[0].t, 'client_automations');
});

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
