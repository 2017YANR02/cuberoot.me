/**
 * person 页成绩表的行级 hash 锚点(#r-{comp}-{event}-{round})—— ByCompList 与
 * ByEventView 共用,避免两处逐字复制(两视图原各存一份完全相同的实现)。
 *
 * round 段用 recon 端记号('1'/'2'/'3'/'f'),但实际 WCA 行 id 可能是带 cutoff 的子型
 * ('d'/'g'/'b'/'c' 等),故解析时按 ROUND_VARIANTS 反查。
 */
import { ROUND_VARIANTS } from '@/lib/wca-results-api';

/** #r-{comp}-{event}-{round} */
export const resultRowHash = (compId: string, eventId: string, roundType: string): string =>
  `#r-${compId}-${eventId}-${roundType}`;

/** hash(含 '#')→ 行元素,按 ROUND_VARIANTS 容错 cutoff 子轮次。 */
export function resolveResultRow(hash: string): HTMLElement | null {
  if (!hash) return null;
  const slug = hash.slice(1);
  const direct = document.getElementById(slug);
  if (direct) return direct;
  const m = slug.match(/^(.+)-([^-]+)$/);
  if (!m) return null;
  const [, prefix, round] = m;
  for (const v of ROUND_VARIANTS[round] ?? [round]) {
    if (v === round) continue;
    const el = document.getElementById(`${prefix}-${v}`);
    if (el) return el;
  }
  return null;
}

/** 深链目标在渐进渲染列表中的下标(comp 尾段 + round 头段夹取,round 容错);找不到 -1。 */
export function resultRowIndex(
  hash: string,
  rows: ReadonlyArray<{ competition_id: string; round_type_id: string }>,
): number {
  if (!hash) return -1;
  const m = hash.slice(1).match(/^r-(.+)-([^-]+)-([^-]+)$/); // r-{comp}-{event}-{round}
  if (!m) return -1;
  const comp = m[1];
  const round = m[3];
  const variants = ROUND_VARIANTS[round] ?? [round];
  return rows.findIndex((r) => r.competition_id === comp && variants.includes(r.round_type_id));
}
