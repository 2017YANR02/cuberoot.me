/**
 * 21 PLL cases with id/name/alg, sourced from @cuberoot/shared/data/pll.json.
 * Used by the PLL trainer subset filter; uses the `noAuf` variant for scrambles.
 */

import pllMap from '@cuberoot/shared/data/pll.json';

export interface PllCase {
  id: string;
  name: string;
  alg: string;
}

const typed = pllMap as Record<string, { noAuf: string }>;

export const PLL_CASES: readonly PllCase[] = Object.entries(typed).map(([id, v]) => ({
  id,
  name: id,
  alg: v.noAuf,
}));
