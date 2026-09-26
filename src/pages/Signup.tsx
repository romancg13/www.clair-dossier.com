import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Seo } from "../lib/seo";
import { useAuth, type CompanyType } from "../lib/auth";
import { trackEvent } from "../lib/analytics";
import { ArrowRightIcon } from "../components/icons";
import {
  isOtpCode,
  normalizePhone,
  requiresOrganization,
  validateSignup,
  type SignupErrors,
} from "../../packages/core/src/index";

const COMPANY_TYPES: { value: CompanyType; label: string }[] = [
  { value: "pme", label: "PME / TPE" },
  { value: "artisan", label: "Artisan" },
  { value: "entreprise-individuelle", label: "Entreprise individuelle" },
  { value: "profession-liberale", label: "Profession libérale" },
  { value: "particulier", label: "Particulier" },
  { value: "autre", label: "Autre" },
];

const RESEND_COOLDOWN = 60;

export function Signup() {
  const { signUp, verifyEmailOtp, resendSignupCode, configured } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/compte";
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<SignupErrors>({});
  const [loading, setLoading] = useState(false);
  const [companyType, setCompanyType] = useState<CompanyType>("pme");

  // Étape 2 : vérification de l'adresse e-mail par code.
  const location = useLocation();
  const [verifyEmail, setVerifyEmail] = useState<string | null>(
    (location.state as { verifier?: string } | null)?.verifier ?? null,
  );
  const [code, setCode] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  const orgRequired = requiresOrganization(companyType);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const input = {
      companyType: String(fd.get("companyType") || ""),
      firstName: String(fd.get("firstName") || ""),
      lastName: String(fd.get("lastName") || ""),
      organizationName: String(fd.get("companyName") || ""),
      email: String(fd.get("email") || "").trim(),
      password: String(fd.get("password") || ""),
      phone: String(fd.get("phone") || ""),
      acceptedTerms: fd.get("cgv") === "on",
    };
    const errors = validateSignup(input);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setLoading(true);
    const res = await signUp(input.email, input.password, {
      firstName: input.firstName,
      lastName: input.lastName,
      companyName: input.organizationName,
      companyType: input.companyType as CompanyType,
      phone: normalizePhone(input.phone),
    });
    setLoading(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    trackEvent("creation_compte");
    if (res.needsVerification) {
      setVerifyEmail(input.email);
      setCooldown(RESEND_COOLDOWN);
      setNotice(null);
      return;
    }
    navigate(next, { replace: true });
  }

  async function onVerify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!verifyEmail) return;
    setError(null);
    if (!isOtpCode(code)) {
      setError("Saisissez les 6 chiffres reçus par e-mail.");
      return;
    }
    setLoading(true);
    const res = await verifyEmailOtp(verifyEmail, code);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      setCode("");
      return;
    }
    navigate(next, { replace: true });
  }

  async function onResend() {
    if (!verifyEmail || cooldown > 0) return;
    setError(null);
    const res = await resendSignupCode(verifyEmail);
    if (res.error) {
      setError(res.error);
      return;
    }
    setNotice("Un nouveau code vient d'être envoyé.");
    setCooldown(RESEND_COOLDOWN);
  }

  return (
    <>
      <Seo
        title="Créer un compte"
        description="Créez gratuitement votre compte ClairDossier : structurez vos dossiers administratifs et juridiques, déposez vos pièces en sécurité et suivez les échéances."
        path="/inscription"
        noindex
      />
      <section className="bg-cream-50">
        <div className="mx-auto max-w-md px-5 py-16 sm:px-8 lg:py-24">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Compte ClairDossier
          </p>
          <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-navy-900">
            {verifyEmail ? "Vérifiez votre e-mail" : "Créer un compte"}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {verifyEmail
              ? `Nous avons envoyé un code à 6 chiffres à ${verifyEmail}. Saisissez-le pour activer votre compte (vous pouvez aussi cliquer sur le lien reçu).`
              : "Gratuit. Vous pourrez créer vos dossiers immédiatement — un abonnement n'est nécessaire que pour aller plus loin."}
          </p>

          {verifyEmail ? (
            <form onSubmit={onVerify} className="mt-8 rounded-2xl border hairline bg-white p-7 shadow-card" noValidate>
              <Field label="Code de vérification" htmlFor="otp">
                <input
                  id="otp"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  value={code}
                  onChange={(ev) => setCode(ev.target.value.replace(/\D/g, ""))}
                  placeholder="000000"
                  className={`${inputCls} text-center font-mono text-lg tracking-[0.3em]`}
                />
              </Field>

              {error && (
                <p className="mt-5 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
                  {error}
                </p>
              )}
              {notice && !error && (
                <p className="mt-5 rounded-xl bg-cream-100 px-4 py-3 text-sm text-navy-900" role="status">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={loading || code.length < 6}
                className="sheen mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Vérification…" : "Vérifier et accéder à mon compte"}
                {!loading && <ArrowRightIcon width={14} height={14} strokeWidth={2} />}
              </button>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm">
                <button
                  type="button"
                  onClick={onResend}
                  disabled={cooldown > 0}
                  className="font-medium text-navy-900 underline decoration-gold-500 underline-offset-4 disabled:cursor-not-allowed disabled:text-slate-500 disabled:no-underline"
                >
                  {cooldown > 0 ? `Renvoyer le code (${cooldown} s)` : "Renvoyer le code"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setVerifyEmail(null);
                    setCode("");
                    setError(null);
                  }}
                  className="text-slate-500 hover:text-navy-900"
                >
                  Modifier mes informations
                </button>
              </div>
            </form>
          ) : (
            <form
              onSubmit={onSubmit}
              className="mt-8 rounded-2xl border hairline bg-white p-7 shadow-card"
              noValidate
            >
              <div className="space-y-5">
                <Field label="Vous êtes *" htmlFor="companyType" error={fieldErrors.companyType}>
                  <select
                    id="companyType"
                    name="companyType"
                    value={companyType}
                    onChange={(ev) => {
                      const nextType = ev.target.value as CompanyType;
                      setCompanyType(nextType);
                      if (!requiresOrganization(nextType)) {
                        setFieldErrors(({ organizationName: _cleared, ...rest }) => rest);
                      }
                    }}
                    className={inputCls}
                  >
                    {COMPANY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Prénom *" htmlFor="firstName" error={fieldErrors.firstName}>
                    <input id="firstName" name="firstName" type="text" required autoComplete="given-name" maxLength={80} className={inputCls} />
                  </Field>
                  <Field label="Nom *" htmlFor="lastName" error={fieldErrors.lastName}>
                    <input id="lastName" name="lastName" type="text" required autoComplete="family-name" maxLength={80} className={inputCls} />
                  </Field>
                </div>
                <Field
                  label={orgRequired ? "Nom de la structure *" : "Nom de la structure (facultatif)"}
                  htmlFor="companyName"
                  error={fieldErrors.organizationName}
                >
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required={orgRequired}
                    autoComplete="organization"
                    className={inputCls}
                  />
                </Field>
                <Field label="E-mail *" htmlFor="email" error={fieldErrors.email}>
                  <input id="email" name="email" type="email" required autoComplete="email" className={inputCls} />
                </Field>
                <Field label="Mot de passe *" htmlFor="password" error={fieldErrors.password}>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    className={inputCls}
                  />
                </Field>
                <Field label="Téléphone — facultatif" htmlFor="phone" error={fieldErrors.phone}>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+33 6 12 34 56 78"
                    className={inputCls}
                  />
                </Field>

                <div>
                  <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed text-navy-900">
                    <input type="checkbox" name="cgv" required className="mt-1 h-4 w-4 shrink-0 accent-gold-500" />
                    <span>
                      J'accepte les{" "}
                      <Link to="/cgv" target="_blank" className="font-medium underline decoration-gold-500 underline-offset-4">
                        CGV
                      </Link>{" "}
                      * — voir aussi la{" "}
                      <Link
                        to="/politique-confidentialite"
                        target="_blank"
                        className="font-medium underline decoration-gold-500 underline-offset-4"
                      >
                        politique de confidentialité
                      </Link>
                      .
                    </span>
                  </label>
                  {fieldErrors.acceptedTerms && (
                    <p className="mt-1.5 text-xs text-red-700">{fieldErrors.acceptedTerms}</p>
                  )}
                </div>
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
                {loading ? "Création…" : "Créer mon compte"}
                {!loading && <ArrowRightIcon width={14} height={14} strokeWidth={2} />}
              </button>
              <p className="mt-3 text-center text-xs text-slate-500">* Champs obligatoires</p>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-slate-500">
            Déjà un compte ?{" "}
            <Link
              to={`/connexion${next !== "/compte" ? `?next=${encodeURIComponent(next)}` : ""}`}
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
  "mt-2 w-full rounded-xl border hairline bg-cream-50 px-4 py-3 text-sm text-navy-900 focus:border-gold-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-gold-500/20";

function Field({
  label,
  htmlFor,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block font-mono text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </label>
      {children}
      {error && <p className="mt-1.5 text-xs text-red-700">{error}</p>}
    </div>
  );
}
