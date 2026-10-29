import type { Family, PublicFamily, SeasonSettings, Sponsor, Sponsorship } from '@bless/shared';
import { config } from '../config.ts';
import type { EmailSpec } from '../notify/render.ts';

/**
 * All email copy lives here. Voice: short, warm, specific. One idea per line, a bold headline,
 * one clear button. Layout is in notify/render.ts; sending and logging in notify/mailer.ts.
 */

export type MessageKind =
  | 'claim_confirmation'   // Konnector: right after choosing a family
  | 'confirm_nudge'        // Konnector: claimed, hasn't started shopping
  | 'shopping_checkin'     // Konnector: shopping, how's it going
  | 'deadline_reminder'    // Konnector: last week before the deadline
  | 'dropoff_thanks'       // Konnector: gifts handed off
  | 'delivered_thanks'     // Konnector: delivered to the family
  | 'released_notice'      // Konnector: staff reopened the family
  | 'release_confirmation' // Konnector: they released the family themselves
  | 'staff_note'           // Konnector: custom message from staff or the assistant
  | 'family_received'      // Family: application received
  | 'family_approved'      // Family: listed for Konnectors
  | 'family_matched'       // Family: a Konnector chose them
  | 'family_note';         // Family: custom message from staff or the assistant

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
  custom?: string; // staff-authored note
}

export interface ComposedMessage {
  subject: string;
  spec: EmailSpec;
}

/** How gifts must be prepared. Shown after claiming and repeated in reminders. */
export const GIFT_RULES = [
  "Wrap every gift and label it with the child's name.",
  'Include a gift receipt with each clothing item.',
  'Buy the same number of gifts for each child.',
];

const firstName = (n: string) => (n || 'there').trim().split(/\s+/)[0];
const kidList = (f: PublicFamily) => f.children.map((c) => `${c.name} (${c.age})`).join(', ');
const kidNames = (f: PublicFamily) => {
  const n = f.children.map((c) => c.name);
  return n.length <= 1 ? n.join('') : `${n.slice(0, -1).join(', ')} and ${n.at(-1)}`;
};
export function fmtDate(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric' }) {
  const d = new Date(iso.length === 10 ? iso + 'T12:00:00' : iso);
  return d.toLocaleDateString('en-US', opts);
}
const due = (s: SeasonSettings) => fmtDate(s.dropoffDeadline);
const shortDue = (s: SeasonSettings) => fmtDate(s.dropoffDeadline, { month: 'long', day: 'numeric' });
const direct = (ctx: MessageContext) => ctx.sponsorship?.handoff === 'Deliver directly';
const handoffRow = (ctx: MessageContext) =>
  direct(ctx)
    ? { label: 'Hand-off', value: "You deliver to the family. We'll contact you to arrange it." }
    : { label: 'Drop off at', value: `${ctx.settings.dropoffLocation}, ${ctx.settings.dropoffHours}` };
const daysLine = (d: number) => (d < 0 ? 'Past due' : d === 0 ? 'Today' : `${d} day${d === 1 ? '' : 's'} left`);
export const shareUrl = (token?: string) => `${config.webUrl}/share${token ? `?k=${token}` : ''}`;

