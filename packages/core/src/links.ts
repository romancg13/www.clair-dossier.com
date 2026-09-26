/**
 * Correspondance URL du site → route de l'application mobile.
 *
 * Fonction PURE (aucune dépendance native) pour être testable et partagée :
 * l'analyse de l'URL est faite par l'appelant, la décision est ici. Toute
 * adresse non reconnue renvoie `null` — on ne devine jamais une destination.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

/** `path` est le chemin seul, avec ou sans barre oblique initiale. */
export function routeForPath(path: string): string | null {
  const clean = `/${path.replace(/^\/+/, '').split(/[?#]/)[0] ?? ''}`;

  const dossier = clean.match(/^\/(?:compte\/)?dossiers?\/([^/]+)/i);
  if (dossier) {
    const id = decodeURIComponent(dossier[1] as string);
    if (id === 'nouveau') return '/dossier/nouveau';
    return isUuid(id) ? `/dossier/${id}` : null;
  }
  if (/^\/compte\/?$/i.test(clean)) return '/compte';
  if (/^\/echeances\/?$/i.test(clean)) return '/echeances';
  if (/^\/dossiers\/?$/i.test(clean)) return '/dossiers';
  return null;
}

/** Destination portée par une notification (charge utile émise par nous). */
export function routeForNotificationData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as Record<string, unknown>;
  if (typeof record.dossierId === 'string' && isUuid(record.dossierId)) return `/dossier/${record.dossierId}`;
  if (typeof record.route === 'string' && record.route.startsWith('/') && !record.route.startsWith('//')) {
    return record.route;
  }
  return null;
}
