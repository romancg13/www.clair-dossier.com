// Accueil de l'espace : ce qui demande une décision (trois priorités au plus), ce qui a changé depuis la
// dernière visite, les préférences de l'assistant et la preuve de passage du planificateur.
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from './api';
import { inputCls, Secondary } from './ui';

type Priorite = { dossier: string; dossier_titre: string; quoi: string; consequence: string; action: string; lien: string };
type Centre = {
  priorites: Priorite[];
  autres: number;
  depuis: string | null;
  changements: { dossier: string; dossier_titre: string; quand: string; quoi: string }[];
  accompli: { quand: string; quoi: string; lien: string }[];
};
const quand = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** Rien ne s'affiche s'il n'y a ni décision à prendre ni nouveauté. */
export function CentreActions() {
  const [c, setC] = useState<Centre | null>(null);
  useEffect(() => void api<Centre>('/api/actions').then(setC).catch(() => setC(null)), []);
  if (!c || (!c.priorites.length && !c.changements.length && !c.accompli.length)) return null;
  const nouveautes = c.changements.length + c.accompli.length;
  return (
    <section aria-labelledby="centre-titre" className="mt-8">
      {c.priorites.length > 0 && (
        <>
          <h2 id="centre-titre" className="text-[15px] font-medium text-navy-900">À décider maintenant</h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-3">
            {c.priorites.map((p) => (
              <li key={p.dossier} className="flex flex-col rounded-2xl border border-gold-500/50 bg-white p-4">
                <span className="text-[12px] uppercase tracking-wide text-slate-500">{p.dossier_titre}</span>
                <strong className="mt-1 text-[15px] font-semibold leading-snug text-navy-900">{p.quoi}</strong>
                <span className="mt-1 flex-1 text-[13.5px] text-slate-600">{p.consequence}</span>
                <Link to={p.lien} className="mt-3 inline-flex w-fit rounded-full bg-navy-900 px-4 py-2 text-[13.5px] font-medium text-cream-50 hover:bg-navy-800">{p.action}</Link>
              </li>
            ))}
          </ul>
          {c.autres > 0 && <p className="mt-2 text-[13px] text-slate-500">{c.autres > 1 ? `${c.autres} autres dossiers ont un point ouvert.` : 'Un autre dossier a un point ouvert.'}</p>}
        </>
      )}
      {nouveautes > 0 && c.depuis && (
        <details className="mt-4 rounded-2xl border border-cream-200 bg-white p-4" open={!c.priorites.length}>
          <summary className="cursor-pointer text-[14.5px] font-medium text-navy-900">Depuis votre dernière visite — {nouveautes} nouveauté{nouveautes > 1 ? 's' : ''}</summary>
          <ul className="mt-3 space-y-1.5 text-[14px] text-slate-700">
            {c.accompli.map((a) => (
              <li key={`a-${a.quand}`}><span className="text-slate-500">{quand(a.quand)} · </span><Link to="/boite" className="font-semibold text-navy-900 underline decoration-gold-500">{a.quoi}</Link></li>
            ))}
            {c.changements.map((x) => (
              <li key={`${x.dossier}-${x.quand}`}><span className="text-slate-500">{quand(x.quand)} · </span><Link to={`/compte/dossier/${x.dossier}`} className="font-semibold text-navy-900">{x.dossier_titre}</Link> — {x.quoi}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

/** Dernier passage du planificateur : la preuve que les automatisations tournent navigateur fermé. */
export function DernierPassage() {
  const [p, setP] = useState<{ dernier_passage_planifie: { at: string; executees: number | null } | null; suspendu: boolean } | null>(null);
  useEffect(() => void api<NonNullable<typeof p>>('/api/planificateur').then(setP).catch(() => setP(null)), []);
  if (!p) return null;
  return (
    <p className="mt-3 text-[12.5px] text-slate-500">
      {p.suspendu
        ? 'Les automatisations sont momentanément suspendues par l’exploitant ; vos dossiers et résultats restent disponibles.'
        : p.dernier_passage_planifie
          ? `Dernier passage automatique : ${quand(p.dernier_passage_planifie.at)}. Passage quotidien, même navigateur fermé.`
          : 'Passage automatique quotidien, même navigateur fermé. Aucun passage enregistré pour le moment.'}
    </p>
  );
}

type Pref = { id: string; text: string };
/** Préférences de travail du titulaire : écrites par lui, visibles, supprimables. */
export function Preferences() {
  const [list, setList] = useState<Pref[]>([]);
  const [texte, setTexte] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => void api<{ preferences: Pref[] }>('/api/memoire').then((r) => setList(r.preferences)).catch(() => setList([])), []);
  useEffect(load, [load]);
  const add = async (e: FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await api('/api/memoire', { body: { texte } });
      setTexte('');
      load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Enregistrement impossible.');
    }
  };
  return (
    <details className="mt-4 rounded-2xl border border-cream-200 bg-white p-5">
      <summary className="cursor-pointer text-[15px] font-medium text-navy-900">Mes préférences pour ClairDossier IA{list.length ? ` (${list.length})` : ''}</summary>
      <p className="mt-3 text-[14px] text-slate-500">Une habitude à retenir : un ton, une signature, une règle de travail. Vous seul les voyez ; elles ne servent qu’à vos demandes.</p>
      <ul className="mt-3 space-y-2">
        {list.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 text-[14px]">
            <span>{p.text}</span>
            <Secondary onClick={async () => { await api(`/api/memoire/${p.id}`, { method: 'DELETE' }).catch(() => undefined); load(); }}>Oublier</Secondary>
          </li>
        ))}
      </ul>
      <form onSubmit={add} className="mt-3 flex flex-wrap gap-2">
        <input className={`${inputCls} min-w-0 flex-1`} aria-label="Nouvelle préférence" maxLength={200} placeholder="Ex. : terminer mes courriers par « Cordialement, C. Roche »" value={texte} onChange={(e) => setTexte(e.target.value)} />
        <button type="submit" className="inline-flex min-h-11 items-center justify-center rounded-full border border-navy-900/15 bg-white px-5 py-2.5 text-[14px] font-medium text-navy-900 transition hover:border-gold-500">Retenir</button>
      </form>
      {err && <p role="alert" className="mt-2 text-[13px] text-red-700">{err}</p>}
    </details>
  );
}
