'use client';
// 平均列内容(ByCompList / ByEventView 共用)。
//   有官方平均 → 照常显示 + 区域纪录 / PR 标志。
//   无官方平均(effAvg===0,如 head-to-head 决赛、Bo-N 等 WCA 不记平均的轮次)且有效解数≥5
//     → 显示 cstimer 式非官方 AoN,右上角标「非官方」。FMC / MBLD 编码特殊,不参与。

import { formatWcaResult } from '@/lib/wca-format-result';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { unofficialAoN } from '@/lib/unofficial-average';
import { tr } from '@/i18n/tr';
import { ResultChangeChain } from './ChangedResultValue';
import { AvgDec } from '@/components/wca-results/AvgDec';

export function AverageValueCell({
  effAvg, attempts, eventId, averageRecord, averageRank, oldValues, note, decimalAlign,
}: {
  effAvg: number;
  attempts: number[];
  eventId: string;
  averageRecord: string | null;
  averageRank: number | null;
  oldValues: number[];
  note?: string | null;
  // 小数点对齐模式(详细成绩带 平均STM/TPS 时):平均值走 AvgDec 铺进 .wp-avg-cell 网格,与下两行小数点对齐。
  decimalAlign?: boolean;
}) {
  const timed = eventId !== '333mbf' && eventId !== '333fm';
  const unof = effAvg === 0 && timed ? unofficialAoN(attempts) : null;

  const badge = averageRecord
    ? <RecordBadge record={averageRecord} variant="inline" />
    : averageRank
      ? <RecordBadge record={averageRank === 1 ? 'PR' : `PR${averageRank}`} variant="inline" />
      : null;
  // 满 5 把复盘轮才会带小数点对齐(平均值为普通计时值,非 unofficial / MBLD)。变更链(旧值划线)
  // 极罕见于此类轮 → 该模式下略过 ResultChangeChain,保 .wp-avg-cell 两列网格结构不破。
  if (decimalAlign && !unof) {
    return <AvgDec text={formatWcaResult(effAvg, eventId, 'average')} badge={badge} variant="main" />;
  }

  if (unof) {
    const tip = tr({
      zh: `非官方平均:cstimer 式 Ao${unof.n}(去掉最快 / 最慢各 ${unof.trim} 个后取平均);WCA 不为该轮次(如对阵决赛)记录平均`,
      en: `Unofficial average: cstimer-style Ao${unof.n} (drop fastest/slowest ${unof.trim} each, mean the rest); WCA records no average for this round`,
    });
    return (
      <span className="wp-unof-avg-cell" title={tip}>
        <ResultChangeChain oldValues={oldValues} eventId={eventId} kind="average" note={note} />
        <span className="wp-unof-avg-val">{formatWcaResult(unof.value, eventId, 'average')}</span>
        <span className="wp-unof-avg-corner">
          <span className="wp-unof-avg-ao">{`Ao${unof.n}`}</span>
          <span className="wp-unof-avg-flag">{tr({ zh: '非官方', en: 'unofficial' })}</span>
        </span>
      </span>
    );
  }

  return (
    <span className="record-num-cell">
      <ResultChangeChain oldValues={oldValues} eventId={eventId} kind="average" note={note} />
      {formatWcaResult(effAvg, eventId, 'average')}
      {badge}
    </span>
  );
}
