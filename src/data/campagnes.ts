/**
 * Campagnes partenaires à durée limitée — source unique des dates (UTC, intervalle [début, fin)).
 *
 * DROIT10_2026 : -10 % sur la création d'un site web ou d'une landing page par ClairNova, pour les
 * professionnels du droit, du 06/11/2026 13 h (lancement anticipé décidé par Roman le 06/11/2026 ; date initiale : 09/11/2026 13 h)
 * au 09/11/2027 13 h — heure de Paris, CET aux deux dates. La fin est FIXE : elle ne glisse pas avec le lancement.
 * ClairDossier ne fait qu'annoncer : la demande, l'éligibilité et le devis sont traités par ClairNova,
 * qui porte les mêmes bornes (roman-gomes-site/src/config/campaigns.ts).
 */
export interface Campagne {
  id: string;
  /** Début, inclus (ISO 8601 UTC). */
  startsAt: string;
  /** Fin, exclue (ISO 8601 UTC). */
  endsAt: string;
  /** Destination du CTA : formulaire ClairNova, service « site » présélectionné, campagne identifiée. Aucune donnée personnelle. */
  url: string;
}

export const DROIT10: Campagne = {
  id: 'DROIT10_2026',
  startsAt: '2026-11-06T12:00:00Z',
  endsAt: '2027-11-09T12:00:00Z',
  url: 'https://clairnova.fr/contact?projet=site&utm_source=clairdossier&utm_campaign=DROIT10_2026',
};

export function campagneActive(campagne: Campagne, now: number | Date = Date.now()): boolean {
  const t = typeof now === 'number' ? now : now.getTime();
  return t >= Date.parse(campagne.startsAt) && t < Date.parse(campagne.endsAt);
}
