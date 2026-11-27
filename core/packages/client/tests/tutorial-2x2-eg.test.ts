import { describe, expect, it } from 'vitest';
import { AllFaces, Face } from '@cuberoot/visualcube';
import { CUBE_ORIENTATIONS, isWcaPocketScramble, orientationForBottomFace, orientedFaceColors, wcaPocketScramble } from '@cuberoot/shared/timer';
import { CUBE_COLOR_LETTER_FOR_FACE, type CubeColorLetter } from '@/lib/cube-colors';
import { TWO_BY_TWO_ORIENTATION, twoByTwoState } from '@/app/[lang]/tutorial/lib/2x2-state';
import { alternateEgRecognition, compareEgCases, getEgRecognition, recognitionExamples, recognitionKey } from '@/app/[lang]/tutorial/2x2-eg/case-comparison';
import {
  EG_CASES, EG_RECOGNITION_CASES, EG_SETS, EG_SHAPES, egBottomRows, egMoves, egTopKey,
} from '@/app/[lang]/tutorial/2x2-eg/lesson-data';
import { egPalette } from '@/app/[lang]/tutorial/2x2-eg/orientation';
import {
  EG_SCRAMBLE_ORIENTATION, EG_WALKTHROUGH, inTeachingColors, loadEgWalkthrough, planEgWalkthrough,
  randomEgWalkthrough,
} from '@/app/[lang]/tutorial/2x2-eg/walkthrough-data';

const topTurns = ['', 'U', 'U2', "U'"];
const bodyTurns = ['', 'y', 'y2', "y'"];
const opposite = new Set(['RO', 'OR', 'BG', 'GB']);
const solved = (moves: string) => {
  const state = twoByTwoState(moves);
  return AllFaces.every(face => new Set(state[face]).size === 1);
};
const isBar = ([a, b]: string) => a === b;
const yellowMask = (setup: string) => AllFaces.flatMap(face =>
  twoByTwoState(setup)[face].map(color => color === 'Y'));

