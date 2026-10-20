import { describe, expect, it } from 'vitest';
import { Alg } from 'cubing/alg';
import { LBL_STEPS, LESSON_STICKERING } from '@/app/[lang]/tutorial/lbl/content';
import { practiceState } from '@/app/[lang]/tutorial/lbl/practice-state';
import { resolvePlayerSetup } from '@/components/AlgPlayer/player-setup';
import { pickStickering } from '@/components/AlgPlayer/stickering';
import { stageStickerColors } from '@/lib/sim-stage-thumbnail';
import { orientedCubeFaceColors } from '@/lib/cube-orientation';
import { stickeringMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';
import { resolveStageMaskFn } from '@cuberoot/puzzle-render-core/engine/nxn/vcStageMask';

describe('LBL corner-position alignment', () => {
  const examples = LBL_STEPS.find(step => step.id === 'corner-position')!.examples;
  const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
  const sides = [1, 2, 4, 5];
  const aligned = (faces: string[][]) => sides.every(side => [0, 2].every(i => faces[side][i] === faces[side][4]));
  const eyes = (faces: string[][]) => sides.filter(side => faces[side][0] === faces[side][2]);

  for (const [index, example] of examples.entries()) {
    it(index === 0 ? 'positions the headlights before the algorithm and finishes with a necessary top turn' : 'stops after creating headlights from a no-headlights state', () => {
      const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
      const moves = new Alg(example.alg).expand().toString().split(/\s+/);
      const at = (n: number): string[][] => JSON.parse(practiceState(colors, `${setup} ${moves.slice(0, n).join(' ')}`));
      expect(eyes(at(0))).toEqual(index === 0 ? [2] : []);
      expect(moves.length).toBe(index === 0 ? 15 : 13);
      if (index === 0) {
        expect(moves[0]).toBe('y');
        expect(eyes(at(1))).toEqual([4]);
        // The algorithm alone leaves all corners shifted relative to their centers.
        expect(aligned(at(14))).toBe(false);
        expect(aligned(at(15))).toBe(true);
      } else {
        expect(eyes(at(13))).toEqual([2]);
        expect(aligned(at(13))).toBe(false);
      }
      for (const n of index === 0 ? [0, 1, 14, 15] : [0, 13]) {
        const faces = at(n);
        expect(faces[0].every(color => color === 'U')).toBe(true);
        expect(sides.every(side => faces[side].slice(3).every(color => color === faces[side][4]))).toBe(true);
      }
    });
  }
});

describe('LBL yellow-face positioning', () => {
  const examples = LBL_STEPS.find(step => step.id === 'yellow-face')!.examples;
  const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
  const topCorners = [0, 2, 6, 8];
  const grayCorners = (faces: string[][]) => topCorners.filter(i => faces[0][i] !== faces[0][4]);

  for (const [index, example] of examples.entries()) {
    it(`${example.title.en} starts unpositioned and adjusts before one Sune`, () => {
      const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
      const moves = new Alg(example.alg).expand().toString().split(/\s+/);
      const at = (n: number): string[][] => JSON.parse(practiceState(colors, `${setup} ${moves.slice(0, n).join(' ')}`));
      expect(moves.length).toBe(8);
      expect(moves[0]).toBe(index % 2 === 0 ? 'U' : "U'");
      expect(grayCorners(at(0)).length).toBe([3, 3, 2, 4][index]);
      expect(grayCorners(at(1)).length).toBe([3, 3, 2, 4][index]);
      if (index < 2) {
        const head = index === 0 ? 6 : 8;
        expect(at(0)[0][head]).not.toBe('U');
        expect(at(1)[0][head]).toBe('U');
      } else {
        const touchesYellow = (faces: string[][]) => faces[2][0] === faces[0][4];
        expect(touchesYellow(at(0))).toBe(index === 3);
        expect(touchesYellow(at(1))).toBe(index === 2);
      }
      expect(grayCorners(at(8)).length).toBe(index < 2 ? 0 : 3);
      for (const n of [0, 1, 8]) {
        const faces = at(n);
        expect([1, 3, 5, 7].every(i => faces[0][i] === faces[0][4])).toBe(true);
        expect(faces[3].every(color => color === faces[3][4])).toBe(true);
        expect([1, 2, 4, 5].every(side => faces[side].slice(3).every(color => color === faces[side][4]))).toBe(true);
      }
    });
  }
});

describe('LBL edge-position preparation', () => {
  const examples = LBL_STEPS.find(step => step.id === 'edge-position')!.examples;
  const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
  const sides = [1, 2, 4, 5];
  const walls = (faces: string[][]) => sides.filter(side => [0, 1, 2].every(i => faces[side][i] === faces[side][0]));
  const cornersAligned = (faces: string[][]) => sides.every(side => [0, 2].every(i => faces[side][i] === faces[side][4]));
  const solved = (faces: string[][]) => faces.every(face => face.every(color => color === face[4]));

  for (const [index, example] of examples.entries()) {
    it(index === 2 ? 'creates one wall and stops before solving the remaining edges' : `${example.title.en} puts the wall at the back before solving`, () => {
      const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
      const moves = new Alg(example.alg).expand().toString().split(/\s+/);
      const at = (n: number): string[][] => JSON.parse(practiceState(colors, `${setup} ${moves.slice(0, n).join(' ')}`));
      expect(moves.length).toBe(index === 2 ? 16 : 17);
      expect(walls(at(0))).toEqual(index === 2 ? [] : [1]);
      if (index === 2) {
        expect(walls(at(16))).toEqual([1]);
        expect(solved(at(16))).toBe(false);
        const continued: string[][] = JSON.parse(practiceState(colors, `${setup} ${example.alg} ${examples[0].alg}`));
        expect(solved(continued)).toBe(true);
      } else {
        expect(moves[0]).toBe("y'");
        expect(walls(at(1))).toEqual([5]);
        expect(cornersAligned(at(1))).toBe(true);
        expect(cornersAligned(at(16))).toBe(false);
        expect(solved(at(17))).toBe(true);
      }
      for (const n of index === 2 ? [0, 16] : [0, 1, 17]) {
        const faces = at(n);
        expect(cornersAligned(faces)).toBe(true);
        expect(faces[0].every(color => color === faces[0][4])).toBe(true);
        expect(faces[3].every(color => color === faces[3][4])).toBe(true);
        expect(sides.every(side => faces[side].slice(3).every(color => color === faces[side][4]))).toBe(true);
      }
    });
  }
});

it('shows a necessary top adjustment before the line and L-shape algorithms', () => {
  const examples = LBL_STEPS.find(step => step.id === 'yellow-cross')!.examples;
  const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
  for (const [index, expected] of [[0, [3, 5]], [1, [5, 7]]] as const) {
    const example = examples[index];
    const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
    const moves = new Alg(example.alg).expand().toString().split(/\s+/);
    const at = (n: number): string[][] => JSON.parse(practiceState(colors, `${setup} ${moves.slice(0, n).join(' ')}`));
    const yellowEdges = (faces: string[][]) => [1, 3, 5, 7].filter(i => faces[0][i] === 'U');
    expect(moves.length).toBe(7);
    expect(moves[0]).toBe('U');
    expect(yellowEdges(at(0))).not.toEqual(expected);
    expect(yellowEdges(at(1))).toEqual(expected);
    expect(yellowEdges(at(7))).toEqual([1, 3, 5, 7]);
    for (const n of [0, 1, 7]) {
      const faces = at(n);
      expect(faces[3].every(color => color === 'D')).toBe(true);
      expect([1, 2, 4, 5].every(side => faces[side].slice(3).every(color => color === faces[side][4]))).toBe(true);
    }
  }
});

it('stops every dot orientation at a vertical line that can continue with the line example', () => {
  const examples = LBL_STEPS.find(step => step.id === 'yellow-cross')!.examples;
  const example = examples[2];
  const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
  const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
  const moves = new Alg(example.alg).expand().toString().split(/\s+/);
  const yellowEdges = (faces: string[][]) => [1, 3, 5, 7].filter(i => faces[0][i] === 'U');
  expect(moves.length).toBe(6);
  for (const adjustment of ['', 'U', 'U2', "U'"]) {
    const at = (n: number): string[][] => JSON.parse(practiceState(colors, `${setup} ${adjustment} ${moves.slice(0, n).join(' ')}`));
    expect(yellowEdges(at(0))).toEqual([]);
    expect(yellowEdges(at(6))).toEqual([1, 7]);
    const continued: string[][] = JSON.parse(practiceState(colors, `${setup} ${adjustment} ${example.alg} ${examples[0].alg}`));
    expect(yellowEdges(continued)).toEqual([1, 3, 5, 7]);
    for (const n of [0, 6]) {
      const faces = at(n);
      expect(faces[3].every(color => color === 'D')).toBe(true);
      expect([1, 2, 4, 5].every(side => faces[side].slice(3).every(color => color === faces[side][4]))).toBe(true);
    }
  }
});

it('teaches color matching before inserting each of the four daisy petals', () => {
  const example = LBL_STEPS.find(step => step.id === 'cross')!.examples[0];
  const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
  const faces = (alg: string): string[][] => JSON.parse(practiceState(colors, alg));
  expect(example.alg).toBe("d y' R2 d y' R2 d2 y' R2 d y' R2");
  const moves = example.alg.split(' ');
  expect(moves.length).toBe(12);
  let sequence = example.setup!;
  expect([1, 3, 5, 7].filter(i => faces(sequence)[0][i] === 'D').length).toBe(4);
  for (let petal = 0; petal < 4; petal++) {
    const before = faces(sequence);
    expect(before[0][7]).toBe('D');
    expect(before[2][1]).not.toBe(before[2][4]);
    expect(moves[petal * 3]).toMatch(/^d(?:2|')?$/);
    sequence += ` ${moves[petal * 3]}`;
    const aligned = faces(sequence);
    expect(aligned[0]).toEqual(before[0]);
    expect(aligned[2][1]).toBe(before[2][1]);
    expect(aligned[2][1]).toBe(aligned[2][4]);
    expect(moves.slice(petal * 3 + 1, petal * 3 + 3)).toEqual(["y'", 'R2']);
    sequence += " y'";
    const right = faces(sequence);
    expect(right[0][5]).toBe('D');
    expect(right[1][1]).toBe(right[1][4]);
    sequence += ' R2';
    const inserted = faces(sequence);
    expect(inserted[3][5]).toBe('D');
    expect(inserted[1][7]).toBe(inserted[1][4]);
    expect([1, 3, 5, 7].filter(i => inserted[0][i] === 'D').length).toBe(3 - petal);
    expect([1, 3, 5, 7].filter(i => inserted[3][i] === 'D').length).toBe(petal + 1);
    for (const [side, bottom] of [[1, 5], [2, 1], [4, 3], [5, 7]]) {
      if (inserted[3][bottom] === 'D') expect(inserted[side][7]).toBe(inserted[side][4]);
    }
  }
});

describe('LBL side-facing corner preparation', () => {
  const step = LBL_STEPS.find(s => s.id === 'corners')!;
  const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
  const faces = (alg: string): string[][] => JSON.parse(practiceState(colors, alg));
  for (const [index, prefix, frontIndex, side, sideIndex] of [
    [0, "U' d", 2, 1, 0], [2, 'U d', 0, 4, 2],
  ] as const) {
    it(`${step.examples[index].title.en} shows positioning before inserting the corner`, () => {
      const example = step.examples[index];
      const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
      const initial = faces(setup);
      const ready = faces(`${setup} ${prefix}`);
      expect(initial[side][sideIndex]).not.toBe('D');
      expect(ready[side][sideIndex]).toBe('D');
      expect(ready[2][frontIndex]).toBe(ready[2][4]);
      const beforeMatching = faces(`${setup} ${prefix.split(' ')[0]}`);
      expect(beforeMatching[2][frontIndex]).not.toBe(beforeMatching[2][4]);
      expect(ready[0]).toEqual(beforeMatching[0]);
      expect(ready[2][frontIndex]).toBe(beforeMatching[2][frontIndex]);
      for (const state of [initial, beforeMatching, ready]) {
        for (const i of [1, 3, 5, 7]) expect(state[3][i]).toBe('D');
        for (const f of [1, 2, 4, 5]) expect(state[f][7]).toBe(state[f][4]);
      }
      expect(practiceState(colors, `${setup} ${example.alg}`)).toBe(practiceState(colors, ''));
    });
  }
});

describe('LBL remaining corner preparation', () => {
  const examples = LBL_STEPS.find(step => step.id === 'corners')!.examples;
  const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
  const sides = [1, 2, 4, 5];
  const whiteCrossSolved = (faces: string[][]) => [1, 3, 5, 7].every(i => faces[3][i] === 'D')
    && sides.every(side => faces[side][7] === faces[side][4]);

  it('moves the misplaced bottom corner from the left to the right and stops after ejecting it', () => {
    const example = examples[1];
    const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
    const moves = new Alg(example.alg).expand().toString().split(/\s+/);
    const at = (n: number): string[][] => JSON.parse(practiceState(colors, `${setup} ${moves.slice(0, n).join(' ')}`));
    expect(moves.length).toBe(5);
    expect(moves[0]).toBe("y'");
    expect(at(0)[2][6]).toBe('D');
    expect(at(0)[2][8]).toBe(at(0)[2][4]);
    expect(at(1)[1][6]).toBe('D');
    expect(at(5)[1][0]).toBe('D');
    expect(at(5)[3].every(color => color === 'D')).toBe(false);
    for (const n of [0, 1, 5]) expect(whiteCrossSolved(at(n))).toBe(true);
  });

  it('positions a white-up corner and cross-matches both side colors before the three triggers', () => {
    const example = examples[3];
    const setup = resolvePlayerSetup('3x3', example.alg, example.setup, false);
    const moves = new Alg(example.alg).expand().toString().split(/\s+/);
    const at = (n: number): string[][] => JSON.parse(practiceState(colors, `${setup} ${moves.slice(0, n).join(' ')}`));
    expect(moves.length).toBe(14);
    expect(moves.slice(0, 2)).toEqual(['U', 'd']);
    expect(at(0)[0][8]).not.toBe('D');
    expect(at(1)[0][8]).toBe('D');
    expect(at(1)[2][2]).not.toBe(at(1)[1][4]);
    expect(at(1)[1][0]).not.toBe(at(1)[2][4]);
    expect(at(2)[2][2]).toBe(at(2)[1][4]);
    expect(at(2)[1][0]).toBe(at(2)[2][4]);
    expect(at(2)[0]).toEqual(at(1)[0]);
    for (const n of [0, 1, 2, 14]) expect(whiteCrossSolved(at(n))).toBe(true);
    expect(practiceState(colors, `${setup} ${example.alg}`)).toBe(practiceState(colors, ''));
  });
});

describe('LBL daisy positioning', () => {
  const examples = LBL_STEPS.find(step => step.id === 'daisy')!.examples;
  const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
  it('positions the downward white edge in the right layer before the half turn', () => {
    const example = examples[5];
    const original = 'F2 R2 B2 L2 R2';
    const before: string[][] = JSON.parse(practiceState(colors, example.setup!));
    const ready: string[][] = JSON.parse(practiceState(colors, `${example.setup} y'`));
    expect(before[3][5]).not.toBe('D');
    expect(ready[3][5]).toBe('D');
    expect(ready[0][4]).toBe('U');
    expect(practiceState(colors, `${example.setup} y'`)).toBe(practiceState(colors, original));
    expect(practiceState(colors, `${example.setup} ${example.alg}`)).toBe(practiceState(colors, `${original} R2`));
  });
  for (const index of [0, 2]) {
    it(`rotates the white sticker to the front before lifting (${index})`, () => {
      const example = examples[index];
      const [rotation, lift] = example.alg.split(' ');
      const original = index === 0 ? "F2 R2 B2 L2 R'" : 'F2 R2 B2 L2 L';
      const before: string[][] = JSON.parse(practiceState(colors, example.setup!));
      const ready: string[][] = JSON.parse(practiceState(colors, `${example.setup} ${rotation}`));
      const frontIndex = index === 0 ? 5 : 3;
      expect(before[2][frontIndex]).not.toBe('D');
      expect(ready[2][frontIndex]).toBe('D');
      const ids = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(face => Array.from({ length: 9 }, (_, i) => `${face}${i}`));
      const positionedIds = JSON.parse(practiceState(ids, `${example.setup} ${rotation}`));
      expect(positionedIds[2][frontIndex]).toBe(index === 0 ? 'D5' : 'D3');
      expect(ready[0][4]).toBe('U');
      expect(practiceState(colors, `${example.setup} ${rotation}`)).toBe(practiceState(colors, original));
      expect(practiceState(colors, `${example.setup} ${example.alg}`)).toBe(practiceState(colors, `${original} ${lift}`));
    });
  }
});

describe('LBL practice target matching', () => {
  for (const step of LBL_STEPS.filter(s => s.id !== 'structure')) {
    const name = pickStickering('3x3', LESSON_STICKERING[step.id], 'sim')!;
    const colors = stageStickerColors(3, stickeringMaskFn(3, name) ?? resolveStageMaskFn(3, name), orientedCubeFaceColors('z2'));
    for (const example of step.examples) {
      it(`${step.id}: ${example.title.en} rejects the start and accepts equivalent moves`, () => {
        const setup = resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false);
        const target = practiceState(colors, `${setup} ${example.alg}`);
        expect(practiceState(colors, setup)).not.toBe(target);
        expect(practiceState(colors, `${setup} R R' ${example.alg} U U U U`)).toBe(target);
      });
    }
  }
  it('checks hidden camera faces too', () => {
    const colors = Array.from({ length: 54 }, (_, i) => String(i));
    expect(practiceState(colors, 'B')).not.toBe(practiceState(colors, ''));
  });
});

// Check real, unmasked stickers: the middle lesson must start with a solved first layer.
describe('LBL middle-layer prerequisites', () => {
  const step = LBL_STEPS.find(s => s.id === 'middle')!;
  const colors = ['U', 'R', 'F', 'D', 'L', 'B'].flatMap(color => Array<string>(9).fill(color));
  const faces = (alg: string): string[][] => JSON.parse(practiceState(colors, alg));
  const sides = [1, 2, 4, 5];
  function firstLayerSolved(f: string[][]) {
    return f[3].every(color => color === 'D') && sides.every(side => [6, 7, 8].every(i => f[side][i] === f[side][4]));
  }
  for (const [index, example] of step.examples.entries()) {
    it(example.title.en + ' preserves the complete white first layer', () => {
      const setup = resolvePlayerSetup('3x3', example.alg, example.setup, example.startSolved ?? false);
      const before = faces(setup);
      const after = faces(setup + ' ' + example.alg);
      expect(firstLayerSolved(before)).toBe(true);
      expect(firstLayerSolved(after)).toBe(true);
      if (index !== 2) {
        const moves = new Alg(example.alg).expand().toString().split(/\s+/);
        expect(moves.slice(0, 2)).toEqual(index === 0 ? ['U', 'd'] : ["U'", "d'"]);
        const front = faces(`${setup} ${moves[0]}`);
        const ready = faces(`${setup} ${moves.slice(0, 2).join(' ')}`);
        // Track the same non-yellow edge: it must move to UF, then need color matching.
        const target = [ready[0][7], ready[2][1]].sort().join('');
        expect([[before[0][1], before[5][1]], [before[0][3], before[4][1]], [before[0][5], before[1][1]]]
          .some(pair => pair.sort().join('') === target)).toBe(true);
        expect(front[2][1]).not.toBe(front[2][4]);
        expect(ready[0]).toEqual(front[0]);
        expect(ready[2][1]).toBe(front[2][1]);
        expect(ready[2][1]).toBe(ready[2][4]);
        expect(ready[0][7]).toBe(ready[index === 0 ? 1 : 4][4]);
        expect(firstLayerSolved(front)).toBe(true);
        expect(firstLayerSolved(ready)).toBe(true);
        expect(sides.every(side => [3, 5, 6, 7, 8].every(i => after[side][i] === after[side][4]))).toBe(true);
      } else {
        // Rotate the misplaced edge to FR before ejecting it.
        expect(example.alg.split(' ')[0]).toBe("y'");
        const positioned = faces(`${setup} y'`);
        expect(firstLayerSolved(positioned)).toBe(true);
        expect(before).not.toEqual(positioned);
        expect(positioned[2][5]).toBe(positioned[1][4]);
        expect(positioned[1][3]).toBe(positioned[2][4]);
        const edge = [positioned[2][5], positioned[1][3]].sort().join('');
        const topEdges = [[after[0][7], after[2][1]], [after[0][5], after[1][1]], [after[0][1], after[5][1]], [after[0][3], after[4][1]]];
        expect(topEdges.some(pair => pair.sort().join('') === edge)).toBe(true);
      }
    });
  }
});
