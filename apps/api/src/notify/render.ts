/**
 * Transactional email layout. One design for every email the app sends, matching the PWA:
 * lavender page, white rounded card, bold Poppins headline, purple pill button, soft detail card.
 *
 * Email clients are fussy, so this is table-based with inline styles. Rounded corners and the
 * web font degrade gracefully (square corners in Outlook desktop, Helvetica where Poppins can't load).
 */

export interface EmailSpec {
  /** Hidden preview line shown next to the subject in the inbox. */
  preheader: string;
  /** Small purple label above the headline, e.g. "Holiday Konnector". */
  eyebrow?: string;
  /** Bold headline. Keep it to one short sentence. */
  title: string;
  /** Lead paragraph, slightly larger. */
  intro?: string;
  paragraphs?: string[];
  cta?: { label: string; url: string };
  /** Label/value rows in a soft inner card (deadline, location, kids…). */
  details?: { label: string; value: string }[];
  /** Short checklist rendered with purple ticks. */
  list?: string[];
  /** A quoted block (custom note from staff, a family story, a testimonial). */
  quote?: { text: string; by?: string };
  /** Muted line under the card. */
  note?: string;
}

export const PALETTE = {
  pri: '#6c22dd', priDark: '#5416b5', ink: '#1d1133', ink2: '#4a3f66', ink3: '#8a7fa6', bg: '#f6f3fb', soft: '#ede4ff', soft2: '#f3eefc', line: '#e6e0f2', lav: '#c9b8ff',
} as const;

const FONT = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
/** Escapes text and turns bare URLs into links (for paragraphs written as plain text). */
const linkify = (s: string) => esc(s).replace(/(https?:\/\/[^\s<]+)/g, `<a href="$1" style="color:${PALETTE.pri};text-decoration:underline">$1</a>`).replace(/\n/g, '<br/>');

export interface Footer {
  contactEmail: string;
  webUrl: string;
  reason: string; // why they got this email
}

