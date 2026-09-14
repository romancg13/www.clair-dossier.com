import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useTransform } from 'motion/react';
import { ChapterFrame } from './ChapterFrame';
import { DEMO } from './demo-dossier';
import { DocumentGlyph } from './DocumentGlyph';
import { DemoBadge, DarkRow, Stage } from './Stage';
import { useSectionProgress } from './useCinematic';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Chapitre 04 — les échéances. Ce qui existe : les dates renseignées à la
 * création sont conservées et affichées sur le dossier, avec leur statut.
 * Ce qui n'existe pas encore (rappels automatiques) est dit tel quel, avec le
 * lien vers l'état du produit — jamais mis en scène comme acquis.
 */
export function ChapterDeadlines() {
  const ref = useRef<HTMLDivElement>(null);
  const { p, reduce } = useSectionProgress(ref, ['start 80%', 'end 85%']);
  const grid = useTransform(p, [0.05, 0.3], [0, 1]);
  const ring = useTransform(p, [0.4, 0.58], [0, 1]);
  const ringScale = useTransform(p, [0.4, 0.58], [1.8, 1]);
  const card = useTransform(p, [0.5, 0.72], [0, 1]);
  const cardY = useTransform(p, [0.5, 0.72], [18, 0]);

  const { deadline } = DEMO;
  const cells: Array<number | null> = [
    ...Array.from({ length: deadline.firstWeekday }, () => null),
    ...Array.from({ length: deadline.daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div ref={ref}>
      <ChapterFrame
        id="echeances"
        number="04"
        kicker="Les échéances"
        title="Aucune date importante ne se perd dans un document."
        body={
          <p>
            Les dates clés que vous renseignez à la création restent visibles sur la page du
            dossier, avec leur statut — au même endroit que les pièces et l’avancement.
          </p>
        }
        footnote={
          <p>
            Rappels automatiques : à l’étude, jamais sans validation humaine.{' '}
            <Link to="/etat-du-produit" className="border-b cd-hairline-strong text-silver-200 transition-colors hover:text-gold-400">
              Voir l’état du produit
            </Link>
          </p>
        }
      >
        <Stage>
          <div className="grid gap-5 sm:grid-cols-[1.05fr_0.95fr] sm:items-center">
            {/* Calendrier */}
            <motion.div style={reduce ? undefined : { opacity: grid }} aria-hidden="true">
              <div className="flex items-center justify-between">
                <span className="font-display text-lg font-semibold text-cream-50">{deadline.month}</span>
                <span className="font-mono text-[0.6rem] uppercase tracking-[0.16em] text-silver-400">
                  Échéances
                </span>
              </div>
              <div className="mt-3 grid grid-cols-7 gap-1 text-center font-mono text-[0.58rem] uppercase tracking-[0.1em] text-silver-400">
                {WEEKDAYS.map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((day, i) => {
                  const isDeadline = day === deadline.day;
                  return (
                    <div key={i} className="relative grid aspect-square place-items-center rounded-md text-[0.72rem]">
                      {day !== null && (
                        <>
                          {isDeadline && (
                            <motion.span
                              style={reduce ? undefined : { opacity: ring, scale: ringScale }}
                              className="absolute inset-0 rounded-md border border-gold-400 bg-gold-500/18 shadow-[0_0_0_4px_rgba(196,164,86,0.12)]"
                            />
                          )}
                          <span className={`relative ${isDeadline ? 'font-semibold text-gold-400' : day < 14 ? 'text-silver-400/70' : 'text-silver-200/85'}`}>
                            {day}
                          </span>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </motion.div>

            {/* Échéance sur le dossier */}
            <motion.div
              style={reduce ? undefined : { opacity: card, y: cardY }}
              className="rounded-xl border cd-hairline bg-navy-950/40 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 font-mono text-[0.66rem] uppercase tracking-[0.18em] text-silver-200/80">
                  <DocumentGlyph type="echeance" width={16} height={16} className="text-gold-400" />
                  Échéance renseignée sur le dossier
                </span>
                <DemoBadge />
              </div>
              <p className="mt-3 font-display text-2xl font-semibold leading-tight text-cream-50">
                {deadline.dateLong}
              </p>
              <dl className="mt-3 divide-y cd-hairline">
                <DarkRow label="Objet" value={deadline.label} />
                <DarkRow label="Dossier" value={DEMO.title} />
                <DarkRow label="Statut" value={deadline.status} tone="gold" />
                <DarkRow label="Affichage" value="page d’avancement, onglet Échéances" />
              </dl>
            </motion.div>
          </div>
        </Stage>
      </ChapterFrame>
    </div>
  );
}
