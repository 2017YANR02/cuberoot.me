import { describe, expect, it } from 'vitest';
import { Face } from '@cuberoot/visualcube';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { ENGINE_TO_VC_FACE, netIndexOf } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { TwistAction } from '@cuberoot/puzzle-render-core/engine/nxn/twister';
import {
  FL_CASES, FL_EXAMPLE, FL_RECOGNITION_EXAMPLES, FL_TWISTS, createFlAlignmentDemo, flAlignedTwist, flCaseGroups,
  flCornerLayer, flRecognitionGroup, flSectionId, hasLeftPair, isFlPracticeTurn,
  randomFlAlignmentRound, randomFlFourthCornerSetup, randomFlLayerQuizSetup, randomFlTwistQuizSetup,
} from '@/app/[lang]/tutorial/2x2-fl/lesson-data';
import { FL_LEFT_PAIR_GOAL, flCornerPairState, randomFlCornerQuizSetup, randomFlLeftPairSetup, solveFlLeftPair } from '@/app/[lang]/tutorial/2x2-fl/left-pair';
import { isWhiteFirstLayer, twoByTwoState } from '@/app/[lang]/tutorial/lib/2x2-state';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import type { CubeFace } from '@/lib/cube-colors';

type State = ReturnType<typeof twoByTwoState>;

function cornerAt(state: State, [x, y, z]: readonly number[]) {
  return Object.fromEntries([x ? FACE.R : FACE.L, y ? FACE.U : FACE.D, z ? FACE.F : FACE.B].map(face =>
    [Face[ENGINE_TO_VC_FACE[face]], state[ENGINE_TO_VC_FACE[face] as Face][netIndexOf(x, y, z, face, 1, 2)]]));
}

const positions = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const locate = (state: State, colors: string) =>
  positions.findIndex(position => Object.values(cornerAt(state, position)).sort().join('') === colors);

function visiblePair(moves: string, first = 'BOW', second = 'BRW') {
  const state = twoByTwoState(moves);
  const stickers = positions.map(position => cornerAt(state, position));
  const placement = (colors: string) => {
    const positionIndex = stickers.findIndex(corner => Object.values(corner).sort().join('') === colors);
    const face = Object.entries(stickers[positionIndex]).find(([, color]) => color === 'W')![0] as CubeFace;
    return { positionIndex, face };
  };
  return flCornerPairState(placement(first), placement(second));
}

