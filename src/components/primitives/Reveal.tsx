import { createElement, type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

type Tag = 'div' | 'section' | 'article' | 'header' | 'span' | 'aside' | 'figure';

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
  amount = 0.2,
  as = 'div',
  id,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  amount?: number;
  as?: Tag;
  id?: string;
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];
  if (reduce) {
    return createElement(as, { className, id }, children);
  }
  return (
    <MotionTag
      id={id}
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount, margin: '-40px' }}
      transition={{ duration: 0.65, delay, ease: EASE_OUT_EXPO }}
    >
      {children}
    </MotionTag>
  );
}

const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE_OUT_EXPO } },
};

export function Stagger({
  children,
  className,
  inView = true,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  inView?: boolean;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      variants={staggerParent}
      initial="hidden"
      transition={{ delayChildren: delay }}
      {...(inView
        ? { whileInView: 'visible', viewport: { once: true, amount: 0.2, margin: '-40px' } }
        : { animate: 'visible' })}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}
