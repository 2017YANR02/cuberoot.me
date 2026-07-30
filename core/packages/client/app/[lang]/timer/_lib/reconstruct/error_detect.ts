/**
 * Error detection — the "here you lost 0.8s and 4 turns" metric no product
 * ships (SMART_CUBE_RESEARCH.md P0-5): Cubeast's error model stops at penalty
 * shapes, the Chinese apps at right/wrong per solve. We track state move by
 * move anyway, so wasted work falls out of one observation:
 *
 *   A CUBE STATE THAT RECURS MEANS THE MOVES BETWEEN WERE A NET NO-OP.
 *
 * That single rule catches every shape the research doc lists — an undone
 * turn (R R'), a wrong alg backed out move by move, a longer detour that
 * happens to cancel — without a catalogue of patterns, and it can't false-
 * positive: if the state truly recurred, those turns truly achieved nothing.
 * (An AUF moves stickers, so aligning the last layer is NOT flagged.)
 *
 * What it cannot see, stated honestly:
 *   - a wrong alg "rescued" by solving onward from where it landed — no
 *     state recurs, so nothing is flagged. That is arguably not an error
 *     in the executed solve at all; the optimal-diff metric (P0-4) is the
 *     tool that will price it.
 *   - a detour returning to the same POSITION but rotated (x/y/z between)
 *     — facelet keys differ. Smart cubes don't report rotations, so this
 *     stays theoretical for recorded streams.
 *
 * Span accounting: every revisit of a first-seen state yields a raw
 * interval, and overlapping intervals are MERGED into maximal spans. This is
 * what makes a wrong alg backed out move by move come out right: R U F F'
 * U' R' revisits three nested states (after F', after U', after R'), and
 * the union says exactly "these 6 turns achieved nothing" — where a
 * first-revisit-wins-then-reset scheme would report only the innermost
 * F F' and forget the outer states, and counting the nested intervals
 * separately would report 12 wasted turns out of 6 actual ones.
 *
 * Time accounting: a span's cost runs from the moment its start state was
 * reached (the move that produced it landing) to the moment it was reached
 * AGAIN — so the think-time before the wrong turns counts as wasted too,
 * which is the honest reading: deciding to go the wrong way is part of what
 * the error cost. When the loop starts from the very first state (undoing
 * from the scrambled position), it runs from the first turn of the loop
 * instead — before that the solve hadn't started.
 */

import type { CubeFaces } from '../cube/state';
import { applyScramble, solved, toFaceletString } from '../cube/state';
import { applyOneToken } from './stage_segments';
import type { SolveMove } from './stage_segments';

export interface WastedSpan {
  /** Index of the first wasted move (into the solve's move array). */
  fromIdx: number;
  /** Index of the last wasted move (inclusive). */
  toIdx: number;
  /** Turn count of the loop (= toIdx - fromIdx + 1). */
  moves: number;
  /** Time the loop cost, ms — see the header for the exact endpoints. */
  ms: number;
}

export interface ErrorDetectResult {
  spans: WastedSpan[];
  totalWastedMoves: number;
  totalWastedMs: number;
}

export function detectWastedWork(
  scramble: string,
  moves: SolveMove[],
): ErrorDetectResult | null {
  if (!moves || moves.length === 0) return null;

  let state: CubeFaces;
  try {
    state = applyScramble(3, scramble);
  } catch {
    state = solved(3);
  }

  // stateKey → index of the move that MOST RECENTLY produced it (-1 = the
  // scrambled start). Re-anchoring on every visit is what keeps two separate
  // errors separate: after R R' closes a loop back at state X, a later
  // D D' returning to X must count from the reclosure, not from X's first
  // appearance — else the interval spans the already-closed loop and the two
  // errors fuse. Nested back-outs still resolve to their full extent because
  // each unwinding step emits its own interval and the merge unions them.
  const seen = new Map<string, number>();
  seen.set(toFaceletString(state), -1);

  // Raw revisit intervals [fromIdx, toIdx], in walk order (fromIdx is the
  // first move of the loop). Nested back-outs produce overlapping intervals.
  const raw: Array<[number, number]> = [];
  for (let i = 0; i < moves.length; i++) {
    state = applyOneToken(state, moves[i].m);
    const key = toFaceletString(state);
    const prev = seen.get(key);
    if (prev !== undefined) raw.push([prev + 1, i]);
    seen.set(key, i);
  }

  // Merge overlaps into maximal spans. Walk order sorts them by toIdx; sort
  // by fromIdx so a plain sweep merges correctly.
  raw.sort((a, b) => a[0] - b[0]);
  const spans: WastedSpan[] = [];
  let cur: [number, number] | null = null;
  const emit = (iv: [number, number]) => {
    const [fromIdx, toIdx] = iv;
    // Cost runs from when the start state was reached (the move before the
    // loop landing) — scrambled-start loops run from their own first turn.
    const startTs = fromIdx > 0 ? moves[fromIdx - 1].ts : moves[fromIdx].ts;
    spans.push({
      fromIdx,
      toIdx,
      moves: toIdx - fromIdx + 1,
      ms: Math.max(0, moves[toIdx].ts - startTs),
    });
  };
  for (const iv of raw) {
    if (cur === null) { cur = [iv[0], iv[1]]; continue; }
    if (iv[0] <= cur[1]) {
      // True overlap (shared moves) — one wasted run. Merely back-to-back
      // loops stay separate: they are two errors, and reporting them as
      // such is the more useful diagnostic.
      cur[1] = Math.max(cur[1], iv[1]);
    } else {
      emit(cur);
      cur = [iv[0], iv[1]];
    }
  }
  if (cur !== null) emit(cur);

  let totalWastedMoves = 0;
  let totalWastedMs = 0;
  for (const s of spans) {
    totalWastedMoves += s.moves;
    totalWastedMs += s.ms;
  }
  return { spans, totalWastedMoves, totalWastedMs };
}
