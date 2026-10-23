import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { ClaimRequestSchema, type ClaimRequest, type PublicFamily, type SeasonSettings } from '@bless/shared';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Label, Option, Sheet, Textarea, useToast } from '@/components/ui';
import { fmtDate } from '@/lib/format';

type Form = { name: string; email: string; phone: string; organization: string; preferredContact: 'Email' | 'Text' | 'Call'; note: string; agree: boolean };
const empty: Form = { name: '', email: '', phone: '', organization: '', preferredContact: 'Email', note: '', agree: false };

export function ClaimSheet({ open, onClose, family, settings }: { open: boolean; onClose: () => void; family: PublicFamily; settings?: SeasonSettings }) {
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [conflict, setConflict] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setForm((f) => ({ ...f, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };

  const claim = useMutation({
    mutationFn: (body: ClaimRequest) => api.claim(family.slug, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['catalog'] }); qc.invalidateQueries({ queryKey: ['family', family.slug] }); },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) { setConflict(e.message); qc.invalidateQueries({ queryKey: ['catalog'] }); qc.invalidateQueries({ queryKey: ['family', family.slug] }); return; }
      if (e instanceof ApiError && e.issues) {
        const fe = (e.issues as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {};
        setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])) as typeof errors);
        return;
      }
      toast(e instanceof Error ? e.message : 'Something went wrong', 'bad');
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = ClaimRequestSchema.safeParse(form);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])) as typeof errors);
      return;
    }
    claim.mutate(parsed.data);
  };

  const portal = claim.data ? `${window.location.origin}/s/${claim.data.token}` : '';
  const copy = async () => { try { await navigator.clipboard.writeText(portal); toast('Link copied', 'ok'); } catch { toast('Could not copy', 'bad'); } };

  return (
    <Sheet open={open} onClose={claim.isSuccess ? () => { onClose(); } : onClose} title={claim.isSuccess ? undefined : conflict ? undefined : `Bless ${family.nickname}`}>
      {claim.isSuccess ? (
        <div className="pt-6 text-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className="mx-auto grid size-20 place-items-center rounded-full bg-pine text-white">
            <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.5">
              <motion.path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2 }} />
            </svg>
          </motion.div>
          <h2 className="mt-5 text-3xl">You're in. Thank you.</h2>
          <p className="mt-2 text-ink-2">
            {family.nickname} is yours this holiday. We emailed your family page to <span className="font-semibold text-ink">{form.email}</span>. Every wishlist, every size, and one-tap updates live there.
          </p>
          {settings && (
            <p className="mt-4 rounded-2xl bg-gold-soft px-4 py-3 text-sm text-[#6b4a0a]">
              Drop off gifts by <span className="font-semibold">{fmtDate(settings.dropoffDeadline, { weekday: 'long', month: 'long', day: 'numeric' })}</span> at {settings.dropoffLocation}.
            </p>
          )}
          <div className="mt-6 grid gap-2">
            <Link to={`/s/${claim.data.token}`}><Button size="lg" full>Open my family page</Button></Link>
            <Button size="lg" variant="secondary" full onClick={copy}>Copy link</Button>
          </div>
          <p className="mt-4 text-xs text-ink-3">Save that link. It's private to you and works like a login.</p>
        </div>
      ) : conflict ? (
        <div className="pt-6 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-gold-soft text-3xl">🙏</div>
          <h2 className="mt-5 text-2xl">Someone beat you to it</h2>
          <p className="mt-2 text-ink-2">{conflict}</p>
          <div className="mt-6 grid gap-2">
            <Link to="/families"><Button size="lg" full>See other families</Button></Link>
            <Button size="lg" variant="ghost" full onClick={onClose}>Close</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 pt-2" noValidate>
          <p className="text-[15px] text-ink-2">
            You're claiming all <span className="font-semibold text-ink">{family.childCount === 1 ? '1 child' : `${family.childCount} children`}</span> in this household: {family.children.map((c) => c.name).join(', ')}. Takes 30 seconds.
          </p>
          <div>
            <Label htmlFor="c-name">Your name</Label>
            <Input id="c-name" autoComplete="name" value={form.name} onChange={(e) => set('name', e.target.value)} error={errors.name} placeholder="First and last name" />
          </div>
          <div>
            <Label htmlFor="c-email">Email</Label>
            <Input id="c-email" type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(e) => set('email', e.target.value)} error={errors.email} placeholder="you@example.com" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="c-phone" hint="(optional)">Phone</Label>
              <Input id="c-phone" type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} error={errors.phone} placeholder="(313) 555-0100" />
            </div>
            <div>
              <Label htmlFor="c-org" hint="(optional)">Church, company or group</Label>
              <Input id="c-org" autoComplete="organization" value={form.organization} onChange={(e) => set('organization', e.target.value)} error={errors.organization} />
            </div>
          </div>
          <div>
            <Label>How should we reach you?</Label>
            <div className="grid grid-cols-3 gap-2">
              {(['Email', 'Text', 'Call'] as const).map((m) => (
                <Option key={m} selected={form.preferredContact === m} onClick={() => set('preferredContact', m)} className="justify-center px-3 py-3 text-[15px]">{m}</Option>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="c-note" hint="(optional)">Anything we should know?</Label>
            <Textarea id="c-note" value={form.note} onChange={(e) => set('note', e.target.value)} error={errors.note} className="min-h-20" placeholder="We're a group of 6 coworkers splitting this family." />
          </div>
          <Option multi selected={form.agree} onClick={() => set('agree', !form.agree)} className="items-start">
            <span className="block text-[15px] font-medium leading-snug">I can support every child in this family, not just one.</span>
          </Option>
          {errors.agree && <p className="-mt-2 text-sm text-bad" role="alert">{errors.agree}</p>}
          <Button type="submit" size="lg" full loading={claim.isPending}>Claim this family</Button>
          <p className="text-center text-xs text-ink-3">No payment here. You shop the wishlist yourself and drop gifts off with us.</p>
        </form>
      )}
    </Sheet>
  );
}