describe('2×2 FL source cases', () => {
  it('allows any dragged amount on the practice face without accepting a different layer', () => {
    for (const face of ['U', 'R'] as const) {
      for (const turns of [1, 2, 3, 4, 12]) {
        for (const reversed of [false, true]) {
          const move = new TwistAction(face, reversed, turns).value;
          expect(isFlPracticeTurn(move, face), move).toBe(true);
          expect(isFlPracticeTurn(move), move).toBe(true);
          expect(isFlPracticeTurn(move, face === 'U' ? 'R' : 'U'), move).toBe(false);
        }
      }
    }
    for (const move of ['D', 'F2', "L3'", 'Uw', 'Rw2', '2U', 'y', 'U R']) {
      expect(isFlPracticeTurn(move), move).toBe(false);
    }
  });

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

  it('demonstrates all three other top slots and reveals corner 4 after placing corner 3', () => {
    const cornerSlots = new Set<number>();
    for (let draw = 0; draw < 3; draw++) {
      const { setup, moves, end } = createFlAlignmentDemo('top', () => draw);
      const initial = twoByTwoState(setup);
      const afterThird = twoByTwoState([setup, moves[0]].join(' '));
      cornerSlots.add(positions.findIndex(position => Object.values(cornerAt(initial, position)).sort().join('') === 'GRW'));
      expect(hasLeftPair(initial)).toBe(true);
      expect(Object.values(cornerAt(afterThird, positions[6])).sort().join('')).toBe('GRW');
      expect(Object.values(cornerAt(afterThird, positions[5])).sort().join('')).toBe('GOW');
      expect(twoByTwoState([setup, ...moves].join(' '))).toEqual(twoByTwoState(end.setup));
    }
    expect(cornerSlots).toEqual(new Set([2, 3, 7]));
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

  it('covers all allowed corner 3 poses and reaches a formula by placing it first', () => {
    const upperTurns = ['', 'U', 'U2', "U'"];
    const rightTurns = ['', 'R', 'R2', "R'"];
    for (const [groupIndex, group] of (['top', 'mixed', 'bottom'] as const).entries()) {
      const chapter = group === 'top' ? 'top' : 'bottom';
      const target = chapter === 'top' ? 6 : 5;
      const poses = new Set<string>();
      const poseCount = chapter === 'top' ? 9 : 3;
      for (let pose = 0; pose < poseCount; pose++) {
        const choices = [chapter === 'top' ? 0 : groupIndex - 1, pose, 0, 0];
        const { setup } = randomFlAlignmentRound(chapter, undefined, () => choices.shift()!);
        const initial = twoByTwoState(setup);
        const slot = locate(initial, 'GRW');
        const direction = Object.entries(cornerAt(initial, positions[slot])).find(([, color]) => color === 'W')?.[0];
        poses.add(slot + ':' + direction);
        expect(hasLeftPair(initial)).toBe(true);
        expect(flCornerLayer(slot)).toBe(chapter === 'top' ? 'U' : 'D');
        expect(slot).not.toBe(target);
        const firstTurns = chapter === 'top' ? upperTurns : rightTurns;
        const first = firstTurns.find(move => locate(twoByTwoState(setup + ' ' + move), 'GRW') === target);
        const secondTurns = group === 'top' ? rightTurns : group === 'mixed' ? upperTurns : [''];
        const twists = secondTurns.map(move => {
          const aligned = twoByTwoState([setup, first, move].join(' '));
          const face = Object.entries(cornerAt(aligned, positions[target])).find(([, color]) => color === 'W')?.[0] as CubeFace;
          return flAlignedTwist(group, { positionIndex: target, face }, locate(aligned, 'GOW'));
        });
        expect(twists, setup).toContain(FL_TWISTS[pose % 3]);

        for (let draw = 0; draw < poseCount - 1; draw++) {
          const reroll = [0, draw, 0, 0];
          expect(randomFlAlignmentRound(chapter, pose, () => reroll.shift()!).pose).not.toBe(pose);
        }
      }
      expect(poses.size).toBe(poseCount);
    }
  });

  it('retries corner 4 with corner 3 in the same position and orientation', () => {
    for (const chapter of ['top', 'bottom'] as const) {
      const top = chapter === 'top';
      const target = top ? 6 : 5;
      const faces = top ? ['U', 'F', 'L'] : ['D', 'F', 'R'];
      const group = top ? 'top' : 'mixed';
      const moves = top ? ['R', 'R2', "R'"] : ['U', 'U2', "U'"];
      for (const [twistIndex, twist] of FL_TWISTS.entries()) {
        const fourthPoses = new Set<string>();
        for (let caseIndex = 0; caseIndex < 3; caseIndex++) {
          for (let offset = 0; offset < (top ? 2 : 3); offset++) {
            const draws = [caseIndex, offset];
            const setup = randomFlFourthCornerSetup(chapter, twist, () => draws.shift()!);
            const state = twoByTwoState(setup);
            expect(hasLeftPair(state)).toBe(true);
            expect(locate(state, 'GRW')).toBe(target);
            const face = faces[twistIndex] as CubeFace;
            expect(cornerAt(state, positions[target])[face]).toBe('W');
            const reference = { positionIndex: target, face };
            const fourth = locate(state, 'GOW');
            const whiteFace = Object.entries(cornerAt(state, positions[fourth])).find(([, color]) => color === 'W')?.[0];
            fourthPoses.add(fourth + ':' + whiteFace);
            expect(flAlignedTwist(group, reference, fourth)).toBeUndefined();
            expect(moves.some(move => {
              const moved = twoByTwoState(setup + ' ' + move);
              return flAlignedTwist(group, reference, locate(moved, 'GOW')) === twist;
            })).toBe(true);
          }
        }
        expect(fourthPoses.size).toBe(top ? 6 : 9);
      }
    }
  });

  it('retries formula-group recognition with a different answer and both corners already aligned', () => {
    for (const chapter of ['top', 'bottom'] as const) {
      for (const previous of FL_TWISTS) {
        for (let twistIndex = 0; twistIndex < 2; twistIndex++) {
          for (let groupIndex = 0; groupIndex < (chapter === 'top' ? 1 : 2); groupIndex++) {
            const draws = [twistIndex, groupIndex, 0];
            const state = twoByTwoState(randomFlTwistQuizSetup(chapter, previous, () => draws.shift()!));
            expect(hasLeftPair(state)).toBe(true);
            const positionIndex = locate(state, 'GRW');
            const fourth = locate(state, 'GOW');
            const group = flRecognitionGroup(positionIndex, fourth)!;
            const face = Object.entries(cornerAt(state, positions[positionIndex])).find(([, color]) => color === 'W')?.[0] as CubeFace;
            const expected = FL_TWISTS.filter(twist => twist !== previous)[twistIndex];
            expect(flAlignedTwist(group, { positionIndex, face }, fourth)).toBe(expected);
          }
        }
      }
    }
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

  it('draws each alternative unsolved third/fourth corner pose with the left pair intact', () => {
    const recognitionPair = (setup: string) => visiblePair(setup, 'GRW', 'GOW');
    const previous = recognitionPair('R');
    const solved = recognitionPair('');
    const poses = new Set<number>();
    for (let draw = 0; draw < 268; draw++) {
      const setup = randomFlCornerQuizSetup(previous, limit => {
        expect(limit).toBe(268);
        return draw;
      });
      expect(hasLeftPair(twoByTwoState(setup)), setup).toBe(true);
      poses.add(recognitionPair(setup));
    }
    expect(poses.size).toBe(268);
    expect(poses.has(previous)).toBe(false);
    expect(poses.has(solved)).toBe(false);
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
