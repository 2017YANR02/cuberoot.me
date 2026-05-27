/**
 * Bluetooth solve reconstruction — turn a (move, ts) stream + total time
 * into HTM/QTM counts, TPS, first-move latency, and pause statistics.
 *
 * Coordinate system:
 *  - `moves[i].ts` is ms since the timer phase became 'running' (i.e. since
 *    inspection ended and the user started executing). Inspection-time moves
 *    are intentionally not recorded by TimerPage so they cannot leak in.
 *  - `totalMs` is `solve.timeMs` — the raw solve time, also measured from
 *    solve start. Therefore moves should always satisfy 0 <= ts <= totalMs.
 *  - `memoMs` (BLD only) is the elapsed time at "memo done". Execution time
 *    for BLD is `totalMs - memoMs`; first-move latency is rebased to the end
 *    of memo so a normal sighted solve and BLD share the same metric shape.
 *
 * Turn-count metrics:
 *  Every move is one of:
 *    - cube rotation (x/y/z, with optional `'`/`2`): not counted; rotations
 *      don't twist any layer, just reorient the model.
 *    - slice (M/E/S, with optional `'`/`2`): also not counted under a strict
 *      face-turn metric. Real STM would count them as 1, but we follow the
 *      WCA-ish convention used elsewhere in the timer (see multistage stage
 *      detection — it uses face moves only) so the numbers stay comparable.
 *    - face turn (F/B/L/R/U/D, with optional `'`/`2`): one HTM regardless of
 *      `'` vs `2`; QTM is 1 for `F` / `F'` and 2 for `F2`.
 *  Wide moves (`Fw`, `Rw`, `r`, `f`, …) are treated as face turns of the
 *  same family — their numeric weight is identical, so we just need to
 *  recognize them as not-rotation, not-slice.
 */

export interface ReconstructSlices {
  /** Raw solve time (ms). Equal to `solve.timeMs`. */
  totalMs: number;
  /** BLD memo elapsed (ms), if present. */
  memoMs?: number;
  /** Execution time used for TPS calc (totalMs - memoMs, or totalMs). */
  executionMs: number;
  /** Half-turn metric (HTM): each face turn = 1; rotations + slices = 0. */
  htmCount: number;
  /** Quarter-turn metric (QTM): F2/R2/... = 2, F/F'/R/R'/... = 1. */
  qtmCount: number;
  /** htmCount / (executionMs / 1000); 0 when execution is sub-millisecond. */
  htps: number;
  /** qtmCount / (executionMs / 1000); 0 when execution is sub-millisecond. */
  qtps: number;
  /** Time from solve start (or memo end if BLD) to the first move (ms). */
  firstMoveLatencyMs: number;
  /** Largest gap between two consecutive moves during execution (ms). */
  longestPauseMs: number;
  /** Number of inter-move gaps strictly greater than 500 ms. */
  pauseCount: number;
}

interface ParsedMove {
  /** Family character: 'F' / 'R' / 'U' / 'B' / 'L' / 'D' / 'M' / 'E' / 'S' / 'x' / 'y' / 'z' (case preserved for slice/rotation classification). */
  family: string;
  /** Suffix: '', "'", or '2'. */
  suffix: '' | "'" | '2';
  /** True if a cube rotation (x/y/z). */
  isRotation: boolean;
  /** True if M/E/S slice. */
  isSlice: boolean;
}

const ROTATIONS = new Set(['x', 'y', 'z', 'X', 'Y', 'Z']);
const SLICES = new Set(['M', 'E', 'S']);

/** Parse one move token. Tolerates trailing `w` (wide) and lowercase wides like `r`/`f`/`u`. */
function parseMove(raw: string): ParsedMove | null {
  const m = raw.trim();
  if (!m) return null;
  const family = m[0];
  // suffix is the last char if it's `'` or `2`, otherwise empty.
  const last = m[m.length - 1];
  const suffix: '' | "'" | '2' = last === "'" || last === '2' ? last : '';
  const isRotation = ROTATIONS.has(family);
  const isSlice = SLICES.has(family);
  return { family, suffix, isRotation, isSlice };
}

