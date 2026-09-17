/**
 * Transmission d'un dossier — §10 / statut « Transmis ».
 *
 * Règle produit non négociable (voir /etat-du-produit et les CGV) : RIEN n'est
 * jamais envoyé automatiquement. La transmission est déclenchée par
 * l'utilisateur, qui relit une synthèse avant d'ouvrir son application de
 * messagerie ou WhatsApp. L'application ne fait que préparer le message.
 *
 * La synthèse reprend exactement le format du site (`src/pages/DossierFlow.tsx`)
 * pour que l'équipe reçoive la même chose, quel que soit le canal.
 */
import { answerLabel, typologyLabel, type Dossier } from '@clairdossier/core';
import { SUPPORT_EMAIL } from './config';
import { openExternal } from './links';

/**
 * Numéro WhatsApp du service — même valeur que le site
 * (`src/lib/whatsapp.ts`, format wa.me sans « + » ni espace).
 * Son remplacement éventuel par le 04 91 95 90 32 est une décision en attente
 * côté produit : on ne la tranche pas ici.
 */
export const WHATSAPP_NUMBER = '33782983644';

export function buildSynthesis(
  dossier: Pick<Dossier, 'typology' | 'title' | 'answers'>,
  documentCount: number,
  accountEmail?: string | null,
): string {
  const label = typologyLabel(dossier.typology);
  const answers = Object.entries(dossier.answers ?? {})
    .filter(([key]) => key !== 'profil')
    .map(([key, value]) => `• ${answerLabel(key)} : ${String(value).trim() || 'Non renseigné'}`)
    .join('\n');
  const profil = dossier.answers?.profil ? `Profil : ${dossier.answers.profil}.\n` : '';
  const docLine = documentCount
    ? `\nPièces jointes : ${documentCount} document(s) déposé(s) dans le compte.`
    : '';
  return (
    `Bonjour ClairDossier,\n\n` +
    profil +
    `Dossier : « ${dossier.title?.trim() || label} » (${label}).\n\n` +
    `Synthèse :\n${answers || '• Aucune information renseignée'}${docLine}\n\n` +
    `Compte : ${accountEmail ?? 'non précisé'}\n` +
    `Pouvez-vous me confirmer la prise en charge ? Merci.`
  );
}

export async function transmitByWhatsApp(message: string): Promise<boolean> {
  return openExternal(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`);
}

export async function transmitByEmail(subject: string, message: string): Promise<boolean> {
  const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
  return openExternal(url);
}
