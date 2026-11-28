// ClairDossier Intelligence côté serveur (recette) : le modèle PROPOSE des appels
// d'outils, le serveur les contrôle et les exécute (registre fermé de
// supabase/functions/_shared/intelligence/core.ts). Garanties :
//  - identité, propriété du dossier et abonnement vérifiés par la route AVANT d'arriver ici ;
//  - coût maximal RÉSERVÉ atomiquement avant chaque appel au modèle, usage réel
//    réconcilié après ; plafond global dur (2 USD par défaut) + plafond par compte ;
//  - sources, fichiers et actions à confirmer viennent des RÉSULTATS d'outils,
//    jamais du texte du modèle ; le contenu du dossier est une donnée, pas une consigne ;
//  - sans modèle, clé invalide ou budget atteint : repli sur les règles, annoncé.
import type { AnalysisData, DeliverableKey } from '../../supabase/functions/_shared/analysis-model.ts';
import type { AttentionItem, AttentionResult } from '../../supabase/functions/_shared/attention.ts';
import type { Context, Rights } from '../../supabase/functions/_shared/intelligence/core.ts';
import type { RenduView } from '../../supabase/functions/_shared/rendus/index.ts';
import { update, type Kv } from './kv.ts';

/* ── Vue de recette → contexte de l'assistant ─────────────────────────── */

type Src = { piece: string; where: string | null; quote: string } | null;
const pageOf = (where: string | null) => {
  const m = /p(?:age)?\.?\s*(\d+)/i.exec(where ?? '');
  return m ? Number(m[1]) : null;
};

/** Adapte la vue publiée (six rendus) au contexte attendu par le registre d'outils. Aucune donnée ajoutée. */
export function viewToContext(view: RenduView, o: { rights: Rights; available: DeliverableKey[]; processing?: { done: number; total: number } | null }): Context {
  const ids = new Map(view.pieces.map((p) => [p.name, p.id]));
  const ev = (...srcs: Src[]) => srcs.flatMap((s) => (s && ids.has(s.piece) ? [{ document_id: ids.get(s.piece)!, page: pageOf(s.where), quote: s.quote }] : []));
  const today = view.dossier.as_of.slice(0, 10);
  const status = (s: string): AnalysisData['facts'][number]['status'] => (s === 'documented' || s === 'asserted_by_party' || s === 'inferred' || s === 'missing' ? s : 'documented');
  const deadlines = [
    ...view.echeances.confirmed.map((d) => ({ d, kind: 'mentioned' as const })),
    ...view.echeances.to_confirm.map((d) => ({ d, kind: 'hypothesis' as const })),
    ...view.echeances.past.map((d) => ({ d, kind: 'mentioned' as const })),
  ];
  const analysis = {
    summary_short: view.tableau.situation,
    summary_long: view.resume.details,
    parties: view.resume.parties.map((p) => ({ ...p, evidence: [] })),
    facts: view.resume.facts.map((f) => ({ text: f.text, status: status(f.status), evidence: ev(f.source), ...(f.reliability.level === 'elevee' ? {} : { unverified: true }) })),
    deadlines: deadlines.map(({ d, kind }) => ({ title: d.title, date: d.date, kind, basis: d.nature, priority: 'normale' as const, evidence: ev(d.source) })),
    contradictions: view.resume.contradictions.map((c) => ({ text: c.text, evidence: ev(...c.sources) })),
    missing_items: view.resume.missing.map((m) => ({ text: m.label, why: m.why })),
    attention_points: view.tableau.alerts,
    next_actions: [view.tableau.action.label],
    reminder_drafts: view.relances.drafts.map((r) => ({ audience: 'third_party' as const, subject: r.subject, body: r.body, suggested_date: r.related_deadline, recipient_hint: r.recipient })),
    events: view.chronologie.all.map((e) => ({ key: e.key, date: e.date, label: e.label, kind: 'event_date', precision: 'day', evidence: ev(...e.sources) })),
  } as unknown as AnalysisData;
  // Priorités : l'action du tableau de bord, puis les éléments manquants (mêmes textes que les rendus).
  const item = (id: string, title: string, action: string, level: AttentionItem['level']): AttentionItem => ({ id, level, category: 'piece_manquante', nature: 'missing', title, source: '', evidence: [], consequence: '', action });
  const items: AttentionItem[] = [
    ...(view.tableau.action.target ? [item('action', view.tableau.action.label, view.tableau.action.rationale || view.tableau.action.label, 'important')] : []),
    ...view.resume.missing.map((m, i) => item(`manque:${i}`, `Pièce manquante : ${m.label}`, m.why, 'a_confirmer')),
  ];
  const attention: AttentionResult = { items: items.slice(0, 5), more: items.slice(5), total: items.length };
  return { title: view.dossier.title, today, analysis, pieces: view.pieces.map((p) => ({ id: p.id, file_name: p.name })), attention, available: o.available, processing: o.processing ?? null, rights: o.rights };
}