/** Deterministic templates for Konnector and family emails. */
export function template(ctx: MessageContext): ComposedMessage {
  const { family: f, settings: s, sponsor } = ctx;
  const name = firstName(sponsor?.name ?? '');
  const page = ctx.portalUrl ? { label: 'Open your family page', url: ctx.portalUrl } : undefined;
  const guardian = firstName(ctx.fullFamily?.guardianName ?? '');
  switch (ctx.kind) {
    case 'claim_confirmation':
      return {
        subject: `You're blessing ${f.nickname}`,
        spec: {
          preheader: `${f.kidLine}, gifts due ${shortDue(s)}. Everything you need is on your family page.`,
          eyebrow: 'Welcome, Holiday Konnector',
          title: `You're blessing ${f.nickname}.`,
          intro: `Thank you, ${name}. ${f.childCount === 1 ? 'One child is' : `${f.childCount} kids are`} counting on you: ${kidList(f)}.`,
          details: [{ label: 'Gifts due', value: due(s) }, handoffRow(ctx), { label: 'Typical spend', value: '$100–$250 per child' }],
          list: GIFT_RULES,
          cta: page,
          note: "Tap \"I've started shopping\" on your family page when you begin. We'll send friendly reminders along the way.",
        },
      };
    case 'confirm_nudge':
      return {
        subject: `Still in for ${f.nickname}?`,
        spec: {
          preheader: 'One tap tells us you have started shopping.',
          eyebrow: 'Quick check-in',
          title: `Still in for ${f.nickname}?`,
          intro: `Hi ${name}. Tap once when you start shopping for ${kidNames(f)} so we can plan deliveries.`,
          paragraphs: [`Plans changed? No problem. Release the family from your page so another Konnector can step in. If you can, tell us at least 10 days before ${shortDue(s)}.`],
          details: [{ label: 'Gifts due', value: due(s) }, { label: 'Time left', value: daysLine(ctx.daysToDeadline) }],
          cta: page,
        },
      };
    case 'shopping_checkin':
      return {
        subject: `How's shopping for ${f.nickname}?`,
        spec: {
          preheader: 'Update your progress in one tap.',
          eyebrow: 'Check-in',
          title: 'How is the list coming?',
          intro: `Hi ${name}. Mark your progress for ${f.nickname} as you go: purchased, wrapped, handed off.`,
          details: [{ label: 'Gifts due', value: due(s) }, { label: 'Time left', value: daysLine(ctx.daysToDeadline) }],
          cta: page,
          note: 'Questions about sizes or wishes? Everything is on your family page, or just reply.',
        },
      };
    case 'deadline_reminder': {
      const d = ctx.daysToDeadline;
      return {
        subject: d <= 0 ? `Gifts for ${f.nickname} are due today` : `${d} day${d === 1 ? '' : 's'} left for ${f.nickname}`,
        spec: {
          preheader: direct(ctx) ? "We'll be in touch to arrange delivery." : `Drop off at ${s.dropoffLocation}.`,
          eyebrow: 'Almost there',
          title: d <= 0 ? 'Gifts are due today.' : `${d} day${d === 1 ? '' : 's'} to go.`,
          intro: `Hi ${name}. ${f.nickname} is almost ready for the holidays.`,
          details: [{ label: 'Gifts due', value: due(s) }, handoffRow(ctx)],
          list: GIFT_RULES,
          cta: ctx.portalUrl ? { label: 'Mark your progress', url: ctx.portalUrl } : undefined,
          note: "Running late? Reply to this email and we'll figure it out together.",
        },
      };
    }
    case 'dropoff_thanks':
      return {
        subject: direct(ctx) ? `Thank you for delivering to ${f.nickname}` : `Got them. Thank you.`,
        spec: {
          preheader: direct(ctx) ? "We'll confirm with the family." : "We'll let you know once they're delivered.",
          eyebrow: 'Gifts handed off',
          title: direct(ctx) ? 'Thank you for delivering.' : 'Got them. Thank you.',
          intro: direct(ctx) ? `We'll check in with ${f.nickname} and let you know everything arrived.` : `Your gifts for ${f.nickname} are with us. We'll tell you the moment they're delivered.`,
          cta: page,
        },
      };
    case 'delivered_thanks':
      return {
        subject: `Delivered. ${f.nickname} has their gifts.`,
        spec: {
          preheader: 'You made a real holiday happen.',
          eyebrow: 'Delivered',
          title: 'You made their holiday.',
          intro: `${f.nickname} received the gifts you chose for ${kidNames(f)}. Thank you, ${name}.`,
          paragraphs: ['Would you share a sentence about the experience? With your OK, it may inspire next year\'s Holiday Konnectors.'],
          cta: { label: 'Share a few words', url: shareUrl(ctx.sponsorship?.token) },
        },
      };
    case 'released_notice':
      return {
        subject: `${f.nickname} has been reopened`,
        spec: {
          preheader: 'Another Holiday Konnector can now step in.',
          eyebrow: 'Family reopened',
          title: `${f.nickname} has been reopened.`,
          intro: `Hi ${name}. We reopened the family so another Konnector can step in${ctx.reason ? ` (${ctx.reason.toLowerCase()})` : ''}.`,
          paragraphs: ["If this was a mistake, reply and we'll sort it out right away. Thank you for considering them."],
        },
      };
    case 'release_confirmation':
      return {
        subject: `You've released ${f.nickname}`,
        spec: {
          preheader: 'Thank you for letting us know.',
          eyebrow: 'Family released',
          title: "Thank you for telling us.",
          intro: `${f.nickname} is back in the catalog so another Holiday Konnector can step in.`,
          paragraphs: ['Plans change. If you would still like to help this season, a smaller family or a chip-in makes a real difference.'],
          cta: { label: 'See who is waiting', url: `${config.webUrl}/families` },
        },
      };
    case 'staff_note':
      return {
        subject: `A note about ${f.nickname}`,
        spec: {
          preheader: (ctx.custom ?? '').slice(0, 90),
          eyebrow: 'From The Konnection',
          title: `A note about ${f.nickname}.`,
          intro: `Hi ${name},`,
          quote: { text: ctx.custom ?? '', by: 'The Konnection team' },
          details: [{ label: 'Gifts due', value: due(s) }],
          cta: page,
        },
      };
    case 'family_received':
      return {
        subject: 'We received your application',
        spec: {
          preheader: `Your family number is ${f.familyId}.`,
          eyebrow: 'Bless This Family',
          title: 'We got your application.',
          intro: `Thank you, ${guardian}. Our team reviews every family, usually within two days.`,
          details: [{ label: 'Family number', value: f.familyId }, { label: 'Children', value: kidList(f) }],
          note: "We'll email you once your family is approved. Keep your family number handy.",
        },
      };
    case 'family_approved':
      return {
        subject: "You're on the list",
        spec: {
          preheader: 'Holiday Konnectors can now choose your family.',
          eyebrow: 'Approved',
          title: "You're on the list.",
          intro: `Good news, ${guardian}. Holiday Konnectors can now see your family. We'll email you as soon as one chooses you.`,
          details: [{ label: 'Family number', value: f.familyId }],
          note: 'Only first names, ages, sizes and wishes are shared. Never your address or phone.',
        },
      };
    case 'family_note':
      return {
        subject: 'A note from The Konnection',
        spec: {
          preheader: (ctx.custom ?? '').slice(0, 90),
          eyebrow: 'From The Konnection',
          title: `Hi ${guardian}.`,
          quote: { text: ctx.custom ?? '', by: 'The Konnection team' },
          details: [{ label: 'Family number', value: f.familyId }],
          note: 'Questions? Just reply to this email.',
        },
      };
    case 'family_matched': {
      const pickup = ctx.fullFamily?.transportation === 'Yes';
      return {
        subject: 'A Holiday Konnector chose your family',
        spec: {
          preheader: `Gifts for ${kidNames(f)} are on the way.`,
          eyebrow: 'Good news',
          title: 'Someone chose your family.',
          intro: `${guardian}, a Holiday Konnector is shopping for ${kidNames(f)} right now.`,
          details: [{ label: 'Family number', value: f.familyId }, { label: 'Gifts', value: pickup ? `Pick up. We'll send pick-up details before ${shortDue(s)}.` : `Delivery. We'll contact you to arrange it.` }],
          note: "Questions? Just reply. We'll keep you posted.",
        },
      };
    }
  }
}

