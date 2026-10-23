import { config } from '../config.ts';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
export interface SmsMessage {
  to: string;
  body: string;
}
export interface Notifier {
  sendEmail(m: EmailMessage): Promise<{ ok: boolean; id?: string; error?: string }>;
  sendSms(m: SmsMessage): Promise<{ ok: boolean; id?: string; error?: string }>;
  readonly smsEnabled: boolean;
}

/** Dev driver: prints to the server log so you can click magic links locally. */
class ConsoleNotifier implements Notifier {
  smsEnabled = false;
  async sendEmail(m: EmailMessage) {
    console.log(`\n📧 [email → ${m.to}] ${m.subject}\n${m.text}\n`);
    return { ok: true, id: 'console' };
  }
  async sendSms(m: SmsMessage) {
    console.log(`\n📱 [sms → ${m.to}] ${m.body}\n`);
    return { ok: true, id: 'console' };
  }
}

class ResendNotifier implements Notifier {
  constructor(private key: string) {}
  get smsEnabled() {
    return !!(config.notify.twilio.sid && config.notify.twilio.token && config.notify.twilio.from);
  }
  async sendEmail(m: EmailMessage) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.notify.from, to: [m.to], reply_to: config.notify.replyTo, subject: m.subject, text: m.text, html: m.html ?? textToHtml(m.text) }),
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${await res.text()}` };
    const j = (await res.json()) as { id: string };
    return { ok: true, id: j.id };
  }
  async sendSms(m: SmsMessage) {
    const { sid, token, from } = config.notify.twilio;
    if (!this.smsEnabled) return { ok: false, error: 'sms not configured' };
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ From: from, To: m.to, Body: m.body }),
    });
    if (!res.ok) return { ok: false, error: `${res.status} ${await res.text()}` };
    const j = (await res.json()) as { sid: string };
    return { ok: true, id: j.sid };
  }
}

export function textToHtml(text: string): string {
  const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  const paras = text
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/(https?:\/\/\S+)/g, '<a href="$1" style="color:#e4572e">$1</a>').replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f6f1e9;font-family:-apple-system,Segoe UI,Inter,sans-serif;color:#1b1b1b">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="font-weight:800;letter-spacing:-.02em;font-size:20px;margin-bottom:24px">The Konnection · Bless-A-Family</div>
    <div style="background:#fff;border-radius:20px;padding:28px;font-size:16px;line-height:1.55">${paras}</div>
    <div style="font-size:12px;color:#777;margin-top:20px">Building Relationships. Connecting Futures.</div>
  </div></body></html>`;
}

let notifier: Notifier | null = null;
export function getNotifier(): Notifier {
  if (!notifier) notifier = config.notify.driver === 'resend' && config.notify.resendKey ? new ResendNotifier(config.notify.resendKey) : new ConsoleNotifier();
  return notifier;
}
export function setNotifier(n: Notifier) {
  notifier = n;
}
