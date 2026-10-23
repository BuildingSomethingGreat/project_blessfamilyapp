import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import type { Activity, FamilyStatus, Sponsor, Sponsorship, SponsorshipStatus } from '@bless/shared';
import { api } from '@/lib/api';
import { Button, Card, Chip, Dominoes, EmptyState, FamilyArt, Input, Label, Select, Sheet, Skeleton, Textarea, Toggle, useToast } from '@/components/ui';
import { fmtDate, fmtDateTime, plural, timeAgo } from '@/lib/format';
import { RELEASE_REASONS, SectionTitle, SpStatusChip, StatusChip, copyText , stagger, rise } from './shared.tsx';

type Sp = Sponsorship & { sponsor: Sponsor | null };

const FAMILY_ACTIONS: Record<FamilyStatus, { label: string; to: FamilyStatus; variant: 'pine' | 'secondary' | 'danger' | 'ghost' }[]> = {
  Submitted: [{ label: 'Approve & list', to: 'Available', variant: 'pine' }, { label: 'Needs info', to: 'Needs Info', variant: 'secondary' }, { label: 'Decline', to: 'Declined', variant: 'danger' }],
  'Needs Info': [{ label: 'Approve & list', to: 'Available', variant: 'pine' }, { label: 'Decline', to: 'Declined', variant: 'danger' }],
  Available: [{ label: 'Withdraw', to: 'Withdrawn', variant: 'danger' }, { label: 'Needs info', to: 'Needs Info', variant: 'ghost' }],
  Claimed: [],
  Fulfilled: [],
  Withdrawn: [{ label: 'Reopen', to: 'Available', variant: 'pine' }],
  Declined: [{ label: 'Reopen', to: 'Available', variant: 'pine' }],
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
  const [nudgeOpen, setNudgeOpen] = useState<Sp | null>(null);
  const [releaseOpen, setReleaseOpen] = useState<Sp | null>(null);
  const [showOld, setShowOld] = useState(false);

  useEffect(() => { if (q.data) { setNick(q.data.public.nickname); setNotes(q.data.adminNotes); } }, [q.data]);

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

  if (q.isPending) return <div className="space-y-4"><Skeleton className="h-10 w-72" /><div className="grid gap-5 lg:grid-cols-5"><Skeleton className="h-96 lg:col-span-3" /><Skeleton className="h-96 lg:col-span-2" /></div></div>;
  if (q.isError) return <EmptyState title="Family not found" action={<Link to="/admin/families"><Button variant="secondary">Back to families</Button></Link>} />;
  const f = q.data;
  const active = f.sponsorships.filter((s) => s.status !== 'Released').sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))[0] ?? null;
  const old = f.sponsorships.filter((s) => s !== active);
  const publicUrl = `${window.location.origin}/families/${f.slug}`;

  const move = (s: Sp, status: SponsorshipStatus, confirmText?: string) => {
    if (confirmText && !window.confirm(confirmText)) return;
    patchSp.mutate({ spId: s.id, body: { status } });
  };

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={rise}>
        <Link to="/admin/families" className="text-sm font-medium text-ink-3 hover:text-ink">← Families</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <FamilyArt colors={f.public.colors} seed={f.children.length} className="size-16 shrink-0 rounded-2xl" />
            <div className="min-w-0">
              {editingNick ? (
                <form className="flex items-center gap-2" onSubmit={(e) => { e.preventDefault(); patchFamily.mutate({ nickname: nick.trim() }); setEditingNick(false); }}>
                  <Input value={nick} onChange={(e) => setNick(e.target.value)} className="py-2 text-xl font-bold" autoFocus maxLength={80} />
                  <Button type="submit" size="sm" variant="dark">Save</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => { setEditingNick(false); setNick(f.public.nickname); }}>Cancel</Button>
                </form>
              ) : (
                <button onClick={() => setEditingNick(true)} className="group flex items-center gap-2 text-left" title="Rename">
                  <h1 className="display-tight text-3xl sm:text-4xl">{f.public.nickname}</h1>
                  <svg viewBox="0 0 20 20" className="size-4 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" fill="currentColor"><path d="M13.6 2.6a2 2 0 0 1 2.8 2.8l-8.5 8.5-3.7.9.9-3.7 8.5-8.5Z" /></svg>
                </button>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-3">
                <span className="font-mono">{f.familyId}</span><span>·</span><span>{f.city}, {f.state}</span><span>·</span><span>{plural(f.children.length, 'child', 'children')}</span>
                <StatusChip status={f.status} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {FAMILY_ACTIONS[f.status].map((a) => (
              <Button key={a.to} size="sm" variant={a.variant} onClick={() => { if (a.to === 'Declined' || a.to === 'Withdrawn' ? window.confirm(`${a.label} ${f.familyId}? Sponsors will no longer see this family.`) : true) patchFamily.mutate({ status: a.to }); }} loading={patchFamily.isPending && patchFamily.variables?.status === a.to}>{a.label}</Button>
            ))}
            {(f.status === 'Available' || f.status === 'Claimed' || f.status === 'Fulfilled') && (
              <Button size="sm" variant="secondary" onClick={() => { copyText(publicUrl); toast('Public link copied', 'ok'); }}>Copy public link</Button>
            )}
          </div>
        </div>
      </motion.div>

      <div className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <motion.div variants={rise}>
            <Card className="p-5">
              <SectionTitle right={<Chip tone="neutral">Private</Chip>}>Household</SectionTitle>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <Row k="Guardian" v={f.guardianName} />
                <Row k="Phone" v={<a className="font-medium text-ember hover:underline" href={`tel:${f.phone}`}>{f.phone}</a>} />
                <Row k="Email" v={f.email ? <a className="font-medium text-ember hover:underline" href={`mailto:${f.email}`}>{f.email}</a> : '—'} />
                <Row k="Prefers" v={f.preferredContact} />
                <Row k="Address" v={`${f.address}, ${f.city}, ${f.state} ${f.zip}`} />
                <Row k="Transportation" v={f.transportation === 'Yes' ? 'Has reliable transportation' : 'No reliable transportation'} />
                <Row k="Eligibility" v={f.eligibilityConfirmed ? 'Confirmed by guardian' : 'Not confirmed'} />
                <Row k="Submitted" v={`${fmtDate(f.createdAt, { month: 'short', day: 'numeric', year: 'numeric' })}${f.approvedAt ? ` · approved ${fmtDate(f.approvedAt)}` : ''}`} />
              </dl>
              {f.notes && <div className="mt-4 rounded-2xl bg-cream-2/70 p-4 text-sm"><div className="text-xs font-semibold uppercase tracking-wider text-ink-3">Family's notes / special requests</div><p className="mt-1 whitespace-pre-wrap">{f.notes}</p></div>}
            </Card>
          </motion.div>

          <motion.div variants={rise}>
            <Card className="p-5">
              <SectionTitle right={<Toggle checked={f.storyApproved} onChange={(v) => patchFamily.mutate({ storyApproved: v })} label="Show publicly" />}>Family story</SectionTitle>
              {f.familyStory ? <p className="whitespace-pre-wrap text-[15px] leading-relaxed">{f.familyStory}</p> : <p className="text-sm text-ink-3">The family didn't write a story.</p>}
              <p className="mt-3 text-xs text-ink-3">Stories are only visible on the public page after you approve them. Check for full names, addresses, or anything the family wouldn't want strangers to read.</p>
            </Card>
          </motion.div>

          <motion.div variants={rise}>
            <Card className="p-5">
              <SectionTitle>Admin notes</SectionTitle>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Calls made, context, anything the next admin should know…" />
              <div className="mt-3 flex justify-end"><Button size="sm" variant="dark" disabled={notes === f.adminNotes} loading={patchFamily.isPending && patchFamily.variables?.adminNotes !== undefined} onClick={() => patchFamily.mutate({ adminNotes: notes })}>Save notes</Button></div>
            </Card>
          </motion.div>

          <motion.div variants={rise} className="space-y-4">
            <h2 className="text-lg">Children</h2>
            {f.children.map((c, i) => (
              <Card key={c.id} className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-9 place-items-center rounded-full text-sm font-bold text-white" style={{ background: f.public.colors[i % f.public.colors.length] ?? '#eb6834' }}>{i + 1}</span>
                    <div><div className="text-lg font-semibold">{c.name}</div><div className="text-sm text-ink-3">{c.gender} · age {c.age}{c.favoriteColor ? ` · loves ${c.favoriteColor.toLowerCase()}` : ''}</div></div>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
                  <Size k="Shirt / top" v={`${c.clothingCategory} ${c.shirtSize}`} />
                  <Size k="Pants / bottom" v={`${c.clothingCategory} ${c.pantsSize}`} />
                  <Size k="Shoes" v={`${c.shoeCategory} ${c.shoeSize}`} />
                </div>
                {c.sizeNotes && <p className="mt-2 rounded-xl bg-gold-soft px-3 py-2 text-sm text-[#8a5f10]"><span className="font-semibold">Size notes:</span> {c.sizeNotes}</p>}
                <dl className="mt-4 space-y-2.5 text-sm">
                  {c.hobbies && <Row k="Interests" v={c.hobbies} />}
                  <Row k="Clothing" v={c.clothingWishlist.length ? <span className="flex flex-wrap gap-1.5">{c.clothingWishlist.map((x) => <Chip key={x}>{x}</Chip>)}</span> : '—'} />
                  {c.otherClothing && <Row k="Other clothing" v={c.otherClothing} />}
                  <Row k="Fun gifts" v={c.giftTypes.length ? <span className="flex flex-wrap gap-1.5">{c.giftTypes.map((x) => <Chip key={x} tone="ember">{x}</Chip>)}</span> : '—'} />
                  {c.specificGifts && <Row k="Specific gifts" v={c.specificGifts} />}
                </dl>
              </Card>
            ))}
          </motion.div>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <motion.div variants={rise}>
            <Card className="p-5">
              <SectionTitle right={active ? <SpStatusChip status={active.status} /> : undefined}>Sponsorship</SectionTitle>
              {!active ? (
                <div>
                  <p className="text-sm text-ink-3">{f.status === 'Available' ? 'Listed and waiting for a sponsor.' : f.status === 'Submitted' || f.status === 'Needs Info' ? 'Not listed yet. Approve the family to make it visible to sponsors.' : 'No active sponsor.'}</p>
                  {f.status === 'Available' && (
                    <div className="mt-4 flex items-center gap-2 rounded-2xl bg-cream-2/70 p-3 text-sm">
                      <span className="min-w-0 flex-1 truncate font-mono text-xs">{publicUrl}</span>
                      <Button size="sm" variant="dark" onClick={() => { copyText(publicUrl); toast('Copied', 'ok'); }}>Copy</Button>
                    </div>
                  )}
                  <div className="mt-3 text-sm text-ink-3">{f.views} views · {f.claimStarts} started a claim · waiting {plural(f.public.daysWaiting, 'day')}</div>
                </div>
              ) : (
                <div className="space-y-5">
                  {active.flagged && <div className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-bad"><span className="font-semibold">Flagged:</span> {active.flagReason || 'needs a human decision'}</div>}
                  <div>
                    <div className="text-lg font-semibold">{active.sponsor?.name ?? 'Unknown sponsor'}</div>
                    <div className="text-sm text-ink-2">
                      {active.sponsor?.organization && <div>{active.sponsor.organization}</div>}
                      {active.sponsor?.email && <a className="block text-ember hover:underline" href={`mailto:${active.sponsor.email}`}>{active.sponsor.email}</a>}
                      {active.sponsor?.phone && <a className="block text-ember hover:underline" href={`tel:${active.sponsor.phone}`}>{active.sponsor.phone}</a>}
                      <div className="text-ink-3">Prefers {active.sponsor?.preferredContact?.toLowerCase() ?? 'email'} · {active.sponsorshipId}</div>
                    </div>
                    {active.sponsorNote && <p className="mt-2 rounded-xl bg-cream-2/70 px-3 py-2 text-sm italic">“{active.sponsorNote}”</p>}
                  </div>
                  <div className="[&_li_span.block]:leading-tight [&_li_span.text-sm]:text-xs"><Dominoes status={active.status} dates={{ Claimed: active.claimedAt, Confirmed: active.confirmedAt, Shopping: active.shoppingAt, 'Dropped Off': active.droppedOffAt, Delivered: active.deliveredAt }} /></div>
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <Cell k="Last heard" v={active.lastResponseAt ? timeAgo(active.lastResponseAt) : 'never'} />
                    <Cell k="Next follow-up" v={active.nextFollowUpAt ? fmtDateTime(active.nextFollowUpAt) : '—'} />
                    <Cell k="Nudges sent" v={active.followUpCount} />
                    <Cell k="Last nudged" v={active.lastNudgedAt ? timeAgo(active.lastNudgedAt) : '—'} />
                  </dl>
                  <div className="grid grid-cols-2 gap-2">
                    {active.status !== 'Delivered' && <Button size="sm" variant="secondary" onClick={() => setNudgeOpen(active)}>Send nudge</Button>}
                    <Button size="sm" variant="secondary" onClick={() => { copyText(`${window.location.origin}/s/${active.token}`); toast('Sponsor portal link copied', 'ok'); }}>Copy portal link</Button>
                    {['Claimed', 'Confirmed', 'Shopping'].includes(active.status) && <Button size="sm" variant="dark" onClick={() => move(active, 'Dropped Off', 'Record that gifts were dropped off at The Konnection?')}>Mark dropped off</Button>}
                    {active.status === 'Dropped Off' && <Button size="sm" variant="pine" onClick={() => move(active, 'Delivered', `Mark gifts delivered to ${f.public.nickname}? The sponsor gets a thank-you.`)}>Mark delivered</Button>}
                    {active.status !== 'Delivered' && <Button size="sm" variant="danger" onClick={() => setReleaseOpen(active)}>Release family</Button>}
                    {active.flagged && <Button size="sm" variant="ghost" onClick={() => patchSp.mutate({ spId: active.id, body: { flagged: false } })}>Clear flag</Button>}
                  </div>
                </div>
              )}
              {old.length > 0 && (
                <div className="mt-5 border-t border-line/70 pt-4">
                  <button className="text-sm font-medium text-ink-3 hover:text-ink" onClick={() => setShowOld((v) => !v)}>{showOld ? 'Hide' : 'Show'} {plural(old.length, 'earlier sponsorship')}</button>
                  {showOld && (
                    <ul className="mt-3 space-y-2 text-sm">
                      {old.map((s) => <li key={s.id} className="rounded-xl bg-cream-2/70 px-3 py-2"><span className="font-medium">{s.sponsor?.name ?? '—'}</span> · {s.status}{s.releaseReason ? ` · ${s.releaseReason}` : ''} · {fmtDate(s.claimedAt)}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </Card>
          </motion.div>

          <motion.div variants={rise}>
            <Card className="p-5">
              <SectionTitle>Activity</SectionTitle>
              {f.activity.length === 0 ? <p className="text-sm text-ink-3">Nothing yet.</p> : (
                <ul className="space-y-3">{f.activity.filter((a) => a.type !== 'family_view').slice(0, 30).map((a) => <ActivityRow key={a.id} a={a} />)}</ul>
              )}
              {f.activity.some((a) => a.type === 'family_view') && <p className="mt-3 text-xs text-ink-3">{f.activity.filter((a) => a.type === 'family_view').length} page views in the log are hidden.</p>}
            </Card>
          </motion.div>
        </div>
      </div>

      <NudgeSheet sp={nudgeOpen} onClose={() => setNudgeOpen(null)} onDone={invalidate} />
      <ReleaseSheet sp={releaseOpen} familyName={f.public.nickname} onClose={() => setReleaseOpen(null)} pending={patchSp.isPending} onConfirm={(reason) => releaseOpen && patchSp.mutate({ spId: releaseOpen.id, body: { status: 'Released', reason } })} />
    </motion.div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex gap-3"><dt className="w-28 shrink-0 text-ink-3">{k}</dt><dd className="min-w-0 flex-1 break-words font-medium text-ink">{v}</dd></div>;
}
function Cell({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="rounded-xl bg-cream-2/70 px-3 py-2"><dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{k}</dt><dd className="mt-0.5 font-semibold tabular-nums">{v}</dd></div>;
}
function Size({ k, v }: { k: string; v: string }) {
  return <div className="rounded-xl bg-cream-2/70 px-3 py-2"><div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3">{k}</div><div className="font-semibold">{v}</div></div>;
}

const ICONS: Partial<Record<Activity['type'], string>> = { message_sent: '✉️', sponsor_response: '💬', claim_complete: '🎁', claim_start: '👀', status_change: '➡️', admin_action: '🛠️', agent_action: '✨', flag: '🚩', release: '↩️', catalog_view: '👀' };
export function ActivityRow({ a }: { a: Activity }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex gap-3 text-sm">
      <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-cream-2 text-xs">{ICONS[a.type] ?? '•'}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2"><span className="font-medium">{a.subject || a.type.replace('_', ' ')}</span><span className="shrink-0 text-xs text-ink-3" title={fmtDateTime(a.occurredAt)}>{timeAgo(a.occurredAt)}</span></div>
        <div className="text-xs text-ink-3">{a.type.replace('_', ' ')}{a.channel !== 'system' ? ` · ${a.channel}` : ''}{a.meta?.ok === false ? ' · failed to send' : ''}</div>
        {a.body && (
          <div>
            <button className="mt-1 text-xs font-medium text-ember hover:underline" onClick={() => setOpen((v) => !v)}>{open ? 'Hide' : 'Show'} message</button>
            {open && <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-cream-2/70 p-3 font-sans text-xs text-ink-2">{a.body}</pre>}
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
          <p className="text-sm text-ink-2">To <span className="font-semibold">{sp.sponsor?.name}</span> via {sp.sponsor?.preferredContact === 'Text' && sp.sponsor.phone ? 'text (if SMS is configured, otherwise email)' : 'email'}. Leave the message empty to send the right template for their step ({sp.status}).</p>
          <div>
            <Label htmlFor="nudge" hint="(optional)">Custom message</Label>
            <Textarea id="nudge" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Hi! Quick check-in from The Konnection…" />
          </div>
          <Button full size="lg" onClick={() => m.mutate()} loading={m.isPending}>{msg.trim() ? 'Send custom message' : 'Send template'}</Button>
        </div>
      )}
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
          <p className="text-sm text-ink-2"><span className="font-semibold">{familyName}</span> goes back into the public catalog immediately and <span className="font-semibold">{sp.sponsor?.name}</span> gets a short notice. This can't be undone.</p>
          <div>
            <Label htmlFor="reason">Reason</Label>
            <Select id="reason" value={reason} onChange={(e) => setReason(e.target.value)}>{RELEASE_REASONS.map((r) => <option key={r}>{r}</option>)}</Select>
            {reason === 'Other' && <Input className="mt-2" placeholder="Tell the next admin why" value={other} onChange={(e) => setOther(e.target.value)} />}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" size="lg" onClick={onClose}>Keep sponsor</Button>
            <Button variant="danger" size="lg" loading={pending} onClick={() => onConfirm(reason === 'Other' ? other.trim() || 'Other' : reason)}>Release family</Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
