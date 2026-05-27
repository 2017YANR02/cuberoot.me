/**
 * Generic IDA* solver, ported from cstimer `mathlib.gSolver`
 * (mathlib.js lines ~1135-1295).
 *
 * It works on opaque states represented as strings (the cube's facelet
 * encoding), with a user-supplied move function and per-move axis/face
 * bitmap. Per-instance pruning tables are built lazily by BFS from each
 * "solved" target up to depth ceil(maxl/2). The IDA* lower-bound heuristic
 * is the table value; states deeper than the table report `prunDepth + 1`
 * (an admissible underestimate).
 *
 * The state masks used for CFOP / Roux / Petrus etc. contain '-' for
 * "don't care" stickers — `solvedStates` are the patterns to drive the cube
 * toward, and any state matching the pattern (i.e. whose chars equal the
 * non-'-' chars of the target) counts as solved.
 *
 * `searchParallel` reproduces cstimer's `solveParallel`: try every target in
 * parallel, accept whichever finishes first, and return the bitmask of
 * targets that the solution covers (so callers can avoid solving a goal
 * that is already implied by an earlier step).
 */

export type DoMoveFn = (state: string, move: string) => string;

export class GSolver {
  private readonly solvedStates: string[];
  private readonly doMove: DoMoveFn;
  private readonly movesList: [string, number][];
  private readonly prunTable = new Map<string, number>();
  private prunDepth = -1;
  private prevSize = 0;
  private toUpdateArr: string[] | null = null;
  private readonly MAX_PRUN_SIZE = 100000;

  // Search state (re-used across recursive calls within one search).
  private sol: number[] = [];
  private subOpt = false;
  private visited: Map<string, number> = new Map();
  private solArr: string[] | null = null;
  private prevSolStr: string | null = null;
  private maxl = 0;

  constructor(solvedStates: string[], doMove: DoMoveFn, moves: Record<string, number>) {
    this.solvedStates = solvedStates.slice();
    this.doMove = doMove;
    this.movesList = [];
    for (const move in moves) {
      this.movesList.push([move, moves[move]]);
    }
  }

  /**
   * Build pruning table out to `targetDepth`. Called automatically by
   * `search`; bounded by MAX_PRUN_SIZE so deep targets degrade gracefully.
   */
  private updatePrun(targetDepth: number): void {
    for (let depth = this.prunDepth + 1; depth <= targetDepth; depth++) {
      if (this.prevSize >= this.MAX_PRUN_SIZE) break;
      if (depth < 1) {
        this.prevSize = 0;
        for (const state of this.solvedStates) {
          if (!this.prunTable.has(state)) {
            this.prunTable.set(state, depth);
          }
        }
      } else {
        this.updatePrunBFS(depth - 1);
      }
      this.prunDepth = depth;
      this.prevSize = this.prunTable.size;
    }
  }

  private updatePrunBFS(fromDepth: number): void {
    if (this.toUpdateArr == null) {
      this.toUpdateArr = [];
      for (const [state, d] of this.prunTable) {
        if (d === fromDepth) this.toUpdateArr.push(state);
      }
    }
    while (this.toUpdateArr.length !== 0) {
      const state = this.toUpdateArr.pop()!;
      for (let i = 0; i < this.movesList.length; i++) {
        const newState = this.doMove(state, this.movesList[i][0]);
        if (!newState || this.prunTable.has(newState)) continue;
        this.prunTable.set(newState, fromDepth + 1);
      }
    }
    this.toUpdateArr = null;
  }

  private getPruning(state: string): number {
    const v = this.prunTable.get(state);
    return v === undefined ? this.prunDepth + 1 : v;
  }

  /**
   * Find a solution of length in [minl, MAXL]. Returns the move list, or
   * `undefined` if no solution exists in that range.
   */
  search(state: string, minl: number, MAXL: number): string[] | undefined {
    this.sol = [];
    this.subOpt = false;
    this.visited = new Map();
    this.maxl = minl;
    this.solArr = null;
    this.prevSolStr = null;

    const cap = MAXL + 1;
    for (; this.maxl < cap; this.maxl++) {
      this.updatePrun(Math.ceil(this.maxl / 2));
      if (this.idaSearch(state, this.maxl, null, 0)) break;
    }
    return this.solArr ?? undefined;
  }

