import { config } from '../config.ts';
import type { Store } from '../store/types.ts';
import { nowIso } from '../lib/ids.ts';
import { getNotifier, type SendResult } from './index.ts';
import { renderEmail, type EmailSpec } from './render.ts';
import type { SeasonSettings } from '@bless/shared';

export type Audience = 'konnector' | 'family' | 'admin' | 'test';

export interface MailInput {
  to: string;
  subject: string;
  spec: EmailSpec;
  /** Template id, shown in the admin email log (claim_confirmation, admin_family_claimed…). */
  kind: string;
  audience: Audience;
  familyId?: string | null;
  sponsorshipId?: string | null;
  actor?: string;
  /** Plain-text body to store in the log instead of the real one (used to keep sign-in links out of Airtable). */
  logBody?: string;
  /** Overrides the footer line explaining why they got this email. */
  reason?: string;
}

export const parseEmails = (v: string) => [...new Set(v.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /^\S+@\S+\.\S+$/.test(e)))];
/** Team email recipients: the Settings list if set, otherwise everyone in ADMIN_EMAILS. */
export const alertRecipients = (s: SeasonSettings) => { const list = parseEmails(s.alertEmails ?? ''); return list.length ? list : config.adminEmails; };

const REASONS: Record<Audience, string> = {
  konnector: 'You are getting this because you chose a family through Bless-a-Family.',
  family: 'You are getting this because your family applied to Bless-a-Family.',
  admin: 'You are getting this because you are on the Bless-a-Family admin team.',
  test: 'This is a test message from Bless-a-Family.',
};

/**
 * Every email goes through here: render the app-styled template, send with Resend (or the console
 * in dev), and record it in Activity so admins can see exactly what went out in the email log.
 */
export class Mailer {
  constructor(private store: Store) {}

  async send(m: MailInput): Promise<SendResult & { subject: string; text: string }> {
    const settings = await this.store.getSettings();
    const { html, text } = renderEmail(m.spec, { contactEmail: settings.contactEmail, contactName: settings.contactName, webUrl: config.webUrl, reason: m.reason ?? REASONS[m.audience] });
    const to = m.to.trim();
    const res: SendResult = to ? await getNotifier().sendEmail({ to, subject: m.subject, text, html, replyTo: config.notify.replyTo || settings.contactEmail }) : { ok: false, error: 'No email address on file' };
    await this.store.logActivity({
      type: 'message_sent', channel: 'email', familyId: m.familyId ?? null, sponsorshipId: m.sponsorshipId ?? null, subject: m.subject, body: m.logBody ?? text,
      meta: { kind: m.kind, audience: m.audience, to, ok: res.ok, error: res.error, providerId: res.id, provider: getNotifier().name, actor: m.actor ?? 'system' }, occurredAt: nowIso(),
    }).catch((e) => console.error('[mailer] could not log email', (e as Error).message));
    if (!res.ok) console.warn(`[mailer] ${m.kind} → ${to || '(none)'} failed: ${res.error}`);
    return { ...res, subject: m.subject, text };
  }

  /**
   * Sends one copy to each team recipient (Settings → Team emails, or ADMIN_EMAILS when that is empty).
   * Activity alerts respect the "Email the team about activity" toggle; `force` is for key updates
   * (Konnector progress and notes) that always go out.
   */
  async toAdmins(m: Omit<MailInput, 'to' | 'audience'>, opts: { force?: boolean } = {}) {
    const settings = await this.store.getSettings();
    if (!settings.adminAlerts && !opts.force) return [];
    return Promise.all(alertRecipients(settings).map((to) => this.send({ ...m, to, audience: 'admin' })));
  }
}
