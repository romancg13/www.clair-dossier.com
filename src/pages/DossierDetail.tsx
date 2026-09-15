import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { zipSync } from "fflate";
import { Seo } from "../lib/seo";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { ArrowRightIcon, CheckIcon } from "../components/icons";
import { hasDossierTrash } from "../lib/admin";
import {
  ACCEPT_ATTR,
  CATEGORY_LABELS,
  PIECE_CATEGORIES,
  deadlineStatus,
  effectiveCategory,
  formatBytes,
  hasDeadlines,
  hasDocExtras,
  hasEvents,
  isGenericTitle,
  logDossierEvent,
  sanitizeFileName,
  validateUpload,
  duplicateWarning,
} from "../lib/dossier-workspace";

type DossierRow = {
  id: string;
  user_id: string;
  typology: string;
  title: string | null;
  status: string;
  answers: Record<string, string> | null;
  legal_review_requested: boolean;
  created_at: string;
};

type DocumentRow = {
  id: string;
  file_name: string;
  file_path: string;
  kind: string; // 'piece' (déposée par le client) | 'deliverable' (livrée par ClairDossier)
  size_bytes: number | null;
  created_at: string;
  category: string | null;
  deleted_at: string | null;
};

type DeadlineRow = {
  id: string;
  title: string;
  description: string | null;
  due_date: string;
  due_time: string | null;
  priority: "haute" | "normale" | "basse";
  done: boolean;
};

type EventRow = { id: string; label: string; created_at: string };

const STATUS_LABELS: Record<string, string> = {
  brouillon: "Brouillon",
  transmis: "Transmis",
  "en-cours": "En cours",
  valide: "Validé",
  archive: "Archivé",
};

const TYPOLOGY_LABELS: Record<string, string> = {
  // Catégories actuelles (tunnel de création — profils PME / artisans / indépendants).
  "dossier-client": "Dossier client",
  "facture-paiement": "Facture / paiement",
  "impaye-precontentieux": "Impayé / pré-contentieux",
  administratif: "Dossier administratif",
  comptable: "Documents comptables",
  rh: "Personnel / RH",
  autre: "Autre",
  // Anciennes typologies — conservées pour les dossiers déjà enregistrés.
  "litige-commercial": "Litige commercial",
  recouvrement: "Recouvrement",
  bail: "Bail & immobilier",
  consommation: "Litige client / fournisseur",
  "prud-hommes": "Prud'hommes",
  divorce: "Divorce / famille",
  succession: "Succession",
};

// Avancement du dossier — 5 étapes métier (étapes cliquables + message dynamique).
const TIMELINE = [
  "Création du dossier",
  "Devis, contrat ou accord",
  "Suivi du dossier",
  "Facture et paiement",
  "Option impayé / pré-contentieux",
];

const STEP_PANELS: string[] = [
  "Le dossier est créé : profil, nature, informations clés et premières pièces sont réunis dans un espace unique.",
  "Les documents qui fondent la relation (devis, contrat, bon de commande, accord) sont rassemblés et datés.",
  "Le dossier vit : échanges, relances, pièces complémentaires et échéances sont suivis au même endroit.",
  "La facturation et les règlements sont tracés : montants, échéances, acomptes et solde restant dû.",
  "En cas d'impayé, le dossier est prêt : relances, mise en demeure et pièces sont organisées pour être transmises à un professionnel habilité.",
];

const STEP_MESSAGES: Record<number, string> = {
  1: "Votre dossier vient d'être créé. Complétez les informations et déposez vos pièces pour le structurer.",
  2: "Rassemblez les documents qui fondent l'accord (devis, contrat, commande) pour sécuriser la suite.",
  3: "Votre dossier est suivi. Ajoutez les nouveaux échanges et pièces au fur et à mesure.",
  4: "Suivez la facturation et les règlements : renseignez les montants et les échéances de paiement.",
  5: "Le dossier est prêt à être transmis à un professionnel du droit en cas de contentieux.",
};

const STEP_NEXT_ACTIONS: Record<number, string> = {
  1: "Vérifiez les informations du dossier et déposez les premières pièces.",
  2: "Ajoutez le devis, le contrat ou l’accord signé au dossier.",
  3: "Mettez à jour le suivi : nouveaux courriers, relances, pièces reçues.",
  4: "Renseignez la facture, le montant dû et l’échéance de paiement.",
  5: "Préparez la transmission à un professionnel habilité si le litige persiste.",
};

// Statut ≠ étape : le statut est l'état général, l'étape la position workflow.
function currentStep(status: string): number {
  switch (status) {
    case "brouillon":
      return 1;
    case "transmis":
    case "en-cours":
      return 3;
    case "valide":
      return 4;
    case "archive":
      return 5;
    default:
      return 1;
  }
}

const ANSWER_LABELS: Record<string, string> = {
  counterparty: "Partie adverse",
  contractDate: "Date du contrat",
  amount: "Montant en jeu",
  deadline: "Échéance",
  situation: "Situation",
  debtor: "Débiteur",
  invoiceDate: "Date de la facture",
  organisme: "Organisme concerné",
  refDossier: "Référence du dossier",
  role: "Rôle",
  address: "Adresse du local",
  startDate: "Date d'entrée dans les lieux",
  merchant: "Vendeur / prestataire / client",
  purchaseDate: "Date d'achat ou de souscription",
  employer: "Nom de l'employeur",
  contractStart: "Date d'embauche",
  ruptureDate: "Date de la rupture",
  marriageDate: "Date du mariage",
  separationDate: "Date de séparation",
  children: "Nombre d'enfants concernés",
  deathDate: "Date du décès",
  heirCount: "Nombre d'héritiers connus",
};

function labelFor(key: string): string {
  return ANSWER_LABELS[key] ?? key;
}

function isDateKey(key: string): boolean {
  return /date|deadline|echeance|échéance/i.test(key);
}

