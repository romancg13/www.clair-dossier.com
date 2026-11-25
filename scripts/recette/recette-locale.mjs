#!/usr/bin/env node
// Recette RÉELLE sur une pile Supabase LOCALE isolée (docker) — données 100 % fictives.
//
//   RECETTE_WORKDIR=<workdir de la pile locale> node scripts/recette/recette-locale.mjs [--json=<fichier>] [--nettoyer]
//
// Le workdir est une COPIE de supabase/ (config adaptée) où `supabase start` a
// été lancé et les migrations appliquées. Le script :
//   - refuse toute cible non locale (127.0.0.1) ;
//   - pose une garde réseau (les déclencheurs pg_net du schéma visent des
//     fonctions de production : ils sont neutralisés DANS le conteneur local) ;
//   - est relançable : les comptes fictifs « @recette.clairdossier.test » et
//     leurs fichiers sont purgés puis recréés à chaque exécution ;
//   - sert lui-même les fonctions Edge (`supabase functions serve`) avec des
//     fichiers d'environnement écrits HORS dépôt, et les laisse servies en
//     mode « sans clé » en sortant ;
//   - n'emploie aucune clé Anthropic : le moteur est prouvé sans clé (503) puis
//     branché sur un FAUX serveur local (ANTHROPIC_BASE_URL) — tout ce qui en
//     dépend est étiqueté SIMULÉ, jamais VÉRIFIÉ.
//
// Sortie : une ligne par test « test → VÉRIFIÉ / ÉCHEC / SIMULÉ / BLOQUÉ »,
// puis un récapitulatif. Code de sortie : 1 si au moins un ÉCHEC, sinon 0.
import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ECHEANCE_SIMULEE, FAUX_MODELE, demarrerFauxAnthropic } from './lib/faux-anthropic.mjs';
import { creerServiceFonctions, creerSql, ecartsAvecDepot, ecrireFichierEnv, gardeEnPlace, lireEnvironnement, poserGardeReseau, projetLocal, repertoireExecution } from './lib/pile-locale.mjs';

const DEPOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORKDIR = process.env.RECETTE_WORKDIR;
const ARGS = process.argv.slice(2);
const SORTIE_JSON = ARGS.find((a) => a.startsWith('--json='))?.slice(7) ?? null;
const NETTOYER = ARGS.includes('--nettoyer');

const DOMAINE_COMPTES = 'recette.clairdossier.test';
const BUCKET = 'documents';
const CONDITIONS_IA = 'ia-2026-10'; // AI_TERMS_VERSION (src/components/dossier/AiPanel.tsx)
const JETON_WORKER = 'jeton-recette-local';
const DOMAINE_RECEPTION = 'recu.recette.test';
const NB_IMPORT = 250;
// Coût attendu d'un appel simulé : estimateCostCents(claude-opus-5-5, 1000, 500) = 1,29 centime.
const COUT_APPEL = 1.29;

// Grille attendue (migrations 20260917120000, 20261118120000, 20261118130000).
const GRILLE = {
  'essentiel': { dossiers: 5, pages: 50, actions: 0, email: false },
  'entrepreneur': { dossiers: 10, pages: 150, actions: 20, email: true },
  'business-pme-20': { dossiers: 20, pages: 300, actions: 50, email: true },
  'business-pme-50': { dossiers: 50, pages: 800, actions: 150, email: true },
  'business-pme-pro': { dossiers: null, pages: 2000, actions: 400, email: true },
  'business-pme-premium': { dossiers: null, pages: 5000, actions: 1000, email: true },
  'business-pme-sur-mesure': { dossiers: null, pages: null, actions: null, email: false },
};

/* ── Journal des tests ──────────────────────────────────────────────────── */

class Bloque extends Error {}
const lignes = [];
const mesures = {};
const ms = (t) => (t < 1000 ? `${Math.round(t)} ms` : `${(t / 1000).toFixed(1)} s`);
const pause = (d) => new Promise((r) => setTimeout(r, d));

function attendu(condition, message) {
  if (!condition) throw new Error(message);
}

/** Exécute un test ; `fn` renvoie un détail (texte) ou { statut, detail }. Une exception = ÉCHEC. */
async function test(section, nom, fn) {
  const debut = performance.now();
  let statut = 'VÉRIFIÉ';
  let detail = '';
  try {
    const r = await fn();
    if (r && typeof r === 'object') {
      statut = r.statut ?? statut;
      detail = r.detail ?? '';
    } else if (typeof r === 'string') detail = r;
  } catch (e) {
    statut = e instanceof Bloque ? 'BLOQUÉ' : 'ÉCHEC';
    detail = e instanceof Error ? e.message : JSON.stringify(e);
  }
  const duree = performance.now() - debut;
  lignes.push({ section, test: nom, statut, duree_ms: Math.round(duree), detail });
  console.log(`[${String(lignes.length).padStart(2, '0')}] ${section} | ${nom} → ${statut} (${ms(duree)})${detail ? ` — ${detail}` : ''}`);
  return statut;
}
const simule = (detail) => ({ statut: 'SIMULÉ', detail });
const bloque = (detail) => ({ statut: 'BLOQUÉ', detail });

/* ── Aides « comme le site » ────────────────────────────────────────────── */

const assainir = (nom) => nom.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 80); // sanitizeFileName (packages/core)
const erreur = (e) => (e ? `${e.message ?? ''}${e.code ? ` [${e.code}]` : ''}${e.statusCode ? ` (HTTP ${e.statusCode})` : ''}` : '');

/** Création + validation d'un dossier : même insertion que src/pages/DossierFlow.tsx (submit). */
function creerDossier(client, userId, titre, requestId = randomUUID()) {
  return client
    .from('dossiers')
    .insert({ user_id: userId, typology: 'impayes', title: titre, answers: {}, legal_review_requested: false, status: 'transmis', client_request_id: requestId })
    .select('id')
    .single();
}

/** Dépôt vérifié : même séquence que uploadVerified (src/lib/document-links.ts) — objet, présence, ligne. */
async function deposer(client, ownerId, dossierId, nom, octets, type) {
  const chemin = `${ownerId}/${dossierId}/${Date.now()}-${assainir(nom)}`;
  const up = await client.storage.from(BUCKET).upload(chemin, new Blob([octets], { type }), { upsert: false, contentType: type });
  if (up.error) throw new Error(`stockage : ${erreur(up.error)}`);
  const present = await client.storage.from(BUCKET).exists(chemin);
  if (present.data !== true) throw new Error('dépôt non confirmé par le stockage');
  const ins = await client.from('dossier_documents').insert({ dossier_id: dossierId, user_id: ownerId, file_name: nom, size_bytes: octets.length, kind: 'piece', file_path: chemin }).select('id').single();
  if (ins.error) {
    await client.storage.from(BUCKET).remove([chemin]);
    throw new Error(`ligne : ${erreur(ins.error)}`);
  }
  return { chemin, id: ins.data.id };
}

async function pdfFictif(titre, pages) {
  const doc = await PDFDocument.create();
  const police = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 1; i <= pages; i++) {
    const page = doc.addPage([420, 300]);
    page.drawText(`${titre} - page ${i}/${pages}`, { x: 30, y: 240, size: 14, font: police });
    page.drawText('Facture fictive n° RECETTE-001 - 1 800 EUR - donnees de recette', { x: 30, y: 210, size: 10, font: police });
  }
  doc.setCreationDate(new Date('2026-01-01T00:00:00Z'));
  doc.setModificationDate(new Date('2026-01-01T00:00:00Z'));
  return Buffer.from(await doc.save());
}
const texteFictif = (n) => Buffer.from(`Pièce fictive n° ${n} — recette locale ClairDossier.\nFacture fictive n° RECETTE-001 : 1 800 EUR, échéance au 30 avril 2026.\nAucune donnée réelle.\n`, 'utf8');

/** Tous les objets sous un préfixe (parcours récursif, clé de service). */
async function listerObjets(service, prefixe) {
  const trouves = [];
  const file = [prefixe];
  while (file.length) {
    const dir = file.pop();
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await service.storage.from(BUCKET).list(dir, { limit: 1000, offset });
      if (error) throw new Error(`liste ${dir} : ${erreur(error)}`);
      for (const e of data ?? []) (e.id ? trouves : file).push(`${dir}/${e.name}`);
      if ((data ?? []).length < 1000) break;
    }
  }
  return trouves;
}

/* ── Programme ──────────────────────────────────────────────────────────── */

