import { motion, type HTMLMotionProps } from 'motion/react';
import { cx } from '@/lib/format';

export function Card({ className, children, hover, ...rest }: HTMLMotionProps<'div'> & { hover?: boolean }) {
  return (
    <motion.div
      whileHover={hover ? { y: -3 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={cx('rounded-xl2 bg-paper shadow-soft border border-line/70', hover && 'hover:shadow-lift transition-shadow duration-300', className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
