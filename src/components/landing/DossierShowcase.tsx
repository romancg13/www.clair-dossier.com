import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react';
import { LockIcon } from '../icons';
import { BUSINESS_STEPS, DEMO } from './demo-dossier';
import { DocumentGlyph } from './DocumentGlyph';
import { DemoBadge } from './Stage';

/**
 * Maquette produit « Avancement du dossier » — l'ancien visuel du Hero,
 * réaffecté à la section finale (§32 : une seule mise en scène produit de ce
 * type sur la page). Carte principale + satellites flottants, parallaxe
 * pointeur desktop (désactivée en motion réduite). Données fictives (DEMO).
 */
export function DossierShowcase() {
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

  return (
    <div ref={stageRef} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} className="relative">
      <div className="relative mx-auto max-w-[560px] [perspective:1600px]">
        <motion.div style={reduce ? undefined : { rotateX, rotateY, transformStyle: 'preserve-3d' }} className="relative">
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
                <span className="block text-[0.78rem] font-medium text-navy-900">{DEMO.pieces[0].name}</span>
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
                <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">Échéance</span>
                <span className="block text-[0.78rem] font-medium text-navy-900">{DEMO.deadline.dateLong}</span>
              </span>
            </Satellite>

            <Satellite className="cd-float-c -bottom-6 left-6 lg:-left-8" depth={60}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-navy-900 text-cream-50">
                <LockIcon width={14} height={14} />
              </span>
              <span>
                <span className="block font-mono text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">Transmission</span>
                <span className="block text-[0.78rem] font-medium text-navy-900">À votre validation · jamais automatique</span>
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
  );
}

function Satellite({ children, className, depth }: { children: ReactNode; className: string; depth: number }) {
  return (
    <div className={`absolute ${className}`} style={{ transform: `translateZ(${depth}px)` }}>
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
        Suivi du dossier · {DEMO.reference}
      </p>
      <p className="mt-1.5 font-display text-[1.6rem] font-semibold leading-tight text-navy-900 sm:text-[1.8rem]">
        {DEMO.title}
      </p>
      <p className="mt-1 text-[0.8rem] text-slate-500">
        {DEMO.category} · profil {DEMO.profile}
      </p>

      {/* Les 4 étapes du suivi — libellés réels de la page dossier */}
      <ol className="mt-6 grid grid-cols-4 gap-1.5" aria-label="Quatre étapes de suivi">
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
