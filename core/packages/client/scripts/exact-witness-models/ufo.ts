// ── Independent reference model ───────────────────────────────────────────────
// Built straight from the cstimer ufo spec (megascramble.js:34 → tokens A B C U U' U2' U2 U3) using
// the verified base permutations over 48 home slots. This reference has its OWN apply path
// (refApplyPerm / refApplySeq) — it never calls the solver's ufoApply. The U powers (U2/U3/U4=U2'/
// U5=U') are RECOMPOSED here from the base U, so a wrong power in the solver would diverge. Round-trip
// and optimality assertions use this reference's apply, not the solver's.

export const U: ReadonlyArray<number> = [
  8, 1, 10, 3, 12, 5, 14, 7, 16, 9, 18, 11, 20, 13, 22, 15, 24, 17, 26, 19, 28, 21, 30, 23,
  32, 25, 34, 27, 36, 29, 38, 31, 40, 33, 42, 35, 44, 37, 46, 39, 0, 41, 2, 43, 4, 45, 6, 47,
];
export const A: ReadonlyArray<number> = [
  3, 2, 1, 0, 7, 6, 5, 4, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
];
export const B: ReadonlyArray<number> = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 19, 18, 17, 16, 23, 22, 21, 20,
  24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47,
];
export const C: ReadonlyArray<number> = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
  24, 25, 26, 27, 28, 29, 30, 31, 35, 34, 33, 32, 39, 38, 37, 36, 40, 41, 42, 43, 44, 45, 46, 47,
];

// compose: (compose(g1,g2))[i] = g1[g2[i]] (apply g2 then g1).
export function compose(g1: ReadonlyArray<number>, g2: ReadonlyArray<number>): number[] {
  const r = new Array<number>(48);
  for (let i = 0; i < 48; i++) r[i] = g1[g2[i]];
  return r;
}
export const U2 = compose(U, U);
export const U3 = compose(U2, U);
export const U4 = compose(U3, U); // U2'
export const U5 = compose(U4, U); // U'

export const REF_PERM: Record<string, ReadonlyArray<number>> = {
  U, "U'": U5, U2, "U2'": U4, U3, A, B, C,
};
export const TOKENS = Object.keys(REF_PERM);

export const SOLVED: ReadonlyArray<number> = (() => {
  const c = new Array<number>(48).fill(-1);
  for (let i = 0; i < 8; i++) c[i] = i;
  for (let i = 0; i < 8; i++) c[16 + i] = 8 + i;
  for (let i = 0; i < 8; i++) c[32 + i] = 16 + i;
  return c;
})();

// ── Geometric re-derivation of the 4 base perms (move-model fidelity anchor) ───
// cstimer has NO UFO solver/apply (megascramble.js:34 only emits random tokens), so the move EFFECTS
// can't be cross-checked against an oracle. Instead we re-derive U/A/B/C from the UFO's physical
// geometry using real 3D rotation matrices — completely independently of the hardcoded U/A/B/C arrays
// above — and assert the geometry reproduces them move-for-move. A subtly-wrong mechanism would fail
// here even though the puzzle would still "solve" itself.
//   Disc in the XY plane, central axis Z, 6 sectors 60° apart; balls at sectors 0,2,4. Each ball cut
//   into 8 octants by sign(radial), sign(tangential), sign(z). Home index = slot*8 + (sr<0?4:0) +
//   (st<0?2:0) + (sz<0?1:0) — the executor's slot/sign layout. U = rotate every top-layer (z>0) octant
//   +60° about Z (bottom fixed); A/B/C = rotate ball 0/2/4's 8 octants 180° about its radial axis.
export const GEO_HOME: Array<{ slot: number; sr: number; st: number; sz: number; pos: [number, number, number] }> = [];
{
  const RAD = 10;
  for (let slot = 0; slot < 6; slot++) {
    const a = (slot * Math.PI) / 3;
    const cx = RAD * Math.cos(a), cy = RAD * Math.sin(a);
    const rad = [Math.cos(a), Math.sin(a), 0];
    const tan = [-Math.sin(a), Math.cos(a), 0];
    for (const sr of [1, -1]) for (const st of [1, -1]) for (const sz of [1, -1]) {
      GEO_HOME.push({
        slot, sr, st, sz,
        pos: [cx + sr * rad[0] + st * tan[0], cy + sr * rad[1] + st * tan[1], sz],
      });
    }
  }
}
export function geoFindHome(p: [number, number, number]): number {
  let best = -1, bd = Infinity;
  for (let i = 0; i < 48; i++) {
    const q = GEO_HOME[i].pos;
    const d = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2;
    if (d < bd) { bd = d; best = i; }
  }
  return bd > 1e-6 ? -1 : best;
}
export function geoIdent(): number[] { return Array.from({ length: 48 }, (_, i) => i); }
export function geoWheel(): number[] {
  const g = geoIdent();
  for (let i = 0; i < 48; i++) {
    if (GEO_HOME[i].sz > 0) {
      const [x, y, z] = GEO_HOME[i].pos;
      const c = Math.cos(Math.PI / 3), s = Math.sin(Math.PI / 3);
      const j = geoFindHome([c * x - s * y, s * x + c * y, z]);
      if (j < 0) throw new Error(`geo U: no home ${i}`);
      g[i] = j;
    }
  }
  return g;
}
export function geoFlip(bs: number): number[] {
  const g = geoIdent();
  const a = (bs * Math.PI) / 3;
  const RAD = 10, cx = RAD * Math.cos(a), cy = RAD * Math.sin(a);
  const u = [Math.cos(a), Math.sin(a), 0];
  for (let i = 0; i < 48; i++) {
    if (GEO_HOME[i].slot === bs) {
      const [x, y, z] = GEO_HOME[i].pos;
      const v = [x - cx, y - cy, z];
      const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      // 180° about unit axis u: R v = 2(u·v)u − v
      const rv: [number, number, number] = [2 * dot * u[0] - v[0], 2 * dot * u[1] - v[1], 2 * dot * u[2] - v[2]];
      const j = geoFindHome([cx + rv[0], cy + rv[1], rv[2]]);
      if (j < 0) throw new Error(`geo flip: no home ${i}`);
      g[i] = j;
    }
  }
  return g;
}
export const GEO = { U: geoWheel(), A: geoFlip(0), B: geoFlip(2), C: geoFlip(4) };

// reference apply: next[g[i]] = cur[i].
export function refApplyPerm(cur: ReadonlyArray<number>, g: ReadonlyArray<number>): number[] {
  const next = new Array<number>(48).fill(-1);
  for (let i = 0; i < 48; i++) next[g[i]] = cur[i];
  return next;
}
export function refApplySeq(seq: string[]): number[] {
  let c: number[] = [...SOLVED];
  for (const tok of seq) c = refApplyPerm(c, REF_PERM[tok]);
  return c;
}
export const keyOf = (c: ReadonlyArray<number>) => c.join(',');
