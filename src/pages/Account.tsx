import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Seo } from '../lib/seo';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { ArrowRightIcon } from '../components/icons';

type DossierRow = {
  id: string;
  user_id: string;
  typology: string;
  title: string | null;
  status: string;
  created_at: string;
};

type ProfileRow = { id: string; company_name: string | null; full_name: string | null };

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
  const [isAdmin, setIsAdmin] = useState(false);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      // Statut admin (renvoie un booléen pour l'appelant courant uniquement).
      const { data: adminFlag } = await supabase.rpc('is_admin');
      const admin = adminFlag === true;

      // Les politiques RLS renvoient automatiquement TOUS les dossiers à l'admin,
      // et uniquement les siens à un utilisateur normal.
      const { data } = await supabase
        .from('dossiers')
        .select('id,user_id,typology,title,status,created_at')
        .order('created_at', { ascending: false });

      const ownerMap: Record<string, string> = {};
      if (admin) {
        const { data: profs } = await supabase.from('profiles').select('id,company_name,full_name');
        (profs as ProfileRow[] | null)?.forEach((p) => {
          ownerMap[p.id] = p.company_name || p.full_name || `${p.id.slice(0, 8)}…`;
        });
      }

      if (!active) return;
      setIsAdmin(admin);
      setOwners(ownerMap);
      setDossiers((data as DossierRow[] | null) ?? []);
      setLoading(false);
    })();
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
      <Seo title="Mon compte" description="Votre espace ClairDossier." path="/compte" noindex />
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

          {isAdmin && (
            <div className="mb-8 rounded-2xl border border-navy-900 bg-navy-900 p-5 text-cream-50">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-500">
                Espace administrateur
              </p>
              <p className="mt-2 text-sm text-cream-50/85">
                Vous voyez l'intégralité des dossiers de la plateforme. Cliquez un dossier pour le
                détail (5 étapes) et le téléchargement des pièces.
              </p>
            </div>
          )}

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
                {isAdmin ? 'Administration' : 'Mon compte'}
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
            <h2 className="font-display text-2xl font-semibold text-navy-900">
              {isAdmin ? `Tous les dossiers (${dossiers.length})` : 'Vos dossiers'}
            </h2>
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
                {isAdmin
                  ? "Aucun dossier sur la plateforme pour le moment."
                  : "Vous n'avez pas encore de dossier. Créez votre premier dossier — typologie, informations, documents, puis transmission."}
              </p>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {dossiers.map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/compte/dossier/${d.id}`}
                    className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border hairline bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-card-hover"
                  >
                    <div>
                      <p className="font-display text-lg font-semibold text-navy-900">
                        {d.title || d.typology}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                        {isAdmin && (
                          <span className="text-gold-700">
                            {owners[d.user_id] ?? `${d.user_id.slice(0, 8)}…`} ·{' '}
                          </span>
                        )}
                        {new Date(d.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="rounded-full bg-gold-500/12 px-3 py-1.5 font-mono text-[0.7rem] font-medium text-navy-900 border hairline-gold">
                        {STATUS_LABELS[d.status] ?? d.status}
                      </span>
                      <ArrowRightIcon
                        width={16}
                        height={16}
                        strokeWidth={2}
                        className="text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-gold-700"
                      />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </>
  );
}
