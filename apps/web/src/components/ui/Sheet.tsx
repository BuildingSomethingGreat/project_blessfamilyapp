import { AnimatePresence, motion } from 'motion/react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Bottom sheet on mobile, centered dialog on desktop. */
export function Sheet({ open, onClose, children, title, wide }: { open: boolean; onClose: () => void; children: React.ReactNode; title?: string; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={title}>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.div
            initial={{ y: 48, opacity: 0, scale: 0.98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 48, opacity: 0, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            className={`relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-xl4 bg-paper shadow-lift sm:rounded-xl4 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-lg'}`}
          >
            <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line sm:hidden" />
            {title && (
              <div className="flex items-center justify-between px-6 pt-4 pb-2">
                <h2 className="text-xl">{title}</h2>
                <button onClick={onClose} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-bg text-ink-2 hover:bg-line">
                  <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" /></svg>
                </button>
              </div>
            )}
            <div className="overflow-y-auto px-6 pb-6 pb-safe">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
