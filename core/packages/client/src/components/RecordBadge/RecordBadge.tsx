import { formatRecord } from '../../utils/recon_utils';
import './record_badge.css';

interface RecordBadgeProps {
  record: string | undefined | null;
  variant?: 'inline' | 'standalone';
}

export function RecordBadge({ record, variant = 'standalone' }: RecordBadgeProps) {
  const badge = formatRecord(record ?? undefined);
  if (!badge) return null;
  const cls = variant === 'inline' ? `${badge.className} record-badge--inline` : badge.className;
  return <span className={cls}>{badge.text}</span>;
}
