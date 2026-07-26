'use client';

// Ported from packages/client-vite/src/components/RecordBadge/RecordBadge.tsx.
import { formatRecord, expandContinentRecord, getRecordClass } from '@/lib/recon-utils';
import { keatonedTitle, type KeatonedInfo } from '@/lib/record-tag';
import './record_badge.css';

interface RecordBadgeProps {
  record: string | undefined | null;
  variant?: 'inline' | 'standalone';
  iso2?: string | null;
  /** 「日掩」:这条成绩够到了 keatoned.level 那级纪录,但同一日历日已有更快的,
   *  按 Reg 9i2 不予认定。渲染成合并 badge:生效级别实色 + 被掩级别划线降饱和。
   *  生效级别为空时(Keaton Ellis 5.09 那种)只剩划线段。 */
  keatoned?: KeatonedInfo | null;
  /** 「日掩」提示里格式化成绩用(不给则只显示级别,不显示具体时间)。 */
  keatonedEventId?: string;
  keatonedIsAvg?: boolean;
}

export function RecordBadge({
  record, variant = 'standalone', iso2, keatoned, keatonedEventId, keatonedIsAvg,
}: RecordBadgeProps) {
  const expanded = iso2 ? expandContinentRecord(record, iso2) : record;

  if (keatoned) {
    const struck = (iso2 ? expandContinentRecord(keatoned.level, iso2) : keatoned.level) ?? '';
    const live = formatRecord(expanded ?? undefined);
    const cls = ['record-keatoned', variant === 'inline' ? 'record-badge--inline' : '']
      .filter(Boolean).join(' ');
    return (
      <span className={cls} title={keatonedEventId ? keatonedTitle(keatoned, keatonedEventId, !!keatonedIsAvg) : undefined}>
        {live && <span className={`record-keatoned__live record-${getRecordClass(live.text)}`}>{live.text}</span>}
        <span className={`record-keatoned__struck record-${getRecordClass(struck)}`}>{struck}</span>
      </span>
    );
  }

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
