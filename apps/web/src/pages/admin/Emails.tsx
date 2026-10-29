import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type EmailLogRow } from '@/lib/api';
import { Button, Chip, EmptyState, Input, Seg, Skeleton, useToast } from '@/components/ui';
import { cx } from '@/lib/format';
import { PageHead, Panel, PanelTitle } from './shared.tsx';

type Filter = 'all' | 'konnector' | 'family' | 'admin' | 'failed';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'konnector', label: 'Konnectors' }, { key: 'family', label: 'Families' }, { key: 'admin', label: 'Team' }, { key: 'failed', label: 'Failed' },
];
const matches = (e: EmailLogRow, f: Filter) => f === 'all' ? true : f === 'failed' ? !e.ok : f === 'admin' ? e.audience === 'admin' || e.audience === 'test' : e.audience === f;

/** Readable names for the email kinds the API logs. */
const KIND: Record<string, string> = {
  claim_confirmation: 'Claim confirmation', confirm_nudge: 'Confirm nudge', shopping_checkin: 'Shopping check-in', deadline_reminder: 'Deadline reminder',
  dropoff_thanks: 'Hand-off thanks', delivered_thanks: 'Delivered thanks', released_notice: 'Released (staff)', release_confirmation: 'Release confirmation', staff_note: 'Note from staff',
  family_received: 'Application received', family_approved: 'Family approved', family_matched: 'Family matched', family_note: 'Note to family',
  konnector_login: 'Sign-in link', konnector_no_account: 'Not a sponsor yet', admin_login: 'Admin sign-in',
  admin_new_application: 'New application', admin_family_claimed: 'Family claimed', admin_family_released: 'Family released', admin_flagged: 'Konnector flagged', admin_handed_off: 'Gifts handed off', admin_konnector_update: 'Konnector update', admin_konnector_note: 'Konnector note', admin_quote: 'New quote', admin_followup_run: 'Follow-up run', test: 'Test email',
};
const AUDIENCE: Record<EmailLogRow['audience'], string> = { konnector: 'Konnector', family: 'Family', admin: 'Team', test: 'Test' };
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Emails: every transactional email the app sent (or tried to), newest first, plus a test send. */
export default function Emails() {
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: api.admin.me });
  const emails = useQuery({ queryKey: ['admin', 'emails'], queryFn: () => api.admin.emails(), refetchInterval: 30_000 });
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, (emails.data ?? []).filter((e) => matches(e, f.key)).length])) as Record<Filter, number>, [emails.data]);
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (emails.data ?? []).filter((e) => matches(e, filter) && (!needle || [e.to, e.subject, e.family?.familyId, e.family?.nickname, e.sponsorshipId, KIND[e.kind]].some((x) => x?.toLowerCase().includes(needle))));
  }, [emails.data, filter, q]);
  const mail = me.data?.mail;

  return (
    <div className="anim-rise">
      <PageHead title="Emails" sub="Every email sent to Konnectors, families and the team. Sign-in links are never shown." right={<Button size="sm" variant="secondary" className="h-10 px-4" onClick={() => qc.invalidateQueries({ queryKey: ['admin', 'emails'] })}>Refresh</Button>} />
      <div className="mt-[22px] grid items-start gap-3.5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 overflow-hidden rounded-[24px] border border-line bg-white">
          <div className="grid gap-2.5 border-b border-line p-[18px]">
            <div className="rail -mx-1 flex gap-1.5 overflow-x-auto px-1">{FILTERS.map((f) => <Seg key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} className={cx('h-9 flex-none px-3.5 text-[13px]', f.key === 'failed' && counts.failed > 0 && filter !== 'failed' && 'text-bad')}>{f.label} · {counts[f.key] ?? 0}</Seg>)}</div>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, family, subject" aria-label="Search emails" className="h-10 w-full rounded-full border border-line bg-bg px-4 text-[13px] outline-none focus:border-pri focus:bg-white" />
          </div>
          <div className="divide-y divide-line">
            {!emails.data && <div className="p-[18px]"><Skeleton className="h-48" /></div>}
            {emails.data && rows.length === 0 && <EmptyState className="m-[18px]" title={q || filter !== 'all' ? 'No emails match' : 'No emails yet'} body={q || filter !== 'all' ? undefined : 'Emails show up here as families apply, Konnectors claim, and follow-ups go out.'} />}
            {rows.map((e) => <EmailRow key={e.id} e={e} />)}
          </div>
        </div>
        <div className="grid gap-3.5 lg:sticky lg:top-6">
          <Panel>
            <PanelTitle>Delivery</PanelTitle>
            {mail ? (
              <div className="mt-3 grid gap-2 text-[13px]">
                <div className="flex items-center gap-2"><span className={cx('size-2 rounded-full', mail.provider === 'resend' ? 'bg-ok' : 'bg-warn')} /><b>{mail.provider === 'resend' ? 'Sending with Resend' : 'Not sending (console mode)'}</b></div>
                <div className="break-all text-ink-3">From {mail.from}</div>
                {mail.provider !== 'resend' && <p className="text-[12px] leading-[1.5] text-ink-3">Add <code className="rounded bg-soft px-1">RESEND_API_KEY</code> and <code className="rounded bg-soft px-1">RESEND_EMAIL</code> to the API environment to send real email. Until then emails are only logged.</p>}
              </div>
            ) : <Skeleton className="mt-3 h-12" />}
          </Panel>
          <TestEmail defaultTo={me.data?.email ?? ''} />
        </div>
      </div>
    </div>
  );
}

