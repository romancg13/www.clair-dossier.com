// Environnement d'exécution de l'API de recette : stockage, secrets, fournisseur IA.
// Les secrets serveur (signature des liens, jeton d'exécuteur) sont GÉNÉRÉS côté
// serveur au premier usage et conservés dans le stockage privé : ils ne transitent
// ni par le dépôt, ni par une variable saisie à la main, ni par un journal.
import Anthropic from '@anthropic-ai/sdk';
import { createAnthropicProvider, type ModelProvider } from '../../supabase/functions/_shared/engine/anthropic.ts';
import { BlobKv, MemoryKv, type Kv } from './kv.ts';
import { RecetteStore } from './store.ts';
import { engineDeps } from './engine-deps.ts';
import { ensureAdmin } from './seed.ts';
import { token } from './security.ts';
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
async function aiProvider(): Promise<ModelProvider | null> {
  if (process.env.RECETTE_AI !== 'passerelle') return null;
  const { getVercelOidcToken } = await import('@vercel/functions/oidc');
  const apiKey = await getVercelOidcToken().catch(() => null);
  if (!apiKey) return null;
  const client = new Anthropic({ apiKey, baseURL: 'https://ai-gateway.vercel.sh', maxRetries: 1 });
  return createAnthropicProvider({ client, modelExtract: process.env.RECETTE_MODELE_EXTRACTION || 'anthropic/claude-sonnet-5.5', modelConsolidate: process.env.RECETTE_MODELE_CONSOLIDATION || 'anthropic/claude-sonnet-5.5', timeoutMs: 110_000 });
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
    aiLabel: process.env.RECETTE_AI === 'passerelle' ? 'IA (passerelle Vercel)' : 'règles déterministes',
    deps: async () =>
      engineDeps(store, {
        ai: await aiProvider(),
        siteUrl,
        demo: true,
        config: { budgetCentsPerUserMonth: budget('RECETTE_BUDGET_COMPTE_CENTIMES', 150), budgetCentsGlobalMonth: budget('RECETTE_BUDGET_GLOBAL_CENTIMES', 800), budgetCentsPerLot: budget('RECETTE_BUDGET_LOT_CENTIMES', 80), paused: process.env.RECETTE_PAUSE === '1' },
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
