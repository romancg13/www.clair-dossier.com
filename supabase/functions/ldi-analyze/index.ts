/**
 * Edge Function : ldi-analyze
 *
 * Étage génératif de LDI. Volontairement mince : elle ne calcule rien, elle ne
 * voit jamais le dossier brut.
 *
 * ┌─ RÉPARTITION DES RÔLES ─────────────────────────────────────────────────┐
 * │ Le noyau déterministe (src/ldi) s'exécute chez l'appelant — navigateur   │
 * │ ou CLI. Lui seul touche aux pièces. Il produit un rapport markdown déjà  │
 * │ pseudonymisé (src/ldi/confidentialite.ts), et c'est CE rapport qui est   │
 * │ transmis ici.                                                            │
 * │                                                                          │
 * │ Cette fonction ne reçoit donc pas le dossier : elle reçoit une synthèse  │
 * │ minimisée, et détient la seule chose qui ne peut pas vivre côté client — │
 * │ la clé d'API.                                                            │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Secrets attendus :
 *   ANTHROPIC_API_KEY   clé d'API (obligatoire)
 *   LDI_MODEL           identifiant de modèle (défaut : claude-opus-5)
 *   LDI_PLAFOND_DOSSIER_DOLLARS  plafond de dépense par dossier (défaut : 5)
 *   SUPABASE_URL        injecté par la plateforme
 *   SUPABASE_ANON_KEY   injecté par la plateforme
 */
import Anthropic from 'npm:@anthropic-ai/sdk@0.117.1';
import { createClient } from 'npm:@supabase/supabase-js@2';

import { verifierCitations } from './citations.ts';
import { INVITE_SYSTEME, construireMessage } from './prompt.ts';
import {
  PLAFOND_DOSSIER_DOLLARS,
  TARIFS_PAR_MILLION,
  TENTATIVES_MAX,
  controlerAvantAppel,
  estimerCout,
  validerStructure,
} from './reponse.ts';

const MODELE = Deno.env.get('LDI_MODEL') ?? 'claude-opus-5';
const CLE_API = Deno.env.get('ANTHROPIC_API_KEY') ?? '';

/** Plafond de dépense par dossier. Une valeur d'environnement illisible est ignorée. */
const PLAFOND = (() => {
  const brut = Number(Deno.env.get('LDI_PLAFOND_DOSSIER_DOLLARS'));
  return Number.isFinite(brut) && brut > 0 ? brut : PLAFOND_DOSSIER_DOLLARS;
})();

/** Le rapport déterministe reste borné : au-delà, l'appelant doit le réduire. */
const TAILLE_MAX_RAPPORT = 200_000;
const TAILLE_MAX_QUESTION = 4_000;

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
 * Sans cette barrière, la fonction serait un proxy ouvert vers une clé d'API
 * facturée.
 */
