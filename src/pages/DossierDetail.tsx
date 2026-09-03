import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { zipSync } from "fflate";
import { Seo } from "../lib/seo";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { isUnknownColumnError, pieceMetadata } from "../lib/documents";
import { ArrowRightIcon, CheckIcon } from "../components/icons";

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
  statut_ingestion?: string | null; // 'doublon' : copie stricte d'une autre pièce du dossier
};

// Colonnes lues : la version étendue (empreinte, suppression logique) puis, si la
// migration n'est pas encore appliquée en base, la version historique.
const DOCUMENT_COLUMNS_V2 = "id,file_name,file_path,kind,statut_ingestion";
const DOCUMENT_COLUMNS_V1 = "id,file_name,file_path,kind";

async function fetchDocumentRows(dossierId: string): Promise<DocumentRow[]> {
  const v2 = await supabase
    .from("dossier_documents")
    .select(DOCUMENT_COLUMNS_V2)
    .eq("dossier_id", dossierId)
    .is("supprime_le", null)
    .order("created_at", { ascending: true });
  if (!v2.error) return (v2.data as DocumentRow[] | null) ?? [];
  if (!isUnknownColumnError(v2.error)) return [];
  const v1 = await supabase
    .from("dossier_documents")
    .select(DOCUMENT_COLUMNS_V1)
    .eq("dossier_id", dossierId)
    .order("created_at", { ascending: true });
  return (v1.data as DocumentRow[] | null) ?? [];
}

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

// Avancement du dossier — 5 étapes métier. Chaque étape est cliquable et ouvre
// un panneau explicatif (cf. cahier directeur : étapes cliquables + message dynamique).
const TIMELINE = [
  "Création du dossier",
  "Devis, contrat ou accord",
  "Suivi du dossier",
  "Facture et paiement",
  "Option impayé / pré-contentieux",
];

// Détail affiché dans le panneau quand on clique une étape (1-indexé via i+1).
const STEP_PANELS: string[] = [
  "Le dossier est créé : profil, nature, informations clés et premières pièces sont réunis dans un espace unique.",
  "Les documents qui fondent la relation (devis, contrat, bon de commande, accord) sont rassemblés et datés.",
  "Le dossier vit : échanges, relances, pièces complémentaires et échéances sont suivis au même endroit.",
  "La facturation et les règlements sont tracés : montants, échéances, acomptes et solde restant dû.",
  "En cas d'impayé, le dossier est prêt : relances, mise en demeure et pièces sont organisées pour être transmises à un professionnel habilité.",
];

// Message dynamique affiché selon l'étape ATTEINTE par le dossier.
const STEP_MESSAGES: Record<number, string> = {
  1: "Votre dossier vient d'être créé. Complétez les informations et déposez vos pièces pour le structurer.",
  2: "Rassemblez les documents qui fondent l'accord (devis, contrat, commande) pour sécuriser la suite.",
  3: "Votre dossier est suivi. Ajoutez les nouveaux échanges et pièces au fur et à mesure.",
  4: "Suivez la facturation et les règlements : renseignez les montants et les échéances de paiement.",
  5: "Le dossier est prêt à être transmis à un professionnel du droit en cas de contentieux.",
};

// « Ce que vous devez faire maintenant » — action concrète selon l'étape atteinte.
const STEP_NEXT_ACTIONS: Record<number, string> = {
  1: "Vérifiez les informations du dossier et déposez les premières pièces.",
  2: "Ajoutez le devis, le contrat ou l’accord signé au dossier.",
  3: "Mettez à jour le suivi : nouveaux courriers, relances, pièces reçues.",
  4: "Renseignez la facture, le montant dû et l’échéance de paiement.",
  5: "Préparez la transmission à un professionnel habilité si le litige persiste.",
};

// Mappe un statut de dossier à une étape atteinte dans la frise (1-indexée).
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

// Étiquettes lisibles pour les clés d'answers connues (cf. DossierFlow).
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

// Détecte les clés d'answers qui portent une date / échéance.
function isDateKey(key: string): boolean {
  return /date|deadline|echeance|échéance/i.test(key);
}

// Onglets de la page dossier — les pièces vivent dans UN seul onglet (cf. cahier),
// plus d'empilement de sections les unes après les autres.
const TABS = [
  { id: "apercu", label: "Vue d'ensemble" },
  { id: "pieces", label: "Pièces" },
  { id: "echeances", label: "Échéances" },
  { id: "dashboard", label: "DashBoard ClairDossier" },
] as const;
type TabId = (typeof TABS)[number]["id"];

