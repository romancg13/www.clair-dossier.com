import type { PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { Stagger, StaggerItem } from '../primitives/Reveal';
import { featuresByGroup } from '../../data/features';
import { FEATURE_ICONS, ArrowRightIcon, CheckIcon } from '../icons';
import { TUNNEL_STEPS } from './demo-dossier';

/**
 * Fonctionnalités — bento par besoin (/fonctionnalites). Les neuf fiches
 * réelles restent toutes présentes, avec leur lien vers
 * /fonctionnalites/{slug} ; le groupe « creer » occupe le bloc principal
 * (étapes réelles du tunnel). Ancres `#groupe-{id}` : navigation du hero.
 * Lumière suivant le pointeur : desktop, souris uniquement (CSS .cd-tile,
 * variables --mx/--my).
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
    <section aria-label="Fonctionnalités par besoin" className="relative bg-cream-50">
      <div aria-hidden="true" className="cd-grid-light pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-5 pb-16 pt-4 sm:px-8 sm:pb-20 lg:px-12 lg:pb-24">
        <Stagger inView className="grid gap-4 sm:grid-cols-2 lg:grid-cols-12">
          <div className="contents" onPointerMove={onPointerMove}>
            {groups.map((g, i) => {
              const main = g.id === 'creer';
              const wide = g.id === 'valider';
              return (
                <StaggerItem key={g.id} className={SPANS[g.id] ?? 'lg:col-span-6'}>
                  <article
                    id={`groupe-${g.id}`}
                    aria-labelledby={`groupe-${g.id}-titre`}
                    className={`cd-tile flex h-full scroll-mt-28 flex-col rounded-[1.125rem] border hairline bg-white ${
                      main ? 'p-7 sm:p-8' : 'p-6 sm:p-7'
                    }`}
                  >
                    <p className="font-mono text-[0.68rem] uppercase tracking-[0.18em] text-gold-700">
                      {String(i + 1).padStart(2, '0')}
                    </p>
                    <h2
                      id={`groupe-${g.id}-titre`}
                      className={`mt-2 font-display font-semibold leading-snug text-navy-900 ${
                        main ? 'text-2xl sm:text-3xl' : 'text-xl sm:text-2xl'
                      }`}
                    >
                      {g.title}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-slate-500 sm:text-[0.95rem]">
                      {g.intro}
                    </p>

                    {main && (
                      <ol className="mt-7 space-y-2.5" aria-label="Les cinq étapes du tunnel de création">
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
                                to={`/fonctionnalites/${f.slug}/`}
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
                              {f.limit && (
                                <p className="mt-2 text-xs leading-relaxed text-slate-500">
                                  <span className="mr-1.5 inline-flex items-center rounded-full border hairline bg-cream-100 px-2 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">
                                    Pas encore disponible
                                  </span>
                                  {f.limit}
                                </p>
                              )}
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
    </section>
  );
}
