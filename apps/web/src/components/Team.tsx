import { useState } from 'react';
import { TEAM_MAX, TeamInviteSchema, type TeamInvite, type TeamMember } from '@bless/shared';
import { cx } from '@/lib/format';
import type { InviteResult } from '@/lib/api';

export type InviteRow = { name: string; email: string };
export const blankRow = (): InviteRow => ({ name: '', email: '' });

/** Rows that are filled in, and per-row errors for rows that are started but not valid. */
export function checkRows(rows: InviteRow[]): { invites: TeamInvite[]; errors: Record<number, string> } {
  const invites: TeamInvite[] = [];
  const errors: Record<number, string> = {};
  rows.forEach((r, i) => {
    if (!r.name.trim() && !r.email.trim()) return;
    const p = TeamInviteSchema.safeParse(r);
    if (p.success) invites.push(p.data);
    else errors[i] = p.error.issues[0]?.message ?? 'Check this row';
  });
  return { invites, errors };
}

const field = 'h-11 min-w-0 rounded-xl border border-line bg-bg px-3 text-[14px] outline-none focus:border-pri focus:bg-white';

/** Name + email rows for inviting teammates, up to `max`. */
export function InviteRows({ rows, onChange, max, errors = {} }: { rows: InviteRow[]; onChange: (rows: InviteRow[]) => void; max: number; errors?: Record<number, string> }) {
  const set = (i: number, k: keyof InviteRow, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  return (
    <div className="grid gap-2">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="flex gap-2">
            <input value={r.name} onChange={(e) => set(i, 'name', e.target.value.slice(0, 120))} placeholder="Name" aria-label={`Teammate ${i + 1} name`} autoComplete="off" className={cx(field, 'w-[38%]', errors[i] && !r.name.trim() && 'border-bad')} />
            <input value={r.email} onChange={(e) => set(i, 'email', e.target.value.slice(0, 200))} type="email" placeholder="Email" aria-label={`Teammate ${i + 1} email`} autoComplete="off" className={cx(field, 'flex-1', errors[i] && r.name.trim() && 'border-bad')} />
            <button type="button" onClick={() => onChange(rows.length === 1 ? [blankRow()] : rows.filter((_, j) => j !== i))} aria-label={`Remove teammate ${i + 1}`} className="grid size-11 flex-none place-items-center rounded-xl text-[18px] text-ink-3 hover:bg-bg hover:text-ink">×</button>
          </div>
          {errors[i] && <div className="mt-1 text-[12px] text-bad">{errors[i]}</div>}
        </div>
      ))}
      {rows.length < max && (
        <button type="button" onClick={() => onChange([...rows, blankRow()])} className="justify-self-start text-[13px] font-semibold text-pri hover:text-pri-dark">+ Add another person</button>
      )}
    </div>
  );
}

const initial = (n: string) => (n.trim()[0] ?? '?').toUpperCase();

/**
 * The co-sponsor team on a family page and the Konnector dashboard. Everyone on it has the same
 * permissions; anyone can invite (up to TEAM_MAX people), cancel a pending invite, or leave.
 */
