import { formatRecord } from '@cuberoot/shared/timer/record-badge';
import './record-badge.css';
export function RecordBadge({record: expanded,variant='standalone'}: {record?:string|null;variant?:'inline'|'standalone'}) {
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
