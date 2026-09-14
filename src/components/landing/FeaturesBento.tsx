import type { PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import { features } from '../../data/features';
import { FEATURE_ICONS, ArrowRightIcon, CheckIcon } from '../icons';
import { TUNNEL_STEPS } from './demo-dossier';

/**
 * Fonctionnalités — bento spécifique ClairDossier (ELEVATE de FeaturesGrid).
 * Les neuf briques réelles (src/data/features.ts) sont toutes présentes, avec
 * leur lien vers /fonctionnalites/{slug} ; la brique fondatrice (création
 * guidée) occupe le bloc principal. Lumière suivant le pointeur : desktop,
 * souris uniquement (CSS .cd-tile, variables --mx/--my).
 */

// Placement sur 12 colonnes — la grille reste lisible à chaque rupture.
const SPANS = [
  'lg:col-span-6 lg:row-span-2',
  'lg:col-span-6',
  'lg:col-span-3',
  'lg:col-span-3',
  'lg:col-span-4',
  'lg:col-span-4',
  'lg:col-span-4',
  'lg:col-span-6',
  'lg:col-span-6',
];

function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
  if (e.pointerType !== 'mouse') return;
  const tile = (e.target as HTMLElement).closest<HTMLElement>('.cd-tile');
  if (!tile) return;
  const r = tile.getBoundingClientRect();
  tile.style.setProperty('--mx', `${e.clientX - r.left}px`);
  tile.style.setProperty('--my', `${e.clientY - r.top}px`);
}

export function FeaturesBento() {
  return (
    <Reveal as="section" id="fonctionnalites" className="relative bg-cream-50">
      <div aria-hidden="true" className="cd-grid-light pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">Fonctionnalités</p>
          <h2 className="mt-3 font-display text-[clamp(2.1rem,4.4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.015em] text-navy-900">
            L'essentiel pour structurer un dossier.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-500">
            Neuf briques concrètes, aucune décorative — chacune détaillée sur sa propre page.
          </p>
        </div>

        <Stagger inView className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-12" >
          <div className="contents" onPointerMove={onPointerMove}>
            {features.map((f, i) => {
              const Icon = FEATURE_ICONS[f.icon];
              const main = i === 0;
              return (
                <StaggerItem key={f.slug} className={`${SPANS[i] ?? 'lg:col-span-4'} ${main ? 'sm:col-span-2 lg:col-span-6' : ''}`}>
                  <article
                    className={`cd-tile flex h-full flex-col rounded-[1.125rem] border hairline bg-white ${
                      main ? 'p-7 sm:p-8' : 'p-6'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="grid h-11 w-11 place-items-center rounded-lg bg-cream-100 text-navy-900">
                        <Icon />
                      </span>
                      {main && (
                        <span className="rounded-full border hairline-gold bg-gold-500/10 px-2.5 py-1 font-mono text-[0.6rem] uppercase tracking-[0.16em] text-gold-700">
                          Brique fondatrice
                        </span>
                      )}
                    </div>
                    <h3
                      className={`mt-5 font-display font-semibold leading-snug text-navy-900 ${
                        main ? 'text-2xl sm:text-3xl' : 'text-xl'
                      }`}
                    >
                      {main ? f.title : f.shortTitle}
                    </h3>
                    <p className={`mt-3 text-sm leading-relaxed text-slate-500 ${main ? 'max-w-md sm:text-[0.95rem]' : 'flex-1'}`}>
                      {f.blurb}
                    </p>

                    {main && (
                      <ol className="mt-7 flex-1 space-y-2.5" aria-label="Les cinq étapes du tunnel">
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

                    <Link
                      to={`/fonctionnalites/${f.slug}`}
                      className="group mt-5 inline-flex items-center gap-1.5 self-start text-sm font-medium text-navy-900 transition-colors hover:text-gold-700"
                    >
                      Voir
                      <ArrowRightIcon width={14} height={14} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
                    </Link>
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
