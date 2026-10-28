import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SHOPPING_STATUSES, SPONSORSHIP_STEPS } from '@bless/shared';
import { api, type AdminSponsorship } from '@/lib/api';
import { Button, Chip, Skeleton, Stat, useToast } from '@/components/ui';
import { fmtDate, pct } from '@/lib/format';
import { BarRow, Panel, PanelTitle, PageHead, SubLabel, SpStatusChip } from './shared.tsx';
import { ReleaseSheet } from './FamilyDetail.tsx';

export default function Dashboard() {
  const qc = useQueryClient();
  const toast = useToast();
  const report = useQuery({ queryKey: ['admin', 'report'], queryFn: api.admin.report, refetchInterval: 60_000 });
  const sponsorships = useQuery({ queryKey: ['admin', 'sponsorships'], queryFn: api.admin.sponsorships });
  const families = useQuery({ queryKey: ['admin', 'families'], queryFn: api.admin.families });
  const [releaseOpen, setReleaseOpen] = useState<AdminSponsorship | null>(null);

  const spByCode = useMemo(() => new Map((sponsorships.data ?? []).map((s) => [s.sponsorshipId, s])), [sponsorships.data]);
  const famByCode = useMemo(() => new Map((families.data ?? []).map((f) => [f.familyId, f])), [families.data]);
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const nudge = useMutation({
    mutationFn: (code: string) => { const s = spByCode.get(code); if (!s) throw new Error('Sponsorship not loaded yet'); return api.admin.nudge(s.id); },
    onSuccess: (r) => { toast(r.ok ? `Sent: ${r.subject}` : `Failed: ${r.error}`, r.ok ? 'ok' : 'bad'); invalidate(); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });
  const release = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => api.admin.patchSponsorship(id, { status: 'Released', reason }),
    onSuccess: () => { toast('Family reopened in the catalog', 'ok'); invalidate(); setReleaseOpen(null); },
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
        <div className="grid gap-3.5 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
      </div>
    );
  }
  if (report.isError) return <Panel className="text-center"><div className="font-bold">Couldn't load the report</div><div className="mt-1 text-[13px] text-ink-3">{(report.error as Error).message}</div><Button className="mt-4" onClick={() => report.refetch()}>Try again</Button></Panel>;

  const r = report.data;
  const sp = r.sponsorships;
  const daysLeft = r.deadline.daysLeft;
  const attentionList = r.followUp.overdue;
  const shoppingNow = SHOPPING_STATUSES.reduce((a, s) => a + sp[s], 0);
  const total = Math.max(1, Object.values(r.pipeline).reduce((a, b) => a + b, 0));
  const pipeline = [['Submitted', '#c9b8ff', r.pipeline.Submitted], ['Available', '#6c22dd', r.pipeline.Available], ['Claimed', '#1d1133', r.pipeline.Claimed], ['Fulfilled', '#9b6bff', r.pipeline.Fulfilled]] as const;
  const totalSp = Math.max(1, Object.values(sp).reduce((a, b) => a + b, 0));
  const m = r.matching;
  const funnel = [['Catalog views', m.catalogViews], ['Family views', m.familyViews], ['Claim starts', m.claimStarts], ['Claims', m.claimCompletes]] as const;
  const funnelMax = Math.max(1, m.catalogViews);
  const viewToClaim = m.familyViews ? pct(m.claimCompletes / m.familyViews) : '—';
  const medianClaim = m.medianHoursToClaim == null ? '—' : m.medianHoursToClaim < 48 ? `${Math.round(m.medianHoursToClaim)}h` : `${Math.round(m.medianHoursToClaim / 24)}d`;
  const maxBand = Math.max(1, ...r.children.byAgeBand.map((b) => b.count));
  const sizeRows = m.claimRateBySize.filter((x) => x.available + x.claimed > 0);
  const worst = [...sizeRows].sort((a, b) => a.rate - b.rate)[0];
  const insight = worst && sizeRows.length >= 2
    ? `Families with ${worst.size} are claimed least often (${pct(worst.rate)}). Featuring them first and allowing chip-ins toward them are the two levers that move this.`
    : 'Families with 3+ kids are usually claimed least often. Featuring them first and allowing chip-ins toward them are the two levers that move this.';
  const releaseRow = releaseOpen ? { ...releaseOpen, sponsor: releaseOpen.sponsor } : null;

  return (
    <div className="anim-rise">
      <PageHead title="Dashboard" sub={`Season ${r.season} · ${daysLeft < 0 ? 'drop-off deadline passed' : `${daysLeft} days to drop-off`}`} right={
        <Button variant="dark" size="sm" className="h-10 px-4" onClick={() => run.mutate()} loading={run.isPending}>Run follow-ups now</Button>
      } />

      <div className="mt-[22px] grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <Stat label="Families left" value={r.pipeline.Available} tone="pri" sub={`${r.pipeline.Submitted} awaiting review`} />
        <Stat label="Claimed" value={r.pipeline.Claimed} sub={`${sp['Dropped Off']} dropped off`} />
        <Stat label="Delivered" value={r.pipeline.Fulfilled} sub={`${shoppingNow} shopping now`} />
        <Stat label="Days to drop-off" value={daysLeft < 0 ? 'Past' : daysLeft} tone={daysLeft <= 7 ? 'warn' : undefined} sub={fmtDate(r.deadline.dropoffDeadline, { weekday: 'long', month: 'short', day: 'numeric' })} />
        <Stat label="Response rate" value={r.followUp.nudgesSent ? pct(r.followUp.responseRate) : '—'} sub={`${r.followUp.nudgesSent} nudges sent`} />
        <Stat label="Needs attention" value={attentionList.length} tone={attentionList.length ? 'bad' : 'ok'} sub={`${r.followUp.flagged} flagged · ${r.followUp.dueNext24h} due in 24h`} />
      </div>

      <div className="mt-3.5 grid min-w-0 gap-3.5 lg:grid-cols-2">
        <Panel>
          <PanelTitle>Pipeline</PanelTitle>
          <div className="mt-3.5 flex h-3 gap-0.5 overflow-hidden rounded-full">
            {pipeline.map(([l, c, v]) => <div key={l} className="transition-[width] duration-600" style={{ width: `${Math.max((v / total) * 100, v ? 3 : 0)}%`, background: c }} />)}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-[13px]">
            {pipeline.map(([l, c, v]) => <span key={l} className="flex items-center gap-1.5"><span className="inline-block size-2 rounded-full" style={{ background: c }} />{l} <b>{v}</b></span>)}
          </div>
          <SubLabel className="mt-[22px]">Sponsorship dominoes</SubLabel>
          <div className="mt-2.5 grid gap-2">
            {SPONSORSHIP_STEPS.map((s) => <BarRow key={s.status} label={s.status === 'Dropped Off' ? 'Dropped off' : s.status} pct={(sp[s.status] / totalSp) * 100} value={sp[s.status]} labelW={110} />)}
          </div>
        </Panel>

        <Panel>
          <PanelTitle right={`${r.followUp.dueNext24h} due in next 24h`}>Needs attention</PanelTitle>
          {attentionList.length === 0 ? (
            <div className="mt-3.5 rounded-2xl bg-soft p-5 text-center text-[14px] font-semibold text-pri-dark">Every Holiday Konnector has responded recently. Nothing to chase.</div>
          ) : (
            <div className="mt-2">
              {attentionList.map((a) => {
                const s = spByCode.get(a.sponsorshipId);
                const fam = famByCode.get(a.familyId);
                const flagged = s?.flagged ?? false;
                return (
                  <div key={a.sponsorshipId} className="flex flex-wrap items-center gap-3 border-b border-soft py-3">
                    <div className="min-w-[200px] flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <b className="text-[14px]">{a.sponsorName}</b>
                        <SpStatusChip status={a.status} />
                        {flagged && <Chip tone="bad" size="sm">{a.followUpCount} unanswered · flagged</Chip>}
                      </div>
                      <div className="mt-0.5 text-[12px] text-ink-3">
                        {fam ? <Link to={`/admin/families/${fam.id}`} className="hover:underline">{a.nickname}</Link> : a.nickname} · {a.familyId} · silent {a.daysSilent} days
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" className="h-[34px] px-3 text-[12px]" onClick={() => nudge.mutate(a.sponsorshipId)} loading={nudge.isPending && nudge.variables === a.sponsorshipId} disabled={!s}>Nudge</Button>
                    <Button size="sm" variant="danger" className="h-[34px] px-3 text-[12px]" onClick={() => s && setReleaseOpen(s)} disabled={!s}>Release</Button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-3.5 flex flex-wrap justify-between gap-2 text-[13px]">
            <Link to="/admin/follow-ups" className="font-semibold text-ink hover:text-pri">Open the dominoes board →</Link>
            <span className="text-ink-3">{r.followUp.nudgesSent} nudges · {r.followUp.responses} responses · {r.followUp.nudgesSent ? pct(r.followUp.responseRate) : '—'}</span>
          </div>
        </Panel>
      </div>

      <div className="mt-3.5 grid min-w-0 gap-3.5 lg:grid-cols-2">
        <Panel>
          <PanelTitle>Matching funnel · season</PanelTitle>
          <div className="mt-3.5 grid gap-2.5">
            {funnel.map(([l, v]) => <BarRow key={l} label={l} pct={(v / funnelMax) * 100} value={v} grow />)}
          </div>
          <div className="mt-[18px] grid grid-cols-3 gap-2">
            <Tile label="View → claim" value={viewToClaim} />
            <Tile label="Median to claim" value={medianClaim} />
            <Tile label="Chip-ins" value={`$${m.totalRaised}`} />
          </div>
          <SubLabel className="mt-5">Claim rate by family size</SubLabel>
          <div className="mt-2.5 grid gap-2">
            {m.claimRateBySize.map((x) => <BarRow key={x.size} label={x.size} pct={x.rate * 100} value={x.available + x.claimed ? pct(x.rate) : '—'} color="#c9b8ff" />)}
          </div>
          <p className="mt-3 text-[13px] leading-[1.5] text-ink-2">{insight}</p>
        </Panel>

        <Panel>
          <PanelTitle right="sorted by wait">Families left · {r.familiesLeft.length}</PanelTitle>
          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <div className="grid grid-cols-[1fr_44px_70px_56px_90px] gap-2 border-b border-soft pb-2 pt-3.5 text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3"><span>Family</span><span>Kids</span><span>Waiting</span><span>Views</span><span>Story</span></div>
              {r.familiesLeft.length === 0 && <div className="py-6 text-center text-[13px] text-ink-3">Every approved family has a Holiday Konnector.</div>}
              {r.familiesLeft.map((x) => {
                const fam = famByCode.get(x.familyId);
                const late = x.daysWaiting >= 21;
                return (
                  <div key={x.familyId} className="grid grid-cols-[1fr_44px_70px_56px_90px] items-center gap-2 border-b border-soft py-2.5 text-[13px]">
                    <div className="min-w-0">{fam ? <Link to={`/admin/families/${fam.id}`} className="block truncate font-bold hover:underline">{x.nickname}</Link> : <b className="block truncate">{x.nickname}</b>}<div className="text-[11px] text-ink-3">{x.familyId}{fam ? ` · ${fam.city}` : ''}</div></div>
                    <span className="tabular">{x.childCount}</span>
                    <span className={late ? 'font-bold text-warn' : ''}>{x.daysWaiting}d</span>
                    <span className="tabular">{x.views}</span>
                    <span><Chip size="sm" tone={x.storyApproved ? 'soft' : 'outline'}>{x.storyApproved ? 'Public' : 'Not shown'}</Chip></span>
                  </div>
                );
              })}
            </div>
          </div>
          <SubLabel className="mt-5">Children by age · {r.children.total} kids</SubLabel>
          <div className="mt-2.5 flex h-[90px] items-end gap-2">
            {r.children.byAgeBand.map((b) => (
              <div key={b.band} className="flex h-full flex-1 flex-col items-center justify-end gap-1">
                <b className="text-[12px]">{b.count}</b>
                <div className="w-full rounded-t-[6px] bg-pri transition-[height] duration-500" style={{ height: `${Math.max(6, (b.count / maxBand) * 100)}%` }} />
                <span className="text-[11px] text-ink-3">{b.band}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-ink-2"><b>{r.children.needingCoats}</b> kids asked for a winter coat · <b>{r.children.needingBoots}</b> for boots.</p>
        </Panel>
      </div>

      <ReleaseSheet sp={releaseRow} familyName={releaseOpen?.family?.nickname ?? 'This family'} onClose={() => setReleaseOpen(null)} pending={release.isPending} onConfirm={(reason) => releaseOpen && release.mutate({ id: releaseOpen.id, reason })} />
    </div>
  );
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-[14px] bg-bg p-3">
      <div className="text-[11px] font-semibold text-ink-3">{label}</div>
      <div className="text-[22px] font-extrabold tracking-[-.03em] tabular">{value}</div>
    </div>
  );
}
