import { useEffect, type CSSProperties, type MouseEvent as ReactMouseEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { animate, useMotionValue, useReducedMotion } from 'motion/react';
import { Magnetic } from '../primitives/Magnetic';
import { MarkerHighlight } from '../primitives/MarkerHighlight';
import { ArrowRightIcon } from '../icons';
import { STORY_ANCHOR } from './StoryScene';
import { DEMO } from './demo-dossier';
import { DemoBadge } from './Stage';
import { DocumentGlyph } from './DocumentGlyph';
// Phase 4b — couche 3D (progressive enhancement, client-only, hors chemin critique).
import { CinematicGate } from './cinematics/CinematicGate';
import { CINEMATIC_SCENES } from './cinematics/scenes';

/**
 * Hero — compréhension en trois secondes : QUOI, POUR QUI, UNE ACTION.
 *
 * Texte critique 100 % CSS (lisible sans JavaScript, pré-rendu) : H1 par mots
 * (.cd-word-mask), phrase 0,9 s, CTA 1,1 s. La scène de convergence (reprise
 * du bloc final — les documents se rangent) joue dans un cadre scénique bleu
 * nuit : pilotée dans le temps à l'arrivée (0 → 1 en ~3 s), puis respiration
 * ambiante. Repli statique soigné (papiers CSS) si la 3D est indisponible,
 * et composition figée en motion réduite. Le titre, la phrase et les CTA
 * n'attendent jamais la scène.
 */

type Word = string | { node: ReactNode } | { break: true };

const TITLE: Word[] = [
  'Des',
  'documents',
  'dispersés.',
  { break: true },
  'Un',
  'dossier',
  { node: <MarkerHighlight delay={1.05}>clair.</MarkerHighlight> },
];

/** Préversion (build VITE_DEMO=1) : présente le traitement IA, absent de la production. */
const PREVIEW_IA = import.meta.env.VITE_DEMO === '1';

export function HeroCinematic() {
  const reduce = useReducedMotion();

  // Convergence jouée à l'arrivée : 0 → 1 (motion réduite : directement en place).
  const intro = useMotionValue(reduce ? 1 : 0);
  useEffect(() => {
    if (reduce) {
      intro.set(1);
      return;
    }
    const ctrl = animate(intro, 1, { duration: 3.2, delay: 0.35, ease: [0.22, 1, 0.36, 1] });
    return () => ctrl.stop();
  }, [reduce, intro]);

  function scrollToStory(e: ReactMouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(STORY_ANCHOR);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }

  let wordIndex = 0;

  return (
    <section className="premium-hero-shell relative isolate overflow-hidden bg-cream-50">
      <div aria-hidden="true" className="cd-grid-light pointer-events-none absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(55% 45% at 78% 12%, rgba(179,210,239,0.22), transparent 60%), radial-gradient(45% 40% at 8% 88%, rgba(196,164,86,0.12), transparent 65%)',
        }}
      />

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:grid lg:grid-cols-[1.02fr_0.98fr] lg:items-center lg:gap-14 lg:px-12 lg:pb-24 lg:pt-20">
        {/* ── Texte : QUOI, POUR QUI, ACTION ── */}
        <div className="relative z-10">
          <h1 className="font-display text-[clamp(2.6rem,5.8vw,5.1rem)] font-semibold leading-[0.96] tracking-[-0.02em] text-navy-900">
            {TITLE.map((w, i) => {
              if (typeof w === 'object' && 'break' in w) {
                return <br key={i} />;
              }
              const idx = wordIndex++;
              return (
                <span key={i}>
                  <span className="cd-word-mask">
                    <span style={{ '--w': idx } as CSSProperties}>{typeof w === 'string' ? w : w.node}</span>
                  </span>{' '}
                </span>
              );
            })}
          </h1>

          <p
            className="rise-in mt-6 max-w-xl text-[1.08rem] leading-[1.6] text-slate-600 sm:text-lg"
            style={{ '--rise-delay': '0.85s' } as CSSProperties}
          >
            {PREVIEW_IA
              ? 'Déposez vos documents. L’IA prépare votre résumé, votre chronologie et vos échéances dans un espace privé.'
              : 'Déposez vos documents : votre dossier est structuré et suivi, vos échéances restent visibles — dans un espace privé.'}
          </p>
          <p
            className="rise-in mt-3 font-mono text-[0.72rem] uppercase tracking-[0.18em] text-gold-700"
            style={{ '--rise-delay': '0.95s' } as CSSProperties}
          >
            Pour les entreprises, indépendants et cabinets.
          </p>

          <div
            className="rise-in mt-8 flex flex-wrap items-center gap-3"
            style={{ '--rise-delay': '1.1s' } as CSSProperties}
          >
            <Magnetic strength={0.12}>
              <Link
                to="/inscription"
                className="sheen cd-btn-primary group inline-flex items-center gap-2 rounded-full bg-gold-500 px-6 py-3.5 text-sm font-semibold text-navy-900 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-gold-strong"
              >
                Commencer
                <ArrowRightIcon
                  width={14}
                  height={14}
                  strokeWidth={2}
                  className="transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </Magnetic>
            {PREVIEW_IA ? (
              <Link
                to="/demo"
                className="inline-flex items-center gap-2 rounded-full border hairline-strong bg-white/60 px-6 py-3.5 text-sm font-medium text-navy-900 transition-colors hover:border-navy-900 hover:bg-white"
              >
                Voir un exemple
              </Link>
            ) : (
              <a
                href={`#${STORY_ANCHOR}`}
                onClick={scrollToStory}
                className="group inline-flex items-center gap-2 rounded-full border hairline-strong bg-white/60 px-6 py-3.5 text-sm font-medium text-navy-900 transition-colors hover:border-navy-900 hover:bg-white"
              >
                Voir un exemple
                <span aria-hidden="true" className="text-slate-400 transition-transform group-hover:translate-y-0.5">
                  ↓
                </span>
              </a>
            )}
          </div>

          {PREVIEW_IA && (
            <p
              className="rise-in mt-5 max-w-xl text-[0.78rem] leading-relaxed text-slate-500"
              style={{ '--rise-delay': '1.2s' } as CSSProperties}
            >
              Préversion : le traitement automatique présenté ici n’est pas encore activé sur le
              service en production.
            </p>
          )}
        </div>

        {/* ── Scène principale : la convergence documentaire, dans un cadre scénique ── */}
        <div className="rise-in relative z-10 mt-12 lg:mt-0" style={{ '--rise-delay': '1.15s' } as CSSProperties}>
          <div
            className="relative h-[340px] w-full overflow-hidden rounded-[1.75rem] border border-navy-900/15 shadow-card sm:h-[440px] lg:h-[560px]"
            style={{
              background:
                'radial-gradient(90% 70% at 50% 30%, #152348 0%, #0d1b3d 55%, #0a1430 100%)',
            }}
          >
            {CINEMATIC_SCENES.hero.enabled ? (
              <CinematicGate load={CINEMATIC_SCENES.hero.load} progress={intro} priority="hero">
                <HeroPoster />
              </CinematicGate>
            ) : (
              <HeroPoster />
            )}
            {/* Au centre de la convergence : l'aperçu du dossier (la scène se range autour). */}
            <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
              <div className="cd-stage w-full max-w-[330px] rounded-2xl p-4 text-left sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-display text-[1.02rem] font-semibold text-cream-50">{DEMO.title}</span>
                  <DemoBadge />
                </div>
                <dl className="mt-3 space-y-2">
                  <div className="flex items-center gap-2.5 text-[0.8rem] text-silver-200/85">
                    <DocumentGlyph type="devis" width={14} height={14} className="shrink-0 text-silver-400" />
                    <dt className="sr-only">Pièces</dt>
                    <dd>{DEMO.pieces.length} pièces réunies, téléchargeables</dd>
                  </div>
                  <div className="flex items-center gap-2.5 text-[0.8rem] text-silver-200/85">
                    <DocumentGlyph type="echeance" width={14} height={14} className="shrink-0 text-gold-400" />
                    <dt className="sr-only">Échéance</dt>
                    <dd>
                      Échéance <span className="font-medium text-gold-400">{DEMO.deadline.dateShort}</span> affichée sur le dossier
                    </dd>
                  </div>
                  <div className="flex items-center gap-2.5 text-[0.8rem] text-silver-200/85">
                    <span aria-hidden="true" className="grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full bg-gold-500/90 text-[0.5rem] font-bold text-navy-900">✓</span>
                    <dt className="sr-only">Résultat</dt>
                    <dd>Résumé, chronologie et échéances prêts</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between px-5 pb-4"
            >
              <span className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-cream-50/50">
                Vos documents trouvent leur place
              </span>
              <span className="h-1.5 w-1.5 rounded-full bg-gold-500/80" />
            </div>
          </div>
          <div
            aria-hidden="true"
            className="absolute -inset-6 -z-10 rounded-[2.25rem] bg-gradient-to-br from-navy-900/12 via-transparent to-gold-500/14 blur-3xl"
          />
        </div>
      </div>
    </section>
  );
}

