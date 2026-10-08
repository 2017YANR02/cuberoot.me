/**
 * Pyraminx Duo: four fixed-position corners and four unmarked face centres.
 * An original, runtime-neutral implementation of the corner/centre model described
 * by Jaap Scherphuis: https://www.jaapsch.net/puzzles/pyraduo.htm
 * Puzzle design: Oskar van Deventer, from Rob Stegmann's idea.
 *
 * A move twists one corner and cycles its three adjacent centres. The centre
 * tetrahedron's twist class equals the sum of corner twists, so there are only
 * 324 reachable states (not 4! * 3^4), with distances [1, 8, 48, 188, 79].
 * Build that entire graph once; scrambles sample uniformly from its 315 states
 * at distance >= 2. This is CubeRoot's native random-state policy, not a WCA event
 * or an upstream csTimer scrambler. Centre logo orientation is not a solve goal.
 */

export const DUO_VERTEX_NAMES = ['U', 'L', 'R', 'B'] as const;
/** Right-handed tetrahedron; the renderer supplies its display rotation. */
export const DUO_VERTEX_AXES: ReadonlyArray<readonly [number, number, number]> = [
  [1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1],
];
/** Face f is opposite corner f; vertices wind outward on that face. */
export const DUO_FACE_VERTICES: ReadonlyArray<readonly [number, number, number]> = [
  [1, 3, 2], [0, 2, 3], [0, 3, 1], [0, 1, 2],
];
/** Clockwise turn, old face position -> new face position. */
export const DUO_CENTRE_PERMUTATIONS: ReadonlyArray<readonly [number, number, number, number]> = [
  [0, 3, 1, 2], [2, 1, 3, 0], [3, 0, 2, 1], [1, 2, 0, 3],
];
export const DUO_GODS_NUMBER = 4;
export const DUO_LENGTH_DISTRIBUTION: readonly number[] = [1, 8, 48, 188, 79];

export interface DuoMove {
  corner: number;
  /** Geometric signed angle: bare = -120 degrees (clockwise from outside). */
  dir: 1 | -1;
}
export interface DuoState {
  corners: number[];
  /** centres[face] = home face/colour currently at that face. */
  centers: number[];
}

export function solvedDuo(): DuoState { return { corners: [0, 0, 0, 0], centers: [0, 1, 2, 3] }; }
export function isDuoSolved(state: DuoState): boolean {
  return state.corners.every(value => value === 0) && state.centers.every((value, face) => value === face);
}

