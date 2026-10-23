import type { Family, PublicFamily, SeasonSettings, Sponsor, Sponsorship } from '@bless/shared';
import { config } from '../config.ts';

export type MessageKind =
  | 'claim_confirmation'   // right after claiming
  | 'confirm_nudge'        // sponsor never confirmed
  | 'shopping_checkin'     // confirmed, how is it going
  | 'deadline_reminder'    // drop-off coming up
  | 'dropoff_thanks'       // gifts received
  | 'delivered_thanks'     // delivered to family
  | 'released_notice'      // we released the family
  | 'family_received'      // to the family: application received
  | 'family_approved';     // to the family: you're listed

export interface MessageContext {
  kind: MessageKind;
  sponsor?: Pick<Sponsor, 'name' | 'email'>;
  family: PublicFamily;
  fullFamily?: Family;
  sponsorship?: Sponsorship;
  settings: SeasonSettings;
  portalUrl?: string;
  daysToDeadline: number;
  followUpCount?: number;
  reason?: string;
  custom?: string; // admin-authored body override
}

export interface ComposedMessage {
  subject: string;
  text: string;
  sms: string;
}

const firstName = (n: string) => (n || 'there').split(/\s+/)[0];
const kidLine = (f: PublicFamily) => f.children.map((c) => `${c.name} (${c.age})`).join(', ');
const deadlineLine = (s: SeasonSettings, days: number) =>
  days >= 0 ? `Gift drop-off deadline: ${fmtDate(s.dropoffDeadline)} (${days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} away`}) at ${s.dropoffLocation}, ${s.dropoffHours}.` : `The drop-off deadline (${fmtDate(s.dropoffDeadline)}) has passed — please reach us at ${s.contactEmail}.`;

export function fmtDate(iso: string) {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

/** Deterministic templates. Always available; Claude may polish the body (see personalize). */
export function template(ctx: MessageContext): ComposedMessage {
  const { family: f, settings: s, sponsor } = ctx;
  const name = firstName(sponsor?.name ?? '');
  const link = ctx.portalUrl ?? '';
  const sign = `\n\nWith gratitude,\nThe Konnection team\n${s.contactEmail}${s.contactPhone ? ' · ' + s.contactPhone : ''}`;
  switch (ctx.kind) {
    case 'claim_confirmation':
      return {
        subject: `You're blessing ${f.nickname} this holiday 🎁`,
        text: `Hi ${name},\n\nThank you. You're blessing ${f.nickname} — ${f.childCount} ${f.childCount === 1 ? 'child' : 'children'}: ${kidLine(f)}.\n\nHere is your private family page with every wishlist and size, plus one-tap status updates so we never have to chase you:\n${link}\n\nTwo quick things:\n1. When you start shopping, tap "I've started shopping" on that page so our team can plan deliveries.\n2. ${deadlineLine(s, ctx.daysToDeadline)} One bag per child with their first name on it.\n\n${s.perChildBudgetNote}${sign}`,
        sms: `The Konnection: thank you for claiming ${f.nickname} (${kidLine(f)}). Wishlists + status updates: ${link}. Drop-off by ${fmtDate(s.dropoffDeadline)}.`,
      };
    case 'confirm_nudge':
      return {
        subject: `Quick check-in: are you still in for ${f.nickname}?`,
        text: `Hi ${name},\n\nQuick check-in — still in for ${f.nickname} (${kidLine(f)})? When you start shopping, tap "I've started shopping" on your family page so we can plan deliveries:\n${link}\n\nIf plans changed, no judgment at all — tap "I can no longer sponsor this family" on the same page so another sponsor can step in while there's still time.\n\n${deadlineLine(s, ctx.daysToDeadline)}${sign}`,
        sms: `The Konnection: still in for ${f.nickname}? Tap to confirm or release so another sponsor can help: ${link}`,
      };
    case 'shopping_checkin':
      return {
        subject: `How's shopping going for ${f.nickname}?`,
        text: `Hi ${name},\n\nHow's it going with ${f.nickname}'s list (${kidLine(f)})? Tap your progress on your family page — purchased, wrapped, dropped off — so our team can plan deliveries:\n${link}\n\n${deadlineLine(s, ctx.daysToDeadline)}\n\nQuestions about sizes or what the kids like? Everything is on that page, and you can reply to this email anytime.${sign}`,
        sms: `The Konnection: how's shopping going for ${f.nickname}? Update us in one tap: ${link}. Drop-off by ${fmtDate(s.dropoffDeadline)}.`,
      };
    case 'deadline_reminder':
      return {
        subject: `${ctx.daysToDeadline <= 1 ? 'Last call' : `${ctx.daysToDeadline} days left`}: gift drop-off for ${f.nickname}`,
        text: `Hi ${name},\n\n${deadlineLine(s, ctx.daysToDeadline)}\n\nWhen you drop off gifts for ${f.nickname}, tap "Gifts dropped off" so the family's delivery gets scheduled:\n${link}\n\nCan't make the deadline? Reply to this email and we'll figure it out together.${sign}`,
        sms: `The Konnection: ${ctx.daysToDeadline <= 1 ? 'last call' : ctx.daysToDeadline + ' days left'} to drop off gifts for ${f.nickname} at ${s.dropoffLocation}. Mark done: ${link}`,
      };
    case 'dropoff_thanks':
      return {
        subject: `Got them! Thank you for ${f.nickname}`,
        text: `Hi ${name},\n\nWe received your gifts for ${f.nickname}. Thank you for showing up for ${kidLine(f)}. We'll let you know once they're delivered.${sign}`,
        sms: `The Konnection: we received your gifts for ${f.nickname}. Thank you!`,
      };
    case 'delivered_thanks':
      return {
        subject: `Delivered: ${f.nickname} has their gifts 💛`,
        text: `Hi ${name},\n\nIt's done. ${f.nickname} received the gifts you chose for ${kidLine(f)}. You made a real holiday happen for this household.\n\nThank you for being part of Bless-A-Family.${sign}`,
        sms: `The Konnection: ${f.nickname} received their gifts. Thank you for making it happen.`,
      };
    case 'released_notice':
      return {
        subject: `${f.nickname} has been reopened for another sponsor`,
        text: `Hi ${name},\n\nWe've reopened ${f.nickname} so another sponsor can step in${ctx.reason ? ` (${ctx.reason})` : ''}. If this was a mistake, reply to this email and we'll sort it out right away.\n\nThank you for considering them.${sign}`,
        sms: `The Konnection: ${f.nickname} was reopened for another sponsor. Reply if this was a mistake.`,
      };
    case 'family_received':
      return {
        subject: 'We received your Bless-A-Family application',
        text: `Hi ${firstName(ctx.fullFamily?.guardianName ?? '')},\n\nThank you for applying to Bless-A-Family ${s.season}. Your family number is ${f.familyId}. Our team reviews every application; once yours is approved it will be listed for sponsors. We'll contact you by ${ctx.fullFamily?.preferredContact?.toLowerCase() ?? 'phone'} with updates.${sign}`,
        sms: `The Konnection: we received your Bless-A-Family application (${f.familyId}). We'll be in touch once it's reviewed.`,
      };
    case 'family_approved':
      return {
        subject: 'Your family is now listed for sponsors',
        text: `Hi ${firstName(ctx.fullFamily?.guardianName ?? '')},\n\nGood news: your Bless-A-Family application (${f.familyId}) was approved and is now visible to sponsors. We'll reach out as soon as a sponsor chooses your family.${sign}`,
        sms: `The Konnection: your Bless-A-Family application (${f.familyId}) is approved and listed for sponsors.`,
      };
  }
}

