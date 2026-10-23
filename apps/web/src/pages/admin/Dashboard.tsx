import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { api } from '@/lib/api';
import { Button, Card, Chip, EmptyState, Skeleton, Stat, useToast } from '@/components/ui';
import { Bars, HBars, Line, Stack } from '@/components/charts';
import { fmtDate, pct, plural, timeAgo } from '@/lib/format';
import { SectionTitle, SpStatusChip , stagger, rise } from './shared.tsx';

export default function Dashboard() {
  const qc = useQueryClient();
  const toast = useToast();
  const report = useQuery({ queryKey: ['admin', 'report'], queryFn: api.admin.report, refetchInterval: 60_000 });
  const sponsorships = useQuery({ queryKey: ['admin', 'sponsorships'], queryFn: api.admin.sponsorships });
  const families = useQuery({ queryKey: ['admin', 'families'], queryFn: api.admin.families });
  const [series, setSeries] = useState<'claims' | 'views'>('claims');

  const spByCode = useMemo(() => new Map((sponsorships.data ?? []).map((s) => [s.sponsorshipId, s])), [sponsorships.data]);
  const famByCode = useMemo(() => new Map((families.data ?? []).map((f) => [f.familyId, f])), [families.data]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const nudge = useMutation({
    mutationFn: (code: string) => { const s = spByCode.get(code); if (!s) throw new Error('Sponsorship not loaded yet'); return api.admin.nudge(s.id); },
    onSuccess: (r) => { toast(r.ok ? `Sent: ${r.subject}` : `Failed: ${r.error}`, r.ok ? 'ok' : 'bad'); invalidate(); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });
  const run = useMutation({
    mutationFn: api.admin.runFollowUps,
    onSuccess: (r) => { toast(`Follow-ups: ${r.sent} sent · ${r.flagged} flagged · ${r.skipped} skipped`, 'ok'); invalidate(); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });

  if (report.isPending) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-10 w-56" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">{[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28" />)}</div>
        <div className="grid gap-5 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
      </div>
    );
  }
  if (report.isError) return <EmptyState title="Couldn't load the report" body={(report.error as Error).message} action={<Button onClick={() => report.refetch()}>Try again</Button>} />;

  const r = report.data;
  const attention = r.followUp.overdue.length;
  const daysLeft = r.deadline.daysLeft;
  const f = r.matching;
  const funnel = [
    { label: 'Catalog views', value: f.catalogViews },
    { label: 'Family views', value: f.familyViews },
    { label: 'Claim starts', value: f.claimStarts },
    { label: 'Claims', value: f.claimCompletes },
  ];
  const sizeRows = r.matching.claimRateBySize.filter((x) => x.available + x.claimed > 0);
  const bestSize = [...sizeRows].sort((a, b) => b.rate - a.rate)[0];
  const worstSize = [...sizeRows].sort((a, b) => a.rate - b.rate)[0];
  const insight = sizeRows.length >= 2 && bestSize && worstSize && bestSize.size !== worstSize.size
    ? `${worstSize.size} families are claimed least often (${pct(worstSize.rate)}) — ${bestSize.size} families most (${pct(bestSize.rate)}).`
    : 'Not enough claims yet to compare family sizes.';
  const lineData = r.matching.claimsByDay.map((d) => ({ label: d.date, sub: fmtDate(d.date), value: series === 'claims' ? d.claims : d.views }));

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={rise} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-tight text-3xl sm:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-ink-3">Season {r.season} · updated {timeAgo(r.generatedAt)}{report.isFetching ? ' · refreshing…' : ''}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => report.refetch()} loading={report.isFetching}>Refresh</Button>
          <Button variant="dark" size="sm" onClick={() => run.mutate()} loading={run.isPending}>Run follow-ups now</Button>
        </div>
      </motion.div>

      {/* KPIs */}
      <motion.div variants={rise} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Families left" value={r.pipeline.Available} tone="ember" sub={`${r.pipeline.Submitted} awaiting review`} small />
        <Stat label="Claimed" value={r.pipeline.Claimed} sub={`${r.sponsorships['Dropped Off']} dropped off`} small />
        <Stat label="Delivered" value={r.pipeline.Fulfilled} tone="pine" sub={`${r.sponsorships.Released} released`} small />
        <Stat label="Days to drop-off" value={daysLeft < 0 ? 'Past' : daysLeft} tone={daysLeft <= 7 ? 'warn' : 'ink'} sub={fmtDate(r.deadline.dropoffDeadline, { month: 'long', day: 'numeric' })} small />
        <Stat label="Response rate" value={r.followUp.nudgesSent ? pct(r.followUp.responseRate) : '—'} sub={r.followUp.medianHoursToRespond != null ? `median ${Math.round(r.followUp.medianHoursToRespond)}h to reply` : `${r.followUp.nudgesSent} nudges sent`} small />
        <Stat label="Needs attention" value={attention} tone={attention > 0 ? 'bad' : 'pine'} sub={`${r.followUp.flagged} flagged · ${r.followUp.dueNext24h} due in 24h`} small />
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Pipeline */}
        <motion.div variants={rise} className="lg:col-span-2">
          <Card className="h-full p-5">
            <SectionTitle>Pipeline</SectionTitle>
            <Stack parts={[
              { label: 'Submitted', value: r.pipeline.Submitted, color: 'var(--color-s1)' },
              { label: 'Needs info', value: r.pipeline['Needs Info'], color: 'var(--color-s2)' },
              { label: 'Available', value: r.pipeline.Available, color: 'var(--color-s3)' },
              { label: 'Claimed', value: r.pipeline.Claimed, color: 'var(--color-s4)' },
              { label: 'Fulfilled', value: r.pipeline.Fulfilled, color: 'var(--color-s5)' },
            ]} />
            <div className="mt-6 text-[13px] font-medium text-ink-3">Sponsorship dominoes</div>
            <HBars className="mt-3" data={[
              { label: 'Claimed', value: r.sponsorships.Claimed }, { label: 'Confirmed', value: r.sponsorships.Confirmed }, { label: 'Shopping', value: r.sponsorships.Shopping },
              { label: 'Dropped off', value: r.sponsorships['Dropped Off'] }, { label: 'Delivered', value: r.sponsorships.Delivered },
            ]} />
          </Card>
        </motion.div>

        {/* Needs attention */}
        <motion.div variants={rise} className="lg:col-span-3">
          <Card className="h-full p-5">
            <SectionTitle right={<span className="text-sm text-ink-3">{r.followUp.dueNext24h} follow-ups due in the next 24h</span>}>Needs attention</SectionTitle>
            {r.followUp.overdue.length === 0 ? (
              <div className="rounded-2xl bg-pine-soft px-4 py-6 text-center text-sm font-medium text-pine">Every sponsor has responded recently. Nothing to chase.</div>
            ) : (
              <ul className="divide-y divide-line/70">
                {r.followUp.overdue.map((o) => {
                  const fam = famByCode.get(o.familyId);
                  return (
                    <li key={o.sponsorshipId} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{o.sponsorName}</span>
                          <SpStatusChip status={o.status} />
                          {o.followUpCount >= 2 && <Chip tone="bad">{o.followUpCount} unanswered</Chip>}
                        </div>
                        <div className="mt-0.5 text-sm text-ink-3">
                          {fam ? <Link to={`/admin/families/${fam.id}`} className="font-medium text-ink-2 underline-offset-2 hover:underline">{o.nickname}</Link> : o.nickname} · {o.familyId} · silent {plural(o.daysSilent, 'day')}
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => nudge.mutate(o.sponsorshipId)} loading={nudge.isPending && nudge.variables === o.sponsorshipId} disabled={!spByCode.has(o.sponsorshipId)}>Nudge</Button>
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="mt-4 flex items-center justify-between text-sm">
              <Link to="/admin/follow-ups" className="font-medium text-ember hover:underline">Open the dominoes board →</Link>
              <span className="text-ink-3">{r.followUp.nudgesSent} nudges · {r.followUp.responses} responses</span>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Matching */}
      <motion.div variants={rise}>
        <Card className="p-5">
          <SectionTitle right={
            <div className="flex gap-1.5">
              <Chip active={series === 'claims'} onClick={() => setSeries('claims')}>Claims</Chip>
              <Chip active={series === 'views'} onClick={() => setSeries('views')}>Views</Chip>
            </div>
          }>Matching · last 30 days</SectionTitle>
          <div className="grid gap-6 lg:grid-cols-5">
            <div className="lg:col-span-3">
              <Line data={lineData} height={170} color={series === 'claims' ? 'var(--color-s1)' : 'var(--color-s2)'} format={(v) => `${v} ${series === 'claims' ? 'claim' : 'view'}${v === 1 ? '' : 's'}`} />
              <div className="mt-1 flex justify-between text-xs text-ink-3"><span>{fmtDate(lineData[0]?.label)}</span><span>{fmtDate(lineData[lineData.length - 1]?.label)}</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Mini label="Median time to claim" value={f.medianHoursToClaim == null ? '—' : f.medianHoursToClaim < 48 ? `${Math.round(f.medianHoursToClaim)}h` : `${Math.round(f.medianHoursToClaim / 24)}d`} />
                <Mini label="Claims" value={f.claimCompletes} />
                <Mini label="Family views" value={f.familyViews} />
                <Mini label="View → claim" value={f.familyViews ? pct(f.claimCompletes / f.familyViews) : '—'} />
              </div>
            </div>
            <div className="space-y-6 lg:col-span-2">
              <div>
                <div className="text-[13px] font-medium text-ink-3">Funnel</div>
                <HBars className="mt-3" data={funnel} max={Math.max(1, funnel[0].value)} />
              </div>
              <div>
                <div className="text-[13px] font-medium text-ink-3">Claim rate by family size</div>
                <HBars className="mt-3" data={r.matching.claimRateBySize.map((x) => ({ label: x.size, value: x.rate, sub: `${x.claimed} of ${x.available + x.claimed}` }))} max={1} format={pct} color="var(--color-s3)" />
                <p className="mt-3 text-sm text-ink-2">{insight}</p>
              </div>
            </div>
          </div>
        </Card>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-5">
        {/* Families left */}
        <motion.div variants={rise} className="lg:col-span-3">
          <Card className="p-5">
            <SectionTitle right={<Link to="/admin/families" className="text-sm font-medium text-ember hover:underline">All families →</Link>}>Families left · {r.familiesLeft.length}</SectionTitle>
            {r.familiesLeft.length === 0 ? <EmptyState title="Every approved family has a sponsor" /> : (
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead><tr className="text-left text-xs font-semibold uppercase tracking-wider text-ink-3"><th className="pb-2 font-semibold">Family</th><th className="pb-2 font-semibold">Kids</th><th className="pb-2 font-semibold">Waiting</th><th className="pb-2 font-semibold">Views</th><th className="pb-2 font-semibold">Story</th></tr></thead>
                  <tbody className="divide-y divide-line/70">
                    {r.familiesLeft.map((x) => {
                      const fam = famByCode.get(x.familyId);
                      return (
                        <tr key={x.familyId} className="group">
                          <td className="py-2.5 pr-3">
                            {fam ? <Link to={`/admin/families/${fam.id}`} className="font-semibold group-hover:underline">{x.nickname}</Link> : <span className="font-semibold">{x.nickname}</span>}
                            <div className="text-xs text-ink-3">{x.familyId}</div>
                          </td>
                          <td className="py-2.5 pr-3 tabular-nums">{x.childCount}</td>
                          <td className="py-2.5 pr-3 tabular-nums"><span className={x.daysWaiting >= 21 ? 'font-semibold text-warn' : ''}>{plural(x.daysWaiting, 'day')}</span></td>
                          <td className="py-2.5 pr-3 tabular-nums">{x.views}</td>
                          <td className="py-2.5">{x.storyApproved ? <Chip tone="pine">Public</Chip> : <Chip tone="neutral">Not shown</Chip>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

        <motion.div variants={rise} className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <SectionTitle>Top viewed, still unclaimed</SectionTitle>
            {r.matching.topViewedUnclaimed.length === 0 ? <p className="text-sm text-ink-3">No unclaimed families.</p> : (
              <ul className="space-y-3">
                {r.matching.topViewedUnclaimed.map((x, i) => {
                  const fam = famByCode.get(x.familyId);
                  return (
                    <li key={x.familyId} className="flex items-center gap-3 text-sm">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cream-2 text-xs font-bold text-ink-2">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        {fam ? <Link to={`/admin/families/${fam.id}`} className="block truncate font-semibold hover:underline">{x.nickname}</Link> : <span className="block truncate font-semibold">{x.nickname}</span>}
                        <span className="text-xs text-ink-3">{x.views} views · {x.claimStarts} started a claim</span>
                      </div>
                      <a className="text-xs font-medium text-ember hover:underline" href={`/families/${x.slug}`} target="_blank" rel="noreferrer">Public page</a>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <SectionTitle right={<span className="text-sm text-ink-3">{plural(r.children.total, 'child', 'children')}</span>}>Children by age</SectionTitle>
            <Bars data={r.children.byAgeBand.map((b) => ({ label: b.band, value: b.count, sub: `ages ${b.band}` }))} height={110} format={(v) => plural(v, 'child', 'children')} />
            <div className="mt-1 grid text-center text-xs text-ink-3" style={{ gridTemplateColumns: `repeat(${r.children.byAgeBand.length}, 1fr)` }}>{r.children.byAgeBand.map((b) => <span key={b.band}>{b.band}</span>)}</div>
            <p className="mt-3 text-sm text-ink-2"><span className="font-semibold">{r.children.needingCoats}</span> kids asked for a winter coat.</p>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-cream-2/70 px-3.5 py-3">
      <div className="text-[12px] font-medium text-ink-3">{label}</div>
      <div className="display mt-0.5 text-xl tabular-nums">{value}</div>
    </div>
  );
}
