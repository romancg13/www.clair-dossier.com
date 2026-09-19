// Identifiants déjà établis par les CLI officiels (`stripe login`,
// `supabase login`) sur CETTE machine. Ne journalise jamais une valeur :
// renvoie la clé ou null, avec l'origine seulement.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

function keychain(service, account) {
  if (process.platform !== 'darwin') return null;
  try {
    const args = ['find-generic-password', '-s', service, '-w'];
    if (account) args.splice(3, 0, '-a', account);
    const raw = execFileSync('security', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    // go-keyring (CLI Go) préfixe parfois la valeur encodée en base64.
    return raw.startsWith('go-keyring-base64:') ? Buffer.from(raw.slice(18), 'base64').toString('utf8') : raw || null;
  } catch {
    return null;
  }
}

/** Clé Stripe : variable d'environnement, sinon profil `stripe login` (fichier puis trousseau). */
export function stripeKey(mode = 'live') {
  if (process.env.STRIPE_SECRET_KEY) return { key: process.env.STRIPE_SECRET_KEY, source: 'STRIPE_SECRET_KEY' };
  const field = `${mode}_mode_api_key`;
  const cfg = join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'stripe', 'config.toml');
  if (existsSync(cfg)) {
    const m = readFileSync(cfg, 'utf8').match(new RegExp(`^\\s*${field}\\s*=\\s*['"]([^'"]+)['"]`, 'm'));
    if (m) return { key: m[1], source: 'stripe login (config.toml)' };
  }
  const fromKeychain = keychain('Stripe CLI', `default.${field}`) ?? keychain('stripe-cli', `default.${field}`);
  return fromKeychain ? { key: fromKeychain, source: 'stripe login (trousseau)' } : null;
}

/** Jeton de la Management API Supabase : variable, sinon session `supabase login`. */
export function supabaseToken() {
  if (process.env.SUPABASE_ACCESS_TOKEN) return { token: process.env.SUPABASE_ACCESS_TOKEN, source: 'SUPABASE_ACCESS_TOKEN' };
  const file = join(homedir(), '.supabase', 'access-token');
  if (existsSync(file)) {
    const t = readFileSync(file, 'utf8').trim();
    if (t) return { token: t, source: 'supabase login (fichier)' };
  }
  const t = keychain('Supabase CLI', 'supabase') ?? keychain('Supabase CLI');
  return t ? { token: t, source: 'supabase login (trousseau)' } : null;
}
