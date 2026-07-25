// SkewbCube drag-letter conversion after x/y/z rotations — engine-level, headless.
// Grip LETTERS are world-fixed: SkewbCube.beginMove remaps every typed letter through
// the live orientation (remapGrip). The drag path resolves a LOCAL grip (the cap the
// user physically grabbed), so it must be converted BACK to the world letter before
// feeding the engine — otherwise beginMove double-maps it and twists the wrong cap
// after a rotation. worldLetterForGrip is that inverse map (same contract as
// PyraCube.letterFor / GearCube.worldLetterForFace); these tests lock the round-trip.
import { describe, it, expect } from 'vitest';
import SkewbCube from '@/app/[lang]/sim/engine/skewb/SkewbCube';
import {
  solvedSkewb, applySkewbMove, parseSkewbMoves, type SkewbState,
} from '@/app/[lang]/sim/engine/skewb/skewbState';

const fp = (s: SkewbState): string =>
  `${s.cornerPerm.join('')}|${s.cornerOri.join('')}|${s.centerPerm.join('')}`;

describe('SkewbCube worldLetterForGrip (drag path after x/y/z rotations)', () => {
  // Build ONE cube, reset between cases (applyStateInstant clears the quaternion too).
  const cube = new SkewbCube();

  it('home orientation: identity map', () => {
    cube.applyStateInstant(solvedSkewb());
    for (let g = 0; g < 8; g++) expect(cube.worldLetterForGrip(g)).toBe(g);
  });

  it('inverts the letter remap for every grip, direction and orientation', () => {
    for (const seq of ['', 'y', "x'", 'z2', 'x y', "y z'", 'x2 y']) {
      for (let g = 0; g < 8; g++) {
        for (const dir of [1, -1] as const) {
          cube.applyStateInstant(solvedSkewb());
          for (const m of parseSkewbMoves(seq)) cube.applyMoveInstant(m);
          const letter = cube.worldLetterForGrip(g);
          // Feeding the WORLD letter through the engine (which remaps it) must twist
          // exactly local grip g — the cap the drag resolved on screen.
          cube.applyMoveInstant({ corner: letter, dir });
          expect(fp(cube.state)).toBe(fp(applySkewbMove(solvedSkewb(), { corner: g, dir })));
        }
      }
    }
  });
});
