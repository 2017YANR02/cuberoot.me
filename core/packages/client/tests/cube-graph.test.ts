import { describe, expect, it } from 'vitest';
import { applySequence, solvedCubie, MOVE_NAMES, invertSequence, parseMoves } from '@cuberoot/puzzle-solvers/kociemba/cube';
import { cubieToFacelet, SOLVED_FACELET } from '@/lib/cube-facelet';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import Cube from '@cuberoot/puzzle-render-core/engine/nxn/cube';
import { GRAPH_SLOTS, RINGS, createGraphLayout, graphPosition, sectorPath, stickerPermutation, parseGraphMoves, turnCycles } from '@/app/[lang]/math/cube-graph/model';

describe('cube sticker graph', () => {
  it.each([1, 2, 3, 4, 5, 6, 7])('maps every sticker and whole-width rotation at order %i', order => {
    const layout = createGraphLayout(order);
    const count = 6 * order * order;
    expect(layout.rings.length).toBe(3 * order);
    expect(layout.positions.length).toBe(2 * count);
    const points = Array.from({ length: count }, (_, id) => {
      const x = layout.positions[2 * id], y = layout.positions[2 * id + 1];
      for (const ringId of layout.ringIds.slice(2 * id, 2 * id + 2)) {
        const ring = layout.rings[ringId];
        expect(Math.hypot(x - ring.x, y - ring.y)).toBeCloseTo(ring.r, 8);
      }
      return `${x.toFixed(6)},${y.toFixed(6)}`;
    });
    expect(new Set(points).size).toBe(count);
    expect(stickerPermutation([`${order}Rw`], order)).toEqual(stickerPermutation(['x'], order));
    expect(stickerPermutation([`${order}Lw`], order)).toEqual(stickerPermutation(["x'"], order));
  });
  it.each([2, 3, 4, 5, 6, 7])('keeps layer, wide and rotation moves aligned with /sim at order %i', order => {
    const moves = ['R', "U'", 'F2', 'Rw', `2R`, `${order}Rw`, `2-${order}Rw`, 'x', "z'"];
    if (order >= 3) moves.push('m', 'e', 's');
    if (order % 2) moves.push('M', 'E', 'S');
    const cube = new Cube(order);
    try {
      for (const move of [...moves, moves.join(' ')]) {
        cube.twister.setup(move);
        const permutation = stickerPermutation(move.split(' '), order);
        expect(permutation.map(id => 'URFDLB'[Math.floor(id / (order * order))]).join(''), move).toBe(cube.serialize());
        expect(stickerPermutation([...move.split(' '), ...invertMoveString(move).split(' ')], order))
          .toEqual(stickerPermutation([], order));
      }
    } finally { cube.dispose(); }
  });
  it('matches the default 3D view with white above green-left and red-right', () => {
    const [u, r, f, d, l, b] = [4, 13, 22, 31, 40, 49].map(id => GRAPH_SLOTS[id]);
    expect(u.x).toBeCloseTo(220, 8);
    expect(d.x).toBeCloseTo(220, 8);
    expect(f.x < u.x && u.x < r.x).toBe(true);
    expect(f.y).toBeCloseTo(r.y, 8);
    expect(u.y < r.y && r.y < d.y).toBe(true);
    expect(l.x < f.x && r.x < b.x).toBe(true);
    expect(l.y < u.y && b.y < u.y).toBe(true);
    expect(stickerPermutation([])).toEqual(Array.from({ length: 54 }, (_, id) => id));
  });

  it('retargets repeated interrupted turns from the displayed positions without jumping', () => {
    let slots = GRAPH_SLOTS.map((_, id) => id);
    let displayed = GRAPH_SLOTS.map(({ x, y }) => ({ x, y }));
    const moves = ['R', 'U', 'F2', "R'", 'M', 'x', 'Rw', 'D'];
    for (let step = 0; step < moves.length; step++) {
      const targets = new Array<number>(54);
      stickerPermutation(moves.slice(0, step + 1)).forEach((id, slot) => { targets[id] = slot; });
      displayed = targets.map((to, id) => {
        const origin = displayed[id];
        expect(graphPosition(slots[id], to, 0, origin)).toEqual(origin);
        const nextFrame = graphPosition(slots[id], to, 0.000001, origin);
        expect(Math.hypot(nextFrame.x - origin.x, nextFrame.y - origin.y)).toBeLessThan(0.001);
        expect(graphPosition(slots[id], to, 1, origin)).toEqual({ x: GRAPH_SLOTS[to].x, y: GRAPH_SLOTS[to].y });
        return graphPosition(slots[id], to, 0.2, origin);
      });
      slots = targets;
    }
  });

  it('continues an interrupted arc on its circle when its target is unchanged', () => {
    const permutation = stickerPermutation(['R']);
    const to = permutation.findIndex((from, slot) => from !== slot
      && GRAPH_SLOTS[from].rings.some(id => GRAPH_SLOTS[slot].rings.includes(id)));
    const from = permutation[to];
    const origin = graphPosition(from, to, 0.3);
    // The next move leaves this sticker's target alone, but its old turn is unfinished.
    const p = graphPosition(to, to, 0.5, origin);
    const ring = RINGS[GRAPH_SLOTS[from].rings.find(id => GRAPH_SLOTS[to].rings.includes(id))!];
    expect(Math.hypot(p.x - ring.x, p.y - ring.y)).toBeCloseTo(ring.r, 8);
    expect(p.x).not.toBe(GRAPH_SLOTS[to].x);
    expect(graphPosition(to, to, 0, origin)).toEqual(origin);
  });

  it('validates editor input without dropping unsupported moves or expanding unbounded groups', () => {
    expect(parseGraphMoves('')).toEqual([]);
    expect(parseGraphMoves('RU2 M′ Rw x')).toEqual(['R', 'U2', "M'", 'Rw', 'x']);
    expect(parseGraphMoves('3Rw 2-3r 2R')).toEqual(['3Rw', '2-3r', '2R']);
    for (const text of ['R Q', '(R U)2', '[R,U]', 'R0', 'R3', '4Rw', '3-2r', 'Mw', 'R'.repeat(501), ' '.repeat(10001)]) {
      expect(parseGraphMoves(text), text).toBeNull();
    }
    expect(parseGraphMoves('R '.repeat(500))).toHaveLength(500);
    expect(parseGraphMoves('7Rw 2-6Rw 4R M m', 7)).toEqual(['7Rw', '2-6Rw', '4R', 'M', 'm']);
    expect(parseGraphMoves('M', 4)).toBeNull();
    expect(parseGraphMoves('m', 2)).toBeNull();
    expect(parseGraphMoves('Rw', 1)).toBeNull();
    expect(parseGraphMoves('8Rw', 7)).toBeNull();
    expect(parseGraphMoves('R', 8)).toBeNull();
  });
  it('draws forward cycles whose successive frames match actual cube turns', () => {
    for (const face of ['U', 'R', 'F', 'D', 'L', 'B']) {
      const cycles = turnCycles(face);
      expect(cycles.map(cycle => cycle.length)).toEqual([4, 4, 4, 4, 4]);
      for (let turns = 0; turns <= 4; turns++) {
        const permutation = stickerPermutation(Array(turns).fill(face));
        for (const cycle of cycles) cycle.forEach((slot, index) => {
          expect(cycle[(index - turns % 4 + 4) % 4]).toBe(permutation[slot]);
        });
      }
    }
  });
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
      const stickers = stickerPermutation([MOVE_NAMES[move]]);
      expect(new Set(stickers).size).toBe(54);
      expect(stickers.map(i => SOLVED_FACELET[i]).join('')).toBe(cubieToFacelet(state));
      expect(stickers.filter((v, i) => v !== i)).toHaveLength(20);
      [4, 13, 22, 31, 40, 49].forEach(i => expect(stickers[i]).toBe(i));
      stickers.forEach((from, to) => {
        expect(graphPosition(from, to, 0).x).toBeCloseTo(GRAPH_SLOTS[from].x, 8);
        expect(graphPosition(from, to, 1).x).toBeCloseTo(GRAPH_SLOTS[to].x, 8);
        expect(graphPosition(from, to, 1).y).toBeCloseTo(GRAPH_SLOTS[to].y, 8);
      });
      expect(stickerPermutation([move, ...invertSequence([move])].map(i => MOVE_NAMES[i]))).toEqual(stickerPermutation([]));
    });
  }
  it('returns every labeled sticker after four quarter turns and after a mixed inverse replay', () => {
    for (let move = 0; move < 18; move += 3) {
      expect(stickerPermutation([move, move, move, move].map(i => MOVE_NAMES[i]))).toEqual(stickerPermutation([]));
    }
    const moves = parseMoves("R U F2 L' D B R2 U'");
    expect(stickerPermutation([...moves, ...invertSequence(moves)].map(i => MOVE_NAMES[i]))).toEqual(stickerPermutation([]));
  });
  it('assigns all 54 stickers distinct finite sector cells', () => {
    const paths = GRAPH_SLOTS.map(p => sectorPath(p.face, p.row, p.col));
    expect(new Set(paths).size).toBe(54);
    expect(paths.join('')).not.toMatch(/NaN|Infinity/);
  });
  it('decomposes each quarter turn into five four-cycles and keeps adjacent strips on their layer circles', () => {
    for (let move = 0; move < 18; move += 3) {
      const permutation = stickerPermutation([MOVE_NAMES[move]]);
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
  it.each([
    ['M', 12, "Lw L'"], ['E', 12, "Dw D'"], ['S', 12, "Fw F'"],
    ['Rw', 32, "R M'"], ['Lw', 32, 'L M'], ['Uw', 32, "U E'"],
    ['Dw', 32, 'D E'], ['Fw', 32, 'F S'], ['Bw', 32, "B S'"],
    ['x', 52, "R M' L'"], ['y', 52, "U E' D'"], ['z', 52, "F S B'"],
  ])('supports /sim move %s, including moving centers and inverse replay', (move, moved, equivalent) => {
    const permutation = stickerPermutation([move]);
    expect(new Set(permutation).size).toBe(54);
    expect(permutation.filter((id, slot) => id !== slot).length).toBe(moved);
    expect(permutation).toEqual(stickerPermutation(String(equivalent).split(' ')));
    expect(stickerPermutation([move, invertMoveString(move)])).toEqual(stickerPermutation([]));
    expect(stickerPermutation([move, move, move, move])).toEqual(stickerPermutation([]));
  });
  it('retraces mixed outer, slice, wide and whole-cube turns with every identity intact', () => {
    const sequence = "R M' Uw2 z S E2 Fw' y2 L";
    expect(stickerPermutation(`${sequence} ${invertMoveString(sequence)}`.split(' '))).toEqual(stickerPermutation([]));
  });
  it('matches /sim for every outer, slice, wide and rotation token and a mixed sequence', () => {
    const algorithms = ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S', 'Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw', 'u', 'r', 'f', 'd', 'l', 'b', 'x', 'y', 'z']
      .flatMap(face => ['', "'", '2', "2'"].map(suffix => face + suffix));
    algorithms.push("R M' Uw2 z S E2 Fw' y2 L");
    const cube = new Cube(3);
    try {
      for (const alg of algorithms) {
        cube.twister.setup(alg);
        expect(stickerPermutation(alg.split(' ')).map(id => SOLVED_FACELET[id]).join(''), alg).toBe(cube.serialize());
      }
    } finally { cube.dispose(); }
  });
});
