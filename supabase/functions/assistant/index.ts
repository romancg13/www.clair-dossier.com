// Fonction Edge « assistant » : ClairDossier Intelligence avec modèle, en production.
// Contrôles, dans l'ordre : identité (jeton), corps, propriété du dossier (RLS), interrupteur
// et acceptation du compte, abonnement, réglages (clé, plafonds, pause), limite de débit.
// Si l'un manque : 409 « assistant_indisponible » → l'écran garde les règles locales (aucun appel payant).
// Contexte reconstruit depuis la base sous l'identité du titulaire ; budget réservé avant chaque appel.
import Anthropic from 'npm:@anthropic-ai/sdk@1.1.0';
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildAttention } from '../_shared/attention.ts';
import { usableAnalysis, type AnalysisData, type CoverageInfo } from '../_shared/analysis-model.ts';
import type { Context } from '../_shared/intelligence/core.ts';
import { answer, type AssistantFinops, type LedgerEntry } from '../_shared/intelligence/assistant-model.ts';
import { ASSISTANT_MESSAGES_PER_HOUR, assistantSettings, modelUsable, parseAssistantRequest } from '../_shared/intelligence/assistant-request.ts';

const SITE = 'https://www.clair-dossier.com';
const ALLOWED_ORIGINS = new Set(['https://www.clair-dossier.com', 'https://clair-dossier.com', 'http://localhost:5173', 'http://localhost:4173']);

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : SITE,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

const today = () => new Date().toISOString().slice(0, 10);

