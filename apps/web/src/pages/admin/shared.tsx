import { Chip } from '@/components/ui';
import type { FamilyStatus, SponsorshipStatus } from '@bless/shared';

export const familyTone: Record<FamilyStatus, 'neutral' | 'ember' | 'pine' | 'gold' | 'dark' | 'ok' | 'warn' | 'bad' | 'info'> = {
  Submitted: 'info', 'Needs Info': 'warn', Available: 'ember', Claimed: 'gold', Fulfilled: 'pine', Withdrawn: 'neutral', Declined: 'bad',
};
export const sponsorshipTone: Record<SponsorshipStatus, 'neutral' | 'ember' | 'pine' | 'gold' | 'dark' | 'ok' | 'warn' | 'bad' | 'info'> = {
  Claimed: 'info', Confirmed: 'gold', Shopping: 'ember', 'Dropped Off': 'pine', Delivered: 'ok', Released: 'neutral',
};

export function StatusChip({ status }: { status: FamilyStatus }) {
  return <Chip tone={familyTone[status]}>{status}</Chip>;
}
export function SpStatusChip({ status }: { status: SponsorshipStatus }) {
  return <Chip tone={sponsorshipTone[status]}>{status}</Chip>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="text-lg">{children}</h2>
      {right}
    </div>
  );
}

export function daysSilent(lastResponseAt: string | null, claimedAt: string): number {
  return Math.floor((Date.now() - new Date(lastResponseAt ?? claimedAt).getTime()) / 86_400_000);
}

export function copyText(text: string) {
  return navigator.clipboard?.writeText(text);
}

export const RELEASE_REASONS = ['Sponsor unresponsive', 'Sponsor asked to step back', 'Duplicate claim', 'Family withdrew', 'Other'];

export { stagger, rise } from '@/components/ui/Page';
