import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { adminErrorMessage, formatCents } from "../../lib/ai-admin";
import {
  alertLabel,
  formatBytes,
  isSupervisionOverview,
  parseEurosToCents,
  quotaLabel,
  quotaTone,
  sortAlerts,
  type SupervisionOverview,
} from "../../lib/supervision";

/**
 * Console : « Supervision » — vue d'ensemble privée du fondateur. UNE lecture
 * agrégée (`admin_supervision_overview`, migration 20261125140000, is_admin()
 * contrôlé côté base) : états et compteurs mesurés, jamais de contenu de pièce.
 *   - alertes de saturation (quota ≥ 80 %, budget, file bloquée, échecs répétés),
 *   - file : traitements, reprises, erreurs par catégorie,
 *   - abonnements et droits (lecture), coût IA et volume stocké par compte,
 *   - dernières actions d'administration (super admin),
 *   - pause / reprise des traitements (motif obligatoire, journalisée).
 * Les décisions par dossier (valider, rejeter, relancer) restent dans « IA privée ».
 * Si la migration n'est pas appliquée, la section l'indique sans rien casser.
 */

type Props = { emails: Record<string, string>; onError: (message: string | null) => void };

const ALERT_TONE: Record<string, string> = {
  critique: "border-red-200 bg-red-50 text-red-800",
  attention: "border-amber-200 bg-amber-50 text-amber-800",
  info: "hairline bg-cream-50 text-navy-900",
};
const QUOTA_TONE = { normal: "text-slate-600", attention: "text-amber-700", critique: "text-red-600" } as const;

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function Stat({ label, value, warn = false }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded-xl border hairline bg-white p-4">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-semibold ${warn ? "text-red-600" : "text-navy-900"}`}>{value}</p>
    </div>
  );
}

