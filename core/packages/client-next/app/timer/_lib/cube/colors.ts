/**
 * WCA standard cube colour palette and the NxN-event lookup table.
 * Kept in a .ts file (not .tsx) so the React-refresh linter is happy.
 */

import type { Face } from './moves.ts';
import type { EventId } from '../types.ts';

export const WCA_COLORS: Record<Face, string> = {
  U: '#FFFFFF',
  D: '#FFD500',
  F: '#009B48',
  B: '#0046AD',
  L: '#FF5800',
  R: '#B71234',
};

const NXN_FOR_EVENT: Partial<Record<EventId, number>> = {
  '222': 2,
  '333': 3, '333oh': 3, '333bld': 3, '333ni': 3, '333fm': 3, '333mr': 3,
  'cross': 3, 'f2l': 3, 'll': 3, 'oll': 3, 'pll': 3,
  'coll': 3, 'cmll': 3, 'zbll': 3, 'eg1': 3, 'eg2': 3,
  '444': 4, '444bld': 4,
  '555': 5, '555bld': 5,
  '666': 6, '666bld': 6,
  '777': 7, '777bld': 7,
};

/** Return the NxN cube size for events that map to an NxN, else null. */
export function nxnSizeForEvent(event: EventId): number | null {
  const n = NXN_FOR_EVENT[event];
  return n ?? null;
}
