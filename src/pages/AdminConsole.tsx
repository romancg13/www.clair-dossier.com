import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Seo } from "../lib/seo";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  checkSuperAdmin,
  confirmIrreversible,
  hasAdminNotes,
  hasAuditLogs,
  hasDossierTrash,
  logAudit,
} from "../lib/admin";
import { CATEGORY_LABELS, effectiveCategory, formatBytes, hasDocExtras, isGenericTitle } from "../lib/dossier-workspace";

/**
 * Console d'administration (/admin) — réservée à l'admin global.
 *
 * La garde frontend (redirection) n'est qu'un confort : CHAQUE requête émise
 * ici est validée côté base par la RLS (is_admin / is_super_admin en
 * SECURITY DEFINER). Un utilisateur normal qui atteindrait cette route ne
 * lirait rien : toutes les listes reviendraient vides et toute écriture
 * serait refusée par PostgreSQL. Aucune élévation de privilège côté client.
 */

type ProfileRow = {
  id: string;
  full_name: string | null;
  company_name: string | null;
  company_type: string | null;
  phone: string | null;
  created_at: string;
};

type DossierRow = {
  id: string;
  user_id: string;
  typology: string;
  title: string | null;
  status: string;
  created_at: string;
  deleted_at?: string | null;
  delete_reason?: string | null;
};

type DocRow = {
  id: string;
  dossier_id: string;
  user_id: string;
  file_name: string;
  file_path: string;
  kind: string;
  size_bytes: number | null;
  created_at: string;
  category?: string | null;
  deleted_at?: string | null;
};

type AuditRow = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  target_user_id: string | null;
  created_at: string;
};

type NoteRow = { id: string; target_user_id: string; body: string; created_at: string };

const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  complete: "Complété",
  transmis: "Transmis",
  "en-cours": "En cours",
  valide: "Validé",
  archive: "Archivé",
};

const SECTIONS = [
  { id: "dashboard", label: "Tableau de bord" },
  { id: "clients", label: "Clients" },
  { id: "dossiers", label: "Dossiers" },
  { id: "corbeille", label: "Corbeille" },
  { id: "activite", label: "Activité" },
  { id: "abonnements", label: "Abonnements" },
  { id: "diagnostic", label: "Diagnostic" },
] as const;
type SectionId = (typeof SECTIONS)[number]["id"];

function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border hairline bg-white p-6 shadow-card ${className}`}>
      {children}
    </div>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string | number; warn?: boolean }) {
  return (
    <div className="rounded-xl border hairline bg-white p-4">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-semibold ${warn ? "text-red-600" : "text-navy-900"}`}>
        {value}
      </p>
    </div>
  );
}

/**
 * Porte MFA (§ sécurité admin) — TOTP natif Supabase, aucun système maison.
 * Après is_admin() : la console n'est rendue qu'en AAL2.
 *  - aucun facteur vérifié → enrôlement (QR + secret) puis vérification ;
 *  - facteur vérifié mais session AAL1 → challenge à 6 chiffres ;
 *  - erreur réseau → message + réessayer, jamais de contournement.
 * Les utilisateurs normaux ne passent jamais par cette porte.
 */