// ---- Account and admin emails ------------------------------------------------

export function konnectorLoginEmail(link: string): ComposedMessage {
  return {
    subject: 'Your sign-in link',
    spec: {
      preheader: 'Tap to open your family page. Works for 30 minutes.',
      eyebrow: 'Sign in',
      title: 'Welcome back.',
      intro: 'Tap below to open your Bless This Family account. The link works for 30 minutes.',
      cta: { label: 'Sign in', url: link },
      note: "Didn't ask for this? You can ignore it. Nobody can sign in without this link.",
    },
  };
}

export function konnectorNoAccountEmail(email: string): ComposedMessage {
  return {
    subject: 'No family found for this email',
    spec: {
      preheader: 'Choose a family to get started.',
      eyebrow: 'Sign in',
      title: "We couldn't find a family.",
      intro: `Nobody has chosen a family with ${email} yet. Choose one and your account is created automatically.`,
      cta: { label: 'Find a family', url: `${config.webUrl}/families` },
      note: 'Used a different email when you chose your family? Sign in with that one.',
    },
  };
}

export function adminLoginEmail(link: string): ComposedMessage {
  return {
    subject: 'Your admin sign-in link',
    spec: {
      preheader: 'Tap to open the Bless This Family admin. Works for 15 minutes.',
      eyebrow: 'Admin',
      title: 'Sign in to admin.',
      intro: 'Tap below to open the Bless This Family admin. The link works for 15 minutes.',
      cta: { label: 'Open admin', url: link },
      note: "Didn't ask for this? Ignore it.",
    },
  };
}

