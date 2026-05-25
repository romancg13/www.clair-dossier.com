import { Link } from 'react-router-dom';
import { Reveal } from '../primitives/Reveal';
import { ArrowRightIcon } from '../icons';

export function FinalCTA() {
  return (
    <Reveal as="section" className="relative isolate overflow-hidden bg-navy-900 text-cream-50">
      <div
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
      />
      <div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(60% 50% at 50% 0%, rgba(196,164,86,0.10), transparent 70%)',
        }}
      />

      <div className="mx-auto max-w-5xl px-5 py-24 text-center sm:px-8 sm:py-28 lg:px-12">
        <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
          Passez à l'usage
        </p>
        <h2 className="mt-4 font-display text-4xl font-semibold leading-[1.05] text-cream-50 sm:text-6xl">
          Prêt à transformer vos dossiers ?
        </h2>
        <p className="mx-auto mt-5 max-w-2xl text-cream-50/75 leading-relaxed">
          Vous pouvez commencer seul, en cinq minutes, ou demander une démo pour explorer
          l'outil avec votre équipe. Les deux chemins mènent au même endroit — un dossier
          juridique propre, validé par un professionnel.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            to="/dossier/nouveau"
            className="sheen inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 shadow-gold transition-all duration-300 hover:-translate-y-0.5 hover:shadow-gold-strong"
          >
            Créer un dossier
            <ArrowRightIcon width={14} height={14} strokeWidth={2} />
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center gap-2 rounded-full border border-cream-50/20 bg-transparent px-6 py-3.5 text-sm font-medium text-cream-50 transition-colors hover:border-cream-50/50"
          >
            Réserver une démo
          </Link>
        </div>
      </div>
    </Reveal>
  );
}
