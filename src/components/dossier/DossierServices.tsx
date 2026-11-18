import { useEffect, useState, type FormEvent } from "react";

type Kind = "linkedin" | "justificatifs" | "rendezvous";
type Post = { text: string; when: { display: string; hour: string; zone: string; offset: string }; reason: string };
type Service = { kind: Kind; updated: string; result: { title: string; text?: string; posts?: Post[]; metric?: string } };
const button = "rounded-md border border-navy-900 px-3 py-2 text-sm font-medium text-navy-900 disabled:opacity-50";
const input = "mt-1 block w-full rounded-md border border-slate-400 bg-white px-3 py-2 text-base";
const days = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

async function loadServices(payload?: unknown, signal?: AbortSignal): Promise<Service[]> {
  const response = await fetch("/api/recette/services", {
    credentials: "same-origin", cache: "no-store", signal, method: payload ? "POST" : "GET",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const data = await response.json();
  if (!response.ok || !Array.isArray(data.services)) throw new Error(data.error || "La demande n’a pas pu être enregistrée.");
  return data.services;
}

function Brief({ submit, busy }: { submit: (e: FormEvent<HTMLFormElement>) => void; busy: boolean }) {
  const [preferred, setPreferred] = useState(false);
  return <form onSubmit={submit} className="mt-3 space-y-3 rounded-lg bg-cream-50 p-4">
    <p className="text-sm text-slate-600">Utilisez un brief fictif destiné à la communication. Les pièces du dossier restent privées.</p>
    <div className="grid gap-3 md:grid-cols-2">
      <label>Cible<input className={input} name="audience" required maxLength={80} defaultValue="syndics de copropriété" /></label>
      <label>Offre à présenter<input className={input} name="offer" required maxLength={140} defaultValue="diagnostic de menuiseries avant rénovation" /></label>
      <label>Zone géographique<input className={input} name="region" required maxLength={80} defaultValue="Marseille" /></label>
      <label>Ton<select name="tone" className={input}><option>Pédagogique</option><option>Direct</option><option>Convivial</option></select></label>
      <label>Objectif<select name="goal" className={input}><option>Demandes de devis</option><option>Visites du profil</option><option>Échanges en commentaire</option></select></label>
      <label>Fuseau horaire<select name="zone" className={input}>{["Europe/Paris", "America/Montreal", "Indian/Reunion", "UTC"].map(z => <option key={z}>{z}</option>)}</select></label>
    </div>
    <label className="flex items-center gap-2"><input type="checkbox" checked={preferred} onChange={e => setPreferred(e.target.checked)} />J’ai relevé un créneau actif pour mon audience</label>
    {preferred && <div className="grid gap-3 sm:grid-cols-2">
      <label>Jour observé<select name="preferredDay" className={input} defaultValue="2">{days.map((d, i) => <option value={i} key={d}>{d}</option>)}</select></label>
      <label>Heure locale observée<select name="preferredHour" className={input} defaultValue="9">{Array.from({ length: 14 }, (_, i) => i + 7).map(h => <option value={h} key={h}>{h} h</option>)}</select></label>
    </div>}
    <button className={button} disabled={busy}>Préparer les trois publications</button>
  </form>;
}

export function DossierServices() {
  const [open, setOpen] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    loadServices(undefined, controller.signal).then(setServices)
      .catch(e => { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Lecture impossible."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [open]);

  async function generate(kind: Kind, brief?: Record<string, FormDataEntryValue>) {
    setError(""); setNotice(""); setBusy(true);
    try {
      setServices(await loadServices({ kind, brief }));
      setShowBrief(false); setNotice("Brouillon enregistré dans votre dossier.");
    } catch (e) { setError(e instanceof Error ? e.message : "Enregistrement impossible."); }
    finally { setBusy(false); }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice("Brouillon copié."); }
    catch { setNotice("Sélectionnez le texte pour le copier."); }
  }
  return <details onToggle={e => setOpen(e.currentTarget.open)} className="rounded-xl border hairline bg-white p-4">
    <summary className="cursor-pointer font-medium text-navy-900">Préparer une demande ou un rendez-vous</summary>
    {open && <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        <button type="button" className={button} disabled={busy || loading} onClick={() => void generate("justificatifs")}>Demander les justificatifs</button>
        <button type="button" className={button} disabled={busy || loading} onClick={() => void generate("rendezvous")}>Préparer le rendez-vous</button>
        <button type="button" className={button} disabled={busy || loading} aria-expanded={showBrief} onClick={() => setShowBrief(v => !v)}>Rédiger pour LinkedIn</button>
      </div>
      {showBrief && <Brief busy={busy} submit={e => { e.preventDefault(); void generate("linkedin", Object.fromEntries(new FormData(e.currentTarget))); }} />}
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
      <p role="status" className="text-sm text-slate-600">{loading ? "Chargement des brouillons…" : busy ? "Préparation en cours…" : notice}</p>
      {services.map(s => <article key={s.kind} className="space-y-3 border-t hairline pt-4">
        <h3 className="font-display text-2xl font-semibold">{s.result.title}</h3>
        {s.result.text && <><p className="whitespace-pre-line text-sm">{s.result.text}</p><button type="button" className={button} onClick={() => void copy(s.result.text!)}>Copier le brouillon</button></>}
        {s.result.posts?.map((p, i) => <section key={p.when.display} className="space-y-2 rounded-lg border hairline p-3">
          <h4 className="font-semibold">Publication {i + 1} · {p.when.display}, {p.when.hour}</h4>
          <p className="text-sm text-slate-600">{p.when.zone} ({p.when.offset}) · {p.reason}</p>
          <p className="whitespace-pre-line text-sm">{p.text}</p><button type="button" className={button} onClick={() => void copy(p.text)}>Copier la publication {i + 1}</button>
        </section>)}
        {s.result.metric && <p className="text-sm">Indicateur à suivre après publication par vos soins · {s.result.metric}.</p>}
      </article>)}
    </div>}
  </details>;
}
