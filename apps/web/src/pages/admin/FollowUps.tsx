import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ACTIVE_SPONSORSHIP_STATUSES, STATUS_LABEL } from '@bless/shared';
import { api, type AdminSponsorship } from '@/lib/api';
import { Button, Chip, Dominoes, Skeleton, useToast } from '@/components/ui';
import { cx, fmtDate, pct } from '@/lib/format';
import { NudgeSheet, ReleaseSheet } from './FamilyDetail.tsx';
import { Panel, PageHead, daysSilent } from './shared.tsx';

type Filter = 'attention' | 'active' | 'dropped' | 'delivered' | 'released' | 'all';
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'attention', label: 'Needs attention' }, { key: 'active', label: 'Active' }, { key: 'dropped', label: 'Awaiting delivery' }, { key: 'delivered', label: 'Delivered' }, { key: 'released', label: 'Released' }, { key: 'all', label: 'All' },
];
const isAttention = (s: AdminSponsorship) => ACTIVE_SPONSORSHIP_STATUSES.includes(s.status) && (s.flagged || s.followUpCount >= 1 || (s.lastResponseAt == null && daysSilent(null, s.claimedAt) >= 2));
const matches = (s: AdminSponsorship, f: Filter) =>
  f === 'all' ? true : f === 'attention' ? isAttention(s) : f === 'active' ? ACTIVE_SPONSORSHIP_STATUSES.includes(s.status) : f === 'dropped' ? s.status === 'Dropped Off' : f === 'delivered' ? s.status === 'Delivered' : s.status === 'Released';
const COLS = 'grid-cols-[1.2fr_1.2fr_150px_110px_90px_120px_200px]';

