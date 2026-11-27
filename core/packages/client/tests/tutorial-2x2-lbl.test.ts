import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { Face } from '@cuberoot/visualcube';
import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import Cube from '@/app/[lang]/sim/engine/nxn/cube';
import { BOTTOM_OVERVIEW, sampleCubeState, TWO_BY_TWO_ORIENTATION, TWO_BY_TWO_OVERVIEW, TWO_BY_TWO_SAMPLE, TWO_BY_TWO_WALKTHROUGH } from '@/app/[lang]/tutorial/2x2-lbl/lesson-data';
import { randomTwoByTwoWalkthrough } from '@/app/[lang]/tutorial/2x2-lbl/walkthrough-data';
import { isWhiteFirstLayer } from '@/app/[lang]/tutorial/lib/2x2-state';

describe('the 2×2 LBL tutorial', () => {
  const toTeachingFrame = new Alg(TWO_BY_TWO_ORIENTATION).invert().toString();
  const walkthroughState = (alg: string) => sampleCubeState(`${toTeachingFrame} ${alg}`);
  const [bottom, yellow, corners] = TWO_BY_TWO_SAMPLE;
  const [positioning, insertion, third, fourth] = bottom.sections.map(section => section.exercise);
  const twoTouch = yellow.sections.find(section => section.id === 'two-touch')!.exercise;

  it('keeps each full walkthrough step consistent with its demonstrated result', () => {
    const { scramble, phases } = TWO_BY_TWO_WALKTHROUGH;
    const sides = [Face.F, Face.R, Face.B, Face.L];
    const isSolved = (state: ReturnType<typeof sampleCubeState>) =>
      Object.values(state).every(row => row.every(color => color === row[0]));
    const eyes = (state: ReturnType<typeof sampleCubeState>) =>
      sides.filter(side => state[side][0] === state[side][1]);

    let alg = scramble;
    const [whiteCorners, yellowFace, cornerPlacement] = phases.map(phase => phase.steps.map(step => {
      alg += ' ' + step.alg;
      return walkthroughState(alg);
    }));
    expect(walkthroughState('')[Face.U]).toEqual(['W', 'W', 'W', 'W']);
    expect(walkthroughState('')[Face.F]).toEqual(['G', 'G', 'G', 'G']);
    expect(walkthroughState(scramble)).not.toEqual(whiteCorners[0]);
    expect([whiteCorners[0][Face.D][2], whiteCorners[0][Face.B][3], whiteCorners[0][Face.L][2]])
      .toEqual(['W', 'O', 'B']);
    expect(whiteCorners[1][Face.L].slice(2)).toEqual(['B', 'B']);
    expect(whiteCorners[2][Face.F].slice(2)).toEqual(['R', 'R']);
    expect(isWhiteFirstLayer(whiteCorners[3])).toBe(true);
    expect(whiteCorners[3][Face.U].filter(color => color === 'Y')).toHaveLength(2);
    expect(yellowFace[0][Face.U].filter(color => color === 'Y')).toHaveLength(1);
    expect(yellowFace[0][Face.U][3]).toBe('Y');
    expect(yellowFace[0][Face.F][0]).toBe('Y');
    expect(yellowFace[1][Face.U]).toEqual(['Y', 'Y', 'Y', 'Y']);
    expect(yellowFace.every(isWhiteFirstLayer)).toBe(true);
    expect(eyes(yellowFace[1])).toEqual([]);
    expect(eyes(cornerPlacement[0])).toEqual([Face.B]);
    expect(eyes(cornerPlacement[1])).toEqual(sides);
    expect(isSolved(cornerPlacement[1])).toBe(false);
    expect(isSolved(cornerPlacement[2])).toBe(true);
  });

  it('matches the generated teaching steps to the states of successive random scrambles', async () => {
    const model = await puzzles['2x2x2'].kpuzzle();
    const sides = [Face.F, Face.R, Face.B, Face.L];
    const eyes = (state: ReturnType<typeof sampleCubeState>) => sides.filter(side => state[side][0] === state[side][1]);
    let seed = 417;
    const rng = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 2 ** 32;
    };
    const seen = new Set<string>();
    let previous: string = TWO_BY_TWO_WALKTHROUGH.scramble;
    for (let i = 0; i < 192; i++) {
      const { scramble, phases } = await randomTwoByTwoWalkthrough(previous, rng);
      expect(scramble).not.toBe(previous);
      previous = scramble;
      let alg = scramble;

      const bottom = phases[0].steps.map(step => {
        alg += ' ' + step.alg;
        return walkthroughState(alg);
      });
      expect([bottom[0][Face.D][2], bottom[0][Face.B][3], bottom[0][Face.L][2]], scramble).toEqual(['W', 'O', 'B']);
      expect(bottom[1][Face.L].slice(2), scramble).toEqual(['B', 'B']);
      expect(bottom[2][Face.F].slice(2), scramble).toEqual(['R', 'R']);
      expect(isWhiteFirstLayer(bottom[3]), scramble).toBe(true);

      for (const step of phases[1].steps) {
        const initial = walkthroughState(alg)[Face.U].filter(color => color === 'Y').length;
        alg += ' ' + step.alg;
        const state = walkthroughState(alg);
        expect(isWhiteFirstLayer(state), scramble).toBe(true);
        if (step.title.zh.endsWith('变小鱼')) {
          expect(initial).toBe(step.title.zh.startsWith('二碰') ? 2 : 0);
          expect(state[Face.U].filter(color => color === 'Y')).toHaveLength(1);
        } else {
          expect(state[Face.U]).toEqual(['Y', 'Y', 'Y', 'Y']);
          expect(initial).toBe(step.alg ? 1 : 4);
        }
        seen.add(step.title.zh);
      }

      for (const step of phases[2].steps) {
        const before = eyes(walkthroughState(alg)).length;
        alg += ' ' + step.alg;
        const state = walkthroughState(alg);
        expect(isWhiteFirstLayer(state), scramble).toBe(true);
        expect(state[Face.U]).toEqual(['Y', 'Y', 'Y', 'Y']);
        const after = eyes(state).length;
        if (step.title.zh.startsWith('无眼')) expect([before, after]).toEqual([0, 1]);
        else if (step.title.zh.startsWith('把眼')) expect([before, after]).toEqual([1, 4]);
        else expect([before, after]).toEqual([4, 4]);
        seen.add(step.title.zh);
      }
      expect(model.defaultPattern().applyAlg(alg).experimentalIsSolved({
        ignorePuzzleOrientation: true, ignoreCenterOrientation: true,
      }), scramble).toBe(true);
    }
    expect([...seen]).toEqual(expect.arrayContaining([
      '二碰变小鱼', '四不碰变小鱼', '用左鱼翻出黄面', '用右鱼翻出黄面', '顶面已全黄',
      '无眼，先造一对眼', '把眼放右面，再做公式', '对齐顶层', '六面已复原',
    ]));
  });

  it('illustrates the end of each stage with a different cube state', () => {
    const [firstLayer, yellowTop, solved] = TWO_BY_TWO_OVERVIEW.map(step => sampleCubeState(step.setup));
    const sides = [Face.F, Face.R, Face.B, Face.L];
    for (const stage of [firstLayer, yellowTop, solved]) {
      expect(stage[Face.D].join('')).toBe('WWWW');
      expect(sides.every(side => stage[side][2] === stage[side][3])).toBe(true);
    }
    expect(firstLayer[Face.U].join('')).not.toBe('YYYY');
    expect(yellowTop[Face.U].join('')).toBe('YYYY');
    expect(sides.some(side => new Set(yellowTop[side]).size > 1)).toBe(true);
    expect(Object.values(solved).every(face => new Set(face).size === 1)).toBe(true);
  });

  it('treats placement as an absolute whole-cube orientation', () => {
    expect(positioning.isComplete([])).toBe(false);
    expect(positioning.isComplete(['y'])).toBe(false);
    expect(positioning.isComplete(['z'])).toBe(true);
    expect(positioning.isComplete(['z5'])).toBe(true);
    expect(positioning.isComplete(["z4'"])).toBe(false);
    expect(positioning.isComplete(["z'", 'z2'])).toBe(true);
    expect(positioning.isComplete(['y', "x'"])).toBe(false);
    expect(positioning.isComplete(['y', "x'", "y'"])).toBe(true);
  });

  it('teaches headlights first and uses a matching front pair in the concept video', () => {
    const [headlights, noHeadlights] = TWO_BY_TWO_SAMPLE[2].sections;
    expect([headlights.id, noHeadlights.id]).toEqual(['headlights', 'no-headlights']);
    const sides = [Face.F, Face.R, Face.B, Face.L];
    const eyeFaces = (setup: string) => {
      const state = sampleCubeState(setup);
      expect(state[Face.U]).toEqual(['Y', 'Y', 'Y', 'Y']);
      return sides.filter(side => state[side][0] === state[side][1]);
    };
    expect(eyeFaces(headlights.exercise.setup)).toEqual([Face.B]);
    expect(eyeFaces(headlights.exercise.setup + ' y2')).toEqual([Face.F]);
    expect(eyeFaces(noHeadlights.exercise.setup)).toEqual([]);
  });

  it('finishes a headlights solve after placing the pair with U and y in any combination', () => {
    const [headlights] = corners.sections;
    const { alignment, algorithm } = headlights.guided;
    if (!alignment || !algorithm.finishingTurn) throw new Error('Missing the headlights guide');
    expect(alignment.matches([])).toBe(false);
    expect(alignment.matches(['U', 'y'])).toBe(false);
    const alg = algorithm.steps.map(step => step.notation);
    for (const [history, adjustment] of [
      [['y'], undefined], [['U'], "U'"], [["y'", 'U2'], 'U2'], [['y2', "U'"], 'U'],
    ] as const) {
      expect(alignment.matches(history)).toBe(true);
      expect(algorithm.finishingTurn(history)?.notation).toBe(adjustment);
      expect(headlights.exercise.isComplete([...history, ...alg, ...(adjustment ? [adjustment] : [])])).toBe(true);
    }
  });

  it('uses the same puzzle states in the overview and the exercises', () => {
    const [first, ...remainingCorners] = bottom.sections;
    expect(first.interaction?.questions?.map(question => 'targetIndex' in question
      ? { kind: question.kind, targetIndex: question.targetIndex } : { kind: question.kind })).toEqual([
      { kind: 'piece', targetIndex: 0 },
      { kind: 'placement' },
    ]);
    const firstResult = sampleCubeState(`${positioning.setup} ${positioning.solution}`);
    expect(firstResult).toEqual(sampleCubeState(BOTTOM_OVERVIEW[0].setup));
    expect(firstResult).toEqual(sampleCubeState(insertion.setup));

    let alg = insertion.setup;
    expect(bottom.sections.map(section => section.id)).toEqual(['white-orange-blue', 'white-blue-red', 'white-red-green', 'white-green-orange']);
    remainingCorners.forEach((section, index) => {
      expect(sampleCubeState(alg)).toEqual(sampleCubeState(section.exercise.setup));
      const moves = section.exercise.solution.split(' ');
      expect(section.exercise.isComplete([])).toBe(false);
      expect(section.exercise.isComplete(moves)).toBe(true);
      alg += ' ' + moves.join(' ');
      expect(sampleCubeState(alg)).toEqual(sampleCubeState(BOTTOM_OVERVIEW[index + 1].setup));
    });
    const solvedLayer = sampleCubeState(alg);
    expect(solvedLayer[Face.D].join('')).toBe('WWWW');
    for (const face of [Face.L, Face.F, Face.R, Face.B]) expect(solvedLayer[face][2]).toBe(solvedLayer[face][3]);
    expect(solvedLayer[Face.U].join('')).not.toBe('YYYY');
  });

  it('accepts either front-left spot for the white–blue–red corner while protecting the first corner', () => {
    const exploration = bottom.sections[1].interaction?.turnExploration;
    if (!exploration) throw new Error('Missing the turn exploration and alignment quizzes');
    const { alignment } = exploration;
    expect(exploration.freeFaces.map(({ face }) => face).sort()).toEqual(['F', 'R', 'U']);
    expect(alignment.stickers.slice().sort()).toEqual(['D0', 'F2', 'L3']);
    const cube = new Cube(2);
    try {
      const placements = [];
      for (const move of ['', 'U', "U'", 'U F', 'U F2', "U F'", "F R U R' F'"]) {
        cube.twister.setup(`${insertion.setup} ${move}`);
        expect(cube.getStickerPlacement(0, FACE.D)).toEqual({ positionIndex: 0, face: FACE.D });
        const target = cube.getStickerPlacement(alignment.homeIndex, FACE[alignment.homeFace])!;
        expect(alignment.goalPositions.some(index => index === target.positionIndex)).toBe([4, 6].includes(target.positionIndex));
        placements.push(target.positionIndex);
      }
      expect(placements[0]).not.toBe(6);
      expect(placements[1]).toBe(6);
      expect(placements).toContain(4);
    } finally {
      cube.dispose();
    }
  });

  it('moves an already aligned corner away from the target without disturbing solved corners', () => {
    const cube = new Cube(2);
    try {
      for (const section of [bottom.sections[1], bottom.sections[2], bottom.sections[3]]) {
        const { alignment, insertion } = section.interaction!.turnExploration!;
        const solved = `${section.exercise.setup} ${section.exercise.solution}`;
        const trigger = insertion.steps.map(step => step.notation).join(' ');
        const protectedStickers = insertion.solvedStickers.filter(sticker => sticker.homeIndex !== alignment.homeIndex);
        for (const setup of [solved, `${solved} (${trigger})'`]) {
          cube.twister.setup(setup);
          const initial = cube.getStickerPlacement(alignment.homeIndex, FACE.D)!;
          const casesByPosition: Readonly<Partial<Record<number, readonly string[]>>> = alignment.casesWhenAligned;
          const cases = casesByPosition[initial.positionIndex];
          if (!cases) continue;
          for (const moves of cases) {
            cube.twister.setup(`${setup} ${moves}`);
            const current = cube.getStickerPlacement(alignment.homeIndex, FACE.D)!;
            expect(alignment.goalPositions.some(position => position === current.positionIndex), section.id).toBe(false);
            for (const { homeIndex, homeFace, placement } of protectedStickers) {
              expect(cube.getStickerPlacement(homeIndex, FACE[homeFace]), section.id)
                .toEqual({ positionIndex: placement.positionIndex, face: FACE[placement.face] });
            }
          }
        }
      }
    } finally {
      cube.dispose();
    }
  });

  it('covers all five trigger practice cases and solves each in the expected number of rounds', () => {
    const cube = new Cube(2);
    try {
      for (const section of [bottom.sections[1], bottom.sections[2], bottom.sections[3]]) {
        const { alignment, insertion } = section.interaction!.turnExploration!;
        const solved = `${section.exercise.setup} ${section.exercise.solution}`;
        const trigger = insertion.steps.map(step => step.notation).join(' ');
        const placements: string[] = [];
        expect(insertion.practiceCases).toHaveLength(5);
        insertion.practiceCases!.forEach((setupMoves, index) => {
          cube.twister.setup(`${solved} ${setupMoves}`);
          const target = cube.getStickerPlacement(alignment.homeIndex, FACE.D)!;
          placements.push(`${target.positionIndex}:${FACE[target.face]}`);
          for (const { homeIndex, homeFace, placement } of insertion.solvedStickers) {
            if (homeIndex === alignment.homeIndex) continue;
            expect(cube.getStickerPlacement(homeIndex, FACE[homeFace]), section.id)
              .toEqual({ positionIndex: placement.positionIndex, face: FACE[placement.face] });
          }
          expect(section.exercise.isComplete([section.exercise.solution, setupMoves]), section.id).toBe(false);
          expect(section.exercise.isComplete([section.exercise.solution, setupMoves, ...Array(index + 1).fill(trigger)]), section.id).toBe(true);
        });
        expect(placements.sort()).toEqual(section.id === 'white-blue-red'
          ? ['4:F', '4:L', '6:F', '6:L', '6:U']
          : ['5:F', '5:R', '7:F', '7:R', '7:U']);
      }
    } finally {
      cube.dispose();
    }
  });

  it('reports the target corner’s current slot and white sticker direction after a rotation', () => {
    const interaction = bottom.sections[0].interaction!;
    const placement = interaction.questions?.find(question => question.kind === 'placement');
    if (!placement) throw new Error('Missing the corner placement question');
    const cube = new Cube(2);
    try {
      for (const [moves, positionIndex, face, prompt] of [
        ['y', 5, FACE.F, '底层右前，白格朝前'],
        ["y x'", 1, FACE.D, '底层右后，白格朝下'],
        ["y x' y'", 0, FACE.D, '底层左后，白格朝下'],
      ] as const) {
        cube.twister.setup(`${positioning.setup} ${moves}`);
        const actual = cube.getStickerPlacement(placement.homeIndex, FACE[placement.homeFace]);
        expect(actual).toEqual({ positionIndex, face });
        expect(placement.describe({ positionIndex: actual!.positionIndex, face: FACE[actual!.face] }).zh).toContain(prompt);
      }
    } finally {
      cube.dispose();
    }
    const dimmed = interaction.dimStickersAfterFirstQuestion;
    expect(new Set(dimmed).size).toBe(21);
    for (const sticker of ['D2', 'B3', 'L2']) expect(dimmed).not.toContain(sticker);
  });

  it('can finish quiz 3 by repeating the left trigger from every accepted placement', () => {
    const exploration = bottom.sections[1].interaction?.turnExploration;
    if (!exploration) throw new Error('Missing the turn exploration quizzes');
    const { alignment } = exploration;
    const trigger = exploration.insertion.steps.map(({ notation }) => notation);
    expect(trigger).toEqual(["L'", "U'", 'L', 'U']);
    const turns = exploration.freeFaces.flatMap(({ face }) => [face, `${face}'`]);
    const candidates: string[][] = [[]];
    const seen = new Set<string>();
    const goalPlacements = new Set<string>();
    const cube = new Cube(2);
    try {
      for (const moves of candidates) {
        cube.twister.setup([insertion.setup, ...moves].join(' '));
        const { positionIndex, face } = cube.getStickerPlacement(alignment.homeIndex, FACE[alignment.homeFace])!;
        const key = `${positionIndex}:${face}`;
        if (seen.has(key)) continue;
        seen.add(key);
        candidates.push(...turns.map(turn => [...moves, turn]));
        if (!alignment.goalPositions.some(index => index === positionIndex)) continue;
        goalPlacements.add(key);
        const rounds = Array.from({ length: 6 }, (_, index) => Array.from({ length: index + 1 }, () => trigger).flat());
        expect(rounds.some(round => insertion.isComplete([...moves, ...round])), key).toBe(true);
      }
      expect(goalPlacements.size).toBe(6);
    } finally {
      cube.dispose();
    }
  });

  it('checks the final two corners against the simulator’s actual sticker orientation', () => {
    const thirdQuiz = bottom.sections[2].interaction.turnExploration;
    const fourthQuiz = bottom.sections[3].interaction.turnExploration;
    const cube = new Cube(2);
    const fits = (goals: typeof thirdQuiz.insertion.solvedStickers) =>
      goals.every(({ homeIndex, homeFace, placement }) => {
        const actual = cube.getStickerPlacement(homeIndex, FACE[homeFace]);
        return actual?.positionIndex === placement.positionIndex && actual.face === FACE[placement.face];
      });
    try {
      cube.twister.setup(third.setup);
      expect(fits(thirdQuiz.insertion.solvedStickers)).toBe(false);
      cube.twister.setup(`${third.setup} ${third.solution}`);
      expect(fits(thirdQuiz.insertion.solvedStickers)).toBe(true);
      // Keep this corner in its slot but twist it, following the same right-hand trigger.
      cube.twister.setup(`${third.setup} ${third.solution} R U R' U' R U R' U'`);
      expect(cube.getStickerPlacement(5, FACE.D)?.positionIndex).toBe(5);
      expect(fits(thirdQuiz.insertion.solvedStickers)).toBe(false);

      cube.twister.setup(`${fourth.setup} y'`);
      expect(fits(fourthQuiz.opening.solvedStickers)).toBe(false);
      cube.twister.setup(`${fourth.setup} y`);
      expect(fits(fourthQuiz.opening.solvedStickers)).toBe(true);
      cube.twister.setup(`${fourth.setup} y U`);
      expect(cube.getStickerPlacement(1, FACE.D)?.positionIndex).toBe(7);
      expect(fits(fourthQuiz.insertion.solvedStickers)).toBe(false);
      cube.twister.setup(`${fourth.setup} ${fourth.solution}`);
      expect(fits(fourthQuiz.insertion.solvedStickers)).toBe(true);
    } finally {
      cube.dispose();
    }
  });

  it('evaluates insertion goals after top turns and whole-cube rotations', () => {
    expect(insertion.isComplete([])).toBe(false);
    expect(insertion.isComplete(['U'])).toBe(false);
    expect(insertion.isComplete(insertion.solution.split(' '))).toBe(true);
    expect(insertion.isComplete([...insertion.solution.split(' '), 'U'])).toBe(true);
    expect(insertion.isComplete([...insertion.solution.split(' '), 'x'])).toBe(false);
    expect(third.isComplete(third.solution.split(' ').slice(0, -2))).toBe(false);
    expect(third.isComplete([...third.solution.split(' '), 'z'])).toBe(true);
    expect(fourth.isComplete(['y', 'U'])).toBe(false);
    expect(fourth.isComplete([...fourth.solution.split(' '), 'x'])).toBe(true);
  });

  it('aligns the yellow sticker at front-left and stops at fish', () => {
    const countYellow = (alg: string) => sampleCubeState(alg)[Face.U].filter(color => color === 'Y').length;
    expect(countYellow(twoTouch.setup)).toBe(2);
    expect(sampleCubeState(twoTouch.setup)[Face.F][0]).not.toBe('Y');
    expect(sampleCubeState(twoTouch.setup + " U'")[Face.F][0]).toBe('Y');
    expect(twoTouch.isComplete([])).toBe(false);
    expect(twoTouch.isComplete(twoTouch.solution.split(' '))).toBe(true);
    expect(countYellow(twoTouch.setup + ' ' + twoTouch.solution)).toBe(1);
    expect(twoTouch.isComplete([...twoTouch.solution.split(' '), 'z'])).toBe(true);
    expect(twoTouch.isComplete(["(" + twoTouch.setup + ")'"])).toBe(false);
  });

  it('reaches the correct goal from every accepted yellow-face alignment', () => {
    const topTurns = [[], ['U'], ['U2'], ["U'"]];
    expect(yellow.sections.map(section => section.id)).toEqual(['right-fish', 'left-fish', 'two-touch', 'four-no-touch']);
    for (const section of yellow.sections) {
      const { exercise, guided } = section;
      const alignment = guided.alignment!;
      const formula = guided.algorithm.steps.map(({ notation }) => notation);
      expect(alignment.matches([]), section.id).toBe(false);
      expect(exercise.isComplete([]), section.id).toBe(false);
      const starts = topTurns.filter(turns => alignment.matches(turns));
      expect(starts.length, section.id).toBeGreaterThan(0);
      for (const turns of starts) {
        const history = [...turns, ...formula];
        const state = sampleCubeState([exercise.setup, ...history].join(' '));
        const toFish = section.id === 'two-touch' || section.id === 'four-no-touch';
        expect(state[Face.U].filter(color => color === 'Y'), section.id).toHaveLength(toFish ? 1 : 4);
        expect(exercise.isComplete(history), section.id).toBe(true);
        expect(exercise.isComplete([...history, 'z']), section.id).toBe(true);
      }
    }
  });

  it('creates one pair of eyes before placing that pair on the right and solving', () => {
    const [eyes, noEyes] = corners.sections;
    const align = eyes.guided.alignment!;
    const noEyesResult = sampleCubeState(`${noEyes.exercise.setup} ${noEyes.exercise.solution}`);
    expect(noEyes.exercise.isComplete([])).toBe(false);
    expect(noEyes.exercise.isComplete(noEyes.exercise.solution.split(' '))).toBe(true);
    expect(noEyesResult).toEqual(sampleCubeState(eyes.exercise.setup));
    expect(align.matches([])).toBe(false);
    expect(align.matches(["y'"])).toBe(false);
    expect(align.matches(['y'])).toBe(true);
    expect(eyes.exercise.isComplete(['y'])).toBe(false);
    expect(eyes.exercise.isComplete(eyes.exercise.solution.split(' '))).toBe(true);
    expect(eyes.exercise.isComplete([...eyes.exercise.solution.split(' '), 'x'])).toBe(true);
  });
});
