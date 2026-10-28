import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { SponsorshipStatus } from '@bless/shared';
import { api, ApiError, setSponsorToken } from '@/lib/api';
import { Checkbox, Dominoes, Select, Sheet, Skeleton, useToast } from '@/components/ui';
import { cx, fmtDate, fmtDateTime } from '@/lib/format';
import { GIFT_RULES, KidMini, shell, wrap } from './shared.tsx';
import { ShareForm } from './Share.tsx';

const REASONS = ["Can't afford it right now", 'Travel or timing', 'Other'];

export default function SponsorPortal() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['portal', token], queryFn: () => api.sponsor.get(token), retry: false });
  const [releaseOpen, setReleaseOpen] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [note, setNote] = useState('');
  const advance = useMutation({
    mutationFn: (to: SponsorshipStatus) => api.sponsor.status(token, to),
    onSuccess: (data) => { qc.setQueryData(['portal', token], data); toast('Updated. Our reminders reset.', 'ok'); },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Could not update', 'bad'),
  });
  const release = useMutation({
    mutationFn: () => api.sponsor.status(token, 'Released', '', reason),
    onSuccess: (data) => { qc.setQueryData(['portal', token], data); setSponsorToken(null); setReleaseOpen(false); toast('Family reopened. Thank you for telling us.'); },
    onError: (e) => toast(e instanceof ApiError ? e.message : 'Could not update', 'bad'),
  });
  const wall = useMutation({
    mutationFn: (body: { optIn: boolean; displayName: string }) => api.sponsor.wall(token, body.optIn, body.displayName),
    onSuccess: (data) => { qc.setQueryData(['portal', token], data); toast(data.sponsor.wallOptIn ? 'You’re on the wall once your gifts are in.' : 'Removed from the wall.', 'ok'); },
  });
  const [wallName, setWallName] = useState<string | null>(null);
  const sendNote = useMutation({
    mutationFn: () => api.sponsor.note(token, note),
    onSuccess: (data) => { qc.setQueryData(['portal', token], data); setNote(''); toast('Note sent to the team.', 'ok'); },
  });

  if (q.error instanceof ApiError && q.error.status === 404) {
    return (
      <div className={`${shell} anim-rise`}><div className="mx-auto my-16 max-w-[520px] text-center"><h1 className="text-[40px] font-extrabold tracking-[-.045em]">That link isn't valid.</h1><p className="mt-2.5 text-[15px] text-ink-2">Check the email we sent you, or claim a family to get a new one.</p><Link to="/families" className="mt-[22px] inline-flex h-[50px] items-center rounded-full bg-pri px-6 text-[15px] font-semibold text-white">Find a family</Link></div></div>
    );
  }
  const v = q.data;
  if (!v) return <div className={shell}><div className={wrap}><Skeleton className="mt-6 h-14 w-2/3" /><div className="mt-7 grid gap-5 md:grid-cols-2"><Skeleton className="h-[420px]" /><Skeleton className="h-[420px]" /></div></div></div>;

  const { sponsorship: sp, family: f, settings: s, sponsor } = v;
  const first = sponsor.name.split(' ')[0];
  const deadline = fmtDate(s.dropoffDeadline, { weekday: 'short', month: 'short', day: 'numeric' });
  const daysLeft = Math.max(0, Math.round((new Date(s.dropoffDeadline + 'T00:00:00').getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000));
  const direct = sp.handoff === 'Deliver directly';
  const actions: Record<SponsorshipStatus, { title: string; body: string; cta?: string; to?: SponsorshipStatus }> = {
    Claimed: { title: 'Shop at your own pace.', body: `Every size and wish is on this page. When you start shopping, tap once so our team can plan deliveries. Gifts are due by ${deadline}.`, cta: "I've started shopping", to: 'Shopping' },
    Shopping: { title: 'How is the list coming?', body: `Tap when everything for ${f.kidNames} is bought. Please get the same number of gifts for each child. ${daysLeft} days to go.`, cta: 'Gifts purchased', to: 'Purchased' },
    Purchased: { title: 'Wrap and label.', body: "Wrap every gift and label it with the child's name. Tuck a gift receipt in with each clothing item in case it doesn't fit.", cta: 'Wrapped & labeled', to: 'Wrapped' },
    Wrapped: direct
      ? { title: 'Ready to deliver?', body: `Our team will contact you to arrange delivery to ${f.nickname} before ${deadline}. Tap below once the gifts are with the family.`, cta: 'Gifts delivered to the family', to: 'Dropped Off' }
      : { title: 'Ready to drop off?', body: `${s.dropoffLocation}, ${s.dropoffHours}, by ${deadline}. Then tap below and you're done.`, cta: 'Gifts dropped off', to: 'Dropped Off' },
    'Dropped Off': direct
      ? { title: 'Thank you, Holiday Konnector.', body: `We'll confirm with ${f.nickname} and let you know once everything is settled.` }
      : { title: "We've got them. Thank you.", body: `Delivery to ${f.nickname} is being scheduled. We'll let you know the moment it lands.` },
    Delivered: { title: 'Delivered. You did that.', body: `${f.nickname} received the gifts you chose. Thank you for being a Holiday Konnector.` },
    Released: { title: 'This family was reopened.', body: `${f.nickname} is back in the catalog so another Holiday Konnector can step in. Thank you for letting us know.` },
  };
  const act = actions[sp.status];
  const terminal = sp.status === 'Dropped Off' || sp.status === 'Delivered' || sp.status === 'Released';
  const canRelease = !terminal;
  const thread = [...v.timeline].filter((m) => m.type === 'message_sent' || m.type === 'sponsor_response').reverse();

  return (
    <div className={`${shell} anim-rise`}>
      <div className={wrap}>
        <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">Holiday Konnector · your family page · {sp.sponsorshipId}</div>
        <h1 className="mt-2 max-w-[900px] text-[clamp(34px,5vw,60px)] font-extrabold leading-none tracking-[-.045em]">Hi {first}, you're blessing <span className="text-pri">{f.nickname}</span>.</h1>
        <div className="mt-2.5 text-[15px] text-ink-2">{f.kidLine}: {f.kidNames} · {f.city}</div>
        <div className="mt-7 grid items-start gap-5 md:grid-cols-2">
          <div className="grid gap-3.5">
            <div className="rounded-xl3 border border-line bg-white p-6">
              <Dominoes status={sp.status} deadlineLabel={deadline} handoffLabel={direct ? 'Delivered by you' : `Dropped off at ${s.dropoffLocation}`} dates={{ Claimed: sp.claimedAt, Shopping: sp.shoppingAt, Purchased: sp.purchasedAt, Wrapped: sp.wrappedAt, 'Dropped Off': sp.droppedOffAt, Delivered: sp.deliveredAt }} />
            </div>
            <div className={cx('rounded-xl3 p-7', terminal ? 'bg-soft text-pri-dark' : 'bg-ink text-white')} style={{ animation: 'rise .5s .1s both cubic-bezier(.16,1,.3,1)' }}>
              <h2 className={cx('text-[28px] tracking-[-.04em]', terminal ? 'text-pri-dark' : 'text-white')}>{act.title}</h2>
              <p className="mt-2.5 text-[15px] leading-[1.5] opacity-85">{act.body}</p>
              {act.cta && act.to && (
                <>
                  <button onClick={() => advance.mutate(act.to!)} disabled={advance.isPending} className="mt-[18px] h-[54px] w-full rounded-full bg-lav text-base font-bold text-ink transition-colors hover:bg-white disabled:opacity-60">{advance.isPending ? 'Saving…' : act.cta}</button>
                  <div className="mt-2.5 text-center text-[12px] opacity-60">One tap. Resets our reminders.</div>
                </>
              )}
              {sp.status === 'Released' && <Link to="/families" className="mt-[18px] inline-flex h-12 items-center rounded-full bg-pri px-5 text-[15px] font-semibold text-white">Find a family</Link>}
            </div>
            {canRelease && <div className="text-center text-[13px] text-ink-3">Something changed? <button onClick={() => setReleaseOpen(true)} className="font-semibold text-ink">I can no longer sponsor</button></div>}
            <div className="rounded-xl3 border border-line bg-white p-5">
              <h3 className="text-[15px]">Wall of Holiday Konnectors</h3>
              <p className="mt-1 text-[13px] leading-[1.5] text-ink-3">We thank Konnectors by name on the home page once their gifts are handed off.</p>
              <div className="mt-3"><Checkbox checked={sponsor.wallOptIn} onChange={(v) => wall.mutate({ optIn: v, displayName: wallName ?? sponsor.displayName })}>Show my name on the wall</Checkbox></div>
              {sponsor.wallOptIn && (
                <div className="mt-2.5 flex gap-2">
                  <input value={wallName ?? sponsor.displayName} onChange={(e) => setWallName(e.target.value.slice(0, 80))} placeholder={`${first} ${sponsor.name.split(' ').at(-1)?.[0] ?? ''}.`} aria-label="Name to show on the wall" className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-[14px] outline-none focus:border-pri focus:bg-white" />
                  <button onClick={() => wall.mutate({ optIn: true, displayName: wallName ?? sponsor.displayName })} disabled={wall.isPending || wallName === null || wallName === sponsor.displayName} className="h-10 rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold disabled:opacity-50">Save</button>
                </div>
              )}
            </div>
          </div>
          <div className="grid gap-3.5">
            <div className="rounded-xl3 border border-line bg-white p-6">
              <div className="flex items-baseline justify-between"><h2 className="text-[20px]">Check-ins</h2><span className="text-[12px] text-ink-3">via {sponsor.preferredContact === 'Text' ? 'SMS' : 'Email'}</span></div>
              <div className="mt-3.5 grid gap-2.5">
                {thread.length === 0 && <div className="text-[13px] text-ink-3">Your first check-in lands shortly after claiming.</div>}
                {thread.map((m, i) => {
                  const mine = m.type === 'sponsor_response';
                  return (
                    <div key={i} className={cx('anim-bubble flex flex-col', mine ? 'items-end' : 'items-start')}>
                      <div className={cx('max-w-[92%] px-3.5 py-3 text-[14px] leading-[1.5] whitespace-pre-line', mine ? 'rounded-[18px_18px_4px_18px] bg-lav text-ink' : 'rounded-[18px_18px_18px_4px] bg-bg text-ink')}>{mine ? m.subject.replace(/^(Sponsor|Konnector) marked: /, '') + (m.body ? ` — ${m.body}` : '') : m.body || m.subject}</div>
                      <div className="mt-1 text-[11px] text-ink-3">{fmtDateTime(m.occurredAt)} · {m.channel} · {mine ? 'you' : 'automated'}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl3 bg-soft p-6">
              <h3 className="text-[17px]">{direct ? 'Gift hand-off' : 'Drop-off'}</h3>
              <div className="mt-3 grid grid-cols-2 gap-3 text-[14px]">
                {(direct ? [['Deadline', deadline, true], ['How', 'You deliver to the family', true], ['Next', 'Our team will contact you to arrange it', false]] : [['Deadline', deadline, true], ['Where', s.dropoffLocation, true], ['Hours', s.dropoffHours, false]]).map(([l, v2, b]) => <div key={String(l)}><div className="text-[10px] font-semibold uppercase tracking-[.08em] text-pri-dark">{l}</div><div className={b ? 'font-semibold' : ''}>{v2}</div></div>)}
              </div>
              <ul className="mt-3.5 grid gap-1.5 border-t border-pri/10 pt-3 text-[13px] leading-[1.45] text-ink-2">{GIFT_RULES.map((r) => <li key={r} className="flex gap-2"><span className="text-pri">✓</span>{r}</li>)}</ul>
            </div>
            <div className="grid gap-3">{f.children.map((k, i) => <KidMini key={k.name + i} k={k} />)}</div>
            <div className="rounded-xl3 border border-line bg-white p-5">
              <h3 className="text-[15px]">Leave a note for the team</h3>
              <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))} placeholder="Running a few days late, dropping off Monday." className="mt-2.5 min-h-20 w-full resize-none rounded-[14px] border border-line bg-bg px-3.5 py-3 text-[14px] outline-none focus:border-pri focus:bg-white" />
              <button onClick={() => sendNote.mutate()} disabled={!note.trim() || sendNote.isPending} className="mt-2.5 h-9 rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold disabled:opacity-50">Send note</button>
            </div>
            {(sp.status === 'Dropped Off' || sp.status === 'Delivered') && (
              <div className="rounded-xl3 border border-line bg-white p-5"><h3 className="text-[15px]">Share a few words?</h3><p className="mt-1 text-[13px] leading-[1.5] text-ink-3">How did it feel to bless {f.nickname}? With your OK we may feature it to inspire next year's Konnectors.</p><div className="mt-3"><ShareForm token={token} compact defaults={{ name: sponsor.displayName || sponsor.name, role: 'Holiday Konnector' }} /></div></div>
            )}
            <div className="text-[12px] text-ink-3">Tip: add this page to your home screen (Share → Add to Home Screen) so it's one tap away. Your link stays private.</div>
          </div>
        </div>
      </div>
      <Sheet open={releaseOpen} onClose={() => setReleaseOpen(false)} title="Release this family?">
        <p className="text-[15px] leading-[1.5] text-ink-2">We understand that plans can change. We'll reopen {f.nickname} right away so another Holiday Konnector can step in. If you can, please let us know at least 10 days before the gift deadline.</p>
        <div className="mt-4"><span className="text-[13px] font-semibold text-ink-2">What changed?</span><div className="mt-1.5"><Select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</Select></div></div>
        <div className="mt-5 flex gap-2">
          <button onClick={() => setReleaseOpen(false)} className="h-12 flex-1 rounded-full border border-line bg-white font-semibold">Keep the family</button>
          <button onClick={() => release.mutate()} disabled={release.isPending} className="h-12 flex-1 rounded-full bg-bad-soft font-semibold text-bad">{release.isPending ? 'Releasing…' : 'Release'}</button>
        </div>
      </Sheet>
    </div>
  );
}
