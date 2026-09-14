import { useRef, type ReactNode } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { BUSINESS_STEPS, DEMO } from './demo-dossier';
import { DocumentGlyph } from './DocumentGlyph';
import { DemoBadge } from './Stage';
import { useCinematic } from './useCinematic';

/**
 * Chapitre 06 — la vue d'ensemble. Les modules vus dans les chapitres
 * précédents (étapes, pièces, échéance, prochaine action) viennent composer
 * la page réelle « Avancement du dossier » (DossierDetail.tsx : mêmes onglets,
 * mêmes étapes, même bloc « Ce que vous devez faire maintenant »).
 * Desktop : scène épinglée, assemblage piloté par le scroll. Sinon : reveal.
 */

const TABS = ['Vue d’ensemble', 'Pièces', 'Échéances', 'DashBoard ClairDossier'];

export function ChapterOverview() {
  const cinematic = useCinematic();
  return cinematic ? <PinnedOverview /> : <StaticOverview />;
}

function Copy() {
  return (
    <div>
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-400">
        <span className="text-silver-400">06</span>
        <span className="mx-2 text-silver-400/50" aria-hidden="true">
          —
        </span>
        La vue d’ensemble
      </p>
      <h2 className="mt-4 font-display text-[clamp(2.1rem,4.4vw,4rem)] font-semibold leading-[1.02] tracking-[-0.015em] text-cream-50">
        Tout le dossier,
        <br />
        sur un seul écran.
      </h2>
      <p className="mt-5 max-w-lg text-[1.02rem] leading-[1.65] text-silver-200/78">
        Les cinq étapes, les pièces, les échéances et la prochaine action à mener : la page
        « Avancement du dossier » réunit ce que vous avez construit. Vous comprenez le dossier
        avant même de l’ouvrir.
      </p>
    </div>
  );
}

/* ─── Desktop : assemblage épinglé ──────────────────────────────────── */

function PinnedOverview() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({
    target: wrapRef,
    offset: ['start start', 'end end'],
    layoutEffect: false,
  });
  const frame = useTransform(p, [0, 0.12], [0, 1]);
  const frameScale = useTransform(p, [0, 0.12], [0.97, 1]);
  const glow = useTransform(p, [0.7, 0.9], [0, 1]);

  return (
    <div ref={wrapRef} className="relative h-[240vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden">
        <div className="mx-auto grid w-full max-w-7xl items-center gap-16 px-5 sm:px-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:px-12">
          <Copy />
          <div className="relative">
            <motion.div
              aria-hidden="true"
              style={{ opacity: glow }}
              className="absolute -inset-8 -z-10 rounded-[2rem] bg-gradient-to-br from-gold-500/18 via-transparent to-sky-glow/15 blur-3xl"
            />
            <motion.div style={{ opacity: frame, scale: frameScale }}>
              <Dashboard>
                {(region, i) => <Assembling key={i} p={p} i={i}>{region}</Assembling>}
              </Dashboard>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}

const ENTRIES = [
  { x: 0, y: -36, from: 0.1, to: 0.3 },
  { x: -70, y: 0, from: 0.2, to: 0.42 },
  { x: 90, y: 20, from: 0.3, to: 0.56 },
  { x: -60, y: 60, from: 0.4, to: 0.66 },
  { x: 0, y: 50, from: 0.5, to: 0.78 },
];

function Assembling({ p, i, children }: { p: MotionValue<number>; i: number; children: ReactNode }) {
  const e = ENTRIES[i] ?? ENTRIES[ENTRIES.length - 1];
  const opacity = useTransform(p, [e.from, e.to], [0, 1]);
  const x = useTransform(p, [e.from, e.to], [e.x, 0]);
  const y = useTransform(p, [e.from, e.to], [e.y, 0]);
  return (
    <motion.div style={{ opacity, x, y }} className="will-change-transform">
      {children}
    </motion.div>
  );
}

/* ─── Mobile / tablette / motion réduite ────────────────────────────── */

function StaticOverview() {
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
      <Copy />
      <div className="mt-10">
        <Dashboard>
          {(region, i) => (
            <motion.div
              key={i}
              initial={reduce ? false : { opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2, margin: '60px' }}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
            >
              {region}
            </motion.div>
          )}
        </Dashboard>
      </div>
    </section>
  );
}

/* ─── Le tableau de bord, en cinq régions ───────────────────────────── */

