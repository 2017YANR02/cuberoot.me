import { describe, it, expect } from 'vitest';
import {
  parseSia123Scramble, randomSia123Scramble,
  sia123Model, sia123ModelB, sia123SolvedVec, sia123ApplyToken, sia123IsSolved,
  sia123CenterRank,
  SIA123_CORNER_ORBIT, SIA123_CENTER_ORBIT,
} from '@/lib/sia123-solver';
import { buildCornerPdb, buildCenterPdb, idaSolve } from '@/lib/restricted-cube-solver';

/*
 * sia123 — engine + geometry correctness tests (CI-SAFE: no full edge PDB build, no deep IDA* solves).
 *
 * STATUS (TRUE WALL on fast solving): sia123 = two 3×3×3 glued at a shared 1×2×3 block; the bonded group is a
 * measured CLEAN direct product G = G_A × G_B, each half a restricted ⟨U,R,r⟩ 3×3×3 with 6 corners (orbit 29,160,
 * face-turn diam 14), 9 edges (orbit 92,897,280), and 5 centers (the inner r slice 4-cycles four face-centers →
 * position orbit 4; center orientation is invisible). The direct-product split + restricted-cube engine (here
 * generalized for movable centers via the NZ field) are CORRECT, but PER-HALF OPTIMAL solving is NOT practical:
 * real cstimer length-25 scrambles put each half at depth ~17-20, where the projection PDBs (corner diam 14, edge
 * diam 15-17, center 4) are too weak — admissible IDA* runs 60-150s/scramble, and fast near-optimal search
 * (weighted-IDA* / greedy best-first) either fails to converge or exhausts memory. A correct fast solver needs a
 * genuine two-phase (Thistlethwaite/Kociemba) reduction, which is unfinished. So sia123 is NOT shipped as a live
 * solvable puzzle (kept in NONWCA_TS_PLANNED). These tests lock the parts that ARE correct: the geometry / move
 * model (corner orbit 29,160, center orbit 4), the cheap exact corner + center PDBs, faithful per-half solving on
 * SHALLOW states, parsing, and the cube-A/cube-B model symmetry. See solver/NONWCA_PUZZLE_LOOP.md for the wall.
 */

describe('sia123 engine: corner + center orbits (exact small PDBs, CI-safe)', () => {
  it('cube A corner PDB reaches 29,160 (face-turn diameter 14); center PDB reaches 4', () => {
    const m = sia123Model();
    const corner = buildCornerPdb(m);
    let cc = 0, cmx = 0; for (let i = 0; i < corner.length; i++) if (corner[i] !== 255) { cc++; if (corner[i] > cmx) cmx = corner[i]; }
    expect(cc).toBe(SIA123_CORNER_ORBIT);
    expect(cc).toBe(29160);
    expect(cmx).toBe(14);
    const center = buildCenterPdb(m);
    let zc = 0; for (let i = 0; i < center.length; i++) if (center[i] !== 255) zc++;
    expect(zc).toBe(SIA123_CENTER_ORBIT);
    expect(zc).toBe(4);
  });

  it('cube B (z2-conjugated) has the SAME corner + center orbits as cube A', () => {
    const mB = sia123ModelB();
    const corner = buildCornerPdb(mB);
    let cc = 0, cmx = 0; for (let i = 0; i < corner.length; i++) if (corner[i] !== 255) { cc++; if (corner[i] > cmx) cmx = corner[i]; }
    expect(cc).toBe(29160);
    expect(cmx).toBe(14);
    const center = buildCenterPdb(mB);
    let zc = 0; for (let i = 0; i < center.length; i++) if (center[i] !== 255) zc++;
    expect(zc).toBe(4);
  });
});

