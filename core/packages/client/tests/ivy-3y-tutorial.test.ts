import { describe, expect, it } from 'vitest';
import {
  ivyApplyStandard,
  ivyDisplayState,
  MOVE_CENTERS,
  parseIvyStandardMoves,
  type IvyDisplayState,
} from '@cuberoot/puzzle-solvers/ivy';
import {
  IVY_CENTER_PRACTICE,
  IVY_3Y_EXAMPLES,
  IVY_3Y_SUPPLEMENT,
} from '@/app/[lang]/tutorial/_ivy3y-data';

// A completed face includes the center and both corner stickers. This is the
// physical completion condition, including a solved cube in a rotated frame.
function completeFaces(state: IvyDisplayState): number[] {
  return state.centers.flatMap((color, face) =>
    MOVE_CENTERS.every((faces, axis) =>
      !faces.includes(face) || state.petals[axis][face] === color
    ) ? [face] : []
  );
}

function facePatterns(state: IvyDisplayState): Array<{ center: number; petals: number[] }> {
  return state.centers.map((center, face) => ({
    center,
    petals: MOVE_CENTERS.flatMap((faces, axis) =>
      faces.includes(face) ? [state.petals[axis][face]] : []
    ).sort((a, b) => a - b),
  }));
}

describe('Ivy center practice states', () => {
  it.each(IVY_CENTER_PRACTICE)('$id matches its recognition case and solves it', (practice) => {
    expect(parseIvyStandardMoves(practice.alg).length).toBe(practice.id === 'four-center-exchange' ? 8 : 4);
    expect(parseIvyStandardMoves(practice.setup).length).toBe(practice.id === 'four-center-exchange' ? 8 : 4);

    // The expected permutation and complete faces were independently recorded;
    // checking only an algorithm followed by its inverse would miss wrong cases.
    const initial = ivyDisplayState(practice.setup);
    expect(initial.centers).toEqual(practice.expectedCenters);
    expect(ivyApplyStandard(practice.setup).corners).toEqual([0, 0, 0, 0]);
    expect(completeFaces(initial)).toEqual(practice.solvedFaces);
    expect(completeFaces(ivyDisplayState(`${practice.setup} ${practice.alg}`)))
      .toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('Ivy 1Y supplementary algorithm', () => {
  it('matches the initial two-face case and every observed top-face transition', () => {
    const { setup, alg, topFaceSteps, expectedCenters, expectedCorners } = IVY_3Y_SUPPLEMENT;
    const moves = parseIvyStandardMoves(alg);
    expect(moves).toHaveLength(8);
    expect(parseIvyStandardMoves(setup)).toHaveLength(8);

    const initial = ivyDisplayState(setup);
    expect(initial.centers).toEqual(expectedCenters);
    expect(ivyApplyStandard(setup).corners).toEqual(expectedCorners);
    expect(completeFaces(initial)).toEqual([4, 5]);

    // BV11hpw6uExy, approximately 11.5–15.9 s, inspected at eight frames/s.
    // Source colors U/R/F/B/L/D are yellow/orange/green/blue/red/white.
    // Record color IDs rather than relabeling the site's standard color scheme.
    // Each row is the top face's left corner, center, and right corner.
    const observedTopFaces = [
      [0, 0, 3],
      [2, 1, 3],
      [2, 3, 0],
      [0, 0, 0],
      [0, 1, 3],
      [2, 3, 3],
      [2, 2, 1],
      [0, 1, 1],
      [0, 0, 0],
    ];
    const states = observedTopFaces.map((_, step) =>
      ivyDisplayState([setup, ...moves.slice(0, step).map(move => move.name)].join(' '))
    );
    expect(states.map(state => [state.petals[1][0], state.centers[0], state.petals[0][0]]))
      .toEqual(observedTopFaces);

    expect(topFaceSteps).toBe(3);
    expect(completeFaces(states[topFaceSteps])).toEqual([0, 4, 5]);
    expect(completeFaces(states[topFaceSteps + 1])).toEqual([4, 5]);
    expect(completeFaces(states[8])).toEqual([0, 1, 2, 3, 4, 5]);
  });
});

describe('Ivy video example scrambles', () => {
  // These states retain the original on-screen RLUB scrambles. Their visible
  // center/petal combinations were checked against BV1Pepw6MEP8 at 14–19 s
  // and 281–294 s, independently of constructing an inverse solution.
  const fixtures = [
    {
      id: 'example-1',
      moveCount: 9,
      centers: [2, 3, 4, 5, 0, 1],
      faces: [
        { center: 2, petals: [1, 3] },
        { center: 3, petals: [1, 5] },
        { center: 4, petals: [0, 2] },
        { center: 5, petals: [0, 4] },
        { center: 0, petals: [2, 3] },
        { center: 1, petals: [4, 5] },
      ],
    },
    {
      id: 'example-2',
      moveCount: 8,
      centers: [4, 1, 3, 5, 2, 0],
      faces: [
        { center: 4, petals: [1, 5] },
        { center: 1, petals: [1, 4] },
        { center: 3, petals: [0, 2] },
        { center: 5, petals: [2, 3] },
        { center: 2, petals: [3, 4] },
        { center: 0, petals: [0, 5] },
      ],
    },
  ];

  it.each(fixtures)('$id preserves the video state in standard notation', (fixture) => {
    const example = IVY_3Y_EXAMPLES.find(value => value.id === fixture.id);
    expect(example).toBeDefined();
    const scramble = example!.scramble;
    expect(parseIvyStandardMoves(scramble)).toHaveLength(fixture.moveCount);
    const state = ivyDisplayState(scramble);
    expect(state.centers).toEqual(fixture.centers);
    expect(facePatterns(state)).toEqual(fixture.faces);
    expect(completeFaces(state)).toEqual([]);
  });
});
