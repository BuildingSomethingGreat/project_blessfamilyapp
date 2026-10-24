import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { cx } from '@/lib/format';

/**
 * Festive decor primitives.
 *
 * Everything here is decorative: `aria-hidden`, `pointer-events-none`, and layered with
 * z-index so props can overlap real UI without ever blocking it. Depth comes from three
 * things working together: (1) back-layer props are blurred and desaturated, (2) each prop
 * scrolls at its own rate (`depth`), and (3) front-layer props sit above content and above
 * the back snow while the front snow drifts over everything.
 *
 * Assets live in /public/festive (transparent PNGs, generated for this project).
 */

export const FESTIVE = {
  branch: '/festive/branch.png',
  ornament: '/festive/ornament.png',
  gifts: '/festive/gifts.png',
  lantern: '/festive/lantern.png',
  snowflake: '/festive/snowflake.png',
} as const;

type Motion = 'sway' | 'swing' | 'drift' | 'hover' | 'none';

/** One decorative image. `depth` is the parallax rate relative to scroll (negative = moves up slower, i.e. farther away). */
export function Prop({ src, className, style, motion = 'none', depth = 0, blur = 0, opacity = 1, flip = false, delay = '0s', width }: {
  src: string;
  className?: string;
  style?: CSSProperties;
  motion?: Motion;
  depth?: number;
  blur?: number;
  opacity?: number;
  flip?: boolean;
  delay?: string;
  width?: string;
}) {
  // The mirror lives on the wrapper so keyframe transforms on the <img> (sway/swing/drift) stay in the flipped frame.
  const ref = useParallax(depth, flip);
  return (
    <div ref={ref} aria-hidden className={cx('pointer-events-none absolute select-none will-change-transform', className)} style={{ width, transform: flip ? 'scaleX(-1)' : undefined, ...style }}>
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        className={cx('block h-auto w-full', motion !== 'none' && `festive-${motion}`)}
        style={{ opacity, filter: blur ? `blur(${blur}px)` : undefined, animationDelay: delay, transformOrigin: motion === 'swing' ? '50% 0%' : motion === 'sway' ? '0% 0%' : undefined }}
      />
    </div>
  );
}

/** Soft out-of-focus light discs (CSS only, no filters, cheap). Seeded so SSR/CSR and re-renders agree. */
export function Bokeh({ count = 26, className, seed = 1, edges = true }: { count?: number; className?: string; seed?: number; edges?: boolean }) {
  const rnd = mulberry32(seed);
  const dots = Array.from({ length: count }, (_, i) => {
    // keep the centre column clear-ish so headlines stay clean
    let x = rnd() * 100;
    if (edges && x > 30 && x < 70) x = x < 50 ? x - 28 : x + 28;
    const y = rnd() * 100;
    const size = 10 + rnd() * 40;
    const warm = rnd() < 0.62;
    const a = 0.25 + rnd() * 0.4;
    return { i, x, y, size, warm, a, d: rnd() * 6, dur: 4 + rnd() * 5 };
  });
  return (
    <div aria-hidden className={cx('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {dots.map((d) => (
        <span
          key={d.i}
          className="festive-twinkle absolute rounded-full"
          style={{
            left: `${d.x}%`, top: `${d.y}%`, width: d.size, height: d.size, ['--tw' as string]: d.a,
            background: d.warm
              ? 'radial-gradient(circle, rgba(255,222,150,.95) 0%, rgba(255,214,140,.55) 45%, rgba(255,214,140,0) 72%)'
              : 'radial-gradient(circle, rgba(201,184,255,.95) 0%, rgba(155,107,255,.45) 45%, rgba(155,107,255,0) 72%)',
            animationDelay: `-${d.d}s`, animationDuration: `${d.dur}s`,
          }}
        />
      ))}
    </div>
  );
}

/** Layer wrappers: absolute, full-bleed, non-interactive. Callers choose z-index via className. */
export function Layer({ className, children }: { className?: string; children: ReactNode }) {
  return <div aria-hidden className={cx('pointer-events-none absolute inset-0', className)}>{children}</div>;
}

/* ---------- parallax ---------- */

/** Moves an element by scrollY * depth. One shared scroll listener; transforms via CSS var so keyframe animations on children are untouched. */
function useParallax(depth: number, flip: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !depth) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const tail = flip ? ' scaleX(-1)' : '';
    return subscribe((y) => { el.style.transform = `translate3d(0, ${(y * depth).toFixed(1)}px, 0)${tail}`; });
  }, [depth, flip]);
  return ref;
}

const subs = new Set<(y: number) => void>();
let armed = false;
let raf = 0;
function subscribe(fn: (y: number) => void) {
  subs.add(fn);
  fn(window.scrollY);
  if (!armed) {
    armed = true;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => { raf = 0; const y = window.scrollY; subs.forEach((s) => s(y)); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
  }
  return () => { subs.delete(fn); };
}

function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
