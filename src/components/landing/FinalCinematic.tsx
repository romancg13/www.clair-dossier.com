import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Magnetic } from '../primitives/Magnetic';
import { ArrowRightIcon } from '../icons';
import { DossierShowcase } from './DossierShowcase';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Séquence finale — la maquette produit (ex-visuel du Hero, réaffectée ici),
 * puis une phrase et une seule action. Même CTA principal que le hero (§32).
 * Sa scène 3D de convergence est devenue la scène principale du Hero.
 */
export function FinalCinematic() {
  const reduce = useReducedMotion();
  const enter = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 16 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.3 },
          transition: { duration: 0.7, delay, ease: EASE },
        };

  return (
    <section className="cd-cinema cd-grain relative isolate overflow-hidden text-cream-50">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />

      <div className="mx-auto max-w-6xl px-5 py-24 text-center sm:px-8 sm:py-32 lg:py-36">
        {/* La maquette « Suivi du dossier » (ancien visuel du Hero) */}
        <motion.div
          className="mx-auto max-w-[560px] text-left"
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, scale: 0.96, y: 24 },
                whileInView: { opacity: 1, scale: 1, y: 0 },
                viewport: { once: true, amount: 0.3 },
                transition: { duration: 1, ease: EASE },
              })}
        >
          <DossierShowcase />
        </motion.div>

        <motion.p {...enter(0.5)} className="mt-14 font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-400">
          Passez à l’usage
        </motion.p>
        <motion.h2
          {...enter(0.6)}
          className="mx-auto mt-4 max-w-4xl font-display text-[clamp(2.4rem,5.6vw,5rem)] font-semibold leading-[1.0] tracking-[-0.02em] text-cream-50"
        >
          Transformez vos dossiers en décisions claires.
        </motion.h2>
        <motion.p {...enter(0.7)} className="mx-auto mt-6 max-w-2xl text-[1.05rem] leading-relaxed text-silver-200/78">
          Vos pièces au même endroit, votre dossier suivi, la transmission à votre main.
        </motion.p>
        <motion.div {...enter(0.8)} className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Magnetic strength={0.12}>
            <Link
              to="/inscription"
              className="sheen cd-btn-primary group inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-gold-strong"
            >
              Commencer
              <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Magnetic>
          <Link
            to="/rendez-vous"
            className="inline-flex items-center gap-2 rounded-full border cd-hairline-strong px-6 py-3.5 text-sm font-medium text-cream-50 transition-colors hover:border-cream-50/60"
          >
            Demander une démonstration
          </Link>
        </motion.div>
        <motion.p {...enter(0.9)} className="mt-6 text-sm text-silver-400">
          Déjà un compte ?{' '}
          <Link to="/connexion" className="border-b cd-hairline-strong text-silver-200 transition-colors hover:text-gold-400">
            Se connecter
          </Link>
        </motion.p>
      </div>
    </section>
  );
}
