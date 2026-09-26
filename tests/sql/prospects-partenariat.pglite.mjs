// Tests SQL réels — demandes « Devenir partenaire » (chantier 14).
//
// Rejoue TOUTES les migrations de supabase/migrations dans l'ordre sur un
// PostgreSQL embarqué (PGlite) doté des bouchons Supabase minimaux (même
// harnais que tests/sql/migrations.pglite.mjs), puis vérifie sous les rôles
// réels anon / authenticated / service_role, RLS active :
//   - l'anonyme ne lit ni n'écrit rien (table et journal de limitation) ;
//   - l'insertion passe uniquement par le chemin prévu (Edge Function en
//     service role), avec la ligne EXACTE produite par validate.ts + scoring.ts ;
//   - listes fermées, URL http(s) seulement, cohérence partenariat, idempotence
//     par identifiant de requête ;
//   - seul l'admin (rôle serveur, sans MFA) lit ; il ne modifie que le statut, et chaque
//     changement de statut est journalisé ;
//   - la migration est rejouable, et sans effet si 20260829 est absente.
//
// Lancement (hors CI, dépendance non déclarée volontairement) :
//   PGLITE_MODULE=/chemin/vers/@electric-sql/pglite/dist/index.js \
//     node tests/sql/prospects-partenariat.pglite.mjs
// (Node ≥ 23.6 : import direct des modules TypeScript purs de l'Edge Function.)

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

const MIGRATION = '20260918130000_prospects_partenariat.sql';

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

const readMigration = (f) =>
  readFileSync(join(root, 'supabase', 'migrations', f), 'utf8')
    // Extension non disponible dans PGlite : remplacée par le bouchon net.http_post.
    .replace(/create extension if not exists pg_net;/gi, '');

async function freshDb(skip = []) {
  const db = new PGlite();
  await db.exec(STUBS);
  // Comptes existants AVANT les migrations (comme en production).
  await db.query(
    `insert into auth.users (email, email_confirmed_at) values ('prestige.seller@icloud.com', now())`,
  );
  const files = readdirSync(join(root, 'supabase', 'migrations'))
    .filter((f) => f.endsWith('.sql') && !skip.includes(f))
    .sort();
  for (const f of files) {
    try {
      await db.exec(readMigration(f));
    } catch (e) {
      throw new Error(`migration ${f} : ${e.message}`);
    }
  }
  return { db, files };
}

let passed = 0;
let failed = 0;
let db;
async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ✔ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✖ ${name}\n      ${String(e.message).split('\n')[0]}`);
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
async function asService() {
  await db.exec(`set role service_role; set request.jwt.claims = '{"role":"service_role"}';`);
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

// ── Mise en place ───────────────────────────────────────────────────────────
let setup;
try {
  setup = await freshDb();
} catch (e) {
  console.error(`✖ Échec de l'application des migrations : ${e.message}`);
  process.exit(1);
}
db = setup.db;
// Rejeu : 20260829 puis la présente migration, sans erreur ni doublon.
await db.exec(readMigration('20260829120000_prospects.sql'));
await db.exec(readMigration(MIGRATION));
await db.exec(readMigration(MIGRATION));
console.log(`Migrations appliquées : ${setup.files.length} (+ rejeu de 20260829 et de ${MIGRATION})\n`);

const [{ id: ADMIN }] = await q(`select id from auth.users where email = 'prestige.seller@icloud.com'`);
const [{ id: CLIENT }] = await q(
  `insert into auth.users (email, email_confirmed_at) values ('client@test.fr', now()) returning id`,
);

// Ligne EXACTE que l'Edge Function insère (validate.ts → scoring.ts → insert).
const { validateProspect } = await import(
  pathToFileURL(join(root, 'supabase', 'functions', 'submit-prospect', 'validate.ts')).href
);
const { qualifyProspect } = await import(
  pathToFileURL(join(root, 'supabase', 'functions', 'submit-prospect', 'scoring.ts')).href
);
function edgeRow(payload) {
  const r = validateProspect(payload);
  if (!r.ok) throw new Error(`validation refusée : ${r.errors.join(', ')}`);
  const p = r.value;
  const qual = qualifyProspect(p);
  const extra = {};
  if (p.partner_type) extra.partner_type = p.partner_type;
  if (p.site_url) extra.site_url = p.site_url;
  if (p.client_request_id) extra.client_request_id = p.client_request_id;
  return {
    ...extra,
    full_name: p.full_name,
    email: p.email,
    organization: p.organization,
    segment: p.segment,
    topic: p.topic,
    message: p.message,
    creneaux: p.creneaux,
    source_page: p.source_page,
    referrer: p.referrer,
    score_potentiel: qual.score_potentiel,
    routage: qual.routage,
    human_flags: JSON.stringify(qual.human_flags),
    audit_log: JSON.stringify([{ action: 'creation', decision: qual.routage }]),
  };
}
async function insertRow(row) {
  const cols = Object.keys(row);
  const rows = await q(
    `insert into public.prospects (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`,
    cols.map((c) => row[c]),
  );
  return rows[0].id;
}

