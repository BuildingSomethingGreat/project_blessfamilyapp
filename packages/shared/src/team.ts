import type { Sponsor, TeamMember } from './types.ts';

/** People on one co-sponsor team, counting pending invites: whoever started it plus 5. */
export const TEAM_MAX = 6;

type TeamFields = Pick<Sponsor, 'id' | 'name' | 'email' | 'organization' | 'teamId' | 'teamInvite' | 'invitedBy' | 'invitedAt' | 'joinedTeamAt' | 'createdAt'>;

/**
 * A sponsor's team: who has joined (always including the sponsor) and who is still invited.
 * Only joined members share families; a pending invitee sees nothing until they accept.
 */
export function teamOf<T extends TeamFields>(sponsor: T, everyone: readonly T[]): { joined: T[]; invited: T[] } {
  if (!sponsor.teamId) return { joined: [sponsor], invited: [] };
  const byJoin = (a: T, b: T) => (a.joinedTeamAt ?? a.createdAt).localeCompare(b.joinedTeamAt ?? b.createdAt);
  const joined = everyone.filter((s) => s.teamId === sponsor.teamId).sort(byJoin);
  if (!joined.some((s) => s.id === sponsor.id)) joined.unshift(sponsor);
  const invited = everyone.filter((s) => s.teamInvite === sponsor.teamId && s.teamId !== sponsor.teamId).sort((a, b) => (a.invitedAt ?? '').localeCompare(b.invitedAt ?? ''));
  return { joined, invited };
}

/** The team as a list for teammates and staff: joined first (in the order they joined), then invites. */
export function teamMembers<T extends TeamFields>(sponsor: T, everyone: readonly T[]): TeamMember[] {
  const { joined, invited } = teamOf(sponsor, everyone);
  const nameOf = (email: string) => everyone.find((s) => s.email.toLowerCase() === email.toLowerCase())?.name ?? '';
  const row = (s: T, status: TeamMember['status']): TeamMember => ({
    id: s.id, name: s.name, email: s.email, organization: s.organization, status,
    invitedBy: s.invitedBy ? nameOf(s.invitedBy) : '', invitedAt: s.invitedAt, joinedAt: status === 'Joined' ? s.joinedTeamAt : null,
  });
  return [...joined.map((s) => row(s, 'Joined')), ...invited.map((s) => row(s, 'Invited'))];
}
