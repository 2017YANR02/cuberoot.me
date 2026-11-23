import { describe, expect, it } from 'vitest';
import { AllFaces, Face } from '@cuberoot/visualcube';
import { twoByTwoState } from '@/app/[lang]/tutorial/lib/2x2-state';
import {
  EG_CASES, EG_SETS, EG_SHAPES, EG_WALKTHROUGH, egBottomRows, egMoves, egTopKey,
} from '@/app/[lang]/tutorial/2x2-eg/lesson-data';

const topTurns = ['', 'U', 'U2', "U'"];
const bodyTurns = ['', 'y', 'y2', "y'"];
const opposite = new Set(['RO', 'OR', 'BG', 'GB']);
const solved = (moves: string) => {
  const state = twoByTwoState(moves);
  return AllFaces.every(face => new Set(state[face]).size === 1);
};
const isBar = ([a, b]: string) => a === b;

describe('2×2 EG course cases', () => {
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
