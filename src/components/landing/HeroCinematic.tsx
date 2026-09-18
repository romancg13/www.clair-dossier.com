import {
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { Magnetic } from '../primitives/Magnetic';
import { MarkerHighlight } from '../primitives/MarkerHighlight';
import { ArrowRightIcon, LockIcon } from '../icons';
import { BUSINESS_STEPS, DEMO } from './demo-dossier';
import { DocumentGlyph } from './DocumentGlyph';
import { DemoBadge } from './Stage';
import { STORY_ANCHOR } from './StoryScene';
// Phase 4b — couche 3D (progressive enhancement, client-only, hors chemin critique).
import { CinematicGate } from './cinematics/CinematicGate';
import { CINEMATIC_SCENES } from './cinematics/scenes';

/**
 * Hero — moment « wow » sans surcharge.
 *
 * Entrée cinématique 100 % CSS pour tout ce qui est critique (lisible sans
 * JavaScript, pré-rendu) : nav 0–300 ms (Nav.tsx, .cd-nav-enter), H1 par mots
 * 300–900 ms (.cd-word-mask), sous-titre 900 ms, CTA 1 100 ms, produit
 * 1 300 → 2 000 ms (.rise-in + --rise-delay). Le seul JavaScript est la
 * parallaxe pointeur, desktop uniquement, désactivée en motion réduite.
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

export function HeroCinematic() {
  const reduce = useReducedMotion();

  // Parallaxe pointeur : valeurs normalisées [-0.5, 0.5] → rotations ±5°.
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 60, damping: 20, mass: 0.6 });
  const sy = useSpring(my, { stiffness: 60, damping: 20, mass: 0.6 });
  const rotateY = useTransform(sx, [-0.5, 0.5], [-5, 5]);
  const rotateX = useTransform(sy, [-0.5, 0.5], [4, -4]);
  const satX = useTransform(sx, (v) => v * -26);
  const satY = useTransform(sy, (v) => v * -18);
  const stageRef = useRef<HTMLDivElement>(null);

  // Progression de sortie du hero (0 en haut de page → 1 quand le hero a quitté l'écran),
  // lue par la scène 3D pour sa parallaxe ; le calque s'estompe en DOM (compositeur).
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress: heroProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end start'], layoutEffect: false });
  const layerOpacity = useTransform(heroProgress, [0, 0.75], [1, 0]);

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (reduce || e.pointerType !== 'mouse' || !stageRef.current) return;
    const r = stageRef.current.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  }
  function onPointerLeave() {
    mx.set(0);
    my.set(0);
  }

  function scrollToStory(e: ReactMouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(STORY_ANCHOR);
    if (!target) return;
    e.preventDefault();
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    target.focus({ preventScroll: true });
  }

  let wordIndex = 0;

  return (
    <section ref={sectionRef} className="premium-hero-shell relative isolate overflow-hidden bg-cream-50">
      <div aria-hidden="true" className="cd-grid-light pointer-events-none absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(55% 45% at 78% 12%, rgba(179,210,239,0.22), transparent 60%), radial-gradient(45% 40% at 8% 88%, rgba(196,164,86,0.12), transparent 65%)',
        }}
      />
      {CINEMATIC_SCENES.hero.enabled && (
        <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0" style={{ opacity: layerOpacity }}>
          <CinematicGate load={CINEMATIC_SCENES.hero.load} progress={heroProgress} priority="hero" />
        </motion.div>
      )}

      <div className="mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 sm:pt-20 lg:grid lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-14 lg:px-12 lg:pb-28 lg:pt-24">
        {/* ── Texte ── */}
        <div className="relative z-10">
          <p
            className="rise-in inline-flex items-center gap-2 rounded-full border hairline-gold bg-white/70 px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.18em] text-gold-700"
            style={{ '--rise-delay': '0.25s' } as CSSProperties}
          >
            <span className="h-1 w-1 rounded-full bg-gold-500" aria-hidden="true" />
            Dossiers administratifs &amp; juridiques, clairs.
          </p>

          <h1 className="mt-6 font-display text-[clamp(2.75rem,6.2vw,5.75rem)] font-semibold leading-[0.94] tracking-[-0.02em] text-navy-900">
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
            className="rise-in mt-7 max-w-xl text-[1.05rem] leading-[1.65] text-slate-500 sm:text-lg"
            style={{ '--rise-delay': '0.9s' } as CSSProperties}
          >
            ClairDossier réunit vos pièces dans un espace privé, structure votre dossier en cinq
            étapes, affiche vos échéances — et ne transmet rien sans votre validation. Pour les
            PME, artisans, indépendants et professions libérales.
          </p>

          <div
            className="rise-in mt-9 flex flex-wrap items-center gap-3"
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
            <a
              href={`#${STORY_ANCHOR}`}
              onClick={scrollToStory}
              className="group inline-flex items-center gap-2 rounded-full border hairline-strong bg-white/60 px-6 py-3.5 text-sm font-medium text-navy-900 transition-colors hover:border-navy-900 hover:bg-white"
            >
              Voir comment ça fonctionne
              <span aria-hidden="true" className="text-slate-400 transition-transform group-hover:translate-y-0.5">
                ↓
              </span>
            </a>
          </div>

          <p
            className="rise-in mt-5 text-[0.8rem] text-slate-500"
            style={{ '--rise-delay': '1.25s' } as CSSProperties}
          >
            Compte gratuit, confirmé par e-mail · Sans engagement · Aucune lecture automatique de vos
            pièces.
          </p>

          <p
            className="rise-in mt-8 text-sm text-slate-500"
            style={{ '--rise-delay': '1.35s' } as CSSProperties}
          >
            Cabinet ou structure à fort volume documentaire ?{' '}
            <Link
              to="/grands-comptes"
              className="border-b hairline-gold font-medium text-navy-900 transition-colors hover:text-gold-700"
            >
              Découvrir le parcours dédié
            </Link>
          </p>
        </div>

        {/* ── Mise en scène produit ── */}
        <div
          ref={stageRef}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          className="rise-in relative z-10 mt-16 lg:mt-0"
          style={{ '--rise-delay': '1.3s' } as CSSProperties}
        >
          <div className="relative mx-auto max-w-[560px] [perspective:1600px]">
            <motion.div
              style={reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }}
              className="relative"
            >
              <MainCard />

              {/* Satellites — profondeur via translateZ, flottement CSS très lent */}
              <motion.div
                aria-hidden="true"
                style={reduce ? undefined : { x: satX, y: satY }}
                className="pointer-events-none absolute inset-0 hidden sm:block"
              >
                <Satellite className="cd-float-a -top-5 -left-2 lg:-left-16 lg:top-4" depth={70}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-navy-900/6 text-navy-900">
                    <DocumentGlyph type="devis" />
                  </span>
                  <span>
                    <span className="block text-[0.78rem] font-medium text-navy-900">
                      {DEMO.pieces[0].name}
                    </span>
                    <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
                      {DEMO.pieces[0].meta}
                    </span>
                  </span>
                </Satellite>

                <Satellite className="cd-float-b -right-3 top-[30%] lg:-right-14" depth={90}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-gold-500/15 text-gold-700">
                    <DocumentGlyph type="echeance" />
                  </span>
                  <span>
                    <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
                      Échéance
                    </span>
                    <span className="block text-[0.78rem] font-medium text-navy-900">
                      {DEMO.deadline.dateLong}
                    </span>
                  </span>
                </Satellite>

                <Satellite className="cd-float-c -bottom-6 left-6 lg:-left-8" depth={60}>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-navy-900 text-cream-50">
                    <LockIcon width={14} height={14} />
                  </span>
                  <span>
                    <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
                      Transmission
                    </span>
                    <span className="block text-[0.78rem] font-medium text-navy-900">
                      À votre validation · jamais automatique
                    </span>
                  </span>
                </Satellite>
              </motion.div>
            </motion.div>
          </div>

          <div
            aria-hidden="true"
            className="absolute -inset-6 -z-10 rounded-[2rem] bg-gradient-to-br from-gold-500/14 via-transparent to-sky-marker/40 blur-3xl"
          />
        </div>
      </div>
    </section>
  );
}

