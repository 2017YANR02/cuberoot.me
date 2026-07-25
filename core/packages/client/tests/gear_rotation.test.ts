// GearCube whole-cube rotations (issue #38) — engine-level, headless (Node, no WebGL;
// same acceptance basis as engine_headless.test.ts). The rotation rides on the render
// group's quaternion and permutes no piece; face LETTERS are world-fixed, so after a
// rotation the engine must remap a typed letter to the face now sitting there
// (GearCube.remapFace), exactly like SkewbCube. These tests lock that contract:
//   - `y R y' R'` must stay scrambled (the classic canary: an engine that DROPS
//     rotations falsely cancels it to solved);
//   - `y R y' B'` must solve exactly (after y, the typed R flips old B);
//   - worldLetterForFace (the drag path's inverse map) must round-trip through the
//     letter remap for every face under every tested orientation.
import { describe, it, expect } from 'vitest';
import GearCube from '@/app/[lang]/sim/engine/gear/GearCube';
import {
  solvedGear, applyGearFlip, parseGearMoves, type GearPieceState,
} from '@/app/[lang]/sim/engine/gear/gearState';

/** Piece-permutation fingerprint read through the cube's public slot getters
 *  (phase is not exposed, but any wrong-face flip already changes the perms). */
function cubeFp(cube: GearCube): string {
  const corners = Array.from({ length: 8 }, (_, id) => cube.cornerSlotOf(id));
  const cents = Array.from({ length: 6 }, (_, id) => cube.centerSlotOf(id));
  const rings = [0, 1, 2].map((r) => [0, 1, 2, 3].map((id) => cube.gearSlotOf(r, id)));
  return `${corners.join('')}|${cents.join('')}|${rings.map((r) => r.join('')).join('.')}`;
}

/** The same fingerprint computed from the pure state model (slotOf = indexOf). */
function stateFp(st: GearPieceState): string {
  const corners = Array.from({ length: 8 }, (_, id) => st.cp.indexOf(id));
  const cents = Array.from({ length: 6 }, (_, id) => st.cent.indexOf(id));
  const rings = st.ring.map((slots) => [0, 1, 2, 3].map((id) => slots.indexOf(id)));
  return `${corners.join('')}|${cents.join('')}|${rings.map((r) => r.join('')).join('.')}`;
}

/** Identity ROTATION (not identity quaternion): the double cover means a chain of
 *  quarter-turn quats can come home as −identity, and float products leave ~1e-16
 *  residue — both still rotate by 0°, so test |w| ≈ 1. */
const isIdentityQuat = (cube: GearCube): boolean => Math.abs(cube.quaternion.w) > 1 - 1e-12;

describe('GearCube whole-cube rotations (x/y/z ride the group quaternion)', () => {
  // CSG piece construction is the expensive part — build ONE cube, reset between tests.
  const cube = new GearCube();

  it('a rotation reorients the group but permutes no piece', () => {
    cube.twister.setup('');
    const solvedFp = cubeFp(cube);
    for (const m of parseGearMoves("y x' z2")) cube.applyMoveInstant(m);
    expect(isIdentityQuat(cube)).toBe(false);
    expect(cubeFp(cube)).toBe(solvedFp);
    expect(cube.complete).toBe(true);
    for (const m of parseGearMoves("z2 x y'")) cube.applyMoveInstant(m);
    expect(isIdentityQuat(cube)).toBe(true);
  });

  it("y R y' B' solves exactly; y R y' R' stays scrambled (rotations not dropped)", () => {
    cube.twister.setup("y R y' B'");
    expect(cube.complete).toBe(true);
    expect(cubeFp(cube)).toBe(stateFp(solvedGear()));
    expect(isIdentityQuat(cube)).toBe(true);

    cube.twister.setup("y R y' R'");
    expect(cubeFp(cube)).not.toBe(stateFp(solvedGear()));
  });

  it('worldLetterForFace inverts the letter remap for every face and orientation', () => {
    for (const seq of ['', 'y', "x'", 'z2', 'x y', "y y", "x y z'"]) {
      cube.twister.setup(seq);
      const baseFp = cubeFp(cube);
      for (let f = 0; f < 6; f++) {
        const letter = cube.worldLetterForFace(f);
        // typing that letter must flip exactly local face f…
        cube.applyMoveInstant({ face: letter, amt: 1 });
        expect(cubeFp(cube)).toBe(stateFp(applyGearFlip(solvedGear(), f, 1)));
        // …and its prime restores the base state (same remap, quaternion untouched).
        cube.applyMoveInstant({ face: letter, amt: -1 });
        expect(cubeFp(cube)).toBe(baseFp);
      }
    }
  });

  it('undo replay (history string round-trip) re-derives rotations and remaps', () => {
    cube.twister.setup('');
    for (const m of parseGearMoves('y R')) cube.applyMoveInstant(m);
    expect(cube.history.moves).toEqual(['y', 'R']); // history keeps the TYPED letters
    expect(cubeFp(cube)).toBe(stateFp(applyGearFlip(solvedGear(), 5, 1))); // R after y = old B
    cube.twister.undo(); // replays "y" from solved
    expect(cubeFp(cube)).toBe(stateFp(solvedGear()));
    expect(isIdentityQuat(cube)).toBe(false);
    cube.twister.undo(); // back to solved, home orientation
    expect(cubeFp(cube)).toBe(stateFp(solvedGear()));
    expect(isIdentityQuat(cube)).toBe(true);
    cube.twister.redo();
    cube.twister.redo();
    expect(cubeFp(cube)).toBe(stateFp(applyGearFlip(solvedGear(), 5, 1)));
  });
});