/** Repli statique du cadre scénique : papiers posés, aucun JavaScript requis. */
function HeroPoster() {
  const sheets = [
    { l: '12%', t: '18%', w: 72, h: 94, r: -8, o: 0.5 },
    { l: '30%', t: '48%', w: 86, h: 112, r: 5, o: 0.72 },
    { l: '52%', t: '22%', w: 96, h: 124, r: -3, o: 0.9 },
    { l: '70%', t: '52%', w: 78, h: 102, r: 9, o: 0.6 },
    { l: '44%', t: '62%', w: 64, h: 84, r: -11, o: 0.42 },
    { l: '80%', t: '16%', w: 58, h: 76, r: 6, o: 0.38 },
  ];
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div
        className="absolute inset-0"
        style={{ background: 'radial-gradient(60% 45% at 50% 38%, rgba(179,210,239,0.10), transparent 70%)' }}
      />
      {sheets.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-[4px] border border-cream-50/20 bg-cream-50/90 shadow-card"
          style={{ left: s.l, top: s.t, width: s.w, height: s.h, transform: `rotate(${s.r}deg)`, opacity: s.o }}
        >
          <div className="mx-2 mt-2 h-1 rounded bg-navy-900/15" />
          <div className="mx-2 mt-1 h-1 w-2/3 rounded bg-navy-900/10" />
        </div>
      ))}
    </div>
  );
}
