/**
 * Validation stricte des entrées prospect (Lot 2.2) — module pur, sans
 * dépendance : importé par l'Edge Function Deno ET par les tests Node
 * (tests/prospects-validate.test.ts). Toute entrée est une donnée non
 * fiable ; rien n'est interprété, tout est borné.
 *
 * Par conception, la fiche ne comporte AUCUN champ de donnée sensible
 * (art. 9 RGPD). Le champ message est du texte libre : il est stocké tel
 * quel comme donnée (jamais comme instruction) ; les motifs d'injection y
 * sont détectés et journalisés par scoring.ts (human_flags).
 */

export const SEGMENTS = [
  'pme',
  'artisan',
  'independant',
  'profession-liberale',
  'cabinet-avocats',
  'expert-comptable',
  'grand-compte',
  'particulier',
  'autre',
] as const;
export type Segment = (typeof SEGMENTS)[number];

export const TOPICS = [
  'demo',
  'commercial',
  'support',
  'presse',
  'rendez-vous',
  'devis',
  'partenariat',
] as const;
export type Topic = (typeof TOPICS)[number];

/**
 * Demande « Devenir partenaire » (chantier 14) : type de partenariat en
 * liste fermée, sans promesse (ni commission, ni acceptation). Libellés
 * partagés par le formulaire public et la console d'administration.
 */
export const PARTNER_TYPES = ['prescripteur', 'integration', 'cabinet-expert', 'autre'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];
export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  prescripteur: 'Prescripteur',
  integration: 'Intégration',
  'cabinet-expert': 'Cabinet ou expert',
  autre: 'Autre',
};

/** Clés acceptées dans la charge utile — toute autre clé est rejetée. */
const ALLOWED_KEYS = new Set([
  'full_name',
  'email',
  'organization',
  'segment',
  'topic',
  'message',
  'source_page',
  'referrer',
  'creneaux',
  'elapsed_ms',
  'website',
  'partner_type',
  'site_url',
  'request_id',
]);

export type CleanProspect = {
  full_name: string;
  email: string;
  organization: string | null;
  segment: Segment;
  topic: Topic;
  message: string;
  source_page: string;
  referrer: string | null;
  creneaux: string | null;
  /** Renseigné si et seulement si topic = 'partenariat'. */
  partner_type: PartnerType | null;
  /** Site web facultatif (partenariat uniquement), http(s) normalisé. */
  site_url: string | null;
  /** Identifiant de requête généré par le navigateur (idempotence). */
  client_request_id: string | null;
};

export type ValidationResult =
  | { ok: true; value: CleanProspect }
  | { ok: false; errors: string[] };

// RFC 5322 simplifié — suffisant pour rejeter le bruit sans refuser
// d'adresses légitimes. Longueur maximale : 254 (RFC 3696 erratum).
export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

// Caractères de contrôle à retirer (on conserve \t \n \r).
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Supprime les caractères de contrôle et borne la longueur. */
function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(CONTROL_CHARS_RE, '').trim().slice(0, max);
}

/** Longueur maximale d'une adresse de site (alignée sur la contrainte SQL). */
export const SITE_URL_MAX = 300;

// Nom d'hôte public : au moins un point, TLD alphabétique (ou IDN punycode).
// Refuse localhost, adresses IP et hôtes internes.
const PUBLIC_HOST_RE =
  /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:[a-z]{2,63}|xn--[a-z0-9-]{1,59})$/i;

export type SiteUrlResult = { ok: true; value: string | null } | { ok: false };

/**
 * Site web facultatif : vide → null ; sinon URL http(s) vers un domaine
 * public, sans identifiants, normalisée (« exemple.fr » → https://exemple.fr/).
 * Tout autre schéma (javascript:, data:, ftp:…) est refusé.
 */
