/**
 * WhatsApp click-to-chat helpers.
 * Numéro au format international sans + ni espaces (requis par wa.me) —
 * source unique : src/data/contact.ts.
 */
import { PHONE_DISPLAY, PHONE_WA, WHATSAPP_URL } from '../data/contact';

export const WHATSAPP_NUMBER = PHONE_WA;
export const WHATSAPP_DISPLAY = PHONE_DISPLAY;

export function buildWhatsAppUrl(message: string): string {
  return `${WHATSAPP_URL}?text=${encodeURIComponent(message)}`;
}

export function openWhatsApp(message: string): void {
  const url = buildWhatsAppUrl(message);
  // window.open peut être bloqué par certains popup blockers — on tombe sur
  // window.location.href en fallback (le navigateur navigue alors directement).
  const newWindow = window.open(url, '_blank', 'noopener,noreferrer');
  if (!newWindow) {
    window.location.href = url;
  }
}