const REQ = '6f1c2b8e-4d3a-4f5b-9c7d-0e1f2a3b4c5d';
const partnerPayload = {
  full_name: 'Paul Partenaire',
  email: 'Paul@Cabinet-Conseil.fr',
  organization: 'Cabinet Conseil',
  segment: 'autre',
  topic: 'partenariat',
  partner_type: 'prescripteur',
  site_url: 'cabinet-conseil.fr',
  message: 'Nous accompagnons des TPE et souhaitons présenter notre activité.',
  source_page: '/contact',
  elapsed_ms: 9000,
  website: '',
  request_id: REQ,
};

console.log('Écriture : uniquement par le chemin prévu (Edge Function, service role)');
let partnerId;
await test('service role : la demande de partenariat validée est enregistrée telle quelle', async () => {
  await asService();
  partnerId = await insertRow(edgeRow(partnerPayload));
  await asSuperuser();
  const [p] = await q(
    'select topic, partner_type, site_url, routage, statut, client_request_id, email from public.prospects where id = $1',
    [partnerId],
  );
  assert.equal(p.topic, 'partenariat');
  assert.equal(p.partner_type, 'prescripteur');
  assert.equal(p.site_url, 'https://cabinet-conseil.fr/');
  assert.equal(p.routage, 'partenariat');
  assert.equal(p.statut, 'nouveau');
  assert.equal(p.client_request_id, REQ);
  assert.equal(p.email, 'paul@cabinet-conseil.fr');
});
await test('service role : les demandes existantes (démo, rendez-vous) restent acceptées', async () => {
  await asService();
  await insertRow(edgeRow({ ...partnerPayload, topic: 'demo', partner_type: undefined, site_url: undefined, request_id: undefined }));
  await insertRow(
    edgeRow({ ...partnerPayload, topic: 'rendez-vous', creneaux: 'mardi matin', partner_type: undefined, site_url: undefined, request_id: undefined }),
  );
});
await test('idempotence : même identifiant de requête = une seule demande', async () => {
  await asService();
  await rejects(insertRow(edgeRow(partnerPayload)), /duplicate key|unique/i);
  await asSuperuser();
  assert.equal((await q('select id from public.prospects where client_request_id = $1', [REQ])).length, 1);
});
await test('anonyme : aucune insertion directe (même avec la clé publique)', async () => {
  await asAnon();
  await rejects(
    q(`insert into public.prospects (full_name, email, segment, topic, message, source_page, partner_type)
       values ('Robot', 'r@x.fr', 'autre', 'partenariat', 'message de test assez long', '/contact', 'autre')`),
    /permission denied|row-level security/,
  );
});
await test('client connecté : aucune insertion directe', async () => {
  await asUser(CLIENT);
  await rejects(
    q(`insert into public.prospects (full_name, email, segment, topic, message, source_page, partner_type)
       values ('Client', 'c@x.fr', 'autre', 'partenariat', 'message de test assez long', '/contact', 'autre')`),
    /permission denied|row-level security/,
  );
});

console.log('Contraintes (dernière ligne de défense, même en service role)');
const base = edgeRow({ ...partnerPayload, request_id: undefined });
await test('partenariat sans type → refusé', async () => {
  await asService();
  const { partner_type: _pt, ...row } = base;
  await rejects(insertRow(row), /prospects_partenariat_coherence/);
});
await test('type de partenariat hors liste fermée → refusé', async () => {
  await asService();
  await rejects(insertRow({ ...base, partner_type: 'commission-garantie' }), /prospects_partner_type_check/);
});
await test('type de partenariat sur une autre nature de demande → refusé', async () => {
  await asService();
  await rejects(insertRow({ ...base, topic: 'demo', routage: 'demonstration' }), /prospects_partenariat_coherence/);
});
await test('site web non http(s) → refusé', async () => {
  await asService();
  await rejects(insertRow({ ...base, site_url: 'javascript:alert(1)' }), /prospects_site_url_check/);
  await rejects(insertRow({ ...base, site_url: `https://exemple.fr/${'a'.repeat(300)}` }), /prospects_site_url_check/);
});
await test('site web sur une autre nature de demande → refusé', async () => {
  await asService();
  const { partner_type: _pt, ...row } = base;
  await rejects(insertRow({ ...row, topic: 'demo', routage: 'demonstration' }), /prospects_partenariat_coherence/);
});
await test('nature ou routage inconnus → refusés', async () => {
  await asService();
  const { partner_type: _pt, site_url: _su, ...row } = base;
  await rejects(insertRow({ ...row, topic: 'affiliation', routage: 'libre-service' }), /prospects_topic_check/);
  await rejects(insertRow({ ...base, routage: 'acceptation-automatique' }), /prospects_routage_check/);
});
await test('site web facultatif : partenariat sans site accepté', async () => {
  await asService();
  await insertRow(edgeRow({ ...partnerPayload, site_url: '', request_id: undefined, email: 'sans-site@exemple.fr' }));
});

