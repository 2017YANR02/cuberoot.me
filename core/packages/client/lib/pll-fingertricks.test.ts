// Tests for the PLL fingertrick library (lib/pll-fingertricks.ts).
//
// HERMETIC: the 21 PLL mainAlgs are embedded as a static fixture (snapshot of the live
// `loadAlg('3x3','pll')` data on 2026-06-01) so the test needs no network and runs in CI.
// If the DB alg order/strings change, refresh PLL_MAIN_ALGS below.
//
// vitest.config.ts includes 'lib/**/*.test.ts' so `pnpm --filter @cuberoot/client test`
// runs this. To run JUST this file:
//     pnpm --filter @cuberoot/client exec vitest run lib/pll-fingertricks.test.ts

import { describe, it, expect } from 'vitest';
import {
  HOME,
  POSE_DOF,
  FINGERTRICKS,
  tokenizeAlg,
  invertAlg,
  parseMove,
  family,
  resolveAlg,
  resolveMove,
  tweenDuration,
  tweenDurationMs,
  liveEngineFrames,
  easeOutQuad,
  samplePhase,
  poseAt,
  PHASES,
  ENGINE_FRAMES,
  ENGINE_TICK_HZ,
  SHOWCASE_FRAMES,
  type MoveFamily,
} from './pll-fingertricks';

// Snapshot of loadAlg('3x3','pll') case order + first alg (2026-06-01).
const PLL_MAIN_ALGS: Record<string, string> = {
  Aa: "x R' U R' D2 R U' R' D2 R2 x'",
  Ab: "x R2 D2 R U R' D2 R U' R x'",
  E: "y x' R U' R' D R U R' D' R U R' D R U' R' D' x",
  F: "y R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
  Ga: "R2 U R' U R' U' R U' R2 D U' R' U R D'",
  Gb: "D R' U' R U D' R2 U R' U R U' R U' R2",
  Gc: "y2 R2 F2 R U2 R U2 R' F R U R' U' R' F R2",
  Gd: "R U R' U' D R2 U' R U' R' U R' U R2 D'",
  H: "M2 U' M2 U2 M2 U' M2",
  Ja: "y2 x R2 F R F' R U2 r' U r U2 x'",
  Jb: "R U R' F' R U R' U' R' F R2 U' R'",
  Na: "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
  Nb: "R' U R U' R' F' U' F R U R' F R' F' R U' R",
  Ra: "y R U' R' U' R U R D R' U' R D' R' U2 R'",
  Rb: "R' U2 R U2 R' F R U R' U' R' F' R2",
  T: "R U R' U' R' F R2 U' R' U' R U R' F'",
  Ua: "y2 M2 U M U2 M' U M2",
  Ub: "y2 M2 U' M U2 M' U' M2",
  V: "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2",
  Y: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  Z: "M' U' M2 U' M2 U' M' U2 M2",
};

describe('HandPose / HOME', () => {
  it('HOME has exactly POSE_DOF channels', () => {
    expect(HOME.length).toBe(POSE_DOF);
    expect(POSE_DOF).toBe(9);
  });
  it('HOME values are all finite numbers', () => {
    for (const v of HOME) expect(Number.isFinite(v)).toBe(true);
  });
});

describe('engine clock math matches the cuber engine', () => {
  it('tweenDuration mirrors CubeGroup.tweenDuration = frames*(2 - 2/(d+1))', () => {
    for (const d of [0.5, 1, 2, 3]) {
      expect(tweenDuration(d)).toBeCloseTo(ENGINE_FRAMES * (2 - 2 / (d + 1)), 10);
    }
    // Spot exact known values.
    expect(tweenDuration(1)).toBe(30); // 90° = 30 frames
    expect(tweenDuration(2)).toBeCloseTo(40, 10); // 180° ≈ 40 frames (~1.33x)
  });

  it('tweenDurationMs is the single source of truth: SHOWCASE_FRAMES / speed @ 60Hz', () => {
    // 1× showcase quarter-turn = SHOWCASE_FRAMES (42) frames ≈ 700ms — the SHIPPED tempo
    // (startMove sets CubeGroup.frames = liveEngineFrames(speed), same constant).
    expect(tweenDurationMs(1, 1)).toBeCloseTo((SHOWCASE_FRAMES * 1000) / ENGINE_TICK_HZ, 10);
    expect(SHOWCASE_FRAMES).toBe(42);
    // 0.5× is slower (more frames); 1.5× is faster (fewer frames).
    expect(tweenDurationMs(1, 0.5)).toBeGreaterThan(tweenDurationMs(1, 1));
    expect(tweenDurationMs(1, 1.5)).toBeLessThan(tweenDurationMs(1, 1));
    // The hand window MUST match the engine frame budget exactly (no 36-vs-30 drift):
    // windowMs == tweenDuration(d, liveEngineFrames(speed)) * 1000/60.
    for (const speed of [0.5, 1, 1.5]) {
      for (const d of [1, 2]) {
        expect(tweenDurationMs(d, speed)).toBeCloseTo(
          (tweenDuration(d, liveEngineFrames(speed)) * 1000) / ENGINE_TICK_HZ,
          10,
        );
      }
    }
  });

  it('easeOutQuad == 1-(p-1)^2, clamped, endpoints 0 and 1', () => {
    expect(easeOutQuad(0)).toBeCloseTo(0, 10);
    expect(easeOutQuad(1)).toBeCloseTo(1, 10);
    for (const p of [0.1, 0.25, 0.5, 0.75, 0.9]) {
      expect(easeOutQuad(p)).toBeCloseTo(1 - (p - 1) * (p - 1), 10);
    }
    // clamps out-of-range
    expect(easeOutQuad(-0.5)).toBeCloseTo(0, 10);
    expect(easeOutQuad(1.5)).toBeCloseTo(1, 10);
  });
});

