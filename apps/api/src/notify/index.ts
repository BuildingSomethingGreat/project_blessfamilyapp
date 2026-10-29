import { config } from '../config.ts';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}
export interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
}
export interface Notifier {
  readonly name: 'console' | 'resend';
  sendEmail(m: EmailMessage): Promise<SendResult>;
}

/** Dev driver: prints the plain-text version to the server log so magic links are clickable locally. */
class ConsoleNotifier implements Notifier {
  readonly name = 'console' as const;
  async sendEmail(m: EmailMessage) {
    console.log(`\n📧 [email → ${m.to}] ${m.subject}\n${m.text}\n`);
    return { ok: true, id: 'console' };
  }
}

/** https://resend.com/docs/api-reference/emails/send-email */
class ResendNotifier implements Notifier {
  readonly name = 'resend' as const;
  constructor(private key: string) {}
  async sendEmail(m: EmailMessage) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: config.notify.from, to: [m.to], reply_to: m.replyTo || undefined, subject: m.subject, text: m.text, html: m.html }),
      });
      if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${(await res.text()).slice(0, 300)}` };
      const j = (await res.json()) as { id: string };
      return { ok: true, id: j.id };
    } catch (e) {
      return { ok: false, error: `Resend unreachable: ${(e as Error).message}` };
    }
  }
}

let notifier: Notifier | null = null;
export function getNotifier(): Notifier {
  if (!notifier) notifier = config.notify.driver === 'resend' && config.notify.resendKey ? new ResendNotifier(config.notify.resendKey) : new ConsoleNotifier();
  return notifier;
}
export function setNotifier(n: Notifier | null) {
  notifier = n;
}
