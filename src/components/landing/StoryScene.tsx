import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { SCATTERED_DOCS, type DemoPiece } from './demo-dossier';
import { DocumentGlyph } from './DocumentGlyph';
import { DemoBadge } from './Stage';
import { useCinematic } from './useCinematic';
// Phase 4b — arrière-plan 3D de la scène épinglée (client-only, différé).
import { CinematicGate } from './cinematics/CinematicGate';
import { CINEMATIC_SCENES } from './cinematics/scenes';

/**
 * Chapitre 01 — du chaos au dossier.
 *
 * Desktop + motion autorisée : scène épinglée (sticky) sur 340 vh, trois
 * temps pilotés par le scroll natif (jamais de scroll hijacking) :
 *   0 → 0,28  « Vos informations sont partout. »  (pièces dispersées)
 *   0,28 → 0,55  « ClairDossier les réunit. »  (convergence)
 *   0,58 → 0,90  « Chaque pièce trouve sa place. »  (rangement dans le dossier)
 * Ailleurs : composition statique équivalente (même contenu, même ordre).
 */

export const STORY_ANCHOR = 'comment-ca-fonctionne';

// Positions en px, relatives au centre de la scène (dispersion volontairement irrégulière).
const SCATTER = [
  { x: -430, y: -230, r: -12 },
  { x: -150, y: -285, r: 7 },
  { x: 140, y: -250, r: -5 },
  { x: 420, y: -205, r: 10 },
  { x: -475, y: -40, r: 6 },
  { x: -190, y: -70, r: -9 },
  { x: 210, y: -30, r: 4 },
  { x: 465, y: 10, r: -7 },
  { x: -400, y: 195, r: 11 },
  { x: -120, y: 245, r: -4 },
  { x: 160, y: 215, r: 8 },
  { x: 440, y: 235, r: -10 },
];

// Regroupement : nuage serré, légèrement désordonné.
const CLUSTER = [
  { x: -60, y: -50, r: -3 },
  { x: 30, y: -72, r: 2 },
  { x: -20, y: -18, r: -1 },
  { x: 72, y: -36, r: 3 },
  { x: -84, y: 12, r: 2 },
  { x: 10, y: 16, r: -2 },
  { x: 62, y: 32, r: 1 },
  { x: -42, y: 56, r: -3 },
  { x: 42, y: 72, r: 2 },
  { x: -72, y: 84, r: 1 },
  { x: 92, y: 92, r: -2 },
  { x: 0, y: 104, r: 3 },
];

// Rangement : 2 colonnes × 6 lignes dans le panneau « Pièces du dossier ».
function slot(i: number) {
  return { x: i % 2 === 0 ? -152 : 152, y: -88 + Math.floor(i / 2) * 44, r: 0 };
}

export function StoryScene() {
  const cinematic = useCinematic();
  return (
    <div id={STORY_ANCHOR} tabIndex={-1} className="outline-none">
      {cinematic ? <PinnedScene /> : <StaticScene />}
    </div>
  );
}

/* ─── Desktop : scène épinglée ──────────────────────────────────────── */

function PinnedScene() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({
    target: wrapRef,
    offset: ['start start', 'end end'],
    layoutEffect: false,
  });

  const cap1 = useTransform(p, [0, 0.2, 0.28], [1, 1, 0]);
  const cap1Y = useTransform(p, [0.2, 0.28], [0, -14]);
  const cap2 = useTransform(p, [0.28, 0.36, 0.5, 0.58], [0, 1, 1, 0]);
  const cap2Y = useTransform(p, [0.28, 0.36, 0.5, 0.58], [14, 0, 0, -14]);
  const cap3 = useTransform(p, [0.62, 0.72], [0, 1]);
  const cap3Y = useTransform(p, [0.62, 0.72], [14, 0]);
  const panelOpacity = useTransform(p, [0.56, 0.68], [0, 1]);
  const panelScale = useTransform(p, [0.56, 0.74], [0.94, 1]);
  const hint = useTransform(p, [0, 0.08], [1, 0]);
  const layerFade = useTransform(p, [0.72, 0.98], [1, 0.4]);

  return (
    <div ref={wrapRef} className="relative h-[340vh]">
      <div className="sticky top-0 flex h-screen flex-col items-center justify-center overflow-hidden">
        {CINEMATIC_SCENES.story.enabled && (
          <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ opacity: layerFade }}>
            <CinematicGate load={CINEMATIC_SCENES.story.load} progress={p} nearMargin="80%" farMargin="200%" />
          </motion.div>
        )}
        {/* Légendes — trois temps, un seul emplacement */}
        <div className="pointer-events-none absolute inset-x-0 top-[9vh] px-6 text-center">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-400">
            <span className="text-silver-400">01</span>
            <span className="mx-2 text-silver-400/50" aria-hidden="true">
              —
            </span>
            Le chaos documentaire
          </p>
          <div className="relative mt-4 h-[5.5rem]">
            <motion.h2
              style={{ opacity: cap1, y: cap1Y }}
              className="absolute inset-x-0 font-display text-[clamp(2rem,4.2vw,3.6rem)] font-semibold leading-[1.02] text-cream-50"
            >
              Vos informations sont partout.
            </motion.h2>
            <motion.p
              style={{ opacity: cap2, y: cap2Y }}
              className="absolute inset-x-0 font-display text-[clamp(2rem,4.2vw,3.6rem)] font-semibold leading-[1.02] text-cream-50"
              aria-hidden="true"
            >
              ClairDossier les réunit.
            </motion.p>
            <motion.p
              style={{ opacity: cap3, y: cap3Y }}
              className="absolute inset-x-0 font-display text-[clamp(2rem,4.2vw,3.6rem)] font-semibold leading-[1.02] text-cream-50"
              aria-hidden="true"
            >
              Chaque pièce trouve sa place.
            </motion.p>
          </div>
        </div>

        {/* Scène */}
        <div className="relative mt-[12vh] h-[560px] w-full max-w-[1100px] xl:scale-[1.08] 2xl:scale-[1.18]">
          <motion.div
            style={{ opacity: panelOpacity, scale: panelScale }}
            className="cd-stage absolute left-1/2 top-1/2 h-[352px] w-[660px] -translate-x-1/2 -translate-y-1/2 rounded-[1.25rem]"
            aria-hidden="true"
          >
            <div className="flex items-center justify-between px-5 pt-4">
              <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-silver-200/80">
                Pièces du dossier · {SCATTERED_DOCS.length}
              </span>
              <DemoBadge />
            </div>
          </motion.div>

          <ul className="contents" aria-label="Douze pièces fictives, réunies dans un dossier">
            {SCATTERED_DOCS.map((doc, i) => (
              <StoryCard key={doc.name} p={p} i={i} doc={doc} />
            ))}
          </ul>
        </div>

        <motion.p
          style={{ opacity: hint }}
          className="pointer-events-none absolute bottom-8 font-mono text-[0.62rem] uppercase tracking-[0.2em] text-silver-400"
          aria-hidden="true"
        >
          Faites défiler
        </motion.p>
      </div>
    </div>
  );
}