export function normalizeSiteUrl(raw: unknown): SiteUrlResult {
  if (raw === undefined || raw === null) return { ok: true, value: null };
  if (typeof raw !== 'string') return { ok: false };
  const trimmed = raw.replace(CONTROL_CHARS_RE, '').trim();
  if (trimmed === '') return { ok: true, value: null };
  if (trimmed.length > SITE_URL_MAX || /\s/.test(trimmed)) return { ok: false };
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return { ok: false };
  if (url.username || url.password) return { ok: false };
  if (!PUBLIC_HOST_RE.test(url.hostname)) return { ok: false };
  if (url.href.length > SITE_URL_MAX) return { ok: false };
  return { ok: true, value: url.href };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Valeur « renseignée » : chaîne non vide après nettoyage (ou tout non-chaîne). */
function isProvided(v: unknown): boolean {
  if (v === undefined || v === null) return false;
  return typeof v !== 'string' || v.trim() !== '';
}

export function validateProspect(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const input = (
    raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  ) as Record<string, unknown>;

  // Liste blanche des champs : toute clé inattendue est rejetée.
  if (Object.keys(input).some((k) => !ALLOWED_KEYS.has(k))) errors.push('champ_inconnu');

  // Anti-robot sans service tiers : champ leurre (doit rester vide) et durée
  // minimale de saisie (un humain ne soumet pas un formulaire en < 3 s).
  if (typeof input.website === 'string' && input.website.trim() !== '') {
    errors.push('honeypot');
  }
  const elapsed = typeof input.elapsed_ms === 'number' ? input.elapsed_ms : Number(input.elapsed_ms);
  if (!Number.isFinite(elapsed) || elapsed < 3000) {
    errors.push('elapsed_ms');
  }

  const full_name = cleanText(input.full_name, 120);
  if (full_name.length < 2) errors.push('full_name');

  const email = cleanText(input.email, 254).toLowerCase();
  if (!EMAIL_RE.test(email)) errors.push('email');

  const organization = cleanText(input.organization, 160);

  const segment = typeof input.segment === 'string' ? input.segment : '';
  if (!(SEGMENTS as readonly string[]).includes(segment)) errors.push('segment');

  const topic = typeof input.topic === 'string' ? input.topic : '';
  if (!(TOPICS as readonly string[]).includes(topic)) errors.push('topic');

  const message = cleanText(input.message, 4000);
  if (message.length < 10) errors.push('message');

  const source_page = cleanText(input.source_page, 300);
  if (!source_page.startsWith('/')) errors.push('source_page');

  const referrer = cleanText(input.referrer, 500);
  const creneaux = cleanText(input.creneaux, 500);

  // Partenariat : type obligatoire (liste fermée), site facultatif mais
  // valide, pas de créneaux. Hors partenariat : ces champs sont refusés.
  let partner_type: PartnerType | null = null;
  let site_url: string | null = null;
  if (topic === 'partenariat') {
    const pt = typeof input.partner_type === 'string' ? input.partner_type : '';
    if ((PARTNER_TYPES as readonly string[]).includes(pt)) partner_type = pt as PartnerType;
    else errors.push('partner_type');
    const site = normalizeSiteUrl(input.site_url);
    if (site.ok) site_url = site.value;
    else errors.push('site_url');
    if (creneaux) errors.push('creneaux');
  } else {
    if (isProvided(input.partner_type)) errors.push('partner_type');
    if (isProvided(input.site_url)) errors.push('site_url');
  }

  // Idempotence : identifiant de requête facultatif, UUID strict.
  let client_request_id: string | null = null;
  if (isProvided(input.request_id)) {
    const rid = typeof input.request_id === 'string' ? input.request_id.trim() : '';
    if (UUID_RE.test(rid)) client_request_id = rid.toLowerCase();
    else errors.push('request_id');
  }

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      full_name,
      email,
      organization: organization || null,
      segment: segment as Segment,
      topic: topic as Topic,
      message,
      source_page,
      referrer: referrer || null,
      creneaux: creneaux || null,
      partner_type,
      site_url,
      client_request_id,
    },
  };
}
