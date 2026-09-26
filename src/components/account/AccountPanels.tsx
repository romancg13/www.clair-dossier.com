import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { fetchMyEntitlement } from '../../lib/dossier-workspace';
import { listDrafts, removeDraft, type DraftSummary } from '../../lib/drafts';
import type { MyProfile } from '../../lib/profile';
import {
  CATEGORIES,
  PLAN_LABELS,
  parseDossierEntitlement,
  profileNeedsCompletion,
  quotaUsageLabel,
  requiresOrganization,
  suggestNameSplit,
  validatePhone,
  type DossierEntitlement,
  type PlanId,
} from '../../../packages/core/src/index';

const card = 'rounded-2xl border hairline bg-white p-6 shadow-card sm:p-7';
const label = 'font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500';
const input =
  'mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20';

function frenchDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ── Profil : complétion (anciens comptes) + e-mail de facturation ──────── */

export function ProfilePanel({
  profile,
  accountEmail,
  onSaved,
}: {
  profile: MyProfile;
  accountEmail: string | null;
  onSaved: () => void;
}) {
  const incomplete = profileNeedsCompletion(profile);
  const [open, setOpen] = useState(incomplete);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const suggestion = suggestNameSplit(profile.full_name);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const fd = new FormData(e.currentTarget);
    const first = String(fd.get('first_name') || '').trim();
    const last = String(fd.get('last_name') || '').trim();
    const company = String(fd.get('company_name') || '').trim();
    const phone = String(fd.get('phone') || '').trim();
    const billing = String(fd.get('billing_email') || '').trim();
    if (!first || !last) {
      setError('Indiquez votre prénom et votre nom.');
      return;
    }
    if (requiresOrganization(profile.company_type) && !company) {
      setError('Indiquez le nom de votre structure.');
      return;
    }
    const phoneError = validatePhone(phone);
    if (phoneError) {
      setError(phoneError);
      return;
    }
    if (billing && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(billing)) {
      setError("Adresse e-mail de facturation invalide.");
      return;
    }
    setSaving(true);
    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        first_name: first,
        last_name: last,
        full_name: `${first} ${last}`,
        company_name: company || null,
        phone: phone || null,
        billing_email: billing || null,
      })
      .eq('id', profile.id);
    setSaving(false);
    if (saveError) {
      setError("Votre profil n'a pas pu être enregistré. Réessayez.");
      return;
    }
    setNotice('Profil enregistré.');
    setOpen(false);
    onSaved();
  }

  if (!open) {
    return (
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
        {notice ? <span className="text-navy-900">{notice}</span> : <span />}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-medium text-navy-900 border-b hairline-gold pb-0.5 hover:text-gold-700"
        >
          Modifier mon profil
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={`mt-6 ${card}`} noValidate>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
        {incomplete ? 'Complétez votre profil' : 'Mon profil'}
      </p>
      {incomplete && (
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Quelques secondes : votre prénom et votre nom remplacent l'adresse e-mail dans votre espace.
        </p>
      )}
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Prénom *</span>
          <input name="first_name" defaultValue={profile.first_name ?? suggestion.first} autoComplete="given-name" maxLength={80} className={input} />
        </label>
        <label className="block">
          <span className={label}>Nom *</span>
          <input name="last_name" defaultValue={profile.last_name ?? suggestion.last} autoComplete="family-name" maxLength={80} className={input} />
        </label>
        <label className="block">
          <span className={label}>
            {requiresOrganization(profile.company_type) ? 'Nom de la structure *' : 'Nom de la structure (facultatif)'}
          </span>
          <input name="company_name" defaultValue={profile.company_name ?? ''} autoComplete="organization" className={input} />
        </label>
        <label className="block">
          <span className={label}>Téléphone — facultatif</span>
          <input name="phone" type="tel" inputMode="tel" defaultValue={profile.phone ?? ''} autoComplete="tel" placeholder="+33 6 12 34 56 78" className={input} />
        </label>
        <label className="block sm:col-span-2">
          <span className={label}>Adresse e-mail de facturation — facultatif</span>
          <input
            name="billing_email"
            type="email"
            inputMode="email"
            defaultValue={profile.billing_email ?? ''}
            placeholder={accountEmail ?? ''}
            autoComplete="email"
            className={input}
          />
          <span className="mt-1.5 block text-xs text-slate-500">
            À défaut, l'adresse e-mail de votre compte sera utilisée.
          </span>
        </label>
      </div>
      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-navy-900 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-navy-800 disabled:opacity-60"
        >
          {saving ? 'Enregistrement…' : 'Enregistrer'}
        </button>
        {!incomplete && (
          <button type="button" onClick={() => setOpen(false)} className="text-sm text-slate-500 hover:text-navy-900">
            Annuler
          </button>
        )}
      </div>
    </form>
  );
}

