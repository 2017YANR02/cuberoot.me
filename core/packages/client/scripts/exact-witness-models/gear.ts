// ── Independent reference: rebuild the gear move model FROM cstimer's gearcube.js semantics ───
// We re-derive cmv/emv (acycle / setNPerm / getNPerm / cornerMove / edgeMove) and the token model
// here — NOT importing the solver's internals — so a subtly-wrong mechanism would fail this anchor
// even though the puzzle would still "solve" itself. State = [corner(0..23), e0,e1,e2 (0..71)].
export function acycle(arr: number[], perm: ReadonlyArray<number>): void {
  const plen = perm.length, tmp: number[] = [];
  for (let i = 0; i < plen; i++) tmp[i] = arr[perm[i]];
  for (let i = 0; i < plen; i++) { const j = (i + 1) % plen; arr[perm[j]] = tmp[i]; }
}
export function fact(n: number): number { let r = 1; for (let i = 2; i <= n; i++) r *= i; return r; }
export function setNPerm(arr: number[], idx: number, n: number): number[] {
  let vall = 0x76543210, valh = 0xfedcba98;
  for (let i = 0; i < n - 1; i++) {
    const p = fact(n - 1 - i); let v = Math.floor(idx / p); idx %= p; v <<= 2;
    if (v >= 32) { v -= 32; arr[i] = (valh >> v) & 0xf; const m = (1 << v) - 1; valh = (valh & m) + ((valh >> 4) & ~m); }
    else { arr[i] = (vall >> v) & 0xf; const m = (1 << v) - 1; vall = (vall & m) + ((vall >>> 4) & ~m) + (valh << 28); valh >>= 4; }
  }
  arr[n - 1] = vall & 0xf; return arr;
}
export function getNPerm(arr: ReadonlyArray<number>, n: number): number {
  let idx = 0, vall = 0x76543210, valh = 0xfedcba98;
  for (let i = 0; i < n - 1; i++) {
    const v = arr[i] << 2; idx *= n - i;
    if (v >= 32) { idx += (valh >> (v - 32)) & 0xf; valh -= 0x11111110 << (v - 32); }
    else { idx += (vall >> v) & 0xf; valh -= 0x11111111; vall -= 0x11111110 << v; }
  }
  return idx;
}
export const REF_MOVE_EDGES: ReadonlyArray<ReadonlyArray<number>> = [[0, 3, 2, 1], [0, 1], [0, 3]];
export function refCornerMove(arr: number[], m: number): void { acycle(arr, [0, m + 1]); }
export function refEdgeMove(idx: number, m: number): number {
  const arr = setNPerm([], Math.floor(idx / 3), 4);
  acycle(arr, REF_MOVE_EDGES[m]);
  return getNPerm(arr, 4) * 3 + ((idx % 3) + (m === 0 ? 1 : 0)) % 3;
}
export const REF_CMV: number[][] = [[], [], []];
for (let m = 0; m < 3; m++) for (let s = 0; s < 24; s++) { const a = setNPerm([], s, 4); refCornerMove(a, m); REF_CMV[m][s] = getNPerm(a, 4); }
export const REF_EMV: number[][] = [[], [], []];
for (let m = 0; m < 3; m++) for (let s = 0; s < 72; s++) REF_EMV[m][s] = refEdgeMove(s, m);
export function refBaseStep(state: ReadonlyArray<number>, m: number): number[] {
  const ns = state.slice();
  ns[0] = REF_CMV[m][ns[0]];
  for (let i = 1; i < 4; i++) ns[i] = REF_EMV[(m + i - 1) % 3][ns[i]];
  return ns;
}
export const REF_SOLVED: ReadonlyArray<number> = [0, 0, 0, 0];
export const keyOf = (c: ReadonlyArray<number>) => c[0] * 373248 + c[1] * 5184 + c[2] * 72 + c[3];

// token model (33 tokens = 3 axes × 11 powers). Suffix index a → steps (a+1).
export const SUFFIX: ReadonlyArray<string> = ["'", "2'", "3'", "4'", "5'", "6", "5", "4", "3", "2", ""];
export const AXIS: Record<string, number> = { U: 0, R: 1, F: 2 };
export const TOKENS: string[] = [];
for (const ax of ['U', 'R', 'F']) for (const suf of SUFFIX) TOKENS.push(ax + suf);
export function refTokenToMA(tok: string): [number, number] {
  const m = AXIS[tok[0]];
  if (m === undefined) throw new Error('bad axis ' + tok);
  const a = SUFFIX.indexOf(tok.slice(1));
  if (a < 0) throw new Error('bad suffix ' + tok);
  return [m, a + 1];
}
export function refApplyTok(cur: ReadonlyArray<number>, tok: string): number[] {
  const [m, steps] = refTokenToMA(tok);
  let s = cur.slice();
  for (let k = 0; k < steps; k++) s = refBaseStep(s, m);
  return s;
}
export function refApplySeq(seq: string[]): number[] {
  let c: number[] = [...REF_SOLVED];
  for (const tok of seq) c = refApplyTok(c, tok);
  return c;
}
