import { Accordion } from '../ui/Accordion';
import { Reveal } from '../primitives/Reveal';
import { homeFaq } from '../../data/faq';

export function FaqBlock() {
  return (
    <Reveal as="section" className="bg-cream-50">
      <div className="mx-auto max-w-4xl px-5 py-24 sm:px-8 lg:px-12">
        <div className="text-center">
          <p className="font-mono text-[0.72rem] uppercase tracking-[0.2em] text-gold-500">
            Foire aux questions
          </p>
          <h2 className="mt-3 font-display text-4xl font-semibold leading-tight text-navy-900 sm:text-5xl">
            Huit questions qui reviennent.
          </h2>
        </div>

        <div className="mt-12">
          <Accordion
            items={homeFaq.map((entry) => ({
              id: entry.id,
              question: entry.question,
              answer: <p>{entry.answer}</p>,
            }))}
          />
        </div>
      </div>
    </Reveal>
  );
}
