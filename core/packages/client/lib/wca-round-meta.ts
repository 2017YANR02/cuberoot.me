// WCA round_type_id → 显示元数据。
// 由 PersonDetailPage 的 ByEventView / ByCompList 和 ReconDetailPage 的 SameCompEventTable 共用。
// 折叠逻辑(ROUND_ORDER / roundBucket / roundLabel)本体在 @cuberoot/shared,stats-build 管道
// (round_top3_sum 等)同源复用,这里只重导出 + 补 client 专属的 CSS class / hover 提示文案。
import { roundBucket } from '@cuberoot/shared';

export { ROUND_ORDER, roundLabel } from '@cuberoot/shared';

export const ROUND_HINT_ZH = `R1 / R2 / R3 — 初赛 / 复赛 / 半决赛
Fi — 决赛`;

export const ROUND_HINT_EN = `R1 / R2 / R3 — First / Second / Third Round
Fi — Final`;

export function roundClass(rt: string): string {
  return {
    first: 'wp-round-first', second: 'wp-round-quarter',
    third: 'wp-round-semi', final: 'wp-round-final',
  }[roundBucket(rt)];
}
