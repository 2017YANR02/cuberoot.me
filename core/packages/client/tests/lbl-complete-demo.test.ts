import { expect, it } from 'vitest';
import { completeDemoPool, COMPLETE_DEMO_STAGES } from '@/app/[lang]/tutorial/lbl-archive/complete-demo-state';
import { practiceState } from '@/app/[lang]/tutorial/lbl-archive/practice-state';

const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
const sides = [1, 2, 4, 5];

// Check the generated lessons with the practice engine, independently of the
// VisualCube state engine used to plan the demonstrations.
for (const stage of COMPLETE_DEMO_STAGES) {
  it(`${stage}: every complete demonstration reaches its chapter goal`, () => {
    const demos = completeDemoPool(stage);
    for (const demo of demos) {
      const faces: string[][] = JSON.parse(practiceState(colors, `${demo.setup} ${demo.alg}`));
      const matches = (face: number, positions: number[]) => positions.every(i => faces[face][i] === faces[face][4]);
      if (stage === 'daisy') {
        expect([1, 3, 5, 7].map(i => faces[0][i])).toEqual(['D', 'D', 'D', 'D']);
        continue;
      }
      expect(matches(3, [0, 1, 2, 3, 4, 5, 6, 7, 8])).toBe(true);
      expect(sides.every(side => matches(side, [6, 7, 8]))).toBe(true);
      if (stage === 'corners') continue;
      expect(sides.every(side => matches(side, [3, 5]))).toBe(true);
      if (stage === 'middle') continue;
      expect(matches(0, [1, 3, 5, 7])).toBe(true);
      if (stage === 'yellow-cross') continue;
      expect(matches(0, [0, 2, 6, 8])).toBe(true);
      if (stage === 'yellow-face') continue;
      expect(sides.every(side => matches(side, [0, 2]))).toBe(true);
      if (stage === 'edge-position') expect(sides.every(side => matches(side, [1]))).toBe(true);
    }
  });
}

it('keeps the reviewed complete demonstration pool', () => {
  expect(COMPLETE_DEMO_STAGES.map(stage => completeDemoPool(stage).length)).toEqual([11, 7, 4, 6, 6, 4, 4]);
});
