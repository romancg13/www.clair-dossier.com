import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { Reveal } from '../primitives/Reveal';
import { statuses } from '../../data/statuses';

export function Workflow() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 80%', 'end 30%'] });
  const lineLength = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <Reveal as="section" className="bg-cream-50">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Workflow
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
            Six statuts. Aucun « entre-deux ».
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-500">
            Chaque dossier traverse les mêmes six états. Le client sait où il en est sans
            avoir à demander, l'avocat sait ce qu'il doit faire sans avoir à chercher.
          </p>
        </div>

        {/* Desktop — horizontal */}
        <div ref={ref} className="mt-16 hidden lg:block">
          <div className="relative">
            {/* Background line */}
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-3 h-px bg-slate-300/40"
            />
            {/* Animated gold line */}
            <motion.div
              aria-hidden="true"
              className="absolute left-0 top-3 h-px origin-left bg-gold-500"
              style={{ scaleX: reduce ? 1 : lineLength, right: 0 }}
            />
            <ol className="relative grid grid-cols-6 gap-4">
              {statuses.map((s, i) => (
                <WorkflowNode key={s.id} index={i} status={s} />
              ))}
            </ol>
          </div>
        </div>

        {/* Mobile — vertical */}
        <ol className="mt-12 space-y-6 lg:hidden">
          {statuses.map((s, i) => (
            <li key={s.id} className="relative pl-8">
              <span className="absolute left-0 top-1 grid h-6 w-6 place-items-center rounded-full border hairline bg-white font-mono text-[0.7rem] font-semibold text-navy-900">
                {i + 1}
              </span>
              {i < statuses.length - 1 && (
                <span className="absolute left-[11px] top-7 h-full w-px bg-slate-300/40" />
              )}
              <div className="pb-2">
                <h3 className="font-display text-xl font-semibold leading-tight text-navy-900">
                  {s.label}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{s.description}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </Reveal>
  );
}

function WorkflowNode({ index, status }: { index: number; status: (typeof statuses)[number] }) {
  return (
    <li className="relative">
      <div className="relative z-10 grid h-6 w-6 place-items-center rounded-full border hairline bg-white">
        <span className="h-2 w-2 rounded-full bg-navy-900" aria-hidden="true" />
      </div>
      <div className="mt-5 pr-2">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-slate-400">
          Étape {String(index + 1).padStart(2, '0')}
        </p>
        <h3 className="mt-1.5 font-display text-lg font-semibold leading-tight text-navy-900">
          {status.label}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{status.description}</p>
      </div>
    </li>
  );
}
