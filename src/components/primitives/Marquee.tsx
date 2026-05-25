import type { ReactNode } from 'react';
import { useReducedMotion } from 'motion/react';

/**
 * Marquee très lent (60s par défaut), CSS-driven pour performance.
 * Hover pause via group-hover, opacity boost via CSS.
 */
export function Marquee({
  children,
  duration = 60,
  className,
}: {
  children: ReactNode;
  duration?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) {
    return <div className={`flex flex-wrap gap-12 ${className ?? ''}`}>{children}</div>;
  }
  return (
    <div className={`group relative overflow-hidden ${className ?? ''}`}>
      <div
        className="flex w-max gap-12 group-hover:[animation-play-state:paused]"
        style={{ animation: `marquee ${duration}s linear infinite` }}
      >
        <div className="flex shrink-0 gap-12">{children}</div>
        <div className="flex shrink-0 gap-12" aria-hidden="true">
          {children}
        </div>
      </div>
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
