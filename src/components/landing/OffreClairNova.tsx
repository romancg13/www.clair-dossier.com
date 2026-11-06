import { useSyncExternalStore } from 'react';
import { ArrowRightIcon } from '../icons';
import { DROIT10, campagneActive } from '../../data/campagnes';
import { trackEvent } from '../../lib/analytics';

/**
 * Encart partenaire « Offre professionnels du droit » (src/data/campagnes.ts), en bas de l'accueil.
 *
 * Visible seulement pendant la période : le HTML prérendu suit l'horloge du build (__BUILD_TIME__,
 * vite.config.ts), puis le navigateur corrige avec sa propre horloge après l'hydratation —
 * useSyncExternalStore évite tout décalage d'hydratation. Fin de campagne sans dépendre d'un cron :
 * index.html pose `html[data-droit10="fini"]` avant le premier rendu (CSS : src/index.css), un onglet
 * resté ouvert se re-rend au franchissement (minuteur dans la journée, puis à chaque retour sur l'onglet),
 * et deploy.yml / surveillance.yml reconstruisent le HTML statique.
 * ClairNova est le prestataire : ClairDossier n'accorde aucune remise sur ses propres abonnements.
 */
declare const __BUILD_TIME__: string | undefined;

const BUILT_AT = typeof __BUILD_TIME__ === 'string' ? Date.parse(__BUILD_TIME__) : Number.NaN;
const DAY_MS = 86_400_000;

/** Re-rendu au franchissement de la fin : minuteur (armé seulement dans la journée) + retour sur l'onglet. */
const subscribe = (notify: () => void) => {
  let timer = 0;
  const arm = () => {
    window.clearTimeout(timer);
    const untilEnd = Date.parse(DROIT10.endsAt) - Date.now();
    if (untilEnd > 0 && untilEnd <= DAY_MS) timer = window.setTimeout(notify, untilEnd + 50);
  };
  const wake = () => {
    notify();
    arm();
  };
  arm();
  window.addEventListener('focus', wake);
  document.addEventListener('visibilitychange', wake);
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener('focus', wake);
    document.removeEventListener('visibilitychange', wake);
  };
};
const clientSnapshot = () => campagneActive(DROIT10);
const serverSnapshot = () => (Number.isNaN(BUILT_AT) ? false : campagneActive(DROIT10, BUILT_AT));

export function OffreClairNova() {
  const active = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);
  if (!active) return null;
  return (
    <aside
      aria-labelledby="offre-clairnova-titre"
      data-campagne={DROIT10.id}
      className="mx-auto mt-14 max-w-2xl rounded-2xl border cd-hairline px-5 py-5 text-left sm:px-7"
    >
      <p id="offre-clairnova-titre" className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-gold-400">
        Offre partenaire · ClairNova, sites web
      </p>
      <p className="mt-2 text-sm leading-relaxed text-cream-50">
        Professionnels du droit : profitez de -10 % sur la création de votre site web ou landing page avec ClairNova.
      </p>
      <p className="mt-1 text-sm leading-relaxed text-silver-400">
        Décrivez votre projet sur ClairNova pour en bénéficier. Offre proposée par ClairNova, sans lien avec les
        abonnements ClairDossier.
      </p>
      <a
        href={DROIT10.url}
        rel="noopener"
        onClick={() => trackEvent('clic_clairnova_droit10')}
        className="group mt-4 inline-flex items-center gap-2 rounded-full border cd-hairline-strong px-5 py-2.5 text-sm font-medium text-cream-50 transition-colors hover:border-gold-400 hover:text-gold-400"
      >
        Parlez de votre projet
        <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
        <span className="sr-only">(sur clairnova.fr)</span>
      </a>
    </aside>
  );
}
