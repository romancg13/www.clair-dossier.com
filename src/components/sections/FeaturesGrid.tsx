import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import { features } from '../../data/features';
import { FEATURE_ICONS, ArrowRightIcon } from '../icons';

export function FeaturesGrid() {
  const reduce = useReducedMotion();
  return (
    <Reveal as="section" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Fonctionnalités
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
            Huit briques pour structurer un dossier juridique.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            Chaque brique répond à un point de friction identifié auprès de cabinets et de
            services juridiques français. Aucune n'est décorative.
          </p>
        </div>

        <Stagger inView className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => {
            const Icon = FEATURE_ICONS[f.icon];
            return (
              <StaggerItem key={f.slug}>
                <motion.div
                  whileHover={reduce ? {} : { y: -4 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="group relative flex h-full flex-col rounded-xl border hairline bg-white p-6 transition-colors duration-300 hover:border-gold-500"
                >
                  <span className="grid h-11 w-11 place-items-center rounded-lg bg-cream-100 text-navy-900 transition-colors group-hover:bg-gold-500/15 group-hover:text-gold-500">
                    <Icon />
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold leading-snug text-navy-900">
                    {f.shortTitle}
                  </h3>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-slate-500">
                    {f.blurb}
                  </p>
                  <Link
                    to={`/fonctionnalites/${f.slug}`}
                    className="mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-navy-900 transition-colors hover:text-gold-500"
                  >
                    Voir
                    <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </motion.div>
              </StaggerItem>
            );
          })}
        </Stagger>
      </div>
    </Reveal>
  );
}
