import { TEAM_MAX, teamMembers, teamOf, toPublicFamily, type Sponsor, type TeamInvite, type TeamMember } from '@bless/shared';
import { config } from '../config.ts';
import type { Store } from '../store/types.ts';
import type { Mailer } from '../notify/mailer.ts';
import { teamInviteEmail } from '../followup/messages.ts';
import { konnectorInviteToken } from './auth.ts';
import { nowIso, shortId } from './ids.ts';
import { HttpError } from './errors.ts';


export interface InviteResult {
  invited: TeamMember[];
  skipped: { email: string; reason: string }[];
  team: TeamMember[];
}

/** Invite emails per team per hour, so the form can't be used to send mail in bulk. */
const INVITES_PER_HOUR = 12;
const sent = new Map<string, number[]>();
function underLimit(team: string) {
  const now = Date.now();
  const recent = (sent.get(team) ?? []).filter((t) => now - t < 3_600_000);
  sent.set(team, recent);
  return recent.length < INVITES_PER_HOUR;
}

/**
 * Co-sponsor teams. A team is a group of Holiday Konnectors with the same permissions: each of them
 * sees and can update every family any of them sponsors, gets the reminders, and can invite others,
 * up to TEAM_MAX people counting pending invites. Nobody leads. Invitees only become teammates (and
 * only start getting emails) once they accept; joined teammates can leave on their own, and staff
 * can remove anyone.
 */
export class Teams {
  constructor(private store: Store, private mailer: Mailer) {}

  async members(sponsor: Sponsor, everyone?: Sponsor[]): Promise<TeamMember[]> {
    return teamMembers(sponsor, everyone ?? (await this.store.listSponsors()));
  }

  /** Sponsor ids whose families this person can see: their own plus every joined teammate's. */
  async sponsorIds(sponsor: Sponsor, everyone?: Sponsor[]): Promise<string[]> {
    return teamOf(sponsor, everyone ?? (await this.store.listSponsors())).joined.map((s) => s.id);
  }

  /** Joined teammates of whoever sponsors a family (including them). Used to copy family emails to the team. */
  async joined(sponsorId: string): Promise<Sponsor[]> {
    const everyone = await this.store.listSponsors();
    const s = everyone.find((x) => x.id === sponsorId);
    return s ? teamOf(s, everyone).joined : [];
  }

  async invite(actorIn: Sponsor, invites: TeamInvite[]): Promise<InviteResult> {
    let actor = actorIn;
    if (actor.teamInvite && !actor.teamId) throw new HttpError(409, 'Join the team you were invited to first, or decline it, before inviting others.');
    const now = nowIso();
    // Starting a team: the first invite gives this Konnector a team id.
    if (!actor.teamId) actor = await this.store.updateSponsor(actor.id, { teamId: `T-${shortId()}`, joinedTeamAt: now });
    let everyone = await this.store.listSponsors();
    const { joined, invited } = teamOf(actor, everyone);
    const skipped: InviteResult['skipped'] = [];
    const out: TeamMember[] = [];
    let open = TEAM_MAX - joined.length - invited.length;
    const settings = await this.store.getSettings();
    const families = (await this.familyNames(joined.map((s) => s.id)));
    const seen = new Set<string>();

    for (const raw of invites) {
      const email = raw.email.trim().toLowerCase();
      const name = raw.name.trim();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      if (email === actor.email.toLowerCase()) { skipped.push({ email, reason: "That's you." }); continue; }
      if (joined.some((s) => s.email.toLowerCase() === email)) { skipped.push({ email, reason: 'Already on your team.' }); continue; }
      const resend = invited.some((s) => s.email.toLowerCase() === email);
      if (!resend && open <= 0) { skipped.push({ email, reason: `Teams are up to ${TEAM_MAX} people, counting invites.` }); continue; }
      if (!underLimit(actor.teamId)) { skipped.push({ email, reason: 'Too many invites at once. Try again in an hour.' }); continue; }

      const existing = everyone.find((s) => s.email.toLowerCase() === email);
      const fields = { teamInvite: actor.teamId, invitedBy: actor.email, invitedAt: now };
      const person = existing
        ? await this.store.updateSponsor(existing.id, fields)
        : await this.store.createSponsor({ name, email, phone: '', organization: '', preferredContact: 'Email', notes: '', displayName: '', wallOptIn: false, wallHidden: false, ...fields });
      if (!resend) open--;
      everyone = [...everyone.filter((s) => s.id !== person.id), person];

      const link = `${config.webUrl}/login?token=${encodeURIComponent(konnectorInviteToken(email, actor.teamId))}`;
      const m = teamInviteEmail({ inviter: actor, invitee: existing?.name || name, link, families, settings });
      sent.get(actor.teamId)!.push(Date.now());
      await this.mailer.send({ to: email, subject: m.subject, spec: m.spec, kind: 'team_invite', audience: 'konnector', logBody: `${actor.name} invited ${existing?.name || name} to their Holiday Konnector team. (Join link hidden from the log.)`, reason: `You are getting this because ${actor.name} invited you to their Bless-a-Family team.` });
      await this.log(`${actor.name} invited ${existing?.name || name} to their team`, { teamId: actor.teamId, by: actor.id, sponsorId: person.id, resend });
      out.push(...teamMembers(actor, everyone).filter((m) => m.id === person.id));
    }
    return { invited: out, skipped, team: teamMembers(actor, everyone) };
  }