function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
  if (!withTime) return date;
  return `${date} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function fmtShort(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const DOC_COLS_BASE = "id,file_name,file_path,kind,size_bytes,created_at";

type TabId = "apercu" | "pieces" | "echeances" | "dashboard" | "activite";

/* ── Ligne document : nom + méta, actions sobres, menu ••• ─────────────── */
function DocRow({
  doc,
  viewHref,
  selected,
  onToggleSelect,
  onRename,
  onRecategorize,
  onTrash,
  onDelete,
  busy,
  showCategory = true,
}: {
  doc: DocumentRow;
  viewHref?: string;
  selected?: boolean;
  onToggleSelect?: () => void;
  onRename?: () => void;
  onRecategorize?: (cat: string) => void;
  onTrash?: () => void;
  onDelete?: () => void;
  busy?: boolean;
  showCategory?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const dlHref = viewHref
    ? `${viewHref}${viewHref.includes("?") ? "&" : "?"}download=${encodeURIComponent(doc.file_name)}`
    : undefined;
  const isDeliverable = doc.kind === "deliverable";
  const ext = doc.file_name.split(".").pop()?.toUpperCase() ?? "";
  const cat = effectiveCategory(doc.file_name, doc.category);
  const hasMenu = Boolean(onRename || onRecategorize || onTrash || onDelete);

  return (
    <li
      className={`rounded-xl border px-4 py-3 text-sm ${
        isDeliverable ? "hairline-gold bg-gold-500/5" : "hairline bg-cream-50"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={Boolean(selected)}
            onChange={onToggleSelect}
            aria-label={`Sélectionner ${doc.file_name}`}
            className="h-5 w-5 shrink-0 accent-[#0d1b3d]"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-navy-900">{doc.file_name}</p>
          <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
            {showCategory && !isDeliverable ? `${CATEGORY_LABELS[cat]} · ` : ""}
            {fmtShort(doc.created_at)}
            {ext ? ` · ${ext}` : ""}
            {doc.size_bytes ? ` · ${formatBytes(doc.size_bytes)}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {viewHref ? (
            <>
              <a
                href={viewHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[40px] items-center font-medium text-navy-900 border-b hairline-gold transition-colors hover:text-gold-700"
              >
                Visualiser
              </a>
              <a
                href={dlHref}
                className="inline-flex min-h-[40px] items-center font-medium text-navy-900 border-b hairline-gold transition-colors hover:text-gold-700"
              >
                Télécharger
              </a>
            </>
          ) : (
            <span className="text-xs text-slate-500">Lien indisponible</span>
          )}
          {hasMenu && (
            <button
              type="button"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-label={`Autres actions pour ${doc.file_name}`}
              disabled={busy}
              className="grid min-h-[40px] min-w-[40px] place-items-center rounded-full px-2 font-semibold text-slate-500 transition-colors hover:bg-cream-100 hover:text-navy-900 disabled:opacity-50"
            >
              •••
            </button>
          )}
        </div>
      </div>
      {menuOpen && hasMenu && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t hairline pt-3">
          {onRename && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRename();
              }}
              className="rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs font-medium text-navy-900 transition-colors hover:bg-cream-100"
            >
              Renommer
            </button>
          )}
          {onRecategorize && (
            <label className="inline-flex items-center gap-2 text-xs text-slate-500">
              Catégorie
              <select
                value={cat}
                onChange={(e) => {
                  setMenuOpen(false);
                  onRecategorize(e.target.value);
                }}
                className="rounded-lg border hairline-strong bg-white px-2 py-1.5 text-xs text-navy-900"
              >
                {PIECE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {onTrash && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onTrash();
              }}
              className="rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs font-medium text-navy-900 transition-colors hover:bg-cream-100"
            >
              Mettre à la corbeille
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onDelete();
              }}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Supprimer définitivement
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function DossierDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [dossier, setDossier] = useState<DossierRow | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [links, setLinks] = useState<Record<string, string>>({});
  const [isAdmin, setIsAdmin] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openStep, setOpenStep] = useState(0);
  const [delivering, setDelivering] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("apercu");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Capacités (migration gestion documentaire appliquée ou non).
  const [docExtras, setDocExtras] = useState(false);
  const [deadlinesOn, setDeadlinesOn] = useState(false);
  const [eventsOn, setEventsOn] = useState(false);

  // Renommage du dossier (inline).
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  // Pièces : recherche, filtre catégorie, tri, sélection, corbeille, upload.
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("tous");
  const [sortBy, setSortBy] = useState<"recent" | "ancien" | "nom">("recent");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [trashOpen, setTrashOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Échéances.
  const [deadlines, setDeadlines] = useState<DeadlineRow[]>([]);
  const [dlTitle, setDlTitle] = useState("");
  const [dlDate, setDlDate] = useState("");
  const [dlTime, setDlTime] = useState("");
  const [dlPriority, setDlPriority] = useState<DeadlineRow["priority"]>("normale");
  const [dlDescription, setDlDescription] = useState("");
  const [dlSaving, setDlSaving] = useState(false);
  const [dlEditing, setDlEditing] = useState<string | null>(null);

  // Activité.
  const [events, setEvents] = useState<EventRow[]>([]);

  const ownerId = dossier?.user_id ?? null;

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      const [extras, dlOk, evOk] = await Promise.all([hasDocExtras(), hasDeadlines(), hasEvents()]);
      if (!active) return;
      setDocExtras(extras);
      setDeadlinesOn(dlOk);
      setEventsOn(evOk);

      // La RLS limite déjà la lecture au propriétaire — le filtre id suffit.
      const trashAware = await hasDossierTrash();
      const { data } = await supabase
        .from("dossiers")
        .select(
          `id,user_id,typology,title,status,answers,legal_review_requested,created_at${trashAware ? ",deleted_at" : ""}`,
        )
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      let row = (data as (DossierRow & { deleted_at?: string | null }) | null) ?? null;

      const { data: adminFlag } = await supabase.rpc("is_admin");
      const admin = adminFlag === true;
      // Dossier en corbeille : invisible pour le client (l'admin le gère depuis /admin).
      if (row?.deleted_at && !admin) row = null;
      setDossier(row);
      if (!active) return;
      setIsAdmin(admin);
      if (admin && row) {
        if (row.user_id === user?.id) {
          setOwnerEmail(user?.email ?? null);
        } else {
          const { data: em } = await supabase.rpc("admin_user_emails");
          const found = (em as { id: string; email: string }[] | null)?.find(
            (e) => e.id === row.user_id,
          );
          if (!active) return;
          setOwnerEmail(found?.email ?? null);
        }
      }

      if (row) {
        await Promise.all([
          reloadDocuments(row.id, extras, (v) => {
            if (active) {
              setDocuments(v.docs);
              setLinks(v.links);
            }
          }),
          dlOk ? reloadDeadlines(row.id, (v) => active && setDeadlines(v)) : Promise.resolve(),
          evOk ? reloadEvents(row.id, (v) => active && setEvents(v)) : Promise.resolve(),
        ]);
      }
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function reloadDocuments(
    dossierId: string,
    extras: boolean,
    apply: (v: { docs: DocumentRow[]; links: Record<string, string> }) => void,
  ) {
    const cols = extras ? `${DOC_COLS_BASE},category,deleted_at` : DOC_COLS_BASE;
    const { data: docs } = await supabase
      .from("dossier_documents")
      .select(cols)
      .eq("dossier_id", dossierId)
      .order("created_at", { ascending: true });
    const raw = (docs as unknown as Partial<DocumentRow>[] | null) ?? [];
    const list: DocumentRow[] = raw.map((d) => ({
      id: d.id as string,
      file_name: d.file_name as string,
      file_path: d.file_path as string,
      kind: (d.kind as string) ?? "piece",
      size_bytes: d.size_bytes ?? null,
      created_at: (d.created_at as string) ?? new Date(0).toISOString(),
      category: d.category ?? null,
      deleted_at: d.deleted_at ?? null,
    }));
    const signed: Record<string, string> = {};
    await Promise.all(
      list.map(async (doc) => {
        const { data: url } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.file_path, 3600);
        if (url?.signedUrl) signed[doc.id] = url.signedUrl;
      }),
    );
    apply({ docs: list, links: signed });
  }

  async function reloadDeadlines(dossierId: string, apply: (v: DeadlineRow[]) => void) {
    const { data } = await supabase
      .from("dossier_deadlines")
      .select("id,title,description,due_date,due_time,priority,done")
      .eq("dossier_id", dossierId)
      .order("due_date", { ascending: true });
    apply((data as DeadlineRow[] | null) ?? []);
  }

  async function reloadEvents(dossierId: string, apply: (v: EventRow[]) => void) {
    const { data } = await supabase
      .from("dossier_events")
      .select("id,label,created_at")
      .eq("dossier_id", dossierId)
      .order("created_at", { ascending: false })
      .limit(200);
    apply((data as EventRow[] | null) ?? []);
  }

  async function refreshDocs() {
    if (!dossier) return;
    await reloadDocuments(dossier.id, docExtras, (v) => {
      setDocuments(v.docs);
      setLinks(v.links);
    });
  }

  async function refreshEvents() {
    if (dossier && eventsOn) await reloadEvents(dossier.id, setEvents);
  }

  const answers = dossier?.answers ?? {};
  const answerEntries = Object.entries(answers).filter(([, v]) => v?.trim());
  const dateEntries = answerEntries.filter(([k]) => isDateKey(k));
  const situation = answers.situation?.trim();
  const step = dossier ? currentStep(dossier.status) : 1;
  const shownStep = openStep || step;

  const pieces = documents.filter((d) => d.kind !== "deliverable" && !d.deleted_at);
  const trashed = documents.filter((d) => d.kind !== "deliverable" && Boolean(d.deleted_at));
  const deliverables = documents.filter((d) => d.kind === "deliverable" && !d.deleted_at);

  const openDeadlines = deadlines.filter((d) => !d.done);
  const nextDeadline = openDeadlines
    .slice()
    .sort((a, b) => a.due_date.localeCompare(b.due_date))[0];

  const lastActivity = useMemo(() => {
    const times = [
      ...(dossier ? [dossier.created_at] : []),
      ...documents.map((d) => d.created_at),
      ...events.map((e) => e.created_at),
    ]
      .map((t) => new Date(t).getTime())
      .filter((t) => Number.isFinite(t) && t > 0);
    return times.length ? new Date(Math.max(...times)).toISOString() : null;
  }, [dossier, documents, events]);

  const genericTitle = isGenericTitle(dossier?.title);
  const displayTitle = genericTitle
    ? dossier?.title?.trim() || TYPOLOGY_LABELS[dossier?.typology ?? ""] || "Dossier sans nom"
    : (dossier?.title as string);

  /* ── Pièces : liste filtrée / triée / groupée ─────────────────────────── */
  const filteredPieces = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = pieces;
    if (q) {
      list = list.filter(
        (d) =>
          d.file_name.toLowerCase().includes(q) ||
          CATEGORY_LABELS[effectiveCategory(d.file_name, d.category)].toLowerCase().includes(q),
      );
    }
    if (catFilter !== "tous") {
      list = list.filter((d) => effectiveCategory(d.file_name, d.category) === catFilter);
    }
    const sorted = list.slice();
    if (sortBy === "recent") sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
    if (sortBy === "ancien") sorted.sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (sortBy === "nom") sorted.sort((a, b) => a.file_name.localeCompare(b.file_name, "fr"));
    return sorted;
  }, [pieces, search, catFilter, sortBy]);

  const groupedPieces = useMemo(() => {
    const groups = new Map<string, DocumentRow[]>();
    for (const d of filteredPieces) {
      const c = effectiveCategory(d.file_name, d.category);
      if (!groups.has(c)) groups.set(c, []);
      groups.get(c)!.push(d);
    }
    return PIECE_CATEGORIES.filter((c) => groups.has(c.id)).map((c) => ({
      id: c.id,
      label: c.label,
      docs: groups.get(c.id)!,
    }));
  }, [filteredPieces]);

  const grouping = !search.trim() && catFilter === "tous";

  /* ── Actions ──────────────────────────────────────────────────────────── */

  async function handleRenameDossier() {
    if (!dossier || !user) return;
    const value = renameValue.trim();
    if (!value) return;
    setActionError(null);
    const { error } = await supabase
      .from("dossiers")
      .update({ title: value, updated_at: new Date().toISOString() })
      .eq("id", dossier.id);
    if (error) {
      setActionError("Le renommage a échoué. Réessayez.");
      return;
    }
    setDossier({ ...dossier, title: value });
    setRenaming(false);
    void logDossierEvent(dossier.id, user.id, "dossier_renomme", `« ${value} »`).then(refreshEvents);
  }

  async function handleUpload(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !dossier || !user || !ownerId) return;
    setActionError(null);
    const files = Array.from(fileList);
    for (const f of files) {
      const err = validateUpload(f);
      if (err) {
        setActionError(err);
        return;
      }
    }
    // Doublons : avertir, jamais bloquer (§ le client peut ajouter quand même).
    for (const f of files) {
      const warn = duplicateWarning(f, documents.filter((d) => d.kind !== "deliverable"));
      if (warn && !window.confirm(`${warn}\n\nAjouter quand même ?`)) return;
    }
    setUploading(true);
    try {
      for (const file of files) {
        const path = `${ownerId}/${dossier.id}/${Date.now()}-${sanitizeFileName(file.name)}`;
        const up = await supabase.storage.from("documents").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        const ins = await supabase.from("dossier_documents").insert({
          dossier_id: dossier.id,
          user_id: ownerId,
          file_path: path,
          file_name: file.name,
          size_bytes: file.size,
          kind: "piece",
        });
        if (ins.error) throw ins.error;
      }
      await refreshDocs();
      setActiveTab("pieces");
    } catch {
      setActionError("Le dépôt a échoué. Vérifiez votre connexion puis réessayez.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRenameDoc(doc: DocumentRow) {
    if (!dossier || !user) return;
    const next = window.prompt("Nouveau nom du document :", doc.file_name)?.trim();
    if (!next || next === doc.file_name) return;
    setBusyId(doc.id);
    const { error } = await supabase
      .from("dossier_documents")
      .update({ file_name: next })
      .eq("id", doc.id);
    setBusyId(null);
    if (error) {
      setActionError("Le renommage a échoué. Réessayez.");
      return;
    }
    await refreshDocs();
    void logDossierEvent(dossier.id, user.id, "document_renomme", `« ${next} »`).then(refreshEvents);
  }

  async function handleRecategorize(doc: DocumentRow, cat: string) {
    if (!dossier || !user) return;
    setBusyId(doc.id);
    const { error } = await supabase
      .from("dossier_documents")
      .update({ category: cat })
      .eq("id", doc.id);
    setBusyId(null);
    if (error) {
      setActionError("Le changement de catégorie a échoué. Réessayez.");
      return;
    }
    await refreshDocs();
    void logDossierEvent(
      dossier.id,
      user.id,
      "document_reclasse",
      `« ${doc.file_name} » → ${CATEGORY_LABELS[cat]}`,
    ).then(refreshEvents);
  }

  async function handleTrash(doc: DocumentRow) {
    if (!dossier || !user) return;
    if (!window.confirm(`Mettre « ${doc.file_name} » à la corbeille ? Vous pourrez le restaurer.`))
      return;
    setBusyId(doc.id);
    const { error } = await supabase
      .from("dossier_documents")
      .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
      .eq("id", doc.id);
    setBusyId(null);
    if (error) {
      setActionError("La mise à la corbeille a échoué. Réessayez.");
      return;
    }
    setSelectedIds((s) => {
      const n = new Set(s);
      n.delete(doc.id);
      return n;
    });
    await refreshDocs();
    void logDossierEvent(dossier.id, user.id, "document_corbeille", `« ${doc.file_name} »`).then(
      refreshEvents,
    );
  }

  async function handleRestore(doc: DocumentRow) {
    if (!dossier || !user) return;
    setBusyId(doc.id);
    const { error } = await supabase
      .from("dossier_documents")
      .update({ deleted_at: null, deleted_by: null })
      .eq("id", doc.id);
    setBusyId(null);
    if (error) {
      setActionError("La restauration a échoué. Réessayez.");
      return;
    }
    await refreshDocs();
    void logDossierEvent(dossier.id, user.id, "document_restaure", `« ${doc.file_name} »`).then(
      refreshEvents,
    );
  }

  // Suppression DÉFINITIVE (fichier storage + ligne). Réservée à la corbeille
  // (client) et aux livrables (admin) ; toujours confirmée.
  async function handleHardDelete(doc: DocumentRow) {
    if (!dossier || !user) return;
    if (!window.confirm(`Supprimer définitivement « ${doc.file_name} » ? Cette action est irréversible.`))
      return;
    setBusyId(doc.id);
    setActionError(null);
    try {
      await supabase.storage.from("documents").remove([doc.file_path]);
      const del = await supabase.from("dossier_documents").delete().eq("id", doc.id);
      if (del.error) throw del.error;
      await refreshDocs();
      void logDossierEvent(dossier.id, user.id, "document_supprime", `« ${doc.file_name} »`).then(
        refreshEvents,
      );
    } catch {
      setActionError("La suppression a échoué. Réessayez.");
    } finally {
      setBusyId(null);
    }
  }

  // Fallback historique (migration non appliquée) : suppression directe confirmée.
  async function handleLegacyDelete(doc: DocumentRow) {
    await handleHardDelete(doc);
  }

  async function downloadZip(docs: DocumentRow[], zipName: string) {
    if (docs.length === 0) return;
    setZipping(true);
    try {
      const entries: Record<string, Uint8Array> = {};
      const used = new Set<string>();
      for (const d of docs) {
        const href = links[d.id];
        if (!href) continue;
        const res = await fetch(href);
        if (!res.ok) continue;
        const buf = new Uint8Array(await res.arrayBuffer());
        let name = d.file_name || d.id;
        while (used.has(name)) name = `copie-${name}`;
        used.add(name);
        entries[name] = buf;
      }
      if (Object.keys(entries).length === 0) {
        setActionError("Téléchargement indisponible pour le moment.");
        return;
      }
      const zipped = zipSync(entries, { level: 0 });
      const blob = new Blob([zipped as BlobPart], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      if (dossier && user)
        void logDossierEvent(dossier.id, user.id, "telechargement_groupe", `${docs.length} pièce(s)`).then(
          refreshEvents,
        );
    } finally {
      setZipping(false);
    }
  }

  // Admin : livrer le travail au client (inchangé).
  async function handleDeliver(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !dossier) return;
    setActionError(null);
    setDelivering(true);
    try {
      for (const file of Array.from(fileList)) {
        const path = `${dossier.user_id}/${dossier.id}/deliverable-${Date.now()}-${sanitizeFileName(file.name)}`;
        const up = await supabase.storage.from("documents").upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        const ins = await supabase.from("dossier_documents").insert({
          dossier_id: dossier.id,
          user_id: dossier.user_id,
          file_path: path,
          file_name: file.name,
          size_bytes: file.size,
          kind: "deliverable",
        });
        if (ins.error) throw ins.error;
      }
      await refreshDocs();
    } catch {
      setActionError("L'envoi du livrable a échoué. Réessayez.");
    } finally {
      setDelivering(false);
    }
  }

  /* ── Échéances : CRUD ─────────────────────────────────────────────────── */

  function resetDeadlineForm() {
    setDlTitle("");
    setDlDate("");
    setDlTime("");
    setDlPriority("normale");
    setDlDescription("");
    setDlEditing(null);
  }

  async function handleSaveDeadline() {
    if (!dossier || !user || !dlTitle.trim() || !dlDate) return;
    setDlSaving(true);
    setActionError(null);
    const payload = {
      title: dlTitle.trim(),
      description: dlDescription.trim() || null,
      due_date: dlDate,
      due_time: dlTime || null,
      priority: dlPriority,
      updated_at: new Date().toISOString(),
    };
    const res = dlEditing
      ? await supabase.from("dossier_deadlines").update(payload).eq("id", dlEditing)
      : await supabase.from("dossier_deadlines").insert({
          ...payload,
          dossier_id: dossier.id,
          user_id: user.id,
        });
    setDlSaving(false);
    if (res.error) {
      setActionError("L'enregistrement de l'échéance a échoué. Réessayez.");
      return;
    }
    await reloadDeadlines(dossier.id, setDeadlines);
    void logDossierEvent(
      dossier.id,
      user.id,
      dlEditing ? "echeance_modifiee" : "echeance_creee",
      `« ${payload.title} » (${fmtShort(dlDate)})`,
    ).then(refreshEvents);
    resetDeadlineForm();
  }

  async function handleToggleDeadline(d: DeadlineRow) {
    if (!dossier || !user) return;
    const { error } = await supabase
      .from("dossier_deadlines")
      .update({ done: !d.done, updated_at: new Date().toISOString() })
      .eq("id", d.id);
    if (error) {
      setActionError("La mise à jour a échoué. Réessayez.");
      return;
    }
    await reloadDeadlines(dossier.id, setDeadlines);
    if (!d.done)
      void logDossierEvent(dossier.id, user.id, "echeance_terminee", `« ${d.title} »`).then(
        refreshEvents,
      );
  }

  async function handleDeleteDeadline(d: DeadlineRow) {
    if (!dossier || !user) return;
    if (!window.confirm(`Supprimer l'échéance « ${d.title} » ?`)) return;
    const { error } = await supabase.from("dossier_deadlines").delete().eq("id", d.id);
    if (error) {
      setActionError("La suppression a échoué. Réessayez.");
      return;
    }
    await reloadDeadlines(dossier.id, setDeadlines);
    void logDossierEvent(dossier.id, user.id, "echeance_supprimee", `« ${d.title} »`).then(
      refreshEvents,
    );
  }

  /* ── Activité : événements réels + repères synthétiques ───────────────── */
  const activityItems = useMemo(() => {
    const items: { key: string; label: string; at: string }[] = [];
    if (dossier) items.push({ key: "created", label: "Dossier créé", at: dossier.created_at });
    for (const d of documents) {
      items.push({
        key: `doc-${d.id}`,
        label:
          d.kind === "deliverable"
            ? `Travail livré par ClairDossier — « ${d.file_name} »`
            : `Document ajouté — « ${d.file_name} »`,
        at: d.created_at,
      });
    }
    for (const e of events) items.push({ key: `ev-${e.id}`, label: e.label, at: e.created_at });
    return items.sort((a, b) => b.at.localeCompare(a.at));
  }, [dossier, documents, events]);

  const activityGroups = useMemo(() => {
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();
    const groups: { label: string; items: typeof activityItems }[] = [];
    for (const item of activityItems) {
      const d = new Date(item.at).toDateString();
      const label = d === today ? "Aujourd’hui" : d === yesterday ? "Hier" : fmtDate(item.at);
      const last = groups[groups.length - 1];
      if (last && last.label === label) last.items.push(item);
      else groups.push({ label, items: [item] });
    }
    return groups;
  }, [activityItems]);

  const selectedDocs = filteredPieces.filter((d) => selectedIds.has(d.id));

  const TABS: { id: TabId; label: string }[] = [
    { id: "apercu", label: "Vue d'ensemble" },
    { id: "pieces", label: `Pièces${pieces.length ? ` (${pieces.length})` : ""}` },
    {
      id: "echeances",
      label: `Échéances${deadlinesOn && openDeadlines.length ? ` (${openDeadlines.length})` : ""}`,
    },
    {
      id: "dashboard",
      label: `DashBoard ClairDossier${deliverables.length ? ` (${deliverables.length})` : ""}`,
    },
    { id: "activite", label: "Activité" },
  ];

  return (
    <>
      <Seo
        title="Détail du dossier"
        description="Le détail de votre dossier ClairDossier."
        path="/compte"
        noindex
      />

      <section className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:px-12">
          <Link
            to="/compte"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-navy-900"
          >
            ← Retour à mes dossiers
          </Link>

          {loading ? (
            <p className="mt-10 text-sm text-slate-500">Chargement…</p>
          ) : !dossier ? (
            <div className="mt-8 rounded-2xl border hairline bg-white p-8 text-center shadow-card">
              <h1 className="font-display text-2xl font-semibold text-navy-900">
                Dossier introuvable
              </h1>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                Ce dossier n'existe pas ou ne fait pas partie de votre compte.
              </p>
              <Link
                to="/compte"
                className="sheen mt-7 inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
              >
                Revenir à mes dossiers
                <ArrowRightIcon width={14} height={14} strokeWidth={2} />
              </Link>
            </div>
          ) : (
            <>
              {/* ── En-tête : titre ≠ catégorie ───────────────────────── */}
              <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  {renaming ? (
                    <form
                      className="flex flex-wrap items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void handleRenameDossier();
                      }}
                    >
                      <label htmlFor="rename-dossier" className="sr-only">
                        Nom du dossier
                      </label>
                      <input
                        id="rename-dossier"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        autoFocus
                        maxLength={120}
                        className="w-72 max-w-full rounded-xl border hairline-strong bg-white px-4 py-2.5 font-display text-xl font-semibold text-navy-900"
                      />
                      <button
                        type="submit"
                        className="rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-navy-800"
                      >
                        Enregistrer
                      </button>
                      <button
                        type="button"
                        onClick={() => setRenaming(false)}
                        className="text-xs font-medium text-slate-500 hover:text-navy-900"
                      >
                        Annuler
                      </button>
                    </form>
                  ) : (
                    <h1 className="font-display text-4xl font-semibold leading-[1.05] text-navy-900">
                      {displayTitle}
                    </h1>
                  )}

                  <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                    {TYPOLOGY_LABELS[dossier.typology] ?? dossier.typology}
                    {" · "}Étape {step}/5 · {TIMELINE[step - 1]}
                  </p>
                  {isAdmin && (
                    <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-gold-700">
                      Propriétaire · {ownerEmail ?? `${dossier.user_id.slice(0, 8)}…`}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                    Créé le {fmtDate(dossier.created_at)}
                    {lastActivity && lastActivity !== dossier.created_at
                      ? ` · Dernière activité le ${fmtDate(lastActivity)}`
                      : ""}
                  </p>

                  {!renaming && (
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setRenameValue(genericTitle ? "" : (dossier.title ?? ""));
                          setRenaming(true);
                        }}
                        className="text-xs font-medium text-navy-900 border-b hairline-gold pb-0.5 transition-colors hover:text-gold-700"
                      >
                        Renommer le dossier
                      </button>
                      {genericTitle && (
                        <span className="text-xs text-slate-500">
                          Donnez-lui un nom parlant, ex. « Recouvrement — Société X ».
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <span className="rounded-full bg-gold-500/12 px-3 py-1.5 font-mono text-[0.7rem] font-medium text-navy-900 border hairline-gold">
                  {STATUS_LABELS[dossier.status] ?? dossier.status}
                </span>
              </div>

              {actionError && (
                <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {actionError}
                </p>
              )}

              {/* ── Onglets ───────────────────────────────────────────── */}
              <div className="mt-8 flex gap-1 overflow-x-auto whitespace-nowrap border-b hairline" role="tablist">
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`-mb-px shrink-0 rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                      activeTab === t.id
                        ? "border-b-2 border-gold-500 text-navy-900"
                        : "text-slate-500 hover:text-navy-900"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {activeTab === "apercu" && (
                <>
                  {/* Résumé express : comprendre le dossier en 5 secondes. */}
                  <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      { k: "Statut", v: STATUS_LABELS[dossier.status] ?? dossier.status },
                      { k: "Étape", v: `${step}/5 · ${TIMELINE[step - 1]}` },
                      { k: "Pièces", v: `${pieces.length} déposée${pieces.length > 1 ? "s" : ""}` },
                      {
                        k: "Prochaine échéance",
                        v: nextDeadline
                          ? `${fmtShort(`${nextDeadline.due_date}T00:00:00`)} · ${nextDeadline.title}`
                          : dateEntries[0]?.[1] ?? "Aucune",
                      },
                    ].map((c) => (
                      <div key={c.k} className="rounded-xl border hairline bg-white p-4">
                        <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
                          {c.k}
                        </p>
                        <p className="mt-1.5 truncate text-sm font-medium text-navy-900" title={c.v}>
                          {c.v}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Ce que vous devez faire maintenant + CTA contextuel. */}
                  <div className="mt-6 rounded-2xl border hairline-gold bg-gold-500/10 p-7 shadow-card sm:p-9">
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                      Ce que vous devez faire maintenant
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-navy-900">
                      {STEP_NEXT_ACTIONS[step]}
                    </p>
                    <button
                      type="button"
                      onClick={() => setActiveTab("pieces")}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-navy-800"
                    >
                      Ajouter des pièces
                      <ArrowRightIcon width={14} height={14} strokeWidth={2} />
                    </button>
                  </div>

                  {/* Avancement du dossier (timeline conservée). */}
                  <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                      Avancement du dossier
                    </p>

                    <ol className="mt-7 space-y-3 sm:space-y-0 sm:flex sm:items-start sm:gap-2">
                      {TIMELINE.map((label, i) => {
                        const n = i + 1;
                        const done = step > n;
                        const active = step === n;
                        const selected = shownStep === n;
                        return (
                          <li key={label} className="sm:flex-1">
                            <button
                              type="button"
                              onClick={() => setOpenStep(n)}
                              aria-expanded={selected}
                              aria-label={`Étape ${n} : ${label}${active ? " (étape en cours)" : ""}`}
                              className={`flex w-full items-start gap-3 rounded-xl p-2 text-left transition-colors hover:bg-cream-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/40 sm:flex-col sm:items-stretch ${
                                selected ? "bg-cream-100" : ""
                              }`}
                            >
                              <div className="flex items-center gap-3 sm:w-full">
                                <span
                                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[0.7rem] font-semibold transition-colors ${
                                    done || active
                                      ? "bg-navy-900 text-cream-50"
                                      : "border hairline-strong bg-white text-slate-500"
                                  }`}
                                >
                                  {done ? <CheckIcon width={12} height={12} strokeWidth={2.5} /> : n}
                                </span>
                                {i < TIMELINE.length - 1 && (
                                  <span
                                    className={`hidden h-px flex-1 transition-colors sm:block ${
                                      step > n ? "bg-navy-900" : "bg-slate-300/40"
                                    }`}
                                  />
                                )}
                              </div>
                              <p
                                className={`text-sm leading-snug sm:mt-3 ${
                                  done || active ? "font-medium text-navy-900" : "text-slate-500"
                                }`}
                              >
                                {label}
                                {active && (
                                  <span className="mt-0.5 block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-gold-700">
                                    En cours
                                  </span>
                                )}
                              </p>
                            </button>
                          </li>
                        );
                      })}
                    </ol>

                    <div className="mt-7 rounded-xl bg-cream-50 p-5">
                      <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                        Étape {shownStep} · {TIMELINE[shownStep - 1]}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-navy-900">
                        {STEP_PANELS[shownStep - 1]}
                      </p>
                    </div>

                    <p className="mt-5 border-t hairline pt-5 text-sm leading-relaxed text-slate-500">
                      {STEP_MESSAGES[step]}
                    </p>
                  </div>
                </>
              )}

              {activeTab === "pieces" && (
                <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                      Pièces du dossier · {pieces.length}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                      {pieces.length > 0 && (
                        <button
                          type="button"
                          onClick={() =>
                            downloadZip(pieces, `pieces-${dossier.title || dossier.id}.zip`)
                          }
                          disabled={zipping}
                          className="shrink-0 rounded-full border hairline-strong bg-white px-4 py-2 text-xs font-medium text-navy-900 transition-colors hover:bg-cream-100 disabled:opacity-60"
                        >
                          {zipping ? "Préparation…" : "Tout télécharger (.zip)"}
                        </button>
                      )}
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gold-500 px-4 py-2 text-xs font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5">
                        {uploading ? "Dépôt en cours…" : "Ajouter des pièces"}
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept={ACCEPT_ATTR}
                          className="hidden"
                          disabled={uploading}
                          onChange={(e) => {
                            void handleUpload(e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {pieces.length > 0 && (
                    <div className="mt-5 flex flex-wrap items-center gap-2">
                      <label htmlFor="piece-search" className="sr-only">
                        Rechercher un document
                      </label>
                      <input
                        id="piece-search"
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher un document…"
                        className="w-full sm:w-64 rounded-full border hairline-strong bg-cream-50 px-4 py-2 text-sm text-navy-900 placeholder:text-slate-500"
                      />
                      <label htmlFor="piece-sort" className="sr-only">
                        Trier les documents
                      </label>
                      <select
                        id="piece-sort"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="rounded-full border hairline-strong bg-cream-50 px-3 py-2 text-sm text-navy-900"
                      >
                        <option value="recent">Plus récentes</option>
                        <option value="ancien">Plus anciennes</option>
                        <option value="nom">Nom (A → Z)</option>
                      </select>
                      <select
                        aria-label="Filtrer par catégorie"
                        value={catFilter}
                        onChange={(e) => setCatFilter(e.target.value)}
                        className="rounded-full border hairline-strong bg-cream-50 px-3 py-2 text-sm text-navy-900"
                      >
                        <option value="tous">Toutes les catégories</option>
                        {PIECE_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedDocs.length > 0 && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl bg-cream-100 px-4 py-3 text-sm">
                      <span className="font-medium text-navy-900">
                        {selectedDocs.length} sélectionnée{selectedDocs.length > 1 ? "s" : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          downloadZip(selectedDocs, `selection-${dossier.title || dossier.id}.zip`)
                        }
                        disabled={zipping}
                        className="rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-cream-50 disabled:opacity-60"
                      >
                        Télécharger la sélection
                      </button>
                      {docExtras && (
                        <button
                          type="button"
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Mettre ${selectedDocs.length} pièce(s) à la corbeille ?`,
                              )
                            )
                              return;
                            for (const d of selectedDocs) {
                              await supabase
                                .from("dossier_documents")
                                .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id })
                                .eq("id", d.id);
                            }
                            setSelectedIds(new Set());
                            await refreshDocs();
                          }}
                          className="rounded-full border hairline-strong bg-white px-3 py-1.5 text-xs font-medium text-navy-900 hover:bg-cream-50"
                        >
                          Mettre à la corbeille
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setSelectedIds(new Set())}
                        className="text-xs font-medium text-slate-500 hover:text-navy-900"
                      >
                        Tout désélectionner
                      </button>
                    </div>
                  )}

                  {pieces.length === 0 ? (
                    <p className="mt-4 text-sm leading-relaxed text-slate-500">
                      Aucune pièce n'a encore été déposée sur ce dossier. Déposez vos premiers
                      documents avec « Ajouter des pièces ».
                    </p>
                  ) : grouping ? (
                    <div className="mt-5 space-y-3">
                      {groupedPieces.map((g) => (
                        <details key={g.id} open className="group rounded-xl border hairline">
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors hover:bg-cream-50">
                            <span className="text-sm font-medium text-navy-900">
                              {g.label} ({g.docs.length})
                            </span>
                            <span
                              aria-hidden="true"
                              className="text-slate-500 transition-transform group-open:rotate-90"
                            >
                              ›
                            </span>
                          </summary>
                          <ul className="space-y-2 px-3 pb-3">
                            {g.docs.map((doc) => (
                              <DocRow
                                key={doc.id}
                                doc={doc}
                                viewHref={links[doc.id]}
                                selected={selectedIds.has(doc.id)}
                                onToggleSelect={() =>
                                  setSelectedIds((s) => {
                                    const n = new Set(s);
                                    if (n.has(doc.id)) n.delete(doc.id);
                                    else n.add(doc.id);
                                    return n;
                                  })
                                }
                                onRename={docExtras ? () => handleRenameDoc(doc) : undefined}
                                onRecategorize={
                                  docExtras ? (c) => handleRecategorize(doc, c) : undefined
                                }
                                onTrash={docExtras ? () => handleTrash(doc) : undefined}
                                onDelete={!docExtras ? () => handleLegacyDelete(doc) : undefined}
                                busy={busyId === doc.id}
                                showCategory={false}
                              />
                            ))}
                          </ul>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <ul className="mt-5 space-y-2">
                      {filteredPieces.length === 0 ? (
                        <p className="text-sm text-slate-500">
                          Aucun document ne correspond à cette recherche.
                        </p>
                      ) : (
                        filteredPieces.map((doc) => (
                          <DocRow
                            key={doc.id}
                            doc={doc}
                            viewHref={links[doc.id]}
                            selected={selectedIds.has(doc.id)}
                            onToggleSelect={() =>
                              setSelectedIds((s) => {
                                const n = new Set(s);
                                if (n.has(doc.id)) n.delete(doc.id);
                                else n.add(doc.id);
                                return n;
                              })
                            }
                            onRename={docExtras ? () => handleRenameDoc(doc) : undefined}
                            onRecategorize={docExtras ? (c) => handleRecategorize(doc, c) : undefined}
                            onTrash={docExtras ? () => handleTrash(doc) : undefined}
                            onDelete={!docExtras ? () => handleLegacyDelete(doc) : undefined}
                            busy={busyId === doc.id}
                          />
                        ))
                      )}
                    </ul>
                  )}

                  {/* Corbeille (restaurable) — visible seulement si non vide. */}
                  {docExtras && trashed.length > 0 && (
                    <details
                      className="group mt-6 rounded-xl border hairline bg-cream-50"
                      open={trashOpen}
                      onToggle={(e) => setTrashOpen((e.target as HTMLDetailsElement).open)}
                    >
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                        <span className="text-sm font-medium text-slate-500">
                          Corbeille ({trashed.length})
                        </span>
                        <span
                          aria-hidden="true"
                          className="text-slate-500 transition-transform group-open:rotate-90"
                        >
                          ›
                        </span>
                      </summary>
                      <ul className="space-y-2 px-3 pb-3">
                        {trashed.map((doc) => (
                          <li
                            key={doc.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border hairline bg-white px-4 py-3 text-sm"
                          >
                            <span className="min-w-0 flex-1 truncate text-slate-500">
                              {doc.file_name}
                            </span>
                            <div className="flex shrink-0 items-center gap-3">
                              <button
                                type="button"
                                onClick={() => handleRestore(doc)}
                                disabled={busyId === doc.id}
                                className="text-xs font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-700 disabled:opacity-50"
                              >
                                Restaurer
                              </button>
                              <button
                                type="button"
                                onClick={() => handleHardDelete(doc)}
                                disabled={busyId === doc.id}
                                className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50"
                              >
                                Supprimer définitivement
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <p className="mt-5 border-t hairline pt-4 text-xs leading-relaxed text-slate-500">
                    Formats acceptés : PDF, JPG, PNG, WEBP, DOC, DOCX, TXT — 25 Mo maximum par
                    fichier. Le classement par catégorie est déduit du nom du fichier, sans aucune
                    lecture du contenu ; vous pouvez le corriger à tout moment.
                  </p>
                </div>
              )}

              {activeTab === "dashboard" && (
                <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                      DashBoard ClairDossier
                    </p>
                    {deliverables.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadZip(deliverables, `travail-${dossier.title || dossier.id}.zip`)
                        }
                        disabled={zipping}
                        className="shrink-0 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-60"
                      >
                        {zipping ? "Préparation…" : "Tout télécharger"}
                      </button>
                    )}
                  </div>

                  {deliverables.length === 0 ? (
                    <p className="mt-4 text-sm leading-relaxed text-slate-500">
                      {isAdmin
                        ? "Aucun livrable pour l'instant. Déposez le travail réalisé ci-dessous : le client y accédera depuis son espace."
                        : "Le travail réalisé par ClairDossier apparaîtra ici une fois livré."}
                    </p>
                  ) : (
                    <ul className="mt-5 space-y-2">
                      {deliverables.map((doc) => (
                        <DocRow
                          key={doc.id}
                          doc={doc}
                          viewHref={links[doc.id]}
                          onDelete={isAdmin ? () => handleHardDelete(doc) : undefined}
                          busy={busyId === doc.id}
                          showCategory={false}
                        />
                      ))}
                    </ul>
                  )}

                  {isAdmin && (
                    <div className="mt-6 border-t hairline pt-5">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5">
                        {delivering ? "Envoi…" : "Livrer le travail au client"}
                        {!delivering && <ArrowRightIcon width={14} height={14} strokeWidth={2} />}
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          disabled={delivering}
                          onChange={(e) => {
                            void handleDeliver(e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        Les fichiers déposés ici sont visibles et téléchargeables par le client
                        depuis son espace.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "echeances" && (
                <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                    Échéances & suivi
                  </p>

                  {deadlinesOn ? (
                    <>
                      {/* Ajout / modification d'une échéance. */}
                      <form
                        className="mt-5 grid gap-3 rounded-xl bg-cream-50 p-5 sm:grid-cols-2"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleSaveDeadline();
                        }}
                      >
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="dl-title"
                            className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500"
                          >
                            {dlEditing ? "Modifier l'échéance" : "Ajouter une échéance"}
                          </label>
                          <input
                            id="dl-title"
                            value={dlTitle}
                            onChange={(e) => setDlTitle(e.target.value)}
                            placeholder="Ex. Échéance de paiement, audience, fin de préavis…"
                            required
                            maxLength={140}
                            className="mt-1.5 w-full rounded-xl border hairline-strong bg-white px-4 py-2.5 text-sm text-navy-900 placeholder:text-slate-500"
                          />
                        </div>
                        <div>
                          <label
                            htmlFor="dl-date"
                            className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500"
                          >
                            Date
                          </label>
                          <input
                            id="dl-date"
                            type="date"
                            value={dlDate}
                            onChange={(e) => setDlDate(e.target.value)}
                            required
                            className="mt-1.5 w-full rounded-xl border hairline-strong bg-white px-4 py-2.5 text-sm text-navy-900"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label
                              htmlFor="dl-time"
                              className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500"
                            >
                              Heure (option)
                            </label>
                            <input
                              id="dl-time"
                              type="time"
                              value={dlTime}
                              onChange={(e) => setDlTime(e.target.value)}
                              className="mt-1.5 w-full rounded-xl border hairline-strong bg-white px-3 py-2.5 text-sm text-navy-900"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="dl-priority"
                              className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500"
                            >
                              Priorité
                            </label>
                            <select
                              id="dl-priority"
                              value={dlPriority}
                              onChange={(e) =>
                                setDlPriority(e.target.value as DeadlineRow["priority"])
                              }
                              className="mt-1.5 w-full rounded-xl border hairline-strong bg-white px-3 py-2.5 text-sm text-navy-900"
                            >
                              <option value="haute">Haute</option>
                              <option value="normale">Normale</option>
                              <option value="basse">Basse</option>
                            </select>
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label
                            htmlFor="dl-desc"
                            className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500"
                          >
                            Description (option)
                          </label>
                          <input
                            id="dl-desc"
                            value={dlDescription}
                            onChange={(e) => setDlDescription(e.target.value)}
                            maxLength={300}
                            className="mt-1.5 w-full rounded-xl border hairline-strong bg-white px-4 py-2.5 text-sm text-navy-900"
                          />
                        </div>
                        <div className="flex items-center gap-3 sm:col-span-2">
                          <button
                            type="submit"
                            disabled={dlSaving || !dlTitle.trim() || !dlDate}
                            className="rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-60"
                          >
                            {dlSaving
                              ? "Enregistrement…"
                              : dlEditing
                                ? "Enregistrer la modification"
                                : "Ajouter l'échéance"}
                          </button>
                          {dlEditing && (
                            <button
                              type="button"
                              onClick={resetDeadlineForm}
                              className="text-xs font-medium text-slate-500 hover:text-navy-900"
                            >
                              Annuler
                            </button>
                          )}
                        </div>
                      </form>

                      {deadlines.length === 0 ? (
                        <p className="mt-5 text-sm leading-relaxed text-slate-500">
                          Aucune échéance enregistrée. Ajoutez une date importante pour la garder
                          sous les yeux à chaque consultation du dossier.
                        </p>
                      ) : (
                        (["retard", "a-venir", "terminee"] as const).map((bucket) => {
                          const items = deadlines.filter(
                            (d) => deadlineStatus(d.due_date, d.done) === bucket,
                          );
                          if (items.length === 0) return null;
                          const titles = {
                            retard: "En retard",
                            "a-venir": "À venir",
                            terminee: "Terminées",
                          } as const;
                          return (
                            <div key={bucket} className="mt-6">
                              <p
                                className={`font-mono text-[0.65rem] uppercase tracking-[0.16em] ${
                                  bucket === "retard" ? "text-red-600" : "text-slate-500"
                                }`}
                              >
                                {titles[bucket]} ({items.length})
                              </p>
                              <ul className="mt-2 space-y-2">
                                {items.map((d) => (
                                  <li
                                    key={d.id}
                                    className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
                                      bucket === "retard"
                                        ? "border-red-200 bg-red-50"
                                        : "hairline bg-cream-50"
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p
                                        className={`font-medium ${
                                          d.done ? "text-slate-500 line-through" : "text-navy-900"
                                        }`}
                                      >
                                        {d.title}
                                        {d.priority === "haute" && !d.done && (
                                          <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-red-700">
                                            Haute
                                          </span>
                                        )}
                                      </p>
                                      <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
                                        {fmtShort(`${d.due_date}T00:00:00`)}
                                        {d.due_time ? ` · ${d.due_time.slice(0, 5)}` : ""}
                                        {d.description ? ` · ${d.description}` : ""}
                                      </p>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-3">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleDeadline(d)}
                                        className="text-xs font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-700"
                                      >
                                        {d.done ? "Rouvrir" : "Terminer"}
                                      </button>
                                      {!d.done && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setDlEditing(d.id);
                                            setDlTitle(d.title);
                                            setDlDate(d.due_date);
                                            setDlTime(d.due_time?.slice(0, 5) ?? "");
                                            setDlPriority(d.priority);
                                            setDlDescription(d.description ?? "");
                                          }}
                                          className="text-xs font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-700"
                                        >
                                          Modifier
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteDeadline(d)}
                                        className="text-xs font-medium text-red-600 hover:text-red-700"
                                      >
                                        Supprimer
                                      </button>
                                    </div>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          );
                        })
                      )}

                      <p className="mt-6 text-xs leading-relaxed text-slate-500">
                        Rappels automatiques : à l'étude — aucune échéance n'est créée
                        automatiquement à votre place.
                      </p>
                    </>
                  ) : null}

                  {/* Dates renseignées à la création (toujours affichées). */}
                  {dateEntries.length > 0 && (
                    <div className={deadlinesOn ? "mt-6 border-t hairline pt-5" : "mt-5"}>
                      <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">
                        Dates renseignées à la création
                      </p>
                      <dl className="mt-2 divide-y hairline border-y hairline">
                        {dateEntries.map(([key, value]) => (
                          <div
                            key={key}
                            className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                          >
                            <dt className="text-sm font-medium text-slate-500">{labelFor(key)}</dt>
                            <dd className="max-w-md text-sm text-navy-900 sm:text-right">{value}</dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  )}

                  {!deadlinesOn && dateEntries.length === 0 && (
                    <p className="mt-4 text-sm leading-relaxed text-slate-500">
                      Aucune échéance renseignée sur ce dossier.
                    </p>
                  )}

                  {situation && (
                    <div className="mt-6 rounded-xl bg-cream-100 p-5">
                      <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                        Situation
                      </p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-navy-900">
                        {situation}
                      </p>
                    </div>
                  )}

                  {dossier.legal_review_requested && (
                    <p className="mt-6 inline-flex items-center gap-2 rounded-full border hairline-gold bg-gold-500/10 px-4 py-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-gold-700">
                      Préavis juridique demandé
                    </p>
                  )}
                </div>
              )}

              {activeTab === "activite" && (
                <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                    Activité du dossier
                  </p>
                  {activityGroups.length === 0 ? (
                    <p className="mt-4 text-sm text-slate-500">
                      L'activité du dossier apparaîtra ici.
                    </p>
                  ) : (
                    <div className="mt-5 space-y-6">
                      {activityGroups.map((g) => (
                        <div key={g.label}>
                          <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-500">
                            {g.label}
                          </p>
                          <ul className="mt-2 space-y-1.5">
                            {g.items.map((item) => (
                              <li key={item.key} className="flex items-baseline gap-3 text-sm">
                                <span className="shrink-0 font-mono text-[0.68rem] text-slate-500">
                                  {new Date(item.at).toLocaleTimeString("fr-FR", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                                <span className="text-navy-900">{item.label}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Garanties : validation humaine + aide à la préparation ── */}
              <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                <p className="text-sm leading-relaxed text-slate-500">
                  <span className="font-medium text-navy-900">
                    Aucun envoi ne sera effectué sans votre confirmation.
                  </span>{" "}
                  ClairDossier vous aide à préparer et organiser votre dossier. Toute fonction
                  d'ordre juridique reste une aide à la préparation et doit pouvoir être vérifiée ou
                  validée par un professionnel habilité lorsque cela est nécessaire.
                </p>
              </div>

              <div className="mt-8">
                <Link
                  to="/compte"
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-navy-900 border-b hairline-gold pb-0.5 transition-colors hover:text-gold-700"
                >
                  ← Retour à mes dossiers
                </Link>
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
