/**
 * Baby FTO (Skewb Diamond): an exact, rotation-independent face-turn solver.
 *
 * CubeRoot's compact product-coordinate BFS uses cubing.js 0.63.3's named
 * `baby_fto` geometry/notation (https://github.com/cubing/cubing.js). The eight
 * move transformations below were extracted from that public KPuzzle model;
 * tests independently replay them through the named loader and its geometry.
 * The classic 138,240-state quotient and diameter 10 are independently reported
 * by Jaap Scherphuis: https://www.jaapsch.net/puzzles/diamond.htm .
 *
 * U/F/BR/BL leave centre slots 0,1,2,7 fixed. Their corner orbit has 11,520
 * states and their other centre tetrad has 12 states; all 138,240 products are
 * reachable. Whole-puzzle rotations cost zero and unmarked centre orientation
 * is invisible. Each of the other four face turns is one of these four turns
 * followed by a whole-puzzle rotation. Consequently the quotient's eight
 * directed edges are exactly the allowed sixteen moves modulo rotations, so
 * BFS distances are shortest even when all eight faces may be turned.
 *
 * An input is normalized by a rigid rotation r, solved in the fixed-centre
 * coordinate by h, and the answer r h r^-1 is returned in the original frame.
 * This restores all face colours (possibly at a different global orientation),
 * without asking the user to perform rotations or replaying the input inverse.
 */

export const BABY_FTO_FACE_NAMES = ['U', 'F', 'R', 'L', 'D', 'B', 'BR', 'BL'] as const;
export const BABY_FTO_TOTAL_STATES = 138_240;
export const BABY_FTO_GODS_NUMBER = 10;
export const BABY_FTO_LENGTH_DISTRIBUTION: readonly number[] = [
  1, 8, 48, 288, 1632, 8568, 36114, 74799, 16547, 220, 15,
];
export const BABY_FTO_MAX_MOVES = 8192;
export const BABY_FTO_MAX_INPUT_LENGTH = 65536;

export interface BabyFtoState {
  centers: number[];
  corners: number[];
  orientation: number[];
}
export interface BabyFtoSolution { solution: string; length: number }
type Transform = Readonly<BabyFtoState>;
const IDENTITY: Transform = { centers: [0, 1, 2, 3, 4, 5, 6, 7], corners: [0, 1, 2, 3, 4, 5], orientation: [0, 0, 0, 0, 0, 0] };
const BASE: readonly Transform[] = [
  { centers: [0, 1, 2, 6, 4, 3, 5, 7], corners: [2, 1, 5, 3, 4, 0], orientation: [0, 0, 0, 0, 0, 0] },
  { centers: [0, 1, 2, 5, 3, 4, 6, 7], corners: [3, 0, 2, 1, 4, 5], orientation: [3, 3, 0, 2, 0, 0] },
  { centers: [1, 7, 2, 3, 4, 5, 6, 0], corners: [1, 2, 0, 3, 4, 5], orientation: [3, 3, 2, 0, 0, 0] },
  { centers: [7, 1, 0, 3, 4, 5, 6, 2], corners: [5, 1, 2, 0, 4, 3], orientation: [2, 0, 0, 3, 0, 3] },
  { centers: [2, 0, 1, 3, 4, 5, 6, 7], corners: [0, 3, 2, 4, 1, 5], orientation: [0, 0, 0, 0, 0, 0] },
  { centers: [0, 2, 7, 3, 4, 5, 6, 1], corners: [0, 1, 4, 3, 5, 2], orientation: [0, 0, 3, 0, 3, 2] },
  { centers: [0, 1, 2, 4, 6, 5, 3, 7], corners: [0, 4, 1, 3, 2, 5], orientation: [0, 2, 3, 0, 3, 0] },
  { centers: [0, 1, 2, 3, 5, 6, 4, 7], corners: [0, 1, 2, 5, 3, 4], orientation: [0, 0, 0, 3, 2, 3] },
];

