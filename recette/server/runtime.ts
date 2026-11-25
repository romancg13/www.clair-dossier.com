// Environnement d'exécution de l'API de recette : stockage, secrets, fournisseur IA.
// Les secrets serveur (signature des liens, jeton d'exécuteur) sont GÉNÉRÉS côté
// serveur au premier usage et conservés dans le stockage privé : ils ne transitent
// ni par le dépôt, ni par une variable saisie à la main, ni par un journal.
import { coupeCircuit } from './pilotage.ts';
import { DEFAULT_MODELS, Finops } from './assistant.ts';
import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicProvider, type ModelProvider } from '../../supabase/functions/_shared/engine/anthropic.ts';
import { BlobKv, MemoryKv, type Kv } from './kv.ts';
import { RecetteStore } from './store.ts';
import { engineDeps } from './engine-deps.ts';
import { ensureAdmin } from './seed.ts';
import { sha, token } from './security.ts';
import type { ApiEnv } from './api.ts';

let kv: Kv | null = null;
let secrets: { secret: string; worker: string } | null = null;

export function storage(): Kv {
  // Un espace par environnement : une prévisualisation (essai IA) ne partage ni données, ni file de travaux, ni secrets avec la démo.
  kv ??= process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN ? new BlobKv(process.env.VERCEL_ENV === 'production' ? 'recette/' : `recette-${process.env.VERCEL_ENV || 'local'}/`) : new MemoryKv();
  return kv;
}

async function runtimeSecrets(k: Kv) {
  if (secrets) return secrets;
  const cur = await k.getJson<{ secret: string; worker: string }>('secrets/runtime.json');
  if (cur) return (secrets = cur.value);
  const fresh = { secret: token(48), worker: token(32) };
  const r = await k.putJson('secrets/runtime.json', fresh, { create: true });
  secrets = r.ok ? fresh : (await k.getJson<{ secret: string; worker: string }>('secrets/runtime.json'))!.value;
  return secrets;
}

/** Fournisseur IA : passerelle Vercel (jeton OIDC de la fonction, aucune clé stockée) si activée. */
/** Client direct de l'API (clé du coffre serveur ANTHROPIC_API_KEY, jamais exposée au navigateur). */
function directClient(): Anthropic | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? new Anthropic({ apiKey, maxRetries: 1 }) : null;
}
const usd = (n: string, d: number) => (Number(process.env[n]) > 0 ? Number(process.env[n]) : d);

async function aiProvider(): Promise<ModelProvider | null> {
  const direct = directClient();
  // Lecture des pièces par l'IA : seulement si explicitement activée (RECETTE_AI=direct), la clé seule ne suffit pas.
  if (direct && process.env.RECETTE_AI === 'direct') return createAnthropicProvider({ client: direct, modelExtract: process.env.RECETTE_MODELE_EXTRACTION || 'claude-sonnet-5-5', modelConsolidate: process.env.RECETTE_MODELE_CONSOLIDATION || 'claude-sonnet-5-5', timeoutMs: 110_000 });
  if (process.env.RECETTE_AI !== 'passerelle') return null;
  const { getVercelOidcToken } = await import('@vercel/functions/oidc');
  const apiKey = await getVercelOidcToken().catch(() => null);
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey, baseURL: 'https://ai-gateway.vercel.sh', maxRetries: 1 });
  return createAnthropicProvider({ client, modelExtract: process.env.RECETTE_MODELE_EXTRACTION || 'anthropic/claude-sonnet-5.5', modelConsolidate: process.env.RECETTE_MODELE_CONSOLIDATION || 'anthropic/claude-sonnet-5.5', timeoutMs: 110_000 });
}

/** Clé du planificateur, dérivée du jeton d'exécuteur (créé au besoin). Utilisée par le build pour l'URL du cron. */
export async function cronKey(): Promise<string> {
  return sha(`${(await runtimeSecrets(storage())).worker}:cron`);
}

