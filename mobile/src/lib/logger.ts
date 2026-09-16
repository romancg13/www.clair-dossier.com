/**
 * Journalisation applicative — §27/§36.
 *
 * Interdits, sans exception : documents, contenus de pièces, jetons, mots de
 * passe, adresses e-mail, identifiants de compte. On ne journalise qu'un code
 * d'événement, une catégorie d'erreur et des compteurs.
 *
 * En développement : console. En production : tampon mémoire borné, lisible
 * depuis Compte → Assistance (diagnostic), jamais envoyé automatiquement.
 * Le branchement d'un service externe (Sentry…) est un choix produit et
 * juridique (sous-traitant RGPD) : il n'est pas fait ici.
 */
import { classifyFailure } from '@clairdossier/core';
import { APP_ENV } from './config';

export type LogEntry = { at: string; level: 'info' | 'warn' | 'error'; event: string; detail?: string };

const BUFFER_MAX = 80;
const buffer: LogEntry[] = [];

/** Supprime tout ce qui pourrait identifier une personne ou un document. */
function safe(detail?: string): string | undefined {
  if (!detail) return undefined;
  return detail
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .replace(/eyJ[\w.-]{10,}/g, '[jeton]')
    .slice(0, 160);
}

function push(level: LogEntry['level'], event: string, detail?: string) {
  const entry: LogEntry = { at: new Date().toISOString(), level, event, detail: safe(detail) };
  buffer.push(entry);
  if (buffer.length > BUFFER_MAX) buffer.shift();
  if (APP_ENV === 'development') {
    const line = `[ClairDossier] ${event}${entry.detail ? ` — ${entry.detail}` : ''}`;
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
  }
}

export const log = {
  info: (event: string, detail?: string) => push('info', event, detail),
  warn: (event: string, detail?: string) => push('warn', event, detail),
  /** N'enregistre que la CATÉGORIE de l'erreur, jamais son message brut. */
  error: (event: string, error: unknown) => push('error', event, classifyFailure(error)),
};

export function recentLogs(): LogEntry[] {
  return [...buffer].reverse();
}

export function clearLogs(): void {
  buffer.length = 0;
}
