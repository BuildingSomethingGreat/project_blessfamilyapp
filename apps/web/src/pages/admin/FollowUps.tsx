import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ACTIVE_SPONSORSHIP_STATUSES } from '@bless/shared';
import { api, type AdminSponsorship } from '@/lib/api';
import { Button, Card, Chip, Dominoes, EmptyState, Skeleton, useToast } from '@/components/ui';
import { fmtDateTime, pct, plural, timeAgo } from '@/lib/format';
import { NudgeSheet, ReleaseSheet } from './FamilyDetail.tsx';
import { SpStatusChip, daysSilent , stagger, rise } from './shared.tsx';

type Filter = 'attention' | 'active' | 'dropped' | 'delivered' | 'released' | 'all';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'attention', label: 'Needs attention' }, { key: 'active', label: 'Active' }, { key: 'dropped', label: 'Awaiting delivery' }, { key: 'delivered', label: 'Delivered' }, { key: 'released', label: 'Released' }, { key: 'all', label: 'All' },
];
const isAttention = (s: AdminSponsorship) => ACTIVE_SPONSORSHIP_STATUSES.includes(s.status) && (s.flagged || daysSilent(s.lastResponseAt, s.claimedAt) >= 3);
const matches = (s: AdminSponsorship, f: Filter) =>
  f === 'all' ? true : f === 'attention' ? isAttention(s) : f === 'active' ? ACTIVE_SPONSORSHIP_STATUSES.includes(s.status) : f === 'dropped' ? s.status === 'Dropped Off' : f === 'delivered' ? s.status === 'Delivered' : s.status === 'Released';

