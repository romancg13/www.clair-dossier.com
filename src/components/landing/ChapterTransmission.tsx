import { useRef, type ReactNode } from 'react';
import { motion, useTransform, type MotionValue } from 'motion/react';
import { CheckIcon, LockIcon, WhatsAppIcon } from '../icons';
import { ChapterFrame } from './ChapterFrame';
import { DEMO } from './demo-dossier';
import { DemoBadge, Stage } from './Stage';
import { useSectionProgress } from './useCinematic';

/**
 * Chapitre 05 — la transmission. Le différenciateur contractuel de
 * ClairDossier : rien ne part sans une action explicite de l'utilisateur.
 * Micro-récit en trois temps (récapitulatif relu → destinataire et canal →
 * validation), puis l'état « Transmis ».
 */
export function ChapterTransmission() {
  const ref = useRef<HTMLDivElement>(null);
  const { p, reduce } = useSectionProgress(ref, ['start 80%', 'end 85%']);
  const btn = useTransform(p, [0.66, 0.78], [1, 0]);
  const sent = useTransform(p, [0.7, 0.84], [0, 1]);
  const sentY = useTransform(p, [0.7, 0.84], [8, 0]);

  return (
    <div ref={ref}>
      <ChapterFrame
        id="transmission"
        number="05"
        kicker="La transmission"
        align="right"
        title="Rien ne part sans vous."
        body={
          <p>
            Le dossier est prêt ? Vous relisez le récapitulatif, vous choisissez le destinataire et
            le canal — e-mail ou WhatsApp — puis vous validez. Aucun envoi automatique : c’est un
            engagement contractuel, pas un réglage.
          </p>
        }
      >
        <Stage>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[0.66rem] uppercase tracking-[0.18em] text-silver-200/80">
              Transmettre le dossier
            </span>
            <DemoBadge />
          </div>

          <ol className="mt-5 space-y-3" aria-label="Trois temps avant l’envoi">
            <FlowStep p={p} at={0.12} reduce={reduce} n={1} title="Récapitulatif relu">
              <span className="text-[0.78rem] text-silver-200/75">
                {DEMO.title} · {DEMO.pieces.length} pièces · échéance {DEMO.deadline.dateShort}
              </span>
            </FlowStep>

            <FlowStep p={p} at={0.34} reduce={reduce} n={2} title="Destinataire et canal">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border cd-hairline-strong bg-cream-50/5 px-2.5 py-1 text-[0.74rem] text-cream-50">
                  {DEMO.transmission.recipient}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-400/60 bg-gold-500/12 px-2.5 py-1 text-[0.74rem] text-gold-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-gold-400" aria-hidden="true" />
                  E-mail
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full border cd-hairline px-2.5 py-1 text-[0.74rem] text-silver-200/75">
                  <WhatsAppIcon width={12} height={12} />
                  WhatsApp
                </span>
              </div>
            </FlowStep>

            <FlowStep p={p} at={0.54} reduce={reduce} n={3} title="Votre validation">
              <div className="relative h-11">
                <motion.div
                  style={reduce ? { opacity: 0 } : { opacity: btn }}
                  className="absolute inset-0 flex items-center"
                  aria-hidden="true"
                >
                  <span className="inline-flex items-center gap-2 rounded-full bg-gold-500 px-4 py-2 text-[0.8rem] font-semibold text-navy-900 shadow-gold">
                    <LockIcon width={13} height={13} />
                    Transmettre le dossier
                  </span>
                </motion.div>
                <motion.div
                  style={reduce ? undefined : { opacity: sent, y: sentY }}
                  className="absolute inset-0 flex items-center"
                >
                  <span className="inline-flex items-center gap-2 rounded-full border border-gold-400/60 bg-navy-950 px-4 py-2 text-[0.8rem] font-medium text-cream-50">
                    <span className="grid h-5 w-5 place-items-center rounded-full bg-gold-500 text-navy-900">
                      <CheckIcon width={11} height={11} strokeWidth={2.4} />
                    </span>
                    Transmis le {DEMO.transmission.date} · par vous · {DEMO.transmission.channel.toLowerCase()}
                  </span>
                </motion.div>
              </div>
            </FlowStep>
          </ol>

          <p className="mt-5 border-t cd-hairline pt-4 font-mono text-[0.58rem] uppercase tracking-[0.14em] text-silver-400">
            Aucune lecture ni exploitation automatique des pièces · engagement CGV
          </p>
        </Stage>
      </ChapterFrame>
    </div>
  );
}

function FlowStep({
  p,
  at,
  reduce,
  n,
  title,
  children,
}: {
  p: MotionValue<number>;
  at: number;
  reduce: boolean;
  n: number;
  title: string;
  children: ReactNode;
}) {
  const opacity = useTransform(p, [at, at + 0.1], [0.28, 1]);
  const x = useTransform(p, [at, at + 0.1], [8, 0]);
  const check = useTransform(p, [at + 0.06, at + 0.14], [0, 1]);
  return (
    <motion.li
      style={reduce ? undefined : { opacity, x }}
      className="flex gap-3 rounded-xl border cd-hairline bg-navy-950/40 p-3.5"
    >
      <span className="relative grid h-7 w-7 shrink-0 place-items-center rounded-full border cd-hairline-strong font-mono text-[0.62rem] text-silver-200">
        {n}
        <motion.span
          aria-hidden="true"
          style={reduce ? undefined : { opacity: check }}
          className="absolute inset-0 grid place-items-center rounded-full bg-gold-500 text-navy-900"
        >
          <CheckIcon width={11} height={11} strokeWidth={2.4} />
        </motion.span>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.86rem] font-medium text-cream-50">{title}</p>
        <div className="mt-1.5">{children}</div>
      </div>
    </motion.li>
  );
}