/* ── Abonnement & quota (publiés par le serveur) ─────────────────────────── */

const PORTAL_URL = import.meta.env.VITE_STRIPE_PORTAL_URL as string | undefined;

export function SubscriptionPanel({ paidReturn }: { paidReturn: boolean }) {
  const [ent, setEnt] = useState<DossierEntitlement | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchMyEntitlement().then((raw) => {
      if (!active) return;
      setEnt(parseDossierEntitlement(raw));
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const usage = quotaUsageLabel(ent);
  const planLabel = ent?.planId && ent.planId in PLAN_LABELS ? PLAN_LABELS[ent.planId as PlanId] : null;
  const active = ent?.subscriptionStatus && ['active', 'trialing', 'past_due'].includes(ent.subscriptionStatus);

  return (
    <>
      {paidReturn && (
        <div className="mb-8 rounded-2xl border hairline-gold bg-gold-500/10 p-5">
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">Paiement</p>
          <p className="mt-2 text-sm text-navy-900">
            {active
              ? `Merci — votre abonnement${planLabel ? ` ${planLabel}` : ''} est actif.`
              : "Merci — votre paiement est en cours de confirmation par Stripe. Votre abonnement apparaîtra ici dès sa confirmation (quelques instants)."}
          </p>
        </div>
      )}
      {loaded && (usage || ent?.blockedReason || PORTAL_URL) && (
        <div className={`mt-8 ${card}`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                Abonnement{planLabel ? ` · ${planLabel}` : ''}
              </p>
              {usage && (
                <p className="mt-2 font-display text-2xl font-semibold text-navy-900">
                  {ent?.unlimited ? 'Dossiers : Illimités' : `Dossiers utilisés : ${usage}`}
                </p>
              )}
              {ent?.periodEnd && !ent.unlimited && (
                <p className="mt-1 text-sm text-slate-500">Prochain renouvellement : {frenchDate(ent.periodEnd)}</p>
              )}
              {ent?.blockedReason === 'payment' && (
                <p className="mt-2 text-sm text-red-700">
                  Paiement en attente : la création de nouveaux dossiers est suspendue. Vos dossiers restent accessibles.
                </p>
              )}
              {ent?.blockedReason === 'suspended' && (
                <p className="mt-2 text-sm text-red-700">Compte suspendu. Contactez l'assistance ClairDossier.</p>
              )}
            </div>
            {PORTAL_URL && (
              <a
                href={PORTAL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border hairline-strong bg-white px-4 py-2 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-100"
              >
                Factures et abonnement ↗
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/* ── Brouillons (appareil courant) ───────────────────────────────────────── */

export function DraftsPanel() {
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);

  useEffect(() => {
    setDrafts(listDrafts());
  }, []);

  if (drafts.length === 0) return null;

  return (
    <div className={`mt-8 ${card}`}>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
        Brouillons en cours · sur cet appareil
      </p>
      <ul className="mt-4 space-y-2">
        {drafts.map((d) => {
          const category = CATEGORIES.find((c) => c.id === d.typology)?.label;
          return (
            <li
              key={d.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-navy-900">{d.title?.trim() || 'Dossier sans nom'}</p>
                <p className="mt-0.5 font-mono text-[0.62rem] uppercase tracking-[0.1em] text-slate-500">
                  {category ? `${category} · ` : ''}Étape {d.step}/5 · {new Date(d.updatedAt).toLocaleDateString('fr-FR')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  to={`/dossier/nouveau?brouillon=${encodeURIComponent(d.id)}`}
                  className="inline-flex min-h-[40px] items-center font-medium text-navy-900 border-b hairline-gold hover:text-gold-700"
                >
                  Reprendre
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    if (!window.confirm(`Supprimer le brouillon « ${d.title?.trim() || 'Dossier sans nom'} » ?`)) return;
                    removeDraft(d.id);
                    setDrafts(listDrafts());
                  }}
                  className="inline-flex min-h-[40px] items-center text-xs font-medium text-slate-500 hover:text-red-600"
                >
                  Supprimer
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