function MfaGate({ onReady }: { onReady: () => void }) {
  const [mode, setMode] = useState<"verification" | "enroll" | "challenge">("verification");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function bootstrap() {
    setErr(null);
    setMode("verification");
    try {
      const { data: aal, error: aalErr } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aalErr) throw aalErr;
      if (aal.currentLevel === "aal2") {
        onReady();
        return;
      }
      const { data: factors, error: fErr } = await supabase.auth.mfa.listFactors();
      if (fErr) throw fErr;
      const verified = factors.totp.find((f) => f.status === "verified");
      if (verified) {
        setFactorId(verified.id);
        setMode("challenge");
        return;
      }
      // Facteurs non vérifiés abandonnés : repartir proprement.
      for (const f of factors.all.filter((x) => x.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: f.id }).catch(() => {});
      }
      const { data: enr, error: eErr } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ClairDossier admin",
      });
      if (eErr) throw eErr;
      setFactorId(enr.id);
      setQr(enr.totp.qr_code);
      setSecret(enr.totp.secret);
      setMode("enroll");
    } catch {
      setErr("Vérification MFA impossible pour le moment. Réessayez.");
    }
  }

  useEffect(() => {
    void bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitCode() {
    if (!factorId || code.trim().length < 6) return;
    setBusy(true);
    setErr(null);
    try {
      const { data: ch, error: cErr } = await supabase.auth.mfa.challenge({ factorId });
      if (cErr) throw cErr;
      const { error: vErr } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: ch.id,
        code: code.trim(),
      });
      if (vErr) throw vErr;
      onReady();
    } catch {
      setErr("Code invalide ou expiré. Réessayez.");
    } finally {
      setBusy(false);
      setCode("");
    }
  }

  return (
    <section className="bg-cream-50">
      <div className="mx-auto max-w-md px-5 py-20 sm:px-8">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
          Console d'administration
        </p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-navy-900">
          Vérification en deux étapes
        </h1>

        {mode === "verification" && !err && (
          <p className="mt-4 text-sm text-slate-500">Vérification du niveau de session…</p>
        )}

        {mode === "enroll" && (
          <div className="mt-5 rounded-2xl border hairline bg-white p-6 shadow-card">
            <p className="text-sm leading-relaxed text-slate-500">
              Scannez ce QR code avec votre application d'authentification (ou saisissez la clé),
              puis entrez le code à 6 chiffres pour activer la protection de la console.
            </p>
            {qr && (
              <img
                src={`data:image/svg+xml;utf8,${encodeURIComponent(qr)}`}
                alt="QR code d'enrôlement MFA"
                width={180}
                height={180}
                className="mx-auto mt-4 rounded-lg border hairline bg-white p-2"
              />
            )}
            {secret && (
              <p className="mt-3 break-all text-center font-mono text-[0.7rem] text-slate-500">
                Clé : {secret}
              </p>
            )}
          </div>
        )}

        {mode === "challenge" && (
          <p className="mt-4 text-sm leading-relaxed text-slate-500">
            Entrez le code à 6 chiffres de votre application d'authentification.
          </p>
        )}

        {(mode === "enroll" || mode === "challenge") && (
          <form
            className="mt-5 flex flex-wrap items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submitCode();
            }}
          >
            <label htmlFor="mfa-code" className="sr-only">
              Code à 6 chiffres
            </label>
            <input
              id="mfa-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              className="w-40 rounded-xl border hairline-strong bg-white px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-navy-900"
            />
            <button
              type="submit"
              disabled={busy || code.length < 6}
              className="rounded-full bg-navy-900 px-5 py-3 text-sm font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-60"
            >
              {busy ? "Vérification…" : "Valider"}
            </button>
          </form>
        )}

        {err && (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {err}{" "}
            <button type="button" onClick={() => void bootstrap()} className="underline">
              Réessayer
            </button>
          </p>
        )}

        <p className="mt-6 text-xs text-slate-500">
          <Link to="/compte" className="underline">
            ← Revenir à mon compte
          </Link>
        </p>
      </div>
    </section>
  );
}

