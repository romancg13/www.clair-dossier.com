import type { ReactNode } from 'react';

/**
 * Gabarit d'un chapitre du récit (fond cinéma) : texte d'un côté, scène de
 * l'autre. `align` alterne le côté du texte d'un chapitre à l'autre pour
 * donner un rythme de lecture, sans jamais changer la hiérarchie.
 */
export function ChapterFrame({
  id,
  number,
  kicker,
  title,
  body,
  footnote,
  align = 'left',
  children,
}: {
  id: string;
  number: string;
  kicker: string;
  title: ReactNode;
  body: ReactNode;
  footnote?: ReactNode;
  align?: 'left' | 'right';
  children: ReactNode;
}) {
  return (
    <section id={id} className="relative py-20 sm:py-28 lg:py-36">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-12">
        <div className="grid items-center gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-20">
          <div className={align === 'right' ? 'lg:order-2' : ''}>
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-400">
              <span className="text-silver-400">{number}</span>
              <span className="mx-2 text-silver-400/50" aria-hidden="true">
                —
              </span>
              {kicker}
            </p>
            <h2 className="mt-4 font-display text-[clamp(2.1rem,4.4vw,4rem)] font-semibold leading-[1.02] tracking-[-0.015em] text-cream-50">
              {title}
            </h2>
            <div className="mt-5 max-w-lg text-[1.02rem] leading-[1.65] text-silver-200/78">{body}</div>
            {footnote && <div className="mt-6 text-sm text-silver-400">{footnote}</div>}
          </div>
          <div className={align === 'right' ? 'lg:order-1' : ''}>{children}</div>
        </div>
      </div>
    </section>
  );
}
