import { useId, useState } from 'react';
import { motion } from 'motion/react';
import { cx } from '@/lib/format';

/**
 * Small, dependency-free SVG charts that follow the data-viz rules:
 * one hue for magnitude, thin marks, 4px rounded data-ends, hover tooltips,
 * recessive grid, text in text tokens (never series color).
 */

type Pt = { label: string; value: number; sub?: string };

export function Bars({ data, color = 'var(--color-s1)', height = 160, format = (v: number) => String(v), className }: { data: Pt[]; color?: string; height?: number; format?: (v: number) => string; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 100 / data.length;
  return (
    <div className={cx('viz-root relative', className)}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label="bar chart">
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1={0} x2={100} y1={height * (1 - g)} y2={height * (1 - g)} stroke="var(--grid)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />)}
        {data.map((d, i) => {
          const h = (d.value / max) * (height - 8);
          const bw = Math.max(1, w * 0.6);
          const x = i * w + (w - bw) / 2;
          return (
            <g key={d.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onTouchStart={() => setHover(i)}>
              <rect x={i * w} y={0} width={w} height={height} fill="transparent" />
              <motion.rect x={x} width={bw} rx={1.2} fill={color} initial={{ y: height, height: 0 }} animate={{ y: height - h, height: h }} transition={{ duration: 0.6, delay: i * 0.02, ease: [0.16, 1, 0.3, 1] }} opacity={hover === null || hover === i ? 1 : 0.45} />
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="viz-tip" style={{ left: `${(hover + 0.5) * w}%`, top: 0, transform: 'translate(-50%, -110%)' }}>
          <div className="font-semibold">{format(data[hover].value)}</div>
          <div className="opacity-70">{data[hover].sub ?? data[hover].label}</div>
        </div>
      )}
    </div>
  );
}

export function Line({ data, color = 'var(--color-s1)', height = 140, format = (v: number) => String(v), area = true, className }: { data: Pt[]; color?: string; height?: number; format?: (v: number) => string; area?: boolean; className?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = Math.max(1, data.length - 1);
  const pts = data.map((d, i) => [(i / n) * 100, height - 6 - (d.value / max) * (height - 14)] as const);
  const path = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x},${y}`).join(' ');
  return (
    <div className={cx('viz-root relative', className)}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} role="img" aria-label="line chart" onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(((e.clientX - r.left) / r.width) * n)); }}
        onTouchMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHover(Math.round(((e.touches[0].clientX - r.left) / r.width) * n)); }}>
        <defs><linearGradient id={id} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.22} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        {[0.5].map((g) => <line key={g} x1={0} x2={100} y1={height * (1 - g)} y2={height * (1 - g)} stroke="var(--grid)" strokeWidth={0.4} vectorEffect="non-scaling-stroke" />)}
        {area && <path d={`${path} L100,${height} L0,${height} Z`} fill={`url(#${id})`} />}
        <motion.path d={path} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }} />
        {hover !== null && pts[hover] && (
          <>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={0} y2={height} stroke="var(--text-secondary)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" strokeDasharray="2 2" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r={3} fill={color} stroke="var(--surface-1)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      {hover !== null && data[hover] && (
        <div className="viz-tip" style={{ left: `${(hover / n) * 100}%`, top: 0, transform: `translate(${hover / n > 0.8 ? '-100%' : hover / n < 0.2 ? '0' : '-50%'}, -110%)` }}>
          <div className="font-semibold">{format(data[hover].value)}</div>
          <div className="opacity-70">{data[hover].sub ?? data[hover].label}</div>
        </div>
      )}
    </div>
  );
}

/** Horizontal bars with labels — for funnels, categories, rankings. One hue. */
export function HBars({ data, color = 'var(--color-s1)', format = (v: number) => String(v), max: forcedMax, className }: { data: Pt[]; color?: string; format?: (v: number) => string; max?: number; className?: string }) {
  const max = forcedMax ?? Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cx('viz-root space-y-2.5', className)}>
      {data.map((d, i) => (
        <div key={d.label} className="grid grid-cols-[7.5rem_1fr_3rem] items-center gap-3 text-sm sm:grid-cols-[9rem_1fr_3.5rem]">
          <span className="truncate text-ink-2" title={d.label}>{d.label}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-soft">
            <motion.span className="block h-full rounded-full" style={{ background: color }} initial={{ width: 0 }} animate={{ width: `${(d.value / max) * 100}%` }} transition={{ duration: 0.7, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }} />
          </span>
          <span className="text-right font-semibold tabular-nums">{format(d.value)}</span>
        </div>
      ))}
    </div>
  );
}

/** Stacked single bar for part-to-whole, with a legend. Uses the categorical slots in fixed order. */
export function Stack({ parts, className }: { parts: { label: string; value: number; color: string }[]; className?: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1;
  return (
    <div className={cx('viz-root', className)}>
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-soft">
        {parts.filter((p) => p.value > 0).map((p) => (
          <motion.span key={p.label} className="h-full first:rounded-l-full last:rounded-r-full" style={{ background: p.color }} initial={{ flexBasis: 0 }} animate={{ flexBasis: `${(p.value / total) * 100}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} title={`${p.label}: ${p.value}`} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
        {parts.map((p) => (
          <li key={p.label} className="flex items-center gap-1.5 text-ink-2"><span className="size-2.5 rounded-sm" style={{ background: p.color }} />{p.label} <span className="font-semibold tabular-nums text-ink">{p.value}</span></li>
        ))}
      </ul>
    </div>
  );
}
