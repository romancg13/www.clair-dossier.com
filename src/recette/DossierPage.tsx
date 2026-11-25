// Espace d'un dossier : en tête, l'état réel, la situation en deux phrases et UN geste ;
// puis « Vos résultats » et « Vos pièces » ; historique, prestations et clôture au second niveau.
// Une seule source (la vue publiée par le serveur) alimente statut, geste et rendus.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Seo } from '../lib/seo';
import { api, ApiError, ETAT_LABEL, frDate, type DossierDetail, type RenduView } from './api';
import { Alert, Card, Chip, Kicker, Page, Primary, Secondary, inputCls } from './ui';
import { IntelligenceLauncher } from '../components/intelligence/IntelligencePanel';
import type { PendingAction, Reply } from '../../supabase/functions/_shared/intelligence/core';

type Section = 'resume' | 'chronologie' | 'dates' | 'echeances' | 'relances' | 'dashboard';
const EXEMPLES = {
  initial: ['Courrier-bailleur-2026-10-12.pdf', 'Avis-echeance-T4-2026.pdf', 'Releve-charges-2025.xlsx', 'Courriel-2026-10-20.eml'],
  complement: ['Bail-commercial-2021.pdf', 'Bail signé (copie).pdf'],
};

function srcLabel(s: { piece: string; where: string | null } | null) {
  return s ? `${s.piece}${s.where ? `, ${s.where}` : ''}` : 'non sourcé';
}

function Fiabilite({ r }: { r: { level: 'elevee' | 'a_verifier'; reasons: string[] } }) {
  return r.level === 'elevee' ? <Chip tone="ok">Fiabilité élevée</Chip> : <Chip tone="warn">À vérifier : {r.reasons.join(', ')}</Chip>;
}

/** Au-delà, le fichier part directement vers le stockage privé (pas de transit par l'API). */
const PETIT = 4 * 1024 * 1024;

