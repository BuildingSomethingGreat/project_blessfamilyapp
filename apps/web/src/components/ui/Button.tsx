import { motion, type HTMLMotionProps } from 'motion/react';
import { cx } from '@/lib/format';

type Variant = 'primary' | 'dark' | 'lav' | 'secondary' | 'ghost' | 'danger' | 'white';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const variants: Record<Variant, string> = {
  primary: 'bg-pri text-white hover:bg-pri-dark',
  dark: 'bg-ink text-white hover:bg-pri',
  lav: 'bg-lav text-ink hover:bg-white',
  secondary: 'bg-paper text-ink border border-line hover:border-ink',
  ghost: 'bg-transparent text-ink hover:bg-soft-2',
  danger: 'bg-bad-soft text-bad hover:bg-red-100',
  white: 'bg-white text-ink hover:bg-lav',
};
const sizes: Record<Size, string> = {
  xs: 'h-8 px-3 text-xs gap-1.5',
  sm: 'h-9 px-3.5 text-[13px] gap-1.5',
  md: 'h-11 px-5 text-[14px] gap-2',
  lg: 'h-[50px] px-6 text-[15px] gap-2',
  xl: 'h-[54px] px-7 text-base gap-3',
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
        'inline-flex items-center justify-center rounded-full font-semibold select-none transition-colors duration-250 disabled:cursor-not-allowed disabled:bg-disabled disabled:text-white disabled:border-0',
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

/** The v3 hero button: dark pill with a white arrow disc that slides on hover. */
export function ArrowButton({ children, className, ...rest }: ButtonProps) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} className={cx('group inline-flex h-[54px] items-center gap-3.5 rounded-full bg-ink pl-7 pr-2.5 text-base font-semibold text-white shadow-[0_14px_30px_-14px_rgba(29,17,51,.7)] transition-all duration-350 hover:bg-pri hover:pl-8 hover:pr-2', className)} {...rest}>
      {children}
      <span className="grid size-9 place-items-center rounded-full bg-white text-[15px] text-ink">→</span>
    </motion.button>
  );
}
