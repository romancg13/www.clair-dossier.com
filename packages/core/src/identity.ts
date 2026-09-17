/**
 * Identité du compte — nom affiché, validation d'inscription, téléphone.
 *
 * Mêmes règles sur le site et l'application mobile. La base applique en
 * parallèle ses propres contraintes (migration 20260917120000) : ce module
 * sert à guider l'utilisateur, jamais de seule garantie.
 */

export type ProfileIdentity = {
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  company_name?: string | null;
};

/**
 * Nom affiché dans « Bonjour, … ». Jamais l'adresse e-mail.
 * Priorité : prénom + nom → nom complet existant → structure → rien.
 */
export function displayName(profile: ProfileIdentity | null | undefined): string | null {
  if (!profile) return null;
  const composed = [profile.first_name, profile.last_name]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(' ');
  if (composed) return composed;
  const full = profile.full_name?.trim();
  if (full && !full.includes('@')) return full;
  const company = profile.company_name?.trim();
  if (company) return company;
  return null;
}

/** « Bonjour, Prénom Nom » — ou simplement « Bonjour ». */
export function greeting(profile: ProfileIdentity | null | undefined): string {
  const name = displayName(profile);
  return name ? `Bonjour, ${name}` : 'Bonjour';
}

/** Vrai si le profil n'a pas encore prénom ET nom séparés (anciens comptes). */
export function profileNeedsCompletion(profile: ProfileIdentity | null | undefined): boolean {
  if (!profile) return true;
  return !profile.first_name?.trim() || !profile.last_name?.trim();
}

/**
 * Suggestion de découpage d'un ancien « nom complet » pour préremplir le
 * formulaire de complétion. Jamais enregistrée sans validation de l'utilisateur.
 */
export function suggestNameSplit(fullName: string | null | undefined): { first: string; last: string } {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0 || (fullName ?? '').includes('@')) return { first: '', last: '' };
  if (parts.length === 1) return { first: parts[0], last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}

/* ── Téléphone (facultatif) ──────────────────────────────────────────────── */

/**
 * Normalise un numéro : espaces conservés pour la lisibilité, format
 * international recommandé. Retourne null si vide.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().replace(/\s+/g, ' ');
  return v ? v : null;
}

/** Message d'erreur, ou null si le numéro est vide (facultatif) ou valide. */
export function validatePhone(raw: string | null | undefined): string | null {
  const v = normalizePhone(raw);
  if (!v) return null;
  if (!/^\+?[0-9][0-9 .()-]{7,22}$/.test(v)) {
    return 'Numéro de téléphone invalide. Exemple : +33 6 12 34 56 78.';
  }
  const digits = v.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15) {
    return 'Numéro de téléphone invalide. Exemple : +33 6 12 34 56 78.';
  }
  return null;
}

/* ── Inscription ─────────────────────────────────────────────────────────── */

export type CompanyType =
  | 'pme'
  | 'artisan'
  | 'entreprise-individuelle'
  | 'profession-liberale'
  | 'particulier'
  | 'autre';

/** Profils pour lesquels une structure n'a pas de sens (jamais imposée). */
export function requiresOrganization(type: string | null | undefined): boolean {
  return type !== 'particulier';
}

export type SignupInput = {
  companyType: string;
  firstName: string;
  lastName: string;
  organizationName: string;
  email: string;
  password: string;
  phone?: string;
  acceptedTerms: boolean;
};

export type SignupErrors = Partial<Record<keyof SignupInput, string>>;

const COMPANY_TYPES = new Set(['pme', 'artisan', 'entreprise-individuelle', 'profession-liberale', 'particulier', 'autre']);

/** Contrôle complet du formulaire d'inscription. Objet vide = valide. */
export function validateSignup(input: SignupInput): SignupErrors {
  const errors: SignupErrors = {};
  if (!COMPANY_TYPES.has(input.companyType)) errors.companyType = 'Indiquez votre profil.';
  if (!input.firstName.trim()) errors.firstName = 'Indiquez votre prénom.';
  else if (input.firstName.trim().length > 80) errors.firstName = 'Prénom trop long.';
  if (!input.lastName.trim()) errors.lastName = 'Indiquez votre nom.';
  else if (input.lastName.trim().length > 80) errors.lastName = 'Nom trop long.';
  if (requiresOrganization(input.companyType) && !input.organizationName.trim()) {
    errors.organizationName = 'Indiquez le nom de votre structure.';
  }
  if (!input.email.trim()) errors.email = 'Indiquez votre adresse e-mail.';
  else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(input.email.trim())) errors.email = 'Adresse e-mail invalide.';
  if (!input.password) errors.password = 'Choisissez un mot de passe.';
  else if (input.password.length < 8) errors.password = 'Mot de passe trop court (8 caractères minimum).';
  const phoneError = validatePhone(input.phone);
  if (phoneError) errors.phone = phoneError;
  if (!input.acceptedTerms) errors.acceptedTerms = 'Vous devez accepter les CGV pour créer un compte.';
  return errors;
}

/** Code de vérification e-mail : 6 chiffres (configuration Supabase). */
export function isOtpCode(value: string): boolean {
  return /^[0-9]{6}$/.test(value.trim());
}

/** Adresse e-mail de facturation effective : facultative, repli sur le compte. */
export function effectiveBillingEmail(billingEmail: string | null | undefined, accountEmail: string | null | undefined): string | null {
  const b = billingEmail?.trim();
  if (b && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b)) return b;
  return accountEmail?.trim() || null;
}
