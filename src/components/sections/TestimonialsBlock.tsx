import { Reveal, Stagger, StaggerItem } from '../primitives/Reveal';
import { testimonials } from '../../data/testimonials';

export function TestimonialsBlock() {
  return (
    <Reveal as="section" className="bg-cream-100/60">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="max-w-3xl">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Témoignages
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
            Ce que disent les premières équipes.
          </h2>
        </div>

        <Stagger inView className="mt-14 grid gap-5 lg:grid-cols-3">
          {testimonials.map((t) => (
            <StaggerItem key={t.id}>
              <figure className="flex h-full flex-col rounded-2xl border hairline bg-white p-7">
                <span
                  aria-hidden="true"
                  className="font-display text-5xl leading-none text-gold-500"
                >
                  «
                </span>
                <blockquote className="mt-4 flex-1 font-display text-xl italic leading-snug text-navy-900 sm:text-[1.4rem]">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-6 border-t hairline pt-5">
                  <p className="font-semibold text-navy-900">{t.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">{t.role}</p>
                  <p className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.14em] text-slate-400">
                    {t.context}
                  </p>
                </figcaption>
              </figure>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </Reveal>
  );
}