async function principal() {
  if (!WORKDIR || !existsSync(path.join(WORKDIR, 'supabase', 'config.toml'))) {
    console.error('RECETTE_WORKDIR doit désigner le workdir de la pile Supabase locale (contenant supabase/config.toml).');
    process.exit(2);
  }
  if (path.resolve(WORKDIR) === DEPOT) {
    console.error('REFUS : le workdir doit être une copie hors dépôt (aucun fichier d’exécution dans le dépôt).');
    process.exit(2);
  }
  const debutTotal = performance.now();
  const env = lireEnvironnement(WORKDIR);
  const API = env.API_URL;
  const projet = projetLocal(WORKDIR);
  const sql = creerSql(projet);
  const fonctions = creerServiceFonctions({ workdir: WORKDIR, projet, apiUrl: API });
  const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
  const service = createClient(API, env.SERVICE_ROLE_KEY, options);
  const anonyme = createClient(API, env.ANON_KEY, options);
  const execution = randomBytes(4).toString('hex');
  const marqueurCron = path.join(repertoireExecution(), 'pg_cron.cree-par-recette');
  console.log(`Recette locale ClairDossier — pile ${API} (projet « ${projet} ») — exécution ${execution}\n`);

  const secretWebhook = `whsec_${randomBytes(24).toString('base64')}`;
  const communs = { AI_WORKER_TOKEN: JETON_WORKER, AI_BUDGET_CENTS_PER_USER_MONTH: '100000', AI_BUDGET_CENTS_GLOBAL_MONTH: '1000000' };
  const envSansCle = ecrireFichierEnv('fonctions-sans-cle.env', { ...communs, RESEND_INBOUND_WEBHOOK_SECRET: secretWebhook, RESEND_API_KEY: 're_recette_cle_fictive', INBOUND_EMAIL_DOMAIN: DOMAINE_RECEPTION }, WORKDIR);

  const retirerCron = () => {
    try {
      if (sql("select count(*) from pg_extension where extname = 'pg_cron'") !== '1') return;
      sql("select cron.unschedule(jobid) from cron.job where jobname = 'recette-locale-ai-worker'");
      if (existsSync(marqueurCron)) {
        sql("delete from vault.secrets where name = 'clairdossier_ai_worker_token'");
        sql('drop extension pg_cron');
        unlinkSync(marqueurCron);
      }
    } catch (e) {
      console.warn(`(nettoyage pg_cron incomplet : ${e instanceof Error ? e.message.slice(0, 200) : e})`);
    }
  };

  const comptes = {}; // nom → { id, email, client }
  const purger = async () => {
    const { data, error } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(`liste des comptes : ${erreur(error)}`);
    const cibles = data.users.filter((u) => (u.email ?? '').endsWith(`@${DOMAINE_COMPTES}`));
    let objets = 0;
    for (const u of cibles) {
      for (const prefixe of [u.id, `ai-review/${u.id}`]) {
        const chemins = await listerObjets(service, prefixe);
        for (let i = 0; i < chemins.length; i += 200) {
          const sup = await service.storage.from(BUCKET).remove(chemins.slice(i, i + 200));
          if (sup.error) throw new Error(`purge stockage : ${erreur(sup.error)}`);
        }
        objets += chemins.length;
      }
      const sup = await service.auth.admin.deleteUser(u.id);
      if (sup.error) throw new Error(`suppression du compte ${u.email} : ${erreur(sup.error)}`);
    }
    return `${cibles.length} compte(s) fictif(s) et ${objets} objet(s) retirés`;
  };

  /* ── 0. Préparation ───────────────────────────────────────────────────── */
  const gardeOk = await test('0 Préparation', 'garde réseau : aucun appel pg_net ne peut atteindre la production', () => poserGardeReseau(sql));
  if (gardeOk !== 'VÉRIFIÉ') {
    console.error('\nARRÊT : sans garde réseau, créer un compte ou un dossier appellerait une fonction de production.');
    process.exit(1);
  }
  await test('0 Préparation', 'fonctions servies = code du dépôt (copie du workdir à jour)', () => {
    const ecarts = ecartsAvecDepot(WORKDIR, DEPOT, ['ai-worker/index.ts', 'email-inbound/index.ts', '_shared/ai-pipeline.ts', '_shared/deliverables.ts', '_shared/analysis-model.ts', '_shared/office.ts', '_shared/inbound-email.ts']);
    attendu(ecarts.length === 0, `la copie du workdir diffère du dépôt : ${ecarts.join(', ')}`);
    return '7 fichiers identiques';
  });
  await test('0 Préparation', 'purge des exécutions précédentes (relançable)', async () => {
    retirerCron();
    return purger();
  });
  await test('0 Préparation', 'schéma : 7 offres et grille conforme aux migrations', async () => {
    const { data, error } = await service.from('plan_entitlements').select('plan_id,dossier_limit,ai_pages_month,ai_actions_month,email_inbound');
    attendu(!error, erreur(error));
    attendu(data.length === 7, `${data.length} offres au lieu de 7`);
    for (const p of data) {
      const g = GRILLE[p.plan_id];
      attendu(g, `offre inattendue ${p.plan_id}`);
      attendu(p.dossier_limit === g.dossiers && p.ai_pages_month === g.pages && p.ai_actions_month === g.actions && (p.email_inbound ?? false) === g.email, `grille ${p.plan_id} : ${JSON.stringify(p)}`);
    }
    return Object.keys(GRILLE).join(', ');
  });
  await test('0 Préparation', 'fonctions Edge servies localement (mode sans clé Anthropic)', async () => `prêtes en ${ms(await fonctions.servir(envSansCle))}`);

  /* ── 1. Authentification ──────────────────────────────────────────────── */
  const creerCompte = async (nom) => {
    const email = `recette-${nom}@${DOMAINE_COMPTES}`;
    const motDePasse = `Recette-${randomBytes(9).toString('base64url')}`;
    const cree = await service.auth.admin.createUser({ email, password: motDePasse, email_confirm: true, user_metadata: { full_name: `Compte fictif ${nom.toUpperCase()}` } });
    attendu(!cree.error, `création ${email} : ${erreur(cree.error)}`);
    const client = createClient(API, env.ANON_KEY, options);
    const session = await client.auth.signInWithPassword({ email, password: motDePasse });
    attendu(!session.error && session.data.session, `connexion ${email} : ${erreur(session.error)}`);
    attendu(session.data.user.id === cree.data.user.id && session.data.user.email_confirmed_at, 'session incohérente');
    comptes[nom] = { id: cree.data.user.id, email, client, motDePasse };
    return comptes[nom];
  };
  for (const nom of ['a', 'b', 'offres', 'admin']) {
    await test('1 Auth', `compte fictif ${nom.toUpperCase()} : création GoTrue (e-mail confirmé) + connexion par mot de passe`, async () => {
      const c = await creerCompte(nom);
      const profil = await c.client.from('profiles').select('id').eq('id', c.id).maybeSingle();
      attendu(profil.data?.id === c.id, 'profil non créé par le déclencheur handle_new_user');
      return `${c.email} — profil créé par déclencheur`;
    });
  }
  const A = comptes.a, B = comptes.b, P = comptes.offres, ADMIN = comptes.admin;
  if (!A || !B || !P || !ADMIN) {
    console.error('\nARRÊT : comptes fictifs indisponibles.');
    return conclure(debutTotal);
  }
  await test('1 Auth', 'mauvais mot de passe refusé', async () => {
    const r = await createClient(API, env.ANON_KEY, options).auth.signInWithPassword({ email: A.email, password: 'mot-de-passe-faux' });
    attendu(r.error && !r.data.session, 'connexion acceptée avec un mauvais mot de passe');
    return erreur(r.error);
  });
  // Abonnement fictif de A (écriture serveur, comme le webhook Stripe) : Entrepreneur.
  const abonner = async (userId, planId) => {
    const sup = await service.from('subscriptions').delete().eq('user_id', userId);
    attendu(!sup.error, erreur(sup.error));
    const maintenant = Date.now();
    const ins = await service.from('subscriptions').insert({ user_id: userId, plan_id: planId, status: 'active', stripe_subscription_id: `sub_recette_${userId.slice(0, 8)}_${planId}`, current_period_start: new Date(maintenant - 5 * 86_400_000).toISOString(), current_period_end: new Date(maintenant + 25 * 86_400_000).toISOString() });
    attendu(!ins.error, erreur(ins.error));
  };

  /* ── 2. Isolation A / B / anonyme ─────────────────────────────────────── */
  let dossierA = null, pieceA = null;
  const requeteA = randomUUID();
  await test('2 Isolation', 'A crée un dossier (chemin du site) et y dépose une pièce (Storage réel + ligne)', async () => {
    const d = await creerDossier(A.client, A.id, 'Dossier fictif A — isolation', requeteA);
    attendu(!d.error, erreur(d.error));
    dossierA = d.data.id;
    pieceA = await deposer(A.client, A.id, dossierA, 'contrat fictif A.txt', texteFictif(1), 'text/plain');
    const relu = await A.client.storage.from(BUCKET).download(pieceA.chemin);
    attendu(!relu.error && Buffer.from(await relu.data.arrayBuffer()).equals(texteFictif(1)), 'relecture du fichier par A différente du dépôt');
    const soumis = await service.from('dossiers').select('submitted_at,created_by').eq('id', dossierA).single();
    attendu(soumis.data?.submitted_at && soumis.data.created_by === A.id, 'champs serveur (submitted_at / created_by) non posés');
    return `dossier ${dossierA.slice(0, 8)}…, objet ${pieceA.chemin.split('/').pop()}`;
  });
  await test('2 Isolation', 'double validation (même client_request_id) : un seul dossier', async () => {
    const d = await creerDossier(A.client, A.id, 'Dossier fictif A — isolation', requeteA);
    attendu(d.error?.code === '23505', `doublon accepté ou erreur inattendue : ${erreur(d.error)}`);
    return 'refus 23505 (unicité serveur)';
  });
  const lectureInterdite = async (qui, client) => {
    // Refus = erreur explicite (42501) ou résultat vide (RLS) ; jamais une ligne.
    const d = await client.from('dossiers').select('id').eq('id', dossierA);
    attendu((d.data ?? []).length === 0, `${qui} lit le dossier de A`);
    const l = await client.from('dossier_documents').select('id').eq('dossier_id', dossierA);
    attendu((l.data ?? []).length === 0, `${qui} lit les lignes de A`);
    const liste = await client.storage.from(BUCKET).list(`${A.id}/${dossierA}`);
    attendu((liste.data ?? []).length === 0, `${qui} liste les objets de A`);
    const dl = await client.storage.from(BUCKET).download(pieceA.chemin);
    attendu(dl.error && !dl.data, `${qui} télécharge l'objet de A`);
    const signe = await client.storage.from(BUCKET).createSignedUrl(pieceA.chemin, 60);
    attendu(signe.error && !signe.data?.signedUrl, `${qui} obtient un lien signé vers l'objet de A`);
    return `ligne (${d.error ? `erreur ${d.error.code}` : 'résultat vide'}), liste, téléchargement et lien signé refusés`;
  };
  await test('2 Isolation', 'B ne peut ni lire la ligne, ni lister, ni télécharger, ni signer l’objet de A', async () => {
    attendu(pieceA, 'prérequis absent');
    return lectureInterdite('B', B.client);
  });
  await test('2 Isolation', 'anonyme : mêmes refus + URL publique du bucket fermée', async () => {
    attendu(pieceA, 'prérequis absent');
    const detail = await lectureInterdite('anonyme', anonyme);
    const pub = await fetch(`${API}/storage/v1/object/public/${BUCKET}/${pieceA.chemin}`);
    attendu(pub.status >= 400, `URL publique servie (HTTP ${pub.status})`);
    const ins = await anonyme.from('dossiers').insert({ user_id: A.id, typology: 'impayes', title: 'intrusion anonyme', status: 'transmis' }).select('id');
    attendu(ins.error, 'insertion anonyme acceptée');
    return `${detail} ; URL publique HTTP ${pub.status} ; insertion refusée`;
  });
  await test('2 Isolation', 'B ne peut pas écrire dans le dossier de A (Storage, mise à jour, suppression, usurpation)', async () => {
    attendu(pieceA, 'prérequis absent');
    const up = await B.client.storage.from(BUCKET).upload(`${A.id}/${dossierA}/intrus.txt`, new Blob(['intrus']), { upsert: false, contentType: 'text/plain' });
    attendu(up.error, 'B dépose un objet sous le préfixe de A');
    const usurpe = await B.client.from('dossier_documents').insert({ dossier_id: dossierA, user_id: A.id, file_name: 'intrus.txt', file_path: `${A.id}/${dossierA}/intrus.txt`, kind: 'piece' }).select('id');
    attendu(usurpe.error, 'B insère une ligne au nom de A');
    await B.client.from('dossiers').update({ title: 'titre modifié par B' }).eq('id', dossierA);
    await B.client.from('dossier_documents').update({ file_name: 'renommé par B' }).eq('id', pieceA.id);
    await B.client.from('dossier_documents').delete().eq('id', pieceA.id);
    await B.client.storage.from(BUCKET).remove([pieceA.chemin]);
    const d = await service.from('dossiers').select('title').eq('id', dossierA).single();
    const l = await service.from('dossier_documents').select('file_name').eq('id', pieceA.id).maybeSingle();
    attendu(d.data?.title === 'Dossier fictif A — isolation', 'titre du dossier de A modifié par B');
    attendu(l.data?.file_name === 'contrat fictif A.txt', 'ligne de A modifiée ou supprimée par B');
    const toujours = await A.client.storage.from(BUCKET).exists(pieceA.chemin);
    attendu(toujours.data === true, 'objet de A supprimé par B');
    const ev = await B.client.from('dossier_events').insert({ dossier_id: dossierA, user_id: B.id, type: 'dossier_cloture', label: 'clôture par B' }).select('id');
    attendu(ev.error, 'B journalise une clôture sur le dossier de A');
    const dos = await B.client.from('dossiers').insert({ user_id: A.id, typology: 'impayes', title: 'usurpation', status: 'transmis' }).select('id');
    attendu(dos.error, 'B crée un dossier au nom de A');
    return 'dépôt, usurpation, mise à jour, suppression, clôture : tous sans effet';
  });
  await test('2 Isolation', 'B ne peut pas rattacher SA propre ligne de pièce au dossier de A', async () => {
    attendu(pieceA, 'prérequis absent');
    const ins = await B.client.from('dossier_documents').insert({ dossier_id: dossierA, user_id: B.id, file_name: 'piece de B dans le dossier de A.txt', file_path: `${B.id}/${dossierA}/intrus.txt`, kind: 'piece' }).select('id');
    if (!ins.error) {
      await service.from('dossier_documents').delete().eq('id', ins.data[0].id);
      throw new Error('DÉFAUT RLS : la policy docs_insert_own (20260615201942_clair_dossier_init.sql:62) ne vérifie que user_id = auth.uid() ; B a inséré une ligne dossier_documents avec dossier_id = dossier de A (ligne retirée après constat)');
    }
    return `refus : ${erreur(ins.error)}`;
  });
  await test('2 Isolation', 'lien signé créé par A : utilisable sans session (capacité au porteur, durée limitée)', async () => {
    attendu(pieceA, 'prérequis absent');
    const s = await A.client.storage.from(BUCKET).createSignedUrl(pieceA.chemin, 60);
    attendu(!s.error, erreur(s.error));
    const r = await fetch(s.data.signedUrl);
    attendu(r.status === 200, `HTTP ${r.status}`);
    return 'HTTP 200 avec le lien signé (60 s) — comportement attendu de Storage';
  });

  /* ── 3. Droits des 7 offres (contrôles serveur) ───────────────────────── */
  const viderConsommation = async (userId) => {
    for (const table of ['dossier_submissions', 'ai_action_events']) {
      const r = await service.from(table).delete().eq('user_id', userId);
      attendu(!r.error, `${table} : ${erreur(r.error)}`);
    }
  };
  const preremplirSoumissions = async (userId, n, ilYaMs) => {
    for (let i = 0; i < n; i += 500) {
      const lot = Array.from({ length: Math.min(500, n - i) }, () => ({ user_id: userId, submitted_at: new Date(Date.now() - ilYaMs).toISOString() }));
      const r = await service.from('dossier_submissions').insert(lot);
      attendu(!r.error, erreur(r.error));
    }
  };
  for (const [plan, g] of Object.entries(GRILLE)) {
    let dossierOffre = null;
    await test('3 Offres', `${plan} : limite de dossiers appliquée par le serveur`, async () => {
      await abonner(P.id, plan);
      await viderConsommation(P.id);
      const droits = await P.client.rpc('get_my_dossier_entitlement');
      attendu(!droits.error, erreur(droits.error));
      attendu(droits.data.plan_id === plan && droits.data.dossier_limit === g.dossiers && droits.data.unlimited === (g.dossiers === null), `droits publiés : ${JSON.stringify(droits.data)}`);
      if (g.dossiers === null) {
        await preremplirSoumissions(P.id, 500, 2 * 3_600_000);
        const d = await creerDossier(P.client, P.id, `Dossier fictif ${plan}`);
        attendu(!d.error, `création refusée malgré l'illimité : ${erreur(d.error)}`);
        dossierOffre = d.data.id;
        return 'illimité : 501ᵉ dossier de la période accepté (500 consommations préremplies côté serveur)';
      }
      // Essentiel : parcours intégral réel ; au-delà : consommation préremplie (limite – 1) pour rester sous l'anti-abus (10 / 10 min).
      const reels = plan === 'essentiel' ? g.dossiers : 1;
      if (reels === 1) await preremplirSoumissions(P.id, g.dossiers - 1, 2 * 3_600_000);
      for (let i = 0; i < reels; i++) {
        const d = await creerDossier(P.client, P.id, `Dossier fictif ${plan} ${i + 1}`);
        attendu(!d.error, `dossier ${i + 1} refusé : ${erreur(d.error)}`);
        dossierOffre ??= d.data.id;
      }
      const trop = await creerDossier(P.client, P.id, `Dossier fictif ${plan} en trop`);
      attendu(trop.error && /DOSSIER_QUOTA_EXCEEDED/.test(trop.error.message), `dépassement non refusé : ${erreur(trop.error) || 'dossier créé'}`);
      const apres = await P.client.rpc('get_my_dossier_entitlement');
      attendu(apres.data.used === g.dossiers, `consommation ${apres.data.used} ≠ ${g.dossiers}`);
      return `${reels === 1 ? `${g.dossiers - 1} préremplis + 1 réel` : `${reels} réels`} acceptés, le ${g.dossiers + 1}ᵉ refusé par le déclencheur (DOSSIER_QUOTA_EXCEEDED)`;
    });
    await test('3 Offres', `${plan} : quotas IA (pages, actions) résolus et opposés côté serveur`, async () => {
      const etat = await service.rpc('ai_quota_state', { p_user: P.id });
      attendu(!etat.error, erreur(etat.error));
      const e = etat.data[0];
      attendu(e.plan_id === plan && e.pages_limit === g.pages && e.actions_limit === g.actions && e.pages_used === 0, `état serveur : ${JSON.stringify(e)}`);
      const mien = await P.client.rpc('get_my_ai_quota');
      attendu(!mien.error && mien.data[0].pages_limit === g.pages && mien.data[0].actions_limit === g.actions, `get_my_ai_quota : ${JSON.stringify(mien.data)} ${erreur(mien.error)}`);
      const direct = await P.client.rpc('ai_quota_state', { p_user: P.id });
      attendu(direct.error, 'ai_quota_state appelable par un client');
      const tricher = await P.client.rpc('ai_consume_action', { p_user: P.id, p_dossier: null, p_kind: 'question' });
      attendu(tricher.error, 'ai_consume_action appelable par un client');
      const pages = async (n) => {
        const r = await service.rpc('ai_quota_allows_pages', { p_user: P.id, p_pages: n });
        attendu(!r.error, erreur(r.error));
        return r.data;
      };
      if (g.pages === null) attendu((await pages(1_000_000)) === true, 'offre non plafonnée refusée');
      else attendu((await pages(g.pages)) === true && (await pages(g.pages + 1)) === false, `plafond de pages non opposé à ${g.pages}`);
      // Actions : jusqu'au plafond puis refus (préremplissage serveur au-delà de 50 pour borner la durée).
      const consommer = async () => {
        const r = await service.rpc('ai_consume_action', { p_user: P.id, p_dossier: null, p_kind: 'question' });
        attendu(!r.error, erreur(r.error));
        return r.data;
      };
      let detailActions;
      if (g.actions === null) {
        attendu((await consommer()) === true, 'action refusée sans plafond');
        detailActions = 'actions non plafonnées à ce niveau';
      } else {
        const reelles = g.actions <= 50 ? g.actions : 1;
        if (reelles === 1) {
          const lot = Array.from({ length: g.actions - 1 }, () => ({ user_id: P.id, kind: 'question' }));
          const r = await service.from('ai_action_events').insert(lot);
          attendu(!r.error, erreur(r.error));
        }
        for (let i = 0; i < reelles; i++) attendu((await consommer()) === true, `action ${i + 1} refusée avant le plafond`);
        attendu((await consommer()) === false, 'action acceptée au-delà du plafond');
        const fin = await P.client.rpc('get_my_ai_quota');
        attendu(fin.data[0].actions_used === g.actions, `actions consommées ${fin.data[0].actions_used} ≠ ${g.actions}`);
        detailActions = `${g.actions} action(s) puis refus (rien journalisé au-delà)`;
      }
      return `pages ${g.pages ?? 'non plafonnées'} (${g.pages === null ? '' : `${g.pages} oui / ${g.pages + 1} non ; `}RPC internes fermées au client) ; ${detailActions}`;
    });
    await test('3 Offres', `${plan} : e-mail entrant ${g.email ? 'inclus' : 'non inclus'} (décision serveur)`, async () => {
      attendu(dossierOffre, 'prérequis absent (dossier de l’offre)');
      const inclus = await service.rpc('email_inbound_included', { p_user: P.id });
      attendu(!inclus.error && inclus.data === g.email, `email_inbound_included = ${inclus.data} ${erreur(inclus.error)}`);
      const adr = await P.client.rpc('create_inbound_address', { p_dossier: dossierOffre });
      if (g.email) {
        attendu(!adr.error && /^d-[0-9a-f]{32}$/.test(adr.data[0].local_part), `adresse non créée : ${erreur(adr.error)}`);
        return 'adresse d-<32 hex> créée par la RPC';
      }
      attendu(adr.error && /FEATURE_NOT_INCLUDED/.test(adr.error.message), `création non refusée : ${erreur(adr.error) || 'adresse créée'}`);
      return 'RPC refusée : FEATURE_NOT_INCLUDED';
    });
  }
  await test('3 Offres', 'anti-abus : 11ᵉ validation en 10 minutes refusée (RATE_LIMITED), même en illimité', async () => {
    await abonner(P.id, 'business-pme-pro');
    await viderConsommation(P.id);
    await preremplirSoumissions(P.id, 9, 30_000);
    const ok = await creerDossier(P.client, P.id, 'Dossier fictif anti-abus 10');
    attendu(!ok.error, erreur(ok.error));
    const trop = await creerDossier(P.client, P.id, 'Dossier fictif anti-abus 11');
    attendu(trop.error && /RATE_LIMITED/.test(trop.error.message), `non refusé : ${erreur(trop.error) || 'dossier créé'}`);
    await viderConsommation(P.id);
    return '10 acceptées, la 11ᵉ refusée par le déclencheur';
  });
  await test('3 Offres', 'compte sans abonnement : get_my_ai_quota sans plafond d’offre, RPC fermée à l’anonyme', async () => {
    const b = await B.client.rpc('get_my_ai_quota');
    attendu(!b.error && b.data[0].plan_id === null && b.data[0].pages_limit === null, JSON.stringify(b.data));
    const an = await anonyme.rpc('get_my_ai_quota');
    attendu(an.error, 'get_my_ai_quota ouverte à l’anonyme');
    const droits = await anonyme.rpc('get_my_dossier_entitlement');
    attendu(droits.error || droits.data === null, 'droits publiés à l’anonyme');
    return 'sans abonnement : aucune limite d’offre résolue (le moteur IA reste fermé : voir 4) ; anonyme refusé';
  });

  /* ── 4a. Moteur IA : mise en file réelle, comportement sans clé ────────── */
  let dossierIa = null;
  const piecesIa = [];
  const travaux = async (filtre = {}) => {
    let q = service.from('ai_jobs').select('id,kind,status,attempts,document_id,run_after,last_error,revision').eq('dossier_id', dossierIa);
    for (const [k, v] of Object.entries(filtre)) q = q.eq(k, v);
    const { data, error } = await q;
    attendu(!error, erreur(error));
    return data;
  };
  const appelerWorker = async (avecJeton = true) => {
    // Échec RÉSEAU seulement (passerelle en cours de reprise après un redémarrage des fonctions) : nouvel essai.
    // Le worker ne lit aucune entrée et s'appuie sur l'état en base : le rappeler est sans effet de bord.
    for (let essai = 1; ; essai++) {
      try {
        const r = await fetch(`${API}/functions/v1/ai-worker`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ANON_KEY}`, ...(avecJeton ? { 'x-worker-token': JETON_WORKER } : {}) }, body: '{"source":"recette-locale"}', signal: AbortSignal.timeout(170_000) });
        return { status: r.status, corps: await r.json().catch(() => ({})) };
      } catch (e) {
        if (essai >= 4) throw e;
        await pause(1500);
      }
    }
  };
  await test('4a IA sans clé', 'dossier non activé : un dépôt ne met rien en file (jamais lu)', async () => {
    await abonner(A.id, 'entrepreneur');
    const d = await creerDossier(A.client, A.id, 'Dossier fictif A — moteur IA');
    attendu(!d.error, erreur(d.error));
    dossierIa = d.data.id;
    piecesIa.push(await deposer(A.client, A.id, dossierIa, 'facture fictive.pdf', await pdfFictif('Facture fictive', 2), 'application/pdf'));
    piecesIa.push(await deposer(A.client, A.id, dossierIa, 'courrier fictif 1.txt', texteFictif(1), 'text/plain'));
    piecesIa.push(await deposer(A.client, A.id, dossierIa, 'courrier fictif 2.txt', texteFictif(2), 'text/plain'));
    attendu((await travaux()).length === 0, 'travaux créés sans activation');
    return '3 pièces déposées (1 PDF de 2 pages, 2 textes), 0 travail en file';
  });
  await test('4a IA sans clé', 'activation refusée : sans abonnement (SUBSCRIPTION_REQUIRED) et par un tiers (FORBIDDEN)', async () => {
    attendu(dossierIa, 'prérequis absent');
    const dB = await creerDossier(B.client, B.id, 'Dossier fictif B — sans abonnement');
    attendu(!dB.error, erreur(dB.error));
    const sans = await B.client.rpc('enable_ai_processing', { p_dossier: dB.data.id, p_terms_version: CONDITIONS_IA });
    attendu(sans.error && /SUBSCRIPTION_REQUIRED/.test(sans.error.message), `activation sans abonnement : ${erreur(sans.error) || 'acceptée'}`);
    const tiers = await B.client.rpc('enable_ai_processing', { p_dossier: dossierIa, p_terms_version: CONDITIONS_IA });
    attendu(tiers.error && /FORBIDDEN/.test(tiers.error.message), `activation par un tiers : ${erreur(tiers.error) || 'acceptée'}`);
    const an = await anonyme.rpc('enable_ai_processing', { p_dossier: dossierIa, p_terms_version: CONDITIONS_IA });
    attendu(an.error, 'activation anonyme acceptée');
    return 'trois refus serveur';
  });
  await test('4a IA sans clé', 'mise en file réelle : activation par A (RPC du site) puis dépôt (déclencheur)', async () => {
    attendu(dossierIa, 'prérequis absent');
    const act = await A.client.rpc('enable_ai_processing', { p_dossier: dossierIa, p_terms_version: CONDITIONS_IA });
    attendu(!act.error, erreur(act.error));
    let t = await travaux();
    attendu(t.filter((j) => j.kind === 'extract' && j.status === 'queued').length === 3 && t.filter((j) => j.kind === 'consolidate').length === 1, `file après activation : ${JSON.stringify(t.map((j) => [j.kind, j.status]))}`);
    piecesIa.push(await deposer(A.client, A.id, dossierIa, 'courrier fictif 3.txt', texteFictif(3), 'text/plain'));
    t = await travaux();
    const conso = t.find((j) => j.kind === 'consolidate');
    const delai = (new Date(conso.run_after).getTime() - Date.now()) / 1000;
    attendu(t.filter((j) => j.kind === 'extract').length === 4 && t.length === 5, `file après dépôt : ${t.length} travaux`);
    attendu(delai > 60 && delai <= 91, `temporisation de consolidation ${delai.toFixed(0)} s`);
    const vus = await A.client.from('ai_jobs').select('id').eq('dossier_id', dossierIa);
    const vusB = await B.client.from('ai_jobs').select('id').eq('dossier_id', dossierIa);
    attendu(vus.data.length === 5 && vusB.data.length === 0, 'visibilité de la file incorrecte');
    const forcer = await A.client.from('ai_jobs').insert({ dossier_id: dossierIa, user_id: A.id, kind: 'extract' });
    attendu(forcer.error, 'le titulaire peut écrire dans la file');
    return `4 extractions + 1 consolidation (temporisée ${delai.toFixed(0)} s, réarmée au dépôt) ; file lisible par A seul, non inscriptible`;
  });
  await test('4a IA sans clé', 'worker sans jeton : 401 ; avec jeton mais SANS clé Anthropic : 503, rien réclamé', async () => {
    attendu(dossierIa, 'prérequis absent');
    const sans = await appelerWorker(false);
    attendu(sans.status === 401, `sans jeton : HTTP ${sans.status}`);
    const avec = await appelerWorker(true);
    attendu(avec.status === 503 && /ANTHROPIC_API_KEY absent/.test(avec.corps.error ?? ''), `avec jeton : HTTP ${avec.status} ${JSON.stringify(avec.corps)}`);
    const t = await travaux();
    attendu(t.length === 5 && t.every((j) => j.status === 'queued' && j.attempts === 0), 'file modifiée alors que le moteur est inactif');
    const ext = await service.from('ai_extractions').select('id', { count: 'exact', head: true }).eq('dossier_id', dossierIa);
    attendu(ext.count === 0, 'extraction créée sans clé');
    return `401 puis 503 « ${avec.corps.error} » ; 5 travaux toujours en file, 0 tentative, 0 extraction`;
  });

  /* ── 5. E-mail entrant ─────────────────────────────────────────────────── */
  let adresse = null, dossierMail = null;
  const corpsEmail = (emailId, local) => JSON.stringify({ type: 'email.received', created_at: new Date().toISOString(), data: { email_id: emailId, from: 'Expéditeur Fictif <expediteur@exemple.test>', to: [`${local}@${DOMAINE_RECEPTION}`], received_for: [`${local}@${DOMAINE_RECEPTION}`], subject: 'Pièce fictive par e-mail', message_id: `<${emailId}@exemple.test>`, attachments: [] } });
  const posterEmail = async (corps, { id = `msg_${randomBytes(8).toString('hex')}`, horodatage = Math.floor(Date.now() / 1000), secret = secretWebhook, signer = true } = {}) => {
    const cle = Buffer.from(secret.slice(6), 'base64');
    const signature = `v1,${createHmac('sha256', cle).update(`${id}.${horodatage}.${corps}`).digest('base64')}`;
    const r = await fetch(`${API}/functions/v1/email-inbound`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(signer ? { 'svix-id': id, 'svix-timestamp': String(horodatage), 'svix-signature': signature } : {}) }, body: corps, signal: AbortSignal.timeout(120_000) });
    return { status: r.status, reponse: await r.json().catch(() => ({})), id, horodatage };
  };
  const receptions = async () => {
    const { data, error } = await service.from('inbound_emails').select('id,provider_email_id,status,error,from_addr,subject,dossier_id,stored_count').eq('user_id', A.id);
    attendu(!error, erreur(error));
    return data;
  };
  await test('5 E-mail entrant', 'adresse de réception créée par A (offre Entrepreneur), invisible de B', async () => {
    const d = await creerDossier(A.client, A.id, 'Dossier fictif A — e-mail entrant');
    attendu(!d.error, erreur(d.error));
    dossierMail = d.data.id;
    const adr = await A.client.rpc('create_inbound_address', { p_dossier: dossierMail });
    attendu(!adr.error, erreur(adr.error));
    adresse = adr.data[0].local_part;
    const tiers = await B.client.rpc('create_inbound_address', { p_dossier: dossierMail });
    attendu(tiers.error && /FORBIDDEN/.test(tiers.error.message), 'B crée une adresse sur le dossier de A');
    const vue = await B.client.from('inbound_addresses').select('id').eq('dossier_id', dossierMail);
    attendu(vue.data.length === 0, 'B lit l’adresse de A');
    return `adresse ${adresse.slice(0, 8)}…@${DOMAINE_RECEPTION} ; B : FORBIDDEN`;
  });
  await test('5 E-mail entrant', 'signature Svix absente, invalide, mauvais secret, horodatage périmé : 401, rien enregistré', async () => {
    attendu(adresse, 'prérequis absent');
    const corps = corpsEmail(`recette-refus-${execution}`, adresse);
    const absente = await posterEmail(corps, { signer: false });
    const mauvaisSecret = await posterEmail(corps, { secret: `whsec_${randomBytes(24).toString('base64')}` });
    const perimee = await posterEmail(corps, { horodatage: Math.floor(Date.now() / 1000) - 600 });
    const future = await posterEmail(corps, { horodatage: Math.floor(Date.now() / 1000) + 600 });
    // Corps modifié après signature (signature valide pour un AUTRE corps).
    const cle = Buffer.from(secretWebhook.slice(6), 'base64');
    const ts = Math.floor(Date.now() / 1000);
    const altere = await fetch(`${API}/functions/v1/email-inbound`, { method: 'POST', headers: { 'svix-id': 'msg_altere', 'svix-timestamp': String(ts), 'svix-signature': `v1,${createHmac('sha256', cle).update(`msg_altere.${ts}.${corps}`).digest('base64')}` }, body: corps.replace('Pièce fictive', 'Pièce altérée') });
    for (const [nom, r] of [['absente', absente.status], ['mauvais secret', mauvaisSecret.status], ['périmée (-10 min)', perimee.status], ['anticipée (+10 min)', future.status], ['corps altéré', altere.status]]) attendu(r === 401, `signature ${nom} : HTTP ${r}`);
    attendu((await receptions()).length === 0, 'réception enregistrée malgré une signature refusée');
    return '5 variantes refusées en 401 (absente, mauvais secret, -10 min, +10 min, corps altéré), journal vide';
  });
  let premierEnvoi = null;
  await test('5 E-mail entrant', 'signature valide : routage par destinataire enregistré, provenance journalisée', async () => {
    attendu(adresse, 'prérequis absent');
    const inconnu = await posterEmail(corpsEmail(`recette-inconnu-${execution}`, `d-${randomBytes(16).toString('hex')}`));
    attendu(inconnu.status === 200 && inconnu.reponse.processed === 0, `destinataire inconnu : HTTP ${inconnu.status}`);
    const autreType = await posterEmail(JSON.stringify({ type: 'email.sent', data: { email_id: 'x' } }));
    attendu(autreType.status === 200 && autreType.reponse.processed === 0, `autre type d'événement : HTTP ${autreType.status}`);
    const corps = corpsEmail(`recette-email-${execution}`, adresse);
    premierEnvoi = { corps, ...(await posterEmail(corps)) };
    const recu = await receptions();
    attendu(recu.length === 1 && recu[0].dossier_id === dossierMail && recu[0].subject === 'Pièce fictive par e-mail' && /expediteur@exemple\.test/.test(recu[0].from_addr), `journal : ${JSON.stringify(recu)}`);
    const vueB = await B.client.from('inbound_emails').select('id').eq('dossier_id', dossierMail);
    attendu(vueB.data.length === 0, 'B lit le journal de réception de A');
    premierEnvoi.ligne = recu[0];
    return `HTTP ${premierEnvoi.status} ; 1 ligne inbound_emails rattachée au dossier de A (destinataire inconnu et autre événement : 200 sans effet)`;
  });
  await test('5 E-mail entrant', 'récupération du contenu et des pièces jointes chez Resend', async () => {
    attendu(premierEnvoi?.ligne, 'prérequis absent');
    const l = premierEnvoi.ligne;
    attendu(l.status !== 'stored' && l.stored_count === 0, 'pièce stockée sans fournisseur réel ?');
    return bloque(`aucun compte ni domaine Resend : la fonction a répondu HTTP ${premierEnvoi.status}, ligne « ${l.status} »${l.error ? ` (${l.error})` : ''} ; aucune pièce créée. Chemin API des pièces jointes non vérifiable ici.`);
  });
  await test('5 E-mail entrant', 'rejeu du même webhook (signature valide) : aucun second traitement', async () => {
    attendu(premierEnvoi?.ligne, 'prérequis absent');
    const rejeu = await posterEmail(premierEnvoi.corps, { id: premierEnvoi.id });
    attendu(rejeu.status === 200 && rejeu.reponse.processed === 0, `rejeu : HTTP ${rejeu.status} ${JSON.stringify(rejeu.reponse)}`);
    const recu = await receptions();
    attendu(recu.length === 1 && recu[0].id === premierEnvoi.ligne.id, `${recu.length} lignes après rejeu`);
    const docs = await service.from('dossier_documents').select('id', { count: 'exact', head: true }).eq('dossier_id', dossierMail);
    attendu(docs.count === 0, 'pièce créée par le rejeu');
    return `200 { processed: 0 }, toujours 1 ligne (unicité provider_email_id), 0 pièce ; la ligne reste « ${recu[0].status} » : un rejeu ne retente PAS une récupération échouée`;
  });
  await test('5 E-mail entrant', 'adresse révoquée par A : un nouvel e-mail n’est plus accepté', async () => {
    attendu(adresse, 'prérequis absent');
    const rev = await A.client.rpc('revoke_inbound_address', { p_dossier: dossierMail });
    attendu(!rev.error, erreur(rev.error));
    const apres = await posterEmail(corpsEmail(`recette-revoquee-${execution}`, adresse));
    attendu(apres.status === 200 && apres.reponse.processed === 0 && (await receptions()).length === 1, 'e-mail accepté sur une adresse révoquée');
    return '200 sans détail, aucune ligne ajoutée';
  });

  /* ── 4b. Moteur IA sur FAUX modèle (tout est SIMULÉ) ───────────────────── */
  const faux = await demarrerFauxAnthropic(Number(process.env.RECETTE_PORT_FAUX_MODELE || 0));
  const envFaux = ecrireFichierEnv('fonctions-faux-modele.env', { ...communs, ANTHROPIC_API_KEY: 'cle-fictive-recette-locale', ANTHROPIC_BASE_URL: `http://host.docker.internal:${faux.port}` }, WORKDIR);
  let moteurPret = false;
  await test('4b IA simulée', 'fonctions resservies avec ANTHROPIC_BASE_URL → faux serveur local', async () => {
    const d = await fonctions.servir(envFaux);
    moteurPret = true;
    return simule(`prêtes en ${ms(d)} ; faux modèle sur le port ${faux.port} (aucune clé réelle)`);
  });
  const prerequisIa = () => attendu(moteurPret && dossierIa && piecesIa.length === 4, 'prérequis absent (moteur simulé ou dossier IA)');
  await test('4b IA simulée', 'claim → extraction : 4 pièces lues, extractions sourcées enregistrées', async () => {
    prerequisIa();
    const debut = performance.now();
    const r = await appelerWorker(true);
    const duree = performance.now() - debut;
    attendu(r.status === 200 && r.corps.processed === 4, `worker : HTTP ${r.status} ${JSON.stringify(r.corps)}`);
    const { data: ext } = await service.from('ai_extractions').select('document_id,status,pages,model,input_tokens,output_tokens,cost_cents,data').eq('dossier_id', dossierIa);
    attendu(ext.length === 4 && ext.every((e) => e.status === 'ok' && e.model === FAUX_MODELE && e.input_tokens === 1000 && e.output_tokens === 500 && Math.abs(Number(e.cost_cents) - COUT_APPEL) < 0.001), `extractions : ${JSON.stringify(ext.map((e) => [e.status, e.pages, e.cost_cents]))}`);
    const pdf = ext.find((e) => e.document_id === piecesIa[0].id);
    attendu(pdf.pages === 2 && ext.filter((e) => e.pages === null).length === 3, 'nombre de pages incorrect (PDF = 2, textes = null)');
    attendu(ext.every((e) => Array.isArray(e.data?.verification?.evidence_problems) && e.data.verification.evidence_problems.length === 0), 'vérification des références non enregistrée');
    const t = await travaux({ kind: 'extract' });
    attendu(t.every((j) => j.status === 'done' && j.attempts === 1), 'travaux d’extraction non clos');
    attendu(faux.journal.length === 4 && faux.journal.every((q) => q.nature === 'extraction' && q.outils === 0 && q.formatStructure), `requêtes reçues : ${JSON.stringify(faux.journal)}`);
    attendu(faux.journal.some((q) => q.typesDeBlocs.includes('document')), 'le PDF n’a pas été transmis comme bloc document');
    return simule(`4 extractions en ${ms(duree)} (${(4 / (duree / 1000)).toFixed(1)} pièces/s, faux modèle) ; requêtes du worker : format structuré, 0 outil exposé, PDF en bloc « document »`);
  });
  await test('4b IA simulée', 'compteurs : pages IA du mois = 5 (PDF 2 + 3 textes), coût = 4 appels', async () => {
    prerequisIa();
    const q = await A.client.rpc('get_my_ai_quota');
    attendu(!q.error && q.data[0].pages_used === 5 && q.data[0].pages_limit === 150 && q.data[0].plan_id === 'entrepreneur', JSON.stringify(q.data));
    const cout = await service.rpc('ai_month_cost_cents', { p_user: A.id });
    attendu(Math.abs(Number(cout.data) - 4 * COUT_APPEL) < 0.001, `coût du mois ${cout.data}`);
    return simule(`pages 5 / 150 ; coût ${Number(cout.data).toFixed(2)} centime(s)`);
  });
  let cronActif = false;
  await test('4b IA simulée', 'déclenchement planifié : pg_cron + pg_net + Vault (navigateur fermé)', async () => {
    prerequisIa();
    try {
      if (sql("select count(*) from pg_available_extensions where name in ('pg_cron','pg_net')") !== '2') throw new Bloque('pg_cron ou pg_net indisponible dans l’image locale');
      if (sql("select count(*) from pg_extension where extname = 'pg_cron'") !== '1') {
        writeFileSync(marqueurCron, execution);
        sql('create extension pg_cron');
      }
      sql(`select vault.create_secret('${JETON_WORKER}', 'clairdossier_ai_worker_token') where not exists (select 1 from vault.secrets where name = 'clairdossier_ai_worker_token')`);
      // Même requête que la migration 20261102120000 (§7), URL remplacée par la passerelle LOCALE.
      sql(`select cron.schedule('recette-locale-ai-worker', '* * * * *', $cron$ select net.http_post(url := 'http://supabase_kong_${projet}:8000/functions/v1/ai-worker', headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ${env.ANON_KEY}', 'x-worker-token', coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'clairdossier_ai_worker_token' limit 1), '')), body := '{"source":"pg_cron"}'::jsonb) $cron$)`);
      cronActif = true;
      return simule('tâche planifiée chaque minute vers la passerelle locale (jeton lu dans Vault) — effet constaté plus bas');
    } catch (e) {
      if (e instanceof Bloque) throw e;
      throw new Bloque(`planification locale impossible : ${e instanceof Error ? e.message.slice(0, 200) : e}`);
    }
  });

  /* ── 6. Import massif (pendant la temporisation de consolidation) ─────── */
  let dossierImport = null;
  await test('6 Import massif', `${NB_IMPORT} fichiers fictifs déposés un à un (chemin du site : objet → présence → ligne)`, async () => {
    const d = await creerDossier(B.client, B.id, 'Dossier fictif B — import massif');
    attendu(!d.error, erreur(d.error));
    dossierImport = d.data.id;
    const debut = performance.now();
    let octets = 0;
    for (let i = 1; i <= NB_IMPORT; i++) {
      const contenu = texteFictif(1000 + i);
      octets += contenu.length;
      await deposer(B.client, B.id, dossierImport, `piece-${String(i).padStart(3, '0')}.txt`, contenu, 'text/plain');
    }
    const duree = performance.now() - debut;
    const nb = await B.client.from('dossier_documents').select('id', { count: 'exact', head: true }).eq('dossier_id', dossierImport);
    const objets = await listerObjets(service, `${B.id}/${dossierImport}`);
    attendu(nb.count === NB_IMPORT && objets.length === NB_IMPORT, `${nb.count} lignes / ${objets.length} objets`);
    const file = await service.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('dossier_id', dossierImport);
    attendu(file.count === 0, 'travaux IA créés sur un dossier non activé');
    mesures.importMassif = { fichiers: NB_IMPORT, duree_ms: Math.round(duree), fichiers_par_seconde: Number((NB_IMPORT / (duree / 1000)).toFixed(1)), octets };
    return `${NB_IMPORT} lignes et ${NB_IMPORT} objets en ${ms(duree)} — ${mesures.importMassif.fichiers_par_seconde} fichiers/s en séquentiel (${(duree / NB_IMPORT).toFixed(0)} ms/fichier, ${octets} octets) ; aucun plafond rencontré`;
  });
  await test('6 Import massif', 'aucun plafond quotidien côté serveur ; doublons : pas de détection serveur', async () => {
    attendu(dossierImport, 'prérequis absent');
    const meme = texteFictif(1001);
    const bis = await deposer(B.client, B.id, dossierImport, 'piece-001.txt', meme, 'text/plain');
    const nb = await B.client.from('dossier_documents').select('id', { count: 'exact', head: true }).eq('dossier_id', dossierImport).eq('file_name', 'piece-001.txt');
    attendu(nb.count === 2, 'le second dépôt identique a été refusé (détection serveur inattendue)');
    const memeChemin = await B.client.storage.from(BUCKET).upload(bis.chemin, new Blob([meme]), { upsert: false, contentType: 'text/plain' });
    attendu(memeChemin.error, 'écrasement d’un objet existant accepté');
    // Retrait du doublon par le chemin « suppression définitive » du site (objet puis ligne).
    await B.client.storage.from(BUCKET).remove([bis.chemin]);
    const sup = await B.client.from('dossier_documents').delete().eq('id', bis.id);
    attendu(!sup.error, erreur(sup.error));
    return `251ᵉ dépôt (même nom, même contenu) accepté : la détection de doublons n’existe que dans l’interface (duplicateWarning, packages/core) ; même chemin refusé (${erreur(memeChemin.error)}) ; doublon retiré`;
  });

  /* ── 4b (suite). Consolidation, rendus, idempotence, publication ──────── */
  let nbLivrables = 0;
  await test('4b IA simulée', 'consolidation après temporisation → analyse révision 1 → rendus stockés (en attente de relecture)', async () => {
    prerequisIa();
    const debut = performance.now();
    let via = cronActif ? 'pg_cron (aucun appel du script)' : 'appel direct (pg_cron indisponible)';
    for (;;) {
      const [conso] = await travaux({ kind: 'consolidate' });
      if (conso.status === 'done') break;
      attendu(conso.status !== 'failed', `consolidation en échec : ${conso.last_error}`);
      const ecoule = performance.now() - debut;
      attendu(ecoule < 330_000, `consolidation non terminée après ${ms(ecoule)} (statut ${conso.status})`);
      const due = new Date(conso.run_after).getTime() <= Date.now();
      if (due && (!cronActif || ecoule > 200_000)) {
        if (cronActif) via = 'appel direct (pg_cron sans effet après 200 s)';
        await appelerWorker(true);
      } else await pause(3000);
    }
    const attente = performance.now() - debut;
    const ticks = cronActif ? sql("select count(*) from cron.job_run_details d join cron.job j using (jobid) where j.jobname = 'recette-locale-ai-worker'") : '0';
    retirerCron();
    cronActif = false;
    const { data: analyses } = await service.from('ai_analyses').select('revision,review_status,model,coverage,cost_cents,data').eq('dossier_id', dossierIa);
    attendu(analyses.length === 1 && analyses[0].revision === 1 && analyses[0].review_status === 'pending', `analyses : ${JSON.stringify(analyses.map((a) => [a.revision, a.review_status]))}`);
    const a = analyses[0];
    attendu(a.coverage.total === 4 && a.coverage.extracted === 4 && a.coverage.complete === true && a.coverage.stripped_references === 1, `couverture : ${JSON.stringify(a.coverage)}`);
    attendu(a.data.facts.some((f) => f.unverified === true) && a.data.events.length > 0, 'référence inventée non marquée ou chronologie vide');
    const { data: docs } = await service.from('dossier_documents').select('id,file_name,file_path,size_bytes,review_status,ai_revision,generated_by').eq('dossier_id', dossierIa).eq('kind', 'deliverable');
    const familles = new Set(docs.map((d) => d.file_name.replace(/-r\d+\.[a-z]+$/, '')));
    attendu(familles.size === 6, `${familles.size} rendus distincts au lieu de 6 : ${[...familles].join(', ')}`);
    attendu(docs.every((d) => d.review_status === 'pending' && d.ai_revision === 1 && d.generated_by === 'ai' && d.file_path.startsWith(`ai-review/${A.id}/${dossierIa}/`)), 'statut ou préfixe des livrables incorrect');
    for (const d of docs) {
      const f = await service.storage.from(BUCKET).download(d.file_path);
      attendu(!f.error && (await f.data.arrayBuffer()).byteLength === Number(d.size_bytes), `objet ${d.file_name} absent ou de taille différente`);
    }
    nbLivrables = docs.length;
    const vusA = await A.client.from('dossier_documents').select('id').eq('dossier_id', dossierIa).eq('kind', 'deliverable');
    const analyseA = await A.client.from('ai_analyses').select('revision').eq('dossier_id', dossierIa);
    const dlA = await A.client.storage.from(BUCKET).download(docs[0].file_path);
    attendu(vusA.data.length === 0 && analyseA.data.length === 0 && dlA.error, 'le titulaire voit des résultats non relus');
    const ev = await service.from('dossier_events').select('type').eq('dossier_id', dossierIa).eq('type', 'analyse_en_relecture');
    attendu(ev.data.length === 1, 'événement analyse_en_relecture absent');
    mesures.iaSimulee = { attente_consolidation_ms: Math.round(attente), declenchement: via, livrables: docs.length, executions_cron: Number(ticks) };
    return simule(`déclenchée par ${via} après ${ms(attente)} (${ticks} exécution(s) cron) ; révision 1 « pending », couverture 4/4, 1 référence inventée retirée ; ${docs.length} fichiers (${[...familles].join(', ')}) présents dans Storage sous ai-review/, invisibles du titulaire`);
  });
  const compter = async () => {
    const [ext, ana, liv, jobs] = await Promise.all([
      service.from('ai_extractions').select('id', { count: 'exact', head: true }).eq('dossier_id', dossierIa),
      service.from('ai_analyses').select('id', { count: 'exact', head: true }).eq('dossier_id', dossierIa),
      service.from('dossier_documents').select('id', { count: 'exact', head: true }).eq('dossier_id', dossierIa).eq('kind', 'deliverable'),
      service.from('ai_jobs').select('id', { count: 'exact', head: true }).eq('dossier_id', dossierIa),
    ]);
    return `${ext.count}/${ana.count}/${liv.count}/${jobs.count}`;
  };
  await test('4b IA simulée', 'idempotence : second passage du worker et réactivation sans effet', async () => {
    prerequisIa();
    attendu(nbLivrables > 0, 'prérequis absent (consolidation)');
    const avant = await compter();
    const appels = faux.journal.length;
    const r = await appelerWorker(true);
    attendu(r.status === 200 && r.corps.processed === 0, `second passage : ${JSON.stringify(r.corps)}`);
    const react = await A.client.rpc('enable_ai_processing', { p_dossier: dossierIa, p_terms_version: CONDITIONS_IA });
    attendu(!react.error, erreur(react.error));
    const r2 = await appelerWorker(true);
    attendu(r2.corps.processed === 0, 'travail créé par la réactivation');
    attendu((await compter()) === avant && faux.journal.length === appels, `compteurs modifiés : ${avant} → ${await compter()}`);
    attendu(appels === 5, `${appels} appels au modèle au lieu de 5 (4 extractions + 1 consolidation)`);
    const cout = await service.rpc('ai_month_cost_cents', { p_user: A.id });
    attendu(Math.abs(Number(cout.data) - 5 * COUT_APPEL) < 0.001, `coût du mois ${cout.data}`);
    return simule(`0 travail traité, compteurs inchangés (extractions/analyses/livrables/travaux = ${avant}), 5 appels au modèle au total, coût ${Number(cout.data).toFixed(2)} centimes`);
  });
  await test('4b IA simulée', 'publication : approbation administrateur → fichiers déplacés, visibles de A seul, échéance créée', async () => {
    prerequisIa();
    attendu(nbLivrables > 0, 'prérequis absent (consolidation)');
    const refus = await A.client.rpc('ai_approve_revision', { p_dossier: dossierIa, p_revision: 1 });
    attendu(refus.error && /FORBIDDEN/.test(refus.error.message), 'le titulaire peut approuver sa propre révision');
    const adm = await service.from('app_admins').insert({ user_id: ADMIN.id });
    attendu(!adm.error, erreur(adm.error));
    const ok = await ADMIN.client.rpc('ai_approve_revision', { p_dossier: dossierIa, p_revision: 1, p_note: 'recette locale' });
    attendu(!ok.error, erreur(ok.error));
    const r = await appelerWorker(true);
    attendu(r.status === 200 && r.corps.processed === 1, `publication : ${JSON.stringify(r.corps)}`);
    const { data: docs } = await A.client.from('dossier_documents').select('id,file_name,file_path,review_status').eq('dossier_id', dossierIa).eq('kind', 'deliverable');
    attendu(docs.length === nbLivrables && docs.every((d) => d.review_status === 'approved' && d.file_path.startsWith(`${A.id}/${dossierIa}/`)), `${docs.length} livrables visibles de A`);
    const pdf = docs.find((d) => d.file_name.endsWith('.pdf'));
    const dl = await A.client.storage.from(BUCKET).download(pdf.file_path);
    attendu(!dl.error && Buffer.from(await dl.data.arrayBuffer()).subarray(0, 5).toString() === '%PDF-', 'PDF publié illisible par A');
    attendu((await listerObjets(service, `ai-review/${A.id}`)).length === 0, 'fichiers restés sous ai-review/');
    const vusB = await B.client.from('dossier_documents').select('id').eq('dossier_id', dossierIa);
    attendu(vusB.data.length === 0, 'B voit les livrables de A');
    const ana = await A.client.from('ai_analyses').select('review_status').eq('dossier_id', dossierIa).single();
    attendu(ana.data?.review_status === 'published', 'analyse non publiée');
    const ech = await A.client.from('dossier_deadlines').select('title,due_date,ai_key').eq('dossier_id', dossierIa);
    attendu(ech.data.length === 1 && ech.data[0].due_date === ECHEANCE_SIMULEE.date && ech.data[0].ai_key, `échéances : ${JSON.stringify(ech.data)}`);
    const notif = await service.from('ai_notifications').select('status,revision').eq('dossier_id', dossierIa);
    attendu(notif.data.length === 1 && notif.data[0].status === 'not_configured', `notification : ${JSON.stringify(notif.data)}`);
    const encore = await appelerWorker(true);
    attendu(encore.corps.processed === 0 && faux.journal.length === 5, 'second passage non neutre après publication');
    const retire = await service.from('app_admins').delete().eq('user_id', ADMIN.id);
    attendu(!retire.error, erreur(retire.error));
    return simule(`${docs.length} livrables « approved » sous ${A.id.slice(0, 8)}…/, PDF relu par A, analyse « published », 1 échéance synchronisée, notification « not_configured » (aucun e-mail : pas de clé Resend), second passage neutre`);
  });
  await test('4b IA simulée', 'quota de pages atteint : extraction refusée par le serveur avant tout appel au modèle', async () => {
    prerequisIa();
    const der = await service.from('entitlement_overrides').insert({ user_id: A.id, mode: 'bonus', dossier_limit: 0, reason: 'recette locale — plafond de pages IA abaissé à la consommation', ai_pages_month: 5 });
    attendu(!der.error, erreur(der.error));
    const q0 = await A.client.rpc('get_my_ai_quota');
    attendu(q0.data[0].pages_limit === 5 && q0.data[0].pages_used === 5, JSON.stringify(q0.data));
    const appels = faux.journal.length;
    const piece = await deposer(A.client, A.id, dossierIa, 'piece hors quota.pdf', await pdfFictif('Piece hors quota', 2), 'application/pdf');
    const r = await appelerWorker(true);
    attendu(r.status === 200 && r.corps.processed === 1, JSON.stringify(r.corps));
    const [job] = await travaux({ document_id: piece.id });
    attendu(job.status === 'failed' && /^BUDGET: pages IA/.test(job.last_error ?? ''), `travail : ${job.status} ${job.last_error}`);
    const ext = await service.from('ai_extractions').select('id', { count: 'exact', head: true }).eq('document_id', piece.id);
    const q1 = await A.client.rpc('get_my_ai_quota');
    attendu(ext.count === 0 && q1.data[0].pages_used === 5 && faux.journal.length === appels, 'consommation ou appel au modèle malgré le refus');
    const present = await A.client.storage.from(BUCKET).exists(piece.chemin);
    attendu(present.data === true, 'pièce perdue');
    return simule(`travail « failed » : ${job.last_error.slice(0, 70)}… ; 0 appel au modèle, pages 5/5 inchangées, pièce conservée`);
  });
  await test('4b IA simulée', 'B ne peut pas injecter une pièce dans la file IA du dossier de A', async () => {
    prerequisIa();
    // Ligne au nom de B, rattachée au dossier de A, pointant vers le fichier d'une pièce de A.
    const ins = await B.client.from('dossier_documents').insert({ dossier_id: dossierIa, user_id: B.id, file_name: 'piece injectee par B.txt', file_path: piecesIa[1].chemin, kind: 'piece' }).select('id');
    if (ins.error) return `refus : ${erreur(ins.error)}`;
    const id = ins.data[0].id;
    const constats = [];
    try {
      const [job] = await travaux({ document_id: id });
      if (job) constats.push(`le déclencheur documents_ai_enqueue a créé un travail « ${job.kind} » au nom du titulaire A`);
      const appels = faux.journal.length;
      await appelerWorker(true);
      const lu = await B.client.from('ai_extractions').select('status,dossier_id,data').eq('document_id', id).maybeSingle();
      if (lu.data) constats.push(`le worker (clé de service) a lu le fichier de A désigné par B (${faux.journal.length - appels} appel au modèle) et B lit l’extraction « ${lu.data.status} » produite (contenu simulé ici) — sans abonnement ni quota, celui de A étant épuisé`);
    } finally {
      await service.from('dossier_documents').delete().eq('id', id);
    }
    throw new Error(`DÉFAUT RLS : B a inséré une pièce dans le dossier IA de A${constats.length ? ` ; ${constats.join(' ; ')}` : ''} — ligne, travail et extraction retirés après constat`);
  });
  await test('4b IA simulée', 'désactivation par A : travaux ouverts annulés, résultats conservés', async () => {
    prerequisIa();
    const des = await A.client.rpc('disable_ai_processing', { p_dossier: dossierIa });
    attendu(!des.error, erreur(des.error));
    const t = await travaux();
    attendu(t.every((j) => !['queued', 'running'].includes(j.status)), 'travaux encore ouverts');
    const r = await appelerWorker(true);
    attendu(r.corps.processed === 0, 'travail traité après désactivation');
    const liv = await A.client.from('dossier_documents').select('id', { count: 'exact', head: true }).eq('dossier_id', dossierIa).eq('kind', 'deliverable');
    attendu(liv.count === nbLivrables, 'livrables perdus à la désactivation');
    return simule(`${t.filter((j) => j.status === 'cancelled').length} travail(aux) annulé(s), ${liv.count} livrables conservés`);
  });

  /* ── Fin ──────────────────────────────────────────────────────────────── */
  retirerCron();
  await faux.arreter();
  await test('7 Remise en état', 'pg_cron local retiré, garde réseau en place, fonctions resservies sans clé', async () => {
    attendu(gardeEnPlace(sql), 'garde réseau absente en fin de recette');
    attendu(sql("select count(*) from pg_extension where extname = 'pg_cron'") === '0' || !existsSync(marqueurCron), 'pg_cron créé par la recette encore présent');
    const d = await fonctions.servir(envSansCle, { detacher: true });
    const r = await appelerWorker(true);
    attendu(r.status === 503, `moteur non revenu à l'état inactif : HTTP ${r.status}`);
    return `fonctions resservies en ${ms(d)} (503 sans clé)${NETTOYER ? ` ; ${await purger()}` : ' ; données fictives conservées pour inspection (purgées à la prochaine exécution, ou --nettoyer)'}`;
  });
  return conclure(debutTotal);
}

function conclure(debutTotal) {
  const total = performance.now() - debutTotal;
  const compte = {};
  for (const l of lignes) compte[l.statut] = (compte[l.statut] ?? 0) + 1;
  const parSection = {};
  for (const l of lignes) parSection[l.section] = (parSection[l.section] ?? 0) + l.duree_ms;
  console.log('\n── Récapitulatif ─────────────────────────────────────────────');
  console.log(`${lignes.length} tests en ${ms(total)} : ${['VÉRIFIÉ', 'SIMULÉ', 'BLOQUÉ', 'ÉCHEC'].map((s) => `${compte[s] ?? 0} ${s}`).join(' · ')}`);
  for (const [s, d] of Object.entries(parSection)) console.log(`  ${s.padEnd(18)} ${ms(d)}`);
  for (const l of lignes.filter((x) => x.statut === 'ÉCHEC')) console.log(`  ÉCHEC — ${l.section} | ${l.test} : ${l.detail}`);
  if (SORTIE_JSON) {
    writeFileSync(SORTIE_JSON, JSON.stringify({ date: new Date().toISOString(), duree_totale_ms: Math.round(total), compte, durees_par_section_ms: parSection, import_massif: mesures.importMassif ?? null, ia_simulee: mesures.iaSimulee ?? null, tests: [...lignes] }, null, 2));
    console.log(`Résultats détaillés : ${SORTIE_JSON}`);
  }
  process.exit((compte['ÉCHEC'] ?? 0) > 0 ? 1 : 0);
}

principal().catch((e) => {
  console.error(`\nERREUR FATALE : ${e instanceof Error ? e.stack : e}`);
  process.exit(2);
});
