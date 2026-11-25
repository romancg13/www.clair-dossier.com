// Pages du parcours privé de recette : connexion, inscription, compte, nouveau dossier,
// offres et paiement simulé, boîte de recette, exceptions d'administration.
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Seo } from '../lib/seo';
import { api, ApiError, ETAT_LABEL, frDate, type DossierListe } from './api';
import { useMoi } from './useMoi';
import { Alert, Card, Chip, Field, Kicker, Page, Primary, Secondary, inputCls } from './ui';

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : null);

export function RecetteConnexion() {
  const [q] = useSearchParams();
  const nav = useNavigate();
  const { refresh } = useMoi();
  const [email, setEmail] = useState('');
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const reinit = q.get('reinitialisation');
  const next = safeNext(q.get('next'));
  const go = async () => {
    const m = await refresh();
    const dest = next ?? (m?.abonnement?.active ? '/compte' : '/tarifs');
    if (dest.startsWith('/oauth/')) window.location.assign(dest);
    else nav(dest, { replace: true });
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (reinit) await api('/api/auth/reinitialisation/confirmer', { body: { token: reinit, password: pwd } });
      else await api('/api/auth/connexion', { body: { email, password: pwd } });
      await go();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Connexion impossible.');
    } finally {
      setBusy(false);
    }
  };
  const demo = async (scenario: string) => {
    setBusy(true);
    setErr(null);
    try {
      await api('/api/demo/demarrer', { body: { scenario } });
      await go();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Démonstration indisponible pour le moment.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page narrow>
      <Seo title="Connexion" description="Accédez à votre espace ClairDossier." path="/connexion" noindex />
      <h1 className="font-display text-[36px] text-navy-900">{reinit ? 'Nouveau mot de passe' : 'Connexion'}</h1>
      <Card className="mt-6">
        <form onSubmit={submit} className="space-y-4">
          {!reinit && <Field label="E-mail"><input className={inputCls} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>}
          <Field label={reinit ? 'Nouveau mot de passe (10 caractères minimum)' : 'Mot de passe'}><input className={inputCls} type="password" autoComplete={reinit ? 'new-password' : 'current-password'} required value={pwd} onChange={(e) => setPwd(e.target.value)} /></Field>
          {err && <Alert tone="error">{err}</Alert>}
          <Primary type="submit" disabled={busy}>{reinit ? 'Enregistrer et me connecter' : 'Se connecter'}</Primary>
        </form>
        {!reinit && (
          <div className="mt-4 flex flex-wrap gap-4 text-[14px]">
            <Link to={`/inscription${next ? `?next=${encodeURIComponent(next)}` : ''}`} className="underline decoration-gold-500">Créer un compte</Link>
            <button type="button" className="underline decoration-gold-500" onClick={async () => { await api('/api/auth/reinitialisation', { body: { email } }); setErr(null); alert('Si un compte existe, un lien a été déposé dans la boîte de recette.'); }}>Mot de passe oublié</button>
          </div>
        )}
      </Card>
      <Card className="mt-4">
        <Kicker>Recette · comptes fictifs isolés</Kicker>
        <p className="mt-2 text-[14px] text-slate-500">Chaque essai crée un compte fictif qui n’est visible que par vous.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Secondary onClick={() => void demo('a')}>Abonnée (Camille Roche)</Secondary>
          <Secondary onClick={() => void demo('sans-abonnement')}>Sans abonnement</Secondary>
        </div>
      </Card>
    </Page>
  );
}

export function RecetteInscription() {
  const [q] = useSearchParams();
  const nav = useNavigate();
  const { refresh } = useMoi();
  const [f, setF] = useState({ first_name: '', last_name: '', email: '', password: '', company: '' });
  const [societe, setSociete] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await api('/api/auth/inscription', { body: { ...f, company: societe ? f.company : '' } });
      await refresh();
      nav(safeNext(q.get('next')) ?? '/tarifs', { replace: true });
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Inscription impossible.');
    }
  };
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });
  return (
    <Page narrow>
      <Seo title="Créer un compte" description="Créez votre compte ClairDossier." path="/inscription" noindex />
      <h1 className="font-display text-[36px] text-navy-900">Créer un compte</h1>
      <Card className="mt-6">
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom"><input className={inputCls} autoComplete="given-name" required value={f.first_name} onChange={set('first_name')} /></Field>
            <Field label="Nom"><input className={inputCls} autoComplete="family-name" required value={f.last_name} onChange={set('last_name')} /></Field>
          </div>
          <Field label="E-mail"><input className={inputCls} type="email" autoComplete="email" required value={f.email} onChange={set('email')} /></Field>
          <Field label="Mot de passe" hint="10 caractères minimum"><input className={inputCls} type="password" autoComplete="new-password" required minLength={10} value={f.password} onChange={set('password')} /></Field>
          {societe ? <Field label="Société"><input className={inputCls} autoComplete="organization" value={f.company} onChange={set('company')} /></Field> : <button type="button" className="text-[14px] underline decoration-gold-500" onClick={() => setSociete(true)}>J’agis pour une société</button>}
          {err && <Alert tone="error">{err}</Alert>}
          <Primary type="submit">Créer mon compte</Primary>
        </form>
      </Card>
    </Page>
  );
}

