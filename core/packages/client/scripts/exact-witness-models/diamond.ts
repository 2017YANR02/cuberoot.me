// ── Independent reference: rebuild the 8 move perms FROM the 4 base generators ───
// The 4 octahedron face-turn generators (cstimer poly3dlib "dmd" move table). We rebuild the move
// alphabet, apply, and full BFS from scratch here — NOT importing the solver's internals — so a
// subtly-wrong mechanism would fail this anchor even though the puzzle would still "solve" itself.
// State = 32-int permutation; apply convention newState[i] = state[perm[i]]; compose(a,b)[i] = a[b[i]].
export const GEN_U = [2, 0, 1, 3, 28, 5, 31, 30, 7, 9, 6, 4, 24, 13, 14, 15, 16, 17, 18, 19, 12, 21, 22, 23, 20, 25, 26, 27, 11, 29, 8, 10];
export const GEN_R = [15, 1, 12, 13, 5, 7, 6, 4, 16, 9, 10, 11, 25, 27, 14, 24, 28, 17, 18, 19, 20, 21, 22, 23, 0, 2, 26, 3, 8, 29, 30, 31];
export const GEN_L = [20, 21, 2, 23, 30, 5, 6, 7, 11, 8, 10, 9, 1, 3, 0, 15, 16, 4, 18, 19, 14, 12, 22, 13, 24, 25, 26, 27, 28, 29, 17, 31];
export const GEN_F = [21, 1, 2, 3, 9, 8, 10, 7, 17, 16, 18, 11, 14, 13, 15, 12, 4, 5, 6, 19, 20, 25, 22, 23, 24, 0, 26, 27, 28, 29, 30, 31];
export const N = 32;
export const composeRef = (a: number[], b: number[]) => a.map((_, i) => a[b[i]]);
export const REF_GENS: Record<string, number[]> = { U: GEN_U, R: GEN_R, L: GEN_L, F: GEN_F };
export const REF_MOVES: Record<string, number[]> = {};
for (const [n, g] of Object.entries(REF_GENS)) {
  REF_MOVES[n] = g;
  REF_MOVES[`${n}'`] = composeRef(g, g);
}
export const TOKENS = Object.keys(REF_MOVES);
export const REF_SOLVED: ReadonlyArray<number> = Array.from({ length: N }, (_, i) => i);
export function refApplyTok(cur: ReadonlyArray<number>, tok: string): number[] {
  const p = REF_MOVES[tok];
  const next = new Array<number>(N);
  for (let i = 0; i < N; i++) next[i] = cur[p[i]];
  return next;
}
export function refApplySeq(seq: string[]): number[] {
  let c: number[] = [...REF_SOLVED];
  for (const tok of seq) c = refApplyTok(c, tok);
  return c;
}
export const keyOf = (c: ReadonlyArray<number>) => c.join(',');
