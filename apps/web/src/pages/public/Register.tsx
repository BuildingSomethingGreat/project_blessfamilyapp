import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChildInputSchema, FamilyApplicationSchema, CLOTHING_CATEGORIES, CLOTHING_OPTIONS, CLOTHING_SIZES, CONTACT_METHODS, GENDERS, GIFT_OPTIONS, OTHER_SIZE, SHOE_SIZES,
  type ClothingCategory, type FamilyApplication,
} from '@bless/shared';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Label, Logo, Option, Progress, Select, Textarea, useToast } from '@/components/ui';
import { cx } from '@/lib/format';

/* ------------------------------------------------------------------ */
/* Draft model                                                         */
/* ------------------------------------------------------------------ */
type ChildDraft = {
  name: string; age: string; gender: '' | 'Male' | 'Female'; clothingCategory: '' | ClothingCategory; shirtSize: string; pantsSize: string; shoeCategory: '' | ClothingCategory; shoeSize: string;
  sizeNotes: string; favoriteColor: string; hobbies: string; clothingWishlist: string[]; otherClothing: string; giftTypes: string[]; specificGifts: string;
};
type Draft = {
  eligibilityConfirmed: boolean; guardianName: string; phone: string; preferredContact: 'Text' | 'Call' | 'Email'; email: string; address: string; city: string; state: string; zip: string;
  transportation: '' | 'Yes' | 'No'; children: ChildDraft[]; familyStory: string; notes: string;
};
const blankChild = (): ChildDraft => ({ name: '', age: '', gender: '', clothingCategory: '', shirtSize: '', pantsSize: '', shoeCategory: '', shoeSize: '', sizeNotes: '', favoriteColor: '', hobbies: '', clothingWishlist: [], otherClothing: '', giftTypes: [], specificGifts: '' });
const blankDraft = (): Draft => ({ eligibilityConfirmed: false, guardianName: '', phone: '', preferredContact: 'Text', email: '', address: '', city: '', state: 'MI', zip: '', transportation: '', children: [blankChild()], familyStory: '', notes: '' });
const KEY = 'baf-register-draft';

type StepKind = 'intro' | 'name' | 'phone' | 'contact' | 'email' | 'address' | 'cityzip' | 'transport' | 'child-basics' | 'child-sizes' | 'child-likes' | 'child-clothes' | 'child-gifts' | 'add-child' | 'story' | 'notes' | 'review';
type Step = { kind: StepKind; child?: number };

function buildSteps(d: Draft): Step[] {
  const s: Step[] = [{ kind: 'intro' }, { kind: 'name' }, { kind: 'phone' }, { kind: 'contact' }, { kind: 'email' }, { kind: 'address' }, { kind: 'cityzip' }, { kind: 'transport' }];
  d.children.forEach((_, i) => s.push({ kind: 'child-basics', child: i }, { kind: 'child-sizes', child: i }, { kind: 'child-likes', child: i }, { kind: 'child-clothes', child: i }, { kind: 'child-gifts', child: i }));
  s.push({ kind: 'add-child' }, { kind: 'story' }, { kind: 'notes' }, { kind: 'review' });
  return s;
}

const Child = ChildInputSchema.innerType().shape;
const Fam = FamilyApplicationSchema.shape;
type Errors = Record<string, string | undefined>;
const first = (r: { success: boolean; error?: { issues: { message: string }[] } }) => (r.success ? undefined : r.error?.issues[0]?.message);

