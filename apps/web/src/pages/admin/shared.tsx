import { Chip, type ChipTone } from '@/components/ui';
import { STATUS_LABEL, type FamilyStatus, type SponsorshipStatus } from '@bless/shared';
import { cx } from '@/lib/format';

export const familyTone: Record<FamilyStatus, ChipTone> = {
  Submitted: 'soft', 'Needs Info': 'warn', Available: 'dark', Claimed: 'lav', Fulfilled: 'ok', Withdrawn: 'neutral', Declined: 'bad',
};
export const sponsorshipTone: Record<SponsorshipStatus, ChipTone> = {
  Claimed: 'soft', Shopping: 'soft', Purchased: 'soft', Wrapped: 'soft', 'Dropped Off': 'lav', Delivered: 'ok', Released: 'neutral',
};

export function StatusChip({ status }: { status: FamilyStatus }) {
  return <Chip tone={familyTone[status]}>{status}</Chip>;
}
export function SpStatusChip({ status }: { status: SponsorshipStatus }) {
  return <Chip tone={sponsorshipTone[status]}>{STATUS_LABEL[status]}</Chip>;
}

/** v3 page header: 36px h1 + 13px muted sub, optional right actions. */
export function PageHead({ title, sub, right }: { title: React.ReactNode; sub?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[32px] font-extrabold tracking-[-.045em] sm:text-[36px]">{title}</h1>
        {sub && <div className="mt-1 text-[13px] text-ink-3">{sub}</div>}
      </div>
      {right && <div className="flex gap-2">{right}</div>}
    </div>
  );
}

/** v3 admin card: white, 1px line, radius 24, padding 22. */
export function Panel({ children, className, dark }: { children: React.ReactNode; className?: string; dark?: boolean }) {
  return <div className={cx('min-w-0 rounded-[24px] p-[22px]', dark ? 'bg-ink text-white' : 'border border-line bg-white', className)}>{children}</div>;
}
export function PanelTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h3 className="text-[17px] font-bold">{children}</h3>
      {right && <span className="text-[12px] text-ink-3">{right}</span>}
    </div>
  );
}
export function SubLabel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx('text-[13px] font-semibold text-ink-3', className)}>{children}</div>;
}

/** Purple progress row: label · bar · value (v3 dominoes / funnel rows). */
export function BarRow({ label, pct, value, color = '#6c22dd', labelW = 120, grow }: { label: string; pct: number; value: React.ReactNode; color?: string; labelW?: number; grow?: boolean }) {
  return (
    <div className="grid items-center gap-3 text-[13px]" style={{ gridTemplateColumns: `${labelW}px 1fr 44px` }}>
      <span className="truncate">{label}</span>
      <div className="h-2 overflow-hidden rounded-full bg-soft">
        <div className="h-full rounded-full transition-[width] duration-600" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color, transformOrigin: 'left', animation: grow ? 'grow .7s cubic-bezier(.16,1,.3,1)' : undefined }} />
      </div>
      <b className="text-right tabular">{value}</b>
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
