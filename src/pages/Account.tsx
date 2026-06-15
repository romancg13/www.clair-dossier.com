import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Seo } from '../lib/seo';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ArrowRightIcon } from '../components/icons';

type DossierRow = {
  id: string;
  typology: string;
  title: string | null;
  status: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, string> = {
  brouillon: 'Brouillon',
  transmis: 'Transmis',
  'en-cours': 'En cours',
  valide: 'Validé',
  archive: 'Archivé',
};

export function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const paidPlan = params.get('paid');
  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    supabase
      .from('dossiers')
      .select('id,typology,title,status,created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!active) return;
        setDossiers((data as DossierRow[] | null) ?? []);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  return (
    <>
      <Seo title="Mon compte" description="Votre espace ClairDossier." path="/compte" />
      <section className="bg-cream-50">
        <div className="mx-auto max-w-4xl px-5 py-16 sm:px-8 lg:px-12">
          {paidPlan && (
            <div className="mb-8 rounded-2xl border hairline-gold bg-gold-500/10 p-5">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                Abonnement confirmé
              </p>
              <p className="mt-2 text-sm text-navy-900">
                Merci — votre paiement a bien été pris en compte. Votre abonnement est actif.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
                Mon compte
              </p>
              <h1 className="mt-3 font-display text-4xl font-semibold leading-[1.05] text-navy-900">
                Bonjour{user?.email ? `, ${user.email}` : ''}
              </h1>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-full bg-cream-100 px-5 py-2.5 text-sm font-medium text-navy-900 transition-colors hover:bg-cream-200"
            >
              Se déconnecter
            </button>
          </div>

          <div className="mt-10 flex items-center justify-between gap-4">
            <h2 className="font-display text-2xl font-semibold text-navy-900">Vos dossiers</h2>
            <Link
              to="/dossier/nouveau"
              className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-3 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
            >
              Créer un dossier
              <ArrowRightIcon width={14} height={14} strokeWidth={2} />
            </Link>
          </div>

          {loading ? (
            <p className="mt-8 text-sm text-slate-500">Chargement…</p>
          ) : dossiers.length === 0 ? (
            <div className="mt-6 rounded-2xl border hairline bg-white p-8 text-center shadow-card">
              <p className="text-sm leading-relaxed text-slate-500">
                Vous n'avez pas encore de dossier. Créez votre premier dossier — typologie,
                informations, documents, puis transmission.
              </p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {dossiers.map((d) => (
                <li
                  key={d.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border hairline bg-white p-5 shadow-card"
                >
                  <div>
                    <p className="font-display text-lg font-semibold text-navy-900">
                      {d.title || d.typology}
                    </p>
                    <p className="mt-0.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                      {new Date(d.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                  <span className="rounded-full bg-gold-500/12 px-3 py-1.5 font-mono text-[0.7rem] font-medium text-navy-900 border hairline-gold">
                    {STATUS_LABELS[d.status] ?? d.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