function validateStep(step: Step, d: Draft): Errors {
  const e: Errors = {};
  const c = step.child !== undefined ? d.children[step.child] : undefined;
  switch (step.kind) {
    case 'intro': if (!d.eligibilityConfirmed) e.eligibilityConfirmed = 'Please confirm household eligibility to continue'; break;
    case 'name': e.guardianName = first(Fam.guardianName.safeParse(d.guardianName)); break;
    case 'phone': e.phone = first(Fam.phone.safeParse(d.phone)); break;
    case 'email': e.email = first(Fam.email.safeParse(d.email)); break;
    case 'address': e.address = first(Fam.address.safeParse(d.address)); break;
    case 'cityzip': e.city = first(Fam.city.safeParse(d.city)); e.state = first(Fam.state.safeParse(d.state)); e.zip = first(Fam.zip.safeParse(d.zip)); break;
    case 'transport': if (!d.transportation) e.transportation = 'Pick one'; break;
    case 'child-basics':
      e.name = first(Child.name.safeParse(c!.name));
      e.age = c!.age === '' ? 'How old is this child?' : first(Child.age.safeParse(c!.age));
      if (!c!.gender) e.gender = 'Pick one';
      break;
    case 'child-sizes': {
      if (!c!.clothingCategory) e.clothingCategory = 'Pick a clothing category';
      if (!c!.shirtSize) e.shirtSize = 'Pick a shirt size';
      if (!c!.pantsSize) e.pantsSize = 'Pick a pants size';
      if (!c!.shoeCategory) e.shoeCategory = 'Pick a shoe category';
      if (!c!.shoeSize) e.shoeSize = 'Pick a shoe size';
      if ([c!.shirtSize, c!.pantsSize, c!.shoeSize].includes(OTHER_SIZE) && !c!.sizeNotes.trim()) e.sizeNotes = 'Tell us a little more about sizing so a sponsor can shop confidently';
      break;
    }
    case 'story': e.familyStory = first(Fam.familyStory.safeParse(d.familyStory)); break;
    case 'notes': e.notes = first(Fam.notes.safeParse(d.notes)); break;
    default: break;
  }
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v));
}

function toApplication(d: Draft): unknown {
  return {
    ...d, children: d.children.map((c) => ({ ...c, age: Number(c.age) })),
  };
}

/* ------------------------------------------------------------------ */
/* Screen chrome                                                       */
/* ------------------------------------------------------------------ */
function Screen({ eyebrow, title, hint, children }: { eyebrow?: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-xl">
      {eyebrow && <p className="text-sm font-semibold uppercase tracking-wider text-ember">{eyebrow}</p>}
      <h1 className="display-tight mt-2 text-3xl leading-tight sm:text-5xl">{title}</h1>
      {hint && <p className="mt-3 text-[16px] text-ink-2">{hint}</p>}
      <div className="mt-7">{children}</div>
    </div>
  );
}

