import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { familyNickname, nicknameProblem, type FamilyStatus } from '@bless/shared';
import { NicknameField } from '@/components/NicknameField';
import { api, type AdminFamily } from '@/lib/api';
import { Button, Chip, FamilyArt, Kicker, Skeleton, useToast } from '@/components/ui';
import { familyArt } from '@bless/shared';
import { cx, plural } from '@/lib/format';
import { PageHead } from './shared.tsx';

const ago = (iso: string) => { const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000); return d === 0 ? 'today' : `${d} day${d === 1 ? '' : 's'} ago`; };

export default function Review() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'families'], queryFn: api.admin.families });
  const patch = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Parameters<typeof api.admin.patchFamily>[1] }) => api.admin.patchFamily(id, body),
    onSuccess: (_, v) => { if (v.body.status) toast(v.body.status === 'Available' ? 'Published to the catalog' : `Marked ${v.body.status}`, 'ok'); else if (v.body.nickname) toast('Nickname saved', 'ok'); qc.invalidateQueries({ queryKey: ['admin'] }); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });
  const rows = (q.data ?? []).filter((f) => f.status === 'Submitted' || f.status === 'Needs Info').sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return (
    <div className="anim-rise">
      <PageHead title="Review queue" sub="New applications. Approve to publish in the catalog; the public projection never includes guardian name, phone or address." />
      {q.isPending ? (
        <div className="mt-[22px] grid gap-3.5 md:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-96" />)}</div>
      ) : rows.length === 0 ? (
        <div className="mt-[22px] rounded-[20px] bg-soft p-[30px] text-center font-semibold text-pri-dark">Queue is empty. Every application has been reviewed.</div>
      ) : (
        <div className="mt-[22px] grid gap-3.5 md:grid-cols-2">
          {rows.map((f) => <ReviewCard key={f.id} f={f} pending={patch.isPending && patch.variables?.id === f.id} onPatch={(body) => patch.mutate({ id: f.id, body })} />)}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ f, onPatch, pending }: { f: AdminFamily; onPatch: (body: Parameters<typeof api.admin.patchFamily>[1]) => void; pending: boolean }) {
  const art = familyArt(f.public.colors);
  const [renaming, setRenaming] = useState(false);
  const [nick, setNick] = useState(f.public.nickname);
  const priv = { guardianName: f.guardianName, childNames: f.children.map((k) => k.name) };
  const needsInfo = f.status === 'Needs Info';
  const toggle = (on: boolean) => cx('h-[34px] flex-none rounded-full border px-3 text-[12px] font-semibold transition-all duration-200', on ? 'border-pri bg-pri text-white' : 'border-line bg-white text-ink hover:border-ink-3');
  const photoNote = !f.photoUrl ? 'No photo submitted.' : f.photoApproved ? 'Will show on the public card.' : 'Check: no faces of minors unless consent box was ticked.';
  return (
    <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3.5 rounded-[24px] border border-line bg-white p-[22px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Kicker>{f.familyId} · submitted {ago(f.createdAt)}</Kicker>
          {renaming ? (
            <form className="mt-1.5" onSubmit={(e) => { e.preventDefault(); if (nicknameProblem(nick, priv)) return; onPatch({ nickname: nick.trim() }); setRenaming(false); }}>
              <NicknameField id={`nick-${f.id}`} value={nick} onChange={setNick} defaultName={familyNickname(f.familyId)} priv={priv} size="sm" autoFocus />
              <div className="mt-2 flex gap-2"><Button type="submit" size="xs" variant="dark" disabled={!!nicknameProblem(nick, priv)}>Save</Button><Button type="button" size="xs" variant="ghost" onClick={() => { setRenaming(false); setNick(f.public.nickname); }}>Cancel</Button></div>
            </form>
          ) : (
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h3 className="text-[24px] tracking-[-.035em]"><Link to={`/admin/families/${f.id}`} className="hover:underline">{f.public.nickname}</Link></h3>
              <button onClick={() => setRenaming(true)} className="rounded-full border border-line px-2.5 py-1 text-[12px] font-semibold text-ink-3 hover:border-ink hover:text-ink">Rename</button>
            </div>
          )}
          <div className="mt-0.5 text-[13px] text-ink-3">{f.public.kidLine} · {f.city}</div>
        </div>
        <Chip tone={needsInfo ? 'warn' : 'soft'} className="flex-none">{f.status}</Chip>
      </div>
      <div className="grid grid-cols-2 gap-1.5 rounded-[14px] bg-bg px-3.5 py-3 text-[13px]">
        <div><span className="text-[10px] font-semibold uppercase tracking-[.08em] text-ink-3">Private · guardian</span><div className="mt-0.5 font-semibold">{f.guardianName}</div></div>
        <div><span className="text-[10px] font-semibold uppercase tracking-[.08em] text-ink-3">Private · contact</span><div className="mt-0.5 font-semibold">{f.phone}{f.email ? <span className="block truncate text-[12px] font-normal text-ink-2">{f.email}</span> : null}</div></div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {f.children.map((k) => <Chip key={k.id} tone="soft" size="lg">{k.name.split(' ')[0]}, {k.age} · {k.clothingCategory} {k.shirtSize} · shoe {k.shoeSize}</Chip>)}
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-line p-3.5">
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">Family story</div>
          <p className="mt-1.5 text-[14px] leading-[1.5]">“{f.familyStory || '(no story provided)'}”</p>
        </div>
        <button className={toggle(f.storyApproved)} disabled={!f.familyStory || pending} onClick={() => onPatch({ storyApproved: !f.storyApproved })}>{f.storyApproved ? 'Story approved ✓' : 'Approve story'}</button>
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-line p-3.5">
        <FamilyArt art={art} photoUrl={f.photoUrl} className="h-[54px] w-[72px] flex-none rounded-[10px]" />
        <div className="flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-[.08em] text-ink-3">Family photo</div>
          <div className="mt-0.5 text-[13px] text-ink-2">{photoNote}</div>
        </div>
        <button className={toggle(f.photoApproved)} disabled={!f.photoUrl || pending} onClick={() => onPatch({ photoApproved: !f.photoApproved })}>{f.photoApproved ? 'Photo approved ✓' : 'Approve photo'}</button>
      </div>
      <div className="flex gap-2">
        <Button className="h-[46px] flex-1 text-[14px] font-bold" onClick={() => onPatch({ status: 'Available' as FamilyStatus })} loading={pending}>Approve & publish</Button>
        {!needsInfo && <Button variant="secondary" className="h-[46px] px-4 text-[14px]" onClick={() => onPatch({ status: 'Needs Info' })} disabled={pending}>Needs info</Button>}
        {needsInfo && <Button variant="danger" className="h-[46px] px-4 text-[14px]" onClick={() => { if (window.confirm(`Decline ${f.familyId}?`)) onPatch({ status: 'Declined' }); }} disabled={pending}>Decline</Button>}
      </div>
      <div className="text-[11px] text-ink-3">{plural(f.children.length, 'child', 'children')} · {f.transportation === 'Yes' ? 'can pick up' : 'needs delivery'} · {f.address}, {f.zip}</div>
    </div>
  );
}