function compose(a: Transform, b: Transform): BabyFtoState {
  return {
    centers: b.centers.map(source => a.centers[source]),
    corners: b.corners.map(source => a.corners[source]),
    orientation: b.corners.map((source, slot) => (a.orientation[source] + b.orientation[slot]) % 4),
  };
}
function transformKey(state: Transform): string {
  return `${state.centers.join(',')}/${state.corners.join(',')}/${state.orientation.join(',')}`;
}
const MOVES = BASE.flatMap(move => [move, compose(move, move)]);
export const BABY_FTO_MOVE_NAMES: readonly string[] = BABY_FTO_FACE_NAMES.flatMap(face => [face, `${face}'`]);
const MOVE_IDS = new Map(BABY_FTO_MOVE_NAMES.map((name, index) => [name, index]));
const FIXED_CENTERS = [0, 1, 2, 7];
const CANONICAL_IDS = [0, 1, 2, 3, 12, 13, 14, 15];
const CANONICAL_MOVES = CANONICAL_IDS.map(index => MOVES[index]);
const CORNER_COUNT = 11520;
const CENTER_COUNT = 12;
const TOKEN = /^(U|F|R|L|D|B|BR|BL)(2|')?$/;

export function parseBabyFtoMoves(text: string): string[] {
  if (text.length > BABY_FTO_MAX_INPUT_LENGTH) throw new Error('Baby FTO input is too long');
  const tokens = text.trim().split(/\s+/).filter(Boolean);
  if (tokens.length > BABY_FTO_MAX_MOVES) throw new Error('Too many Baby FTO moves');
  return tokens.map(token => {
    const match = TOKEN.exec(token);
    if (!match) throw new Error(`Invalid Baby FTO move: ${token}`);
    return match[1] + (match[2] ? "'" : '');
  });
}
export function classifyBabyFtoTokens(text: string): Array<{ text: string; bad: boolean }> {
  if (text.length > BABY_FTO_MAX_INPUT_LENGTH) return [{ text, bad: true }];
  let count = 0;
  return text.split(/(\s+)/).filter(Boolean).map(part => ({
    text: part,
    bad: !/^\s+$/.test(part) && (++count > BABY_FTO_MAX_MOVES || !TOKEN.test(part)),
  }));
}
export function solvedBabyFto(): BabyFtoState {
  return { centers: [...IDENTITY.centers], corners: [...IDENTITY.corners], orientation: [...IDENTITY.orientation] };
}
export function babyFtoApply(scramble: string): BabyFtoState {
  return parseBabyFtoMoves(scramble).reduce((state, token) => compose(state, MOVES[MOVE_IDS.get(token)!]), solvedBabyFto());
}

/** Pack six (piece, orientation) pairs into 30 bits. */
function cornerCode(state: Transform): number {
  let code = 0;
  for (let slot = 0; slot < 6; slot++) code |= (state.corners[slot] * 4 + state.orientation[slot]) << (slot * 5);
  return code;
}
function cornerStep(code: number, move: Transform): number {
  let next = 0;
  for (let slot = 0; slot < 6; slot++) {
    const value = (code >>> (move.corners[slot] * 5)) & 31;
    next |= ((value & 28) | ((value + move.orientation[slot]) & 3)) << (slot * 5);
  }
  return next;
}
function centerCode(state: Transform): number {
  let code = 0;
  for (let slot = 3; slot <= 6; slot++) code |= (state.centers[slot] - 3) << ((slot - 3) * 2);
  return code;
}
function centerStep(code: number, move: Transform): number {
  let next = 0;
  for (let slot = 3; slot <= 6; slot++) next |= ((code >>> ((move.centers[slot] - 3) * 2)) & 3) << ((slot - 3) * 2);
  return next;
}

interface Frame { transform: Transform; inverse: Transform; conjugatedMoves: number[] }
let cachedFrames: Frame[] | undefined;
function frames(): Frame[] {
  if (cachedFrames) return cachedFrames;
  // F B' is the loader's Fv. The other generator is its geometric 90-degree
  // D_BR_R_Fv rotation; together they generate all 24 rigid octahedral frames.
  const rotations: Transform[] = [compose(MOVES[2], MOVES[11]), {
    centers: [4, 3, 6, 0, 1, 2, 7, 5], corners: [3, 1, 0, 4, 2, 5], orientation: [2, 1, 1, 3, 2, 3],
  }];
  const transforms: Transform[] = [IDENTITY];
  const seen = new Set([transformKey(IDENTITY)]);
  for (let head = 0; head < transforms.length; head++) for (const rotation of rotations) {
    const next = compose(transforms[head], rotation);
    const key = transformKey(next);
    if (seen.has(key)) continue;
    if (transforms.length >= 24) throw new Error('Invalid Baby FTO rotation model');
    seen.add(key); transforms.push(next);
  }
  if (transforms.length !== 24) throw new Error('Incomplete Baby FTO rotation model');
  const moveKeys = MOVES.map(transformKey);
  cachedFrames = transforms.map(transform => {
    const inverse = transforms.find(candidate => transformKey(compose(transform, candidate)) === transformKey(IDENTITY))!;
    const conjugatedMoves = CANONICAL_MOVES.map(move => moveKeys.indexOf(transformKey(compose(compose(transform, move), inverse))));
    if (conjugatedMoves.includes(-1)) throw new Error('Invalid Baby FTO move conjugation');
    return { transform, inverse, conjugatedMoves };
  });
  return cachedFrames;
}
function normalize(state: Transform): { state: BabyFtoState; frame: Frame } {
  const frame = frames().find(({ transform }) => FIXED_CENTERS.every(slot => state.centers[transform.centers[slot]] === slot));
  if (!frame) throw new Error('Unreachable Baby FTO centre arrangement');
  return { state: compose(state, frame.transform), frame };
}
function validateState(state: BabyFtoState): void {
  const permutation = (values: number[], size: number) => Array.isArray(values) && values.length === size
    && Array.from(values).every(value => Number.isInteger(value) && value >= 0 && value < size) && new Set(values).size === size;
  if (!state || !permutation(state.centers, 8) || !permutation(state.corners, 6)
    || !Array.isArray(state.orientation) || state.orientation.length !== 6
    || !Array.from(state.orientation).every(value => Number.isInteger(value) && value >= 0 && value < 4)) {
    throw new Error('Invalid Baby FTO state');
  }
}

interface Graph {
  cornerRanks: Map<number, number>;
  centerRanks: Int16Array;
  cornerMoves: Uint16Array;
  centerMoves: Uint8Array;
  distance: Uint8Array;
  towardSolved: Uint8Array;
  histogram: number[];
  buildMilliseconds: number;
  typedArrayBytes: number;
}
let cachedGraph: Graph | undefined;
function graph(): Graph {
  if (cachedGraph) return cachedGraph;
  const started = Date.now();
  const cornerRanks = new Map<number, number>([[cornerCode(IDENTITY), 0]]);
  const cornerCodes = new Uint32Array(CORNER_COUNT);
  cornerCodes[0] = cornerCode(IDENTITY);
  const cornerMoves = new Uint16Array(CORNER_COUNT * 8);
  let cornerSize = 1;
  for (let head = 0; head < cornerSize; head++) for (let move = 0; move < 8; move++) {
    const code = cornerStep(cornerCodes[head], CANONICAL_MOVES[move]);
    let rank = cornerRanks.get(code);
    if (rank === undefined) {
      if (cornerSize >= CORNER_COUNT) throw new Error('Baby FTO corner orbit exceeds its bound');
      rank = cornerSize++; cornerCodes[rank] = code; cornerRanks.set(code, rank);
    }
    cornerMoves[head * 8 + move] = rank;
  }
  const centerRanks = new Int16Array(256).fill(-1);
  const centerCodes = new Uint8Array(CENTER_COUNT);
  centerCodes[0] = centerCode(IDENTITY); centerRanks[centerCodes[0]] = 0;
  const centerMoves = new Uint8Array(CENTER_COUNT * 8);
  let centerSize = 1;
  for (let head = 0; head < centerSize; head++) for (let move = 0; move < 8; move++) {
    const code = centerStep(centerCodes[head], CANONICAL_MOVES[move]);
    let rank = centerRanks[code];
    if (rank < 0) {
      if (centerSize >= CENTER_COUNT) throw new Error('Baby FTO centre orbit exceeds its bound');
      rank = centerSize++; centerCodes[rank] = code; centerRanks[code] = rank;
    }
    centerMoves[head * 8 + move] = rank;
  }
  if (cornerSize !== CORNER_COUNT || centerSize !== CENTER_COUNT) throw new Error('Incomplete Baby FTO coordinates');
  const distance = new Uint8Array(BABY_FTO_TOTAL_STATES).fill(255);
  const towardSolved = new Uint8Array(BABY_FTO_TOTAL_STATES);
  const queue = new Uint32Array(BABY_FTO_TOTAL_STATES);
  const histogram: number[] = [1];
  let count = 1; distance[0] = 0;
  for (let head = 0; head < count; head++) {
    const index = queue[head], corner = Math.floor(index / CENTER_COUNT), center = index % CENTER_COUNT;
    for (let move = 0; move < 8; move++) {
      const next = cornerMoves[corner * 8 + move] * CENTER_COUNT + centerMoves[center * 8 + move];
      if (distance[next] !== 255) continue;
      const depth = distance[index] + 1;
      distance[next] = depth; towardSolved[next] = move ^ 1; queue[count++] = next;
      histogram[depth] = (histogram[depth] ?? 0) + 1;
    }
  }
  if (count !== BABY_FTO_TOTAL_STATES || histogram.join(',') !== BABY_FTO_LENGTH_DISTRIBUTION.join(',')) {
    throw new Error('Baby FTO exact graph failed its distribution check');
  }
  cachedGraph = {
    cornerRanks, centerRanks, cornerMoves, centerMoves, distance, towardSolved, histogram,
    buildMilliseconds: Date.now() - started,
    typedArrayBytes: centerRanks.byteLength + cornerMoves.byteLength + centerMoves.byteLength + distance.byteLength + towardSolved.byteLength,
  };
  return cachedGraph;
}
function solutionMoves(index: number, table: Graph): number[] {
  const result: number[] = [];
  while (index !== 0) {
    const move = table.towardSolved[index]; result.push(move);
    index = table.cornerMoves[Math.floor(index / CENTER_COUNT) * 8 + move] * CENTER_COUNT
      + table.centerMoves[(index % CENTER_COUNT) * 8 + move];
  }
  return result;
}

/** Solve a physical state independently of any scramble history. */
export async function solveBabyFtoState(input: BabyFtoState): Promise<BabyFtoSolution> {
  validateState(input);
  const { state, frame } = normalize(input);
  const table = graph();
  const corner = table.cornerRanks.get(cornerCode(state));
  const center = table.centerRanks[centerCode(state)];
  if (corner === undefined || center < 0) throw new Error('Unreachable Baby FTO state');
  const moves = solutionMoves(corner * CENTER_COUNT + center, table);
  return { solution: moves.map(move => BABY_FTO_MOVE_NAMES[frame.conjugatedMoves[move]]).join(' '), length: moves.length };
}
export async function solveBabyFto(scramble: string): Promise<BabyFtoSolution> {
  return solveBabyFtoState(babyFtoApply(scramble));
}
export async function babyFtoGraphStats(): Promise<{
  total: number; histogram: number[]; buildMilliseconds: number; typedArrayBytes: number;
}> {
  const table = graph();
  return { total: table.distance.length, histogram: [...table.histogram], buildMilliseconds: table.buildMilliseconds, typedArrayBytes: table.typedArrayBytes };
}
export async function babyFtoExamplesByLength(perBin = 12): Promise<Record<number, string[]>> {
  if (perBin !== Infinity && (!Number.isSafeInteger(perBin) || perBin < 0)) throw new Error('Invalid Baby FTO example limit');
  const table = graph(), result: Record<number, string[]> = {};
  const counts = Array(table.histogram.length).fill(0) as number[];
  for (let index = 0; index < table.distance.length; index++) {
    const depth = table.distance[index];
    const offset = counts[depth]++;
    const step = perBin === Infinity ? 1 : Math.max(1, Math.floor(table.histogram[depth] / Math.max(1, perBin)));
    if ((result[depth]?.length ?? 0) >= perBin || offset % step !== 0) continue;
    const scramble = solutionMoves(index, table).reverse().map(move => BABY_FTO_MOVE_NAMES[CANONICAL_IDS[move ^ 1]]).join(' ');
    (result[depth] ??= []).push(scramble);
  }
  return result;
}
export async function babyFtoAllScramblesByLength(): Promise<Record<number, string[]>> {
  return babyFtoExamplesByLength(Infinity);
}