export function AdminConsole() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [mfaOk, setMfaOk] = useState(false);
  const [superAdmin, setSuperAdmin] = useState(false);
  const [section, setSection] = useState<SectionId>("dashboard");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Capacités (migrations appliquées ou non).
  const [caps, setCaps] = useState({ trash: false, audit: false, notes: false, docExtras: false });

  // Données.
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [clientOpen, setClientOpen] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    (async () => {
      const { data } = await supabase.rpc("is_admin");
      if (!active) return;
      if (data !== true) {
        setAllowed(false);
        navigate("/compte", { replace: true });
        return;
      }
      setAllowed(true);
      const [sa, trash, auditOk, notesOk, extras] = await Promise.all([
        checkSuperAdmin(),
        hasDossierTrash(),
        hasAuditLogs(),
        hasAdminNotes(),
        hasDocExtras(),
      ]);
      if (!active) return;
      setSuperAdmin(sa);
      setCaps({ trash, audit: auditOk, notes: notesOk, docExtras: extras });
      await reloadAll(trash, auditOk, notesOk, extras, (fn) => active && fn());
      if (active) setLoading(false);
      void logAudit("admin_console_ouverte", "console");
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  async function reloadAll(
    trash: boolean,
    auditOk: boolean,
    notesOk: boolean,
    extras: boolean,
    guard: (fn: () => void) => void = (fn) => fn(),
  ) {
    const dossierCols = `id,user_id,typology,title,status,created_at${trash ? ",deleted_at,delete_reason" : ""}`;
    const docCols = `id,dossier_id,user_id,file_name,file_path,kind,size_bytes,created_at${extras ? ",category,deleted_at" : ""}`;
    const [p, em, d, dc, au, no] = await Promise.all([
      supabase.from("profiles").select("id,full_name,company_name,company_type,phone,created_at"),
      supabase.rpc("admin_user_emails"),
      supabase.from("dossiers").select(dossierCols).order("created_at", { ascending: false }),
      supabase.from("dossier_documents").select(docCols).order("created_at", { ascending: false }),
      auditOk
        ? supabase
            .from("audit_logs")
            .select("id,action,resource_type,resource_id,target_user_id,created_at")
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] }),
      notesOk
        ? supabase
            .from("admin_notes")
            .select("id,target_user_id,body,created_at")
            .order("created_at", { ascending: false })
            .limit(200)
        : Promise.resolve({ data: [] }),
    ]);
    guard(() => {
      setProfiles((p.data as ProfileRow[] | null) ?? []);
      const map: Record<string, string> = {};
      for (const e of (em.data as { id: string; email: string }[] | null) ?? []) map[e.id] = e.email;
      setEmails(map);
      setDossiers((d.data as unknown as DossierRow[] | null) ?? []);
      setDocs((dc.data as unknown as DocRow[] | null) ?? []);
      setAudit((au.data as AuditRow[] | null) ?? []);
      setNotes((no.data as NoteRow[] | null) ?? []);
    });
  }

  async function refresh() {
    await reloadAll(caps.trash, caps.audit, caps.notes, caps.docExtras);
  }

  const activeDossiers = dossiers.filter((d) => !d.deleted_at);
  const trashedDossiers = dossiers.filter((d) => Boolean(d.deleted_at));
  const activeDocs = docs.filter((d) => !d.deleted_at);
  const trashedDocs = docs.filter((d) => Boolean(d.deleted_at));
  const storageBytes = activeDocs.reduce((s, d) => s + (d.size_bytes ?? 0), 0);

  const q = query.trim().toLowerCase();
  const matchProfile = (p: ProfileRow) =>
    !q ||
    [p.full_name, p.company_name, emails[p.id], p.id, p.phone]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  const matchDossier = (d: DossierRow) =>
    !q ||
    [d.title, d.typology, d.id, emails[d.user_id]]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  const matchDoc = (d: DocRow) =>
    !q || [d.file_name, d.id, emails[d.user_id]].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));

  const diagnostics = useMemo(() => {
    const dossierIds = new Set(dossiers.map((d) => d.id));
    const profileIds = new Set(profiles.map((p) => p.id));
    return {
      docsSansDossier: activeDocs.filter((d) => !dossierIds.has(d.dossier_id)),
      dossiersSansProfil: activeDossiers.filter((d) => !profileIds.has(d.user_id)),
      dossiersSansTitre: activeDossiers.filter((d) => !d.title?.trim()),
      titresGeneriques: activeDossiers.filter((d) => d.title?.trim() && isGenericTitle(d.title)),
      docsNonClasses: caps.docExtras
        ? activeDocs.filter((d) => d.kind !== "deliverable" && effectiveCategory(d.file_name, d.category) === "autres")
        : [],
    };
  }, [dossiers, profiles, activeDocs, activeDossiers, caps.docExtras]);

  /* ── Actions dossiers ─────────────────────────────────────────────────── */

  async function trashDossier(d: DossierRow) {
    const reason = window.prompt(
      `Mettre le dossier « ${d.title || d.typology} » à la corbeille ?\nMotif (visible dans l'audit) :`,
      "Créé par erreur",
    );
    if (reason === null) return;
    const { error: e } = await supabase
      .from("dossiers")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id, delete_reason: reason || null })
      .eq("id", d.id);
    if (e) {
      setError("Mise à la corbeille refusée (migration super admin appliquée ?).");
      return;
    }
    setNotice(`Dossier « ${d.title || d.typology} » placé dans la corbeille.`);
    void logAudit("dossier_corbeille", "dossier", d.id, d.user_id, { motif: reason || "" });
    await refresh();
  }

  async function restoreDossier(d: DossierRow) {
    const { error: e } = await supabase
      .from("dossiers")
      .update({ deleted_at: null, deleted_by: null, delete_reason: null })
      .eq("id", d.id);
    if (e) {
      setError("Restauration refusée.");
      return;
    }
    setNotice(`Dossier « ${d.title || d.typology} » restauré.`);
    void logAudit("dossier_restaure", "dossier", d.id, d.user_id);
    await refresh();
  }

  async function hardDeleteDossier(d: DossierRow) {
    const docCount = docs.filter((x) => x.dossier_id === d.id).length;
    if (
      !confirmIrreversible(
        `Supprimer DÉFINITIVEMENT le dossier « ${d.title || d.typology} » (client ${emails[d.user_id] ?? d.user_id.slice(0, 8)}) et ses ${docCount} document(s) ?`,
      )
    )
      return;
    // 1. Fichiers storage, 2. lignes documents (cascade couvre aussi), 3. dossier.
    const paths = docs.filter((x) => x.dossier_id === d.id).map((x) => x.file_path);
    if (paths.length) await supabase.storage.from("documents").remove(paths);
    const { error: e } = await supabase.from("dossiers").delete().eq("id", d.id);
    if (e) {
      setError("Suppression définitive refusée (réservée au super admin).");
      return;
    }
    setNotice("Dossier supprimé définitivement (fichiers inclus).");
    void logAudit("dossier_suppression_definitive", "dossier", d.id, d.user_id, {
      documents: String(docCount),
    });
    await refresh();
  }

  async function changeStatus(d: DossierRow, status: string) {
    const { error: e } = await supabase.from("dossiers").update({ status }).eq("id", d.id);
    if (e) {
      setError("Changement de statut refusé (migration super admin appliquée ?).");
      return;
    }
    void logAudit("dossier_statut", "dossier", d.id, d.user_id, { statut: status });
    await refresh();
  }

  /* ── Actions documents (corbeille admin) ──────────────────────────────── */

  async function trashDoc(doc: DocRow) {
    if (!window.confirm(`Mettre « ${doc.file_name} » à la corbeille ?`)) return;
    const { error: e } = await supabase
      .from("dossier_documents")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id })
      .eq("id", doc.id);
    if (e) {
      setError("Action refusée (migrations appliquées ?).");
      return;
    }
    void logAudit("document_corbeille", "document", doc.id, doc.user_id);
    await refresh();
  }

  async function restoreDoc(doc: DocRow) {
    const { error: e } = await supabase
      .from("dossier_documents")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", doc.id);
    if (e) {
      setError("Restauration refusée.");
      return;
    }
    void logAudit("document_restaure", "document", doc.id, doc.user_id);
    await refresh();
  }

  async function hardDeleteDoc(doc: DocRow) {
    if (!confirmIrreversible(`Supprimer DÉFINITIVEMENT « ${doc.file_name} » ?`)) return;
    await supabase.storage.from("documents").remove([doc.file_path]);
    const { error: e } = await supabase.from("dossier_documents").delete().eq("id", doc.id);
    if (e) {
      setError("Suppression refusée.");
      return;
    }
    void logAudit("document_suppression_definitive", "document", doc.id, doc.user_id);
    await refresh();
  }

  async function openDoc(doc: DocRow) {
    const { data } = await supabase.storage.from("documents").createSignedUrl(doc.file_path, 600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    else setError("Lien indisponible pour ce fichier.");
  }

  /* ── Clients ──────────────────────────────────────────────────────────── */

  async function sendReset(email: string, userId: string) {
    const { error: e } = await supabase.auth.resetPasswordForEmail(email);
    if (e) {
      setError("Envoi du lien de réinitialisation refusé (limite de débit ?).");
      return;
    }
    setNotice(`Lien de réinitialisation envoyé à ${email}.`);
    void logAudit("reset_password_envoye", "utilisateur", userId, userId);
  }

  async function addNote(targetUserId: string) {
    const body = noteDraft.trim();
    if (!body || !user) return;
    const { error: e } = await supabase.from("admin_notes").insert({
      target_user_id: targetUserId,
      author_id: user.id,
      body,
    });
    if (e) {
      setError("Note refusée (migration super admin appliquée ?).");
      return;
    }
    setNoteDraft("");
    void logAudit("note_interne_ajoutee", "utilisateur", targetUserId, targetUserId);
    await refresh();
  }

  if (authLoading || allowed === null) {
    return (
      <section className="bg-cream-50">
        <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
          <p className="text-sm text-slate-500">Vérification des autorisations…</p>
        </div>
      </section>
    );
  }
  if (!allowed) return null;
  if (!mfaOk) return <MfaGate onReady={() => setMfaOk(true)} />;

  return (
    <>
      <Seo title="Console d'administration" description="Administration ClairDossier." path="/compte" noindex />
      <section className="bg-cream-50">
        <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8 lg:px-12">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
                Console d'administration
              </p>
              <h1 className="mt-2 font-display text-3xl font-semibold text-navy-900">
                {superAdmin ? "Super admin" : "Support"} · ClairDossier
              </h1>
              {!caps.trash && (
                <p className="mt-2 max-w-xl text-xs leading-relaxed text-slate-500">
                  Mode lecture étendu : appliquez les migrations « gestion documentaire » et
                  « super admin » (dossier supabase/migrations) pour activer corbeille,
                  corrections, notes internes et journal d'audit.
                </p>
              )}
            </div>
            <Link
              to="/compte"
              className="rounded-full border hairline-strong bg-white px-4 py-2 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-100"
            >
              ← Mon compte
            </Link>
          </div>

          {(error || notice) && (
            <p
              role={error ? "alert" : "status"}
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                error ? "border-red-200 bg-red-50 text-red-700" : "hairline-gold bg-gold-500/10 text-navy-900"
              }`}
            >
              {error ?? notice}
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                }}
                className="ml-3 text-xs underline"
              >
                Fermer
              </button>
            </p>
          )}

          {/* Recherche globale */}
          <div className="mt-6">
            <label htmlFor="admin-search" className="sr-only">
              Recherche globale
            </label>
            <input
              id="admin-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher un client, un e-mail, un dossier, un document…"
              className="w-full max-w-xl rounded-full border hairline-strong bg-white px-5 py-3 text-sm text-navy-900 placeholder:text-slate-500"
            />
          </div>

          {/* Navigation sections (aria-pressed : boutons de section, pas de
              role="tab" sans tabpanel associé) */}
          <div className="mt-6 flex gap-1 overflow-x-auto whitespace-nowrap border-b hairline">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                aria-pressed={section === s.id}
                onClick={() => setSection(s.id)}
                className={`-mb-px shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  section === s.id
                    ? "border-b-2 border-gold-500 text-navy-900"
                    : "text-slate-500 hover:text-navy-900"
                }`}
              >
                {s.label}
                {s.id === "corbeille" && trashedDossiers.length + trashedDocs.length > 0
                  ? ` (${trashedDossiers.length + trashedDocs.length})`
                  : ""}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-slate-500">Chargement des données…</p>
          ) : (
            <>
              {section === "dashboard" && (
                <div className="mt-8 space-y-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to="/dossier/nouveau"
                      className="rounded-full bg-gold-500 px-4 py-2 text-xs font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
                    >
                      + Dossier
                    </Link>
                    {(
                      [
                        ["corbeille", "Corbeille"],
                        ["diagnostic", "Diagnostic"],
                        ["clients", "Clients"],
                        ["activite", "Activité"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSection(id)}
                        className="rounded-full border hairline-strong bg-white px-4 py-2 text-xs font-medium text-navy-900 hover:bg-cream-100"
                      >
                        {label}
                      </button>
                    ))}
                    <span className="ml-auto font-mono text-[0.65rem] uppercase tracking-[0.12em] text-slate-500">
                      Base de données : {profiles.length + dossiers.length > 0 || emails ? "opérationnelle" : "à vérifier"} · Stripe : voir dashboard
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Clients" value={profiles.length} />
                    <Stat label="Dossiers actifs" value={activeDossiers.length} />
                    <Stat label="Documents" value={activeDocs.length} />
                    <Stat label="Stockage" value={formatBytes(storageBytes) || "0"} />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <Stat label="Corbeille dossiers" value={trashedDossiers.length} warn={trashedDossiers.length > 0} />
                    <Stat label="Corbeille documents" value={trashedDocs.length} warn={trashedDocs.length > 0} />
                    <Stat
                      label="Anomalies détectées"
                      value={
                        diagnostics.docsSansDossier.length +
                        diagnostics.dossiersSansProfil.length +
                        diagnostics.dossiersSansTitre.length
                      }
                      warn={
                        diagnostics.docsSansDossier.length + diagnostics.dossiersSansProfil.length > 0
                      }
                    />
                    <Stat label="Actions admin (100 dern.)" value={caps.audit ? audit.length : "—"} />
                  </div>
                  <Card>
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                      Derniers dossiers
                    </p>
                    <ul className="mt-4 space-y-2">
                      {activeDossiers.slice(0, 8).map((d) => (
                        <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                          <Link
                            to={`/compte/dossier/${d.id}`}
                            className="min-w-0 flex-1 truncate font-medium text-navy-900 hover:text-gold-700"
                          >
                            {d.title || d.typology}
                          </Link>
                          <span className="font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
                            {emails[d.user_id] ?? "—"} · {fmt(d.created_at)} ·{" "}
                            {STATUS_LABELS[d.status] ?? d.status}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              )}

              {section === "clients" && (
                <div className="mt-8 space-y-3">
                  {profiles.filter(matchProfile).map((p) => {
                    const clientDossiers = activeDossiers.filter((d) => d.user_id === p.id);
                    const clientNotes = notes.filter((n) => n.target_user_id === p.id);
                    const open = clientOpen === p.id;
                    const email = emails[p.id];
                    return (
                      <Card key={p.id}>
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-navy-900">
                              {p.full_name || p.company_name || email || p.id.slice(0, 8)}
                              {p.company_name && p.full_name ? ` · ${p.company_name}` : ""}
                            </p>
                            <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
                              {email ?? "e-mail indisponible"} · inscrit le {fmt(p.created_at)} ·{" "}
                              {clientDossiers.length} dossier{clientDossiers.length > 1 ? "s" : ""}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {email && (
                              <button
                                type="button"
                                onClick={() => sendReset(email, p.id)}
                                className="rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-cream-100"
                              >
                                Réinitialiser le mot de passe
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setClientOpen(open ? null : p.id)}
                              aria-expanded={open}
                              className="rounded-full bg-navy-900 px-3 py-1.5 text-xs font-semibold text-cream-50 hover:bg-navy-800"
                            >
                              {open ? "Fermer" : "Détail"}
                            </button>
                          </div>
                        </div>
                        {open && (
                          <div className="mt-4 border-t hairline pt-4">
                            <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">
                              Dossiers (vue client via l'espace normal)
                            </p>
                            <ul className="mt-2 space-y-1.5">
                              {clientDossiers.length === 0 && (
                                <li className="text-sm text-slate-500">Aucun dossier actif.</li>
                              )}
                              {clientDossiers.map((d) => (
                                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                  <Link
                                    to={`/compte/dossier/${d.id}`}
                                    className="min-w-0 flex-1 truncate text-navy-900 hover:text-gold-700"
                                  >
                                    {d.title || d.typology}
                                  </Link>
                                  <span className="font-mono text-[0.62rem] text-slate-500">
                                    {STATUS_LABELS[d.status] ?? d.status}
                                  </span>
                                </li>
                              ))}
                            </ul>
                            {caps.notes && (
                              <div className="mt-4">
                                <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-slate-500">
                                  Notes internes (jamais visibles par le client)
                                </p>
                                <ul className="mt-2 space-y-1.5">
                                  {clientNotes.map((n) => (
                                    <li key={n.id} className="rounded-lg bg-cream-50 px-3 py-2 text-sm text-navy-900">
                                      <span className="font-mono text-[0.6rem] text-slate-500">{fmt(n.created_at)}</span>{" "}
                                      {n.body}
                                    </li>
                                  ))}
                                </ul>
                                <form
                                  className="mt-2 flex gap-2"
                                  onSubmit={(e) => {
                                    e.preventDefault();
                                    void addNote(p.id);
                                  }}
                                >
                                  <input
                                    value={noteDraft}
                                    onChange={(e) => setNoteDraft(e.target.value)}
                                    placeholder="Ajouter une note interne…"
                                    aria-label="Note interne"
                                    className="flex-1 rounded-full border hairline-strong bg-white px-4 py-2 text-sm"
                                  />
                                  <button
                                    type="submit"
                                    className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 hover:bg-navy-800"
                                  >
                                    Noter
                                  </button>
                                </form>
                              </div>
                            )}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              )}

              {section === "dossiers" && (
                <div className="mt-8 space-y-2">
                  {activeDossiers.filter(matchDossier).map((d) => (
                    <Card key={d.id} className="!p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <Link
                            to={`/compte/dossier/${d.id}`}
                            className="block truncate font-medium text-navy-900 hover:text-gold-700"
                          >
                            {d.title || d.typology}
                          </Link>
                          <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
                            {emails[d.user_id] ?? d.user_id.slice(0, 8)} · {fmt(d.created_at)} ·{" "}
                            {docs.filter((x) => x.dossier_id === d.id && !x.deleted_at).length} doc.
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <label className="sr-only" htmlFor={`st-${d.id}`}>
                            Statut du dossier
                          </label>
                          <select
                            id={`st-${d.id}`}
                            value={d.status}
                            onChange={(e) => changeStatus(d, e.target.value)}
                            className="rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs text-navy-900"
                          >
                            {Object.entries(STATUS_LABELS).map(([v, l]) => (
                              <option key={v} value={v}>
                                {l}
                              </option>
                            ))}
                          </select>
                          {caps.trash && (
                            <button
                              type="button"
                              onClick={() => trashDossier(d)}
                              className="rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-cream-100"
                            >
                              Corbeille
                            </button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {section === "corbeille" && (
                <div className="mt-8 space-y-6">
                  {!caps.trash && (
                    <Card>
                      <p className="text-sm text-slate-500">
                        La corbeille s'active après application des migrations (voir TODO_ADMIN.md).
                      </p>
                    </Card>
                  )}
                  {caps.trash && (
                    <Card>
                      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                        Dossiers ({trashedDossiers.length})
                      </p>
                      <ul className="mt-3 space-y-2">
                        {trashedDossiers.length === 0 && (
                          <li className="text-sm text-slate-500">Aucun dossier dans la corbeille.</li>
                        )}
                        {trashedDossiers.map((d) => (
                          <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-navy-900">{d.title || d.typology}</p>
                              <p className="mt-0.5 font-mono text-[0.62rem] text-slate-500">
                                {emails[d.user_id] ?? "—"} · supprimé le {d.deleted_at ? fmt(d.deleted_at) : "—"}
                                {d.delete_reason ? ` · ${d.delete_reason}` : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => restoreDossier(d)} className="text-xs font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-700">
                                Restaurer
                              </button>
                              {superAdmin && (
                                <button type="button" onClick={() => hardDeleteDossier(d)} className="text-xs font-medium text-red-600 hover:text-red-700">
                                  Supprimer définitivement
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                  {caps.docExtras && (
                    <Card>
                      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                        Documents ({trashedDocs.length})
                      </p>
                      <ul className="mt-3 space-y-2">
                        {trashedDocs.length === 0 && (
                          <li className="text-sm text-slate-500">Aucun document dans la corbeille.</li>
                        )}
                        {trashedDocs.map((doc) => (
                          <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm">
                            <span className="min-w-0 flex-1 truncate text-navy-900">{doc.file_name}</span>
                            <div className="flex items-center gap-3">
                              <button type="button" onClick={() => restoreDoc(doc)} className="text-xs font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-700">
                                Restaurer
                              </button>
                              {superAdmin && (
                                <button type="button" onClick={() => hardDeleteDoc(doc)} className="text-xs font-medium text-red-600 hover:text-red-700">
                                  Supprimer définitivement
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </Card>
                  )}
                </div>
              )}

              {section === "activite" && (
                <Card className="mt-8">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                    Journal d'audit admin (non effaçable depuis l'interface)
                  </p>
                  {!caps.audit ? (
                    <p className="mt-3 text-sm text-slate-500">
                      Le journal s'active après application de la migration super admin.
                    </p>
                  ) : audit.length === 0 ? (
                    <p className="mt-3 text-sm text-slate-500">Aucune action enregistrée.</p>
                  ) : (
                    <ul className="mt-4 space-y-1.5">
                      {audit.map((a) => (
                        <li key={a.id} className="flex flex-wrap items-baseline gap-3 text-sm">
                          <span className="font-mono text-[0.65rem] text-slate-500">
                            {new Date(a.created_at).toLocaleString("fr-FR")}
                          </span>
                          <span className="text-navy-900">
                            {a.action.replaceAll("_", " ")} · {a.resource_type}
                            {a.target_user_id ? ` · ${emails[a.target_user_id] ?? a.target_user_id.slice(0, 8)}` : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              )}

              {section === "abonnements" && (
                <Card className="mt-8">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                    Abonnements
                  </p>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-500">
                    Les paiements passent par des Stripe Payment Links : <strong className="text-navy-900">Stripe est la source de vérité financière</strong>. Aucune donnée d'abonnement n'est
                    répliquée dans la base ClairDossier aujourd'hui — rien n'est donc affiché ici
                    pour ne pas montrer d'information invérifiable. Gérez clients, factures,
                    remboursements et résiliations directement dans le dashboard Stripe.
                  </p>
                  <a
                    href="https://dashboard.stripe.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-cream-50 hover:bg-navy-800"
                  >
                    Ouvrir le dashboard Stripe ↗
                  </a>
                </Card>
              )}

              {section === "diagnostic" && (
                <div className="mt-8 space-y-4">
                  {[
                    {
                      label: "Documents rattachés à un dossier introuvable",
                      items: diagnostics.docsSansDossier.map((d) => `${d.file_name} (${d.id.slice(0, 8)})`),
                      grave: true,
                    },
                    {
                      label: "Dossiers dont le propriétaire n'a pas de profil",
                      items: diagnostics.dossiersSansProfil.map((d) => `${d.title || d.typology} (${d.id.slice(0, 8)})`),
                      grave: true,
                    },
                    {
                      label: "Titres génériques (à renommer avec le client)",
                      items: diagnostics.titresGeneriques.map((d) => `${d.title} (${emails[d.user_id] ?? d.id.slice(0, 8)})`),
                      grave: false,
                    },
                    {
                      label: "Dossiers sans titre",
                      items: diagnostics.dossiersSansTitre.map((d) => `${d.typology} (${d.id.slice(0, 8)})`),
                      grave: false,
                    },
                    {
                      label: "Pièces non classées (« Autres »)",
                      items: diagnostics.docsNonClasses.slice(0, 20).map((d) => d.file_name),
                      grave: false,
                    },
                  ].map((diag) => (
                    <Card key={diag.label}>
                      <p className={`text-sm font-medium ${diag.grave && diag.items.length ? "text-red-600" : "text-navy-900"}`}>
                        {diag.label} — {diag.items.length}
                      </p>
                      {diag.items.length > 0 && (
                        <ul className="mt-2 space-y-1 text-sm text-slate-500">
                          {diag.items.slice(0, 10).map((i) => (
                            <li key={i} className="truncate">
                              {i}
                            </li>
                          ))}
                          {diag.items.length > 10 && <li>… et {diag.items.length - 10} de plus.</li>}
                        </ul>
                      )}
                    </Card>
                  ))}
                  <p className="text-xs leading-relaxed text-slate-500">
                    Aucune correction automatique : chaque anomalie se corrige depuis la fiche
                    concernée (aucun cas ambigu n'est modifié sans votre décision). La comparaison
                    Storage ↔ base fichier par fichier et la synchronisation Stripe nécessitent un
                    accès serveur — voir TODO_ADMIN.md.
                  </p>
                </div>
              )}

              {/* Documents en recherche globale */}
              {q && section !== "corbeille" && (
                <Card className="mt-6">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                    Documents correspondants
                  </p>
                  <ul className="mt-3 space-y-2">
                    {activeDocs.filter(matchDoc).slice(0, 15).map((doc) => (
                      <li key={doc.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-navy-900">{doc.file_name}</p>
                          <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
                            {caps.docExtras ? `${CATEGORY_LABELS[effectiveCategory(doc.file_name, doc.category)]} · ` : ""}
                            {emails[doc.user_id] ?? "—"} · {fmt(doc.created_at)} · {formatBytes(doc.size_bytes)}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button type="button" onClick={() => openDoc(doc)} className="text-xs font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-700">
                            Visualiser
                          </button>
                          <Link to={`/compte/dossier/${doc.dossier_id}`} className="text-xs font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-700">
                            Ouvrir le dossier
                          </Link>
                          {caps.docExtras && (
                            <button type="button" onClick={() => trashDoc(doc)} className="text-xs font-medium text-slate-500 hover:text-navy-900">
                              Corbeille
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}
