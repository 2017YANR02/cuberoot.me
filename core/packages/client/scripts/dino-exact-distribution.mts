/**
 * Offline exact six-colour Dino enumeration, A12 / tetrahedral rotations = A11.
 * Raw move semantics reuse the existing csTimer adapter; an independent integer
 * 3D rotation model checks pieces, stickers, frame changes and every witness.
 *
 * One counted move is either 120-degree twist at any of the eight corners.
 * The primary goal preserves the colour arrangement (up to the 12 legal frame
 * rotations). A separate two-goal result also accepts its mirror arrangement.
 * Reference counts: https://www.jaapsch.net/puzzles/dinocube.htm
 *
 * No enumeration on import. enumerateDino requires a checkpoint directory;
 * every complete BFS layer is durably saved before the next layer starts.
 * Run only through the enclosing serial resource guard. This module does not
 * establish a new machine boot/Swapouts baseline or automatically restart.
 */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, mkdirSync, openSync, readFileSync,
  readSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { DINO_EDGE_FACES, DINO_FACES, DINO_MOVE_NAMES, dinoEpFromScramble } from '../lib/dino-solver.ts';
import { permutationRank, unrankPermutation, type ResumableExactStates } from './exact-coordinate-bfs.mts';

const COUNT = 19_958_400, MOVES = 16, COMBINATIONS = 462;
const P6 = 720, P5 = 120, H5 = 60, BLOCK = P6 * H5;
const FORMAT = 'dino-a11-6-5-v1';
const REFERENCE = 'https://www.jaapsch.net/puzzles/dinocube.htm';
const SINGLE_HIST = [1, 16, 160, 1408, 11712, 90912, 640192, 3740838, 11138597, 4313963, 20577, 24];
const DUAL_HIST = [2, 32, 320, 2816, 23424, 180084, 1227084, 6167660, 10926002, 1429972, 1004];
// Conjugate slot and piece labels together. Both factors are mirror-invariant.
const ORDER = [0, 4, 1, 5, 2, 6, 3, 7, 8, 9, 10, 11];
const OLD_TO_NEW = ORDER.map((_, old) => ORDER.indexOf(old));
const MIRROR = [4, 5, 6, 7, 0, 1, 2, 3, 8, 9, 10, 11];
type Vec = [number, number, number];
type Perm = number[];
const FACE_VECTORS: Vec[] = [[0, 1, 0], [0, -1, 0], [0, 0, 1], [1, 0, 0], [0, 0, -1], [-1, 0, 0]];
const EDGE_NAMES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'LF', 'BL', 'RB'];
// csTimer poly3dlib's FLBRflbr -> URF UFL ULB URB RFD FDL DLB RDB.
const AXES: Vec[] = [[1, 1, 1], [-1, 1, 1], [-1, 1, -1], [1, 1, -1],
  [1, -1, 1], [-1, -1, 1], [-1, -1, -1], [1, -1, -1]];
const IDENTITY = Array.from({ length: 12 }, (_, index) => index);

function check(value: unknown, message: string): asserts value {
  if (!value) throw new Error(`dino-exact: ${message}`);
}
const same = (a: ArrayLike<number>, b: ArrayLike<number>): boolean => a.length === b.length
  && Array.from(a).every((value, index) => value === b[index]);
