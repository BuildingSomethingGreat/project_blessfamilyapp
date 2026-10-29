import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CLOTHING_CATEGORIES, CLOTHING_OPTIONS, CLOTHING_SIZES, CONTACT_METHODS, FAVORITE_COLORS, GENDERS, GIFT_OPTIONS, OTHER_SIZE, SHOE_SIZES, TRANSPORT_OPTIONS, FamilyApplicationSchema, colorSwatch, type ChildInput, type ClothingCategory } from '@bless/shared';
import { api, ApiError } from '@/lib/api';
import { Checkbox, KMark, Seg, Select, UnderlineInput } from '@/components/ui';
import { cx } from '@/lib/format';

type Kid = { name: string; age: string; gender: string; cat: ClothingCategory; shirt: string; pants: string; shoe: string; sizeNotes: string; hobbies: string; color: string; clothing: string[]; clothingExtra: string; gifts: string[]; giftsExtra: string };
type Ans = { guardian: string; phone: string; contact: string; email: string; city: string; address: string; zip: string; transport: string; kidCount: string; kids: Kid[]; story: string; photo: string; photoDataUrl: string; photoPrivate: boolean; eligible: boolean };
type Step = { t: 'welcome' | 'text' | 'choice' | 'address' | 'who' | 'sizes' | 'interests' | 'multi' | 'story' | 'photo' | 'confirm' | 'done'; key?: keyof Ans | 'clothing' | 'gifts'; i?: number; kicker?: string; title: string; help?: string; ph?: string; type?: string; opts?: readonly string[]; extraPh?: string };

const DRAFT = 'baf-register-draft';
const blankKid = (): Kid => ({ name: '', age: '', gender: '', cat: 'Youth / Kids', shirt: '', pants: '', shoe: '', sizeNotes: '', hobbies: '', color: '', clothing: [], clothingExtra: '', gifts: [], giftsExtra: '' });
const fresh = (): Ans => ({ guardian: '', phone: '', contact: '', email: '', city: '', address: '', zip: '', transport: '', kidCount: '', kids: [], story: '', photo: '', photoDataUrl: '', photoPrivate: false, eligible: false });
const field = 'mt-1.5 h-[50px] w-full rounded-2xl border border-line bg-bg px-4 text-base outline-none focus:border-pri focus:bg-white';
const label = 'text-[13px] font-semibold text-ink-2';

