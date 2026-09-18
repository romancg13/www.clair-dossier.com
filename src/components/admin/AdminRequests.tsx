import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { journalReviewAlerts } from "../../data/blog";
import { PARTNER_TYPES, PARTNER_TYPE_LABELS, type PartnerType } from "../../lib/prospects";

/**
 * Console : demandes reçues par le formulaire de contact (dont « Devenir
 * partenaire ») et alerte de relecture des articles du Journal.
 * Lecture et changement de statut réservés à l'administration par la base
 * (RLS) ; seule la colonne « statut » est modifiable (migration 20260918130000).
 */
type Prospect = {
  id: string;
  created_at: string;
  full_name: string;
  email: string;
  organization: string | null;
  topic: string;
  partner_type: string | null;
  site_url: string | null;
  message: string | null;
  statut: string;
};

const STATUTS = ["nouveau", "contacte", "converti", "clos"] as const;
const STATUT_LABELS: Record<string, string> = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  converti: "Converti",
  clos: "Clos",
};
const TOPIC_LABELS: Record<string, string> = {
  demo: "Démo",
  commercial: "Commercial",
  support: "Support",
  presse: "Presse",
  "rendez-vous": "Rendez-vous",
  devis: "Devis",
  partenariat: "Partenariat",
};

function isPartnerType(v: string | null): v is PartnerType {
  return v !== null && (PARTNER_TYPES as readonly string[]).includes(v);
}

export function AdminRequests({ onError }: { onError: (m: string | null) => void }) {
  const [rows, setRows] = useState<Prospect[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [topic, setTopic] = useState("tous");
  const [partnerType, setPartnerType] = useState("tous");
  const [statut, setStatut] = useState("tous");
  const [saving, setSaving] = useState<string | null>(null);
  const alerts = useMemo(() => journalReviewAlerts(new Date()), []);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("prospects")
        .select("id,created_at,full_name,email,organization,topic,partner_type,site_url,message,statut")
        .order("created_at", { ascending: false })
        .limit(200);
      if (!active) return;
      if (error) {
        // Table absente ou colonnes partenariat non migrées.
        setMissing(true);
        setRows([]);
        return;
      }
      setRows((data as Prospect[] | null) ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  const visible = (rows ?? []).filter(
    (r) =>
      (topic === "tous" || r.topic === topic) &&
      (partnerType === "tous" || r.partner_type === partnerType) &&
      (statut === "tous" || r.statut === statut),
  );

  async function changeStatut(id: string, next: string) {
    setSaving(id);
    onError(null);
    const { data, error } = await supabase.from("prospects").update({ statut: next }).eq("id", id).select("statut");
    setSaving(null);
    const saved = (data as { statut: string }[] | null)?.[0]?.statut;
    if (error || saved !== next) {
      onError("Statut non enregistré : droits insuffisants ou session à revérifier.");
      return;
    }
    setRows((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, statut: next } : r)));
  }

  const select =
    "rounded-lg border hairline bg-white px-3 py-2 text-sm text-navy-900 focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-500/20";

  return (
    <div className="mt-8 space-y-8">
      <div className="rounded-2xl border hairline bg-white p-6 shadow-card">
        <h2 className="font-display text-xl font-semibold text-navy-900">Journal : articles à relire</h2>
        {alerts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune relecture due dans les 30 prochains jours.</p>
        ) : (
          <ul className="mt-3 space-y-2 text-sm">
            {alerts.map((a) => (
              <li key={a.slug} className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 font-mono text-[0.65rem] uppercase ${a.level === "overdue" ? "bg-red-100 text-red-800" : "bg-gold-500/15 text-navy-900"}`}>
                  {a.level === "overdue" ? "En retard" : `Dans ${a.daysLeft} j`}
                </span>
                <Link to={`/blog/${a.slug}`} className="text-navy-900 underline-offset-2 hover:underline">
                  {a.title}
                </Link>
                <span className="text-xs text-slate-500">
                  {a.status === "draft" ? "brouillon · " : ""}dernière révision {a.lastRevised}
                </span>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-slate-500">
          Alerte seulement : aucune republication automatique. Relire, corriger les sources, puis mettre à jour « updated » et « reviewBy ».
        </p>
      </div>

      <div className="rounded-2xl border hairline bg-white p-6 shadow-card">
        <h2 className="font-display text-xl font-semibold text-navy-900">Demandes reçues</h2>
        {missing ? (
          <p className="mt-2 text-sm text-slate-500">
            Enregistrement des demandes non activé : appliquer les migrations 20260829120000 puis
            20260918130000 et déployer la fonction submit-prospect (voir TODO_ADMIN.md).
          </p>
        ) : rows === null ? (
          <p className="mt-2 text-sm text-slate-500">Chargement…</p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap gap-2">
              <label className="text-xs text-slate-500">
                Nature{" "}
                <select className={select} value={topic} onChange={(e) => setTopic(e.target.value)}>
                  <option value="tous">Toutes</option>
                  {Object.entries(TOPIC_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Partenariat{" "}
                <select className={select} value={partnerType} onChange={(e) => setPartnerType(e.target.value)}>
                  <option value="tous">Tous</option>
                  {PARTNER_TYPES.map((t) => (
                    <option key={t} value={t}>{PARTNER_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </label>
              <label className="text-xs text-slate-500">
                Statut{" "}
                <select className={select} value={statut} onChange={(e) => setStatut(e.target.value)}>
                  <option value="tous">Tous</option>
                  {STATUTS.map((s) => (
                    <option key={s} value={s}>{STATUT_LABELS[s]}</option>
                  ))}
                </select>
              </label>
            </div>
            {visible.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Aucune demande pour ces filtres.</p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100">
                {visible.map((r) => (
                  <li key={r.id} className="py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-navy-900">
                          {r.full_name}
                          {r.organization ? ` · ${r.organization}` : ""}
                        </p>
                        <p className="mt-0.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] text-slate-500">
                          {TOPIC_LABELS[r.topic] ?? r.topic}
                          {isPartnerType(r.partner_type) ? ` · ${PARTNER_TYPE_LABELS[r.partner_type]}` : ""} ·{" "}
                          {new Date(r.created_at).toLocaleDateString("fr-FR")}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          <a href={`mailto:${r.email}`} className="text-navy-900 hover:underline">{r.email}</a>
                          {r.site_url && (
                            <>
                              {" · "}
                              <a href={r.site_url} target="_blank" rel="noopener noreferrer nofollow" className="text-navy-900 hover:underline">
                                site
                              </a>
                            </>
                          )}
                        </p>
                        {r.message && <p className="mt-2 whitespace-pre-line text-sm text-navy-900">{r.message}</p>}
                      </div>
                      <label className="text-xs text-slate-500">
                        <span className="sr-only">Statut de la demande de {r.full_name}</span>
                        <select
                          className={select}
                          value={r.statut}
                          disabled={saving === r.id}
                          onChange={(e) => void changeStatut(r.id, e.target.value)}
                        >
                          {STATUTS.map((s) => (
                            <option key={s} value={s}>{STATUT_LABELS[s]}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
