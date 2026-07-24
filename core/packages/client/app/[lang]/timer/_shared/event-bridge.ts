/**
 * Event-id bridge (Solo + Battle) — one import site for WCA event mapping.
 *
 * Timer's EventId set (../_lib/types) is broader than WCA: it adds relays
 * (r3/r4/r5), CFOP-step training (cross/f2l/ll/oll/pll), LL-subset training
 * (coll/cmll/zbll/eg1/eg2), custom, and a few shape mods. rank/preview UIs
 * only understand real WCA event ids, so map there and return null for the
 * rest.
 */

import type { EventId } from '../_lib/types';
import { toWcaEventId, isWcaEvent, eventDisplayName } from '@/lib/wca-events';

export { toWcaEventId, isWcaEvent, eventDisplayName };

/** Timer EventId -> WCA standard id (the spelling WCA/rank uses). */
const TIMER_TO_WCA: Partial<Record<EventId, string>> = {
  '222': '222', '333': '333', '444': '444', '555': '555', '666': '666', '777': '777',
  '333oh': '333oh', '333fm': '333fm',
  '333bld': '333bf', '333mbld': '333mbf', '333ni': '333bf',
  '444bld': '444bf', '555bld': '555bf',
  pyra: 'pyram', skewb: 'skewb', sq1: 'sq1', mega: 'minx', clock: 'clock',
  magic: 'magic', mmagic: 'mmagic',
};

/**
 * Map a timer EventId to a WCA event id usable by rank/preview, or null when
 * the event has no WCA equivalent (relays, CFOP/LL training sets, custom,
 * 666bld/777bld which are not WCA, mirror blocks, etc.).
 */
export function toWcaEventForRank(eventId: EventId): string | null {
  return TIMER_TO_WCA[eventId] ?? null;
}

/**
 * Timer EventId -> the `/recon` event vocabulary ('3x3' / 'oh' / '3bld' / …).
 *
 * `lib/recon-utils.ts` (`buildExternalLinks`, `getPuzzleId`, `getCubedbPuzzle`)
 * keys on these, NOT on WCA ids — hence a second table rather than reusing
 * TIMER_TO_WCA. Anything absent has no sensible single puzzle for an external
 * alg viewer (relays span several cubes, `custom` is unknown, magic/clock-less
 * oddities have no puzzle id) and maps to null so callers hide the links.
 *
 * Shape mods and the 3x3-notation training sets DO map: their scramble and
 * solution are plain 3x3 (or 2x2 for EG) notation, which is all the viewers need.
 */
const TIMER_TO_RECON: Partial<Record<EventId, string>> = {
  '222': '2x2', '333': '3x3', '444': '4x4', '555': '5x5', '666': '6x6', '777': '7x7',
  '333oh': 'oh', '333fm': 'fmc', '333mr': '3x3',
  '333bld': '3bld', '333ni': '3bld', '333mbld': 'mbld',
  '444bld': '4bld', '555bld': '5bld', '666bld': '6x6', '777bld': '7x7',
  pyra: 'pyra', skewb: 'skewb', sq1: 'sq1', mega: 'mega', clock: 'clock',
  // CFOP-step / LL training: 3x3 notation (EG is 2x2).
  cross: '3x3', f2l: '3x3', ll: '3x3', oll: '3x3', pll: '3x3',
  coll: '3x3', cmll: '3x3', zbll: '3x3',
  eg1: '2x2', eg2: '2x2',
};

/**
 * Map a timer EventId to the `/recon` event id, or null when no single puzzle
 * applies. Feed the result to `buildExternalLinks` from `@/lib/recon-utils`.
 */
export function toReconEventId(eventId: EventId): string | null {
  return TIMER_TO_RECON[eventId] ?? null;
}
