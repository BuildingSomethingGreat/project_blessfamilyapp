import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CLOTHING_CATEGORIES, CLOTHING_OPTIONS, CLOTHING_SIZES, CONTACT_METHODS, FAVORITE_COLORS, GENDERS, GIFT_OPTIONS, OTHER_SIZE, SHOE_SIZES, cleanGiftDetails, type ClothingCategory, type FamilyDetails, type Family } from '@bless/shared';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Kicker, Label, Select, Skeleton, Textarea, useToast } from '@/components/ui';
import { GiftFollowUps } from '@/components/GiftFollowUps';
import { cx } from '@/lib/format';
import { PageHead, Panel, PanelTitle } from './shared.tsx';

type Kid = FamilyDetails['children'][number] & { key: string };
type Form = Omit<FamilyDetails, 'children'> & { children: Kid[] };

const toForm = (f: Family): Form => ({
  guardianName: f.guardianName, phone: f.phone, email: f.email, preferredContact: f.preferredContact, address: f.address, city: f.city, state: f.state, zip: f.zip,
  transportation: f.transportation, familyStory: f.familyStory, notes: f.notes,
  children: f.children.map((c) => ({
    key: c.id, id: c.id, name: c.name, age: c.age, gender: c.gender, clothingCategory: c.clothingCategory, shirtSize: c.shirtSize, pantsSize: c.pantsSize,
    shoeCategory: c.shoeCategory, shoeSize: c.shoeSize, sizeNotes: c.sizeNotes, favoriteColor: c.favoriteColor, hobbies: c.hobbies,
    clothingWishlist: c.clothingWishlist as Kid['clothingWishlist'], otherClothing: c.otherClothing, giftTypes: c.giftTypes as Kid['giftTypes'], giftDetails: c.giftDetails ?? {}, specificGifts: c.specificGifts,
  })),
});

const newKid = (): Kid => ({
  key: `new-${Math.random().toString(36).slice(2)}`, name: '', age: 0, gender: 'Prefer not to say', clothingCategory: 'Youth / Kids', shirtSize: '', pantsSize: '', shoeCategory: 'Youth / Kids', shoeSize: '',
  sizeNotes: '', favoriteColor: '', hobbies: '', clothingWishlist: [], otherClothing: '', giftTypes: [], giftDetails: {}, specificGifts: '',
});

