import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

/**
 * Surligneur sky animé (clip-path trace) sur un mot/expression du H1.
 * Le délai permet de syncer avec l'animation SplitWords.
 */
export function MarkerHighlight({
  children,
  delay = 0,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  const [revealed, setRevealed] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (reduce) {
      setRevealed(true);
      return;
    }
    const t = window.setTimeout(() => setRevealed(true), delay * 1000);
    return () => window.clearTimeout(t);
  }, [delay, reduce]);

  return (
    <span ref={ref} className="marker-track" data-revealed={revealed ? 'true' : 'false'}>
      {children}
    </span>
  );
}
