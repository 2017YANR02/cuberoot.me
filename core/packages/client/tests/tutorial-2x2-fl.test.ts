import { describe, expect, it } from 'vitest';
import { Face } from '@cuberoot/visualcube';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { ENGINE_TO_VC_FACE, netIndexOf } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { FL_CASES, FL_EXAMPLE, FL_LEFT_PAIR, hasLeftPair } from '@/app/[lang]/tutorial/2x2-fl/lesson-data';
import { isWhiteFirstLayer, twoByTwoState } from '@/app/[lang]/tutorial/lib/2x2-state';

type State = ReturnType<typeof twoByTwoState>;

function cornerAt(state: State, [x, y, z]: readonly number[]) {
  return Object.fromEntries([x ? FACE.R : FACE.L, y ? FACE.U : FACE.D, z ? FACE.F : FACE.B].map(face =>
    [Face[ENGINE_TO_VC_FACE[face]], state[ENGINE_TO_VC_FACE[face] as Face][netIndexOf(x, y, z, face, 1, 2)]]));
}

describe('2×2 FL source cases', () => {
  it('matches all 44 diagram positions and the first corner twist', () => {
    const diagrams = [
      { cases: FL_CASES.top, groupSizes: [9, 9, 9], wrg: [0, 1, 1], directions: ['U', 'F', 'L'],
        wgo: [[0, 1, 0], [1, 1, 0], [1, 1, 1]], wgoFace: 'U' },
      { cases: FL_CASES.mixed, groupSizes: [3, 3, 3], wrg: [1, 0, 1], directions: ['D', 'F', 'R'],
        wgo: [[1, 1, 1]], wgoFace: 'U' },
      { cases: FL_CASES.bottom, groupSizes: [2, 3, 3], wrg: [1, 0, 1], directions: ['D', 'F', 'R'],
        wgo: [[1, 0, 0]], wgoFace: 'D' },
    ];
    for (const { cases, groupSizes, wrg, directions, wgo, wgoFace } of diagrams) {
      expect(cases).toHaveLength(groupSizes.reduce((total, size) => total + size, 0));
      let offset = 0;
      for (const [group, size] of groupSizes.entries()) {
        const groupCases = cases.slice(offset, offset + size);
        offset += size;
        for (const [index, item] of groupCases.entries()) {
          const state = twoByTwoState(item.exercise.setup);
          const first = cornerAt(state, wrg);
          const second = cornerAt(state, wgo[Math.floor(index / 3)]);
          expect(hasLeftPair(state), item.id).toBe(true);
          expect(Object.values(first).sort().join(''), item.id).toBe('GRW');
          expect(first[directions[group]], item.id).toBe('W');
          expect(Object.values(second).sort().join(''), item.id).toBe('GOW');
          const colors = size === 2 ? ['O', 'G'] : ['W', 'O', 'G'];
          expect(second[wgoFace], item.id).toBe(colors[index % 3]);
        }
      }
    }
  });

  it('plays every primary and alternative formula to a complete first layer', () => {
    const cases = Object.values(FL_CASES).flat();
    expect(new Set(cases.map(item => item.id)).size).toBe(44);
    expect(cases.flatMap(item => item.algs)).toHaveLength(62);
    for (const item of cases) {
      expect(item.exercise.isComplete([]), item.id).toBe(false);
      expect(item.exercise.isComplete(['y']), item.id).toBe(false);
      for (const alg of item.algs) {
        expect(item.exercise.isComplete(alg.split(' ')), `${item.id}: ${alg}`).toBe(true);
      }
    }
  });

  it('builds the left pair, aligns the case and finishes only the first layer in one example', () => {
    const [back, front, align] = FL_EXAMPLE.moves.split(' ');
    const play = (...moves: string[]) => twoByTwoState([FL_EXAMPLE.setup, ...moves].join(' '));
    expect(hasLeftPair(play())).toBe(false);
    expect(cornerAt(play(back), [0, 0, 0])).toEqual({ B: 'O', D: 'W', L: 'B' });
    expect(hasLeftPair(play(back))).toBe(false);
    expect(hasLeftPair(play(back, front))).toBe(true);
    expect(FL_LEFT_PAIR.exercise.isComplete([back])).toBe(false);
    expect(FL_LEFT_PAIR.exercise.isComplete([back, front])).toBe(true);
    expect(play(back, front, align)).toEqual(twoByTwoState(FL_EXAMPLE.case.exercise.setup));
    const result = play(FL_EXAMPLE.moves);
    expect(isWhiteFirstLayer(result)).toBe(true);
    expect(result[Face.U]).not.toEqual(['Y', 'Y', 'Y', 'Y']);
  });
});
