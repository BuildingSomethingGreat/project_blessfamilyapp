import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { familyArt, colorSwatch, nicknameProblem, STATUS_LABEL, type Activity, type FamilyStatus, type Sponsor, type Sponsorship, type SponsorshipStatus } from '@bless/shared';
import { api } from '@/lib/api';
import { Button, Chip, Dominoes, FamilyArt, Input, Kicker, Label, Select, Sheet, Skeleton, Textarea, Toggle, useToast } from '@/components/ui';
import { NicknameField } from '@/components/NicknameField';
import { cx, fmtDate, fmtDateTime, plural, timeAgo } from '@/lib/format';
import { Panel, PanelTitle, RELEASE_REASONS, SpStatusChip, StatusChip, copyText } from './shared.tsx';

type Sp = Sponsorship & { sponsor: Sponsor | null; family?: { nickname: string } | null };
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const FAMILY_ACTIONS: Record<FamilyStatus, { label: string; to: FamilyStatus; variant: Variant }[]> = {
  Submitted: [{ label: 'Approve & publish', to: 'Available', variant: 'primary' }, { label: 'Needs info', to: 'Needs Info', variant: 'secondary' }, { label: 'Decline', to: 'Declined', variant: 'danger' }],
  'Needs Info': [{ label: 'Approve & publish', to: 'Available', variant: 'primary' }, { label: 'Decline', to: 'Declined', variant: 'danger' }],
  Available: [{ label: 'Withdraw', to: 'Withdrawn', variant: 'danger' }, { label: 'Needs info', to: 'Needs Info', variant: 'ghost' }],
  Claimed: [],
  Fulfilled: [],
  Withdrawn: [{ label: 'Reopen', to: 'Available', variant: 'primary' }],
  Declined: [{ label: 'Reopen', to: 'Available', variant: 'primary' }],
};

