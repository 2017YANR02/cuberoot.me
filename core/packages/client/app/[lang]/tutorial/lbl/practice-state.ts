import { Alg } from 'cubing/alg';
import { AllFaces, CubeData, parseAlgorithm } from '@cuberoot/visualcube';
import { CUBE_ORIENTATIONS } from '@/lib/cube-orientation';
import { FM_FIXED_COLOR, FM_IGNORED } from '@cuberoot/puzzle-render-core/engine/nxn/stickering';

/** Compare all six masked faces, not the move text or only the visible camera side. */
export function practiceState(colors: string[], alg: string): string {
  const faces = Object.fromEntries(AllFaces.map((face, i) => [face, colors.slice(i * 9, (i + 1) * 9)]));
  const cube = new CubeData(3, faces);
  for (const turn of parseAlgorithm(new Alg(alg).expand().toString())) cube.turn(turn);
  return JSON.stringify(AllFaces.map(face => cube.faces[face]));
}

/** Rotate independent masked states; never change the player's state or camera. */
export function practiceTargetStates(colors: string[], alg: string): Set<string> {
  return new Set(CUBE_ORIENTATIONS.map(({ value }) => practiceState(colors, `${alg} ${value}`)));
}

// Facelets in URFDLB order. Each triplet belongs to one physical corner.
const topCorners = [[8, 9, 20], [6, 18, 38], [0, 36, 47], [2, 45, 11]];
const bottomCorners = [[29, 26, 15], [27, 44, 24], [33, 53, 42], [35, 17, 51]];
const stickerIds = Array.from({ length: 54 }, (_, i) => String(i));
const lowerLayerSlots = Array.from({ length: 54 }, (_, i) => i).filter(i =>
  Math.floor(i / 9) === 3 || (Math.floor(i / 9) !== 0 && i % 9 >= 3));
const identityState = (alg: string): string[] => (JSON.parse(practiceState(stickerIds, alg)) as string[][]).flat();

const normalizedState = (alg: string): string[] => {
  for (const { value } of CUBE_ORIENTATIONS) {
    const state = identityState(`${alg} ${value}`);
    if ([4, 13, 22, 31, 40, 49].every(i => state[i] === stickerIds[i])) return state;
  }
  throw new Error('Cube centers could not be aligned');
};

/** Either Sune handedness, with the yellow cross and solved first two layers. */
export function isFishWithSolvedLowerLayers(alg: string): boolean {
  const state = normalizedState(alg);
  const topCornerStickers = [0, 2, 6, 8];
  const topEdgeStickers = [1, 3, 5, 7];
  return lowerLayerSlots.every(i => state[i] === stickerIds[i])
    && topEdgeStickers.every(i => topEdgeStickers.includes(Number(state[i])))
    && topCornerStickers.filter(i => topCornerStickers.includes(Number(state[i]))).length === 1;
}

/** Eject the specified corner, preserving the cross and already solved corners. */
export function bottomCornerGoal(setup: string, target: string, colors: string[]) {
  const initial = normalizedState(setup);
  const reference = normalizedState(target);
  const upper = topCorners.flat();
  const slot = bottomCorners.find(corner => corner.every(i => upper.some(j => reference[j] === initial[i])));
  if (!slot) throw new Error('Bottom-corner exercise has no ejected target corner');
  const targetIds = slot.map(i => initial[i]);
  const protectedSlots = [28, 30, 32, 34, 16, 25, 43, 52,
    ...bottomCorners.filter(corner => corner.every(i => initial[i] === stickerIds[i])).flat()];
  return {
    targetColors: colors.map((color, i) => targetIds.includes(String(i)) ? '#a855f7' : color),
    matches(alg: string): boolean {
      const state = normalizedState(alg);
      return targetIds.every(id => upper.some(i => state[i] === id))
        && protectedSlots.every(i => state[i] === stickerIds[i]);
    },
  };
}

const middleEdges = [[23, 12], [21, 41], [50, 39], [48, 14]];
const topEdges = [[1, 46], [3, 37], [5, 10], [7, 19]];

/** A wall with either remaining edge-cycle direction; keep F2L and top corners solved. */
export function isWallWithSolvedLowerLayers(alg: string): boolean {
  const state = normalizedState(alg);
  const upperStickers = topEdges.map(edge => edge[0]);
  return lowerLayerSlots.every(i => state[i] === stickerIds[i])
    && topCorners.flat().every(i => state[i] === stickerIds[i])
    && upperStickers.every(i => upperStickers.includes(Number(state[i])))
    && topEdges.some(edge => edge.every(i => state[i] === stickerIds[i]));
}

/** Follow the ejected physical edge, independent of its top-layer slot or flip. */
export function middleEdgeGoal(setup: string, target: string, colors: string[]) {
  const initial = normalizedState(setup);
  const reference = normalizedState(target);
  const upper = topEdges.flat();
  const slot = middleEdges.find(edge => edge.every(i => upper.some(j => reference[j] === initial[i])));
  if (!slot) throw new Error('Middle-edge exercise has no ejected target edge');
  const targetIds = slot.map(i => initial[i]);
  const hiddenIds = middleEdges.flat().map(String).filter(id => !targetIds.includes(id));
  // All stickers belonging to bottom-layer edges and corners, in URFDLB order.
  // Normalize centers first so whole-cube view rotations remain acceptable.
  const bottomSlots = [27, 28, 29, 30, 32, 33, 34, 35,
    15, 16, 17, 24, 25, 26, 42, 43, 44, 51, 52, 53];
  const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
  return {
    hiddenStickers: hiddenIds.map(id => `${faces[Math.floor(Number(id) / 9)]}${Number(id) % 9}`),
    targetColors: colors.map((color, i) => targetIds.includes(String(i)) ? '#a855f7'
      : hiddenIds.includes(String(i)) ? FM_FIXED_COLOR[FM_IGNORED]! : color),
    matches(alg: string): boolean {
      const state = normalizedState(alg);
      return targetIds.every(id => upper.some(i => state[i] === id))
        && bottomSlots.every(i => state[i] === initial[i]);
    },
  };
}
