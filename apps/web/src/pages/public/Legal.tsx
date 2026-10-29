import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { shell } from './shared.tsx';

/** Bump when either policy changes in a meaningful way (and email active participants about it). */
const EFFECTIVE = 'October 29, 2026';
const FALLBACK_CONTACT = 'sharnese@thekonnection.org';

type Block = string | string[];
type Section = { id: string; title: string; body: Block[] };

/**
 * Privacy Policy and Terms of Use for Bless This Family, operated by The Konnection.
 * Written to match what the app actually does (see docs/DECISIONS.md "Legal page").
 * Keep it in sync when data handling changes: new fields, new vendors, new public surfaces.
 */
function privacy(contact: string): Section[] {
  return [
    { id: 'p-who', title: 'Who we are', body: [
      'Bless This Family is a holiday gift program run by The Konnection, a nonprofit organization based in Detroit, Michigan. This policy explains what information the program collects on this website, how we use it, and the choices you have. "We," "us" and "our" mean The Konnection.',
      `Questions about your information go to Sharnese at ${contact}.`,
    ] },
    { id: 'p-collect', title: 'What we collect', body: [
      'We only ask for what we need to match families with Holiday Konnectors and get gifts to children.',
      [
        'Families (from a parent or guardian): your name, phone, email (optional unless you choose email), home address, city and ZIP, how you prefer to be contacted, whether you prefer to pick up gifts or have them delivered, and confirmation that you are part of The Konnection’s programs.',
        'About each child: first name, age, gender (or "prefer not to say"), clothing and shoe sizes, favorite color, interests and a wish list. A short family story and a family photo are optional.',
        'Holiday Konnectors: your name, email, optional phone and organization, how you will hand off gifts, the name you want on our thank-you wall, notes you send us, and the progress you mark on your family page.',
        'Quotes and shout-outs: your words, the name you want to be credited as, and an optional email.',
        'Chip-ins: the amount you pledge and an optional email. Payments are handled by Zeffy. We never see or store your card details.',
        'Staff: the work email used to sign in to the admin tools.',
      ],
      'Automatically: we do not use advertising or analytics trackers. We count how many times each family profile is viewed (without recording who viewed it). Your IP address is used briefly, in memory, to stop spam and limit repeated sign-in attempts. It is not saved with your records. Our hosting provider keeps standard server logs for security.',
    ] },
    { id: 'p-use', title: 'How we use it', body: [[
      'To review applications and list approved families for Holiday Konnectors.',
      'To match a family with a Holiday Konnector and coordinate drop-off, pick-up or delivery.',
      'To send emails about your application, your family, deadlines and hand-off. These are program emails, not marketing.',
      'To thank Holiday Konnectors publicly, but only those who opt in.',
      'To report program totals (families served, gifts delivered) and improve the program.',
      'To keep the program safe, prevent fraud and meet legal obligations.',
    ]] },
    { id: 'p-public', title: 'What is public, and what never is', body: [
      'An approved family profile shows a family nickname (one we suggest from your kids\u2019 interests, or one you choose, never including last names), your city, each child’s first name, age, sizes and wishes. Your family story and photo appear only after our team approves them, and never if you mark the photo staff-only.',
      'We never publish parent or guardian names, last names, home addresses, phone numbers, email addresses or school names.',
      'A Holiday Konnector’s name appears on the thank-you wall only if they opt in, only after their gifts are handed off, and only as the name they choose. Quotes appear only after our team approves them, with the credit name you gave. Our team can hide any name or quote at any time.',
    ] },
    { id: 'p-share', title: 'Who we share it with', body: [
      'We do not sell, rent or trade personal information. We share it only as follows:',
      [
        'With the Holiday Konnector who chooses your family: the information on your family profile. If gifts are delivered directly, our team arranges the hand-off and shares only what is needed to complete it.',
        'With service providers that run the program for us, under their privacy and security terms: Airtable (program database), Netlify (website hosting), Resend (email delivery), Zeffy (chip-in donations) and Google Fonts (typefaces). When enabled, our staff use an AI assistant from Anthropic to help manage program records. Anthropic’s commercial terms limit how it can use that data.',
        'When required by law, or to protect the safety of a child, a family, a volunteer or the public.',
      ],
    ] },
    { id: 'p-children', title: 'Children’s privacy', body: [
      'This program serves children, but children do not use this website. A parent or guardian provides all information about their children, and we collect only what a gift-giver needs: first names, ages, sizes and wishes. We do not knowingly collect personal information directly from children under 13. If you believe a child has submitted information to us, contact us and we will delete it.',
      'Parents control whether a family photo is shared and can ask us to remove a photo or story at any time.',
    ] },
    { id: 'p-cookies', title: 'Cookies and browser storage', body: [
      'We use a small number of cookies and browser storage items, all needed for the site to work:',
      [
        'A sign-in cookie for Holiday Konnectors (lasts up to 60 days) and a session cookie for staff.',
        'Browser storage that remembers your private family page link, families you saved while browsing, and that you have already seen the intro animation.',
      ],
      'We do not use advertising or cross-site tracking cookies.',
    ] },
    { id: 'p-email', title: 'Emails', body: [
      'Families get emails when an application is received, approved and matched. Holiday Konnectors get a confirmation, check-ins, deadline reminders and thank-yous. Sign-in links are sent only when you ask for one. We keep a record of the emails we send so our team can help if something goes missing.',
      `These emails are part of taking part in the program. If you would like fewer emails, or none, write to ${contact}. If you are a Holiday Konnector, we may then need to reopen your family so another Konnector can help. We will not add you to a newsletter or fundraising list unless you ask.`,
    ] },
    { id: 'p-retention', title: 'How long we keep it', body: [
      'We keep program records for the current season and generally up to three years afterward, for reporting, audits and to welcome back returning families and Holiday Konnectors. After that we delete them or remove the details that identify you. You can ask us to delete your information sooner (see below). We may need to keep a minimal record of donations where the law requires it.',
    ] },
    { id: 'p-security', title: 'Security', body: [
      'Only signed-in staff can see private family details. Information is encrypted in transit, and private family pages are reached through hard-to-guess links. Treat your family page link and sign-in emails like a password. No system is perfectly secure. If we learn of a breach that affects you, we will tell you as the law requires.',
    ] },
    { id: 'p-choices', title: 'Your choices', body: [
      `You can ask to see, correct or delete your information, withdraw your family’s application, remove a photo or story, or come off the thank-you wall. Write to ${contact} from the email you used, or tell us how to reach you. We aim to respond within 30 days. Holiday Konnectors can also update their wall name and release a family from their family page.`,
    ] },
    { id: 'p-changes', title: 'Changes to this policy', body: [
      'If we change this policy, we will update the date at the top of this page. If a change materially affects how we use information you already gave us, we will email active participants before it takes effect.',
    ] },
  ];
}

