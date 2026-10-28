import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUOTE_ROLES, type Quote, type QuoteRole, type QuoteStatus } from '@bless/shared';
import { api, type WallAdminRow } from '@/lib/api';
import { Button, Chip, EmptyState, Input, Label, Seg, Skeleton, Textarea, Toggle, useToast } from '@/components/ui';
import { cx, fmtDate } from '@/lib/format';
import { copyText, PageHead, Panel, PanelTitle } from './shared.tsx';

const tone: Record<QuoteStatus, 'warn' | 'ok' | 'neutral'> = { Pending: 'warn', Approved: 'ok', Hidden: 'neutral' };

/**
 * Community: the two public "thank you" surfaces.
 *  - Quotes from Holiday Konnectors and families (nothing shows until approved).
 *  - The Wall of Holiday Konnectors (opted-in names, shown once their gifts are handed off).
 */
export default function Community() {
  const qc = useQueryClient();
  const toast = useToast();
  const quotes = useQuery({ queryKey: ['admin', 'quotes'], queryFn: api.admin.quotes });
  const wall = useQuery({ queryKey: ['admin', 'wall'], queryFn: api.admin.wall });
  const [tab, setTab] = useState<QuoteStatus>('Pending');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['admin', 'quotes'] }); qc.invalidateQueries({ queryKey: ['admin', 'wall'] }); qc.invalidateQueries({ queryKey: ['community'] }); };
  const patchQuote = useMutation({ mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.admin.patchQuote>[1] }) => api.admin.patchQuote(id, body), onSuccess: refresh, onError: (e: Error) => toast(e.message, 'bad') });
  const patchSponsor = useMutation({ mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.admin.patchSponsor>[1] }) => api.admin.patchSponsor(id, body), onSuccess: refresh, onError: (e: Error) => toast(e.message, 'bad') });
  const counts = useMemo(() => Object.fromEntries((['Pending', 'Approved', 'Hidden'] as QuoteStatus[]).map((s) => [s, (quotes.data ?? []).filter((q) => q.status === s).length])) as Record<QuoteStatus, number>, [quotes.data]);
  const list = (quotes.data ?? []).filter((q) => q.status === tab);
  const shareUrl = `${window.location.origin}/share`;

  return (
    <div className="anim-rise">
      <PageHead title="Community" sub="Quotes and shout-outs for Holiday Konnectors and families. Nothing here is public until you approve it." right={<Button size="sm" variant="secondary" onClick={() => { copyText(shareUrl); toast('Share link copied. Text it to families or Konnectors.', 'ok'); }}>Copy share link</Button>} />
      <div className="mt-[22px] grid items-start gap-3.5 lg:grid-cols-5">
        <div className="space-y-3.5 lg:col-span-3">
          <Panel>
            <PanelTitle right={<span>{counts.Approved} on the site</span>}>Quotes</PanelTitle>
            <div className="mt-3 flex gap-1.5">{(['Pending', 'Approved', 'Hidden'] as QuoteStatus[]).map((s) => <Seg key={s} active={tab === s} onClick={() => setTab(s)} className="h-9 px-3.5 text-[13px]">{s} · {counts[s] ?? 0}</Seg>)}</div>
            <div className="mt-4 grid gap-2.5">
              {!quotes.data && <Skeleton className="h-28" />}
              {quotes.data && list.length === 0 && <EmptyState title={tab === 'Pending' ? 'Nothing waiting for review' : `No ${tab.toLowerCase()} quotes`} body={tab === 'Pending' ? 'Konnectors get a share link after delivery. You can also text families the share link above.' : undefined} />}
              {list.map((q) => <QuoteRow key={q.id} q={q} busy={patchQuote.isPending && patchQuote.variables?.id === q.id} onPatch={(body) => patchQuote.mutate({ id: q.id, body })} />)}
            </div>
          </Panel>
          <AddQuote onAdded={() => { refresh(); setTab('Approved'); toast('Quote added and live', 'ok'); }} />
        </div>
        <div className="lg:col-span-2">
          <Panel>
            <PanelTitle right={<span>{(wall.data ?? []).filter((w) => w.showing).length} showing</span>}>Wall of Holiday Konnectors</PanelTitle>
            <p className="mt-2 text-[13px] leading-[1.5] text-ink-3">A name appears on the home page once the Konnector opted in and their gifts are dropped off or delivered. Hide any name with one tap.</p>
            <div className="mt-3.5 grid gap-2">
              {!wall.data && <Skeleton className="h-40" />}
              {wall.data?.length === 0 && <EmptyState title="No Konnectors yet" body="Names show up here as Holiday Konnectors choose families." />}
              {wall.data?.map((w) => <WallRow key={w.id} w={w} onPatch={(body) => patchSponsor.mutate({ id: w.id, body })} />)}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function QuoteRow({ q, busy, onPatch }: { q: Quote; busy: boolean; onPatch: (body: Parameters<typeof api.admin.patchQuote>[1]) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(q.quote);
  const [name, setName] = useState(q.name);
  return (
    <div className="min-w-0 rounded-[18px] border border-line bg-bg p-4">
      <div className="flex flex-wrap items-center gap-1.5 text-[12px]"><Chip tone={tone[q.status]} size="sm">{q.status}</Chip><Chip tone={q.role === 'Konnection family' ? 'ok' : 'soft'} size="sm">{q.role}</Chip>{q.featured && <Chip tone="lav" size="sm">★ Featured</Chip>}<span className="ml-auto text-ink-3">{fmtDate(q.submittedAt)}{q.email ? ` · ${q.email}` : ''}</span></div>
      {editing ? (
        <div className="mt-3 grid gap-2"><Textarea className="min-h-20" value={text} onChange={(e) => setText(e.target.value.slice(0, 600))} /><Input value={name} onChange={(e) => setName(e.target.value.slice(0, 80))} /></div>
      ) : (
        <><p className="mt-2.5 text-[15px] leading-[1.5]">“{q.quote}”</p><div className="mt-1.5 text-[13px] font-semibold text-ink-2">— {q.name}{q.organization ? `, ${q.organization}` : ''}</div></>
      )}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {editing ? (
          <><Button size="xs" variant="dark" loading={busy} onClick={() => { onPatch({ quote: text, name }); setEditing(false); }}>Save</Button><Button size="xs" variant="ghost" onClick={() => { setEditing(false); setText(q.quote); setName(q.name); }}>Cancel</Button></>
        ) : (
          <>
            {q.status !== 'Approved' && <Button size="xs" loading={busy} onClick={() => onPatch({ status: 'Approved' })}>Approve</Button>}
            {q.status !== 'Hidden' && <Button size="xs" variant="secondary" onClick={() => onPatch({ status: 'Hidden', featured: false })}>Hide</Button>}
            {q.status === 'Approved' && <Button size="xs" variant="secondary" onClick={() => onPatch({ featured: !q.featured })}>{q.featured ? 'Unfeature' : '★ Feature'}</Button>}
            <Button size="xs" variant="ghost" onClick={() => setEditing(true)}>Edit wording</Button>
          </>
        )}
      </div>
    </div>
  );
}

function WallRow({ w, onPatch }: { w: WallAdminRow; onPatch: (body: { wallHidden?: boolean; displayName?: string }) => void }) {
  const [name, setName] = useState<string | null>(null);
  const status = !w.wallOptIn ? 'Not opted in' : w.wallHidden ? 'Hidden by staff' : w.done > 0 ? 'On the wall' : 'Shows after hand-off';
  return (
    <div className={cx('min-w-0 rounded-[16px] border px-3.5 py-3', w.showing ? 'border-pri/30 bg-soft-2' : 'border-line bg-white')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-bold">{w.publicName}</div>
          <div className="truncate text-[12px] text-ink-3">{w.name}{w.organization ? ` · ${w.organization}` : ''} · {w.done}/{w.active} handed off</div>
          <div className={cx('mt-0.5 text-[12px] font-semibold', w.showing ? 'text-pri' : 'text-ink-3')}>{status}</div>
        </div>
        {w.wallOptIn && <Toggle checked={!w.wallHidden} onChange={(v) => onPatch({ wallHidden: !v })} />}
      </div>
      {w.wallOptIn && (
        <div className="mt-2 flex gap-1.5">
          <input value={name ?? w.displayName} onChange={(e) => setName(e.target.value.slice(0, 80))} placeholder={w.publicName} aria-label={`Display name for ${w.name}`} className="h-8 min-w-0 flex-1 rounded-lg border border-line bg-bg px-2.5 text-[12px] outline-none focus:border-pri" />
          <button disabled={name === null || name === w.displayName} onClick={() => { onPatch({ displayName: name ?? '' }); setName(null); }} className="h-8 rounded-full border border-line bg-white px-3 text-[12px] font-semibold disabled:opacity-40">Rename</button>
        </div>
      )}
    </div>
  );
}

function AddQuote({ onAdded }: { onAdded: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ quote: '', name: '', role: 'Holiday Konnector' as QuoteRole, organization: '' });
  const add = useMutation({ mutationFn: () => api.admin.addQuote(form), onSuccess: () => { setForm({ quote: '', name: '', role: form.role, organization: '' }); onAdded(); }, onError: (e: Error) => toast(e.message, 'bad') });
  return (
    <Panel>
      <PanelTitle>Add a quote you received</PanelTitle>
      <p className="mt-1.5 text-[13px] text-ink-3">From a text, email or thank-you card. Only add it if the person said it's okay to share. It goes live right away.</p>
      <div className="mt-3 flex gap-1.5">{QUOTE_ROLES.map((r) => <Seg key={r} active={form.role === r} onClick={() => setForm({ ...form, role: r })} className="h-9 px-3.5 text-[13px]">{r}</Seg>)}</div>
      <div className="mt-3 grid gap-3">
        <div><Label htmlFor="q-text">Quote</Label><Textarea id="q-text" className="min-h-20" value={form.quote} onChange={(e) => setForm({ ...form, quote: e.target.value.slice(0, 600) })} /></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><Label htmlFor="q-name" hint="as it should appear">Credit</Label><Input id="q-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value.slice(0, 80) })} placeholder={form.role === 'Konnection family' ? 'A Konnection mom' : 'The Carter Family'} /></div>
          <div><Label htmlFor="q-org" hint="optional">Organization</Label><Input id="q-org" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value.slice(0, 120) })} /></div>
        </div>
        <div className="flex justify-end"><Button size="sm" variant="dark" disabled={form.quote.trim().length < 3 || !form.name.trim()} loading={add.isPending} onClick={() => add.mutate()}>Add quote</Button></div>
      </div>
    </Panel>
  );
}