export function RecetteCompte() {
  const { moi, refresh } = useMoi();
  const [q] = useSearchParams();
  const [list, setList] = useState<DossierListe[] | null>(null);
  const [conns, setConns] = useState<{ client_id: string; nom: string; depuis: string }[]>([]);
  const paiement = q.get('paiement');
  useEffect(() => {
    void api<{ dossiers: DossierListe[] }>('/api/dossiers').then((r) => setList(r.dossiers)).catch(() => setList([]));
    void api<{ connexions: typeof conns }>('/api/connexions').then((r) => setConns(r.connexions)).catch(() => undefined);
  }, []);
  // Retour de paiement : l'abonnement n'est actif qu'après confirmation serveur (événement signé).
  useEffect(() => {
    if (!paiement || moi?.abonnement?.active) return;
    const t = setInterval(() => void refresh(), 1500);
    return () => clearInterval(t);
  }, [paiement, moi?.abonnement?.active, refresh]);
  const ab = moi?.abonnement;
  return (
    <Page>
      <Seo title="Mes dossiers" description="Espace privé." path="/compte" noindex />
      <Kicker>Bonjour {moi?.user?.prenom}</Kicker>
      <h1 className="mt-2 font-display text-[38px] text-navy-900">Mes dossiers</h1>
      {paiement && <div className="mt-4"><Alert tone={ab?.active ? 'ok' : 'info'}>{ab?.active ? `Abonnement ${ab.plan_name} actif.` : 'Paiement reçu : confirmation en cours…'}</Alert></div>}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        {ab?.active ? <Primary to="/dossier/nouveau">Nouveau dossier</Primary> : <Primary to="/tarifs">Choisir une formule</Primary>}
        <span className="text-[13.5px] text-slate-500">{ab?.active ? `Formule ${ab.plan_name}${ab.period_end ? ` · jusqu’au ${frDate(ab.period_end)}` : ''}${ab.cancel_at_period_end || ab.status === 'canceled' ? ' (résiliée à terme)' : ''}` : 'Aucun abonnement actif : le dépôt de pièces est réservé aux abonnés.'}</span>
      </div>
      <ul className="mt-6 grid gap-3">
        {list?.map((d) => (
          <li key={d.id}>
            <Link to={`/compte/dossier/${d.id}`} className="block rounded-2xl border border-cream-200 bg-white p-5 transition hover:border-gold-500">
              <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-[17px] font-semibold text-navy-900">{d.titre}</span><Chip tone={d.etat === 'pret' ? 'ok' : d.etat === 'en_cours' ? 'busy' : 'neutral'}>{ETAT_LABEL[d.etat]}</Chip></div>
              <p className="mt-1 text-[14px] text-slate-500">{d.action ? `Prochaine action : ${d.action}` : `${d.pieces} pièce(s)`}</p>
            </Link>
          </li>
        ))}
        {list && !list.length && <li className="text-[15px] text-slate-500">Aucun dossier pour le moment.</li>}
      </ul>
      <details className="mt-10 rounded-2xl border border-cream-200 bg-white p-5">
        <summary className="cursor-pointer text-[15px] font-medium text-navy-900">Suivi depuis ChatGPT ou Claude (lecture seule)</summary>
        <p className="mt-3 text-[14px] text-slate-500">Adresse du serveur : <code className="rounded bg-cream-100 px-1.5 py-0.5">{window.location.origin}/mcp</code>. Accès en lecture seule à l’état de vos dossiers, sans les pièces ; vous l’autorisez à la première connexion et pouvez le retirer ici.</p>
        <ul className="mt-3 space-y-2">
          {conns.map((c) => <li key={c.client_id} className="flex items-center justify-between gap-3 text-[14px]"><span>{c.nom} — depuis le {frDate(c.depuis)}</span><Secondary onClick={async () => { await api(`/api/connexions/${c.client_id}`, { method: 'DELETE' }); setConns(conns.filter((x) => x.client_id !== c.client_id)); }}>Retirer</Secondary></li>)}
          {!conns.length && <li className="text-[14px] text-slate-500">Aucune application connectée.</li>}
        </ul>
      </details>
      <p className="mt-6 flex flex-wrap gap-4 text-[14px]"><Link to="/boite" className="underline decoration-gold-500">Boîte de recette (notifications)</Link>{moi?.user?.role === 'admin' && <Link to="/admin" className="underline decoration-gold-500">Exceptions</Link>}<button type="button" className="underline decoration-gold-500" onClick={async () => { await api('/api/auth/deconnexion', { body: {} }); window.location.assign('/'); }}>Se déconnecter</button></p>
    </Page>
  );
}

