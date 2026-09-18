import type { PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import { featuresByGroup } from '../../data/features';
import { FEATURE_ICONS, ArrowRightIcon, CheckIcon } from '../icons';
import { TUNNEL_STEPS } from './demo-dossier';

/**
 * Fonctionnalités — bento spécifique ClairDossier (ELEVATE de FeaturesGrid).
 * LB13 · chantier 12 : présentation en QUATRE groupes d'usage, même
 * vocabulaire que /fonctionnalites (src/data/features.ts → FEATURE_GROUPS).
 * Les neuf fiches réelles restent toutes présentes, avec leur lien vers
 * /fonctionnalites/{slug} ; le groupe « Créer et nommer » occupe le bloc
 * principal (étapes réelles du tunnel). Lumière suivant le pointeur :
 * desktop, souris uniquement (CSS .cd-tile, variables --mx/--my).
 */

// Placement sur 12 colonnes — la grille reste lisible à chaque rupture.
const SPANS: Record<string, string> = {
  creer: 'sm:col-span-2 lg:col-span-5 lg:row-span-2',
  deposer: 'lg:col-span-7',
  suivre: 'lg:col-span-7',
  valider: 'sm:col-span-2 lg:col-span-12',
};

function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
  if (e.pointerType !== 'mouse') return;
  const tile = (e.target as HTMLElement).closest<HTMLElement>('.cd-tile');
  if (!tile) return;
  const r = tile.getBoundingClientRect();
  tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
  tile.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export function FeaturesBento() {
  const groups = featuresByGroup();
  return (
    <Reveal as="section" id="fonctionnalites" className="relative bg-cream-50">
      <div aria-hidden="true" className="cd-grid-light pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">Fonctionnalités</p>
          <h2 className="mt-3 font-display text-[clamp(2.1rem,4.4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.015em] text-navy-900">
            Tout pour organiser et suivre vos dossiers.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
            Quatre temps, du premier document à la transmission — chaque fonctionnalité est détaillée
            sur sa propre page.
          </p>
        </div>

        <Stagger inView className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <div className="contents" onPointerMove={onPointerMove}>
            {groups.map((g, i) => {
              const main = g.id === 'creer';
              const wide = g.id === 'valider';
              return (
                <StaggerItem key={g.id} className={SPANS[g.id] ?? 'lg:col-span-6'}>
                  <article
                    aria-labelledby={`bento-${g.id}`}
                    className={`cd-tile flex h-full flex-col rounded-[1.125rem] border hairline bg-white ${
                      main ? 'p-7 sm:p-8' : 'p-6 sm:p-7'
                    }`}
                  >
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-gold-700">
                      {String(i + 1).padStart(2, '0')}
                    </p>
                    <h3
                      id={`bento-${g.id}`}
                      className={`mt-2 font-display font-semibold leading-snug text-navy-900 ${
                        main ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                      }`}
                    >
                      {g.title}
                    </h3>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-[0.95rem]">
                      {g.intro}
                    </p>

                    {main && (
                      <ol className="mt-7 space-y-2.5" aria-label="Les cinq étapes du tunnel">
                        {TUNNEL_STEPS.map((step, j) => {
                          const last = j === TUNNEL_STEPS.length - 1;
                          return (
                            <li key={step} className="flex items-center gap-3">
                              <span
                                className={`grid h-6 w-6 shrink-0 place-items-center rounded-full font-mono text-[0.6rem] ${
                                  last ? 'bg-gold-500 text-navy-900' : 'border hairline-strong bg-white text-navy-900'
                                }`}
                              >
                                {last ? <CheckIcon width={11} height={11} strokeWidth={2.4} /> : j + 1}
                              </span>
                              <span className={`text-sm ${last ? 'font-medium text-navy-900' : 'text-slate-500'}`}>
                                {step}
                              </span>
                              {j < TUNNEL_STEPS.length - 1 && (
                                <span aria-hidden="true" className="ml-auto hidden h-px w-16 bg-navy-900/8 sm:block" />
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    )}

                    <ul
                      className={`mt-6 grid flex-1 content-end gap-4 ${wide ? 'md:grid-cols-3' : ''}`}
                    >
                      {g.features.map((f) => {
                        const Icon = FEATURE_ICONS[f.icon];
                        return (
                          <li key={f.slug} className="flex gap-3 border-t hairline pt-4">
                            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-cream-100 text-navy-900">
                              <Icon width={20} height={20} />
                            </span>
                            <div className="min-w-0">
                              <Link
                                to={`/fonctionnalites/${f.slug}`}
                                className="group inline-flex items-center gap-1.5 text-sm font-semibold text-navy-900 transition-colors hover:text-gold-700"
                              >
                                {f.shortTitle}
                                <ArrowRightIcon
                                  width={13}
                                  height={13}
                                  strokeWidth={2}
                                  className="transition-transform group-hover:translate-x-0.5"
                                />
                              </Link>
                              <p className="mt-1 text-sm leading-relaxed text-slate-500">{f.benefit}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </article>
                </StaggerItem>
              );
            })}
          </div>
        </Stagger>
      </div>
    </Reveal>
  );
}
