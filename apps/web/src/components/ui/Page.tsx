import { motion } from 'motion/react';
import { cx } from '@/lib/format';

export function Page({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.main initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }} className={cx('mx-auto w-full max-w-6xl px-4 sm:px-6', className)}>
      {children}
    </motion.main>
  );
}

/** Stagger children on mount. */
export const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } } };
export const rise = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } } };
