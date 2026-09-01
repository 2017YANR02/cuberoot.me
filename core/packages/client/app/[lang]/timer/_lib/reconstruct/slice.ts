export {
  sliceReconstruction,
  type ReconstructSlices,
} from '@cuberoot/shared/timer/reconstruct/solve-metrics';

/** Web-only heuristic until an installed-client memo write-back consumes it. */
export function detectMemoPause(
  moves: Array<{ m: string; ts: number }>,
  totalMs: number,
): number | null {
  if (moves.length < 2 || totalMs <= 0) return null;
  const minGapMs = 10_000;
  const maxStartFraction = 0.6;
  let bestGap = 0;
  let bestStartTs: number | null = null;
  for (let index = 1; index < moves.length; index += 1) {
    const startTs = moves[index - 1].ts;
    const gap = moves[index].ts - startTs;
    if (gap > bestGap) {
      bestGap = gap;
      bestStartTs = startTs;
    }
  }
  if (bestStartTs === null || bestGap < minGapMs || bestStartTs > totalMs * maxStartFraction) {
    return null;
  }
  return bestStartTs + bestGap;
}