  private idaSearch(state: string, maxl: number, lm: number | null, depth: number): boolean {
    if (this.getPruning(state) > maxl) return false;
    if (maxl === 0) {
      // Target match: in cstimer's convention `state` is a *permuted mask*
      // (initialized from the target by scramble+sol prefix). When it
      // returns to one of the original target strings, the puzzle's
      // visible stickers match the goal.
      if (this.solvedStates.indexOf(state) === -1) return false;
      const sa = this.sol.map(idx => this.movesList[idx][0]);
      this.subOpt = true;
      const joined = sa.join(',');
      if (joined === this.prevSolStr) return false;
      this.solArr = sa;
      return true;
    }
    if (!this.subOpt) {
      const v = this.visited.get(state);
      if (v !== undefined && v < depth) return false;
      this.visited.set(state, depth);
    }
    const lastMove = lm == null ? '' : this.movesList[lm][0];
    const lastAxisFace = lm == null ? -1 : this.movesList[lm][1];

    const startIdx = this.sol[depth] ?? 0;
    for (let moveIdx = startIdx; moveIdx < this.movesList.length; moveIdx++) {
      const moveArgs = this.movesList[moveIdx];
      const axisface = moveArgs[1] ^ lastAxisFace;
      const move = moveArgs[0];
      // Same face → skip; same axis (low nibble == 0) and not canonical
      // ordered by name → skip.
      if (axisface === 0 || ((axisface & 0xf) === 0 && move <= lastMove)) continue;
      const newState = this.doMove(state, move);
      if (!newState || newState === state) continue;
      this.sol[depth] = moveIdx;
      if (this.idaSearch(newState, maxl - 1, moveIdx, depth + 1)) return true;
      this.sol.pop();
    }
    return false;
  }

}

/**
 * State `s` matches `target` iff every non-'-' char in `target` equals the
 * corresponding char in `s`.
 */
export function matches(s: string, target: string): boolean {
  if (s.length !== target.length) return false;
  for (let i = 0; i < target.length; i++) {
    const c = target.charCodeAt(i);
    if (c === 45) continue; // '-'
    if (s.charCodeAt(i) !== c) return false;
  }
  return true;
}

/**
 * Solve a step composed of multiple alternative targets, each with its own
 * solver. Returns the best (shortest) solution across targets, plus the
 * bitmask of targets solved (so the caller can OR it into a running mask
 * and skip already-implied targets in later phases). Mirrors cstimer's
 * `solveParallel`.
 *
 * Per cstimer convention, each solver's "state" is the *mask string*
 * (containing '-') permuted by the scramble + any accumulated solution
 * moves so far. The solver searches for a sequence whose application
 * brings that permuted-mask string back to one of the original mask
 * targets — equivalent to the cube's stickers matching the target.
 * `scrambleAndSol` is the prefix to apply to each target string.
 *
 * `fmov` is an optional list of "free moves" (e.g. ["x ", "x2", "x'"]) to
 * try as a one-move prefix before invoking each solver — used by Roux step
 * 1 and similar.
 */
export interface ParallelTarget {
  solver: GSolver;
  /** Bit set indicating "if this solver matches, these sub-goals are now solved". */
  mask: number;
  /** The target mask string this solver is built around. */
  target: string;
}

export function solveParallel(
  doMove: DoMoveFn,
  scrambleAndSol: string[],
  targets: ParallelTarget[],
  currentMask: number,
  MAXL: number,
  fmov: string[] = [],
): { sol: string[] | undefined; mask: number } {
  let sol: string[] | undefined;
  let outMask = currentMask;
  outer: for (let maxl = 0; maxl <= MAXL; maxl++) {
    for (const t of targets) {
      // Skip targets when accumulated mask has bits NOT covered by this
      // target — i.e., we've already solved more than this target's
      // sub-goal so re-running it is pointless. Match cstimer's
      // `(maps[solved] | mask) != maps[solved]`.
      if ((t.mask | currentMask) !== t.mask) continue;
      let state = t.target;
      for (const m of scrambleAndSol) state = doMove(state, m);
      sol = t.solver.search(state, 0, maxl);
      if (sol !== undefined) {
        outMask = currentMask | t.mask;
        break outer;
      }
      for (const f of fmov) {
        const fstate = doMove(state, f);
        sol = t.solver.search(fstate, 0, maxl);
        if (sol !== undefined) {
          sol.unshift(f);
          outMask = currentMask | t.mask;
          break outer;
        }
      }
    }
  }
  return { sol, mask: outMask };
}