function buildSteps(a: Ans, askPhoto: boolean): Step[] {
  const s: Step[] = [
    { t: 'welcome', title: 'Tell us about your family.', help: "Bless This Family matches Konnection households with Holiday Konnectors who shop your children's wish lists. Answer a few questions and we'll take it from there." },
    { t: 'text', key: 'guardian', kicker: 'About you', title: "What's your name?", help: 'Parent or guardian. Holiday Konnectors never see this.', ph: 'First and last name' },
    { t: 'text', key: 'phone', kicker: 'About you', title: 'Best number to reach you?', help: 'So our team can reach you about your application or gift delivery.', ph: '(313) 555-0100', type: 'tel' },
    { t: 'choice', key: 'contact', kicker: 'About you', title: 'How do you prefer we reach you?', opts: CONTACT_METHODS },
  ];
  s.push(a.contact === 'Email'
    ? { t: 'text', key: 'email', kicker: 'About you', title: "What's your email?", help: "We'll email you when your family is approved and when a Holiday Konnector chooses you.", ph: 'you@example.com', type: 'email' }
    : { t: 'text', key: 'email', kicker: 'About you', title: 'Email for updates? (optional)', help: "We'll email you when your family is approved and when a Holiday Konnector chooses you. Skip if you don't have one.", ph: 'you@example.com', type: 'email' });
  s.push(
    { t: 'text', key: 'city', kicker: 'Your household', title: 'What city do you live in?', help: 'Holiday Konnectors see the city only, never your street address.', ph: 'Detroit' },
    { t: 'address', kicker: 'Your household', title: "What's your home address?", help: 'Private. Only our team sees it, to arrange delivery.' },
    { t: 'choice', key: 'transport', kicker: 'Your household', title: 'Would you prefer to pick up the gifts or have them delivered?', opts: TRANSPORT_OPTIONS },
    { t: 'choice', key: 'kidCount', kicker: 'Your children', title: 'How many children are in your household?', help: 'Under 18, living with you.', opts: ['1', '2', '3', '4', '5', '6'] },
  );
  const n = Math.min(15, Number(a.kidCount) || 0);
  for (let i = 0; i < n; i++) {
    const nm = a.kids[i]?.name || `Child ${i + 1}`;
    s.push(
      { t: 'who', i, kicker: `Child ${i + 1} of ${n}`, title: i === 0 ? 'Tell us about your first child.' : `And child ${i + 1}?` },
      { t: 'sizes', i, kicker: `Child ${i + 1} · ${nm}`, title: `What sizes does ${nm} wear?`, help: 'Category first, then the exact size.' },
      { t: 'interests', i, kicker: `Child ${i + 1} · ${nm}`, title: `What does ${nm} love?`, help: 'Hobbies, characters, sports — this is what makes a gift feel chosen.' },
      { t: 'multi', i, key: 'clothing', kicker: `Child ${i + 1} · ${nm}`, title: `Clothing ${nm} needs`, opts: CLOTHING_OPTIONS, extraPh: 'Anything else? (optional)' },
      { t: 'multi', i, key: 'gifts', kicker: `Child ${i + 1} · ${nm}`, title: `Fun gifts for ${nm}`, help: 'Pick a few kinds. Holiday Konnectors choose within them.', opts: GIFT_OPTIONS, extraPh: 'A specific wish, e.g. a sketchbook and markers' },
    );
  }
  s.push(
    { t: 'story', key: 'story', kicker: 'Your story', title: 'Tell Holiday Konnectors a little about your family.', help: 'Two or three sentences. What makes your kids who they are? Optional, but families with a story are chosen sooner.' },
  );
  if (askPhoto) s.push({ t: 'photo', key: 'photo', kicker: 'Your story', title: 'Would you like to share a family photo?', help: 'Completely optional. Our team reviews every photo, and you choose whether Holiday Konnectors see it.' });
  s.push(
    { t: 'confirm', kicker: 'Last step', title: 'Does this look right?' },
    { t: 'done', kicker: 'Submitted', title: `Thank you, ${(a.guardian || 'friend').split(' ')[0]}.` },
  );
  return s;
}

function toApplication(a: Ans, askPhoto: boolean) {
  if (!askPhoto) a = { ...a, photo: '', photoDataUrl: '' };
  return {
    eligibilityConfirmed: a.eligible as true, guardianName: a.guardian, phone: a.phone, email: a.email, preferredContact: (a.contact || 'Text') as 'Text' | 'Call' | 'Email',
    address: a.address, city: a.city, state: 'MI', zip: a.zip, transportation: (a.transport === TRANSPORT_OPTIONS[0] || a.transport === 'I can pick up' ? 'Yes' : 'No') as 'Yes' | 'No', familyStory: a.story, photoDataUrl: a.photo === 'Share a photo' ? a.photoDataUrl : '', photoPrivate: a.photo === 'Share a photo' && a.photoPrivate, notes: '',
    children: a.kids.slice(0, Math.min(15, Number(a.kidCount) || 0)).map((k): ChildInput => ({
      name: k.name, age: Number(k.age), gender: (k.gender || 'Prefer not to say') as ChildInput['gender'], clothingCategory: k.cat, shirtSize: k.shirt, pantsSize: k.pants, shoeCategory: k.cat, shoeSize: k.shoe,
      sizeNotes: k.sizeNotes, favoriteColor: k.color, hobbies: k.hobbies, clothingWishlist: k.clothing as ChildInput['clothingWishlist'], otherClothing: k.clothingExtra, giftTypes: k.gifts as ChildInput['giftTypes'], specificGifts: k.giftsExtra,
    })),
  };
}

