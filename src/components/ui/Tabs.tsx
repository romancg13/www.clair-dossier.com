import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export type TabItem = {
  id: string;
  label: string;
  content: ReactNode;
};

export function Tabs({
  items,
  defaultId,
  className,
}: {
  items: TabItem[];
  defaultId?: string;
  className?: string;
}) {
  const [active, setActive] = useState(defaultId ?? items[0]?.id);
  const activeItem = items.find((i) => i.id === active) ?? items[0];
  const tabsRef = useRef<Array<HTMLButtonElement | null>>([]);

  // Pattern tabs WAI-ARIA : le tabindex tournant retire les onglets inactifs
  // du parcours Tab — les flèches (+ Home/End) prennent le relais, comme dans
  // AudienceSwitcher.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const idx = items.findIndex((i) => i.id === active);
    let next = idx;
    if (e.key === 'ArrowRight') next = (idx + 1) % items.length;
    else if (e.key === 'ArrowLeft') next = (idx - 1 + items.length) % items.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = items.length - 1;
    else return;
    e.preventDefault();
    setActive(items[next].id);
    tabsRef.current[next]?.focus();
  }

  return (
    <div className={className}>
      <div role="tablist" aria-label="Espaces dédiés" onKeyDown={onKeyDown} className="inline-flex flex-wrap gap-2 rounded-full border border-cream-50/15 bg-navy-800/40 p-1 backdrop-blur">
        {items.map((item, i) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              ref={(el) => {
                tabsRef.current[i] = el;
              }}
              id={`tab-${item.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setActive(item.id)}
              className={`relative min-h-[40px] rounded-full px-4 py-2 text-xs font-medium transition-colors sm:px-5 sm:text-sm ${
                isActive ? 'text-navy-900' : 'text-cream-50/75 hover:text-cream-50'
              }`}
            >
              {isActive && (
                <motion.span
                  layoutId="tab-active"
                  className="absolute inset-0 rounded-full bg-gold-500"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              )}
              <span className="relative z-10">{item.label}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 min-h-[280px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeItem.id}
            id={`tabpanel-${activeItem.id}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeItem.id}`}
            tabIndex={0}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          >
            {activeItem.content}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