const key = (p: ArrayLike<number>): string => Array.from(p).join(',');
const compose = (a: ArrayLike<number>, b: ArrayLike<number>): Perm => Array.from(b, value => a[value]);
function inverse(p: ArrayLike<number>): Perm {
  const out = new Array<number>(p.length);
  for (let i = 0; i < p.length; i++) out[p[i]] = i;
  return out;
}
function parity(p: ArrayLike<number>): number {
  let result = 0;
  for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) result ^= Number(p[i] > p[j]);
  return result;
}
const dot = (a: Vec, b: Vec): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Exact Rodrigues formula, unit body diagonal and +/-120 degrees. */
function turn(v: Vec, axis: Vec, direction: number): Vec {
  const d = dot(axis, v);
  const cross = [axis[1] * v[2] - axis[2] * v[1], axis[2] * v[0] - axis[0] * v[2],
    axis[0] * v[1] - axis[1] * v[0]];
  return v.map((value, i) => (-value + axis[i] * d + direction * cross[i]) / 2) as Vec;
}
function edgeVectors(): Vec[] {
  check(DINO_FACES.join(',') === 'U,D,F,R,B,L', 'production face order changed');
  return EDGE_NAMES.map((name, index) => {
    check(DINO_EDGE_FACES[index].map(face => DINO_FACES[face]).join('') === name,
      'production edge order changed');
    const pair = DINO_EDGE_FACES[index];
    return FACE_VECTORS[pair[0]].map((value, axis) => value + FACE_VECTORS[pair[1]][axis]) as Vec;
  });
}
interface Rotation { pull: Perm; vector: (point: Vec) => Vec }
function makeGeometry() {
  const slots = edgeVectors();
  const slotOf = (v: Vec): number => {
    const index = slots.findIndex(slot => same(slot, v));
    check(index >= 0, 'geometric rotation missed an edge slot');
    return index;
  };
  // Even coordinate-axis cycles and an even number of sign changes: the core's
  // 12 proper tetrahedral rotations, not all 24 rotations of a cube shell.
  const rotations: Rotation[] = [];
  for (const axes of [[0, 1, 2], [1, 2, 0], [2, 0, 1]]) {
    for (const signs of [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]) {
      const vector = (v: Vec): Vec => axes.map((axis, i) => signs[i] * v[axis]) as Vec;
      const push = slots.map(slot => slotOf(vector(slot)));
      rotations.push({ pull: inverse(push), vector });
    }
  }
  check(new Set(rotations.map(rotation => key(rotation.pull))).size === 12, 'rotation group size is not 12');
  for (const a of rotations) {
    check(parity(a.pull) === 0, 'core rotation has odd edge parity');
    for (const b of rotations) check(rotations.some(r => same(r.pull, compose(a.pull, b.pull))),
      'core rotations are not closed');
  }
  for (let edge = 0; edge < 12; edge++) {
    check(new Set(rotations.map(r => inverse(r.pull)[edge])).size === 12,
      'core rotations are not free and transitive on edges');
  }
  const rawMoves = DINO_MOVE_NAMES.map((name, move) => {
    const axis = AXES[move >> 1], direction = move % 2 ? 1 : -1;
    const geometric = inverse(slots.map(slot => slotOf(dot(slot, axis) === 2 ? turn(slot, axis, direction) : slot)));
    check(same(geometric, dinoEpFromScramble(name)), `production/geometric move mismatch: ${name}`);
    return dinoEpFromScramble(name);
  });
  const normalizers = rawMoves.map(raw => {
    const anchorSlot = raw.indexOf(11);
    const matches = rotations.filter(rotation => rotation.pull[11] === anchorSlot);
    check(matches.length === 1, 'anchor normalization is not unique');
    return matches[0].pull;
  });
  const normalized = rawMoves.map((raw, move) => compose(raw, normalizers[move]));
  normalized.forEach(move => check(move[11] === 11 && parity(move) === 0, 'normalized move is not in A11'));
  check(new Set(normalized.map(key)).size === MOVES, 'normalized move set has duplicates');
  const inverseMoves = normalized.map(move => {
    const result = normalized.findIndex(candidate => same(candidate, inverse(move)));
    check(result >= 0, 'normalized move set is not inverse-closed');
    return result;
  });
  // Every frame-conjugated physical corner turn must remain a physical token.
  for (const rotation of rotations) for (const raw of rawMoves) {
    check(rawMoves.some(candidate => same(candidate, compose(rotation.pull, compose(raw, inverse(rotation.pull))))),
      'frame conjugation escaped the physical corner generators');
  }
  return { slots, rotations, rawMoves, normalizers, normalized, inverseMoves };
}
type Geometry = ReturnType<typeof makeGeometry>;

function makeFactor(size: number, count: number) {
  const permutations = new Uint8Array(size * count), parities = new Uint8Array(count);
  for (let rank = 0; rank < count; rank++) {
    const p = permutations.subarray(rank * size, (rank + 1) * size);
    unrankPermutation(rank, p);
    check(permutationRank(p) === rank, 'small-factor rank/unrank mismatch');
    parities[rank] = parity(p);
  }
  const table = size === 6 ? new Uint16Array(count * count) : new Uint8Array(count * count);
  const output = new Uint8Array(size);
  for (let shuffle = 0; shuffle < count; shuffle++) for (let rank = 0; rank < count; rank++) {
    for (let i = 0; i < size; i++) output[i] = permutations[rank * size + permutations[shuffle * size + i]];
    table[shuffle * count + rank] = permutationRank(output);
  }
  return { permutations, parities, table };
}