export default function FamilyDetail() {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'family', id], queryFn: () => api.admin.family(id) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const [nick, setNick] = useState('');
  const [editingNick, setEditingNick] = useState(false);
  const [notes, setNotes] = useState('');
  const [goal, setGoal] = useState('');
  const [nudgeOpen, setNudgeOpen] = useState<Sp | null>(null);
  const [releaseOpen, setReleaseOpen] = useState<Sp | null>(null);
  const [showOld, setShowOld] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);

  useEffect(() => { if (q.data) { setNick(q.data.public.nickname); setNotes(q.data.adminNotes); setGoal(String(q.data.public.goal)); } }, [q.data]);

  const patchFamily = useMutation({
    mutationFn: (body: Parameters<typeof api.admin.patchFamily>[1]) => api.admin.patchFamily(id, body),
    onSuccess: () => { toast('Saved', 'ok'); invalidate(); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });
  const patchSp = useMutation({
    mutationFn: ({ spId, body }: { spId: string; body: Parameters<typeof api.admin.patchSponsorship>[1] }) => api.admin.patchSponsorship(spId, body),
    onSuccess: () => { toast('Updated', 'ok'); invalidate(); setReleaseOpen(null); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });

  if (q.isPending) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid gap-3.5 lg:grid-cols-5"><Skeleton className="h-96 lg:col-span-3" /><Skeleton className="h-96 lg:col-span-2" /></div></div>;
  if (q.isError) return <Panel className="text-center"><div className="font-bold">Family not found</div><Link to="/admin/families" className="mt-4 inline-block"><Button variant="secondary">Back to families</Button></Link></Panel>;
  const f = q.data;
  const art = familyArt(f.public.colors);
  const active = f.sponsorships.filter((s) => s.status !== 'Released').sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))[0] ?? null;
  const old = f.sponsorships.filter((s) => s !== active);
  const publicUrl = `${window.location.origin}/families/${f.slug}`;
  const move = (s: Sp, status: SponsorshipStatus, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    patchSp.mutate({ spId: s.id, body: { status } });
  };
  const inShopping = ['Claimed', 'Shopping', 'Purchased', 'Wrapped'].includes(active?.status ?? '');

  return (
    <div className="anim-rise">
      <Link to="/admin/families" className="inline-flex h-9 items-center rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold hover:border-ink">‹ Families</Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <FamilyArt art={art} photoUrl={f.photoApproved ? f.photoUrl : ''} className="size-16 flex-none rounded-2xl" />
          <div className="min-w-0">
            <Kicker>{f.familyId} · {f.city}, {f.state}</Kicker>
            {editingNick ? (
              <form className="mt-1 w-[min(520px,80vw)]" onSubmit={(e) => { e.preventDefault(); if (nicknameProblem(nick, { guardianName: f.guardianName, childNames: f.children.map((k) => k.name) })) return; patchFamily.mutate({ nickname: nick.trim() }); setEditingNick(false); }}>
                <NicknameField value={nick} onChange={setNick} kids={f.children} seed={f.familyId} priv={{ guardianName: f.guardianName, childNames: f.children.map((k) => k.name) }} size="sm" autoFocus />
                <div className="mt-2 flex gap-2">
                  <Button type="submit" size="sm" variant="dark" disabled={!!nicknameProblem(nick, { guardianName: f.guardianName, childNames: f.children.map((k) => k.name) })}>Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingNick(false); setNick(f.public.nickname); }}>Cancel</Button>
                </div>
              </form>
            ) : (
              <button onClick={() => setEditingNick(true)} className="group mt-0.5 flex items-center gap-2 text-left" title="Rename">
                <h1 className="text-[30px] font-extrabold tracking-[-.045em] sm:text-[36px]">{f.public.nickname}</h1>
                <span className="rounded-full border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-3 transition-colors group-hover:border-ink group-hover:text-ink">Rename</span>
              </button>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-3"><span>{plural(f.children.length, 'child', 'children')}</span><StatusChip status={f.status} /><span>submitted {fmtDate(f.createdAt)}</span></div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {FAMILY_ACTIONS[f.status].map((a) => (
            <Button key={a.to} size="sm" variant={a.variant} onClick={() => { if (a.to === 'Declined' || a.to === 'Withdrawn' ? window.confirm(`${a.label} ${f.familyId}? Holiday Konnectors will no longer see this family.`) : true) patchFamily.mutate({ status: a.to }); }} loading={patchFamily.isPending && patchFamily.variables?.status === a.to}>{a.label}</Button>
          ))}
          {(f.status === 'Available' || f.status === 'Claimed' || f.status === 'Fulfilled') && <Button size="sm" variant="secondary" onClick={() => { copyText(publicUrl); toast('Public link copied', 'ok'); }}>Copy public link</Button>}
        </div>
      </div>

      <div className="mt-5 grid gap-3.5 lg:grid-cols-5">
        <div className="space-y-3.5 lg:col-span-3">
          <Panel>
            <PanelTitle right={<span className="flex items-center gap-2">{f.email && <button onClick={() => setEmailOpen(true)} className="text-[12px] font-semibold text-pri hover:text-pri-dark">Email family</button>}<Chip tone="outline" size="sm">Private</Chip></span>}>Household</PanelTitle>
            <dl className="mt-3.5 grid grid-cols-1 gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-2">
              <Row k="Guardian" v={f.guardianName} />
              <Row k="Phone" v={<a className="text-pri hover:underline" href={`tel:${f.phone}`}>{f.phone}</a>} />
              <Row k="Email" v={f.email ? <a className="text-pri hover:underline" href={`mailto:${f.email}`}>{f.email}</a> : '—'} />
              <Row k="Prefers" v={f.preferredContact} />
              <Row k="Address" v={`${f.address}, ${f.city}, ${f.state} ${f.zip}`} />
              <Row k="Gifts" v={f.transportation === 'Yes' ? 'Prefers to pick up' : 'Prefers delivery'} />
              <Row k="Eligibility" v={f.eligibilityConfirmed ? 'Confirmed by guardian' : 'Not confirmed'} />
              <Row k="Approved" v={f.approvedAt ? fmtDate(f.approvedAt) : '—'} />
            </dl>
            {f.notes && <div className="mt-4 rounded-[14px] bg-bg p-3.5 text-[13px]"><div className="text-[10px] font-semibold uppercase tracking-[.08em] text-ink-3">Family's notes / special requests</div><p className="mt-1 whitespace-pre-wrap">{f.notes}</p></div>}
          </Panel>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Panel>
              <PanelTitle right={<Toggle checked={f.storyApproved} onChange={(v) => patchFamily.mutate({ storyApproved: v })} label="Show publicly" />}>Family story</PanelTitle>
              {f.familyStory ? <p className="mt-3 whitespace-pre-wrap text-[14px] leading-[1.5]">“{f.familyStory}”</p> : <p className="mt-3 text-[13px] text-ink-3">The family didn't write a story.</p>}
              <p className="mt-3 text-[12px] text-ink-3">Only visible on the public page after approval. Check for full names or addresses.</p>
            </Panel>
            <Panel>
              <PanelTitle right={f.photoUrl ? <Toggle checked={f.photoApproved && !f.photoPrivate} onChange={(v) => patchFamily.mutate(v ? { photoApproved: true, photoPrivate: false } : { photoPrivate: true })} label="Show publicly" /> : undefined}>Family photo</PanelTitle>
              <FamilyArt art={art} photoUrl={f.photoUrl} className="mt-3 h-[160px] rounded-[16px]" />
              <p className="mt-3 text-[12px] text-ink-3">{!f.photoUrl ? 'No photo. The card uses a gradient from the kids\' favorite colors.' : f.photoPrivate ? 'Hidden from Holiday Konnectors (staff only). Only turn it on if the family says it\'s okay.' : f.photoApproved ? 'Shows on the public card and family page.' : 'Waiting for review. Check that it doesn\'t show full names, addresses or school logos.'}</p>
            </Panel>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Panel>
              <PanelTitle>Admin notes</PanelTitle>
              <Textarea className="mt-3 min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Calls made, context, anything the next admin should know…" />
              <div className="mt-3 flex justify-end"><Button size="sm" variant="dark" disabled={notes === f.adminNotes} loading={patchFamily.isPending && patchFamily.variables?.adminNotes !== undefined} onClick={() => patchFamily.mutate({ adminNotes: notes })}>Save notes</Button></div>
            </Panel>
            <Panel>
              <PanelTitle right={<span className="text-[12px] text-ink-3">${f.raised} pledged</span>}>Chip-in goal</PanelTitle>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-soft"><div className="h-full rounded-full bg-pri" style={{ width: `${Math.min(100, (f.raised / Math.max(1, f.public.goal)) * 100)}%` }} /></div>
              <div className="mt-3.5 flex items-end gap-2">
                <div className="flex-1"><Label htmlFor="goal" hint="dollars">Wishlist goal</Label><Input id="goal" type="number" min={0} step={10} value={goal} onChange={(e) => setGoal(e.target.value)} /></div>
                <Button size="md" variant="dark" className="h-[50px]" disabled={Number(goal) === f.public.goal} onClick={() => patchFamily.mutate({ goal: Number(goal) })}>Save</Button>
              </div>
              <p className="mt-3 text-[12px] text-ink-3">Defaults to $175 per child. Konnection staff shop whatever a Holiday Konnector doesn't cover.</p>
            </Panel>
          </div>

          <div className="space-y-3.5">
            <h2 className="text-[20px]">Children</h2>
            {f.children.map((c, i) => (
              <Panel key={c.id}>
                <div className="flex items-center justify-between gap-3">
                  <div><Kicker>Child {i + 1}</Kicker><div className="mt-0.5 text-[22px] font-extrabold tracking-[-.03em]">{c.name}, {c.age}</div><div className="text-[13px] text-ink-3">{c.gender}{c.hobbies ? ` · ${c.hobbies}` : ''}</div></div>
                  {c.favoriteColor && <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[12px] font-semibold"><span className="inline-block size-2.5 rounded-full" style={{ background: colorSwatch(c.favoriteColor) }} />{c.favoriteColor}</span>}
                </div>
                <div className="mt-3.5 grid grid-cols-3 gap-2">
                  <Size k="Shirt" v={c.shirtSize} cat={c.clothingCategory} />
                  <Size k="Pants" v={c.pantsSize} cat={c.clothingCategory} />
                  <Size k="Shoes" v={c.shoeSize} cat={c.shoeCategory} />
                </div>
                {c.sizeNotes && <p className="mt-2.5 rounded-[14px] bg-amber-50 px-3 py-2 text-[13px] text-warn"><b>Size notes:</b> {c.sizeNotes}</p>}
                <div className="mt-3.5 text-[12px] font-semibold text-ink-2">Clothing</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{c.clothingWishlist.map((x) => <Chip key={x} tone="soft">{x}</Chip>)}{c.otherClothing && <Chip tone="outline">{c.otherClothing}</Chip>}{!c.clothingWishlist.length && !c.otherClothing && <span className="text-[13px] text-ink-3">—</span>}</div>
                <div className="mt-3 text-[12px] font-semibold text-ink-2">Fun gifts</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{c.giftTypes.map((x) => <Chip key={x} tone="outline">{x}</Chip>)}{c.specificGifts && <Chip tone="outline">{c.specificGifts}</Chip>}{!c.giftTypes.length && !c.specificGifts && <span className="text-[13px] text-ink-3">—</span>}</div>
              </Panel>
            ))}
          </div>
        </div>

        <div className="space-y-3.5 lg:col-span-2">
          <Panel>
            <PanelTitle right={active ? <SpStatusChip status={active.status} /> : undefined}>Holiday Konnector</PanelTitle>
            {!active ? (
              <div className="mt-3">
                <p className="text-[13px] text-ink-3">{f.status === 'Available' ? 'Listed and waiting for a Holiday Konnector.' : f.status === 'Submitted' || f.status === 'Needs Info' ? 'Not listed yet. Approve the family to make it visible to Holiday Konnectors.' : 'No active Holiday Konnector.'}</p>
                {f.status === 'Available' && (
                  <div className="mt-3.5 flex items-center gap-2 rounded-[14px] bg-bg p-3 text-[13px]">
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{publicUrl}</span>
                    <Button size="xs" variant="dark" onClick={() => { copyText(publicUrl); toast('Copied', 'ok'); }}>Copy</Button>
                  </div>
                )}
                <div className="mt-3 text-[13px] text-ink-3">{f.views} views · {f.claimStarts} started a claim · waiting {plural(f.public.daysWaiting, 'day')}</div>
              </div>
            ) : (
              <div className="mt-3.5 space-y-5">
                {active.flagged && <div className="rounded-2xl bg-bad-soft px-4 py-3 text-[13px] text-bad"><b>Flagged:</b> {active.flagReason || 'needs a human decision'}</div>}
                <div>
                  <div className="text-[17px] font-bold">{active.sponsor?.name ?? 'Unknown Konnector'}</div>
                  <div className="text-[13px] text-ink-2">
                    {active.sponsor?.organization && <div>{active.sponsor.organization}</div>}
                    {active.sponsor?.email && <a className="block text-pri hover:underline" href={`mailto:${active.sponsor.email}`}>{active.sponsor.email}</a>}
                    {active.sponsor?.phone && <a className="block text-pri hover:underline" href={`tel:${active.sponsor.phone}`}>{active.sponsor.phone}</a>}
                    <div className="text-ink-3">Updates by email · {active.sponsorshipId}</div>
                    <div className={active.handoff === 'Deliver directly' ? 'mt-1 font-semibold text-warn' : 'mt-1 text-ink-3'}>{active.handoff === 'Deliver directly' ? 'Will deliver directly: share the family\'s address with them privately' : 'Dropping off gifts with us'}</div>
                    {active.sponsor && <div className="text-ink-3">Wall: {active.sponsor.wallOptIn ? (active.sponsor.wallHidden ? 'opted in, hidden by staff' : 'opted in') : 'not opted in'}</div>}
                  </div>
                  {active.sponsorNote && <p className="mt-2 rounded-[14px] bg-bg px-3 py-2 text-[13px] italic">“{active.sponsorNote}”</p>}
                </div>
                <Dominoes status={active.status} dates={{ Claimed: active.claimedAt, Shopping: active.shoppingAt, Purchased: active.purchasedAt, Wrapped: active.wrappedAt, 'Dropped Off': active.droppedOffAt, Delivered: active.deliveredAt }} />
                <dl className="grid grid-cols-2 gap-2 text-[13px]">
                  <Cell k="Last heard" v={active.lastResponseAt ? timeAgo(active.lastResponseAt) : 'never'} bad={!active.lastResponseAt} />
                  <Cell k="Next follow-up" v={active.flagged ? 'Flagged → human' : active.nextFollowUpAt ? fmtDateTime(active.nextFollowUpAt) : '—'} />
                  <Cell k="Unanswered" v={active.followUpCount} bad={active.flagged} />
                  <Cell k="Last nudged" v={active.lastNudgedAt ? timeAgo(active.lastNudgedAt) : '—'} />
                </dl>
                <div className="grid grid-cols-2 gap-2">
                  {active.status !== 'Delivered' && <Button size="sm" variant="secondary" onClick={() => setNudgeOpen(active)}>Send nudge</Button>}
                  <Button size="sm" variant="secondary" onClick={() => { copyText(`${window.location.origin}/s/${active.token}`); toast('Konnector page link copied', 'ok'); }}>Copy portal link</Button>
                  {inShopping && <Button size="sm" variant="dark" onClick={() => move(active, 'Dropped Off', 'Record that gifts were dropped off at The Konnection?')}>Mark dropped off</Button>}
                  {active.status === 'Dropped Off' && <Button size="sm" onClick={() => move(active, 'Delivered', `Mark gifts delivered to ${f.public.nickname}? The Konnector gets a thank-you and a link to share their story.`)}>Mark delivered</Button>}
                  {active.status !== 'Delivered' && <Button size="sm" variant="danger" onClick={() => setReleaseOpen(active)}>Release family</Button>}
                  {active.flagged && <Button size="sm" variant="ghost" onClick={() => patchSp.mutate({ spId: active.id, body: { flagged: false } })}>Clear flag</Button>}
                </div>
              </div>
            )}
            {old.length > 0 && (
              <div className="mt-5 border-t border-soft pt-4">
                <button className="text-[13px] font-semibold text-ink-3 hover:text-ink" onClick={() => setShowOld((v) => !v)}>{showOld ? 'Hide' : 'Show'} {plural(old.length, 'earlier sponsorship')}</button>
                {showOld && <ul className="mt-3 space-y-2 text-[13px]">{old.map((s) => <li key={s.id} className="rounded-[14px] bg-bg px-3 py-2"><b>{s.sponsor?.name ?? '—'}</b> · {STATUS_LABEL[s.status]}{s.releaseReason ? ` · ${s.releaseReason}` : ''} · {fmtDate(s.claimedAt)}</li>)}</ul>}
              </div>
            )}
          </Panel>

          <Panel>
            <PanelTitle>Activity</PanelTitle>
            {f.activity.length === 0 ? <p className="mt-3 text-[13px] text-ink-3">Nothing yet.</p> : <ul className="mt-3.5 space-y-3">{f.activity.filter((a) => a.type !== 'family_view').slice(0, 30).map((a) => <ActivityRow key={a.id} a={a} />)}</ul>}
            {f.activity.some((a) => a.type === 'family_view') && <p className="mt-3 text-[12px] text-ink-3">{f.activity.filter((a) => a.type === 'family_view').length} page views in the log are hidden.</p>}
          </Panel>
        </div>
      </div>

      <FamilyEmailSheet open={emailOpen} familyId={f.id} to={f.email} name={f.guardianName} onClose={() => setEmailOpen(false)} onDone={invalidate} />
      <NudgeSheet sp={nudgeOpen} onClose={() => setNudgeOpen(null)} onDone={invalidate} />
      <ReleaseSheet sp={releaseOpen} familyName={f.public.nickname} onClose={() => setReleaseOpen(null)} pending={patchSp.isPending} onConfirm={(reason) => releaseOpen && patchSp.mutate({ spId: releaseOpen.id, body: { status: 'Released', reason } })} />
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex gap-3"><dt className="w-24 shrink-0 text-ink-3">{k}</dt><dd className="min-w-0 flex-1 break-words font-semibold text-ink">{v}</dd></div>;
}
function Cell({ k, v, bad }: { k: string; v: React.ReactNode; bad?: boolean }) {
  return <div className="rounded-[14px] bg-bg px-3 py-2"><dt className="text-[10px] font-semibold uppercase tracking-[.08em] text-ink-3">{k}</dt><dd className={cx('mt-0.5 font-bold tabular', bad && 'text-bad')}>{v}</dd></div>;
}
function Size({ k, v, cat }: { k: string; v: string; cat: string }) {
  return <div className="rounded-[14px] bg-bg px-3 py-2.5"><div className="text-[10px] font-semibold uppercase tracking-[.08em] text-ink-3">{k}</div><div className="mt-0.5 text-[17px] font-bold">{v}</div><div className="text-[11px] text-ink-3">{cat}</div></div>;
}

const ICONS: Partial<Record<Activity['type'], string>> = { message_sent: '✉️', sponsor_response: '💬', claim_complete: '🎁', claim_start: '👀', status_change: '➡️', admin_action: '🛠️', agent_action: '✨', flag: '🚩', release: '↩️', catalog_view: '👀', chip_in: '💜' };
export function ActivityRow({ a }: { a: Activity }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex gap-3 text-[13px]">
      <span className="mt-0.5 grid size-7 flex-none place-items-center rounded-full bg-soft-2 text-[12px]">{ICONS[a.type] ?? '•'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2"><span className="font-semibold">{a.subject || a.type.replace('_', ' ')}</span><span className="flex-none text-[11px] text-ink-3" title={fmtDateTime(a.occurredAt)}>{timeAgo(a.occurredAt)}</span></div>
        <div className="text-[11px] text-ink-3">{a.type.replace('_', ' ')}{a.channel !== 'system' ? ` · ${a.channel}` : ''}{a.meta?.ok === false ? ' · failed to send' : ''}</div>
        {a.body && (
          <div>
            <button className="mt-1 text-[12px] font-semibold text-pri hover:underline" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Show'} message</button>
            {open && <pre className="mt-2 whitespace-pre-wrap rounded-[14px] bg-bg p-3 font-sans text-[12px] text-ink-2">{a.body}</pre>}
          </div>
        )}
      </div>
    </li>
  );
}

export function NudgeSheet({ sp, onClose, onDone }: { sp: Sp | null; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [msg, setMsg] = useState('');
  const m = useMutation({
    mutationFn: () => api.admin.nudge(sp!.id, msg.trim() || undefined),
    onSuccess: (r) => { toast(r.ok ? `Sent: ${r.subject}` : `Failed: ${r.error}`, r.ok ? 'ok' : 'bad'); setMsg(''); onDone(); onClose(); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });
  return (
    <Sheet open={!!sp} onClose={onClose} title="Send a nudge">
      {sp && (
        <div className="space-y-4">
          <p className="text-[14px] text-ink-2">Emails <b>{sp.sponsor?.name}</b>{sp.sponsor?.email ? ` (${sp.sponsor.email})` : ''}. Leave the message empty to send the right template for their step ({STATUS_LABEL[sp.status]}).</p>
          <div>
            <Label htmlFor="nudge" hint="(optional)">Custom message</Label>
            <Textarea id="nudge" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Hi! Quick check-in from The Konnection…" />
          </div>
          <Button full size="xl" onClick={() => m.mutate()} loading={m.isPending}>{msg.trim() ? 'Send custom message' : 'Send template'}</Button>
        </div>
      )}
    </Sheet>
  );
}

function FamilyEmailSheet({ open, familyId, to, name, onClose, onDone }: { open: boolean; familyId: string; to: string; name: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [msg, setMsg] = useState('');
  const m = useMutation({
    mutationFn: () => api.admin.emailFamily(familyId, msg.trim()),
    onSuccess: (r) => { toast(r.ok ? 'Email sent to the family' : `Not sent: ${r.error}`, r.ok ? 'ok' : 'bad'); if (r.ok) { setMsg(''); onClose(); } onDone(); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });
  return (
    <Sheet open={open} onClose={onClose} title="Email the family">
      <div className="space-y-4">
        <p className="text-[14px] text-ink-2">To <b>{name}</b> ({to}). It goes out as a short note from The Konnection team and is saved in Emails.</p>
        <div>
          <Label htmlFor="fam-email">Message</Label>
          <Textarea id="fam-email" value={msg} onChange={(e) => setMsg(e.target.value.slice(0, 2000))} placeholder="Hi! We need one more size for…" />
        </div>
        <Button full size="xl" onClick={() => m.mutate()} loading={m.isPending} disabled={msg.trim().length < 2}>Send email</Button>
      </div>
    </Sheet>
  );
}

export function ReleaseSheet({ sp, familyName, onClose, onConfirm, pending }: { sp: Sp | null; familyName: string; onClose: () => void; onConfirm: (reason: string) => void; pending: boolean }) {
  const [reason, setReason] = useState(RELEASE_REASONS[0]);
  const [other, setOther] = useState('');
  return (
    <Sheet open={!!sp} onClose={onClose} title="Release this family">
      {sp && (
        <div className="space-y-4">
          <p className="text-[14px] text-ink-2"><b>{familyName}</b> goes back into the public catalog immediately and <b>{sp.sponsor?.name}</b> gets a short notice. This can't be undone.</p>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>{RELEASE_REASONS.map((r) => <option key={r}>{r}</option>)}</Select>
            {reason === 'Other' && <Input className="mt-2" placeholder="Tell the next admin why" value={other} onChange={(e) => setOther(e.target.value)} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" onClick={onClose}>Keep Konnector</Button>
            <Button variant="danger" size="lg" loading={pending} onClick={() => onConfirm(reason === 'Other' ? other.trim() || 'Other' : reason)}>Release family</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
