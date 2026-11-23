import { describe, expect, it } from 'vitest';
import { Face } from '@cuberoot/visualcube';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { ENGINE_TO_VC_FACE, netIndexOf } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { FL_CASES, FL_EXAMPLE, FL_RECOGNITION_EXAMPLES, FL_TWISTS, flAlignedTwist, flCaseGroups, flCornerLayer, flSectionId, hasLeftPair, randomFlLayerQuizSetup } from '@/app/[lang]/tutorial/2x2-fl/lesson-data';
import { FL_LEFT_PAIR_GOAL, flLeftPairState, randomFlLeftPairSetup, solveFlLeftPair } from '@/app/[lang]/tutorial/2x2-fl/left-pair';
import { isWhiteFirstLayer, twoByTwoState } from '@/app/[lang]/tutorial/lib/2x2-state';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';

type State = ReturnType<typeof twoByTwoState>;

function cornerAt(state: State, [x, y, z]: readonly number[]) {
  return Object.fromEntries([x ? FACE.R : FACE.L, y ? FACE.U : FACE.D, z ? FACE.F : FACE.B].map(face =>
    [Face[ENGINE_TO_VC_FACE[face]], state[ENGINE_TO_VC_FACE[face] as Face][netIndexOf(x, y, z, face, 1, 2)]]));
}

const positions = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];

function visiblePair(moves: string) {
  const state = twoByTwoState(moves);
  const stickers = positions.map(position => cornerAt(state, position));
  const placement = (colors: string) => {
    const positionIndex = stickers.findIndex(corner => Object.values(corner).sort().join('') === colors);
    const face = Object.entries(stickers[positionIndex]).find(([, color]) => color === 'W')![0] as CubeFace;
    return { positionIndex, face };
  };
  return flLeftPairState(placement('BOW'), placement('BRW'));
}