function ChipGroup({ options, value, onChange }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <button key={o} type="button" role="checkbox" aria-checked={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
            className={cx('rounded-full border px-4 py-2.5 text-[15px] font-medium transition-all duration-200 active:scale-[0.97]', on ? 'border-ink bg-ink text-cream shadow-soft' : 'border-line bg-paper text-ink hover:border-ink-3')}>
            {o}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Register() {
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: api.settings });
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [idx, setIdx] = useState(0);
  const [dir, setDir] = useState(1);
  const [errors, setErrors] = useState<Errors>({});
  const [resume, setResume] = useState<{ draft: Draft; idx: number } | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const steps = useMemo(() => buildSteps(draft), [draft]);
  const step = steps[Math.min(idx, steps.length - 1)];
  const screenRef = useRef<HTMLDivElement>(null);

  // Resume prompt
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { draft: Draft; idx: number };
        if (saved?.draft && (saved.draft.guardianName || saved.idx > 0)) setResume(saved);
      }
    } catch { /* ignore */ }
  }, []);
  // Persist
  useEffect(() => {
    if (done || resume) return;
    try { localStorage.setItem(KEY, JSON.stringify({ draft, idx })); } catch { /* ignore */ }
  }, [draft, idx, done, resume]);
  // Autofocus first field on each screen
  useEffect(() => {
    const t = setTimeout(() => {
      const el = screenRef.current?.querySelector<HTMLElement>('input:not([type=checkbox]), textarea, select');
      if (el && window.matchMedia('(min-width: 640px)').matches) el.focus();
    }, 260);
    return () => clearTimeout(t);
  }, [idx]);

  const update = (patch: Partial<Draft>) => { setDraft((d) => ({ ...d, ...patch })); setErrors({}); };
  const updateChild = (i: number, patch: Partial<ChildDraft>) => { setDraft((d) => ({ ...d, children: d.children.map((c, j) => (j === i ? { ...c, ...patch } : c)) })); setErrors({}); };

  const go = useCallback((to: number) => { setDir(to > idx ? 1 : -1); setIdx(Math.max(0, Math.min(steps.length - 1, to))); setErrors({}); }, [idx, steps.length]);
  const next = useCallback(() => {
    const e = validateStep(step, draft);
    if (Object.keys(e).length) { setErrors(e); return; }
    go(idx + 1);
  }, [step, draft, idx, go]);
  const back = () => go(idx - 1);

  // Keyboard: Enter on inputs, ⌘/Ctrl+Enter anywhere
  useEffect(() => {
    const h = (ev: KeyboardEvent) => {
      if (ev.key !== 'Enter') return;
      const t = ev.target as HTMLElement;
      const inTextarea = t.tagName === 'TEXTAREA';
      if ((ev.metaKey || ev.ctrlKey) || (!inTextarea && ['INPUT', 'SELECT'].includes(t.tagName))) {
        if (step.kind === 'review') return;
        ev.preventDefault();
        next();
      }
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [next, step.kind]);

  const submit = useMutation({
    mutationFn: () => api.register(toApplication(draft) as FamilyApplication),
    onSuccess: (r) => { setDone(r.familyId); try { localStorage.removeItem(KEY); } catch { /* ignore */ } },
    onError: (e) => {
      if (e instanceof ApiError && e.issues) {
        const fe = (e.issues as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {};
        const key = Object.keys(fe)[0];
        const map: Record<string, StepKind> = { eligibilityConfirmed: 'intro', guardianName: 'name', phone: 'phone', email: 'email', address: 'address', city: 'cityzip', state: 'cityzip', zip: 'cityzip', transportation: 'transport', children: 'child-basics', familyStory: 'story', notes: 'notes' };
        const target = steps.findIndex((s) => s.kind === (map[key] ?? 'review'));
        if (target >= 0) go(target);
        toast(fe[key]?.[0] ?? e.message, 'bad');
        return;
      }
      toast(e instanceof Error ? e.message : 'Something went wrong', 'bad');
    },
  });

  const doSubmit = () => {
    const parsed = FamilyApplicationSchema.safeParse(toApplication(draft));
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      const path = issue.path;
      if (path[0] === 'children' && typeof path[1] === 'number') {
        const f = String(path[2] ?? '');
        const kind: StepKind = ['name', 'age', 'gender'].includes(f) ? 'child-basics' : ['clothingCategory', 'shirtSize', 'pantsSize', 'shoeCategory', 'shoeSize', 'sizeNotes'].includes(f) ? 'child-sizes' : ['favoriteColor', 'hobbies'].includes(f) ? 'child-likes' : ['clothingWishlist', 'otherClothing'].includes(f) ? 'child-clothes' : 'child-gifts';
        go(steps.findIndex((s) => s.kind === kind && s.child === path[1]));
      } else {
        const map: Record<string, StepKind> = { eligibilityConfirmed: 'intro', guardianName: 'name', phone: 'phone', email: 'email', address: 'address', city: 'cityzip', state: 'cityzip', zip: 'cityzip', transportation: 'transport', familyStory: 'story', notes: 'notes', children: 'add-child' };
        go(steps.findIndex((s) => s.kind === map[String(path[0])]));
      }
      toast(issue.message, 'bad');
      return;
    }
    submit.mutate();
  };

  const progress = done ? 1 : idx / (steps.length - 1);

  /* ---------- closed / resume / success ---------- */
  if (settings && !settings.registrationOpen) {
    return (
      <Shell progress={0}>
        <Screen eyebrow="Bless-A-Family" title="Registration is closed for this season." hint="Thank you for your interest. Reach out to The Konnection and we'll let you know when applications open again.">
          <Link to="/"><Button size="lg">Back home</Button></Link>
        </Screen>
      </Shell>
    );
  }
  if (done) {
    return (
      <Shell progress={1}>
        <div className="mx-auto w-full max-w-xl text-center">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 18 }} className="mx-auto grid size-20 place-items-center rounded-full bg-pine text-white">
            <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="currentColor" strokeWidth="2.5"><motion.path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 0.2 }} /></svg>
          </motion.div>
          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-pine">Application received</p>
          <h1 className="display-tight mt-2 text-4xl sm:text-6xl">You're all set.</h1>
          <p className="mt-4 text-lg text-ink-2">Your family number is</p>
          <p className="display mt-1 text-4xl text-ember">{done}</p>
          <div className="mt-8 rounded-xl3 border border-line bg-paper p-6 text-left shadow-soft">
            <h2 className="text-xl">What happens next</h2>
            <ol className="mt-3 space-y-2 text-[15px] text-ink-2">
              <li><span className="font-semibold text-ink">1.</span> Our team reviews your application, usually within a few days.</li>
              <li><span className="font-semibold text-ink">2.</span> Once approved, your family is listed for sponsors by first names and ages only.</li>
              <li><span className="font-semibold text-ink">3.</span> When a sponsor chooses your family, we'll reach you by {draft.preferredContact.toLowerCase()} to arrange delivery.</li>
            </ol>
          </div>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Link to="/"><Button size="lg" variant="secondary">Back home</Button></Link>
            <Button size="lg" variant="ghost" onClick={() => { setDraft(blankDraft()); setIdx(0); setDone(null); }}>Start another application</Button>
          </div>
        </div>
      </Shell>
    );
  }
  if (resume) {
    return (
      <Shell progress={resume.idx / Math.max(1, buildSteps(resume.draft).length - 1)}>
        <Screen eyebrow="Welcome back" title="Resume where you left off?" hint="We saved your answers on this device.">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button size="lg" onClick={() => { setDraft(resume.draft); setIdx(Math.min(resume.idx, buildSteps(resume.draft).length - 1)); setResume(null); }}>Resume</Button>
            <Button size="lg" variant="secondary" onClick={() => { try { localStorage.removeItem(KEY); } catch { /* ignore */ } setResume(null); }}>Start over</Button>
          </div>
        </Screen>
      </Shell>
    );
  }

  /* ---------- screens ---------- */
  const c = step.child !== undefined ? draft.children[step.child] : null;
  const ci = step.child ?? 0;
  const childLabel = c ? `Child ${ci + 1}${c.name ? ` · ${c.name.split(' ')[0]}` : ''}` : '';
  const sizeList = (cat: '' | ClothingCategory) => (cat ? [...CLOTHING_SIZES[cat], OTHER_SIZE] : []);
  const shoeList = (cat: '' | ClothingCategory) => (cat ? [...SHOE_SIZES[cat], OTHER_SIZE] : []);

  let body: React.ReactNode = null;
  switch (step.kind) {
    case 'intro':
      body = (
        <Screen eyebrow={`Bless-A-Family ${settings?.season ?? ''}`} title="Let's get your family on the list." hint="About 10 minutes. One application per household. You can stop and come back any time on this device.">
          <div className="rounded-xl3 bg-gold-soft p-5 text-[15px] text-[#4d3607]">
            <p className="font-semibold">Who can be included</p>
            <p className="mt-1">Only children under 18 who currently live in your immediate household. Please don't include children who live elsewhere, including nieces, nephews, grandchildren or cousins. Each child may only appear on one application.</p>
          </div>
          <div className="mt-4">
            <Option multi selected={draft.eligibilityConfirmed} onClick={() => update({ eligibilityConfirmed: !draft.eligibilityConfirmed })} className="items-start">
              <span className="block text-[15px] leading-snug">I confirm that every child listed is under 18, lives in my immediate household, and has not been included on another Bless-A-Family application to my knowledge.</span>
            </Option>
            {errors.eligibilityConfirmed && <p className="mt-2 text-sm text-bad" role="alert">{errors.eligibilityConfirmed}</p>}
          </div>
        </Screen>
      );
      break;
    case 'name':
      body = (
        <Screen eyebrow="About you" title="What's your full name?" hint="Parent or guardian completing this application.">
          <Input autoComplete="name" value={draft.guardianName} onChange={(e) => update({ guardianName: e.target.value })} error={errors.guardianName} placeholder="First and last name" className="!text-xl !py-4" />
        </Screen>
      );
      break;
    case 'phone':
      body = (
        <Screen eyebrow="About you" title="Best phone number to reach you?" hint="We'll use it to coordinate delivery once a sponsor chooses your family.">
          <Input type="tel" inputMode="tel" autoComplete="tel" value={draft.phone} onChange={(e) => update({ phone: e.target.value })} error={errors.phone} placeholder="(313) 555-0100" className="!text-xl !py-4" />
        </Screen>
      );
      break;
    case 'contact':
      body = (
        <Screen eyebrow="About you" title="How do you prefer we contact you?">
          <div className="grid gap-2">
            {CONTACT_METHODS.map((m) => <Option key={m} selected={draft.preferredContact === m} onClick={() => update({ preferredContact: m })}>{m}</Option>)}
          </div>
        </Screen>
      );
      break;
    case 'email':
      body = (
        <Screen eyebrow="About you" title="Email address?" hint="Optional. We'll send a confirmation and updates here if you add one.">
          <Input type="email" inputMode="email" autoComplete="email" value={draft.email} onChange={(e) => update({ email: e.target.value })} error={errors.email} placeholder="you@example.com" className="!text-xl !py-4" />
        </Screen>
      );
      break;
    case 'address':
      body = (
        <Screen eyebrow="Your home" title="What's your home address?" hint="Street address only on this screen. Your address is never shown publicly and sponsors never receive it.">
          <Input autoComplete="street-address" value={draft.address} onChange={(e) => update({ address: e.target.value })} error={errors.address} placeholder="123 Main St, Apt 4" className="!text-xl !py-4" />
        </Screen>
      );
      break;
    case 'cityzip':
      body = (
        <Screen eyebrow="Your home" title="City, state and ZIP?">
          <div className="grid gap-4">
            <div><Label htmlFor="r-city">City</Label><Input id="r-city" autoComplete="address-level2" value={draft.city} onChange={(e) => update({ city: e.target.value })} error={errors.city} /></div>
            <div className="grid grid-cols-[6rem_1fr] gap-3">
              <div><Label htmlFor="r-state">State</Label><Input id="r-state" autoComplete="address-level1" maxLength={2} value={draft.state} onChange={(e) => update({ state: e.target.value.toUpperCase() })} error={errors.state} className="uppercase" /></div>
              <div><Label htmlFor="r-zip">ZIP code</Label><Input id="r-zip" inputMode="numeric" autoComplete="postal-code" value={draft.zip} onChange={(e) => update({ zip: e.target.value })} error={errors.zip} placeholder="48201" /></div>
            </div>
          </div>
        </Screen>
      );
      break;
    case 'transport':
      body = (
        <Screen eyebrow="Your home" title="Do you have reliable transportation?" hint="This helps us plan how gifts get to you.">
          <div className="grid grid-cols-2 gap-2">
            {(['Yes', 'No'] as const).map((v) => <Option key={v} selected={draft.transportation === v} onClick={() => update({ transportation: v })} className="justify-center py-5 text-lg">{v}</Option>)}
          </div>
          {errors.transportation && <p className="mt-2 text-sm text-bad" role="alert">{errors.transportation}</p>}
        </Screen>
      );
      break;
    case 'child-basics':
      body = (
        <Screen eyebrow={childLabel} title={ci === 0 ? "Let's start with your first child." : 'Tell us about this child.'} hint="Only their first name and age are ever shown to sponsors.">
          <div className="grid gap-4">
            <div><Label htmlFor="k-name">Child's full name</Label><Input id="k-name" value={c!.name} onChange={(e) => updateChild(ci, { name: e.target.value })} error={errors.name} placeholder="First and last name" /></div>
            <div className="grid grid-cols-[7rem_1fr] gap-3 items-start">
              <div><Label htmlFor="k-age">Age</Label><Input id="k-age" type="number" inputMode="numeric" min={0} max={17} value={c!.age} onChange={(e) => updateChild(ci, { age: e.target.value })} error={errors.age} /></div>
              <div>
                <Label>Gender</Label>
                <div className="grid grid-cols-2 gap-2">
                  {GENDERS.map((g) => <Option key={g} selected={c!.gender === g} onClick={() => updateChild(ci, { gender: g })} className="justify-center py-3.5">{g === 'Male' ? 'Boy' : 'Girl'}</Option>)}
                </div>
                {errors.gender && <p className="mt-1.5 text-sm text-bad" role="alert">{errors.gender}</p>}
              </div>
            </div>
          </div>
        </Screen>
      );
      break;
    case 'child-sizes':
      body = (
        <Screen eyebrow={childLabel} title={`What sizes does ${c!.name.split(' ')[0] || 'this child'} wear?`} hint="Please select the category and exact size, e.g. Youth / Kids 12, Toddler 3T, Women's 2X, Men's 2XL.">
          <div className="grid gap-4">
            <div>
              <Label>Clothing category</Label>
              <div className="flex flex-wrap gap-2">
                {CLOTHING_CATEGORIES.map((cat) => (
                  <button key={cat} type="button" onClick={() => updateChild(ci, { clothingCategory: cat, shirtSize: '', pantsSize: '', shoeCategory: c!.shoeCategory || cat, shoeSize: c!.shoeCategory ? c!.shoeSize : '' })}
                    className={cx('rounded-full border px-4 py-2.5 text-[15px] font-medium transition-all active:scale-[0.97]', c!.clothingCategory === cat ? 'border-ink bg-ink text-cream' : 'border-line bg-paper hover:border-ink-3')}>{cat}</button>
                ))}
              </div>
              {errors.clothingCategory && <p className="mt-1.5 text-sm text-bad" role="alert">{errors.clothingCategory}</p>}
            </div>
            <AnimatePresence initial={false}>
              {c!.clothingCategory && (
                <motion.div key="sizes" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="grid grid-cols-2 gap-3 overflow-hidden">
                  <div><Label htmlFor="k-shirt">Shirt / top</Label>
                    <Select id="k-shirt" value={c!.shirtSize} onChange={(e) => updateChild(ci, { shirtSize: e.target.value })} error={errors.shirtSize}><option value="">Select</option>{sizeList(c!.clothingCategory).map((s) => <option key={s}>{s}</option>)}</Select></div>
                  <div><Label htmlFor="k-pants">Pants / bottom</Label>
                    <Select id="k-pants" value={c!.pantsSize} onChange={(e) => updateChild(ci, { pantsSize: e.target.value })} error={errors.pantsSize}><option value="">Select</option>{sizeList(c!.clothingCategory).map((s) => <option key={s}>{s}</option>)}</Select></div>
                </motion.div>
              )}
            </AnimatePresence>
            <div className="grid grid-cols-2 gap-3">
              <div><Label htmlFor="k-shoecat">Shoe category</Label>
                <Select id="k-shoecat" value={c!.shoeCategory} onChange={(e) => updateChild(ci, { shoeCategory: e.target.value as ClothingCategory, shoeSize: '' })} error={errors.shoeCategory}><option value="">Select</option>{CLOTHING_CATEGORIES.map((s) => <option key={s}>{s}</option>)}</Select></div>
              <div><Label htmlFor="k-shoe">Shoe size</Label>
                <Select id="k-shoe" value={c!.shoeSize} onChange={(e) => updateChild(ci, { shoeSize: e.target.value })} error={errors.shoeSize} disabled={!c!.shoeCategory}><option value="">Select</option>{shoeList(c!.shoeCategory).map((s) => <option key={s}>{s}</option>)}</Select></div>
            </div>
            <div>
              <Label htmlFor="k-sizenotes" hint={[c!.shirtSize, c!.pantsSize, c!.shoeSize].includes(OTHER_SIZE) ? '(required)' : '(if needed)'}>Size clarifications</Label>
              <Textarea id="k-sizenotes" value={c!.sizeNotes} onChange={(e) => updateChild(ci, { sizeNotes: e.target.value })} error={errors.sizeNotes} className="min-h-20" placeholder="e.g. Between a 10 and 12, runs tall. Wide feet." />
            </div>
          </div>
        </Screen>
      );
      break;
    case 'child-likes':
      body = (
        <Screen eyebrow={childLabel} title={`What does ${c!.name.split(' ')[0] || 'this child'} love?`} hint="Sponsors use this to pick something that feels personal.">
          <div className="grid gap-4">
            <div><Label htmlFor="k-color">Favorite color</Label><Input id="k-color" value={c!.favoriteColor} onChange={(e) => updateChild(ci, { favoriteColor: e.target.value })} placeholder="Purple" /></div>
            <div><Label htmlFor="k-hobbies">Interests and hobbies</Label><Input id="k-hobbies" value={c!.hobbies} onChange={(e) => updateChild(ci, { hobbies: e.target.value })} placeholder="Drawing, basketball, dinosaurs" /></div>
          </div>
        </Screen>
      );
      break;
    case 'child-clothes':
      body = (
        <Screen eyebrow={childLabel} title="Which clothing items are needed?" hint="Select all that apply.">
          <ChipGroup options={CLOTHING_OPTIONS} value={c!.clothingWishlist} onChange={(v) => updateChild(ci, { clothingWishlist: v })} />
          <div className="mt-5"><Label htmlFor="k-otherclothes" hint="(optional)">Other clothing needs or specific preferences</Label><Textarea id="k-otherclothes" value={c!.otherClothing} onChange={(e) => updateChild(ci, { otherClothing: e.target.value })} className="min-h-20" placeholder="A warm coat with a hood. No pink, please." /></div>
        </Screen>
      );
      break;
    case 'child-gifts':
      body = (
        <Screen eyebrow={childLabel} title="And for fun?" hint="Select all that apply. Each item should be under $100.">
          <ChipGroup options={GIFT_OPTIONS} value={c!.giftTypes} onChange={(v) => updateChild(ci, { giftTypes: v })} />
          <div className="mt-5"><Label htmlFor="k-gifts" hint="(optional)">Specific gifts or store gift card preferences</Label><Textarea id="k-gifts" value={c!.specificGifts} onChange={(e) => updateChild(ci, { specificGifts: e.target.value })} className="min-h-20" placeholder="A sketchbook and markers. Target gift card." /></div>
        </Screen>
      );
      break;
    case 'add-child':
      body = (
        <Screen eyebrow="Children" title={`${draft.children.length === 1 ? 'One child so far.' : `${draft.children.length} children so far.`} Add another?`} hint="Add every eligible child in your household now so a sponsor can cover the whole family.">
          <ul className="mb-5 space-y-2">
            {draft.children.map((k, i) => (
              <li key={i} className="flex items-center justify-between rounded-2xl border border-line bg-paper px-4 py-3">
                <span className="font-medium">{k.name || 'Unnamed child'}{k.age ? `, ${k.age}` : ''}</span>
                <span className="flex gap-3 text-sm">
                  <button className="font-semibold text-ember" onClick={() => go(steps.findIndex((s) => s.kind === 'child-basics' && s.child === i))}>Edit</button>
                  {draft.children.length > 1 && <button className="text-ink-3 hover:text-bad" onClick={() => update({ children: draft.children.filter((_, j) => j !== i) })}>Remove</button>}
                </span>
              </li>
            ))}
          </ul>
          {draft.children.length >= 15 ? (
            <p className="rounded-2xl bg-gold-soft px-4 py-3 text-sm text-[#6b4a0a]">Please contact program staff for households with more than 15 children.</p>
          ) : (
            <Button size="lg" variant="secondary" full onClick={() => { const n = draft.children.length; update({ children: [...draft.children, blankChild()] }); setDir(1); setIdx(steps.findIndex((s) => s.kind === 'add-child') + 0); setTimeout(() => setIdx(8 + n * 5), 0); }}>
              + Add another child
            </Button>
          )}
        </Screen>
      );
      break;
    case 'story':
      body = (
        <Screen eyebrow="Almost done" title="Tell sponsors a little about your family." hint="Optional. Sponsors say this is what helps them choose. It's shown publicly only after our team approves it, and never with names or addresses.">
          <Textarea value={draft.familyStory} maxLength={600} onChange={(e) => update({ familyStory: e.target.value })} error={errors.familyStory} className="min-h-40 !text-[17px]" placeholder="We moved twice this year and the kids have been so brave about it. Jordan draws every day…" />
          <div className="mt-1 text-right text-xs text-ink-3">{draft.familyStory.length}/600</div>
        </Screen>
      );
      break;
    case 'notes':
      body = (
        <Screen eyebrow="Almost done" title="Anything else we should know?" hint="Optional. Allergies, special requests, or anything that helps us serve your family well. This stays private to staff.">
          <Textarea value={draft.notes} onChange={(e) => update({ notes: e.target.value })} error={errors.notes} className="min-h-32" />
        </Screen>
      );
      break;
    case 'review': {
      const jump = (kind: StepKind, child?: number) => go(steps.findIndex((s) => s.kind === kind && (child === undefined || s.child === child)));
      const Row = ({ k, v, onEdit }: { k: string; v: React.ReactNode; onEdit: () => void }) => (
        <div className="flex items-start justify-between gap-4 py-2.5">
          <div className="min-w-0"><div className="text-xs font-semibold uppercase tracking-wider text-ink-3">{k}</div><div className="text-[15px]">{v || <span className="text-ink-3">—</span>}</div></div>
          <button onClick={onEdit} className="shrink-0 text-sm font-semibold text-ember">Edit</button>
        </div>
      );
      body = (
        <Screen eyebrow="Review" title="Does everything look right?" hint="Tap Edit to change anything. Submit when you're ready.">
          <div className="rounded-xl3 border border-line bg-paper p-5 shadow-soft divide-y divide-line">
            <Row k="Parent / guardian" v={draft.guardianName} onEdit={() => jump('name')} />
            <Row k="Phone · preferred" v={`${draft.phone} · ${draft.preferredContact}`} onEdit={() => jump('phone')} />
            <Row k="Email" v={draft.email} onEdit={() => jump('email')} />
            <Row k="Address" v={`${draft.address}, ${draft.city}, ${draft.state} ${draft.zip}`} onEdit={() => jump('address')} />
            <Row k="Transportation" v={draft.transportation} onEdit={() => jump('transport')} />
          </div>
          {draft.children.map((k, i) => (
            <div key={i} className="mt-4 rounded-xl3 border border-line bg-paper p-5 shadow-soft divide-y divide-line">
              <Row k={`Child ${i + 1}`} v={`${k.name}, ${k.age} · ${k.gender === 'Male' ? 'Boy' : 'Girl'}`} onEdit={() => jump('child-basics', i)} />
              <Row k="Sizes" v={`${k.clothingCategory} · shirt ${k.shirtSize} · pants ${k.pantsSize} · shoes ${k.shoeCategory} ${k.shoeSize}${k.sizeNotes ? ` · ${k.sizeNotes}` : ''}`} onEdit={() => jump('child-sizes', i)} />
              <Row k="Loves" v={[k.favoriteColor, k.hobbies].filter(Boolean).join(' · ')} onEdit={() => jump('child-likes', i)} />
              <Row k="Clothing" v={[...k.clothingWishlist, k.otherClothing].filter(Boolean).join(', ')} onEdit={() => jump('child-clothes', i)} />
              <Row k="Fun gifts" v={[...k.giftTypes, k.specificGifts].filter(Boolean).join(', ')} onEdit={() => jump('child-gifts', i)} />
            </div>
          ))}
          <div className="mt-4 rounded-xl3 border border-line bg-paper p-5 shadow-soft divide-y divide-line">
            <Row k="Family story" v={draft.familyStory} onEdit={() => jump('story')} />
            <Row k="Notes" v={draft.notes} onEdit={() => jump('notes')} />
          </div>
        </Screen>
      );
      break;
    }
  }

  const isLast = step.kind === 'review';
  return (
    <Shell progress={progress} onExit={() => { toast('Saved on this device', 'ok'); }}>
      <div ref={screenRef} className="relative flex-1">
        <AnimatePresence mode="wait" custom={dir} initial={false}>
          <motion.div key={`${step.kind}-${step.child ?? ''}`} custom={dir} initial={{ opacity: 0, x: dir * 36 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -36 }} transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
            {body}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="sticky bottom-0 -mx-4 mt-8 border-t border-line/60 bg-cream/90 px-4 py-3 backdrop-blur-md pb-safe sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
          <Button variant="ghost" onClick={back} disabled={idx === 0}>Back</Button>
          <div className="hidden text-xs text-ink-3 sm:block">{step.kind !== 'review' ? 'Press Enter ↵' : ''}</div>
          {isLast ? (
            <Button size="lg" onClick={doSubmit} loading={submit.isPending}>Submit application</Button>
          ) : (
            <Button size="lg" onClick={next}>{step.kind === 'email' && !draft.email ? 'Skip' : step.kind === 'intro' ? "Let's go" : 'Continue'}</Button>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children, progress, onExit }: { children: React.ReactNode; progress: number; onExit?: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col bg-cream">
      <header className="sticky top-0 z-40 bg-cream/85 backdrop-blur-md pt-safe">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Logo />
          <Link to="/" onClick={onExit} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-cream-2">Save & exit</Link>
        </div>
        <Progress value={progress} className="h-1 rounded-none" tone="ember" />
      </header>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 pt-8 sm:px-6 sm:pt-16">{children}</main>
    </div>
  );
}
