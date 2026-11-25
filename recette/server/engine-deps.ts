// Assemblage du moteur pour la recette : stockage, rendus, lecture PDF, fournisseur.
import { createRenderer } from '../../supabase/functions/_shared/rendus/index.ts';
import type { EngineConfig } from '../../supabase/functions/_shared/engine/ports.ts';
import type { EngineDeps } from '../../supabase/functions/_shared/engine/runner.ts';
import type { ModelProvider } from '../../supabase/functions/_shared/engine/anthropic.ts';
import { loadAssets } from './assets.ts';
import { pdfText } from './pdf-text.ts';
import type { RecetteStore } from './store.ts';

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
export async function sha256(data: Uint8Array | string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)));
}

export function engineDeps(store: RecetteStore, o: { ai: ModelProvider | null; config?: Partial<EngineConfig>; demo?: boolean; siteUrl?: string }): EngineDeps {
  const config: EngineConfig = {
    budgetCentsPerUserMonth: 300,
    budgetCentsGlobalMonth: 1500,
    budgetCentsPerLot: 150,
    paused: false,
    maxAttempts: 4,
    // Bail court : un exécuteur interrompu ne bloque un travail que le temps de l’appel le plus long (IA : délai 110 s).
    leaseMs: o.ai ? 150_000 : 60_000,
    // Avec l'IA, chaque synthèse est un appel payant : on attend que le lot se stabilise (2 s) et on réessaie posément
    // (3 s). Par règles (aucun appel, aucun coût), ces attentes fixes ne protègent rien : elles sont réduites à 1 s.
    consolidateDelayMs: o.ai ? 2_000 : 1_000,
    extractionWaitMs: o.ai ? 3_000 : 1_000,
    now: store.now,
    workerId: `w-${crypto.randomUUID().slice(0, 8)}`,
    dossierLink: (id) => `${o.siteUrl ?? ''}/compte/dossier/${id}`,
    ...o.config,
  };
  return {
    store,
    config,
    renderer: createRenderer({ assets: loadAssets(), demo: o.demo ?? true }) as EngineDeps['renderer'],
    reading: { pdfText },
    ai: o.ai,
    boundary: () => crypto.randomUUID().replace(/-/g, '').slice(0, 16),
    sha256,
  };
}
