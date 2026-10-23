import { useEffect, useState } from 'react';

const KEY = 'baf-loaded';
export function shouldShowLoader(): boolean {
  try { return !sessionStorage.getItem(KEY); } catch { return true; }
}

/**
 * The v3 loading page: dark ink screen, drifting purple orb, "Bless this family."
 * word reveal and a percentage counter. Plays once per session, then slides up.
 */
export function Loader({ onDone, season }: { onDone: () => void; season?: string }) {
  const [pct, setPct] = useState(0);
  const [up, setUp] = useState(false);
  useEffect(() => {
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + Math.ceil(Math.random() * 9) + 3);
      setPct(p);
      if (p >= 100) {
        clearInterval(t);
        try { sessionStorage.setItem(KEY, '1'); } catch { /* ignore */ }
        setTimeout(() => setUp(true), 250);
        setTimeout(onDone, 1200);
      }
    }, 70);
    return () => clearInterval(t);
  }, [onDone]);
  return (
    <div aria-hidden className="fixed inset-0 z-[200] flex flex-col justify-between overflow-hidden bg-ink p-[clamp(24px,4vw,48px)] text-white transition-transform duration-[900ms] ease-[cubic-bezier(.76,0,.24,1)]" style={{ transform: up ? 'translateY(-100%)' : 'translateY(0)' }}>
      <div className="absolute left-1/2 top-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-pri drift" style={{ filter: 'blur(90px)', opacity: 0.55, animationDuration: '6s' }} />
      <div className="relative flex justify-between text-[13px] text-white/60"><span>The Konnection</span><span>Holiday {season ?? new Date().getFullYear()}</span></div>
      <div className="relative flex flex-wrap gap-x-[.25em] text-[clamp(44px,8vw,112px)] font-bold leading-none tracking-[-.05em]">
        <span className="word-clip"><span className="loader-word" style={{ animationDelay: '.05s' }}>Bless</span></span>
        <span className="word-clip"><span className="loader-word" style={{ animationDelay: '.15s' }}>this</span></span>
        <span className="word-clip"><span className="loader-word text-lav" style={{ animationDelay: '.25s' }}>family.</span></span>
      </div>
      <div className="relative">
        <div className="flex items-end justify-between"><span className="text-[13px] text-white/60">Loading families near you</span><span className="text-[clamp(48px,7vw,96px)] font-bold leading-[.9] tracking-[-.05em] tabular">{pct}</span></div>
        <div className="mt-4 h-0.5 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-lav transition-[width] duration-[120ms] ease-linear" style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}
