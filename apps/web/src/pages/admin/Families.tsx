import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import type { FamilyStatus } from '@bless/shared';
import { api, type AdminFamily } from '@/lib/api';
import { Button, Chip, Dominoes, EmptyState, FamilyArt, Input, Select, Skeleton, useToast } from '@/components/ui';
import { fmtDate, plural } from '@/lib/format';
import { StatusChip , stagger, rise } from './shared.tsx';

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

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={rise} className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="display-tight text-3xl sm:text-4xl">Families</h1>
          <p className="mt-1 text-sm text-ink-3">{q.data ? plural(q.data.length, 'application') : '…'} this season</p>
        </div>
        <a href={api.admin.exportUrl} className="inline-flex h-9 items-center rounded-full border border-line bg-paper px-3.5 text-sm font-semibold hover:border-ink-3">Export CSV</a>
      </motion.div>

      <motion.div variants={rise} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <svg className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="9" r="6" /><path d="m14 14 3 3" strokeLinecap="round" /></svg>
          <Input placeholder="Search family id, nickname, guardian, city, child…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-11 py-3" />
        </div>
        <div className="w-full sm:w-52">
          <Select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="py-3">
            <option value="newest">Newest first</option>
            <option value="waiting">Waiting longest</option>
            <option value="kids">Most kids</option>
          </Select>
        </div>
      </motion.div>
      <motion.div variants={rise} className="rail -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {FILTERS.map((k) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{k === 'Closed' ? 'Withdrawn / Declined' : k} <span className="opacity-60">{counts[k] ?? 0}</span></Chip>
        ))}
      </motion.div>

      {q.isPending ? (
        <div className="space-y-3">{[...Array(5)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : rows.length === 0 ? (
        <EmptyState title="No families match" body={search ? 'Try a different search.' : 'Nothing in this status yet.'} />
      ) : (
        <motion.div variants={rise} className="overflow-hidden rounded-xl2 border border-line/70 bg-paper shadow-soft">
          {/* Desktop table */}
          <table className="hidden w-full text-sm md:table">
            <thead className="bg-cream-2/60 text-left text-xs font-semibold uppercase tracking-wider text-ink-3">
              <tr><th className="px-4 py-3 font-semibold">Family</th><th className="px-3 py-3 font-semibold">Kids</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Sponsor</th><th className="px-3 py-3 text-right font-semibold">Views</th><th className="px-3 py-3 font-semibold">Submitted</th><th className="px-4 py-3" /></tr>
            </thead>
            <tbody className="divide-y divide-line/70">
              {rows.map((f) => (
                <tr key={f.id} onClick={() => nav(`/admin/families/${f.id}`)} className="cursor-pointer transition-colors hover:bg-cream/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <FamilyArt colors={f.public.colors} seed={f.children.length} className="size-10 shrink-0 rounded-xl" />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{f.public.nickname}</div>
                        <div className="text-xs text-ink-3">{f.familyId} · {f.city}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3"><div className="max-w-[14rem] truncate">{f.children.map((c) => `${c.name.split(' ')[0]} (${c.age})`).join(', ')}</div></td>
                  <td className="px-3 py-3"><StatusChip status={f.status} /></td>
                  <td className="px-3 py-3">
                    {f.sponsorship ? (
                      <div><div className="truncate font-medium">{f.sponsorship.sponsor?.name ?? '—'}</div><div className="mt-1"><Dominoes status={f.sponsorship.status} compact /></div></div>
                    ) : <span className="text-ink-3">—</span>}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{f.views}<span className="text-ink-3"> / {f.claimStarts}</span></td>
                  <td className="px-3 py-3 whitespace-nowrap text-ink-2">{fmtDate(f.createdAt)}</td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {f.status === 'Submitted' && (
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="ghost" onClick={() => patch.mutate({ id: f.id, status: 'Needs Info' })}>Needs info</Button>
                        <Button size="sm" variant="pine" onClick={() => patch.mutate({ id: f.id, status: 'Available' })} loading={patch.isPending && patch.variables?.id === f.id}>Approve</Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Mobile cards */}
          <ul className="divide-y divide-line/70 md:hidden">
            {rows.map((f) => (
              <li key={f.id}>
                <Link to={`/admin/families/${f.id}`} className="flex gap-3 p-4">
                  <FamilyArt colors={f.public.colors} seed={f.children.length} className="size-12 shrink-0 rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2"><span className="truncate font-semibold">{f.public.nickname}</span><StatusChip status={f.status} /></div>
                    <div className="mt-0.5 truncate text-xs text-ink-3">{f.familyId} · {f.children.map((c) => `${c.name.split(' ')[0]} (${c.age})`).join(', ')}</div>
                    <div className="mt-1.5 flex items-center gap-3 text-xs text-ink-3">
                      {f.sponsorship ? <><span className="truncate font-medium text-ink-2">{f.sponsorship.sponsor?.name}</span><Dominoes status={f.sponsorship.status} compact /></> : <span>{f.views} views · {fmtDate(f.createdAt)}</span>}
                    </div>
                  </div>
                </Link>
                {f.status === 'Submitted' && (
                  <div className="flex gap-2 px-4 pb-4">
                    <Button size="sm" variant="secondary" full onClick={() => patch.mutate({ id: f.id, status: 'Needs Info' })}>Needs info</Button>
                    <Button size="sm" variant="pine" full onClick={() => patch.mutate({ id: f.id, status: 'Available' })}>Approve</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </motion.div>
      )}
    </motion.div>
  );
}
