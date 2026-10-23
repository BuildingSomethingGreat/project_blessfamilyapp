import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import type { SponsorshipStatus } from '@bless/shared';
import { api, ApiError } from '@/lib/api';
import { Button, Dominoes, Page, Select, Sheet, Skeleton, Textarea, useToast } from '@/components/ui';
import { fmtDate, timeAgo, plural } from '@/lib/format';
import { ChildWishlist } from './ChildWishlist.tsx';

const REASONS = ["Can't afford it right now", 'Travel or timing', 'Other'];

export default function SponsorPortal() {
  const { token = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const [release, setRelease] = useState(false);
  const [reason, setReason] = useState(REASONS[0]);
  const [releaseNote, setReleaseNote] = useState('');
  const [note, setNote] = useState('');
  const q = useQuery({ queryKey: ['portal', token], queryFn: () => api.sponsor.get(token), retry: false });

  const status = useMutation({
    mutationFn: (v: { status: SponsorshipStatus; note?: string; reason?: string }) => api.sponsor.status(token, v.status, v.note ?? '', v.reason ?? ''),
    onSuccess: (data) => { qc.setQueryData(['portal', token], data); setRelease(false); toast(data.sponsorship.status === 'Released' ? 'Family reopened. Thank you for letting us know.' : 'Updated. Thank you!', 'ok'); },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not update', 'bad'),
  });
  const sendNote = useMutation({
    mutationFn: () => api.sponsor.note(token, note),
    onSuccess: (data) => { qc.setQueryData(['portal', token], data); setNote(''); toast('Note sent to the team', 'ok'); },
    onError: (e) => toast(e instanceof Error ? e.message : 'Could not send', 'bad'),
  });

  if (q.error) {
    const nf = q.error instanceof ApiError && q.error.status === 404;
    return (
      <Page className="py-20 text-center">
        <h1 className="display-tight text-4xl sm:text-6xl">{nf ? "That link isn't valid." : 'Something went wrong.'}</h1>
        <p className="mx-auto mt-4 max-w-md text-ink-2">{nf ? 'Check the link in your email, or reach out and we will resend it.' : 'Please try again in a moment.'}</p>
        <Link to="/families" className="mt-8 inline-block"><Button size="lg">See families</Button></Link>
      </Page>
    );
  }
  if (!q.data) {
    return <Page className="py-8"><Skeleton className="h-10 w-2/3" /><Skeleton className="mt-6 h-32 w-full" /><Skeleton className="mt-4 h-48 w-full" /></Page>;
  }

  const { sponsorship: s, sponsor, family: f, settings, timeline } = q.data;
  const firstName = sponsor.name.split(/\s+/)[0];
  const deadline = fmtDate(settings.dropoffDeadline, { weekday: 'long', month: 'long', day: 'numeric' });
  const dates = { Claimed: s.claimedAt, Confirmed: s.confirmedAt, Shopping: s.shoppingAt, 'Dropped Off': s.droppedOffAt, Delivered: s.deliveredAt } as const;

  const action: { title: string; body: React.ReactNode; cta?: { label: string; to: SponsorshipStatus; variant?: 'primary' | 'pine' } } = (() => {
    switch (s.status) {
      case 'Claimed': return { title: 'First things first: are you in?', body: <>Tap below so we know {f.nickname} is covered and we can stop checking in. No payment, just a yes.</>, cta: { label: "I'm in", to: 'Confirmed' } };
      case 'Confirmed': return { title: 'Shop at your own pace.', body: <>Every size and wish is below. When you've started shopping, tap once so our team can plan deliveries. Drop-off is by <span className="font-semibold text-ink">{deadline}</span>.</>, cta: { label: "I've started shopping", to: 'Shopping' } };
      case 'Shopping': return { title: 'Ready to drop off?', body: <>Bring gifts to <span className="font-semibold text-ink">{settings.dropoffLocation}</span>, {settings.dropoffHours}, by <span className="font-semibold text-ink">{deadline}</span>. One bag per child with their first name. Then tap below.</>, cta: { label: 'Gifts dropped off', to: 'Dropped Off', variant: 'pine' } };
      case 'Dropped Off': return { title: "We've got them. Thank you.", body: <>Delivery to {f.nickname} is being scheduled. We'll let you know the moment it lands.</> };
      case 'Delivered': return { title: 'Delivered. You did that.', body: <>{f.nickname} received the gifts you chose for {f.children.map((c) => c.name).join(', ')}. Thank you for being part of Bless-A-Family.</> };
      case 'Released': return { title: 'This family was reopened.', body: <>{f.nickname} is back in the catalog so another sponsor can step in. If that was a mistake, reply to any of our emails and we'll sort it out.</> };
    }
  })();

  const terminal = s.status === 'Delivered' || s.status === 'Released';

  return (
    <Page className="py-8 sm:py-12">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}>
        <p className="text-sm font-semibold uppercase tracking-wider text-ember">Your family page · {s.sponsorshipId}</p>
        <h1 className="display-tight mt-2 text-4xl sm:text-6xl">Hi {firstName}, you're blessing <span className="text-ember">{f.nickname}</span>.</h1>
        <p className="mt-3 text-ink-2">{f.childCount === 1 ? '1 child' : `${f.childCount} kids`}: {f.children.map((c) => `${c.name} (${c.age})`).join(', ')} · {f.city}</p>
      </motion.div>

      <div className="mt-8 rounded-xl3 border border-line/70 bg-paper p-5 shadow-soft sm:p-8">
        <Dominoes status={s.status} dates={dates} />
      </div>

      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.45 }} className={`mt-5 rounded-xl3 p-6 sm:p-8 ${terminal ? 'bg-pine-soft' : 'bg-ink text-cream'}`}>
        <h2 className={`text-2xl sm:text-3xl ${terminal ? 'text-pine' : 'text-cream'}`}>{action.title}</h2>
        <p className={`mt-2 text-[16px] leading-relaxed ${terminal ? 'text-ink-2' : 'text-cream/80 [&_span]:!text-gold'}`}>{action.body}</p>
        {action.cta && (
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Button size="xl" variant={action.cta.variant === 'pine' ? 'pine' : 'primary'} loading={status.isPending} onClick={() => status.mutate({ status: action.cta!.to })}>{action.cta.label}</Button>
            {s.status === 'Claimed' && <span className="text-sm text-cream/60">Takes one tap. We'll stop emailing reminders.</span>}
          </div>
        )}
      </motion.section>

      {!terminal && s.status !== 'Dropped Off' && (
        <p className="mt-4 text-center text-sm text-ink-3">
          Something changed? <button onClick={() => setRelease(true)} className="font-semibold text-ink underline-offset-2 hover:underline">I can no longer sponsor this family</button>
        </p>
      )}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div>
          <h2 className="text-2xl sm:text-3xl">The wishlists</h2>
          <p className="mt-1 text-sm text-ink-3">{settings.perChildBudgetNote}</p>
          <div className="mt-4 grid gap-4">
            {f.children.map((c, i) => <ChildWishlist key={c.name + i} c={c} index={i} />)}
          </div>
        </div>
        <aside className="space-y-4">
          <div className="rounded-xl3 border border-line/70 bg-paper p-5 shadow-soft">
            <h3 className="text-lg">Drop-off</h3>
            <dl className="mt-2 space-y-2 text-[15px]">
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-3">Deadline</dt><dd className="font-semibold">{deadline}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-3">Where</dt><dd>{settings.dropoffLocation}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-3">Hours</dt><dd>{settings.dropoffHours}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-ink-3">Questions</dt><dd><a className="underline-offset-2 hover:underline" href={`mailto:${settings.contactEmail}`}>{settings.contactEmail}</a>{settings.contactPhone ? ` · ${settings.contactPhone}` : ''}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-ink-3">Please don't wrap individual gifts. One bag per child with their first name is perfect.</p>
          </div>

          <div className="rounded-xl3 border border-line/70 bg-paper p-5 shadow-soft">
            <h3 className="text-lg">Leave a note for the team</h3>
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="mt-2 min-h-24" placeholder="Running a few days late, dropping off Monday." />
            <Button className="mt-2" variant="secondary" size="sm" disabled={!note.trim()} loading={sendNote.isPending} onClick={() => sendNote.mutate()}>Send note</Button>
            {s.sponsorNote && <p className="mt-3 text-xs text-ink-3">Last note: “{s.sponsorNote}”</p>}
          </div>

          <div className="rounded-xl3 border border-line/70 bg-paper p-5 shadow-soft">
            <h3 className="text-lg">Activity</h3>
            <ul className="mt-3 space-y-3">
              {timeline.length === 0 && <li className="text-sm text-ink-3">Nothing yet.</li>}
              {timeline.map((t, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${t.type === 'sponsor_response' ? 'bg-pine' : t.type === 'message_sent' ? 'bg-ember' : 'bg-ink-3'}`} />
                  <span className="min-w-0 flex-1"><span className="block text-ink">{t.subject || t.type.replace('_', ' ')}</span><span className="text-xs text-ink-3">{timeAgo(t.occurredAt)}{t.channel !== 'web' && t.channel !== 'system' ? ` · ${t.channel}` : ''}</span></span>
                </li>
              ))}
            </ul>
          </div>

          <p className="px-1 text-xs text-ink-3">Tip: add this page to your home screen (Share → Add to Home Screen) to find it fast. Waiting {plural(f.daysWaiting, 'day')} before you came along.</p>
        </aside>
      </div>

      <Sheet open={release} onClose={() => setRelease(false)} title="Release this family?">
        <div className="space-y-4 pt-1">
          <p className="text-[15px] text-ink-2">No judgment at all. We'll reopen {f.nickname} so another sponsor can step in while there's still time.</p>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-ink-2">What changed?</label>
            <Select value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r}>{r}</option>)}</Select>
          </div>
          <Textarea value={releaseNote} onChange={(e) => setReleaseNote(e.target.value)} className="min-h-20" placeholder="Anything you want us to know (optional)" />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button variant="secondary" onClick={() => setRelease(false)}>Keep the family</Button>
            <Button variant="danger" loading={status.isPending} onClick={() => status.mutate({ status: 'Released', note: releaseNote, reason })}>Release the family</Button>
          </div>
        </div>
      </Sheet>
    </Page>
  );
}
