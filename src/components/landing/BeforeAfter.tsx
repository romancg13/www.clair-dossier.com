import { useRef } from 'react';
import { motion, useTransform, type MotionValue } from 'motion/react';
import { AVANT, AVEC } from '../sections/AvantApres';
import { CheckIcon, CrossIcon } from '../icons';
import { useSectionProgress } from './useCinematic';

/**
 * Avant / avec ClairDossier — ENHANCE de AvantApres (mêmes cinq paires de
 * textes, exportées de la section d'origine). Mise en page « registre » :
 * chaque ligne oppose la situation d'avant à la situation avec, un trait or
 * se dessine au centre en suivant le scroll.
 */
export function BeforeAfter() {
  const ref = useRef<HTMLDivElement>(null);
  const { p, reduce } = useSectionProgress(ref, ['start 80%', 'end 90%']);
  const draw = useTransform(p, [0.1, 0.95], [0, 1]);

  return (
    <section ref={ref} className="bg-cream-100/50">
      <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-700">Avant / avec</p>
          <h2 className="mt-3 font-display text-[clamp(2.1rem,4.4vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.015em] text-navy-900">
            Le dossier vit dans le désordre. Puis dans l’ordre.
          </h2>
        </div>

        <div className="relative mt-12 rounded-[1.5rem] border hairline bg-white shadow-card">
          {/* En-têtes */}
          <div className="grid gap-4 border-b hairline px-5 py-5 sm:grid-cols-[1fr_auto_1fr] sm:items-end sm:px-8">
            <h3 className="font-display text-xl font-semibold leading-tight text-slate-500 sm:text-2xl">
              <span className="block font-mono text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">
                Avant ClairDossier
              </span>
              Le dossier vit dans le désordre.
            </h3>
            <span aria-hidden="true" className="hidden sm:block sm:w-10" />
            <h3 className="font-display text-xl font-semibold leading-tight text-navy-900 sm:text-2xl">
              <span className="block font-mono text-[0.62rem] uppercase tracking-[0.18em] text-gold-700">
                Avec ClairDossier
              </span>
              Le dossier vit dans l’ordre.
            </h3>
          </div>

          {/* Trait central qui se dessine */}
          <div aria-hidden="true" className="pointer-events-none absolute bottom-6 left-1/2 top-[5.5rem] hidden w-px -translate-x-1/2 bg-navy-900/8 sm:block">
            <motion.div
              style={reduce ? undefined : { scaleY: draw }}
              className="cd-draw h-full w-full bg-gradient-to-b from-gold-500 via-gold-500 to-gold-500/30"
            />
          </div>

          <ul className="divide-y hairline">
            {AVANT.map((before, i) => (
              <Pair key={before} p={p} i={i} reduce={reduce} before={before} after={AVEC[i]} />
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Pair({
  p,
  i,
  reduce,
  before,
  after,
}: {
  p: MotionValue<number>;
  i: number;
  reduce: boolean;
  before: string;
  after: string;
}) {
  const start = 0.12 + i * 0.15;
  const opacity = useTransform(p, [start, start + 0.12], [0, 1]);
  const leftX = useTransform(p, [start, start + 0.12], [-10, 0]);
  const rightX = useTransform(p, [start, start + 0.12], [10, 0]);
  return (
    <li className="grid gap-3 px-5 py-5 sm:grid-cols-[1fr_auto_1fr] sm:items-start sm:gap-4 sm:px-8 sm:py-6">
      <motion.div style={reduce ? undefined : { opacity, x: leftX }} className="flex gap-3">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-navy-900/6">
          <CrossIcon width={10} height={10} strokeWidth={2} className="text-slate-400" />
        </span>
        <p className="text-sm leading-relaxed text-slate-500">{before}</p>
      </motion.div>
      <span aria-hidden="true" className="hidden sm:block sm:w-10" />
      <motion.div style={reduce ? undefined : { opacity, x: rightX }} className="flex gap-3">
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-gold-500/18">
          <CheckIcon width={11} height={11} strokeWidth={2.2} className="text-gold-700" />
        </span>
        <p className="text-sm font-medium leading-relaxed text-navy-900">{after}</p>
      </motion.div>
    </li>
  );
}
