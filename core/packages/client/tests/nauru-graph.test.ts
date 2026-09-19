import { describe, expect, it } from 'vitest';
import { applyAlg, identity } from '@/app/[lang]/math/group/_components/cube_state';
import { NAURU_STATES, NAURU_EDGES, NAURU_MOVES, NAURU_OUTER, NAURU_INNER, NAURU_SPHERES } from '@/app/[lang]/math/group/_components/nauru-graph';

describe('pocket-cube half-turn Cayley graph', () => {
  it('enumerates full corner states and faithfully identifies all 24 permutations', () => {
    expect(NAURU_STATES).toHaveLength(24);
    expect(new Set(NAURU_STATES.map(state => state.permutation)).size).toBe(24);
    expect(NAURU_SPHERES).toEqual([1, 3, 6, 9, 5]);
    for (const state of NAURU_STATES) {
      const cube = applyAlg(identity(), state.word.join(' '));
      expect(cube.cp).toEqual(state.corners);
      expect(cube.cp[6]).toBe(6);
      expect(cube.co).toEqual(Array(8).fill(0));
      const solved = applyAlg(cube, [...state.word].reverse().join(' '));
      expect(solved.cp).toEqual(identity().cp);
      NAURU_MOVES.forEach((move, index) => {
        const next = NAURU_STATES[state.neighbours[index]];
        expect(applyAlg(cube, move).cp).toEqual(next.corners);
        const permutation = state.permutation.split('');
        [permutation[0], permutation[index + 1]] = [permutation[index + 1], permutation[0]];
        expect(next.permutation).toBe(permutation.join(''));
      });
    }
  });

  it('has 36 edges, three involutions, diameter 4, girth 6 and bipartition 12+12', () => {
    expect(NAURU_EDGES).toHaveLength(36);
    expect(NAURU_MOVES.map((_, move) => NAURU_EDGES.filter(edge => edge.move === move).length)).toEqual([12, 12, 12]);
    expect(NAURU_STATES.filter(state => state.word.length % 2 === 0)).toHaveLength(12);
    let girth = Infinity;
    for (const [origin, state] of NAURU_STATES.entries()) {
      expect(new Set(state.neighbours).size).toBe(3);
      state.neighbours.forEach((next, move) => {
        expect(next).not.toBe(origin);
        expect(NAURU_STATES[next].neighbours[move]).toBe(origin);
      });
      const distance = Array(24).fill(-1);
      const parent = Array(24).fill(-1);
      distance[origin] = 0;
      const queue = [origin];
      for (const vertex of queue) {
        for (const next of NAURU_STATES[vertex].neighbours) {
          if (distance[next] < 0) {
            distance[next] = distance[vertex] + 1;
            parent[next] = vertex;
            queue.push(next);
          } else if (parent[vertex] !== next) {
            girth = Math.min(girth, distance[vertex] + distance[next] + 1);
          }
          expect(NAURU_STATES[next].word.length % 2).not.toBe(NAURU_STATES[vertex].word.length % 2);
        }
      }
      expect(Math.max(...distance)).toBe(4);
      expect(distance.filter(d => d < 0)).toHaveLength(0);
    }
    expect(girth).toBe(6);
  });

  it('proves the drawing is GP(12,5), not merely a graph with matching counts', () => {
    expect(new Set([...NAURU_OUTER, ...NAURU_INNER]).size).toBe(24);
    for (let i = 0; i < 12; i++) {
      expect([...NAURU_STATES[NAURU_OUTER[i]].neighbours].sort()).toEqual([
        NAURU_OUTER[(i + 1) % 12], NAURU_OUTER[(i + 11) % 12], NAURU_INNER[i],
      ].sort());
      expect([...NAURU_STATES[NAURU_INNER[i]].neighbours].sort()).toEqual([
        NAURU_INNER[(i + 5) % 12], NAURU_INNER[(i + 7) % 12], NAURU_OUTER[i],
      ].sort());
    }
  });

  it('distinguishes all six half turns with a fixed external frame (96 states)', () => {
    const states = [identity()];
    const seen = new Set([identity().cp.join(',')]);
    for (const cube of states) {
      for (const move of ['U2', 'R2', 'F2', 'D2', 'L2', 'B2']) {
        const next = applyAlg(cube, move);
        expect(next.co).toEqual(Array(8).fill(0));
        const key = next.cp.join(',');
        if (!seen.has(key)) { seen.add(key); states.push(next); }
      }
    }
    expect(states).toHaveLength(96);
  });
});