function terms(contact: string): Section[] {
  return [
    { id: 't-agree', title: 'Using this site', body: [
      'These terms apply when you use the Bless This Family website, run by The Konnection. By applying as a family, choosing a family, chipping in or sharing a quote, you agree to these terms and to our Privacy Policy above. If you do not agree, please do not use the site.',
    ] },
    { id: 't-program', title: 'How the program works', body: [
      'Families in The Konnection’s programs share their children’s holiday wishes. Volunteers we call Holiday Konnectors choose a family, buy and wrap the gifts, and hand them off through The Konnection. We work hard to match every family, but we cannot promise that every family will be chosen or that every wish will be filled.',
    ] },
    { id: 't-families', title: 'For families', body: [[
      'You must be a parent or legal guardian, 18 or older, and part of The Konnection’s programs. Every child you list must live in your household.',
      'The information you give must be true and current. Tell us if it changes.',
      'Our team reviews every application and may ask for more information, edit a story or nickname to protect your privacy, or decline an application.',
      'Gifts are given freely by volunteers. There is no cost to families, and gifts should not be resold.',
    ]] },
    { id: 't-konnectors', title: 'For Holiday Konnectors', body: [
      'When you choose a family, you agree to:',
      [
        'Shop for every child in the family, with the same number of gifts for each child.',
        'Give new, unused, age-appropriate gifts. No weapons, alcohol, tobacco or vaping products, or anything unsafe for the child’s age.',
        'Wrap every gift, label it with the child’s name, and include a gift receipt with clothing.',
        'Drop gifts off at the listed site and hours, or deliver them as arranged with our team, by the deadline.',
        'Answer our check-ins. If you cannot finish, release the family from your family page as soon as you can so another Konnector can step in. If we cannot reach you, our team may reopen the family.',
      ],
      'You must be 18 or older, or take part with a parent, guardian or organization that agrees to these terms. If you sign up for a group, you confirm you may act for it.',
    ] },
    { id: 't-respect', title: 'Respecting families', body: [[
      'Use family information only to shop for and deliver their gifts. Do not share it, post it online or use it for anything else.',
      'Do not contact a family except as arranged by our team. Do not photograph children or post photos of them without a parent’s written permission.',
      'Do not use the program to sell, recruit, fundraise or promote anything.',
    ]] },
    { id: 't-gifts', title: 'Donations and taxes', body: [
      'This site never takes payment for gifts. You buy gifts yourself, from any store you like. Chip-ins are processed by Zeffy under its own terms, and donations are generally non-refundable.',
      'The Konnection is a nonprofit organization. Gifts and donations may be tax-deductible to the extent the law allows. We do not give tax advice, so please check with a tax professional. Ask us if you need an acknowledgment of your gift.',
    ] },
    { id: 't-content', title: 'Quotes and names you share', body: [
      'When you send a quote or choose a wall name, you give The Konnection permission to show it on this site and in our outreach, free of charge, with the credit you gave. We may shorten it or remove details to protect privacy. You can ask us to take it down at any time. Please do not share anything that is not yours to share.',
    ] },
    { id: 't-use', title: 'Fair use of the site', body: [[
      'Do not give false information, pretend to be someone else, or sign up for a family you do not intend to help.',
      'Your family page link and sign-in emails are personal. Do not share them.',
      'Do not scrape, overload, probe or interfere with the site, or try to reach information that is not meant for you.',
    ]] },
    { id: 't-safety', title: 'Volunteers and safety', body: [
      'Holiday Konnectors are volunteers, not employees or agents of The Konnection. If you deliver gifts yourself, follow our team’s instructions and use good judgment. Families and Konnectors are responsible for their own conduct. Please tell us right away about anything that feels unsafe.',
    ] },
    { id: 't-liability', title: 'Disclaimers and limits', body: [
      'We provide the site and the program "as is." We do our best to keep information accurate and the site available, but we cannot guarantee it. To the fullest extent the law allows, The Konnection, its staff and volunteers are not liable for indirect or consequential losses, or for gifts, deliveries or interactions between participants. Nothing in these terms limits rights you have under law that cannot be waived.',
      'You agree to be responsible for claims that arise from your own breach of these terms or misuse of family information.',
    ] },
    { id: 't-changes', title: 'Changes and ending access', body: [
      'We may update these terms, or change, pause or end the program or the site. We will update the date at the top of this page and email active participants about material changes. We may remove anyone who breaks these terms or puts a family at risk, and reopen any family they chose.',
    ] },
    { id: 't-law', title: 'Governing law', body: [
      'These terms are governed by the laws of the State of Michigan. Any dispute will be handled in the state or federal courts serving Wayne County, Michigan, unless the law requires otherwise. If one part of these terms cannot be enforced, the rest still applies.',
    ] },
    { id: 't-contact', title: 'Contact', body: [
      `The Konnection · Detroit, Michigan · ${contact}`,
    ] },
  ];
}

