import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { isGenericTitle } from '../lib/dossier-workspace';
import { hasDossierTrash } from '../lib/admin';
import { hasDeadlines, deadlineStatus } from '../lib/dossier-workspace';
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
  const [todo, setTodo] = useState<{ id: string; dossier_id: string; title: string; due_date: string; late: boolean }[]>([]);
  const [filter, setFilter] = useState<'tous' | 'actifs' | 'archives'>('tous');
  const [search, setSearch] = useState('');
  const [dossiers, setDossiers] = useState<DossierRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [owners, setOwners] = useState<Record<string, string>>({});
  const [emails, setEmails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  // Une erreur réseau/RLS ne doit pas s'afficher comme « aucun dossier »
  // (état vide trompeur) : on la distingue et on propose de réessayer.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      // Statut admin (renvoie un booléen pour l'appelant courant uniquement).
      const { data: adminFlag } = await supabase.rpc('is_admin');
      const admin = adminFlag === true;

      // Les politiques RLS renvoient automatiquement TOUS les dossiers à l'admin,
      // et uniquement les siens à un utilisateur normal.
      const trashAware = await hasDossierTrash();
      const { data: rawRows, error: dossiersError } = await supabase
        .from('dossiers')
        .select(`id,user_id,typology,title,status,created_at${trashAware ? ',deleted_at' : ''}`)
        .order('created_at', { ascending: false });
      if (dossiersError) throw dossiersError;
      const data = ((rawRows as unknown as (DossierRow & { deleted_at?: string | null })[] | null) ?? []).filter(
        (r) => !r.deleted_at,
      );

      // « À faire » : échéances ouvertes de l'utilisateur (si la table existe).
      if (await hasDeadlines()) {
        const { data: dls } = await supabase
          .from('dossier_deadlines')
          .select('id,dossier_id,title,due_date,done')
          .eq('done', false)
          .order('due_date', { ascending: true })
          .limit(5);
        if (active && dls) {
          setTodo(
            (dls as { id: string; dossier_id: string; title: string; due_date: string; done: boolean }[]).map((d) => ({
              id: d.id,
              dossier_id: d.dossier_id,
              title: d.title,
              due_date: d.due_date,
              late: deadlineStatus(d.due_date, d.done) === 'retard',
            })),
          );
        }
      }

      const ownerMap: Record<string, string> = {};
      const emailMap: Record<string, string> = {};
      if (admin) {
        const { data: profs } = await supabase.from('profiles').select('id,company_name,full_name');
        (profs as ProfileRow[] | null)?.forEach((p) => {
          const name = p.company_name || p.full_name;
          if (name) ownerMap[p.id] = name;
        });
        // Identité (e-mail) du propriétaire — réservé à l'admin (fonction gardée par is_admin()).
        const { data: em } = await supabase.rpc('admin_user_emails');
        (em as { id: string; email: string }[] | null)?.forEach((e) => {
          emailMap[e.id] = e.email;
        });
      }

      if (!active) return;
      setIsAdmin(admin);
      setOwners(ownerMap);
      setEmails(emailMap);
      setDossiers((data as DossierRow[] | null) ?? []);
      setLoadError(null);
      setLoading(false);
    })().catch(() => {
      if (!active) return;
      setLoadError('Impossible de charger vos dossiers pour le moment. Vérifiez votre connexion, puis réessayez.');
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [reloadKey]);

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
              <Link
                to="/admin"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-gold-500 px-4 py-2 text-xs font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
              >
                Ouvrir la console d'administration →
              </Link>
            </div>
          )}

          {!isAdmin && todo.length > 0 && (
            <div className="mb-8 rounded-2xl border hairline-gold bg-gold-500/10 p-5">
              <p className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-gold-700">
                À faire
              </p>
              <ul className="mt-3 space-y-2">
                {todo.map((t) => (
                  <li key={t.id}>
                    <Link
                      to={`/compte/dossier/${t.dossier_id}`}
                      className="flex flex-wrap items-center justify-between gap-2 text-sm text-navy-900 hover:text-gold-700"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
                      <span className={`font-mono text-[0.65rem] uppercase tracking-[0.1em] ${t.late ? 'text-red-600' : 'text-slate-500'}`}>
                        {t.late ? 'En retard · ' : ''}
                        {new Date(`${t.due_date}T00:00:00`).toLocaleDateString('fr-FR')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
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

          {dossiers.length >= 4 && (
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <label htmlFor="dossier-search" className="sr-only">
                Rechercher un dossier
              </label>
              <input
                id="dossier-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un dossier…"
                className="w-full sm:w-64 rounded-full border hairline-strong bg-white px-4 py-2 text-sm text-navy-900 placeholder:text-slate-500"
              />
              {(['tous', 'actifs', 'archives'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  aria-pressed={filter === f}
                  className={`rounded-full px-3.5 py-2 text-xs font-medium transition-colors ${
                    filter === f ? 'bg-navy-900 text-cream-50' : 'border hairline-strong bg-white text-navy-900 hover:bg-cream-100'
                  }`}
                >
                  {f === 'tous' ? 'Tous' : f === 'actifs' ? 'Actifs' : 'Archivés'}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <p className="mt-8 text-sm text-slate-500">Chargement…</p>
          ) : loadError ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-8 text-center">
              <p role="alert" className="text-sm leading-relaxed text-red-700">
                {loadError}
              </p>
              <button
                type="button"
                onClick={() => {
                  setLoading(true);
                  setReloadKey((k) => k + 1);
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-navy-900 px-5 py-3 text-sm font-medium text-cream-50 transition-colors hover:bg-navy-800"
              >
                Réessayer
              </button>
            </div>
          ) : dossiers.length === 0 ? (
            <div className="mt-6 rounded-2xl border hairline bg-white p-8 text-center shadow-card">
              <p className="text-sm leading-relaxed text-slate-500">
                {isAdmin
                  ? "Aucun dossier sur la plateforme pour le moment."
                  : "Vous n'avez pas encore de dossier. Créez votre premier dossier — typologie, informations, documents, puis transmission."}
              </p>
              <Link
                to="/dossier/nouveau"
                className="sheen mt-5 inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-3 text-sm font-semibold text-navy-900 shadow-gold transition-transform hover:-translate-y-0.5"
              >
                Créer votre premier dossier
                <ArrowRightIcon width={14} height={14} strokeWidth={2} />
              </Link>
            </div>
          ) : (
            <ul className="mt-6 space-y-3">
              {dossiers
                .filter((d) => (filter === 'actifs' ? d.status !== 'archive' : filter === 'archives' ? d.status === 'archive' : true))
                .filter((d) => {
                  const q = search.trim().toLowerCase();
                  if (!q) return true;
                  return [d.title, d.typology, STATUS_LABELS[d.status]].filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
                })
                .map((d) => (
                <li key={d.id}>
                  <Link
                    to={`/compte/dossier/${d.id}`}
                    className="group flex flex-wrap items-center justify-between gap-3 rounded-2xl border hairline bg-white p-5 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-500 hover:shadow-card-hover"
                  >
                    <div>
                      <p className="font-display text-lg font-semibold text-navy-900">
                        {d.title || d.typology}{isGenericTitle(d.title) ? ' · à renommer' : ''}
                      </p>
                      <p className="mt-0.5 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                        {isAdmin && (
                          <span className="text-gold-700">
                            {[owners[d.user_id], emails[d.user_id]].filter(Boolean).join(' · ') ||
                              `${d.user_id.slice(0, 8)}…`}{' '}
                            ·{' '}
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
