import { describe, expect, it } from 'vitest';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { alignedDaisyFaces, attachDaisyAlignment } from '@/components/AlgPlayer/daisy-alignment';

describe('white-cross color alignment', () => {
  it('recognizes petals on all four sides, but not solved top edges', () => {
    const cube = new Cube(3);
    try {
      for (const [setup, expected] of [
        ['', []], ['F2', [FACE.F]], ['R2', [FACE.R]], ['B2', [FACE.B]], ['L2', [FACE.L]],
        ['F2 R2 B2 L2', [FACE.F, FACE.R, FACE.B, FACE.L]], ['F2 U', []],
      ] as const) {
        cube.twister.setup(setup);
        expect(alignedDaisyFaces(cube), setup).toEqual(expected);
      }
    } finally { cube.dispose(); }
  });

  it('follows the lesson from unmatched to aligned, rotated, and inserted', () => {
    const cube = new Cube(3);
    const setup = "F2 U R2 U2 B2 U L2 U'";
    try {
      cube.twister.setup(setup);
      // The back petal already matches; the front petal is the one being taught.
      expect(alignedDaisyFaces(cube)).toEqual([FACE.B]);
      cube.twister.setup(`${setup} d`);
      expect(alignedDaisyFaces(cube)).toEqual([FACE.F, FACE.R]);
      cube.twister.setup(`${setup} d y'`);
      expect(alignedDaisyFaces(cube)).toEqual([FACE.R, FACE.B]);
      cube.twister.setup(`${setup} d y' R2`);
      expect(alignedDaisyFaces(cube)).toEqual([FACE.B]);
    } finally { cube.dispose(); }
  });

  it('hides during turns, restores after settling, and releases the frames', () => {
    const cube = new Cube(3);
    const alignment = attachDaisyAlignment(cube);
    try {
      cube.twister.setup('F2');
      alignment.update();
      const frame = cube.getObjectByName('daisy-alignment-F')!;
      expect(frame.visible).toBe(true);
      cube.locks.get('x')!.add(0);
      alignment.update();
      expect(frame.visible).toBe(false);
      cube.locks.get('x')!.clear();
      alignment.update();
      expect(frame.visible).toBe(true);
      cube.twister.setup('');
      alignment.update();
      expect(frame.visible).toBe(false);
      alignment.dispose();
      expect(cube.getObjectByName('daisy-alignment-F')).toBeUndefined();
    } finally { cube.dispose(); }
  });
});
