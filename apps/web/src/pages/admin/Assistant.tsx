import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, ApiError } from '@/lib/api';
import { Chip } from '@/components/ui';
import { cx } from '@/lib/format';
import { PageHead } from './shared.tsx';

type Msg = { id: number; role: 'user' | 'assistant'; text: string; actions?: { tool: string; summary: string }[]; error?: boolean };

const PROMPTS = ['Which families with 3+ kids are still open?', 'Who has gone quiet?', 'Draft a nudge', 'Weekly summary', 'How many kids need coats?'];

export default function Assistant() {
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: api.admin.me });
  const report = useQuery({ queryKey: ['admin', 'report'], queryFn: api.admin.report });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [convo, setConvo] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const [disabledReason, setDisabledReason] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const enabled = me.data?.assistantEnabled !== false && !disabledReason;
  const offNotice = disabledReason ?? (me.data && !me.data.assistantEnabled ? 'Assistant is off. Add ANTHROPIC_API_KEY to the API environment to enable it.' : null);
  const r = report.data;
  const opening = r
    ? `Morning. ${r.pipeline.Available} families are still waiting, ${r.followUp.overdue.length} Konnector${r.followUp.overdue.length === 1 ? " has" : "s have"} gone quiet, and ${r.deadline.daysLeft} days remain to drop-off. What do you need?`
    : 'Morning. Pulling the latest numbers…';

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs, busy]);

  const send = async (text: string) => {
    const t = text.trim();
    if (!t || busy || !enabled) return;
    setInput('');
    setMsgs((m) => [...m, { id: Date.now(), role: 'user', text: t }]);
    setBusy(true);
    try {
      const res = await api.admin.assistant(t, convo);
      setConvo(res.conversationId);
      setMsgs((m) => [...m, { id: Date.now() + 1, role: 'assistant', text: res.reply, actions: res.actions }]);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : 'Something went wrong.';
      if (e instanceof ApiError && e.status === 503) setDisabledReason(msg);
      setMsgs((m) => [...m, { id: Date.now() + 1, role: 'assistant', text: msg, error: true }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };
  const bubbles: Msg[] = [{ id: 0, role: 'assistant', text: opening }, ...msgs];

  return (
    <div className="anim-rise min-w-0 max-w-[880px]">
      <PageHead title="Assistant" sub="Asks the live data, drafts messages, and can take actions — releases always ask first." right={msgs.length > 0 ? <button className="text-[13px] font-semibold text-ink-3 hover:text-ink" onClick={() => { setMsgs([]); setConvo(undefined); }}>New conversation</button> : undefined} />
      {offNotice && <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-warn"><b>Assistant is off.</b> {offNotice.replace(/^Assistant is off\.\s*/, '')}</div>}

      <div className="mt-[22px] flex min-h-[520px] flex-col rounded-[28px] border border-line bg-white">
        <div className="grid flex-1 content-start gap-3.5 p-4 sm:p-6">
          {bubbles.map((m) => (
            <div key={m.id} className={cx('anim-bubble flex flex-col', m.role === 'user' ? 'items-end' : 'items-start')}>
              <div className={cx('max-w-[92%] whitespace-pre-line rounded-[18px] px-4 py-3 text-[14px] leading-[1.55] sm:max-w-[78%]', m.role === 'user' ? 'bg-ink text-white' : m.error ? 'bg-bad-soft text-bad' : 'bg-bg text-ink')}><Markdown text={m.text} /></div>
              {m.actions && m.actions.length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {m.actions.map((a, i) => <Chip key={i} tone="dark">✓ {a.summary}</Chip>)}
                  <span className="text-[12px] text-ink-3">Logged as an agent action</span>
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="flex w-max gap-1 rounded-[18px] bg-bg px-4 py-3">
              {[0, 0.2, 0.4].map((d) => <span key={d} className="blink size-1.5 rounded-full bg-ink-3" style={{ animationDelay: `${d}s` }} />)}
            </div>
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-soft px-[18px] pb-[18px] pt-3.5">
          <div className="mb-2.5 flex flex-wrap gap-1.5">
            {PROMPTS.map((p) => <button key={p} type="button" disabled={!enabled || busy} onClick={() => send(p)} className="h-8 rounded-full border border-line bg-white px-3 text-[12px] font-semibold text-ink-2 transition-colors hover:border-pri hover:text-pri disabled:opacity-50">{p}</button>)}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} disabled={!enabled || busy} placeholder={enabled ? 'Ask about families, Konnectors, follow-ups…' : 'Assistant is unavailable'} className="h-[46px] min-w-0 flex-1 rounded-full border border-line bg-bg px-[18px] text-[14px] outline-none transition-colors focus:border-pri focus:bg-white disabled:opacity-60" />
            <button type="submit" disabled={!enabled || busy || !input.trim()} className="h-[46px] rounded-full bg-pri px-[18px] text-[14px] font-bold text-white transition-colors hover:bg-pri-dark disabled:bg-disabled">Ask</button>
          </form>
        </div>
      </div>
    </div>
  );
}

/** Tiny markdown: bullet/numbered lines, **bold**, `code`. Paragraph breaks come from white-space: pre-line. */
function Markdown({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((l, i) => {
        const m = /^\s*([-*•]|\d+[.)])\s+(.*)$/.exec(l);
        return <span key={i}>{i > 0 && '\n'}{m ? <span className="inline-block pl-3 -indent-3">{m[1].match(/\d/) ? m[1] + ' ' : '• '}<Inline text={m[2]} /></span> : <Inline text={l} />}</span>;
      })}
    </>
  );
}
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return <>{parts.map((p, i) => p.startsWith('**') ? <strong key={i}>{p.slice(2, -2)}</strong> : p.startsWith('`') ? <code key={i} className="rounded bg-ink/10 px-1 font-mono text-[12px]">{p.slice(1, -1)}</code> : <span key={i}>{p}</span>)}</>;
}
