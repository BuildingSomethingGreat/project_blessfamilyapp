import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import type { SeasonSettings } from '@bless/shared';
import { api } from '@/lib/api';
import { Button, Card, Input, Label, Textarea, Toggle, Skeleton, useToast } from '@/components/ui';
import { SectionTitle , stagger, rise } from './shared.tsx';

export default function Settings() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: api.admin.settings });
  const me = useQuery({ queryKey: ['admin', 'me'], queryFn: api.admin.me });
  const [form, setForm] = useState<SeasonSettings | null>(null);
  useEffect(() => { if (q.data) setForm(q.data); }, [q.data]);

  const save = useMutation({
    mutationFn: (body: SeasonSettings) => api.admin.patchSettings(body),
    onSuccess: () => { toast('Settings saved', 'ok'); qc.invalidateQueries({ queryKey: ['admin'] }); },
    onError: (e: Error) => toast(e.message, 'bad'),
  });

  if (!form) return <div className="space-y-4"><Skeleton className="h-10 w-48" /><Skeleton className="h-96" /></div>;
  const set = <K extends keyof SeasonSettings>(k: K, v: SeasonSettings[K]) => setForm({ ...form, [k]: v });
  const dirty = JSON.stringify(form) !== JSON.stringify(q.data);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-5">
      <motion.div variants={rise}>
        <h1 className="display-tight text-3xl sm:text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-ink-3">Season details that show up in the catalog, the sponsor portal and every email.</p>
      </motion.div>

      <form onSubmit={(e) => { e.preventDefault(); save.mutate(form); }} className="grid gap-5 lg:grid-cols-5">
        <div className="space-y-5 lg:col-span-3">
          <motion.div variants={rise}>
            <Card className="p-5">
              <SectionTitle>Season</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label htmlFor="season">Season</Label><Input id="season" value={form.season} onChange={(e) => set('season', e.target.value)} /></div>
                <div><Label htmlFor="deadline">Gift drop-off deadline</Label><Input id="deadline" type="date" value={form.dropoffDeadline} onChange={(e) => set('dropoffDeadline', e.target.value)} /></div>
                <div><Label htmlFor="loc">Drop-off location</Label><Input id="loc" value={form.dropoffLocation} onChange={(e) => set('dropoffLocation', e.target.value)} /></div>
                <div><Label htmlFor="hours">Drop-off hours</Label><Input id="hours" value={form.dropoffHours} onChange={(e) => set('dropoffHours', e.target.value)} /></div>
                <div className="sm:col-span-2"><Label htmlFor="budget" hint="shown to sponsors">Per-child budget note</Label><Textarea id="budget" className="min-h-20" value={form.perChildBudgetNote} onChange={(e) => set('perChildBudgetNote', e.target.value)} /></div>
              </div>
            </Card>
          </motion.div>
          <motion.div variants={rise}>
            <Card className="p-5">
              <SectionTitle>Contact</SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label htmlFor="email">Contact email</Label><Input id="email" type="email" value={form.contactEmail} onChange={(e) => set('contactEmail', e.target.value)} /></div>
                <div><Label htmlFor="phone">Contact phone</Label><Input id="phone" type="tel" value={form.contactPhone} onChange={(e) => set('contactPhone', e.target.value)} /></div>
                <div className="sm:col-span-2"><Label htmlFor="donate" hint="for people who can't sponsor a whole family">Organization donate URL</Label><Input id="donate" type="url" value={form.orgDonateUrl} onChange={(e) => set('orgDonateUrl', e.target.value)} /></div>
              </div>
            </Card>
          </motion.div>
        </div>
        <div className="space-y-5 lg:col-span-2">
          <motion.div variants={rise}>
            <Card className="p-5">
              <SectionTitle>Open / closed</SectionTitle>
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-4"><div><div className="font-semibold">Catalog open</div><div className="text-sm text-ink-3">Sponsors can browse and claim families.</div></div><Toggle checked={form.catalogOpen} onChange={(v) => set('catalogOpen', v)} /></div>
                <div className="flex items-start justify-between gap-4"><div><div className="font-semibold">Registration open</div><div className="text-sm text-ink-3">Families can submit new applications.</div></div><Toggle checked={form.registrationOpen} onChange={(v) => set('registrationOpen', v)} /></div>
              </div>
            </Card>
          </motion.div>
          <motion.div variants={rise}>
            <Card className="p-5">
              <SectionTitle>Data</SectionTitle>
              <p className="text-sm text-ink-2">
                Records live in {me.data?.store === 'airtable' ? <><span className="font-semibold">Airtable</span> (base "Client-TheKonnection-BlessAFamily": Families, Children, Sponsors, Sponsorships, Activity, Settings). Edits made directly in Airtable show up here within about 20 seconds.</> : <><span className="font-semibold">a local demo store</span>. Set <code className="rounded bg-cream-2 px-1 font-mono text-xs">STORE=airtable</code> on the API to use the Airtable base.</>}
              </p>
              <a href={api.admin.exportUrl} className="mt-4 inline-flex h-10 items-center rounded-full border border-line bg-paper px-4 text-sm font-semibold hover:border-ink-3">Export season CSV</a>
            </Card>
          </motion.div>
          <motion.div variants={rise} className="sticky bottom-24 lg:bottom-6">
            <Button type="submit" full size="lg" disabled={!dirty} loading={save.isPending}>{dirty ? 'Save changes' : 'Saved'}</Button>
          </motion.div>
        </div>
      </form>
    </motion.div>
  );
}