describe('tokenizer + family classifier', () => {
  it('strips finger-trick decorators · ↑ ↓ ← →', () => {
    expect(tokenizeAlg("R· U↑ R'↓ ←U' →F")).toEqual(["R", 'U', "R'", "U'", 'F']);
  });

  it('strips grouping brackets ( ) [ ]', () => {
    expect(tokenizeAlg("R U [R' U'] (R U R')")).toEqual(['R', 'U', "R'", "U'", 'R', 'U', "R'"]);
  });

  it('invertAlg reverses order + flips direction (alg ∘ inverse = identity)', () => {
    expect(invertAlg('R U F')).toBe("F' U' R'");
    expect(invertAlg("R U' R2")).toBe("R2 U R'");
    // double-applying invert is identity (modulo bracket/space normalization).
    expect(invertAlg(invertAlg('R U R2 F'))).toBe('R U R2 F');
  });

  it('parses prime, double, wide, rotation correctly', () => {
    expect(parseMove("R'")).toMatchObject({ family: 'R', reverse: true, times: 1, wide: false });
    expect(parseMove('R2')).toMatchObject({ family: 'R', reverse: false, times: 2 });
    expect(parseMove('Rw')).toMatchObject({ family: 'wide', wide: true, base: 'R' });
    expect(parseMove('r')).toMatchObject({ family: 'wide', wide: true, base: 'R' });
    expect(parseMove("r'")).toMatchObject({ family: 'wide', wide: true, reverse: true });
    expect(parseMove("x'")).toMatchObject({ family: 'x', reverse: true });
    expect(parseMove('y2')).toMatchObject({ family: 'y', times: 2 });
    expect(parseMove('M2')).toMatchObject({ family: 'M', times: 2 });
    expect(parseMove("M'")).toMatchObject({ family: 'M', reverse: true });
    expect(parseMove('D2')).toMatchObject({ family: 'D', times: 2 });
    expect(parseMove("U2")).toMatchObject({ family: 'U', times: 2 });
  });

  it('returns null for garbage tokens', () => {
    expect(parseMove('')).toBeNull();
    expect(parseMove('hello')).toBeNull();
  });
});

describe('every move family in all 21 PLL mainAlgs resolves to a trick', () => {
  const seen = new Set<MoveFamily>();
  for (const [name, alg] of Object.entries(PLL_MAIN_ALGS)) {
    it(`${name}: ${alg}`, () => {
      const tokens = tokenizeAlg(alg);
      expect(tokens.length).toBeGreaterThan(0);
      for (const tok of tokens) {
        const fam = family(tok); // throws if unparseable
        expect(FINGERTRICKS[fam]).toBeDefined();
        seen.add(fam);
        // resolveMove must succeed end-to-end.
        const r = resolveMove(tok);
        expect(r).not.toBeNull();
        expect(r!.trick).toBe(FINGERTRICKS[fam]);
        expect(r!.durationTicks).toBeCloseTo(tweenDuration(r!.times), 10);
      }
    });
  }

  it('exercises the expected family coverage (R L U F D M + x/y rotations)', () => {
    // PLLs use these; B/z/wide are in the table for completeness even if no PLL hits them.
    expect(seen.has('R')).toBe(true);
    expect(seen.has('U')).toBe(true);
    expect(seen.has('F')).toBe(true);
    expect(seen.has('M')).toBe(true);
    expect(seen.has('D')).toBe(true);
    expect(seen.has('x')).toBe(true);
    expect(seen.has('y')).toBe(true);
    expect(seen.has('wide')).toBe(true); // Ja has r/r'
  });
});

