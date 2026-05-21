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

  // 特殊分支: PR<N> (N≥2) 选手历史第 N 快 — 裸文字, 无蓝框, 跟 PR(=PR1) 的 badge 在同一位置
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
