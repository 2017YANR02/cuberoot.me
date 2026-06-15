'use client';

// Ported from packages/client/src/components/RecordBadge/RecordBadge.tsx.
import { formatRecord, expandContinentRecord } from '@/lib/recon-utils';
import './record_badge.css';

interface RecordBadgeProps {
  record: string | undefined | null;
  variant?: 'inline' | 'standalone';
  iso2?: string | null;
}

export function RecordBadge({ record, variant = 'standalone', iso2 }: RecordBadgeProps) {
  const expanded = iso2 ? expandContinentRecord(record, iso2) : record;

  const prRankMatch = expanded ? /^PR(\d+)$/.exec(expanded) : null;
  if (prRankMatch && Number(prRankMatch[1]) >= 2) {
    const cls = variant === 'inline'
      ? 'record-pr-rank record-badge--inline'
      : 'record-pr-rank';
    return <span className={cls}>{expanded}</span>;
  }

  const badge = formatRecord(expanded ?? undefined);
  if (!badge) return null;
  const cls = variant === 'inline' ? `${badge.className} record-badge--inline` : badge.className;
  return <span className={cls}>{badge.text}</span>;
}