export function RecetteNouveau() {
  const nav = useNavigate();
  const [titre, setTitre] = useState('');
  const [objectif, setObjectif] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      const { id } = await api<{ id: string }>('/api/dossiers', { body: { titre, objectif } });
      nav(`/compte/dossier/${id}`);
    } catch (e2) {
      if (e2 instanceof ApiError && e2.redirect) nav(e2.redirect);
      setErr(e2 instanceof ApiError ? e2.message : 'Création impossible.');
    }
  };
  return (
    <Page narrow>
      <Seo title="Nouveau dossier" description="Créer un dossier." path="/dossier/nouveau" noindex />
      <h1 className="font-display text-[36px] text-navy-900">Nouveau dossier</h1>
      <Card className="mt-6">
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nom du dossier"><input className={inputCls} required value={titre} onChange={(e) => setTitre(e.target.value)} placeholder="Ex. Régularisation de charges 2025" /></Field>
          <Field label="Votre objectif" hint="Une phrase suffit : ce que vous voulez comprendre ou obtenir."><textarea className={`${inputCls} min-h-24`} value={objectif} onChange={(e) => setObjectif(e.target.value)} /></Field>
          {err && <Alert tone="error">{err}</Alert>}
          <Primary type="submit">Créer et déposer mes pièces</Primary>
        </form>
      </Card>
    </Page>
  );
}

export function RecetteBoite() {
  const [m, setM] = useState<{ id: string; subject: string; text: string; link: string; at: string }[] | null>(null);
  useEffect(() => void api<{ messages: NonNullable<typeof m> }>('/api/boite').then((r) => setM(r.messages)).catch(() => setM([])), []);
  return (
    <Page narrow>
      <Seo title="Boîte de recette" description="Notifications de recette." path="/boite" noindex />
      <h1 className="font-display text-[34px] text-navy-900">Boîte de recette</h1>
      <p className="mt-2 text-[14px] text-slate-500">En recette, aucune notification ne quitte la plateforme : elles sont déposées ici.</p>
      <ul className="mt-6 space-y-3">
        {m?.map((x) => <li key={x.id}><Card><p className="text-[13px] text-slate-500">{new Date(x.at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}</p><p className="mt-1 font-semibold text-navy-900">{x.subject}</p><p className="mt-2 whitespace-pre-line text-[14px] text-navy-900">{x.text}</p><Link to={x.link.replace(/^https?:\/\/[^/]+/, '')} className="mt-2 inline-block text-[14px] underline decoration-gold-500">Ouvrir</Link></Card></li>)}
        {m && !m.length && <li className="text-[14px] text-slate-500">Aucun message.</li>}
      </ul>
    </Page>
  );
}

export function RecetteAdmin() {
  const [x, setX] = useState<{ alertes: { code: string; at: string; meta: Record<string, unknown> }[]; travaux_en_echec: { id: string; kind: string; dossier: string; tentatives: number; erreur: string | null }[]; file: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => void api<NonNullable<typeof x>>('/api/admin/exceptions').then(setX).catch((e) => setErr(e instanceof ApiError ? e.message : 'Accès refusé.')), []);
  return (
    <Page>
      <Seo title="Exceptions" description="Exceptions techniques." path="/admin" noindex />
      <h1 className="font-display text-[34px] text-navy-900">Exceptions</h1>
      <p className="mt-2 text-[14px] text-slate-500">Seules les exceptions apparaissent ici (métadonnées, jamais le contenu des pièces). Le parcours normal ne demande aucune action.</p>
      {err && <div className="mt-4"><Alert tone="error">{err}</Alert></div>}
      {x && (<><p className="mt-4 text-[14px]">Travaux en file : {x.file}</p><h2 className="mt-6 text-[18px] font-semibold">Travaux en échec ({x.travaux_en_echec.length})</h2><ul className="mt-2 text-[14px]">{x.travaux_en_echec.map((t) => <li key={t.id}>{t.kind} · dossier {t.dossier.slice(0, 8)} · {t.tentatives} tentatives · {t.erreur}</li>)}</ul><h2 className="mt-6 text-[18px] font-semibold">Alertes</h2><ul className="mt-2 text-[14px]">{x.alertes.map((a, i) => <li key={i}>{new Date(a.at).toLocaleString('fr-FR')} · {a.code} · {JSON.stringify(a.meta)}</li>)}</ul></>)}
    </Page>
  );
}

export function RecetteBandeau() {
  return (
    <div className="bg-navy-900 px-4 py-2 text-center text-[12.5px] text-cream-50" role="note">
      Recette — données fictives · paiement simulé · aucune notification ni publication externe · ce site n’est pas indexé
    </div>
  );
}