  /** The invitee says yes (from the email link or their dashboard). Joining a team leaves any previous one. */
  async accept(sponsor: Sponsor, teamId = sponsor.teamInvite): Promise<Sponsor> {
    if (!teamId || sponsor.teamInvite !== teamId) {
      if (sponsor.teamId && sponsor.teamId === teamId) return sponsor; // already joined (link opened twice)
      throw new HttpError(409, 'That invite was cancelled or has already been used.');
    }
    const everyone = await this.store.listSponsors();
    const members = everyone.filter((s) => s.teamId === teamId);
    if (!members.length) {
      await this.store.updateSponsor(sponsor.id, { teamInvite: '' });
      throw new HttpError(409, 'Everyone on that team has left, so there is nothing to join.');
    }
    if (members.length >= TEAM_MAX) throw new HttpError(409, `That team is full (${TEAM_MAX} people).`);
    const updated = await this.store.updateSponsor(sponsor.id, { teamId, teamInvite: '', joinedTeamAt: nowIso() });
    await this.log(`${sponsor.name} joined a team with ${members.map((m) => m.name).join(', ')}`, { teamId, sponsorId: sponsor.id, left: sponsor.teamId || null });
    return updated;
  }

  async decline(sponsor: Sponsor): Promise<Sponsor> {
    if (!sponsor.teamInvite) return sponsor;
    const updated = await this.store.updateSponsor(sponsor.id, { teamInvite: '' });
    await this.log(`${sponsor.name} declined a team invite`, { teamId: sponsor.teamInvite, sponsorId: sponsor.id });
    return updated;
  }

  /**
   * A teammate cancels a pending invite, or removes themselves (leaves). Families stay with whoever
   * chose them. Joined teammates can't remove each other; staff can (admin → family page).
   */
  async remove(actor: Sponsor, memberId: string): Promise<TeamMember[]> {
    if (!actor.teamId) throw new HttpError(404, "You're not on a team.");
    const target = memberId === actor.id ? actor : await this.store.getSponsor(memberId);
    if (!target) throw new HttpError(404, 'That person is not on your team.');
    if (target.id === actor.id) {
      await this.store.updateSponsor(actor.id, { teamId: '', joinedTeamAt: null });
      await this.log(`${actor.name} left their team`, { teamId: actor.teamId, sponsorId: actor.id });
      return [];
    }
    if (target.teamInvite === actor.teamId && target.teamId !== actor.teamId) {
      await this.store.updateSponsor(target.id, { teamInvite: '' });
      await this.log(`${actor.name} cancelled ${target.name}'s team invite`, { teamId: actor.teamId, by: actor.id, sponsorId: target.id });
      return this.members(actor);
    }
    if (target.teamId === actor.teamId) throw new HttpError(403, 'Teammates can leave on their own. To remove someone, email our team.');
    throw new HttpError(404, 'That person is not on your team.');
  }

  /** Staff: take someone off their team and cancel any pending invite. */
  async staffRemove(sponsorId: string, admin: string): Promise<Sponsor> {
    const s = await this.store.getSponsor(sponsorId);
    if (!s) throw new HttpError(404, 'Sponsor not found');
    const updated = await this.store.updateSponsor(s.id, { teamId: '', teamInvite: '', joinedTeamAt: null });
    await this.log(`${admin} removed ${s.name} from their team`, { teamId: s.teamId || s.teamInvite, sponsorId: s.id, admin });
    return updated;
  }

  private async familyNames(sponsorIds: string[]) {
    const [sps, fams] = await Promise.all([this.store.listSponsorships(), this.store.listFamilies()]);
    const fm = new Map(fams.map((f) => [f.id, f]));
    return sps.filter((s) => sponsorIds.includes(s.sponsorId) && s.status !== 'Released' && fm.has(s.familyId)).map((s) => toPublicFamily(fm.get(s.familyId)!).nickname);
  }

  private log(subject: string, meta: Record<string, unknown>) {
    return this.store.logActivity({ type: 'team', channel: 'web', familyId: null, sponsorshipId: null, subject, body: '', meta, occurredAt: nowIso() }).catch((e) => console.error('[team] could not log', (e as Error).message));
  }
}