describe('sia123 engine: center coordinate is tracked, orientation is don\'t-care', () => {
  it('the r slice moves a center POSITION (4-cycle); U/R leave center positions fixed; rank reflects position', () => {
    const m = sia123Model();
    const NZ = m.NZ ?? 0;
    expect(NZ).toBe(5);
    const base = m.NP - NZ;
    const idx = new Map(m.tokens.map((t, i) => [t, i] as const));
    const ap = (t: string, v: Int32Array) => sia123ApplyToken(m, idx.get(t)!, v);
    const sv = sia123SolvedVec(m);
    // r moves 4 center positions
    const afterR = ap('r', sv);
    let moved = 0; for (let j = base; j < m.NP; j++) if (((afterR[j] / 24) | 0) !== j) moved++;
    expect(moved).toBe(4);
    expect(sia123CenterRank(m, afterR)).not.toBe(sia123CenterRank(m, sv));
    // U and R leave center POSITIONS fixed (centerRank unchanged) even though they reorient centers
    for (const f of ['U', 'R']) {
      const af = ap(f, sv);
      let mv = 0; for (let j = base; j < m.NP; j++) if (((af[j] / 24) | 0) !== j) mv++;
      expect(mv, `${f} moved a center position`).toBe(0);
      expect(sia123CenterRank(m, af)).toBe(sia123CenterRank(m, sv));
    }
    // isSolvedVec treats center ORIENTATION as don't-care: U^? leaves centers re-oriented but in place → after a
    // full corner+edge+center-position-solving sequence the goal ignores their spin. Concretely: a pure-center
    // reorientation (apply U four-… ) — simplest check: a state equal to solved except a center's orientation.
    const reor = sv.slice();
    // pick the first center slot and set a nonzero orientation, keeping its piece + position
    reor[base] = base * 24 + 5;
    expect(sia123IsSolved(m, reor)).toBe(true); // center orientation invisible → still solved
  });
});

describe('sia123 faithful per-half solving on shallow states (cheap, exact corner+center heuristic)', () => {
  it('a short random per-half sequence is undone by IDA* using only the exact corner+center PDBs', () => {
    // Shallow states (≤5 moves) are solvable fast with just the corner+center PDBs as the heuristic — this proves
    // the move model + ranks + isSolved are internally consistent without the heavy edge BFS.
    const m = sia123Model();
    const corner = buildCornerPdb(m);
    const centers = buildCenterPdb(m);
    const pdbs = { corner, edges: [], centers };
    // local IDA* (edges intentionally NOT in the heuristic → still admissible, just weaker; fine at depth ≤5)
    const idx = new Map(m.tokens.map((t, i) => [t, i] as const));
    const ap = (t: string, v: Int32Array) => sia123ApplyToken(m, idx.get(t)!, v);
    const faces = [['U'], ['R', 'r']];
    function mulberry(seed: number): () => number { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    const rng = mulberry(0x123);
    let ok = 0;
    for (let trial = 0; trial < 20; trial++) {
      let v = sia123SolvedVec(m); let lastAxis = -1; const seq: string[] = [];
      const len = 3 + Math.floor(rng() * 3); // 3..5
      for (let i = 0; i < len; i++) { let ax: number; do { ax = Math.floor(rng() * 2); } while (ax === lastAxis); lastAxis = ax; const fs = faces[ax]; const f = fs[Math.floor(rng() * fs.length)] + ['', '2', "'"][Math.floor(rng() * 3)]; seq.push(f); v = ap(f, v); }
      const r = idaSolve(m, pdbs, v, { maxDepth: 12 });
      expect(r).not.toBeNull();
      let solved = v; for (const t of r!.path) solved = sia123ApplyToken(m, t, solved);
      if (sia123IsSolved(m, solved)) ok++;
    }
    expect(ok).toBe(20);
  });
});

describe('sia123 scramble parsing + generation', () => {
  it('parses the z2-split cstimer format and rejects bad tokens / missing separator', () => {
    const { aTokens, bTokens } = parseSia123Scramble("U R r' z2 U2 R r");
    expect(aTokens).toEqual(['U', 'R', "r'"]);
    expect(bTokens).toEqual(['U2', 'R', 'r']);
    expect(() => parseSia123Scramble('U R X z2 U')).toThrow(/bad/);
    expect(() => parseSia123Scramble('U R U')).toThrow(/bad: missing/);
    expect(() => parseSia123Scramble('D z2 U')).toThrow(/bad/);   // D is not a half gen
    expect(() => parseSia123Scramble('F z2 U')).toThrow(/bad/);   // F is sia222's gen, not sia123's
  });

  it('randomSia123Scramble produces a valid z2-split scramble with no same-axis repeats per block', () => {
    function mulberry(seed: number): () => number { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    const rng = mulberry(0x51A123);
    const axisOf = (tok: string) => (tok[0] === 'U' ? 0 : 1);
    for (let i = 0; i < 20; i++) {
      const scr = randomSia123Scramble(25, rng);
      const { aTokens, bTokens } = parseSia123Scramble(scr);
      expect(aTokens.length).toBe(25);
      expect(bTokens.length).toBe(25);
      for (const block of [aTokens, bTokens]) for (let j = 1; j < block.length; j++) expect(axisOf(block[j])).not.toBe(axisOf(block[j - 1]));
    }
  });
});