export type AdminAlert =
  | { kind: 'admin_new_application'; family: Family; pub: PublicFamily }
  | { kind: 'admin_family_claimed'; family: Family; pub: PublicFamily; sponsor: Sponsor; sponsorship: Sponsorship }
  | { kind: 'admin_family_released'; family: Family; pub: PublicFamily; sponsor: Sponsor | null; reason: string; by: string }
  | { kind: 'admin_flagged'; family: Family; pub: PublicFamily; sponsor: Sponsor | null; sponsorship: Sponsorship; count: number }
  | { kind: 'admin_handed_off'; family: Family; pub: PublicFamily; sponsor: Sponsor | null; sponsorship: Sponsorship }
  | { kind: 'admin_quote'; name: string; role: string; quote: string }
  | { kind: 'admin_followup_run'; sent: number; flagged: number; skipped: number; by: string };

export function adminAlert(a: AdminAlert): ComposedMessage {
  const famLink = (f: Family) => ({ label: 'Open in admin', url: `${config.webUrl}/admin/families/${f.id}` });
  switch (a.kind) {
    case 'admin_new_application':
      return {
        subject: `New application: ${a.family.familyId}`,
        spec: {
          preheader: `${a.pub.kidLine} in ${a.family.city}. Ready for review.`, eyebrow: 'New application', title: 'A family applied.',
          details: [{ label: 'Family', value: `${a.family.familyId} · ${a.pub.nickname}` }, { label: 'Children', value: kidList(a.pub) }, { label: 'City', value: a.family.city }, { label: 'Gifts', value: a.family.transportation === 'Yes' ? 'Will pick up' : 'Needs delivery' }, { label: 'Story', value: a.family.familyStory ? 'Yes, needs review' : 'None' }],
          cta: { label: 'Review application', url: `${config.webUrl}/admin/review` },
        },
      };
    case 'admin_family_claimed':
      return {
        subject: `${a.family.familyId} was chosen by ${a.sponsor.name}`,
        spec: {
          preheader: a.sponsorship.handoff === 'Deliver directly' ? 'They will deliver directly. Connect them with the family.' : 'They will drop off gifts with us.',
          eyebrow: 'Family chosen', title: `${a.pub.nickname} has a Konnector.`,
          details: [{ label: 'Konnector', value: a.sponsor.name }, { label: 'Email', value: a.sponsor.email }, ...(a.sponsor.phone ? [{ label: 'Phone', value: a.sponsor.phone }] : []), ...(a.sponsor.organization ? [{ label: 'Organization', value: a.sponsor.organization }] : []), { label: 'Hand-off', value: a.sponsorship.handoff === 'Deliver directly' ? 'Delivers directly. Share the address privately.' : 'Drops off with us' }, { label: 'Family', value: `${a.family.familyId} · ${a.pub.kidLine}` }],
          cta: famLink(a.family),
        },
      };
    case 'admin_family_released':
      return {
        subject: `${a.family.familyId} was released`,
        spec: {
          preheader: 'The family is back in the catalog.', eyebrow: 'Family released', title: `${a.pub.nickname} is back in the catalog.`,
          details: [{ label: 'Konnector', value: a.sponsor ? `${a.sponsor.name} (${a.sponsor.email})` : 'Unknown' }, { label: 'Released by', value: a.by }, { label: 'Reason', value: a.reason || 'Not given' }],
          cta: famLink(a.family),
        },
      };
    case 'admin_flagged':
      return {
        subject: `Needs a person: ${a.family.familyId}`,
        spec: {
          preheader: `No response after ${a.count} follow-ups.`, eyebrow: 'Flagged', title: 'A Konnector has gone quiet.',
          intro: `${a.sponsor?.name ?? 'The Konnector'} hasn't responded after ${a.count} follow-ups. Reminders are paused until someone on the team decides.`,
          details: [{ label: 'Family', value: `${a.family.familyId} · ${a.pub.nickname}` }, { label: 'Konnector', value: a.sponsor ? `${a.sponsor.name} (${a.sponsor.email})` : 'Unknown' }, { label: 'Step', value: a.sponsorship.status }],
          cta: { label: 'Open Sponsors', url: `${config.webUrl}/admin/sponsors` },
        },
      };
    case 'admin_handed_off':
      return {
        subject: `Gifts handed off for ${a.family.familyId}`,
        spec: {
          preheader: a.sponsorship.handoff === 'Deliver directly' ? 'Confirm with the family, then mark it delivered.' : 'Schedule delivery to the family.',
          eyebrow: 'Gifts handed off', title: a.sponsorship.handoff === 'Deliver directly' ? 'Delivered by the Konnector.' : 'Gifts are in.',
          details: [{ label: 'Family', value: `${a.family.familyId} · ${a.pub.nickname}` }, { label: 'Konnector', value: a.sponsor?.name ?? 'Unknown' }, { label: 'Next', value: a.sponsorship.handoff === 'Deliver directly' ? 'Confirm with the family, then mark Delivered.' : a.family.transportation === 'Yes' ? 'Family picks up. Send pick-up details.' : 'Schedule delivery, then mark Delivered.' }],
          cta: famLink(a.family),
        },
      };
    case 'admin_quote':
      return {
        subject: `New quote from ${a.name}`,
        spec: { preheader: a.quote.slice(0, 90), eyebrow: 'New quote', title: 'Someone shared their story.', quote: { text: a.quote, by: `${a.name} · ${a.role}` }, cta: { label: 'Review quotes', url: `${config.webUrl}/admin/community` } },
      };
    case 'admin_followup_run':
      return {
        subject: `Follow-ups: ${a.sent} sent`,
        spec: {
          preheader: `${a.sent} sent, ${a.flagged} flagged.`, eyebrow: 'Follow-ups run', title: `${a.sent} reminder${a.sent === 1 ? '' : 's'} sent.`,
          details: [{ label: 'Sent', value: String(a.sent) }, { label: 'Flagged for a person', value: String(a.flagged) }, { label: 'Skipped', value: String(a.skipped) }, { label: 'Run by', value: a.by }],
          cta: { label: 'Open the email log', url: `${config.webUrl}/admin/emails` },
        },
      };
  }
}

export function testEmail(by: string): ComposedMessage {
  return {
    subject: 'Test email from Bless This Family',
    spec: {
      preheader: 'If you can read this, email is working.',
      eyebrow: 'Test',
      title: 'Email is working.',
      intro: 'This is how every Bless This Family email looks: one card, one headline, one clear next step.',
      details: [{ label: 'Sent by', value: by }, { label: 'Sent at', value: new Date().toLocaleString('en-US', { timeZone: 'America/Detroit', dateStyle: 'medium', timeStyle: 'short' }) + ' ET' }],
      list: ['Konnector confirmations, check-ins and thank-yous', 'Family updates', 'Team alerts and sign-in links'],
      cta: { label: 'Open Bless This Family', url: config.webUrl },
    },
  };
}