/**
 * Optional Claude polish: rewrite the email body in a warmer, more personal
 * voice using ONLY the facts in the template. Falls back to the template on
 * any failure, so messaging never depends on the model.
 */
export async function personalize(ctx: MessageContext, base: ComposedMessage): Promise<ComposedMessage> {
  if (!config.anthropic.apiKey || ctx.custom) return base;
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: config.anthropic.apiKey });
    const res = await client.beta.messages.create({
      model: config.anthropic.writerModel,
      max_tokens: 1200,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low' },
      system:
        'You write short, warm, plain-English emails for The Konnection, a Detroit nonprofit running a holiday gift program called Bless-A-Family. ' +
        'Rewrite the draft so it sounds like a real person on a small team wrote it: kind, direct, no corporate filler, no exclamation-point pileups, no emojis. ' +
        'Keep every fact, link, deadline, name and age exactly as given. Do not add facts, promises, or new instructions. Keep the same call to action. ' +
        'Keep it under 140 words. Return only the email body (no subject line).',
      messages: [{ role: 'user', content: `Draft:\n\n${base.text}` }],
    });
    if (res.stop_reason === 'refusal') return base;
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
    if (text.length < 40 || (ctx.portalUrl && !text.includes(ctx.portalUrl))) return base;
    return { ...base, text };
  } catch (e) {
    console.warn('[personalize] falling back to template:', (e as Error).message);
    return base;
  }
}