const TOKEN = /^([ULRB])('?)$/;

/** Strict notation: Duo has neither independent tips nor face/layer turns. */
export function parseDuoMoves(text: string): DuoMove[] {
  if (!text.trim()) return [];
  return text.trim().split(/\s+/).map(token => {
    const match = TOKEN.exec(token);
    if (!match) throw new Error(`Invalid Pyraminx Duo move: ${token}`);
    return { corner: DUO_VERTEX_NAMES.indexOf(match[1] as typeof DUO_VERTEX_NAMES[number]), dir: match[2] ? 1 : -1 };
  });
}
export function duoMoveToString(move: DuoMove): string {
  return DUO_VERTEX_NAMES[move.corner] + (move.dir === 1 ? "'" : '');
}
export function duoMovesToString(moves: readonly DuoMove[]): string { return moves.map(duoMoveToString).join(' '); }
export function invertDuoMoves(moves: readonly DuoMove[]): DuoMove[] {
  return moves.slice().reverse().map(move => ({ corner: move.corner, dir: move.dir === 1 ? -1 : 1 }));
}
export function classifyDuoTokens(text: string): Array<{ text: string; bad: boolean }> {
  return text.split(/(\s+)/).filter(Boolean).map(part => ({ text: part, bad: !/^\s+$/.test(part) && !TOKEN.test(part) }));
}

export function applyDuoMove(state: DuoState, move: DuoMove): DuoState {
  if (!Number.isInteger(move.corner) || move.corner < 0 || move.corner > 3 || (move.dir !== -1 && move.dir !== 1)) {
    throw new Error('Invalid Pyraminx Duo turn');
  }
  const turns = move.dir === -1 ? 1 : 2;
  const corners = state.corners.slice();
  let centers = state.centers.slice();
  corners[move.corner] = (corners[move.corner] + turns) % 3;
  for (let turn = 0; turn < turns; turn++) {
    const next = centers.slice();
    centers.forEach((value, face) => { next[DUO_CENTRE_PERMUTATIONS[move.corner][face]] = value; });
    centers = next;
  }
  return { corners, centers };
}

export function duoApply(scramble: string): DuoState {
  return parseDuoMoves(scramble).reduce(applyDuoMove, solvedDuo());
}

/** Colour of a live face patch, for the shared SVG and geometry-independent checks. */
export function duoStickerColor(state: DuoState, face: number, corner: number | null): number {
  if (corner === null) return state.centers[face];
  if (corner === face) throw new Error('A corner has no sticker on its opposite face');
  // Find the home face carried to `face` by this corner's clockwise orientation.
  const inverseTurns = (3 - state.corners[corner]) % 3;
  let homeFace = face;
  for (let turn = 0; turn < inverseTurns; turn++) homeFace = DUO_CENTRE_PERMUTATIONS[corner][homeFace];
  return homeFace;
}

export function reduceDuoAlg(text: string): string {
  const result: DuoMove[] = [];
  for (const move of parseDuoMoves(text)) {
    const previous = result.at(-1);
    if (previous?.corner !== move.corner) { result.push(move); continue; }
    result.pop();
    if (previous.dir === move.dir) result.push({ corner: move.corner, dir: move.dir === 1 ? -1 : 1 });
  }
  return duoMovesToString(result);
}

interface GraphNode { state: DuoState; parent: number; move: DuoMove | null; distance: number }
interface DuoGraph { nodes: GraphNode[]; byKey: Map<number, number>; candidates: number[] }
let cachedGraph: DuoGraph | undefined;
function stateKey(state: DuoState): number {
  let cornerCode = 0, centreCode = 0;
  for (let i = 3; i >= 0; i--) { cornerCode = cornerCode * 3 + state.corners[i]; centreCode = centreCode * 4 + state.centers[i]; }
  return centreCode * 81 + cornerCode;
}
function graph(): DuoGraph {
  if (cachedGraph) return cachedGraph;
  const initial = solvedDuo();
  const nodes: GraphNode[] = [{ state: initial, parent: -1, move: null, distance: 0 }];
  const byKey = new Map([[stateKey(initial), 0]]);
  const candidates: number[] = [];
  for (let head = 0; head < nodes.length; head++) {
    for (let corner = 0; corner < 4; corner++) for (const dir of [-1, 1] as const) {
      const move: DuoMove = { corner, dir };
      const state = applyDuoMove(nodes[head].state, move);
      const key = stateKey(state);
      if (byKey.has(key)) continue;
      const index = nodes.length;
      const distance = nodes[head].distance + 1;
      byKey.set(key, index);
      nodes.push({ state, parent: head, move, distance });
      if (distance >= 2) candidates.push(index);
    }
  }
  cachedGraph = { nodes, byKey, candidates };
  return cachedGraph;
}
function pathTo(index: number): DuoMove[] {
  const { nodes } = graph();
  const path: DuoMove[] = [];
  for (let node = nodes[index]; node.move; node = nodes[node.parent]) path.push(node.move);
  return path.reverse();
}

export function generatePyraminxDuoScramble(random: () => number = Math.random): string {
  const sample = random();
  if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error('Pyraminx Duo RNG must return a number in [0, 1)');
  const { candidates } = graph();
  return duoMovesToString(pathTo(candidates[Math.floor(sample * candidates.length)]));
}
export function solvePyraminxDuo(scramble: string): { solution: string; length: number } {
  const { byKey } = graph();
  const index = byKey.get(stateKey(duoApply(scramble)));
  if (index === undefined) throw new Error('Unreachable Pyraminx Duo state');
  const moves = invertDuoMoves(pathTo(index));
  return { solution: duoMovesToString(moves), length: moves.length };
}
export function duoGraphStats(): { total: number; histogram: number[] } {
  const histogram: number[] = [];
  const { nodes } = graph();
  for (const node of nodes) histogram[node.distance] = (histogram[node.distance] ?? 0) + 1;
  return { total: nodes.length, histogram };
}