console.log('Lecture : anonyme et client ne voient rien');
await test('anonyme : aucune lecture des demandes ni du journal de limitation', async () => {
  await asAnon();
  await rejects(q('select id from public.prospects'), /permission denied/);
  await rejects(q('select id from public.prospect_rate_limits'), /permission denied/);
});
await test('client connecté : 0 demande visible, aucune modification', async () => {
  await asUser(CLIENT, 'aal2');
  assert.equal((await q('select id from public.prospects')).length, 0);
  assert.equal((await q(`update public.prospects set statut = 'clos' returning id`)).length, 0);
  await rejects(q('select id from public.prospect_rate_limits'), /permission denied/);
});

// Depuis 20260920120000 : le rôle admin (app_admins) décide seul, quel que soit
// le niveau de session. Les sessions admin sont ouvertes en aal1 (sans TOTP).
console.log('Administration : rôle admin (sans MFA), statut seul, journalisé');
await test('client en aal2 : toujours aucune demande, statut inchangé (le niveau de session ne donne aucun droit)', async () => {
  await asUser(CLIENT, 'aal2');
  assert.equal((await q('select id from public.prospects')).length, 0);
  assert.equal((await q(`update public.prospects set statut = 'clos' where id = $1 returning id`, [partnerId])).length, 0);
  await asSuperuser();
  assert.equal((await q('select statut from public.prospects where id = $1', [partnerId]))[0].statut, 'nouveau');
});
await test('admin en session normale : lit les demandes, filtre par nature et statut', async () => {
  await asUser(ADMIN, 'aal1');
  const all = await q('select id from public.prospects');
  assert.ok(all.length >= 4);
  const partners = await q(
    `select id, partner_type, site_url from public.prospects where topic = 'partenariat' and statut = 'nouveau' order by created_at desc`,
  );
  assert.ok(partners.some((p) => p.id === partnerId && p.partner_type === 'prescripteur'));
});
await test('admin : change le statut → ajouté au journal (de → vers, auteur)', async () => {
  await asUser(ADMIN, 'aal1');
  const rows = await q(`update public.prospects set statut = 'contacte' where id = $1 returning id`, [partnerId]);
  assert.equal(rows.length, 1);
  await asSuperuser();
  const [p] = await q('select statut, audit_log from public.prospects where id = $1', [partnerId]);
  assert.equal(p.statut, 'contacte');
  const last = p.audit_log[p.audit_log.length - 1];
  assert.equal(last.action, 'statut');
  assert.equal(last.de, 'nouveau');
  assert.equal(last.vers, 'contacte');
  assert.equal(last.actor, ADMIN);
  assert.equal(p.audit_log[0].action, 'creation', 'entrée de création conservée');
});
await test('admin : statut hors liste refusé', async () => {
  await asUser(ADMIN, 'aal1');
  await rejects(q(`update public.prospects set statut = 'accepte' where id = $1`, [partnerId]), /prospects_statut_check/);
});
await test('admin : données déclarées et journal intangibles', async () => {
  await asUser(ADMIN, 'aal1');
  await rejects(q(`update public.prospects set message = 'réécrit' where id = $1`, [partnerId]), /permission denied/);
  await rejects(q(`update public.prospects set partner_type = 'autre' where id = $1`, [partnerId]), /permission denied/);
  await rejects(q(`update public.prospects set audit_log = '[]' where id = $1`, [partnerId]), /permission denied/);
  await rejects(q(`delete from public.prospects where id = $1`, [partnerId]), /permission denied/);
});

console.log('Rejouabilité');
await test('contraintes et déclencheur présents une seule fois après rejeu', async () => {
  await asSuperuser();
  const cons = await q(
    `select conname from pg_constraint where conrelid = 'public.prospects'::regclass
     and conname in ('prospects_topic_check','prospects_routage_check','prospects_partner_type_check','prospects_site_url_check','prospects_partenariat_coherence')`,
  );
  assert.equal(cons.length, 5);
  const trg = await q(`select tgname from pg_trigger where tgrelid = 'public.prospects'::regclass and tgname = 'prospects_statut_journal'`);
  assert.equal(trg.length, 1);
});
await test('sans 20260829 (capture non activée) : migration sans effet, sans erreur', async () => {
  const other = await freshDb(['20260829120000_prospects.sql']);
  const [{ t }] = (await other.db.query(`select to_regclass('public.prospects') as t`)).rows;
  assert.equal(t, null);
  await other.db.exec(readMigration(MIGRATION));
  await other.db.close();
});

console.log(`\n${passed} réussis, ${failed} échoués`);
process.exit(failed ? 1 : 0);