function makeModel() {
  const geometry = makeGeometry(), six = makeFactor(6, P6), five = makeFactor(5, P5);
  const masks: number[] = [], maskIndex = new Int16Array(1 << 11).fill(-1);
  const maskParity = new Uint8Array(COMBINATIONS);
  for (let mask = 0; mask < 1 << 11; mask++) {
    let count = 0, inversions = 0;
    for (let i = 0; i < 11; i++) if (mask & (1 << i)) { inversions += i - count; count++; }
    if (count !== 6) continue;
    maskIndex[mask] = masks.length;
    maskParity[masks.length] = inversions % 2;
    masks.push(mask);
  }
  check(masks.length === COMBINATIONS && masks[0] === 63, 'combination coordinate changed');
  const expandFive = new Uint8Array(P5);
  for (let p = 0; p < 2; p++) for (let half = 0; half < H5; half++) {
    const rank = half * 2 + Number(five.parities[half * 2] !== p);
    check(five.parities[rank] === p, 'parity-compressed S5 coordinate is not bijective');
    expandFive[p * H5 + half] = rank;
  }
  const combinationMoves = new Uint16Array(COMBINATIONS * MOVES);
  const sixShuffleOffsets = new Uint32Array(COMBINATIONS * MOVES);
  const fiveShuffleOffsets = new Uint16Array(COMBINATIONS * MOVES);
  const reordered = geometry.normalized.map(move => ORDER.slice(0, 11).map(slot => OLD_TO_NEW[move[slot]]));
  for (let c = 0; c < COMBINATIONS; c++) {
    const indexWithinGroup = new Uint8Array(11);
    let low = 0, high = 0;
    for (let i = 0; i < 11; i++) indexWithinGroup[i] = masks[c] & (1 << i) ? low++ : high++;
    for (let move = 0; move < MOVES; move++) {
      const lowShuffle: number[] = [], highShuffle: number[] = [];
      let targetMask = 0;
      for (let dest = 0; dest < 11; dest++) {
        const source = reordered[move][dest];
        if (masks[c] & (1 << source)) { targetMask |= 1 << dest; lowShuffle.push(indexWithinGroup[source]); }
        else highShuffle.push(indexWithinGroup[source]);
      }
      const offset = c * MOVES + move;
      combinationMoves[offset] = maskIndex[targetMask];
      sixShuffleOffsets[offset] = permutationRank(lowShuffle) * P6;
      fiveShuffleOffsets[offset] = permutationRank(highShuffle) * P5;
    }
  }
  const mirrorSix = new Uint16Array(P6), mirrorFive = new Uint8Array(P5);
  const relabel = ORDER.map(old => OLD_TO_NEW[MIRROR[old]]);
  for (let rank = 0; rank < P6; rank++) mirrorSix[rank] = permutationRank(
    Array.from(six.permutations.subarray(rank * 6, rank * 6 + 6), piece => relabel[piece]));
  for (let rank = 0; rank < P5; rank++) mirrorFive[rank] = permutationRank(
    Array.from(five.permutations.subarray(rank * 5, rank * 5 + 5), piece => relabel[piece + 6] - 6));
  function encode(ep: ArrayLike<number>): number {
    check(ep[11] === 11 && parity(ep) === 0, 'coordinate input is not anchor-fixed A11');
    let mask = 0;
    const low: number[] = [], high: number[] = [];
    for (let i = 0; i < 11; i++) {
      const piece = OLD_TO_NEW[ep[ORDER[i]]];
      if (piece < 6) { mask |= 1 << i; low.push(piece); } else high.push(piece - 6);
    }
    return maskIndex[mask] * BLOCK + permutationRank(low) * H5 + Math.floor(permutationRank(high) / 2);
  }
  function decode(state: number): Perm {
    const combination = Math.floor(state / BLOCK), local = state % BLOCK, lowRank = Math.floor(local / H5);
    const highRank = expandFive[(maskParity[combination] ^ six.parities[lowRank]) * H5 + local % H5];
    const ep = IDENTITY.slice();
    let low = 0, high = 0;
    for (let i = 0; i < 11; i++) ep[ORDER[i]] = masks[combination] & (1 << i)
      ? ORDER[six.permutations[lowRank * 6 + low++]] : ORDER[five.permutations[highRank * 5 + high++] + 6];
    return ep;
  }
  function next(state: number, move: number): number {
    const combination = Math.floor(state / BLOCK), local = state % BLOCK, lowRank = Math.floor(local / H5);
    const highRank = expandFive[(maskParity[combination] ^ six.parities[lowRank]) * H5 + local % H5];
    const offset = combination * MOVES + move;
    return combinationMoves[offset] * BLOCK + six.table[sixShuffleOffsets[offset] + lowRank] * H5
      + (five.table[fiveShuffleOffsets[offset] + highRank] >> 1);
  }
  function mirrored(state: number): number {
    const combination = Math.floor(state / BLOCK), local = state % BLOCK, lowRank = Math.floor(local / H5);
    const highRank = expandFive[(maskParity[combination] ^ six.parities[lowRank]) * H5 + local % H5];
    return combination * BLOCK + mirrorSix[lowRank] * H5 + (mirrorFive[highRank] >> 1);
  }
  const arrays = [six.permutations, six.parities, six.table, five.permutations, five.parities, five.table,
    maskIndex, maskParity, expandFive, combinationMoves, sixShuffleOffsets, fiveShuffleOffsets, mirrorSix, mirrorFive];
  const modelBytes = arrays.reduce((sum, array) => sum + array.byteLength, 0);
  check(COUNT * 5 + modelBytes < 128 * 2 ** 20, 'model and BFS arrays exceed 128 MiB');
  check(encode(IDENTITY) === 0 && mirrored(mirrored(0)) === 0 && mirrored(0) !== 0, 'goal coordinates are invalid');
  const fingerprint = createHash('sha256').update(JSON.stringify({ format: FORMAT, order: ORDER,
    raw: geometry.rawMoves, normalized: geometry.normalized, mirror: MIRROR })).digest('hex');
  return { ...geometry, six, five, masks, maskParity, expandFive, combinationMoves, sixShuffleOffsets,
    fiveShuffleOffsets, next, mirrored, encode, decode, modelBytes, fingerprint };
}
type Model = ReturnType<typeof makeModel>;

