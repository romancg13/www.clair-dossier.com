/**
 * Edge Function : ldi-jurisprudence
 *
 * Relais vers Judilibre, via PISTE. Volontairement mince : elle ne cherche
 * rien d'elle-même, elle ne complète rien, elle ne garde rien.
 *
 * ┌─ POURQUOI CE RELAIS EXISTE ─────────────────────────────────────────────┐
 * │ Une clé PISTE livrée au navigateur n'est pas une clé secrète : elle est  │
 * │ lisible par quiconque ouvre les outils de développement, et les quotas   │
 * │ sont attachés à l'opérateur. Le secret doit donc rester ici.             │
 * │                                                                          │
 * │ Voir docs/RECHERCHE-JURIDIQUE.md pour l'analyse des options écartées.    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ CE QUI SORT DU POSTE DE L'AVOCAT ──────────────────────────────────────┐
 * │ UNE RÉFÉRENCE D'ARTICLE, et rien d'autre. « CPP, art. 63-4-2 » ne        │
 * │ désigne ni le client, ni le dossier, ni les faits.                       │
 * │                                                                          │
 * │ Il n'existe AUCUN champ de recherche libre, ni côté client ni ici. Un    │
 * │ tel champ laisserait passer « garde à vue Dupont 14 mars stupéfiants »,  │
 * │ et cette phrase-là ne doit pas quitter le cabinet. La borne n'est pas    │
 * │ une consigne d'usage : c'est l'absence du chemin de code.                │
 * │                                                                          │
 * │ Ce qui arrive dans le corps est un ALLÉGUÉ, quoi qu'il prétende : la     │
 * │ liste est intersectée avec le corpus détenu ici. L'appelant restreint,   │
 * │ il n'élargit pas — même discipline que `ldi-analyze`.                    │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ CE QUE CE RELAIS N'ALIMENTE PAS ───────────────────────────────────────┐
 * │ Les arrêts trouvés ici ne sont PAS transmis à l'étage génératif. Ils     │
 * │ sont montrés à l'avocat, qui les lit et décide. Faire l'inverse          │
 * │ supposerait que `ldi-analyze` puisse vérifier lui-même qu'un pourvoi     │
 * │ vient bien de Judilibre — ce qu'il ne peut pas faire sans l'interroger à │
 * │ son tour. Tant que ce n'est pas fait, il n'autorise aucun pourvoi, et    │
 * │ c'est le comportement correct.                                           │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Secrets attendus :
 *   LDI_PISTE_CLIENT_ID       identifiant d'application PISTE (obligatoire)
 *   LDI_PISTE_CLIENT_SECRET   secret associé (obligatoire)
 *   LDI_PISTE_OAUTH_URL       défaut : https://oauth.piste.gouv.fr/api/oauth/token
 *   LDI_JUDILIBRE_URL         défaut : https://api.piste.gouv.fr/cassation/judilibre/v1.0/
 *   SUPABASE_URL              injecté par la plateforme
 *   SUPABASE_ANON_KEY         injecté par la plateforme
 */
import { createClient } from 'npm:@supabase/supabase-js@2';

import { REFERENCES_AUTORITE } from './corpus-autorite.ts';
import { REFERENCES_MAX, chercherJurisprudence, type IdentifiantsPiste } from './piste.ts';

const IDENTIFIANTS: IdentifiantsPiste | null = (() => {
  const clientId = Deno.env.get('LDI_PISTE_CLIENT_ID') ?? '';
  const clientSecret = Deno.env.get('LDI_PISTE_CLIENT_SECRET') ?? '';
  if (!clientId || !clientSecret) return null;

  return {
    clientId,
    clientSecret,
    urlOauth: Deno.env.get('LDI_PISTE_OAUTH_URL') ?? 'https://oauth.piste.gouv.fr/api/oauth/token',
    urlJudilibre:
      Deno.env.get('LDI_JUDILIBRE_URL') ?? 'https://api.piste.gouv.fr/cassation/judilibre/v1.0/',
  };
})();

/** Délai au-delà duquel la vérification d'identité est abandonnée. */
const DELAI_AUTH_MS = 8_000;

