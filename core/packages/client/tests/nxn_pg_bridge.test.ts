import { describe, it, expect } from 'vitest';
import { PgEngineBinding } from '@/app/[lang]/sim/engine/pgBinding';
import { nxnPgBridge } from '@/app/[lang]/sim/engine/nxn/nxnPgBridge';
import { notationToAtoms, type NxnAtom } from '@/app/[lang]/sim/engine/nxn/nxnNotation';

/**
 * Oracle = the engine's OWN logical cube, ported free of THREE/WASM: integer
 * (doubled, centred) coordinates + a 3×3 signed-permutation orientation frame, driven by
 * the exact per-quarter-turn coordinate transforms from nxn/twister.ts (the `dispatch`
 * cases). This is a wholly independent representation of the group from the PG bridge, so
 * agreement between them certifies the engine↔PG move map (slices + sign) and the BSGS.
 *
 * `solvedPG()` matches PuzzleGeometry's fixed-in-space solved test: every piece home, and
 * oriented (frame == identity) for corners/edges (≥2 extreme coords); centre pieces (1
 * extreme coord) ignore orientation, exactly like PG's oriMod-1 centre orbits.
 */
type Mat = number[][];
const ROT: Record<string, Mat> = {
  '0_1': [[1, 0, 0], [0, 0, 1], [0, -1, 0]],
  '0_2': [[1, 0, 0], [0, -1, 0], [0, 0, -1]],
  '0_3': [[1, 0, 0], [0, 0, -1], [0, 1, 0]],
  '1_1': [[0, 0, -1], [0, 1, 0], [1, 0, 0]],
  '1_2': [[-1, 0, 0], [0, 1, 0], [0, 0, -1]],
  '1_3': [[0, 0, 1], [0, 1, 0], [-1, 0, 0]],
  '2_1': [[0, 1, 0], [-1, 0, 0], [0, 0, 1]],
  '2_2': [[-1, 0, 0], [0, -1, 0], [0, 0, 1]],
  '2_3': [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
};
const I3: Mat = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const mulVec = (R: Mat, v: number[]): number[] => R.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
const mulMat = (A: Mat, B: Mat): Mat =>
  A.map((row) => [0, 1, 2].map((j) => row[0] * B[0][j] + row[1] * B[1][j] + row[2] * B[2][j]));
const eqVec = (a: number[], b: number[]): boolean => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
const isI = (M: Mat): boolean => M.every((row, i) => row.every((x, j) => x === I3[i][j]));

interface Cell { home: number[]; pos: number[]; ori: Mat; }

class RefCube {
  N: number;
  cells: Cell[] = [];
  constructor(N: number) {
    this.N = N;
    const c = (l: number) => 2 * l - (N - 1);
    for (let lx = 0; lx < N; lx++)
      for (let ly = 0; ly < N; ly++)
        for (let lz = 0; lz < N; lz++) {
          const extreme = (lx === 0 || lx === N - 1 ? 1 : 0) + (ly === 0 || ly === N - 1 ? 1 : 0) + (lz === 0 || lz === N - 1 ? 1 : 0);
          if (extreme === 0) continue; // interior — not a surface piece (no sticker)
          const v = [c(lx), c(ly), c(lz)];
          this.cells.push({ home: [...v], pos: [...v], ori: I3.map((r) => [...r]) });
        }
  }
  apply(a: NxnAtom): void {
    const t = a.dir === 1 ? 1 : 3;
    const R = ROT[`${a.axis}_${t}`];
    const coord = 2 * a.layer - (this.N - 1);
    for (const cell of this.cells) {
      if (cell.pos[a.axis] !== coord) continue;
      cell.pos = mulVec(R, cell.pos);
      cell.ori = mulMat(R, cell.ori);
    }
  }
  applyAll(atoms: NxnAtom[]): void { for (const a of atoms) this.apply(a); }
  solvedPG(): boolean {
    const ext = this.N - 1;
    for (const cell of this.cells) {
      if (!eqVec(cell.pos, cell.home)) return false;
      const nExtreme = cell.home.filter((x) => Math.abs(x) === ext).length;
      if (nExtreme >= 2 && !isI(cell.ori)) return false; // corner/edge orientation
    }
    return true;
  }
}

// Deterministic RNG so failures reproduce (Date.now/Math.random-free would be ideal, but
// the suite already uses Math.random elsewhere; seed a small LCG for stability).
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000; };
}
function randomAtoms(N: number, len: number, rng: () => number): NxnAtom[] {
  const out: NxnAtom[] = [];
  for (let i = 0; i < len; i++) {
    out.push({ axis: Math.floor(rng() * 3) as 0 | 1 | 2, layer: Math.floor(rng() * N), dir: rng() < 0.5 ? 1 : -1 });
  }
  return out;
}

