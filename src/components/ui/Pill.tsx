import type { ReactNode } from 'react';

type Tone = 'cream' | 'navy' | 'gold' | 'mono';

const TONE: Record<Tone, string> = {
  cream: 'bg-cream-100 text-navy-900 border hairline-gold',
  navy: 'bg-navy-900 text-cream-50 border border-navy-900',
  gold: 'bg-gold-500/15 text-navy-900 border hairline-gold',
  mono: 'bg-cream-50 text-navy-900 border hairline font-mono uppercase tracking-[0.16em] text-[0.7rem]',
};

export function Pill({
  children,
  tone = 'cream',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${TONE[tone]} ${className ?? ''}`}
    >
      {children}
    </span>
  );
}
