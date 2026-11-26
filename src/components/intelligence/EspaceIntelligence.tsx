// « Mon compte » ORIGINAL enrichi : ce qui demande une décision (3 priorités au plus), ce qui est arrivé depuis votre
// dernière visite, ce que ClairDossier fait pour vous (automatisations), vos préférences pour ClairDossier IA.
// Tout est lu sous RLS (titulaire seulement) ; activé par le build VITE_INTELLIGENCE=1 (migration 20261126120000).
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";

type Echeance = { id: string; title: string; due_date: string; dossier_id: string; done: boolean };
type Dossier = { id: string; title: string | null };
type Note = { id: string; title: string; body: string; link: string; created_at: string; read_at: string | null };
type Auto = { id: string; title: string; frequence: string; jour: number | null; heure: number; status: string; motif: string | null; next_run_at: string | null; last_run_at: string | null; runs: number };
type Pref = { id: string; body: string };

const JOURS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
const quand = (a: Auto) =>
  a.frequence === "piece" ? "à chaque pièce reçue" : a.frequence === "quotidien" ? `chaque jour à ${a.heure} h` : a.frequence === "mensuel" ? `le 1er de chaque mois à ${a.heure} h` : `chaque ${JOURS[(a.jour ?? 1) - 1]} à ${a.heure} h`;
const fr = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
const jours = (d: string) => Math.round((Date.parse(`${d}T00:00:00`) - new Date(new Date().toDateString()).getTime()) / 86_400_000);
const carte = "rounded-2xl border hairline bg-white p-6 shadow-card";
const bouton = "inline-flex min-h-11 items-center justify-center rounded-full border border-navy-900/15 bg-white px-4 py-2 text-sm font-medium text-navy-900 transition-colors hover:border-gold-500";

