/**
 * Coordonnées publiques officielles — source unique pour le footer, la page
 * contact, la page locale Marseille et les données structurées (NAP cohérent).
 * Vérifiées : mentions légales (src/data/legal.ts) et CLAUDE.md (téléphone
 * officiel). Le canal WhatsApp reste distinct (src/lib/whatsapp.ts).
 */
export const PHONE_DISPLAY = '04 91 95 90 32';
export const PHONE_HREF = 'tel:0491959032';
export const PHONE_E164 = '+33491959032';
export const CONTACT_EMAIL = 'contact.clairdossier@icloud.com';
export const SIEGE_DISPLAY = 'Château-Gombert, 13013 Marseille';
export const SIEGE = {
  addressLocality: 'Marseille',
  postalCode: '13013',
  addressRegion: 'Bouches-du-Rhône',
  addressCountry: 'FR',
} as const;