// Ligne de document : Visualiser (aperçu en ligne) + Télécharger + (admin) Supprimer.
function DocLine({
  doc,
  viewHref,
  onDelete,
  deleting,
}: {
  doc: DocumentRow;
  viewHref?: string;
  onDelete?: () => void;
  deleting?: boolean;
}) {
  // Même URL signée, forcée en téléchargement via le paramètre ?download de Supabase.
  const dlHref = viewHref
    ? `${viewHref}${viewHref.includes("?") ? "&" : "?"}download=${encodeURIComponent(doc.file_name)}`
    : undefined;
  const isDeliverable = doc.kind === "deliverable";
  return (
    <li
      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        isDeliverable ? "hairline-gold bg-gold-500/5" : "hairline bg-cream-50"
      }`}
    >
      <span className="min-w-0 flex-1 truncate text-navy-900">
        {doc.file_name}
      </span>
      <div className="flex shrink-0 items-center gap-3">
        {doc.statut_ingestion === "doublon" && (
          <span
            className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-slate-500"
            title="Copie strictement identique d'une autre pièce de ce dossier"
          >
            Doublon
          </span>
        )}
        {viewHref ? (
          <>
            <a
              href={viewHref}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-navy-900 border-b hairline-gold pb-0.5 transition-colors hover:text-gold-700"
            >
              Visualiser
            </a>
            <a
              href={dlHref}
              className="font-medium text-navy-900 border-b hairline-gold pb-0.5 transition-colors hover:text-gold-700"
            >
              Télécharger
            </a>
          </>
        ) : (
          <span className="text-xs text-slate-500">Lien indisponible</span>
        )}
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="text-xs font-medium text-red-600 transition-colors hover:text-red-700 disabled:opacity-50"
          >
            {deleting ? "…" : "Supprimer"}
          </button>
        )}
      </div>
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
  // Étape dont le panneau est ouvert (0 = aucune ⇒ on affiche l'étape atteinte).
  const [openStep, setOpenStep] = useState(0);
  const [delivering, setDelivering] = useState(false);
  const [deliverError, setDeliverError] = useState<string | null>(null);
  const [zipping, setZipping] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("apercu");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    (async () => {
      // La RLS limite déjà la lecture au propriétaire — le filtre id suffit.
      const { data } = await supabase
        .from("dossiers")
        .select(
          "id,user_id,typology,title,status,answers,legal_review_requested,created_at",
        )
        .eq("id", id)
        .maybeSingle();
      if (!active) return;
      const row = (data as DossierRow | null) ?? null;
      setDossier(row);

      // Admin : identité (e-mail) du propriétaire du dossier (réservé à l'admin).
      const { data: adminFlag } = await supabase.rpc("is_admin");
      const admin = adminFlag === true;
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
        const list = await fetchDocumentRows(id);
        if (!active) return;
        setDocuments(list);

        // Pré-génère les URL signées (valides 1 h) pour le téléchargement.
        const signed: Record<string, string> = {};
        await Promise.all(
          list.map(async (doc) => {
            const { data: url } = await supabase.storage
              .from("documents")
              .createSignedUrl(doc.file_path, 3600);
            if (url?.signedUrl) signed[doc.id] = url.signedUrl;
          }),
        );
        if (!active) return;
        setLinks(signed);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  const answers = dossier?.answers ?? {};
  const answerEntries = Object.entries(answers).filter(([, v]) => v?.trim());
  const dateEntries = answerEntries.filter(([k]) => isDateKey(k));
  const situation = answers.situation?.trim();
  const step = dossier ? currentStep(dossier.status) : 1;
  // Panneau affiché : l'étape cliquée, ou par défaut l'étape atteinte par le dossier.
  const shownStep = openStep || step;

  // Pièces déposées par le client vs travail livré par ClairDossier.
  const pieces = documents.filter((d) => d.kind !== "deliverable");
  const deliverables = documents.filter((d) => d.kind === "deliverable");

  // Recharge la liste des documents + URL signées après une livraison.
  async function reloadDocuments() {
    if (!id) return;
    const list = await fetchDocumentRows(id);
    setDocuments(list);
    const signed: Record<string, string> = {};
    await Promise.all(
      list.map(async (doc) => {
        const { data: url } = await supabase.storage
          .from("documents")
          .createSignedUrl(doc.file_path, 3600);
        if (url?.signedUrl) signed[doc.id] = url.signedUrl;
      }),
    );
    setLinks(signed);
  }

  // Admin global : dépose le travail réalisé sous le dossier du CLIENT (kind='deliverable'),
  // de sorte que le client y accède via ses propres politiques RLS (lecture + storage).
  async function handleDeliver(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || !dossier) return;
    setDeliverError(null);
    setDelivering(true);
    try {
      for (const file of Array.from(fileList)) {
        const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80);
        const path = `${dossier.user_id}/${dossier.id}/deliverable-${Date.now()}-${safe}`;
        const meta = await pieceMetadata(file);
        const up = await supabase.storage
          .from("documents")
          .upload(path, file, { upsert: false });
        if (up.error) throw up.error;
        const row = {
          dossier_id: dossier.id,
          user_id: dossier.user_id, // propriété au CLIENT → il y accède via sa policy _own
          file_path: path,
          file_name: file.name,
          size_bytes: file.size,
          kind: "deliverable",
        };
        let ins = await supabase.from("dossier_documents").insert({ ...row, ...meta });
        if (ins.error && isUnknownColumnError(ins.error)) {
          // Migration d'empreinte pas encore appliquée côté base : comportement historique.
          ins = await supabase.from("dossier_documents").insert(row);
        }
        if (ins.error) throw ins.error;
      }
      await reloadDocuments();
    } catch {
      setDeliverError("L'envoi du livrable a échoué. Réessayez.");
    } finally {
      setDelivering(false);
    }
  }

  // Téléchargement groupé : récupère chaque fichier (URL signée) et assemble un .zip côté client.
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
        setDeliverError("Téléchargement indisponible pour le moment.");
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
    } finally {
      setZipping(false);
    }
  }

  // Admin : supprimer un livrable envoyé (fichier storage + ligne DB), avec confirmation.
  async function handleDelete(doc: DocumentRow) {
    if (
      !window.confirm(
        `Supprimer « ${doc.file_name} » ? Cette action est définitive.`,
      )
    )
      return;
    setDeletingId(doc.id);
    setDeliverError(null);
    try {
      await supabase.storage.from("documents").remove([doc.file_path]);
      const del = await supabase
        .from("dossier_documents")
        .delete()
        .eq("id", doc.id);
      if (del.error) throw del.error;
      await reloadDocuments();
    } catch {
      setDeliverError("La suppression a échoué. Réessayez.");
    } finally {
      setDeletingId(null);
    }
  }

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
              {/* ── En-tête ─────────────────────────────────────────── */}
              <div className="mt-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
                    {TYPOLOGY_LABELS[dossier.typology] ?? dossier.typology}
                  </p>
                  <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] text-navy-900">
                    {dossier.title ||
                      TYPOLOGY_LABELS[dossier.typology] ||
                      dossier.typology}
                  </h1>
                  <p className="mt-3 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                    Catégorie ·{" "}
                    {TYPOLOGY_LABELS[dossier.typology] ?? dossier.typology}
                  </p>
                  {isAdmin && (
                    <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-gold-700">
                      Propriétaire ·{" "}
                      {ownerEmail ?? `${dossier.user_id.slice(0, 8)}…`}
                    </p>
                  )}
                  <p className="mt-1 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                    Créé le{" "}
                    {new Date(dossier.created_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <span className="rounded-full bg-gold-500/12 px-3 py-1.5 font-mono text-[0.7rem] font-medium text-navy-900 border hairline-gold">
                  {STATUS_LABELS[dossier.status] ?? dossier.status}
                </span>
              </div>

              {/* ── Onglets (une pièce = un onglet, plus d'empilement) ── */}
              <div
                className="mt-8 flex flex-wrap gap-1 border-b hairline"
                role="tablist"
              >
                {TABS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === t.id}
                    onClick={() => setActiveTab(t.id)}
                    className={`-mb-px rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
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
                  {/* ── Avancement du dossier (étapes cliquables) ───────── */}
                  <div className="mt-10 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
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
                                  {done ? (
                                    <CheckIcon
                                      width={12}
                                      height={12}
                                      strokeWidth={2.5}
                                    />
                                  ) : (
                                    n
                                  )}
                                </span>
                                {i < TIMELINE.length - 1 && (
                                  <span
                                    className={`hidden h-px flex-1 transition-colors sm:block ${
                                      step > n
                                        ? "bg-navy-900"
                                        : "bg-slate-300/40"
                                    }`}
                                  />
                                )}
                              </div>
                              <p
                                className={`text-sm leading-snug sm:mt-3 ${
                                  done || active
                                    ? "font-medium text-navy-900"
                                    : "text-slate-500"
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

                    {/* Panneau de l'étape sélectionnée */}
                    <div className="mt-7 rounded-xl bg-cream-50 p-5">
                      <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                        Étape {shownStep} · {TIMELINE[shownStep - 1]}
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-navy-900">
                        {STEP_PANELS[shownStep - 1]}
                      </p>
                    </div>

                    {/* Message dynamique : où en est le dossier */}
                    <p className="mt-5 border-t hairline pt-5 text-sm leading-relaxed text-slate-500">
                      {STEP_MESSAGES[step]}
                    </p>
                  </div>

                  {/* ── Ce que vous devez faire maintenant ──────────────── */}
                  <div className="mt-6 rounded-2xl border hairline-gold bg-gold-500/10 p-7 shadow-card sm:p-9">
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                      Ce que vous devez faire maintenant
                    </p>
                    <p className="mt-3 text-sm leading-relaxed text-navy-900">
                      {STEP_NEXT_ACTIONS[step]}
                    </p>
                  </div>
                </>
              )}

              {activeTab === "pieces" && (
                <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                      Pièces du dossier
                    </p>
                    {/* Admin : télécharger toutes les pièces du client en une fois (.zip). */}
                    {isAdmin && pieces.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadZip(
                            pieces,
                            `pieces-${dossier.title || dossier.id}.zip`,
                          )
                        }
                        disabled={zipping}
                        className="shrink-0 rounded-full bg-navy-900 px-4 py-2 text-xs font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-60"
                      >
                        {zipping
                          ? "Préparation…"
                          : `Télécharger toutes les pièces (${pieces.length})`}
                      </button>
                    )}
                  </div>
                  {pieces.length === 0 ? (
                    <p className="mt-4 text-sm leading-relaxed text-slate-500">
                      Aucune pièce n'a encore été déposée sur ce dossier.
                    </p>
                  ) : (
                    <ul className="mt-5 space-y-2">
                      {pieces.map((doc) => (
                        <DocLine
                          key={doc.id}
                          doc={doc}
                          viewHref={links[doc.id]}
                        />
                      ))}
                    </ul>
                  )}
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
                          downloadZip(
                            deliverables,
                            `travail-${dossier.title || dossier.id}.zip`,
                          )
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
                        <DocLine
                          key={doc.id}
                          doc={doc}
                          viewHref={links[doc.id]}
                          onDelete={
                            isAdmin ? () => handleDelete(doc) : undefined
                          }
                          deleting={deletingId === doc.id}
                        />
                      ))}
                    </ul>
                  )}

                  {/* Admin : livrer le travail effectué sur le compte du client. */}
                  {isAdmin && (
                    <div className="mt-6 border-t hairline pt-5">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-gold-500 px-5 py-2.5 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5">
                        {delivering ? "Envoi…" : "Livrer le travail au client"}
                        {!delivering && (
                          <ArrowRightIcon
                            width={14}
                            height={14}
                            strokeWidth={2}
                          />
                        )}
                        <input
                          type="file"
                          multiple
                          className="hidden"
                          disabled={delivering}
                          onChange={(e) => {
                            handleDeliver(e.target.files);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        Les fichiers déposés ici sont visibles et
                        téléchargeables par le client depuis son espace.
                      </p>
                      {deliverError && (
                        <p className="mt-2 text-xs font-medium text-red-600">
                          {deliverError}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "echeances" && (
                <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                  <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                    Échéances & suivi
                  </p>

                  {dateEntries.length > 0 ? (
                    <dl className="mt-5 divide-y hairline border-y hairline">
                      {dateEntries.map(([key, value]) => (
                        <div
                          key={key}
                          className="flex flex-col gap-1 py-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6"
                        >
                          <dt className="text-sm font-medium text-slate-500">
                            {labelFor(key)}
                          </dt>
                          <dd className="max-w-md text-sm text-navy-900 sm:text-right">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
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

              {/* ── Garanties : validation humaine + aide à la préparation ── */}
              <div className="mt-6 rounded-2xl border hairline bg-white p-7 shadow-card sm:p-9">
                <p className="text-sm leading-relaxed text-slate-500">
                  <span className="font-medium text-navy-900">
                    Aucun envoi ne sera effectué sans votre confirmation.
                  </span>{" "}
                  ClairDossier vous aide à préparer et organiser votre dossier.
                  Toute fonction d'ordre juridique reste une aide à la
                  préparation et doit pouvoir être vérifiée ou validée par un
                  professionnel habilité lorsque cela est nécessaire.
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