/* ── Choix du modèle, coût, boucle : module partagé avec la production (Deno) ── */

export { DEFAULT_MODELS, REPLI, SYSTEM, answer, costMicroUsd, qualify, type AssistantReply, type LedgerEntry, type ModelMap, type Tier } from '../../supabase/functions/_shared/intelligence/assistant-model.ts';
import type { AssistantDeps as SharedDeps, AssistantFinops, LedgerEntry } from '../../supabase/functions/_shared/intelligence/assistant-model.ts';

/** Dépendances de la recette : comptabilité Blob avec ses vues de supervision (paliers, compte, vue d'ensemble). */
export type AssistantDeps = SharedDeps & { finops: Finops };

/* ── FinOps (recette : stockage Blob) : réservation avant appel, réconciliation après ── */

const MICRO = 1_000_000; // micro-dollars
const month = (d: Date) => d.toISOString().slice(0, 7);
export interface Budget {
  /** Plafond dur global du mois, en USD (crédits de recette). */
  globalUsd: number;
  /** Plafond par compte et par mois, en USD. */
  perUserUsd: number;
}
type Pot = { reserved: number; spent: number };
export class Finops implements AssistantFinops {
  constructor(
    private readonly kv: Kv,
    private readonly now: () => Date,
    readonly budget: Budget,
  ) {}
  private keys(userId: string) {
    const m = month(this.now());
    return [`finops/${m}/_global.json`, `finops/${m}/u-${userId}.json`] as const;
  }
  /** Réserve le coût MAXIMAL d'un appel sur le pot global puis sur celui du compte. false = plafond atteint, rien n'est réservé. */
  async reserve(userId: string, microUsd: number): Promise<boolean> {
    const [g, u] = this.keys(userId);
    const take = async (key: string, capUsd: number) => {
      let ok = false;
      await update<Pot>(this.kv, key, (cur) => {
        const p = cur ?? { reserved: 0, spent: 0 };
        ok = p.reserved + p.spent + microUsd <= capUsd * MICRO;
        return ok ? { ...p, reserved: p.reserved + microUsd } : null;
      }).catch(() => (ok = false));
      return ok;
    };
    if (!(await take(g, this.budget.globalUsd))) return false;
    if (await take(u, this.budget.perUserUsd)) return true;
    await this.settle(userId, microUsd, 0, { globalOnly: true });
    return false;
  }
  /** Libère la réservation et comptabilise le coût réel (0 si l'appel n'a pas eu lieu). */
  async settle(userId: string, reservedMicro: number, actualMicro: number, o: { globalOnly?: boolean } = {}): Promise<void> {
    const [g, u] = this.keys(userId);
    const fix = (key: string) => update<Pot>(this.kv, key, (cur) => ({ reserved: Math.max(0, (cur?.reserved ?? 0) - reservedMicro), spent: (cur?.spent ?? 0) + actualMicro })).catch(() => undefined);
    await fix(g);
    if (!o.globalOnly) await fix(u);
  }
  /** Part du plafond global consommée (dépensé + réservé) : une seule lecture, pour les alertes à 70, 90 et 100 %. */
  async palier(): Promise<{ mois: string; ratio: number; seuil: 'ok' | '70' | '90' | '100' }> {
    const m = month(this.now());
    const g = (await this.kv.getJson<Pot>(`finops/${m}/_global.json`))?.value ?? { reserved: 0, spent: 0 };
    const ratio = (g.spent + g.reserved) / (this.budget.globalUsd * MICRO);
    return { mois: m, ratio, seuil: ratio >= 1 ? '100' : ratio >= 0.9 ? '90' : ratio >= 0.7 ? '70' : 'ok' };
  }
  /** Consommation du mois d'UN compte (ses propres appels, aucun autre compte) : coût réel réglé, réservations en cours, appels. */
  async compte(userId: string): Promise<{ mois: string; depense_usd: number; reserve_usd: number; appels: { at: string; model: string; feature: string; input_tokens: number; output_tokens: number; cache_read_tokens: number; usd: number; ms: number; status: string }[] }> {
    const m = month(this.now());
    const [, u] = this.keys(userId);
    const p = (await this.kv.getJson<Pot>(u))?.value ?? { reserved: 0, spent: 0 };
    const appels = [];
    for (const k of (await this.kv.list(`finops/journal/${m}/`)).slice(-300)) {
      const e = (await this.kv.getJson<LedgerEntry>(k))?.value;
      if (e?.user_id === userId) appels.push({ at: e.at, model: e.model, feature: e.feature, input_tokens: e.input_tokens, output_tokens: e.output_tokens, cache_read_tokens: e.cache_read_tokens, usd: e.actual_micro_usd / MICRO, ms: e.duration_ms, status: e.status });
    }
    return { mois: m, depense_usd: p.spent / MICRO, reserve_usd: p.reserved / MICRO, appels };
  }
  async record(e: LedgerEntry): Promise<void> {
    await this.kv.putJson(`finops/journal/${month(this.now())}/${e.at.replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 8)}.json`, e).catch(() => undefined);
  }
  /** État du mois (supervision) : montants en USD, sans aucun contenu client. */
  async overview(): Promise<{ mois: string; plafond_usd: number; depense_usd: number; reserve_usd: number; seuil: 'ok' | '70' | '90' | '100'; appels: number; par_modele: Record<string, { appels: number; usd: number }>; par_fonction: Record<string, { appels: number; usd: number }> }> {
    const m = month(this.now());
    const g = (await this.kv.getJson<Pot>(`finops/${m}/_global.json`))?.value ?? { reserved: 0, spent: 0 };
    const keys = (await this.kv.list(`finops/journal/${m}/`)).slice(-500);
    const par_modele: Record<string, { appels: number; usd: number }> = {};
    const par_fonction: Record<string, { appels: number; usd: number }> = {};
    for (const k of keys) {
      const e = (await this.kv.getJson<LedgerEntry>(k))?.value;
      if (!e) continue;
      for (const [map, key] of [[par_modele, e.model], [par_fonction, e.feature]] as const) {
        const cur = (map[key] ??= { appels: 0, usd: 0 });
        cur.appels++;
        cur.usd = Math.round((cur.usd + e.actual_micro_usd / MICRO) * 1e6) / 1e6;
      }
    }
    const ratio = (g.spent + g.reserved) / (this.budget.globalUsd * MICRO);
    return { mois: m, plafond_usd: this.budget.globalUsd, depense_usd: g.spent / MICRO, reserve_usd: g.reserved / MICRO, seuil: ratio >= 1 ? '100' : ratio >= 0.9 ? '90' : ratio >= 0.7 ? '70' : 'ok', appels: keys.length, par_modele, par_fonction };
  }
}

