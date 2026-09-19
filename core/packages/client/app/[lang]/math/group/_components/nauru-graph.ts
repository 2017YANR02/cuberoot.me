import { applyAlg, identity } from './cube_state';

export const NAURU_MOVES = ['U2', 'R2', 'F2'] as const;
export type NauruMove = typeof NAURU_MOVES[number];
// Alternating corners of the cube: labels 1, 2, 3, 4 respectively.
export const NAURU_TETRAD = [0, 2, 7, 5] as const;

type NauruState = {
  corners: number[];
  permutation: string;
  word: NauruMove[];
  neighbours: number[];
};

function enumerate(): NauruState[] {
  const states: NauruState[] = [];
  const seen = new Map<string, number>();
  function visit(word: NauruMove[]) {
    const cube = applyAlg(identity(), word.join(' '));
    // A pocket cube has no edges. Deduplicate by ALL corners, never by the
    // 3×3 edge coordinates carried by the existing move engine.
    const key = [...cube.cp, ...cube.co].join(',');
    const existing = seen.get(key);
    if (existing !== undefined) return existing;
    const index = states.length;
    seen.set(key, index);
    states.push({ corners: cube.cp,
      permutation: NAURU_TETRAD.map(slot => NAURU_TETRAD.indexOf(cube.cp[slot] as typeof NAURU_TETRAD[number]) + 1).join(''),
      word, neighbours: [] });
    return index;
  }
  visit([]);
  for (let i = 0; i < states.length; i++) {
    states[i].neighbours = NAURU_MOVES.map(move => visit([...states[i].word, move]));
  }
  return states;
}

export const NAURU_STATES = enumerate();
export const NAURU_EDGES = NAURU_STATES.flatMap((state, from) =>
  state.neighbours.flatMap((to, move) => from < to ? [{ from, to, move }] : []));
export const NAURU_SPHERES = NAURU_STATES.reduce<number[]>((counts, state) => {
  counts[state.word.length] = (counts[state.word.length] ?? 0) + 1;
  return counts;
}, []);

// One explicit GP(12,5) labelling, checked against the computed move graph.
// Labels are cube permutations, not BFS indices, so traversal order is irrelevant.
const outerLabels = ['1234', '2134', '3124', '4123', '1423', '2413',
  '3412', '4312', '1342', '2341', '3241', '4231'];
export const NAURU_OUTER = outerLabels.map(label => NAURU_STATES.findIndex(state => state.permutation === label));
export const NAURU_INNER = NAURU_OUTER.map(id => NAURU_STATES[id].neighbours.find(next => !NAURU_OUTER.includes(next))!);
export function nauruPosition(id: number) {
  const outerIndex = NAURU_OUTER.indexOf(id);
  const index = outerIndex >= 0 ? outerIndex : NAURU_INNER.indexOf(id);
  const angle = (index - 0.5) * Math.PI / 6 - Math.PI / 2;
  const radius = outerIndex >= 0 ? 182 : 110;
  return { x: 210 + radius * Math.cos(angle), y: 210 + radius * Math.sin(angle) };
}
