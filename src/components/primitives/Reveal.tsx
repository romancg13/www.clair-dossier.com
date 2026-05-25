import { createElement, useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';

const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;

// Fallback timeout: if the IntersectionObserver hasn't reported the element
// as visible by then (race conditions on route change, off-screen lazy
// sections, etc.), we force-show it so content never stays stuck invisible.
const FALLBACK_MS = 900;

// Very permissive viewport: trigger as soon as the element comes within
// 240px of the visible area, so sections just below the fold animate in
// before the user even scrolls to them.
const VIEWPORT_CONFIG = { once: true, amount: 0, margin: '240px' } as const;

type Tag = 'div' | 'section' | 'article' | 'header' | 'span' | 'aside' | 'figure';

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
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
  const [forceShown, setForceShown] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setForceShown(true), FALLBACK_MS);
    return () => clearTimeout(t);
  }, []);

  if (reduce) {
    return createElement(as, { className, id }, children);
  }

  const MotionTag = motion[as];

  if (forceShown) {
    // After fallback, render content in final state regardless of observer.
    return (
      <MotionTag
        id={id}
        className={className}
        initial={{ opacity: 0, y }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, delay, ease: EASE_OUT_EXPO }}
      >
        {children}
      </MotionTag>
    );
  }

  return (
    <MotionTag
      id={id}
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEWPORT_CONFIG}
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
  const [forceShown, setForceShown] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setForceShown(true), FALLBACK_MS);
    return () => clearTimeout(t);
  }, []);

  if (reduce) return <div className={className}>{children}</div>;

  if (forceShown) {
    // Hard fallback: animate visible regardless of observer.
    return (
      <motion.div
        ref={ref}
        className={className}
        variants={staggerParent}
        initial="hidden"
        animate="visible"
        transition={{ delayChildren: delay }}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={staggerParent}
      initial="hidden"
      transition={{ delayChildren: delay }}
      {...(inView
        ? { whileInView: 'visible', viewport: VIEWPORT_CONFIG }
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
