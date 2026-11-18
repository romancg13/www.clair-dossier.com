// Offres lisibles (prévisualisation) : les sept formules existantes, lues dans
// src/data/pricing.ts SANS le modifier ; différences de volume, d'utilisateurs et
// de service d'un coup d'œil, détails au clic. En recette, le paiement est simulé.
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { COMPARISON_FEATURES, plans } from '../data/pricing';
import { Seo } from '../lib/seo';
import { api, ApiError } from './api';
import { useMoi } from './useMoi';
import { Alert, Card, Kicker, Page, Primary } from './ui';

const STATUS = { yes: 'Inclus', limited: 'Limité', no: '—' } as const;

export function TarifsLisibles() {
  const [open, setOpen] = useState<string | null>(null);
  const { moi } = useMoi();
  const cta = (id: string) => (moi?.user ? `/abonnement?formule=${id}` : `/inscription?next=${encodeURIComponent(`/abonnement?formule=${id}`)}`);
  return (
    <Page>
      <Seo title="Tarifs — comparer les formules" description="Sept formules ClairDossier comparées : nombre de dossiers, utilisateurs et niveau de service." path="/tarifs" noindex />
      <Kicker>Tarifs</Kicker>
      <h1 className="mt-2 font-display text-[38px] leading-tight text-navy-900 sm:text-[46px]">Une formule par volume de dossiers.</h1>
      <p className="mt-3 max-w-2xl text-[16px] text-slate-500">Toutes les formules donnent le même résultat pour chaque dossier : situation, dates, prochaine action. Elles diffèrent par le nombre de dossiers, d’utilisateurs et le niveau d’accompagnement.</p>
      <div className="mt-8 overflow-hidden rounded-2xl border border-cream-200 bg-white">
        <div className="hidden grid-cols-[1.4fr_0.8fr_1fr_1fr_1.2fr_auto] gap-3 border-b border-cream-200 px-5 py-3 font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500 md:grid">
          <span>Formule</span><span>Prix / mois</span><span>Dossiers</span><span>Utilisateurs</span><span>Service</span><span />
        </div>
        <ul className="divide-y divide-cream-200">
          {plans.map((p) => (
            <li key={p.id} className="px-5 py-4">
              <div className="grid gap-2 md:grid-cols-[1.4fr_0.8fr_1fr_1fr_1.2fr_auto] md:items-center md:gap-3">
                <div>
                  <p className="text-[16px] font-semibold text-navy-900">{p.name}{p.badge && <span className="ml-2 rounded-full bg-gold-300/40 px-2 py-0.5 text-[11px] font-medium text-gold-700">{p.badge.label}</span>}</p>
                  <p className="text-[13px] text-slate-500">{p.audience}</p>
                </div>
                <p className="text-[18px] font-semibold text-navy-900">{p.priceMonthly === null ? 'Sur devis' : `${p.priceMonthly} €`}</p>
                <p className="text-[14px] text-navy-900"><span className="text-slate-500 md:hidden">Dossiers : </span>{p.specs.dossiers}</p>
                <p className="text-[14px] text-navy-900"><span className="text-slate-500 md:hidden">Utilisateurs : </span>{p.specs.users}</p>
                <p className="text-[14px] text-navy-900"><span className="text-slate-500 md:hidden">Service : </span>{p.specs.support}</p>
                <div className="flex flex-wrap gap-2 md:justify-end">
                  <button type="button" aria-expanded={open === p.id} className="min-h-11 rounded-full px-3 text-[14px] underline decoration-gold-500" onClick={() => setOpen(open === p.id ? null : p.id)}>Détails</button>
                  {p.priceMonthly !== null ? <Primary to={cta(p.id)}>Choisir</Primary> : <Primary to="/contact?plan=sur-mesure">Demander un devis</Primary>}
                </div>
              </div>
              {open === p.id && (
                <div className="mt-3 rounded-xl bg-cream-50 p-4 text-[14px] text-navy-900">
                  <p>{p.description}</p>
                  <ul className="mt-2 grid gap-1 sm:grid-cols-2">{COMPARISON_FEATURES.map((f) => <li key={f.id}>{f.label} : <strong>{STATUS[p.features[f.id] ?? 'no']}</strong></li>)}</ul>
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-4 text-[13px] text-slate-500">Prévisualisation de recette : les sept offres et leurs prix sont lus dans la grille existante, inchangée ; le paiement est simulé, les liens de paiement réels ne sont pas utilisés.</p>
    </Page>
  );
}

const CARTES = [
  { n: '4242424242424242', l: 'Carte de test acceptée' },
  { n: '4000000000000002', l: 'Carte de test refusée' },
  { n: '4000002500003155', l: 'Authentification 3-D Secure non terminée' },
];

export function PaiementRecette() {
  const [q] = useSearchParams();
  const nav = useNavigate();
  const plan = plans.find((p) => p.id === q.get('formule'));
  const [carte, setCarte] = useState(CARTES[0].n);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!plan || plan.priceMonthly === null) return <Page narrow><Alert tone="error">Formule inconnue.</Alert></Page>;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ retour: string }>('/api/abonnement/paiement-recette', { body: { plan_id: plan.id, carte } });
      nav(r.retour);
    } catch (e2) {
      setMsg(e2 instanceof ApiError ? e2.message : 'Paiement impossible.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Page narrow>
      <Seo title="Paiement de recette" description="Paiement simulé." path="/abonnement" noindex />
      <Kicker>Paiement simulé — aucun débit</Kicker>
      <h1 className="mt-2 font-display text-[34px] text-navy-900">Formule {plan.name}</h1>
      <p className="mt-2 text-[16px] text-navy-900">{plan.priceMonthly} € par mois · {plan.specs.dossiers} · {plan.specs.users}</p>
      <Card className="mt-6">
        <form onSubmit={submit} className="space-y-3">
          <fieldset>
            <legend className="text-[14px] font-medium text-navy-900">Carte de test</legend>
            {CARTES.map((c) => (
              <label key={c.n} className="mt-2 flex min-h-11 items-center gap-3 text-[14px]"><input type="radio" name="carte" value={c.n} checked={carte === c.n} onChange={() => setCarte(c.n)} /> {c.l} <span className="font-mono text-slate-500">•••• {c.n.slice(-4)}</span></label>
            ))}
          </fieldset>
          {msg && <Alert tone="error">{msg}</Alert>}
          <Primary type="submit" disabled={busy}>Payer (simulation)</Primary>
          <p className="text-[12.5px] text-slate-500">Le retour de paiement n’active rien à lui seul : l’abonnement s’active à réception de l’événement signé, comme avec le vrai prestataire.</p>
        </form>
      </Card>
    </Page>
  );
}
