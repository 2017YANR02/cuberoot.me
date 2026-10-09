import type { EventId } from './types';
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