function Title({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">{children}</p>;
}

function Counts({ values, empty }: { values: Record<string, number>; empty: string }) {
  const entries = Object.entries(values).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return <p className="mt-2 text-sm text-slate-500">{empty}</p>;
  return (
    <ul className="mt-2 flex flex-wrap gap-2 text-xs">
      {entries.map(([k, n]) => (
        <li key={k} className="rounded-full bg-cream-100 px-3 py-1 text-navy-900">
          <span className="font-mono">{k}</span> · {n}
        </li>
      ))}
    </ul>
  );
}

export function AdminSupervision({ emails, onError }: Props) {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [data, setData] = useState<SupervisionOverview | null>(null);
  const [pauseReason, setPauseReason] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [repere, setRepere] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    // Sonde de capacité = la lecture elle-même : absente (migration non
    // appliquée) ou de forme inattendue ⇒ message neutre, aucune erreur.
    const res = await supabase.rpc("admin_supervision_overview");
    if (res.error || !isSupervisionOverview(res.data)) {
      setAvailable(false);
      return;
    }
    setData(res.data);
    setAvailable(true);
    if (res.data.moteur.en_pause) {
      const ctl = await supabase.from("ai_engine_control").select("reason").maybeSingle();
      setPauseReason(ctl.error ? null : ((ctl.data as { reason: string | null } | null)?.reason ?? null));
    } else {
      setPauseReason(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const alertes = useMemo(() => sortAlerts(data?.alertes ?? []), [data]);

  const run = async (fn: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(true);
    onError(null);
    const { error } = await fn();
    if (error) onError(adminErrorMessage(error.message));
    await load();
    setBusy(false);
  };

  if (available === null) return <p className="mt-8 text-sm text-slate-500">Chargement de la supervision…</p>;
  if (available === false || !data) {
    return (
      <div className="mt-8 rounded-2xl border hairline bg-white p-6 shadow-card">
        <p className="font-display text-lg text-navy-900">Supervision</p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          La vue de supervision n'est pas installée sur ce projet : elle s'active après application de la migration{" "}
          <code className="font-mono text-xs">20261125140000_supervision_fondateur.sql</code>. Le reste de la console fonctionne normalement.
        </p>
      </div>
    );
  }

  const { moteur, file, traitements_mois: tm, emails_entrants: mail, abonnements, budget, stockage, comptes, actions_admin: actions } = data;
  const repereCents = parseEurosToCents(repere);

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Title>Supervision</Title>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            États et compteurs mesurés en base — aucun contenu de pièce n'est lu ici. Les décisions par dossier (valider, rejeter, relancer)
            restent dans « IA privée ».
          </p>
        </div>
        <button
          type="button"
          disabled={busy}
          onClick={() => void run(async () => ({ error: null }))}
          className="rounded-full border hairline px-4 py-2 text-xs font-medium text-navy-900 hover:bg-cream-100 disabled:opacity-50"
        >
          Actualiser · {fmtDate(data.genere_le)}
        </button>
      </div>

      {/* Alertes de saturation */}
      <div className="space-y-2" aria-live="polite">
        {alertes.length === 0 ? (
          <p className="rounded-2xl border hairline bg-white px-5 py-4 text-sm text-slate-600">Aucune alerte : rien ne réclame votre attention.</p>
        ) : (
          alertes.map((a) => (
            <p key={a.code} className={`rounded-2xl border px-5 py-3 text-sm ${ALERT_TONE[a.niveau] ?? ALERT_TONE.info}`}>
              <span className="font-mono text-[0.62rem] uppercase tracking-[0.14em]">{a.niveau}</span> · {alertLabel(a)}
            </p>
          ))
        )}
      </div>

      {/* Pause sécurisée */}
      <div className="rounded-2xl border hairline bg-white p-6 shadow-card">
        <Title>Traitements automatiques</Title>
        {!moteur.installe ? (
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Le moteur documentaire n'est pas installé sur ce projet : aucun traitement automatique n'est exécuté.
          </p>
        ) : moteur.en_pause ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm leading-relaxed text-navy-900">
              En pause depuis le {fmtDate(moteur.en_pause_depuis)}
              {pauseReason ? ` — motif : ${pauseReason}` : ""}. Les travaux restent en file et repartiront à la reprise.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run(() => supabase.rpc("ai_admin_set_pause", { p_paused: false, p_reason: null }))}
              className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-navy-800 disabled:opacity-50"
            >
              Reprendre les traitements
            </button>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <label className="sr-only" htmlFor="supervision-motif">Motif de la pause</label>
            <input
              id="supervision-motif"
              type="text"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motif de la pause (obligatoire, journalisé)"
              className="min-w-[16rem] flex-1 rounded-lg border hairline bg-white px-3 py-2 text-sm"
            />
            <button
              type="button"
              disabled={busy || reason.trim().length < 3}
              onClick={() =>
                void run(async () => {
                  const r = await supabase.rpc("ai_admin_set_pause", { p_paused: true, p_reason: reason });
                  if (!r.error) setReason("");
                  return r;
                })
              }
              className="rounded-full border hairline px-4 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Mettre en pause
            </button>
          </div>
        )}
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          La pause empêche toute nouvelle réclamation de travail ; un travail déjà en cours se termine. Données, résultats et exports sont conservés.
          L'arrêt d'urgence côté serveur (secret <code className="font-mono">AI_ENGINE_PAUSED</code>) reste indépendant et prioritaire.
        </p>
      </div>

      {/* File : traitements, reprises, erreurs */}
      {file && (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="En file / en cours" value={`${file.par_statut.queued} / ${file.par_statut.running}`} />
            <Stat label="Bloqués" value={file.bloques} warn={file.bloques > 0 && !moteur.en_pause} />
            <Stat label="Reprises en cours" value={file.reprises_en_cours} />
            <Stat label="Terminés (24 h)" value={file.termines_24h} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Échecs (24 h)" value={file.echecs_24h} warn={file.echecs_24h > 0} />
            <Stat label="Tentatives épuisées (7 j)" value={file.echecs_definitifs_7j} warn={file.echecs_definitifs_7j > 0} />
            <Stat label="Dossiers à échecs multiples (7 j)" value={file.dossiers_multi_echecs_7j} warn={file.dossiers_multi_echecs_7j > 0} />
            <Stat label="Suspensions budget / quota (mois)" value={file.pauses_budget_mois} warn={file.pauses_budget_mois > 0} />
          </div>
          <div className="rounded-2xl border hairline bg-white p-6 shadow-card">
            <Title>File de travaux</Title>
            <p className="mt-3 text-sm text-slate-600">
              Plus ancien travail en attente : {fmtDate(file.plus_ancien_en_attente)} · dernière activité : {fmtDate(file.derniere_activite)} ·
              annulés : {file.par_statut.cancelled} · terminés au total : {file.par_statut.done}
            </p>
            <p className="mt-4 text-xs font-medium text-navy-900">Travaux ouverts par type</p>
            <Counts values={file.ouverts_par_type} empty="Aucun travail ouvert." />
            <p className="mt-4 text-xs font-medium text-navy-900">Échecs sur 30 jours, par catégorie</p>
            <Counts
              values={{
                "budget ou quota": file.erreurs_30j.budget_ou_quota,
                "interruption du worker": file.erreurs_30j.interruption,
                "autre erreur": file.erreurs_30j.autre,
              }}
              empty="Aucun échec."
            />
          </div>
        </div>
      )}

      {/* Coûts et budget */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Coût IA du mois (global)" value={formatCents(budget.cout_global_mois_cents)} warn={(budget.repere_pct ?? 0) >= 100} />
        <Stat label="Repère d'alerte" value={budget.repere_alerte_cents === null ? "non fixé" : `${formatCents(budget.repere_alerte_cents)} · ${(budget.repere_pct ?? 0).toLocaleString("fr-FR")} %`} />
        <Stat label="Pages lues / analyses (mois)" value={tm ? `${tm.pages_lues} / ${tm.analyses}` : "—"} />
        <Stat label="Extractions en erreur (mois)" value={tm ? tm.extractions_en_erreur : "—"} warn={(tm?.extractions_en_erreur ?? 0) > 0} />
      </div>
      <div className="rounded-2xl border hairline bg-white p-6 shadow-card">
        <Title>Repère d'alerte du budget global</Title>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-600">
          Chiffre de surveillance uniquement : une alerte apparaît à 80 % puis à 100 %. Le plafond réel de dépense reste le secret serveur{" "}
          <code className="font-mono text-xs">AI_BUDGET_CENTS_GLOBAL_MONTH</code>, que cette console ne lit ni ne modifie.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="supervision-repere">Repère mensuel en euros</label>
          <input
            id="supervision-repere"
            type="text"
            inputMode="decimal"
            value={repere}
            onChange={(e) => setRepere(e.target.value)}
            placeholder="Repère mensuel en € (vide = retirer)"
            className="w-64 rounded-lg border hairline bg-white px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={busy || repereCents === undefined || (repereCents === null && budget.repere_alerte_cents === null)}
            onClick={() =>
              void run(async () => {
                const r = await supabase.rpc("ai_admin_set_budget_alert", { p_cents: repereCents ?? null });
                if (!r.error) setRepere("");
                return r;
              })
            }
            className="rounded-full border hairline px-4 py-2 text-xs font-medium text-navy-900 hover:bg-cream-100 disabled:opacity-50"
          >
            {repereCents === null ? "Retirer le repère" : "Enregistrer le repère"}
          </button>
        </div>
      </div>

      {/* Abonnements et droits (lecture) */}
      <div className="rounded-2xl border hairline bg-white p-6 shadow-card">
        <Title>Abonnements et droits (lecture)</Title>
        <p className="mt-3 text-xs font-medium text-navy-900">Abonnements en cours, par offre</p>
        <Counts values={abonnements.en_cours_par_offre} empty="Aucun abonnement en cours." />
        <p className="mt-4 text-xs font-medium text-navy-900">Toutes lignes, par statut</p>
        <Counts values={abonnements.par_statut} empty="Aucune ligne d'abonnement synchronisée." />
        <p className="mt-4 text-sm text-slate-600">
          Résiliations programmées : {abonnements.resiliations_programmees}
          {abonnements.derogations_actives !== null ? ` · dérogations de quota actives : ${abonnements.derogations_actives}` : ""}. Le détail par client
          et toute modification restent dans « Abonnements » et dans Stripe.
        </p>
      </div>

      {/* Par compte : coût IA, quota, volume */}
      <div className="rounded-2xl border hairline bg-white p-6 shadow-card">
        <Title>Coût IA et volume stocké par compte</Title>
        <p className="mt-3 text-sm text-slate-600">
          Volume total : {formatBytes(stockage.octets)} pour {stockage.documents} fichier{stockage.documents > 1 ? "s" : ""}
          {stockage.octets_corbeille > 0 ? ` (dont ${formatBytes(stockage.octets_corbeille)} en corbeille)` : ""}
          {stockage.documents_sans_taille > 0 ? ` · ${stockage.documents_sans_taille} sans taille enregistrée (non comptés)` : ""}.
          {data.comptes_total > comptes.length ? ` ${comptes.length} comptes affichés sur ${data.comptes_total}.` : ""}
        </p>
        {comptes.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucun compte avec dossier, fichier ou abonnement.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="border-b hairline font-mono text-[0.62rem] uppercase tracking-[0.12em] text-slate-500">
                  <th scope="col" className="py-2 pr-3 font-normal">Compte</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Offre</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Coût IA (mois)</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Pages IA</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Actions IA</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Quota</th>
                  <th scope="col" className="py-2 pr-3 font-normal">Volume</th>
                  <th scope="col" className="py-2 font-normal">Dossiers</th>
                </tr>
              </thead>
              <tbody className="divide-y hairline">
                {comptes.map((c) => (
                  <tr key={c.user_id}>
                    <td className="py-2 pr-3 text-navy-900">{emails[c.user_id] ?? c.user_id.slice(0, 8)}</td>
                    <td className="py-2 pr-3 text-slate-600">
                      {c.offre ?? "—"}
                      {c.statut_abonnement ? ` (${c.statut_abonnement})` : ""}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">{formatCents(c.cout_ia_mois_cents)}</td>
                    <td className="py-2 pr-3 text-slate-600">{quotaLabel(c.pages_utilisees, c.pages_limite)}</td>
                    <td className="py-2 pr-3 text-slate-600">{quotaLabel(c.actions_utilisees, c.actions_limite)}</td>
                    <td className={`py-2 pr-3 font-medium ${QUOTA_TONE[quotaTone(c.quota_pct)]}`}>
                      {c.quota_pct === null ? "—" : `${c.quota_pct.toLocaleString("fr-FR")} %`}
                    </td>
                    <td className="py-2 pr-3 text-slate-600">
                      {formatBytes(c.octets)} · {c.documents}
                    </td>
                    <td className="py-2 text-slate-600">{c.dossiers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Réception d'e-mails */}
      {mail && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="E-mails reçus (30 j)" value={mail.recus_30j} />
          <Stat label="Pièces stockées (30 j)" value={mail.stockes_30j} />
          <Stat label="Rejetés / en erreur (30 j)" value={`${mail.rejetes_30j} / ${mail.en_erreur_30j}`} warn={mail.en_erreur_7j > 0} />
          <Stat label="Adresses de réception actives" value={mail.adresses_actives} />
        </div>
      )}

      {/* Historique des actions d'administration */}
      <div className="rounded-2xl border hairline bg-white p-6 shadow-card">
        <Title>Actions d'administration</Title>
        {!actions.visible ? (
          <p className="mt-3 text-sm text-slate-500">L'historique des actions est réservé au super administrateur.</p>
        ) : actions.dernieres.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">Aucune action enregistrée.</p>
        ) : (
          <>
            <p className="mt-3 text-sm text-slate-600">{actions.total_30j} action{actions.total_30j > 1 ? "s" : ""} sur 30 jours.</p>
            <Counts values={actions.par_action_30j} empty="" />
            <ul className="mt-4 space-y-1.5">
              {actions.dernieres.map((a, i) => (
                <li key={`${a.at}-${i}`} className="flex flex-wrap items-baseline gap-3 text-sm">
                  <span className="font-mono text-[0.65rem] text-slate-500">{fmtDate(a.at)}</span>
                  <span className="text-navy-900">
                    {a.action.replaceAll("_", " ")} · {a.ressource}
                    {a.compte ? ` · ${emails[a.compte] ?? a.compte.slice(0, 8)}` : ""}
                    {` · par ${emails[a.acteur] ?? a.acteur.slice(0, 8)}`}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">Les 30 dernières ; le journal complet reste dans « Activité ».</p>
          </>
        )}
      </div>
    </div>
  );
}
