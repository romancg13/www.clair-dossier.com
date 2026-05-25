/**
 * WhatsApp click-to-chat helpers.
 * Numéro au format international sans + ni espaces (requis par wa.me).
 */
export const WHATSAPP_NUMBER = '33782983644';
export const WHATSAPP_DISPLAY = '+33 7 82 98 36 44';

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
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
