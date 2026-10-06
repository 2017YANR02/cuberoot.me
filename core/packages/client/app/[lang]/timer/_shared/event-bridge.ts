/**
 * Event-id bridge (Solo + Battle) — one import site for WCA event mapping.
 *
 * Timer's EventId set (../_lib/types) is broader than WCA: it adds relays
 * (r3/r4/r5), CFOP-step training (cross/f2l/ll/oll/pll), LL-subset training
 * (coll/cmll/zbll/eg1/eg2), custom, and a few shape mods. rank/preview UIs
 * only understand real WCA event ids, so map there and return null for the
 * rest.
 */

import { toWcaEventId, isWcaEvent, eventDisplayName } from '@/lib/wca-events';

export { toWcaEventId, isWcaEvent, eventDisplayName };

export { toWcaEventForRank } from '@cuberoot/shared/timer/rank-client';
