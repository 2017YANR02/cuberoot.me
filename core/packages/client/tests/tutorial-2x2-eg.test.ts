import { describe, expect, it } from 'vitest';
import { AllFaces, Face } from '@cuberoot/visualcube';
import { twoByTwoState } from '@/app/[lang]/tutorial/lib/2x2-state';
import { alternateEgRecognition, compareEgCases, getEgRecognition, recognitionExamples, recognitionKey } from '@/app/[lang]/tutorial/2x2-eg/case-comparison';
import {
  EG_CASES, EG_RECOGNITION_CASES, EG_SETS, EG_SHAPES, EG_WALKTHROUGH, egBottomRows, egMoves, egTopKey, randomEgWalkthrough,
} from '@/app/[lang]/tutorial/2x2-eg/lesson-data';

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

  it('constructs new teaching cases with accurate opening, grip and finish checkpoints', () => {
    const previous = EG_WALKTHROUGH.entry;
    const pool = EG_CASES.filter(entry => entry !== previous);
    const openingCounts = new Set<number>();
    const hasFinish = new Set<boolean>();
    for (const [index, candidate] of pool.entries()) {
      let draw = 0;
      const { start, face, regrip, align, finish, entry } = randomEgWalkthrough(previous,
        limit => draw++ === 0 ? index : (index + draw) % limit);
      expect(entry).toBe(candidate);
      const whiteDown = (alg: string) => twoByTwoState(alg)[Face.D].filter(color => color === 'W').length;
      openingCounts.add(whiteDown(start));
      const opening = face.split(' ');
      for (let prefix = 0; prefix < opening.length; prefix++) {
        expect(whiteDown(egMoves(start, ...opening.slice(0, prefix)))).toBeLessThan(4);
      }
      const firstFace = egMoves(start, face);
      expect(whiteDown(firstFace)).toBe(4);
      expect(egBottomRows(firstFace).filter(isBar)).toHaveLength({ cll: 4, eg1: 1, eg2: 0 }[entry.set]);
      const held = egMoves(firstFace, regrip, align);
      if (entry.set === 'eg1') {
        expect(regrip).not.toBe('');
        expect(isBar(egBottomRows(firstFace)[2])).toBe(false);
        expect(isBar(egBottomRows(held)[2])).toBe(true);
      } else {
        expect(regrip).toBe('');
      }
      expect(egTopKey(held)).toBe(egTopKey(entry.setup));
      const afterAlg = egMoves(held, entry.alg);
      hasFinish.add(Boolean(finish));
      expect(solved(afterAlg)).toBe(!finish);
      expect(solved(egMoves(afterAlg, finish))).toBe(true);
    }
    expect(openingCounts).toEqual(new Set([1, 2, 3]));
    expect(hasFinish).toEqual(new Set([true, false]));
  });

  it('walks from a missing white corner through a right bar, a back bar and the final U', () => {
    const { start, face, regrip, align, entry, finish } = EG_WALKTHROUGH;
    expect(twoByTwoState(start)[Face.D].filter(color => color === 'W')).toHaveLength(3);
    const firstFace = egMoves(start, face);
    expect(twoByTwoState(firstFace)[Face.D].join('')).toBe('WWWW');
    expect(egBottomRows(firstFace).map(isBar)).toEqual([false, true, false, false]);
    const held = egMoves(firstFace, regrip, align);
    expect(egBottomRows(held).map(isBar)).toEqual([false, false, true, false]);
    expect(egTopKey(held)).toBe(egTopKey(entry.setup));
    const beforeAuf = egMoves(held, entry.alg);
    expect(solved(beforeAuf)).toBe(false);
    expect(solved(egMoves(beforeAuf, finish))).toBe(true);
  });
});
