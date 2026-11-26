// ClairDossier Intelligence dans la page dossier ORIGINALE (Supabase) : bouton « ClairDossier IA » à droite de
// « Vos résultats », même composant que la démonstration. Données lues sous RLS (titulaire seulement) ; les actions
// confirmées sont réellement écrites en base : échéance du dossier, ou automatisation exécutée par la base.
// Activé par le build VITE_INTELLIGENCE=1 (inerte sans la migration 20261126120000).
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { IntelligenceLauncher } from "./IntelligencePanel";
import { runAssistant, suggestions, type Context, type PendingAction } from "../../../supabase/functions/_shared/intelligence/core.ts";
import { planificationDe } from "../../../supabase/functions/_shared/intelligence/planification.ts";
import { buildAttention } from "../../../supabase/functions/_shared/attention.ts";
import type { AnalysisData, CoverageInfo, DeliverableKey } from "../../../supabase/functions/_shared/analysis-model.ts";

type Props = {
  dossierId: string;
  ownerId: string;
  title: string;
  /** Seul le titulaire converse avec l'assistant de son dossier. */
  isOwner: boolean;
  pieces: { id: string; file_name: string }[];
  available: DeliverableKey[];
  deadlines: { title: string; due_date: string; priority: string; done: boolean; ai_key?: string | null }[];
  onFile: (key: DeliverableKey) => void;
  /** Appelé après création réelle d'une échéance (rafraîchit la page). */
  onChanged?: () => void;
};

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function DossierIntelligence(p: Props) {
  const [analysis, setAnalysis] = useState<{ coverage: CoverageInfo; data: AnalysisData } | null>(null);
  const [history, setHistory] = useState<{ from: "vous" | "ia"; text: string }[] | null>(null);

  useEffect(() => {
    if (!p.isOwner) return;
    let live = true;
    void (async () => {
      const [a, h] = await Promise.all([
        supabase.from("ai_analyses").select("coverage,data").eq("dossier_id", p.dossierId).order("revision", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("assistant_turns").select("author,body").eq("dossier_id", p.dossierId).order("created_at", { ascending: true }).limit(40),
      ]);
      if (!live) return;
      setAnalysis(a.error || !a.data ? null : (a.data as { coverage: CoverageInfo; data: AnalysisData }));
      setHistory(h.error ? [] : ((h.data ?? []) as { author: "vous" | "ia"; body: string }[]).map((t) => ({ from: t.author, text: t.body })));
    })();
    return () => {
      live = false;
    };
  }, [p.dossierId, p.isOwner]);

  const ctx: Context = useMemo(() => {
    const t = today();
    const names = Object.fromEntries(p.pieces.map((x) => [x.id, x.file_name]));
    return {
      title: p.title,
      today: t,
      analysis: analysis?.data ?? null,
      pieces: p.pieces,
      attention: analysis?.data?.summary_short
        ? buildAttention({ analysis: analysis.data, coverage: analysis.coverage, today: t, documentNames: names, deadlines: p.deadlines.map((d) => ({ ...d, ai_key: d.ai_key ?? null })) as never })
        : null,
      available: p.available,
      processing: null,
      rights: { owner: p.isOwner, assistant: true, automations: true },
    };
  }, [analysis, p.available, p.deadlines, p.isOwner, p.pieces, p.title]);

  const remember = useCallback(
    async (q: string, a: string) => {
      await supabase.from("assistant_turns").insert([
        { user_id: p.ownerId, dossier_id: p.dossierId, author: "vous", body: q.slice(0, 4000) },
        { user_id: p.ownerId, dossier_id: p.dossierId, author: "ia", body: a.slice(0, 4000) || "…" },
      ]);
    },
    [p.dossierId, p.ownerId],
  );

  const confirm = useCallback(
    async (a: PendingAction): Promise<string> => {
      if (a.kind === "rappel") {
        const date = /^rappel:(\d{4}-\d{2}-\d{2})$/.exec(a.id)?.[1];
        if (!date || date < today()) return "Date de rappel invalide ou passée : rien n’a été enregistré.";
        // « le 10/01/2027 de répondre au bailleur » → « Répondre au bailleur » (la date est déjà celle de l'échéance).
        const brut = (a.detail || "").replace(/[\u0000-\u001f]/g, " ").replace(/^\s*(le\s+)?\d{1,2}\/\d{1,2}(\/\d{2,4})?\s*(de\s+|d['’]\s*)?/i, "").trim();
        const titre = (brut.charAt(0).toUpperCase() + brut.slice(1)).slice(0, 120) || "Rappel";
        const { error } = await supabase.from("dossier_deadlines").insert({ dossier_id: p.dossierId, user_id: p.ownerId, title: titre, due_date: date, description: "Rappel créé depuis ClairDossier IA, après votre confirmation." });
        if (error) return "Le rappel n’a pas pu être enregistré. Réessayez.";
        p.onChanged?.();
        return `Enregistré : rappel du ${date.split("-").reverse().join("/")} ajouté aux échéances de ce dossier.`;
      }
      const plan = planificationDe(a.workflow);
      if (!plan) return "Cette automatisation n’est pas encore disponible. Vous pouvez demander un bilan régulier de vos dossiers, ou une alerte avant vos échéances.";
      const { error } = await supabase.rpc("create_client_automation", { p_action: plan.action, p_frequence: plan.frequence, p_jour: plan.jour, p_heure: plan.heure });
      if (error) return /SUBSCRIPTION_REQUIRED/.test(error.message) ? "Un abonnement actif est nécessaire pour programmer une automatisation." : "L’automatisation n’a pas pu être enregistrée. Réessayez.";
      return `Enregistré : ${a.title}. Elle s’exécute sur nos serveurs, même application fermée ; vous la retrouvez dans Mon compte, où vous pouvez la suspendre ou l’annuler.`;
    },
    [p],
  );

  if (!p.isOwner || history === null) return null;
  return (
    <IntelligenceLauncher
      initial={history}
      suggestions={suggestions(ctx)}
      onFile={p.onFile}
      onConfirm={confirm}
      transport={async (m) => {
        // Règles déterministes sur l'analyse du dossier (aucun appel de modèle) : le serveur avec modèle prendra le relais
        // une fois la clé d'API installée (même composant, autre transport).
        const r = runAssistant(m, ctx);
        void remember(m, r.text);
        return r;
      }}
    />
  );
}