function EmailRow({ e }: { e: EmailLogRow }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-w-0">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="grid w-full grid-cols-[1fr_auto] items-start gap-3 px-[18px] py-3.5 text-left transition-colors hover:bg-soft-2/60">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip size="sm" tone={e.audience === 'family' ? 'ok' : e.audience === 'konnector' ? 'soft' : 'neutral'}>{AUDIENCE[e.audience] ?? e.audience}</Chip>
            <span className="text-[12px] font-semibold text-ink-3">{KIND[e.kind] ?? e.kind}</span>
            {!e.ok && <Chip size="sm" tone="bad">Failed</Chip>}
          </div>
          <div className="mt-1 truncate text-[14px] font-bold">{e.subject}</div>
          <div className="truncate text-[12px] text-ink-3">To {e.to || 'no address'}{e.family ? ` · ${e.family.familyId}` : ''}{e.actor && e.actor !== 'system' ? ` · by ${e.actor}` : ''}</div>
        </div>
        <div className="text-right text-[12px] text-ink-3 tabular">{when(e.at)}<div className="mt-1 text-ink-3" aria-hidden>{open ? '▴' : '▾'}</div></div>
      </button>
      {open && (
        <div className="px-[18px] pb-4">
          {!e.ok && e.error && <div className="mb-2.5 rounded-[12px] bg-bad-soft px-3 py-2 text-[13px] text-bad">{e.error}</div>}
          <pre className="max-h-[360px] overflow-auto whitespace-pre-wrap break-words rounded-[14px] bg-bg p-3.5 font-sans text-[13px] leading-[1.55] text-ink-2">{e.body || '(no body saved)'}</pre>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-3">
            {e.family && <Link to={`/admin/families/${e.family.id}`} className="font-semibold text-pri">Open {e.family.nickname} →</Link>}
            {e.sponsorshipId && <span>{e.sponsorshipId}</span>}
            {e.provider && <span>via {e.provider}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

function TestEmail({ defaultTo }: { defaultTo: string }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [to, setTo] = useState<string | null>(null);
  const addr = to ?? defaultTo;
  const send = useMutation({
    mutationFn: () => api.admin.testEmail(addr),
    onSuccess: (r) => { toast(r.ok ? (r.provider === 'resend' ? `Test email sent to ${addr}` : 'Logged only. Email is in console mode.') : `Failed: ${r.error}`, r.ok ? 'ok' : 'bad'); qc.invalidateQueries({ queryKey: ['admin', 'emails'] }); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });
  return (
    <Panel>
      <PanelTitle>Send a test email</PanelTitle>
      <p className="mt-1.5 text-[13px] leading-[1.5] text-ink-3">See exactly what Konnectors and families receive.</p>
      <form className="mt-3 grid gap-2.5" onSubmit={(ev) => { ev.preventDefault(); send.mutate(); }}>
        <Input type="email" required value={addr} onChange={(ev) => setTo(ev.target.value)} placeholder="name@example.com" aria-label="Send test to" />
        <Button type="submit" size="sm" variant="dark" className="h-10" loading={send.isPending}>Send test</Button>
      </form>
    </Panel>
  );
}