const CORS = {
  'Access-Control-Allow-Origin': 'https://www.clair-dossier.com',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(charge: unknown, status = 200): Response {
  return new Response(JSON.stringify(charge), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

/**
 * Vérifie que l'appel émane d'un utilisateur authentifié.
 *
 * Sans cette barrière, la fonction serait un proxy ouvert vers un quota PISTE
 * attaché à l'opérateur : n'importe qui interrogerait Judilibre en son nom,
 * jusqu'à épuisement du quota du cabinet.
 */
async function utilisateurAuthentifie(req: Request): Promise<boolean> {
  const entete = req.headers.get('Authorization') ?? '';
  if (!entete.startsWith('Bearer ')) return false;

  const url = Deno.env.get('SUPABASE_URL');
  const cle = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !cle) return false;

  // `getUser()` n'expose ni délai ni signal d'annulation. Le délai est donc
  // posé sur le `fetch` lui-même, avec un contrôleur qui l'interrompt vraiment.
  const client = createClient(url, cle, {
    global: {
      headers: { Authorization: entete },
      fetch: (entree, init) => {
        const controleur = new AbortController();
        const minuterie = setTimeout(() => controleur.abort(), DELAI_AUTH_MS);
        return fetch(entree, { ...init, signal: controleur.signal }).finally(() =>
          clearTimeout(minuterie)
        );
      },
    },
    auth: { persistSession: false },
  });

  try {
    const { data, error } = await client.auth.getUser();
    return !error && Boolean(data.user);
  } catch {
    // Abandon, réseau coupé, réponse illisible : l'authentification échoue.
    // Elle ne s'ouvre jamais sur une erreur.
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  if (!IDENTIFIANTS) {
    // Pas de dégradation vers un résultat approximatif : sans identifiants, il
    // n'y a pas de jurisprudence, et l'écran doit le dire.
    return json(
      {
        error: 'Source de jurisprudence non configurée.',
        detail:
          "Les identifiants PISTE ne sont pas renseignés sur ce déploiement. Aucune décision n'est retournée, et aucune n'est produite à la place.",
      },
      503
    );
  }

  if (!(await utilisateurAuthentifie(req))) {
    return json({ error: 'Authentification requise.' }, 401);
  }

  let corps: { references?: unknown };
  try {
    corps = await req.json();
  } catch {
    return json({ error: 'Corps de requête illisible.' }, 400);
  }

  const proposees = Array.isArray(corps.references)
    ? corps.references.filter((r): r is string => typeof r === 'string').slice(0, REFERENCES_MAX)
    : [];

  if (proposees.length === 0) {
    return json({ error: 'Aucune référence à rechercher.' }, 400);
  }

  // ┌─ L'APPELANT NE FIXE PAS CE QU'ON A LE DROIT DE CHERCHER ──────────────┐
  // │ L'intersection avec le corpus serveur est la seule chose qui empêche   │
  // │ un appelant authentifié d'envoyer un texte libre — donc du contenu de  │
  // │ dossier — dans une requête sortante.                                   │
  // └────────────────────────────────────────────────────────────────────────┘
  const autorisees = new Set(REFERENCES_AUTORITE.map((r) => r.toLowerCase()));
  const retenues = proposees.filter((r) => autorisees.has(r.trim().toLowerCase()));
  const ecartees = proposees.filter((r) => !autorisees.has(r.trim().toLowerCase()));

  if (retenues.length === 0) {
    return json(
      {
        error: 'Aucune référence recevable.',
        ecartees,
        detail:
          "Seules les références du corpus peuvent être recherchées. Une recherche en texte libre n'est pas prévue : elle ferait sortir du poste des éléments du dossier.",
      },
      422
    );
  }

  // Séquentiel, pas parallèle : le quota PISTE est celui de l'opérateur, et
  // huit requêtes simultanées sont le meilleur moyen de se faire limiter.
  const resultats = [];
  for (const reference of retenues) {
    resultats.push(await chercherJurisprudence(reference, IDENTIFIANTS));
  }

  return json({
    resultats,
    ecartees,
    origine: 'Judilibre, via PISTE — relayé sans modification',
    consulteLe: new Date().toISOString().slice(0, 10),
    reserve:
      "Ces décisions sont restituées telles que la source les a rendues. Aucune n'est complétée ni interprétée. Avant toute citation dans un acte, l'arrêt doit être lu intégralement : un sommaire ne fait pas la portée d'une décision.",
  });
});