const chip = (on: boolean) => cx('h-8 rounded-full border px-3 text-[12px] font-semibold transition-colors', on ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink-2 hover:border-ink-3');

/**
 * Admin editor for everything a family submitted: household details and each child (sizes, wish
 * lists, gift follow-ups). Works at any status, including after approval; changes show on the
 * public family page and the Holiday Konnector's family page as soon as they're saved.
 */
export default function FamilyEdit() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ['admin', 'family', id], queryFn: () => api.admin.family(id) });
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { if (q.data && !form) setForm(toForm(q.data)); }, [q.data, form]);
  const original = useMemo(() => (q.data ? JSON.stringify(toForm(q.data)) : ''), [q.data]);
  const dirty = !!form && JSON.stringify(form) !== original;

  const save = useMutation({
    mutationFn: () => api.admin.saveFamilyDetails(id, {
      ...form!,
      children: form!.children.map(({ key: _k, ...k }) => ({ ...k, giftDetails: cleanGiftDetails(k.giftTypes, k.giftDetails) })),
    }),
    onSuccess: (f) => { qc.setQueryData(['admin', 'family', id], undefined); qc.invalidateQueries({ queryKey: ['admin'] }); setForm(toForm(f)); toast('Family details saved', 'ok'); nav(`/admin/families/${id}`); },
    onError: (e: Error) => setError(e instanceof ApiError ? e.message : 'Could not save. Try again.'),
  });

  // Warn before closing the tab with unsaved edits; in-app exits (Back, Cancel) confirm too.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  const leave = () => { if (!dirty || window.confirm('Leave without saving your changes?')) nav(`/admin/families/${id}`); };

  if (!form || !q.data) return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-80" /></div>;
  const f = q.data;
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm({ ...form, [k]: v });
  const setKid = (i: number, patch: Partial<Kid>) => setForm({ ...form, children: form.children.map((k, j) => (j === i ? { ...k, ...patch } : k)) });
  const shopping = f.sponsorships.some((s) => ['Claimed', 'Shopping', 'Purchased', 'Wrapped'].includes(s.status));

  return (
    <div className="anim-rise pb-24">
      <button type="button" onClick={leave} className="text-[13px] font-semibold text-ink-3 hover:text-ink">‹ Back to {f.public.nickname}</button>
      <PageHead title="Edit family" sub={`${f.familyId} · ${f.public.nickname} · ${f.status}`} />
      {shopping && (
        <div className="mt-4 rounded-[18px] border border-warn/30 bg-amber-50 px-4 py-3 text-[13px] leading-[1.5] text-ink-2">
          <b className="text-ink">A Holiday Konnector is shopping for this family.</b> They see your changes on their family page right away. If you change sizes or wishes, let them know.
        </div>
      )}

      <Panel className="mt-5">
        <PanelTitle right={<span>Private · staff only</span>}>Household</PanelTitle>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="g-name" label="Guardian name"><Input id="g-name" value={form.guardianName} onChange={(e) => set('guardianName', e.target.value)} /></Field>
          <Field id="g-phone" label="Phone"><Input id="g-phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field id="g-email" label="Email" hint="optional"><Input id="g-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></Field>
          <Field id="g-contact" label="Prefers">
            <div className="flex gap-1.5">{CONTACT_METHODS.map((m) => <button key={m} type="button" onClick={() => set('preferredContact', m)} className={cx(chip(form.preferredContact === m), 'h-12 flex-1 text-[13px]')}>{m}</button>)}</div>
          </Field>
          <Field id="g-address" label="Street address" wide><Input id="g-address" value={form.address} onChange={(e) => set('address', e.target.value)} /></Field>
          <Field id="g-city" label="City"><Input id="g-city" value={form.city} onChange={(e) => set('city', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field id="g-state" label="State"><Input id="g-state" maxLength={2} value={form.state} onChange={(e) => set('state', e.target.value.toUpperCase())} /></Field>
            <Field id="g-zip" label="ZIP"><Input id="g-zip" value={form.zip} onChange={(e) => set('zip', e.target.value)} /></Field>
          </div>
          <Field id="g-gifts" label="Gifts" wide>
            <div className="flex gap-1.5">{([['Yes', 'Family picks up'], ['No', 'Needs delivery']] as const).map(([v, l]) => <button key={v} type="button" onClick={() => set('transportation', v)} className={cx(chip(form.transportation === v), 'h-12 flex-1 text-[13px]')}>{l}</button>)}</div>
          </Field>
          <Field id="g-story" label="Family story" hint="public once the story is approved" wide><Textarea id="g-story" className="min-h-24" value={form.familyStory} onChange={(e) => set('familyStory', e.target.value.slice(0, 600))} /></Field>
          <Field id="g-notes" label="Family's notes / special requests" hint="staff only" wide><Textarea id="g-notes" className="min-h-20" value={form.notes} onChange={(e) => set('notes', e.target.value.slice(0, 1000))} /></Field>
        </div>
      </Panel>

      <div className="mt-6 flex items-end justify-between gap-3">
        <h2 className="text-[20px]">Children · {form.children.length}</h2>
        <Button size="sm" variant="secondary" disabled={form.children.length >= 15} onClick={() => setForm({ ...form, children: [...form.children, newKid()] })}>+ Add child</Button>
      </div>
      <div className="mt-3 grid gap-3.5">
        {form.children.map((k, i) => (
          <KidEditor key={k.key} k={k} n={i + 1} onChange={(p) => setKid(i, p)}
            onRemove={form.children.length > 1 ? () => { if (window.confirm(`Remove ${k.name || `child ${i + 1}`} from this family?`)) setForm({ ...form, children: form.children.filter((_, j) => j !== i) }); } : undefined} />
        ))}
      </div>

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white/95 px-4 py-3 backdrop-blur lg:left-[230px]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-3">
          {error && <span className="mr-auto text-[13px] font-semibold text-bad">{error}</span>}
          {!error && <span className="mr-auto text-[13px] text-ink-3">{dirty ? 'Unsaved changes' : 'No changes yet'}</span>}
          <Button variant="ghost" size="sm" onClick={leave}>Cancel</Button>
          <Button variant="dark" size="md" disabled={!dirty} loading={save.isPending} onClick={() => { setError(''); save.mutate(); }}>Save changes</Button>
        </div>
      </div>
    </div>
  );
}

function Field({ id, label, hint, wide, children }: { id: string; label: string; hint?: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? 'sm:col-span-2' : undefined}><Label htmlFor={id} hint={hint}>{label}</Label>{children}</div>;
}

/** Size picker for a category; keeps an older size that's no longer in the list so nothing is lost on save. */
function SizeSelect({ id, value, options, onChange }: { id: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  const list = [...options, OTHER_SIZE];
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="" disabled>Choose…</option>
      {value && !list.includes(value) && <option value={value}>{value} (current)</option>}
      {list.map((s) => <option key={s} value={s}>{s}</option>)}
    </Select>
  );
}

function KidEditor({ k, n, onChange, onRemove }: { k: Kid; n: number; onChange: (p: Partial<Kid>) => void; onRemove?: () => void }) {
  const toggle = <T extends string>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const id = (s: string) => `${k.key}-${s}`;
  return (
    <Panel>
      <div className="flex items-start justify-between gap-3">
        <div><Kicker>Child {n}</Kicker><div className="mt-0.5 text-[20px] font-extrabold tracking-[-.03em]">{k.name || 'New child'}{k.name ? `, ${k.age}` : ''}</div></div>
        {onRemove && <button type="button" onClick={onRemove} className="text-[12px] font-semibold text-bad hover:underline">Remove</button>}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field id={id('name')} label="Name" hint="only the first name is ever shown"><Input id={id('name')} value={k.name} onChange={(e) => onChange({ name: e.target.value })} /></Field>
        <Field id={id('age')} label="Age"><Input id={id('age')} type="number" min={0} max={17} value={k.age} onChange={(e) => onChange({ age: Math.max(0, Math.min(17, Number(e.target.value) || 0)) })} /></Field>
        <Field id={id('gender')} label="Gender">
          <Select id={id('gender')} value={k.gender} onChange={(e) => onChange({ gender: e.target.value as Kid['gender'] })}>{GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}</Select>
        </Field>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-4">
        <Field id={id('cat')} label="Clothing category">
          <Select id={id('cat')} value={k.clothingCategory} onChange={(e) => onChange({ clothingCategory: e.target.value as ClothingCategory })}>{CLOTHING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        </Field>
        <Field id={id('shirt')} label="Shirt"><SizeSelect id={id('shirt')} value={k.shirtSize} options={CLOTHING_SIZES[k.clothingCategory]} onChange={(v) => onChange({ shirtSize: v })} /></Field>
        <Field id={id('pants')} label="Pants"><SizeSelect id={id('pants')} value={k.pantsSize} options={CLOTHING_SIZES[k.clothingCategory]} onChange={(v) => onChange({ pantsSize: v })} /></Field>
        <Field id={id('shoecat')} label="Shoe category">
          <Select id={id('shoecat')} value={k.shoeCategory} onChange={(e) => onChange({ shoeCategory: e.target.value as ClothingCategory })}>{CLOTHING_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</Select>
        </Field>
        <Field id={id('shoe')} label="Shoe size"><SizeSelect id={id('shoe')} value={k.shoeSize} options={SHOE_SIZES[k.shoeCategory]} onChange={(v) => onChange({ shoeSize: v })} /></Field>
        <div className="sm:col-span-3"><Field id={id('sizenotes')} label="Size notes" hint="optional"><Input id={id('sizenotes')} value={k.sizeNotes} onChange={(e) => onChange({ sizeNotes: e.target.value.slice(0, 500) })} placeholder="Runs small, prefers loose fit…" /></Field></div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field id={id('color')} label="Favorite color">
          <Select id={id('color')} value={k.favoriteColor} onChange={(e) => onChange({ favoriteColor: e.target.value })}>
            <option value="">—</option>
            {k.favoriteColor && !(FAVORITE_COLORS as readonly string[]).includes(k.favoriteColor) && <option value={k.favoriteColor}>{k.favoriteColor}</option>}
            {FAVORITE_COLORS.map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <Field id={id('hobbies')} label="Loves" hint="hobbies, characters"><Input id={id('hobbies')} value={k.hobbies} onChange={(e) => onChange({ hobbies: e.target.value.slice(0, 200) })} /></Field>
      </div>

      <div className="mt-5 text-[13px] font-semibold text-ink-2">Clothing needed</div>
      <div className="mt-2 flex flex-wrap gap-1.5">{CLOTHING_OPTIONS.map((o) => <button key={o} type="button" aria-pressed={k.clothingWishlist.includes(o)} onClick={() => onChange({ clothingWishlist: toggle(k.clothingWishlist, o) })} className={chip(k.clothingWishlist.includes(o))}>{o}</button>)}</div>
      <Input className="mt-2" value={k.otherClothing} onChange={(e) => onChange({ otherClothing: e.target.value.slice(0, 500) })} placeholder="Anything else (optional)" aria-label="Other clothing" />

      <div className="mt-5 text-[13px] font-semibold text-ink-2">Fun gifts</div>
      <div className="mt-2 flex flex-wrap gap-1.5">{GIFT_OPTIONS.map((o) => <button key={o} type="button" aria-pressed={k.giftTypes.includes(o)} onClick={() => onChange({ giftTypes: toggle(k.giftTypes, o) })} className={chip(k.giftTypes.includes(o))}>{o}</button>)}</div>
      {k.giftTypes.length > 0 && <div className="mt-3"><GiftFollowUps compact giftTypes={k.giftTypes} value={k.giftDetails} onChange={(d) => onChange({ giftDetails: d })} /></div>}
      <Input className="mt-3" value={k.specificGifts} onChange={(e) => onChange({ specificGifts: e.target.value.slice(0, 500) })} placeholder="A specific wish (optional)" aria-label="Specific wish" />
    </Panel>
  );
}
