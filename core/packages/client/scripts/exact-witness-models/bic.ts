// ── Independent move-model re-derivation (fidelity anchor) ─────────────────────
// We rebuild the bicube move model FROM the cstimer geometry spec, completely independently of the
// solver's internal PERM tables: our own copy of d / SOLVED / the 8-cycle doMove / the 5-distinct-with-0
// gate. Then we assert the solver's single-token applies match this independent geometry, run an
// independent BFS that reproduces the closure / God / full histogram, and round-trip real cstimer
// scrambles. We do NOT import any solver-internal permutation tables.

export const D: ReadonlyArray<ReadonlyArray<number>> = [
  [0, 1, 2, 5, 8, 7, 6, 3, 4],
  [6, 7, 8, 13, 20, 19, 18, 11, 12],
  [0, 3, 6, 11, 18, 17, 16, 9, 10],
  [8, 5, 2, 15, 22, 21, 20, 13, 14],
];
export const FACE = 'UFLR';
export const SOLVED: ReadonlyArray<number> = [1, 1, 2, 3, 3, 2, 4, 4, 0, 5, 6, 7, 8, 9, 10, 10, 5, 6, 7, 8, 9, 11, 11];
export const SUFF = ['', '2', "'"];

// One quarter turn (cstimer's exact 8-cycle), in place.
export function refQuarter(s: number[], face: number): void {
  const di = D[face];
  let t = s[di[0]];
  s[di[0]] = s[di[6]]; s[di[6]] = s[di[4]]; s[di[4]] = s[di[2]]; s[di[2]] = t;
  t = s[di[7]];
  s[di[7]] = s[di[5]]; s[di[5]] = s[di[3]]; s[di[3]] = s[di[1]]; s[di[1]] = t;
}
// Apply (face, amount) tokens, returning a fresh array.
export function refApplyTok(cur: ReadonlyArray<number>, tok: string): number[] {
  const face = FACE.indexOf(tok[0]);
  const suf = tok.slice(1);
  const amount = suf === '' ? 1 : suf === '2' ? 2 : 3;
  const next = cur.slice();
  for (let k = 0; k < amount; k++) refQuarter(next, face);
  return next;
}
export function refApplySeq(seq: string[]): number[] {
  let c: number[] = [...SOLVED];
  for (const tok of seq) c = refApplyTok(c, tok);
  return c;
}
// Bandaging gate: 9 face stickers show exactly 5 distinct colors and one of them is 0.
export function refCanMove(state: ReadonlyArray<number>, face: number): boolean {
  const di = D[face];
  const seen: number[] = [];
  let z = false;
  for (let i = 0; i < 9; i++) {
    const c = state[di[i]];
    if (!seen.includes(c)) { seen.push(c); if (c === 0) z = true; }
  }
  return seen.length === 5 && z;
}
export const ALL_TOKENS: string[] = [];
for (let f = 0; f < 4; f++) for (let a = 1; a <= 3; a++) ALL_TOKENS.push(FACE[f] + SUFF[a - 1]);

// Compact key over the 19 moving positions (centres 4,10,12,14 never move).
export const MOVING = (() => { const fx = new Set([4, 10, 12, 14]); const o: number[] = []; for (let i = 0; i < 23; i++) if (!fx.has(i)) o.push(i); return o; })();
export const keyOf = (c: ReadonlyArray<number>) => MOVING.map((p) => c[p]).join(',');
