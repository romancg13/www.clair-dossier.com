import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Seo } from '../lib/seo';
import { useAuth } from '../lib/auth';
import { ArrowRightIcon } from '../components/icons';

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/compte';
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const email = String(fd.get('email') || '').trim();
    const password = String(fd.get('password') || '');
    setLoading(true);
    const res = await signIn(email, password);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    navigate(next, { replace: true });
  }

  const inputCls =
    'mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20';

  return (
    <>
      <Seo
        title="Connexion"
        description="Connectez-vous à votre espace ClairDossier pour retrouver vos dossiers, vos échéances et vos documents."
        path="/connexion"
        noindex
      />
      <section className="bg-cream-50">
        <div className="mx-auto max-w-md px-5 py-16 sm:px-8 lg:py-24">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Compte ClairDossier
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900">
            Se connecter
          </h1>

          <form onSubmit={onSubmit} className="mt-8 rounded-2xl border hairline bg-white p-7 shadow-card" noValidate>
            <div className="space-y-5">
              <label className="block">
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Email</span>
                <input name="email" type="email" required autoComplete="email" className={inputCls} />
              </label>
              <label className="block">
                <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                  Mot de passe
                </span>
                <input name="password" type="password" required autoComplete="current-password" className={inputCls} />
              </label>
            </div>

            {error && (
              <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="sheen mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Connexion…' : 'Se connecter'}
              {!loading && <ArrowRightIcon width={14} height={14} strokeWidth={2} />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Pas encore de compte ?{' '}
            <Link
              to={`/inscription${next !== '/compte' ? `?next=${encodeURIComponent(next)}` : ''}`}
              className="font-medium text-navy-900 underline decoration-gold-500 underline-offset-4"
            >
              Créer un compte
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}
