import { AnimatePresence, motion } from 'motion/react';
import { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Toast = { id: number; text: string; tone?: 'ok' | 'bad' | 'neutral' };
const Ctx = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, tone: Toast['tone'] = 'neutral') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, tone }]);
    setTimeout(() => setItems((xs) => xs.filter((t) => t.id !== id)), 3200);
  }, []);
  const value = useMemo(() => push, [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 pb-safe">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div key={t.id} initial={{ y: 20, opacity: 0, scale: 0.95 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className={`pointer-events-auto rounded-full px-4 py-2.5 text-sm font-medium shadow-lift ${t.tone === 'ok' ? 'bg-ok text-white' : t.tone === 'bad' ? 'bg-bad text-white' : 'bg-ink text-white'}`}>
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
