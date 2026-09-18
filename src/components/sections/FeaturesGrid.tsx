import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'motion/react';
import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import { featuresByGroup } from '../../data/features';
import { FEATURE_ICONS, ArrowRightIcon } from '../icons';

/**
 * Fonctionnalités — composition historique de l'accueil (flag HOME_CINEMATIC
 * désactivé). LB13 · chantier 12 : mêmes quatre groupes et même vocabulaire
 * que /fonctionnalites et le bento de la home cinématique.
 */
export function FeaturesGrid() {
  const reduce = useReducedMotion();
  const groups = featuresByGroup();
  return (
    <Reveal as="section" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-5 py-14 sm:py-20 lg:py-24 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">
            Fonctionnalités
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
            Tout pour organiser et suivre vos dossiers.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            Quatre temps, du premier document à la transmission — chaque fonctionnalité est
            détaillée sur sa propre page.
          </p>
        </div>

        <Stagger inView className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {groups.map((g, i) => (
            <StaggerItem key={g.id}>
              <motion.article
                aria-labelledby={`grille-${g.id}`}
                whileHover={reduce ? {} : { y: -4 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="premium-card group relative flex h-full flex-col rounded-xl border hairline bg-white p-6 transition-colors duration-300 hover:border-gold-500"
              >
                <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-gold-700">
                  {String(i + 1).padStart(2, '0')}
                </p>
                <h3
                  id={`grille-${g.id}`}
                  className="mt-2 font-display text-xl font-semibold leading-snug text-navy-900"
                >
                  {g.title}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-slate-500">{g.intro}</p>
                <ul className="mt-5 flex-1 space-y-3 border-t hairline pt-4">
                  {g.features.map((f) => {
                    const Icon = FEATURE_ICONS[f.icon];
                    return (
                      <li key={f.slug}>
                        <Link
                          to={`/fonctionnalites/${f.slug}`}
                          className="inline-flex items-center gap-2 text-sm font-medium text-navy-900 transition-colors hover:text-gold-700"
                        >
                          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-cream-100 text-navy-900">
                            <Icon width={18} height={18} />
                          </span>
                          {f.shortTitle}
                          <ArrowRightIcon width={13} height={13} strokeWidth={2} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </motion.article>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Reveal>
  );
}