interface PhysicalState { positions: Vec[]; normals: [Vec, Vec][] }
function physicalFromPermutation(model: Geometry, ep: Perm): PhysicalState {
  const locations = inverse(ep);
  const rotations = locations.map((slot, piece) => {
    const found = model.rotations.filter(rotation => same(rotation.vector(model.slots[piece]), model.slots[slot]));
    check(found.length === 1, 'piece orientation is not uniquely determined by its edge slot');
    return found[0];
  });
  return { positions: locations.map(slot => [...model.slots[slot]]),
    normals: rotations.map((rotation, piece) => DINO_EDGE_FACES[piece].map(face => rotation.vector(FACE_VECTORS[face])) as [Vec, Vec]) };
}
/** Independent rigid-body replay; does not use the solver's permutation tables. */
function replayPhysical(model: Geometry, algorithm: string): PhysicalState {
  const state = physicalFromPermutation(model, IDENTITY);
  for (const token of algorithm.trim().split(/\s+/).filter(Boolean)) {
    const move = DINO_MOVE_NAMES.indexOf(token);
    check(move >= 0, `witness contains a non-physical token: ${token}`);
    const axis = AXES[move >> 1], direction = move % 2 ? 1 : -1;
    for (let piece = 0; piece < 12; piece++) {
      if (dot(state.positions[piece], axis) !== 2) continue;
      state.positions[piece] = turn(state.positions[piece], axis, direction);
      state.normals[piece] = state.normals[piece].map(normal => turn(normal, axis, direction)) as [Vec, Vec];
    }
  }
  return state;
}
function physicalPermutation(model: Geometry, state: PhysicalState): Perm {
  const ep = new Array<number>(12).fill(-1);
  state.positions.forEach((position, piece) => {
    const slot = model.slots.findIndex(value => same(value, position));
    check(slot >= 0 && ep[slot] === -1, 'physical replay has duplicate/missing edge slots');
    ep[slot] = piece;
  });
  return ep;
}
function faceColors(state: PhysicalState): number[] | null {
  const colors: number[][] = Array.from({ length: 6 }, () => []);
  state.normals.forEach((normals, piece) => normals.forEach((normal, side) => {
    const face = FACE_VECTORS.findIndex(value => same(value, normal));
    check(face >= 0, 'sticker normal missed a physical face');
    colors[face].push(DINO_EDGE_FACES[piece][side]);
  }));
  if (colors.some(face => face.length !== 4 || face.some(color => color !== face[0]))) return null;
  const result = colors.map(face => face[0]);
  return new Set(result).size === 6 ? result : null;
}
function normalize(model: Geometry, ep: Perm): Perm {
  const rotation = model.rotations.find(value => value.pull[11] === ep.indexOf(11));
  check(rotation, 'no anchor-normalizing rotation');
  return compose(ep, rotation.pull);
}

export type DinoWitnessGoal = 'original-colour-order' | 'mirror-colour-order' | 'either';
/** Exporter verification only: small 3D geometry, no factor/BFS tables or search. */
export function validateDinoWitness(scramble: string, solution: string, expectedGoal: DinoWitnessGoal) {
  check(['original-colour-order', 'mirror-colour-order', 'either'].includes(expectedGoal), 'unknown witness goal');
  const geometry = makeGeometry();
  const physical = replayPhysical(geometry, scramble);
  const sourceEp = physicalPermutation(geometry, physical);
  check(same(sourceEp, dinoEpFromScramble(scramble)), 'independent scramble replay disagrees with the public Dino model');
  const sourceCanonical = normalize(geometry, sourceEp);
  const solved = replayPhysical(geometry, `${scramble} ${solution}`);
  const solvedCanonical = normalize(geometry, physicalPermutation(geometry, solved));
  const original = same(solvedCanonical, IDENTITY), mirror = same(solvedCanonical, MIRROR);
  check(faceColors(solved) !== null && (expectedGoal === 'either' ? original || mirror
    : expectedGoal === 'original-colour-order' ? original : mirror),
  'independent witness replay missed the requested six-colour goal');
  return { canonicalStateKey: key(sourceCanonical), solvedCanonicalStateKey: key(solvedCanonical),
    goal: mirror ? 'mirror-colour-order' : 'original-colour-order',
    scrambleMoveCost: scramble.trim().split(/\s+/).filter(Boolean).length,
    solutionMoveCost: solution.trim().split(/\s+/).filter(Boolean).length,
    independentlyVerified: true };
}

function verifyModel(model: Model): number {
  check(same(faceColors(physicalFromPermutation(model, IDENTITY)) ?? [], [0, 1, 2, 3, 4, 5]), 'normal goal is not six uniform faces');
  check(same(faceColors(physicalFromPermutation(model, MIRROR)) ?? [], [1, 0, 2, 3, 4, 5]), 'mirror goal is not the reflected six-colour solution');
  for (let move = 0; move < MOVES; move++) {
    const physical = replayPhysical(model, DINO_MOVE_NAMES[move]);
    const expected = physicalFromPermutation(model, model.rawMoves[move]);
    check(JSON.stringify(physical) === JSON.stringify(expected), 'slot-derived sticker orientation disagrees with rigid geometry');
  }
  let ep = IDENTITY.slice(), state = 0, seed = 0x31415926, checks = 0;
  for (let probe = 0; probe < 512; probe++) {
    check(same(model.decode(state), ep) && model.encode(ep) === state, 'coordinate round trip failed');
    const mirrorEp = ep.map(piece => MIRROR[piece]);
    check(model.mirrored(state) === model.encode(mirrorEp) && model.mirrored(model.mirrored(state)) === state,
      'mirror coordinate is not the expected label involution');
    for (let move = 0; move < MOVES; move++) {
      const expected = normalize(model, compose(ep, model.rawMoves[move]));
      const next = model.next(state, move);
      check(next === model.encode(expected), 'factor transition disagrees with physical move/normalization');
      check(model.next(next, model.inverseMoves[move]) === state, 'factor inverse transition failed');
      check(model.next(model.mirrored(state), move) === model.mirrored(next), 'mirror does not commute with coordinate moves');
      checks++;
    }
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const move = (seed >>> 16) % MOVES;
    ep = normalize(model, compose(ep, model.rawMoves[move]));
    state = model.next(state, move);
  }
  return checks;
}

