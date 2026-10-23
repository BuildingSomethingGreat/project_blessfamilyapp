import { motion, type HTMLMotionProps } from 'motion/react';
import { cx } from '@/lib/format';

export function Card({ className, children, hover, dark, soft, ...rest }: HTMLMotionProps<'div'> & { hover?: boolean; dark?: boolean; soft?: boolean }) {
  return (
    <motion.div
      whileHover={hover ? { y: -4 } : undefined}
      transition={{ type: 'spring', stiffness: 300, damping: 24 }}
      className={cx('rounded-xl3', dark ? 'bg-ink text-white' : soft ? 'bg-soft' : 'border border-line bg-paper', hover && 'hover:shadow-lift transition-shadow duration-300', className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}