async function utilisateurAuthentifie(req: Request): Promise<boolean> {
  const entete = req.headers.get('Authorization') ?? '';
  if (!entete.startsWith('Bearer ')) return false;

  const url = Deno.env.get('SUPABASE_URL');
  const cle = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !cle) return false;

  const client = createClient(url, cle, {
    global: { headers: { Authorization: entete } },
    auth: { persistSession: false },
  });

  const { data, error } = await client.auth.getUser();
  return !error && Boolean(data.user);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Méthode non autorisée.' }, 405);

  if (!CLE_API) {
    return json({ error: "Le service d'analyse n'est pas configuré." }, 503);
  }
  if (!(await utilisateurAuthentifie(req))) {
    return json({ error: 'Authentification requise.' }, 401);
  }

  let corps: {
    rapport?: unknown;
    question?: unknown;
    sources?: unknown;
    referencesAutorisees?: unknown;
    pourvoisAutorises?: unknown;
    coutEngage?: unknown;
  };
  try {
    corps = await req.json();
  } catch {
    return json({ error: 'Corps de requête illisible.' }, 400);
  }

  const rapport = typeof corps.rapport === 'string' ? corps.rapport : '';
  const question = typeof corps.question === 'string' ? corps.question.trim() : '';
  const sources = typeof corps.sources === 'string' ? corps.sources : '';

  // Ensemble citable, calculé par l'appelant à partir du sourçage officiel.
  // Vide par défaut : en l'absence de sourçage, RIEN n'est citable.
  const chaines = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').slice(0, 500) : [];
  const referencesAutorisees = chaines(corps.referencesAutorisees);
  const pourvoisAutorises = chaines(corps.pourvoisAutorises);

  if (!rapport) return json({ error: 'Rapport d’analyse manquant.' }, 400);
  if (!question) return json({ error: 'Question manquante.' }, 400);
  if (rapport.length > TAILLE_MAX_RAPPORT) {
    return json({ error: 'Rapport trop volumineux : le réduire côté client.' }, 413);
  }
  if (question.length > TAILLE_MAX_QUESTION) {
    return json({ error: 'Question trop longue.' }, 413);
  }

  // Plafond de dépense — contrôlé AVANT l'appel, seul moment où le contrôle
  // évite quelque chose. Le cumul est tenu par l'appelant : le serveur ne
  // dispose d'aucun compteur (voir controlerAvantAppel, § LIMITE À CONNAÎTRE).
  // Une valeur absente vaut zéro ; une valeur présente mais non numérique est
  // refusée plutôt que ramenée à zéro.
  const coutEngage = corps.coutEngage === undefined ? 0 : Number(corps.coutEngage);
  const plafond = controlerAvantAppel(coutEngage, PLAFOND);
  if (!plafond.autorise) {
    return json({ error: plafond.message, plafondDollars: PLAFOND, coutEngage }, 429);
  }

  // La fonction a une horloge d'invocation : sans borne explicite, un appel
  // amont bloqué la consomme entièrement et l'appelant reçoit une erreur de
  // plateforme au lieu d'un message utile.
  const client = new Anthropic({ apiKey: CLE_API, timeout: 120_000, maxRetries: 1 });

  try {
    // Le fil est conservé d'une tentative à l'autre : la relance corrective
    // s'ajoute à la conversation au lieu de repartir de zéro, sinon le modèle
    // perdrait l'analyse déjà produite et en écrirait une autre.
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: 'user', content: construireMessage({ rapport, sources, question }) },
    ];

    let texte = '';
    let modeleServi = MODELE;
    let structure = validerStructure('');
    const jetons = { entree: 0, sortie: 0, cacheLu: 0, cacheEcrit: 0 };

    for (let tentative = 1; tentative <= TENTATIVES_MAX; tentative += 1) {
      const reponse = await client.beta.messages.create({
        model: MODELE,
        max_tokens: 16000,
        // Réflexion adaptative : sur ce type d'analyse, le raisonnement compte
        // davantage que la latence.
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        // Repli côté serveur : une analyse pénale peut déclencher un refus de
        // classification. Plutôt qu'une réponse vide renvoyée à l'avocat, la
        // requête est rejouée sur un modèle de repli dans le même appel.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        system: [{ type: 'text', text: INVITE_SYSTEME, cache_control: { type: 'ephemeral' } }],
        messages,
      });

      // Comptabilisé tentative par tentative : une relance est un second appel
      // facturé, et le coût affiché doit être celui de la demande entière.
      jetons.entree += reponse.usage.input_tokens;
      jetons.sortie += reponse.usage.output_tokens;
      jetons.cacheLu += reponse.usage.cache_read_input_tokens ?? 0;
      jetons.cacheEcrit += reponse.usage.cache_creation_input_tokens ?? 0;

      if (reponse.stop_reason === 'refusal') {
        // `stop_details` vient du fournisseur et peut contenir des fragments de
        // la requête : il est journalisé côté serveur, jamais renvoyé au client.
        console.error('[ldi-analyze] refus de classification', reponse.stop_details ?? null);
        return json({ error: "L'analyse n'a pas pu être produite pour cette demande." }, 422);
      }

      texte = reponse.content
        .filter((bloc): bloc is Anthropic.Beta.BetaTextBlock => bloc.type === 'text')
        .map((bloc) => bloc.text)
        .join('\n');
      modeleServi = reponse.model;

      structure = validerStructure(texte);
      if (structure.conforme) break;

      // Une réponse tronquée par la limite de jetons n'est pas un défaut de
      // structure : la relancer produirait la même troncature, en double.
      if (reponse.stop_reason === 'max_tokens') {
        console.warn('[ldi-analyze] réponse tronquée', structure.sectionsManquantes);
        break;
      }

      if (tentative < TENTATIVES_MAX) {
        console.warn('[ldi-analyze] structure incomplète, relance', structure.sectionsManquantes);
        messages.push({ role: 'assistant', content: texte });
        messages.push({ role: 'user', content: structure.consigneCorrective });
      }
    }

    // Contrôle après génération, sur le texte produit. C'est ici, et nulle part
    // ailleurs, que la règle « aucune référence hors source officielle » devient
    // exécutée plutôt que demandée. Le texte du dossier n'entre pas dans
    // l'ensemble autorisé : une référence recopiée dans une pièce est du
    // contenu, pas une source.
    const verification = verifierCitations(texte, {
      references: referencesAutorisees.map((reference) => ({ reference })),
      decisions: pourvoisAutorises.map((numero) => ({ numero })),
    });

    if (!verification.conforme) {
      console.warn('[ldi-analyze] citations non vérifiées', verification.inconnues);
    }

    // Le plafond est appliqué sur la part restante : ce qui compte est le
    // cumul du dossier, pas le coût du seul appel qui vient de s'exécuter.
    const cout = estimerCout(jetons, TARIFS_PAR_MILLION, PLAFOND - coutEngage);
    if (cout.plafondDepasse) {
      console.warn('[ldi-analyze] plafond dépassé', { coutEngage, appel: cout.dollars, PLAFOND });
    }

    return json({
      analyse: verification.texte,
      verification: {
        conforme: verification.conforme,
        citationsNonVerifiees: verification.inconnues,
        rapport: verification.rapport,
      },
      // Une structure restée incomplète après la relance n'est PAS une erreur :
      // le texte reste utile à l'avocat. Elle est renvoyée telle quelle, pour
      // qu'il sache quelles rubriques manquent — au premier rang desquelles les
      // risques et les limites, dont l'absence se lit à tort comme un feu vert.
      structure: {
        conforme: structure.conforme,
        sectionsManquantes: structure.sectionsManquantes,
        rapport: structure.conforme
          ? ''
          : `Réponse incomplète après relance : ${structure.sectionsManquantes.join(', ')} ${structure.sectionsManquantes.length === 1 ? 'est absente' : 'sont absentes'}. Ce qui n'est pas écrit n'a pas été examiné.`,
      },
      modele: modeleServi,
      usage: {
        entree: jetons.entree,
        sortie: jetons.sortie,
        cache_lu: jetons.cacheLu,
        cache_ecrit: jetons.cacheEcrit,
      },
      // Estimation, pas facture : tarifs déclarés en dur, et modèle servi
      // possiblement différent du modèle demandé (repli côté serveur).
      // `cumule` est ce que l'appelant doit renvoyer au prochain appel.
      cout: {
        ...cout,
        cumule: Number((coutEngage + cout.dollars).toFixed(6)),
        plafondDollars: PLAFOND,
        tarifsVerifieLe: TARIFS_PAR_MILLION.verifieLe,
      },
      // Rappelé à chaque réponse : la sortie d'un modèle de langage n'est pas
      // une source. Elle doit être relue et recoupée avant tout usage.
      avertissement:
        "Analyse produite par un modèle de langage à partir du rapport déterministe. Toute référence citée doit être vérifiée sur sa source officielle avant d'être reprise dans un acte.",
    });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) {
      return json({ error: 'Service momentanément saturé. Réessayer dans quelques instants.' }, 429);
    }
    if (e instanceof Anthropic.AuthenticationError) {
      return json({ error: "Le service d'analyse est mal configuré." }, 503);
    }
    if (e instanceof Anthropic.APIError) {
      // Le message d'erreur amont n'est pas renvoyé au client : il peut
      // contenir des fragments de la requête.
      console.error('[ldi-analyze] erreur API', e.status, e.message);
      return json({ error: "L'analyse a échoué." }, 502);
    }
    console.error('[ldi-analyze] erreur inattendue', e);
    return json({ error: "L'analyse a échoué." }, 500);
  }
});