/** Small algebra/geometry check only: no state-space distance or queue allocation. */
export function validateDinoExactModel() {
  const model = makeModel();
  return { stateCount: COUNT, goalCount: 1, dualGoalCount: 2, independentTransitionChecks: verifyModel(model),
    modelBytes: model.modelBytes, plannedArrayBytes: model.modelBytes + COUNT * 5, fingerprint: model.fingerprint };
}

interface Checkpoint {
  format: string; modelFingerprint: string; stateCount: number; nextDepth: number;
  complete: boolean; histogram: number[]; visited: number; directedEdgesChecked: number;
  distanceFile: string; sha256: string; graphElapsedMs: number; writtenAt: string;
}
interface Progress { phase: string; depth?: number; visited?: number; frontier?: number; elapsedMs: number; checkpoint?: string }
export interface DinoEnumerationOptions {
  /** Must live inside the resource guard's original run/session directory. */
  checkpointDirectory: string;
  onProgress?: (progress: Progress) => void;
}
function atomicFile(filename: string, bytes: string | Uint8Array): void {
  const temporary = `${filename}.${process.pid}.tmp`;
  const descriptor = openSync(temporary, 'w', 0o600);
  try { writeFileSync(descriptor, bytes); fsyncSync(descriptor); } finally { closeSync(descriptor); }
  renameSync(temporary, filename);
}
function hashDistance(distance: Uint8Array): string {
  return createHash('sha256').update(distance).digest('hex');
}
function saveCheckpoint(directory: string, checkpoint: Omit<Checkpoint, 'distanceFile' | 'sha256' | 'writtenAt'>,
  distance: Uint8Array): Checkpoint {
  const sha256 = hashDistance(distance);
  const distanceFile = `distance-${checkpoint.nextDepth}-${sha256}.bin`;
  const target = path.join(directory, distanceFile), latest = path.join(directory, 'checkpoint.json');
  const previous: Checkpoint | null = existsSync(latest) ? JSON.parse(readFileSync(latest, 'utf8')) : null;
  if (!existsSync(target)) atomicFile(target, distance);
  const saved = { ...checkpoint, distanceFile, sha256, writtenAt: new Date().toISOString() };
  atomicFile(latest, `${JSON.stringify(saved, null, 2)}\n`);
  // Only remove a prior generation after the new manifest is durable. A crash
  // before manifest replacement leaves the previous complete layer resumable.
  if (previous && previous.distanceFile !== distanceFile) {
    check(path.basename(previous.distanceFile) === previous.distanceFile, 'unsafe checkpoint path');
    const previousPath = path.join(directory, previous.distanceFile);
    if (existsSync(previousPath)) unlinkSync(previousPath);
  }
  return saved;
}
function loadCheckpoint(directory: string, model: Model, distance: Uint8Array): Checkpoint | null {
  const manifest = path.join(directory, 'checkpoint.json');
  if (!existsSync(manifest)) return null;
  const checkpoint = JSON.parse(readFileSync(manifest, 'utf8')) as Checkpoint;
  check(checkpoint.format === FORMAT && checkpoint.modelFingerprint === model.fingerprint
    && checkpoint.stateCount === COUNT, 'checkpoint coordinate/model mismatch');
  check(path.basename(checkpoint.distanceFile) === checkpoint.distanceFile, 'unsafe checkpoint distance path');
  const filename = path.join(directory, checkpoint.distanceFile);
  check(statSync(filename).size === COUNT, 'checkpoint distance file has the wrong size');
  const descriptor = openSync(filename, 'r');
  try {
    let offset = 0;
    while (offset < distance.length) {
      const bytes = readSync(descriptor, distance, offset, distance.length - offset, offset);
      check(bytes > 0, 'truncated distance checkpoint'); offset += bytes;
    }
  } finally { closeSync(descriptor); }
  check(hashDistance(distance) === checkpoint.sha256, 'checkpoint distance checksum mismatch');
  const actual: number[] = [];
  for (const depth of distance) if (depth !== 255) {
    check(depth <= checkpoint.nextDepth, 'checkpoint contains a future layer');
    actual[depth] = (actual[depth] ?? 0) + 1;
  }
  check(same(actual, checkpoint.histogram) && distance[0] === 0 && actual[0] === 1,
    'checkpoint histogram does not match its distance data');
  check(actual.reduce((sum, count) => sum + count, 0) === checkpoint.visited, 'checkpoint visited count mismatch');
  check(checkpoint.directedEdgesChecked === MOVES * actual.slice(0, checkpoint.nextDepth).reduce((sum, count) => sum + count, 0),
    'checkpoint expansion frontier does not match its checked edge count');
  check(!checkpoint.complete || checkpoint.visited === COUNT, 'incomplete graph marked complete');
  return checkpoint;
}

