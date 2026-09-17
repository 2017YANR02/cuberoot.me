import { describe, it, expect } from 'vitest';
import { PgEngineBinding } from '@/app/[lang]/sim/engine/pgBinding';
import { megaPgBridge } from '@/app/[lang]/sim/engine/mega/megaPgBridge';
import * as mega from '@/app/[lang]/sim/engine/mega/megaState';
import MegaminxCube from '@cuberoot/puzzle-render-core/engine/mega/MegaminxCube';
import { applyAnimFrame } from '@cuberoot/puzzle-render-core/engine/pieceAnim';
import { Quaternion, Vector3 } from 'three';

describe('Megaminx WCA deep-turn direction', () => {
  it.each([
    ['R++', 2, 1], ['R--', 2, -1],
    ['D++', 0, 1], ['D--', 0, -1],
  ] as const)('%s follows the WCA direction and preserves its fixed layer', (token, face, sense) => {
    const cube = new MegaminxCube();
    try {
      const [move] = mega.parseMegaMoves(token);
      const anims = cube.beginMove(move);
      // The named L/U axis points opposite to the rotating R/D side:
      // ++ is +144 degrees about that axis, not the shallow L/U clockwise turn.
      const axis = new Vector3(...mega.FACE_NORMAL[face]).normalize();
      const angle = sense * 4 * Math.PI / 5;
      expect(anims).toHaveLength(51);
      for (const anim of anims) {
        expect(anim.axis.distanceTo(axis)).toBeCloseTo(0, 12);
        expect(anim.angle).toBeCloseTo(angle, 12);
      }
      const allPivots = [...cube.corners, ...cube.edges, ...cube.centers].map(p => p.pivot);
      const moving = new Set(anims.map(a => a.pivot));
      const fixed = allPivots.filter(p => !moving.has(p));
      expect(fixed).toHaveLength(11);
      expect(moving.has(cube.centers[face].pivot)).toBe(false);
      // The front of R++ travels up; the front of D++ travels right.
      const tangent = axis.clone().cross(new Vector3(0, 0, 1)).multiplyScalar(sense);
      expect(Math.sign(face === 2 ? tangent.y : tangent.x)).toBe(sense);
      for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
        applyAnimFrame(anims, progress);
        const expected = new Quaternion().setFromAxisAngle(axis, angle * progress);
        for (const pivot of moving) expect(pivot.quaternion.angleTo(expected)).toBeCloseTo(0, 6);
        for (const pivot of fixed) expect(pivot.quaternion.angleTo(new Quaternion())).toBe(0);
      }
      expect(mega.megaMoveToString(move)).toBe(token);
      expect(megaPgBridge.stepToMove(megaPgBridge.moveToStep(move))).toEqual(move);
      cube.reset();
      cube.applyMovesInstant([move, ...mega.invertMegaMoves([move])]);
      expect(cube.complete).toBe(true);
      cube.applyMovesInstant(Array.from({ length: 5 }, () => move));
      expect(cube.complete).toBe(true);
    } finally {
      cube.dispose();
    }
  });

  it('keeps shallow turns and empty/unsupported input unchanged', () => {
    expect(mega.parseMegaMoves("U U'")).toEqual([{ face: 0, dir: 1 }, { face: 0, dir: -1 }]);
    expect(mega.parseMegaMoves('')).toEqual([]);
    expect(mega.parseMegaMoves('R+ D+ invalid')).toEqual([]);
  });
});

// Canonical megaminx group order, computed (not transcribed): |G| = 30!·20!·2²⁷·3¹⁹.
const fact = (n: bigint): bigint => { let r = 1n; for (let i = 2n; i <= n; i++) r *= i; return r; };
const MEGA_ORDER = fact(30n) * fact(20n) * (2n ** 27n) * (3n ** 19n);