export default function FollowUps() {
  const qc = useQueryClient();
  const toast = useToast();
  const sps = useQuery({ queryKey: ['admin', 'sponsorships'], queryFn: api.admin.sponsorships });
  const report = useQuery({ queryKey: ['admin', 'report'], queryFn: api.admin.report });
  const [filter, setFilter] = useState<Filter>('all');
  const [nudgeOpen, setNudgeOpen] = useState<AdminSponsorship | null>(null);
  const [releaseOpen, setReleaseOpen] = useState<AdminSponsorship | null>(null);
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
  const rows = useMemo(() => (sps.data ?? []).filter((s) => matches(s, filter)).sort((a, b) => Number(b.flagged) - Number(a.flagged) || b.claimedAt.localeCompare(a.claimedAt)), [sps.data, filter]);
  const fu = report.data?.followUp;

  const lastLabel = (s: AdminSponsorship) => {
    if (!s.lastResponseAt) return 'Never';
    const d = Math.floor((Date.now() - new Date(s.lastResponseAt).getTime()) / 86_400_000);
    return d === 0 ? 'Today' : `${d} day${d === 1 ? '' : 's'} ago`;
  };
  const nextLabel = (s: AdminSponsorship) => {
    if (s.flagged) return 'Flagged → human';
    if (!s.nextFollowUpAt) return '—';
    return new Date(s.nextFollowUpAt) <= new Date() ? 'Due now' : fmtDate(s.nextFollowUpAt, { month: 'short', day: 'numeric' });
  };

  return (
    <div className="anim-rise">
      <PageHead title="Dominoes board" sub="Every active sponsorship, where it is, and when the system reaches out next." right={<Button variant="dark" size="sm" className="h-10 px-4" onClick={() => run.mutate()} loading={run.isPending}>Run follow-ups now</Button>} />

      <div className="rail mt-[22px] -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((f) => <Chip key={f.key} size="lg" active={filter === f.key} onClick={() => setFilter(f.key)} tone={f.key === 'attention' && counts.attention > 0 ? 'bad' : 'outline'} className={filter === f.key ? '' : 'bg-white'}>{f.label} <span className="opacity-60">{counts[f.key] ?? 0}</span></Chip>)}
      </div>

      <div className="mt-3.5 overflow-x-auto rounded-[24px] border border-line bg-white px-5 py-1.5">
        <div className={cx('grid min-w-[960px] gap-3 border-b border-soft py-3 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3', COLS)}><span>Sponsor</span><span>Family</span><span>Dominoes</span><span>Last response</span><span>Nudges</span><span>Next follow-up</span><span /></div>
        {sps.isPending && <div className="space-y-2 py-3">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12" />)}</div>}
        {!sps.isPending && rows.length === 0 && <div className="py-8 text-center text-[13px] text-ink-3">{filter === 'attention' ? 'Nothing is stalled. Every active sponsor has responded since their last nudge.' : 'Nothing here.'}</div>}
        {rows.map((s) => (
          <div key={s.id} className={cx('grid min-w-[960px] items-center gap-3 border-b border-soft py-3.5 text-[13px]', COLS)} style={{ background: s.flagged ? '#fdf3f3' : 'transparent' }}>
            <div className="min-w-0"><b className="block truncate">{s.sponsor?.name ?? 'Unknown sponsor'}</b><div className="text-[11px] text-ink-3">{s.sponsor?.preferredContact === 'Text' ? 'SMS' : s.sponsor?.preferredContact === 'Call' ? 'Call' : 'Email'} · {s.sponsorshipId}</div></div>
            <div className="min-w-0">{s.family ? <Link to={`/admin/families/${s.family.id}`} className="block truncate font-bold hover:underline">{s.family.nickname}</Link> : <b>—</b>}<div className="text-[11px] text-ink-3">{s.family ? (s.family.childCount === 1 ? '1 child' : `${s.family.childCount} kids`) : ''}</div></div>
            <div><Dominoes status={s.status} compact /><div className="mt-1 text-[11px] text-ink-3">{STATUS_LABEL[s.status]}</div></div>
            <span className={s.lastResponseAt ? '' : 'text-bad'}>{lastLabel(s)}</span>
            <span><b className={s.flagged ? 'text-bad' : s.followUpCount ? 'text-warn' : ''}>{s.followUpCount}</b> <span className="text-ink-3">unanswered</span></span>
            <span>{nextLabel(s)}</span>
            <div className="flex flex-wrap justify-end gap-1.5">
              {s.status !== 'Delivered' && s.status !== 'Released' && <Button size="xs" variant="secondary" className="h-8 px-2.5" onClick={() => setNudgeOpen(s)}>Nudge</Button>}
              {s.status === 'Dropped Off' && <Button size="xs" className="h-8 px-2.5" onClick={() => { if (window.confirm('Mark gifts delivered to the family?')) patch.mutate({ id: s.id, body: { status: 'Delivered' } }); }}>Delivered</Button>}
              {s.status !== 'Delivered' && s.status !== 'Released' && <Button size="xs" variant="danger" className="h-8 px-2.5" onClick={() => setReleaseOpen(s)}>Release</Button>}
              {s.flagged && <Button size="xs" variant="ghost" className="h-8 px-2.5" onClick={() => patch.mutate({ id: s.id, body: { flagged: false } })}>Unflag</Button>}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-3">
        <Panel><div className="text-[12px] font-semibold text-ink-3">Response rate</div><div className="mt-1.5 text-[38px] font-extrabold leading-[1.1] tracking-[-.04em]">{fu ? (fu.nudgesSent ? pct(fu.responseRate) : '—') : '—'}</div><div className="text-[12px] text-ink-3">{fu?.responses ?? 0} replies to {fu?.nudgesSent ?? 0} nudges</div></Panel>
        <Panel><div className="text-[12px] font-semibold text-ink-3">Median hours to respond</div><div className="mt-1.5 text-[38px] font-extrabold leading-[1.1] tracking-[-.04em]">{fu?.medianHoursToRespond != null ? `${Math.round(fu.medianHoursToRespond)}h` : '—'}</div><div className="text-[12px] text-ink-3">SMS replies ~3× faster than email</div></Panel>
        <Panel dark><div className="text-[12px] font-semibold text-lav">Staff hours saved</div><div className="mt-1.5 text-[38px] font-extrabold leading-[1.1] tracking-[-.04em]">{fu ? `${fu.staffHoursSaved}h` : '—'}</div><div className="text-[12px] opacity-70">at ~10 min per manual follow-up</div></Panel>
      </div>

      <NudgeSheet sp={nudgeOpen} onClose={() => setNudgeOpen(null)} onDone={invalidate} />
      <ReleaseSheet sp={releaseOpen} familyName={releaseOpen?.family?.nickname ?? 'This family'} onClose={() => setReleaseOpen(null)} pending={patch.isPending} onConfirm={(reason) => releaseOpen && patch.mutate({ id: releaseOpen.id, body: { status: 'Released', reason } })} />
    </div>
  );
}
