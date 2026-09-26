// Edge Function: delete-account — suppression du compte par son titulaire.
//
// Pourquoi une fonction serveur : effacer un utilisateur `auth.users` demande
// un privilège que le client n'a pas (et ne doit pas avoir). La fonction
// vérifie d'abord le jeton de l'appelant, puis n'efface QUE les données de cet
// utilisateur — jamais un identifiant reçu dans le corps de la requête.
//
// Exigences couvertes : App Store 5.1.1(v), Google Play « Suppression du
// compte », droit à l'effacement (RGPD art. 17).
//
// Chaîne : CORS strict → authentification → confirmation explicite →
// suppression des fichiers du bucket privé → suppression de l'utilisateur
// (les tables liées disparaissent par `on delete cascade`).
//
// Secrets attendus (injectés par la plateforme, jamais dans le code) :
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY.

import { createClient } from 'npm:@supabase/supabase-js@2';

const SITE = 'https://www.clair-dossier.com';

// L'application mobile n'envoie pas d'origine : la vérification d'origine ne
// remplace donc jamais la vérification du jeton, qui est la seule garantie.
const ALLOWED_ORIGINS = new Set([
  'https://www.clair-dossier.com',
  'https://clair-dossier.com',
  'https://clair-dossier.netlify.app',
  'http://localhost:5173',
  'http://localhost:4173',
]);

const BUCKET = 'documents';
const CONFIRMATION = 'SUPPRIMER';

function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

/** Liste récursivement les fichiers d'un préfixe du bucket privé. */
async function listAll(
  admin: ReturnType<typeof createClient>,
  prefix: string,
  depth = 0,
): Promise<string[]> {
  if (depth > 4) return []; // garde-fou : l'arborescence est <user>/<dossier>/<fichier>
  const { data, error } = await admin.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error || !data) return [];
  const files: string[] = [];
  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    // Un « dossier » n'a pas de métadonnées de fichier.
    if (entry.id === null || entry.metadata === null) {
      files.push(...(await listAll(admin, path, depth + 1)));
    } else {
      files.push(path);
    }
  }
  return files;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), { status: 405, headers });
  }

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !anonKey || !serviceKey) {
    console.error('delete-account: configuration incomplète');
    return new Response(JSON.stringify({ error: 'server_misconfigured' }), { status: 500, headers });
  }

  // 1. Authentification : l'identité vient du JETON, jamais du corps de la requête.
  const authorization = req.headers.get('Authorization') ?? '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
  }

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: userData, error: userError } = await caller.auth.getUser();
  const user = userData?.user;
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers });
  }

  // 2. Confirmation explicite (double sécurité contre un appel accidentel).
  let confirm = '';
  try {
    const body = (await req.json()) as { confirm?: unknown };
    confirm = typeof body.confirm === 'string' ? body.confirm : '';
  } catch {
    confirm = '';
  }
  if (confirm.trim().toUpperCase() !== CONFIRMATION) {
    return new Response(JSON.stringify({ error: 'confirmation_required' }), { status: 400, headers });
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // 3. Fichiers du bucket privé : ils ne sont PAS supprimés en cascade.
  try {
    const paths = await listAll(admin, user.id);
    for (let i = 0; i < paths.length; i += 100) {
      const slice = paths.slice(i, i + 100);
      const { error } = await admin.storage.from(BUCKET).remove(slice);
      if (error) console.error('delete-account: échec suppression fichiers', error.message);
    }
  } catch (error) {
    console.error('delete-account: erreur stockage', error instanceof Error ? error.message : 'inconnue');
  }

  // 4. Jetons de notification de cet utilisateur (au cas où la table existe).
  await admin.from('device_push_tokens').delete().eq('user_id', user.id);

  // 5. Utilisateur : profiles, dossiers, pièces, échéances et journal
  //    disparaissent par `on delete cascade` (voir les migrations initiales).
  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('delete-account: échec suppression utilisateur', deleteError.message);
    return new Response(JSON.stringify({ error: 'delete_failed' }), { status: 500, headers });
  }

  console.log('delete-account: compte supprimé');
  return new Response(JSON.stringify({ deleted: true }), { status: 200, headers });
});
