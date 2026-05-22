// (compId, wcaEventId, wcaRoundTypeId, attemptNum) → reconId 查询。
// 用于 /recon (同场比赛表) 和 /wca/persons (per-row attempt cell) 双向跳转。

import type { ReconSolve } from '@cuberoot/shared';
import { matchRoundType } from './wca_results_api';
import { toWcaEventId } from './wca_events';

/** 把一个 person 的全部复盘按 `${compId}|${wcaEventId}|${reconRound}|${solveNum}` 索引。 */
export function buildReconAttemptMap(recons: ReconSolve[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of recons) {
    if (!r.compWcaId || !r.event || !r.round || r.solveNum == null) continue;
    const wcaEid = toWcaEventId(r.event);
    m.set(`${r.compWcaId}|${wcaEid}|${r.round}|${r.solveNum}`, r.id);
  }
  return m;
}

/** 给定 WCA row 的 (compId, eventId, round_type_id) + 1-based attempt 序号,返回对应复盘 id。
 *  走 ROUND_VARIANTS 兼容 cutoff 子型 ('d' ↔ '1', 'g' ↔ '2' 等)。 */
export function findReconForAttempt(
  map: Map<string, number> | null | undefined,
  compId: string,
  wcaEventId: string,
  wcaRoundTypeId: string,
  attemptNum: number,
): number | undefined {
  if (!map) return undefined;
  for (const reconRound of ['1', '2', '3', 'f']) {
    if (matchRoundType(reconRound, wcaRoundTypeId)) {
      const id = map.get(`${compId}|${wcaEventId}|${reconRound}|${attemptNum}`);
      if (id) return id;
    }
  }
  return undefined;
}