/**
 * Auto-detect a BLD memo-pause by scanning for the largest gap between
 * consecutive moves. Returns the candidate memo-end timestamp (ms since
 * solve start) when:
 *   - the gap exceeds 10s, AND
 *   - the gap's start ts falls within the first 60% of the solve.
 * Returns null if no gap satisfies the heuristic, or if there are <2 moves.
 *
 * Rationale: a typical BLD solve is "memorize ~30-60s, then execute fast".
 * The memorization period appears as one outlier inter-move gap; subsequent
 * execution pauses are short by comparison. Restricting to the first 60% of
 * solve time avoids mistaking a late-solve thinking pause for memo end.
 */
export function detectMemoPause(
  moves: Array<{ m: string; ts: number }>,
  totalMs: number,
): number | null {
  if (!moves || moves.length < 2 || totalMs <= 0) return null;
  const MIN_GAP_MS = 10_000;
  const MAX_START_FRAC = 0.6;
  let bestGap = 0;
  let bestStartTs: number | null = null;
  for (let i = 1; i < moves.length; i++) {
    const startTs = moves[i - 1].ts;
    const gap = moves[i].ts - startTs;
    if (gap > bestGap) {
      bestGap = gap;
      bestStartTs = startTs;
    }
  }
  if (bestStartTs === null) return null;
  if (bestGap < MIN_GAP_MS) return null;
  if (bestStartTs > totalMs * MAX_START_FRAC) return null;
  // Memo "ends" when the first execution move starts — i.e. the start of
  // the gap plus the gap itself. But the convention used elsewhere in the
  // codebase is that memoMs is the elapsed time at "memo done", which is
  // immediately before the first exec move fires. We use the gap-end ts
  // (i.e. the next move's ts) so memoMs lands right at the first move.
  // Actually re-reading sliceReconstruction: execMoves filter is ts >= execStart,
  // so memoMs == first-exec-move ts means that move is included (and
  // firstMoveLatencyMs == 0). Use bestStartTs + bestGap.
  return bestStartTs + bestGap;
}

export function sliceReconstruction(
  moves: Array<{ m: string; ts: number }>,
  totalMs: number,
  memoMs?: number,
): ReconstructSlices {
  const executionMs = Math.max(0, totalMs - (memoMs ?? 0));
  const execStart = memoMs ?? 0;

  let htmCount = 0;
  let qtmCount = 0;
  let firstMoveLatencyMs = 0;
  let longestPauseMs = 0;
  let pauseCount = 0;

  // Filter moves to "execution window" (ts >= execStart). Inspection-time
  // moves are already filtered upstream, but BLD memo moves might leak in
  // if a future agent decides to record memo-time moves; defensive filter.
  const execMoves = moves.filter(x => x.ts >= execStart);

  if (execMoves.length > 0) {
    firstMoveLatencyMs = Math.max(0, execMoves[0].ts - execStart);
  }

  let prevTs: number | null = null;
  for (const { m, ts } of execMoves) {
    const p = parseMove(m);
    if (p && !p.isRotation && !p.isSlice) {
      htmCount += 1;
      qtmCount += p.suffix === '2' ? 2 : 1;
    }
    if (prevTs !== null) {
      const gap = ts - prevTs;
      if (gap > longestPauseMs) longestPauseMs = gap;
      if (gap > 500) pauseCount += 1;
    }
    prevTs = ts;
  }

  const execSec = executionMs / 1000;
  const htps = execSec >= 0.001 ? htmCount / execSec : 0;
  const qtps = execSec >= 0.001 ? qtmCount / execSec : 0;

  return {
    totalMs,
    memoMs,
    executionMs,
    htmCount,
    qtmCount,
    htps,
    qtps,
    firstMoveLatencyMs,
    longestPauseMs,
    pauseCount,
  };
}