function Dashboard({ children }: { children: (region: ReactNode, i: number) => ReactNode }) {
  const regions: ReactNode[] = [
    // 0 — en-tête
    <div key="head" className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-2">
          <DemoBadge />
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-silver-400">
            {DEMO.reference}
          </span>
        </div>
        <p className="mt-2 font-display text-2xl font-semibold leading-tight text-cream-50">{DEMO.title}</p>
        <p className="mt-0.5 text-[0.78rem] text-silver-400">
          {DEMO.category} · profil {DEMO.profile}
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/50 bg-gold-500/12 px-2.5 py-1 font-mono text-[0.62rem] uppercase tracking-[0.14em] text-gold-400">
        <span className="h-1.5 w-1.5 rounded-full bg-gold-400" aria-hidden="true" />
        {DEMO.status}
      </span>
    </div>,

    // 1 — onglets réels + 5 étapes métier
    <div key="steps" className="mt-5">
      <div className="flex flex-wrap gap-1 border-b cd-hairline pb-2" aria-hidden="true">
        {TABS.map((t, i) => (
          <span
            key={t}
            className={`rounded-full px-3 py-1 text-[0.72rem] ${
              i === 0 ? 'bg-cream-50/10 font-medium text-cream-50' : 'text-silver-400'
            }`}
          >
            {t}
          </span>
        ))}
      </div>
      <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Avancement sur cinq étapes métier">
        {BUSINESS_STEPS.map((label, i) => {
          const n = i + 1;
          const state = n < DEMO.step ? 'done' : n === DEMO.step ? 'active' : 'todo';
          return (
            <li key={label} className="min-w-0">
              <span
                aria-hidden="true"
                className={`block h-1 rounded-full ${
                  state === 'done' ? 'bg-cream-50/80' : state === 'active' ? 'bg-gold-500' : 'bg-cream-50/12'
                }`}
              />
              <span
                className={`mt-2 block truncate font-mono text-[0.56rem] uppercase tracking-[0.1em] ${
                  state === 'active' ? 'text-gold-400' : 'text-silver-400'
                }`}
                title={label}
              >
                {n}. {label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>,

    // 2 — pièces
    <div key="pieces" className="mt-4 rounded-xl border cd-hairline bg-navy-950/40 p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-silver-200/80">
          Pièces · {DEMO.pieces.length}
        </span>
        <span className="font-mono text-[0.58rem] uppercase tracking-[0.14em] text-silver-400">
          Visualiser · Télécharger
        </span>
      </div>
      <ul className="mt-2 divide-y cd-hairline">
        {DEMO.pieces.map((piece) => (
          <li key={piece.name} className="flex items-center gap-3 py-2">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-cream-50/8 text-cream-50">
              <DocumentGlyph type={piece.type} width={15} height={15} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[0.8rem] text-cream-50">{piece.name}</span>
              <span className="block font-mono text-[0.56rem] uppercase tracking-[0.12em] text-silver-400">
                {piece.tag} · {piece.meta}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>,

    // 3 — échéance
    <div key="deadline" className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="rounded-xl border cd-hairline bg-navy-950/40 p-4">
        <span className="inline-flex items-center gap-2 font-mono text-[0.62rem] uppercase tracking-[0.16em] text-silver-200/80">
          <DocumentGlyph type="echeance" width={14} height={14} className="text-gold-400" />
          Échéance
        </span>
        <p className="mt-2 font-display text-xl font-semibold text-cream-50">{DEMO.deadline.dateLong}</p>
        <p className="mt-0.5 text-[0.78rem] text-silver-400">
          {DEMO.deadline.label} · {DEMO.deadline.status}
        </p>
      </div>
      <div className="rounded-xl border cd-hairline bg-navy-950/40 p-4">
        <span className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-silver-200/80">
          Transmission
        </span>
        <p className="mt-2 font-display text-xl font-semibold text-cream-50">Par vous, jamais automatique</p>
        <p className="mt-0.5 text-[0.78rem] text-silver-400">
          Dernier envoi : {DEMO.transmission.date} · {DEMO.transmission.channel.toLowerCase()}
        </p>
      </div>
    </div>,

    // 4 — prochaine action (bloc réel)
    <div key="next" className="mt-4 rounded-xl bg-gold-500/10 px-4 py-3.5 ring-1 ring-gold-400/30">
      <p className="font-mono text-[0.62rem] uppercase tracking-[0.16em] text-gold-400">
        Ce que vous devez faire maintenant
      </p>
      <p className="mt-1 text-[0.86rem] leading-relaxed text-cream-50">{DEMO.nextAction}</p>
    </div>,
  ];

  return <div className="cd-stage rounded-[1.5rem] p-5 sm:p-7">{regions.map((r, i) => children(r, i))}</div>;
}
