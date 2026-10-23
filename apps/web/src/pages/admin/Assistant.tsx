import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { api, ApiError } from '@/lib/api';
import { Button, Chip, Textarea } from '@/components/ui';
import { cx } from '@/lib/format';

type Msg = { id: number; role: 'user' | 'assistant'; text: string; actions?: { tool: string; summary: string }[]; error?: boolean };

const PROMPTS = [
  'What should I focus on today?',
  "Which sponsors haven't responded?",
  'Which families have been waiting longest?',
  'Draft a nudge for SP-2026-001',
  'How are big families doing compared to small ones?',
  'Summarize this week',
];

export default function Assistant() {
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: api.admin.me });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [convo, setConvo] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const enabled = me.data?.assistantEnabled !== false && !disabledReason;
  const offNotice = disabledReason ?? (me.data && !me.data.assistantEnabled ? 'Assistant is off. Add ANTHROPIC_API_KEY to the API environment to enable it.' : null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy || !enabled) return;
    setInput('');
    setMsgs((m) => [...m, { id: Date.now(), role: 'user', text: t }]);
    setBusy(true);
    try {
      const r = await api.admin.assistant(t, convo);
      setConvo(r.conversationId);
      setMsgs((m) => [...m, { id: Date.now() + 1, role: 'assistant', text: r.reply, actions: r.actions }]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong.';
      if (e instanceof ApiError && e.status === 503) setDisabledReason(msg);
      setMsgs((m) => [...m, { id: Date.now() + 1, role: 'assistant', text: msg, error: true }]);
    } finally {
      setBusy(false);
      formRef.current?.querySelector('textarea')?.focus();
    }
  };

  return (
    <div className="flex h-[calc(100dvh-11rem)] min-h-[32rem] flex-col lg:h-[calc(100dvh-7rem)]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="display-tight text-3xl sm:text-4xl">Assistant</h1>
          <p className="mt-1 text-sm text-ink-3">Ask about families, sponsors and follow-ups. It reads live data and can send nudges or update statuses when you ask.</p>
        </div>
        {msgs.length > 0 && <Button size="sm" variant="secondary" onClick={() => { setMsgs([]); setConvo(undefined); }}>New conversation</Button>}
      </div>

      {offNotice && (
        <div className="mt-4 rounded-2xl border border-gold bg-gold-soft px-4 py-3 text-sm text-[#8a5f10]"><span className="font-semibold">Assistant is off.</span> {offNotice.replace(/^Assistant is off\.\s*/, '')}</div>
      )}

      <div className="mt-4 flex-1 overflow-y-auto rounded-xl3 border border-line/70 bg-paper p-4 shadow-soft sm:p-6">
        {msgs.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="grid size-14 place-items-center rounded-full bg-ember-soft text-ember">
              <svg viewBox="0 0 24 24" className="size-7" fill="currentColor"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3Zm6 11l.9 2.3 2.3.9-2.3.9L18 20l-.9-2.3-2.3-.9 2.3-.9L18 14Z" /></svg>
            </div>
            <h2 className="mt-4 text-xl">What do you want to know?</h2>
            <p className="mt-1 max-w-sm text-sm text-ink-3">Try one of these, or type your own question below.</p>
            <div className="mt-5 flex max-w-xl flex-wrap justify-center gap-2">
              {PROMPTS.map((p) => <Chip key={p} onClick={() => send(p)} className={cx(!enabled && 'pointer-events-none opacity-50')}>{p}</Chip>)}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence initial={false}>
              {msgs.map((m) => (
                <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className={cx('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cx('max-w-[85%] sm:max-w-[75%]', m.role === 'user' ? 'rounded-3xl rounded-br-md bg-ink px-4 py-3 text-cream' : cx('rounded-3xl rounded-bl-md px-4 py-3', m.error ? 'bg-red-50 text-bad' : 'bg-cream-2/80 text-ink'))}>
                    <Markdown text={m.text} />
                    {m.actions && m.actions.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">{m.actions.map((a, i) => <Chip key={i} tone="pine">✓ {a.summary}</Chip>)}</div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {busy && (
              <div className="flex justify-start"><div className="flex items-center gap-1.5 rounded-3xl rounded-bl-md bg-cream-2/80 px-4 py-3.5">
                {[0, 1, 2].map((i) => <motion.span key={i} className="size-2 rounded-full bg-ink-3" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }} />)}
              </div></div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <form ref={formRef} className="mt-3 flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} disabled={!enabled || busy} rows={1} placeholder={enabled ? 'Ask anything… (Enter to send, Shift+Enter for a new line)' : 'Assistant is unavailable'}
          className="min-h-12 max-h-40 resize-none py-3" onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input); } }} />
        <Button type="submit" size="lg" disabled={!enabled || !input.trim()} loading={busy} aria-label="Send">
          <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 16V4m0 0 5 5m-5-5-5 5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Button>
      </form>
    </div>
  );
}

/** Tiny markdown: paragraphs, bullet lines, numbered lines, **bold**, `code`. */
function Markdown({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-2 text-[15px] leading-relaxed">
      {blocks.map((b, i) => {
        const lines = b.split('\n');
        const isList = lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l));
        if (isList) {
          const ordered = /^\s*\d+[.)]/.test(lines[0]);
          const L = ordered ? 'ol' : 'ul';
          return <L key={i} className={cx('space-y-1 pl-5', ordered ? 'list-decimal' : 'list-disc')}>{lines.map((l, j) => <li key={j}><Inline text={l.replace(/^\s*([-*•]|\d+[.)])\s+/, '')} /></li>)}</L>;
        }
        return <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}<Inline text={l} /></span>)}</p>;
      })}
    </div>
  );
}
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return <>{parts.map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('`') ? <code key={i} className="rounded bg-ink/10 px-1 font-mono text-[13px]">{p.slice(1, -1)}</code> : <span key={i}>{p}</span>)}</>;
}
