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

export const TOPICS = ['demo', 'commercial', 'support', 'presse', 'rendez-vous', 'devis'] as const;
export type Topic = (typeof TOPICS)[number];

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
};

export type ValidationResult =
  | { ok: true; value: CleanProspect }
  | { ok: false; errors: string[] };

// RFC 5322 simplifié — suffisant pour rejeter le bruit sans refuser
// d'adresses légitimes. Longueur maximale : 254 (RFC 3696 erratum).
const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]+\.[^\s@]{2,}$/;

// Caractères de contrôle à retirer (on conserve \t \n \r).
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Supprime les caractères de contrôle et borne la longueur. */
function cleanText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(CONTROL_CHARS_RE, '').trim().slice(0, max);
}

export function validateProspect(raw: unknown): ValidationResult {
  const errors: string[] = [];
  const input = (raw ?? {}) as Record<string, unknown>;

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
    },
  };
}