describe('2×2 FL source cases', () => {
  it('groups UD and DD within each twist section of the bottom chapter', () => {
    for (const [index, twist] of FL_TWISTS.entries()) {
      const groups = (chapter: 'top' | 'bottom') => flCaseGroups(chapter, twist)
        .map(({ group, cases }) => [group, cases.length]);
      expect(groups('top')).toEqual([['top', 9]]);
      expect(groups('bottom')).toEqual([['mixed', 3], ['bottom', index === 0 ? 2 : 3]]);
    }
  });

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
        const sectionId = flSectionId(cases[0].group, FL_TWISTS[group]);
        const groupCases = cases.filter(item => item.sectionId === sectionId);
        expect(groupCases).toEqual(cases.slice(offset, offset + size));
        offset += size;
        for (const [index, item] of groupCases.entries()) {
          const state = twoByTwoState(item.setup);
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
      expect(isWhiteFirstLayer(twoByTwoState(item.setup)), item.id).toBe(false);
      for (const alg of item.algs) {
        const completesLayer = CUBE_ORIENTATIONS.some(({ value }) =>
          isWhiteFirstLayer(twoByTwoState(`${item.setup} ${alg} ${value}`)));
        expect(completesLayer, `${item.id}: ${alg}`).toBe(true);
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
    expect(play(back, front)).toEqual(twoByTwoState(FL_EXAMPLE.leftPairSetup));
    expect(play(back, front, align)).toEqual(twoByTwoState(FL_EXAMPLE.case.setup));
    const result = play(FL_EXAMPLE.moves);
    expect(isWhiteFirstLayer(result)).toBe(true);
    expect(result[Face.U]).not.toEqual(['Y', 'Y', 'Y', 'Y']);
  });

  it('matches a formula group after the three video examples reach their required slots', () => {
    const expected = [
      [[7, 5], [6, 5], [6, 7]],
      [[1, 7], [5, 3], [5, 7]],
      [[1, 3], [5, 1]],
    ];
    for (const [index, example] of FL_RECOGNITION_EXAMPLES.entries()) {
      const path = expected[index];
      path.forEach(([wrg, wgo], step) => {
        const state = twoByTwoState([example.setup, ...example.moves.slice(0, step)].join(' '));
        const reference = cornerAt(state, positions[wrg]);
        const face = Object.entries(reference).find(([, color]) => color === 'W')?.[0] as CubeFace;
        expect(hasLeftPair(state), example.group).toBe(true);
        expect(Object.values(reference).sort().join(''), example.group).toBe('GRW');
        expect(Object.values(cornerAt(state, positions[wgo])).sort().join(''), example.group).toBe('GOW');
        const twist = flAlignedTwist(example.group, { positionIndex: wrg, face }, wgo);
        expect(twist, example.group).toBe(step === path.length - 1 ? FL_TWISTS[index] : undefined);
        if (twist) expect(flSectionId(example.group, twist)).toBe(example.end.sectionId);
      });
    }
  });

  it('generates every unsolved visible left-pair state exactly once over the 503 possible draws', () => {
    const states = new Set<number>();
    for (let draw = 0; draw < 503; draw++) {
      const setup = randomFlLeftPairSetup(limit => limit === 503 ? draw : draw % limit);
      const state = visiblePair(setup);
      states.add(state);
      const solution = solveFlLeftPair(state);
      expect(solution.length).toBeGreaterThan(0);
      expect(hasLeftPair(twoByTwoState([setup, ...solution].join(' '))), setup).toBe(true);
    }
    expect(states.size).toBe(503);
    expect(states.has(FL_LEFT_PAIR_GOAL)).toBe(false);
  });

  it('randomizes both recognition corners across available slots with the left pair solved', () => {
    const referenceSlots = new Set<number>();
    const lastSlots = new Set<number>();
    for (const [layer, count] of [432, 136].entries()) {
      for (let draw = 0; draw < count; draw++) {
        let first = true;
        let remaining = draw;
        const setup = randomFlLayerQuizSetup(limit => {
          if (first) {
            first = false;
            return layer;
          }
          const choice = remaining % limit;
          remaining = Math.floor(remaining / limit);
          return choice;
        });
        const state = twoByTwoState(setup);
        const cornerColors = positions.map(position => Object.values(cornerAt(state, position)).sort().join(''));
        const reference = cornerColors.indexOf('GRW');
        expect(flCornerLayer(reference), setup).toBe(layer === 0 ? 'U' : 'D');
        expect(hasLeftPair(state), setup).toBe(true);
        expect(isWhiteFirstLayer(state), setup).toBe(false);
        referenceSlots.add(reference);
        lastSlots.add(cornerColors.indexOf('GOW'));
      }
    }
    const freeSlots = new Set([1, 2, 3, 5, 6, 7]);
    expect(referenceSlots).toEqual(freeSlots);
    expect(lastSlots).toEqual(freeSlots);
  });

  it('updates the hints after unrelated layer turns and whole-cube rotations', () => {
    let setup = `${randomFlLeftPairSetup(() => 0)} D F x U B'`;
    for (let pass = 0; pass < 8; pass++) {
      const [hint] = solveFlLeftPair(visiblePair(setup));
      if (!hint) break;
      setup += ` ${hint}`;
    }
    expect(hasLeftPair(twoByTwoState(setup))).toBe(true);
  });

  it('suggests one whole-cube rotation when it solves the left pair', () => {
    const cases = [
      ['x', "x'"], ["x'", 'x'], ['x2', 'x2'],
      ['y', "y'"], ["y'", 'y'], ['y2', 'y2'],
      ['z', "z'"], ["z'", 'z'], ['z2', 'z2'],
      ["F B'", "z'"],
    ];
    for (const [setup, rotation] of cases) {
      expect(solveFlLeftPair(visiblePair(setup)), setup).toEqual([rotation]);
      expect(hasLeftPair(twoByTwoState(`${setup} ${rotation}`)), setup).toBe(true);
    }
  });
});
