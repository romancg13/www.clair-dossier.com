import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Seo } from '../lib/seo';
import { useAuth, type CompanyType } from '../lib/auth';
import { ArrowRightIcon } from '../components/icons';

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: 'pme', label: 'PME / TPE' },
  { value: 'artisan', label: 'Artisan' },
  { value: 'entreprise-individuelle', label: 'Entreprise individuelle' },
  { value: 'profession-liberale', label: 'Profession libérale' },
  { value: 'particulier', label: 'Particulier' },
  { value: 'autre', label: 'Autre' },
];

export function Signup() {
  const { signUp, configured } = useAuth();
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
    const fullName = String(fd.get('fullName') || '').trim();
    const companyName = String(fd.get('companyName') || '').trim();
    const companyType = String(fd.get('companyType') || 'autre') as CompanyType;
    if (password.length < 6) {
      setError('Mot de passe trop court (6 caractères minimum).');
      return;
    }
    setLoading(true);
    const res = await signUp(email, password, { fullName, companyName, companyType });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    navigate(next, { replace: true });
  }

  return (
    <>
      <Seo
        title="Créer un compte"
        description="Créez votre compte ClairDossier en 30 secondes : structurez vos dossiers administratifs et juridiques, suivez les échéances, générez vos projets de réponse."
        path="/inscription"
      />
      <section className="bg-cream-50">
        <div className="mx-auto max-w-md px-5 py-16 sm:px-8 lg:py-24">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Compte ClairDossier
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900">
            Créer un compte
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            Gratuit. Vous pourrez créer vos dossiers immédiatement — un abonnement n'est nécessaire
            que pour aller plus loin.
          </p>

          <form onSubmit={onSubmit} className="mt-8 rounded-2xl border hairline bg-white p-7 shadow-card" noValidate>
            <div className="space-y-5">
              <Field label="Vous êtes">
                <select
                  name="companyType"
                  defaultValue="pme"
                  className="mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20"
                >
                  {COMPANY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Nom de la structure (optionnel)">
                <input name="companyName" type="text" autoComplete="organization" className={inputCls} />
              </Field>
              <Field label="Votre nom">
                <input name="fullName" type="text" autoComplete="name" className={inputCls} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required autoComplete="email" className={inputCls} />
              </Field>
              <Field label="Mot de passe">
                <input
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete="new-password"
                  className={inputCls}
                />
              </Field>
            </div>

            {error && (
              <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                {error}
              </p>
            )}
            {!configured && (
              <p className="mt-5 rounded-xl bg-cream-100 px-4 py-3 text-sm text-slate-500">
                Le service de comptes est en cours de configuration.
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="sheen mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Création…' : 'Créer mon compte'}
              {!loading && <ArrowRightIcon width={14} height={14} strokeWidth={2} />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            Déjà un compte ?{' '}
            <Link
              to={`/connexion${next !== '/compte' ? `?next=${encodeURIComponent(next)}` : ''}`}
              className="font-medium text-navy-900 underline decoration-gold-500 underline-offset-4"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </section>
    </>
  );
}

const inputCls =
  'mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">{label}</span>
      {children}
    </label>
  );
}
