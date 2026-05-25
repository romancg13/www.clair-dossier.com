import { Marquee } from '../primitives/Marquee';
import { Reveal } from '../primitives/Reveal';
import { partners } from '../../data/partners';

export function Partners() {
  return (
    <Reveal as="section" className="border-y hairline bg-cream-100/40">
      <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 lg:px-12">
        <p className="text-center font-mono text-[0.72rem] uppercase tracking-[0.2em] text-slate-400">
          Utilisé par des cabinets et services juridiques français
        </p>
        <div className="mt-6">
          <Marquee duration={60}>
            {partners.map((name) => (
              <span
                key={name}
                className="whitespace-nowrap font-display text-lg font-medium tracking-tight text-slate-400 opacity-60 transition-opacity duration-300 hover:text-navy-900 hover:opacity-100 sm:text-xl"
              >
                {name}
              </span>
            ))}
          </Marquee>
        </div>
      </div>
    </Reveal>
  );
}
