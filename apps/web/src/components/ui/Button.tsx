import { motion, type HTMLMotionProps } from 'motion/react';
import { cx } from '@/lib/format';

type Variant = 'primary' | 'secondary' | 'ghost' | 'dark' | 'danger' | 'pine';
type Size = 'sm' | 'md' | 'lg' | 'xl';

const variants: Record<Variant, string> = {
  primary: 'bg-ember text-white hover:bg-ember-2 shadow-soft',
  secondary: 'bg-paper text-ink border border-line hover:border-ink-3',
  ghost: 'bg-transparent text-ink hover:bg-cream-2',
  dark: 'bg-ink text-cream hover:bg-night',
  danger: 'bg-paper text-bad border border-line hover:bg-red-50',
  pine: 'bg-pine text-white hover:bg-[#174a39]',
};
const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-sm gap-1.5',
  md: 'h-11 px-5 text-[15px] gap-2',
  lg: 'h-13 px-6 text-base gap-2',
  xl: 'h-14 px-7 text-lg gap-2.5',
};

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  full?: boolean;
  children?: React.ReactNode;
}

export function Button({ variant = 'primary', size = 'md', loading, full, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      className={cx(
        'inline-flex items-center justify-center rounded-full font-semibold select-none transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none',
        variants[variant], sizes[size], full && 'w-full', className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <span className="size-4 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden />}
      {children}
    </motion.button>
  );
}