function enumerateGraph(model: Model, options: DinoEnumerationOptions) {
  check(options.checkpointDirectory, 'a checkpoint directory is required');
  mkdirSync(options.checkpointDirectory, { recursive: true });
  const distance = new Uint8Array(COUNT), queue = new Uint32Array(COUNT);
  let checkpoint = loadCheckpoint(options.checkpointDirectory, model, distance);
  const resumed = checkpoint !== null;
  if (!checkpoint) {
    distance.fill(255); distance[0] = 0;
    checkpoint = saveCheckpoint(options.checkpointDirectory, { format: FORMAT, modelFingerprint: model.fingerprint,
      stateCount: COUNT, nextDepth: 0, complete: false, histogram: [1], visited: 1,
      directedEdgesChecked: 0, graphElapsedMs: 0 }, distance);
  }
  const histogram = [...checkpoint.histogram];
  let depth = checkpoint.nextDepth, visited = checkpoint.visited, edgeChecks = checkpoint.directedEdgesChecked;
  let head = 0, tail = 0;
  if (!checkpoint.complete) for (let state = 0; state < COUNT; state++) if (distance[state] === depth) queue[tail++] = state;
  check(checkpoint.complete || tail > 0, 'resume frontier is empty');
  const start = performance.now(), priorElapsed = checkpoint.graphElapsedMs;
  const progress = options.onProgress ?? (value => console.log(JSON.stringify({ event: 'dino', ...value })));
  progress({ phase: resumed ? 'resumed' : 'started', depth, visited, frontier: tail, elapsedMs: priorElapsed });
  // Hot loop is table-only: no per-node arrays, maps, permutation unranking or
  // parity calculations. A full 16-neighbour scan proves the graph is closed.
  const { maskParity, expandFive, combinationMoves, sixShuffleOffsets, fiveShuffleOffsets, six, five } = model;
  while (head < tail) {
    const layerEnd = tail;
    while (head < layerEnd) {
      const state = queue[head++], combination = Math.floor(state / BLOCK), local = state % BLOCK;
      const low = Math.floor(local / H5);
      const high = expandFive[(maskParity[combination] ^ six.parities[low]) * H5 + local % H5];
      const offset = combination * MOVES;
      let descending = state === 0;
      for (let move = 0; move < MOVES; move++) {
        const at = offset + move;
        const neighbor = combinationMoves[at] * BLOCK + six.table[sixShuffleOffsets[at] + low] * H5
          + (five.table[fiveShuffleOffsets[at] + high] >> 1);
        let neighborDepth = distance[neighbor];
        if (neighborDepth === 255) {
          check(tail < COUNT && depth + 1 < 255, 'bounded BFS arena exhausted');
          neighborDepth = depth + 1; distance[neighbor] = neighborDepth; queue[tail++] = neighbor;
          histogram[neighborDepth] = (histogram[neighborDepth] ?? 0) + 1; visited++;
        }
        check(Math.abs(neighborDepth - depth) <= 1, 'edge violates shortest-distance Lipschitz bound');
        if (neighborDepth === depth - 1) descending = true;
        edgeChecks++;
      }
      check(descending, 'non-root state has no descending edge');
    }
    depth++;
    checkpoint = saveCheckpoint(options.checkpointDirectory, { format: FORMAT, modelFingerprint: model.fingerprint,
      stateCount: COUNT, nextDepth: depth, complete: head === tail, histogram: [...histogram], visited,
      directedEdgesChecked: edgeChecks, graphElapsedMs: priorElapsed + performance.now() - start }, distance);
    progress({ phase: 'layer-saved', depth: depth - 1, visited, frontier: tail - head,
      elapsedMs: checkpoint.graphElapsedMs, checkpoint: path.join(options.checkpointDirectory, 'checkpoint.json') });
  }
  check(visited === COUNT && edgeChecks === COUNT * MOVES, 'BFS did not cover the complete A11 coordinate space');
  check(same(histogram, SINGLE_HIST), 'single-goal distribution differs from the independent Jaap reference');
  return { distance, histogram, checkpoint, resumed, edgeChecks, graphMs: performance.now() - start };
}

function descendingPath(model: Model, distance: Uint8Array, original: number): number[] {
  const result: number[] = [];
  let state = original;
  while (distance[state] > 0) {
    let selected = -1;
    for (let move = 0; move < MOVES; move++) {
      const next = model.next(state, move);
      if (distance[next] + 1 === distance[state]) { selected = move; state = next; break; }
    }
    check(selected >= 0 && result.length < 32, 'could not extract a shortest descending witness');
    result.push(selected);
  }
  return result;
}
/** Convert free canonical-frame changes to conjugated physical corner tokens. */
function liftPath(model: Model, moves: number[], initialFrame = IDENTITY) {
  let frame = initialFrame.slice();
  const tokens: string[] = [];
  for (const move of moves) {
    const physical = compose(frame, compose(model.rawMoves[move], inverse(frame)));
    const index = model.rawMoves.findIndex(raw => same(raw, physical));
    check(index >= 0, 'canonical path cannot be expressed as a physical corner turn');
    tokens.push(DINO_MOVE_NAMES[index]);
    frame = compose(frame, model.normalizers[move]);
  }
  return { tokens, frame };
}

