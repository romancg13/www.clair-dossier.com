import type { ReactElement } from 'react';
import type { JournalIllustrationKey } from '../../data/blog/types';

/**
 * Illustrations originales du Journal : traits or sur fond marine, SVG inline
 * (aucune requête, < 1 Ko chacune), purement décoratives.
 */
const MOTIFS: Record<JournalIllustrationKey, ReactElement> = {
  dossier: (
    <>
      <path d="M22 30h22l6 6h28v36H22z" />
      <path d="M30 46h40M30 54h32M30 62h24" opacity=".6" />
    </>
  ),
  archive: (
    <>
      <rect x="20" y="24" width="60" height="12" rx="2" />
      <path d="M24 36v36h52V36" />
      <path d="M42 46h16" />
      <path d="M32 58h36M32 64h26" opacity=".5" />
    </>
  ),
  shield: (
    <>
      <path d="M50 20l26 10v18c0 16-11 27-26 32-15-5-26-16-26-32V30z" />
      <path d="M39 50l8 8 15-16" />
    </>
  ),
  timeline: (
    <>
      <path d="M16 50h68" />
      <circle cx="28" cy="50" r="4" />
      <circle cx="50" cy="50" r="4" />
      <circle cx="72" cy="50" r="4" />
      <path d="M28 40v-8M50 60v8M72 40v-8" opacity=".6" />
    </>
  ),
  letter: (
    <>
      <rect x="20" y="28" width="60" height="42" rx="3" />
      <path d="M20 32l30 20 30-20" />
    </>
  ),
  balance: (
    <>
      <path d="M50 22v50M34 72h32M24 34h52" />
      <path d="M24 34l-8 18h16zM76 34l-8 18h16z" />
    </>
  ),
  checklist: (
    <>
      <rect x="26" y="20" width="48" height="58" rx="3" />
      <path d="M34 36l4 4 7-8M34 52l4 4 7-8M34 68l4 4 7-8" />
      <path d="M52 37h14M52 53h14M52 69h10" opacity=".6" />
    </>
  ),
  compass: (
    <>
      <circle cx="50" cy="50" r="28" />
      <path d="M58 42l-5 13-13 5 5-13z" />
    </>
  ),
};

export function JournalIllustration({
  kind = 'dossier',
  className = '',
}: {
  kind?: JournalIllustrationKey;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`relative overflow-hidden bg-navy-900 ${className}`}
      style={{
        backgroundImage:
          'radial-gradient(circle at 80% 20%, rgba(196,164,86,0.22), transparent 55%)',
      }}
    >
      <svg
        viewBox="0 0 100 100"
        className="absolute right-6 top-1/2 h-[72%] -translate-y-1/2 text-gold-500"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {MOTIFS[kind]}
      </svg>
    </div>
  );
}
