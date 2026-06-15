// (compId, wcaEventId, wcaRoundTypeId, attemptNum) → reconId lookup.
// Used by /recon (same-comp list) and /wca/persons (per-row attempt cell) navigation.

import type { ReconSolve } from '@cuberoot/shared';
import { matchRoundType } from './wca-results-api';
import { toWcaEventId } from './wca-events';

export function buildReconAttemptMap(recons: ReconSolve[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of recons) {
    if (!r.compWcaId || !r.event || !r.round || r.solveNum == null) continue;
    const wcaEid = toWcaEventId(r.event);
    m.set(`${r.compWcaId}|${wcaEid}|${r.round}|${r.solveNum}`, r.id);
  }
  return m;
}

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