/** All possible accumulated frame changes fit in 12 x 16 byte tables. */
function downloadLiftingTables(model: Model) {
  const physicalMove = new Uint8Array(12 * MOVES), nextFrame = new Uint8Array(12 * MOVES);
  const frames = model.rotations.map(rotation => rotation.pull);
  const identityFrame = frames.findIndex(frame => same(frame, IDENTITY));
  check(identityFrame >= 0, 'download frame group has no identity');
  for (let f = 0; f < frames.length; f++) for (let move = 0; move < MOVES; move++) {
    const physical = compose(frames[f], compose(model.rawMoves[move], inverse(frames[f])));
    const physicalIndex = model.rawMoves.findIndex(raw => same(raw, physical));
    const frameIndex = frames.findIndex(frame => same(frame, compose(frames[f], model.normalizers[move])));
    check(physicalIndex >= 0 && frameIndex >= 0, 'download frame table is not closed');
    physicalMove[f * MOVES + move] = physicalIndex;
    nextFrame[f * MOVES + move] = frameIndex;
  }
  return { physicalMove, nextFrame, identityFrame };
}

/** No distance table or BFS: independently replay 128 short lifted paths. */
export function validateDinoDownloadLifting() {
  const model = makeModel(), tables = downloadLiftingTables(model);
  let seed = 0x31415926;
  for (let probe = 0; probe < 128; probe++) {
    const moves: number[] = [], tokens: string[] = [];
    let state = 0, frame = tables.identityFrame;
    for (let step = 0; step < probe % 32; step++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const move = (seed >>> 16) % MOVES, at = frame * MOVES + move;
      moves.push(move); state = model.next(state, move);
      tokens.push(DINO_MOVE_NAMES[tables.physicalMove[at]]); frame = tables.nextFrame[at];
    }
    check(tokens.join(' ') === liftPath(model, moves).tokens.join(' '), 'download lifting differs from reference');
    check(model.encode(normalize(model, physicalPermutation(model, replayPhysical(model, tokens.join(' '))))) === state,
      'download lifting misses its independent physical state');
  }
  return { independentPathChecks: 128, frameTransitionsChecked: 12 * MOVES, modelBytes: model.modelBytes };
}

function dinoAllStates(model: Model, distance: Uint8Array, checkpoint: Checkpoint, dual: boolean): ResumableExactStates {
  const tables = downloadLiftingTables(model);
  const resumeKey = createHash('sha256').update(readFileSync(new URL(import.meta.url)))
    .update(JSON.stringify([checkpoint.sha256, model.fingerprint, DINO_MOVE_NAMES, dual])).digest('hex');
  function* resume(startRow: number) {
    check(Number.isSafeInteger(startRow) && startRow >= 0 && startRow <= COUNT, 'invalid Dino resume row');
    const pathMoves = new Uint8Array(32), tokens: string[] = [];
    for (let original = startRow; original < COUNT; original++) {
      let state = original, length = 0;
      while (distance[state] > 0) {
        let selected = -1;
        for (let move = 0; move < MOVES; move++) {
          const next = model.next(state, move);
          if (distance[next] + 1 === distance[state]) { selected = move; state = next; break; }
        }
        check(selected >= 0 && length < pathMoves.length, 'download state has no descending edge');
        pathMoves[length++] = model.inverseMoves[selected];
      }
      check(length === distance[original], 'Dino download path length differs from its identity distance');
      tokens.length = 0;
      let frame = tables.identityFrame;
      for (let step = length - 1; step >= 0; step--) {
        const at = frame * MOVES + pathMoves[step];
        tokens.push(DINO_MOVE_NAMES[tables.physicalMove[at]]); frame = tables.nextFrame[at];
      }
      // A row always identifies a state by a scramble from the original goal.
      // With two accepted goals its shortest solving distance can be smaller
      // than that scramble's length; the mirror goal has a nonempty scramble.
      yield { depth: dual ? Math.min(distance[original], distance[model.mirrored(original)]) : distance[original],
        scramble: tokens.join(' ') };
    }
  }
  return { total: COUNT, resumeKey, resume, [Symbol.iterator]: () => resume(0) };
}

/** Download-only entry: requires an existing completed checkpoint. Allocates
 * the 20 MB byte table and small factors; never allocates a queue or runs BFS. */
export function prepareDinoStateDownloads(options: Pick<DinoEnumerationOptions, 'checkpointDirectory'>) {
  const model = makeModel(), distance = new Uint8Array(COUNT);
  const checkpoint = loadCheckpoint(options.checkpointDirectory, model, distance);
  check(checkpoint?.complete && checkpoint.visited === COUNT && checkpoint.directedEdgesChecked === COUNT * MOVES,
    'Dino downloads require the original completed BFS checkpoint');
  check(same(checkpoint.histogram, SINGLE_HIST), 'Dino checkpoint differs from the independent reference');
  return { total: COUNT, histogram: [...SINGLE_HIST], allStates: dinoAllStates(model, distance, checkpoint, false),
    mirrorAccepted: { total: COUNT, histogram: [...DUAL_HIST], allStates: dinoAllStates(model, distance, checkpoint, true) },
    checkpoint, estimatedArrayBytes: model.modelBytes + distance.byteLength + 2 * 12 * MOVES };
}
function makeExample(model: Model, distance: Uint8Array, state: number, dual: boolean) {
  const toIdentity = descendingPath(model, distance, state);
  const forward = toIdentity.slice().reverse().map(move => model.inverseMoves[move]);
  const scramblePath = liftPath(model, forward);
  const mirrorState = model.mirrored(state);
  const mirrorGoal = dual && distance[mirrorState] < distance[state];
  const expectedDistance = Math.min(distance[state], dual ? distance[mirrorState] : 255);
  const pathToGoal = mirrorGoal ? descendingPath(model, distance, mirrorState) : toIdentity;
  const solutionPath = liftPath(model, pathToGoal, scramblePath.frame);
  const scramble = scramblePath.tokens.join(' '), solution = solutionPath.tokens.join(' ');
  const physical = replayPhysical(model, scramble);
  check(model.encode(normalize(model, physicalPermutation(model, physical))) === state,
    'independent physical scramble replay missed its canonical state');
  const solved = replayPhysical(model, `${scramble} ${solution}`);
  const solvedEp = normalize(model, physicalPermutation(model, solved));
  check(same(solvedEp, mirrorGoal ? MIRROR : IDENTITY) && faceColors(solved) !== null,
    'independent physical solution replay did not reach the claimed six-colour goal');
  check(solutionPath.tokens.length === expectedDistance, 'physical shortest witness has the wrong move cost');
  return { distance: expectedDistance, scramble, solution, state, moveCost: expectedDistance,
    goal: mirrorGoal ? 'mirror-colour-order' : 'original-colour-order' };
}