/* ── Historique privé (par compte et par dossier) ─────────────────────── */

export type Turn = { from: 'vous' | 'ia'; text: string; at: string };
const hkey = (userId: string, dossierId: string) => `ia/${userId}/${dossierId}.json`;
export async function history(kv: Kv, userId: string, dossierId: string): Promise<Turn[]> {
  return (await kv.getJson<{ turns: Turn[] }>(hkey(userId, dossierId)))?.value.turns ?? [];
}
export async function remember(kv: Kv, userId: string, dossierId: string, turns: Turn[]): Promise<void> {
  await update<{ turns: Turn[] }>(kv, hkey(userId, dossierId), (cur) => ({ turns: [...(cur?.turns ?? []), ...turns].slice(-40) })).catch(() => undefined);
}
export async function forget(kv: Kv, userId: string, dossierId: string): Promise<void> {
  await kv.delete(hkey(userId, dossierId));
}

/* ── Mémoire professionnelle privée : préférences écrites par le titulaire, consultables et supprimables ── */

export type Preference = { id: string; text: string; at: string };
export const MAX_PREFERENCES = 12;
const prefKey = (userId: string) => `memoire/${userId}.json`;
export async function preferences(kv: Kv, userId: string): Promise<Preference[]> {
  return (await kv.getJson<{ items: Preference[] }>(prefKey(userId)))?.value.items ?? [];
}
/** Ajoute une préférence (texte court, sans caractère de contrôle). null = texte vide ou mémoire pleine. */
export async function addPreference(kv: Kv, userId: string, raw: string, now: Date): Promise<Preference | null> {
  const text = raw.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
  if (!text) return null;
  let made: Preference | null = null;
  await update<{ items: Preference[] }>(kv, prefKey(userId), (cur) => {
    const items = cur?.items ?? [];
    const same = items.find((i) => i.text.toLowerCase() === text.toLowerCase());
    if (same) return (made = same), null;
    if (items.length >= MAX_PREFERENCES) return null;
    made = { id: crypto.randomUUID().slice(0, 8), text, at: now.toISOString() };
    return { items: [...items, made] };
  });
  return made;
}
export async function removePreference(kv: Kv, userId: string, id: string): Promise<void> {
  await update<{ items: Preference[] }>(kv, prefKey(userId), (cur) => (cur ? { items: cur.items.filter((i) => i.id !== id) } : null));
}
