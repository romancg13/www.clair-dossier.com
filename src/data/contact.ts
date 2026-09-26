/**
 * Coordonnées publiques officielles — source unique pour le footer, la page
 * contact, la page locale Marseille, WhatsApp (src/lib/whatsapp.ts), les
 * supports régénérés (scripts/gen-markdown.ts) et les données structurées
 * (NAP cohérent). Numéro officiel depuis le 2026-09-18 (décision du
 * propriétaire) : 07 82 98 36 44 — appel et WhatsApp sur le même numéro.
 */
export const PHONE_DISPLAY = '07 82 98 36 44';
export const PHONE_HREF = 'tel:+33782983644';
export const PHONE_E164 = '+33782983644';
/** Format wa.me : international, sans « + » ni espace. */
export const PHONE_WA = '33782983644';
export const WHATSAPP_URL = `https://wa.me/${PHONE_WA}`;
export const CONTACT_EMAIL = 'contact.clairdossier@icloud.com';
export const SIEGE_DISPLAY = 'Château-Gombert, 13013 Marseille';
export const SIEGE = {
  addressLocality: 'Marseille',
  postalCode: '13013',
  addressRegion: 'Bouches-du-Rhône',
  addressCountry: 'FR',
} as const;
