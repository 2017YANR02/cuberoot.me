/**
 * Turning a smart cube's notification stream into moves a cuber would count.
 *
 * Every brand's protocol encodes a turn as `face << 1 | direction` — six faces,
 * two directions, **quarter turns only** (see `bluetooth/gan_v2.ts` and
 * friends). A 180° flick therefore arrives as two separate notifications, so a
 * stream recorded from real hardware never contains a single `R2`; it contains
 * `R R`.
 *
 * That is faithful to the hardware and we keep the raw stream that way — the
 * 3D replay, QTM and the wasted-work detector all want the physical turns. But
 * anything that counts MOVES has to merge them first, or:
 *
 *   - the HTM figure equals QTM for every smart-cube solve (two cells, one
 *     number, different labels);
 *   - efficiency compares the cuber's quarter turns against a reference solver's
 *     half-turn metric, charging one extra move for every double turn they
 *     execute. A solve performed exactly along the reference line scored 65
 *     instead of 100 before this existed.
 *
 * The rule is the ordinary one: a maximal run of consecutive turns of the same
 * face collapses into one move, its net rotation taken mod 4. A run that
 * cancels (`R R'`, or four quarters of the same face) is no move at all — the
 * turns still happened and are still charged, but by the waste axis, which is
 * where undoing your own work belongs. Anything that isn't a turn of the same
 * face breaks the run, whole-cube rotations included: after a `y`, the next `R`
 * is a different physical face.
 *
 * Runs are only merged when ADJACENT. `R L R` stays two R-moves even though the
 * two R turns commute across L — that is how move counts are quoted, and
 * chasing algebraic minima here would make the number stop matching what the
 * cuber remembers doing.
 */

import type { SolveMove } from './stage_segments';

/** One counted move, possibly assembled from several notifications. */
export interface HtmMove {
  /** Canonical token: "R", "R2", "R'". */
  m: string;
  /** Timestamp of the FIRST quarter turn in the run (when the move began). */
  ts: number;
  /** Timestamp of the last quarter turn in the run. */
  endTs: number;
  /** Net rotation in quarters, 1..3. Never 0 — cancelling runs are dropped. */
  quarters: number;
  /** Index in the source stream of the first / last quarter turn of the run. */
  startIdx: number;
  endIdx: number;
}

/** What merges with what, and by how much. Null for anything that is not a
 *  turn of a single face or slice: whole-cube rotations, empty tokens, garbage.
 *  The key is the token without its suffix, so `R` and `R'` share a key while
 *  `R` and `Rw` do not. */
function turnOf(raw: string): { key: string; quarters: number } | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^[xyzXYZ]/.test(t)) return null;          // whole-cube rotation: 0 moves
  const m = /^([^'2]+)(2?)('?)(2?)$/.exec(t);
  if (!m) return null;
  const [, key, two, prime, twoAfterPrime] = m;
  // A layer count may lead the family letter ("3R" on big cubes). Anything
  // that isn't shaped like a move at all is not a turn: it breaks the run and
  // counts nothing, rather than being folded into a neighbour's move.
  if (!/^\d?[A-Za-z]/.test(key)) return null;
  const half = two === '2' || twoAfterPrime === '2';
  const quarters = half ? 2 : prime === "'" ? 3 : 1;
  return { key, quarters };
}

function tokenFor(key: string, quarters: number): string {
  return quarters === 1 ? key : quarters === 2 ? `${key}2` : `${key}'`;
}

/**
 * Merge a raw stream into counted moves. Input order is preserved; the output
 * is shorter than the input exactly when the cuber turned the same face twice
 * in a row.
 */
export function htmMoves(moves: SolveMove[]): HtmMove[] {
  const out: HtmMove[] = [];
  if (!moves || moves.length === 0) return out;

  let key: string | null = null;
  let quarters = 0;
  let ts = 0;
  let endTs = 0;
  let startIdx = 0;
  let endIdx = 0;

  const flush = (): void => {
    if (key === null) return;
    const net = ((quarters % 4) + 4) % 4;
    if (net !== 0) {
      out.push({ m: tokenFor(key, net), ts, endTs, quarters: net, startIdx, endIdx });
    }
    key = null;
    quarters = 0;
  };

  for (let i = 0; i < moves.length; i++) {
    const turn = turnOf(moves[i].m);
    if (!turn) { flush(); continue; }             // rotation / garbage breaks the run
    if (turn.key !== key) {
      flush();
      key = turn.key;
      quarters = 0;
      ts = moves[i].ts;
      startIdx = i;
    }
    quarters += turn.quarters;
    endTs = moves[i].ts;
    endIdx = i;
  }
  flush();
  return out;
}

/** How many moves the stream really is. */
export function countHtm(moves: SolveMove[]): number {
  return htmMoves(moves).length;
}

/**
 * 同一条流,但**一个四分之一转一条**,什么都不合。
 *
 * 谱子那一层要的是这一份,因为「同面连着的合成半转」和「相对面配成中层」抢同一批
 * 记号,而先合同面会把中层拆散:用户 2026-08-04 那把 Z perm 报上来是
 * `L R' | R' L | U U | ...`,`htmMoves` 先把中间那对 `R' R'` 合成 `R2`,于是
 * `L R2 L` 再也配不出两个 M —— 印出来的是 `R2 L D2 M D M2 D L R2 L U M U2`,
 * 谁也认不出那是 Z perm。
 *
 * 所以顺序反过来:**先认中层,再合同面**。合同面那一步搬进 `humanize.ts`(它本来
 * 就在合相邻的同族中层,`M M → M2`,同一条规则),这里只负责把流摊成一手一条。
 *
 * 计步仍然走 `htmMoves` —— 魔方确实转了那么多下面,效率对比也是按面转算的。
 */
export function quarterMoves(moves: SolveMove[]): HtmMove[] {
  const out: HtmMove[] = [];
  if (!moves || moves.length === 0) return out;
  for (let i = 0; i < moves.length; i++) {
    const turn = turnOf(moves[i].m);
    if (!turn) continue;                            // 转体 / 认不出来的记号:不占一条
    out.push({
      m: tokenFor(turn.key, turn.quarters),
      ts: moves[i].ts, endTs: moves[i].ts,
      quarters: turn.quarters, startIdx: i, endIdx: i,
    });
  }
  return out;
}
