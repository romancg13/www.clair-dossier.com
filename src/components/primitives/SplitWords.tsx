import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

/**
 * Word-by-word reveal pour H1/H2 Cormorant.
 * On parse une string ; pour rendu plus riche (marker etc.), passer des `segments` enrichis.
 */
export function SplitWords({
  text,
  className,
  stagger = 0.055,
  duration = 0.9,
  segments,
}: {
  text?: string;
  className?: string;
  stagger?: number;
  duration?: number;
  /** Permet d'injecter des éléments custom (ex: <span className="marker-track">clair</span>) */
  segments?: Array<string | { node: ReactNode }>;
}) {
  const reduce = useReducedMotion();
  const words = segments ?? (text ?? '').split(' ').map((w) => w);

  if (reduce) {
    return (
      <span className={className}>
        {words.map((w, i) =>
          typeof w === 'string' ? (
            <span key={i}>
              {w}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ) : (
            <span key={i}>
              {w.node}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          )
        )}
      </span>
    );
  }

  return (
    <span className={className} aria-label={text}>
      {words.map((w, i) => (
        <span key={i} className="inline-block overflow-hidden" aria-hidden="true">
          <motion.span
            className="inline-block"
            initial={{ y: '110%', opacity: 0 }}
            animate={{ y: '0%', opacity: 1 }}
            transition={{ duration, delay: i * stagger, ease: EASE_OUT_EXPO }}
          >
            {typeof w === 'string' ? w : w.node}
            {i < words.length - 1 ? ' ' : ''}
          </motion.span>
        </span>
      ))}
    </span>
  );
}
