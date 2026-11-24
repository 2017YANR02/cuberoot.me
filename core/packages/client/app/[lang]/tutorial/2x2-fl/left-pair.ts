import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { ENGINE_TO_VC_FACE, netIndexOf } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { CubeData, parseAlgorithm } from '@cuberoot/visualcube';
import type { AlgStickerPlacement } from '@/components/AlgPlayer/AlgPlayer';
import { FL_WGO_HOME, FL_WRG_HOME } from './lesson-data';

export const FL_LEFT_BACK = 0;
export const FL_LEFT_FRONT = 4;
const poseCount = 24;
const cornerSlots = Array.from({ length: 8 }, (_, slot) => slot);
const recognitionSlots = cornerSlots.filter(slot => slot !== FL_LEFT_BACK && slot !== FL_LEFT_FRONT);
const pairDrawCount = (slots: readonly number[]) => slots.length * (slots.length - 1) * 9;
const turnVariants = (axis: string) => [axis, axis + '2', axis + "'"];
const faceTurns = ['F', 'B', 'L', 'U', 'R', 'D'].flatMap(turnVariants);
const hintTurns = [...['x', 'y', 'z'].flatMap(turnVariants), ...faceTurns];
const recognitionTurns = ['U', 'R'].flatMap(turnVariants);
const invertTurn = (move: string) => move.endsWith('2') ? move : invertMoveString(move);

// Track each corner by its slot and the face carrying its white sticker.
const poses = Array.from({ length: 8 }, (_, position) => {
  const [x, y, z] = [position & 1, (position >> 1) & 1, position >> 2];
  return [x ? FACE.R : FACE.L, y ? FACE.U : FACE.D, z ? FACE.F : FACE.B].map(face => ({
    face, netFace: ENGINE_TO_VC_FACE[face], index: netIndexOf(x, y, z, face, 1, 2),
  }));
}).flat();

export function flCornerPairState(first: AlgStickerPlacement, second: AlgStickerPlacement) {
  const index = ({ positionIndex, face }: AlgStickerPlacement) =>
    3 * positionIndex + poses.slice(3 * positionIndex, 3 * positionIndex + 3).findIndex(pose => pose.face === FACE[face]);
  return index(first) * poseCount + index(second);
}

export const FL_LEFT_PAIR_GOAL = flCornerPairState(
  { positionIndex: FL_LEFT_BACK, face: 'D' }, { positionIndex: FL_LEFT_FRONT, face: 'D' },
);
const recognitionGoal = flCornerPairState(
  { positionIndex: FL_WRG_HOME, face: 'D' }, { positionIndex: FL_WGO_HOME, face: 'D' },
);

function stateForDraw(draw: number, slots: readonly number[]) {
  const otherSlots = slots.length - 1;
  const firstIndex = Math.floor(draw / (9 * otherSlots));
  const secondChoice = Math.floor(draw / 9) % otherSlots;
  const secondIndex = secondChoice + Number(secondChoice >= firstIndex);
  const first = 3 * slots[firstIndex] + Math.floor(draw / 3) % 3;
  const second = 3 * slots[secondIndex] + draw % 3;
  return first * poseCount + second;
}

const goalBackSlot = Math.floor(FL_LEFT_PAIR_GOAL / poseCount / 3);
const goalFrontSlot = Math.floor((FL_LEFT_PAIR_GOAL % poseCount) / 3);
// Encode the solved draw with vertical white stickers (orientation index 1).
const goalDraw = (goalBackSlot * 7 + goalFrontSlot - Number(goalFrontSlot > goalBackSlot)) * 9 + 3 + 1;

const moveMaps = new Map<string, Uint8Array>();
function mapForMove(move: string) {
  const cached = moveMaps.get(move);
  if (cached) return cached;
  const cube = new CubeData(2);
  for (const [label, pose] of poses.entries()) cube.faces[pose.netFace][pose.index] = label;
  for (const turn of parseAlgorithm(move)) cube.turn(turn);
  const map = new Uint8Array(poseCount);
  for (const [index, pose] of poses.entries()) map[cube.faces[pose.netFace][pose.index] as number] = index;
  moveMaps.set(move, map);
  return map;
}

function shortestPairSolution(state: number, goal: number, moves: readonly string[]): string[] {
  if (state === goal) return [];
  const maps = moves.map(mapForMove);
  const parent = new Int16Array(poseCount * poseCount).fill(-1);
  const via = new Uint8Array(parent.length);
  const queue = [goal];
  parent[goal] = goal;
  for (let head = 0; head < queue.length && parent[state] === -1; head++) {
    const previous = queue[head];
    const back = Math.floor(previous / poseCount);
    const front = previous % poseCount;
    for (const [index, map] of maps.entries()) {
      const next = map[back] * poseCount + map[front];
      if (parent[next] !== -1) continue;
      parent[next] = previous;
      via[next] = index;
      queue.push(next);
    }
  }
  if (parent[state] === -1) throw new Error('Unreachable 2×2 corner-pair state');
  const solution = [];
  for (let cursor = state; cursor !== goal; cursor = parent[cursor]) {
    solution.push(invertTurn(moves[via[cursor]]));
  }
  return solution;
}

/** Find a shortest hint for the left pair, counting layer turns and rotations as one action each. */
export function solveFlLeftPair(state: number): string[] {
  return shortestPairSolution(state, FL_LEFT_PAIR_GOAL, hintTurns);
}

function uniformBelow(limit: number) {
  const word = new Uint32Array(1);
  const ceiling = 2 ** 32 - (2 ** 32 % limit);
  do { crypto.getRandomValues(word); } while (word[0] >= ceiling);
  return word[0] % limit;
}

export function randomFlLeftPairSetup(randomBelow = uniformBelow) {
  const draw = randomBelow(pairDrawCount(cornerSlots) - 1);
  const state = stateForDraw(draw + Number(draw >= goalDraw), cornerSlots);
  const solution = shortestPairSolution(state, FL_LEFT_PAIR_GOAL, faceTurns);
  // Shuffle the other corners with turns that preserve the solved left pair.
  const rest = ['R', 'U', 'R', 'U'].map(face => face + ['', '2', "'"][randomBelow(3)]);
  return [...rest, ...solution.reverse().map(invertTurn)].join(' ');
}

/** Sample visible third/fourth corner poses with the solved left pair held fixed. */
export function randomFlCornerQuizSetup(previous: number, randomBelow = uniformBelow) {
  const candidates = Array.from({ length: pairDrawCount(recognitionSlots) }, (_, draw) => stateForDraw(draw, recognitionSlots))
    .filter(state => state !== recognitionGoal && state !== previous);
  const target = candidates[randomBelow(candidates.length)];
  return shortestPairSolution(recognitionGoal, target, recognitionTurns).join(' ');
}