export async function apiEnv(siteUrl: string, waitUntil: (p: Promise<unknown>) => void): Promise<ApiEnv> {
  const k = storage();
  const store = new RecetteStore(k);
  const s = await runtimeSecrets(k);
  const budget = (n: string, d: number) => (Number(process.env[n]) > 0 ? Number(process.env[n]) : d);
  const env: ApiEnv = {
    store,
    secret: s.secret,
    workerToken: s.worker,
    cronSecret: process.env.CRON_SECRET ?? '',
    siteUrl,
    adminPassword: process.env.RECETTE_ADMIN_PASSWORD ?? null,
    waitUntil,
    aiLabel: process.env.RECETTE_AI === 'passerelle' ? 'IA (passerelle Vercel)' : process.env.RECETTE_AI === 'direct' && process.env.ANTHROPIC_API_KEY ? 'IA (API directe)' : 'règles déterministes',
    // Assistant : plafond dur de 2 USD par mois sur l'ensemble de la recette (0,80 USD pour l'assistant, le reste
    // pour la lecture des pièces via les budgets du moteur), 0,25 USD par compte. Sans clé : règles seules.
    assistant: {
      client: directClient(),
      models: { simple: process.env.RECETTE_MODELE_SIMPLE || DEFAULT_MODELS.simple, courant: process.env.RECETTE_MODELE_COURANT || DEFAULT_MODELS.courant, avance: process.env.RECETTE_MODELE_AVANCE || DEFAULT_MODELS.avance },
      finops: new Finops(k, store.now, { globalUsd: Math.min(2, usd('RECETTE_IA_PLAFOND_ASSISTANT_USD', 0.8)), perUserUsd: usd('RECETTE_IA_PLAFOND_COMPTE_USD', 0.25) }),
      now: store.now,
    },
    aiHealth: async () => {
      const c = directClient();
      if (!c) return { configure: false };
      try {
        // GET /v1/models : vérifie la clé et liste les modèles accessibles, sans consommer de jetons.
        const ids: string[] = [];
        for await (const mo of c.models.list({ limit: 100 })) ids.push(mo.id);
        const voulus = [DEFAULT_MODELS.simple, DEFAULT_MODELS.courant, DEFAULT_MODELS.avance, 'claude-fable-5-2'];
        return { configure: true, authentifie: true, modeles_accessibles: voulus.filter((v) => ids.includes(v)), modeles_absents: voulus.filter((v) => !ids.includes(v)) };
      } catch (e) {
        const st = (e as { status?: number }).status ?? 0;
        return { configure: true, authentifie: false, statut: st, cause: st === 401 ? 'clé invalide' : st === 403 ? 'accès refusé' : st === 429 ? 'quota ou crédits épuisés' : 'fournisseur injoignable' };
      }
    },
    deps: async () =>
      engineDeps(store, {
        // Coupe-circuit de l'exploitant : lecture par les règles, aucun appel de modèle.
        ai: (await coupeCircuit(store)).ia ? null : await aiProvider(),
        siteUrl,
        demo: true,
        config: { budgetCentsPerUserMonth: budget('RECETTE_BUDGET_COMPTE_CENTIMES', process.env.RECETTE_AI === 'direct' ? 40 : 150), budgetCentsGlobalMonth: budget('RECETTE_BUDGET_GLOBAL_CENTIMES', process.env.RECETTE_AI === 'direct' ? 100 : 800), budgetCentsPerLot: budget('RECETTE_BUDGET_LOT_CENTIMES', 80), paused: process.env.RECETTE_PAUSE === '1' },
      }),
    kickWorker: async () => {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4000);
      await fetch(`${siteUrl}/api/worker`, { method: 'POST', headers: { 'x-worker-token': s.worker }, signal: ctl.signal }).catch(() => undefined);
      clearTimeout(t);
    },
  };
  await ensureAdmin(env).catch(() => undefined);
  return env;
}

/**
 * Diagnostic de la passerelle IA (prévisualisation uniquement) : trois appels
 * minimaux, sans aucune pièce, pour distinguer facturation / modèle / option.
 * Ne renvoie que des statuts et des types d'erreur.
 */
export async function diagnosticIa(): Promise<unknown> {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.RECETTE_AI !== 'passerelle') return { disponible: false };
  const { getVercelOidcToken } = await import('@vercel/functions/oidc');
  const apiKey = await getVercelOidcToken().catch(() => null);
  if (!apiKey) return { oidc: false };
  const client = new Anthropic({ apiKey, baseURL: 'https://ai-gateway.vercel.sh', maxRetries: 0 });
  const model = process.env.RECETTE_MODELE_EXTRACTION || 'anthropic/claude-sonnet-5.5';
  const essai = async (label: string, body: Record<string, unknown>) => {
    try {
      const r = await client.messages.create({ model, max_tokens: 16, messages: [{ role: 'user', content: 'Réponds OK.' }], ...body } as never);
      return { label, ok: true, modele: (r as { model?: string }).model ?? null };
    } catch (e) {
      const err = e as { status?: number; error?: { error?: { type?: string; message?: string }; type?: string } };
      return { label, ok: false, statut: err.status ?? 0, type: err.error?.error?.type ?? err.error?.type ?? null, message: (err.error?.error?.message ?? '').slice(0, 160) };
    }
  };
  return [
    await essai('texte simple', {}),
    await essai('sortie structurée', { output_config: { format: { type: 'json_schema', schema: { type: 'object', properties: { ok: { type: 'string' } }, required: ['ok'], additionalProperties: false } } } }),
  ];
}
