'use client';

// Ported from packages/client-vite/src/components/RecordBadge/RecordBadge.tsx.
import { formatRecord, expandContinentRecord } from '@/lib/recon-utils';
import './record_badge.css';

interface RecordBadgeProps {
  record: string | undefined | null;
  variant?: 'inline' | 'standalone';
  iso2?: string | null;
}

export function RecordBadge({ record, variant = 'standalone', iso2 }: RecordBadgeProps) {
  const expanded = iso2 ? expandContinentRecord(record, iso2) : record;

  // 带名次的个人最好成绩(PR2 / PB10 …)是「第 n 好」而非纪录,不给方框,只作小角标;
  // 不带数字的 PR / PB(个人最佳本身)仍走下面的纪录方框。
  const prRankMatch = expanded ? /^P[RB](\d+)$/.exec(expanded) : null;
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