describe('Megaminx state model', () => {
  it('every face turn has order 5 (turn^5 = solved, not before)', () => {
    for (let f = 0; f < 12; f++) {
      let s = mega.solvedMega();
      for (let r = 0; r < 4; r++) { s = mega.applyMegaMove(s, { face: f, dir: 1 }); expect(mega.isSolved(s)).toBe(false); }
      s = mega.applyMegaMove(s, { face: f, dir: 1 });
      expect(mega.isSolved(s)).toBe(true);
    }
  });
  it('move then inverse returns to solved (both directions)', () => {
    for (let f = 0; f < 12; f++) {
      expect(mega.isSolved(mega.applyMegaScramble([{ face: f, dir: 1 }, { face: f, dir: -1 }]))).toBe(true);
      expect(mega.isSolved(mega.applyMegaScramble([{ face: f, dir: -1 }, { face: f, dir: 1 }]))).toBe(true);
    }
  });
  it('a single face turn conserves corner-twist sum (mod 3) and edge-flip sum (mod 2)', () => {
    for (let f = 0; f < 12; f++) {
      const s = mega.applyMegaMove(mega.solvedMega(), { face: f, dir: 1 });
      expect(s.co.reduce((a, b) => a + b, 0) % 3).toBe(0);
      expect(s.eo.reduce((a, b) => a + b, 0) % 2).toBe(0);
    }
  });
  it('random scramble + exact inverse returns to solved', () => {
    for (let t = 0; t < 30; t++) {
      const scr = mega.randomMegaScramble(40);
      const s = mega.applyMegaScramble([...scr, ...mega.invertMegaMoves(scr)]);
      expect(mega.isSolved(s)).toBe(true);
    }
  });
});

describe('Megaminx PG bridge — facts + faithful live mirror (no BSGS)', () => {
  const binding = new PgEngineBinding(megaPgBridge);

  it('serves Schreier-Sims facts over the 12 face turns but opts out of constructive BSGS', () => {
    expect(binding.solvable).toBe(false);
    expect(binding.order).toBe(MEGA_ORDER); // canonical 1.01e68, NOT PG's 6.04e69 over all 18 cuts
    expect(binding.solveMoves()).toEqual([]);
    expect(binding.scrambleMoves()).toEqual([]);
  });

  it('facts: 20×ℤ3 corners, 30×ℤ2 edges, 12 centers, constraint index 24', () => {
    const f = binding.facts();
    expect(f.order).toBe(MEGA_ORDER);
    expect(f.index).toBe(24n); // 2³·3 — corner/edge parity (×2 each) + twist mod 3 + flip mod 2
    expect(f.reorientations).toBe(1n);
    const byName = Object.fromEntries(f.orbits.map((o) => [o.name, o]));
    expect(byName.CORNERS).toMatchObject({ pieces: 20, oriMod: 3 });
    expect(byName.EDGES).toMatchObject({ pieces: 30, oriMod: 2 });
    expect(byName.CENTERS).toMatchObject({ pieces: 12, oriMod: 1 });
    expect(f.moveNames).toHaveLength(12);
  });

  it('live mirror is faithful: engine-solved ⇔ PG-identity across random sequences', () => {
    // Certifies the face↔PG-move alignment AND the state model against the source group:
    // a wrong face map would desync engine-solvedness from the group identity.
    for (let t = 0; t < 40; t++) {
      const scr = mega.randomMegaScramble(18 + (t % 12));
      binding.rebuild(scr);
      const engineSolved = mega.isSolved(mega.applyMegaScramble(scr));
      expect(binding.solved).toBe(engineSolved);
      if (scr.length) expect(binding.solved).toBe(false); // a scramble from solved is never solved
    }
  });

  it('moves then their reverse-inverse return to group-identity; a single move does not', () => {
    for (let t = 0; t < 20; t++) {
      const scr = mega.randomMegaScramble(16);
      binding.rebuild([...scr, ...mega.invertMegaMoves(scr)]);
      expect(binding.solved).toBe(true);
      binding.rebuild([scr[0]]);
      expect(binding.solved).toBe(false);
    }
  });
});
