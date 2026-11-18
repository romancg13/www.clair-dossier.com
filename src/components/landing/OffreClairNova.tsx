import { useSyncExternalStore } from 'react';
import { ArrowRightIcon } from '../icons';
import { DROIT10, campagneActive } from '../../data/campagnes';
import { trackEvent } from '../../lib/analytics';

/**
 * Bandeau partenaire « Offre professionnels du droit » (src/data/campagnes.ts) : une ligne compacte dans
 * le flux de la page, sous la navigation et avant la Hero de l'accueil (HomeCinematic).
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
    <aside aria-label="Offre partenaire ClairNova" data-campagne={DROIT10.id} className="border-b hairline bg-cream-100/80">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-x-4 gap-y-0.5 px-5 py-0.5 text-center text-[0.875rem] leading-snug text-navy-900 sm:px-8 lg:px-12">
        <p>
          Professionnels du droit : <span className="font-semibold text-gold-700">-10 %</span> sur votre site ou landing
          page avec ClairNova.
          <span className="hidden text-slate-500 lg:inline"> Offre ClairNova, sans lien avec les abonnements ClairDossier.</span>
        </p>
        <a
          href={DROIT10.url}
          rel="noopener"
          onClick={() => trackEvent('clic_clairnova_droit10')}
          className="group inline-flex min-h-9 items-center gap-1.5 rounded-sm font-medium text-navy-900 underline decoration-gold-500 decoration-[1.5px] underline-offset-4 transition-colors hover:text-gold-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-500"
        >
          En profiter
          <ArrowRightIcon width={13} height={13} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
          <span className="sr-only">(sur clairnova.fr)</span>
        </a>
      </div>
    </aside>
  );
}
