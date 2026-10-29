import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SeasonSettings } from '@bless/shared';
import { api } from '@/lib/api';
import { Button, Input, Label, Textarea, Toggle, Skeleton, useToast } from '@/components/ui';
import { Panel, PanelTitle, PageHead } from './shared.tsx';

export default function Settings() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: api.admin.settings });
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: api.admin.me });
  const [form, setForm] = useState<SeasonSettings | null>(null);
  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: (body: SeasonSettings) => api.admin.patchSettings(body),
    onSuccess: () => { toast('Settings saved', 'ok'); qc.invalidateQueries({ queryKey: ['admin'] }); qc.invalidateQueries({ queryKey: ['settings'] }); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });

  if (!form) return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-96" /></div>;
  const set = <K extends keyof SeasonSettings>(k: K, v: SeasonSettings[K]) => setForm({ ...form, [k]: v });
  const dirty = JSON.stringify(form) !== JSON.stringify(q.data);
  const Row = ({ title, body, k }: { title: string; body: string; k: 'catalogOpen' | 'registrationOpen' | 'chipInsEnabled' | 'showPhotos' | 'askFamilyPhoto' | 'adminAlerts' }) => (
    <div className="flex items-start justify-between gap-4"><div><div className="text-[14px] font-semibold">{title}</div><div className="text-[13px] text-ink-3">{body}</div></div><Toggle checked={form[k]} onChange={(v) => set(k, v)} /></div>
  );

  return (
    <div className="anim-rise">
      <PageHead title="Settings" sub="Season details that show up in the catalog, each Holiday Konnector's family page and every message." />
      <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="mt-[22px] grid gap-3.5 lg:grid-cols-5">
        <div className="space-y-3.5 lg:col-span-3">
          <Panel>
            <PanelTitle>Season</PanelTitle>
            <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="season">Season</Label><Input id="season" value={form.season} onChange={(e) => set('season', e.target.value)} /></div>
              <div><Label htmlFor="deadline">Gift drop-off deadline</Label><Input id="deadline" type="date" value={form.dropoffDeadline} onChange={(e) => set('dropoffDeadline', e.target.value)} /></div>
              <div><Label htmlFor="loc">Drop-off location</Label><Input id="loc" value={form.dropoffLocation} onChange={(e) => set('dropoffLocation', e.target.value)} /></div>
              <div><Label htmlFor="hours">Drop-off hours</Label><Input id="hours" value={form.dropoffHours} onChange={(e) => set('dropoffHours', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label htmlFor="budget" hint="shown to Holiday Konnectors">Per-child budget note</Label><Textarea id="budget" className="min-h-20" value={form.perChildBudgetNote} onChange={(e) => set('perChildBudgetNote', e.target.value)} /></div>
            </div>
          </Panel>
          <Panel>
            <PanelTitle>Contact & giving</PanelTitle>
            <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="cname" hint="shown in email footers">Contact name</Label><Input id="cname" value={form.contactName ?? ''} onChange={(e) => set('contactName', e.target.value)} placeholder="Sharnese" /></div>
              <div><Label htmlFor="email">Contact email</Label><Input id="email" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label htmlFor="phone">Contact phone</Label><Input id="phone" type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label htmlFor="donate" hint="general fund">Organization donate URL</Label><Input id="donate" type="url" value={form.orgDonateUrl} onChange={(e) => set('orgDonateUrl', e.target.value)} /></div>
              <div className="sm:col-span-2"><Label htmlFor="chip" hint="opened after a chip-in pledge (Zeffy or Stripe link)">Chip-in checkout URL</Label><Input id="chip" type="url" value={form.chipInUrl} onChange={(e) => set('chipInUrl', e.target.value)} /></div>
            </div>
          </Panel>
        </div>
        <div className="space-y-3.5 lg:col-span-2">
          <Panel>
            <PanelTitle>Open / closed</PanelTitle>
            <div className="mt-3.5 space-y-4">
              <Row title="Catalog open" body="Holiday Konnectors can browse and choose families." k="catalogOpen" />
              <Row title="Registration open" body="Families can submit new applications." k="registrationOpen" />
              <Row title="Chip-ins" body='Show "Chip in" on family pages for partial giving.' k="chipInsEnabled" />
              <Row title="Ask families for a photo" body="Adds an optional photo question to the application. Families can skip it or keep the photo staff-only." k="askFamilyPhoto" />
              <Row title="Show family photos" body="Show approved, non-private photos in the catalog. Off hides every photo." k="showPhotos" />
            </div>
          </Panel>
          <Panel>
            <PanelTitle>Team emails</PanelTitle>
            <div className="mt-3.5 space-y-4">
              <div>
                <Label htmlFor="alerts" hint="comma-separated">Send team emails to</Label>
                <Textarea id="alerts" className="min-h-[72px]" value={form.alertEmails ?? ''} onChange={(e) => set('alertEmails', e.target.value)} placeholder={me.data?.adminEmails?.join(', ') ?? 'Admin emails'} />
                <div className="mt-1.5 text-[12px] leading-[1.5] text-ink-3">{(form.alertEmails ?? '').trim() ? 'Only these addresses get team emails.' : <>Empty means every admin: <b className="text-ink-2">{me.data?.adminEmails?.join(', ') || '…'}</b></>}</div>
              </div>
              <div className="rounded-[14px] bg-soft-2 px-3.5 py-3 text-[13px] leading-[1.5] text-ink-2"><b className="text-ink">Always sent:</b> every Konnector update (shopping, purchased, wrapped, handed off, released) and every note they leave.</div>
              <Row title="Also email activity" body="New applications, new claims and flagged Konnectors. Every email is listed in Emails." k="adminAlerts" />
            </div>
          </Panel>
          <Panel>
            <PanelTitle>Data</PanelTitle>
            <p className="mt-3 text-[13px] leading-[1.5] text-ink-2">
              Records live in {me.data?.store === 'airtable' ? <><b>Airtable</b> (base "Client-TheKonnection-BlessAFamily": Families, Children, Sponsors, Sponsorships, Quotes, Activity, Settings). Edits made directly in Airtable show up here within about 20 seconds.</> : <><b>a local demo store</b>. Set <code className="rounded bg-soft px-1 font-mono text-[12px]">STORE=airtable</code> on the API to use the Airtable base.</>}
            </p>
            <a href={api.admin.exportUrl} className="mt-4 inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[13px] font-semibold hover:border-ink">Export season CSV</a>
          </Panel>
          <div className="sticky bottom-4"><Button type="submit" full size="xl" disabled={!dirty} loading={save.isPending}>{dirty ? 'Save changes' : 'Saved'}</Button></div>
        </div>
      </form>
    </div>
  );
}
