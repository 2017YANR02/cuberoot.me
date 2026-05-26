/**
 * Public surface of the cube preview module. TimerPage / Round 2
 * integration code should import from here.
 */

export { default as CubePreview } from './CubePreview';
/** @deprecated Import directly from `@/components/CubingPreview` instead. */
export { default as CubingPreview } from '@/components/CubingPreview';
export { WCA_COLORS, nxnSizeForEvent } from './colors';
export {
  applyMoves,
  applyScramble,
  facesEqual,
  solved,
} from './state';
export type { CubeFaces, FaceArr } from './state';
export { parseScramble, FACES } from './moves';
export type { Face, ParsedMove } from './moves';
