// Pile de recette EN MÉMOIRE qui reproduit le fonctionnement hébergé, pour les mesures locales :
//  - un magasin RecetteStore NEUF par requête (comme apiEnv sur Vercel : aucun cache partagé entre invocations) ;
//  - les tâches d'arrière-plan (waitUntil) continuent après la réponse ;
//  - la relance de l'exécuteur (kickWorker) est une nouvelle requête POST /api/worker ;
//  - aucune IA (lecture par règles), aucun réseau, horloge réelle.
import { handle, type ApiEnv } from '../../../recette/server/api.ts';
import { engineDeps } from '../../../recette/server/engine-deps.ts';
import { RecetteStore } from '../../../recette/server/store.ts';
import type { EngineConfig } from '../../../supabase/functions/_shared/engine/ports.ts';
import type { EngineDeps } from '../../../supabase/functions/_shared/engine/runner.ts';
import { MesureKv, type Latence } from './kv-mesure.ts';

export interface PileMesure {
  kv: MesureKv;
  env: () => ApiEnv;
  /** Tâches d'arrière-plan en cours (waitUntil non terminés). */
  enFond: () => number;
  /** Attend la fin de toutes les tâches d'arrière-plan (y compris celles qu'elles déclenchent). */
  repos: () => Promise<void>;
  client: () => ClientMesure;
  /** Compteurs d'exécution : relances de l'exécuteur (kickWorker) et passages de l'exécuteur (deps demandées). */
  compteurs: { relances: number; passages: number };
}
export interface ClientMesure {
  call: (method: string, path: string, body?: unknown) => Promise<Response>;
  json: <T = any>(method: string, path: string, body?: unknown) => Promise<T>; // eslint-disable-line @typescript-eslint/no-explicit-any
}

export function pileMesure(o: { latence?: Latence | null; config?: Partial<EngineConfig>; surDeps?: (deps: EngineDeps) => void; /** Garde-fou : au-delà, les relances sont coupées (une boucle sans fin devient un compteur). */ maxRelances?: number } = {}): PileMesure {
  const kv = new MesureKv(undefined, o.latence ?? null);
  const compteurs = { relances: 0, passages: 0 };
  const fond = new Set<Promise<unknown>>();
  const env = (): ApiEnv => {
    const store = new RecetteStore(kv);
    const e: ApiEnv = {
      store,
      deps: async () => {
        compteurs.passages++;
        const deps = engineDeps(store, { ai: null, config: o.config });
        o.surDeps?.(deps);
        return deps;
      },
      secret: 'secret-de-mesure-0123456789',
      workerToken: 'jeton-executeur-de-mesure',
      cronSecret: '',
      siteUrl: 'http://recette.mesure',
      adminPassword: null,
      waitUntil: (p) => {
        const q = p.catch(() => undefined).finally(() => fond.delete(q));
        fond.add(q);
      },
      kickWorker: async () => {
        if (++compteurs.relances > (o.maxRelances ?? Infinity)) return;
        await handle(env(), new Request('http://recette.mesure/api/worker', { method: 'POST', headers: { 'x-worker-token': 'jeton-executeur-de-mesure' } }));
      },
      aiLabel: 'règles déterministes',
    };
    return e;
  };
  const repos = async () => {
    while (fond.size) await Promise.all([...fond]);
  };
  const client = (): ClientMesure => {
    let cookie = '';
    const call = async (method: string, path: string, body?: unknown) => {
      const headers: Record<string, string> = { 'x-clairdossier': '1', cookie };
      let payload: BodyInit | undefined;
      if (body instanceof FormData) payload = body;
      else if (body !== undefined) (payload = JSON.stringify(body)), (headers['content-type'] = 'application/json');
      const r = await handle(env(), new Request(`http://recette.mesure${path}`, { method, headers, body: payload }));
      const sc = r.headers.get('set-cookie');
      if (sc) cookie = sc.split(';')[0];
      return r;
    };
    return { call, json: async (m, p, b) => (await call(m, p, b)).json() };
  };
  return { kv, env, enFond: () => fond.size, repos, client, compteurs };
}

export const pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
