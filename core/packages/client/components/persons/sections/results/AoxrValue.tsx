'use client';
// AoXR 单元格内容:一场比赛里某项目跨轮次的「平均的平均」+ 时间序 PR 名次。
// 「按项目」「按比赛」两个成绩视图共用;口径与世界榜的差异见 logic/aoxr.ts 文件头。
// 直播(非官方)场次灰显 + 星号:它与官方场次不在同一序列里比较。

import { formatWcaResult } from '@/lib/wca-format-result';
import { RecordBadge } from '@/components/RecordBadge/RecordBadge';
import { tr } from '@/i18n/tr';
import type { AoxrCell } from '../../logic/aoxr';

export function AoxrValue({ cell, eventId }: { cell: AoxrCell | null | undefined; eventId: string }) {
  // 该场该项目没有有效平均(全 DNF / 单次项目),或轮次超出 1—4 档 → 留空
  if (!cell) return <span className="wp-aoxr-empty">—</span>;
  // 直播场次照常出 PR 角标(名次取自「官方 + 直播」序列,同单次/平均列的 prRankLive 口径),
  // 非官方只靠灰显传达 —— 同行已经有橙色「直播」标,格内不再重复标记。
  return (
    <span
      className={`wp-aoxr ${cell.unofficial ? 'wp-aoxr--unofficial' : ''}`}
      title={cell.unofficial ? tr({
        zh: '含直播(非官方)轮次;WCA 收录后转为官方',
        en: 'Includes live (unofficial) rounds — becomes official once WCA publishes the results',
      }) : undefined}
    >
      <span className="wp-aoxr-label">Ao{cell.x}R</span>
      <span className="wp-aoxr-value">
        {formatWcaResult(cell.value, eventId, 'average')}
        {cell.prRank
          ? <RecordBadge record={cell.prRank === 1 ? 'PR' : `PR${cell.prRank}`} variant="inline" />
          : null}
      </span>
    </span>
  );
}

/** 列头提示:一次讲清 AoXR 是什么 + 为什么某些场次没有值 */
export const aoxrHint = () => tr({
  zh: 'AoXR = 一场比赛里某项目各轮平均值再取平均,衡量整场发挥。两个前提:①打满该项目的全部轮次(即打进决赛),四轮的项目只打两轮就被淘汰不计;②每轮都有有效平均,任意一轮平均 DNF 则整场不计。X = 该场轮数。PR 名次同档比同档(Ao3R 只和 Ao3R 比)。',
  en: 'AoXR = the mean of a competitor\'s round averages at one competition — a measure of whole-competition consistency. Two prerequisites: (1) they competed in every round of that event (i.e. made the final), so getting knocked out after 2 of 4 rounds does not become an Ao2R; (2) every round produced a valid average — one DNF average voids the whole competition. X = the number of rounds. PR ranks compare like with like (Ao3R only against Ao3R).',
});