export function renderEmail(spec: EmailSpec, footer: Footer): { html: string; text: string } {
  const P = PALETTE;
  const p = (s: string, size = 16, color: string = P.ink2, mb = 16) => `<p style="margin:0 0 ${mb}px;font-family:${FONT};font-size:${size}px;line-height:1.55;color:${color}">${linkify(s)}</p>`;

  const parts: string[] = [];
  if (spec.eyebrow) parts.push(`<p style="margin:0 0 10px;font-family:${FONT};font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:${P.pri}">${esc(spec.eyebrow)}</p>`);
  parts.push(`<h1 style="margin:0 0 16px;font-family:${FONT};font-size:30px;line-height:1.08;font-weight:800;letter-spacing:-.04em;color:${P.ink}">${esc(spec.title)}</h1>`);
  if (spec.intro) parts.push(p(spec.intro, 17, P.ink2, 18));
  for (const para of spec.paragraphs ?? []) parts.push(p(para));
  if (spec.quote) {
    parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px"><tr><td style="border-left:3px solid ${P.lav};padding:2px 0 2px 16px">
      <p style="margin:0;font-family:${FONT};font-size:16px;line-height:1.55;color:${P.ink}">${linkify(spec.quote.text)}</p>
      ${spec.quote.by ? `<p style="margin:8px 0 0;font-family:${FONT};font-size:13px;color:${P.ink3}">${esc(spec.quote.by)}</p>` : ''}
    </td></tr></table>`);
  }
  if (spec.details?.length) {
    const rows = spec.details.map((d, i) => `<tr>
      <td style="padding:12px 0;${i ? `border-top:1px solid ${P.line};` : ''}font-family:${FONT};font-size:13px;color:${P.ink3};vertical-align:top;width:38%">${esc(d.label)}</td>
      <td style="padding:12px 0;${i ? `border-top:1px solid ${P.line};` : ''}font-family:${FONT};font-size:14px;font-weight:600;color:${P.ink};vertical-align:top">${linkify(d.value)}</td></tr>`).join('');
    parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 22px;background:${P.soft2};border-radius:18px"><tr><td style="padding:6px 20px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table></td></tr></table>`);
  }
  if (spec.list?.length) {
    const items = spec.list.map((li) => `<tr><td style="width:26px;vertical-align:top;padding:0 0 10px"><span style="display:inline-block;width:18px;height:18px;border-radius:9px;background:${P.soft};color:${P.pri};font-family:${FONT};font-size:11px;font-weight:700;line-height:18px;text-align:center">&#10003;</span></td><td style="padding:0 0 10px;font-family:${FONT};font-size:15px;line-height:1.5;color:${P.ink2}">${linkify(li)}</td></tr>`).join('');
    parts.push(`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:2px 0 14px">${items}</table>`);
  }
  if (spec.cta) {
    parts.push(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:10px 0 6px"><tr><td style="border-radius:999px;background:${P.pri}" bgcolor="${P.pri}">
      <a href="${esc(spec.cta.url)}" style="display:inline-block;padding:15px 30px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:999px">${esc(spec.cta.label)} &rarr;</a>
    </td></tr></table>`);
  }

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only">
<title>${esc(spec.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>@media (max-width:600px){.card{padding:28px 22px!important;border-radius:24px!important}.wrap{padding:24px 12px!important}h1{font-size:26px!important}}</style>
</head>
<body style="margin:0;padding:0;background:${P.bg};-webkit-font-smoothing:antialiased">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${P.bg}">${esc(spec.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${P.bg}"><tr><td align="center" class="wrap" style="padding:36px 16px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
    <tr><td style="padding:0 6px 18px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="width:32px;height:32px;border-radius:10px;background:${P.pri};text-align:center;vertical-align:middle;font-family:${FONT};font-size:17px;font-weight:800;color:#fff">K</td>
        <td style="padding-left:10px;font-family:${FONT};font-size:15px;font-weight:700;letter-spacing:-.01em;color:${P.ink}">Bless This Family <span style="font-weight:400;color:${P.ink3}">&middot; The Konnection</span></td>
      </tr></table>
    </td></tr>
    <tr><td class="card" style="background:#ffffff;border-radius:28px;padding:38px 36px;border:1px solid ${P.line}">${parts.join('\n')}</td></tr>
    ${spec.note ? `<tr><td style="padding:18px 10px 0;font-family:${FONT};font-size:13px;line-height:1.5;color:${P.ink3}">${linkify(spec.note)}</td></tr>` : ''}
    <tr><td style="padding:26px 10px 0;font-family:${FONT};font-size:12px;line-height:1.6;color:${P.ink3}">
      Questions? Reply to this email or write to <a href="mailto:${esc(footer.contactEmail)}" style="color:${P.ink2}">${esc(footer.contactEmail)}</a>.<br/>
      ${esc(footer.reason)}<br/>
      <a href="${esc(footer.webUrl)}" style="color:${P.ink3}">The Konnection &middot; Detroit, MI</a>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;

  const text = [
    spec.eyebrow?.toUpperCase(),
    spec.title,
    '',
    spec.intro,
    ...(spec.paragraphs ?? []),
    spec.quote ? `"${spec.quote.text}"${spec.quote.by ? ` (${spec.quote.by})` : ''}` : undefined,
    spec.details?.length ? spec.details.map((d) => `${d.label}: ${d.value}`).join('\n') : undefined,
    spec.list?.length ? spec.list.map((l) => `- ${l}`).join('\n') : undefined,
    spec.cta ? `${spec.cta.label}: ${spec.cta.url}` : undefined,
    spec.note,
    '',
    `Questions? Reply or write to ${footer.contactEmail}.`,
    footer.reason,
  ].filter((x) => x !== undefined).join('\n\n').replace(/\n{3,}/g, '\n\n').trim();

  return { html, text };
}
