import { z } from 'zod';
import { CLOTHING_CATEGORIES, CLOTHING_OPTIONS, CONTACT_METHODS, GENDERS, GIFT_OPTIONS, OTHER_SIZE, CLOTHING_SIZES, SHOE_SIZES } from './sizes.ts';
import { FAMILY_STATUSES, SPONSORSHIP_STATUSES } from './status.ts';
import { HANDOFFS, QUOTE_ROLES } from './types.ts';

const trimmed = (max = 200) => z.string().trim().max(max);

export const ChildInputSchema = z
  .object({
    name: trimmed(80).min(1, 'Please add a first name'),
    age: z.coerce.number().int().min(0).max(17),
    gender: z.enum(GENDERS),
    clothingCategory: z.enum(CLOTHING_CATEGORIES),
    shirtSize: trimmed(40).min(1),
    pantsSize: trimmed(40).min(1),
    shoeCategory: z.enum(CLOTHING_CATEGORIES),
    shoeSize: trimmed(40).min(1),
    sizeNotes: trimmed(500).default(''),
    favoriteColor: trimmed(60).default(''),
    hobbies: trimmed(200).default(''),
    clothingWishlist: z.array(z.enum(CLOTHING_OPTIONS)).default([]),
    otherClothing: trimmed(500).default(''),
    giftTypes: z.array(z.enum(GIFT_OPTIONS)).default([]),
    specificGifts: trimmed(500).default(''),
  })
  .superRefine((c, ctx) => {
    const sizes = [...CLOTHING_SIZES[c.clothingCategory], OTHER_SIZE];
    if (!sizes.includes(c.shirtSize)) ctx.addIssue({ code: 'custom', path: ['shirtSize'], message: 'Pick a size from the list' });
    if (!sizes.includes(c.pantsSize)) ctx.addIssue({ code: 'custom', path: ['pantsSize'], message: 'Pick a size from the list' });
    const shoes = [...SHOE_SIZES[c.shoeCategory], OTHER_SIZE];
    if (!shoes.includes(c.shoeSize)) ctx.addIssue({ code: 'custom', path: ['shoeSize'], message: 'Pick a size from the list' });
    if ([c.shirtSize, c.pantsSize, c.shoeSize].includes(OTHER_SIZE) && !c.sizeNotes.trim()) {
      ctx.addIssue({ code: 'custom', path: ['sizeNotes'], message: 'Tell us a little more about sizing so a sponsor can shop confidently' });
    }
  });
export type ChildInput = z.infer<typeof ChildInputSchema>;

export const FamilyApplicationSchema = z.object({
  eligibilityConfirmed: z.literal(true, { errorMap: () => ({ message: 'Please confirm household eligibility' }) }),
  guardianName: trimmed(120).min(2, 'Please enter your full name'),
  phone: z.string().trim().regex(/^[+()\-.\s\d]{10,20}$/, 'Enter a valid phone number'),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]).default(''),
  preferredContact: z.enum(CONTACT_METHODS).default('Text'),
  address: trimmed(200).min(3),
  city: trimmed(80).min(2),
  state: trimmed(2).length(2, 'Use the 2-letter state code'),
  zip: z.string().trim().regex(/^\d{5}(?:-\d{4})?$/, 'Enter a valid ZIP code'),
  transportation: z.enum(['Yes', 'No']),
  familyStory: trimmed(600).default(''),
  /** Public display name. Empty = we pick one from the kids' interests. Checked with nicknameProblem on the server. */
  nickname: trimmed(40).default(''),
  /** Optional family photo as a data URL (client resizes to <= 1200px, <= 1.5MB). */
  photoDataUrl: z.union([z.literal(''), z.string().regex(/^data:image\/(jpeg|png|webp);base64,/, 'Unsupported image').max(2_000_000, 'Photo is too large')]).default(''),
  /** The family wants the photo kept from sponsors (staff only). */
  photoPrivate: z.boolean().default(false),
  notes: trimmed(1000).default(''),
  children: z.array(ChildInputSchema).min(1, 'Add at least one child').max(15, 'Please contact program staff for households with more than 15 children'),
});
export type FamilyApplication = z.infer<typeof FamilyApplicationSchema>;

export const ClaimRequestSchema = z.object({
  name: trimmed(120).min(2, 'Please enter your name'),
  email: z.string().trim().email('Enter a valid email'),
  phone: z.union([z.literal(''), z.string().trim().regex(/^[+()\-.\s\d]{10,20}$/, 'Enter a valid phone number')]).default(''),
  organization: trimmed(120).default(''),
  /** Holiday Konnectors are contacted by email only; the phone is kept for urgent delivery questions. */
  preferredContact: z.literal('Email').default('Email'),
  emailConsent: z.literal(true, { errorMap: () => ({ message: 'Please confirm updates can come by email' }) }),
  note: trimmed(500).default(''),
  handoff: z.enum(HANDOFFS).default('Drop off'),
  /** Add my name to the Wall of Holiday Konnectors once gifts are in. */
  wallOptIn: z.boolean().default(false),
  displayName: trimmed(80).default(''),
  agree: z.literal(true, { errorMap: () => ({ message: 'Please confirm you can support every child in this family' }) }),
});
export type ClaimRequest = z.infer<typeof ClaimRequestSchema>;

export const ChipInSchema = z.object({
  amount: z.coerce.number().int().min(5).max(5000),
  coverFees: z.boolean().default(true),
  name: trimmed(120).default(''),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]).default(''),
});
export type ChipIn = z.infer<typeof ChipInSchema>;

export const QuoteSubmitSchema = z.object({
  role: z.enum(QUOTE_ROLES),
  name: trimmed(80).min(2, 'How should we credit you? A first name is fine.'),
  organization: trimmed(120).default(''),
  quote: trimmed(600).min(12, 'A sentence or two is perfect.'),
  email: z.union([z.literal(''), z.string().trim().email('Enter a valid email')]).default(''),
  consent: z.literal(true, { errorMap: () => ({ message: 'Please confirm we can share your words' }) }),
  /** Optional Konnector portal token so staff can see which family it is about. */
  token: trimmed(80).default(''),
});
export type QuoteSubmit = z.infer<typeof QuoteSubmitSchema>;

export const SponsorUpdateSchema = z.object({
  status: z.enum(SPONSORSHIP_STATUSES),
  note: trimmed(500).default(''),
  reason: trimmed(200).default(''),
});

export const FamilyStatusSchema = z.enum(FAMILY_STATUSES);
export const SponsorshipStatusSchema = z.enum(SPONSORSHIP_STATUSES);