export function DossierPage() {
  const { id = '' } = useParams();
  const [d, setD] = useState<DossierDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Section | null>(null);
  const [upload, setUpload] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      setD(await api<DossierDetail>(`/api/dossiers/${id}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Dossier indisponible.');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);
  // Historique privé de l'assistant (titulaire uniquement) ; absent si l'assistant n'est pas servi.
  const [iaHist, setIaHist] = useState<{ from: 'vous' | 'ia'; text: string }[] | null>(null);
  useEffect(() => {
    if (!id) return;
    api<{ historique: { from: 'vous' | 'ia'; text: string }[] }>(`/api/dossiers/${id}/assistant`).then((r) => setIaHist(r.historique)).catch(() => setIaHist(null));
  }, [id]);
  // Lecture en cours : actualisation automatique (le traitement continue même si la page est fermée).
  useEffect(() => {
    if (!d || d.statut.etat !== 'en_cours') return;
    const t = setInterval(() => void load(), 4000);
    return () => clearInterval(t);
  }, [d, load]);

  async function deposer(files: File[]) {
    if (!files.length) return;
    const lot = crypto.randomUUID();
    setUpload({ done: 0, total: files.length });
    setNotice(null);
    let recus = 0;
    try {
      // Envoi par 4 fichiers à la fois. Jusqu'à 4 Mo : dépôt classique. Au-delà : dépôt direct vers le
      // stockage privé (autorisation courte délivrée par le serveur, puis confirmation), sans transit par l'API.
      const queue = [...files];
      const envoyer = async (f: File) => {
        if (f.size <= PETIT) {
          const form = new FormData();
          form.append('lot', lot);
          form.append('total', String(files.length));
          form.append('fichiers', f, f.name);
          await api(`/api/dossiers/${id}/pieces`, { form });
          return;
        }
        const a = await api<{ mode: 'direct' | 'serveur'; id?: string; pathname?: string; token?: string }>(`/api/dossiers/${id}/pieces/autoriser`, { body: { nom: f.name, taille: f.size, type: f.type, lot, total: files.length } });
        if (a.mode !== 'direct' || !a.id || !a.pathname || !a.token) throw new ApiError(413, `« ${f.name} » dépasse 4 Mo : le dépôt direct n’est pas disponible ici.`);
        const { put } = await import('@vercel/blob/client');
        await put(a.pathname, f, { access: 'private', token: a.token, contentType: f.type || undefined, multipart: f.size > 8 * 1024 * 1024 });
        // La confirmation est idempotente : on la rejoue si le fichier n'est pas encore visible du serveur.
        for (let essai = 0; ; essai++) {
          try {
            await api(`/api/dossiers/${id}/pieces/confirmer`, { body: { id: a.id } });
            return;
          } catch (e) {
            if (!(e instanceof ApiError) || e.status !== 409 || essai >= 4) throw e;
            await new Promise((r) => setTimeout(r, 800 * (essai + 1)));
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(4, files.length) }, async () => {
          for (let f = queue.shift(); f; f = queue.shift()) {
            await envoyer(f);
            recus++;
            setUpload({ done: recus, total: files.length });
          }
        }),
      );
      setNotice('Pièces reçues. La lecture a commencé : vous pouvez fermer cette page, les résultats vous attendront ici.');
    } catch (e) {
      if (e instanceof ApiError && e.redirect) window.location.assign(e.redirect);
      setNotice(e instanceof ApiError ? e.message : 'Dépôt interrompu. Réessayez.');
    } finally {
      // Envoi arrêté avant le dernier fichier : le lot est clos sur les pièces reçues (sinon, clôture automatique après 10 min).
      if (recus > 0 && recus < files.length) await api(`/api/dossiers/${id}/lots/${lot}/fin`, { body: {} }).catch(() => undefined);
      setUpload(null);
      void load();
    }
  }

  async function exemples(kind: keyof typeof EXEMPLES) {
    const files = await Promise.all(EXEMPLES[kind].map(async (n) => new File([await (await fetch(`/recette/pieces/${encodeURIComponent(n)}`)).blob()], n)));
    await deposer(files);
  }

  // Action préparée par l'assistant : enregistrée seulement après confirmation explicite, côté serveur.
  async function confirmerAction(a: PendingAction): Promise<string> {
    try {
      const r = await api<{ message: string }>('/api/automatisations', { body: { action: a, dossier: id } });
      return r.message;
    } catch (e) {
      return e instanceof ApiError ? e.message : 'L’enregistrement a échoué : rien n’a été modifié.';
    }
  }

  async function ouvrir(categorie: string, nom: string, telecharger = false) {
    try {
      const { url } = await api<{ url: string }>(`/api/dossiers/${id}/lien`, { body: { categorie, nom } });
      if (telecharger) window.location.assign(url);
      else window.open(`${url}?affichage=1`, '_blank', 'noopener');
    } catch (e) {
      setNotice(e instanceof ApiError ? e.message : 'Fichier indisponible.');
    }
  }

  function geste(v: RenduView) {
    const t = v.tableau.action.target;
    if (t === 'pieces') dropRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    else if (t) {
      setOpen(t === 'echeances' ? 'echeances' : (t as Section));
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  }

  if (error) return <Page narrow><Alert tone="error">{error}</Alert><p className="mt-4"><Link to="/compte" className="underline">Retour à mes dossiers</Link></p></Page>;
  if (!d) return <Page narrow><p role="status" className="text-slate-500">Ouverture du dossier…</p></Page>;

  const v = d.vue;
  const etat = d.statut.etat;
  const lues = d.pieces.filter((p) => p.lecture && !p.doublon_de).length;
  const principales = d.pieces.filter((p) => !p.doublon_de).length;
  const ORDRE = ['dashboard', 'resume', 'echeances', 'chronologie', 'dates', 'relances'];
  const disponibles = d.rendus.filter((r) => r.fichiers.length).sort((a, b) => ORDRE.indexOf(a.cle) - ORDRE.indexOf(b.cle));

  return (
    <Page>
      <Seo title={`${d.dossier.titre} — votre dossier`} description="Espace privé du dossier." path={`/compte/dossier/${id}`} noindex />
      <Link to="/compte" className="text-[14px] text-slate-500 hover:text-navy-900">← Mes dossiers</Link>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Chip tone={etat === 'pret' ? 'ok' : etat === 'en_cours' ? 'busy' : etat === 'incident' ? 'warn' : 'neutral'}>{ETAT_LABEL[etat]}</Chip>
        {v && <span className="text-[13px] text-slate-500">Situation au {frDate(v.dossier.as_of)} · {v.dossier.coverage_label}</span>}
      </div>
      <h1 className="mt-3 font-display text-[34px] leading-tight text-navy-900 sm:text-[42px]">{d.dossier.titre}</h1>

      {/* ── En tête : situation, geste, prochaine date ── */}
      <Card className="mt-6">
        {etat === 'en_cours' && (
          <p role="status" aria-live="polite" className="mb-4 text-[15px] text-navy-900">
            Lecture de vos pièces : {lues}/{principales}. Vous pouvez fermer cette page : les résultats vous attendront ici.
          </p>
        )}
        {v ? (
          <>
            <Kicker>Situation</Kicker>
            <p className="mt-2 text-[18px] leading-relaxed text-navy-900 sm:text-[19px]">{v.tableau.situation}</p>
            <div className="mt-5 flex flex-col gap-3 border-t border-cream-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <Kicker>Votre prochaine action</Kicker>
                <p className="mt-1 text-[15px] text-slate-500">{v.tableau.action.rationale}</p>
                <p className="mt-1 text-[13px] text-slate-500">Responsable : {v.tableau.action.owner_label}{v.tableau.action.due_date ? ` · avant le ${frDate(v.tableau.action.due_date)}` : ''}</p>
              </div>
              {v.tableau.action.target ? <Primary onClick={() => geste(v)}>{v.tableau.action.label}</Primary> : <Chip>Rien à faire pour le moment</Chip>}
            </div>
            {v.tableau.cabinet && <p className="mt-4 text-[14px] text-navy-900"><strong>Votre cabinet :</strong> {v.tableau.cabinet}</p>}
            {v.dossier.simulation && <p className="mt-4 text-[12.5px] text-slate-500">Analyse produite par règles déterministes (sans IA) : à vérifier.</p>}
          </>
        ) : d.en_verification ? (
          <p className="text-[16px] text-navy-900">Vos résultats sont prêts et en cours de vérification avant mise à disposition.</p>
        ) : etat === 'vide' ? (
          <p className="text-[16px] text-navy-900">Déposez vos pièces : vous retrouverez ici la situation, vos dates importantes et votre prochaine action.</p>
        ) : etat === 'incident' ? (
          <p className="text-[16px] text-navy-900">La lecture a été interrompue. Vos pièces sont conservées ; un nouveau dépôt relance la lecture.</p>
        ) : null}
      </Card>

      {notice && <div className="mt-4"><Alert>{notice}</Alert></div>}

      {/* ── Vos résultats ── */}
      <div ref={resultsRef} className="scroll-mt-24" />
      <div className="mt-10 flex flex-wrap items-end justify-between gap-3">
        <h2 className="font-display text-[26px] text-navy-900">Vos résultats</h2>
        <div className="flex flex-wrap items-center gap-2">
          {d.abonnement.active && (
            <IntelligenceLauncher
              key={iaHist ? 'h' : 'v'}
              initial={iaHist ?? undefined}
              transport={async (message) => (await api<{ reponse: Reply & { notice?: string } }>(`/api/dossiers/${id}/assistant`, { body: { message } })).reponse}
              suggestions={v ? ['Résume ce dossier.', 'Prépare mes prochaines démarches.', 'Quelles sont mes échéances ?', 'Chaque vendredi, prépare le bilan de mes dossiers.'] : ['Où en est mon dossier ?']}
              onFile={(cle) => {
                const r = d.rendus.find((x) => x.cle === cle);
                const f = r?.fichiers.find((x) => x.nom.endsWith('.pdf')) ?? r?.fichiers[0];
                if (f) void ouvrir(cle, f.nom);
              }}
              onConfirm={confirmerAction}
            />
          )}
          {disponibles.length > 0 && <Secondary href={`/api/dossiers/${id}/archive`} download>Tout télécharger (.zip)</Secondary>}
        </div>
      </div>
      {!v || !disponibles.length ? (
        <p className="mt-3 text-[15px] text-slate-500">{etat === 'en_cours' ? 'En préparation : ils apparaîtront ici dès la fin de la lecture.' : 'Aucun résultat pour le moment.'}</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {disponibles.map((r) => {
            const pdf = r.fichiers.find((f) => f.nom.endsWith('.pdf'));
            const resume = resumeOf(r.cle as Section, v);
            return (
              <Card key={r.cle} className="flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-[16px] font-semibold text-navy-900">{r.libelle}</h3>
                  {r.versions > 0 && <span className="text-[12px] text-slate-500">version {r.revision}</span>}
                </div>
                <p className="mt-1 flex-1 text-[14px] text-slate-500">{resume}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Secondary onClick={() => setOpen(open === r.cle ? null : (r.cle as Section))}>{open === r.cle ? 'Masquer' : 'Voir ici'}</Secondary>
                  {pdf && <Secondary onClick={() => void ouvrir(r.cle, pdf.nom)}>PDF</Secondary>}
                  {r.fichiers.filter((f) => !f.nom.endsWith('.pdf')).map((f) => (
                    <Secondary key={f.nom} onClick={() => void ouvrir(r.cle, f.nom, true)}>{f.nom.split('.').pop()!.toUpperCase()}</Secondary>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      {v && open && <div className="mt-4"><Detail section={open} v={v} id={id} onChange={load} /></div>}

      {/* ── Vos pièces ── */}
      <h2 className="mt-12 font-display text-[26px] text-navy-900">Vos pièces</h2>
      {v?.tableau.next_date ? (
        <p className="mt-2 text-[15px] text-navy-900">
          Prochaine date : <strong>{frDate(v.tableau.next_date.date)}</strong> — {v.tableau.next_date.title} ({v.tableau.next_date.status === 'confirmee' ? 'date confirmée' : 'à confirmer'}, {srcLabel(v.tableau.next_date.source)}).
        </p>
      ) : v ? (
        <p className="mt-2 text-[15px] text-slate-500">Aucune date confirmée dans les pièces du dossier.</p>
      ) : null}
      <div
        ref={dropRef}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void deposer([...e.dataTransfer.files]);
        }}
        className="mt-4 rounded-2xl border-2 border-dashed border-cream-200 bg-white p-6 text-center scroll-mt-24"
      >
        {d.dossier.cloture ? (
          <p className="text-[15px] text-slate-500">Dossier clôturé : rouvrez-le pour ajouter des pièces.</p>
        ) : upload ? (
          <p role="status" className="text-[15px] text-navy-900">Envoi : {upload.done}/{upload.total}…</p>
        ) : (
          <>
            <p className="text-[15px] text-navy-900">Glissez vos pièces ici ou</p>
            <label className="mt-3 inline-flex cursor-pointer"><span className="inline-flex min-h-11 items-center rounded-full bg-navy-900 px-6 py-3 text-[15px] font-semibold text-white">Choisir des fichiers</span>
              <input type="file" multiple className="sr-only" accept=".pdf,.jpg,.jpeg,.png,.webp,.docx,.xlsx,.csv,.txt,.eml" onChange={(e) => void deposer([...(e.target.files ?? [])])} />
            </label>
            <p className="mt-3 text-[13px] text-slate-500">PDF, photos, Word, tableurs, courriels · 25 Mo par fichier.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 text-[13px]">
              <span className="text-slate-500">Pièces fictives :</span>
              <button type="button" className="underline decoration-gold-500" onClick={() => void exemples('initial')}>lot initial (4)</button>
              <button type="button" className="underline decoration-gold-500" onClick={() => void exemples('complement')}>bail + doublon</button>
            </div>
          </>
        )}
      </div>
      <ul className="mt-4 divide-y divide-cream-200 rounded-2xl border border-cream-200 bg-white">
        {d.pieces.map((p) => (
          <li key={p.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="break-all text-[14px] text-navy-900">{p.nom}</span>
            <span className="text-[13px] text-slate-500">
              {p.doublon_de ? 'Doublon : prise en compte une seule fois' : !p.lecture ? 'En cours de lecture' : p.lecture.statut === 'ok' ? 'Lue' : p.lecture.report ? 'Lecture reportée (pièce conservée)' : p.lecture.motif}
            </span>
          </li>
        ))}
        {!d.pieces.length && <li className="px-4 py-3 text-[14px] text-slate-500">Aucune pièce déposée.</li>}
      </ul>

      {/* ── Second niveau ── */}
      <details className="mt-10 rounded-2xl border border-cream-200 bg-white p-5">
        <summary className="cursor-pointer text-[15px] font-medium text-navy-900">Préparer un document (option)</summary>
        <Prestations id={id} hasView={Boolean(v)} />
      </details>
      <details className="mt-3 rounded-2xl border border-cream-200 bg-white p-5">
        <summary className="cursor-pointer text-[15px] font-medium text-navy-900">Historique et clôture</summary>
        <ul className="mt-3 space-y-1 text-[14px] text-slate-500">
          {d.historique.map((h) => <li key={h.id}>{new Date(h.created_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })} — {h.label}</li>)}
        </ul>
        <div className="mt-4">
          <Secondary onClick={async () => { await api(`/api/dossiers/${id}/cloture`, { body: { cloture: !d.dossier.cloture } }); void load(); }}>{d.dossier.cloture ? 'Rouvrir le dossier' : 'Clôturer le dossier'}</Secondary>
        </div>
      </details>
    </Page>
  );
}

function resumeOf(k: Section, v: RenduView): string {
  switch (k) {
    case 'dashboard': return `${v.tableau.action.label} · ${v.tableau.next_date ? `prochaine date le ${frDate(v.tableau.next_date.date)}` : 'aucune date confirmée'}`;
    case 'resume': return `${v.resume.facts.length} faits déterminants, sourcés${v.resume.missing.length ? ` · ${v.resume.missing.length} pièce(s) absente(s)` : ''}`;
    case 'chronologie': return `${v.chronologie.milestones.length} jalons · ${v.chronologie.all.filter((e) => !e.hidden).length} événements en annexe`;
    case 'dates': return `${v.dates.rows.length} dates, modifiables avec la raison${v.dates.history.length ? ` · ${v.dates.history.length} correction(s)` : ''}`;
    case 'echeances': return v.echeances.none_confirmed ? 'Aucune date confirmée' : `${v.echeances.confirmed.length} confirmée(s) · ${v.echeances.to_confirm.length} à confirmer`;
    case 'relances': return v.relances.drafts.length ? `${v.relances.drafts.length} brouillon(s) prêt(s) à copier` : 'Aucune relance utile';
  }
}

function Detail({ section, v, id, onChange }: { section: Section; v: RenduView; id: string; onChange: () => void }) {
  if (section === 'dashboard') return null;
  if (section === 'resume')
    return (
      <Card>
        <ul className="space-y-4">
          {v.resume.facts.map((f, i) => (
            <li key={i}>
              <p className="text-[15px] text-navy-900">{f.text}</p>
              <p className="mt-1 flex flex-wrap items-center gap-2 text-[12.5px] text-slate-500">{f.status} · {srcLabel(f.source)} <Fiabilite r={f.reliability} /></p>
            </li>
          ))}
        </ul>
        {v.resume.missing.length > 0 && (<><h3 className="mt-5 text-[14px] font-semibold text-navy-900">Pièces absentes du lot</h3><ul className="mt-2 list-disc pl-5 text-[14px] text-slate-500">{v.resume.missing.map((m, i) => <li key={i}>{m.label} — {m.why}</li>)}</ul></>)}
      </Card>
    );
  if (section === 'chronologie')
    return (
      <Card>
        <ol className="space-y-3">
          {v.chronologie.milestones.map((m) => (
            <li key={m.key}><p className="text-[15px] text-navy-900"><strong>{frDate(m.date)}</strong> — {m.label}{m.corrected ? ' (date corrigée)' : ''}</p><p className="mt-1 flex flex-wrap gap-2 text-[12.5px] text-slate-500">Importance : {m.importance} · {srcLabel(m.source)} <Fiabilite r={m.reliability} /></p></li>
          ))}
        </ol>
        <details className="mt-4"><summary className="cursor-pointer text-[14px] text-navy-900">Tous les événements ({v.chronologie.all.length})</summary><ul className="mt-2 space-y-1 text-[13.5px] text-slate-500">{v.chronologie.all.filter((e) => !e.hidden).map((e) => <li key={e.key}>{frDate(e.date)} — {e.label}</li>)}</ul></details>
      </Card>
    );
  if (section === 'dates') return <Dates v={v} id={id} onChange={onChange} />;
  if (section === 'echeances') {
    const row = (x: RenduView['echeances']['confirmed'][number]) => <li key={x.key} className="py-2"><p className="text-[15px] text-navy-900"><strong>{frDate(x.date)}</strong> — {x.title}</p><p className="mt-1 flex flex-wrap gap-2 text-[12.5px] text-slate-500">{x.nature} · Responsable : {x.owner} · {srcLabel(x.source)} <Fiabilite r={x.reliability} /></p></li>;
    return (
      <Card>
        <h3 className="text-[14px] font-semibold text-navy-900">Dates confirmées</h3>
        {v.echeances.none_confirmed ? <p className="mt-1 text-[14px] text-slate-500">Aucune date confirmée dans les pièces du dossier.</p> : <ul>{v.echeances.confirmed.map(row)}</ul>}
        {v.echeances.to_confirm.length > 0 && <><h3 className="mt-4 text-[14px] font-semibold text-navy-900">À confirmer</h3><ul>{v.echeances.to_confirm.map(row)}</ul></>}
        {v.echeances.past.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-[14px]">Dates passées ({v.echeances.past.length})</summary><ul>{v.echeances.past.map(row)}</ul></details>}
      </Card>
    );
  }
  return (
    <Card>
      {!v.relances.drafts.length && <p className="text-[14px] text-slate-500">Aucune relance utile pour le moment.</p>}
      {v.relances.drafts.map((r, i) => (
        <div key={i} className="border-b border-cream-200 py-3 last:border-0">
          <p className="text-[15px] font-semibold text-navy-900">{r.subject}</p>
          <p className="text-[13px] text-slate-500">Destinataire : {r.recipient} · {r.condition}</p>
          <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-cream-50 p-3 font-sans text-[14px] text-navy-900">{r.body}</pre>
          <div className="mt-2"><Secondary onClick={() => void navigator.clipboard?.writeText(`${r.subject}\n\n${r.body}`)}>Copier le message</Secondary></div>
        </div>
      ))}
      <p className="mt-2 text-[12.5px] text-slate-500">Brouillons : rien n’est envoyé automatiquement.</p>
    </Card>
  );
}

function Dates({ v, id, onChange }: { v: RenduView; id: string; onChange: () => void }) {
  const [edit, setEdit] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [raison, setRaison] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  async function save(cle: string) {
    try {
      await api(`/api/dossiers/${id}/dates`, { body: { cle, date, raison } });
      setEdit(null);
      setMsg('Correction enregistrée : les documents sont mis à jour.');
      onChange();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Correction impossible.');
    }
  }
  async function formulaire(f: File | undefined) {
    if (!f) return;
    const form = new FormData();
    form.append('fichier', f);
    try {
      const r = await api<{ corrigees: number; conflits?: string[]; ignorees?: string[]; introuvables?: string[] }>(`/api/dossiers/${id}/dates/formulaire`, { form });
      const parts: string[] = [];
      if (r.corrigees) parts.push(r.corrigees > 1 ? `${r.corrigees} dates corrigées depuis le formulaire.` : 'Une date corrigée depuis le formulaire.');
      if (r.conflits?.length) parts.push(`Non appliqué, car la date a été modifiée depuis l’impression du formulaire : ${r.conflits.join(' ; ')}. Téléchargez le formulaire à jour pour la corriger.`);
      if (r.introuvables?.length) parts.push(`Non appliqué, car ${r.introuvables.length > 1 ? 'ces lignes ne figurent' : 'cette ligne ne figure'} plus dans le dossier : ${r.introuvables.join(' ; ')}. Téléchargez le formulaire à jour.`);
      if (r.ignorees?.length) parts.push(`Date illisible ou inexistante, non prise en compte : ${r.ignorees.join(' ; ')} (format attendu : JJ/MM/AAAA).`);
      setMsg(parts.length ? parts.join(' ') : 'Aucune modification trouvée dans le formulaire.');
      onChange();
    } catch (e) {
      setMsg(e instanceof ApiError ? e.message : 'Formulaire illisible.');
    }
  }
  return (
    <Card>
      {msg && <div className="mb-3"><Alert>{msg}</Alert></div>}
      <ul className="divide-y divide-cream-200">
        {v.dates.rows.filter((r) => r.status !== 'masquee').map((r) => (
          <li key={r.key} className="py-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[15px] text-navy-900"><strong>{frDate(r.retained)}</strong> — {r.label}</p>
                <p className="text-[12.5px] text-slate-500">Extraite : {frDate(r.extracted)} · {srcLabel(r.source)}{r.status === 'corrigee' ? ` · corrigée (${r.reason})` : ''}</p>
                {r.flag && <p className="mt-1"><Chip tone="warn">{r.flag}</Chip></p>}
              </div>
              {edit !== r.key && <Secondary onClick={() => { setEdit(r.key); setDate(r.retained); setRaison(''); }}>Corriger</Secondary>}
            </div>
            {edit === r.key && (
              <form className="mt-3 grid gap-2 sm:grid-cols-[160px_1fr_auto]" onSubmit={(e) => { e.preventDefault(); void save(r.key); }}>
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} aria-label="Date retenue" />
                <input required value={raison} onChange={(e) => setRaison(e.target.value)} placeholder="Raison de la correction" className={inputCls} aria-label="Raison" />
                <Primary type="submit">Enregistrer</Primary>
              </form>
            )}
          </li>
        ))}
      </ul>
      <label className="mt-4 block text-[13.5px] text-slate-500">Vous avez rempli le formulaire PDF ? Déposez-le ici : <input type="file" accept="application/pdf" className="mt-1 block" onChange={(e) => void formulaire(e.target.files?.[0])} /></label>
    </Card>
  );
}

function Prestations({ id, hasView }: { id: string; hasView: boolean }) {
  const [out, setOut] = useState<unknown>(null);
  const [err, setErr] = useState<string | null>(null);
  const run = async (k: string, body: unknown = {}) => {
    setErr(null);
    try {
      setOut(await api(`/api/dossiers/${id}/prestations/${k}`, { body }));
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Indisponible.');
    }
  };
  const o = out as { brouillon?: { objet: string; corps: string }; fiche?: { objectif: string; questions: string[]; pieces: string[] } } | null;
  return (
    <div className="mt-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        {hasView && <Secondary onClick={() => void run('justificatifs')}>Demande groupée de justificatifs</Secondary>}
        {hasView && <Secondary onClick={() => void run('rendez-vous')}>Fiche de préparation de rendez-vous</Secondary>}
      </div>
      {err && <Alert tone="error">{err}</Alert>}
      {o?.brouillon && <Card><p className="font-semibold text-navy-900">{o.brouillon.objet}</p><pre className="mt-2 whitespace-pre-wrap font-sans text-[14px] text-navy-900">{o.brouillon.corps}</pre></Card>}
      {o?.fiche && <Card><p className="font-semibold text-navy-900">Objectif</p><p className="text-[14px]">{o.fiche.objectif}</p><p className="mt-3 font-semibold text-navy-900">Trois questions</p><ol className="list-decimal pl-5 text-[14px]">{o.fiche.questions.map((q) => <li key={q}>{q}</li>)}</ol><p className="mt-3 font-semibold text-navy-900">Pièces à apporter</p><ul className="list-disc pl-5 text-[14px]">{o.fiche.pieces.map((q) => <li key={q}>{q}</li>)}</ul></Card>}
      <p className="text-[12.5px] text-slate-500">Brouillons uniquement : rien n’est envoyé automatiquement.</p>
    </div>
  );
}