describe('FINGERTRICKS table integrity', () => {
  const FAMILIES: MoveFamily[] = ['R', 'L', 'U', 'F', 'B', 'D', 'M', 'wide', 'x', 'y', 'z'];
  it('every family entry has POSE_DOF-length delta + valid activeHand + anchor', () => {
    for (const f of FAMILIES) {
      const t = FINGERTRICKS[f];
      expect(t, `missing trick for family ${f}`).toBeDefined();
      expect(t.delta.length).toBe(POSE_DOF);
      expect(['left', 'right', 'both']).toContain(t.activeHand);
      expect(t.anchor).toBeTruthy();
      if (t.deltaOther) expect(t.deltaOther.length).toBe(POSE_DOF);
    }
  });
  it('rotations x/y/z are flagged rotation:true and anchor "cube"', () => {
    for (const f of ['x', 'y', 'z'] as MoveFamily[]) {
      expect(FINGERTRICKS[f].rotation).toBe(true);
      expect(FINGERTRICKS[f].anchor).toBe('cube');
      expect(FINGERTRICKS[f].activeHand).toBe('both');
    }
  });
});

describe('phase scheduler prep/turn/settle', () => {
  it('phase fractions sum to 1', () => {
    expect(PHASES.prep + PHASES.turn + PHASES.settle).toBeCloseTo(1, 10);
  });
  it('classifies progress into the right phase', () => {
    expect(samplePhase(0.1).phase).toBe('prep');
    expect(samplePhase(0.5).phase).toBe('turn');
    expect(samplePhase(0.95).phase).toBe('settle');
  });
  it('amplitude ramps 0→~1 in prep, holds 1 in turn, ramps 1→0 in settle', () => {
    expect(samplePhase(0).amplitude).toBeCloseTo(0, 6);
    expect(samplePhase(PHASES.prep - 1e-6).amplitude).toBeCloseTo(1, 4);
    expect(samplePhase(0.5).amplitude).toBe(1);
    expect(samplePhase(1).amplitude).toBeCloseTo(0, 6);
  });
});

describe('HOME-delta model: every trick returns to HOME (no drift)', () => {
  // For each family, the active hand at p=0 and p=1 must equal HOME exactly, and the
  // inactive hand must equal HOME at ALL p (single-hand tricks).
  const FAMILIES: MoveFamily[] = ['R', 'L', 'U', 'F', 'B', 'D', 'M', 'wide', 'x', 'y', 'z'];
  for (const f of FAMILIES) {
    const trick = FINGERTRICKS[f];
    for (const reverse of [false, true]) {
      for (const times of [1, 2]) {
        it(`${f} reverse=${reverse} times=${times} returns to HOME at endpoints`, () => {
          for (const which of ['left', 'right'] as const) {
            const at0 = poseAt(trick, { reverse, times }, 0, which);
            const at1 = poseAt(trick, { reverse, times }, 1, which);
            for (let i = 0; i < POSE_DOF; i++) {
              expect(at0[i]).toBeCloseTo(HOME[i], 6);
              expect(at1[i]).toBeCloseTo(HOME[i], 6);
            }
          }
        });
      }
    }
  }

  it('peak pose at p=0.5 differs from HOME for an active single-hand trick', () => {
    const r = FINGERTRICKS.R;
    const peak = poseAt(r, { reverse: false, times: 1 }, 0.5, 'right');
    let moved = false;
    for (let i = 0; i < POSE_DOF; i++) if (Math.abs(peak[i] - HOME[i]) > 1e-3) moved = true;
    expect(moved).toBe(true);
  });

  it('inactive hand stays at HOME for a single-hand trick at every p', () => {
    const r = FINGERTRICKS.R; // right-hand trick → left stays HOME
    for (const p of [0, 0.25, 0.5, 0.75, 1]) {
      const left = poseAt(r, { reverse: false, times: 1 }, p, 'left');
      for (let i = 0; i < POSE_DOF; i++) expect(left[i]).toBeCloseTo(HOME[i], 10);
    }
  });

  it('a full 12-move alg composes without accumulating drift (end pose == HOME)', () => {
    // Walk Aa move-by-move; after each move completes (p=1) both hands must be HOME.
    const moves = resolveAlg(PLL_MAIN_ALGS.Aa);
    expect(moves.length).toBeGreaterThan(8);
    for (const m of moves) {
      for (const which of ['left', 'right'] as const) {
        const end = poseAt(m.trick, m, 1, which);
        for (let i = 0; i < POSE_DOF; i++) expect(end[i]).toBeCloseTo(HOME[i], 6);
      }
    }
  });
});