export function TeamCard({ team, meId, onInvite, onRemove, canLeave, className }: {
  team: TeamMember[];
  /** The person looking, to mark "you" and offer Leave. */
  meId?: string | null;
  onInvite: (invites: TeamInvite[]) => Promise<InviteResult>;
  onRemove: (m: TeamMember) => Promise<unknown>;
  /** Leaving needs a sign-in (we know who you are), so it's off on a family page opened from a link. */
  canLeave?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<InviteRow[]>([blankRow()]);
  const [errors, setErrors] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: string; skipped: InviteResult['skipped'] } | null>(null);
  const [error, setError] = useState('');
  const solo = team.length <= 1;
  const left = Math.max(0, TEAM_MAX - team.length);

  const send = async () => {
    const { invites, errors: errs } = checkRows(rows);
    setErrors(errs);
    if (Object.keys(errs).length || !invites.length) return;
    setBusy('invite'); setError(''); setResult(null);
    try {
      const r = await onInvite(invites);
      setResult({ ok: r.invited.length ? `Invite sent to ${r.invited.map((m) => m.name.split(' ')[0]).join(', ')}.` : '', skipped: r.skipped });
      setRows([blankRow()]);
      if (r.invited.length) setOpen(false);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send the invites'); }
    finally { setBusy(null); }
  };
  const remove = async (m: TeamMember) => {
    const self = m.id === meId;
    if (!window.confirm(self ? 'Leave this team? You will stop seeing families your teammates chose, and they will stop seeing yours.' : `Cancel ${m.name}'s invite?`)) return;
    setBusy(m.id); setError('');
    try { await onRemove(m); } catch (e) { setError(e instanceof Error ? e.message : 'Could not update the team'); } finally { setBusy(null); }
  };

  return (
    <div className={cx('rounded-xl3 border border-line bg-white p-5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[15px]">{solo ? 'Bless together' : 'Your team'}</h3>
        {!solo && <span className="text-[12px] text-ink-3">{team.length} of {TEAM_MAX}</span>}
      </div>
      <p className="mt-1 text-[13px] leading-[1.5] text-ink-3">
        {solo ? `Invite up to ${TEAM_MAX - 1} people to shop with you. Everyone on a team sees the same family pages, gets the reminders and can mark progress.` : 'Everyone here sees the same family pages, gets the reminders and can mark progress. No one is in charge; you all have the same access.'}
      </p>
      {!solo && (
        <ul className="mt-3 grid gap-2">
          {team.map((m) => {
            const you = m.id === meId;
            return (
              <li key={m.id} className="flex items-center gap-3">
                <span aria-hidden className={cx('grid size-8 flex-none place-items-center rounded-full text-[13px] font-bold', m.status === 'Joined' ? 'bg-pri text-white' : 'border border-dashed border-ink-3 text-ink-3')}>{initial(m.name)}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-semibold text-ink">{m.name}{you && <span className="font-normal text-ink-3"> (you)</span>}</div>
                  <div className="truncate text-[12px] text-ink-3">{m.status === 'Invited' ? `Invited${m.invitedBy ? ` by ${m.invitedBy.split(' ')[0]}` : ''} · ${m.email}` : m.email}</div>
                </div>
                {m.status === 'Invited' && <button onClick={() => remove(m)} disabled={busy === m.id} className="text-[12px] font-semibold text-ink-3 hover:text-bad disabled:opacity-50">{busy === m.id ? '…' : 'Cancel'}</button>}
                {m.status === 'Joined' && you && canLeave && team.length > 1 && <button onClick={() => remove(m)} disabled={busy === m.id} className="text-[12px] font-semibold text-ink-3 hover:text-bad disabled:opacity-50">{busy === m.id ? '…' : 'Leave'}</button>}
              </li>
            );
          })}
        </ul>
      )}
      {result?.ok && <p className="mt-3 rounded-xl bg-ok/10 px-3 py-2 text-[13px] text-ok">{result.ok} They'll join once they tap the link in their email.</p>}
      {!!result?.skipped.length && <ul className="mt-2 grid gap-1 text-[12px] text-bad">{result.skipped.map((s) => <li key={s.email}>{s.email}: {s.reason}</li>)}</ul>}
      {error && <p className="mt-2 text-[13px] text-bad">{error}</p>}
      {left > 0 && (open ? (
        <div className="mt-3.5 border-t border-soft pt-3.5">
          <InviteRows rows={rows} onChange={setRows} max={left} errors={errors} />
          <p className="mt-2 text-[12px] leading-[1.5] text-ink-3">We'll email each person one invite. They only get reminders once they join.</p>
          <div className="mt-2.5 flex gap-2">
            <button onClick={send} disabled={busy === 'invite'} className="h-10 rounded-full bg-pri px-4 text-[13px] font-semibold text-white hover:bg-pri-dark disabled:opacity-60">{busy === 'invite' ? 'Sending…' : 'Send invites'}</button>
            <button onClick={() => { setOpen(false); setErrors({}); }} className="h-10 rounded-full border border-line bg-white px-4 text-[13px] font-semibold">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setOpen(true); setResult(null); }} className="mt-3.5 h-10 rounded-full border border-line bg-white px-4 text-[13px] font-semibold text-ink hover:border-pri">+ Invite {solo ? 'people' : 'someone'}</button>
      ))}
    </div>
  );
}

/** "Lisa invited you to their team" with Join / No thanks. */
export function InviteBanner({ invite, onAccept, onDecline, className }: { invite: { from: string; members: string[] }; onAccept: () => Promise<unknown>; onDecline: () => Promise<unknown>; className?: string }) {
  const [busy, setBusy] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState('');
  const go = async (which: 'yes' | 'no') => {
    setBusy(which); setError('');
    try { await (which === 'yes' ? onAccept() : onDecline()); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(null); }
  };
  const others = invite.members.filter((n) => n !== invite.from);
  return (
    <div className={cx('rounded-[24px] bg-ink p-6 text-white', className)}>
      <div className="text-[11px] font-semibold uppercase tracking-[.1em] text-lav">Team invite</div>
      <h2 className="mt-1.5 text-[22px] tracking-[-.03em] text-white">{invite.from} invited you to bless families together.</h2>
      <p className="mt-2 text-[14px] leading-[1.5] opacity-85">{others.length ? `You'd join ${invite.from}, ${others.join(', ')}. ` : ''}You'll see the same family pages, get the reminders and can mark progress.</p>
      {error && <p className="mt-2 text-[13px] text-lav">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button onClick={() => go('yes')} disabled={!!busy} className="h-11 rounded-full bg-lav px-5 text-[14px] font-bold text-ink hover:bg-white disabled:opacity-60">{busy === 'yes' ? 'Joining…' : 'Join the team'}</button>
        <button onClick={() => go('no')} disabled={!!busy} className="h-11 rounded-full border border-white/25 px-5 text-[14px] font-semibold text-white hover:bg-white/10 disabled:opacity-60">{busy === 'no' ? '…' : 'No thanks'}</button>
      </div>
    </div>
  );
}