async function resizeImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const scale = Math.min(1, 1200 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

export default function Register() {
  const nav = useNavigate();
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  const [a, setA] = useState<Ans>(fresh);
  const [step, setStep] = useState(0);
  const [resume, setResume] = useState<{ ans: Ans; step: number } | null>(null);
  const [submitted, setSubmitted] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [more, setMore] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { try { const raw = localStorage.getItem(DRAFT); if (raw) { const d = JSON.parse(raw); if (d?.ans?.guardian || d?.step > 0) setResume(d); } } catch { /* ignore */ } }, []);
  useEffect(() => { if (submitted) return; try { if (step > 0) localStorage.setItem(DRAFT, JSON.stringify({ ans: { ...a, photoDataUrl: '' }, step })); } catch { /* ignore */ } }, [a, step, submitted]);

  const askPhoto = !!settings.data?.askFamilyPhoto;
  const steps = useMemo(() => buildSteps(a, askPhoto), [a, askPhoto]);
  const q = steps[Math.min(step, steps.length - 1)];
  const kid = a.kids[q.i ?? 0] ?? blankKid();
  const setKid = (i: number, patch: Partial<Kid>) => setA((s) => { const kids = [...s.kids]; kids[i] = { ...(kids[i] ?? blankKid()), ...patch }; return { ...s, kids }; });
  const set = (k: keyof Ans, v: Ans[keyof Ans]) => setA((s) => ({ ...s, [k]: v }));

  const valid = (() => {
    switch (q.t) {
      case 'text': { const v = String(a[q.key as keyof Ans] ?? '').trim(); if (q.key === 'phone') return /^[+()\-.\s\d]{10,20}$/.test(v); if (q.key === 'email') return /\S+@\S+\.\S+/.test(v) || (!v && a.contact !== 'Email'); return v.length >= 2; }
      case 'choice': return !!a[q.key as keyof Ans];
      case 'address': return a.address.trim().length >= 3 && /^\d{5}(?:-\d{4})?$/.test(a.zip.trim());
      case 'who': return !!kid.name.trim() && Number.isInteger(Number(kid.age)) && kid.age !== '' && Number(kid.age) >= 0 && Number(kid.age) <= 17;
      case 'sizes': return !!kid.shirt && !!kid.pants && !!kid.shoe && !([kid.shirt, kid.pants, kid.shoe].includes(OTHER_SIZE) && !kid.sizeNotes.trim());
      case 'interests': return !!kid.hobbies.trim();
      case 'multi': return (kid[q.key as 'clothing' | 'gifts'] ?? []).length > 0;
      case 'confirm': return a.eligible;
      default: return true;
    }
  })();

  const next = async () => {
    if (!valid || busy) return;
    if (q.t === 'confirm') {
      const parsed = FamilyApplicationSchema.safeParse(toApplication(a, askPhoto));
      if (!parsed.success) { const issue = parsed.error.issues[0]; setError(`${issue.path.join(' › ') || 'Form'}: ${issue.message}`); const idx = issue.path[0] === 'children' ? steps.findIndex((s) => s.t === 'who' && s.i === Number(issue.path[1])) : 1; if (idx >= 0) setStep(idx); return; }
      setBusy(true); setError('');
      try {
        const res = await api.register(parsed.data);
        setSubmitted(res.familyId);
        try { localStorage.removeItem(DRAFT); } catch { /* ignore */ }
        setStep(steps.length - 1);
      } catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'); } finally { setBusy(false); }
      return;
    }
    if (q.t === 'done') { nav('/'); return; }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };
  const onKey = (e: React.KeyboardEvent) => { if (e.key === 'Enter' && (e.target as HTMLElement).tagName !== 'TEXTAREA') { e.preventDefault(); next(); } };
  const progress = Math.round((step / (steps.length - 1)) * 100);
  const titleSize = q.t === 'welcome' || q.t === 'done' ? 'text-[36px] sm:text-[44px]' : 'text-[30px] sm:text-[36px]';
  const nextLabel = q.t === 'welcome' ? 'Start' : q.t === 'confirm' ? (busy ? 'Submitting…' : 'Submit application') : q.t === 'done' ? 'Done' : 'Continue';
  const sizeOpts = [...CLOTHING_SIZES[kid.cat], OTHER_SIZE];
  const shoeOpts = [...SHOE_SIZES[kid.cat], OTHER_SIZE];

  if (settings.data && !settings.data.registrationOpen) {
    return <div className="mx-auto my-16 max-w-[520px] px-4 text-center anim-rise"><KMark size={40} className="mx-auto" /><h1 className="mt-5 text-[36px] font-extrabold tracking-[-.045em]">Applications are closed for this season.</h1><p className="mt-3 text-[15px] text-ink-2">Questions? Email <a className="text-pri" href={`mailto:${settings.data.contactEmail}`}>{settings.data.contactEmail}</a>.</p><Link to="/" className="mt-6 inline-flex h-12 items-center rounded-full bg-ink px-6 font-semibold text-white">Back home</Link></div>;
  }

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 pb-16 pt-6 sm:px-8">
      <div onKeyDown={onKey} className="flex min-h-[640px] flex-col overflow-hidden rounded-[32px] border border-line bg-white">
        <div className="flex items-center justify-between px-7 pt-[22px]">
          <div className="flex items-center gap-2.5"><KMark /><span className="text-[15px] font-bold">Bless-A-Family application</span></div>
          <Link to="/" className="text-[13px] font-semibold text-ink-2">Save & exit</Link>
        </div>
        <div className="mx-7 mt-4 h-1 overflow-hidden rounded-full bg-soft"><div className="h-full bg-pri transition-[width] duration-500 ease-[cubic-bezier(.16,1,.3,1)]" style={{ width: `${progress}%` }} /></div>
        <div className="max-w-[720px] flex-1 px-6 pb-6 pt-9 sm:px-14">
          {resume && (
            <div className="anim-rise mb-5 flex flex-wrap items-center gap-3 rounded-2xl bg-soft px-4 py-3 text-[14px] text-ink-2">
              <span className="flex-1">Resume where you left off?</span>
              <button onClick={() => { setA(resume.ans); setStep(resume.step); setResume(null); }} className="h-9 rounded-full bg-ink px-4 text-[13px] font-semibold text-white">Resume</button>
              <button onClick={() => { setResume(null); try { localStorage.removeItem(DRAFT); } catch { /* ignore */ } }} className="h-9 rounded-full border border-line bg-white px-4 text-[13px] font-semibold">Start fresh</button>
            </div>
          )}
          <div key={step} className="anim-rise" style={{ animationDuration: '.4s' }}>
            {q.kicker && <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">{q.kicker}</div>}
            <h1 className={cx('mt-2 font-extrabold leading-[1.05] tracking-[-.04em]', titleSize)}>{q.title}</h1>
            {q.help && <p className="mt-3 text-base leading-[1.5] text-ink-2">{q.help}</p>}

            {q.t === 'welcome' && (
              <div className="mt-7 grid gap-2.5">
                <div className="flex items-center gap-3.5 rounded-[18px] bg-bg px-[18px] py-4"><div className="grid size-10 flex-none place-items-center rounded-xl bg-soft text-[13px] font-extrabold text-pri-dark">6m</div><div><div className="text-[14px] font-semibold">About 6 minutes</div><div className="text-[13px] text-ink-3">One question at a time. Your progress saves on this device.</div></div></div>
                <div className="flex items-center gap-3.5 rounded-[18px] bg-bg px-[18px] py-4"><div className="grid size-10 flex-none place-items-center rounded-xl bg-soft font-extrabold text-pri-dark">●</div><div><div className="text-[14px] font-semibold">Private by default</div><div className="text-[13px] text-ink-3">Holiday Konnectors see first names, ages, sizes and your story. Never your address or phone.</div></div></div>
              </div>
            )}
            {q.t === 'text' && <div className="mt-7"><UnderlineInput autoFocus type={q.type ?? 'text'} value={String(a[q.key as keyof Ans] ?? '')} onChange={(e) => set(q.key as keyof Ans, e.target.value.slice(0, 200))} placeholder={q.ph} /></div>}
            {q.t === 'choice' && (
              <div className="mt-7 flex flex-wrap gap-2">
                {q.opts!.map((o) => <Seg key={o} active={a[q.key as keyof Ans] === o} onClick={() => { set(q.key as keyof Ans, o); if (q.key === 'kidCount') setMore(false); }} className={cx('h-[50px] px-5 text-[15px]', q.key === 'kidCount' && 'min-w-[60px]')}>{o}</Seg>)}
                {q.key === 'kidCount' && (more ? <input autoFocus type="number" min={7} max={15} value={Number(a.kidCount) > 6 ? a.kidCount : ''} onChange={(e) => set('kidCount', String(Math.min(15, Math.max(0, Number(e.target.value)))))} placeholder="7–15" className="h-[50px] w-24 rounded-full border border-line bg-bg px-4 text-[15px] font-semibold outline-none focus:border-pri" /> : <Seg active={Number(a.kidCount) > 6} onClick={() => setMore(true)} className="h-[50px] px-5 text-[15px]">More</Seg>)}
              </div>
            )}
            {q.t === 'address' && (
              <div className="mt-7 grid gap-2.5 sm:grid-cols-[1fr_140px]">
                <label><span className={label}>Street address</span><input autoFocus value={a.address} onChange={(e) => set('address', e.target.value.slice(0, 200))} placeholder="100 Main St, Apt 2" className={field} /></label>
                <label><span className={label}>ZIP</span><input value={a.zip} onChange={(e) => set('zip', e.target.value.slice(0, 10))} inputMode="numeric" placeholder="48201" className={field} /></label>
              </div>
            )}
            {q.t === 'who' && (
              <>
                <div className="mt-7 grid grid-cols-[1fr_100px] gap-2.5">
                  <label><span className={label}>First name</span><input autoFocus value={kid.name} onChange={(e) => setKid(q.i!, { name: e.target.value.slice(0, 80) })} placeholder="Jordan" className={field} /></label>
                  <label><span className={label}>Age</span><input value={kid.age} onChange={(e) => setKid(q.i!, { age: e.target.value })} type="number" min={0} max={17} placeholder="8" className={field} /></label>
                </div>
                <div className="mt-3.5 flex flex-wrap gap-2">{GENDERS.map((g) => <Seg key={g} grow active={kid.gender === g} onClick={() => setKid(q.i!, { gender: g })} className="min-w-[120px]">{g}</Seg>)}</div>
              </>
            )}
            {q.t === 'sizes' && (
              <>
                <div className={cx(label, 'mt-[26px]')}>Clothing category</div>
                <div className="mt-2 flex flex-wrap gap-2">{CLOTHING_CATEGORIES.map((c) => <Seg key={c} active={kid.cat === c} onClick={() => setKid(q.i!, { cat: c, shirt: '', pants: '', shoe: '' })} className="h-[42px] px-3.5">{c}</Seg>)}</div>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  {([['Shirt / top', 'shirt', sizeOpts], ['Pants', 'pants', sizeOpts], ['Shoes', 'shoe', shoeOpts]] as const).map(([l, k, opts]) => (
                    <label key={k}><span className={label}>{l}</span><div className="mt-1.5"><Select value={kid[k]} onChange={(e) => setKid(q.i!, { [k]: e.target.value })}><option value="">Select</option>{opts.map((s) => <option key={s} value={s}>{s}</option>)}</Select></div></label>
                  ))}
                </div>
                <input value={kid.sizeNotes} onChange={(e) => setKid(q.i!, { sizeNotes: e.target.value.slice(0, 500) })} placeholder={[kid.shirt, kid.pants, kid.shoe].includes(OTHER_SIZE) ? 'Tell us what you know, e.g. between a 10 and 12, runs tall' : 'Size notes, e.g. runs tall, wide feet (optional)'} className={cx('mt-3 h-12 w-full rounded-[14px] border bg-bg px-3.5 text-[14px] outline-none focus:border-pri', [kid.shirt, kid.pants, kid.shoe].includes(OTHER_SIZE) && !kid.sizeNotes.trim() ? 'border-pri' : 'border-line')} />
              </>
            )}
            {q.t === 'interests' && (
              <>
                <div className="mt-7"><UnderlineInput autoFocus value={kid.hobbies} onChange={(e) => setKid(q.i!, { hobbies: e.target.value.slice(0, 200) })} placeholder="Drawing, dinosaurs, volleyball…" className="text-[24px] sm:text-[26px]" /></div>
                <div className={cx(label, 'mt-6')}>Favorite color</div>
                <div className="mt-2 flex flex-wrap gap-2">{FAVORITE_COLORS.map((c) => <Seg key={c} active={kid.color === c} onClick={() => setKid(q.i!, { color: c })} swatch={colorSwatch(c)} className="h-10 pl-2 pr-3 text-[13px]">{c}</Seg>)}</div>
              </>
            )}
            {q.t === 'multi' && (
              <>
                <div className="mt-[26px] flex flex-wrap gap-2">{q.opts!.map((o) => { const list = kid[q.key as 'clothing' | 'gifts']; const on = list.includes(o); return <Seg key={o} active={on} onClick={() => setKid(q.i!, { [q.key as 'clothing' | 'gifts']: on ? list.filter((x) => x !== o) : [...list, o] })} className="h-[42px] px-3.5">{o}</Seg>; })}</div>
                <input value={q.key === 'clothing' ? kid.clothingExtra : kid.giftsExtra} onChange={(e) => setKid(q.i!, q.key === 'clothing' ? { clothingExtra: e.target.value.slice(0, 500) } : { giftsExtra: e.target.value.slice(0, 500) })} placeholder={q.extraPh} className="mt-3.5 h-12 w-full rounded-[14px] border border-line bg-bg px-3.5 text-[14px] outline-none focus:border-pri" />
              </>
            )}
            {q.t === 'story' && (
              <>
                <textarea autoFocus value={a.story} onChange={(e) => set('story', e.target.value.slice(0, 400))} placeholder="We moved twice this year and the kids have been so brave about it…" className="mt-[26px] min-h-[170px] w-full resize-none rounded-[18px] border border-line bg-bg px-4 py-3.5 text-base leading-[1.5] outline-none focus:border-pri focus:bg-white" />
                <div className="mt-1.5 flex justify-between text-[12px] text-ink-3"><span>Our team reads it before it goes public.</span><span>{a.story.length}/400</span></div>
              </>
            )}
            {q.t === 'photo' && (
              <>
                <div className="mt-[26px] flex gap-2">{['Share a photo', 'No photo'].map((o) => <Seg key={o} grow active={a.photo === o} onClick={() => set('photo', o)}>{o}</Seg>)}</div>
                {a.photo === 'Share a photo' && (
                  <>
                    <button type="button" onClick={() => fileRef.current?.click()} className="mt-3.5 block h-[220px] w-full overflow-hidden rounded-[20px] border border-line bg-bg">
                      {a.photoDataUrl ? <img src={a.photoDataUrl} alt="Your family photo" className="size-full object-cover" /> : <span className="grid size-full place-items-center text-[14px] font-semibold text-ink-3">Tap to add a photo</span>}
                    </button>
                    <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) set('photoDataUrl', await resizeImage(f)); }} />
                    <div className="mt-3 rounded-2xl bg-bg px-4 py-3"><Checkbox checked={a.photoPrivate} onChange={(v) => set('photoPrivate', v)}>Keep my photo private. Only The Konnection team will see it.</Checkbox></div>
                    <p className="mt-2.5 text-[13px] leading-[1.5] text-ink-3">Share only what you're comfortable with: a doorway, hands, a holiday table. Faces are optional, and you can ask us to remove it any time.</p>
                  </>
                )}
              </>
            )}
            {q.t === 'confirm' && (
              <>
                <div className="mt-6 rounded-[20px] bg-bg px-[18px] py-1">
                  {[['Guardian', a.guardian || '—'], ['Contact', `${a.contact || '—'} · ${a.phone}${a.email ? ` · ${a.email}` : ''}`], ['Children', a.kids.slice(0, Number(a.kidCount) || 0).map((k) => `${k.name}, ${k.age}`).join(' · ') || '—'], ['Public story', a.story ? 'Yes' : 'None'], ...(askPhoto ? [['Photo', a.photo === 'Share a photo' && a.photoDataUrl ? (a.photoPrivate ? 'Staff only' : 'Shared after review') : 'None']] : []), ['Gifts', a.transport || '—']].map(([k, v], i, arr) => (
                    <div key={k} className={cx('flex justify-between gap-4 py-3 text-[14px]', i < arr.length - 1 && 'border-b border-line')}><span className="text-ink-3">{k}</span><b className="text-right">{v}</b></div>
                  ))}
                </div>
                <div className="mt-4"><Checkbox checked={a.eligible} onChange={(v) => set('eligible', v)}>I confirm all children live in my household and that we're part of The Konnection's programs.</Checkbox></div>
                {error && <p className="mt-3 text-[13px] text-bad">{error}</p>}
              </>
            )}
            {q.t === 'done' && (
              <div className="anim-pop mt-7 rounded-xl2 bg-ink p-7 text-bg">
                <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-lav">Your family ID</div>
                <div className="mt-1 text-[40px] font-extrabold tracking-[-.04em] text-white">{submitted}</div>
                <p className="mt-3 text-[14px] leading-[1.55] text-bg/75">We'll text you when it's reviewed — usually within 2 days — and again when a Holiday Konnector steps up. Keep this ID handy.</p>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line px-7 pb-6 pt-4">
          {step > 0 && q.t !== 'done' ? <button onClick={() => setStep((s) => Math.max(0, s - 1))} className="px-1.5 text-[15px] font-semibold">Back</button> : <span />}
          <button onClick={next} disabled={!valid || busy} className="flex h-[52px] items-center gap-2 rounded-full bg-pri px-7 text-base font-bold text-white transition-colors hover:bg-pri-dark active:scale-[.97] disabled:bg-disabled">{nextLabel}{!['welcome', 'done', 'confirm'].includes(q.t) && <span className="opacity-70">↵</span>}</button>
        </div>
      </div>
    </div>
  );
}
