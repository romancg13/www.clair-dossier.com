import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import {
  invokeAdminFunction,
  logAudit,
  type AdminEntitlementRow,
} from "../../lib/admin";
import { CATEGORIES, PLAN_LABELS, TYPOLOGY_LABELS, type PlanId } from "../../../packages/core/src/index";

/**
 * Console admin — automatisation (migration 20260917120000).
 * Chaque écriture est validée par la base (RLS, déclencheurs, RPC super
 * admin + AAL2) ; ces composants ne font que présenter et déclencher.
 */

const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  complete: "Complété",
  transmis: "Transmis",
  "en-cours": "En cours",
  valide: "Validé",
  archive: "Archivé",
};

const TIMELINE = [
  "Création du dossier",
  "Devis, contrat ou accord",
  "Suivi du dossier",
  "Facture et paiement",
  "Option impayé / pré-contentieux",
];

const chip = "rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-cream-100";

function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  return withTime
    ? d.toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/* ── Nouveaux dossiers ───────────────────────────────────────────────────── */

type SubmittedDossier = {
  id: string;
  user_id: string;
  title: string | null;
  typology: string;
  status: string;
  submitted_at: string;
  admin_seen_at: string | null;
  taken_by: string | null;
  taken_at: string | null;
  current_step: number | null;
};

export type IntakeFilter = "nouveau" | "a-traiter" | "en-cours" | "termine" | "archive";

const FILTERS: { id: IntakeFilter; label: string }[] = [
  { id: "nouveau", label: "Nouveau" },
  { id: "a-traiter", label: "À traiter" },
  { id: "en-cours", label: "En cours" },
  { id: "termine", label: "Terminé" },
  { id: "archive", label: "Archivé" },
];

/** Classement administratif d'un dossier validé (dérivé, jamais stocké). */
export function intakeBucket(d: Pick<SubmittedDossier, "status" | "admin_seen_at">): IntakeFilter {
  if (d.status === "archive") return "archive";
  if (d.status === "valide") return "termine";
  if (d.status === "en-cours") return "en-cours";
  if (!d.admin_seen_at) return "nouveau";
  return "a-traiter";
}