Deno.serve(async (req: Request): Promise<Response> => {
  const headers = cors(req.headers.get('origin'));
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return reply(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (!url || !anonKey || !serviceKey) return reply(500, { error: 'server_misconfigured' });

  // 1. Identité : uniquement le jeton.
  const authz = req.headers.get('Authorization') ?? '';
  const token = authz.startsWith('Bearer ') ? authz.slice(7) : '';
  if (!token) return reply(401, { error: 'unauthorized' });
  const caller = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });
  const { data: u, error: ue } = await caller.auth.getUser();
  const user = u?.user;
  if (ue || !user) return reply(401, { error: 'unauthorized' });

  // 2. Corps.
  let parsed;
  try {
    parsed = parseAssistantRequest(await req.json());
  } catch {
    parsed = null;
  }
  if (!parsed) return reply(400, { error: 'bad_request' });

  // 3. Propriété du dossier (RLS du titulaire) : jamais le dossier d'un autre compte.
  const { data: dossier } = await caller.from('dossiers').select('id,user_id,title').eq('id', parsed.dossierId).is('deleted_at', null).maybeSingle();
  if (!dossier || dossier.user_id !== user.id) return reply(404, { error: 'dossier_not_found' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const indisponible = (raison: string) => reply(409, { error: 'assistant_indisponible', raison });

  // 4. Interrupteur, acceptation du compte, abonnement, réglages.
  const settings = assistantSettings((n) => Deno.env.get(n));
  if (!modelUsable(settings)) return indisponible('reglages');
  const [{ data: gate }, { data: acc }, { data: sub }] = await Promise.all([
    admin.rpc('ai_auto_gate_allows', { p_user: user.id }),
    admin.from('ai_account_settings').select('enabled_at').eq('user_id', user.id).maybeSingle(),
    admin.rpc('client_subscription_active', { p_user: user.id }),
  ]);
  if (gate !== true) return indisponible('ferme');
  if (!acc?.enabled_at) return indisponible('non_accepte');
  if (sub !== true) return indisponible('abonnement');

  // 5. Limite de débit par compte.
  // Compte les appels au modèle de l'heure (jusqu'à 4 par message). Erreur de lecture = refus (jamais ouvert par défaut).
  const { count, error: ce } = await admin.from('assistant_usage').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(Date.now() - 3600_000).toISOString());
  if (ce) return indisponible('debit');
  if ((count ?? 0) >= ASSISTANT_MESSAGES_PER_HOUR) return reply(429, { error: 'trop_de_demandes' });

  // 6. Contexte depuis la base, sous l'identité du titulaire.
  const [s, a, pieces, deadlines, turns, prefs] = await Promise.all([
    caller.from('dossier_ai_settings').select('enabled_at').eq('dossier_id', dossier.id).maybeSingle(),
    caller.from('ai_analyses').select('coverage,data').eq('dossier_id', dossier.id).order('revision', { ascending: false }).limit(1).maybeSingle(),
    caller.from('dossier_documents').select('id,file_name').eq('dossier_id', dossier.id).eq('kind', 'piece').is('deleted_at', null).order('created_at').limit(500),
    caller.from('dossier_deadlines').select('title,due_date,priority,done,ai_key').eq('dossier_id', dossier.id).limit(200),
    caller.from('assistant_turns').select('author,body').eq('dossier_id', dossier.id).order('created_at', { ascending: false }).limit(6),
    caller.from('assistant_preferences').select('body').limit(12),
  ]);
  // L'analyse n'est transmise au modèle que si l'analyse est activée sur CE dossier.
  const row = s.data?.enabled_at ? (a.data as { coverage: CoverageInfo; data: unknown } | null) : null;
  const usable = usableAnalysis(row?.data);
  const analysis: { coverage: CoverageInfo; data: AnalysisData } | null = row && usable ? { coverage: row.coverage, data: usable } : null;
  const pieceList = ((pieces.data ?? []) as { id: string; file_name: string }[]);
  const t = today();
  const ctx: Context = {
    title: dossier.title ?? 'Dossier',
    today: t,
    analysis: analysis?.data ?? null,
    pieces: pieceList,
    attention: analysis?.data?.summary_short
      ? buildAttention({ analysis: analysis.data, coverage: analysis.coverage, today: t, documentNames: Object.fromEntries(pieceList.map((p) => [p.id, p.file_name])), deadlines: (deadlines.data ?? []) as never })
      : null,
    available: parsed.available,
    processing: null,
    rights: { owner: true, assistant: true, automations: true },
  };
  const history = ((turns.data ?? []) as { author: 'vous' | 'ia'; body: string }[]).reverse().map((h) => ({ from: h.author, text: h.body }));

  // 7. Comptabilité en base (micro-USD) : réservation avant appel, réconciliation, journal sans contenu.
  const finops: AssistantFinops = {
    reserve: async (userId, micro) => {
      const { data } = await admin.rpc('assistant_reserve', { p_user: userId, p_micro: micro, p_cap_global_micro: settings.capGlobalMicro, p_cap_user_micro: settings.capUserMicro });
      return data === true;
    },
    settle: async (userId, reserved, actual) => {
      await admin.rpc('assistant_settle', { p_user: userId, p_reserved_micro: reserved, p_actual_micro: actual });
    },
    record: async (e: LedgerEntry) => {
      await admin.from('assistant_usage').insert({
        user_id: e.user_id, dossier_id: dossier.id, feature: e.feature, model: e.model, input_tokens: e.input_tokens, output_tokens: e.output_tokens,
        cache_read_tokens: e.cache_read_tokens, cache_write_tokens: e.cache_write_tokens, estimated_micro: e.estimated_micro_usd,
        actual_micro: e.actual_micro_usd, duration_ms: e.duration_ms, status: e.status,
      });
    },
  };

  const client = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '', maxRetries: 1 });
  const r = await answer({ client, models: settings.models, finops, now: () => new Date() }, user.id, parsed.message, ctx, history, {
    preferences: ((prefs.data ?? []) as { body: string }[]).map((p) => p.body),
  });

  // 8. Historique privé (deux tours), sous l'identité du titulaire.
  await caller.from('assistant_turns').insert([
    { user_id: user.id, dossier_id: dossier.id, author: 'vous', body: parsed.message.slice(0, 4000) },
    { user_id: user.id, dossier_id: dossier.id, author: 'ia', body: (r.text || '…').slice(0, 4000) },
  ]);
  // L'identifiant du modèle reste côté serveur (journal assistant_usage).
  const { model: _modele, ...publique } = r;
  return reply(200, publique);
});
