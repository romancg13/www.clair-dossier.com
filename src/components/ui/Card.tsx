import { createElement, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

type Variant = 'white' | 'cream' | 'navy';

const VARIANT: Record<Variant, string> = {
  white: 'bg-white border hairline shadow-card',
  cream: 'bg-cream-100 border hairline-strong',
  navy: 'bg-navy-900 text-cream-50 border border-navy-800',
};

export function Card({
  children,
  variant = 'white',
  className,
  interactive = false,
  as = 'article',
}: {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  interactive?: boolean;
  as?: 'article' | 'div' | 'section' | 'li';
}) {
  const reduce = useReducedMotion();
  const cls = `rounded-xl p-6 transition-[border-color,box-shadow,transform] duration-300 ${VARIANT[variant]} ${className ?? ''}`;

  if (interactive && !reduce) {
    const MotionTag = motion[as];
    return (
      <MotionTag
        className={`${cls} hover:border-gold-500 hover:shadow-card-hover hover:-translate-y-1`}
        whileHover={{ y: -4 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {children}
      </MotionTag>
    );
  }

  return createElement(as, { className: cls }, children);
}