export function NewDossiersSection({
  userId,
  emails,
  names,
  onCount,
  onViewClient,
  onError,
  onNotice,
}: {
  userId: string | undefined;
  emails: Record<string, string>;
  names: Record<string, string>;
  onCount: (n: number) => void;
  onViewClient: (userId: string) => void;
  onError: (m: string) => void;
  onNotice: (m: string) => void;
}) {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SubmittedDossier[]>([]);
  const [filter, setFilter] = useState<IntakeFilter>("nouveau");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("dossiers")
      .select("id,user_id,title,typology,status,submitted_at,admin_seen_at,taken_by,taken_at,current_step,deleted_at")
      .not("submitted_at", "is", null)
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false })
      .limit(300);
    if (!error) {
      const list = (data as unknown as SubmittedDossier[] | null) ?? [];
      setRows(list);
      onCount(list.filter((d) => intakeBucket(d) === "nouveau").length);
    }
    setLoading(false);
  }, [onCount]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(() => {
    const c: Record<IntakeFilter, number> = { nouveau: 0, "a-traiter": 0, "en-cours": 0, termine: 0, archive: 0 };
    for (const d of rows) c[intakeBucket(d)]++;
    return c;
  }, [rows]);

  async function patch(d: SubmittedDossier, values: Record<string, unknown>, action: string, meta?: Record<string, string>) {
    const { error } = await supabase.from("dossiers").update(values).eq("id", d.id);
    if (error) {
      onError("Modification refusée par le serveur.");
      return false;
    }
    void logAudit(action, "dossier", d.id, d.user_id, meta);
    await load();
    return true;
  }

  async function open(d: SubmittedDossier) {
    if (!d.admin_seen_at) {
      await supabase.from("dossiers").update({ admin_seen_at: new Date().toISOString() }).eq("id", d.id);
    }
    navigate(`/compte/dossier/${d.id}`);
  }

  async function take(d: SubmittedDossier) {
    const ok = await patch(
      d,
      {
        taken_by: userId,
        taken_at: new Date().toISOString(),
        admin_seen_at: d.admin_seen_at ?? new Date().toISOString(),
        status: "en-cours",
      },
      "dossier_pris_en_charge",
    );
    if (ok) onNotice(`Dossier « ${d.title || d.typology} » pris en charge.`);
  }

  async function rename(d: SubmittedDossier) {
    const next = window.prompt(`Nouveau nom du dossier (actuel : « ${d.title ?? ""} ») :`, d.title ?? "")?.trim();
    if (!next || next === d.title) return;
    await patch(d, { title: next }, "dossier_renomme", { ancien: d.title ?? "", nouveau: next });
  }

  async function note(d: SubmittedDossier) {
    const body = window.prompt("Note interne (jamais visible par le client) :")?.trim();
    if (!body || !userId) return;
    const { error } = await supabase
      .from("admin_notes")
      .insert({ target_user_id: d.user_id, dossier_id: d.id, author_id: userId, body });
    if (error) {
      onError("Note refusée par le serveur.");
      return;
    }
    void logAudit("note_interne_ajoutee", "dossier", d.id, d.user_id);
    onNotice("Note interne enregistrée.");
  }

  const visible = rows.filter((d) => intakeBucket(d) === filter);
  const typologies = [
    ...CATEGORIES.map((c) => [c.id, c.label] as const),
    ...Object.entries(TYPOLOGY_LABELS).filter(([id]) => !CATEGORIES.some((c) => c.id === id)),
  ];

  return (
    <div className="mt-8">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrer les dossiers validés">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
              filter === f.id ? "bg-navy-900 text-cream-50" : "border hairline-strong bg-white text-navy-900 hover:bg-cream-100"
            }`}
          >
            {f.label} ({counts[f.id]})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-slate-500">Chargement…</p>
      ) : visible.length === 0 ? (
        <p className="mt-6 rounded-2xl border hairline bg-white p-6 text-sm text-slate-500 shadow-card">
          Aucun dossier dans cette catégorie.
        </p>
      ) : (
        <ul className="mt-5 space-y-2">
          {visible.map((d) => (
            <li key={d.id} className="rounded-2xl border hairline bg-white p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-navy-900">
                    {!d.admin_seen_at && <span className="mr-2 inline-block h-2 w-2 rounded-full bg-gold-500 align-middle" aria-label="Nouveau" />}
                    {d.title || d.typology}
                  </p>
                  <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
                    {names[d.user_id] || emails[d.user_id] || d.user_id.slice(0, 8)} · validé le {fmtDate(d.submitted_at, true)}
                    {d.taken_at ? ` · pris en charge le ${fmtDate(d.taken_at)}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => open(d)} className="rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-cream-50 hover:bg-navy-800">
                    Ouvrir
                  </button>
                  {!d.taken_at && d.status !== "archive" && d.status !== "valide" && (
                    <button type="button" onClick={() => take(d)} className={chip}>
                      Prendre en charge
                    </button>
                  )}
                  <button type="button" onClick={() => onViewClient(d.user_id)} className={chip}>
                    Voir client
                  </button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t hairline pt-3">
                <label className="sr-only" htmlFor={`nd-st-${d.id}`}>Statut</label>
                <select
                  id={`nd-st-${d.id}`}
                  value={d.status}
                  onChange={(e) => patch(d, { status: e.target.value }, "dossier_statut", { ancien: d.status, nouveau: e.target.value })}
                  className="rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs text-navy-900"
                >
                  {Object.entries(STATUS_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor={`nd-cat-${d.id}`}>Catégorie</label>
                <select
                  id={`nd-cat-${d.id}`}
                  value={d.typology}
                  onChange={(e) => patch(d, { typology: e.target.value }, "dossier_categorie", { ancien: d.typology, nouveau: e.target.value })}
                  className="max-w-[12rem] rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs text-navy-900"
                >
                  {typologies.map(([id, label]) => (
                    <option key={id} value={id}>{label}</option>
                  ))}
                </select>
                <label className="sr-only" htmlFor={`nd-step-${d.id}`}>Étape</label>
                <select
                  id={`nd-step-${d.id}`}
                  value={d.current_step ?? ""}
                  onChange={(e) =>
                    patch(d, { current_step: e.target.value ? Number(e.target.value) : null }, "dossier_etape", {
                      ancienne: String(d.current_step ?? "auto"),
                      nouvelle: e.target.value || "auto",
                    })
                  }
                  className="max-w-[14rem] rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs text-navy-900"
                >
                  <option value="">Étape : automatique</option>
                  {TIMELINE.map((label, i) => (
                    <option key={label} value={i + 1}>Étape {i + 1} · {label}</option>
                  ))}
                </select>
                <button type="button" onClick={() => rename(d)} className={chip}>Renommer</button>
                <button type="button" onClick={() => note(d)} className={chip}>Note interne</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Notifications administrateur ───────────────────────────────────────── */

type NotificationRow = {
  id: string;
  dossier_id: string | null;
  user_id: string | null;
  created_at: string;
  read_at: string | null;
  email_status: string;
  sms_status: string;
  retry_count: number;
  last_error: string | null;
};

const CHANNEL_LABELS: Record<string, string> = {
  pending: "en attente",
  sending: "envoi…",
  sent: "envoyé",
  failed: "échec",
  not_configured: "non configuré",
};

export function NotificationsSection({
  userId,
  emails,
  names,
  onError,
  onNotice,
}: {
  userId: string | undefined;
  emails: Record<string, string>;
  names: Record<string, string>;
  onError: (m: string) => void;
  onNotice: (m: string) => void;
}) {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("admin_notifications")
      .select("id,dossier_id,user_id,created_at,read_at,email_status,sms_status,retry_count,last_error")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as NotificationRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function markRead(ids: string[]) {
    if (!ids.length) return;
    const { error } = await supabase
      .from("admin_notifications")
      .update({ read_at: new Date().toISOString(), read_by: userId })
      .in("id", ids);
    if (error) onError("Mise à jour refusée.");
    await load();
  }

  async function retry(n: NotificationRow) {
    setBusy(n.id);
    const res = await invokeAdminFunction("notify-lead", { table: "dossiers", notification_id: n.id, retry: true });
    setBusy(null);
    if (!res.ok || res.error) onError("La relance n'a pas abouti (fonction serveur déployée ?).");
    else onNotice("Notification relancée.");
    await load();
  }

  const unread = rows.filter((r) => !r.read_at);

  return (
    <div className="mt-8 rounded-2xl border hairline bg-white p-6 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
          Notifications · {unread.length} non lue{unread.length > 1 ? "s" : ""}
        </p>
        {unread.length > 0 && (
          <button type="button" onClick={() => markRead(unread.map((r) => r.id))} className={chip}>
            Tout marquer comme lu
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">Aucune notification.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {rows.map((n) => {
            const failed = n.email_status === "failed" || n.sms_status === "failed" || n.email_status === "pending";
            return (
              <li key={n.id} className={`rounded-xl border px-4 py-3 text-sm ${n.read_at ? "hairline bg-cream-50" : "hairline-gold bg-gold-500/5"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 text-navy-900">
                    Nouveau dossier créé par {n.user_id ? names[n.user_id] || emails[n.user_id] || "un client" : "un client"}
                  </p>
                  <span className="font-mono text-[0.62rem] text-slate-500">{fmtDate(n.created_at, true)}</span>
                </div>
                <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
                  E-mail : {CHANNEL_LABELS[n.email_status] ?? n.email_status} · SMS : {CHANNEL_LABELS[n.sms_status] ?? n.sms_status}
                  {n.retry_count ? ` · ${n.retry_count} relance(s)` : ""}
                </p>
                {n.last_error && <p className="mt-1 text-xs text-red-700">{n.last_error}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {n.dossier_id && (
                    <Link to={`/compte/dossier/${n.dossier_id}`} className={chip}>Ouvrir le dossier</Link>
                  )}
                  {!n.read_at && (
                    <button type="button" onClick={() => markRead([n.id])} className={chip}>Marquer comme lu</button>
                  )}
                  {failed && n.retry_count < 5 && (
                    <button type="button" disabled={busy === n.id} onClick={() => retry(n)} className={chip}>
                      {busy === n.id ? "Relance…" : "Relancer l'envoi"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── Quota, exception et accès d'un client ───────────────────────────────── */

function planLabel(id: string | null): string {
  if (!id) return "Aucun abonnement synchronisé";
  return id in PLAN_LABELS ? PLAN_LABELS[id as PlanId] : id;
}

function limitLabel(row: AdminEntitlementRow): string {
  if (!row.applies) return "Non appliqué";
  if (row.unlimited) return "Illimité";
  return String(row.effective_limit ?? "—");
}

export function ClientEntitlementPanel({
  row,
  email,
  superAdmin,
  onChanged,
  onError,
  onNotice,
}: {
  row: AdminEntitlementRow | undefined;
  email: string | null;
  superAdmin: boolean;
  onChanged: () => void;
  onError: (m: string) => void;
  onNotice: (m: string) => void;
}) {
  async function setOverride(mode: "unlimited" | "custom_limit" | "bonus" | "remove") {
    if (!row) return;
    let limit: number | null = null;
    if (mode === "custom_limit" || mode === "bonus") {
      const raw = window.prompt(mode === "bonus" ? "Nombre de dossiers supplémentaires (+N) :" : "Nouvelle limite de dossiers par période :");
      if (raw === null) return;
      limit = Number.parseInt(raw, 10);
      if (!Number.isFinite(limit) || limit < 0) {
        onError("Nombre invalide.");
        return;
      }
    }
    const reason = window.prompt("Motif (obligatoire, journalisé) :")?.trim();
    if (!reason) return;
    const { error } = await supabase.rpc("admin_set_dossier_override", {
      p_user: row.user_id,
      p_mode: mode,
      p_limit: limit,
      p_reason: reason,
      p_expires_at: null,
    });
    if (error) {
      onError(error.message.includes("MFA_REQUIRED") ? "Vérification MFA requise." : "Modification refusée par le serveur.");
      return;
    }
    onNotice("Quota mis à jour.");
    onChanged();
  }

  async function access(action: "suspend" | "reactivate") {
    if (!row) return;
    let reason = "";
    if (action === "suspend") {
      reason = window.prompt("Motif de la suspension (obligatoire). Les données du client sont conservées :")?.trim() ?? "";
      if (!reason) return;
    } else if (!window.confirm("Réactiver l'accès de ce client ?")) {
      return;
    }
    const res = await invokeAdminFunction("admin-users", { action, user_id: row.user_id, reason });
    if (!res.ok || res.error) {
      onError("Action refusée (fonction serveur admin-users déployée ? session MFA ?).");
      return;
    }
    onNotice(action === "suspend" ? "Compte suspendu." : "Compte réactivé.");
    onChanged();
  }

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ first_name: "", last_name: "", company_name: "", phone: "" });

  async function openProfileEditor() {
    if (!row) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("first_name,last_name,company_name,phone")
      .eq("id", row.user_id)
      .maybeSingle();
    if (error) {
      onError("Profil indisponible.");
      return;
    }
    const d = (data as Record<string, string | null> | null) ?? {};
    setDraft({
      first_name: d.first_name ?? "",
      last_name: d.last_name ?? "",
      company_name: d.company_name ?? "",
      phone: d.phone ?? "",
    });
    setEditing(true);
  }

  async function saveProfile() {
    if (!row) return;
    const first = draft.first_name.trim();
    const last = draft.last_name.trim();
    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: first || null,
        last_name: last || null,
        full_name: [first, last].filter(Boolean).join(" ") || null,
        company_name: draft.company_name.trim() || null,
        phone: draft.phone.trim() || null,
      })
      .eq("id", row.user_id);
    if (error) {
      onError("Modification refusée (session MFA requise, ou téléphone invalide).");
      return;
    }
    void logAudit("profil_client_modifie", "utilisateur", row.user_id, row.user_id);
    setEditing(false);
    onNotice("Profil client mis à jour.");
    onChanged();
  }

  async function resendVerification() {
    if (!email || !row) return;
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) onError("Renvoi impossible (compte déjà vérifié ou limite d'envoi atteinte).");
    else {
      onNotice(`E-mail de vérification renvoyé à ${email}.`);
      void logAudit("verification_renvoyee", "utilisateur", row.user_id, row.user_id);
    }
  }

  if (!row) return null;

  return (
    <div className="mt-4 rounded-xl bg-cream-50 p-4">
      <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">Abonnement & quota</p>
      <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Offre</dt><dd className="text-navy-900">{planLabel(row.plan_id)}{row.subscription_status ? ` · ${row.subscription_status}` : ""}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Quota plan</dt><dd className="text-navy-900">{row.plan_id ? (row.plan_limit ?? "Illimité") : "—"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Exception</dt><dd className="text-navy-900">{row.override_mode === "unlimited" ? "Illimité" : row.override_mode === "custom_limit" ? `Limite ${row.override_limit}` : row.override_mode === "bonus" ? `+${row.override_limit}` : "Aucune"}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Quota effectif</dt><dd className="font-medium text-navy-900">{limitLabel(row)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Utilisé (période)</dt><dd className="text-navy-900">{row.used}</dd></div>
        <div className="flex justify-between gap-3"><dt className="text-slate-500">Fin de période</dt><dd className="text-navy-900">{row.period_end ? fmtDate(row.period_end) : "—"}</dd></div>
      </dl>
      {row.override_reason && <p className="mt-2 text-xs text-slate-500">Motif de l'exception : {row.override_reason}</p>}
      {row.suspended_at && <p className="mt-2 text-sm font-medium text-red-700">Compte suspendu depuis le {fmtDate(row.suspended_at)}.</p>}

      {superAdmin && editing && (
        <form
          className="mt-3 grid gap-2 border-t hairline pt-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            void saveProfile();
          }}
        >
          {([
            ["first_name", "Prénom"],
            ["last_name", "Nom"],
            ["company_name", "Structure"],
            ["phone", "Téléphone"],
          ] as const).map(([key, label]) => (
            <label key={key} className="block text-xs text-slate-500">
              {label}
              <input
                value={draft[key]}
                onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                type={key === "phone" ? "tel" : "text"}
                className="mt-1 w-full rounded-lg border hairline-strong bg-white px-3 py-2 text-sm text-navy-900"
              />
            </label>
          ))}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-navy-800">
              Enregistrer
            </button>
            <button type="button" onClick={() => setEditing(false)} className="text-xs text-slate-500 hover:text-navy-900">
              Annuler
            </button>
          </div>
        </form>
      )}

      {superAdmin && (
        <div className="mt-3 flex flex-wrap gap-2 border-t hairline pt-3">
          <button type="button" onClick={openProfileEditor} className={chip}>Modifier le profil</button>
          <button type="button" onClick={() => setOverride("unlimited")} className={chip}>Illimité</button>
          <button type="button" onClick={() => setOverride("custom_limit")} className={chip}>Limite personnalisée</button>
          <button type="button" onClick={() => setOverride("bonus")} className={chip}>+N dossiers</button>
          {row.override_mode && <button type="button" onClick={() => setOverride("remove")} className={chip}>Retirer l'exception</button>}
          {email && <button type="button" onClick={resendVerification} className={chip}>Renvoyer la vérification</button>}
          {row.suspended_at ? (
            <button type="button" onClick={() => access("reactivate")} className={chip}>Réactiver</button>
          ) : (
            <button type="button" onClick={() => access("suspend")} className="rounded-full px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
              Suspendre
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Abonnements synchronisés ────────────────────────────────────────────── */

export function SubscriptionsTable({ rows }: { rows: AdminEntitlementRow[] }) {
  const withSub = rows.filter((r) => r.plan_id || r.subscription_status || r.override_mode);
  if (withSub.length === 0) {
    return <p className="mt-4 text-sm text-slate-500">Aucun abonnement synchronisé pour le moment (webhook Stripe à configurer ou aucun paiement depuis).</p>;
  }
  return (
    <ul className="mt-4 space-y-2">
      {withSub.map((r) => (
        <li key={r.user_id} className="rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 flex-1 truncate font-medium text-navy-900">{r.email ?? r.user_id.slice(0, 8)}</p>
            <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
              {planLabel(r.plan_id)}{r.subscription_status ? ` · ${r.subscription_status}` : ""}
            </span>
          </div>
          <p className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
            Quota {limitLabel(r)} · utilisé {r.used}{r.period_end ? ` · renouvellement ${fmtDate(r.period_end)}` : ""}
            {r.override_mode ? " · exception active" : ""}
            {r.stripe_customer_id ? ` · ${r.stripe_customer_id}` : ""}
          </p>
        </li>
      ))}
    </ul>
  );
}
