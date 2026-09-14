import { Link } from 'react-router-dom';
import { Reveal } from '../primitives/Reveal';
import { ArrowRightIcon } from '../icons';

/**
 * Appel à l'action de milieu de page (MASTER PROMPT §32) : une seule action
 * principale, identique sur toute la landing — commencer, compte gratuit.
 */
export function MidCTA() {
  return (
    <Reveal as="section" className="relative">
      <div className="mx-auto max-w-7xl px-5 pb-24 sm:px-8 lg:px-12">
        <div className="flex flex-col items-start justify-between gap-6 rounded-[1.5rem] border cd-hairline bg-cream-50/[0.04] px-6 py-7 sm:flex-row sm:items-center sm:px-9">
          <div>
            <p className="font-display text-2xl font-semibold leading-tight text-cream-50 sm:text-3xl">
              Votre premier dossier, en cinq étapes.
            </p>
            <p className="mt-1.5 text-sm text-silver-200/70">
              Compte gratuit, confirmé par e-mail. Vous décidez de tout, jusqu’à la transmission.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/inscription"
              className="sheen cd-btn-primary group inline-flex items-center gap-2 rounded-full bg-gold-500 px-5 py-3 text-sm font-semibold text-navy-900 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-gold-strong"
            >
              Commencer
              <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              to="/rendez-vous"
              className="inline-flex items-center gap-2 rounded-full border cd-hairline-strong px-5 py-3 text-sm font-medium text-cream-50 transition-colors hover:border-cream-50/60"
            >
              Demander une démonstration
            </Link>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
