import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "../components/Logo";
import { Seo } from "../lib/seo";
import { Depot } from "../recette/Depot";
import { api, accessFile, downloadResults, requestRecovery, SessionEnded, ServerUnavailable, type Persona, type State } from "../recette/client";
import { DeliverablesGrid } from "../components/dossier/DeliverablesGrid";
import { DossierServices } from "../components/dossier/DossierServices";
import { dossierOverview } from "../../supabase/functions/_shared/dossier-overview";
import { deliverableKeyOf, frDate, sources } from "../../supabase/functions/_shared/analysis-model";

const label: Record<Persona, string> = { a: "Client A", b: "Client B", "sans-abonnement": "Client sans abonnement" };
const statusLabels = {
  empty: "Dossier ouvert", queued: "Dépôt reçu", processing: "Traitement en cours", ready: "Résultats disponibles",
  partial: "Résultats partiels", failed: "Traitement interrompu", closed: "Dossier clôturé", review: "Validation par l’équipe en cours",
};
const card = "rounded-2xl border hairline bg-white p-5 sm:p-8";
const title = "font-display text-3xl font-semibold text-navy-900";
const button = "inline-flex min-h-11 items-center justify-center rounded-full bg-navy-900 px-5 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50";

function Dates({ dossier, busy, save }: { dossier: State["dossier"]; busy: boolean; save: (change: object) => Promise<boolean> }) {
  const names = new Map(dossier.objects.map(o => [o.id, o.name]));
  const [editing, setEditing] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  return (
    <details id="recette-dates" className={card}>
      <summary className="cursor-pointer font-semibold">Vérifier et corriger les dates ({dossier.events.length})</summary>
      <ul className="mt-3 divide-y divide-slate-200">
        {dossier.events.map(ev => (
          <li className="py-3" key={ev.key}>
            <p className="font-medium">{ev.retained_label}</p>
            <p className="mt-1 text-sm text-slate-700">Valeur extraite {frDate(ev.date)} · Date retenue {frDate(ev.retained_date)}</p>
            <p className="mt-1 text-sm text-slate-600">{ev.kind === "document_date" ? "Date du document" : "Date d’événement"} · {sources(ev.evidence, names)}</p>
            {ev.edited && <p className="mt-1 text-sm text-slate-600">Correction enregistrée</p>}
            {!dossier.closed && editing !== ev.key && <button type="button" onClick={() => { setEditing(ev.key); setDate(ev.retained_date); setReason(""); }}
              className="mt-1 min-h-10 text-sm underline underline-offset-4">Corriger la date</button>}
            {editing === ev.key && !dossier.closed && <form className="mt-3 grid max-w-md gap-2 text-sm" onSubmit={async e => {
              e.preventDefault();
              if (await save({ key: ev.key, date, reason: reason.trim() })) setEditing("");
            }}>
              <label>Date corrigée<input type="date" value={date} required onChange={e => setDate(e.target.value)} className="mt-1 block w-full rounded-lg border hairline-strong px-3 py-2" /></label>
              <label>Motif de la correction<input value={reason} minLength={3} maxLength={200} required onChange={e => setReason(e.target.value)} className="mt-1 block w-full rounded-lg border hairline-strong px-3 py-2" /></label>
              <div className="flex flex-wrap gap-4">
                <button disabled={busy || reason.trim().length < 3} className={button}>Enregistrer la correction</button>
                <button type="button" className="underline" onClick={() => setEditing("")}>Annuler</button>
              </div>
            </form>}
          </li>
        ))}
      </ul>
      {dossier.overrides.length > 0 && <details className="mt-3 text-sm"><summary className="cursor-pointer">Historique des corrections</summary>
        <ul className="mt-2 space-y-2">{dossier.overrides.map((o, i) => <li key={i}>{frDate(o.retained_date)} · {o.reason} · {o.author} · {new Date(o.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}</li>)}</ul>
      </details>}
    </details>
  );
}

function Dossier({ state, mutate, busy }: { state: State; mutate: (path: string, payload: unknown) => Promise<boolean>; busy: boolean }) {
  const { dossier: d, fixtures } = state;
  const [fileError, setFileError] = useState("");
  const onFileError = () => setFileError("Le fichier n’est plus accessible. Rouvrez le dossier pour renouveler la session.");
  const [zipping, setZipping] = useState(false);
  const names = new Map(d.objects.map(o => [o.id, o.name]));
  const overview = d.analysis && dossierOverview(d.analysis, d.objects.map(o => ({ id: o.id, file_name: o.name, created_at: "" })), d.formattedAt ? new Date(d.formattedAt) : new Date());
  const working = d.jobStatus === "queued" || d.jobStatus === "processing";
  const summary = d.analysis;
  const actionTarget = d.files.length ? "#recette-resultats" : "#recette-pieces";
  const initial = d.objects.length === 0;
  const publishedRevision = Math.max(0, ...d.files.map(f => f.revision));
  return (
    <div className="space-y-5">
      <div className="py-3">
        <p className="text-sm font-medium text-slate-600">{label[state.persona]} · Espace de démonstration</p>
        <h1 className="mt-2 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">{d.title}</h1>
        {d.objective && <p className="mt-2 text-slate-700">{d.objective}</p>}
      </div>
      <section className="rounded-2xl border hairline-gold border-l-4 bg-white p-5 sm:p-8" aria-labelledby="situation">
        <h2 id="situation" className="font-display text-3xl font-semibold" aria-live="polite">{statusLabels[d.jobStatus]}</h2>
        <p className="mt-3 max-w-2xl leading-relaxed">{overview?.situation || (working ? "Vos pièces sont enregistrées. Vous pouvez fermer l’onglet et retrouver ici le résultat de leur traitement." :
          d.jobStatus === "review" ? "L’équipe doit vérifier ce dossier sensible avant de rendre ses documents disponibles." : d.closed ? "Le dossier est en lecture seule. Les dernières livraisons restent consultables." : d.jobStatus === "failed" ? "Le traitement de ce lot n’a pas abouti. Les résultats précédents restent consultables." :
          "Votre dossier est prêt à recevoir ses premières pièces. L’analyse de démonstration utilise les documents fictifs proposés ci-dessous.")}</p>
        {working && overview && <p className="mt-2 text-sm">Un complément est en cours de traitement. La dernière livraison reste disponible.</p>}
        {overview && <p className="mt-3 text-sm"><strong>Prochaine action · </strong>{overview.action} {overview.responsible && <>({overview.responsible})</>}</p>}
        {overview?.nextDate ? <p className="mt-2 text-sm"><strong>{frDate(overview.nextDate.date)}</strong> · {overview.nextDate.title} · {overview.nextDate.confirmed ? "Date confirmée" : "À confirmer"} · {overview.nextDate.source}</p> :
          <p className="mt-2 text-sm text-slate-600">Aucune prochaine date confirmée.</p>}
        {(d.files.length > 0 || (!working && !d.closed)) && <a href={actionTarget} className={`${button} mt-5`}>{d.files.length ? summary ? "Voir ma synthèse" : "Voir mes résultats" : "Joindre mes pièces"}</a>}
      </section>
      {state.receipt && <p role="status" className="text-sm text-slate-700">Lot enregistré · {state.receipt.added} nouvelle(s) pièce(s) · {state.receipt.duplicates} doublon(s) écarté(s).</p>}
      {fileError && <p role="alert" className="text-sm text-red-700">{fileError}</p>}
      {d.files.length > 0 && <section id="recette-resultats" className={card}>
        {summary && <>
          <h2 className={title}>Votre synthèse</h2>
          {summary.facts.length > 0 && <ul className="mt-3 space-y-2">{summary.facts.slice(0, 5).map((f, i) => <li key={i}>
            {f.text}<span className="block text-sm text-slate-600">{sources(f.evidence, names)}</span>
          </li>)}</ul>}
          {summary.contradictions.map((c, i) => <p className="mt-3 border-l-2 border-gold-500 pl-3 text-sm" key={i}><strong>À vérifier · </strong>{c.text} · {sources(c.evidence, names)}</p>)}
          {summary.missing_items.map((m, i) => <p className="mt-3 text-sm" key={i}><strong>Pièce à fournir · </strong>{m.text} · {m.why}</p>)}
          {summary.reminder_drafts.map((draft, i) => <details className="my-4 rounded-xl border hairline p-3 text-sm" key={i}>
            <summary className="cursor-pointer font-medium">Brouillon · {draft.subject}</summary>
            <p className="mt-2">À · {draft.recipient_hint}</p><p className="mt-2 whitespace-pre-line">{draft.body}</p>
          </details>)}
        </>}
        <DeliverablesGrid files={d.files.map(f => ({ key: deliverableKeyOf(f.name, f.key), id: f.href, name: f.name,
          open: () => accessFile(f, true).catch(onFileError), download: () => accessFile(f).catch(onFileError) }))}
          caption={publishedRevision ? `Dernière version publiée · révision ${publishedRevision}` : "Document remis par l’équipe"} emptyLabel="Aucun fichier disponible." busy={zipping}
          onDownloadAll={async () => { setZipping(true); setFileError(""); try { await downloadResults(d.files); } catch { onFileError(); } finally { setZipping(false); } }} />
      </section>}
      {d.events.length > 0 && <Dates dossier={d} busy={busy} save={c => mutate("corrections", c)} />}
      <section id="recette-pieces" className={card}>
        <h2 className={title}>Vos pièces</h2>
        {d.objects.length > 0 && <ul className="my-3 divide-y divide-slate-200">{d.objects.map(o => <li key={o.id}>
          <a className="inline-flex min-h-11 items-center break-all text-sm underline decoration-gold-600 underline-offset-4" href={o.href} download={o.name} onClick={e => { e.preventDefault(); void accessFile(o).catch(onFileError); }}>{o.name}</a>
        </li>)}</ul>}
        {!d.closed && <div className="mt-4">{initial ? <Depot fixtures={fixtures} initial busy={busy} onSubmit={lot => mutate("lots", lot)} /> :
          <details><summary className="cursor-pointer text-sm font-semibold underline underline-offset-4">Joindre un complément</summary>
            <div className="mt-4"><Depot fixtures={fixtures} initial={false} busy={busy} onSubmit={lot => mutate("lots", lot)} /></div></details>}</div>}
      </section>
      {summary && !d.closed && <DossierServices key={d.id} />}
      <details className={card}><summary className="cursor-pointer font-semibold">Historique et clôture</summary>
        {d.notifications.length > 0 && <ul className="my-3 space-y-2 text-sm">{d.notifications.map(n => <li key={n.revision}>
          Notification de disponibilité · révision {n.revision} · {new Date(n.createdAt).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} · boîte de recette
        </li>)}</ul>}
        {d.historyFiles?.length > 0 && <details className="my-3 text-sm"><summary className="cursor-pointer">Anciennes versions</summary>
          <ul>{d.historyFiles.map(f => <li key={f.href}><a className="inline-block py-1 underline" href={f.href} download={f.name} onClick={e => { e.preventDefault(); void accessFile(f).catch(onFileError); }}>{f.name} · révision {f.revision}</a></li>)}</ul>
        </details>}
        <button type="button" disabled={busy} onClick={() => void mutate("cloture", { closed: !d.closed })} className="mt-3 min-h-10 text-sm underline underline-offset-4">
          {d.closed ? "Rouvrir le dossier" : "Clôturer le dossier"}</button>
        <details className="mt-3 text-sm"><summary className="cursor-pointer">Changer de profil fictif</summary>
          <div className="flex flex-wrap gap-3">{(["a", "b", "sans-abonnement"] as const).filter(p => p !== state.persona).map(p =>
            <button type="button" key={p} disabled={busy} className="min-h-10 underline" onClick={() => void mutate("session", { persona: p })}>{label[p]}</button>)}</div>
        </details>
      </details>
    </div>
  );
}

export function RecetteDossier() {
  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [down, setDown] = useState(false);
  const [error, setError] = useState("");
  const [recovering, setRecovering] = useState(false);
  const [recoveryPersona, setRecoveryPersona] = useState<"a" | "b">("a");
  const generation = useRef(0);
  const mutating = useRef(false);
  const report = useCallback((e: unknown) => {
    if (e instanceof SessionEnded) { setState(null); setError(""); setDown(false); }
    else if (e instanceof ServerUnavailable || e instanceof TypeError) setDown(true);
    else setError(e instanceof Error ? e.message : "Une erreur est survenue.");
  }, []);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const version = generation.current;
    if (mutating.current) return;
    try {
      const next = await api("state", undefined, signal);
      if (version === generation.current && !signal?.aborted) { setState(next); setDown(false); setError(""); }
    } catch (e) { if (!signal?.aborted && version === generation.current) report(e); }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [report]);
  useEffect(() => { const c = new AbortController(); void refresh(c.signal); return () => c.abort(); }, [refresh]);
  const processing = state?.dossier.jobStatus === "processing" || state?.dossier.jobStatus === "queued";
  useEffect(() => {
    if (!processing || busy) return;
    const c = new AbortController();
    const timer = window.setTimeout(() => void refresh(c.signal), 1200);
    return () => { clearTimeout(timer); c.abort(); };
  }, [state, processing, busy, refresh]);
  async function mutate(path: string, body: unknown) {
    if (mutating.current) return false;
    mutating.current = true; generation.current++; setBusy(true); setError("");
    try {
      const next = await api(path, body);
      if (next?.persona === "a" || next?.persona === "b") setRecoveryPersona(next.persona);
      setRecovering(false); setState(next); setDown(false); return true;
    }
    catch (e) { report(e); return false; }
    finally { mutating.current = false; setBusy(false); }
  }
  return (
    <main id="main" className="min-h-screen bg-cream-50 text-navy-900">
      <Seo title="Dossier de démonstration" description="Espace fictif de recette ClairDossier" path="/recette" noindex />
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-8">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b hairline pb-3 text-sm">
          <Logo />
          {state && <button type="button" disabled={busy} onClick={() => void mutate("logout", {})} className="min-h-10 underline">Se déconnecter</button>}
        </div>
        {down && <section className={card} role="alert"><h2 className={title}>Serveur de recette indisponible</h2>
          <p className="mt-2">Le dépôt et le suivi nécessitent le serveur de traitement. L’exemple préparé permet de consulter un résultat et ses fichiers.</p>
          <a href="/exemple-recette/" className={`${button} mt-4`}>Consulter le dossier fictif déjà préparé</a>
          <button className="ml-4 min-h-11 text-sm underline" onClick={() => void refresh()}>Réessayer</button>
        </section>}
        {error && <p role="alert" className="my-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {loading ? <p role="status">Ouverture du dossier…</p> : down ? null : !state ?
          <section className={card}>
            <p className="text-sm font-medium text-slate-600">Compte de démonstration</p>
            <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Ouvrir mon dossier fictif</h1>
            <p className="mt-4 max-w-xl leading-relaxed">Déposez les deux pièces d’exemple et retrouvez vos résultats après avoir fermé l’onglet. Les droits d’abonnement et la synthèse sont simulés en recette.</p>
            <button className={`${button} mt-5`} disabled={busy} onClick={() => void mutate("session", { persona: "a" })}>Ouvrir le dossier du client A</button>
            <details className="mt-5 text-sm"><summary className="cursor-pointer">Essayer un autre profil</summary>
              <div className="mt-2 flex flex-wrap gap-4">{(["b", "sans-abonnement"] as const).map(p => <button key={p} className="min-h-10 underline" disabled={busy} onClick={() => void mutate("session", { persona: p })}>{label[p]}</button>)}</div>
            </details>
            <details className="mt-4 text-sm"><summary className="cursor-pointer">Retrouver mon espace fictif</summary>
              <p className="mt-3">La boîte de recette de ce navigateur permet de rouvrir un dossier déjà utilisé.</p>
              {!recovering ? <form className="mt-2 flex flex-wrap items-end gap-3" onSubmit={async e => {
                e.preventDefault();
                setBusy(true); setError("");
                try { await requestRecovery(recoveryPersona); setRecovering(true); }
                catch (err) { report(err); }
                finally { setBusy(false); }
              }}>
                <label>Compte à retrouver<select value={recoveryPersona} onChange={e => setRecoveryPersona(e.target.value === "b" ? "b" : "a")}
                  className="mt-1 block rounded-lg border hairline-strong bg-white px-3 py-2">
                  <option value="a">Client A</option><option value="b">Client B</option>
                </select></label>
                <button disabled={busy} className={button}>Demander la récupération</button>
              </form> : <button disabled={busy} className={`${button} mt-3`} onClick={() => void mutate("recuperation/confirmer", {})}>
                Confirmer depuis la boîte de recette</button>}
            </details>
          </section> : !state.subscribed ? <section className={card}>
            <h1 className={title}>Un abonnement est nécessaire pour déposer vos pièces</h1>
            <p className="mt-3">Le compte fictif sélectionné ne dispose pas d’un droit de dépôt.</p>
            <a href="/tarifs/" className={`${button} mt-5`}>Choisir une formule</a>
            <button disabled={busy} className="mt-3 block min-h-10 text-sm underline" onClick={() => void mutate("session", { persona: "a" })}>Essayer avec le client A abonné</button>
          </section> : <Dossier key={state.dossier.id} state={state} mutate={mutate} busy={busy} />}
      </div>
    </main>
  );
}
