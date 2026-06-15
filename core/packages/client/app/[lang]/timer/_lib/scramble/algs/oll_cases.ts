/**
 * OLL case list with id/name/group, sourced from @cuberoot/shared/data/oll.json.
 * Used by the OLL trainer subset filter; ordered "OLL 1" .. "OLL 57".
 */

import ollMap from '@cuberoot/shared/data/oll.json';

export interface OllCase {
  id: string;
  name: string;
  alg: string;
  group: string;
}

const typed = ollMap as Record<string, { name: string; alg: string; alg2: string; group: string }>;

export const OLL_CASES: readonly OllCase[] = Object.entries(typed).map(([id, v]) => ({
  id,
  name: v.name,
  alg: v.alg,
  group: v.group,
}));