function Satellite({ children, className, depth }: { children: ReactNode; className: string; depth: number }) {
  return (
    <div
      className={`absolute ${className}`}
      style={{ transform: `translateZ(${depth}px)` }}
    >
      <div className="cd-paper flex items-center gap-3 rounded-xl px-3.5 py-2.5 shadow-float">{children}</div>
    </div>
  );
}

function MainCard() {
  return (
    <div className="relative rounded-2xl border hairline bg-white p-6 shadow-card sm:p-7">
      <div className="flex items-center justify-between gap-3">
        <DemoBadge tone="light" />
        <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-900 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-cream-50">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-500" aria-hidden="true" />
          {DEMO.status}
        </span>
      </div>

      <p className="mt-4 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-slate-500">
        Avancement du dossier · {DEMO.reference}
      </p>
      <p className="mt-1.5 font-display text-[1.6rem] font-semibold leading-tight text-navy-900 sm:text-[1.8rem]">
        {DEMO.title}
      </p>
      <p className="mt-1 text-[0.8rem] text-slate-500">
        {DEMO.category} · profil {DEMO.profile}
      </p>

      {/* 5 étapes métier — libellés réels de la page dossier */}
      <ol className="mt-6 grid grid-cols-5 gap-1.5" aria-label="Cinq étapes métier">
        {BUSINESS_STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < DEMO.step ? 'done' : n === DEMO.step ? 'active' : 'todo';
          return (
            <li key={label} className="min-w-0">
              <span
                className={`block h-1 rounded-full ${
                  state === 'done' ? 'bg-navy-900' : state === 'active' ? 'bg-gold-500' : 'bg-navy-900/10'
                }`}
                aria-hidden="true"
              />
              <span
                className={`mt-2 block font-mono text-[0.6rem] tracking-[0.12em] ${
                  state === 'active' ? 'text-gold-700' : 'text-slate-500'
                }`}
                title={label}
                aria-label={`Étape ${n} : ${label}`}
              >
                {String(n).padStart(2, '0')}
              </span>
            </li>
          );
        })}
      </ol>

      <dl className="mt-6 divide-y hairline border-y hairline">
        <Row label="Pièces déposées" value={`${DEMO.pieces.length} pièces · téléchargeables`} />
        <Row label={DEMO.deadline.label} value={DEMO.deadline.dateShort} gold />
        <Row label="Étape en cours" value={`${DEMO.step} / ${BUSINESS_STEPS.length} · ${BUSINESS_STEPS[DEMO.step - 1]}`} />
        <Row label="Transmission" value="à votre validation" />
      </dl>

      <div className="mt-5 rounded-lg bg-cream-100 px-4 py-3">
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-gold-700">
          Ce que vous devez faire maintenant
        </p>
        <p className="mt-1 text-[0.82rem] leading-relaxed text-navy-900">{DEMO.nextAction}</p>
      </div>
    </div>
  );
}

function Row({ label, value, gold = false }: { label: string; value: string; gold?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-[0.82rem]">
      <dt className="text-slate-500">{label}</dt>
      <dd className={`text-right font-medium ${gold ? 'text-gold-700' : 'text-navy-900'}`}>{value}</dd>
    </div>
  );
}