describe('nxn oracle self-check (independent of PG)', () => {
  it('behaves like a real cube (famous 3x3 facts)', () => {
    // R has order 4
    let cube = new RefCube(3);
    for (let i = 0; i < 4; i++) cube.applyAll(notationToAtoms('R', 3));
    expect(cube.solvedPG()).toBe(true);
    cube = new RefCube(3);
    cube.applyAll(notationToAtoms('R', 3));
    expect(cube.solvedPG()).toBe(false);
    // sexy move (R U R' U') has order 6
    cube = new RefCube(3);
    for (let i = 0; i < 6; i++) cube.applyAll(notationToAtoms("R U R' U'", 3));
    expect(cube.solvedPG()).toBe(true);
    cube = new RefCube(3);
    for (let i = 0; i < 5; i++) cube.applyAll(notationToAtoms("R U R' U'", 3));
    expect(cube.solvedPG()).toBe(false);
    // a scramble then its inverse returns to solved
    cube = new RefCube(4);
    const scr = randomAtoms(4, 40, makeRng(7));
    cube.applyAll(scr);
    cube.applyAll(scr.slice().reverse().map((a) => ({ ...a, dir: (a.dir === 1 ? -1 : 1) as 1 | -1 })));
    expect(cube.solvedPG()).toBe(true);
  });
});

describe('2x2 — full BSGS closed loop (solvable)', () => {
  const binding = new PgEngineBinding(nxnPgBridge(2));
  it('|G| fixed-in-space + solvable', () => {
    expect(binding.order).toBe(88179840n);
    expect(binding.solvable).toBe(true);
  });
  it('PG solve solves the engine oracle (30 random scrambles)', () => {
    const rng = makeRng(101);
    for (let t = 0; t < 30; t++) {
      const scramble = randomAtoms(2, 25, rng);
      const cube = new RefCube(2);
      cube.applyAll(scramble);
      binding.rebuild(scramble);
      // faithful mirror: group-solved iff oracle strictly solved
      expect(binding.solved).toBe(cube.solvedPG());
      const solution = binding.solveMoves();
      cube.applyAll(solution);
      expect(cube.solvedPG()).toBe(true);
    }
  });
  it('random-STATE scramble reaches a real state then is solved', () => {
    let nonTrivial = 0;
    for (let t = 0; t < 15; t++) {
      const scr = binding.scrambleMoves();
      const cube = new RefCube(2);
      cube.applyAll(scr);
      if (!cube.solvedPG()) nonTrivial++;
      binding.rebuild(scr);
      cube.applyAll(binding.solveMoves());
      expect(cube.solvedPG()).toBe(true);
    }
    expect(nonTrivial).toBeGreaterThan(12);
  });
});

describe('3x3–5x5 — faithful live mirror (facts only)', () => {
  for (const N of [3, 4, 5]) {
    it(`${N}x${N}x${N}: group-solved ⇔ oracle solved across random scrambles`, () => {
      const binding = new PgEngineBinding(nxnPgBridge(N));
      expect(binding.solvable).toBe(false);
      const rng = makeRng(1000 + N);
      for (let t = 0; t < 25; t++) {
        const scramble = randomAtoms(N, 30, rng);
        const cube = new RefCube(N);
        cube.applyAll(scramble);
        binding.rebuild(scramble);
        expect(binding.solved).toBe(cube.solvedPG());
      }
      // round-trip: scramble + inverse → solved in both
      const scr = randomAtoms(N, 30, makeRng(50 + N));
      const inv = scr.slice().reverse().map((a) => ({ ...a, dir: (a.dir === 1 ? -1 : 1) as 1 | -1 }));
      binding.rebuild([...scr, ...inv]);
      expect(binding.solved).toBe(true);
      // a single non-trivial move is scrambled in both
      binding.rebuild([scr[0]]);
      const cube = new RefCube(N);
      cube.apply(scr[0]);
      expect(binding.solved).toBe(false);
      expect(cube.solvedPG()).toBe(false);
    });
  }
});

describe('facts match precomputed |G|', () => {
  it('order per N', () => {
    expect(new PgEngineBinding(nxnPgBridge(2)).facts().order).toBe(88179840n);
    expect(new PgEngineBinding(nxnPgBridge(3)).facts().order).toBe(1038048078587756544000n);
    expect(new PgEngineBinding(nxnPgBridge(4)).facts().order).toBe(16972688908618238933770849245964147960401887232000000000n);
  });
});