function StoryCard({ p, i, doc }: { p: MotionValue<number>; i: number; doc: DemoPiece }) {
  const s = SCATTER[i];
  const c = CLUSTER[i];
  const g = slot(i);
  const d = i * 0.006;
  const keys = [0, 0.28 + d, 0.55 + d, 0.6 + d, 0.86 + d];
  const x = useTransform(p, keys, [s.x, s.x, c.x, c.x, g.x]);
  const y = useTransform(p, keys, [s.y, s.y, c.y, c.y, g.y]);
  const rotate = useTransform(p, keys, [s.r, s.r, c.r, c.r, g.r]);
  const scale = useTransform(p, [0, 0.28, 0.55, 0.86], [1, 1, 0.84, 0.94]);
  const opacity = useTransform(p, [0, 0.03 + i * 0.008], [0, 1]);
  return (
    <motion.li
      style={{ x, y, rotate, scale, opacity }}
      className="absolute left-1/2 top-1/2 -ml-[135px] -mt-[22px] w-[270px] list-none will-change-transform"
    >
      <Paper doc={doc} />
    </motion.li>
  );
}

/* ─── Mobile / tablette / motion réduite : composition statique ─────── */

const STATIC_OFFSETS = [-40, 36, -28, 44, -52, 30, -36, 48, -24, 40, -44, 32];

function StaticScene() {
  const reduce = useReducedMotion();
  return (
    <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-400">
        <span className="text-silver-400">01</span>
        <span className="mx-2 text-silver-400/50" aria-hidden="true">
          —
        </span>
        Le chaos documentaire
      </p>
      <h2 className="mt-4 font-display text-[clamp(2.1rem,7vw,3.6rem)] font-semibold leading-[1.02] text-cream-50">
        Vos informations sont partout.
        <br />
        <span className="text-silver-200/70">ClairDossier les réunit.</span>
      </h2>
      <p className="mt-5 max-w-lg text-[1.02rem] leading-[1.65] text-silver-200/78">
        E-mails, devis, factures, courriers, photos, échéances : chaque pièce trouve sa place dans
        votre dossier, dans un espace privé — rien ne se perd.
      </p>

      <div className="cd-stage mt-10 rounded-[1.25rem] p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-silver-200/80">
            Pièces du dossier · {SCATTERED_DOCS.length}
          </span>
          <DemoBadge />
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label="Douze pièces fictives, réunies dans un dossier">
          {SCATTERED_DOCS.map((doc, i) => (
            <motion.li
              key={doc.name}
              initial={reduce ? false : { opacity: 0, x: STATIC_OFFSETS[i], rotate: STATIC_OFFSETS[i] / 8 }}
              whileInView={{ opacity: 1, x: 0, rotate: 0 }}
              viewport={{ once: true, amount: 0.2, margin: '80px' }}
              transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
            >
              <Paper doc={doc} />
            </motion.li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Paper({ doc }: { doc: DemoPiece }) {
  return (
    <div className="cd-paper flex items-center gap-2.5 rounded-lg px-3 py-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-navy-900/6 text-navy-900">
        <DocumentGlyph type={doc.type} width={16} height={16} />
      </span>
      <span className="min-w-0 flex-1 truncate text-[0.78rem] font-medium text-navy-900">{doc.name}</span>
      <span className="shrink-0 font-mono text-[0.56rem] uppercase tracking-[0.12em] text-slate-500">
        {doc.tag}
      </span>
    </div>
  );
}