export async function enumerateDino(options: DinoEnumerationOptions) {
  const started = performance.now(), model = makeModel(), preparationMs = performance.now() - started;
  let phase = performance.now();
  const independentTransitionChecks = verifyModel(model);
  const verificationMs = performance.now() - phase;
  const graph = enumerateGraph(model, options);
  phase = performance.now();
  const dualHistogram: number[] = [], singleSamples: number[][] = [], dualSamples: number[][] = [];
  for (let state = 0; state < COUNT; state++) {
    const depth = graph.distance[state];
    check(depth !== 255, 'completed distance array still contains unseen states');
    const mirrorDepth = graph.distance[model.mirrored(state)], dualDepth = Math.min(depth, mirrorDepth);
    dualHistogram[dualDepth] = (dualHistogram[dualDepth] ?? 0) + 1;
    const singleBin = singleSamples[depth] ??= [], dualBin = dualSamples[dualDepth] ??= [];
    const singleLimit = depth === SINGLE_HIST.length - 1 && SINGLE_HIST[depth] <= 256 ? 256 : 12;
    const dualLimit = dualDepth === DUAL_HIST.length - 1 && DUAL_HIST[dualDepth] <= 256 ? 256 : 12;
    if (singleBin.length < singleLimit) singleBin.push(state);
    if (dualBin.length < dualLimit) dualBin.push(state);
  }
  check(same(dualHistogram, DUAL_HIST), 'two-goal distribution differs from the independent Jaap reference');
  const deriveMirrorMs = performance.now() - phase;
  phase = performance.now();
  const examples = singleSamples.flatMap(bin => bin.map(state => makeExample(model, graph.distance, state, false)));
  const dualExamples = dualSamples.flatMap(bin => bin.map(state => makeExample(model, graph.distance, state, true)));
  const examplesMs = performance.now() - phase;
  check(new Set(examples.map(example => example.distance)).size === graph.histogram.length
    && new Set(dualExamples.map(example => example.distance)).size === dualHistogram.length,
  'a nonempty histogram bin has no independently replayed example');
  return {
    id: 'dino', label: 'Dino Cube / 恐龙魔方', total: COUNT, stateCount: COUNT,
    metric: '120-degree corner turn in either direction = 1; 12 tetrahedral whole rotations ignored; original colour-order goal',
    goalCount: 1, godsNumber: graph.histogram.length - 1, histogram: graph.histogram, examples,
    examplesLimitPerDepth: 12, deepestExamplesComplete: true,
    mirrorAccepted: { goalCount: 2, godsNumber: dualHistogram.length - 1, histogram: dualHistogram,
      examples: dualExamples, examplesLimitPerDepth: 12, deepestExamplesComplete: false,
      metric: 'same moves and 19,958,400 states; either original or mirror colour-order goal',
      derivation: 'min(d(state), d(mirror relabeling(state))); label relabeling commutes with every normalized move' },
    estimatedArrayBytes: model.modelBytes + COUNT * 5, denseCoordinateUpperBound: COUNT,
    timingMs: { graph: preparationMs + graph.graphMs, examples: examplesMs, solve: 0,
      verification: verificationMs, mirrorDerivation: deriveMirrorMs },
    elapsedMs: performance.now() - started,
    checkpoint: { resumed: graph.resumed, directory: options.checkpointDirectory, ...graph.checkpoint },
    distanceTable: { path: path.join(options.checkpointDirectory, graph.checkpoint.distanceFile),
      bytes: COUNT, sha256: graph.checkpoint.sha256, format: FORMAT,
      scope: 'one Uint8 exact single-goal distance per canonical A11 state; mirror distances derived by label involution' },
    verification: { closed: true, directedEdgesChecked: graph.edgeChecks,
      allEdgesDistanceDifferenceAtMostOne: true, allNonRootStatesHaveDescendingEdge: true,
      independentTransitionChecks, independentlyReplayedExamples: examples.length + dualExamples.length,
      independentReplay: 'integer Rodrigues 3D edge-centre and 24-sticker-normal model; all emitted tokens are physical FLBRflbr turns',
      normalAndMirrorGoalsHaveSixUniformFaces: true, referenceHistogramMatches: true,
      referenceHistogramSource: REFERENCE, moveNames: DINO_MOVE_NAMES,
      scope: 'complete six-colour Dino modulo 12 legal core rotations; primary one-goal and separate two-goal metrics' },
  };
}
