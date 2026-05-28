import { useState, type ReactNode } from 'react';
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

  return (
    <div className={className}>
      <div role="tablist" aria-label="Espaces dédiés" className="inline-flex flex-wrap gap-2 rounded-full border border-cream-50/15 bg-navy-800/40 p-1 backdrop-blur">
        {items.map((item) => {
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
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
