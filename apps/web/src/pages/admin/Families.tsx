import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { familyArt, type FamilyStatus } from '@bless/shared';
import { api, type AdminFamily } from '@/lib/api';
import { Button, Chip, Dominoes, FamilyArt, Input, Select, Skeleton, useToast } from '@/components/ui';
import { fmtDate, plural } from '@/lib/format';
import { PageHead, StatusChip } from './shared.tsx';

type Filter = 'All' | FamilyStatus | 'Closed';
const FILTERS: Filter[] = ['All', 'Submitted', 'Needs Info', 'Available', 'Claimed', 'Fulfilled', 'Closed'];
const matches = (f: AdminFamily, filter: Filter) => filter === 'All' ? true : filter === 'Closed' ? f.status === 'Withdrawn' || f.status === 'Declined' : f.status === filter;

export default function Families() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'families'], queryFn: api.admin.families });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('All');
  const [sort, setSort] = useState<'newest' | 'waiting' | 'kids'>('newest');

  const patch = useMutation({
    mutationFn: ({ id, status }: { id: string; status: FamilyStatus }) => api.admin.patchFamily(id, { status }),
    onSuccess: (_, v) => { toast(v.status === 'Available' ? 'Family approved and listed' : `Marked ${v.status}`, 'ok'); qc.invalidateQueries({ queryKey: ['admin'] }); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });

  const rows = useMemo(() => {
    const all = q.data ?? [];
    const s = search.trim().toLowerCase();
    let out = all.filter((f) => matches(f, filter) && (!s || [f.familyId, f.nickname, f.public.nickname, f.guardianName, f.city, f.email, f.phone, ...f.children.map((c) => c.name)].some((x) => x?.toLowerCase().includes(s))));
    if (sort === 'newest') out = [...out].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sort === 'waiting') out = [...out].sort((a, b) => b.public.daysWaiting - a.public.daysWaiting);
    if (sort === 'kids') out = [...out].sort((a, b) => b.children.length - a.children.length);
    return out;
  }, [q.data, search, filter, sort]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map((k) => [k, (q.data ?? []).filter((f) => matches(f, k)).length])) as Record<Filter, number>, [q.data]);
  const kids = (f: AdminFamily) => f.children.map((c) => `${c.name.split(' ')[0]} (${c.age})`).join(', ');

  return (
    <div className="anim-rise">
      <PageHead title="Families" sub={q.data ? `${plural(q.data.length, 'application')} this season` : '…'} right={<a href={api.admin.exportUrl} className="inline-flex h-10 items-center rounded-full border border-line bg-white px-3.5 text-[13px] font-semibold hover:border-ink">Export CSV</a>} />

      <div className="mt-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-[360px]">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3">⌕</span>
          <Input placeholder="Search id, nickname, guardian, city, child" value={search} onChange={(e) => setSearch(e.target.value)} className="h-[46px] rounded-full bg-white pl-10 text-[14px]" />
        </div>
        <div className="rail -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-1 sm:px-0">
          {FILTERS.map((k) => <Chip key={k} size="lg" active={filter === k} onClick={() => setFilter(k)} tone="outline" className={filter === k ? '' : 'bg-white'}>{k === 'Closed' ? 'Withdrawn / Declined' : k} <span className="opacity-60">{counts[k] ?? 0}</span></Chip>)}
        </div>
        <div className="w-full sm:w-44">
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="h-[46px] rounded-full bg-white text-[14px]">
            <option value="newest">Newest first</option>
            <option value="waiting">Waiting longest</option>
            <option value="kids">Most kids</option>
          </Select>
        </div>
      </div>

      {q.isPending ? (
        <div className="mt-5 space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : rows.length === 0 ? (
        <div className="mt-5 rounded-[28px] border border-dashed border-line bg-white p-10 text-center"><div className="font-bold">No families match that</div><div className="mt-1 text-[13px] text-ink-3">{search ? 'Try a different search.' : 'Nothing in this status yet.'}</div></div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-[24px] border border-line bg-white">
          {/* Desktop table */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[880px] text-[13px]">
              <thead className="text-left text-[11px] font-semibold uppercase tracking-[.06em] text-ink-3">
                <tr className="border-b border-soft"><th className="px-5 py-3 font-semibold">Family</th><th className="px-3 py-3 font-semibold">Kids</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Konnector</th><th className="px-3 py-3 text-right font-semibold">Views</th><th className="px-3 py-3 text-right font-semibold">Chip-ins</th><th className="px-3 py-3 font-semibold">Submitted</th><th className="px-5 py-3" /></tr>
              </thead>
              <tbody>
                {rows.map((f) => (
                  <tr key={f.id} onClick={() => nav(`/admin/families/${f.id}`)} className="cursor-pointer border-b border-soft transition-colors last:border-0 hover:bg-bg">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <FamilyArt art={familyArt(f.public.colors)} photoUrl={f.photoApproved ? f.photoUrl : ''} className="size-10 flex-none rounded-xl" />
                        <div className="min-w-0"><div className="truncate font-bold">{f.public.nickname}</div><div className="text-[11px] text-ink-3">{f.familyId} · {f.city}</div></div>
                      </div>
                    </td>
                    <td className="px-3 py-3"><div className="max-w-[14rem] truncate">{kids(f)}</div></td>
                    <td className="px-3 py-3"><StatusChip status={f.status} /></td>
                    <td className="px-3 py-3">{f.sponsorship ? <div><div className="truncate font-semibold">{f.sponsorship.sponsor?.name ?? '—'}</div><div className="mt-1"><Dominoes status={f.sponsorship.status} compact /></div></div> : <span className="text-ink-3">—</span>}</td>
                    <td className="px-3 py-3 text-right tabular">{f.views}<span className="text-ink-3"> / {f.claimStarts}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 text-right tabular">{f.raised ? <span className="font-semibold text-pri">${f.raised}</span> : <span className="text-ink-3">—</span>}<span className="text-ink-3"> / ${f.public.goal}</span></td>
                    <td className="whitespace-nowrap px-3 py-3 text-ink-2">{fmtDate(f.createdAt)}</td>
                    <td className="px-5 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      {(f.status === 'Submitted' || f.status === 'Needs Info') && (
                        <div className="flex justify-end gap-1.5">
                          {f.status === 'Submitted' && <Button size="xs" variant="ghost" onClick={() => patch.mutate({ id: f.id, status: 'Needs Info' })}>Needs info</Button>}
                          <Button size="xs" onClick={() => patch.mutate({ id: f.id, status: 'Available' })} loading={patch.isPending && patch.variables?.id === f.id}>Approve</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile cards */}
          <ul className="divide-y divide-soft md:hidden">
            {rows.map((f) => (
              <li key={f.id}>
                <Link to={`/admin/families/${f.id}`} className="flex gap-3 p-4">
                  <FamilyArt art={familyArt(f.public.colors)} photoUrl={f.photoApproved ? f.photoUrl : ''} className="size-12 flex-none rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><span className="truncate font-bold">{f.public.nickname}</span><StatusChip status={f.status} /></div>
                    <div className="mt-0.5 truncate text-[12px] text-ink-3">{f.familyId} · {kids(f)}</div>
                    <div className="mt-1.5 flex items-center gap-3 text-[12px] text-ink-3">
                      {f.sponsorship ? <><span className="truncate font-semibold text-ink-2">{f.sponsorship.sponsor?.name}</span><Dominoes status={f.sponsorship.status} compact /></> : <span>{f.views} views · {fmtDate(f.createdAt)}</span>}
                    </div>
                  </div>
                </Link>
                {(f.status === 'Submitted' || f.status === 'Needs Info') && (
                  <div className="flex gap-2 px-4 pb-4">
                    {f.status === 'Submitted' && <Button size="sm" variant="secondary" full onClick={() => patch.mutate({ id: f.id, status: 'Needs Info' })}>Needs info</Button>}
                    <Button size="sm" full onClick={() => patch.mutate({ id: f.id, status: 'Available' })}>Approve</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
