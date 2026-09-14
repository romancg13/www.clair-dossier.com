import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion, useScroll } from 'motion/react';
// Phase 4b — convergence finale 3D (client-only, différée, desktop).
import { CinematicGate } from './cinematics/CinematicGate';
import { CINEMATIC_SCENES } from './cinematics/scenes';
import { useMediaQuery } from './useCinematic';
import { Magnetic } from '../primitives/Magnetic';
import { ArrowRightIcon } from '../icons';
import { BUSINESS_STEPS, DEMO } from './demo-dossier';
import { DocumentGlyph } from './DocumentGlyph';
import { DemoBadge } from './Stage';

const EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Séquence finale — l'interface se recentre, les modules apparaissent, puis
 * une phrase et une seule action. Même CTA principal que le hero (§32).
 */
export function FinalCinematic() {
  const reduce = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { scrollYProgress: approach } = useScroll({ target: sectionRef, offset: ['start 92%', 'center 50%'], layoutEffect: false });
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
    <section ref={sectionRef} className="cd-cinema cd-grain relative isolate overflow-hidden text-cream-50">
      {CINEMATIC_SCENES.final.enabled && desktop && (
        <CinematicGate load={CINEMATIC_SCENES.final.load} progress={approach} className="cd-gl" nearMargin="90%" farMargin="220%" />
      )}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-gold-500/60 to-transparent" />

      <div className="mx-auto max-w-6xl px-5 py-24 text-center sm:px-8 sm:py-32 lg:px-12 lg:py-40">
        {/* L'interface se recentre */}
        <motion.div
          aria-hidden="true"
          className="mx-auto max-w-2xl"
          {...(reduce
            ? {}
            : {
                initial: { opacity: 0, scale: 0.94, y: 24 },
                whileInView: { opacity: 1, scale: 1, y: 0 },
                viewport: { once: true, amount: 0.3 },
                transition: { duration: 1, ease: EASE },
              })}
        >
          <div className="cd-stage rounded-[1.25rem] p-4 text-left sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate font-display text-lg font-semibold text-cream-50">{DEMO.title}</span>
              <DemoBadge />
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <motion.div {...enter(0.25)} className="rounded-lg border cd-hairline bg-navy-950/40 p-3">
                <p className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-silver-400">Étapes</p>
                <div className="mt-2 grid grid-cols-5 gap-1">
                  {BUSINESS_STEPS.map((s, i) => (
                    <span
                      key={s}
                      className={`h-1 rounded-full ${i + 1 < DEMO.step ? 'bg-cream-50/80' : i + 1 === DEMO.step ? 'bg-gold-500' : 'bg-cream-50/12'}`}
                    />
                  ))}
                </div>
                <p className="mt-2 text-[0.74rem] text-cream-50">
                  {DEMO.step} / {BUSINESS_STEPS.length} · {BUSINESS_STEPS[DEMO.step - 1]}
                </p>
              </motion.div>
              <motion.div {...enter(0.4)} className="rounded-lg border cd-hairline bg-navy-950/40 p-3">
                <p className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-silver-400">Pièces</p>
                <ul className="mt-2 space-y-1">
                  {DEMO.pieces.slice(0, 3).map((piece) => (
                    <li key={piece.name} className="flex items-center gap-1.5 text-[0.72rem] text-cream-50">
                      <DocumentGlyph type={piece.type} width={12} height={12} className="shrink-0 text-silver-400" />
                      <span className="truncate">{piece.name}</span>
                    </li>
                  ))}
                </ul>
              </motion.div>
              <motion.div {...enter(0.55)} className="rounded-lg border cd-hairline bg-navy-950/40 p-3">
                <p className="font-mono text-[0.56rem] uppercase tracking-[0.14em] text-silver-400">Échéance</p>
                <p className="mt-2 font-display text-base font-semibold text-gold-400">{DEMO.deadline.dateShort}</p>
                <p className="text-[0.72rem] text-cream-50">{DEMO.deadline.label}</p>
              </motion.div>
            </div>
          </div>
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
          Centralisez vos pièces, suivez chaque étape et transmettez quand vous le décidez — avec
          ClairDossier.
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