function Blocks({ body }: { body: Block[] }) {
  return (
    <div className="mt-3 grid gap-3 text-[15px] leading-[1.65] text-ink-2">
      {body.map((b, i) => Array.isArray(b)
        ? <ul key={i} className="grid gap-2">{b.map((li) => <li key={li} className="flex gap-2.5"><span aria-hidden className="mt-[9px] size-1.5 flex-none rounded-full bg-pri" />{li}</li>)}</ul>
        : <p key={i}>{b}</p>)}
    </div>
  );
}

function Part({ id, kicker, title, intro, sections }: { id: string; kicker: string; title: string; intro: string; sections: Section[] }) {
  return (
    <section id={id} className="scroll-mt-28 rounded-[32px] border border-line bg-white p-[clamp(22px,4vw,44px)]">
      <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">{kicker}</div>
      <h2 className="mt-1.5 text-[clamp(28px,3.6vw,40px)] font-extrabold leading-[1.02] tracking-[-.045em]">{title}</h2>
      <p className="mt-3 max-w-[640px] text-[16px] leading-[1.6] text-ink-2">{intro}</p>
      <div className="mt-6 divide-y divide-line">
        {sections.map((s, i) => (
          <div key={s.id} id={s.id} className="scroll-mt-28 py-6 first:pt-2 last:pb-0">
            <h3 className="flex items-baseline gap-3 text-[19px] tracking-[-.025em]"><span className="text-[13px] font-semibold text-ink-3 tabular">{String(i + 1).padStart(2, '0')}</span>{s.title}</h3>
            <Blocks body={s.body} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Legal() {
  const settings = useQuery({ queryKey: ['settings'], queryFn: api.settings, staleTime: 5 * 60_000 });
  const contact = settings.data?.contactEmail || FALLBACK_CONTACT;
  const { hash } = useLocation();
  const p = privacy(contact);
  const t = terms(contact);

  // Deep links (/legal#terms) land after the page renders.
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) requestAnimationFrame(() => el.scrollIntoView({ block: 'start' }));
  }, [hash]);

  const toc = (label: string, href: string, items: Section[]) => (
    <div>
      <a href={href} className="text-[13px] font-bold text-ink hover:text-pri">{label}</a>
      <ul className="mt-2 grid gap-1.5 border-l border-line pl-3">{items.map((s) => <li key={s.id}><a href={`#${s.id}`} className="text-[13px] text-ink-3 hover:text-pri">{s.title}</a></li>)}</ul>
    </div>
  );

  return (
    <div className={`${shell} anim-rise`}>
      <div className="mx-auto max-w-[1080px]">
        <header className="max-w-[720px]">
          <div className="text-[12px] font-semibold uppercase tracking-[.1em] text-pri">The Konnection · Bless This Family</div>
          <h1 className="mt-2 text-[clamp(38px,6vw,64px)] font-extrabold leading-[.98] tracking-[-.05em]">Privacy & Terms</h1>
          <p className="mt-4 text-[17px] leading-[1.55] text-ink-2">Plain-language rules for a program built on trust. Families share a lot with us, so we share as little as possible.</p>
          <div className="mt-4 text-[13px] text-ink-3">Effective {EFFECTIVE} · Questions: <a href={`mailto:${contact}`} className="font-semibold text-pri">{contact}</a></div>
        </header>

        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          {[
            ['We never publish', 'Parent names, last names, addresses, phone numbers, emails or schools.'],
            ['We never sell', 'Your information is used only to run Bless This Family.'],
            ['You stay in control', 'Ask us to see, fix or delete your information anytime.'],
          ].map(([h, b]) => (
            <div key={h} className="rounded-[24px] bg-soft p-5">
              <div className="text-[16px] font-bold tracking-[-.02em] text-ink">{h}</div>
              <p className="mt-1 text-[14px] leading-[1.5] text-ink-2">{b}</p>
            </div>
          ))}
        </div>

        <nav className="mt-6 flex gap-2 lg:hidden" aria-label="Jump to">
          {[['#privacy', 'Privacy Policy'], ['#terms', 'Terms of Use']].map(([href, label]) => <a key={href} href={href} className="inline-flex h-10 items-center rounded-full border border-line bg-white px-4 text-[14px] font-semibold text-ink hover:border-ink">{label}</a>)}
        </nav>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[220px_1fr]">
          <aside className="rail hidden lg:sticky lg:top-28 lg:grid lg:max-h-[calc(100dvh-8rem)] lg:gap-6 lg:overflow-y-auto lg:pb-4" aria-label="Contents">
            {toc('Privacy Policy', '#privacy', p)}
            {toc('Terms of Use', '#terms', t)}
          </aside>
          <div className="grid min-w-0 gap-6">
            <Part id="privacy" kicker="Privacy Policy" title="How we handle your information." intro="What we collect from families, Holiday Konnectors and visitors, why we need it, and who can see it." sections={p} />
            <Part id="terms" kicker="Terms of Use" title="How we take part, together." intro="What we ask of everyone who uses this site: families, Holiday Konnectors and donors." sections={t} />
            <p className="text-center text-[13px] text-ink-3">Back to <Link to="/" className="font-semibold text-ink">Bless This Family</Link></p>
          </div>
        </div>
      </div>
    </div>
  );
}
