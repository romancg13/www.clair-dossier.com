import type { ReactNode } from 'react';
import { DEMO_LABEL } from './demo-dossier';

/** Cadre d'une scène sur fond cinéma (panneau translucide, lumière haute). */
export function Stage({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`cd-stage rounded-[1.5rem] p-5 sm:p-7 ${className}`}>{children}</div>;
}

/**
 * Marqueur obligatoire des données fictives (MASTER_PROMPT VI.4 / X.5) :
 * jamais de vraies données client dans une mise en scène.
 */
export function DemoBadge({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const skin =
    tone === 'dark'
      ? 'border-cream-50/15 bg-cream-50/6 text-silver-200/80'
      : 'hairline-gold bg-gold-500/12 text-gold-700';
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[0.62rem] uppercase tracking-[0.16em] ${skin}`}
    >
      <span className="h-1 w-1 rounded-full bg-gold-500" aria-hidden="true" />
      {DEMO_LABEL}
    </span>
  );
}

/** Ligne « clé → valeur » d'un panneau sur fond sombre. */
export function DarkRow({
  label,
  value,
  tone = 'normal',
}: {
  label: string;
  value: ReactNode;
  tone?: 'normal' | 'gold';
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-[0.8rem]">
      <dt className="text-silver-400">{label}</dt>
      <dd className={`text-right font-medium ${tone === 'gold' ? 'text-gold-400' : 'text-cream-50'}`}>
        {value}
      </dd>
    </div>
  );
}