export function EspaceIntelligence({ dossiers }: { dossiers: Dossier[] }) {
  const [echeances, setEcheances] = useState<Echeance[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [autos, setAutos] = useState<Auto[] | null>(null);
  const [prefs, setPrefs] = useState<Pref[]>([]);
  const [texte, setTexte] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const charger = useCallback(async () => {
    const dans7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const [e, n, a, p] = await Promise.all([
      supabase.from("dossier_deadlines").select("id,title,due_date,dossier_id,done").eq("done", false).lte("due_date", dans7).order("due_date").limit(20),
      supabase.from("client_notifications").select("id,title,body,link,created_at,read_at").is("read_at", null).order("created_at", { ascending: false }).limit(8),
      supabase.from("client_automations").select("id,title,frequence,jour,heure,status,motif,next_run_at,last_run_at,runs").neq("status", "annulee").order("created_at"),
      supabase.from("assistant_preferences").select("id,body").order("created_at"),
    ]);
    setEcheances(e.error ? [] : ((e.data ?? []) as Echeance[]));
    setNotes(n.error ? [] : ((n.data ?? []) as Note[]));
    setAutos(a.error ? null : ((a.data ?? []) as Auto[])); // null : migration absente → section masquée
    setPrefs(p.error ? [] : ((p.data ?? []) as Pref[]));
  }, []);
  useEffect(() => void charger(), [charger]);

  if (autos === null) return null;
  const titre = (id: string) => dossiers.find((d) => d.id === id)?.title || "Dossier";
  // Une priorité par dossier, la plus proche ; trois au plus. Les échéances passées non faites restent en tête.
  const parDossier = new Map<string, Echeance>();
  for (const x of echeances) if (!parDossier.has(x.dossier_id)) parDossier.set(x.dossier_id, x);
  const priorites = [...parDossier.values()].slice(0, 3);

  const etat = async (id: string, op: string) => {
    await supabase.rpc("set_client_automation_status", { p_id: id, p_op: op });
    void charger();
  };
  const retenir = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    const body = texte.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, 200);
    if (!body) return;
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("assistant_preferences").insert({ user_id: u.user?.id, body });
    if (error) setErr(/PREFERENCES_PLEINES/.test(error.message) ? "12 préférences au plus : supprimez-en une." : /duplicate|unique/.test(error.message) ? "Cette préférence est déjà enregistrée." : "Enregistrement impossible.");
    else setTexte("");
    void charger();
  };

  return (
    <div className="space-y-6">
      {priorites.length > 0 && (
        <section aria-labelledby="decider" className={carte}>
          <h2 id="decider" className="font-display text-2xl font-semibold text-navy-900">À décider maintenant</h2>
          <ul className="mt-4 grid gap-3 md:grid-cols-3">
            {priorites.map((x) => {
              const j = jours(x.due_date);
              return (
                <li key={x.id} className="flex flex-col rounded-xl border border-gold-500/40 p-4">
                  <span className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">{titre(x.dossier_id)}</span>
                  <strong className="mt-1 text-[0.95rem] font-semibold leading-snug text-navy-900">{x.title}</strong>
                  <span className="mt-1 flex-1 text-sm text-slate-600">{j < 0 ? `Échéance dépassée depuis ${-j} jour${j < -1 ? "s" : ""}.` : j === 0 ? "Échéance aujourd’hui." : j === 1 ? "Échéance demain." : `Échéance dans ${j} jours (${fr(x.due_date)}).`}</span>
                  <Link to={`/compte/dossier/${x.dossier_id}`} className="mt-3 inline-flex w-fit rounded-full bg-navy-900 px-4 py-2 text-sm font-medium text-cream-50 hover:bg-navy-800">Voir le dossier</Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <section aria-labelledby="nouveautes" className={carte}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="nouveautes" className="font-display text-2xl font-semibold text-navy-900">Depuis votre dernière visite</h2>
            <button type="button" className={bouton} onClick={async () => { await supabase.rpc("mark_client_notifications_read"); void charger(); }}>Tout marquer comme lu</button>
          </div>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {notes.map((n) => (
              <li key={n.id}><span className="text-slate-500">{fr(n.created_at)} · </span><Link to={n.link} className="font-semibold text-navy-900">{n.title}</Link> — {n.body}</li>
            ))}
          </ul>
        </section>
      )}

      {autos.length > 0 && (
        <section aria-labelledby="automatisations" className={carte}>
          <h2 id="automatisations" className="font-display text-2xl font-semibold text-navy-900">Ce que ClairDossier fait pour vous</h2>
          <ul className="mt-3 divide-y divide-cream-200">
            {autos.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                <span>
                  <strong className="font-semibold text-navy-900">{a.title}</strong> — {quand(a)}
                  <span className="block text-xs text-slate-500">
                    {a.status === "active" ? "Active" : a.status === "suspendue" ? "En pause" : `Arrêtée${a.motif ? ` : ${a.motif}` : ""}`}
                    {a.last_run_at ? ` · dernière exécution le ${fr(a.last_run_at)} (${a.runs})` : " · pas encore exécutée"}
                    {a.status === "active" && a.next_run_at ? ` · prochaine le ${fr(a.next_run_at)}` : ""}
                  </span>
                </span>
                <span className="flex gap-2">
                  {a.status === "active" && <button type="button" className={bouton} onClick={() => void etat(a.id, "suspendre")}>Mettre en pause</button>}
                  {a.status !== "active" && <button type="button" className={bouton} onClick={() => void etat(a.id, "reprendre")}>Reprendre</button>}
                  <button type="button" className={bouton} onClick={() => void etat(a.id, "annuler")}>Annuler</button>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-slate-500">Exécutées sur nos serveurs, même navigateur ou application fermés.</p>
        </section>
      )}

      <details className={carte}>
        <summary className="cursor-pointer text-[0.95rem] font-semibold text-navy-900">Mes préférences pour ClairDossier IA{prefs.length ? ` (${prefs.length})` : ""}</summary>
        <p className="mt-3 text-sm text-slate-500">Une habitude à retenir : un ton, une signature, une règle de travail. Vous seul les voyez.</p>
        <ul className="mt-3 space-y-2">
          {prefs.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
              <span>{p.body}</span>
              <button type="button" className={bouton} onClick={async () => { await supabase.from("assistant_preferences").delete().eq("id", p.id); void charger(); }}>Oublier</button>
            </li>
          ))}
        </ul>
        <form onSubmit={retenir} className="mt-3 flex flex-wrap gap-2">
          <input aria-label="Nouvelle préférence" maxLength={200} value={texte} onChange={(e) => setTexte(e.target.value)} placeholder="Ex. : terminer mes courriers par « Cordialement »" className="min-h-11 min-w-0 flex-1 rounded-full border hairline-strong bg-white px-4 text-sm" />
          <button type="submit" className={bouton}>Retenir</button>
        </form>
        {err && <p role="alert" className="mt-2 text-sm text-red-700">{err}</p>}
      </details>
    </div>
  );
}
