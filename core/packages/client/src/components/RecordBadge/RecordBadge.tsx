import { formatRecord, expandContinentRecord } from '../../utils/recon_utils';
import './record_badge.css';

interface RecordBadgeProps {
  record: string | undefined | null;
  variant?: 'inline' | 'standalone';
  /** 选手国籍 iso2(小写)。传了就把 "CR" / "cancelled CR" 展开为 AsR / ER / NAR / SAR / OcR / AfR */
  iso2?: string | null;
}

export function RecordBadge({ record, variant = 'standalone', iso2 }: RecordBadgeProps) {
  const expanded = iso2 ? expandContinentRecord(record, iso2) : record;
  const badge = formatRecord(expanded ?? undefined);
  if (!badge) return null;
  const cls = variant === 'inline' ? `${badge.className} record-badge--inline` : badge.className;
  return <span className={cls}>{badge.text}</span>;
}
