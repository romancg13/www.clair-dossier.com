import { useRef } from 'react';
import { motion, useTransform, type MotionValue } from 'motion/react';
import { ChapterFrame } from './ChapterFrame';
import { DEMO, TUNNEL_STEPS } from './demo-dossier';
import { DocumentGlyph } from './DocumentGlyph';
import { DemoBadge, Stage } from './Stage';
import { useSectionProgress } from './useCinematic';

/**
 * Chapitre 02 — la structure. Un document est ouvert ; les informations que
 * VOUS renseignez (parties, dates, montants, échéance) composent le
 * récapitulatif. Aucune extraction automatique : ce sont les champs réels du
 * tunnel (DossierFlow.tsx) qui s'assemblent, au rythme du scroll.
 */
export function ChapterStructure() {
  const ref = useRef<HTMLDivElement>(null);
  const { p, reduce } = useSectionProgress(ref, ['start 80%', 'end 80%']);
  const fill = useTransform(p, [0.05, 0.9], ['0%', '100%']);
  const link = useTransform(p, [0.15, 0.35], [0, 1]);

  return (
    <div ref={ref}>
      <ChapterFrame
        id="structure"
        number="02"
        kicker="La structure"
        title={
          <>
            Cinq étapes.
            <br />
            Un dossier lisible.
          </>
        }
        body={
          <p>
            Profil, nature du dossier, informations, pièces, récapitulatif : le tunnel guide la
            saisie et ne demande que l’utile. Ce que vous renseignez devient un dossier structuré,
            relu avant validation — sans lecture automatique de vos pièces.
          </p>
        }
      >
        <Stage>
          {/* Tunnel — 5 étapes réelles */}
          <ol className="grid grid-cols-5 gap-1.5" aria-label="Les cinq étapes du tunnel de création">
            {TUNNEL_STEPS.map((label, i) => (
              <li key={label} className="min-w-0">
                <div className="h-1 overflow-hidden rounded-full bg-cream-50/10">
                  <StepFill p={p} i={i} reduce={reduce} />
                </div>
                <span className="mt-2 block font-mono text-[0.58rem] uppercase tracking-[0.12em] text-silver-400" title={label}>
                  <span className="md:hidden">{String(i + 1).padStart(2, '0')}</span>
                  <span className="hidden truncate md:block">
                    {i + 1}. {label}
                  </span>
                </span>
              </li>
            ))}
          </ol>

          <div className="mt-6 grid gap-4 sm:grid-cols-[0.9fr_auto_1.1fr] sm:items-center">
            {/* Document déposé */}
            <div className="cd-paper rounded-xl p-4" aria-hidden="true">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-navy-900/6 text-navy-900">
                  <DocumentGlyph type="facture" width={16} height={16} />
                </span>
                <span className="truncate text-[0.78rem] font-medium">Facture F-2026-042.pdf</span>
              </div>
              <div className="mt-4 space-y-2">
                <Line w="72%" />
                <Line w="54%" />
                <Highlight p={p} at={0.3} reduce={reduce}>
                  Exemple SARL
                </Highlight>
                <Line w="64%" />
                <Highlight p={p} at={0.42} reduce={reduce}>
                  12/09/2026
                </Highlight>
                <Line w="48%" />
                <Highlight p={p} at={0.54} reduce={reduce}>
                  4 800,00 € HT
                </Highlight>
                <Line w="60%" />
                <Highlight p={p} at={0.66} reduce={reduce}>
                  Échéance : 15/10/2026
                </Highlight>
              </div>
            </div>

            {/* Lien document → récapitulatif */}
            <div className="hidden h-px w-10 bg-cream-50/10 sm:block" aria-hidden="true">
              <motion.div
                style={reduce ? undefined : { scaleX: link }}
                className="h-px w-full origin-left bg-gold-500"
              />
            </div>

            {/* Récapitulatif — champs réels du tunnel */}
            <div className="rounded-xl border cd-hairline bg-navy-950/40 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-silver-200/80">
                  Récapitulatif
                </span>
                <DemoBadge />
              </div>
              <dl className="mt-3 divide-y cd-hairline">
                {DEMO.fields.map((f, i) => (
                  <FieldRow key={f.label} p={p} i={i} reduce={reduce} label={f.label} value={f.value} />
                ))}
              </dl>
              <div className="mt-4 h-px w-full overflow-hidden rounded-full bg-cream-50/10" aria-hidden="true">
                <motion.div
                  style={reduce ? undefined : { width: fill }}
                  className="h-full bg-gradient-to-r from-gold-500/60 to-gold-400"
                />
              </div>
              <p className="mt-2 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-silver-400">
                Relu par vous avant validation
              </p>
            </div>
          </div>
        </Stage>
      </ChapterFrame>
    </div>
  );
}

function StepFill({ p, i, reduce }: { p: MotionValue<number>; i: number; reduce: boolean }) {
  const start = 0.05 + i * 0.16;
  const width = useTransform(p, [start, start + 0.16], ['0%', '100%']);
  return (
    <motion.div
      style={reduce ? undefined : { width }}
      className={`h-full rounded-full ${i === TUNNEL_STEPS.length - 1 ? 'bg-gold-500' : 'bg-cream-50/70'}`}
    />
  );
}

function Line({ w }: { w: string }) {
  return <div className="h-1.5 rounded-full bg-navy-900/8" style={{ width: w }} />;
}

function Highlight({
  p,
  at,
  reduce,
  children,
}: {
  p: MotionValue<number>;
  at: number;
  reduce: boolean;
  children: string;
}) {
  const bg = useTransform(p, [at, at + 0.1], ['rgba(179,210,239,0)', 'rgba(179,210,239,0.75)']);
  return (
    <motion.span
      style={reduce ? { backgroundColor: 'rgba(179,210,239,0.75)' } : { backgroundColor: bg }}
      className="inline-block rounded-[0.2em] px-1 text-[0.74rem] font-medium text-navy-900"
    >
      {children}
    </motion.span>
  );
}

function FieldRow({
  p,
  i,
  reduce,
  label,
  value,
}: {
  p: MotionValue<number>;
  i: number;
  reduce: boolean;
  label: string;
  value: string;
}) {
  const start = 0.2 + i * 0.12;
  const opacity = useTransform(p, [start, start + 0.1], [0, 1]);
  const x = useTransform(p, [start, start + 0.1], [10, 0]);
  return (
    <motion.div
      style={reduce ? undefined : { opacity, x }}
      className="flex items-center justify-between gap-4 py-2.5 text-[0.8rem]"
    >
      <dt className="text-silver-400">{label}</dt>
      <dd className={`text-right font-medium ${i === DEMO.fields.length - 1 ? 'text-gold-400' : 'text-cream-50'}`}>
        {value}
      </dd>
    </motion.div>
  );
}
