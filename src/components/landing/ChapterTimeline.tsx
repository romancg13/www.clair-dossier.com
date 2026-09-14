import { useRef } from 'react';
import { motion, useTransform, type MotionValue } from 'motion/react';
import { statuses } from '../../data/statuses';
import { ChapterFrame } from './ChapterFrame';
import { DEMO_TIMELINE } from './demo-dossier';
import { DemoBadge, Stage } from './Stage';
import { useSectionProgress } from './useCinematic';

/**
 * Chapitre 03 — la chronologie. Les six statuts réels (src/data/statuses.ts)
 * se révèlent en suivant le scroll ; le trait se dessine. Contenu de la
 * section « Six statuts. Aucun entre-deux » conservé (VI.4 : MERGE).
 */
export function ChapterTimeline() {
  const ref = useRef<HTMLDivElement>(null);
  const { p, reduce } = useSectionProgress(ref, ['start 80%', 'end 85%']);
  const draw = useTransform(p, [0.08, 0.92], [0, 1]);
  const current = statuses.findIndex((s) => s.id === 'validation');

  return (
    <div ref={ref}>
      <ChapterFrame
        id="chronologie"
        number="03"
        kicker="L’avancement"
        align="right"
        title="Vous savez toujours où en est le dossier."
        body={
          <p>
            Six statuts, aucun « entre-deux » : {statuses.map((s) => s.label).join(', ')}. Chaque
            dossier traverse les mêmes états, et sa page d’avancement vous dit ce qu’il reste à
            faire — sans avoir à demander, sans avoir à chercher.
          </p>
        }
      >
        <Stage>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-silver-200/80">
              Chronologie du dossier
            </span>
            <DemoBadge />
          </div>

          <ol className="relative mt-6 pl-9" aria-label="Six statuts, dans l’ordre">
            {/* Trait de fond + trait qui se dessine */}
            <div aria-hidden="true" className="absolute bottom-3 left-[13px] top-3 w-px bg-cream-50/10" />
            <motion.div
              aria-hidden="true"
              style={reduce ? undefined : { scaleY: draw }}
              className="cd-draw absolute bottom-3 left-[13px] top-3 w-px bg-gradient-to-b from-gold-400 via-gold-500 to-gold-500/40"
            />
            {statuses.map((s, i) => (
              <TimelineItem
                key={s.id}
                p={p}
                i={i}
                reduce={reduce}
                label={s.label}
                event={DEMO_TIMELINE[i]?.event ?? s.description}
                when={DEMO_TIMELINE[i]?.when ?? ''}
                state={i < current ? 'done' : i === current ? 'active' : 'todo'}
              />
            ))}
          </ol>
        </Stage>
      </ChapterFrame>
    </div>
  );
}

function TimelineItem({
  p,
  i,
  reduce,
  label,
  event,
  when,
  state,
}: {
  p: MotionValue<number>;
  i: number;
  reduce: boolean;
  label: string;
  event: string;
  when: string;
  state: 'done' | 'active' | 'todo';
}) {
  const start = 0.1 + i * 0.13;
  const opacity = useTransform(p, [start, start + 0.1], [0, 1]);
  const y = useTransform(p, [start, start + 0.1], [10, 0]);
  const dotScale = useTransform(p, [start, start + 0.08], [0.4, 1]);
  return (
    <motion.li style={reduce ? undefined : { opacity, y }} className="relative py-3">
      <motion.span
        aria-hidden="true"
        style={reduce ? undefined : { scale: dotScale }}
        className={`absolute -left-9 top-[1.05rem] grid h-[26px] w-[26px] place-items-center rounded-full border ${
          state === 'active'
            ? 'border-gold-400 bg-navy-950 shadow-[0_0_0_6px_rgba(196,164,86,0.14)]'
            : state === 'done'
              ? 'border-cream-50/30 bg-cream-50'
              : 'cd-hairline-strong bg-navy-950'
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            state === 'active' ? 'bg-gold-400' : state === 'done' ? 'bg-navy-900' : 'bg-cream-50/25'
          }`}
        />
      </motion.span>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className={`font-display text-lg font-semibold leading-tight ${state === 'todo' ? 'text-silver-200/60' : 'text-cream-50'}`}>
          <span className="mr-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-silver-400">
            {String(i + 1).padStart(2, '0')}
          </span>
          {label}
        </p>
        <span className={`font-mono text-[0.62rem] uppercase tracking-[0.14em] ${state === 'active' ? 'text-gold-400' : 'text-silver-400'}`}>
          {when}
        </span>
      </div>
      <p className={`mt-1 text-[0.82rem] leading-relaxed ${state === 'todo' ? 'text-silver-400/70' : 'text-silver-200/75'}`}>
        {event}
      </p>
    </motion.li>
  );
}
