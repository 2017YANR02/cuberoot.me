import { FACE } from '@cuberoot/puzzle-render-core/engine/define';
import { ENGINE_TO_VC_FACE, netIndexOf } from '@cuberoot/puzzle-render-core/engine/nxn/netIndex';
import { invertMoveString } from '@cuberoot/shared/alg-notation';
import { CubeData, parseAlgorithm } from '@cuberoot/visualcube';
import type { AlgStickerPlacement } from '@/components/AlgPlayer/AlgPlayer';

export const FL_LEFT_BACK = 0;
export const FL_LEFT_FRONT = 4;
const poseCount = 24;
const drawCount = 8 * 7 * 3 * 3;
const turnVariants = (axis: string) => [axis, axis + '2', axis + "'"];
const faceTurns = ['F', 'B', 'L', 'U', 'R', 'D'].flatMap(turnVariants);
const hintTurns = [...['x', 'y', 'z'].flatMap(turnVariants), ...faceTurns];
const invertTurn = (move: string) => move.endsWith('2') ? move : invertMoveString(move);

// Track each corner by its slot and the face carrying its white sticker.
const poses = Array.from({ length: 8 }, (_, position) => {
  const [x, y, z] = [position & 1, (position >> 1) & 1, position >> 2];
  return [x ? FACE.R : FACE.L, y ? FACE.U : FACE.D, z ? FACE.F : FACE.B].map(face => ({
    face, netFace: ENGINE_TO_VC_FACE[face], index: netIndexOf(x, y, z, face, 1, 2),
  }));
}).flat();

export function flLeftPairState(back: AlgStickerPlacement, front: AlgStickerPlacement) {
  const index = ({ positionIndex, face }: AlgStickerPlacement) =>
    3 * positionIndex + poses.slice(3 * positionIndex, 3 * positionIndex + 3).findIndex(pose => pose.face === FACE[face]);
  return index(back) * poseCount + index(front);
}

export const FL_LEFT_PAIR_GOAL = flLeftPairState(
  { positionIndex: FL_LEFT_BACK, face: 'D' }, { positionIndex: FL_LEFT_FRONT, face: 'D' },
);

function stateForDraw(draw: number) {
  const backSlot = Math.floor(draw / 63);
  const frontChoice = Math.floor(draw / 9) % 7;
  const frontSlot = frontChoice + Number(frontChoice >= backSlot);
  const back = 3 * backSlot + Math.floor(draw / 3) % 3;
  const front = 3 * frontSlot + draw % 3;
  return back * poseCount + front;
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

function shortestLeftPairSolution(state: number, moves: readonly string[]): string[] {
  if (state === FL_LEFT_PAIR_GOAL) return [];
  const maps = moves.map(mapForMove);
  const parent = new Int16Array(poseCount * poseCount).fill(-1);
  const via = new Uint8Array(parent.length);
  const queue = [FL_LEFT_PAIR_GOAL];
  parent[FL_LEFT_PAIR_GOAL] = FL_LEFT_PAIR_GOAL;
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
  if (parent[state] === -1) throw new Error('Unreachable 2×2 left-pair state');
  const solution = [];
  for (let cursor = state; cursor !== FL_LEFT_PAIR_GOAL; cursor = parent[cursor]) {
    solution.push(invertTurn(moves[via[cursor]]));
  }
  return solution;
}

/** Find a shortest hint for the left pair, counting layer turns and rotations as one action each. */
export function solveFlLeftPair(state: number): string[] {
  return shortestLeftPairSolution(state, hintTurns);
}

function uniformBelow(limit: number) {
  const word = new Uint32Array(1);
  const ceiling = 2 ** 32 - (2 ** 32 % limit);
  do { crypto.getRandomValues(word); } while (word[0] >= ceiling);
  return word[0] % limit;
}

export function randomFlLeftPairSetup(randomBelow = uniformBelow) {
  const draw = randomBelow(drawCount - 1);
  const solution = shortestLeftPairSolution(stateForDraw(draw + Number(draw >= goalDraw)), faceTurns);
  // Shuffle the other corners with turns that preserve the solved left pair.
  const rest = ['R', 'U', 'R', 'U'].map(face => face + ['', '2', "'"][randomBelow(3)]);
  return [...rest, ...solution.reverse().map(invertTurn)].join(' ');
}
