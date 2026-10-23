// ── Independent geometric re-derivation (move-model fidelity anchor) ───────────
// cstimer has NO Cmetrick Mini solver/apply (megascramble.js:29 only emits random tokens), so the
// move EFFECTS can't be cross-checked against an oracle. Instead we re-build the cube rotation group
// (order 24) + the X/Y 90° generators FROM SCRATCH here, using real 3D rotation matrices —
// completely independently of the solver's internal tables — and assert the geometry reproduces the
// solver's 12 move effects move-for-move. A subtly-wrong mechanism would fail here even though the
// puzzle would still "solve" itself.
//
// Physics: 4 balls (0=TL,1=TR,2=BL,3=BR), each ∈ cube rotation group. Row move (U=top {0,1},
// D=bottom {2,3}) rolls 90° about Y; column move (R=right {1,3}, L=left {0,2}) rolls 90° about X.
// `<`/`^` = +90°, `>`/`v` = −90° (inverse), `2` = 180° (self-inverse). The rotation enumeration uses
// the SAME deterministic closure order as the solver (closure of {RX,RY,RZ} from I3), so orientation
// indices align between this reference and the solver — letting us compare state vectors directly.

export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [Vec3, Vec3, Vec3];
export function matMul(a: Mat3, b: Mat3): Mat3 {
  const r = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) r[i][j] += a[i][k] * b[k][j];
  return r as unknown as Mat3;
}
export const I3: Mat3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
export const RX: Mat3 = [[1, 0, 0], [0, 0, -1], [0, 1, 0]];
export const RY: Mat3 = [[0, 0, 1], [0, 1, 0], [-1, 0, 0]];
export const RZ: Mat3 = [[0, -1, 0], [1, 0, 0], [0, 0, 1]];

export const REF_MATS: Mat3[] = [];
export const REF_IDX = new Map<string, number>();
{
  const key = (m: Mat3) => JSON.stringify(m);
  REF_IDX.set(key(I3), 0); REF_MATS.push(I3);
  let fr: Mat3[] = [I3];
  while (fr.length) {
    const nx: Mat3[] = [];
    for (const m of fr) for (const g of [RX, RY, RZ]) {
      const m2 = matMul(g, m);
      const k = key(m2);
      if (!REF_IDX.has(k)) { REF_IDX.set(k, REF_MATS.length); REF_MATS.push(m2); nx.push(m2); }
    }
    fr = nx;
  }
}
export const refMatIdx = (m: Mat3) => REF_IDX.get(JSON.stringify(m))!;
export const REF_ID = refMatIdx(I3);
// composition: MUL[g][o] = idx(G·O) (rotate orientation o by g)
export const REF_MUL: number[][] = REF_MATS.map((G) => REF_MATS.map((O) => refMatIdx(matMul(G, O))));
export const RY1 = refMatIdx(RY), RYinv = refMatIdx(matMul(RY, matMul(RY, RY))), RY2 = refMatIdx(matMul(RY, RY));
export const RX1 = refMatIdx(RX), RXinv = refMatIdx(matMul(RX, matMul(RX, RX))), RX2 = refMatIdx(matMul(RX, RX));

// reference move table (own structure, own generators)
export const REF_MOVES: Record<string, { balls: number[]; g: number }> = {
  'U<': { balls: [0, 1], g: RY1 }, 'U>': { balls: [0, 1], g: RYinv }, 'U2': { balls: [0, 1], g: RY2 },
  'D<': { balls: [2, 3], g: RY1 }, 'D>': { balls: [2, 3], g: RYinv }, 'D2': { balls: [2, 3], g: RY2 },
  'R^': { balls: [1, 3], g: RX1 }, 'Rv': { balls: [1, 3], g: RXinv }, 'R2': { balls: [1, 3], g: RX2 },
  'L^': { balls: [0, 2], g: RX1 }, 'Lv': { balls: [0, 2], g: RXinv }, 'L2': { balls: [0, 2], g: RX2 },
};
export const TOKENS = Object.keys(REF_MOVES);
export const REF_SOLVED: ReadonlyArray<number> = [REF_ID, REF_ID, REF_ID, REF_ID];
export function refApplyTok(cur: ReadonlyArray<number>, tok: string): number[] {
  const mv = REF_MOVES[tok];
  const next = cur.slice();
  for (const b of mv.balls) next[b] = REF_MUL[mv.g][cur[b]];
  return next;
}
export function refApplySeq(seq: string[]): number[] {
  let c: number[] = [...REF_SOLVED];
  for (const tok of seq) c = refApplyTok(c, tok);
  return c;
}
export const keyOf = (c: ReadonlyArray<number>) => c.join(',');