describe('2×2 EG course cases', () => {
  it('keeps the physical scramble colors fixed for every teaching grip', () => {
    expect(orientedFaceColors(EG_SCRAMBLE_ORIENTATION)).toMatchObject({ U: 'U', F: 'F' });
    const standard = twoByTwoState(inTeachingColors(EG_WALKTHROUGH.start, TWO_BY_TWO_ORIENTATION));
    for (const { value, label } of CUBE_ORIENTATIONS) {
      const { sticker } = egPalette(value);
      const normalized = twoByTwoState(inTeachingColors(EG_WALKTHROUGH.start, value));
      expect(AllFaces.map(face => normalized[face].map(color => sticker(color as CubeColorLetter))), label)
        .toEqual(AllFaces.map(face => standard[face]));
    }
  });

  it('uses one rule per shape across all three sets and all matching U turns', () => {
    for (const { id: shape } of EG_SHAPES) {
      const method = getEgRecognition(shape);
      if (!method || method.anchor.kind !== 'yellow') throw new Error(`Missing group rule for ${shape}`);
      const stickers = new Set(method.checks.flatMap(check => check.kind === 'relation' ? [...check.pair] : []));
      expect(stickers.size, shape).toBeLessThanOrEqual(3);
      const owners = new Map<string, string>();
      for (const { id: set } of EG_SETS) {
        const readings = recognitionExamples(method, set);
        const cases = EG_RECOGNITION_CASES.filter(entry => entry.set === set && entry.shape === shape);
        expect(new Set(readings.map(item => item.entry.id))).toEqual(new Set(cases.map(entry => entry.id)));
        for (const entry of cases) {
          const shown = readings.filter(item => item.entry === entry);
          const reference = yellowMask(shown[0].setup).join();
          expect(shown.map(item => item.turn)).toEqual(topTurns.filter(turn =>
            yellowMask(egMoves(entry.setup, turn)).join() === reference));
          for (const item of shown) {
            const key = item.answers.map(recognitionKey).join('/');
            if (!owners.has(key)) owners.set(key, entry.id);
            expect(owners.get(key), `${set}/${entry.id}`).toBe(entry.id);
          }
        }
      }
    }
  });

  it('finds the first separating check in the shared rule for every comparison', () => {
    for (const { id: set } of EG_SETS) for (const { id: shape } of EG_SHAPES) {
      const cases = EG_CASES.filter(entry => entry.set === set && entry.shape === shape);
      for (const [index, first] of cases.entries()) for (const second of cases.slice(index + 1)) {
        const result = compareEgCases(first, second);
        const context = `${set} ${first.id}/${second.id}`;
        if (!result) throw new Error(`Missing comparison for ${context}`);
        const [left, right] = result.readings;
        const overlapping = (length: number) => left.some(a => right.some(b => a.answers.slice(0, length).map(recognitionKey).join('/')
          === b.answers.slice(0, length).map(recognitionKey).join('/')));
        expect(overlapping(result.difference + 1), context).toBe(false);
        expect(overlapping(result.difference), context).toBe(true);
        expect(yellowMask(left[0].setup), context).toEqual(yellowMask(right[0].setup));

        const alternate = alternateEgRecognition(set, shape, [first.id, second.id]);
        if (alternate?.anchor.kind === 'side') {
          const { pair, relation } = alternate.anchor;
          const answers = [];
          for (const entry of [first, second]) {
            const shown = alternate.examples.filter(item => item.entry === entry);
            const eligible = topTurns.filter(turn => {
              const state = twoByTwoState(egMoves(entry.setup, turn));
              const [a, b] = pair.map(index => state[Math.floor(index / 4) as Face][index % 4]);
              return a !== 'Y' && b !== 'Y' && (relation === 'same' ? a === b : opposite.has(a + b));
            });
            expect(eligible.length, context).toBeGreaterThan(0);
            expect(shown.map(item => item.turn), context).toEqual(eligible);
            const variants = new Set(shown.map(item => recognitionKey(item.answers[0])));
            expect(variants.size, context).toBe(1);
            answers.push(...variants);
          }
          expect(new Set(answers).size, context).toBe(2);
        }
      }
    }
  });

  it('derives the back-side opposite-color reference for EG-2 LL and LB', () => {
    const alternate = alternateEgRecognition('eg2', 'l', ['LL', 'LB']);
    expect(alternate?.anchor).toMatchObject({ kind: 'side', face: Face.B, relation: 'opposite' });
    expect(alternate?.examples.map(item => [item.entry.id, item.answers[0]])).toEqual([['LL', [0, 3]], ['LB', [1, 2]]]);
  });
  it('covers 128 distinct cases with the right bottom class and top family', () => {
    for (const [index, set] of EG_SETS.entries()) {
      const items = EG_CASES.filter(item => item.set === set.id);
      expect(items).toHaveLength([42, 43, 43][index]);
      const keys = items.map(item => topTurns.map(turn => egTopKey(egMoves(item.setup, turn))).sort()[0]);
      expect(new Set(keys).size).toBe(items.length);
      for (const item of items) {
        const state = twoByTwoState(item.setup);
        const context = `${set.name} ${item.id}`;
        expect(state[Face.D].join(''), context).toBe('WWWW');
        const bars = egBottomRows(item.setup).map(isBar);
        expect(bars.filter(Boolean).length, context).toBe([4, 1, 0][index]);
        if (set.id === 'eg1') expect(bars[2], context).toBe(true);
        const topCount = state[Face.U].filter(color => color === 'Y').length;
        expect(topCount, context).toBe(EG_SHAPES.find(shape => shape.id === item.shape)?.count);
        expect(solved(egMoves(item.setup, item.alg)), context).toBe(true);
        for (const turn of bodyTurns) {
          const rows = egBottomRows(egMoves(item.setup, turn));
          const [front, right] = rows;
          const read = isBar(front) && isBar(right) ? 'cll' : opposite.has(front) && opposite.has(right) ? 'eg2' : 'eg1';
          expect(read, context).toBe(set.id);
          if (read === 'eg1') {
            const oppositeRow = rows.findIndex(row => opposite.has(row));
            expect(isBar(rows[(oppositeRow + 2) % 4]), context).toBe(true);
          }
        }
      }
    }
  });

  it('matches each handout ID across sets and solves with any equivalent holding from practice', () => {
    const byName = new Map<string, string>();
    for (const { id, set, setup, alg } of EG_CASES) {
      const holdKey = egTopKey(setup);
      const familyKey = topTurns.map(u => egTopKey(egMoves(setup, u))).sort()[0];
      expect(byName.get(id) ?? familyKey, id).toBe(familyKey);
      byName.set(id, familyKey);
      for (const y of bodyTurns) {
        const rotated = egMoves(setup, 'U', y);
        const barAtBack = set !== 'eg1' || isBar(egBottomRows(rotated)[2]);
        if (!barAtBack) continue;
        const held = topTurns.map(u => egMoves(rotated, u)).filter(state => egTopKey(state) === holdKey);
        expect(held.length, id).toBeGreaterThan(0);
        for (const state of held) {
          expect(topTurns.some(auf => solved(egMoves(state, alg, auf))), id).toBe(true);
        }
      }
    }
  });

  it('solves regular WCA scrambles forward from the white-up green-front grip', async () => {
    let state = 0x2e6128;
    const rng = () => (state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 2 ** 32;
    const grip = twoByTwoState(inTeachingColors('', TWO_BY_TWO_ORIENTATION));
    expect(grip[Face.U].join('')).toBe('WWWW');
    expect(grip[Face.F].join('')).toBe('GGGG');
    expect(EG_WALKTHROUGH.start).toBe(wcaPocketScramble(rng));

    function check(scramble: typeof EG_WALKTHROUGH, orientation: string) {
      const route = planEgWalkthrough(scramble, orientation);
      if (!route) throw new Error(`No walkthrough for ${scramble.start} at ${orientation}`);
      const { start, face, hold, regrip, align, entry, finish } = route;
      expect(start).toBe(scramble.start);
      const firstFace = inTeachingColors(egMoves(start, face), orientation);
      const firstState = twoByTwoState(firstFace);
      expect(AllFaces.some(side => firstState[side].every(sticker => sticker === 'W'))).toBe(true);
      const bottom = egMoves(firstFace, hold);
      expect(twoByTwoState(bottom)[Face.D].join('')).toBe('WWWW');
      const physicalBottom = twoByTwoState(inTeachingColors(egMoves(start, face, hold), TWO_BY_TWO_ORIENTATION));
      expect(physicalBottom[Face.D].join('')).toBe(CUBE_COLOR_LETTER_FOR_FACE[orientedFaceColors(orientation).D].repeat(4));
      expect(egBottomRows(bottom).filter(isBar)).toHaveLength({ cll: 4, eg1: 1, eg2: 0 }[entry.set]);
      const held = egMoves(bottom, regrip, align);
      if (entry.set === 'eg1') expect(isBar(egBottomRows(held)[2])).toBe(true);
      else expect(regrip).toBe('');
      expect(egTopKey(held)).toBe(egTopKey(entry.setup));
      expect(solved(egMoves(held, entry.alg, finish))).toBe(true);
      return entry.set;
    }

    expect(isWcaPocketScramble(EG_WALKTHROUGH.start)).toBe(true);
    const seen = new Set([check(EG_WALKTHROUGH, TWO_BY_TWO_ORIENTATION)]);
    const initial = await loadEgWalkthrough(EG_WALKTHROUGH.start);
    for (const { value } of CUBE_ORIENTATIONS) seen.add(check(initial, value));

    const colorGrips = (['U', 'R', 'F', 'D', 'L', 'B'] as const).map(orientationForBottomFace);
    let example = EG_WALKTHROUGH;
    for (let i = 0; i < 16; i++) {
      const next = await randomEgWalkthrough(example.start, rng);
      expect(next.start).not.toBe(example.start);
      expect(isWcaPocketScramble(next.start)).toBe(true);
      for (const grip of colorGrips) seen.add(check(next, grip));
      example = next;
    }
    expect(seen).toEqual(new Set(EG_SETS.map(set => set.id)));
  });
});
