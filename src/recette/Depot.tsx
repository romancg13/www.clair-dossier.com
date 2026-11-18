import { useState } from "react";
import { encodeFixtures, type Fixture } from "./client";

type Props = { fixtures: Fixture[]; initial: boolean; busy: boolean; onSubmit: (lot: object) => Promise<boolean> };
const initialSelection = ["devis", "scan"];
const defaultObjective = "Identifier les dates et préparer le suivi du devis.";

export function Depot({ fixtures, initial, busy, onSubmit }: Props) {
  const [selected, setSelected] = useState(initial ? initialSelection : []);
  const [objective, setObjective] = useState(defaultObjective);
  const [copies, setCopies] = useState<File[]>([]);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  function choices(items: Fixture[]) {
    return <div className="mt-2 grid gap-x-5 sm:grid-cols-2">
      {items.map(f => (
        <label key={f.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b hairline py-2 text-sm">
          <input type="checkbox" checked={selected.includes(f.id)} onChange={e => setSelected(e.target.checked ? [...selected, f.id] : selected.filter(id => id !== f.id))}
            className="h-4 w-4 shrink-0 accent-[#0d1b3d]" />
          <span className="break-words">{f.name}</span>
        </label>
      ))}
    </div>;
  }
  return (
    <form className="space-y-4" onSubmit={async event => {
      event.preventDefault();
      setReading(true);
      setError("");
      try {
        const uploads = await encodeFixtures(copies, fixtures);
        const done = await onSubmit({ fixtures: selected, uploads, ...(initial ? { objective: objective.trim() } : {}) });
        if (done) { setSelected([]); setCopies([]); }
      } catch (e) { setError(e instanceof Error ? e.message : "Lecture impossible."); }
      finally { setReading(false); }
    }}>
      {initial && <label className="block font-medium" htmlFor="lot-objectif">Votre objectif
        <input id="lot-objectif" required maxLength={160} value={objective} onChange={e => setObjective(e.target.value)}
          className="mt-2 block w-full rounded-lg border hairline-strong bg-white px-3 py-2 text-base font-normal" />
      </label>}
      <fieldset disabled={busy || reading}>
        <legend className="font-semibold">Pièces fictives à joindre</legend>
        {initial ? <>
          <p className="mt-1 text-sm text-slate-600">Le PDF et le scan sont prêts pour votre premier dépôt.</p>
          {choices(fixtures.filter(f => initialSelection.includes(f.id)))}
          <details className="mt-2"><summary className="cursor-pointer py-2 text-sm">Autres exemples</summary>
            {choices(fixtures.filter(f => !initialSelection.includes(f.id)))}
          </details>
        </> : choices(fixtures)}
      </fieldset>
      <details>
        <summary className="cursor-pointer text-sm underline underline-offset-4">Importer des copies du jeu fictif</summary>
        <p className="mt-3 text-sm text-slate-600">Téléchargez les exemples, puis choisissez leurs copies sur votre appareil. Le navigateur vérifie leur empreinte avant l’envoi.</p>
        <ul className="my-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {fixtures.map(f => <li key={f.id}><a download={f.name} href={f.href} className="underline">{f.name}</a></li>)}
        </ul>
        <label className="block text-sm">Copies à importer
          <input type="file" multiple onChange={e => { const files = Array.from(e.target.files ?? []); setCopies(files); if (files.length) setSelected([]); }}
            className="mt-2 block w-full text-sm" />
        </label>
      </details>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy || reading || (!selected.length && !copies.length) || (initial && !objective.trim())}
        className="rounded-full bg-navy-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
        {busy || reading ? "Dépôt en cours…" : initial ? "Déposer les pièces" : "Déposer le complément"}
      </button>
    </form>
  );
}
