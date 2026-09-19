import { describe, expect, it } from 'vitest';
import { applySequence, solvedCubie, MOVE_NAMES, invertSequence, parseMoves } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { cubieToFacelet, SOLVED_FACELET } from '@/lib/cube-facelet';
import { GRAPH_SLOTS, RINGS, graphPosition, sectorPath, stickerPermutation } from '@/app/[lang]/math/cube-graph/model';

describe('cube sticker graph', () => {
  it('places 54 distinct stickers exactly on their two layer circles', () => {
    expect(GRAPH_SLOTS).toHaveLength(54);
    expect(new Set(GRAPH_SLOTS.map(p => `${p.x.toFixed(6)},${p.y.toFixed(6)}`)).size).toBe(54);
    GRAPH_SLOTS.forEach(p => p.rings.forEach(id => {
      expect(Math.hypot(p.x - RINGS[id].x, p.y - RINGS[id].y)).toBeCloseTo(RINGS[id].r, 8);
      expect(p.x).toBeGreaterThan(0);
      expect(p.y).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(440);
      expect(p.y).toBeLessThan(440);
    }));
  });
  for (let move = 0; move < 18; move++) {
    it(`${MOVE_NAMES[move]} preserves identities, centers, colors and animation endpoints`, () => {
      const state = applySequence(solvedCubie(), [move]);
      const stickers = stickerPermutation(state);
      expect(new Set(stickers).size).toBe(54);
      expect(stickers.map(i => SOLVED_FACELET[i]).join('')).toBe(cubieToFacelet(state));
      expect(stickers.filter((v, i) => v !== i)).toHaveLength(20);
      [4, 13, 22, 31, 40, 49].forEach(i => expect(stickers[i]).toBe(i));
      stickers.forEach((from, to) => {
        expect(graphPosition(from, to, 0).x).toBeCloseTo(GRAPH_SLOTS[from].x, 8);
        expect(graphPosition(from, to, 1).x).toBeCloseTo(GRAPH_SLOTS[to].x, 8);
        expect(graphPosition(from, to, 1).y).toBeCloseTo(GRAPH_SLOTS[to].y, 8);
      });
      expect(stickerPermutation(applySequence(state, invertSequence([move])))).toEqual(stickerPermutation(solvedCubie()));
    });
  }
  it('returns every labeled sticker after four quarter turns and after a mixed inverse replay', () => {
    for (let move = 0; move < 18; move += 3) {
      expect(stickerPermutation(applySequence(solvedCubie(), [move, move, move, move]))).toEqual(stickerPermutation(solvedCubie()));
    }
    const moves = parseMoves("R U F2 L' D B R2 U'");
    expect(stickerPermutation(applySequence(solvedCubie(), [...moves, ...invertSequence(moves)]))).toEqual(stickerPermutation(solvedCubie()));
  });
  it('assigns all 54 stickers distinct finite sector cells', () => {
    const paths = GRAPH_SLOTS.map(p => sectorPath(p.face, p.row, p.col));
    expect(new Set(paths).size).toBe(54);
    expect(paths.join('')).not.toMatch(/NaN|Infinity/);
  });
  it('decomposes each quarter turn into five four-cycles and keeps adjacent strips on their layer circles', () => {
    for (let move = 0; move < 18; move += 3) {
      const permutation = stickerPermutation(applySequence(solvedCubie(), [move]));
      const visited = new Set<number>();
      const cycles: number[] = [];
      permutation.forEach((from, to) => {
        if (from === to || visited.has(to)) return;
        let current = to, length = 0;
        do { visited.add(current); length++; current = permutation[current]; } while (current !== to);
        cycles.push(length);
      });
      expect(cycles).toEqual([4, 4, 4, 4, 4]);
      const adjacent = permutation.map((from, to) => ({ from, to }))
        .filter(({ from, to }) => from !== to && Math.floor(to / 9) !== move / 3);
      expect(adjacent).toHaveLength(12);
      adjacent.forEach(({ from, to }) => {
        const common = GRAPH_SLOTS[from].rings.filter(id => GRAPH_SLOTS[to].rings.includes(id));
        expect(common).toHaveLength(1);
        const ring = RINGS[common[0]];
        const halfway = graphPosition(from, to, 0.5);
        expect(Math.hypot(halfway.x - ring.x, halfway.y - ring.y)).toBeCloseTo(ring.r, 8);
      });
    }
  });
});
