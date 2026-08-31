/**
 * WCA standard cube colour palette and the NxN-event lookup table.
 * Kept in a .ts file (not .tsx) so the React-refresh linter is happy.
 */

import type { Face } from './moves.ts';

export const WCA_COLORS: Record<Face, string> = {
  U: '#FFFFFF',
  D: '#FFD500',
  F: '#009B48',
  B: '#0046AD',
  L: '#FF5800',
  R: '#B71234',
};

/** Compatibility export; the cross-runtime event capability lives in shared. */
export { timerEventNxnSize as nxnSizeForEvent } from '@cuberoot/shared/timer';