export default function FollowUps() {
  const qc = useQueryClient();
  const toast = useToast();
  const sps = useQuery({ queryKey: ['admin', 'sponsorships'], queryFn: api.admin.sponsorships });
  const report = useQuery({ queryKey: ['admin', 'report'], queryFn: api.admin.report });
  const [filter, setFilter] = useState<Filter>('attention');
  const [nudgeOpen, setNudgeOpen] = useState<AdminSponsorship | null>(null);
  const [releaseOpen, setReleaseOpen] = useState<AdminSponsorship | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.admin.patchSponsorship>[1] }) => api.admin.patchSponsorship(id, body),
    onSuccess: () => { toast('Updated', 'ok'); invalidate(); setReleaseOpen(null); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });
  const run = useMutation({
    mutationFn: api.admin.runFollowUps,
    onSuccess: (r) => { toast(`Follow-ups: ${r.sent} sent · ${r.flagged} flagged · ${r.skipped} skipped`, 'ok'); invalidate(); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, (sps.data ?? []).filter((s) => matches(s, f.key)).length])) as Record<Filter, number>, [sps.data]);
  const rows = useMemo(() => (sps.data ?? []).filter((s) => matches(s, filter)).sort((a, b) => {
    if (filter === 'attention' || filter === 'active') return daysSilent(b.lastResponseAt, b.claimedAt) - daysSilent(a.lastResponseAt, a.claimedAt);
    return b.claimedAt.localeCompare(a.claimedAt);
  }), [sps.data, filter]);
  const fu = report.data?.followUp;

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={rise} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-tight text-3xl sm:text-4xl">Follow-ups</h1>
          <p className="mt-1 text-sm text-ink-3">Every claimed family, and where its sponsor is on the path to delivery.</p>
        </div>
        <Button variant="dark" size="sm" onClick={() => run.mutate()} loading={run.isPending}>Run follow-ups now</Button>
      </motion.div>

      <motion.div variants={rise} className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        <Metric label="Active" value={fu?.activeSponsorships ?? '—'} />
        <Metric label="Nudges sent" value={fu?.nudgesSent ?? '—'} />
        <Metric label="Response rate" value={fu ? (fu.nudgesSent ? pct(fu.responseRate) : '—') : '—'} />
        <Metric label="Median reply" value={fu?.medianHoursToRespond != null ? `${Math.round(fu.medianHoursToRespond)}h` : '—'} />
        <Metric label="Flagged" value={fu?.flagged ?? '—'} tone={fu && fu.flagged > 0 ? 'bad' : undefined} />
        <Metric label="Released" value={fu?.released ?? '—'} />
      </motion.div>

      <motion.div variants={rise}>
        <button onClick={() => setPolicyOpen((v) => !v)} className="flex w-full items-center justify-between rounded-2xl border border-line/70 bg-paper px-4 py-3 text-left text-sm font-medium hover:border-ink-3">
          <span>How automatic follow-up works</span><span className="text-ink-3">{policyOpen ? '−' : '+'}</span>
        </button>
        {policyOpen && (
          <ol className="mt-2 grid gap-2 rounded-2xl bg-cream-2/70 p-4 text-sm text-ink-2 sm:grid-cols-2">
            <li><span className="font-semibold">1. Claim.</span> The sponsor immediately gets the family's wishlist and a one-tap status link.</li>
            <li><span className="font-semibold">2. 48 hours.</span> If they haven't tapped "I'm in", we ask them to confirm or release.</li>
            <li><span className="font-semibold">3. Check-ins.</span> Confirmed sponsors hear from us every 5 days, every 3 days in the final week, daily in the last 2 days; reminders land 7, 3 and 1 day before drop-off.</li>
            <li><span className="font-semibold">4. Any reply resets the clock.</span> Tapping a status or leaving a note counts as a response.</li>
            <li><span className="font-semibold">5. Flagged for a human.</span> After 2 unanswered nudges the sponsorship shows up here. The system never releases a family on its own; that's your call.</li>
          </ol>
        )}
      </motion.div>

      <motion.div variants={rise} className="rail -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((f) => <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} tone={f.key === 'attention' && counts.attention > 0 ? 'bad' : 'neutral'}>{f.label} <span className="opacity-60">{counts[f.key] ?? 0}</span></Chip>)}
      </motion.div>

      {sps.isPending ? <div className="space-y-3">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        : rows.length === 0 ? <EmptyState title={filter === 'attention' ? 'Nobody needs chasing right now' : 'Nothing here'} body={filter === 'attention' ? 'Every active sponsor has responded in the last 3 days.' : undefined} />
        : (
          <motion.ul variants={rise} className="space-y-3">
            {rows.map((s) => {
              const silent = daysSilent(s.lastResponseAt, s.claimedAt);
              const attention = isAttention(s);
              return (
                <li key={s.id}>
                  <Card className={`p-4 sm:p-5 ${attention ? 'border-bad/30' : ''}`}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-lg font-semibold">{s.sponsor?.name ?? 'Unknown sponsor'}</span>
                          <SpStatusChip status={s.status} />
                          {s.flagged && <Chip tone="bad">🚩 {s.flagReason || 'Flagged'}</Chip>}
                        </div>
                        <div className="mt-0.5 text-sm text-ink-3">
                          {s.family ? <Link to={`/admin/families/${s.family.id}`} className="font-medium text-ink-2 hover:underline">{s.family.nickname}</Link> : '—'}
                          {s.family && <> · {plural(s.family.childCount, 'child', 'children')} · {s.family.familyId}</>} · {s.sponsorshipId}
                        </div>
                      </div>
                      <div className="w-full sm:w-auto"><Dominoes status={s.status} compact /></div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                      <span className={attention ? 'font-semibold text-bad' : 'text-ink-2'}>{s.lastResponseAt ? `last heard ${timeAgo(s.lastResponseAt)}` : s.status === 'Released' || s.status === 'Delivered' ? '' : `no reply yet · claimed ${timeAgo(s.claimedAt)}`}{ACTIVE_SPONSORSHIP_STATUSES.includes(s.status) && silent >= 3 ? ` (${plural(silent, 'day')} silent)` : ''}</span>
                      {s.nextFollowUpAt && <span className="text-ink-3">next follow-up {fmtDateTime(s.nextFollowUpAt)}</span>}
                      <span className="text-ink-3">{plural(s.followUpCount, 'nudge')}</span>
                      {s.releaseReason && <span className="text-ink-3">released: {s.releaseReason}</span>}
                    </div>
                    {s.status !== 'Delivered' && s.status !== 'Released' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setNudgeOpen(s)}>Nudge</Button>
                        {s.status === 'Dropped Off' && <Button size="sm" variant="pine" onClick={() => { if (window.confirm('Mark gifts delivered to the family?')) patch.mutate({ id: s.id, body: { status: 'Delivered' } }); }}>Mark delivered</Button>}
                        {s.flagged && <Button size="sm" variant="ghost" onClick={() => patch.mutate({ id: s.id, body: { flagged: false } })}>Unflag</Button>}
                        <Button size="sm" variant="danger" onClick={() => setReleaseOpen(s)}>Release</Button>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </motion.ul>
        )}

      <NudgeSheet sp={nudgeOpen} onClose={() => setNudgeOpen(null)} onDone={invalidate} />
      <ReleaseSheet sp={releaseOpen} familyName={releaseOpen?.family?.nickname ?? 'This family'} onClose={() => setReleaseOpen(null)} pending={patch.isPending} onConfirm={(reason) => releaseOpen && patch.mutate({ id: releaseOpen.id, body: { status: 'Released', reason } })} />
    </motion.div>
  );
}

function Metric({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'bad' }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-paper px-3.5 py-3 shadow-soft">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className={`display mt-0.5 text-2xl tabular-nums ${tone === 'bad' ? 'text-bad' : ''}`}>{value}</div>
    </div>
  );
}
