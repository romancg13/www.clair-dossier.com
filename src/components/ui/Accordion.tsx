import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export type AccordionItem = {
  id: string;
  question: string;
  answer: ReactNode;
};

export function Accordion({ items }: { items: AccordionItem[] }) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null);

  return (
    <ul className="divide-y hairline border-y hairline">
      {items.map((item) => {
        const isOpen = open === item.id;
        return (
          <li key={item.id}>
            <button
              type="button"
              id={`accordion-trigger-${item.id}`}
              onClick={() => setOpen(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              aria-controls={`accordion-panel-${item.id}`}
              className="flex min-h-[44px] w-full items-center justify-between gap-4 py-4 text-left transition-colors sm:gap-6 sm:py-5"
            >
              <span className="font-display text-base font-semibold text-navy-900 sm:text-xl">
                {item.question}
              </span>
              <span
                aria-hidden="true"
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full border hairline transition-transform"
                style={{ transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)' }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-navy-900">
                  <line x1="6" y1="1" x2="6" y2="11" />
                  <line x1="1" y1="6" x2="11" y2="6" />
                </svg>
              </span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="content"
                  id={`accordion-panel-${item.id}`}
                  role="region"
                  aria-labelledby={`accordion-trigger-${item.id}`}
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="overflow-hidden"
                >
                  <div className="pb-5 pr-2 text-sm text-slate-500 leading-relaxed sm:pb-6 sm:pr-10 sm:text-base">
                    {item.answer}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </li>
        );
      })}
    </ul>
  );
}
