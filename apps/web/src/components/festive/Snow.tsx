import { useEffect, useRef } from 'react';
import { cx } from '@/lib/format';

type Flake = { x: number; y: number; r: number; vy: number; vx: number; a: number; ph: number };

/**
 * Canvas snowfall that fills its (relatively positioned) parent.
 *
 * `layer="back"` draws many small, crisp flakes meant to sit behind content;
 * `layer="front"` draws fewer, larger, softly blurred flakes meant to float over it.
 * Stacking is the caller's job (z-index); the canvas never captures pointer events.
 *
 * Respects prefers-reduced-motion (renders nothing), and pauses when the canvas
 * scrolls out of view or the tab is hidden.
 */
export function Snow({ layer = 'back', density = 1, className }: { layer?: 'back' | 'front'; density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const front = layer === 'front';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    let h = 0;
    let flakes: Flake[] = [];
    let raf = 0;
    let running = true;
    let inView = true;
    let last = performance.now();

    const spawn = (anywhere: boolean): Flake => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : -12,
      r: front ? 2.4 + Math.random() * 3.2 : 0.8 + Math.random() * 1.7,
      vy: front ? 28 + Math.random() * 30 : 12 + Math.random() * 20, // px/s
      vx: (Math.random() - 0.5) * 10,
      a: front ? 0.3 + Math.random() * 0.35 : 0.28 + Math.random() * 0.5,
      ph: Math.random() * Math.PI * 2,
    });

    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      w = Math.max(1, rect.width);
      h = Math.max(1, rect.height);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(front ? 60 : 220, Math.round(((w * h) / (front ? 30000 : 9000)) * density));
      flakes = Array.from({ length: n }, () => spawn(true));
    };

    const tick = (now: number) => {
      if (!running) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (inView) {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#ffffff';
        for (const f of flakes) {
          f.ph += dt * 0.9;
          f.x += (f.vx + Math.sin(f.ph) * 14) * dt;
          f.y += f.vy * dt;
          if (f.y > h + 12 || f.x < -12 || f.x > w + 12) Object.assign(f, spawn(false));
          ctx.globalAlpha = f.a;
          ctx.beginPath();
          ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);
    const io = new IntersectionObserver(([e]) => { inView = !!e?.isIntersecting; }, { rootMargin: '80px' });
    io.observe(canvas);
    const onVis = () => { running = !document.hidden; if (running) { last = performance.now(); raf = requestAnimationFrame(tick); } else cancelAnimationFrame(raf); };
    document.addEventListener('visibilitychange', onVis);
    raf = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [layer, density]);

  return <canvas ref={ref} aria-hidden className={cx('pointer-events-none absolute inset-0 block', layer === 'front' && 'snow-front', className)} />;
}
